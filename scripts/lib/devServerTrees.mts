/**
 * WHICH DEV SERVER IS WHOSE, AND WHICH PROCESS ACTUALLY ENDS ONE.
 *
 * # The mistake this exists to make impossible
 *
 * `pnpm dev` is `tsx watch server/_core/index.ts`. That is **two** processes: a
 * WATCHER, which owns the lifecycle, and a CHILD, which holds the port. Every
 * instrument a person reaches for — `netstat -ano | findstr :300` — names the
 * CHILD, and killing the child is not killing the server: the watcher notices
 * and starts another one, on whatever port is free.
 *
 * So a shift that "cleaned up" leaves the watcher running, and the next file it
 * edits respawns a server somewhere new. Three consecutive seats have done
 * exactly this, the last two of them AFTER reading a written warning about it
 * (opus-1101 §4, opus-1105 §5.4, opus-1108 §5). At the worst moment there were
 * four servers listening and a paid browser drive hit a stale one, which is how
 * an instrumented run came back with no instrumentation in it.
 *
 * A fourth warning is not a fix. This is the mechanical form: the selection
 * below is a pure function of a process table, so *"kill the roots, never the
 * listeners"* is a thing the code does rather than a thing somebody remembers.
 *
 * # ⚠ ONE `pnpm dev` IS NOT TWO PROCESSES — IT IS NINE, AND TWO OF THEM ARE
 * # SHELLS (#658)
 *
 * The paragraph above is true and was not the whole truth. `pnpm dev` runs
 * `cross-env`, which starts the watcher **through a `cmd.exe`**, and the
 * `cross-env` process carries the watch command as its own arguments — so ONE
 * server holds TWO processes that every command-line test calls a watcher,
 * with a shell between them. A process table filtered to `node.exe` cannot see
 * that shell, so the inner watcher looked parentless and was promoted to a root
 * of its own: **one server, two rows.** On 2026-09-07 the reader said eleven
 * where seven were running.
 *
 * The repair is in `owningRoot`, which carries the measured chain: read the
 * WHOLE table, walk the ancestry through anything, and let the outermost
 * watcher own everything beneath it. `isNodeProcess` is the other half — a
 * `cmd.exe` repeats the command line it was given, so once the whole table is
 * in hand the shells match the watcher predicates too.
 *
 * # And the second half: whose is it?
 *
 * The founder runs his own dev server on this machine and it must never be
 * killed by a shift's cleanup. There is no ownership flag on a process, so the
 * honest discriminator is TIME: a root born before this shift started is not
 * this shift's. `rootsStartedAfter` takes that cutoff explicitly rather than
 * guessing at it, and the caller has to say when its shift began — which is a
 * fact it knows and a process table does not.
 */

/** One process, as a Windows process table reports it. */
export type ProcessRow = {
  readonly pid: number;
  readonly parentPid: number;
  /** When it was created. */
  readonly startedAt: Date;
  /** The executable, e.g. `node.exe` or `cmd.exe` — see `ONE `pnpm dev`` above. */
  readonly name: string;
  readonly commandLine: string;
};

/** A dev-server watcher and everything it owns. */
export type DevServerTree = {
  /** The WATCHER — the process to kill. Killing anything else is temporary. */
  readonly rootPid: number;
  readonly startedAt: Date;
  /** The children it has spawned, newest last. One of them holds the port. */
  readonly childPids: readonly number[];
};

/**
 * A node process, and nothing else.
 *
 * ⚠ It is a real gate rather than a tidiness one (#658). Every `cmd.exe` hop
 * in the chain above carries the whole command line as its own — measured:
 * `cmd.exe /d /s /c "tsx ^^^"watch^^^" ^^^"server/_core/index.ts^^^""` — so the
 * command-line predicates below match a shell as readily as the process it
 * started. Read a table of node processes only and this never came up; read the
 * whole table, which the ancestry walk needs, and without this every dev server
 * grows two more roots.
 */
function isNodeProcess(row: ProcessRow): boolean {
  return /^node(\.exe)?$/i.test(row.name.trim());
}

/**
 * Is this row a `tsx watch` invocation of the dev server?
 *
 * Matched on the WATCH verb and the entrypoint together. `tsx` alone would
 * match every disposable script in this repository, and the entrypoint alone
 * would match the child — which is the whole thing being told apart.
 *
 * ⚠ It answers *is this a watcher*, NOT *is this a tree's root* — one
 * `pnpm dev` satisfies it TWICE (the `cross-env` process carries the watch
 * command as its arguments). `devServerTrees` decides which of them is a root;
 * see `owningRoot`.
 */
export function isDevServerRoot(row: ProcessRow): boolean {
  if (!isNodeProcess(row)) return false;
  const line = row.commandLine.replace(/\\/g, "/");
  return /\btsx\b/.test(line)
    && /(^|["'\s])watch(["'\s]|$)/.test(line)
    && /server\/_core\/index\.ts/.test(line);
}

/**
 * A child the watcher spawned to actually serve — the process that holds the
 * port, and the one a `netstat` reading names.
 *
 * It runs the same entrypoint and does NOT carry the watch verb, which is the
 * only difference between the two in a process table.
 */
export function isDevServerChild(row: ProcessRow): boolean {
  return isNodeProcess(row)
    && !isDevServerRoot(row)
    && /server\/_core\/index\.ts/.test(row.commandLine.replace(/\\/g, "/"));
}

/**
 * Every process between this one and the top of the table, nearest first.
 *
 * It walks through processes of ANY kind, which is the repair: the hops between
 * a dev server's own processes are `cmd.exe`, and a walk that can only see node
 * loses the chain at the first of them.
 *
 * ⚠ **A parent that started AFTER its child is not that child's parent** — it
 * is a recycled pid, and Windows recycles them freely. The walk stops there
 * rather than attributing a live server to whatever now holds the number.
 */
function ancestorsOf(rows: readonly ProcessRow[], row: ProcessRow): ProcessRow[] {
  const index = new Map(rows.map((one) => [one.pid, one]));
  const chain: ProcessRow[] = [];
  const seen = new Set<number>([row.pid]);
  let child = row;
  for (;;) {
    const parent = index.get(child.parentPid);
    if (!parent || seen.has(parent.pid)) break;
    /*
      ⚠ AN UNREADABLE CREATION DATE STOPS THE WALK RATHER THAN PASSING IT —
      PR #659 review, note 2. `NaN > x` is `false`, so a row whose date the
      process table would not give up sailed through the guard below and could
      adopt whatever now holds its parent's pid. Stopping costs an over-count
      at worst, which is the direction this module fails in on purpose.
    */
    const parentAt = parent.startedAt.getTime();
    const childAt = child.startedAt.getTime();
    if (Number.isNaN(parentAt) || Number.isNaN(childAt)) break;
    if (parentAt > childAt) break;
    seen.add(parent.pid);
    chain.push(parent);
    child = parent;
  }
  return chain;
}

/**
 * ⚠ WHICH TREE A PROCESS BELONGS TO — the answer #658 was filed for.
 *
 * `pnpm dev` is `cross-env NODE_ENV=development tsx watch server/_core/index.ts`,
 * and the chain that produces on this machine is nine deep. Measured, one dev
 * server, 2026-09-08:
 *
 *     node  cross-env.js NODE_ENV=development tsx watch server/_core/index.ts
 *       └ cmd.exe  /c "tsx ^"watch^" ^"server/_core/index.ts^""
 *           └ node  tsx/dist/cli.mjs "watch" "server/_core/index.ts"
 *               └ node  --require tsx/dist/preflight.cjs server/_core/index.ts   ← the port
 *
 * **Two of those four are watchers by every command-line test there is**, and
 * the `cmd.exe` between them hid the relationship from a node-only table: the
 * inner watcher's parent appeared not to exist, so it was promoted to a root
 * beside the process that started it. **One server read as two trees** — the
 * night of 2026-09-07 it reported ELEVEN where seven were running, and killing
 * seven roots ended all eleven rows.
 *
 * So the outermost watcher in a process's ancestry owns it, and anything with
 * a watcher above it is not a root. Returns the row itself when it is a watcher
 * with no watcher above it, and null when the row belongs to no tree at all.
 */
export function owningRoot(rows: readonly ProcessRow[], row: ProcessRow): ProcessRow | null {
  const watchersAbove = ancestorsOf(rows, row).filter(isDevServerRoot);
  if (watchersAbove.length > 0) return watchersAbove[watchersAbove.length - 1];
  return isDevServerRoot(row) ? row : null;
}

/**
 * Every dev-server tree in this table, oldest root first.
 *
 * `childPids` holds everything the root owns — the nested watcher as well as
 * the server child that holds the port — because the whole point of naming a
 * root is that killing it takes ALL of them, and a listing that hid the middle
 * of the tree is what made a hand count unreliable.
 */
export function devServerTrees(rows: readonly ProcessRow[]): DevServerTree[] {
  const owners = new Map<ProcessRow, ProcessRow | null>();
  const ownerOf = (row: ProcessRow) => {
    if (!owners.has(row)) owners.set(row, owningRoot(rows, row));
    return owners.get(row) ?? null;
  };
  const oldestFirst = (a: { startedAt: Date }, b: { startedAt: Date }) =>
    a.startedAt.getTime() - b.startedAt.getTime();

  return rows
    .filter((row) => isDevServerRoot(row) && ownerOf(row) === row)
    .map((root) => ({
      rootPid: root.pid,
      startedAt: root.startedAt,
      childPids: rows
        .filter((row) => row !== root
          && (isDevServerRoot(row) || isDevServerChild(row))
          && ownerOf(row) === root)
        .sort(oldestFirst)
        .map((row) => row.pid),
    }))
    .sort(oldestFirst);
}

/**
 * The trees this shift started, and no others.
 *
 * `after` is the shift's own start, passed in by the caller — see the header on
 * why it is not inferred. A tree born exactly at the cutoff counts as this
 * shift's: a cleanup that leaves one of its own behind is the failure this
 * module exists to prevent, and a cleanup that asks about one extra is a
 * question rather than a loss.
 */
export function rootsStartedAfter(
  rows: readonly ProcessRow[],
  after: Date,
): DevServerTree[] {
  return devServerTrees(rows).filter((tree) => tree.startedAt.getTime() >= after.getTime());
}

/**
 * ⚠ THE REFUSAL, and it is the point of the whole module.
 *
 * A pid somebody read off `netstat` is a CHILD. Handed one, this says so and
 * names the root it belongs to, rather than killing it and letting the watcher
 * quietly replace it thirty seconds later.
 *
 * Returns the roots to kill, or a refusal naming every pid that was not one.
 */
export function rootsToKill(
  rows: readonly ProcessRow[],
  pids: readonly number[],
): { kind: "kill"; rootPids: number[] } | { kind: "refused"; reason: string } {
  const trees = devServerTrees(rows);
  const rootPids = new Set(trees.map((tree) => tree.rootPid));
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const wrong: string[] = [];
  for (const pid of pids) {
    if (rootPids.has(pid)) continue;
    const row = byPid.get(pid);
    const owner = trees.find((tree) => tree.childPids.includes(pid))
      /*
        ⚠ AND A SHELL HOP IS INSIDE THE TREE TOO, though `childPids` cannot
        show it — PR #659 review, note 1. `childPids` holds node processes, so
        the `cmd.exe` between the two watchers was refused with *"not a
        dev-server process at all"*, which is true of the LIST and false of the
        machine: somebody reading that would reasonably go and kill it by hand,
        orphaning the watcher below it. The ownership walk knows better, so it
        is asked.
      */
      ?? (row ? trees.find((tree) => tree.rootPid === owningRoot(rows, row)?.pid) : undefined);
    if (!owner) {
      wrong.push(`${pid} is not a dev-server process at all.`);
      continue;
    }
    /* Three ways to be inside a tree and none of them is the pid to kill: the
       server that holds the port, the inner `tsx watch` the root started
       through a shell, and the shell itself. */
    if (row && isDevServerChild(row)) {
      wrong.push(
        `${pid} is a dev server's CHILD — its watcher ${owner.rootPid} would start another one. Kill ${owner.rootPid}.`,
      );
    } else if (row && isDevServerRoot(row)) {
      wrong.push(
        `${pid} is the inner watcher INSIDE dev server ${owner.rootPid}'s tree — ${owner.rootPid} started it and is the pid to kill.`,
      );
    } else {
      wrong.push(
        `${pid} is a shell inside dev server ${owner.rootPid}'s tree — killing it orphans the watcher below it. Kill ${owner.rootPid}.`,
      );
    }
  }
  if (wrong.length > 0) return { kind: "refused", reason: wrong.join("\n") };
  return { kind: "kill", rootPids: [...new Set(pids)] };
}

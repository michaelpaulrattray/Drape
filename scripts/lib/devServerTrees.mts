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
 *
 * # ⚠ AND A DEV SERVER WITH NO WATCHER AT ALL READ AS A CLEAN MACHINE (#783)
 *
 * Everything above is about telling a watcher from its child. A server started
 * WITHOUT the watch verb — `npx tsx server/_core/index.ts`, which is what a
 * crashed or hand-started run leaves behind — has no watcher anywhere in its
 * ancestry, so it was neither a root nor a child by the tests above and was
 * **dropped from the listing entirely**. A dropped tree and a clean machine
 * print the same sentence.
 *
 * Measured on this machine, 2026-09-11, the two readings taken in the same
 * second: `netstat` said `0.0.0.0:3000 LISTENING 45988`, and this module's
 * caller said *"no dev server is running on this machine."* **Four consecutive
 * shifts read that answer over a live server and reported the machine clean.**
 *
 * So a tree is now anything the ENTRYPOINT names, and the watch verb decides
 * only whether it is `watched` — which is the fact that matters when killing,
 * because a watcher restarts what you kill and nothing else does.
 *
 * # Which tree, when the directory it was launched from is gone
 *
 * The specimen was started from a shift worktree that has since been deleted,
 * and that is the one fact that made killing it safe: it cannot be anyone's
 * live work. A process table has no working directory, but every dev server
 * here runs through `tsx`, and the path it loaded `tsx` from is written in its
 * own command line — so `launchDirectoryOf` reads that, and a caller with a
 * file system decides whether it still exists. The module stays pure.
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

/** A dev server, and everything one pid ends. */
export type DevServerTree = {
  /** The process to kill. Killing anything else is temporary, or partial. */
  readonly rootPid: number;
  readonly startedAt: Date;
  /** The children it has spawned, newest last. One of them holds the port. */
  readonly childPids: readonly number[];
  /**
   * Does a WATCHER own this tree?
   *
   * `true` is `pnpm dev` — kill a child and it starts another one. `false` is
   * a server run straight off the entrypoint, which nothing restarts and which
   * this module could not see at all until #783.
   */
  readonly watched: boolean;
  /**
   * The directory this tree loaded `tsx` from — its worktree, in practice —
   * or null when no row in it names one.
   *
   * Read out of the command lines, because a process table carries no working
   * directory. A caller that can touch a file system turns this into the one
   * verdict a shift may act on alone: **the directory is gone, so this is
   * nobody's live work.**
   */
  readonly launchedFrom: string | null;
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
 * A node process running the dev server, watcher or not.
 *
 * ⚠ **The predicate #783 was missing.** The two above are a partition of the
 * `pnpm dev` shape and answer *which half is this*; nothing answered *is this a
 * dev server at all*, so a tree made only of the second half — an unwatched
 * server and the `tsx` cli that started it — matched no root and belonged to no
 * root, and fell out of the listing without a word.
 */
function isDevServerProcess(row: ProcessRow): boolean {
  return isDevServerRoot(row) || isDevServerChild(row);
}

/**
 * ⚠ WHERE A TREE WAS LAUNCHED FROM, read out of its own command line.
 *
 * A process table gives no working directory, and the specimen that produced
 * #783 had been launched from a shift worktree that was later deleted — which
 * is the one fact that made killing it safe, because a directory that is gone
 * cannot be anybody's live work. What every one of these processes DOES carry
 * is the path it loaded `tsx` from, and on this machine that path begins at the
 * tree it was started in.
 *
 * Measured rows, verbatim, 2026-09-11 and 2026-09-08:
 *
 *     node "C:/Users/Admin/Drape/node_modules/.bin//../.pnpm/tsx@4.20.6/…/cli.mjs" server/_core/index.ts
 *     node.exe --require C:/Users/Admin/Drape/node_modules/.pnpm/tsx@4.20.6/…/preflight.cjs …
 *
 * ⚠ **The `node_modules` nearest the front of the line is not always the right
 * one, which is why the remainder has to name `tsx`.** An `npx` launch puts
 * npm's own global install first — `…/AppData/Roaming/npm/node_modules/npm/bin/npx-cli.js`
 * — and reading that would name a directory with nothing to do with the server,
 * and would report it PRESENT while the worktree it actually ran from was gone.
 * That is this card's own defect arriving through the reader written to fix it.
 *
 * Returns forward-slashed, which every Windows file API accepts.
 */
export function launchDirectoryOf(commandLine: string): string | null {
  const line = commandLine.replace(/\\/g, "/");
  const paths = /([A-Za-z]:\/[^"';\s]*?)\/node_modules\/([^"';\s]*)/g;
  for (const match of line.matchAll(paths)) {
    if (/\btsx\b/i.test(match[2])) return match[1];
  }
  return null;
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
 *
 * ⚠ **AND A TREE WITH NO WATCHER IN IT AT ALL IS STILL A TREE (#783).** The
 * second clause used to read `isDevServerRoot(row) ? row : null`, so a server
 * started without the watch verb was owned by nothing and owned nothing: it
 * answered null, `devServerTrees` filtered it away, and the listing said the
 * machine was clean over a live server on :3000. The rule is the same rule
 * either way — **the outermost dev-server process in the ancestry owns
 * everything below it** — with watchers preferred, because a watcher is the
 * only thing that restarts what you kill.
 */
export function owningRoot(rows: readonly ProcessRow[], row: ProcessRow): ProcessRow | null {
  const above = ancestorsOf(rows, row);
  const watchersAbove = above.filter(isDevServerRoot);
  if (watchersAbove.length > 0) return watchersAbove[watchersAbove.length - 1];
  const serversAbove = above.filter(isDevServerProcess);
  if (serversAbove.length > 0) return serversAbove[serversAbove.length - 1];
  return isDevServerProcess(row) ? row : null;
}

/**
 * Every dev-server tree in this table, oldest root first.
 *
 * `childPids` holds everything the root owns — the nested watcher as well as
 * the server child that holds the port — because the whole point of naming a
 * root is that killing it takes ALL of them, and a listing that hid the middle
 * of the tree is what made a hand count unreliable.
 *
 * ⚠ **A tree with no watcher in it is listed too, and says so (#783).** It is
 * the shape a crashed or hand-started run leaves — `npx tsx server/_core/index.ts`
 * — and until this it was not listed at all, so a live server read as an empty
 * machine. `watched` is the difference that matters to whoever is killing it.
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
    .filter((row) => isDevServerProcess(row) && ownerOf(row) === row)
    .map((root) => {
      const mine = rows
        .filter((row) => row !== root && isDevServerProcess(row) && ownerOf(row) === root)
        .sort(oldestFirst);
      return {
        rootPid: root.pid,
        startedAt: root.startedAt,
        childPids: mine.map((row) => row.pid),
        watched: isDevServerRoot(root),
        /* The root's own line first — but an `npx` launch names npm's global
           install and nothing else, so the tree answers for itself. */
        launchedFrom: [root, ...mine]
          .map((row) => launchDirectoryOf(row.commandLine))
          .find((where) => where !== null) ?? null,
      };
    })
    .sort(oldestFirst);
}

/**
 * ⚠ THE BACKSTOP, AND IT IS THE PART OF #783 THAT OUTLIVES #783.
 *
 * Everything above classifies command lines, and a classifier has exactly one
 * failure mode worth fearing here: a launch shape nobody anticipated is DROPPED,
 * and a dropped tree prints the same sentence as a clean machine. Widening the
 * predicates fixes the shape that has already bitten; it cannot fix the next
 * one.
 *
 * `netstat` is the ground truth and does not care how a process was started. So
 * a pid LISTENING on the studio's port family that belongs to no tree this
 * module can see is reported as exactly that — **a hole in this reader**, not a
 * clean machine. On 2026-09-11 that reading was available and nothing compared
 * the two: `park-state.mts` printed *"1 listener(s) on :300x"* in the same
 * minute this module's caller printed *"no dev server is running"*, and four
 * shifts believed the second one.
 *
 * The family is 3000–3009: `PORT` defaults to 3000 and the dev server takes the
 * next free port when it is busy, which is how four of them once ended up
 * listening at once.
 */
export function listenersOutsideEveryTree(
  trees: readonly DevServerTree[],
  ports: ReadonlyMap<number, readonly number[]>,
): { pid: number; ports: number[] }[] {
  const known = new Set(trees.flatMap((tree) => [tree.rootPid, ...tree.childPids]));
  const found: { pid: number; ports: number[] }[] = [];
  for (const [pid, held] of ports) {
    if (known.has(pid)) continue;
    const studio = held.filter((port) => port >= 3000 && port <= 3009);
    if (studio.length > 0) found.push({ pid, ports: [...studio].sort((a, b) => a - b) });
  }
  return found.sort((a, b) => a.pid - b.pid);
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
 * ⚠ THE PIDS THE OPERATOR NAMED, before any of them is treated as a number.
 *
 * `--kill`'s value was read with `.split(",").map(Number).filter(Boolean)`, and
 * both `NaN` and `0` are falsy — so `--kill abc`, `--kill 0` and `--kill ""`
 * each became an EMPTY target list, killed nothing, and exited 0 having printed
 * the trees still standing. An operator reads that as a cleanup that ran.
 *
 * Worse in the mixed case: `--kill 22316,abc` dropped the word it could not
 * read and killed the rest, so a typo bought a PARTIAL cleanup silently — the
 * same outcome `rootsToKill`'s whole-batch refusal already exists to prevent,
 * arriving one step earlier than that function can see.
 *
 * Filed as #642's declared remainder by PR #670's review, which named it a
 * judgement rather than a conversion: the parse it sits behind catches the
 * MISSING-value spelling (`--kill` with nothing after it) and not the UNUSABLE
 * one. A pid is a positive whole number; every other word is refused and quoted
 * back, because a refusal that does not say which word was wrong sends the
 * operator to re-read their own command line.
 */
export function pidsNamed(
  said: string,
): { kind: "pids"; pids: number[] } | { kind: "refused"; reason: string } {
  const words = said.split(",").map((one) => one.trim());
  const unusable = words.filter((word) => !/^[1-9][0-9]*$/.test(word));
  if (unusable.length > 0) {
    const quoted = unusable.map((word) => `"${word}"`).join(", ");
    return {
      kind: "refused",
      reason: `--kill was given ${quoted}, which ${unusable.length === 1 ? "is not a pid" : "are not pids"}.`
        + ` A pid is a positive whole number. Nothing was killed —`
        + ` run this with no arguments to see the roots and their pids.`,
    };
  }
  return { kind: "pids", pids: words.map((word) => Number(word)) };
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
  /*
    ⚠ AN EMPTY LIST IS NEVER A KILL INSTRUCTION (#642 remainder). The loop below
    simply does not run on one, so this used to answer `{ kind: "kill",
    rootPids: [] }` — a verdict saying "go ahead" about nothing. `pidsNamed`
    now stops every route that produced an empty list, and this is the guard at
    the point where the decision is actually made rather than at the one caller
    that happens to exist today.
  */
  if (pids.length === 0) {
    return { kind: "refused", reason: "no pid was named, so there is nothing to kill." };
  }
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
    if (row && isDevServerChild(row) && !owner.watched) {
      /* ⚠ NOT the sentence below it, because it would not be true (#783). An
         unwatched tree restarts nothing — killing this pid ends the serving and
         leaves the process that started it standing, which is litter rather
         than a resurrection. Say what actually happens. */
      wrong.push(
        `${pid} is inside dev server ${owner.rootPid}'s tree, which has NO watcher —`
        + ` nothing would restart it, but killing ${pid} alone leaves ${owner.rootPid} behind.`
        + ` Kill ${owner.rootPid}.`,
      );
    } else if (row && isDevServerChild(row)) {
      wrong.push(
        `${pid} is a dev server's CHILD — its watcher ${owner.rootPid} would start another one. Kill ${owner.rootPid}.`,
      );
    } else if (row && isDevServerRoot(row)) {
      wrong.push(
        `${pid} is the inner watcher INSIDE dev server ${owner.rootPid}'s tree — ${owner.rootPid} started it and is the pid to kill.`,
      );
    } else {
      wrong.push(
        /* "what is below it" rather than "the watcher below it": an unwatched
           tree has no watcher, and the sentence must stay true of both. */
        `${pid} is a shell inside dev server ${owner.rootPid}'s tree — killing it orphans what is below it. Kill ${owner.rootPid}.`,
      );
    }
  }
  if (wrong.length > 0) return { kind: "refused", reason: wrong.join("\n") };
  return { kind: "kill", rootPids: [...new Set(pids)] };
}

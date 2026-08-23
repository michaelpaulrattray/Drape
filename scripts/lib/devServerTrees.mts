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
 * Is this row the `tsx watch` that owns a dev server?
 *
 * Matched on the WATCH verb and the entrypoint together. `tsx` alone would
 * match every disposable script in this repository, and the entrypoint alone
 * would match the child — which is the whole thing being told apart.
 */
export function isDevServerRoot(row: ProcessRow): boolean {
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
  return !isDevServerRoot(row) && /server\/_core\/index\.ts/.test(row.commandLine.replace(/\\/g, "/"));
}

/** Every dev-server tree in this table, oldest root first. */
export function devServerTrees(rows: readonly ProcessRow[]): DevServerTree[] {
  const roots = rows.filter(isDevServerRoot);
  const children = rows.filter(isDevServerChild);
  return roots
    .map((root) => ({
      rootPid: root.pid,
      startedAt: root.startedAt,
      childPids: children
        .filter((child) => child.parentPid === root.pid)
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .map((child) => child.pid),
    }))
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
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
  const wrong: string[] = [];
  for (const pid of pids) {
    if (rootPids.has(pid)) continue;
    const owner = trees.find((tree) => tree.childPids.includes(pid));
    wrong.push(owner
      ? `${pid} is a dev server's CHILD — its watcher ${owner.rootPid} would start another one. Kill ${owner.rootPid}.`
      : `${pid} is not a dev-server process at all.`);
  }
  if (wrong.length > 0) return { kind: "refused", reason: wrong.join("\n") };
  return { kind: "kill", rootPids: [...new Set(pids)] };
}

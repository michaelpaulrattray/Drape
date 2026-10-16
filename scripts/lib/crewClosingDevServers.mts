/**
 * DID THIS SHIFT LEAVE ITS OWN DEV SERVER RUNNING — asked at the close, which is
 * the last moment anybody knows whose it was (#2563).
 *
 * # The class, and why a sweep kept being the answer
 *
 * `scripts/dev-servers.mts` has been able to list and kill these since #783,
 * and it is a good instrument. It has **no mechanical caller** — a shift runs it
 * if a shift remembers to. The standing orders do say *"kill every process you
 * started"*, and skipping that step leaves no failing test, no error and no
 * trace: the only evidence is a process table nobody reads until somebody goes
 * looking.
 *
 * So the population accumulates and is found LATER, by a patrol, in somebody
 * else's worktree — at which point the one fact that would make clearing it
 * safe, *whose is it*, is gone. **#1481 swept two stacks on 2026-09-29 and
 * filed the prevention as a separate question. Seventeen days later there were
 * seven, across four trees, and #2563 declined to sweep them for exactly the
 * reason the delay creates: "none is mine ... killing another session's
 * processes is not reversible by the person who finds them."** Both refusals
 * were correct. The remedy was being applied where only a prevention can work.
 *
 * # What this asks, and the one fact it has that a patrol does not
 *
 * There is no ownership flag on a process — `devServerTrees`'s own header says
 * so, and names TIME as the honest discriminator, which is why
 * `dev-servers.mts --since` makes the operator state when their shift began.
 *
 * **A closing run row already carries that number.** `startedAt` is when this
 * shift opened its row, so a dev server tree born at or after it was born
 * during this shift — and no patrol arriving tomorrow can reconstruct that.
 * The cutoff is read from the row rather than asked for, which is the whole
 * reason this check belongs here and nowhere else.
 *
 * ⚠ **IT NAMES AND NEVER KILLS, and that is not timidity.** Up to four builder
 * seats run in one pass, so *started after my row opened* also catches a
 * lane-mate's tree that is alive and in use. Time cannot tell those apart —
 * only the launch DIRECTORY can, and only a person reading it knows which tree
 * is theirs. So the finding prints each root with its directory and lets the
 * shift decide. A check that kills on a time comparison would eventually kill a
 * working seat's server mid-shift, which is a far worse failure than litter.
 *
 * ⚠ **AND IT NEVER COSTS A SHIFT ITS CLOSE** — this script's standing rule: the
 * read comes back as a reading rather than a throw, and an unreadable process
 * table prints its reason and carries no exit code. A check that can cost a
 * shift its close is a check that gets skipped, and the row being terminal
 * matters more than the discipline note (#288 — an open row reads on his page
 * as a shift still running).
 */
import { execFileSync } from "node:child_process";

import {
  PROCESS_TABLE_QUERY,
  processRowsFromJson,
  rootsStartedAfter,
  type DevServerTree,
} from "./devServerTrees.mts";

/** What the close learned, including "nothing, and here is why". */
export type ClosingDevServerReading =
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "read"; readonly trees: readonly DevServerTree[] };

/**
 * The trees born at or after `since`.
 *
 * ⚠ `rootsStartedAfter` is INCLUSIVE of the boundary and that is the right edge
 * here: a shift's first act after opening its row can be `pnpm dev`, and a tree
 * stamped in the same second as the row is this shift's.
 */
export function readClosingDevServers(
  since: Date,
  say: (line: string) => void,
): ClosingDevServerReading {
  let raw: string;
  try {
    raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", PROCESS_TABLE_QUERY], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (cause) {
    const reason = `the process table could not be read (${String((cause as Error).message).split("\n")[0].slice(0, 120)})`;
    say(`\n⚠ ${reason}, so whether this shift left a dev server running is UNKNOWN —`);
    say("  not \"nothing is running\". Look by hand: npx tsx scripts/dev-servers.mts");
    return { kind: "unreadable", reason };
  }
  const read = processRowsFromJson(raw);
  if (read.kind === "refused") {
    say(`\n⚠ the process table was refused by its own reader (${read.reason.split("\n")[0].slice(0, 120)}),`);
    say("  so whether this shift left a dev server running is UNKNOWN. npx tsx scripts/dev-servers.mts");
    return { kind: "unreadable", reason: read.reason };
  }
  return { kind: "read", trees: rootsStartedAfter(read.rows, since) };
}

/**
 * The finding, or null when there is nothing to say.
 *
 * Pure, so an arm can hold the wording without a Windows process table — which
 * is the half of this that a test can actually reach, `.agents/` and a live
 * machine being what they are.
 */
export function closingDevServerFinding(args: {
  readonly runId: number;
  readonly reading: ClosingDevServerReading;
}): string | null {
  if (args.reading.kind === "unreadable") return null;
  const trees = args.reading.trees;
  if (trees.length === 0) return null;
  const roots = trees.map((tree) => tree.rootPid);
  const lines = [
    `\n⚠ FINDING — run #${args.runId} is closing with ${trees.length} dev server tree(s) still running`,
    "  that were started at or after this row opened, so they are very likely this shift's:",
  ];
  for (const tree of trees) {
    lines.push(
      `    root ${tree.rootPid}  started ${tree.startedAt.toLocaleString()}`
      + `  from ${tree.launchedFrom ?? "a directory its command lines do not name"}`,
    );
  }
  lines.push(
    "",
    "  Each one holds a file watcher over a whole checkout and outlives this shift. Seven of",
    "  these were resident across four finished seats' worktrees on 2026-10-16 (#2563), and two",
    "  on 2026-09-29 (#1481) — found by a patrol days later, by which time nobody could prove",
    "  whose they were and neither card dared clear them.",
    "",
    "  ⚠ READ THE DIRECTORIES FIRST. Up to four seats run in one pass, so a tree above may be a",
    "  lane-mate's and still in use — this check compares start times and cannot tell.",
    "    npx tsx scripts/dev-servers.mts     what is running, from where, and which watchers are idle",
    "  and then, for the roots above that you have proven are yours:",
    `    npx tsx scripts/dev-servers.mts --kill ${roots.join(",")}`,
    "  Kill the ROOT, never the pid netstat shows you — that one is a child and the watcher",
    "  starts another.",
  );
  return lines.join("\n");
}

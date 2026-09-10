/**
 * THE DEV SERVERS ON THIS MACHINE — who owns them, and what actually ends one.
 *
 * `pnpm dev` is a WATCHER plus a CHILD. `netstat` names the child; killing the
 * child leaves the watcher, which starts another one on the next file you edit.
 * Three consecutive seats have made that mistake, the last two after reading a
 * written warning, so this is the mechanical form of the warning:
 * `scripts/lib/devServerTrees.mts` decides, and it refuses a child's pid by
 * name rather than killing it.
 *
 * It reads processes and kills them. It touches no database and no network, so
 * it declares no world; the only thing it asks a file system is whether a
 * directory a process names still exists (#783).
 *
 *   npx tsx scripts/dev-servers.mts                  list every tree, with ports
 *   npx tsx scripts/dev-servers.mts --since 14:30    kill the ones started since
 *   npx tsx scripts/dev-servers.mts --kill 1234      kill these ROOTS by pid
 *
 * `--since` is how a shift kills its own and leaves the founder's alone: there
 * is no ownership flag on a process, so the honest discriminator is when your
 * shift began. Say it; do not guess it.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  devServerTrees,
  listenersOutsideEveryTree,
  portsOfTree,
  rootsStartedAfter,
  pidsNamed,
  rootsToKill,
  type ProcessRow,
} from "./lib/devServerTrees.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

function powershell(command: string): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/**
 * EVERY process on the machine, as rows this module can reason about.
 *
 * ⚠ **Not `-Filter "Name='node.exe'"`, and that is the #658 fix.** `pnpm dev`
 * starts its watcher through a `cmd.exe`, so a node-only table loses the link
 * between the two halves of one server and reports each as a tree of its own.
 * The ancestry walk needs the shells, so the filter comes off; a row whose
 * command line is unreadable (another user's, a system process) still carries
 * its pid and parent, which is all the walk asks of it.
 */
function processTable(): ProcessRow[] {
  const raw = powershell(
    "Get-CimInstance Win32_Process "
    + "| Select-Object ProcessId,ParentProcessId,Name,CreationDate,CommandLine | ConvertTo-Json -Depth 3",
  ).trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .map((row: Record<string, unknown>) => ({
      pid: Number(row.ProcessId),
      parentPid: Number(row.ParentProcessId),
      name: typeof row.Name === "string" ? row.Name : "",
      /* PowerShell's JSON renders a CIM date as `/Date(1787…)/`; anything else
         is passed to Date as written rather than guessed at. */
      startedAt: new Date(
        typeof row.CreationDate === "string" && /\/Date\((\d+)/.test(row.CreationDate)
          ? Number(/\/Date\((\d+)/.exec(row.CreationDate)![1])
          : String(row.CreationDate),
      ),
      /* Empty, never the string "null": a process whose command line this
         account cannot read is a hop in the walk, not a candidate watcher. */
      commandLine: typeof row.CommandLine === "string" ? row.CommandLine : "",
    }));
}

/** Which port a pid is listening on, when it is listening on one. */
function portsByPid(): Map<number, number[]> {
  const held = new Map<number, number[]>();
  let raw = "";
  try {
    raw = execFileSync("netstat", ["-ano"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return held;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/.exec(line);
    if (!match) continue;
    const port = Number(match[1]);
    const pid = Number(match[2]);
    const ports = held.get(pid) ?? [];
    if (!ports.includes(port)) ports.push(port);
    held.set(pid, ports);
  }
  return held;
}

/** `14:30`, `2026-08-23T14:30`, or anything Date understands. */
function cutoffOf(said: string): Date {
  const clock = /^(\d{1,2}):(\d{2})$/.exec(said.trim());
  if (clock) {
    const when = new Date();
    when.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
    return when;
  }
  const when = new Date(said);
  if (Number.isNaN(when.getTime())) throw new Error(`--since could not read "${said}"`);
  return when;
}

/* ⚠ THE VOCABULARY, DECLARED ONCE (#642). Read out of this file's own usage
   block above, not guessed: `--since <clock>` and `--kill <pids>`. Before this,
   a mistyped `--kil 1234` was simply NOT SEEN - both `indexOf` reads returned
   -1, the script printed the trees and exited 0, and the operator read that as
   "nothing to kill" rather than "you typed it wrong". `--kill` with nothing
   after it was worse: it became an empty target list and killed nothing,
   silently. */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["since", "kill"],
  boolean: [],
});
const rows = processTable();
const trees = devServerTrees(rows);
const ports = portsByPid();

/**
 * ⚠ WHERE THE ONE VERDICT A SHIFT MAY ACT ON ALONE IS DECIDED (#783).
 *
 * The module is pure and reads a directory OUT of a command line; only here is
 * there a file system to ask whether it still exists. A dev server launched
 * from a worktree that has since been deleted cannot be anybody's live work —
 * which is the fact four shifts did not have when each of them decided the
 * process on :3001 was "not mine, not killed" and left it running.
 */
const describe = (tree: (typeof trees)[number], held: ReadonlyMap<number, number[]> = ports) => {
  /* ⚠ `portsOfTree`, never `childPids` — PR #784 review, finding 1. An
     unwatched tree's ROOT can be the port holder, and the backstop below cannot
     see that case because the pid does belong to a tree. */
  const listening = portsOfTree(tree, held).map((port) => `:${port}`);
  const abandoned = tree.launchedFrom !== null && !existsSync(tree.launchedFrom);
  return `  root ${String(tree.rootPid).padStart(6)}  started ${tree.startedAt.toLocaleString()}`
    + `  children [${tree.childPids.join(", ") || "none"}]`
    /* "between restarts" is a promise only a watcher can keep. An unwatched
       tree holding no port is not waiting to come back — it is litter. */
    + `  ${listening.length > 0
      ? listening.join(" ")
      : tree.watched ? "(no port — between restarts)" : "(no port — nothing is being served)"}`
    + (tree.watched ? "" : "\n         ⚠ NO WATCHER — started off the entrypoint, so nothing restarts it")
    + (abandoned
      ? `\n         ⚠ ABANDONED — launched from ${tree.launchedFrom}, which no longer exists.`
        + " Nobody's live work; safe to kill."
      : "")
    + (tree.launchedFrom === null
      ? "\n         (no launch directory in its command lines — whose it is cannot be read here)"
      : "");
};

/**
 * ⚠ SAY IT BEFORE ANY VERDICT ABOUT THE MACHINE, INCLUDING "CLEAN" (#783).
 *
 * `netstat` does not care how a process was started, so a listener this reader
 * cannot place is a hole in the READER. Printed on every road out of this
 * script, and the exit code is 2 so a caller that only reads codes still learns
 * the answer was incomplete — the same shape `patrol-clocks` and
 * `gate-stall-check` use for a finding.
 */

const sayUnplaced = (found: ReturnType<typeof listenersOutsideEveryTree>) => {
  if (found.length === 0) return;
  console.log(`\n⚠ ${found.length} process(es) LISTENING on the studio's ports belong to NO tree above:`);
  for (const one of found) {
    console.log(`     pid ${one.pid}  ${one.ports.map((port) => `:${port}`).join(" ")}`);
    console.log("       walk it: powershell -NoProfile -Command \"Get-CimInstance Win32_Process"
      + ` -Filter 'ProcessId=${one.pid}' | Select-Object CommandLine | Format-List"`);
  }
  console.log("  netstat is the ground truth here, so this is a hole in THIS READER, not a clean machine —");
  console.log("  which is exactly how #783 told four shifts the machine was clear over a live server.");
};

if (trees.length === 0) {
  const found = listenersOutsideEveryTree(trees, ports);
  console.log(found.length === 0
    ? "no dev server is running on this machine."
    : "this reader sees no dev server tree on this machine — and that is contradicted below.");
  sayUnplaced(found);
  process.exit(found.length === 0 ? 0 : 2);
}

console.log(`${trees.length} dev server tree(s), oldest first:`);
for (const tree of trees) console.log(describe(tree));
console.log("\n⚠ the pids netstat shows you are CHILDREN. Kill the ROOT or the watcher starts another.");
if (trees.some((tree) => !tree.watched)) {
  console.log("⚠ a tree marked NO WATCHER is a server started off the entrypoint — it was invisible here until #783.");
}

const since = ARGS.value("since");
const kill = ARGS.value("kill");
if (since === null && kill === null) {
  const found = listenersOutsideEveryTree(trees, ports);
  sayUnplaced(found);
  process.exit(found.length === 0 ? 0 : 2);
}

let targets: number[];
if (since !== null) {
  const cutoff = cutoffOf(since);
  const mine = rootsStartedAfter(rows, cutoff);
  console.log(`\nstarted at or after ${cutoff.toLocaleString()}:`);
  for (const tree of mine) console.log(describe(tree));
  if (mine.length === 0) {
    console.log("  none — nothing to kill.");
    /* ⚠ THE ROAD A CLOSING SHIFT ACTUALLY WALKS, so the contradiction has to
       reach it here too — "nothing to kill" is the same reassuring sentence in
       different words. */
    const found = listenersOutsideEveryTree(trees, ports);
    sayUnplaced(found);
    process.exit(found.length === 0 ? 0 : 2);
  }
  targets = mine.map((tree) => tree.rootPid);
} else {
  /* ⚠ Parsed by the module that owns the refusal, never here (#642 remainder).
     `.map(Number).filter(Boolean)` dropped NaN AND 0, so `--kill abc` reached
     rootsToKill as an empty list and this script exited 0 having killed
     nothing. */
  const named = pidsNamed(kill ?? "");
  if (named.kind === "refused") {
    console.error(`
REFUSING:
${named.reason}`);
    process.exit(1);
  }
  targets = named.pids;
}

const verdict = rootsToKill(rows, targets);
if (verdict.kind === "refused") {
  console.error(`\nREFUSING:\n${verdict.reason}`);
  process.exit(1);
}

for (const pid of verdict.rootPids) {
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8" });
    console.log(`killed tree ${pid}`);
  } catch (error) {
    console.log(`tree ${pid} was already gone (${String(error).split("\n")[0].slice(0, 80)})`);
  }
}

/* ⚠ RE-READ BOTH TABLES, not only the process one. `0 dev server tree(s) left`
   is the exact sentence a shift quotes into its close, so it is the last place
   a listener nobody can place may go unsaid. */
const leftRows = processTable();
const left = devServerTrees(leftRows);
/* ⚠ THE FRESH PORT TABLE REACHES THE LISTING TOO — PR #784 review, finding 2.
   It reached the backstop and not the lines above it, so a surviving watcher
   that had already restarted its child printed the reading taken before the
   kill, under a comment claiming both tables were re-read. */
const portsNow = portsByPid();
console.log(`\n${left.length} dev server tree(s) left:`);
for (const tree of left) console.log(describe(tree, portsNow));
const stillListening = listenersOutsideEveryTree(left, portsNow);
sayUnplaced(stillListening);
process.exit(stillListening.length === 0 ? 0 : 2);

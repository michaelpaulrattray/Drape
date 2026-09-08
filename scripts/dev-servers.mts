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
 * It reads processes and kills them. It touches no file, no database and no
 * network, so it declares no world.
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

import {
  devServerTrees,
  rootsStartedAfter,
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

const describe = (tree: (typeof trees)[number]) => {
  const listening = tree.childPids.flatMap((pid) => (ports.get(pid) ?? []).map((port) => `:${port}`));
  return `  root ${String(tree.rootPid).padStart(6)}  started ${tree.startedAt.toLocaleString()}`
    + `  children [${tree.childPids.join(", ") || "none"}]`
    + `  ${listening.length > 0 ? listening.join(" ") : "(no port — between restarts)"}`;
};

if (trees.length === 0) {
  console.log("no dev server is running on this machine.");
  process.exit(0);
}

console.log(`${trees.length} dev server tree(s), oldest first:`);
for (const tree of trees) console.log(describe(tree));
console.log("\n⚠ the pids netstat shows you are CHILDREN. Kill the ROOT or the watcher starts another.");

const since = ARGS.value("since");
const kill = ARGS.value("kill");
if (since === null && kill === null) process.exit(0);

let targets: number[];
if (since !== null) {
  const cutoff = cutoffOf(since);
  const mine = rootsStartedAfter(rows, cutoff);
  console.log(`\nstarted at or after ${cutoff.toLocaleString()}:`);
  for (const tree of mine) console.log(describe(tree));
  if (mine.length === 0) { console.log("  none — nothing to kill."); process.exit(0); }
  targets = mine.map((tree) => tree.rootPid);
} else {
  targets = (kill ?? "").split(",").map((one) => Number(one.trim())).filter(Boolean);
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

const left = devServerTrees(processTable());
console.log(`\n${left.length} dev server tree(s) left:`);
for (const tree of left) console.log(describe(tree));
process.exit(0);

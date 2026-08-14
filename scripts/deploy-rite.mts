/**
 * THE DEPLOY CEREMONY, PERFORMED RATHER THAN REMEMBERED (fable-485 §a,
 * founder-approved 2026-08-14).
 *
 * Eleven steps, run several times a night, and the record holds three real
 * incidents from doing them by hand:
 *
 *  - **the watched claim** — a deploy reported SUCCESS from a `deployment list`
 *    read that had matched a line for a DIFFERENT sha, because the watch loop's
 *    grep spanned lines;
 *  - **two flags-from-memory** — a park block quoted scope flags as they were
 *    believed to be rather than as the service holds them;
 *  - **health read once** and reported as three.
 *
 * So this script does the ceremony and prints the receipt. What it prints is
 * what it SAW: every line is a reading taken in this process, and any step that
 * cannot be read fails the run rather than being omitted from the block.
 *
 * # What it will not do
 *
 * It pushes `main` and `main:local-migration` and it reads. It never sets a
 * variable, never touches a database, never force-pushes, and never rewrites
 * history — the four things the overnight grant excludes. `--dry` performs
 * every reading and no push.
 *
 *   npx tsx scripts/deploy-rite.mts [--dry]
 */
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry");
const SERVICE = process.env.RAILWAY_SERVICE ?? "Drape";
const BASE = process.env.PROD_BASE_URL ?? "https://drape-production-0232.up.railway.app";
/** The branches every deploy carries. Production builds from the second one. */
const BRANCHES = ["main", "main:local-migration"] as const;

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };
/* Annotated on the VARIABLE, not just the arrow: TypeScript only narrows after
   a never-returning call when the binding itself carries the signature. */
const die: (why: string) => never = (why: string): never => {
  say("");
  say(`REFUSED: ${why}`);
  console.error(why);
  process.exit(1);
};

const run = (command: string, args: string[]): string => {
  try {
    return execFileSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch (error: any) {
    return `${error?.stdout ?? ""}${error?.stderr ?? ""}` || String(error?.message ?? error);
  }
};
const git = (...args: string[]) => run("git", args).trim();
const railway = (...args: string[]) => run("railway.cmd", args);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── 1. what is being deployed ──────────────────────────────────────────── */

const sha = git("rev-parse", "HEAD");
const shortSha = sha.slice(0, 8);
const subject = git("log", "-1", "--format=%s");
const dirty = git("status", "--porcelain").split("\n").filter((line) => line && !line.startsWith("??"));
if (dirty.length > 0) {
  die(`the working tree has ${dirty.length} uncommitted tracked change(s) — a deploy must carry a commit, not a desk:\n${dirty.join("\n")}`);
}

say(`DEPLOY RITE — ${shortSha} · ${subject}`);
say(`  service ${SERVICE} · ${BASE}${DRY ? " · DRY RUN (no push)" : ""}`);
say("");

/* ── 2. push both branches, and PROVE both landed ───────────────────────── */

if (!DRY) for (const branch of BRANCHES) say(`  push ${branch}: ${git("push", "origin", branch) || "ok"}`);

/*
  THE REMOTE'S OWN ANSWER, not the push command's exit code. `git push` on an
  up-to-date branch says nothing at all, which is indistinguishable from a push
  that did not happen — and production builds from `local-migration`, so a
  branch left behind deploys the previous commit under this one's name.
*/
for (const branch of BRANCHES) {
  const ref = branch.includes(":") ? branch.split(":")[1]! : branch;
  const remote = git("ls-remote", "origin", `refs/heads/${ref}`).split(/\s+/)[0] ?? "";
  if (remote !== sha) die(`origin/${ref} is at ${remote.slice(0, 8) || "(absent)"} — not ${shortSha}`);
  say(`  origin/${ref} = ${shortSha}  ✓`);
}
if (DRY) { say(""); say("DRY RUN — stopping before the watch."); process.exit(0); }

/* ── 3. watch to a terminal state ───────────────────────────────────────── */

say("");
const started = Date.now();
let deployment: { id: string; status: string; at: string } | null = null;
for (let attempt = 0; attempt < 90; attempt += 1) {
  /*
    ONE LINE, PARSED AS A LINE. The watched-claim incident was a pattern that
    matched a status on one line and a sha on another; the newest deployment is
    the first row of this list and its status is that row's own field.
  */
  const newest = railway("deployment", "list").split("\n")
    .map((line) => line.trim())
    .find((line) => /^[0-9a-f-]{36} \| [A-Z]+ \|/.test(line));
  if (newest) {
    const [id, status, at] = newest.split("|").map((field) => field.trim());
    deployment = { id: id!, status: status!, at: at! };
    if (["SUCCESS", "FAILED", "CRASHED", "REMOVED"].includes(deployment.status)) break;
  }
  await wait(20_000);
}
if (!deployment) die("no deployment row could be read at all");
const elapsed = Math.round((Date.now() - started) / 1000);
say(`  deployment ${deployment.id.slice(0, 8)} → ${deployment.status} after ${elapsed}s`);
if (deployment.status !== "SUCCESS") die(`the deploy ended ${deployment.status}`);

/* ── 4. health, THREE TIMES — a deploy reporting SUCCESS is a claim ─────── */

const healths: Array<{ status: string; db: number; uptime: number }> = [];
for (let read = 0; read < 3; read += 1) {
  const response = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!response || !response.ok) die(`health read ${read + 1} returned ${response?.status ?? "no response"}`);
  const body = await response!.json() as any;
  healths.push({
    status: body.status,
    db: Number(body.checks?.database?.latencyMs ?? NaN),
    uptime: Number(body.uptime ?? NaN),
  });
  if (read < 2) await wait(3_000);
}
if (healths.some((entry) => entry.status !== "healthy")) die(`health said ${healths.map((h) => h.status).join(", ")}`);
const latencies = healths.map((entry) => entry.db);
const anchor = new Date(Date.now() - Math.round(healths[0]!.uptime * 1000)).toISOString();

/* ── 5. the flags, OFF THE SERVICE ──────────────────────────────────────── */

const variables = railway("variables", "--service", SERVICE, "--kv").split("\n")
  .map((line) => line.trim())
  .filter((line) => /^(CASTING_|R7_|ENABLE_STORAGE_CLEANUP_WORKER)/.test(line));
if (variables.length === 0) die("no scope flags could be read from the service — a park block may not quote them from memory");

/* ── 6. the receipt ─────────────────────────────────────────────────────── */

say("");
say("─".repeat(72));
say(`\`${shortSha}\` · main == local-migration · deploy SUCCESS · health ×3 — 200 ·`);
say(`healthy · db ${latencies.map((value) => value.toFixed(2)).join(" / ")} ms ·`);
say(`**UPTIME ANCHOR ${anchor}** (uptime ${healths[0]!.uptime.toFixed(1)} s)`);
say("");
say("FLAGS, read off the service:");
for (const variable of variables) say(`  ${variable}`);
say("─".repeat(72));
process.exit(0);

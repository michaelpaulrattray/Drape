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
/*
  THE RITE READS `.env` FOR ONE THING: the OpenRouter key, so the balance line
  is a reading rather than an UNREAD. It was added when the line's first live
  run printed `UNREAD — OPENROUTER_API_KEY not set in this process`, which was
  the honest failure mode doing its job and not the intent.

  Safe here, and checked rather than assumed: this script never reads
  `DATABASE_URL`. Both of its database reads take the production URL explicitly
  from `railway variables --service MySQL` and pass it to `openDatabase(url)`,
  so nothing it does can fall back to the dev database that `.env` names.
*/
import "dotenv/config";
import { execFileSync } from "node:child_process";

import { openDatabase } from "./lib/dbConnection.mts";
import { uptimeAnchor } from "./lib/uptimeAnchor.mts";
import { balanceLine, readOpenRouterBalance, readOpenRouterUsage } from "./lib/openrouterBalance.mts";
import {
  falLine,
  priceFalCalls,
  readFalBalance,
  readFalPrices,
  readFalTraffic,
} from "./lib/falSpend.mts";

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

/*
  `shell` is not a style choice on Windows: `railway.cmd` is a batch file, and
  `execFileSync` without a shell cannot resolve one from PATH — it returns the
  spawn error as text, which reads exactly like a command that ran and said
  nothing. The first run of this script watched a deploy that had already
  succeeded for thirty minutes because of it.
*/
const run = (command: string, args: string[], shell = false): string => {
  try {
    return execFileSync(command, args, { encoding: "utf8", shell, maxBuffer: 32 * 1024 * 1024 });
  } catch (error: any) {
    return `${error?.stdout ?? ""}${error?.stderr ?? ""}` || String(error?.message ?? error);
  }
};
const git = (...args: string[]) => run("git", args).trim();
const railway = (...args: string[]) => run("railway.cmd", args, true);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The production database's public URL, read by name and never printed. */
function productionUrl(): string | undefined {
  return railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
}

/* ── 1. what is being deployed ──────────────────────────────────────────── */

const sha = git("rev-parse", "HEAD");
const shortSha = sha.slice(0, 8);
const subject = git("log", "-1", "--format=%s");
const dirty = git("status", "--porcelain").split("\n").filter((line) => line && !line.startsWith("??"));
if (dirty.length > 0) {
  die(`the working tree has ${dirty.length} uncommitted tracked change(s) — a deploy must carry a commit, not a desk:\n${dirty.join("\n")}`);
}

/*
  WHAT IS IN FLIGHT WHEN THIS LANDS — recorded, not prevented.

  A deploy that lands mid-roll kills the process holding its candidates, and
  the founder ruled that this is an accepted collision class: per-slice billing
  plus the recovery sweep IS the answer, and drain infrastructure is explicitly
  not to be built (2026-08-01). So this does not gate, wait or queue. It READS,
  because the collision has been invisible in every receipt so far — tonight's
  own 07:24Z roll was killed by a deploy from this shift and settled correctly
  eight refunds later, and nothing in the record would have said so.

  Read by NAME from the MySQL service; the URL never leaves this block.
*/
/**
 * IS HE IN THE MIDDLE OF SOMETHING (fable-504)?
 *
 * Ten deploys landed in one night while the founder was dogfooding, and one of
 * them killed a roll he was watching. The Aug-1 ruling accepts that collision
 * class and forbids drain infrastructure — it does not forbid manners. So the
 * rite REFUSES while he has casting work from the last ten minutes, and says
 * why. `--anyway` proceeds deliberately, for the case where the push IS the fix
 * he is waiting on.
 */
const founderIsActive = await (async (): Promise<{ active: boolean; note: string }> => {
  const url = productionUrl();
  if (!url) return { active: false, note: "(unread — MYSQL_PUBLIC_URL not readable)" };
  try {
    const connection = await openDatabase(url);
    const [rows] = await connection.query<any[]>(
      `SELECT MAX(at) AS latest FROM (
         SELECT MAX(createdAt) AS at FROM casting_candidates WHERE userId = 1
         UNION ALL
         SELECT MAX(createdAt) AS at FROM casting_candidate_variants WHERE userId = 1
       ) AS his`,
    );
    await connection.end();
    const latest = rows[0]?.latest ? new Date(rows[0].latest).getTime() : 0;
    if (!latest) return { active: false, note: "no casting work on record" };
    const minutes = (Date.now() - latest) / 60_000;
    return {
      active: minutes <= 10,
      note: `his last casting work was ${minutes.toFixed(1)} minutes ago`,
    };
  } catch {
    return { active: false, note: "(unread — the production ledger could not be reached)" };
  }
})();

const inFlight = await (async (): Promise<string> => {
  const url = railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
  if (!url) return "(unread — MYSQL_PUBLIC_URL not readable)";
  try {
    const connection = await openDatabase(url);
    const [rows] = await connection.query<any[]>(
      `SELECT COUNT(*) AS open FROM casting_candidates
        WHERE status NOT IN ('ready', 'failed', 'discarded')
          AND createdAt >= (NOW() - INTERVAL 20 MINUTE)`,
    );
    await connection.end();
    const open = Number(rows[0]?.open ?? 0);
    return open === 0
      ? "nothing in flight"
      : `${open} candidate(s) IN FLIGHT — this deploy costs their wait (accepted class, D-85)`;
  } catch {
    /* NO ERROR TEXT. A driver's connection error can carry the DSN it was
       handed, and this line goes into a mailbox report — the reading is
       either taken or it is not, and which driver said no does not belong in
       a receipt beside a credential. */
    return "(unread — the production ledger could not be reached)";
  }
})();

say(`DEPLOY RITE — ${shortSha} · ${subject}`);
say(`  service ${SERVICE} · ${BASE}${DRY ? " · DRY RUN (no push)" : ""}`);
say(`  paid work at push: ${inFlight}`);
say(`  the founder: ${founderIsActive.note}`);
if (founderIsActive.active && !process.argv.includes("--anyway")) {
  die(`he is in an active session — ${founderIsActive.note}. Batch this and deploy when he goes `
    + `quiet (fable-504). If this push IS the fix he is waiting on, say so and re-run with --anyway.`);
}
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

const healths: Array<{ status: string; db: number; uptime: number; timestamp: string }> = [];
for (let read = 0; read < 3; read += 1) {
  const response = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!response || !response.ok) die(`health read ${read + 1} returned ${response?.status ?? "no response"}`);
  const body = await response!.json() as any;
  healths.push({
    status: body.status,
    db: Number(body.checks?.database?.latencyMs ?? NaN),
    uptime: Number(body.uptime ?? NaN),
    timestamp: String(body.timestamp ?? ""),
  });
  if (read < 2) await wait(3_000);
}
if (healths.some((entry) => entry.status !== "healthy")) die(`health said ${healths.map((h) => h.status).join(", ")}`);
const latencies = healths.map((entry) => entry.db);
// Both terms from the same reading — this loop sleeps, and the local clock is
// not a party to the subtraction. See scripts/lib/uptimeAnchor.mts.
const anchor = uptimeAnchor(healths[0]!);

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
say(`paid work at push: ${inFlight}`);
say(`**UPTIME ANCHOR ${anchor}** (uptime ${healths[0]!.uptime.toFixed(1)} s)`);
/* OUR OWN MONEY, beside the deploy that will spend it. At zero the
   interpreter fails and every paid roll and refine dies at dispatch, so a
   deploy is exactly the moment to look. Read here, never remembered. */
say(balanceLine(await readOpenRouterBalance()));
/*
  AND THE SPEND BESIDE THE LEVEL (fable-688 §3).

  A remaining balance cannot show a leak: two deploys an hour apart both print
  "$9.68" whether nothing was spent or a cent was. The account keeps its own
  windows, so the receipt carries today's and this week's figure next to the
  remainder, and a drain becomes visible in ONE reading instead of needing two.
  That is exactly the reading that attributed tonight's own 7¢ movement.
*/
say(await (async () => {
  const usage = await readOpenRouterUsage();
  return usage.ok
    ? `openrouter spend  today $${usage.daily.toFixed(2)} · week $${usage.weekly.toFixed(2)}`
      + ` · month $${usage.monthly.toFixed(2)}`
      + (usage.isManagementKey ? "" : "  (per-day/model breakdown needs a management key)")
    : `openrouter spend UNREAD — ${usage.why}`;
})());
/*
  AND THE OTHER ACCOUNT (fable-684 §1).

  The founder ordered fal the same rigour, and the two are not symmetrical:
  fal's remainder is behind an admin key we do not hold (HTTP 403), while its
  PRICE list answers to our ordinary key. So the reader asks for the balance
  every time — the day he mints an admin key this upgrades itself, with no code
  change and nobody remembering to come back — and derives a floor from our own
  rows meanwhile. Priced with fal's own figures where fal states one in a unit
  that converts, and with our measured $0.099 where its published unit is
  opaque.

  The window is SEVEN DAYS, matching the week the $100 question is about.
*/
say(await (async () => {
  const balance = await readFalBalance();
  if (balance.ok) return falLine(balance);
  const url = productionUrl();
  if (!url) return falLine(balance);
  try {
    const connection = await openDatabase(url);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const traffic = await readFalTraffic(connection, since);
    await connection.end();
    const prices = await readFalPrices(traffic.models.map((model) => model.model));
    return falLine(balance, { traffic, priced: priceFalCalls(traffic.models, prices) });
  } catch {
    /* NO ERROR TEXT — same rule as the in-flight read above: this line goes
       into a mailbox, and a driver's error can carry the DSN it was handed. */
    return falLine(balance);
  }
})());
say("");
say("FLAGS, read off the service:");
for (const variable of variables) say(`  ${variable}`);
say("─".repeat(72));
process.exit(0);

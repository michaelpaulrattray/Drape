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
 * # THERE IS NO SUCH THING AS A DEPLOY TOO SMALL FOR THE CEREMONY
 *
 * Ordered into this header by fable-852 §4, banked to opus-630 §1 and opus-633
 * §6, because the temptation lives here rather than in a mailbox. A shift
 * hand-pushed a DOCS-ONLY commit — reasoning, correctly, that no code moved —
 * and killed a paid render the founder was watching. The freeze below would
 * have said GO, so nothing was broken that the design had not already accepted:
 * the failure was the DISCIPLINE, not the outcome. The whole point of the rite
 * is that *"was he working?"* gets asked by a script rather than by a judgement
 * about what counts as a risky commit — and the judgement is exactly the part
 * that is wrong when it is wrong. Running it costs ninety seconds.
 *
 * # What it will not do
 *
 * It pushes `main` and `main:local-migration` and it reads. It never sets a
 * variable, never touches a database, never force-pushes, and never rewrites
 * history — the four things the overnight grant excludes. `--dry` performs
 * every reading and no push.
 *
 * # NEVER PIPE THE RITE — and the receipt no longer depends on you remembering
 *
 * A shift ran this as `… | grep -v … | tail -18` for a tidier mailbox. The pipe
 * ate the receipt, and — the dangerous half — a pipeline returns its LAST
 * command's exit status, so "exit code 0" was reported while the deployment was
 * FAILED. The one tool built to stop a green claim with no fact under it
 * produced one.
 *
 * Every run now writes its full transcript and its exit status to
 * `output/deploy-receipts/`, unconditionally and on every path, so a piped or
 * truncated invocation still leaves the durable record. Custody blocks quote
 * that file. Run it unpiped anyway.
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
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { decideWatch, newestRow } from "./lib/deployWatch.mts";
import { uptimeAnchor } from "./lib/uptimeAnchor.mts";
import {
  balanceLine,
  booksLine,
  readOpenRouterActivity,
  readOpenRouterBalance,
  readOpenRouterUsage,
} from "./lib/openrouterBalance.mts";
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

/*
  THE RECEIPT DEFENDS ITSELF — ordered fable-1012 §2, from a real incident.

  A shift ran this script as `npx tsx scripts/deploy-rite.mts | grep -v … |
  tail -18` to keep the mailbox tidy. Two things died in that pipe: the receipt,
  which is the whole point of the rite, and the EXIT CODE — a pipeline returns
  its LAST command's status, so the harness reported "exit code 0" while the
  deployment was FAILED. A green-looking signal with no fact under it, produced
  by the one tool built to stop exactly that.

  **NEVER PIPE THE RITE.** But a rule that has to be remembered is a rule that
  gets forgotten at 2am, so the receipt no longer depends on anyone reading it
  off a terminal: every run writes its full transcript AND its exit status to a
  file, unconditionally, on every path — success, REFUSED, or a throw. A piped,
  grepped or truncated invocation still leaves the durable record, and a custody
  block quotes the FILE.

  Registered on `exit` rather than called at the end, because the paths that
  matter most are the ones that never reach the end. Synchronous writes for the
  same reason: nothing async survives `process.exit`.
*/
/* Named rather than inlined: this file gets edited by scripts more often than
   by hand, and an escaped newline inside a template literal is exactly what
   the last such edit broke. */
const NL = String.fromCharCode(10);
const RECEIPTS = "output/deploy-receipts";
const startedAtIso = new Date().toISOString();
const receiptFile = `${RECEIPTS}/${startedAtIso.replace(/[:.]/g, "-")}-${process.pid}.txt`;
process.on("exit", (code) => {
  try {
    mkdirSync(RECEIPTS, { recursive: true });
    const verdict = code === 0 ? "OK" : `EXIT ${code}`;
    writeFileSync(
      receiptFile,
      [
        `deploy-rite ${startedAtIso}`,
        `argv: ${process.argv.slice(2).join(" ") || "(none)"}`,
        `EXIT STATUS: ${verdict}`,
        "",
        ...lines,
        "",
      ].join(NL),
      "utf8",
    );
    /* One greppable line per run beside the transcripts, so the SEQUENCE of
       deploys is readable without opening every file — which is the question
       actually asked when something went wrong an hour ago. */
    appendFileSync(
      `${RECEIPTS}/index.log`,
      `${startedAtIso}  ${verdict.padEnd(8)}  ${receiptFile}${NL}`,
      "utf8",
    );
    console.log(`receipt: ${receiptFile}`);
  } catch (error) {
    /* A receipt that cannot be written must SAY so rather than vanish — an
       absent record reads as a run that never happened. */
    console.error(`[deploy-rite] could not write the receipt: ${String(error)}`);
  }
});
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
const run = (command: string, args: string[], shell = false, env?: NodeJS.ProcessEnv): string => {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      shell,
      maxBuffer: 32 * 1024 * 1024,
      ...(env ? { env } : {}),
    });
  } catch (error: any) {
    return `${error?.stdout ?? ""}${error?.stderr ?? ""}` || String(error?.message ?? error);
  }
};
const git = (...args: string[]) => run("git", args).trim();

/*
  THE MARKER THE PRE-PUSH GATE LOOKS FOR (ordered fable-982).

  `.githooks/pre-push` refuses any push to `main` or `local-migration` unless
  this variable is set on the git process. It is set HERE and nowhere else, on
  the push child alone — not exported into the shift's environment, because a
  variable that outlives the push would be a marker any later hand-push
  inherits, which is the gate with its own key taped to it.
*/
const gitPush = (...args: string[]) =>
  run("git", ["push", ...args], false, { ...process.env, DRAPE_DEPLOY_RITE: "1" }).trim();

/*
  AND THE GATE'S OWN INSTALLATION IS CHECKED BEFORE ANYTHING ELSE.

  `core.hooksPath` is local config, so a fresh clone has the hook file and not
  the gate. A guard that is silently absent is worse than none — invariant 7 —
  so the rite refuses to run rather than performing a ceremony whose backstop
  is not armed.
*/
const hooksPath = git("config", "core.hooksPath");
if (hooksPath !== ".githooks") {
  console.log(
    `REFUSED: core.hooksPath is ${hooksPath || "unset"}, not .githooks — the pre-push gate is not armed.\n`
    + "  git config core.hooksPath .githooks",
  );
  process.exit(1);
}
/*
  THE CUSTODY CHECKS THAT ARE CHEAP ENOUGH TO RUN EVERY TIME (ruled fable-1320
  §1, from the census landing).

  These are CHECKS, not refusals: the founder-activity freeze below is the only
  thing that says *"not now"*, and this says *"not like this"*. Red here means
  the push does not fire, exactly as a red suite would — the difference being
  that a suite takes a minute and these take seconds, so there is no honest
  reason to leave them to memory.

  **No path filter, deliberately.** *"Only run the capability census when
  server/castingV2 changed"* is a second list of which files matter, and a
  second list drifts from the first the day somebody adds a door somewhere new
  (working law 4). Both are deterministic and both are seconds; running them
  always costs less than deciding when to.

  What is NOT here: `pnpm test` and `pnpm check`, which are minutes and belong
  in the custody block of the report, and `capability:check --drive`, which
  makes text calls and costs money — the census's own rule that a script whose
  default action is to spend is never run casually.
*/
for (const [label, script] of [["atlas", "architecture:check"], ["capability", "capability:check"]]) {
  const result = spawnSync("pnpm", [script!], { encoding: "utf8", shell: true });
  const printed = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .trim().split(/\r?\n/).slice(-3).join(" · ");
  if (result.status !== 0) {
    console.log(`REFUSED: ${label} check is RED — the push does not fire. ${printed}`);
    process.exit(1);
  }
  console.log(`  ${label}: ok`);
}

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
 *
 * # WHAT THIS CAN AND CANNOT SEE — said in the receipt, not just here
 *
 * It reads ROWS: candidates and variants. Browsing writes neither. On
 * 2026-08-16 this line printed *"his last casting work was 138.5 minutes ago"*
 * while he was opening face panels — twelve production scans between 10:46Z and
 * 10:58Z, reconciled to the cent against fal's own balance — and two deploys
 * landed inside that session, one of them five seconds after a scan of his.
 *
 * The guard is unchanged, deliberately (fable-754 §4): what it protects against
 * is a killed roll, and reading request logs per deploy to catch a browsing
 * session buys a risk the kept-scan table is already retiring. What changes is
 * the SENTENCE — it now says which reading it took, so nobody quotes a
 * quietness this instrument cannot see. An instrument that overstates its own
 * reach is the uptime-anchor family's defect wearing a politeness costume.
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
    const blind = "browsing writes no row and is invisible to this reading";
    if (!latest) return { active: false, note: `no cast or version on record (${blind})` };
    const minutes = (Date.now() - latest) / 60_000;
    return {
      active: minutes <= 10,
      note: `his last CAST OR VERSION was ${minutes.toFixed(1)} minutes ago (${blind})`,
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
    /*
      THE FREEZE'S THIRD READING (fable-847 §1, granted).

      The line above counts CANDIDATES, which is a roll's unit of work — and a
      REFINE mints no candidate at all. So a founder halfway through a paid
      edit was invisible to this reading, and a deploy that killed it would have
      printed "nothing in flight" on its own receipt. A live operation holds a
      lease it renews every 30 s, so `claimed`/`running` with an unexpired lease
      is exactly the set whose process this push is about to replace.

      SAID OUT LOUD, because a guard credited with a save it could not have made
      is worse than no guard: **this would NOT have saved last night.** His
      render began 51 seconds AFTER the push landed, and no reading taken before
      a push can see work that has not started. That future hole is D-85's
      accepted cost and stays accepted. This closes the other one — the edit
      already under way while the rite says the coast is clear.
    */
    const [operationRows] = await connection.query<any[]>(
      `SELECT COUNT(*) AS live FROM generation_operations
        WHERE status IN ('claimed', 'running')
          AND leaseExpiresAt > NOW()`,
    );
    await connection.end();
    const open = Number(rows[0]?.open ?? 0);
    const live = Number(operationRows[0]?.live ?? 0);
    const parts = [
      ...(open > 0 ? [`${open} candidate(s)`] : []),
      ...(live > 0 ? [`${live} live operation(s) (unexpired lease — a refine is here and nowhere else)`] : []),
    ];
    return parts.length === 0
      ? "nothing in flight — no candidate of the last 20 minutes, no operation on an unexpired lease"
      : `${parts.join(" + ")} IN FLIGHT — this deploy costs their wait (accepted class, D-85)`;
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

/*
  WHOSE DEPLOYMENT IS THIS GOING TO BE? Read BEFORE the push, because after it
  there is a window — measured at seven minutes on 2026-08-19 — in which the
  newest row is still the PREVIOUS deploy, already SUCCESS. The watch below
  accepted exactly that and printed `deployment 0ea3207c → SUCCESS after 2s`
  for a commit Railway had not begun building; health, uptime and the flags
  were then read off the OLD process and were all true of it, which is what
  makes this class dangerous — nothing in the receipt looks wrong.
*/
const priorDeployment = DRY ? null : (newestRow(railway("deployment", "list"))?.id ?? null);

if (!DRY) for (const branch of BRANCHES) say(`  push ${branch}: ${gitPush("origin", branch) || "ok"}`);

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

    AND IT MUST NOT BE THE ONE THAT WAS THERE BEFORE THE PUSH — see
    `lib/deployWatch.mts`, and the receipt it printed for somebody else's
    deployment on 2026-08-19.
  */
  const newest = newestRow(railway("deployment", "list"));
  const decision = decideWatch(priorDeployment, newest);
  if (decision.kind === "settled" || decision.kind === "running") deployment = newest;
  if (decision.kind === "settled") break;
  if (decision.kind === "not-mine" && attempt % 6 === 5) {
    say(`  waiting for Railway to create the deployment (${attempt * 20}s)`);
  }
  await wait(20_000);
}
if (!deployment) {
  die(priorDeployment
    ? `Railway never created a deployment newer than ${priorDeployment.slice(0, 8)}. The push LANDED and the build did not start — nothing here may be reported as deployed.`
    : "no deployment row could be read at all");
}
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
const books = await readOpenRouterActivity();
say(await (async () => {
  const usage = await readOpenRouterUsage();
  if (!usage.ok) return `openrouter spend UNREAD — ${usage.why}`;
  /*
    THE "NEEDS A MANAGEMENT KEY" NOTE BELONGS TO THE BOOKS, NOT TO THIS KEY.

    `isManagementKey` is a property of the INFERENCE key and is correctly false
    — but the breakdown now arrives on a different credential, on the next
    line. Printing the note off this flag alone told the reader a capability was
    missing while it sat directly underneath. Same class as the three threshold
    sentences swept earlier tonight: a fact restated somewhere it cannot see
    whether it is still true.
  */
  return `openrouter spend  today $${usage.daily.toFixed(2)} · week $${usage.weekly.toFixed(2)}`
    + ` · month $${usage.monthly.toFixed(2)}`
    + (books.ok ? "" : "  (per-day/model breakdown needs a management key)");
})());
/*
  AND THE BOOKS THEMSELVES (fable-693 §2c).

  Per day and per model, from the provider rather than from us — the reading
  that turned the whole reconciliation the right way round. Account-wide rather
  than per-key, and the line says so where it prints.
*/
say(booksLine(books));
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

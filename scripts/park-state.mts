/**
 * THE PARK BLOCK, READ RATHER THAN REMEMBERED (fable-485 §b, founder-approved
 * 2026-08-14).
 *
 * Every handoff ends with a state block, and the two worst numbers this program
 * has published were both hand-assembly defects: a **+6,200 credit scare** that
 * turned out to be two worlds' ledgers compared with each other, and an
 * **understated walk gross** copied from the wrong reading. Flags have been
 * quoted from memory twice. So the block is now produced by a script whose
 * every line is a reading taken in this process.
 *
 * **A PARK'S STATE BLOCK IS GENERATED, NEVER TYPED** (fable-831 §2, from
 * opus-619 → fable-830 → opus-620). The rule above is why this script exists;
 * this sentence is why running it is not optional. A shift wrote its block by
 * hand and justified skipping the suite with *"a docs file no test reads"* —
 * false, and refuted IN WRITING forty lines below, by a note earned when the
 * very same file reddened the very same suite. **The lesson was in the right
 * instrument and the park never asked it**, so main shipped red for a commit.
 * The gap was bypass, not absence: every line here is a reading, and a line
 * retyped beside them is a claim wearing their clothes.
 *
 * # The care that matters here
 *
 * **Two databases, compared by PORT.** The dev database and production are the
 * same host, the same name and different ports (`:52008` and `:23768`), which
 * is exactly how one world's rows came to be read as another's. Each ledger
 * below prints the port it was read from, and they are never summed.
 *
 * **No credential ever leaves memory.** Production's URL is read by NAME from
 * the Railway service and used to connect; what is printed is `host:port` and
 * nothing else.
 *
 * **Read-only.** Selects, `git ls-remote`, `railway variables`, `netstat`. It
 * writes nothing, pushes nothing and charges nothing.
 *
 *   npx tsx scripts/park-state.mts [--suite] [--no-prod]
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { uptimeAnchor } from "./lib/uptimeAnchor.mts";
import { balanceLine, readOpenRouterBalance } from "./lib/openrouterBalance.mts";
import { falLine, readFalBalance } from "./lib/falSpend.mts";
import { findSuiteLine, suiteVerdict } from "./lib/suiteLine.mts";

const WITH_SUITE = process.argv.includes("--suite");
const WITH_PROD = !process.argv.includes("--no-prod");
const SERVICE = process.env.RAILWAY_SERVICE ?? "Drape";
const BASE = process.env.PROD_BASE_URL ?? "https://drape-production-0232.up.railway.app";

/* The campaign ceiling's own two constants, taken from the instrument that owns
   them (`campaign-ledger-rows-disposable.mts`) rather than restated here as a
   third copy that can drift from both. */
const CAMPAIGN_FROM = "2026-08-07 00:00:00";
const CAMPAIGN_USER = 1;
/* ⚠ THE CEILING IS GONE — the founder removed it outright on 2026-08-23,
   verbatim *"no cieling remove it"* (relayed fable-1439). Not re-pointed and
   not raised: the 5,000 figure governs nothing. The LEDGER READING stays as an
   instrument — reports still quote it as a fact — it simply commands no stop.
   What remains is the discipline that was always the real control: a paid court
   is costed and countersigned BEFORE it runs, and every spend lands in a
   receipt with the ledger read at both ends. He removed the backstop, not the
   doors. */

const say = (line = "") => console.log(line);
/*
  `shell` is not a style choice on Windows: `railway.cmd` is a batch file, and
  `execFileSync` without a shell cannot resolve one from PATH — it returns the
  spawn error as text, which reads exactly like a command that ran and said
  nothing.
*/
const run = (command: string, args: string[], shell = false): string => {
  try {
    return execFileSync(command, args, { encoding: "utf8", shell, maxBuffer: 64 * 1024 * 1024 });
  } catch (error: any) {
    return `${error?.stdout ?? ""}${error?.stderr ?? ""}` || String(error?.message ?? error);
  }
};
const git = (...args: string[]) => run("git", args).trim();

/** Gross, refunded and net inside the campaign window, for one world. */
async function readLedger(url: string): Promise<{ where: string; line: string } | { where: string; error: string }> {
  const where = (() => {
    /* host:port only — the URL itself carries a password and never leaves this
       function. */
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}:${parsed.port}`;
    } catch { return "(unparseable url)"; }
  })();
  try {
    const connection = await openDatabase(url);
    const [rows] = await connection.query<any[]>(
      `SELECT amount, type FROM point_transactions WHERE userId = ? AND createdAt >= ?`,
      [CAMPAIGN_USER, CAMPAIGN_FROM],
    );
    await connection.end();
    let gross = 0;
    let refunded = 0;
    for (const row of rows) {
      const amount = Number(row.amount);
      if (amount < 0) gross += -amount;
      if (amount > 0 && row.type === "refund") refunded += amount;
    }
    return {
      where,
      line: `gross ${gross} · refunded ${refunded} · net ${gross - refunded} · rows ${rows.length}`,
    };
  } catch {
    /* NO ERROR TEXT, for the same reason the URL is never printed: a driver's
       connection error can carry the DSN it was handed, and this block is
       pasted into a mailbox report. */
    return { where, error: "the connection failed" };
  }
}

/* ── the block ──────────────────────────────────────────────────────────── */

const sha = git("rev-parse", "HEAD");
const subject = git("log", "-1", "--format=%s");
const dirty = git("status", "--porcelain").split("\n").filter((line) => line && !line.startsWith("??"));
const remotes = ["main", "local-migration"].map((ref) => ({
  ref, at: (git("ls-remote", "origin", `refs/heads/${ref}`).split(/\s+/)[0] ?? "").slice(0, 8),
}));

say("```");
say(`HEAD      ${sha.slice(0, 8)} · ${subject}`);
say(`          ${remotes.map((entry) => `origin/${entry.ref}=${entry.at || "(absent)"}`).join(" · ")}`
  + `${remotes.every((entry) => entry.at === sha.slice(0, 8)) ? "  — both match HEAD" : "  *** A BRANCH IS BEHIND ***"}`);
say(`tree      ${dirty.length === 0 ? "clean (tracked)" : `${dirty.length} uncommitted tracked change(s)`}`);

const newest = run("railway.cmd", ["deployment", "list"], true).split("\n")
  .map((line) => line.trim())
  .find((line) => /^[0-9a-f-]{36} \| [A-Z]+ \|/.test(line));
say(`deploy    ${newest ? newest.split("|").slice(1).join("·").trim() : "(unreadable)"}`);

const healths: Array<{ status: string; db: number; uptime: number; timestamp: string }> = [];
for (let read = 0; read < 3; read += 1) {
  const response = await fetch(`${BASE}/api/health`).catch(() => null);
  const body = response && response.ok ? await response.json() as any : null;
  healths.push({
    status: body?.status ?? `HTTP ${response?.status ?? "none"}`,
    db: Number(body?.checks?.database?.latencyMs ?? NaN),
    uptime: Number(body?.uptime ?? NaN),
    timestamp: String(body?.timestamp ?? ""),
  });
  if (read < 2) await new Promise((resolve) => setTimeout(resolve, 2_000));
}
const latencies = healths.map((entry) => entry.db).filter((value) => Number.isFinite(value));
say(`health    ${healths.map((entry) => entry.status).join(" · ")} · db `
  + `${latencies.length ? `${Math.min(...latencies).toFixed(2)}–${Math.max(...latencies).toFixed(2)} ms` : "(unread)"}`);
if (Number.isFinite(healths[0]!.uptime) && healths[0]!.timestamp) {
  // Both terms from the same reading — see scripts/lib/uptimeAnchor.mts.
  say(`          **UPTIME ANCHOR ${uptimeAnchor(healths[0]!)}**`);
}

const flags = run("railway.cmd", ["variables", "--service", SERVICE, "--kv"], true).split("\n")
  .map((line) => line.trim())
  .filter((line) => /^(CASTING_|R7_|ENABLE_STORAGE_CLEANUP_WORKER)/.test(line));
/* THE COUNT NAMES ITS BASIS, so successive parks are comparable at a glance
   (fable-832 §2; owner assigned opus-622, discharged here). Two parks said
   "13 scope keys" and "16 keys" of the SAME world on consecutive shifts —
   one filtered to `*_SCOPE`, one counting everything this filter admits — and
   a successor comparing them reads a change that never happened. A bare count
   is a claim about a basis nobody wrote down. */
const scopeKeys = flags.filter((flag) => /^[A-Z0-9_]*_SCOPE=/.test(flag)).length;
say(`flags     READ OFF THE SERVICE — never state one from memory`);
say(`          BASIS: ${scopeKeys} scope keys + ${flags.length - scopeKeys} operational = ${flags.length} read`);
for (const flag of flags) say(`          ${flag}`);
if (flags.length === 0) say("          *** UNREADABLE — do not quote flags in this park ***");

/* THE TWO LEDGERS, SEPARATELY, EACH NAMING ITS PORT. */
if (process.env.DATABASE_URL) {
  const dev = await readLedger(process.env.DATABASE_URL);
  say(`ledger    dev ${dev.where} — ${"line" in dev ? dev.line : `UNREAD: ${dev.error}`}`);
}
if (WITH_PROD) {
  /* By NAME, from the service. The value is used and never printed. */
  const production = run("railway.cmd", ["variables", "--service", "MySQL", "--kv"], true).split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
  if (!production) {
    say("ledger    production — UNREAD (MYSQL_PUBLIC_URL not readable from the MySQL service)");
  } else {
    const read = await readLedger(production);
    say(`ledger    production ${read.where} — ${"line" in read ? read.line : `UNREAD: ${read.error}`}`);
  }
}

/* THE MONEY THAT IS NOT CREDITS. The campaign ledger above counts the
   founder's credits; this counts OURS, and the two had never been in one
   block — which is how he came to be $100 down on OpenRouter while every
   shift report truthfully said "zero model calls" (fable-682). Read, never
   remembered; the key is used and never printed. */
say(`          ${balanceLine(await readOpenRouterBalance())}`);
/*
  AND THE OTHER ACCOUNT, AT OPEN AS WELL AS AT CLOSE (fable-852 §2, from the
  opus-633 §3 miss).

  A shift spent house money on segmenter reads and could only quote it as a
  BAND, because the only fal figure it held was the one the deploy rite took
  afterwards — the before-reading was never bought, and a subtraction with one
  end missing is not a subtraction (subtract-from-the-same-reading). The rite
  already prints this line at deploy time; printing it here too means every
  shift opens and closes with a fal figure of its own, so the next spend is
  quotable to the cent without anybody remembering to look first.
*/
say(`          ${falLine(await readFalBalance())}`);

/*
  THE FOUNDER QUEUE'S BYTES BESIDE ITS HASH (fable-852 §2, from opus-633 §4).

  A park closed its custody arithmetic on one end only: the md5 was recorded at
  open and the SIZE was not, so "+2,057 B across two moves" could be proved for
  the second move and not the first. A hash says whether the file changed; only
  the byte count says by how much, and the pair is what makes a custody claim
  checkable by the next hand. Both are readings taken here.

  The queue lives under `.agents/`, which is never committed — so an absent file
  is a legitimate state (a fresh clone), and it says UNREAD rather than throwing
  a park block away over it.

  **LINE-ENDING FIGURES ARE MEASURED AT THIS PARK, NEVER INHERITED** (fable-865
  §2, from opus-640 §4). A park recorded this file as "CRLF 0 — uniform LF" for
  a file that is 97% CRLF; the figure had been carried from a predecessor and
  nobody had taken it. Same class as the uniform-file bound: a custody claim may
  not carry a number its own sitting did not read.
*/
say(`queue     ${(() => {
  try {
    const bytes = readFileSync(".agents/mailbox/founder-queue.md");
    /* NEWLINES, which is `wc -l`'s count and therefore the one every custody
       figure already in the record was taken with. `split("\n").length` is one
       MORE than this on any file that ends in a newline, and a park comparing
       its own 2,463 against the previous park's 2,462 would read a line that
       was never written. */
    let lines = 0;
    for (const byte of bytes) if (byte === 0x0a) lines += 1;
    return `founder-queue.md ${bytes.length.toLocaleString()} B · ${lines.toLocaleString()} lines`
      + ` · md5 ${createHash("md5").update(bytes).digest("hex")}`;
  } catch {
    return "founder-queue.md UNREAD — not present in this tree";
  }
})()}`);

/* PROCESS HYGIENE — the six orphaned dev servers that lagged the founder's
   machine were invisible in every park that did not look. */
const listeners = run("netstat", ["-ano"]).split("\n")
  .map((line) => line.trim())
  .filter((line) => /LISTENING/.test(line) && /:300\d\b/.test(line));
say(`process   ${listeners.length} listener(s) on :300x`
  + (listeners.length ? ` — pids ${[...new Set(listeners.map((line) => line.split(/\s+/).pop()))].join(", ")}` : ""));

if (WITH_SUITE) {
  /* `findSuiteLine`, not a local predicate: the one this replaced also matched
     `failed |`, which on a RED run finds the `Test Files` line FIRST — file
     counts, reported as the suite, on exactly the run where it matters. */
  const output = findSuiteLine(run("npx", ["vitest", "run"], true));
  const finished = new Date().toISOString();
  /* Not the raw line: the line WITH ITS ARITHMETIC DONE. A park once copied
     "6,754 passed · 302 skipped · 0 failed" out of a run that had one failure,
     and the parts already disagreed with the total printed beside them
     (fable-791 §1). **Paste this line; do not re-typeset it** — a green run has
     three parts, and every `0 failed` in the mailbox was typed by an author
     (fable-794 §1). */
  say(`suite     ${output ? suiteVerdict(output) : "(unreadable)"}`);
  /* THE READING CARRIES ITS OWN CLOCK (fable-794 §2). The sum rule catches a
     line that dropped a part; it cannot catch a line that was TRUE when it was
     taken and went stale afterwards — that one sums perfectly. The guards sweep
     the filesystem rather than the index, so a file written after this moment can
     redden a suite this line still calls green, and until now the line carried no
     datum to notice it by (vitest's own `Start at` is discarded with the rest of
     the run).
     This is the honest half only: a timestamp, not a gate. No sweep, no policy,
     nothing that could false-positive on the suite's own temp files.

     THE SCOPE IS THE TREES THE SUITE READS, WHICH IS NOT THE TREE IT LIVES IN.
     fable-791 §1's "any later file write, tracked or not" has to narrow to
     something, because taken literally it invalidated every park ever written —
     the park report itself being a later write. The narrowing first shipped on
     this line was `scripts/` and `server/`, reasoned from the twelve
     `readdirSync` guards, and it was FALSIFIED WITHIN THE HOUR by the very next
     commit: one sentence written into `docs/specs/INSTRUMENT_DOCTRINE.md`
     reddened the suite, because `instrumentDoctrine.test.ts` reads that file.
     Three test files read under `docs/` today.
     So do not read the trees below as a boundary. A suite reads whatever its
     tests open; that set grows without announcing itself, and a tree is not out
     of scope for holding no tests of its own. Compare this clock against YOUR
     LAST WRITE ANYWHERE, and treat the named trees as the ones already known to
     bite. (Doctrine 17, earned by this line: the reasoned-about scope was a
     convention, the timestamp is the instrument.) */
  say(`          run finished ${finished} — this reading is green AS OF THEN;`
    + ` a later write can redden it (scripts/, server/ and docs/ are all read`
    + ` by tests — compare against your last write anywhere)`);
} else {
  say("suite     NOT RUN in this park — pass --suite to read it");
}
say("```");
process.exit(0);

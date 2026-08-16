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

import { openDatabase } from "./lib/dbConnection.mts";
import { uptimeAnchor } from "./lib/uptimeAnchor.mts";
import { balanceLine, readOpenRouterBalance } from "./lib/openrouterBalance.mts";

const WITH_SUITE = process.argv.includes("--suite");
const WITH_PROD = !process.argv.includes("--no-prod");
const SERVICE = process.env.RAILWAY_SERVICE ?? "Drape";
const BASE = process.env.PROD_BASE_URL ?? "https://drape-production-0232.up.railway.app";

/* The campaign ceiling's own two constants, taken from the instrument that owns
   them (`campaign-ledger-rows-disposable.mts`) rather than restated here as a
   third copy that can drift from both. */
const CAMPAIGN_FROM = "2026-08-07 00:00:00";
const CAMPAIGN_USER = 1;
const CEILING = 5_000;

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
      line: `gross ${gross} of ${CEILING} · refunded ${refunded} · net ${gross - refunded} · rows ${rows.length}`,
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
say(`flags     READ OFF THE SERVICE — never state one from memory`);
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

/* PROCESS HYGIENE — the six orphaned dev servers that lagged the founder's
   machine were invisible in every park that did not look. */
const listeners = run("netstat", ["-ano"]).split("\n")
  .map((line) => line.trim())
  .filter((line) => /LISTENING/.test(line) && /:300\d\b/.test(line));
say(`process   ${listeners.length} listener(s) on :300x`
  + (listeners.length ? ` — pids ${[...new Set(listeners.map((line) => line.split(/\s+/).pop()))].join(", ")}` : ""));

if (WITH_SUITE) {
  const output = run("npx", ["vitest", "run"], true).split("\n")
    .map((line) => line.replace(/\[[0-9;]*m/g, "").trim())
    .find((line) => /^Tests\s+\d|failed \|/.test(line));
  say(`suite     ${output ?? "(unreadable)"}`);
} else {
  say("suite     NOT RUN in this park — pass --suite to read it");
}
say("```");
process.exit(0);

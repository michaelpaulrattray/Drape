/**
 * THE DELIVERY-RATE READ (D-236), run on demand.
 *
 * Derived entirely from rows the render path already writes — the variant's
 * status, its failure class, and the verdict stored on `internalPrompt`. This
 * script does no classification of its own: it hands rows to the same
 * `summarize` the walk report and the heartbeat use, so three surfaces can
 * never disagree about one number.
 *
 *   npx tsx scripts/reliability-report.mts                # dev database
 *   railway.cmd run --service MySQL npx tsx scripts/…     # production
 *
 * Optional: --since 2026-08-07T00:00:00Z   (a build boundary; see D-236 on why
 * build attribution is by timestamp and what that costs in precision)
 *           --user 1
 */
import mysql from "mysql2/promise";
import { formatReport, summarize, type AttemptRow } from "../server/castingV2/reliabilityReport.js";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const sinceRaw = arg("since");
const since = sinceRaw ? new Date(sinceRaw) : undefined;
if (sinceRaw && Number.isNaN(since!.getTime())) {
  console.error(`--since is not a date: ${sinceRaw}`);
  process.exit(1);
}
const userId = arg("user");

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL. Set DATABASE_URL, or run under `railway run` for production.");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
const where: string[] = ["v.pointsCost > 0"];
const params: unknown[] = [];
if (since) { where.push("v.createdAt >= ?"); params.push(since); }
if (userId) { where.push("v.userId = ?"); params.push(Number(userId)); }

const [rows] = await conn.query<any[]>(
  `SELECT v.operationId, v.createdAt, v.status, v.failureClass, v.pointsCost,
          v.requestText, v.internalPrompt, o.refundedCredits
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE ${where.join(" AND ")}
    ORDER BY v.createdAt ASC`,
  params,
);
await conn.end();

/*
  The stored verdict is a JSON column, and mysql2 hands it back already parsed
  or as a string depending on the driver's mood. Both shapes are read, and an
  unreadable one becomes NO verdict rather than an invented pass.
*/
const verdictOf = (internalPrompt: unknown): AttemptRow["verification"] => {
  if (!internalPrompt) return null;
  let parsed: any = internalPrompt;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return null; }
  }
  const verification = parsed?.verification;
  return verification && typeof verification === "object" ? verification : null;
};

const attempts: AttemptRow[] = rows.map((row) => ({
  operationId: String(row.operationId ?? ""),
  createdAt: new Date(row.createdAt),
  status: String(row.status),
  failureClass: row.failureClass ?? null,
  pointsCost: row.pointsCost ?? 0,
  refundedCredits: row.refundedCredits ?? 0,
  verification: verdictOf(row.internalPrompt),
  requestText: row.requestText ?? null,
}));

const report = summarize(attempts, {
  windowFrom: since,
  windowLabel: since ? `since ${since.toISOString()}` : "all time",
});
console.log(formatReport(report));

/* The rows behind an ugly number, so the next question can be asked of the
   picture rather than of the summary (working law 1: artifacts are facts). */
const interesting = attempts.filter((row) => {
  const checks = row.verification?.checks ?? [];
  return row.status !== "ready" || checks.some((check) => check.read === true && !check.verified);
});
if (interesting.length > 0) {
  console.log("\nATTEMPTS THAT DID NOT DELIVER CLEANLY");
  for (const row of interesting) {
    const missed = (row.verification?.checks ?? [])
      .filter((check) => check.read === true && !check.verified)
      .map((check) => `${check.facet}="${check.asked}" saw="${check.saw ?? "?"}"`);
    console.log(
      `  ${row.createdAt.toISOString().slice(0, 19)} ${row.operationId.slice(0, 8)} `
      + `${row.status}${row.failureClass ? `/${row.failureClass}` : ""} `
      + `"${(row.requestText ?? "").slice(0, 34)}"${missed.length ? ` — ${missed.join("; ")}` : ""}`,
    );
  }
}

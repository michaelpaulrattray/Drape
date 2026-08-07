/**
 * THE STORED VERDICT, read back from the rows the render path already writes.
 *
 * # Why the walk cannot score itself from the response
 *
 * `castingV2.refine` returns `{ kind, variantId, candidateId, imageUrl,
 * instructions }` and **no verification** — the verdict is persisted onto the
 * variant's `internalPrompt` and never sent to the client. A driver reading
 * `data.verification` therefore gets `undefined` on every step, every row
 * classifies `delivered_unverified`, and the delivery rate it prints is
 * structurally 0% no matter how well the product performs. That is not a
 * pessimistic number, it is a broken instrument, and D-236 makes the walk the
 * SOLE source of the number — so the instrument had to be fixed before the
 * first credit was spent, not after.
 *
 * The stored row is also the better authority on its own terms: it is what the
 * product decided, persisted, and would answer a billing question with. The
 * response body is a claim about it (working law 1).
 *
 * # One query, two callers
 *
 * `scripts/reliability-report.mts` and the walk read the same rows through this
 * module rather than each writing the SELECT. Two copies of a query that feeds
 * one number is the mirror law #4 forbids, and it is how the on-demand report
 * and the walk report would come to disagree about the same window.
 */
import type { AttemptRow } from "../../server/castingV2/reliabilityReport.js";
import { openDatabase } from "./dbConnection.mjs";

/**
 * The stored verdict is a JSON column, and mysql2 hands it back already parsed
 * or as a string depending on the driver's mood. Both shapes are read, and an
 * unreadable one becomes NO verdict rather than an invented pass.
 */
export function verdictOf(internalPrompt: unknown): AttemptRow["verification"] {
  if (!internalPrompt) return null;
  let parsed: any = internalPrompt;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return null; }
  }
  const verification = parsed?.verification;
  return verification && typeof verification === "object" ? verification : null;
}

export function databaseUrl(): string {
  const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database URL. Set DATABASE_URL, or run under `railway run` for production.",
    );
  }
  return url;
}

/**
 * Paid refine attempts in a window, as the reliability report's own row shape.
 *
 * `pointsCost > 0` is the definition of an attempt: a free question or a free
 * selection never reserved anything and has nothing to be delivered. That is
 * also why an ask cannot inflate or depress the delivery rate — it is not in
 * this result set at all, rather than being excluded from a denominator
 * somewhere downstream where the exclusion could be forgotten.
 */
export async function readAttemptRows(input: {
  since?: Date;
  userId?: number;
}): Promise<AttemptRow[]> {
  /*
    THROUGH `openDatabase`, AND THE TEN HOURS ARE THE REASON.

    A raw `mysql.createConnection` parses a DATETIME as LOCAL, and everything in
    this database is UTC — so on this machine (UTC+10) a `--since` window is
    compared ten hours out of frame in BOTH directions. The first walk to run
    against it reported `n=0` over a window in which four renders had just
    completed, and a zero is exactly the shape of a real finding.

    `scripts/lib/dbConnection.mts` was written for this defect and says so; this
    module and `reliability-report.mts` had both opened their own connection and
    opted straight back out of it. That is the class, not the instance: the
    shared connection only helps if the thing that needs it imports it.
  */
  const conn = await openDatabase(databaseUrl());
  const where: string[] = ["v.pointsCost > 0"];
  const params: unknown[] = [];
  if (input.since) { where.push("v.createdAt >= ?"); params.push(input.since); }
  if (input.userId != null) { where.push("v.userId = ?"); params.push(input.userId); }

  try {
    const [rows] = await conn.query<any[]>(
      `SELECT v.operationId, v.createdAt, v.status, v.failureClass, v.pointsCost,
              v.requestText, v.internalPrompt, o.refundedCredits
         FROM casting_candidate_variants v
         LEFT JOIN generation_operations o ON o.id = v.operationId
        WHERE ${where.join(" AND ")}
        ORDER BY v.createdAt ASC`,
      params,
    );
    return rows.map((row) => ({
      operationId: String(row.operationId ?? ""),
      createdAt: new Date(row.createdAt),
      status: String(row.status),
      failureClass: row.failureClass ?? null,
      pointsCost: row.pointsCost ?? 0,
      refundedCredits: row.refundedCredits ?? 0,
      verification: verdictOf(row.internalPrompt),
      requestText: row.requestText ?? null,
    }));
  } finally {
    await conn.end();
  }
}

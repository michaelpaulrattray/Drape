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
import {
  unsettledAttempts,
  type AttemptRow,
} from "../../server/castingV2/reliabilityReport.js";
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

export type SettledRows = {
  rows: AttemptRow[];
  /** Rows still in flight when the wait gave up. Zero on a clean read. */
  unsettled: number;
  waitedMs: number;
};

/**
 * THE ROWS, ONCE THEY HAVE STOPPED MOVING.
 *
 * # The defect
 *
 * Run-6's walk read its own rate table **31 seconds before its last operation
 * settled**. The removal appeared as `unclassified` with `credits refunded: 0`;
 * the row it was about to become says `refused_honest`, 25 refunded. Both
 * numbers in the walk's own report were wrong, and neither was wrong in a way
 * that looks wrong — an unclassified row and a zero refund are exactly what a
 * real finding looks like.
 *
 * The walk closes the browser as soon as its last DOM check gives up, and its
 * landing cap is shorter than a slow render, so this is not a rare race: it is
 * what happens every time a step times out on the screen while the server is
 * still working.
 *
 * # Why it waits rather than filtering
 *
 * Dropping in-flight rows would silently shrink the denominator, and a sample
 * that quietly excludes the slowest renders is the most flattering possible
 * bias — the slow ones are exactly where the failures are. So it waits, and if
 * it runs out of patience it says how many rows it gave up on rather than
 * reporting their half-written state as a verdict.
 */
export async function settleAttemptRows(input: {
  since?: Date;
  userId?: number;
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<SettledRows> {
  const timeoutMs = input.timeoutMs ?? 180_000;
  const pollMs = input.pollMs ?? 5_000;
  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const began = now();

  for (;;) {
    const rows = await readAttemptRows(input);
    const unsettled = unsettledAttempts(rows).length;
    const waitedMs = now() - began;
    if (unsettled === 0) return { rows, unsettled: 0, waitedMs };
    if (waitedMs >= timeoutMs) return { rows, unsettled, waitedMs };
    console.log(
      `  waiting for ${unsettled} attempt row(s) to settle — ${Math.round(waitedMs / 1000)}s`,
    );
    await sleep(pollMs);
  }
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

/**
 * THE PAID ATTEMPTS THE QUERY ABOVE STRUCTURALLY CANNOT SEE.
 *
 * `readAttemptRows` starts `FROM casting_candidate_variants`. A refine killed
 * before its variant row was written has none — the operation was claimed and
 * CHARGED, the recovery sweep refunded it, and nothing about it ever reaches
 * the reliability table. Production, 2026-08-17: **15 of the founder's 199
 * settled refines, 7.5%**, absent from the number D-236 made the sole source of
 * the delivery rate.
 *
 * The exclusion itself is defensible — a deploy-collision death is not the
 * product failing to deliver a picture, and CLAUDE.md documents that class as
 * designed-for. What was not defensible was that nothing said so, in the one
 * direction that flatters the figure. This counts them so the report can
 * disclose them.
 *
 * The window is matched to `readAttemptRows`'s own, so the disclosure is about
 * the same period as the table it sits under.
 */
export async function countRecoveredExclusions(input: {
  since?: Date;
  userId?: number;
}): Promise<number> {
  const conn = await openDatabase(databaseUrl());
  const where: string[] = [
    "o.kind = 'castingV2.refine'",
    "o.completedAt IS NOT NULL",
    /* Charged, so it was a paid attempt — the same definition `pointsCost > 0`
       carries for the rows that DO exist. */
    "o.chargedCredits > 0",
    /* And no variant row at all: that absence is the whole finding, and it is
       what makes these invisible above rather than merely classified oddly. */
    "v.id IS NULL",
  ];
  const params: unknown[] = [];
  if (input.since) { where.push("o.createdAt >= ?"); params.push(input.since); }
  if (input.userId != null) { where.push("o.userId = ?"); params.push(input.userId); }
  try {
    const [rows] = await conn.query<any[]>(
      `SELECT COUNT(*) AS n
         FROM generation_operations o
         LEFT JOIN casting_candidate_variants v ON v.operationId = o.id
        WHERE ${where.join(" AND ")}`,
      params,
    );
    return Number(rows[0]?.n ?? 0);
  } finally {
    await conn.end();
  }
}

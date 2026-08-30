/**
 * Bug Reports — DB helpers for user-submitted bug reports.
 *
 * # The reader was missing for the life of the feature (#255)
 *
 * A customer typed what went wrong, pressed send, and was told "Bug report
 * submitted. Thank you!" — and the report reached nobody. The row was written
 * and there was no `select` anywhere in the product: no procedure, no admin
 * surface, no export. The `status` column below describes a workflow nothing
 * could drive. The Slack notification that was meant to be the read path has
 * never had a webhook configured on production.
 *
 * Founder ruling, 2026-08-30, verbatim and entire:
 *
 *   "D is the right long-term answer probably in the admin panel first not the
 *    moderator panel yet. no point taking shortcuts."
 *
 * So: a real reader, in the ADMIN panel, with the status workflow the column
 * already declares. `first` and not `only` — the moderator surface is deferred
 * rather than refused, which is why nothing here is shaped around the admin
 * role. These helpers take no role argument and make no role decision; the
 * procedure layer is where `adminProcedure` stands, and adding a moderator
 * surface later is a second procedure over the same reader.
 *
 * # Why an explicit projection, on a table whose every column looks harmless
 *
 * Invariant 8: read paths return an explicit projection, never a bare
 * `select()` or a spread row. It matters more here than the column list
 * suggests — `description` is a CUSTOMER'S OWN PROSE, which is the most
 * sensitive thing on the table and the entire reason the founder was asked
 * before this was built rather than told after. A spread row also carries
 * whatever a future migration adds, which is how a field reaches a staff
 * surface without anyone deciding it should.
 */

import { and, count, desc, eq } from "drizzle-orm";
import { withTransaction, getDb } from "./connection";
import { bugReports, users, type InsertBugReport } from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";
import { assertOwnedAvailableModelIn } from "./modelReferenceFence";

const log = createModuleLogger("db/bugReports");

/* The vocabulary lives in `shared/` and is re-exported here rather than
   redeclared: two lists of the same values drift, and the router must be able
   to reach them without evaluating the db barrel (see that module's header).
   Imported as well as re-exported — `export … from` forwards a name without
   binding it in this module's own scope, and every signature below uses it. */
import type { BugReportStatus, BugReportCategory } from "../../shared/bugReportVocabulary";
export type { BugReportStatus, BugReportCategory };

/**
 * One row as a staff reader sees it.
 *
 * `reporterEmail` / `reporterName` come from a join rather than from the report
 * — a report is worthless for support if you cannot answer the person who sent
 * it, and an admin can already see both on the user surface, so this widens
 * nothing. They are NULLABLE because the join is a `leftJoin` on purpose: a
 * deleted account must not make its report disappear from the queue.
 */
export type BugReportRow = {
  id: number;
  userId: number;
  reporterEmail: string | null;
  reporterName: string | null;
  description: string;
  category: BugReportCategory;
  page: string | null;
  modelId: number | null;
  userAgent: string | null;
  viewport: string | null;
  status: BugReportStatus;
  createdAt: Date;
};

export async function createBugReport(data: InsertBugReport) {
  const result = await withTransaction(async (tx) => {
    if (data.modelId != null) {
      await assertOwnedAvailableModelIn(tx, { modelId: data.modelId, userId: data.userId });
    }
    const [inserted] = await tx.insert(bugReports).values(data).$returningId();
    return inserted;
  });
  log.info({ bugReportId: result.id, userId: data.userId }, "Bug report created");
  return result.id;
}

/**
 * The reader (#255). Newest first — a support queue is read from the top.
 *
 * Returns `{ rows, total }` rather than rows alone: a queue that cannot say how
 * many are behind the page it is showing cannot be paged honestly, and "0 of 0"
 * and "0 of 340" are different facts about the product.
 */
export async function listBugReports(options?: {
  status?: BugReportStatus;
  category?: BugReportCategory;
  limit?: number;
  offset?: number;
}): Promise<{ rows: BugReportRow[]; total: number }> {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const limit = options?.limit ?? 25;
  const offset = options?.offset ?? 0;

  const filters = [
    options?.status ? eq(bugReports.status, options.status) : undefined,
    options?.category ? eq(bugReports.category, options.category) : undefined,
  ].filter((f): f is NonNullable<typeof f> => f !== undefined);
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: bugReports.id,
      userId: bugReports.userId,
      reporterEmail: users.email,
      reporterName: users.name,
      description: bugReports.description,
      category: bugReports.category,
      page: bugReports.page,
      modelId: bugReports.modelId,
      userAgent: bugReports.userAgent,
      viewport: bugReports.viewport,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
    })
    .from(bugReports)
    .leftJoin(users, eq(bugReports.userId, users.id))
    .where(where)
    /* `id` is the tiebreak, and it is not decoration: `createdAt` is a
       second-resolution timestamp, so two reports sent in the same second have
       no stable order without it and the queue can reshuffle between two reads
       of the same data. Found by driving the surface — two fixture rows landed
       in one second and the page's order changed under a refresh. */
    .orderBy(desc(bugReports.createdAt), desc(bugReports.id))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ value: count() })
    .from(bugReports)
    .where(where);

  return { rows: rows as BugReportRow[], total: Number(totalRow?.value ?? 0) };
}

/**
 * The queue's shape at a glance — how many sit at each status.
 *
 * DERIVED by grouping the rows rather than kept as a second set of counters
 * (working law 4): a tally beside the table it counts drifts from it.
 */
export async function getBugReportCounts(): Promise<Record<BugReportStatus, number> & { total: number }> {
  const empty = { new: 0, reviewing: 0, resolved: 0, dismissed: 0, total: 0 };
  const db = await getDb();
  if (!db) return empty;

  const rows = await db
    .select({ status: bugReports.status, value: count() })
    .from(bugReports)
    .groupBy(bugReports.status);

  const out = { ...empty };
  for (const row of rows) {
    const n = Number(row.value ?? 0);
    out[row.status as BugReportStatus] = n;
    out.total += n;
  }
  return out;
}

/**
 * Move one report through the workflow.
 *
 * Returns `{ changed, previousStatus }` rather than a bare boolean because the
 * caller writes an audit row naming what it moved FROM, and re-deriving that
 * with a second read is a race — a second admin can move the same row between
 * the read and the write. The previous status is taken inside the same
 * transaction as the update.
 *
 * `changed: false` with a `previousStatus` means the row exists and already sat
 * at that status; `previousStatus: null` means no such row. The two are
 * different answers and the surface says different things about them.
 */
export async function updateBugReportStatus(input: {
  id: number;
  status: BugReportStatus;
}): Promise<{ changed: boolean; previousStatus: BugReportStatus | null }> {
  return withTransaction(async (tx) => {
    const [existing] = await tx
      .select({ status: bugReports.status })
      .from(bugReports)
      .where(eq(bugReports.id, input.id))
      .for("update")
      .limit(1);

    if (!existing) return { changed: false, previousStatus: null };
    const previousStatus = existing.status as BugReportStatus;
    if (previousStatus === input.status) return { changed: false, previousStatus };

    await tx
      .update(bugReports)
      .set({ status: input.status })
      .where(eq(bugReports.id, input.id));

    return { changed: true, previousStatus };
  });
}

/**
 * ⚠ Deliberately absent, and named so nobody adds it by reflex: there is no
 * `deleteBugReport`. A report is a message from a person; the workflow's own
 * terminal states are `resolved` and `dismissed`, and both KEEP what they were
 * told. Removing customer prose from the record is a founder decision, not a
 * convenience on a support queue.
 */

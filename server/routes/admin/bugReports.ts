/**
 * The bug-report inbox (#255) — the reader a customer's report never had.
 *
 * Founder ruling, 2026-08-30, verbatim and entire:
 *
 *   "D is the right long-term answer probably in the admin panel first not the
 *    moderator panel yet. no point taking shortcuts."
 *
 * # This is a DELIBERATE, DOCUMENTED EXCEPTION to the access-control grid
 *
 * CLAUDE.md puts bug reports under the default for resources not in the grid:
 * *owner-only for users, none for staff*. Putting a customer's own prose in
 * front of an admin is broader than that default, which is exactly why the
 * founder was asked rather than told. The grid is updated in the same change
 * that ships this — a widening that lives only in code is how the grid stops
 * describing the product.
 *
 * # Admin FIRST, not admin ONLY
 *
 * His word was `first`. The moderator surface is deferred, not refused, so
 * nothing here is shaped around the admin role: the db reader takes no role
 * argument and makes no role decision, and a moderator inbox later is a second
 * procedure over the same reader rather than a rewrite. What it is NOT is
 * `moderatorProcedure` — admins inherit that middleware, so using it here would
 * have shipped the moderator surface he deferred, silently, on the same day.
 *
 * # No delete, and no export
 *
 * The workflow's terminal states (`resolved`, `dismissed`) both KEEP what the
 * customer said. There is no delete procedure and no CSV export: an export of
 * customer prose is a second decision about where that prose may travel, and it
 * was not the one he was asked.
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import { logAdminAction, writeImmutableLog } from "../../security/adminSecurity";
import { BUG_REPORT_CATEGORIES, BUG_REPORT_STATUSES } from "../../../shared/bugReportVocabulary";

const statusEnum = z.enum(BUG_REPORT_STATUSES);
const categoryEnum = z.enum(BUG_REPORT_CATEGORIES);

/**
 * `.strict()` on both inputs (invariant 4). Neither is optional-wrapped: a
 * `ZodOptional` has no `.strict` in zod 4, so `.strict()` must sit INSIDE an
 * `.optional()` — the tempting repair is to drop the `.optional()`, and that
 * rejects a caller sending no input at all. These take a required object with
 * every field optional instead, which the client always satisfies.
 */
export const bugReportsRouter = router({
  /** The queue, newest first, with the total behind the page. */
  getBugReports: adminProcedure
    .input(
      z
        .object({
          status: statusEnum.optional(),
          category: categoryEnum.optional(),
          limit: z.number().int().min(1).max(100).default(25),
          offset: z.number().int().min(0).default(0),
        })
        .strict()
    )
    .query(async ({ input }) => {
      const { listBugReports } = await import("../../db");
      return listBugReports(input);
    }),

  /** How many sit at each status — derived from the rows, never a counter. */
  getBugReportCounts: adminProcedure.query(async () => {
    const { getBugReportCounts } = await import("../../db");
    return getBugReportCounts();
  }),

  /**
   * Move one report through the workflow.
   *
   * The audit row names what it moved FROM as well as to, and the previous
   * status comes out of the same transaction as the write rather than from a
   * second read — two admins working the same queue is the ordinary case, not
   * the exotic one.
   *
   * ⚠ **The audit row carries the id, the category and the transition, and
   * NEVER the description.** The audit log is a staff-wide surface with its own
   * moderator readers; copying a customer's prose into it would widen the
   * exception this router documents, through a side door, to a role the founder
   * deferred.
   */
  updateBugReportStatus: adminProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          status: statusEnum,
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      const { updateBugReportStatus } = await import("../../db");
      const result = await updateBugReportStatus(input);

      if (result.previousStatus === null) {
        return { ok: false as const, reason: "not_found" as const };
      }
      if (!result.changed) {
        return { ok: true as const, changed: false as const, status: input.status };
      }

      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || "Admin",
        action: "UPDATE_BUG_REPORT_STATUS",
        targetType: "bug_report",
        targetId: String(input.id),
        details: `Bug report #${input.id}: ${result.previousStatus} → ${input.status}`,
      });
      await writeImmutableLog("UPDATE_BUG_REPORT_STATUS", {
        adminId: ctx.user.id,
        bugReportId: input.id,
        from: result.previousStatus,
        to: input.status,
      });

      return { ok: true as const, changed: true as const, status: input.status };
    }),
});

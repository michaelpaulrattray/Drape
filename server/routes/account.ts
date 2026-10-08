/**
 * Account Router — the GDPR data export (Article 20).
 *
 * ⚠ **IT USED TO CARRY A SECOND ERASURE ENTRANCE AND NO LONGER DOES — #1962.**
 * `account.deleteAccount` ran the same `deleteUserData` as `auth.deleteAccount`,
 * had no caller in the app (`SecuritySection.tsx` calls `auth.deleteAccount`
 * and nothing else), and carried a rate limit that did nothing: it called
 * `checkRateLimit` and dropped the verdict, where `checkRateLimit` RETURNS
 * `{ allowed }` and never throws. So its own comment — *"1 attempt per 5
 * minutes to prevent abuse"* — described a control that was not invoked
 * (invariants 6 and 7), and its input schema was not `.strict()` (invariant 4).
 *
 * It was RETIRED rather than repaired, which is the card's own preference and
 * the right one: one erasure entrance is the one that carries #1954/#1960's
 * in-flight-render refusal, and a second entrance is a second place to keep
 * every future rule about erasure. The surviving entrance is also the better
 * one — it clears the session cookie, which this never did.
 *
 * Measured before anything was deleted: **zero rows, all time**, on production
 * for `account.deleted`, `account.deletion_requested`, `account.deletion_failed`
 * and `account.deletion_completed` — no account has ever been erased, so the
 * three audit actions only this road wrote have never been written, and nothing
 * historical loses a name by their going with it.
 *
 * `server/accountErasureEntrance.test.ts` is the absence test that stops it
 * coming back quietly, and it is the shape the deleted public Cast registry's
 * absence tests already use.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { exportUserData } from "../db/gdprExport";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS } from "../../drizzle/schema";
import { checkRateLimit } from "../security/rateLimit";
import { TRPCError } from "@trpc/server";
import { getEvidenceDeliveryAdapter } from "../casting/evidence/evidenceDeliveryRuntime";

export const accountRouter = router({
  /**
   * Export all personal data for the authenticated user (GDPR Article 20).
   * Returns a structured JSON object with all user data.
   * Rate limited to 1 request per 5 minutes.
   */
  exportData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    /*
      ⚠ **THE VERDICT IS READ — #1962, and it was not until this card.** This
      was `checkRateLimit(…)` with the result dropped, and `checkRateLimit`
      returns `{ allowed }` rather than throwing, so the comment above it
      described a limit that did not exist. It is the sibling of the one the
      card was filed about, in the same file, and it is the one that MATTERS:
      a GDPR export assembles every row and every URL an account owns, so an
      unenforced limit is an unbounded read of the most expensive projection
      the product has.

      A real `TOO_MANY_REQUESTS` rather than a 200 carrying an error field, per
      invariant 6, and the message says when — the shape `routes/referral.ts`
      already uses on both its limits.

      Measured at the code the day it was fixed: exactly TWO of the thirty
      `checkRateLimit` call sites under `server/` discarded their verdict, and
      both were in this file. `server/rateLimitVerdictRead.test.ts` is the
      derived sweep that keeps it that way.
    */
    const rl = checkRateLimit(`data-export:${userId}`, {
      maxRequests: 1,
      windowMs: 300_000,
    });
    if (!rl.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `You can export your data once every 5 minutes. Try again in ${Math.ceil(rl.resetIn / 60000)} minutes.`,
      });
    }

    await logAuditEvent({
      action: AUDIT_ACTIONS.DATA_EXPORT_REQUESTED,
      userId,
      severity: "info",
      metadata: { requestedAt: new Date().toISOString() },
    });

    const data = await exportUserData(
      userId,
      getEvidenceDeliveryAdapter() ?? undefined,
    );
    if (!data) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User data not found.",
      });
    }

    return data;
  }),

});

/**
 * refundCopy — ONE truthful vocabulary for refund outcomes, shared
 * client/server (Batch C final review correction 1).
 *
 * A failed slot / candidate carries `refunded` (the credits that ACTUALLY
 * recorded — 0 when the automatic refund failed) and optionally the
 * deterministic `refundReference` support needs for manual reconciliation.
 * Every surface that speaks about the money derives its sentence here, so
 * "you weren't charged" can never be claimed for a refund that didn't land.
 *
 * ⚠ **`refunded` IS A LEDGER NUMBER AND THE SENTENCE SAYS THE DISPLAY ONE**
 * (#1600, 2026-10-02). Every caller hands this the figure the ledger recorded,
 * which is what it must stay — the reference it quotes and the row support
 * reconciles are both ledger. The conversion belongs here rather than at the
 * four call sites, because a sentence is built once and read on four surfaces:
 * `ViewTabs`, `CastNode`, `useCastingPackageRefresh` and `useCastGate`.
 */

import { displayRefund, formatCredits } from "./creditDisplay";

export interface RefundedFailure {
  refunded: number;
  refundReference?: string;
}

/** The money half of any failure sentence. */
export function refundOutcomeText(f: RefundedFailure): string {
  if (f.refunded > 0) {
    const shown = displayRefund(f.refunded);
    /*
      ⚠ A REFUND SMALLER THAN ONE DISPLAY CREDIT MUST NOT READ AS ZERO.
      `displayRefund` floors, which is right everywhere else — it never claims
      more credits came back than did — but floored to 0 it would print
      "0 credits refunded — you weren't charged", which is the one sentence a
      refund line cannot say. It is unreachable today and this is a backstop
      rather than a feature: every refundable unit in the product is a multiple
      of 5 (`server/creditPriceScale.test.ts` refuses a declared price that is
      not), so the branch exists for the day a proportional refund is not.
    */
    return shown > 0
      ? `${formatCredits(shown)} credits refunded — you weren't charged.`
      : `Your credits were refunded — you weren't charged.`;
  }
  return f.refundReference
    ? `The automatic refund couldn't be recorded — quote ${f.refundReference} and support will restore the credits.`
    : `The automatic refund couldn't be recorded — contact support to restore the credits.`;
}

/** Short badge/annotation form for failed-slot chips and cards. */
export function refundBadgeText(refunded: number): string {
  return refunded > 0 ? "You weren't charged" : "Refund pending — contact support";
}

/** The full toast for a failed mint/refresh slot. `markerPersisted: false`
 *  means the durable Retry marker itself could not be saved — never promise
 *  the failure will survive reopening when it won't. */
export function slotFailureMessage(f: RefundedFailure & {
  label: string;
  reason: string;
  markerPersisted?: boolean;
}): string {
  const marker =
    f.markerPersisted === false
      ? " The failure couldn't be saved to the package — if it isn't shown after reopening, the view is still missing."
      : ' It\'s marked "Retry" in the package.';
  return `${f.label} view failed — ${f.reason} ${refundOutcomeText(f)}${marker}`;
}

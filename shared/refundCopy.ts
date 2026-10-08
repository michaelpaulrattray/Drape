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

/**
 * THE ONE SENTENCE FOR CREDITS THAT CAME BACK — *"{N} credits returned."*
 *
 * His word, 2026-10-08, approving Yuna's in-app money wording (#1940, B13/B14/
 * B17/B21/B22): *"on 1 and 2 go with your reccomendations"*. It replaces four
 * spellings that had grown apart — *"N credits refunded — you weren't
 * charged."*, *"N credits were refunded."*, *"The charged credits were
 * refunded."* and *"Your N credits are back."* — and it lives HERE so the
 * server's receipts and the client's lines cannot drift apart again (working
 * law 4). Every caller hands it the LEDGER figure; the display conversion is
 * this function's job, exactly as it was `refundOutcomeText`'s (#1600).
 *
 * ⚠ A REFUND SMALLER THAN ONE DISPLAY CREDIT MUST NOT READ AS ZERO.
 * `displayRefund` floors, which is right everywhere else — it never claims
 * more credits came back than did — but floored to 0 it would print "0
 * credits returned", which is the one sentence a refund line cannot say. It is
 * unreachable today and this is a backstop rather than a feature: every
 * refundable unit in the product is a multiple of 5
 * (`server/creditPriceScale.test.ts` refuses a declared price that is not).
 */
export function creditsReturnedText(ledgerRefunded: number): string {
  const shown = displayRefund(ledgerRefunded);
  return shown > 0
    ? `${formatCredits(shown)} credits returned.`
    : "Your credits were returned.";
}

/** The money half of any failure sentence. */
export function refundOutcomeText(f: RefundedFailure): string {
  if (f.refunded > 0) return creditsReturnedText(f.refunded);
  return f.refundReference
    ? `The automatic refund couldn't be recorded — quote ${f.refundReference} and support will restore the credits.`
    : `The automatic refund couldn't be recorded — contact support to restore the credits.`;
}

/**
 * The reason a failed view gives, ready to be followed by a full stop.
 *
 * ⚠ THE SURFACE SUPPLIES THE STOP, SO A REASON THAT ARRIVES WITH ONE OF ITS
 * OWN READS *"…so we didn't keep it.."* (#1904's defect, caught at the
 * composed line in `packageOrchestrator.test.ts`). Most reasons ship bare, but
 * a server message passed through `publicErrorMessage` can end in its own
 * stop, so the join trims it rather than trusting every author to remember.
 */
export function bareReason(reason: string): string {
  return reason.trim().replace(/[.\s]+$/, "");
}

/** Short badge/annotation form for failed-slot chips and cards. */
export function refundBadgeText(refunded: number): string {
  return refunded > 0 ? "Credits returned" : "Refund pending — contact support";
}

/** The full toast for a failed mint/refresh slot. `markerPersisted: false`
 *  means the durable Try again marker itself could not be saved — never promise
 *  the failure will survive reopening when it won't. */
export function slotFailureMessage(f: RefundedFailure & {
  label: string;
  reason: string;
  markerPersisted?: boolean;
}): string {
  const marker =
    f.markerPersisted === false
      ? " The failure couldn't be saved to the package — if it isn't shown after reopening, the view is still missing."
      : ' It\'s marked "Try again" in the package.';
  return `${f.label} view failed — ${bareReason(f.reason)}. ${refundOutcomeText(f)}${marker}`;
}

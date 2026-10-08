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

/**
 * The money half of any failure sentence — **and it is EMPTY when no money was
 * ever owed (#1968).**
 *
 * ⚠ **THREE STATES, NOT TWO, AND THE THIRD ARRIVED WITH HIS FLAT SIGN PRICE.**
 * This read `refunded > 0` and treated everything else as a refund that had
 * been attempted and failed — correct while every failed view refunded its own
 * slice, because a zero could only mean the ledger write did not land. Since
 * his word of 2026-10-08 a refused view on a signed package refunds NOTHING by
 * design (views are cut from two sheets and *"can't be refunded one by one"*),
 * so a zero now has two possible meanings and only one of them is a fault.
 *
 * **The `refundReference` is what tells them apart, and it is a receipt rather
 * than a convention**: a refund that was attempted always has one, recorded or
 * not (`recordRefund` returns its reference either way), and a road that never
 * attempted one has nothing to quote. So:
 *
 * | `refunded` | reference | what the customer is told |
 * |---|---|---|
 * | > 0 | any | *"N credits returned."* |
 * | 0 | present | the refund failed — quote it to support |
 * | 0 | absent | **nothing**, because nothing was owed |
 *
 * ⚠ **THE EMPTY STRING IS LOAD-BEARING: every caller joins around it** with
 * {@link joinSentences}. A surface that interpolated it blind would print a
 * double space, or worse a dangling dash.
 *
 * ⚠ **AND THE DIRECTION OF THE OLD DEFAULT IS WHY THIS COULD NOT BE LEFT
 * ALONE.** With `refunded: 0` and no reference the old reading told a customer
 * *"The automatic refund couldn't be recorded — contact support to restore the
 * credits."* on a view that was never refundable: an invented fault, an
 * invented errand, about money that was never owed. Rows written before #1968
 * all carry a reference, so their sentences are untouched.
 */
export function refundOutcomeText(f: RefundedFailure): string {
  if (f.refunded > 0) return creditsReturnedText(f.refunded);
  if (!f.refundReference) return "";
  return `The automatic refund couldn't be recorded — quote ${f.refundReference} and support will restore the credits.`;
}

/**
 * Joins sentence parts, dropping the empty ones.
 *
 * Exists because {@link refundOutcomeText} may be empty and three surfaces
 * compose it into a longer line. One join rather than three is working law 4
 * pointed at punctuation — the kind of thing that drifts into a double space
 * on one surface and a dangling dash on another.
 */
export function joinSentences(
  ...parts: readonly (string | false | null | undefined)[]
): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
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

/**
 * Short badge/annotation form for failed-slot chips and cards — **empty when
 * no money was owed (#1968).**
 *
 * ⚠ **IT TOOK A BARE `refunded: number` AND THAT IS WHY IT HAD TO CHANGE
 * SHAPE.** A number cannot tell "no refund was owed" from "the refund failed",
 * and with the Sign's per-view refund gone the second reading is wrong on
 * every refused view: the badge would have read *"refund pending — contact
 * support"* under a picture that was never refundable. It takes the whole
 * failure now, so it reads the same three states {@link refundOutcomeText}
 * does.
 */
export function refundBadgeText(f: RefundedFailure): string {
  if (f.refunded > 0) return "Credits returned";
  if (!f.refundReference) return "";
  return "Refund pending — contact support";
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
      ? "The failure couldn't be saved to the package — if it isn't shown after reopening, the view is still missing."
      : 'It\'s marked "Try again" in the package.';
  /* The money half can be empty (#1968), so the parts are joined rather than
     interpolated — `joinSentences` carries why. */
  return joinSentences(
    `${f.label} view failed — ${bareReason(f.reason)}.`,
    refundOutcomeText(f),
    marker,
  );
}

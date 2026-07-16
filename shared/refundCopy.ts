/**
 * refundCopy — ONE truthful vocabulary for refund outcomes, shared
 * client/server (Batch C final review correction 1).
 *
 * A failed slot / candidate carries `refunded` (the credits that ACTUALLY
 * recorded — 0 when the automatic refund failed) and optionally the
 * deterministic `refundReference` support needs for manual reconciliation.
 * Every surface that speaks about the money derives its sentence here, so
 * "you weren't charged" can never be claimed for a refund that didn't land.
 */

export interface RefundedFailure {
  refunded: number;
  refundReference?: string;
}

/** The money half of any failure sentence. */
export function refundOutcomeText(f: RefundedFailure): string {
  if (f.refunded > 0) {
    return `${f.refunded} credits refunded — you weren't charged.`;
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

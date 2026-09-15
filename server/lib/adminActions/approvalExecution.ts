/**
 * What the review procedure hands the executor for an approved change request:
 * the target and the params, built from the stored row.
 *
 * Lifted out of `reviewChangeRequest` unchanged (#923) so that
 * `server/changeRequestApprovalBlocker.test.ts` can drive the REAL mapping into
 * the REAL executors. A sweep that rebuilt these params itself would be a
 * second copy of this function, and would stay green while this one drifted.
 */
export function approvalExecution(request: {
  id: number;
  type: string;
  title: string;
  targetUserId: number;
  creditAmount?: number | null;
  creditReason?: string | null;
  ipAddress?: string | null;
  stripeSessionId?: string | null;
  refundType?: string | null;
  originalCredits?: number | null;
}): { targetId: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = {
    changeRequestId: request.id,
    reason: request.title,
  };
  if (request.creditAmount) params.creditAmount = request.creditAmount;
  if (request.creditReason) params.creditReason = request.creditReason;
  if (request.ipAddress) params.reason = `${request.title} (IP: ${request.ipAddress})`;
  // ⚠ The stripe_refund executor reads these three off the approval
  // params, and until #418 nothing put them there — every approved
  // Stripe refund would have died at execution on "Missing Stripe
  // session ID". The AMOUNT is deliberately not carried: the executor
  // reads it from the charge itself at the moment money moves.
  if (request.type === "stripe_refund") {
    params.stripeSessionId = request.stripeSessionId;
    params.refundType = request.refundType;
    params.originalCredits = request.originalCredits;
  }

  // ⚠ The `&& request.ipAddress` half of this condition is UNREACHABLE on the
  // approve road — the review procedure refuses an address-less `block_ip`
  // before this runs (#921, now `changeRequestApprovalBlocker`). It is kept
  // rather than simplified away because it is the thing that would go wrong if
  // that refusal were ever removed: a reader deleting it would find a bare
  // `request.ipAddress` here and have to think about the null, where a
  // cleaned-up ternary would silently hand the executor `undefined`. Belt and
  // braces, and the braces are the refusal.
  const targetId = request.type === "block_ip" && request.ipAddress
    ? request.ipAddress
    : String(request.targetUserId);

  return { targetId, params };
}

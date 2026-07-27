export const INK_ADD_CAPABILITY_KEY = "ink.add.front_upper_torso.v1" as const;
export const INK_ADD_PRICE_CREDITS = 350 as const;
export const EVIDENCE_CANDIDATE_MAX_ATTEMPTS = 2 as const;

export const EVIDENCE_INTENT_STATUSES = [
  "pending",
  "resolved",
  "cancelled",
] as const;
export type EvidenceIntentStatus = typeof EVIDENCE_INTENT_STATUSES[number];

export const EVIDENCE_CANDIDATE_STATUSES = [
  "processing",
  "ready",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
  "invalid",
] as const;
export type EvidenceCandidateStatus =
  typeof EVIDENCE_CANDIDATE_STATUSES[number];

export const EVIDENCE_CANDIDATE_ATTEMPT_STATUSES = [
  "planned",
  "generating",
  "stored",
  "probe_passed",
  "probe_failed",
  "probe_unknown",
  "promoted",
  "cleanup_pending",
  "cleaned",
] as const;
export type EvidenceCandidateAttemptStatus =
  typeof EVIDENCE_CANDIDATE_ATTEMPT_STATUSES[number];

export const EVIDENCE_CANDIDATE_BILLING_ROLES = [
  "charged_attempt",
  "included_retry",
] as const;
export type EvidenceCandidateBillingRole =
  typeof EVIDENCE_CANDIDATE_BILLING_ROLES[number];

export const EVIDENCE_PROBE_OUTCOMES = ["pass", "fail", "unknown"] as const;
export type EvidenceProbeOutcome = typeof EVIDENCE_PROBE_OUTCOMES[number];

const INTENT_TRANSITIONS: Readonly<
  Record<EvidenceIntentStatus, readonly EvidenceIntentStatus[]>
> = {
  pending: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

const CANDIDATE_TRANSITIONS: Readonly<
  Record<EvidenceCandidateStatus, readonly EvidenceCandidateStatus[]>
> = {
  processing: ["ready", "invalid"],
  ready: ["accepted", "rejected", "cancelled", "expired"],
  accepted: [],
  rejected: [],
  cancelled: [],
  expired: [],
  invalid: [],
};

const ATTEMPT_TRANSITIONS: Readonly<
  Record<EvidenceCandidateAttemptStatus, readonly EvidenceCandidateAttemptStatus[]>
> = {
  planned: ["generating", "cleanup_pending"],
  generating: ["stored", "cleanup_pending"],
  stored: ["probe_passed", "probe_failed", "probe_unknown", "cleanup_pending"],
  probe_passed: ["promoted", "cleanup_pending"],
  probe_failed: ["cleanup_pending"],
  probe_unknown: ["cleanup_pending"],
  promoted: ["cleanup_pending"],
  cleanup_pending: ["cleaned"],
  cleaned: [],
};

function assertClosedValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): asserts value is T {
  if (!values.includes(value as T)) {
    throw new TypeError(`Unknown ${label}`);
  }
}

export function assertEvidenceIntentStatus(
  value: unknown,
): asserts value is EvidenceIntentStatus {
  assertClosedValue(value, EVIDENCE_INTENT_STATUSES, "evidence intent status");
}

export function assertEvidenceCandidateStatus(
  value: unknown,
): asserts value is EvidenceCandidateStatus {
  assertClosedValue(
    value,
    EVIDENCE_CANDIDATE_STATUSES,
    "evidence candidate status",
  );
}

export function assertEvidenceCandidateAttemptStatus(
  value: unknown,
): asserts value is EvidenceCandidateAttemptStatus {
  assertClosedValue(
    value,
    EVIDENCE_CANDIDATE_ATTEMPT_STATUSES,
    "evidence candidate attempt status",
  );
}

export function assertEvidenceProbeOutcome(
  value: unknown,
): asserts value is EvidenceProbeOutcome {
  assertClosedValue(value, EVIDENCE_PROBE_OUTCOMES, "evidence probe outcome");
}

function canTransition<T extends string>(
  transitions: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
): boolean {
  return transitions[from].includes(to);
}

export function canTransitionEvidenceIntent(
  from: EvidenceIntentStatus,
  to: EvidenceIntentStatus,
): boolean {
  return canTransition(INTENT_TRANSITIONS, from, to);
}

export function canTransitionEvidenceCandidate(
  from: EvidenceCandidateStatus,
  to: EvidenceCandidateStatus,
): boolean {
  return canTransition(CANDIDATE_TRANSITIONS, from, to);
}

export function canTransitionEvidenceCandidateAttempt(
  from: EvidenceCandidateAttemptStatus,
  to: EvidenceCandidateAttemptStatus,
): boolean {
  return canTransition(ATTEMPT_TRANSITIONS, from, to);
}

export function evidenceCandidateAttemptCost(
  role: EvidenceCandidateBillingRole,
): number {
  return role === "charged_attempt" ? INK_ADD_PRICE_CREDITS : 0;
}

export type EvidenceCandidateSettlementEvidence =
  | "unresolved"
  | "pre_delivery_failure"
  | "durable_ready_candidate";

export interface EvidenceCandidateBillingTruth {
  plannedCredits: typeof INK_ADD_PRICE_CREDITS;
  chargedCredits: 0 | typeof INK_ADD_PRICE_CREDITS;
  refundedCredits: 0 | typeof INK_ADD_PRICE_CREDITS;
  netCredits: 0 | typeof INK_ADD_PRICE_CREDITS;
  requiresRecovery: boolean;
}

/**
 * Parent-operation billing authority. Internal attempt rows never multiply
 * charges or refunds: one candidate episode has at most one semantic charge.
 */
export function deriveEvidenceCandidateBillingTruth(input: {
  chargeRecorded: boolean;
  settlementEvidence: EvidenceCandidateSettlementEvidence;
}): EvidenceCandidateBillingTruth {
  const chargedCredits = input.chargeRecorded ? INK_ADD_PRICE_CREDITS : 0;
  if (input.settlementEvidence === "unresolved") {
    return {
      plannedCredits: INK_ADD_PRICE_CREDITS,
      chargedCredits,
      refundedCredits: 0,
      netCredits: chargedCredits,
      requiresRecovery: true,
    };
  }
  const refundedCredits =
    input.chargeRecorded && input.settlementEvidence === "pre_delivery_failure"
      ? INK_ADD_PRICE_CREDITS
      : 0;
  return {
    plannedCredits: INK_ADD_PRICE_CREDITS,
    chargedCredits,
    refundedCredits,
    netCredits: (chargedCredits - refundedCredits) as
      | 0
      | typeof INK_ADD_PRICE_CREDITS,
    requiresRecovery: false,
  };
}

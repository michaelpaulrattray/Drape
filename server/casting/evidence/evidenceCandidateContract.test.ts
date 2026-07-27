import { describe, expect, it } from "vitest";
import {
  EVIDENCE_CANDIDATE_MAX_ATTEMPTS,
  INK_ADD_CAPABILITY_KEY,
  INK_ADD_PRICE_CREDITS,
  assertEvidenceCandidateAttemptStatus,
  assertEvidenceCandidateStatus,
  assertEvidenceIntentStatus,
  assertEvidenceProbeOutcome,
  canTransitionEvidenceCandidate,
  canTransitionEvidenceCandidateAttempt,
  canTransitionEvidenceIntent,
  deriveEvidenceCandidateBillingTruth,
  evidenceCandidateAttemptCost,
} from "./evidenceCandidateContract";

describe("R7-7D evidence candidate contract", () => {
  it("pins the one tattoo recipe, price, and two-attempt ceiling", () => {
    expect(INK_ADD_CAPABILITY_KEY).toBe("ink.add.front_upper_torso.v1");
    expect(INK_ADD_PRICE_CREDITS).toBe(350);
    expect(EVIDENCE_CANDIDATE_MAX_ATTEMPTS).toBe(2);
    expect(evidenceCandidateAttemptCost("charged_attempt")).toBe(350);
    expect(evidenceCandidateAttemptCost("included_retry")).toBe(0);
  });

  it("allows only the closed lifecycle transitions", () => {
    expect(canTransitionEvidenceIntent("pending", "resolved")).toBe(true);
    expect(canTransitionEvidenceIntent("pending", "cancelled")).toBe(true);
    expect(canTransitionEvidenceIntent("resolved", "pending")).toBe(false);

    expect(canTransitionEvidenceCandidate("processing", "ready")).toBe(true);
    expect(canTransitionEvidenceCandidate("processing", "invalid")).toBe(true);
    expect(canTransitionEvidenceCandidate("ready", "accepted")).toBe(true);
    expect(canTransitionEvidenceCandidate("ready", "rejected")).toBe(true);
    expect(canTransitionEvidenceCandidate("ready", "cancelled")).toBe(true);
    expect(canTransitionEvidenceCandidate("ready", "expired")).toBe(true);
    expect(canTransitionEvidenceCandidate("accepted", "ready")).toBe(false);
    expect(canTransitionEvidenceCandidate("processing", "accepted")).toBe(false);

    expect(canTransitionEvidenceCandidateAttempt("planned", "generating"))
      .toBe(true);
    expect(canTransitionEvidenceCandidateAttempt("generating", "stored"))
      .toBe(true);
    expect(canTransitionEvidenceCandidateAttempt("stored", "probe_passed"))
      .toBe(true);
    expect(canTransitionEvidenceCandidateAttempt("probe_passed", "promoted"))
      .toBe(true);
    expect(canTransitionEvidenceCandidateAttempt("cleanup_pending", "cleaned"))
      .toBe(true);
    expect(canTransitionEvidenceCandidateAttempt("planned", "probe_passed"))
      .toBe(false);
    expect(canTransitionEvidenceCandidateAttempt("cleaned", "generating"))
      .toBe(false);
  });

  it("keeps one semantic charge/refund regardless of child attempt count", () => {
    expect(deriveEvidenceCandidateBillingTruth({
      chargeRecorded: false,
      settlementEvidence: "pre_delivery_failure",
    })).toEqual({
      plannedCredits: 350,
      chargedCredits: 0,
      refundedCredits: 0,
      netCredits: 0,
      requiresRecovery: false,
    });
    expect(deriveEvidenceCandidateBillingTruth({
      chargeRecorded: true,
      settlementEvidence: "pre_delivery_failure",
    })).toEqual({
      plannedCredits: 350,
      chargedCredits: 350,
      refundedCredits: 350,
      netCredits: 0,
      requiresRecovery: false,
    });
    expect(deriveEvidenceCandidateBillingTruth({
      chargeRecorded: true,
      settlementEvidence: "durable_ready_candidate",
    })).toEqual({
      plannedCredits: 350,
      chargedCredits: 350,
      refundedCredits: 0,
      netCredits: 350,
      requiresRecovery: false,
    });
    expect(deriveEvidenceCandidateBillingTruth({
      chargeRecorded: true,
      settlementEvidence: "unresolved",
    })).toEqual({
      plannedCredits: 350,
      chargedCredits: 350,
      refundedCredits: 0,
      netCredits: 350,
      requiresRecovery: true,
    });
    expect(deriveEvidenceCandidateBillingTruth({
      chargeRecorded: false,
      settlementEvidence: "unresolved",
    })).toEqual({
      plannedCredits: 350,
      chargedCredits: 0,
      refundedCredits: 0,
      netCredits: 0,
      requiresRecovery: true,
    });
  });

  it("rejects unknown persisted vocabulary", () => {
    for (const assertion of [
      assertEvidenceIntentStatus,
      assertEvidenceCandidateStatus,
      assertEvidenceCandidateAttemptStatus,
      assertEvidenceProbeOutcome,
    ]) {
      expect(() => assertion("provider said maybe")).toThrow("Unknown");
    }
  });
});

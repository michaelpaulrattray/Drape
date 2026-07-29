import type {
  EvidenceProbeOutcome,
} from "../evidenceCandidateContract";
import {
  EVIDENCE_CANDIDATE_MAX_ATTEMPTS,
} from "../evidenceCandidateContract";
import type {
  InkCandidateProbeTruth,
} from "./inkProbe";
import type { InkRetryDirective } from "./inkComposer";

export type InkAttemptDecision =
  | { action: "ready" }
  | {
      action: "included_retry";
      nextAttemptNumber: 2;
      directives: readonly InkRetryDirective[];
    }
  | {
      action: "fail_and_refund";
      outcome: "fail" | "unknown";
    };

const OUTCOME_TO_DIRECTIVE: readonly [
  keyof Pick<
    InkCandidateProbeTruth,
    | "identityOutcome"
    | "placementOutcome"
    | "featureMatchOutcome"
    | "priorInkOutcome"
    | "poseFramingOutcome"
    | "unexpectedInkOutcome"
  >,
  InkRetryDirective,
][] = [
  ["identityOutcome", "identity"],
  ["placementOutcome", "placement"],
  ["featureMatchOutcome", "feature"],
  ["priorInkOutcome", "prior_ink"],
  ["poseFramingOutcome", "pose_framing"],
  ["unexpectedInkOutcome", "unexpected_ink"],
];

function failedDirectives(
  probe: InkCandidateProbeTruth,
): InkRetryDirective[] {
  return OUTCOME_TO_DIRECTIVE
    .filter(([key]) => probe[key] === "fail")
    .map(([, directive]) => directive);
}

export function decideInkCandidateAttempt(input: {
  attemptNumber: 1 | 2;
  probe: InkCandidateProbeTruth;
}): InkAttemptDecision {
  if (
    !Number.isSafeInteger(input.attemptNumber)
    || input.attemptNumber < 1
    || input.attemptNumber > EVIDENCE_CANDIDATE_MAX_ATTEMPTS
  ) {
    throw new TypeError("Invalid evidence candidate attempt number");
  }
  if (input.probe.overallOutcome === "pass") return { action: "ready" };
  if (input.probe.overallOutcome === "unknown") {
    return { action: "fail_and_refund", outcome: "unknown" };
  }
  if (input.attemptNumber === 1) {
    const directives = failedDirectives(input.probe);
    if (directives.length === 0) {
      return { action: "fail_and_refund", outcome: "unknown" };
    }
    return {
      action: "included_retry",
      nextAttemptNumber: 2,
      directives,
    };
  }
  return { action: "fail_and_refund", outcome: "fail" };
}

export function probeOutcomeAllowsCanon(
  outcome: EvidenceProbeOutcome,
): boolean {
  return outcome === "pass";
}

import { describe, expect, it } from "vitest";
import type { Generation, GenerationOperation } from "../drizzle/schema";
import {
  assertGenerationOperationLandingStatus,
  assertGenerationOperationPhase,
  assertGenerationOperationProgress,
  assertGenerationOperationStatus,
} from "./casting/operationContract";
import { toPublicGenerationOperation } from "./db/generationOperations";
import { assertGenerationAttemptLink } from "./db/generations";

const OPERATION_ID = "6fa459ea-ee8a-4ca4-894e-db77e160355e";
const REQUEST_ID = "7fa459ea-ee8a-4ca4-894e-db77e160355f";
const NOW = new Date("2026-07-19T00:00:00.000Z");

function operation(overrides: Partial<GenerationOperation> = {}): GenerationOperation {
  return {
    id: OPERATION_ID,
    userId: 12,
    clientRequestId: REQUEST_ID,
    kind: "casting.refresh",
    modelId: 44,
    originBoardId: 8,
    originItemId: 9,
    payloadHash: "a".repeat(64),
    status: "partial",
    expectedIdentityRevisionId: "revision-1",
    plannedCredits: 900,
    chargedCredits: 900,
    refundedCredits: 300,
    chargeReferenceId: `op:${OPERATION_ID}:charge`,
    result: { modelId: 44, refreshedAngles: ["sideClose"], failedAngles: ["backFull"] },
    errorCode: null,
    publicMessage: "One view could not be refreshed; its credits were refunded.",
    phase: "finalizing",
    progress: {
      total: 2,
      completed: 1,
      failed: 1,
      steps: [
        { stepKey: "view:sideClose", viewAngle: "sideClose", status: "completed" },
        { stepKey: "view:backFull", viewAngle: "backFull", status: "failed" },
      ],
    },
    heartbeatAt: NOW,
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
    landingStatus: "not_applicable",
    landedItemId: null,
    landingAcknowledgedAt: null,
    recoveryAttemptedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
    ...overrides,
  };
}

function child(overrides: Partial<Generation> = {}): Generation {
  return {
    id: 71,
    userId: 12,
    modelId: 44,
    operationId: OPERATION_ID,
    stepKey: "view:sideClose",
    viewAngle: "sideClose",
    type: "multiView",
    status: "completed",
    pointsCost: 300,
    resultUrl: "https://internal.example/result.png",
    errorMessage: "internal provider detail",
    metadata: { prompt: "must never enter the public operation DTO" },
    createdAt: NOW,
    completedAt: NOW,
    ...overrides,
  };
}

describe("R7-2A durable operation contract", () => {
  it("uses closed status, phase and landing vocabularies", () => {
    expect(() => assertGenerationOperationStatus("partial")).not.toThrow();
    expect(() => assertGenerationOperationStatus("cancelled")).toThrow("Unknown");
    expect(() => assertGenerationOperationPhase("reconciling")).not.toThrow();
    expect(() => assertGenerationOperationPhase("calling gemini with raw prompt")).toThrow("Unknown");
    expect(() => assertGenerationOperationLandingStatus("relink_required")).not.toThrow();
    expect(() => assertGenerationOperationLandingStatus("overwritten")).toThrow("Unknown");
  });

  it("validates bounded, conserved child progress", () => {
    expect(() => assertGenerationOperationProgress(operation().progress)).not.toThrow();
    expect(() => assertGenerationOperationProgress({
      total: 1,
      completed: 1,
      failed: 1,
      steps: [],
    })).toThrow("exceeds");
    expect(() => assertGenerationOperationProgress({
      total: 2,
      completed: 0,
      failed: 0,
      steps: [
        { stepKey: "view:sideClose", status: "pending" },
        { stepKey: "view:sideClose", status: "processing" },
      ],
    })).toThrow("duplicate");
    expect(() => assertGenerationOperationProgress({
      total: 1,
      completed: 0,
      failed: 0,
      steps: [{ stepKey: "headshot", status: "completed" }],
    })).toThrow("counts do not match");
  });

  it("allows legacy unlinked attempts and requires complete trusted linkage otherwise", () => {
    expect(() => assertGenerationAttemptLink({ operationId: null, stepKey: null, viewAngle: null })).not.toThrow();
    expect(() => assertGenerationAttemptLink({
      operationId: OPERATION_ID,
      stepKey: "view:sideClose",
      viewAngle: "sideClose",
    })).not.toThrow();
    expect(() => assertGenerationAttemptLink({
      operationId: null,
      stepKey: "view:sideClose",
      viewAngle: null,
    })).toThrow("requires an operation id");
    expect(() => assertGenerationAttemptLink({
      operationId: OPERATION_ID,
      stepKey: null,
      viewAngle: null,
    })).toThrow("step key");
  });

  it("projects only public-safe operation and child truth", () => {
    const projected = toPublicGenerationOperation(operation(), [child()]);
    expect(projected).toMatchObject({
      operationId: OPERATION_ID,
      status: "partial",
      netCredits: 600,
      cancellable: false,
      children: [{
        id: 71,
        stepKey: "view:sideClose",
        viewAngle: "sideClose",
        status: "completed",
        pointsCost: 300,
      }],
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain("payloadHash");
    expect(serialized).not.toContain("chargeReferenceId");
    expect(serialized).not.toContain("resultUrl");
    expect(serialized).not.toContain("internal provider detail");
    expect(serialized).not.toContain("must never enter");
  });

  it("fails closed on corrupt stored progress, result or child ownership", () => {
    expect(() => toPublicGenerationOperation(operation({ progress: { rawPrompt: "secret" } }), []))
      .toThrow("progress.total");
    expect(() => toPublicGenerationOperation(operation({ result: { prompt: "secret" } }), []))
      .toThrow("forbidden field");
    expect(() => toPublicGenerationOperation(operation(), [child({ operationId: REQUEST_ID })]))
      .toThrow("different operation");
    expect(() => toPublicGenerationOperation(operation(), [child({ userId: 13 })]))
      .toThrow("different operation");
  });
});

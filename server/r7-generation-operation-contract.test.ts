import { describe, expect, it } from "vitest";
import {
  assertCreditConservation,
  assertGenerationOperationKind,
  assertOperationLockKey,
  assertPublicOperationResult,
  boardItemOperationLockKey,
  hashGenerationOperationClaim,
  modelOperationLockKey,
  operationChargeReference,
  stableCanonicalJson,
} from "./casting/operationContract";
import {
  assertClientRequestId,
  createClientRequestId,
  isClientRequestId,
} from "../shared/clientRequestId";

const REQUEST_ID = "6fa459ea-ee8a-4ca4-894e-db77e160355e";

describe("R7-1C operation contract", () => {
  it("creates and validates UUID client request ids", () => {
    const requestId = createClientRequestId();
    expect(isClientRequestId(requestId)).toBe(true);
    expect(() => assertClientRequestId("not-a-uuid")).toThrow("clientRequestId must be a UUID");
  });

  it("canonicalizes plain JSON independent of object insertion order", () => {
    expect(stableCanonicalJson({ z: 1, a: { y: 2, x: [true, null] } }))
      .toBe(stableCanonicalJson({ a: { x: [true, null], y: 2 }, z: 1 }));
    expect(stableCanonicalJson({ selected: "pink", omitted: undefined }))
      .toBe(stableCanonicalJson({ selected: "pink" }));
    expect(() => stableCanonicalJson([undefined])).toThrow("only JSON values");
    expect(() => stableCanonicalJson({ value: Number.NaN })).toThrow("non-finite");
    expect(() => stableCanonicalJson({ when: new Date() })).toThrow("plain JSON objects");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => stableCanonicalJson(cyclic)).toThrow("must not be cyclic");
    expect(() => stableCanonicalJson(new Array(2))).toThrow("sparse arrays");
  });

  it("hashes the complete trusted envelope without persisting its raw material", () => {
    const base = {
      clientRequestId: REQUEST_ID,
      kind: "casting.iterate" as const,
      modelId: 7,
      originBoardId: 3,
      originItemId: 11,
      payload: { feedback: "make the hair pink", assetId: 19 },
    };
    const hash = hashGenerationOperationClaim(base);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("hair");
    expect(hashGenerationOperationClaim({ ...base, payload: { assetId: 19, feedback: "make the hair pink" } }))
      .toBe(hash);
    expect(hashGenerationOperationClaim({ ...base, modelId: 8 })).not.toBe(hash);
    expect(hashGenerationOperationClaim({ ...base, originItemId: 12 })).not.toBe(hash);
    expect(hashGenerationOperationClaim({ ...base, kind: "casting.refresh" })).not.toBe(hash);
  });

  it("uses the closed operation-kind and resource-lock vocabularies", () => {
    expect(() => assertGenerationOperationKind("casting.iterate")).not.toThrow();
    expect(() => assertGenerationOperationKind("casting.restore")).not.toThrow();
    expect(() => assertGenerationOperationKind("model.delete")).not.toThrow();
    expect(() => assertGenerationOperationKind("casting.unknown")).toThrow("Unknown");
    expect(modelOperationLockKey(12)).toBe("model:12");
    expect(boardItemOperationLockKey(8)).toBe("board-item:8");
    expect(() => assertOperationLockKey("model:0")).toThrow("Invalid");
    expect(() => assertOperationLockKey("user:12")).toThrow("Invalid");
  });

  it("derives the only valid charge reference from the server operation id", () => {
    expect(operationChargeReference(REQUEST_ID)).toBe(`op:${REQUEST_ID}:charge`);
    expect(() => operationChargeReference("client-chosen")).toThrow();
  });

  it("rejects sensitive fields from replayable public results", () => {
    expect(() => assertPublicOperationResult({ modelId: 7, assetIds: [1, 2] })).not.toThrow();
    for (const value of [
      { prompt: "raw" },
      { nested: { referenceImage: "data:image/png;base64,..." } },
      { maskBase64: "raw" },
      { authToken: "secret" },
    ]) {
      expect(() => assertPublicOperationResult(value)).toThrow("forbidden field");
    }
  });

  it("enforces non-negative conserved credit totals", () => {
    expect(() => assertCreditConservation(900, 300)).not.toThrow();
    expect(() => assertCreditConservation(300, 301)).toThrow("invalid");
    expect(() => assertCreditConservation(-1, 0)).toThrow("invalid");
    expect(() => assertCreditConservation(1.5, 0)).toThrow("invalid");
  });
});

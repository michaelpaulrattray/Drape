import { describe, expect, it } from "vitest";
import {
  allowedOperationLockKeys,
  assertCreditConservation,
  assertGenerationOperationKind,
  assertOperationLockKey,
  assertPublicOperationResult,
  boardItemOperationLockKey,
  castingCandidateOperationLockKey,
  castViewSlotOperationLockKey,
  hashGenerationOperationClaim,
  modelOperationLockKey,
  operationChargeReference,
  stableCanonicalJson,
} from "./casting/operationContract";
import { CAST_VIEW_ANGLES } from "../shared/boardTypes";
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
    expect(() => assertGenerationOperationKind("casting.restore_state")).not.toThrow();
    expect(() => assertGenerationOperationKind("model.delete")).not.toThrow();
    expect(() => assertGenerationOperationKind("casting.unknown")).toThrow("Unknown");
    expect(modelOperationLockKey(12)).toBe("model:12");
    expect(boardItemOperationLockKey(8)).toBe("board-item:8");
    expect(() => assertOperationLockKey("model:0")).toThrow("Invalid");
    expect(() => assertOperationLockKey("user:12")).toThrow("Invalid");
  });

  it("locks a castingV2 candidate by its INTERNAL id, in the same numeric grammar", () => {
    /*
      One face, one render (ruled fable-974). The key is derived from the row's
      internal id and never from the `publicId` a request names, so the grammar
      stays one unambiguous numeric shape — and a caller holding only
      customer-facing input cannot compose a key at all.
    */
    expect(castingCandidateOperationLockKey(41)).toBe("casting-candidate:41");
    expect(() => assertOperationLockKey("casting-candidate:41")).not.toThrow();
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => castingCandidateOperationLockKey(bad), String(bad)).toThrow(TypeError);
    }
    /* The uuid a customer's request carries is NOT a key — the shape that would
       have been reached for first, refused here so the ownership read stays the
       only way to one. */
    expect(() => assertOperationLockKey("casting-candidate:5fa47ee0-9e24-4242-9e65-b1f1f75569c2"))
      .toThrow("Invalid");
  });

  it("locks ONE VIEW SLOT of a Cast, with the angle vocabulary derived rather than retyped", () => {
    /*
      ONE SLOT, ONE TRY AGAIN (#1257).

      A signed Cast has five slots and each is asked for again on its own, so
      `model:` would serialise the whole Cast and refuse a Try again on her
      profile while her close-up rendered — his second report on #1235, from the
      other side. The angle is therefore part of the key.
    */
    expect(castViewSlotOperationLockKey(12, "closeUp")).toBe("cast-view:12:closeUp");
    expect(() => assertOperationLockKey("cast-view:12:closeUp")).not.toThrow();

    /*
      THE DERIVED ARM, and it is the point of this test rather than a flourish.

      The grammar interpolates `CAST_VIEW_ANGLES`, so every member must both
      BUILD and VALIDATE. An angle added to the strip that the validator refused
      would render and charge normally and 500 only on its lock — on the one
      road nobody would re-test.
    */
    expect(CAST_VIEW_ANGLES.length).toBeGreaterThanOrEqual(5);
    for (const angle of CAST_VIEW_ANGLES) {
      const key = castViewSlotOperationLockKey(7, angle);
      expect(key, angle).toBe(`cast-view:7:${angle}`);
      expect(() => assertOperationLockKey(key), angle).not.toThrow();
    }
    /* Every slot of one Cast is a DIFFERENT key — the exclusion is per slot. */
    expect(new Set(CAST_VIEW_ANGLES.map((angle) => castViewSlotOperationLockKey(7, angle))).size)
      .toBe(CAST_VIEW_ANGLES.length);

    /* The negative controls: an angle nobody declared, a model id nobody owns,
       and the public id a customer's request actually carries. */
    expect(() => assertOperationLockKey("cast-view:12:portrait")).toThrow("Invalid");
    expect(() => assertOperationLockKey("cast-view:0:closeUp")).toThrow("Invalid");
    expect(() => assertOperationLockKey("cast-view:12")).toThrow("Invalid");
    expect(() => assertOperationLockKey("cast-view:12:closeUp:extra")).toThrow("Invalid");
    expect(() => castViewSlotOperationLockKey(7, "portrait" as never)).toThrow(TypeError);
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => castViewSlotOperationLockKey(bad, "closeUp"), String(bad)).toThrow(TypeError);
    }
  });

  it("admits only keys naming a resource the claim declared — the lock door's whole rule", () => {
    /*
      #1257, AND THE REASON THIS ARM IS HERE RATHER THAN IN THE DB SUITE.

      `acquireGenerationOperationLock` reads an operation row, so a suite driving
      it needs a database — and this repository's CI sets no `TEST_DATABASE_URL`,
      so every arm in `r7-generation-operations-db.test.ts` SKIPS in the gate.
      The allowlist is the door's security rule; the rule is therefore a pure
      function and this is the arm that runs on every push.

      The DB suite keeps its own arms for the parts only a database can prove —
      that the INSERT is the exclusion, and that the loser's receipt is sealed.
    */
    const modelOnly = allowedOperationLockKeys({ modelId: 44, originItemId: null });
    expect(modelOnly).toContain("model:44");
    expect(modelOnly).toContain("cast-view:44:closeUp");
    /* Every slot of the claimed Cast, and nothing about any other Cast. */
    expect(modelOnly).toHaveLength(1 + CAST_VIEW_ANGLES.length);
    expect(modelOnly.filter((key) => !key.endsWith(":44") && !key.startsWith("cast-view:44:")))
      .toEqual([]);

    /* THE FORGERY CONTROLS — a key naming a Cast or an item this claim never
       declared is simply not in the list, which is what the door refuses on. */
    expect(modelOnly).not.toContain("model:45");
    expect(modelOnly).not.toContain("cast-view:45:closeUp");
    expect(modelOnly).not.toContain("board-item:44");

    const itemOnly = allowedOperationLockKeys({ modelId: null, originItemId: 8 });
    expect(itemOnly).toEqual(["board-item:8"]);
    /* A board item is not a Cast, so it unlocks no view slot. */
    expect(itemOnly.some((key) => key.startsWith("cast-view:"))).toBe(false);

    /* A claim naming nothing can lock nothing — `model.create`'s road, which the
       wire guard calls out of scope BY CONSTRUCTION rather than by exemption. */
    expect(allowedOperationLockKeys({ modelId: null, originItemId: null })).toEqual([]);

    /* Every key it offers is one the validator accepts: the door and the grammar
       cannot disagree about a shape. */
    for (const key of allowedOperationLockKeys({ modelId: 44, originItemId: 8 })) {
      expect(() => assertOperationLockKey(key), key).not.toThrow();
    }
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

  /**
   * #301 — the guard fires on the VALUE, not on the key name alone.
   *
   * The founder could not delete a Cast: `FinalCastDeletionCounts.referencePlates`
   * is a COUNT, the name contains `reference`, and the deletion's own receipt was
   * rejected as a leaked secret. The same field in a stored result made every read
   * of `generation.activeOperations` throw.
   *
   * The NEGATIVE arm below is the bug. The POSITIVE arms beside it are the point:
   * a narrowed guard that no longer bites is worse than the bug it fixed, so each
   * forbidden name is re-asserted carrying a STRING, and the string forms must
   * still be refused for the arm to mean anything.
   */
  it("lets a forbidden-sounding COUNT through and still refuses the same name carrying content", () => {
    // The founder's real payload shape: a Cast deletion's receipt.
    expect(() =>
      assertPublicOperationResult({
        modelId: 7,
        counts: { referencePlates: 3, evidenceCrops: 0, assets: 12 },
      }),
    ).not.toThrow();

    // Every value form that cannot carry a prompt, a mask or a credential.
    for (const value of [
      { referencePlates: 0 },
      { promptCount: 4 },
      { maskApplied: true },
      { secretRotated: false },
      { tokenExpiresAt: null },
      { authorizationRequired: false },
      { cookieCount: 2 },
      { base64Bytes: 1024 },
    ]) {
      expect(() => assertPublicOperationResult(value)).not.toThrow();
    }

    // POSITIVE CONTROL — the same names carrying content are still refused.
    for (const value of [
      { referencePrompt: "the whole master prompt" },
      { referencePlates: ["data:image/png;base64,..."] },
      { maskData: "raw" },
      { authorizationHeader: "Bearer live-token" },
      { cookieCount: { value: "app_session_id=…" } },
      { nested: { deep: { secretMaterial: "k" } } },
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

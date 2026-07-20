import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  OVERALL_IDENTITY_DIMENSION,
  authorizedFieldsForPatch,
  expectedObservableDimensions,
  parseGateResponse,
  protectedDimensionsFor,
  verifyIdentityEdit,
  violationsForStatuses,
  type IdentityGateVerdict,
} from "./casting/identity/editGate";
import { identityRetryDirective, runGatedIdentityGeneration } from "./casting/identity/editGateFlow";
import {
  buildIterationImagePrompt,
  castingSessionKey,
  deleteCastingSessionsFor,
  getCastingSessionFor,
  setCastingSessionFor,
} from "./casting/geminiGeneration";
import type { AuthorizedIdentityPatch, GenerationAuthorization } from "./casting/identity/identityTypes";
import { AUTHORIZABLE_FIELDS } from "./casting/identity/identityFieldHandlers";
import { SKIN_TONE_VALUES } from "../shared/castingOptions";
import { requireIdentityPatch } from "./casting/identity/identityAuthorizationGuard";
import {
  HAIR_GEOMETRY_DEPENDENT_FIELDS,
  IDENTITY_EDIT_DEPENDENCIES,
  dependentFieldsForPatch,
} from "./casting/identity/identityDependencies";

const hairColorPatch: AuthorizedIdentityPatch = {
  source: "text",
  edits: [{
    kind: "leaf",
    leaf: "person.hair.color",
    operation: "modify",
    value: { base: "Copper", override: "" },
  }],
};

const hairStylePatch: AuthorizedIdentityPatch = {
  source: "reference",
  edits: [{
    kind: "leaf",
    leaf: "person.hair.style",
    operation: "modify",
    value: { base: "", override: "layered bob" },
  }],
};

const hairLengthPatch: AuthorizedIdentityPatch = {
  source: "text",
  edits: [{
    kind: "leaf",
    leaf: "person.hair.length",
    operation: "modify",
    value: "Very Long",
  }],
};

const jawlinePatch: AuthorizedIdentityPatch = {
  source: "structured",
  edits: [{ kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: "defined angular jaw" }],
};

const skinTonePatch: AuthorizedIdentityPatch = {
  source: "structured",
  edits: [{ kind: "structured", edit: { field: "person.skinTone", value: SKIN_TONE_VALUES[0] } }],
};

function verdict(ok: boolean, checked = true): IdentityGateVerdict {
  return { ok, checked, violations: ok ? [] : [OVERALL_IDENTITY_DIMENSION] };
}

describe("W5 identity gate — exact authorization boundary", () => {
  it("refuses an identity authorization that is missing its typed patch", () => {
    const malformed = {
      modelId: 7,
      viewType: "frontClose",
      class: "identity",
      referenceAssisted: false,
      anchorEligible: true,
      stalesSiblings: true,
      promptDirectives: [],
    } as GenerationAuthorization;
    expect(() => requireIdentityPatch(malformed)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }),
    );
  });

  it("extracts structured and leaf fields without widening them", () => {
    expect(authorizedFieldsForPatch(hairColorPatch)).toEqual(["person.hair.color"]);
    expect(authorizedFieldsForPatch(skinTonePatch)).toEqual(["person.skinTone"]);
  });

  it("hair color exempts hair color only", () => {
    const protectedSet = new Set(protectedDimensionsFor(hairColorPatch));
    expect(protectedSet.has("person.hair.color")).toBe(false);
    for (const field of [
      "person.hair.style",
      "person.hair.length",
      "person.hair.texture",
      "person.hair.hairline",
      "person.skinTone",
      OVERALL_IDENTITY_DIMENSION,
    ] as const) expect(protectedSet.has(field)).toBe(true);
  });

  it("hair style exempts only its reviewed hair-geometry dependents", () => {
    const protectedSet = new Set(protectedDimensionsFor(hairStylePatch));
    expect(protectedSet.has("person.hair.style")).toBe(false);
    for (const dependent of dependentFieldsForPatch(hairStylePatch)) {
      expect(protectedSet.has(dependent), `${dependent} is a reviewed dependent`).toBe(false);
    }
    expect(protectedSet.has("person.hair.texture")).toBe(true);
    expect(protectedSet.has("person.hair.color")).toBe(true);
    expect(protectedSet.has("person.hair.hairline")).toBe(true);
    expect(protectedSet.has(OVERALL_IDENTITY_DIMENSION)).toBe(true);
  });

  it("turns the first failed gate verdict into a precise fresh-retry correction", () => {
    const directive = identityRetryDirective({
      ok: false,
      checked: true,
      violations: [OVERALL_IDENTITY_DIMENSION, "person.skinTone"],
    });
    expect(directive).toContain("previous candidate was rejected");
    expect(directive).toContain(OVERALL_IDENTITY_DIMENSION);
    expect(directive).toContain("person.skinTone");
    expect(directive).toContain("Start again from the original source image");
  });

  it("jawline does not exempt face shape or cheekbones", () => {
    const protectedSet = new Set(protectedDimensionsFor(jawlinePatch));
    expect(protectedSet.has("person.face.jawline")).toBe(false);
    expect(protectedSet.has("person.face.faceShape")).toBe(true);
    expect(protectedSet.has("person.face.cheekbones")).toBe(true);
  });

  it("exempts exactly the explicit field plus its static, non-transitive dependents", () => {
    for (const field of AUTHORIZABLE_FIELDS) {
      const patch = {
        source: "structured",
        edits: [{ kind: "leaf", leaf: field, operation: "modify", value: "test" }],
      } as AuthorizedIdentityPatch;
      const protectedSet = new Set(protectedDimensionsFor(patch));
      const exemptions = new Set([field, ...dependentFieldsForPatch(patch)]);
      expect(protectedSet.has(field), `${field} must be exempt`).toBe(false);
      for (const other of AUTHORIZABLE_FIELDS) {
        expect(protectedSet.has(other), `${other} protection for ${field}`).toBe(!exemptions.has(other));
      }
      expect(protectedSet.has(OVERALL_IDENTITY_DIMENSION)).toBe(true);
    }
  });

  it("keeps the dependency policy closed to length/style and hair geometry only", () => {
    expect(Object.keys(IDENTITY_EDIT_DEPENDENCIES).sort()).toEqual([
      "person.hair.length",
      "person.hair.style",
    ]);
    const allowlist = new Set(HAIR_GEOMETRY_DEPENDENT_FIELDS);
    for (const dependents of Object.values(IDENTITY_EDIT_DEPENDENCIES)) {
      for (const dependent of dependents) expect(allowlist.has(dependent)).toBe(true);
    }
    const forbidden = [
      "person.hair.color",
      "person.hair.texture",
      "person.hair.hairline",
      "person.face.faceShape",
      "person.skinTone",
    ];
    expect(HAIR_GEOMETRY_DEPENDENT_FIELDS).not.toEqual(expect.arrayContaining(forbidden));
  });

  it("does not chain dependencies and never releases an explicitly authorized field", () => {
    const combined: AuthorizedIdentityPatch = {
      source: "text",
      edits: [...hairLengthPatch.edits, ...hairStylePatch.edits],
    };
    const released = dependentFieldsForPatch(combined);
    expect(released).not.toContain("person.hair.length");
    expect(released).not.toContain("person.hair.style");
    expect(released.sort()).toEqual([
      "person.hair.fade",
      "person.hair.flyaways",
      "person.hair.fringe",
      "person.hair.parting",
      "person.hair.tuck",
      "person.hair.volume",
    ]);
  });

  it("does not claim a headshot can verify body build", () => {
    const observable = expectedObservableDimensions("HEADSHOT");
    expect(observable.has("person.build")).toBe(false);
    expect(observable.has("person.skinTone")).toBe(true);
    expect(observable.has(OVERALL_IDENTITY_DIMENSION)).toBe(true);
  });

  it("includes the structured identity schema in iteration anchors", () => {
    const prompt = buildIterationImagePrompt(
      "change only the hair color",
      "saved master identity",
      "HEADSHOT",
      "studio settings",
      "INPUT VISUALS",
      undefined,
      undefined,
      1,
      "frontClose",
      ["AUTHORIZED IDENTITY CHANGE — hair color only: Copper."],
      {
        subject: { skin_tone: "deep ebony", ethnicity: "Mediterranean", hair_color: "black" },
        facial_features: { jawline: "angular" },
      },
    );
    expect(prompt).toContain("Skin tone: deep ebony");
    expect(prompt).toContain("Ethnicity: Mediterranean");
    expect(prompt).toContain("Jawline: angular");
  });

  it("strictly rejects missing, extra, and unknown verdict keys", () => {
    const queried = [OVERALL_IDENTITY_DIMENSION, "person.skinTone"] as const;
    expect(parseGateResponse(JSON.stringify({ dimensions: {
      [OVERALL_IDENTITY_DIMENSION]: "unchanged",
      "person.skinTone": "unchanged",
    } }), queried)?.checked).toBe(true);
    expect(parseGateResponse(JSON.stringify({ dimensions: {
      [OVERALL_IDENTITY_DIMENSION]: "unchanged",
    } }), queried)).toBeNull();
    expect(parseGateResponse(JSON.stringify({ dimensions: {
      [OVERALL_IDENTITY_DIMENSION]: "unchanged",
      "person.skinTone": "unchanged",
      surprise: "unchanged",
    } }), queried)).toBeNull();
    expect(parseGateResponse("```json\n{}\n```", queried)).toBeNull();
  });

  it("fails changed, uncertain, and falsely-not-observable expected dimensions", () => {
    const queried = [OVERALL_IDENTITY_DIMENSION, "person.skinTone", "person.build"] as const;
    expect(violationsForStatuses(queried, {
      [OVERALL_IDENTITY_DIMENSION]: "changed",
      "person.skinTone": "uncertain",
      "person.build": "not_observable",
    }, "HEADSHOT")).toEqual([OVERALL_IDENTITY_DIMENSION, "person.skinTone"]);
    expect(violationsForStatuses(queried, {
      [OVERALL_IDENTITY_DIMENSION]: "unchanged",
      "person.skinTone": "not_observable",
      "person.build": "not_observable",
    }, "HEADSHOT")).toEqual(["person.skinTone"]);
  });

  it("fails closed when a queried status is missing even if called outside strict parsing", () => {
    expect(violationsForStatuses(
      [OVERALL_IDENTITY_DIMENSION, "person.skinTone"],
      { [OVERALL_IDENTITY_DIMENSION]: "unchanged" },
      "HEADSHOT",
    )).toEqual(["person.skinTone"]);
  });

  it("scopes chat keys by both user and model", () => {
    expect(castingSessionKey("7", 10)).toBe("7:10");
    expect(castingSessionKey("7", 11)).not.toBe(castingSessionKey("7", 10));
    expect(castingSessionKey("8", 10)).not.toBe(castingSessionKey("7", 10));
  });

  it("clears one model without touching the same user's other model", () => {
    const sessions = new Map([["7:10", "a"], ["7:11", "b"], ["8:10", "c"]]);
    expect(deleteCastingSessionsFor(sessions, "7", 10)).toBe(1);
    expect(Array.from(sessions.keys()).sort()).toEqual(["7:11", "8:10"]);
  });

  it("creating a second model session leaves the first model isolated and readable", () => {
    const sessions = new Map<string, { id: string }>();
    setCastingSessionFor(sessions, "7", 10, { id: "model-10" });
    setCastingSessionFor(sessions, "7", 11, { id: "model-11" });
    expect(getCastingSessionFor(sessions, "7", 10)?.id).toBe("model-10");
    expect(getCastingSessionFor(sessions, "7", 11)?.id).toBe("model-11");
    expect(getCastingSessionFor(sessions, "8", 10)).toBeUndefined();
  });

  it("clears every model for one user without touching another user", () => {
    const sessions = new Map([["7:10", "a"], ["7:11", "b"], ["8:10", "c"]]);
    expect(deleteCastingSessionsFor(sessions, "7")).toBe(2);
    expect(Array.from(sessions.keys())).toEqual(["8:10"]);
  });
});

describe("W5 identity gate — validate before persistence", () => {
  const sourceImage = "data:image/png;base64,c291cmNl";

  function setup(verdicts: IdentityGateVerdict[]) {
    const generate = vi.fn(async (attempt: 1 | 2) => ({
      imageBase64: `data:image/png;base64,Y2FuZGlkYXRl${attempt}`,
      engineUsed: "test-engine",
    }));
    const upload = vi.fn(async () => ({ imageUrl: "https://r2.test/passing.png", storageKey: "iterate/passing.png" }));
    const resetRejectedSession = vi.fn();
    const verify = vi.fn(async () => verdicts.shift() ?? verdict(false, false));
    const run = () => runGatedIdentityGeneration({
      sourceImage,
      patch: hairColorPatch,
      frame: "HEADSHOT",
      modelName: "Test Model",
      generate,
      upload,
      resetRejectedSession,
      verify,
    });
    return { run, generate, upload, resetRejectedSession, verify };
  }

  it("uploads and returns exactly one passing first candidate", async () => {
    const s = setup([verdict(true)]);
    const result = await s.run();
    expect(result).toMatchObject({ attempts: 1, storageKey: "iterate/passing.png" });
    expect(s.generate).toHaveBeenCalledTimes(1);
    expect(s.upload).toHaveBeenCalledTimes(1);
    expect(s.resetRejectedSession).not.toHaveBeenCalled();
  });

  it("retries from the original source after a checked drift verdict and uploads only the retry", async () => {
    const s = setup([verdict(false), verdict(true)]);
    const result = await s.run();
    expect(result.attempts).toBe(2);
    expect(s.generate).toHaveBeenNthCalledWith(1, 1);
    expect(s.generate).toHaveBeenNthCalledWith(2, 2);
    expect(s.verify.mock.calls[0][0].sourceImage).toBe(sourceImage);
    expect(s.verify.mock.calls[1][0].sourceImage).toBe(sourceImage);
    expect(s.verify.mock.calls[0][0].candidateImage).not.toBe(s.verify.mock.calls[1][0].candidateImage);
    expect(s.upload).toHaveBeenCalledTimes(1);
    expect(s.resetRejectedSession).toHaveBeenCalledTimes(1);
  });

  it("supports the paid-drive first-attempt failure hook without persisting the rejected candidate", async () => {
    const previous = process.env.IDENTITY_GATE_FORCE_FAIL_FIRST;
    process.env.IDENTITY_GATE_FORCE_FAIL_FIRST = "1";
    try {
      const s = setup([verdict(true)]);
      const result = await s.run();
      expect(result.attempts).toBe(2);
      expect(s.generate).toHaveBeenCalledTimes(2);
      expect(s.verify).toHaveBeenCalledTimes(1);
      expect(s.upload).toHaveBeenCalledTimes(1);
      expect(s.resetRejectedSession).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.IDENTITY_GATE_FORCE_FAIL_FIRST;
      else process.env.IDENTITY_GATE_FORCE_FAIL_FIRST = previous;
    }
  });

  it("supports the paid-drive unavailable hook as a fail-closed unchecked verdict", async () => {
    const previous = process.env.IDENTITY_GATE_FORCE_UNAVAILABLE;
    process.env.IDENTITY_GATE_FORCE_UNAVAILABLE = "1";
    try {
      await expect(verifyIdentityEdit({
        sourceImage,
        candidateImage: sourceImage,
        patch: hairColorPatch,
        frame: "HEADSHOT",
      })).resolves.toEqual({ ok: false, checked: false, violations: [] });
    } finally {
      if (previous === undefined) delete process.env.IDENTITY_GATE_FORCE_UNAVAILABLE;
      else process.env.IDENTITY_GATE_FORCE_UNAVAILABLE = previous;
    }
  });

  it("persists nothing and clears the rejected retry session when both attempts drift", async () => {
    const s = setup([verdict(false), verdict(false)]);
    await expect(s.run()).rejects.toBeInstanceOf(TRPCError);
    expect(s.generate).toHaveBeenCalledTimes(2);
    expect(s.upload).not.toHaveBeenCalled();
    expect(s.resetRejectedSession).toHaveBeenCalledTimes(2);
  });

  it("rechecks an unavailable verdict once without regenerating, then fails closed", async () => {
    const s = setup([verdict(false, false), verdict(false, false)]);
    await expect(s.run()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(s.verify).toHaveBeenCalledTimes(2);
    expect(s.generate).toHaveBeenCalledTimes(1);
    expect(s.upload).not.toHaveBeenCalled();
    expect(s.resetRejectedSession).toHaveBeenCalledTimes(1);
  });

  it("treats a verifier throw as unavailable and still fails closed without regenerating", async () => {
    const s = setup([]);
    s.verify.mockRejectedValue(new Error("checker crashed"));
    await expect(s.run()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(s.verify).toHaveBeenCalledTimes(2);
    expect(s.generate).toHaveBeenCalledTimes(1);
    expect(s.upload).not.toHaveBeenCalled();
    expect(s.resetRejectedSession).toHaveBeenCalledTimes(1);
  });

  it("clears the candidate session when the passing upload fails", async () => {
    const s = setup([verdict(true)]);
    s.upload.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(s.run()).rejects.toThrow("storage unavailable");
    expect(s.resetRejectedSession).toHaveBeenCalledTimes(1);
  });
});

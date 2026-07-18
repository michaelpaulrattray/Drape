/**
 * Batch C — the shared authorization boundary (§6, M1/M2/M16/M18 units).
 *
 * The LLM seam is injected, so every stage is testable with the model dead:
 * deterministic checks (marks, presentation, eyelashes, vague/whole
 * references), the strict classifier parser vs a malformed corpus, the
 * status/view/evidence gates, modality/registry gates, the strict
 * normalizer (relational values, wrong fields, invalid bases), and
 * most-restrictive-wins over mixed requests. Every refusal is typed and
 * produced BEFORE any money-adjacent side effect (the boundary has none).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  authorizeEditRequest,
  deterministicStage,
  parseClassifierResponse,
  parseNormalizerResponse,
  requestedHairLengthBand,
  type AuthorityLlm,
} from "./editAuthority";
import { REFUSAL_COPY } from "./refusalCopy";
import type { EditRefusal, SupportedIdentityLeaf } from "./identityTypes";

const draftModel = { id: 7, status: "draft", name: "Vera", identityRevisionId: null };
const mintedModel = { id: 7, status: "active", name: "Vera", identityRevisionId: null };
const anchorAsset = { id: 100, viewType: "frontClose" };
const sideAsset = { id: 101, viewType: "sideClose" };

function llm(classify: string, normalize = '{"edits":[]}'): AuthorityLlm {
  return {
    classify: vi.fn().mockResolvedValue(classify),
    normalize: vi.fn().mockResolvedValue(normalize),
  };
}
const identityJson = (categories: string[]) =>
  JSON.stringify({ kind: "identity", categories, operations: {} });
const imageOnlyJson = JSON.stringify({ kind: "imageOnly", categories: ["image.lighting"], operations: {} });

function baseInput(feedback: string, over: Record<string, unknown> = {}) {
  return {
    model: draftModel,
    targetAsset: anchorAsset,
    anchorAssetId: anchorAsset.id,
    feedback,
    referenceAttached: false,
    ...over,
  } as Parameters<typeof authorizeEditRequest>[0];
}

const expectRefusal = (decision: Awaited<ReturnType<typeof authorizeEditRequest>>, code: EditRefusal["code"]) => {
  expect(decision.refused).toBe(true);
  expect((decision as EditRefusal).code).toBe(code);
};

afterEach(() => {
  delete process.env.ITERATE_CLASSIFY_FORCE_IDENTITY;
});

// ── Deterministic stage: holds with the LLM dead (R2, M1, M2, M16) ──────────

describe("deterministic stage — no LLM required", () => {
  const deadLlm: AuthorityLlm = {
    classify: vi.fn().mockRejectedValue(new Error("LLM down")),
    normalize: vi.fn().mockRejectedValue(new Error("LLM down")),
  };

  it.each([
    // Every mark family × operations, text form (M1)
    "add a small tattoo on the forearm",
    "remove her tattoos",
    "make the ink darker",
    "add a scar through the eyebrow",
    "give her light freckles on the nose",
    "add a beauty mark above the lip",
    "remove the birthmark",
    "add a septum piercing",
    "give her stretch marks",
    "add a gap tooth",
  ])("mark edit %j refuses deterministically, every status, every operation", async (feedback) => {
    for (const model of [draftModel, mintedModel]) {
      const d = await authorizeEditRequest(baseInput(feedback, { model }), deadLlm);
      expectRefusal(d, "mark_edit");
      expect((d as EditRefusal).message).toBe(REFUSAL_COPY.markEdit);
    }
  });

  it("mark edits refuse in REFERENCE form too (tattoo transfer)", async () => {
    const d = await authorizeEditRequest(
      baseInput("use the tattoo from the reference", { referenceAttached: true }),
      deadLlm,
    );
    expectRefusal(d, "mark_edit");
  });

  it.each([
    "put her in a red dress",
    "add a necklace",
    "give him sunglasses",
    "add a beanie",
    "heavier makeup",
    "red lipstick",
    "put him in whatever she's wearing", // §6.2 corpus → presentation.clothing
    "use this whole look", // LOOK noun phrase
  ])("presentation %j refuses-and-routes with the ratified copy (M16)", async (feedback) => {
    const d = await authorizeEditRequest(baseInput(feedback), deadLlm);
    expect(d.refused).toBe(true);
    expect((d as EditRefusal).code).toBe("presentation");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.presentationRouting);
  });

  it("'make her look older' is NOT a presentation false-positive (look-noun phrases only)", () => {
    expect(deterministicStage("make her look older", false)).toBeNull();
  });

  it.each(["add mascara", "false lashes", "give her lash extensions", "a lash lift"])(
    "cosmetic lash %j refuses as presentation with the lash copy (§5.2)",
    async (feedback) => {
      const d = await authorizeEditRequest(baseInput(feedback), deadLlm);
      expectRefusal(d, "presentation");
      expect((d as EditRefusal).message).toBe(REFUSAL_COPY.cosmeticLash);
    },
  );

  it.each(["longer eyelashes", "naturally dense lashes", "curl her lashes"])(
    "post-creation eyelash edit %j refuses — natural or cosmetic, no escape hatch (M16)",
    async (feedback) => {
      const d = await authorizeEditRequest(baseInput(feedback), deadLlm);
      expectRefusal(d, "eyelash_post_creation");
      expect((d as EditRefusal).message).toBe(REFUSAL_COPY.eyelashPostCreation);
    },
  );

  it.each([
    "make her resemble this person",
    "replace her face",
    "copy everything",
    "swap the face",
  ])("whole-identity replacement %j refuses (§6.2 corpus)", async (feedback) => {
    const d = await authorizeEditRequest(baseInput(feedback, { referenceAttached: true }), deadLlm);
    expectRefusal(d, "whole_identity_reference");
  });

  it.each(["apply this", "use this look", "make her like the reference", "copy that style"])(
    "vague reference %j refuses free as ambiguous (§9.1 rule 3)",
    async (feedback) => {
      const d = await authorizeEditRequest(baseInput(feedback, { referenceAttached: true }), deadLlm);
      expectRefusal(d, "vague_reference");
    },
  );

  it("the same vague words WITHOUT a reference fall through to classification", () => {
    expect(deterministicStage("apply this", false)).toBeNull();
  });
});

// ── Strict classifier parser (M2) ────────────────────────────────────────────

describe("strict classifier parser — deviation is malformed, unrecognized is unknown", () => {
  it.each([
    ["not json at all", "malformed"],
    ["{", "malformed"],
    ['{"kind":"identity"}', "malformed"], // missing categories
    ['{"kind":"identity","categories":"person.face.jawline"}', "malformed"], // wrong shape
    ['{"kind":"cosmetic","categories":[]}', "malformed"], // invented kind
    ["[1,2,3]", "malformed"],
  ])("%j ⇒ %s", (raw, kind) => {
    expect(parseClassifierResponse(raw).kind).toBe(kind);
  });

  it.each([
    ['{"kind":"identity","categories":["person.face.nostril"],"operations":{}}'], // invented leaf
    ['{"kind":"imageOnly","categories":["image.hologram"],"operations":{}}'],
    ['{"kind":"presentation","categories":["presentation.tattoos"],"operations":{}}'],
    ['{"kind":"identity","categories":[],"operations":{}}'], // empty
    ["UNSURE"],
    ['{"kind":"unknown","categories":[],"operations":{}}'],
  ])("%j ⇒ unknown (fail-closed, never fail-open)", (raw) => {
    expect(parseClassifierResponse(raw).kind).toBe("unknown");
  });

  it("valid closed-union responses parse exactly", () => {
    const c = parseClassifierResponse(identityJson(["person.face.jawline"]));
    expect(c).toMatchObject({ kind: "identity", categories: ["person.face.jawline"], source: "model" });
    expect(parseClassifierResponse(imageOnlyJson)).toEqual({ kind: "imageOnly", categories: ["image.lighting"] });
    expect(parseClassifierResponse('```json\n{"kind":"imageOnly","categories":["image.retouch"],"operations":{}}\n```').kind).toBe("imageOnly");
  });

  // ── Review finding 6: strict JSON is real ─────────────────────────────────
  it("unexpected TOP-LEVEL keys are malformed — no side channel exists (classifier)", () => {
    expect(
      parseClassifierResponse('{"kind":"imageOnly","categories":["image.lighting"],"operations":{},"preferenceKey":"jawline"}').kind,
    ).toBe("malformed");
    expect(
      parseClassifierResponse('{"kind":"identity","categories":["person.face.jawline"],"operations":{},"destination":"x"}').kind,
    ).toBe("malformed");
  });

  it("unexpected TOP-LEVEL keys are malformed (normalizer)", () => {
    const r = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.face.jawline","value":"squared"}],"schemaPath":"subject.sex"}',
      ["person.face.jawline"],
    );
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("a kind that contradicts its own categories is malformed, never guessed", () => {
    expect(
      parseClassifierResponse('{"kind":"imageOnly","categories":["person.face.jawline"],"operations":{}}').kind,
    ).toBe("malformed");
    expect(
      parseClassifierResponse('{"kind":"presentation","categories":["image.lighting"],"operations":{}}').kind,
    ).toBe("malformed");
  });

  // ── Review finding 6: MIXED responses retain every recognized category ────
  it("mixed identity + presentation + imageOnly parses with every bucket retained", () => {
    const c = parseClassifierResponse(
      '{"kind":"identity","categories":["person.face.jawline","presentation.headwear","image.lighting"],"operations":{}}',
    );
    expect(c).toMatchObject({
      kind: "identity",
      categories: ["person.face.jawline"],
      presentationAlso: ["presentation.headwear"],
      imageOnlyAlso: ["image.lighting"],
    });
  });

  it("presentation + imageOnly resolves to presentation (refuse-and-route beats image-only)", () => {
    const c = parseClassifierResponse(
      '{"kind":"presentation","categories":["presentation.clothing","image.lighting"],"operations":{}}',
    );
    expect(c).toEqual({ kind: "presentation", categories: ["presentation.clothing"] });
  });

  it("an unknown category inside a MIXED response fails the whole response closed", () => {
    expect(
      parseClassifierResponse(
        '{"kind":"identity","categories":["person.face.jawline","presentation.hologram"],"operations":{}}',
      ).kind,
    ).toBe("unknown");
  });
});

describe("mixed-request precedence through the pipeline (finding 6 / §6.2)", () => {
  const mixed = (categories: string[]) => JSON.stringify({ kind: "identity", categories, operations: {} });

  it("ALLOWED identity + imageOnly ⇒ the identity edit proceeds (identity outranks image-only)", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jawline and brighten the shot"),
      llm(mixed(["person.face.jawline", "image.lighting"]), '{"edits":[{"leaf":"person.face.jawline","value":"broad angular jaw"}]}'),
    );
    expect(d.refused).toBe(false);
    if (!d.refused) expect(d.authorization.class).toBe("identity");
  });

  it("ALLOWED identity + presentation ⇒ presentation refuses-and-routes the WHOLE request", async () => {
    // Keyword-free phrasing: the DETERMINISTIC fast path must stay silent so
    // the scripted mixed classification is what decides
    const d = await authorizeEditRequest(
      baseInput("sharper jawline and something chic on her head"),
      llm(mixed(["person.face.jawline", "presentation.headwear"])),
    );
    expectRefusal(d, "presentation");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.presentationRouting);
  });

  it("REFUSED identity (mark) + imageOnly ⇒ the mark refusal wins (most restrictive)", async () => {
    const d = await authorizeEditRequest(
      baseInput("darker skin dots and better lighting"),
      llm(mixed(["mark.pigmentation", "image.lighting"])),
    );
    expectRefusal(d, "mark_edit");
  });

  it("REFUSED identity (structured) + imageOnly ⇒ the structured refusal wins", async () => {
    const d = await authorizeEditRequest(
      baseInput("make her older and brighten it"),
      llm(mixed(["person.age", "image.lighting"])),
    );
    expectRefusal(d, "person_structured");
  });

  it("REFUSED identity (unmapped) + presentation ⇒ the identity refusal wins over routing", async () => {
    const d = await authorizeEditRequest(
      baseInput("a new chin and something chic on her head"),
      llm(mixed(["person.face.chin", "presentation.headwear"])),
    );
    expectRefusal(d, "unmapped_leaf");
  });

  it("identity + presentation on a MINTED model ⇒ the minted-identity refusal wins (refused identity beats routing)", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jawline and something chic on her head", { model: mintedModel }),
      llm(mixed(["person.face.jawline", "presentation.headwear"])),
    );
    expectRefusal(d, "not_draft");
  });
});

// ── Pipeline decisions (M1/M2/M18) ───────────────────────────────────────────

describe("pipeline — outage, refusal ordering, gates", () => {
  it("classifier outage ⇒ free retryable refusal, never image-only fallback (R2)", async () => {
    const d = await authorizeEditRequest(baseInput("subtle change to her vibe"), {
      classify: vi.fn().mockRejectedValue(new Error("down")),
      normalize: vi.fn(),
    });
    expectRefusal(d, "classifier_unavailable");
    expect((d as EditRefusal).retryable).toBe(true);
  });

  it("malformed classification ⇒ free retryable refusal", async () => {
    const d = await authorizeEditRequest(baseInput("something subtle"), llm("garbage"));
    expectRefusal(d, "malformed_classification");
  });

  it("unknown ⇒ free refusal", async () => {
    const d = await authorizeEditRequest(baseInput("hmm"), llm('{"kind":"unknown","categories":[],"operations":{}}'));
    expectRefusal(d, "unknown");
  });

  it("image-only authorizes asset-only on ANY view, drafts and minted alike (§5.3)", async () => {
    for (const model of [draftModel, mintedModel]) {
      for (const targetAsset of [anchorAsset, sideAsset]) {
        const d = await authorizeEditRequest(baseInput("brighten the lighting", { model, targetAsset }), llm(imageOnlyJson));
        expect(d.refused).toBe(false);
        if (!d.refused) {
          expect(d.authorization.class).toBe("imageOnly");
          expect(d.authorization.anchorEligible).toBe(false);
          expect(d.authorization.stalesSiblings).toBe(false);
          expect(d.authorization.identityPatch).toBeUndefined();
        }
      }
    }
  });

  it("LLM-classified presentation refuses-and-routes", async () => {
    const d = await authorizeEditRequest(
      baseInput("use the headpiece she is wearing", { referenceAttached: true }),
      llm(JSON.stringify({ kind: "presentation", categories: ["presentation.headwear"], operations: {} })),
    );
    expectRefusal(d, "presentation");
  });

  it("LLM-classified mark categories refuse (most-restrictive over the set)", async () => {
    const d = await authorizeEditRequest(
      baseInput("darker skin dots"),
      llm(identityJson(["mark.pigmentation", "person.skin.texture"])),
    );
    expectRefusal(d, "mark_edit");
  });

  it("§8.2: person-structured categories refuse at the free-text door with re-cast routing", async () => {
    const d = await authorizeEditRequest(baseInput("make her older"), llm(identityJson(["person.age"])));
    expectRefusal(d, "person_structured");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.personStructured);
  });

  it("parent-only ('change her face') ⇒ ambiguous ⇒ refine-or-refuse copy (§8.4-rule)", async () => {
    const d = await authorizeEditRequest(baseInput("change her face"), llm(identityJson(["person.face"])));
    expectRefusal(d, "ambiguous_identity");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.ambiguousIdentity);
  });

  it("a parent alongside a leaf still refuses as ambiguous (most-restrictive)", async () => {
    const d = await authorizeEditRequest(
      baseInput("change her face and sharpen the jawline"),
      llm(identityJson(["person.face", "person.face.jawline"])),
    );
    expectRefusal(d, "ambiguous_identity");
  });

  it.each(["person.face.chin", "person.face.browColor"])(
    "unmapped leaf %s refuses with the R9 copy (M1)",
    async (leaf) => {
      const d = await authorizeEditRequest(baseInput("adjust it"), llm(identityJson([leaf])));
      expectRefusal(d, "unmapped_leaf");
      expect((d as EditRefusal).message).toBe(REFUSAL_COPY.unmappedLeaf);
    },
  );

  it("MIXED multi-leaf: one refused leaf refuses the WHOLE request (M1)", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jaw and a different chin"),
      llm(identityJson(["person.face.jawline", "person.face.chin"])),
    );
    expectRefusal(d, "unmapped_leaf");
  });

  // FOUNDER FINAL RULING (R1b reversed + final corrections): the committed
  // hair-length value is the BAND the user named, derived deterministically
  // from their own words. Long stays Long; Very Long stays Very Long;
  // below-shoulder/chest/mid-back wording = Long; waist/hip/tailbone = Very
  // Long. Whatever the normalizer returns, the committed value can never be
  // a more (or less) extreme band than the user requested.
  it.each([
    ["long hair", "Long"],
    ["long hair past the shoulders", "Long"],
    ["hair falling below her shoulders", "Long"],
    ["hair down to her mid-back", "Long"],
    ["chest-length hair", "Long"],
    ["very long hair", "Very Long"],
    ["waist-length hair", "Very Long"],
    ["hair down to her hips", "Very Long"],
    ["hair down to her tailbone", "Very Long"],
    ["shoulder-length hair", "Medium"],
    ["a chin-length bob", "Short"],
  ] as const)(
    "hair-length edit %j commits the deterministic band %j regardless of normalizer prose",
    async (feedback, band) => {
      const d = await authorizeEditRequest(
        baseInput(feedback),
        llm(
          identityJson(["person.hair.length"]),
          // The normalizer deliberately returns an ESCALATED value — the
          // committed edit must carry the requested band, never this prose.
          '{"edits":[{"leaf":"person.hair.length","value":"waist-length, well past the shoulders"}]}',
        ),
      );
      expect(d.refused).toBe(false);
      if (!d.refused) {
        expect(d.authorization.class).toBe("identity");
        expect(d.authorization.anchorEligible).toBe(true);
        expect(d.authorization.stalesSiblings).toBe(true); // pinned included at commit
        expect(d.authorization.identityPatch!.edits[0]).toMatchObject({
          leaf: "person.hair.length",
          value: band,
        });
      }
    },
  );

  it("explicit 'long hair' can NEVER commit waist-length — the exact escalation the correction closes", async () => {
    const d = await authorizeEditRequest(
      baseInput("long hair"),
      llm(identityJson(["person.hair.length"]), '{"edits":[{"leaf":"person.hair.length","value":"waist-length"}]}'),
    );
    expect(d.refused).toBe(false);
    if (!d.refused) {
      expect(d.authorization.identityPatch!.edits[0]).toMatchObject({ leaf: "person.hair.length", value: "Long" });
    }
  });

  it("the normalizer inventing a shorter band is equally overridden by the requested band", async () => {
    const d = await authorizeEditRequest(
      baseInput("waist-length hair"),
      llm(identityJson(["person.hair.length"]), '{"edits":[{"leaf":"person.hair.length","value":"cropped pixie length"}]}'),
    );
    expect(d.refused).toBe(false);
    if (!d.refused) {
      expect(d.authorization.identityPatch!.edits[0]).toMatchObject({ leaf: "person.hair.length", value: "Very Long" });
    }
  });

  it.each([
    "make her hair a bit longer",
    "much longer hair than in the photo",
    "change the hair length",
  ])("vague/comparative length wording %j fails closed and free (no justified durable value)", async (feedback) => {
    const d = await authorizeEditRequest(
      baseInput(feedback),
      llm(identityJson(["person.hair.length"]), '{"edits":[{"leaf":"person.hair.length","value":"waist-length"}]}'),
    );
    expectRefusal(d, "hair_length_vague");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.hairLengthVague);
  });

  it("conflicting length wording refuses rather than guessing a band", async () => {
    const d = await authorizeEditRequest(
      baseInput("short in front, long in the back"),
      llm(identityJson(["person.hair.length"]), '{"edits":[{"leaf":"person.hair.length","value":"long"}]}'),
    );
    expectRefusal(d, "hair_length_vague");
  });

  it("'long layers' is a style, not a length — layered Medium hair stays Medium (D-56.1)", async () => {
    const d = await authorizeEditRequest(
      baseInput("long layers, keep it medium length"),
      llm(identityJson(["person.hair.length"]), '{"edits":[{"leaf":"person.hair.length","value":"long"}]}'),
    );
    expect(d.refused).toBe(false);
    if (!d.refused) {
      expect(d.authorization.identityPatch!.edits[0]).toMatchObject({ leaf: "person.hair.length", value: "Medium" });
    }
  });

  describe("requestedHairLengthBand (deterministic band derivation)", () => {
    it.each([
      ["long hair", "Long"],
      ["very long hair", "Very Long"],
      ["hair below the shoulders", "Long"],
      ["mid-back hair", "Long"],
      ["bra-length hair", "Long"],
      ["waist-length", "Very Long"],
      ["hip-length hair", "Very Long"],
      ["down to her tailbone", "Very Long"],
      ["rapunzel hair", "Very Long"],
      ["shoulder-length", "Medium"],
      ["medium hair", "Medium"],
      ["a bob", "Short"],
      ["short hair", "Short"],
      ["very short hair", "Very Short"],
      ["a pixie cut", "Very Short"],
      ["buzzed", "Very Short"],
    ] as const)("%j → %j", (text, band) => {
      expect(requestedHairLengthBand(text)).toBe(band);
    });

    it.each([
      "a bit longer",
      "hair like the reference",
      "short but also very long",
      "long layers", // style only — names no length band
      "",
    ])("%j names no single band → null", (text) => {
      expect(requestedHairLengthBand(text)).toBeNull();
    });
  });

  it("R1c: reference-assisted skin-texture transfer refuses as unsupported modality", async () => {
    const d = await authorizeEditRequest(
      baseInput("use the skin texture from the reference", { referenceAttached: true }),
      llm(identityJson(["person.skin.texture"])),
    );
    expectRefusal(d, "unsupported_reference");
  });

  it("facial hair: reference form refuses (not in the transfer list); text form proceeds", async () => {
    const ref = await authorizeEditRequest(
      baseInput("use his facial hair from the reference", { referenceAttached: true }),
      llm(identityJson(["person.face.facialHair"])),
    );
    expectRefusal(ref, "unsupported_reference");

    const text = await authorizeEditRequest(
      baseInput("give him light stubble"),
      llm(
        identityJson(["person.face.facialHair"]),
        '{"edits":[{"leaf":"person.face.facialHair","base":"Stubble","override":""}]}',
      ),
    );
    expect(text.refused).toBe(false);
  });

  it("skin finish: free-text durable request is registry-disabled (structured editor's field)", async () => {
    const d = await authorizeEditRequest(
      baseInput("her skin is always matte"),
      llm(identityJson(["person.skin.finish"])),
    );
    expectRefusal(d, "registry_disabled");
  });

  it("F4: an allowed leaf on a MINTED model refuses with the fork copy", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jawline", { model: mintedModel }),
      llm(identityJson(["person.face.jawline"])),
    );
    expectRefusal(d, "not_draft");
    expect((d as EditRefusal).message).toContain("identity is minted");
  });

  it("non-anchor view: identity edit refuses with routing to the headshot", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jawline", { targetAsset: sideAsset }),
      llm(identityJson(["person.face.jawline"])),
    );
    expectRefusal(d, "non_anchor_view");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.nonAnchorView);
  });

  it("allows the newest display headshot to take an identity edit when it belongs to the current revision", async () => {
    const displayedAsset = { id: 999, viewType: "frontClose" };
    const d = await authorizeEditRequest(
      baseInput("sharper jawline", {
        targetAsset: displayedAsset,
        displayedHeadshotAssetId: displayedAsset.id,
        targetBelongsToCurrentIdentity: true,
      }),
      llm(
        identityJson(["person.face.jawline"]),
        '{"edits":[{"leaf":"person.face.jawline","value":"sharp, angular"}]}',
      ),
    );
    expect(d.refused).toBe(false);
  });

  it("refuses a displayed headshot from an earlier or uncertain identity revision", async () => {
    const displayedAsset = { id: 999, viewType: "frontClose" };
    const d = await authorizeEditRequest(
      baseInput("sharper jawline", {
        targetAsset: displayedAsset,
        displayedHeadshotAssetId: displayedAsset.id,
        targetBelongsToCurrentIdentity: false,
      }),
      llm(identityJson(["person.face.jawline"])),
    );
    expectRefusal(d, "non_anchor_view");
    expect((d as EditRefusal).message).toBe(REFUSAL_COPY.nonAuthoritativeHeadshot);
  });

  it("refuses an older display row even when it belongs to the current identity revision", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jawline", {
        targetAsset: { id: 998, viewType: "frontClose" },
        displayedHeadshotAssetId: 999,
        targetBelongsToCurrentIdentity: true,
      }),
      llm(identityJson(["person.face.jawline"])),
    );
    expectRefusal(d, "non_anchor_view");
  });

  it("the force hook still produces a watchable FREE refusal (M2)", async () => {
    process.env.ITERATE_CLASSIFY_FORCE_IDENTITY = "1";
    const neverCalled = llm(imageOnlyJson);
    const d = await authorizeEditRequest(baseInput("brighten the lighting"), neverCalled);
    expectRefusal(d, "ambiguous_identity");
    expect(neverCalled.classify).not.toHaveBeenCalled();
  });
});

// ── Normalization (§8.6 steps 2–4, M18) ─────────────────────────────────────

describe("strict normalizer — concrete durable values only", () => {
  const jawline = identityJson(["person.face.jawline"]);

  it("a successful identity authorization carries the typed patch + §8.4 directives", async () => {
    const d = await authorizeEditRequest(
      baseInput("give her the sharp lower-face structure from the reference", { referenceAttached: true }),
      llm(jawline, '{"edits":[{"leaf":"person.face.jawline","value":"broad angular jaw, squared"}]}'),
    );
    expect(d.refused).toBe(false);
    if (!d.refused) {
      expect(d.authorization.class).toBe("identity");
      expect(d.authorization.anchorEligible).toBe(true);
      expect(d.authorization.stalesSiblings).toBe(true);
      expect(d.authorization.identityPatch).toEqual({
        edits: [{ kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: "broad angular jaw, squared" }],
        source: "reference",
      });
      expect(d.authorization.promptDirectives.join(" ")).toContain("jawline only");
      expect(d.authorization.promptDirectives.join(" ")).not.toContain("from the reference");
    }
  });

  it("RELATIONAL values are rejected — 'like the reference' can never be stored", () => {
    const r = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.face.jawline","value":"a jawline like the reference"}]}',
      ["person.face.jawline"],
    );
    expect(r).toEqual({ ok: false, reason: "relational_value" });
  });

  it("an unrequested field in the response fails (§8.6 step 4)", () => {
    const r = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.face.jawline","value":"squared"},{"leaf":"person.face.noseShape","value":"thin"}]}',
      ["person.face.jawline"],
    );
    expect(r).toEqual({ ok: false, reason: "wrong_fields" });
  });

  it("a missing requested field fails — one value per leaf, never collapsed", () => {
    const r = parseNormalizerResponse('{"edits":[{"leaf":"person.face.jawline","value":"squared jaw"}]}', [
      "person.face.jawline",
      "person.face.noseShape",
    ] as SupportedIdentityLeaf[]);
    expect(r).toEqual({ ok: false, reason: "wrong_fields" });
  });

  it("the contract has NO channel for destinations — extra keys are malformed (M18 proof 8)", () => {
    const r = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.face.jawline","value":"squared","preferenceKey":"jawline"}]}',
      ["person.face.jawline"],
    );
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("pair fields require a legal base from the closed option set", () => {
    const bad = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.hair.color","base":"Chartreuse-Neon","override":""}]}',
      ["person.hair.color"],
    );
    expect(bad).toEqual({ ok: false, reason: "invalid_value" });
    const good = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.hair.color","base":"Auburn","override":""}]}',
      ["person.hair.color"],
    );
    expect(good.ok).toBe(true);
  });

  // ── Review correction 2: the LLM's OWN output takes the policy boundary ──
  it.each([
    ["hallucinated mark", '{"edits":[{"leaf":"person.face.jawline","value":"sharp jaw with a scar"}]}'],
    ["hallucinated presentation", '{"edits":[{"leaf":"person.skin.finish","value":"dewy makeup-contoured skin"}]}'],
    ["hallucinated accessory", '{"edits":[{"leaf":"person.face.jawline","value":"sharp jaw framed by earrings"}]}'],
    ["hallucinated cosmetic lash", '{"edits":[{"leaf":"person.face.eyeShape","value":"almond eyes with false lashes"}]}'],
    ["hallucinated whole-identity", '{"edits":[{"leaf":"person.face.jawline","value":"replace her face entirely"}]}'],
  ])("a benign request cannot persist a %s from the normalizer", (_label, normalize) => {
    const leaf = JSON.parse(normalize).edits[0].leaf as SupportedIdentityLeaf;
    const r = parseNormalizerResponse(normalize, [leaf]);
    expect(r).toEqual({ ok: false, reason: "forbidden_content" });
  });

  it("hallucinated forbidden OVERRIDE prose fails closed too", () => {
    const r = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.hair.style","base":"Bob","override":"a bob tucked under a beanie"}]}',
      ["person.hair.style"],
    );
    expect(r).toEqual({ ok: false, reason: "forbidden_content" });
  });

  it("honest long-hair values pass the output boundary", () => {
    const r = parseNormalizerResponse(
      '{"edits":[{"leaf":"person.hair.length","value":"waist-length, well past the shoulders"}]}',
      ["person.hair.length"],
    );
    expect(r.ok).toBe(true);
  });

  it("normalizer failure ⇒ free retryable refusal, no partial authorization", async () => {
    const d = await authorizeEditRequest(
      baseInput("sharper jawline"),
      llm(jawline, "not json"),
    );
    expectRefusal(d, "normalization_failed");
    expect((d as EditRefusal).retryable).toBe(true);
  });

  it("normalizer outage ⇒ free retryable refusal (R2 covers the outage cost)", async () => {
    const d = await authorizeEditRequest(baseInput("sharper jawline"), {
      classify: vi.fn().mockResolvedValue(jawline),
      normalize: vi.fn().mockRejectedValue(new Error("down")),
    });
    expectRefusal(d, "classifier_unavailable");
  });

  it("multi-leaf success keeps field-specific value types (no prose flattening, M18 proof 5)", async () => {
    const d = await authorizeEditRequest(
      baseInput("use only the hairstyle, and warm up the hair color"),
      llm(
        identityJson(["person.hair.style", "person.hair.color"]),
        JSON.stringify({
          edits: [
            { leaf: "person.hair.style", base: "Shag / Wolf", override: "chin-length layered wolf cut" },
            { leaf: "person.hair.color", base: "Auburn", override: "" },
          ],
        }),
      ),
    );
    expect(d.refused).toBe(false);
    if (!d.refused) {
      const edits = d.authorization.identityPatch!.edits;
      expect(edits).toHaveLength(2);
      expect(edits[0]).toMatchObject({ kind: "leaf", value: { base: "Shag / Wolf", override: "chin-length layered wolf cut" } });
      expect(edits[1]).toMatchObject({ kind: "leaf", value: { base: "Auburn", override: "" } });
    }
  });
});

/**
 * Batch C — the ONE shared categorized marks vocabulary (§6.4) and the
 * three-state prompt rule (§13.10, ratified R6/M14). This suite pins the
 * agreement the two legacy detectors (broad MARK_PATTERN vs ink-only
 * hasBodyArt) never had: a freckled document must never take the clean-skin
 * rule, an inked one keeps persistence, and compaction can never launder
 * mark language away.
 */
import { describe, it, expect } from "vitest";
import {
  detectMarkCategories,
  detectMarkOperation,
  markPromptStateFor,
  namesAnyMark,
  namesInk,
  protectedMarkLanguageIntact,
} from "./marksVocabulary";
import { getStudioSettings } from "../geminiPrompts";

describe("per-category detection (§6.4)", () => {
  const cases: Array<[string, string[]]> = [
    ["small rose tattoo on the shoulder", ["mark.ink"]],
    ["black ink on the forearm", ["mark.ink"]],
    ["body art across the chest", ["mark.ink"]],
    ["a thin scar through the left brow", ["mark.scar"]],
    ["scarification pattern on the arm", ["mark.scar"]],
    ["light freckles across the nose", ["mark.pigmentation"]],
    ["a beauty mark above the lip", ["mark.pigmentation"]],
    ["a beauty spot on the cheek", ["mark.pigmentation"]],
    ["port-wine stain on the neck", ["mark.pigmentation"]],
    ["vitiligo patches on the hands", ["mark.pigmentation"]],
    ["a septum ring and pierced ears", ["mark.piercing"]],
    ["remove her piercings", ["mark.piercing"]],
    ["stretch marks on the shoulders", ["mark.structural"]],
    ["a gap tooth smile", ["mark.structural"]],
    ["a tattoo over the old scar", ["mark.ink", "mark.scar"]],
  ];
  it.each(cases)("%j → %j", (text, expected) => {
    expect(detectMarkCategories(text).sort()).toEqual([...expected].sort());
  });

  it("word boundaries hold: scarf / molecular / branding-prose / inking never false-positive", () => {
    expect(namesAnyMark("a silk scarf around the neck")).toBe(false);
    expect(namesAnyMark("molecular biology student look")).toBe(false);
    expect(namesAnyMark("strong personal branding")).toBe(false);
    expect(namesAnyMark("thinking about the lighting")).toBe(false);
    expect(namesAnyMark("smooth clean skin")).toBe(false);
  });

  it("operation detection is copy-only — add/remove/modify all classify", () => {
    expect(detectMarkOperation("add a tattoo")).toBe("add");
    expect(detectMarkOperation("remove the tattoo")).toBe("remove");
    expect(detectMarkOperation("make the tattoo bigger")).toBe("modify");
  });
});

describe("three-state prompt rule (M14)", () => {
  it("ink ⇒ persistence state", () => {
    expect(markPromptStateFor("she has a small tattoo on her wrist")).toBe("ink");
    expect(namesInk("wax seal tattoo design")).toBe(true);
  });
  it("non-ink mark ⇒ NEITHER rule — the pinned legacy disagreement", () => {
    // Under the legacy split, hasBodyArt=false selected CLEAN_SKIN for this
    // freckled document — erasing its own marks. Now: neither rule.
    expect(markPromptStateFor("dense freckles across nose and cheeks")).toBe("nonInkMark");
    expect(markPromptStateFor("a faint scar through the eyebrow")).toBe("nonInkMark");
    expect(markPromptStateFor("pierced ears with small studs")).toBe("nonInkMark");
  });
  it("mark-free ⇒ clean-skin state", () => {
    expect(markPromptStateFor("an elegant editorial face, smooth skin")).toBe("markFree");
  });

  it("getStudioSettings consumes the shared vocabulary: ink ⇒ persistence rule", () => {
    const settings = getStudioSettings("subject has a rose tattoo on the shoulder");
    expect(settings).toContain("TATTOO PERSISTENCE");
    expect(settings).not.toContain("STRICTLY CLEAN SKIN");
  });
  it("getStudioSettings: a marked (non-ink) document NEVER receives the clean-skin rule", () => {
    const settings = getStudioSettings("light freckles across the nose bridge");
    expect(settings).not.toContain("STRICTLY CLEAN SKIN");
    expect(settings).not.toContain("TATTOO PERSISTENCE");
  });
  it("getStudioSettings: a mark-free document takes the clean-skin rule", () => {
    const settings = getStudioSettings("a clean editorial look");
    expect(settings).toContain("STRICTLY CLEAN SKIN");
  });
});

describe("compaction protected-language guard (§13.4, M5)", () => {
  it("passes when every original mark family survives the rewrite", () => {
    const original = "She has a rose tattoo on her shoulder and light freckles.";
    const rewritten = "Editorial model; shoulder rose tattoo; faint freckles across the nose.";
    expect(protectedMarkLanguageIntact(original, rewritten)).toBe(true);
  });
  it("fails when a family is dropped or paraphrased away", () => {
    const original = "She has a rose tattoo on her shoulder and light freckles.";
    const dropped = "Editorial model with a shoulder rose tattoo."; // freckles laundered
    expect(protectedMarkLanguageIntact(original, dropped)).toBe(false);
    const paraphrased = "Editorial model with body decoration and sun-kissed dots."; // both laundered
    expect(protectedMarkLanguageIntact(original, paraphrased)).toBe(false);
  });
  it("byte-identical text trivially passes; mark-free documents always pass", () => {
    const marked = "a scar over the left brow";
    expect(protectedMarkLanguageIntact(marked, marked)).toBe(true);
    expect(protectedMarkLanguageIntact("clean editorial face", "totally different text")).toBe(true);
  });
});

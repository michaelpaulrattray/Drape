import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { SIGN_VERSION_COPY, signVersionFor } from "./signVersion";

/**
 * #1478 — HE SIGNED THE ORIGINAL AND THE PRODUCT NEVER SAID SO.
 *
 * *"i refined him edited his nose but only his original image signed"*. The
 * rows exonerate the mechanism — he had stepped back to compare seventeen
 * seconds earlier, so the original WAS the picture on his screen — and convict
 * the silence: nothing in the Sign box mentioned that the edit he had paid for
 * was not the thing about to be made permanent. His ruling was **A**, *"Sign
 * shows you which version it's about to sign, with the picture, before you
 * spend"*.
 *
 * ⚠ **EVERY ARM HERE HAS ITS OPPOSITE BESIDE IT, because both failures are
 * cheap to ship and only one of them is visible.** A rule that always returned
 * a version would satisfy every "it says something" arm and would put a
 * sentence about editions onto the nine Signs this product has performed where
 * no edit existed. A rule that always returned `null` would satisfy the quiet
 * arm and leave the founder's own defect exactly as he found it.
 */
describe("which version Sign is about to make permanent", () => {
  it("says nothing about a face that has never been edited — there is no version to name", () => {
    expect(signVersionFor({ refinementCount: 0, selectedVariantId: null })).toBeNull();
  });

  it("names the EDIT when the edit is the one on screen", () => {
    expect(signVersionFor({ refinementCount: 1, selectedVariantId: "var_abc" })).toBe("edit");
  });

  /* His own case, and the only one that has ever cost anybody anything. */
  it("names the ORIGINAL when she has edits and the original is the one on screen", () => {
    expect(signVersionFor({ refinementCount: 1, selectedVariantId: null })).toBe("original");
  });

  it("still names it with a whole stack of edits behind her", () => {
    expect(signVersionFor({ refinementCount: 6, selectedVariantId: null })).toBe("original");
    expect(signVersionFor({ refinementCount: 6, selectedVariantId: "var_f" })).toBe("edit");
  });

  /*
    A COUNT THAT CANNOT BE BELIEVED IS NOT A REASON TO SPEAK.

    Not defensive tidiness: the caller reads this off a list length, and a
    negative would mean the list was not a list. Silence is the safe direction
    for a claim about money, so the guard is `<= 0` rather than `=== 0` and this
    arm is what keeps it that way.
  */
  it("stays quiet on a count it cannot believe, rather than guessing", () => {
    expect(signVersionFor({ refinementCount: -1, selectedVariantId: "var_abc" })).toBeNull();
  });
});

/**
 * THE WORDS, NOT THE TOKEN.
 *
 * An arm asserting `"edit"` and a modal rendering "This signs your original"
 * would both be green — the rule and the sentence are two different claims, and
 * only the sentence is the product. So these read the copy the customer is
 * shown, and the anatomy arm below proves the component draws THIS map rather
 * than a string of its own.
 */
describe("what the box actually says", () => {
  it("speaks his vocabulary — his words, not the pipeline's", () => {
    expect(SIGN_VERSION_COPY.edit).toBe("This signs your edit.");
    expect(SIGN_VERSION_COPY.original).toBe("This signs your original, not your edit.");
  });

  /*
    THE DISAPPEARING-TECHNOLOGY LAW, DRIVEN RATHER THAN PROMISED (clause: no
    engine name, no pipeline term, on a path someone must walk to their
    picture). "Variant" is the word this whole road is built on and the one
    most likely to leak; "refinement" is ours too. A customer has an EDIT.
  */
  it("names no machinery — a customer has an edit, not a variant", () => {
    for (const sentence of Object.values(SIGN_VERSION_COPY)) {
      expect(sentence.toLowerCase()).not.toMatch(
        /variant|refinement|candidate|master|selected|version id|null/,
      );
    }
  });

  it("is a sentence, not a label — it ends in a full stop and starts with a capital", () => {
    for (const sentence of Object.values(SIGN_VERSION_COPY)) {
      expect(sentence.endsWith(".")).toBe(true);
      expect(sentence[0]).toBe(sentence[0]?.toUpperCase());
    }
  });
});

/**
 * THE COMPONENT DRAWS THE RULE, AND DRAWS IT NOWHERE ELSE.
 *
 * Read at the source rather than rendered, for the reason `modalAnatomy` gives:
 * a jsdom render proves the element exists and says nothing about the element
 * being wired to the shared map, which is the only thing that keeps the words
 * and the rule from drifting apart.
 */
const MODAL = new URL("./components/SignConfirm.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

describe("the Sign box's version line", () => {
  it("renders the shared copy map, never a string of its own", async () => {
    const source = await readFile(MODAL, "utf8");
    expect(source).toContain("SIGN_VERSION_COPY[signsVersion]");
    /* The sentences live in one place; a literal here is the drift. */
    expect(source).not.toContain("This signs your");
  });

  it("draws nothing at all when there is no version to name", async () => {
    const source = await readFile(MODAL, "utf8");
    /* The guard is the whole quiet case — without it the element renders with
       an undefined lookup inside it and the law's failure mode ships. */
    expect(source).toMatch(/\{signsVersion \?[\s\S]{0,200}: null\}/);
  });

  it("is sans and full ink, because it is a sentence and it is the operative one", async () => {
    const css = await readFile(new URL("../../foundation/modals.css", import.meta.url), "utf8");
    const block = css.slice(css.indexOf(".dpc-modal__version {"));
    const rule = block.slice(0, block.indexOf("}"));
    expect(rule).toContain("var(--font-sans)");
    /* No mono on sentences — the house's own mechanized design law. */
    expect(rule).not.toContain("var(--font-mono)");
    expect(rule).toContain("color: var(--ink)");
    /* Accent means STATE in this product, and nothing here is refused. */
    expect(rule).not.toContain("--accent");
  });
});

/**
 * WHERE THE ANSWER COMES FROM — the two facts that make the sentence true.
 *
 * Both are read at the sheet's source, because neither can be proven by
 * rendering: the first is a query key and the second is which resolver the
 * derivation calls. Getting either wrong produces a confident sentence about
 * the wrong woman or the wrong version, which is the one outcome worse than the
 * silence this card replaces.
 */
describe("the fact the sentence is derived from", () => {
  it("asks about the SIGN TARGET, not whichever face the viewer happens to be open on", async () => {
    const source = await readFile(SHEET, "utf8");
    expect(source).toContain("candidateId: signing?.candidateId ?? \"\"");
    expect(source).toContain("enabled: signing !== null");
  });

  /*
    ⚠ THE ARM THAT PINS THE DECISION THIS BUILD GOT WRONG FIRST, AND IT ASSERTS
    AN ABSENCE ON PURPOSE.

    The obvious wiring — and the one written first — resolved this through
    `selectedVariantFor`, the click-aware answer every other surface on the
    sheet uses. It is wrong HERE, and wrong in the direction that matters.

    The override is scoped to the viewer and the tile. It never reaches the kept
    strip, whose picture is `faceImageKey` — projected from the server's own
    `selectedVariantId`, the same fact `getSignableCandidate` signs from. So
    inside the round trip of a version click the modal's PICTURE is the server's
    version and the SIGN takes the server's version; only the viewer behind the
    scrim is drawing the clicked one. A click-aware sentence would there read
    *"this signs your edit"* over a photograph of the original, and then sign
    the original — a confident sentence contradicting both the picture beside it
    and the money under it, on the surface built to stop exactly that.

    Every instinct in this file's neighbourhood says to "fix" this back, so the
    arm states the rule rather than leaving the next reader to re-derive it.
  */
  it("keys on the SERVER's pointer, not the click-aware one — the words must agree with the picture and the spend", async () => {
    const source = await readFile(SHEET, "utf8");
    const derivation = source.slice(
      source.indexOf("const signsVersion = signing"),
      source.indexOf("THE FRAME THE SHOWN ONE REPLACED"),
    );
    expect(derivation).toContain("signTargetVariants.data.selectedVariantId");
    expect(derivation).not.toContain("selectedVariantFor(");
    expect(derivation).not.toContain("chosenFrame");
  });

  it("passes it to the box rather than deriving a second answer inside it", async () => {
    const source = await readFile(SHEET, "utf8");
    expect(source).toContain("signsVersion={signsVersion}");
  });
});

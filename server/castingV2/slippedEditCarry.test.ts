import { describe, expect, it } from "vitest";
import { mintedSlotsForRender } from "./mintedSlots";
import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";
import { liveReferences, supersededCarrySlots, type StoredReference } from "./referenceLibrary";
import { REFUSAL_THAT_IS_EVIDENCE_ONLY } from "./referenceCompleteness";
import { confirmVerdict, libraryReadingOf, type FacetCheck, type RenderVerdict } from "./renderVerification";
import { pronounsForSex } from "./castPronouns";
import type { Facet } from "./refineFacets";

/**
 * ⚠ AN EDIT THE RENDER LOST IS NEVER LOCKED IN AS "KEEP … EXACTLY" (#2646).
 *
 * The layout court's specimen, driven end to end through the seam it crossed:
 * the reader's verdict → what the library adopts → which rows are live → the
 * prompt the next render sends.
 *
 *   step 1  "cut the hair into a short crop"   delivered short
 *   step 2  a neck tattoo                       the cut slipped back to a bun
 *   step 3  glasses (the hair is re-asked)      still a bun; the one reading
 *                                               said "worn as cut", its re-read
 *                                               failed twice → hair@v2 ADOPTED
 *   step 4+ every prompt: Reference "the exact hair they have — the same hair,
 *           unchanged" + "Keep their hair exactly: … high bun", beside a
 *           description saying short cropped hair.
 *
 * Neither end alone shows it: the library suite proves what it adopts and the
 * assembler suite proves what it says about a library it is handed. The
 * contradiction lived between them.
 */
const THEY = pronounsForSex(undefined);
const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };
const BUN_WORDS = "Dark brown hair swept up into a high bun, center-parted";
const DESCRIPTION = "A street casting subject in their mid 20s, with short cropped hair.";

const check = (facet: Facet, verified: boolean, saw: string): FacetCheck => ({
  subject: { kind: "facet", facet },
  asked: `the ${facet} asked`,
  verified,
  read: true,
  binding: false,
  saw,
});

/** Step 3's reading: both written hair facets say yes, on the frame with the bun. */
const falsePass = (readings: number): RenderVerdict => ({
  ok: true,
  readings,
  checks: [
    check("hair.cut" as Facet, true, "short hair"),
    /* A confirmed yes carries its own mark (#2650); the count alone never did. */
    { ...check("hairWorn" as Facet, true, "worn as cut"), ...(readings >= 2 ? { confirmed: true as const } : {}) },
  ],
});
const WRITTEN = new Set<Facet>(["hair.cut" as Facet, "hairWorn" as Facet]);

let nextId = 1;
const row = (over: Partial<StoredReference>): StoredReference => ({
  id: nextId,
  publicId: `ref-${nextId++}`,
  candidateId: 744,
  variantId: 1,
  role: "carry",
  slot: "hair",
  tier: "anatomy",
  noun: "hair",
  words: [BUN_WORDS],
  storageKey: null,
  maskKey: null,
  digest: null,
  geometry: null,
  guard: null,
  refusal: null,
  version: 1,
  retiredAt: null,
  createdAt: new Date(0),
  ...over,
});

/** Step 2 left a disputed hair row behind — the bun the reader DID catch. */
const STEP_2 = row({
  version: 1,
  refusal: { reason: REFUSAL_THAT_IS_EVIDENCE_ONLY, kind: "hair", coverage: 9985, contentKey: null, maskKey: null, geometry: null },
});

/**
 * Step 3, through the real derivation and the real slot list, then step 4's
 * prompt through the real assembler. Returns the prompt and what was superseded.
 */
function stepThreeThenFour(verdict: RenderVerdict) {
  const reading = libraryReadingOf(verdict, WRITTEN);
  const minted = mintedSlotsForRender({
    earned: reading.earned,
    disputed: Array.from(reading.missed),
    captions: { "hair.cut": BUN_WORDS },
    accessoryKind: null,
    held: new Set(),
  });
  const hair = minted.slots.find((spec) => spec.slot === "hair");
  expect(hair, "step 3 filed no hair row at all").toBeDefined();
  /* What the mint writes for each: a disputed slot is refused at the door as
     evidence; an adopted one is a delivered crop with its words. */
  const stepThree = hair!.disputed
    ? row({ version: 2, refusal: { reason: REFUSAL_THAT_IS_EVIDENCE_ONLY, kind: "hair", coverage: 10000, contentKey: null, maskKey: null, geometry: null } })
    : row({ version: 2, storageKey: "casting-v2/library/bun.png", digest: "b0b0b0b0b0b0" });
  const lineage = [STEP_2, stepThree];
  const live = liveReferences(lineage);
  const library: LibraryEntry[] = live.map((entry) => ({
    slot: entry.slot,
    tier: entry.tier,
    noun: entry.noun,
    words: entry.words,
    ...(entry.storageKey && entry.digest ? { carry: { key: entry.storageKey, sha: entry.digest } } : {}),
  }));
  const recipe = assembleRecipe({
    master: MASTER,
    pronouns: THEY,
    library,
    asks: [{ slot: "skin", noun: "skin", words: "freckles across the nose and cheeks" }],
    currentDescription: DESCRIPTION,
  });
  expect(recipe.ok, "step 4's assembly refused").toBe(true);
  if (!recipe.ok) throw new Error("unreachable");
  return { reading, recipe, superseded: supersededCarrySlots(lineage) };
}

describe("an edit the render lost is not carried forward as the truth (#2646)", () => {
  it("an unconfirmed yes on the hair sends no bun crop and no 'Keep … exactly' bun line", () => {
    const { reading, recipe, superseded } = stepThreeThenFour(falsePass(1));

    expect(reading.unconfirmed.has("hairWorn" as Facet)).toBe(true);
    expect(reading.earned).not.toContain("hairWorn");
    /* At the wire: the sentence and the picture the next engine receives. */
    expect(recipe.prompt).not.toMatch(/Keep \w+ hair exactly/);
    expect(recipe.prompt).not.toContain("high bun");
    expect(recipe.prompt).not.toContain("the exact hair");
    expect(recipe.references.map((ref) => ref.image.key)).not.toContain("casting-v2/library/bun.png");
    /* And the slot is handed to the words road instead (`RepaintAsksInput.restore`),
       which says the ASKED state rather than the delivered one. */
    expect(superseded).toContain("hair");
    expect(recipe.prompt).toContain(DESCRIPTION);
  });

  it("a slot whose neighbour facet MISSED is not adopted on the strength of the one that passed", () => {
    /* Two readings this time, so the confirmation is not the reason: the cut
       passed and the worn state plainly did not. */
    const verdict: RenderVerdict = {
      ok: true,
      readings: 2,
      checks: [
        check("hair.cut" as Facet, true, "short hair"),
        check("hairWorn" as Facet, false, "hair gathered into a bun on top of head"),
      ],
    };
    const { recipe, superseded } = stepThreeThenFour(verdict);
    expect(recipe.prompt).not.toMatch(/Keep \w+ hair exactly/);
    expect(recipe.prompt).not.toContain("high bun");
    expect(superseded).toContain("hair");
  });

  it("⚠ POSITIVE CONTROL — a CONFIRMED reading still adopts, and the arm can see the line", () => {
    /* Two readings that agree are the product's own bar for a fact, so the
       crop is adopted and stands. If this arm stopped seeing the keep line, the
       two above would pass for nothing. */
    const { recipe, superseded } = stepThreeThenFour(falsePass(2));
    expect(recipe.prompt).toMatch(/Keep \w+ hair exactly: Dark brown hair swept up into a high bun/);
    expect(recipe.references.map((ref) => ref.image.key)).toContain("casting-v2/library/bun.png");
    expect(superseded).not.toContain("hair");
  });

  it("⚠ a re-read that comes back SILENT on the hair is not a confirmation — through the real confirmVerdict (#2650)", async () => {
    /* The reviewer's shape: the second reading returned (readings: 2) but held
       no check for hairWorn. Until #2650 the count alone made the yes count. */
    const first: RenderVerdict = { ok: true, checks: [
      check("hair.cut" as Facet, true, "short hair"),
      check("hairWorn" as Facet, true, "worn as cut"),
    ] };
    const verdict = await confirmVerdict(first, async () => ({
      ok: true, checks: [check("hair.cut" as Facet, true, "short hair")],
    }));
    expect(verdict.readings).toBe(2);
    const { reading, recipe, superseded } = stepThreeThenFour(verdict);
    expect(reading.unconfirmed.has("hairWorn" as Facet)).toBe(true);
    expect(recipe.prompt).not.toMatch(/Keep \w+ hair exactly/);
    expect(recipe.prompt).not.toContain("high bun");
    expect(superseded).toContain("hair");
  });

  it("⚠ CONTROL — a re-read that READ the hair and agreed confirms it, through the same function", async () => {
    const first: RenderVerdict = { ok: true, checks: [
      check("hair.cut" as Facet, true, "short hair"),
      check("hairWorn" as Facet, true, "worn as cut"),
    ] };
    const verdict = await confirmVerdict(first, async () => ({
      ok: true, checks: [check("hair.cut" as Facet, true, "short hair"), check("hairWorn" as Facet, true, "worn as cut")],
    }));
    const { reading, recipe } = stepThreeThenFour(verdict);
    expect(reading.unconfirmed.has("hairWorn" as Facet)).toBe(false);
    expect(recipe.prompt).toMatch(/Keep \w+ hair exactly: Dark brown hair swept up into a high bun/);
  });
});

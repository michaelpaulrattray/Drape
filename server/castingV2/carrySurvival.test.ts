import { describe, expect, it } from "vitest";
import { mintedSlotsForRender } from "./mintedSlots";
import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";
import { allFacets } from "./refineFacets";
import { FACET_SLOTS } from "./referenceSlotCatalogue";
import { pronounsForSex } from "./castPronouns";

/**
 * ⚠ EVERY DELIVERED FACT SURVIVES THE NEXT REPAINT — the class arm for
 * fable-1364/1365, and it is here to make the NEXT sibling loud rather than to
 * re-prove the horns.
 *
 * # What was lost, and why one test could not have caught it
 *
 * A repaint's prompt says a fact only if the fact is in the LIBRARY:
 * `recipeAssembler`'s standing loop iterates `library` and there is no other
 * word source. So a delivered fact that mints no library row does not exist to
 * the next render, however loudly the composed deltas still state it — and the
 * frame comes back without it, delivered and charged. Measured on production:
 * three of sixteen repaint renders dropped a paid feature (v198 and v199,
 * `dangly cross earrings`; v212, the founder's horns).
 *
 * Every instance so far has been a different door — a caption the two readers
 * worded differently, an accessory family with no kind, an open kind that
 * stored nothing. What they share is the SHAPE, so this arm is written on the
 * shape: **drive every facet a delta can hold through the mint and then through
 * the assembler, and require the recipe to name it.**
 *
 * # The two ends it holds together
 *
 * Neither end alone catches this. The mint's own suite proves what it files;
 * the assembler's suite proves what it says about a library it is handed. The
 * defect lived exactly between them — a mint that filed nothing and an
 * assembler that faithfully said nothing about it — which is the seam a
 * per-module test cannot see.
 */
const SHE = pronounsForSex("female");
const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };

/**
 * Facets the catalogue DELIBERATELY does not give a feature slot, each with the
 * catalogue's own reason quoted rather than a name on a skip-list.
 *
 * A new entry here is a decision somebody signs: the assignment type is
 * `Record<Facet, FacetAssignment>`, so a facet cannot go unassigned, but it CAN
 * be assigned a reason — and this list is where that reason has to be true.
 */
const NOT_A_FEATURE_SLOT: Record<string, string> = {
  /* `{"notASlot":"presentation, not identity (D-136) — a follow must never
     inherit a smile — and there is no zone that contains it"}` */
  expression: "notASlot",
  /* `{"notASlot":"makeup is worn STATE on the anatomy slots it is worn on"}` —
     a smoky eye rides `eye@left`/`eye@right`, a nude lip rides `lips`. */
  makeup: "notASlot",
  /* `{"perPlacement":"ink"}` — its own lane, keyed by placement, carried as a
     delivered crop rather than a feature slot. */
  ink: "perPlacement",
  /* `{"family":"accessories"}` — resolved to a slot by the accessory KIND at
     mint time. ⚠ This is door (b) of fable-1365 §3: production v198/v199
     dropped `dangly cross earrings`, mechanism unproven, and it is filed rather
     than fixed in this commit. The exclusion here is what keeps this arm honest
     about that. */
  statedAccessories: "family",
};

describe("a delivered fact survives to the next render", () => {
  const carried = allFacets()
    .filter((facet) => !(facet in NOT_A_FEATURE_SLOT))
    .sort();

  it("the excluded set is exactly what the catalogue says it is", () => {
    /*
      The skip-list cannot drift away from the source: every excluded facet must
      still carry the assignment shape its reason names, and every facet the
      catalogue gives a feature must NOT be excluded. A facet demoted to
      `notASlot` without a line here fails, and so does one promoted to a
      feature while a stale exclusion hides it.
    */
    for (const [facet, shape] of Object.entries(NOT_A_FEATURE_SLOT)) {
      expect(FACET_SLOTS[facet], facet).toHaveProperty(shape);
    }
    for (const facet of carried) {
      expect(FACET_SLOTS[facet], facet).toHaveProperty("feature");
    }
    /* And the population is real — an arm over an empty list passes. */
    expect(carried.length).toBeGreaterThan(20);
  });

  it.each(carried)("⚠ %s — the mint files it and the next recipe says it", (facet) => {
    /*
      The render this models is the one that lost the horns: the binding
      verifier confirmed the delivery (so the facet is EARNED) and the caption
      reader could not corroborate its own words (so `captions` is empty). That
      pairing is not exotic — on novel anatomy it is the ordinary case, because
      two honest readers describe an unfamiliar thing two ways.
    */
    const asked = `the delivered ${facet} of this render`;
    const minted = mintedSlotsForRender({
      earned: [facet],
      disputed: [],
      captions: {},
      accessoryKind: null,
      held: new Set(),
      asked: { [facet]: asked },
    });

    expect(
      minted.slots.length,
      `${facet} minted NOTHING — unfiled: ${JSON.stringify(minted.unfiled)}`,
    ).toBeGreaterThan(0);

    /* The library this render leaves behind, in the shape the next render reads. */
    const library: LibraryEntry[] = minted.slots.map((spec) => ({
      slot: spec.slot,
      tier: spec.tier,
      noun: spec.noun,
      words: spec.words,
    }));

    /*
      The NEXT render, editing something else entirely. `lips` is the neighbour
      because every fixture in `recipeAssembler.test.ts` uses it and it shares a
      slot with nothing — so a facet that edits `lips` itself is asked about a
      different neighbour, since a slot cannot both be edited and stand.
    */
    const neighbour = library.some((entry) => entry.slot === "lips")
      ? { slot: "hair" as const, noun: "hair", words: "worn long and loose" }
      : { slot: "lips" as const, noun: "lips", words: "a soft nude lip gloss" };
    const recipe = assembleRecipe({
      master: MASTER,
      pronouns: SHE,
      library: library.filter((entry) => entry.slot !== neighbour.slot),
      asks: [neighbour],
    });

    expect(recipe.ok, `assembly refused for ${facet}`).toBe(true);
    if (!recipe.ok) return;

    /*
      NAMED, not merely present in some array. The prompt is what reaches the
      engine, and a fact carried in a structure the prompt does not read is the
      defect this file is named after.
    */
    const standingSlots = recipe.standing.map((entry) => entry.slot);
    for (const entry of library) {
      if (entry.slot === neighbour.slot) continue;
      expect(
        standingSlots,
        `${facet}: ${entry.slot} minted a row and the recipe never stood on it`,
      ).toContain(entry.slot);
      expect(recipe.prompt, `${facet}: the prompt never says ${entry.slot}`).toContain(asked);
    }
  });

  it("⚠ CONTROL — a fact with NO library row is exactly what disappears", () => {
    /*
      The negative control, and it is the specimen rather than a fixture: this
      is v212. The recipe is assembled with an empty library, the composed state
      still holds the fact, and the prompt says nothing about it — which is why
      the frame came back hornless and why the arms above are worth running.
    */
    const recipe = assembleRecipe({
      master: MASTER,
      pronouns: SHE,
      library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.standing).toEqual([]);
    expect(recipe.prompt).not.toContain("horn");
  });
});

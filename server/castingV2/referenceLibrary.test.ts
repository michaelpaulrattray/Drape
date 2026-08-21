/**
 * The reference library's fold — the rules a fork-edit gets wrong.
 *
 * Every case here is a branch of the refinement TREE, because that is where the
 * defects live: a candidate has many answers to "what is her hair", and the
 * whole job of this fold is to return the one belonging to the face she is
 * looking at. fable-091 is the specimen — a fork from B carrying D's glasses.
 *
 * Each rule is driven with the case that would pass if the rule were missing,
 * not merely with the case it is meant to handle.
 */
import { describe, expect, it } from "vitest";

import {
  deriveLibrary, instanceLastWritten, libraryWithoutEditedCrops, liveReferences,
  type StoredReference,
} from "./referenceLibrary";
import { assembleRecipe } from "./recipeAssembler";

let nextId = 1;

function row(overrides: Partial<StoredReference> & { slot: string }): StoredReference {
  const id = nextId++;
  return {
    id,
    publicId: `pub-${id}`,
    candidateId: 7,
    variantId: null,
    role: "carry",
    tier: "anatomy",
    noun: overrides.slot,
    words: [],
    storageKey: `casting-v2/library/${id}.png`,
    maskKey: `casting-v2/library/${id}-mask.png`,
    digest: `digest-${id}`,
    geometry: {
      bbox: { x: 0, y: 0, width: 10, height: 10 },
      frame: { width: 100, height: 100 },
    },
    guard: { kind: "hair", coverage: 9460, spill: 0, threshold: 9460 },
    refusal: null,
    version: 1,
    retiredAt: null,
    createdAt: new Date(2026, 7, 10, 12, 0, id),
    ...overrides,
  };
}

describe("which rows are live", () => {
  it("takes the newest version of a slot and drops its predecessor", () => {
    const older = row({ slot: "hair", version: 1, storageKey: "old.png" });
    const newer = row({ slot: "hair", version: 2, storageKey: "new.png" });

    const live = liveReferences([older, newer]);

    expect(live).toHaveLength(1);
    expect(live[0]!.storageKey).toBe("new.png");
  });

  it("keeps the anchor and the carry of one slot side by side", () => {
    const anchor = row({ slot: "tattoo", role: "anchor", tier: "item" });
    const carry = row({ slot: "tattoo", role: "carry", tier: "item" });

    expect(liveReferences([anchor, carry])).toHaveLength(2);
  });

  /*
    THE UNDO INSIDE A TREE, and the reason retired rows are not filtered in SQL.

    She takes the earring off on this branch. If the fold simply skipped retired
    rows, this input — a live v1 and a retired v2 — would return the OLD earring
    and put it straight back on. The assertion is that nothing comes back, and
    the fixture is built so that a broken rule has something to return.
  */
  it("treats a retired NEWEST as gone, with an older live row present to come back", () => {
    const introduced = row({ slot: "earring@left", role: "anchor", tier: "item", version: 1 });
    const removed = row({
      slot: "earring@left",
      role: "anchor",
      tier: "item",
      version: 2,
      retiredAt: new Date(2026, 7, 10, 13, 0, 0),
    });

    const live = liveReferences([introduced, removed]);

    expect(live).toEqual([]);
  });

  it("treats a retired OLDER version as nothing at all", () => {
    const retired = row({
      slot: "hair",
      version: 1,
      retiredAt: new Date(2026, 7, 10, 13, 0, 0),
    });
    const current = row({ slot: "hair", version: 2, storageKey: "current.png" });

    const live = liveReferences([retired, current]);

    expect(live).toHaveLength(1);
    expect(live[0]!.storageKey).toBe("current.png");
  });

  it("never folds two instances of a bilateral feature into one", () => {
    const left = row({ slot: "eye@left" });
    const right = row({ slot: "eye@right" });

    expect(liveReferences([left, right]).map((entry) => entry.slot))
      .toEqual(["eye@left", "eye@right"]);
  });
});

/**
 * RULE 3 — a disputed row is evidence, not a version (fable-220 §3).
 *
 * The failure it prevents is silent and expensive: the row is the newest carry
 * row for its slot, it holds no `storageKey`, and the crop that had been riding
 * into every prompt simply stops. A disputed ask would then change what the
 * painter sees on the NEXT paid render — which is delivery, and delivery was
 * ruled untouched.
 */
describe("a disputed delivery's row", () => {
  const disputedRow = (slot: string, version: number) => row({
    slot,
    version,
    /* The shape the mint writes: no delivered crop, a refusal carrying one. */
    storageKey: null,
    maskKey: null,
    digest: null,
    geometry: null,
    guard: null,
    words: ["natural, slim, no pronounced cupid's bow"],
    refusal: {
      reason: "disputedDelivery",
      kind: "lips",
      coverage: 8870,
      contentKey: "casting-v2/library/x-refused.png",
      maskKey: "casting-v2/library/x-refused-mask.png",
      geometry: { bbox: { x: 0, y: 0, width: 10, height: 10 }, frame: { width: 100, height: 100 } },
    },
  });

  it("does not become the slot's newest version, however new it is", () => {
    const delivered = row({ slot: "lips", version: 4, storageKey: "the-good-crop.png" });
    const live = liveReferences([delivered, disputedRow("lips", 5)]);

    expect(live).toHaveLength(1);
    expect(live[0]!.storageKey).toBe("the-good-crop.png");
  });

  /*
    AND THE SAME PROPERTY ON A CARRIED DEGREE FACET, which is where it was
    needed and was not reaching (his incident, fable-1242/1247).

    Production candidate 1641: v#204 delivered a jacked build and minted
    version 1; v#206 carried it, the engine dropped it, and version 3 was cut
    from the frame that LOST it — so the branch's answer to WHAT IS HIS BUILD
    became a picture of the un-jacked body, and every later carry would have
    sent the loss as the fact.

    The gate was never wrong; it was never handed this case. Marked disputed,
    the branch heals with no repaint and no second reader: the next render
    carries the jacked crop again.
  */
  it("HEALS a carried slot: the frame that LOST his build never displaces the one that had it", () => {
    const live = liveReferences([
      row({ slot: "build", version: 1, storageKey: "casting-v2/library/jacked.png" }),
      row({ slot: "build", version: 2, storageKey: "casting-v2/library/jacked-2.png" }),
      disputedRow("build", 3),
    ]);

    expect(live).toHaveLength(1);
    expect(live[0]!.storageKey, "the branch adopted the body that lost the build")
      .toBe("casting-v2/library/jacked-2.png");
    expect(live[0]!.version).toBe(2);
  });

  it("CHANGES THE ASSEMBLER'S LIBRARY BY EXACTLY NOTHING", () => {
    /* The additivity property, driven rather than argued: the same rows with and
       without a disputed row produce the same library. If this ever fails, a
       disputed ask has started editing the next render's prompt. */
    const before = [
      row({ slot: "lips", version: 4, words: ["full, a soft nude"] }),
      row({ slot: "hair", version: 1, words: ["a blunt bob"] }),
    ];
    expect(deriveLibrary([...before, disputedRow("lips", 5)]))
      .toEqual(deriveLibrary(before));
  });

  it("CONTROL — a noSpecimen refusal IS a version, and drops the stale crop", () => {
    /*
      The other refusal that keeps its pixels behaves the opposite way, and it
      must: that render EARNED its slot, the words moved on, and leaving the old
      crop riding beside them is two instructions about one feature. Same column
      group, same kept pixels, different verdict about the feature — so the
      distinction is real rather than a spelling.
    */
    const delivered = row({ slot: "earring@left", version: 1, storageKey: "the-old-hoop.png" });
    const refused = row({
      slot: "earring@left",
      version: 2,
      storageKey: null,
      maskKey: null,
      digest: null,
      geometry: null,
      guard: null,
      words: ["a thin gold hoop"],
      refusal: {
        reason: "noSpecimen",
        kind: "earring",
        coverage: 6520,
        contentKey: "casting-v2/library/y-refused.png",
        maskKey: "casting-v2/library/y-refused-mask.png",
        geometry: { bbox: { x: 0, y: 0, width: 10, height: 10 }, frame: { width: 100, height: 100 } },
      },
    });

    const live = liveReferences([delivered, refused]);
    expect(live).toHaveLength(1);
    expect(live[0]!.storageKey).toBeNull();
    expect(deriveLibrary([delivered, refused])[0]).toEqual({
      slot: "earring@left",
      tier: "anatomy",
      noun: "earring@left",
      words: ["a thin gold hoop"],
    });
  });

  it("leaves a slot it is the ONLY row for out of the library entirely", () => {
    /* No previous version to protect, and still nothing to say: the render made
       no verified account of this feature, so the assembler hears nothing about
       it — exactly as it did before any of this was built. */
    expect(deriveLibrary([disputedRow("lips", 1)])).toEqual([]);
  });
});

describe("the library the assembler is handed", () => {
  it("gives a slot its anchor and its carry as one entry", () => {
    const entries = deriveLibrary([
      row({
        slot: "tattoo",
        role: "anchor",
        tier: "item",
        noun: "forearm tattoo",
        words: ["a small swallow"],
        storageKey: "flash-sheet.png",
        maskKey: null,
        geometry: null,
        guard: null,
      }),
      row({
        slot: "tattoo",
        role: "carry",
        tier: "item",
        noun: "forearm tattoo",
        words: ["a small swallow"],
        storageKey: "minted-crop.png",
      }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.anchor?.key).toBe("flash-sheet.png");
    expect(entries[0]!.carry?.key).toBe("minted-crop.png");
    expect(entries[0]!.tier).toBe("item");
  });

  /*
    A SURFACE HAS WORDS AND NEVER A CROP (§3.0a). An entry built only from rows
    that carry an image would silently drop everything ever said about her tan,
    and the prompt would stop saying it without anything failing.
  */
  it("keeps a words-only surface slot, with no carry image", () => {
    const entries = deriveLibrary([
      row({
        slot: "skin",
        tier: "surface",
        noun: "skin",
        words: ["a warm even tan"],
        storageKey: null,
        maskKey: null,
        digest: null,
        geometry: null,
        guard: null,
      }),
    ]);

    expect(entries).toEqual([{
      slot: "skin",
      tier: "surface",
      words: ["a warm even tan"],
      noun: "skin",
    }]);
  });

  it("reads the slot's state from its newest row", () => {
    const entries = deriveLibrary([
      row({ slot: "lips", version: 1, words: ["full"], noun: "lips" }),
      row({ slot: "lips", version: 2, words: ["full", "a soft matte red"], noun: "lips" }),
    ]);

    expect(entries[0]!.words).toEqual(["full", "a soft matte red"]);
  });

  it("orders slots by when the face acquired them", () => {
    const entries = deriveLibrary([
      row({ slot: "hair", createdAt: new Date(2026, 7, 10, 12, 0, 0) }),
      row({ slot: "lips", createdAt: new Date(2026, 7, 10, 12, 5, 0) }),
      row({ slot: "eye@left", createdAt: new Date(2026, 7, 10, 12, 9, 0) }),
    ]);

    expect(entries.map((entry) => entry.slot)).toEqual(["hair", "lips", "eye@left"]);
  });

  it("hands the assembler something it can build a prompt from", () => {
    const library = deriveLibrary([
      row({
        slot: "hair",
        tier: "anatomy",
        noun: "hair",
        words: ["a blunt shoulder-length bob"],
        storageKey: "hair-crop.png",
        digest: "sha-hair",
      }),
      row({
        slot: "skin",
        tier: "surface",
        noun: "skin",
        words: ["a warm even tan"],
        storageKey: null,
        maskKey: null,
        digest: null,
        geometry: null,
        guard: null,
      }),
    ]);

    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
      library,
      asks: [],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* The hair crop rides as reference 2 and says its own words on its own
       sentence; the surface has no crop at all and stands on words alone. */
    expect(recipe.references.map((reference) => reference.image.key))
      .toEqual(["master.png", "hair-crop.png"]);
    expect(recipe.prompt).toContain("Reference 2 is the exact hair she has");
    expect(recipe.prompt).toContain("Keep her skin exactly: a warm even tan.");
    expect(recipe.carried).toEqual(["hair", "skin"]);
  });

  /*
    D-244 line 2 — the crop an edited slot must not be sent, dropped where both
    the asks and the library are in hand. The assembler refuses such a recipe
    rather than repairing it, and until opus-238 nothing removed the crop, so
    the SECOND edit of any slot refused and refunded on the founder's own face.
  */
  it("drops an EDITED slot's crop and keeps everything else about it", () => {
    const library = deriveLibrary([
      row({ slot: "hair", role: "carry", tier: "anatomy", noun: "hair",
        words: ["tight curls piled into a high bun"], storageKey: "hair-crop.png" }),
      row({ slot: "lips", role: "carry", tier: "anatomy", noun: "lips",
        words: ["a fuller cupid's bow"], storageKey: "lips-crop.png" }),
    ]);

    const forRender = libraryWithoutEditedCrops(library, new Set(["hair"] as never));

    const hair = forRender.find((entry) => entry.slot === "hair")!;
    expect(hair.carry).toBeUndefined();
    /* The words are the stack the edit regenerates FROM; losing them with the
       crop would be the same defect wearing the fix's clothes. */
    expect(hair.words).toEqual(["tight curls piled into a high bun"]);
    /* And an untouched slot is not collateral. */
    expect(forRender.find((entry) => entry.slot === "lips")!.carry?.key)
      .toBe("lips-crop.png");
  });

  it("keeps an edited item's ANCHOR — a tattoo regenerates from its flash sheet", () => {
    /* D-244 line 3. Only the minted crop is forbidden in its own edit; the
       frozen introduction reference is the very thing the edit paints from, and
       dropping it would repaint an introduced item from a master that never
       held it. */
    const library = deriveLibrary([
      row({ slot: "tattoo@forearm", role: "anchor", tier: "item", noun: "forearm tattoo",
        words: ["a fine-line swallow"], storageKey: "flash-swallow.png" }),
      row({ slot: "tattoo@forearm", role: "carry", tier: "item", noun: "forearm tattoo",
        words: ["a fine-line swallow"], storageKey: "tattoo-crop.png", version: 2 }),
    ]);

    const forRender = libraryWithoutEditedCrops(library, new Set(["tattoo@forearm"] as never));

    const tattoo = forRender[0]!;
    expect(tattoo.carry).toBeUndefined();
    expect(tattoo.anchor?.key).toBe("flash-swallow.png");
  });

  it("is a no-op when nothing is edited, and when the edited slot never carried", () => {
    /* The control that makes the two above mean something: the same function on
       the same library, changing nothing. */
    const library = deriveLibrary([
      row({ slot: "hair", role: "carry", tier: "anatomy", noun: "hair",
        words: ["copper"], storageKey: "hair-crop.png" }),
    ]);

    expect(libraryWithoutEditedCrops(library, new Set())).toEqual(library);
    expect(libraryWithoutEditedCrops(library, new Set(["lips"] as never))).toEqual(library);
  });

  /*
    The degenerate case, which is the road every new cast travels first: a face
    with no library at all assembles to the master and the ask alone.
  */
  it("is empty for a face nothing has been filed against", () => {
    expect(deriveLibrary([])).toEqual([]);
  });
});

/*
  THE LIBRARY LEARNS TO HOLD AN ABSENCE (migration 0030, fable-326/327).

  Proved with pictures before any of this existed: step A took her glasses off,
  step B asked for copper hair, and the frame came back with copper hair AND the
  glasses, because the master wears them forever and nothing re-said the absence.
  Each rule below is driven with the case that would pass if the rule were
  missing.
*/
describe("a vacated slot", () => {
  const VACANT = "no earrings — both earlobes bare, nothing hanging from either ear";

  it("sends NO crop, even though the carry that put the earrings there is still live", () => {
    const worn = row({
      slot: "earring@left", role: "carry", tier: "item", noun: "left earring",
      words: ["a wide gold hoop"], version: 1, storageKey: "hoop.png",
    });
    const gone = row({
      slot: "earring@left", role: "vacancy", tier: "item", noun: "left earring",
      words: [VACANT], version: 2, storageKey: null, maskKey: null, digest: null,
    });

    const [entry] = deriveLibrary([worn, gone]);

    expect(entry!.vacant).toBe(true);
    expect(entry!.carry).toBeUndefined();
    expect(entry!.anchor).toBeUndefined();
    expect(entry!.words).toEqual([VACANT]);
  });

  it("CONTROL — without the vacancy the same carry rides, which is the recipe this prevents", () => {
    const worn = row({
      slot: "earring@left", role: "carry", tier: "item", noun: "left earring",
      words: ["a wide gold hoop"], version: 1, storageKey: "hoop.png",
    });

    const [entry] = deriveLibrary([worn]);

    expect(entry!.vacant).toBeUndefined();
    expect(entry!.carry).toEqual({ key: "hoop.png", sha: worn.digest });
  });

  it("is superseded by a later answer on the same slot — she puts new ones in", () => {
    const gone = row({
      slot: "earring@left", role: "vacancy", tier: "item", noun: "left earring",
      words: [VACANT], version: 2, storageKey: null, maskKey: null, digest: null,
      createdAt: new Date(2026, 7, 10, 12, 0, 1),
    });
    const again = row({
      slot: "earring@left", role: "carry", tier: "item", noun: "left earring",
      words: ["small silver studs"], version: 3, storageKey: "studs.png",
      createdAt: new Date(2026, 7, 10, 13, 0, 0),
    });

    const [entry] = deriveLibrary([gone, again]);

    expect(entry!.vacant).toBeUndefined();
    expect(entry!.carry).toEqual({ key: "studs.png", sha: again.digest });
    expect(entry!.words).toEqual(["small silver studs"]);
  });

  it("says the absence in the recipe on a LATER render that never mentioned it", () => {
    const gone = row({
      slot: "glasses", role: "vacancy", tier: "item", noun: "glasses",
      words: ["no glasses — her face uncovered, no frames, no lenses"],
      version: 2, storageKey: null, maskKey: null, digest: null,
    });

    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
      library: deriveLibrary([gone]),
      /* An unrelated ask — the exact shape of the step that brought them back. */
      asks: [{ slot: "hair", noun: "hair", words: "coloured copper" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("no glasses — her face uncovered");
    /* And it sends the master alone: nothing pictures an absence. */
    expect(recipe.references).toHaveLength(1);
  });

  it("CONTROL — an ITEM slot that is merely undescribed says nothing, as it always has", () => {
    /* The same shape without the vacancy: an item carry with words. It is
       carried by its crop and must NOT also be described, which is why the
       standing loop skips items — the rule the vacancy has to reach past. */
    const worn = row({
      slot: "earring@left", role: "carry", tier: "item", noun: "left earring",
      words: ["a wide gold hoop"], version: 1, storageKey: "hoop.png",
    });

    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
      library: deriveLibrary([worn]),
      asks: [{ slot: "hair", noun: "hair", words: "coloured copper" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).not.toContain("Keep her left earring exactly");
  });
});

/**
 * WHICH ONE OF A PAIR THE LAST EDIT TOUCHED (fable-444 condition 1).
 *
 * Ruling C put the per-side memory in these rows, so these rows are the only
 * honest answer to "may a later render still ask whether her EYES are green".
 * Every case below is a state a real chain produces, and each is driven with
 * the case that would pass if the rule were missing.
 */
describe("which one of a pair the last edit wrote", () => {
  const eyes = ["eye@left", "eye@right"];

  it("names the side a scoped edit wrote, when the other side was never touched", () => {
    const left = row({ slot: "eye@left", words: ["green"], version: 2 });

    expect(instanceLastWritten([left], eyes)).toBe("eye@left");
  });

  it("names the side of the NEWEST divergence, not the first one", () => {
    /* Scoped left green, then scoped right blue. The composed delta says blue,
       and blue is a fact about her right eye alone. */
    const left = row({ slot: "eye@left", words: ["green"], version: 2 });
    const right = row({ slot: "eye@right", words: ["icy blue"], version: 3 });

    expect(instanceLastWritten([left, right], eyes)).toBe("eye@right");
  });

  it("names NOBODY when the pair matches — a whole-face edit wrote both", () => {
    const left = row({ slot: "eye@left", words: ["green"], version: 2 });
    const right = row({ slot: "eye@right", words: ["green"], version: 2 });

    expect(instanceLastWritten([left, right], eyes)).toBeNull();
  });

  it("names nobody when both sides diverge at the SAME version", () => {
    /* One render that wrote both sides differently is still one render's
       account of both sides, and the question it answers is whole-face. */
    const left = row({ slot: "eye@left", words: ["green"], version: 2 });
    const right = row({ slot: "eye@right", words: ["hazel"], version: 2 });

    expect(instanceLastWritten([left, right], eyes)).toBeNull();
  });

  it("names nobody on a face the library has never written", () => {
    expect(instanceLastWritten([], eyes)).toBeNull();
  });

  it("names nobody for a feature there is only one of", () => {
    const lips = row({ slot: "lips", words: ["a fuller cupid's bow"], version: 2 });

    expect(instanceLastWritten([lips], ["lips"])).toBeNull();
  });

  it("reads through the fold — a RETIRED newest row is not what the branch holds", () => {
    /* The rule that makes this a library question rather than a max() over
       rows: she took the left one back, so the pair matches again and nothing
       may claim one side of it. */
    const left = row({ slot: "eye@left", words: ["green"], version: 2, retiredAt: new Date() });

    expect(instanceLastWritten([left], eyes)).toBeNull();
  });
});

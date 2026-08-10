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

import { deriveLibrary, liveReferences, type StoredReference } from "./referenceLibrary";
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
    digest: `digest-${id}`,
    geometry: {
      bbox: { x: 0, y: 0, width: 10, height: 10 },
      frame: { width: 100, height: 100 },
    },
    guard: { kind: "hair", coverage: 9460, spill: 0, threshold: 9460 },
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
    The degenerate case, which is the road every new cast travels first: a face
    with no library at all assembles to the master and the ask alone.
  */
  it("is empty for a face nothing has been filed against", () => {
    expect(deriveLibrary([])).toEqual([]);
  });
});

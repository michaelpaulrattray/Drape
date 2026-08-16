/**
 * THE OLD-CHAIN GUARD (D-182).
 *
 * Every walk this program has done verified a FRESH candidate, and fresh
 * candidates are the one shape that cannot exhibit this defect. The founder's
 * real casts are legacy chains by definition, and so is every customer's after
 * any future migration.
 *
 * The fixtures below are the ACTUAL row shapes from the founder's verification
 * chain on production (candidate 1569), copied field for field — pre-split hair,
 * pre-split eyes, pre-items ink, no `stepDeltas` — plus a modern row. If a
 * future vocabulary change retires another subject, this file goes red before a
 * customer's chain does.
 */
import { describe, expect, it } from "vitest";

import { composeDeltas, readDelta } from "./refineDelta";
import { migrateStoredDelta, namesRetiredSubject, readStoredDelta } from "./refineLegacy";

/** Variant #2 — the first refinement, when hair was one slot. */
const ERA_PRE_SPLIT = { free: { hair: "mullet" } };

/** Variant #12 — the predecessor of the render that dropped everything. */
const ERA_PRE_ITEMS = {
  free: {
    ink: "chest tattoo of two swallows",
    eyes: "seafoam green",
    hair: "the colour of rosé",
    nose: "button nose",
    expression: "a warm open smile",
  },
  makeup: "soft smokey eye, glossy nude lip",
  eyeShape: "hooded",
  hairColour: "black",
};

/** Variant #71 — today's shape: one facet, per-step deltas beside it. */
const ERA_MODERN = { free: { hairShade: "pink" } };

describe("the strict reader still refuses these, and that is correct", () => {
  /*
    This is not a bug in `readDelta`. A MODEL REPLY with an unknown key is a
    reply to distrust — the vocabulary is closed and a new key is either a
    hallucination or a version skew. The defect was using that reader on our own
    stored history, and then treating its null as "there was nothing".
  */
  it("returns null for a whole delta when one subject has been retired", () => {
    expect(readDelta(ERA_PRE_SPLIT)).toBeNull();
    expect(readDelta(ERA_PRE_ITEMS)).toBeNull();
  });

  it("reads the modern shape unchanged", () => {
    expect(readDelta(ERA_MODERN)).not.toBeNull();
  });
});

describe("stored rows read through the shim", () => {
  it("recognises a retired subject without touching a modern row", () => {
    expect(namesRetiredSubject(ERA_PRE_ITEMS)).toBe(true);
    expect(namesRetiredSubject(ERA_MODERN)).toBe(false);
    /* Untouched means the same object, not a copy that happens to match. */
    expect(migrateStoredDelta(ERA_MODERN)).toBe(ERA_MODERN);
  });

  it("classifies the legacy hair slot by what the value says", () => {
    const cut = readStoredDelta({ free: { hair: "mullet" } });
    expect(cut?.free?.hairCut).toBe("mullet");

    const shade = readStoredDelta({ free: { hair: "the colour of rosé" } });
    expect(shade?.free?.hairShade).toBe("the colour of rosé");

    /* "Worn down" is styling, and it is the reason `hairWorn` exists at all. */
    const worn = readStoredDelta({ free: { hair: "worn down" } });
    expect(worn?.free?.hairWorn).toBe("worn down");
  });

  it("classifies the legacy eye slot the same way", () => {
    expect(readStoredDelta({ free: { eyes: "seafoam green" } })?.free?.eyeColourFree)
      .toBe("seafoam green");
    expect(readStoredDelta({ free: { eyes: "surgical fox eyes not makeup" } })?.free?.eyeShapeFree)
      .toBe("surgical fox eyes not makeup");
  });

  it("never lets a legacy slot overwrite a modern key that is already there", () => {
    const both = readStoredDelta({ free: { hair: "the colour of rosé", hairShade: "pink" } });
    expect(both?.free?.hairShade).toBe("pink");
  });

  it("reads a row from every era", () => {
    expect(readStoredDelta(ERA_PRE_SPLIT)).not.toBeNull();
    expect(readStoredDelta(ERA_PRE_ITEMS)).not.toBeNull();
    expect(readStoredDelta(ERA_MODERN)).not.toBeNull();
  });
});

/*
  THE OPEN LANE'S KINDS, AND THE TWO BOUNDARIES THAT MUST ANSWER DIFFERENTLY
  (`OPEN_LANE_DESIGN_NOTE.md` §8 steps 0 and 4).

  This module's header already draws the split for retired subjects — a model
  reply with an unknown key is a reply to distrust; a stored row with one is our
  own past. `open` arrives at the same fork for a second reason, and it is the
  more load-bearing of the two: the open lane is a FALLBACK, not a peer, and a
  reply free to name its own kind would route an ask into it before the closed
  lane ever declined.
*/
describe("an open kind is read from our own record and never from a reply", () => {
  const CAT_EARS = { open: { "cat-ears": { noun: "cat ears", words: "soft grey cat ears" } } };

  it("carries a stored open kind forward", () => {
    expect(readStoredDelta(CAT_EARS)?.open).toEqual({
      "cat-ears": { noun: "cat ears", words: "soft grey cat ears" },
    });
  });

  it("and the STRICT reader cannot see it at all — the boundary that stays shut", () => {
    /*
      THE HALF THAT MATTERS MOST. `readDelta` guards the door where a model's
      reply enters the record. If a reply may name its own kind, the interpreter
      can file *"give her wings"* as an open kind before the closed lane has
      declined, and wings stop being eyeliner — §8 step 0's one choice that
      cannot be retrofitted.

      An open kind is written by code, after `normalizeOpenKind` has been
      consulted and its answer checked against the closed vocabulary.

      Two arms, because one of them can pass for the wrong reason. A reply
      naming ONLY a kind reads as null — the field contributes nothing, so the
      delta is empty and *"an empty delta is not a delta"*. That alone would
      also pass if the reader rejected the row for having an unknown key, so the
      second arm puts a readable value beside it: the row is read, and the field
      is simply not in it.
    */
    expect(readDelta(CAT_EARS)).toBeNull();
    expect(readDelta({ ...CAT_EARS, free: { nose: "a narrower bridge" } }))
      .toEqual({ free: { nose: "a narrower bridge" } });
  });

  it("drops a key the library would refuse after the render was paid for", () => {
    /* `parseSlot` has no space in its grammar, so `open:cat ears` is
       `slotNotAFeatureSlot` at the database door — the defect the kebab
       conversion closed, re-entering through the stored record. */
    expect(readStoredDelta({ open: { "cat ears": { noun: "cat ears", words: "soft grey" } } })?.open)
      .toBeUndefined();
  });

  it("drops an entry with no noun, rather than leaving the key to be shown", () => {
    /* The noun is the only thing a customer may be shown, and the key is a
       token: a fallback would put `cat-ears` in a paid prompt. */
    expect(readStoredDelta({ open: { "cat-ears": { words: "soft grey cat ears" } } })?.open)
      .toBeUndefined();
    expect(readStoredDelta({ open: { "cat-ears": { noun: "cat ears" } } })?.open)
      .toBeUndefined();
  });

  it("PROMOTION: a kind the closed lane now owns moves into it", () => {
    /*
      The event has already happened once in this campaign — `horns` was an open
      kind and is a catalogued subject now. A branch that carried it across that
      day holds a record BOTH lanes answer for: the open loop paints
      `open:horns` from her words while the closed lane owns the noun. Two
      instructions about one feature, arriving through the record rather than
      through an ask, on a customer's face rather than in a fixture.

      A promotion is a vocabulary split pointed the other way, so it migrates in
      the same place and by the same rules as `hair` and `eyes` did.
    */
    const migrated = readStoredDelta({
      open: { horns: { noun: "horns", words: "horns curving back from her temples" } },
    });

    expect(migrated?.open).toBeUndefined();
    expect(migrated?.free?.horns).toEqual(["horns curving back from her temples"]);
  });

  it("and never overwrites a closed answer that is already there", () => {
    /* This file's existing rule, unchanged: the modern key already present
       WINS, because a newer write is the more recent statement and a stored
       open kind is by construction older than the promotion. */
    const migrated = readStoredDelta({
      open: { horns: { noun: "horns", words: "horns curving back from her temples" } },
      free: { horns: "short blunt horns" },
    });

    /* A list, because `horns` is plural — the promotion goes through the closed
       lane's own reader, so the value arrives in that lane's shape rather than
       as the bare string a promotion written onto the finished delta would
       leave. */
    expect(migrated?.free?.horns).toEqual(["short blunt horns"]);
    /*
      AND THE OPEN ENTRY IS GONE, which is the half that makes this arm mean
      anything. The line above is true of a row nothing happened to — with the
      promotion switched off entirely it still reads `short blunt horns`,
      because that is what the raw row already said. Found by sabotage, which is
      what a sabotage is for: an arm that cannot tell "the rule was respected"
      from "the rule never ran" is measuring the fixture.
    */
    expect(migrated?.open).toBeUndefined();
  });

  it("CONTROL — an unpromoted kind is left exactly where it is", () => {
    /* The half that must not move. A migration that pulled everything into the
       closed lane would pass the two arms above and quietly end the open lane. */
    const migrated = readStoredDelta({
      open: {
        horns: { noun: "horns", words: "horns curving back from her temples" },
        "cat-ears": { noun: "cat ears", words: "soft grey cat ears" },
      },
    });

    expect(migrated?.open).toEqual({ "cat-ears": { noun: "cat ears", words: "soft grey cat ears" } });
    expect(migrated?.free?.horns).toEqual(["horns curving back from her temples"]);
  });
});

describe("composing across the eras carries every fact it still holds", () => {
  /*
    THE FOUNDER'S RENDER, RE-RUN. Before the fix this composed to
    `{free: {hairShade: "pink"}}` — one fact out of nine — and the picture was
    exactly what that prompt asked for.
  */
  const composed = composeDeltas([readStoredDelta(ERA_PRE_ITEMS)!, ERA_MODERN]);

  it("carries the facts the predecessor still held", () => {
    expect(composed.eyeShape).toBe("hooded");
    expect(composed.makeup).toBe("soft smokey eye, glossy nude lip");
    expect(composed.free?.eyeColourFree).toBe("seafoam green");
    expect(composed.free?.nose).toBe("button nose");
    expect(composed.free?.expression).toBe("a warm open smile");
    expect(composed.free?.ink).toEqual(["chest tattoo of two swallows"]);
  });

  it("supersedes the hair colour rather than accumulating three of them", () => {
    expect(composed.free?.hairShade).toBe("pink");
    expect(JSON.stringify(composed)).not.toContain("rosé");
    /* `black` was the guaranteed-lane answer for the same facet, and the new
       free-lane pink has to clear it or the prompt asks for both. */
    expect(composed.hairColour).toBeUndefined();
  });

  it("keeps a cut and a colour apart, which the single slot could not", () => {
    /* The mullet died at variant #5, when "hair the colour of rosé" overwrote
       "mullet" in the one slot they shared — the loss that caused the split.
       With the slots separate, both survive. */
    const kept = composeDeltas([
      readStoredDelta({ free: { hair: "mullet" } })!,
      readStoredDelta({ free: { hair: "the colour of rosé" } })!,
    ]);
    expect(kept.free?.hairCut).toBe("mullet");
    expect(kept.free?.hairShade).toBe("the colour of rosé");
  });
});

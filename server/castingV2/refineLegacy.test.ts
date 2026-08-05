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

import { describe, expect, it } from "vitest";

import { previewKeyOf, sheetPreviewKeys } from "./sheetPreview";

/**
 * The faces on an unsigned sheet's card.
 *
 * Pinned because this rule has now been wrong twice, and both times the card
 * rendered something plausible while lying about the sheet behind it — which is
 * the class of bug review never catches, because nothing looks broken.
 */

let nextId = 1;
const ready = (key = `img-${nextId}.png`) => ({
  id: nextId++,
  status: "ready",
  imageKey: key,
  thumbKey: null,
});

describe("a sheet card previews what is on the sheet", () => {
  it("leads with the kept faces and backfills from the latest roll", () => {
    /*
      The founder's report: one keep read as an empty sheet. The old rule was
      either/or — kept faces if there were any, the roll otherwise — so a single
      shortlisted face filled one of four slots and left three holes. The card
      was punishing the owner for shortlisting.
    */
    const kept = [ready("kept-a.png")];
    const roll = [ready("roll-a.png"), ready("roll-b.png"), ready("roll-c.png")];

    expect(sheetPreviewKeys(kept, roll)).toEqual([
      "kept-a.png",
      "roll-a.png",
      "roll-b.png",
      "roll-c.png",
    ]);
  });

  it("never shows the same face twice", () => {
    /*
      A kept candidate is usually ALSO in the latest roll, so a naive
      concatenation would show her twice and make the sheet look emptier than it
      is — the exact failure the blend was meant to fix, reintroduced by it.
    */
    const shared = ready("shared.png");
    const other = ready("other.png");

    expect(sheetPreviewKeys([shared], [shared, other])).toEqual([
      "shared.png",
      "other.png",
    ]);
  });

  it("falls back to the roll when nothing is kept", () => {
    expect(sheetPreviewKeys([], [ready("only.png")])).toEqual(["only.png"]);
  });

  it("still previews when the kept faces cannot be projected", () => {
    /*
      The Sign regression: after signing from a sheet, the card went blank —
      "3 rolls · 1 kept" above an empty strip. The kept list was non-empty but
      yielded no projectable face, and the fallback was applied to the SOURCE
      rather than to the result. Concatenation fixes it structurally: an
      unprojectable kept row simply contributes nothing and the roll fills in.
    */
    const signedKeep = { id: 900, status: "signed", imageKey: "gone.png", thumbKey: null };
    expect(sheetPreviewKeys([signedKeep], [ready("roll.png")])).toEqual(["roll.png"]);
  });

  it("stops at the strip's width", () => {
    const many = Array.from({ length: 8 }, () => ready());
    expect(sheetPreviewKeys([], many)).toHaveLength(4);
  });

  it("prefers a thumbnail but never requires one", () => {
    /*
      The first version filtered on `thumbKey` alone and every real card was
      empty: the thumbnail worker is deferred scope (§G.6), so that column is
      null in production and always has been. Filtering on a field nothing
      populates is the same mistake as a control that is never called.
    */
    expect(previewKeyOf({ id: 1, status: "ready", imageKey: "full.png", thumbKey: "thumb.png" }))
      .toBe("thumb.png");
    expect(previewKeyOf({ id: 2, status: "ready", imageKey: "full.png", thumbKey: null }))
      .toBe("full.png");
    // And a candidate that never landed contributes nothing at all.
    expect(previewKeyOf({ id: 3, status: "casting", imageKey: "early.png", thumbKey: null }))
      .toBeNull();
  });
});

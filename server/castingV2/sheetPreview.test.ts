import { describe, expect, it } from "vitest";

import { previewKeyOf, previewStateOf, sheetPreviewKeys, sheetPreviewTiles } from "./sheetPreview";

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
  faceImageKey: key,
  faceThumbKey: null,
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
    const signedKeep = { id: 900, status: "signed", faceImageKey: "gone.png", faceThumbKey: null };
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
    expect(previewKeyOf({ id: 1, status: "ready", faceImageKey: "full.png", faceThumbKey: "thumb.png" }))
      .toBe("thumb.png");
    expect(previewKeyOf({ id: 2, status: "ready", faceImageKey: "full.png", faceThumbKey: null }))
      .toBe("full.png");
    // And a candidate that never landed contributes nothing at all.
    expect(previewKeyOf({ id: 3, status: "casting", faceImageKey: "early.png", faceThumbKey: null }))
      .toBeNull();
  });
});

/**
 * THE STATES ON THE CARD (his bug, #1086).
 *
 * *"when you start a roll off a sheet and exit out before anything generates
 * the card on unsigned sheets needs to appear instantly and show some sort of
 * loading state, additionally rolls that fail ... should still show preview
 * cards just cards relevant to the state"*.
 *
 * Every arm here failed before the change: `ready` was the only status that
 * projected anything at all, so each of these sheets rendered an empty strip
 * under a line saying how many rolls it had.
 */
const at = (id: number, status: string, failureClass: string | null = null) => ({
  id,
  status,
  faceImageKey: null,
  faceThumbKey: null,
  failureClass,
});

describe("a sheet card shows the state of the sheet, not only its faces", () => {
  it("shows a roll still being cast as frames being cast", () => {
    // The exact case he described: start a roll, leave before anything lands.
    const roll = [at(1, "queued"), at(2, "dispatched"), at(3, "queued"), at(4, "queued")];
    expect(sheetPreviewTiles([], roll)).toEqual([
      { kind: "pending" },
      { kind: "pending" },
      { kind: "pending" },
      { kind: "pending" },
    ]);
  });

  it("tells a content refusal from everything else that did not arrive", () => {
    /*
      The screenshot's sheet — the young woman sci-fi android — whose latest
      roll was refused and whose card was therefore blank. The two words are
      different because the answers are: one is the engine's filter saying no
      to these words, the other is a failure that says nothing about them.
    */
    const roll = [at(1, "failed", "content_policy"), at(2, "failed", "timeout"), at(3, "failed", null)];
    expect(sheetPreviewTiles([], roll)).toEqual([
      { kind: "refused" },
      { kind: "failed" },
      { kind: "failed" },
    ]);
  });

  it("lets faces take every slot before a state does", () => {
    /*
      The rule that keeps this change a strict addition: a partially refused
      roll shows the faces it has, exactly as it does today, and only fills
      what is LEFT with states. A grey frame never displaces a picture because
      it happens to sit at an earlier position.
    */
    const roll = [
      at(1, "failed", "content_policy"),
      ready("a.png"),
      at(3, "failed", "engine"),
      ready("b.png"),
      ready("c.png"),
    ];
    expect(sheetPreviewTiles([], roll)).toEqual([
      { kind: "face", key: "a.png" },
      { kind: "face", key: "b.png" },
      { kind: "face", key: "c.png" },
      { kind: "refused" },
    ]);
  });

  it("stays silent about the states that are the owner's own doing, or gone", () => {
    /*
      Four statuses that deliberately draw nothing, each for its own reason:
      discarded and cancelled are the owner's decisions and a grey frame would
      argue with them; signed has left the sheet for the roster; expired DID
      arrive and was swept afterwards, so every word this strip has would be
      false of it.
    */
    for (const status of ["discarded", "cancelled", "signed", "expired"]) {
      expect(previewStateOf(at(1, status))).toBeNull();
    }
    expect(sheetPreviewTiles([], [at(1, "discarded"), at(2, "expired")])).toEqual([]);
  });

  it("never draws more than the strip holds, whatever the mixture", () => {
    const roll = [ready("a.png"), ready("b.png"), at(90, "queued"), at(91, "queued"), at(92, "failed")];
    expect(sheetPreviewTiles([], roll)).toHaveLength(4);
  });

  it("does not show a kept face a second time as a state", () => {
    /*
      The dedupe has to survive the second pass too: a candidate that led the
      strip as a face must not come back as a frame in the backfill.
    */
    const shared = ready("kept.png");
    const tiles = sheetPreviewTiles([shared], [shared, at(70, "queued")]);
    expect(tiles).toEqual([{ kind: "face", key: "kept.png" }, { kind: "pending" }]);
  });

  it("keeps the faces-only view exactly as it was", () => {
    /*
      `sheetPreviewKeys` is what the previous bundle reads for one more deploy.
      It is DERIVED from the tiles now, so this arm is the proof that deriving
      it did not change a single card: states contribute nothing to it.
    */
    const roll = [at(1, "queued"), ready("a.png"), at(3, "failed", "content_policy"), ready("b.png")];
    expect(sheetPreviewKeys([], roll)).toEqual(["a.png", "b.png"]);
  });
});

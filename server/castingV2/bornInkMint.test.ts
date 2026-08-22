/**
 * THE ROW A BORN-WITH-INK CAST GETS — 7b(a).
 *
 * The specimen is production roll 129's brief, VERBATIM, everywhere it appears:
 * *"Bare-chested, displaying extensive black-and-grey ornamental tattoos
 * covering most of his chest, shoulders, upper arms, and lower neck."* A
 * reworded specimen is a different specimen, and this feature has no living
 * population at all — both rolls that named ink have zero surviving candidates
 * — so the brief is the only real thing here.
 *
 * The arms that matter are the ones that would fail if somebody made this
 * writer reachable from a refine, if the failure started costing a customer her
 * face, or if the fallback went silent.
 */
import { describe, expect, it, vi } from "vitest";

import {
  BORN_INK_NOT_RECORDED,
  BORN_INK_NOUN,
  BORN_INK_REGION_UNREAD,
  bornInkRows,
  mintBornInkRows,
} from "./bornInkMint";
import type { StatedInk } from "./castingIntent";
import { BODY_ANCHOR_REGIONS } from "../../shared/bodyAnchorRegions";
import { assertReferenceRowShape } from "../db/castingV2ReferenceLibrary";

const BRIEF_WORDS = [
  "extensive black-and-grey ornamental tattoos",
];

const stated = (over: Partial<StatedInk> = {}): StatedInk => ({
  words: BRIEF_WORDS,
  regions: ["torso", "arms"],
  readFailed: false,
  ...over,
});

describe("the rows a described reading becomes", () => {
  it("files ONE row per described region, keyed by the region", () => {
    const rows = bornInkRows(stated());
    expect(rows.map((row) => row.slot)).toEqual(["bornInk:torso", "bornInk:arms"]);
  });

  it("carries her own words on every one of them", () => {
    /* Each row records what the brief said about ink at that place, and the
       brief said one thing about all of them. Stated in the source; asserted
       here so the day something reads them nobody has to guess. */
    for (const row of bornInkRows(stated())) expect(row.words).toEqual(BRIEF_WORDS);
  });

  it("is a SURFACE — words only, always — and never the ink lane's `item`", () => {
    /*
      `item`'s own reason is "she did not arrive with it, the master does not
      hold it, and it arrives through an edit carrying its own picture". Every
      clause of that is false for a cast BORN with tattoos. `surface` is the
      tier the vocabulary describes as words-only, and it is the one that makes
      the recipe say "his tattoos" rather than "the tattoos".
    */
    for (const row of bornInkRows(stated())) {
      expect(row.tier).toBe("surface");
      expect(row.role).toBe("carry");
      expect(row.noun).toBe(BORN_INK_NOUN);
      expect(row.image, "7b-i records and discloses; it does not mint pixels").toBeUndefined();
      expect(row.refusal, "nothing was cut, so nothing was turned away").toBeUndefined();
    }
  });

  it("produces rows the LIBRARY'S OWN DOOR accepts, for every region", () => {
    /*
      Driven through `assertReferenceRowShape` rather than eyeballed: the door
      is what a real write runs, and the open lane has already paid once for a
      key that resolved upstream and was refused at this door AFTER the render
      was paid for.
    */
    for (const region of BODY_ANCHOR_REGIONS) {
      const rows = bornInkRows(stated({ regions: [region] }));
      expect(rows).toHaveLength(1);
      expect(() => assertReferenceRowShape(rows[0]!), `${region} must pass the door`).not.toThrow();
    }
  });

  it("writes nothing at all for the ordinary brief", () => {
    expect(bornInkRows(null)).toEqual([]);
    /* And a reading with no words is no reading — `parseStatedInk` cannot
       produce one, and this refuses it anyway rather than filing a row that
       claims something about her body with nothing she said underneath. */
    expect(bornInkRows({ words: [], regions: ["torso"], readFailed: false })).toEqual([]);
  });
});

describe("the write, and what it may never cost her", () => {
  const input = {
    userId: 7,
    candidateId: 42,
    rollPublicId: "roll-129",
    candidatePublicId: "cand-abc",
  };

  it("records the rows against the candidate's own MASTER, not a variant", () => {
    const record = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    return mintBornInkRows({ ...input, statedInk: stated() }, { record }).then((result) => {
      expect(result).toEqual({ written: 2, failed: false });
      const call = record.mock.calls[0]![0];
      /* `variantId: null` is the master's own mark, and it is what the panel
         already reads as "she came with it" — which is exactly what a cast born
         with tattoos is. */
      expect(call.variantId).toBeNull();
      expect(call.candidateId).toBe(42);
      expect(call.userId).toBe(7);
      /* Words-only rows write no objects, so there is nothing for a manifest to
         hold. Passing one would be a reservation with nothing to discharge. */
      expect(call.cleanupBatchId).toBeUndefined();
    });
  });

  it("⚠ HER CANDIDATE BEATS OUR RECORD — a failed write never throws", async () => {
    /*
      She paid for a face and it landed. `dispatchCandidate` awaits this INSIDE
      the try that refunds her slice, so a throw here would fail and refund a
      candidate she can already see. The trade is stated in the header; this is
      the arm that keeps it true.
    */
    const record = vi.fn().mockRejectedValue(new Error("the database went away"));
    await expect(mintBornInkRows({ ...input, statedInk: stated() }, { record }))
      .resolves.toEqual({ written: 0, failed: true });
  });

  it("does not touch the database at all for a brief that named no ink", async () => {
    const record = vi.fn();
    await expect(mintBornInkRows({ ...input, statedInk: null }, { record }))
      .resolves.toEqual({ written: 0, failed: false });
    expect(record, "the ordinary roll is unchanged, including its statement count").not.toHaveBeenCalled();
  });
});

describe("the two things that must be countable rather than anecdotal", () => {
  /*
    Both are the same failure shape with different owners: a writer that starts
    failing routinely, and a reader that starts falling back routinely. Either
    one silently stops a born cast disclosing what it is, and the inert-control
    lesson is that a control nobody can count is a control nobody notices
    breaking (condition of fable-1412 (b); fable-1381 ruling 2's "not silence").
  */
  it("names its reasons as single greppable strings, spelled once", () => {
    expect(BORN_INK_NOT_RECORDED).toBe("bornInkNotRecorded");
    expect(BORN_INK_REGION_UNREAD).toBe("bornInkRegionUnread");
  });

  it("a failed region read still files the row, at wholeBody, rather than nothing", async () => {
    /*
      fable-1381 ruling 2: over-inclusive is never WRONG about where the ink is;
      a silent fallback is how a bad reader hides for six months. The provenance
      lives with the reading (`compiledBrief.intent.statedInk.readFailed`) and is
      counted at the moment it decides a row.
    */
    const record = vi.fn().mockResolvedValue([{ id: 1 }]);
    const fallen = stated({ regions: ["wholeBody"], readFailed: true });
    await mintBornInkRows({
      userId: 7, candidateId: 42, rollPublicId: "roll-129", candidatePublicId: "cand-abc",
      statedInk: fallen,
    }, { record });
    expect(record.mock.calls[0]![0].rows.map((row: { slot: string }) => row.slot))
      .toEqual(["bornInk:wholeBody"]);
  });
});

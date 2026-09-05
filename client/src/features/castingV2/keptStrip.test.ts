import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { visibleShortlist, type StripCandidate, type StripEntry } from "./keptStrip";

/**
 * #554 — THE TILE PAINTED AND THE DOCK DID NOT.
 *
 * The founder, with a frame of his own sheet: *"if i click keep on a cast tile
 * it can take around 2 seconds to show up in the prompt box."* The tile's ring
 * was optimistic; the dock's strip read the server's list. Two views of one
 * fact, drifting for as long as the network took.
 *
 * Every arm has its opposite beside it. An overlay that added everything would
 * satisfy "she appears" and fill the tray with faces nobody kept; one that
 * added nothing would satisfy the removal arms and leave the defect exactly as
 * it was.
 */

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

function entry(id: string, label: string, rollIndex = 1): StripEntry {
  return {
    candidateId: id,
    thumbUrl: `https://cdn.example/${id}-thumb.jpg`,
    imageUrl: `https://cdn.example/${id}.jpg`,
    personaLine: null,
    sourceRollIndex: rollIndex,
    indexLabel: label,
  };
}

function candidate(
  id: string,
  label: string,
  status: StripCandidate["status"] = "ready",
): StripCandidate {
  return {
    candidateId: id,
    indexLabel: label,
    imageUrl: `https://cdn.example/${id}.jpg`,
    thumbUrl: `https://cdn.example/${id}-thumb.jpg`,
    personaLine: null,
    status,
  };
}

const BASE = {
  shortlist: [] as StripEntry[],
  candidates: [] as StripCandidate[],
  rollIndex: 2,
  optimisticKept: {} as Record<string, boolean>,
  optimisticDiscarded: {} as Record<string, true>,
};

describe("a keep reaches the dock on the click", () => {
  it("adds the face the user just kept, before the server has answered", () => {
    /* The fix. This is what the two seconds were. */
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("a", "03")],
      candidates: [candidate("a", "03"), candidate("b", "08")],
      optimisticKept: { b: true },
    });
    expect(strip.map((row) => row.candidateId)).toEqual(["a", "b"]);
  });

  it("puts her LAST, which is what makes her the Sign target", () => {
    /*
      Not cosmetic. `signTargets` reverses this list to aim the dock, so the
      newest keep is the face the button offers. Prepending would arm the
      OLDEST kept face on a 450-credit ceremony.
    */
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("a", "03"), entry("b", "05")],
      candidates: [candidate("c", "08")],
      optimisticKept: { c: true },
    });
    expect(strip[strip.length - 1]?.candidateId).toBe("c");
  });

  it("labels her with the roll she is actually on", () => {
    /* The tray prints "ROLL 02"; a wrong index is a face filed under a roll
       she was never cast in. */
    const strip = visibleShortlist({
      ...BASE,
      rollIndex: 7,
      candidates: [candidate("c", "08")],
      optimisticKept: { c: true },
    });
    expect(strip[0]?.sourceRollIndex).toBe(7);
    expect(strip[0]?.indexLabel).toBe("08");
    expect(strip[0]?.thumbUrl).toBe("https://cdn.example/c-thumb.jpg");
  });

  it("does not invent a tray from an untouched sheet", () => {
    /*
      The negative control for the whole overlay: with nothing clicked, the
      strip is the server's list and nothing else.
    */
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("a", "03")],
      candidates: [candidate("a", "03"), candidate("b", "08")],
    });
    expect(strip.map((row) => row.candidateId)).toEqual(["a"]);
  });

  it("never lists her twice once the server agrees", () => {
    /*
      The flag is NOT cleared on success, so for the rest of the sheet's life
      she is both in the server's shortlist and flagged optimistically kept.
    */
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("b", "08")],
      candidates: [candidate("b", "08")],
      optimisticKept: { b: true },
    });
    expect(strip.map((row) => row.candidateId)).toEqual(["b"]);
  });
});

describe("un-keeping and discarding remove her on the click too", () => {
  it("drops a face the user just un-kept", () => {
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("a", "03"), entry("b", "05")],
      optimisticKept: { a: false },
    });
    expect(strip.map((row) => row.candidateId)).toEqual(["b"]);
  });

  it("drops a face the user just discarded", () => {
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("a", "03"), entry("b", "05")],
      optimisticDiscarded: { b: true },
    });
    expect(strip.map((row) => row.candidateId)).toEqual(["a"]);
  });

  it("distinguishes 'not touched' from 'un-kept'", () => {
    /*
      The reason the filter tests `!== false` rather than truthiness. An absent
      entry means the user has not touched this face — reading that as unkept
      would empty the tray on every fresh load.
    */
    const strip = visibleShortlist({ ...BASE, shortlist: [entry("a", "03")] });
    expect(strip).toHaveLength(1);
  });

  it("does not re-add a face that was un-kept and is still on the roll", () => {
    /* The two rules meeting: removal must win over the addition path. */
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [entry("a", "03")],
      candidates: [candidate("a", "03")],
      optimisticKept: { a: false },
    });
    expect(strip).toEqual([]);
  });
});

describe("a signed face does not come back", () => {
  it("stays out of the tray after she is signed", () => {
    /*
      ⚠ THE ARM THAT PAYS FOR THE `ready` NARROWING, and it is not defensive.

      `optimisticKept` is dropped only on failure and undo, so it stays `true`
      for the life of the sheet. When she is SIGNED, the server's loader stops
      sending her (`listKeptCandidates` filters `status = 'ready'` — fable-744
      §3b). She therefore leaves the shortlist, `present` no longer holds her,
      and a status-blind overlay would ADD HER BACK from the stale flag: a
      450-credit purchase reappearing in the tray she graduated out of, and
      re-enterable as a Sign target.
    */
    const strip = visibleShortlist({
      ...BASE,
      shortlist: [],
      candidates: [candidate("b", "08", "signed")],
      optimisticKept: { b: true },
    });
    expect(strip).toEqual([]);
  });

  it("keeps a still-casting or failed face out as well", () => {
    const casting = visibleShortlist({
      ...BASE,
      candidates: [candidate("b", "08", "casting")],
      optimisticKept: { b: true },
    });
    const failed = visibleShortlist({
      ...BASE,
      candidates: [candidate("b", "08", "failed-refunded")],
      optimisticKept: { b: true },
    });
    expect([casting, failed]).toEqual([[], []]);
  });
});

describe("the derivation is wired, not merely present", () => {
  /*
    Invariant 7. Every arm above passes with this module imported by nothing —
    the two seconds would still be there and the suite would still be green.
  */
  it("feeds the strip, the count and the Sign target from ONE list", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("visibleShortlist({");
    // The tray draws it.
    expect(sheet).toMatch(/shortlist=\{keptStrip\}/);
    // The count reads the same list — it said "1 kept" beside two thumbnails.
    expect(sheet).toMatch(/\{keptStrip\.length\} kept/);
    // And the ceremony is aimed at it, or the ring and the target disagree.
    expect(sheet).toContain("signTargets(keptStrip)");
  });

  it("no longer aims any of the three at the raw server list", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).not.toContain("signTargets(shortlist)");
    expect(sheet).not.toMatch(/shortlist=\{shortlist\}/);
    expect(sheet).not.toMatch(/\{shortlist\.length\} kept/);
  });
});

/**
 * THE TWO KEY SPACES, KEPT APART — and divergence proven to be derived.
 *
 * The tests that matter here are the ones that would fail if somebody
 * "unified" the library key with the ledger key, and the one that would fail if
 * somebody cached divergence in a flag. Both are cheap to write today and
 * expensive to discover in a panel that says "her earrings" about two things
 * that are no longer a pair.
 */
import { describe, expect, it } from "vitest";

import { isFeatureSlot, pairHasDiverged, parseSlot, presentPair, slotKey } from "./referenceSlots";

describe("a library key is a feature slot, and a ledger key is not one", () => {
  it("parses the slots the panel actually has", () => {
    expect(parseSlot("hair")).toEqual({ feature: "hair" });
    expect(parseSlot("eye@left")).toEqual({ feature: "eye", instance: "left" });
    expect(parseSlot("earring@right")).toEqual({ feature: "earring", instance: "right" });
    expect(slotKey("earring", "left")).toBe("earring@left");
    expect(slotKey("hair")).toBe("hair");
  });

  it("REFUSES the ledger's keys, which is the entire point of the closed suffix", () => {
    /* These are real production keys. They look exactly like slots and they
       answer a different question — which instruction wrote these pixels. */
    expect(parseSlot("makeup@face skin")).toBeNull();
    expect(parseSlot("makeup@lips")).toBeNull();
    expect(parseSlot("marks@face skin")).toBeNull();
    expect(parseSlot("hairWorn@hair")).toBeNull();
    expect(parseSlot("eye.colour@eyes")).toBeNull();
    expect(isFeatureSlot("makeup@face skin")).toBe(false);
  });

  it("REFUSES the malformed rather than repairing it", () => {
    expect(parseSlot("")).toBeNull();
    expect(parseSlot(" hair")).toBeNull();
    expect(parseSlot("@left")).toBeNull();
    expect(parseSlot("eye@middle")).toBeNull();
    expect(parseSlot("eye@LEFT")).toBeNull();
  });
});

describe("divergence is derived from the instances, never held beside them", () => {
  const pair = (left: string[], right: string[]) => ({
    feature: "earring", left: { words: left }, right: { words: right },
  });

  it("a matched pair is one thing, and is spoken about as one", () => {
    const presentation = presentPair(pair(["a gold hoop"], ["a gold hoop"]), {
      paired: "her earrings", left: "the earring on her left ear", right: "the earring on her right ear",
    });
    expect(presentation.diverged).toBe(false);
    expect(presentation.rows).toEqual([{ key: "earring", noun: "her earrings" }]);
  });

  it("an edit to one instance splits the row, with no flag to set", () => {
    const presentation = presentPair(pair(["a gold hoop", "noticeably bigger"], ["a gold hoop"]), {
      paired: "her earrings", left: "the earring on her left ear", right: "the earring on her right ear",
    });
    expect(presentation.diverged).toBe(true);
    expect(presentation.rows.map((row) => row.key)).toEqual(["earring@left", "earring@right"]);
  });

  it("and it RE-MERGES when they are made matching again, with no flag to clear", () => {
    /* The whole reason divergence is derived. A cached flag would still say
       "these differ" here, and the panel would go on showing two rows for one
       pair until somebody noticed by eye. */
    const diverged = pair(["a gold hoop", "bigger"], ["a gold hoop"]);
    expect(pairHasDiverged(diverged)).toBe(true);
    const remerged = pair(["a gold hoop", "bigger"], ["a gold hoop", "bigger"]);
    expect(pairHasDiverged(remerged)).toBe(false);
    expect(presentPair(remerged, { paired: "her earrings", left: "l", right: "r" }).rows).toHaveLength(1);
  });

  it("order counts — the same words in a different order is a different look", () => {
    expect(pairHasDiverged(pair(["a gold hoop", "bigger"], ["bigger", "a gold hoop"]))).toBe(true);
  });

  it("does NOT derive divergence from pixels", () => {
    /*
      Two crops of two ears are never byte-identical even when the earrings are
      a matched pair — different light, different occlusion, different hair
      crossing them. A pixel comparison would report every pair as diverged,
      which is the answer that flatters the machine and fails the stylist.
    */
    const matched = {
      feature: "earring",
      left: { words: ["a gold hoop"], carryDigest: "aaaa" },
      right: { words: ["a gold hoop"], carryDigest: "bbbb" },
    };
    expect(pairHasDiverged(matched)).toBe(false);
  });
});

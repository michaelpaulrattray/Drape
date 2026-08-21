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

import { accessoryKindOfSlot } from "./slotWordShape";

import {
  INK_SLOT_PREFIX,
  inkPlacementOfSlot,
  inkSideSlotKey,
  inkSlotKey,
  isFeatureSlot,
  isInkSlot,
  isOpenSlot,
  openSlotKey,
  pairHasDiverged,
  parseSlot,
  presentPair,
  slotKey,
} from "./referenceSlots";

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

/*
  THE INK NAMESPACE — a second lane on the same `:` separator, and the tests
  that matter are the ones that would fail if the two lanes could be confused
  for each other or for the closed grammar.
*/
describe("the ink lane's keys", () => {
  it("composes rather than concatenates — no call site spells the prefix", () => {
    expect(inkSlotKey("neck")).toBe("ink:neck");
    expect(inkSideSlotKey("upperArm", "left")).toBe("ink:upperArm@left");
    /* The composition is literally the two owners in order, which is what
       stops a hand-written key from drifting from the parser. */
    expect(inkSideSlotKey("upperArm", "right")).toBe(slotKey(inkSlotKey("upperArm"), "right"));
    expect(inkSlotKey("neck").startsWith(INK_SLOT_PREFIX)).toBe(true);
  });

  it("round-trips the placement and the side", () => {
    expect(inkPlacementOfSlot("ink:neck")).toEqual({ placement: "neck", side: null });
    expect(inkPlacementOfSlot("ink:upperArm@left"))
      .toEqual({ placement: "upperArm", side: "left" });
    expect(inkPlacementOfSlot("ink:upperArm@right"))
      .toEqual({ placement: "upperArm", side: "right" });
    /* Her own word for a surface nobody measured parses the same way — the
       grammar is about the KEY, and the vocabulary is asked one layer along. */
    expect(inkPlacementOfSlot("ink:sleeve")).toEqual({ placement: "sleeve", side: null });
  });

  it("refuses a suffix outside the closed two-member instance list", () => {
    /* The one rule the whole grammar rests on. If `centre` ever parsed here,
       `earring@centre` would parse too and the closed grammar is breached in
       the place the separator argument exists to protect. */
    expect(inkPlacementOfSlot("ink:upperArm@centre")).toBeNull();
    expect(inkPlacementOfSlot("ink:upperArm@both")).toBeNull();
  });

  it("answers null for anything outside the namespace", () => {
    expect(inkPlacementOfSlot("neck")).toBeNull();
    expect(inkPlacementOfSlot("open:horns")).toBeNull();
    expect(inkPlacementOfSlot("hair")).toBeNull();
  });

  /*
    THE TWO LANES CANNOT BE CONFUSED, and this is the arm that would catch it.

    Both ride `:` and both are recognised before `parseSlot`. If either
    predicate ever answered for the other's key, an ink design would resolve as
    an open kind — which mints into the library, which is the one thing
    fable-1137 §3 forbids.
  */
  it("is disjoint from the open lane, both ways", () => {
    expect(isInkSlot("ink:neck")).toBe(true);
    expect(isOpenSlot("ink:neck")).toBe(false);
    expect(isInkSlot(openSlotKey("horns"))).toBe(false);
    expect(isOpenSlot(openSlotKey("horns"))).toBe(true);
    /* And neither claims a closed key. */
    expect(isInkSlot("hair")).toBe(false);
    expect(isOpenSlot("hair")).toBe(false);
  });

  /*
    AND THE CLOSED GRAMMAR STILL READS AN INK KEY AS A PLAIN FEATURE, which is
    the fact the library door had to be told about.

    It is asserted here rather than assumed, because it is the reason
    `slotNeverEntersTheLibrary` needs a line of its own: `parseSlot` does NOT
    refuse `ink:neck`, so a door that only asked the grammar would admit it.
    If this ever starts returning null, that door has a second, silent reason
    and the sabotage that proves it would stop proving anything.
  */
  it("is NOT refused by the closed grammar — which is why the door is explicit", () => {
    expect(parseSlot("ink:neck")).toEqual({ feature: "ink:neck" });
    expect(isFeatureSlot("ink:neck")).toBe(true);
    /* A spaced placement is the one shape the grammar does refuse. */
    expect(parseSlot("ink:left forearm")).toBeNull();
  });

  /*
    ⚠ AND EVERY OTHER READER OF THE GRAMMAR, ANSWERING BY DECISION RATHER THAN
    BY ACCIDENT — working law 7's first half, discharged (ordered fable-1293
    §2a: *teach the reader, then sweep for a THIRD reader before closing*).

    `facetsOfSlot` was the second reader and it was found answering `null` for
    an ink key by accident, which cost the scoped narrowing its facet list. The
    sweep for the rest of them is this arm. It is modelled on the open lane's
    own — `openLanePinning.test.ts`'s *"leaves the other slot-keyed readers
    refusing rather than guessing"* — because the two namespaces have the same
    problem and should not be answered in two styles.

    THE FOUR READERS AND THEIR ANSWERS, each pinned so a later hand cannot move
    one without meeting a red test:

      slotDefinition      RESOLVES it (fable-1137 §2a's branch)
      facetsOfSlot        RESOLVES it (this shift) — pinned in the catalogue's
                          own suite, beside the rejections it shares
      accessoryKindOfSlot NULL, and it is REACHED: `slotWordsRefusal` runs it
                          on every slot including an ink one. A tattoo is not a
                          worn accessory, so null is the right answer and this
                          line is what makes it a decision
      parseSlot.instance  the SIDE, which `referenceMint` reads to know which
                          half of a pair a spec is about — correct, and the one
                          reader that needed no teaching because the instance
                          suffix is genuinely the closed grammar's

    ONE READER IS DELIBERATELY ABSENT and its absence is the interesting half:
    `viewFeatureWords.regionForSlot` knows the OPEN namespace and has never
    heard of this one. It is not taught here because it CANNOT receive an ink
    key — its entries come from `deriveLibrary(rows)`, and the library write
    door refuses an ink slot by name (`slotNeverEntersTheLibrary`, pinned in
    `castingV2ReferenceLibrary.test.ts`). That is unreachable BY A TESTED DOOR
    rather than by luck, which is the only kind of unreachable this campaign
    accepts — and the day ink is allowed a library row is the day that reader
    needs its branch.
  */
  it("answers in every OTHER reader of the grammar by decision, not by accident", () => {
    for (const key of ["ink:neck", "ink:upperArm@left", "ink:sleeve"]) {
      expect(accessoryKindOfSlot(key), `${key} — a tattoo is not a worn accessory`).toBeNull();
    }
    /* The side is the closed grammar's own suffix and reads straight through,
       which is what `referenceMint`'s `instanceOf` depends on. */
    expect(parseSlot("ink:upperArm@left")?.instance).toBe("left");
    expect(parseSlot("ink:upperArm@right")?.instance).toBe("right");
    expect(parseSlot("ink:neck")?.instance).toBeUndefined();
    /* The negative control kept after the positive: a real accessory slot must
       still answer, or this arm would pass with the reader broken outright. */
    expect(accessoryKindOfSlot("earring@left")).not.toBeNull();
  });
});

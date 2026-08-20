/**
 * WHICH DESIGN AN ASK MEANS — every refusal driven directly.
 *
 * Working law 3's own case: these are exactly the refusals a suite would
 * otherwise "prove" by never triggering them. A planted two-design placement is
 * one line here and a database somewhere else, so they are driven here.
 *
 * The arm carrying the most weight is the CONFLICT one, because the answer it
 * asserts is the one nobody would have chosen by default: a road that rode the
 * design already at the address would pass every other test in this file and
 * paint a different artwork onto her.
 *
 * # THE FIXTURE FAMILY IS DELIBERATELY MIXED (fable-1150 §1)
 *
 * A family that shares one property tests that property once, and the property
 * that could hide here is WHERE A ROW CAME FROM. So there are two makers —
 * {@link uploaded} for a design she handed us through the studio door
 * (`sourceDigest: null`) and {@link takenFrom} for one cut out of a picture —
 * and the arms below use both. A file that only ever built one kind would
 * "prove" the reuse rule against rows that could not fail it.
 */
import { describe, expect, it } from "vitest";

import { inkDesignForAsk, slotPlacementOf } from "./inkDesignForAsk";
import { slotDefinition } from "./referenceSlotCatalogue";
import { inkSlotKey } from "./referenceSlots";
import { inkDesignWasExamined, INK_CUT_ROUTES } from "../../shared/inkCutRoute";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";

/** The picture she pointed at on this ask. */
const SOURCE = { digest: "5".repeat(64) };
/** A different picture, byte-for-byte. The reuse key's whole subject. */
const OTHER_PICTURE = { digest: "9".repeat(64) };

/** A design she uploaded herself — she took it out of nothing. */
const uploaded = (over: Partial<StoredInkDesign> = {}): StoredInkDesign => ({
  publicId: "d-1",
  candidateId: 1,
  placement: "neck",
  side: "centre",
  provenance: "consented",
  intents: ["tattoo"],
  storageKey: "casting-v2/ink/d-1.png",
  cutRoute: "cut",
  sourceDigest: null,
  createdAt: new Date("2026-08-20T00:00:00Z"),
  digest: "a".repeat(64),
  mime: "image/png",
  byteSize: 1024,
  width: 512,
  height: 512,
  ...over,
} as StoredInkDesign);

/** A design cut out of a picture — the mint's own rows. */
const takenFrom = (
  source: { digest: string },
  over: Partial<StoredInkDesign> = {},
): StoredInkDesign => uploaded({ sourceDigest: source.digest, ...over });

describe("the picture she pointed at is already here", () => {
  it("RIDES the row cut out of it — one picture, one row, no second cut", () => {
    const only = takenFrom(SOURCE, { publicId: "d-neck" });
    const answer = inkDesignForAsk([only], { placement: "neck", side: null }, SOURCE);
    expect(answer.kind).toBe("ride");
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-neck");
  });

  it("is found among designs at OTHER places, and they are not offered", () => {
    /* The filter is the placement, and a Cast with a full studio must not have
       an upper-arm design answer a neck ask. */
    const answer = inkDesignForAsk([
      takenFrom(SOURCE, { publicId: "d-arm", placement: "upperArm", side: "left" }),
      takenFrom(SOURCE, { publicId: "d-chest", placement: "upperChest" }),
      takenFrom(SOURCE, { publicId: "d-neck" }),
    ], { placement: "neck", side: null }, SOURCE);
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-neck");
  });

  it("THE PICTURE DISAMBIGUATES — one of three at the address is hers to ride", () => {
    /*
      The outcome the old `ambiguous` answer could not express. Three designs
      sit at one placement and she pointed at the picture ONE of them came out
      of, so there is nothing to ask her: a wall here would be the product
      failing to understand a correct answer.
    */
    const answer = inkDesignForAsk([
      uploaded({ publicId: "d-hand-1" }),
      takenFrom(OTHER_PICTURE, { publicId: "d-other" }),
      takenFrom(SOURCE, { publicId: "d-mine" }),
    ], { placement: "neck", side: null }, SOURCE);
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-mine");
  });

  it("takes her own word for a surface the vocabulary never measured", () => {
    /* fable-1078: a reference-tattoo ask is never refused on placement. The
       row's placement column is a string since 0046 for exactly this, and a
       row that already exists at an open placement RIDES — it is only the
       MINTING of a new one that waits on the type widening (opus-855 §2). */
    /* The cast is through `unknown` on purpose and is not laziness: the
       column's `$type` is held NARROW deliberately (fable-1112 §3) because the
       only writer today validates `z.enum(INK_PLACEMENTS)`, and
       `inkPlacementCoupling.test.ts` is the arm that reddens if the door opens
       without the type widening in the same commit. This resolver must handle
       her own word BEFORE that day, so the fixture states the row shape that
       column already permits. */
    const answer = inkDesignForAsk(
      [takenFrom(SOURCE, { publicId: "d-sleeve", placement: "sleeve" } as unknown as Partial<StoredInkDesign>)],
      { placement: "sleeve", side: null },
      SOURCE,
    );
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-sleeve");
  });
});

describe("the side she said narrows, and the side she did not say does not", () => {
  const arms = [
    takenFrom(SOURCE, { publicId: "d-left", placement: "upperArm", side: "left" }),
    takenFrom(SOURCE, { publicId: "d-right", placement: "upperArm", side: "right" }),
  ];

  it("picks the arm she named", () => {
    expect(inkDesignForAsk(arms, { placement: "upperArm", side: "left" }, SOURCE))
      .toMatchObject({ kind: "ride", design: { publicId: "d-left" } });
    expect(inkDesignForAsk(arms, { placement: "upperArm", side: "right" }, SOURCE))
      .toMatchObject({ kind: "ride", design: { publicId: "d-right" } });
  });

  it("REFUSES rather than choosing an arm she never named", () => {
    /*
      THE ONE THAT WOULD HAVE BEEN A REFUND AND AN APOLOGY.

      The same picture on BOTH arms is two rows by the reuse key's own side
      member (fable-1149 §2b), and a sentence that says neither side cannot
      pick between them. Narrowing on a side she did not state is the road
      choosing an arm for her — this road's own proven killer, 300 credits
      refunded twice for a design on the wrong anatomical side (R7-7G).
    */
    const answer = inkDesignForAsk(arms, { placement: "upperArm", side: null }, SOURCE);
    /*
      IT ASKS, and the version of this function written before this arm existed
      RODE THE LEFT ARM. Both rows came out of the picture she is pointing at —
      the reuse key's other two members agree and only the SIDE differs — so
      the "which of her designs" question is already answered and the only
      thing missing is the word she never typed.
    */
    expect(answer.kind).toBe("sideUnstated");
    expect(answer.kind === "sideUnstated" && answer.say).toContain("her left or her right");
  });
});

describe("something else already lives at the place she named", () => {
  const resident = [
    uploaded({ publicId: "d-a", createdAt: new Date("2026-08-01T00:00:00Z") }),
    takenFrom(OTHER_PICTURE, { publicId: "d-b", createdAt: new Date("2026-08-19T00:00:00Z") }),
  ];

  it("does NOT ride the resident — the banned default, asserted as banned", () => {
    /*
      The arm that would pass if somebody "helpfully" rode what was there. A
      shared address is not a reason: nothing about sitting at her neck makes a
      design the one in the picture she just handed over, and painting it would
      be a different artwork on her body with no way for her to tell why.
    */
    const answer = inkDesignForAsk(resident, { placement: "neck", side: null }, SOURCE);
    expect(answer.kind).toBe("conflict");
    expect(JSON.stringify(answer)).not.toContain("d-b");
    expect(JSON.stringify(answer)).not.toContain("d-a");
  });

  it("does not ride a row cut from a DIFFERENT picture, even when it is the only one", () => {
    /* The reuse key is byte identity of what she POINTED AT. One resident, cut
       from another photograph, is still not this design. */
    const answer = inkDesignForAsk(
      [takenFrom(OTHER_PICTURE, { publicId: "d-other" })],
      { placement: "neck", side: null },
      SOURCE,
    );
    expect(answer.kind).toBe("conflict");
    expect(answer.kind === "conflict" && answer.count).toBe(1);
  });

  it("does not ride a HAND-UPLOADED row, because a null matches no digest", () => {
    /*
      Migration 0048's own argument, driven. `sourceDigest` is `null` for every
      design a customer uploaded through the studio door, and no digest equals
      a null — so the safety is a property of the column's emptiness rather
      than of a branch somebody remembered to write.
    */
    const answer = inkDesignForAsk([uploaded({ publicId: "d-hand" })], {
      placement: "neck", side: null,
    }, SOURCE);
    expect(answer.kind).toBe("conflict");
  });

  it("says the count, and BOTH moves that exist today", () => {
    /* fable-1151 §3's conditions, each asserted. She cannot see the list, so
       the count is what tells her how much thinking this needs. */
    const answer = inkDesignForAsk(resident, { placement: "neck", side: null }, SOURCE);
    if (answer.kind !== "conflict") return expect.unreachable("a resident design must conflict");
    expect(answer.say).toContain("2 designs");
    expect(answer.say).toContain("her neck");
    /* The per-design delete shipped this week, so this is a move she can make
       right now rather than a wall being polite about itself. */
    expect(answer.say).toContain("Remove the one you");
    /* And the second move: somewhere she has room. */
    expect(answer.say).toContain("somewhere she");
    expect(answer.say).toContain("Nothing was charged.");
  });

  it("counts one as one, in her words rather than in a number", () => {
    const answer = inkDesignForAsk([uploaded({ publicId: "d-only" })], {
      placement: "neck", side: null,
    }, SOURCE);
    expect(answer.kind === "conflict" && answer.say).toContain("a design for her neck already");
  });

  it("promises nothing about a picker that does not exist", () => {
    /* D-180: a question whose every answer leads to "we can't yet" is a dead
       end wearing a tap target. The room is owed and unbuilt (fable-1138 §3),
       so the sentence must not hint at one. */
    const answer = inkDesignForAsk(resident, { placement: "neck", side: null }, SOURCE);
    const said = answer.kind === "conflict" ? answer.say : "";
    /*
      The ban is on a PROMISE, not on plain speech. *"this picture isn't one of
      them"* is a true statement about now and is the clearest thing she can be
      told; what must not appear is a future — an offer to choose, or a "soon"
      — because that is the tap target with nothing behind it.
    */
    for (const promise of ["choose", "pick one", "select", "coming", "soon", "will be able"]) {
      expect(said.toLowerCase(), promise).not.toContain(promise);
    }
  });

  it("counts what MATCHES, never what the Cast holds", () => {
    /* A Cast with a full studio and two neck designs is told two, not eight. */
    const answer = inkDesignForAsk([
      ...resident,
      uploaded({ publicId: "d-c", placement: "upperChest" }),
      uploaded({ publicId: "d-d", placement: "upperArm", side: "left" }),
    ], { placement: "neck", side: null }, SOURCE);
    expect(answer.kind === "conflict" && answer.count).toBe(2);
  });
});

describe("nothing is at the place she named, so the picture becomes the design", () => {
  it("MINTS, and hands the caller a placement and a side it cannot have guessed", () => {
    const answer = inkDesignForAsk([uploaded({ placement: "upperChest" })], {
      placement: "neck", side: "centre",
    }, SOURCE);
    expect(answer).toEqual({ kind: "mint", placement: "neck", side: "centre" });
  });

  it("mints against an EMPTY studio too, without a different voice", () => {
    expect(inkDesignForAsk([], { placement: "neck", side: "centre" }, SOURCE))
      .toMatchObject({ kind: "mint" });
  });

  it("REFUSES a surface nobody has measured, naming the three that work", () => {
    /*
      ⚠ THE ONE TEMPORARY OUTCOME IN THIS FILE (opus-855 §2). The column has
      held any word since 0046 and the slot grammar takes one on purpose, so
      this is not fable-1078's document wall — it is the row TYPE still being
      narrow, and widening it forces an unmeasured answer on the paid sign
      road. The sentence therefore leaves her a road in the next message.
    */
    const answer = inkDesignForAsk([], { placement: "sleeve", side: "left" }, SOURCE);
    expect(answer.kind).toBe("placementUnserved");
    const said = answer.kind === "placementUnserved" ? answer.say : "";
    expect(said).toContain("her neck");
    expect(said).toContain("her upper arm");
    expect(said).toContain("her upper chest");
    expect(said).toContain("sleeve");
    expect(said).toContain("Nothing was charged.");
  });

  it("ASKS which arm rather than picking one", () => {
    /*
      The row's `side` column is NOT NULL and there is no value for *she did not
      say*. `centre` is not a spare — it is the vocabulary's answer for a
      surface there is one of — so a paired surface with no word is the one case
      where a value would have to be invented, and inventing it is R7-7G's
      refund. Asking is allowed only because the road behind the answer now
      exists (fable-1120 §4).
    */
    const answer = inkDesignForAsk([], { placement: "upperArm", side: null }, SOURCE);
    expect(answer.kind).toBe("sideUnstated");
    const said = answer.kind === "sideUnstated" ? answer.say : "";
    expect(said).toContain("her left or her right");
    expect(said).toContain("Nothing was charged.");
  });

  it("never asks about a side on a surface there is ONE of", () => {
    /* `sidesForInkPlacement` has already answered `centre` for these before the
       address is built, so a question here would be about nothing. */
    for (const placement of ["neck", "upperChest"] as const) {
      expect(inkDesignForAsk([], { placement, side: "centre" }, SOURCE).kind, placement).toBe("mint");
    }
  });
});

describe("nobody looked at what was in the picture", () => {
  it("REFUSES a null disposition, free, before anything is claimed", () => {
    /*
      `null` is the recorded fact that `CASTING_INK_CUT_SCOPE` was off when
      those bytes were stored — so what sits at `storageKey` is the picture she
      uploaded rather than the design cut out of it, and on this road that means
      possibly a photograph of a person.

      Real from day one: `null` is every row's state in production today.
    */
    const answer = inkDesignForAsk([takenFrom(SOURCE, { cutRoute: null })], {
      placement: "neck", side: null,
    }, SOURCE);
    expect(answer.kind).toBe("unexamined");
    expect(answer.kind === "unexamined" && answer.say).toContain("Nothing was charged.");
    /* Her sentence is about her picture, never about our flags. */
    const said = answer.kind === "unexamined" ? answer.say.toLowerCase() : "";
    for (const leak of ["flag", "scope", "cutter", "null", "disposition"]) {
      expect(said, leak).not.toContain(leak);
    }
  });

  it("admits BOTH real answers — the refusal is about nobody looking", () => {
    /*
      The other half of the same control. `rideWhole` is a FINISHED examination
      — the cutter looked and ruled the frame rides unchanged — and refusing it
      would turn a completed reading into a wall. Driven over the vocabulary
      itself so a third measured route cannot arrive silently excluded.
    */
    for (const route of INK_CUT_ROUTES) {
      const answer = inkDesignForAsk([takenFrom(SOURCE, { cutRoute: route })], {
        placement: "neck", side: null,
      }, SOURCE);
      expect(answer.kind, route).toBe("ride");
    }
  });
});

describe("the disposition predicate has ONE owner", () => {
  /*
    Ruled fable-1146 §3a. Two doors ask this question — the pre-claim one above
    and the recipe assembler, which is the last thing between a design and an
    engine. Written out as `!== null` at both they are two spellings of one
    rule, and the day the absence stops being spelled `null` only one follows.
  */
  it("counts every measured route as looked-at, and nothing else", () => {
    for (const route of INK_CUT_ROUTES) {
      expect(inkDesignWasExamined(route), route).toBe(true);
    }
    expect(inkDesignWasExamined(null)).toBe(false);
    expect(inkDesignWasExamined(undefined)).toBe(false);
  });
});

/*
  THE TWO VOCABULARIES MEETING — found by a sabotage that reddened NOTHING.

  `slotPlacementOf` translates a design row's side into a slot's instance, and
  the whole content of it is `centre` → `null`. Breaking that translation left
  every arm in this file and every arm at the wire GREEN, because all of them
  used a per-side placement.

  It is not a corner. `sidesForInkPlacement("neck")` is `["centre"]`, so *"put
  it on her neck"* produces exactly this address — and without the translation
  the key becomes `ink:neck@centre`, which `inkPlacementOfSlot` refuses because
  the suffix list is closed, so the ask finds no slot and a NECK tattoo is
  walled with `unplacedInk`. The most ordinary ask on the road was the one
  nothing covered.
*/
describe("a row's side, in the slot grammar's words", () => {
  it("says `centre` by having no instance at all", () => {
    expect(slotPlacementOf({ placement: "neck", side: "centre" }))
      .toEqual({ placement: "neck", side: null });
    expect(slotPlacementOf({ placement: "upperChest", side: "centre" }))
      .toEqual({ placement: "upperChest", side: null });
  });

  it("passes the two real sides through untouched — the half worth protecting", () => {
    /* This road's measured failure is a design on the wrong arm (300 credits
       refunded twice, DECISION_LOG R7-7G), so a translation that ever moved
       `left` would be that refund with a new author. */
    expect(slotPlacementOf({ placement: "upperArm", side: "left" }))
      .toEqual({ placement: "upperArm", side: "left" });
    expect(slotPlacementOf({ placement: "upperArm", side: "right" }))
      .toEqual({ placement: "upperArm", side: "right" });
  });

  it("carries an unstated side as unstated", () => {
    expect(slotPlacementOf({ placement: "neck", side: null }))
      .toEqual({ placement: "neck", side: null });
  });

  /*
    AND THE KEY IT PRODUCES RESOLVES — the assertion that would have caught the
    defect on its own, because it asks the catalogue rather than a shape.
  */
  it("produces a key the catalogue actually answers for", () => {
    const one = slotPlacementOf({ placement: "neck", side: "centre" });
    expect(slotDefinition(inkSlotKey(one.placement))).not.toBeNull();
    /* And the key the broken translation would have produced does NOT resolve,
       which is why nothing downstream could have rescued it. */
    expect(slotDefinition("ink:neck@centre")).toBeNull();
  });
});

/**
 * WHICH DESIGN AN ASK MEANS — every refusal driven directly.
 *
 * Working law 3's own case: these are exactly the refusals a suite would
 * otherwise "prove" by never triggering them. A planted two-design placement is
 * one line here and a database somewhere else, so they are driven here.
 *
 * The arm carrying the most weight is the AMBIGUITY one, because the answer it
 * asserts is the one nobody would have chosen by default: a road that picked
 * the most recent design would pass every other test in this file.
 */
import { describe, expect, it } from "vitest";

import { inkDesignForAsk } from "./inkDesignForAsk";
import { inkDesignWasExamined, INK_CUT_ROUTES } from "../../shared/inkCutRoute";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";

const design = (over: Partial<StoredInkDesign> = {}): StoredInkDesign => ({
  publicId: "d-1",
  candidateId: 1,
  placement: "neck",
  side: "centre",
  provenance: "ownWork",
  intents: ["ink"],
  storageKey: "casting-v2/ink/d-1.png",
  cutRoute: "cut",
  createdAt: new Date("2026-08-20T00:00:00Z"),
  digest: "a".repeat(64),
  mime: "image/png",
  byteSize: 1024,
  width: 512,
  height: 512,
  ...over,
} as StoredInkDesign);

describe("one design at the place she named", () => {
  it("rides", () => {
    const only = design({ publicId: "d-neck" });
    const answer = inkDesignForAsk([only], { placement: "neck", side: null });
    expect(answer.kind).toBe("ride");
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-neck");
  });

  it("is found among designs at OTHER places, and they are not offered", () => {
    /* The filter is the placement, and a Cast with a full studio must not have
       an upper-arm design answer a neck ask. */
    const answer = inkDesignForAsk([
      design({ publicId: "d-arm", placement: "upperArm", side: "left" }),
      design({ publicId: "d-chest", placement: "upperChest" }),
      design({ publicId: "d-neck" }),
    ], { placement: "neck", side: null });
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-neck");
  });

  it("takes her own word for a surface the vocabulary never measured", () => {
    /* fable-1078: a reference-tattoo ask is never refused on placement. The
       row's placement column is a string since 0046 for exactly this. */
    /* The cast is through `unknown` on purpose and is not laziness: the
       column's `$type` is held NARROW deliberately (fable-1112 §3) because the
       only writer today validates `z.enum(INK_PLACEMENTS)`, and
       `inkPlacementCoupling.test.ts` is the arm that reddens if the door opens
       without the type widening in the same commit. This resolver must handle
       her own word BEFORE that day, so the fixture states the row shape that
       column already permits. */
    const answer = inkDesignForAsk(
      [design({ publicId: "d-sleeve", placement: "sleeve" } as unknown as Partial<StoredInkDesign>)],
      { placement: "sleeve", side: null },
    );
    expect(answer.kind === "ride" && answer.design.publicId).toBe("d-sleeve");
  });
});

describe("the side she said narrows, and the side she did not say does not", () => {
  const arms = [
    design({ publicId: "d-left", placement: "upperArm", side: "left" }),
    design({ publicId: "d-right", placement: "upperArm", side: "right" }),
  ];

  it("picks the arm she named", () => {
    expect(inkDesignForAsk(arms, { placement: "upperArm", side: "left" }))
      .toMatchObject({ kind: "ride", design: { publicId: "d-left" } });
    expect(inkDesignForAsk(arms, { placement: "upperArm", side: "right" }))
      .toMatchObject({ kind: "ride", design: { publicId: "d-right" } });
  });

  it("REFUSES rather than choosing an arm she never named", () => {
    /*
      THE ONE THAT WOULD HAVE BEEN A REFUND AND AN APOLOGY.

      Two designs, one per arm, and a sentence that says neither. Narrowing on a
      side she did not state is the road choosing an arm for her — this road's
      own proven killer, 300 credits refunded twice for a design on the wrong
      anatomical side (DECISION_LOG R7-7G).
    */
    const answer = inkDesignForAsk(arms, { placement: "upperArm", side: null });
    expect(answer.kind).toBe("ambiguous");
    expect(answer.kind === "ambiguous" && answer.count).toBe(2);
  });
});

describe("more than one, and the choice stays hers", () => {
  const two = [
    design({ publicId: "d-a", createdAt: new Date("2026-08-01T00:00:00Z") }),
    design({ publicId: "d-b", createdAt: new Date("2026-08-19T00:00:00Z") }),
  ];

  it("does NOT pick the most recent — the banned default, asserted as banned", () => {
    /*
      The arm that would pass if somebody "helpfully" defaulted. A timestamp is
      an alibi, not a reason: nothing about being newer makes a design the one
      she meant, and the customer cannot see the list to know what was chosen.
    */
    const answer = inkDesignForAsk(two, { placement: "neck", side: null });
    expect(answer.kind).toBe("ambiguous");
    expect(JSON.stringify(answer)).not.toContain("d-b");
    expect(JSON.stringify(answer)).not.toContain("d-a");
  });

  it("says the placement, the COUNT, and the road that exists today", () => {
    /* fable-1145 §4's three conditions, each asserted. She cannot see the list,
       so the count is what tells her how much thinking this needs. */
    const answer = inkDesignForAsk(two, { placement: "neck", side: null });
    if (answer.kind !== "ambiguous") return expect.unreachable("two designs must be ambiguous");
    expect(answer.say).toContain("2 designs");
    expect(answer.say).toContain("her neck");
    /* The per-design delete shipped this week, so this is a move she can make
       right now rather than a wall being polite about itself. */
    expect(answer.say).toContain("Remove the ones you don't want");
    expect(answer.say).toContain("Nothing was charged.");
  });

  it("promises nothing about a picker that does not exist", () => {
    /* D-180: a question whose every answer leads to "we can't yet" is a dead
       end wearing a tap target. The room is owed and unbuilt (fable-1138 §3),
       so the sentence must not hint at one. */
    const answer = inkDesignForAsk(two, { placement: "neck", side: null });
    const said = answer.kind === "ambiguous" ? answer.say : "";
    /*
      The ban is on a PROMISE, not on plain speech. *"I don't know which one you
      mean"* is a true statement about now and is the clearest thing she can be
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
      ...two,
      design({ publicId: "d-c", placement: "upperChest" }),
      design({ publicId: "d-d", placement: "upperArm", side: "left" }),
    ], { placement: "neck", side: null });
    expect(answer.kind === "ambiguous" && answer.count).toBe(2);
  });
});

describe("no design at the place she named", () => {
  it("says so, free, and hands her the move", () => {
    const answer = inkDesignForAsk([design({ placement: "upperChest" })], {
      placement: "neck", side: null,
    });
    expect(answer.kind).toBe("none");
    expect(answer.kind === "none" && answer.say).toContain("her neck");
    expect(answer.kind === "none" && answer.say).toContain("Nothing was charged.");
  });

  it("says it about an EMPTY studio too, without a different voice", () => {
    const answer = inkDesignForAsk([], { placement: "neck", side: null });
    expect(answer.kind).toBe("none");
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
    const answer = inkDesignForAsk([design({ cutRoute: null })], {
      placement: "neck", side: null,
    });
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
      const answer = inkDesignForAsk([design({ cutRoute: route })], {
        placement: "neck", side: null,
      });
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

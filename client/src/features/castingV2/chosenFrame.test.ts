import { describe, expect, it } from "vitest";

import {
  frameUrlFor,
  overrideApplies,
  selectedVariantFor,
  supersededBy,
  type ChosenFrame,
} from "./chosenFrame";

const V1 = "https://pub.example/v1.png";
const V2 = "https://pub.example/v2.png";
const V3 = "https://pub.example/v3.png";
const V4 = "https://pub.example/v4.png";

const pick = (over: Partial<ChosenFrame> = {}): ChosenFrame => ({
  candidateId: "face-a", url: V2, insteadOf: [V1], variantId: "variant-2", ...over,
});

describe("the picture answers the click", () => {
  it("draws the version they just picked, while the server still says the old one", () => {
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V1, chosen: pick() })).toBe(V2);
  });

  it("steps aside the moment the server agrees", () => {
    /* Not a race and not a flicker: both answers are the same URL, so the
       handover is invisible and the override is spent by arithmetic. */
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V2, chosen: pick() })).toBe(V2);
  });

  it("NEVER pins a stale picture when something newer lands", () => {
    /*
      The hazard the `insteadOf` field exists for. A refine delivering mid-switch
      moves the candidate to a third picture — and an override that only knew
      what it wanted would keep drawing the old pick over the new render.
    */
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V3, chosen: pick() })).toBe(V3);
  });

  it("does not follow the arrows onto another face", () => {
    /* One viewer walks the whole sheet (the fable-465 class, which cost a
       founder walk when a mutation's pending state was read sheet-wide). */
    expect(frameUrlFor({ candidateId: "face-b", serverUrl: V1, chosen: pick() })).toBe(V1);
  });

  it("is the server's own answer when nothing has been picked", () => {
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V1, chosen: null })).toBe(V1);
  });
});

/**
 * THE HIGHLIGHT IS THE SAME CLAIM AS THE PICTURE (founder bug, fable-546).
 *
 * The rail's lit chip read the server-confirmed selection while the photograph
 * rode this override, so for the length of a round trip the picture was the new
 * version and the lit chip was the old one — two readers of "which version is
 * she on". These prove the second reader is gone rather than merely quieter:
 * every rule the frame follows, the selection follows, because it is the same
 * object answering.
 */
describe("the rail lights the version the picture is showing", () => {
  it("lights the version she just picked, while the server still says the old one", () => {
    expect(selectedVariantFor({
      candidateId: "face-a", serverUrl: V1, serverSelected: "variant-1", chosen: pick(),
    })).toBe("variant-2");
  });

  it("steps aside the moment the server agrees", () => {
    expect(selectedVariantFor({
      candidateId: "face-a", serverUrl: V2, serverSelected: "variant-2", chosen: pick(),
    })).toBe("variant-2");
  });

  it("NEVER pins a stale highlight when something newer lands", () => {
    /* A refine delivering mid-switch must win BOTH surfaces together — the
       picture and the highlight — never one of them. */
    expect(selectedVariantFor({
      candidateId: "face-a", serverUrl: V3, serverSelected: "variant-3", chosen: pick(),
    })).toBe("variant-3");
  });

  it("does not follow the arrows onto another woman's face", () => {
    expect(selectedVariantFor({
      candidateId: "face-b", serverUrl: V1, serverSelected: "variant-9", chosen: pick(),
    })).toBe("variant-9");
  });

  it("carries the ORIGINAL as a real selection rather than an absence", () => {
    expect(selectedVariantFor({
      candidateId: "face-a", serverUrl: V1, serverSelected: "variant-1",
      chosen: pick({ variantId: null }),
    })).toBeNull();
  });
});

/**
 * THE ABANDONED VERSION COMING BACK — the founder's own report, granted in
 * fable-701 §4 and reproduced twice before it was believed.
 *
 * Five clicks in half a second put five writes in a queue that runs ONE at a
 * time. The sheet's poll lands in the middle of that queue, and the server
 * answers honestly with a version she passed through two clicks ago. Under the
 * single-URL rule that intermediate frame was not the one the override was
 * watching for, so the override stood down and a version nobody had chosen sat
 * on the plate for about sixteen seconds — then changed again by itself when
 * the last write finally landed.
 *
 * The claim is now the burst's whole history, and the arm that must NOT move
 * with it is the refine landing: a picture nobody clicked belongs to no burst.
 */
describe("a burst of clicks — the last one owns the plate throughout", () => {
  /** V1 on screen; she clicks V2, then V3, then V4 before any write lands. */
  const burst = (): ChosenFrame => {
    const first: ChosenFrame = {
      candidateId: "face-a", url: V2, variantId: "variant-2",
      insteadOf: supersededBy({ candidateId: "face-a", showing: V1, picked: V2, previous: null }),
    };
    const second: ChosenFrame = {
      candidateId: "face-a", url: V3, variantId: "variant-3",
      insteadOf: supersededBy({ candidateId: "face-a", showing: V1, picked: V3, previous: first }),
    };
    return {
      candidateId: "face-a", url: V4, variantId: "variant-4",
      insteadOf: supersededBy({ candidateId: "face-a", showing: V1, picked: V4, previous: second }),
    };
  };

  it("keeps the last pick while the server answers with an INTERMEDIATE one", () => {
    /* The reproduction, exactly: the second write lands, the poll reads V3, and
       the plate must still be V4. This is the assertion that was false. */
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V3, chosen: burst() })).toBe(V4);
    expect(selectedVariantFor({
      candidateId: "face-a", serverUrl: V3, serverSelected: "variant-3", chosen: burst(),
    })).toBe("variant-4");
  });

  it("and while it still answers with the frame the burst began on", () => {
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V1, chosen: burst() })).toBe(V4);
  });

  it("steps aside when the last write finally lands", () => {
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: V4, chosen: burst() })).toBe(V4);
    /* And it is SPENT rather than merely agreeing: the frame it drew is not in
       its own history, so the next server answer is the server's. */
    expect(burst().insteadOf).not.toContain(V4);
  });

  it("STILL dies the instant a refine delivers something nobody clicked", () => {
    /*
      Condition (a) of the grant, and the reason `insteadOf` exists at all. A
      render that lands mid-burst is in no burst's history, so the widened claim
      must let go of the plate exactly as the narrow one did.
    */
    const landed = "https://pub.example/refined.png";
    expect(frameUrlFor({ candidateId: "face-a", serverUrl: landed, chosen: burst() })).toBe(landed);
    expect(selectedVariantFor({
      candidateId: "face-a", serverUrl: landed, serverSelected: "variant-9", chosen: burst(),
    })).toBe("variant-9");
  });

  it("does not carry another face's history onto this one", () => {
    /* The fable-465 class again: a burst is per face, so a claim left on
       another woman contributes nothing here. */
    const elsewhere: ChosenFrame = {
      candidateId: "face-b", url: V3, insteadOf: [V1, V2], variantId: "variant-3",
    };
    expect(supersededBy({ candidateId: "face-a", showing: V1, picked: V2, previous: elsewhere }))
      .toEqual([V1]);
  });

  it("counts each frame once, however many times the burst passes it", () => {
    const first: ChosenFrame = {
      candidateId: "face-a", url: V2, insteadOf: [V1], variantId: "variant-2",
    };
    /* Back to V1 and away again — the history is a set, not a tally. */
    expect(supersededBy({ candidateId: "face-a", showing: V1, picked: V3, previous: first }))
      .toEqual([V1, V2]);
  });

  it("asks ONE question, so the three surfaces cannot answer differently", () => {
    /* `overrideApplies` is the rule; the frame, the highlight and the small
       copy all read it. Driven directly so a caller that inlines its own copy
       is a change to this file rather than a silent third opinion. */
    expect(overrideApplies({ candidateId: "face-a", serverUrl: V3, chosen: burst() })).toBe(true);
    expect(overrideApplies({ candidateId: "face-a", serverUrl: V4, chosen: burst() })).toBe(false);
    expect(overrideApplies({ candidateId: "face-b", serverUrl: V3, chosen: burst() })).toBe(false);
    expect(overrideApplies({ candidateId: "face-a", serverUrl: V3, chosen: null })).toBe(false);
  });
});

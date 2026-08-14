import { describe, expect, it } from "vitest";

import { frameUrlFor, type ChosenFrame } from "./chosenFrame";

const V1 = "https://pub.example/v1.png";
const V2 = "https://pub.example/v2.png";
const V3 = "https://pub.example/v3.png";

const pick = (over: Partial<ChosenFrame> = {}): ChosenFrame => ({
  candidateId: "face-a", url: V2, insteadOf: V1, ...over,
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

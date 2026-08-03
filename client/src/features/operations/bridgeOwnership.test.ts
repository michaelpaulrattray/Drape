import { describe, expect, it } from "vitest";

import { ownsItsOwnSurface, selfReportingKinds } from "./surfaceOwnership";

/**
 * Who gets to tell the user what happened.
 *
 * `GenerationOperationBridge` polls every generation operation and toasts a
 * failed one's `publicMessage` from wherever the user happens to be. That is
 * right for work nobody is watching — a canvas draft landing on a board the
 * user has navigated away from. It is wrong for a Casting V2 surface, which
 * reports every outcome in place.
 *
 * D-110: a toast is the fallback channel, never a second copy.
 *
 * **This file used to carry its own copy of the predicate**, which meant it
 * described the bridge rather than testing it — it would have stayed green
 * through any change to the real rule, including a wrong one. It now imports
 * the thing the bridge actually calls.
 */

/**
 * The bridge's condition, with the real predicate inside it.
 *
 * The surrounding clauses are restated because they are three booleans read off
 * a DTO; the part that carries a ruling is imported.
 */
function shouldToastFailure(operation: {
  kind: string;
  status: string;
  publicMessage: string | null;
  locallyNotified?: boolean;
}): boolean {
  return (
    operation.status === "failed"
    && Boolean(operation.publicMessage)
    && !operation.locallyNotified
    && !ownsItsOwnSurface(operation.kind)
  );
}

describe("the bridge does not double-report a surface that speaks for itself", () => {
  /*
    The list is pinned, not merely exercised. Both failure directions are
    silent: a kind wrongly added here goes quiet with nothing on screen, and a
    kind wrongly missing duplicates a notice the user is already reading.
  */
  it("names exactly the kinds that confess in place", () => {
    expect(selfReportingKinds()).toEqual(["castingV2.roll", "castingV2.sign"]);
  });

  it("stays silent on the cancelled roll the founder saw", () => {
    expect(
      shouldToastFailure({
        kind: "castingV2.roll",
        status: "failed",
        publicMessage: "That roll was cancelled. 160 credits were refunded.",
      }),
    ).toBe(false);
  });

  it("stays silent on a genuinely failed roll too — the sheet still shows it", () => {
    /*
      Deliberately not narrowed to cancellations. A failed V2 roll leaves
      `failed-refunded` tiles and a banner on the sheet, so the toast is a
      second telling either way. Narrowing to the cancel message would mean
      matching on copy, which breaks the first time the sentence is edited.
    */
    expect(
      shouldToastFailure({
        kind: "castingV2.roll",
        status: "failed",
        publicMessage: "None of the sheet arrived. 160 credits were refunded.",
      }),
    ).toBe(false);
  });

  /*
    Sign joined when the room shipped. A permanently failed slot confesses in
    place ("this view didn't arrive — refunded") and a total loss says so at the
    top, both server-authored — so a toast would talk over the room.
  */
  it("leaves the Sign to the room", () => {
    expect(
      shouldToastFailure({
        kind: "castingV2.sign",
        status: "failed",
        publicMessage: "The package could not be built. 500 credits were refunded.",
      }),
    ).toBe(false);
  });

  it("STILL reports work that has no surface of its own", () => {
    // The negative control, and the reason this is scoped by kind rather than
    // switched off. A canvas draft failing while the user is elsewhere has
    // nowhere else to be told.
    for (const kind of ["canvas.cast", "canvas.recast", "canvas.variations", "casting.mint"]) {
      expect(
        shouldToastFailure({
          kind,
          status: "failed",
          publicMessage: "The generation failed and the charged credits were refunded.",
        }),
        kind,
      ).toBe(true);
    }
  });

  it("treats an unknown kind as needing the fallback", () => {
    // Fail toward being told: a kind this build has never heard of has no
    // surface here by definition.
    expect(
      shouldToastFailure({ kind: "something.new", status: "failed", publicMessage: "x" }),
    ).toBe(true);
  });

  it("keeps the existing suppressions intact", () => {
    expect(
      shouldToastFailure({ kind: "canvas.cast", status: "failed", publicMessage: null }),
    ).toBe(false);
    expect(
      shouldToastFailure({
        kind: "canvas.cast",
        status: "failed",
        publicMessage: "x",
        locallyNotified: true,
      }),
    ).toBe(false);
    expect(
      shouldToastFailure({ kind: "canvas.cast", status: "succeeded", publicMessage: "x" }),
    ).toBe(false);
  });
});

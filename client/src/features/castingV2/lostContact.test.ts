import { describe, expect, it } from "vitest";

import { createDispatchLatch } from "./singleFlight";
import type { DispatchFailure } from "./sheetState";

/**
 * The banner must dismiss itself when the sheet proves it wrong.
 *
 * THE LIVE FAILURE: the founder fired a follow that overlapped a deploy. The
 * connection dropped mid-`createRoll`, "We lost contact" appeared — and stayed,
 * while the roll it was wrong about rendered directly beneath it, until a
 * manual page refresh.
 *
 * THE CAUSE, and it was not follow-specific: clearing depended on the
 * single-flight latch settling, and the failure handler called `release()` on
 * that latch BEFORE raising the banner. `settleIfArrived` returns false when
 * the latch is not held, so the one mechanism that could dismiss the banner had
 * already been torn down by the handler that raised it. Every dispatch failure
 * had this; a follow is just what the founder happened to fire.
 *
 * THE FIX SHAPE (founder): the banner derives from the same source the sheet
 * renders from. If the rendered active roll is not the one the failed dispatch
 * fired on top of, a roll arrived afterwards and the failure describes a world
 * that no longer exists. No second predicate to keep in step.
 */

/** Exactly the derivation `CastingSheet` performs, kept in one place. */
function bannerVisible(
  activeRollId: string | null,
  failure: DispatchFailure | null,
  cancelledByUser = false,
): boolean {
  const stale = failure !== null && activeRollId !== null && activeRollId !== failure.afterRollId;
  return !stale && !cancelledByUser && failure !== null;
}

const lostContact = (afterRollId: string | null): DispatchFailure => ({
  kind: "unavailable",
  message: "We lost contact while your roll was starting.",
  afterRollId,
});

describe("the latch cannot be the clear-condition", () => {
  it("proves the old mechanism was already dead when the banner was raised", () => {
    /*
      The regression, reproduced against the real latch. This is the sequence
      the founder hit, and the assertion is the bug: after a failure releases
      the latch, a roll arriving reports NOTHING, so anything depending on this
      to clear never fires.
    */
    const latch = createDispatchLatch();
    latch.tryAcquire("roll-1");
    // The transport dies. The failure handler releases the latch, then raises
    // the banner.
    latch.release();
    // The roll it was wrong about lands.
    expect(latch.settleIfArrived("roll-2")).toBe(false);
  });
});

describe("the banner dismisses itself", () => {
  it("goes when a newer roll renders — no refresh, no latch", () => {
    const failure = lostContact("roll-1");
    // The moment the failure was raised, the sheet still showed roll-1.
    expect(bannerVisible("roll-1", failure)).toBe(true);
    // The roll that was actually created lands. The banner is now describing a
    // world that no longer exists.
    expect(bannerVisible("roll-2", failure)).toBe(false);
  });

  it("goes on a FIRST roll too, where there was no previous roll to compare", () => {
    // The lobby path: it fires and unmounts before any roll exists, so any
    // roll appearing at all proves the failure stale.
    const failure = lostContact(null);
    expect(bannerVisible(null, failure)).toBe(true);
    expect(bannerVisible("roll-1", failure)).toBe(false);
  });

  it("STAYS when the dispatch genuinely produced nothing", () => {
    /*
      The negative control, and the reason this is a derivation rather than a
      timer. A refusal that created no roll leaves the sheet on the same roll
      it was already showing — so the banner is still true and must persist.
      A rule that dismissed on any poll tick would hide real failures.
    */
    const refusal: DispatchFailure = {
      kind: "refused",
      message: "That brief names a real person.",
      afterRollId: "roll-3",
    };
    expect(bannerVisible("roll-3", refusal)).toBe(true);
    // Still true several polls later — nothing about time clears it.
    expect(bannerVisible("roll-3", refusal)).toBe(true);
  });

  it("stays on an empty sheet whose dispatch failed and produced nothing", () => {
    expect(bannerVisible(null, lostContact(null))).toBe(true);
  });
});

describe("a roll the user cancelled reports no failure", () => {
  it("suppresses the banner once the user has cancelled", () => {
    /*
      `createRoll` stays open for the whole roll, so cancelling makes it reject
      a minute or two later carrying "That roll was cancelled. N credits were
      refunded." True, and long after the fact — describing something the user
      did on purpose and has already been told about, live, in the dock.

      The founder saw that sentence arrive while they were doing something
      else. The cancel line owns the story; a second late notice reads as a new
      problem.
    */
    const failure = lostContact("roll-1");
    expect(bannerVisible("roll-1", failure, false)).toBe(true);
    expect(bannerVisible("roll-1", failure, true)).toBe(false);
  });

  it("still shows a REAL failure on a sheet the user never cancelled", () => {
    // The negative control: suppression is scoped to the user's own cancel,
    // never a blanket silence on dispatch failures.
    const refusal: DispatchFailure = {
      kind: "refused",
      message: "That brief names a real person.",
      afterRollId: "roll-3",
    };
    expect(bannerVisible("roll-3", refusal, false)).toBe(true);
  });
});

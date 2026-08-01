import { beforeEach, describe, expect, it } from "vitest";

import { useSheetState } from "./sheetState";
import { cancelNoticeFor } from "./cancelNotice";

/**
 * Sheet state belongs to ONE sheet.
 *
 * The founder's finding, and it had money attached: an age adjustment set on
 * one sheet appeared in a different sheet's echo, and a roll fired there would
 * have posted a lock the user never set on that sheet. A paid action carrying
 * foreign state.
 */

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

const sliceOf = (id: string) => useSheetState.getState().sessions[id];

beforeEach(() => {
  useSheetState.setState({ sessions: {} });
});

describe("state never crosses sheets", () => {
  it("keeps a hand adjustment on the sheet it was made on", () => {
    useSheetState.getState().setOverride(A, "ageBand", "teens");
    expect(sliceOf(A).overrides.ageBand).toBe("teens");
    // The reproduction, inverted: sheet B must not have inherited it.
    expect(sliceOf(B)?.overrides.ageBand).toBeUndefined();
  });

  it("keeps unpinned chips, undo and optimistic paint apart too", () => {
    const store = useSheetState.getState();
    store.unlock(A, "sex");
    store.setUndoable(A, "cand-1");
    store.setOptimisticDiscarded(A, "cand-1");
    store.setStartingRoll(A, true);

    expect(sliceOf(B)).toBeUndefined();
    expect(sliceOf(A).unlocked).toEqual(["sex"]);
    expect(sliceOf(A).undoable).toBe("cand-1");
    expect(sliceOf(A).startingRoll).toBe(true);
  });

  it("still lets an adjustment stand ACROSS ROLLS within its own sheet", () => {
    /*
      The founder's standing-correction law, which this change must not break.
      A roll re-reads the brief every time, so an override that cleared on
      dispatch would be silently re-derived away by the interpreter — the
      adjustment would not be refused, it would evaporate. Bounded by the
      sheet was always what "standing" meant.
    */
    const store = useSheetState.getState();
    store.setOverride(A, "ageBand", "40s");
    store.unlock(A, "sex");
    store.rollDispatched(A);

    expect(sliceOf(A).overrides.ageBand).toBe("40s");
    // Unpinning is one-shot by the same law, and is spent by the dispatch.
    expect(sliceOf(A).unlocked).toEqual([]);
  });

  it("delivers a late dispatch failure to the sheet it belongs to", () => {
    /*
      The lobby fires the roll and unmounts in the same tick, so its `.catch`
      can resolve while the user is standing on a different sheet. Addressed
      writes are what make that land on the right one — a reset-on-switch
      design would put it wherever the user happened to be.
    */
    useSheetState.getState().setStartingRoll(A, true);
    useSheetState.getState().setDispatchFailure(A, { kind: "refused", message: "no", afterRollId: null });

    expect(sliceOf(A).dispatchFailure?.kind).toBe("refused");
    expect(sliceOf(A).startingRoll).toBe(false);
    expect(sliceOf(B)?.dispatchFailure).toBeUndefined();
  });

  it("forgets a sheet on request, so the map stays bounded", () => {
    useSheetState.getState().setOverride(A, "build", "athletic");
    useSheetState.getState().dropSession(A);
    expect(sliceOf(A)).toBeUndefined();
  });
});

describe("what a cancel says", () => {
  it("does not report a bare zero when work is still arriving", () => {
    // The founder's reading: "0 credits back" looked like a failure at the
    // exact moment they were worrying about their balance.
    const notice = cancelNoticeFor({
      refundedCredits: 0,
      refundRecorded: true,
      stillFinishing: 5,
    });
    expect(notice).not.toMatch(/\b0 credits\b/);
    expect(notice).toContain("5 still finishing");
    expect(notice).toContain("refunds complete as they land");
  });

  it("still states the recorded amount when there is one (R6 refund honesty)", () => {
    const notice = cancelNoticeFor({
      refundedCredits: 240,
      refundRecorded: true,
      stillFinishing: 3,
    });
    expect(notice).toContain("240 credits back");
    expect(notice).toContain("3 still finishing");
  });

  it("says nothing was owed when the roll had already finished", () => {
    const notice = cancelNoticeFor({
      refundedCredits: 0,
      refundRecorded: true,
      stillFinishing: 0,
    });
    expect(notice).toContain("already finished");
  });

  it("never softens a refund that failed to record", () => {
    /*
      The one branch that must survive every future copy edit: a refund that
      did not record is never reported as "you weren't charged".
    */
    const notice = cancelNoticeFor({
      refundedCredits: 0,
      refundRecorded: false,
      stillFinishing: 4,
    });
    expect(notice).toContain("Support has the details");
    expect(notice).not.toContain("still finishing");
  });

  it("uses singular English for one", () => {
    expect(
      cancelNoticeFor({ refundedCredits: 0, refundRecorded: true, stillFinishing: 1 }),
    ).toContain("1 still finishing");
  });
});

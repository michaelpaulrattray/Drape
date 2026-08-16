import { beforeEach, describe, expect, it } from "vitest";

import { useSheetState } from "./sheetState";
import { cancelNoticeFor, cancelStory } from "./cancelNotice";

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

/**
 * UNDO TAKES BACK WHAT SHE QUEUED — WHICHEVER KIND IT WAS (fable-729 §4).
 *
 * The echo queues a change two ways: pinning a value, and unpinning one. Its
 * popover offers one Undo for both — *"Undo — keep 30s"* — and that footer
 * only ever deleted an override. On the unpinned branch there is no override,
 * so the control did nothing at all: the span kept reading "→ varying · next
 * roll", the popover kept saying queued, and the next roll still shipped the
 * unlock she had just taken back.
 *
 * Both arms here, because a fix that cleared only the unpin would be the same
 * defect facing the other way.
 */
describe("undoing a queued change", () => {
  it("takes back an unpinned fact — the branch where it did nothing", () => {
    const store = useSheetState.getState();
    store.unlock(A, "ageBand");
    expect(sliceOf(A).unlocked, "queued, so the echo says varying").toEqual(["ageBand"]);

    useSheetState.getState().undoOverride(A, "ageBand");
    expect(sliceOf(A).unlocked, "and taken back when she says so").toEqual([]);
  });

  it("still takes back a pinned value", () => {
    const store = useSheetState.getState();
    store.setOverride(A, "ageBand", "30s");
    useSheetState.getState().undoOverride(A, "ageBand");
    expect(sliceOf(A).overrides.ageBand).toBeUndefined();
  });

  it("leaves every OTHER queued fact exactly where it was", () => {
    /* The undo names one field. Clearing the whole slice would take back
       decisions she never mentioned — and both kinds of queue live in this
       slice, so the arm checks both. */
    const store = useSheetState.getState();
    store.unlock(A, "sex");
    store.setOverride(A, "ageBand", "30s");
    store.unlock(A, "ageBand");

    useSheetState.getState().undoOverride(A, "ageBand");
    expect(sliceOf(A).unlocked).toEqual(["sex"]);
  });

  it("does not reach into another sheet", () => {
    const store = useSheetState.getState();
    store.unlock(A, "ageBand");
    store.unlock(B, "ageBand");
    useSheetState.getState().undoOverride(A, "ageBand");
    expect(sliceOf(B).unlocked, "the fable-465 scope, on this control too").toEqual(["ageBand"]);
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

describe("the cancel arc is a state, not an event", () => {
  const arc = (refunded: number, finishing: number, recorded = true) =>
    cancelStory({
      cancelled: true,
      refunded,
      finishing,
      total: 8,
      sliceCredits: 20,
      refundRecorded: recorded,
    });

  it("says nothing at all on a roll that was not cancelled", () => {
    expect(
      cancelStory({ cancelled: false, refunded: 0, finishing: 8, total: 8, sliceCredits: 20, refundRecorded: true }),
    ).toBeNull();
  });

  it("counts down as landings refund, instead of freezing at the click", () => {
    /*
      The founder's finding: the mechanics were right and the arc was
      disjointed. A sentence composed once from the mutation's reply described
      a moment, while the thing it described carried on for another minute.
    */
    expect(arc(0, 8)).toBe("Cancelled — 0 of 8 refunded · 8 finishing");
    expect(arc(3, 5)).toBe("Cancelled — 3 of 8 refunded · 5 finishing");
    expect(arc(7, 1)).toBe("Cancelled — 7 of 8 refunded · 1 finishing");
  });

  it("finishes on the recorded total, in the one place the money lives", () => {
    expect(arc(8, 0)).toContain("160 credits back");
    expect(arc(6, 0)).toContain("120 credits back");
  });

  it("NEVER MOVES BACKWARDS across the whole arc", () => {
    /*
      The pass bar, as a property. Walk the projection through every state a
      real cancel passes: refunded counts only rise, finishing only falls, and
      the line changes at every step until it reaches its terminal form.
    */
    const seen: string[] = [];
    for (let refunded = 0; refunded <= 6; refunded += 1) {
      seen.push(arc(refunded, 6 - refunded + 2) ?? "");
    }
    seen.push(arc(6, 0) ?? "");
    // Monotonic: every line is distinct from the one before it.
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).not.toBe(seen[i - 1]);
    // And it ends on a total, not on a count.
    expect(seen[seen.length - 1]).toContain("credits back");
    expect(seen[seen.length - 1]).not.toContain("finishing");
  });

  it("keeps the unrecorded-refund branch verbatim, at any point in the arc", () => {
    // R6's sacred branch. It outranks the count, because a refund that did not
    // record is not a smaller number — it is a different fact.
    expect(arc(4, 0, false)).toBe(
      "Cancelled — part of the refund could not be recorded. Support has the details.",
    );
    expect(arc(4, 0, false)).toBe(cancelNoticeFor({ refundedCredits: 0, refundRecorded: false, stillFinishing: 4 }));
  });

  it("counts a roll whose candidates all EXPIRED as fully refunded", () => {
    /*
      The case a paid roll found, and the one that matters most: a roll already
      fully dispatched when the user cancels. Every candidate lands, every one
      is refunded under the generosity rule, and every one is deliberately
      HIDDEN from the projection — showing them would make cancelling a way to
      buy images for nothing.

      Counting the visible tiles therefore said "nothing to refund" while 160
      credits were coming back. Counted from `counts` — total minus delivered
      minus still-coming — it says what actually happened.
    */
    const fromCounts = (total: number, ready: number, casting: number) =>
      cancelStory({
        cancelled: true,
        refunded: Math.max(0, total - ready - casting),
        finishing: casting,
        total,
        sliceCredits: 20,
        refundRecorded: true,
      });

    // Eight dispatched, none delivered, all expired after the cancel.
    expect(fromCounts(8, 0, 0)).toContain("160 credits back");
    expect(fromCounts(8, 0, 0)).not.toContain("nothing to refund");
    // Mid-arc, five still landing.
    expect(fromCounts(8, 0, 5)).toBe("Cancelled — 3 of 8 refunded · 5 finishing");
    // Two genuinely delivered before the cancel: those are not refunded.
    expect(fromCounts(8, 2, 0)).toContain("120 credits back");
  });

  it("survives a reload with no stored sentence, because it derives", () => {
    // Nothing is read from the store here except the recorded flag; the counts
    // come from the projection, which the poll restores on its own.
    expect(arc(5, 3)).toBe("Cancelled — 5 of 8 refunded · 3 finishing");
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  dispatchOnScreen,
  followingChipLabel,
  lineageForDispatch,
  lineageOnScreen,
  type SheetLineage,
} from "./followLineage";

/**
 * "FOLLOWING 07" OVER A FOLLOW OF 04 (#2587).
 *
 * His report: *"if i follow someone on that sheet for example 04 the next sheet
 * will still say following 07 until generations begin while it's
 * pre-loading"*. The chip read the LOADED roll's lineage, and between the press
 * and the new roll landing the loaded roll is the previous follow.
 *
 * The scenario arm walks the real sequence of states the sheet passes through;
 * each helper arm has its opposite beside it, so a helper that always returns
 * the press, or never does, reddens.
 */

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/* Sheet 03 is a follow of face 07 on roll 02; the customer presses Follow on 04. */
const loadedFollowOf07: SheetLineage = {
  fromCandidateId: "cand-07",
  fromCandidateLabel: "07",
  fromRollId: "roll-02",
};

function chipAt(state: {
  pressed: SheetLineage | null;
  awaitingNewRoll: boolean;
  viewedRollId: string | null;
  loadedRollId: string | null;
  activeRollId: string | null;
  loaded: SheetLineage | null;
}): string | null {
  const onScreen = dispatchOnScreen({
    pressed: state.pressed !== null,
    awaitingNewRoll: state.awaitingNewRoll,
    viewedRollId: state.viewedRollId,
    loadedRollId: state.loadedRollId,
    activeRollId: state.activeRollId,
  });
  return followingChipLabel({
    dispatchOnScreen: onScreen,
    dispatched: state.pressed,
    standingFollowId: state.loaded?.fromCandidateId ?? null,
    loaded: state.loaded,
  });
}

describe("the FOLLOWING chip names the face just pressed (#2587)", () => {
  it("following 07, then 04, says 04 from the press onward", () => {
    const pressed = lineageForDispatch({
      mode: "follow",
      pressed: { candidateId: "cand-04", indexLabel: "04", rollId: "roll-03" },
      standing: loadedFollowOf07,
      standingFollowId: "cand-07",
    });
    expect(pressed).toEqual({ fromCandidateId: "cand-04", fromCandidateLabel: "04", fromRollId: "roll-03" });

    /* Before the press: the loaded sheet is the follow of 07, and says so. */
    expect(
      chipAt({ pressed: null, awaitingNewRoll: false, viewedRollId: null, loadedRollId: "roll-03", activeRollId: "roll-03", loaded: loadedFollowOf07 }),
    ).toBe("07");
    /* The press: latch held, sheet 03 still loaded. This is his report's window. */
    expect(
      chipAt({ pressed, awaitingNewRoll: true, viewedRollId: null, loadedRollId: "roll-03", activeRollId: "roll-03", loaded: loadedFollowOf07 }),
    ).toBe("04");
    /* The new row exists (latch settled) but its getRoll has not answered. */
    expect(
      chipAt({ pressed, awaitingNewRoll: false, viewedRollId: null, loadedRollId: null, activeRollId: "roll-04", loaded: null }),
    ).toBe("04");
    /* The new roll is loaded: server truth takes over, and says the same face. */
    expect(
      chipAt({
        pressed,
        awaitingNewRoll: false,
        viewedRollId: null,
        loadedRollId: "roll-04",
        activeRollId: "roll-04",
        loaded: { fromCandidateId: "cand-04", fromCandidateLabel: "04", fromRollId: "roll-03" },
      }),
    ).toBe("04");
  });

  it("an open Roll again shows no stale chip while it prepares", () => {
    /* Chip dismissed on a follow sheet, then Roll again: an open roll. */
    const pressed = lineageForDispatch({ mode: "roll", standing: loadedFollowOf07, standingFollowId: null });
    expect(pressed).toEqual({});
    expect(lineageOnScreen({ dispatchOnScreen: true, dispatched: pressed, loaded: loadedFollowOf07 })).toEqual({});
    expect(followingChipLabel({ dispatchOnScreen: true, dispatched: pressed, standingFollowId: null, loaded: loadedFollowOf07 })).toBeNull();
  });

  it("Roll again under a standing chip keeps the same family", () => {
    const pressed = lineageForDispatch({ mode: "roll", standing: loadedFollowOf07, standingFollowId: "cand-07" });
    expect(pressed.fromCandidateLabel).toBe("07");
    expect(pressed.fromRollId).toBe("roll-02");
  });

  it("outside the window the chip is the loaded roll's, exactly as before", () => {
    /* No press recorded. */
    expect(followingChipLabel({ dispatchOnScreen: false, dispatched: null, standingFollowId: "cand-07", loaded: loadedFollowOf07 })).toBe("07");
    /* A press recorded, but the window is shut (the opposite of the arm above). */
    expect(
      followingChipLabel({ dispatchOnScreen: false, dispatched: { fromCandidateLabel: "04" }, standingFollowId: "cand-07", loaded: loadedFollowOf07 }),
    ).toBe("07");
    expect(followingChipLabel({ dispatchOnScreen: false, dispatched: null, standingFollowId: null, loaded: loadedFollowOf07 })).toBeNull();
    expect(lineageOnScreen({ dispatchOnScreen: false, dispatched: { fromRollId: "x" }, loaded: loadedFollowOf07 })).toBe(loadedFollowOf07);
  });

  it("the window: open from the press, shut by a chosen roll or the new roll loading", () => {
    const base = { pressed: true, awaitingNewRoll: true, viewedRollId: null, loadedRollId: "roll-03", activeRollId: "roll-03" };
    expect(dispatchOnScreen(base)).toBe(true);
    expect(dispatchOnScreen({ ...base, pressed: false })).toBe(false);
    expect(dispatchOnScreen({ ...base, viewedRollId: "roll-01" })).toBe(false);
    expect(dispatchOnScreen({ ...base, awaitingNewRoll: false })).toBe(false);
    expect(dispatchOnScreen({ ...base, awaitingNewRoll: false, activeRollId: "roll-04" })).toBe(true);
    expect(dispatchOnScreen({ ...base, awaitingNewRoll: false, loadedRollId: "roll-04", activeRollId: "roll-04" })).toBe(false);
  });
});

describe("the sheet reads its lineage words through the window, never the loaded roll raw", () => {
  it("the chip, the echo sentence and the FROM pill all derive from it", async () => {
    const source = await readFile(SHEET, "utf8");
    expect(source).toContain("FOLLOWING {followingChip}");
    expect(source).not.toContain("FOLLOWING {roll.data?.lineage.fromCandidateLabel");
    /* The only raw lineage read left is the anchor Roll again sends — server truth on purpose. */
    expect(source).not.toMatch(/roll\.data\?\.lineage\.fromCandidateLabel/);
    expect(source).not.toMatch(/roll\.data\?\.lineage\.fromRollId/);
    expect(source).toContain("const fromRollId = shownLineage?.fromRollId;");
    expect(source).toContain("const face = shownLineage?.fromCandidateLabel;");
    /* And the press is recorded where it fires. */
    const dispatch = source.slice(source.indexOf("const dispatchRoll = "), source.indexOf("follow.mutate("));
    expect(dispatch).toContain("setDispatchedLineage(\n      lineageForDispatch({");
  });
});

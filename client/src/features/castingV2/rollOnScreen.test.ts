import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { showingProvisionalRoll } from "./rollOnScreen";

/**
 * THE SHEET LOCKED LOOKING BECAUSE IT ASKED ABOUT SPENDING (card 1232).
 *
 * His report: *"when i roll a new sheet it goes into like a buffering or
 * loading state when i cant swiotch back to sheet 1 or anything until the
 * buffering or loading finishes?"* — the grid, the header, the rail's selected
 * pill and the skeleton label all read `awaitingNewRoll`, which is true from
 * the click until the new roll's row lands. His click on 01 set `viewedRollId`
 * and nothing downstream read it.
 *
 * Every arm here has its opposite beside it, because a predicate that answers
 * `true` for everything passes the skeleton arms and re-locks the sheet, and
 * one that answers `false` for everything passes the freed-view arms and takes
 * the skeletons off a roll that is genuinely being cast (working law 2 — the
 * instrument gets both controls before its verdicts count).
 */
describe("which roll is on screen while one is being paid for", () => {
  it("nothing is provisional when no dispatch is in flight", () => {
    /* The ordinary sheet: her faces, her header, her pill. */
    expect(showingProvisionalRoll({ awaitingNewRoll: false, viewedRollId: null })).toBe(false);
    /* And the same while she reads an older roll — history is not a dispatch. */
    expect(showingProvisionalRoll({ awaitingNewRoll: false, viewedRollId: "roll-01" })).toBe(false);
  });

  it("the roll being paid for is on screen when she has chosen nothing else", () => {
    /*
      THE ARM 1110 OWNS. `dispatchRoll` sets `viewedRollId` to null at the
      click, so null during a dispatch is the roll she just bought — it has no
      id yet to be named by. This is the state that must show eight skeletons,
      the "casting 8" header and the dashed pill as selected.
    */
    expect(showingProvisionalRoll({ awaitingNewRoll: true, viewedRollId: null })).toBe(true);
  });

  it("choosing a roll to look at takes the provisional chrome off the screen", () => {
    /*
      THE ARM THIS CARD OWNS, and the whole of his report. The dispatch is
      still in flight — the money is still committed, Roll again is still
      disabled — but she asked for 01, so 01's tiles and 01's header are what
      the page must draw.
    */
    expect(showingProvisionalRoll({ awaitingNewRoll: true, viewedRollId: "roll-01" })).toBe(false);
  });

  it("an empty string is a chosen roll, not an absent one", () => {
    /*
      `viewedRollId` is `string | null` and the absence is the null. A `??`
      reading would have folded "" in with null and put the skeletons back over
      a roll she had asked for; `=== null` is the reading, and this pins it.
      (`nullish-default-misses-empty-string` is this repository's own scar.)
    */
    expect(showingProvisionalRoll({ awaitingNewRoll: true, viewedRollId: "" })).toBe(false);
  });
});

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/** Strips block comments so an arm reads code rather than its own prose. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * THE TWO QUESTIONS MUST STAY APART.
 *
 * The predicate above is correct in isolation and worth nothing if the page
 * goes on asking the latch. There is no page-render harness in this client
 * (no jsdom, no Testing Library — `refineBusy` is the house pattern: a pure
 * module unit-tested, plus a source arm pinning that the page reads it), so
 * these arms read the source. **Declared rather than implied**: a render test
 * over the real component would be the stronger instrument, and law 6's drive
 * in the running app is what stands in for it here.
 */
describe("the page asks the view question about the view", () => {
  it("every surface the customer LOOKS at reads the roll on screen", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    expect(source).toContain(
      "const showingProvisional = showingProvisionalRoll({ awaitingNewRoll, viewedRollId });",
    );
    /* The grid. Skeletons over her faces is the symptom he reported. */
    expect(source).toContain(
      "&& (showingProvisional || session.isPending || (!roll.data && (startingRoll || shownRollId)))",
    );
    /* The label is a claim about the provider, so it goes with the grid. */
    expect(source).toContain("label={showingProvisional ? `CASTING 0${index + 1}` : undefined}");
    /* One selected pill, and it is the one whose tiles are up (1110's rule). */
    expect(source).toContain("const shown = !showingProvisional && entry.rollId === shownRollId;");
    expect(source).toContain(
      '`dpc-rollrail__item${showingProvisional ? " is-shown" : ""} dpc-rollrail__item--provisional`',
    );
  });

  it("every surface she SPENDS through still reads the dispatch latch", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    /*
      THE ARM THAT STOPS THIS FIX BECOMING A MONEY DEFECT. Looking at 01 while
      02 is being paid for must not re-arm Roll again or any tile's Follow —
      that is eight ways to buy the same thing twice, which is what `paidBusy`
      was added for. If a later tidy-up folds these onto `showingProvisional`
      because "they are all the same flag", this is what reddens.
    */
    expect(source).toContain("paidBusy={awaitingNewRoll}");
    expect(source).toContain("disabled={awaitingNewRoll}");
    expect(source).toContain('{awaitingNewRoll ? "Rolling…" : "Roll again"}');
    /*
      And the pill itself EXISTS for the whole dispatch whatever she is looking
      at — it carries the live dot that says a roll is being cast at all.
      Gating its existence on the view would hide the work; only its "you are
      here" mark moves.
    */
    expect(source).toContain(
      "const provisionalIndex = awaitingNewRoll ? provisionalRollIndex || null : null;",
    );
  });
});

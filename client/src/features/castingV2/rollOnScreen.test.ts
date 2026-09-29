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
    expect(showingProvisionalRoll({ rollInFlight: false, viewedRollId: null })).toBe(false);
    /* And the same while she reads an older roll — history is not a dispatch. */
    expect(showingProvisionalRoll({ rollInFlight: false, viewedRollId: "roll-01" })).toBe(false);
  });

  it("the roll being paid for is on screen when she has chosen nothing else", () => {
    /*
      THE ARM 1110 OWNS. `dispatchRoll` sets `viewedRollId` to null at the
      click, so null during a dispatch is the roll she just bought — it has no
      id yet to be named by. This is the state that must show eight skeletons,
      the "casting 8" header and the dashed pill as selected.
    */
    expect(showingProvisionalRoll({ rollInFlight: true, viewedRollId: null })).toBe(true);
  });

  it("choosing a roll to look at takes the provisional chrome off the screen", () => {
    /*
      THE ARM THIS CARD OWNS, and the whole of his report. The dispatch is
      still in flight — the money is still committed, Roll again is still
      disabled — but she asked for 01, so 01's tiles and 01's header are what
      the page must draw.
    */
    expect(showingProvisionalRoll({ rollInFlight: true, viewedRollId: "roll-01" })).toBe(false);
  });

  it("an empty string is a chosen roll, not an absent one", () => {
    /*
      `viewedRollId` is `string | null` and the absence is the null. A `??`
      reading would have folded "" in with null and put the skeletons back over
      a roll she had asked for; `=== null` is the reading, and this pins it.
      (`nullish-default-misses-empty-string` is this repository's own scar.)
    */
    expect(showingProvisionalRoll({ rollInFlight: true, viewedRollId: "" })).toBe(false);
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
      "const showingProvisional = showingProvisionalRoll({ rollInFlight, viewedRollId });",
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
      "const provisionalIndex = rollInFlight ? provisionalRollIndex || rolls.length + 1 : null;",
    );
  });
});

/**
 * THE SHEET ASKS THE SERVER TOO, AND THE PILL IS A ROAD (#1454).
 *
 * His report, 2026-09-27: *"i cannot move back to sheet 4 to view the loading
 * state cards, additionally if i exit the sheet and then come back into it
 * sheet 4 will not show at all until its finished generating the cards"*.
 *
 * Two facts, one feeling. The latch above is a memory this component owns, so
 * a reload destroys it and the sheet draws itself as idle over a roll that is
 * still compiling; and the pill that says where the work is was a `span`, while
 * the other road back — "Back to the latest roll" — cannot render in this state
 * at all, because `activeRollId` still names the PREVIOUS roll until the new
 * row lands.
 *
 * Source arms for the same reason the ones above are: there is no render
 * harness in this client. Law 6's drive in the running app is what stands in
 * for one, and the frames are on the PR.
 */
describe("a roll being cast survives leaving the sheet", () => {
  it("the in-flight fact reads the server as well as this tab's own click", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    /*
      THE WHOLE OF THE RE-ENTRY HALF. `awaitingNewRoll` alone cannot answer on a
      load that did not make the click, and the roll's row does not exist yet —
      so without the server's answer there is nothing on the page to draw.
    */
    expect(source).toContain(
      "const rollInFlight = awaitingNewRoll || (session.data?.castingNow ?? false);",
    );
  });

  it("the spending half is NOT widened by it", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    /*
      THE CONTROL THAT STOPS THIS BECOMING A MONEY DEFECT, and the reason it is
      its own arm rather than a line in the one above: `rollInFlight` is true in
      every tab of a sheet that is compiling, so folding it into the paid
      affordances would disable Roll again on a sheet whose roll this tab never
      started — and, worse, ENABLE it the moment a stale stamp ages out.
      Spending reads the latch this tab holds. Nothing else.
    */
    expect(source).not.toContain("paidBusy={rollInFlight}");
    expect(source).not.toContain("disabled={rollInFlight}");
    expect(source).not.toContain('{rollInFlight ? "Rolling…" : "Roll again"}');
  });

  it("the provisional pill is the way back to the roll being cast", async () => {
    const source = await readFile(SHEET, "utf8");
    /*
      Read on the RAW source, comments and all, because what is pinned is one
      JSX element and the `code()` strip would take its neighbours' prose with
      it and leave the two halves of this element unanchored to each other.

      It presses back to the roll being paid for — `setViewedRollId(null)`,
      which is the same act "Back to the latest roll" performs and the same act
      the click that started the roll performed. A `span` here is his report.
    */
    const marker = "dpc-rollrail__item--provisional";
    const opensAt = source.lastIndexOf("<", source.indexOf(marker + "`"));
    const pill = source.slice(opensAt, opensAt + 700);
    expect(pill.startsWith("<button")).toBe(true);
    expect(pill).toContain("onClick={() => setViewedRollId(null)}");
    /* And it is still the dashed, unfinished one — a road back, not a landed roll. */
    expect(pill).toContain(marker);
  });
});

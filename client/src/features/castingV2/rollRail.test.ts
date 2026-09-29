import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE ROLL RAIL HAS ONE SELECTED PILL (card 1110).
 *
 * The founder rolled a fourth sheet from the third's page and saw the rail
 * light 03 as selected while a dashed 04 stood beside it, over 04's skeletons
 * and under a header saying "Roll 4". His words: *"its still on sheet 3 thats
 * highlighted and i cant click onto 4 until it starts generating and 3 is
 * showing me 04's loading state."*
 *
 * The header and the tiles go optimistic on the dispatch latch; the real
 * pills read `shownRollId`, which still names the old roll until the new row
 * lands. So for a second or two the rail carried two "you are here" marks.
 * The real pills now stand down for exactly as long as the provisional pill
 * is up, which is what these arms pin — read at the source, because the
 * expression is the kind a later tidy-up simplifies back to the bug.
 *
 * ⚠ THE FACT THE PILLS STAND DOWN FOR IS NARROWER SINCE CARD 1232, AND 1110'S
 * CLAIM IS UNCHANGED.
 *
 * It was `awaitingNewRoll` — "a roll is being paid for" — and that locked
 * LOOKING: his click on 01 mid-dispatch set `viewedRollId`, nothing downstream
 * read it, and the sheet read as frozen. It is now `showingProvisional`, which
 * is that same fact AND the provisional roll being the one on screen. 1110's
 * rule survives word for word — exactly one pill is selected, and it is the one
 * whose tiles are up. What changed is that the tiles can now be 01's.
 *
 * So these arms still pin "no two you-are-here marks", against the expression
 * that is true today. `rollOnScreen.test.ts` owns the predicate itself and the
 * arm that the paid affordances did NOT move with it.
 *
 * ⚠ AND THE DASHED PILL IS A BUTTON SINCE #1454 — HIS OWN REPORT OVERTURNED
 * THE "INERT ON PURPOSE" READING THAT USED TO SIT IN THIS FILE.
 *
 * This suite carried, in its own words, *"I can't click onto 4 for that second
 * or two is the design, not the bug"*. On 2026-09-27 he reported the opposite:
 * *"i cannot move back to sheet 4 to view the loading state cards"*. The
 * argument for inertness — a click would show an empty sheet — was answering a
 * question nobody asks of this pill: pressing it navigates to NOTHING, it
 * clears the chosen roll (`setViewedRollId(null)`), which is the same act the
 * click that started the roll performed. There were no rows to show either way.
 *
 * What made it worse than a missing affordance is that it was the ONLY road:
 * while the new roll has no row, `activeRollId` still names the previous one,
 * so `viewingHistory` is false and "Back to the latest roll" does not render at
 * all. 1110's rule is still untouched — exactly one pill is selected, and it is
 * the one whose tiles are up. What changed is that pressing this one is how you
 * get those tiles back.
 */
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/** Strips block comments so an arm reads code rather than its own prose. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the roll rail: one selected pill while a roll is being paid for", () => {
  it("a real pill is selected only when the provisional roll is not the one shown", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    const rail = source.slice(source.indexOf('role="tablist" aria-label="Rolls in this sheet"'));
    expect(rail, "the rail must be readable").toContain("rolls.map((entry)");
    /*
      THE ARM THAT MATTERS. `entry.rollId === shownRollId` alone is the bug:
      `shownRollId` is the OLD roll until the poll lands, so it lights 03 under
      04's skeletons. The gate on `showingProvisional` is what stands it down —
      and, since 1232, hands the mark back the moment she picks a real roll.
    */
    expect(rail.slice(0, 1600)).toContain("const shown = !showingProvisional && entry.rollId === shownRollId;");
    /* And both the accessible state and the visual one read that single fact. */
    expect(rail.slice(0, 1600)).toContain("aria-selected={shown}");
    expect(rail.slice(0, 1600)).toContain('className={`dpc-rollrail__item${shown ? " is-shown" : ""}`}');
  });

  it("the provisional pill is the selected one while its tiles are up, and it is the way back to them", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    const rail = source.slice(source.indexOf('role="tablist" aria-label="Rolls in this sheet"'));
    /* Bounded at the block's own close, so the arm cannot read the history button after it. */
    const start = rail.indexOf("{provisionalIndex ? (");
    const provisional = rail.slice(start, rail.indexOf(") : null}", start));
    expect(provisional, "the provisional pill must be readable").toContain("dpc-rollrail__item--provisional");
    /*
      Selected WHEN it is the roll the header and the grid are showing — which
      since 1232 is "she has not clicked away", not "a dispatch is in flight".
      The pill is still drawn either way; only `is-shown` moves.
    */
    expect(provisional).toContain(
      '`dpc-rollrail__item${showingProvisional ? " is-shown" : ""} dpc-rollrail__item--provisional`',
    );
    /*
      ⚠ PRESSABLE, AND THIS ARM IS THE REVERSAL OF WHAT STOOD HERE (#1454).
      It read `not.toContain("onClick")` and `toContain("<span")` — his report
      is that he could not get back to the roll being cast, and this element is
      the only road there. It navigates to the roll being paid for, which is the
      absence of a chosen roll and needs no rows to exist.
    */
    expect(provisional).toContain("onClick={() => setViewedRollId(null)}");
    expect(provisional).toContain("<button");
    /* A tab in a tablist, like the pills beside it, so the mark and the role
       agree about which one you are on. */
    expect(provisional).toContain('role="tab"');
    expect(provisional).toContain("aria-selected={showingProvisional}");
  });

  it("the provisional pill only exists while a dispatch is in flight", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    /*
      The same gate from the other side: if the provisional pill could outlive
      the roll being cast, the real pills would stand down with nothing
      selected. The two are one fact read twice, and this pins the second
      reading.

      ⚠ THE FACT IS `rollInFlight` SINCE #1454, NOT `awaitingNewRoll`, AND THE
      FALLBACK CAME WITH IT. `awaitingNewRoll` is this component's memory of its
      own click, so on a load that did not make the click it is false and
      `provisionalRollIndex` is 0 — which is precisely the road his report is
      about (leave the sheet mid-cast, come back, and nothing says a roll is
      happening). The sheet asks the server too, and falls back to the next
      index the header has always fallen back to.
    */
    expect(source).toContain("const provisionalIndex = rollInFlight ? provisionalRollIndex || rolls.length + 1 : null;");
  });
});

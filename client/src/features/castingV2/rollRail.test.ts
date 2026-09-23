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
 */
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/** Strips block comments so an arm reads code rather than its own prose. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the roll rail: one selected pill while a roll is being paid for", () => {
  it("a real pill is selected only when no dispatch is in flight", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    const rail = source.slice(source.indexOf('role="tablist" aria-label="Rolls in this sheet"'));
    expect(rail, "the rail must be readable").toContain("rolls.map((entry)");
    /*
      THE ARM THAT MATTERS. `entry.rollId === shownRollId` alone is the bug:
      `shownRollId` is the OLD roll until the poll lands, so it lights 03 under
      04's skeletons. The gate on `awaitingNewRoll` is what stands it down.
    */
    expect(rail.slice(0, 1200)).toContain("const shown = !awaitingNewRoll && entry.rollId === shownRollId;");
    /* And both the accessible state and the visual one read that single fact. */
    expect(rail.slice(0, 1200)).toContain("aria-selected={shown}");
    expect(rail.slice(0, 1200)).toContain('className={`dpc-rollrail__item${shown ? " is-shown" : ""}`}');
  });

  it("the provisional pill is the selected one while it is up, and it is inert", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    const rail = source.slice(source.indexOf('role="tablist" aria-label="Rolls in this sheet"'));
    /* Bounded at the block's own close, so the arm cannot read the history button after it. */
    const start = rail.indexOf("{provisionalIndex ? (");
    const provisional = rail.slice(start, rail.indexOf(") : null}", start));
    expect(provisional, "the provisional pill must be readable").toContain("dpc-rollrail__item--provisional");
    /* Selected: it is the roll the header and the grid are already showing. */
    expect(provisional).toContain('className="dpc-rollrail__item is-shown dpc-rollrail__item--provisional"');
    /*
      Inert, on purpose and unchanged: the roll has no rows yet, so a click
      would show an empty sheet. It becomes the real pill when the row lands.
      "I can't click onto 4" for that second or two is the design, not the bug.
    */
    expect(provisional).not.toContain("onClick");
    expect(provisional).toContain("<span");
  });

  it("the provisional pill only exists while a dispatch is in flight", async () => {
    const source = code(await readFile(SHEET, "utf8"));
    /*
      The same gate from the other side: if the provisional pill could outlive
      `awaitingNewRoll`, the real pills would stand down with nothing selected.
      The two are one fact read twice, and this pins the second reading.
    */
    expect(source).toContain("const provisionalIndex = awaitingNewRoll ? provisionalRollIndex || null : null;");
  });
});

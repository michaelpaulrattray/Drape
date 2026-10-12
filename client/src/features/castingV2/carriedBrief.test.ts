/**
 * #2385 — A REFUSED BRIEF'S WORDS COME BACK.
 *
 * The casting page leaves for the sheet before the roll is read, so a refused
 * brief made no roll and both boxes were empty: the sheet's (drawn from a roll
 * that does not exist) and the casting page's after "Edit the brief" (which
 * carried nothing). The words now ride the history state both ways.
 *
 * Three groups: the carrier itself (round trip, and everything that is not our
 * shape reads as nothing), what the sheet's box starts from (both directions,
 * so a sheet that has cast never falls back to the old words), and the two
 * pages' wiring read at their source — the only place the hop between them is
 * written. The browser drive on the PR is the end-to-end proof.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { carriedBriefState, readCarriedBrief, sheetBoxStart } from "./carriedBrief";
import { readSheetGone, sheetGoneState } from "./sheetGone";

const BRIEF =
  "A weathered fisher in their sixties, salt-white beard, oilskin coat, eyes that have watched a lot of weather.";

describe("the words travel in history state", () => {
  it("round-trips, trimmed the way the roll sends them", () => {
    expect(readCarriedBrief(carriedBriefState(BRIEF))).toBe(BRIEF);
    expect(readCarriedBrief(carriedBriefState(`  ${BRIEF}\n`))).toBe(BRIEF);
  });

  it("a plain visit carries nothing", () => {
    expect(readCarriedBrief(null)).toBe("");
    expect(readCarriedBrief(undefined)).toBe("");
  });

  it("anything not our shape reads as nothing", () => {
    expect(readCarriedBrief({ carriedBrief: 42 })).toBe("");
    expect(readCarriedBrief("a string somebody else left here")).toBe("");
  });

  it("a GONE sheet still carries nothing (#890 is not reversed), and the two carriers cannot read each other", () => {
    expect(readCarriedBrief(sheetGoneState("That sheet expired and was cleared. Start a new one."))).toBe("");
    expect(readSheetGone(carriedBriefState(BRIEF))).toBe("");
  });
});

describe("what the sheet's box starts from", () => {
  it("a sheet with no roll yet, or a refused one that made none, starts from the arrived words", () => {
    expect(sheetBoxStart({ shownBrief: "", activeRollId: null, arrived: BRIEF })).toBe(BRIEF);
  });

  it("the roll's own sentence wins whenever there is one", () => {
    expect(sheetBoxStart({ shownBrief: "the cast sentence", activeRollId: "roll-1", arrived: BRIEF }))
      .toBe("the cast sentence");
  });

  it("once a roll is active the arrival is spent, even while its sentence is still loading", () => {
    expect(sheetBoxStart({ shownBrief: "", activeRollId: "roll-1", arrived: BRIEF })).toBe("");
  });

  it("a plain visit to a sheet with no roll is the empty box it always was", () => {
    expect(sheetBoxStart({ shownBrief: "", activeRollId: null, arrived: "" })).toBe("");
  });
});

/*
  THE HOP IS WRITTEN IN THE PAGES, so the pages are read. Each arm slices the
  one call it is about out of the source where it can, so an identical line
  elsewhere cannot satisfy it.
*/
const pages = resolve(__dirname, "../../pages");
const lobby = readFileSync(resolve(pages, "CastingV2.tsx"), "utf8");
const sheet = readFileSync(resolve(pages, "CastingSheet.tsx"), "utf8");

describe("the two pages carry the words", () => {
  it("the casting page sends the words it is casting with the hop onto the sheet", () => {
    const hop = lobby.match(/navigate\(`\/app\/casting\/s\/\$\{session\.sessionId\}`[^;]*;/);
    /* `briefText` is the argument the roll itself sends (trimmed by the reader, as the roll trims it), not the box. */
    expect(hop?.[0]).toContain("carriedBriefState(briefText)");
  });

  it("the casting page's box starts from the carried words", () => {
    expect(lobby).toMatch(/useState\(\(\) => readCarriedBrief\(historyState\)\)/);
    expect(lobby).toMatch(/const \[brief, setBrief\] = useState\(carriedOnArrival\);/);
  });

  it("the failure's own button hands the box back", () => {
    const start = sheet.indexOf("setDispatchFailure(null);");
    const end = sheet.indexOf("{failureActionLabel(visibleFailure.kind)}");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(sheet.slice(start, end)).toContain('navigate("/app/casting", { state: carriedBriefState(brief) })');
  });

  it("the sheet's box reads the arrival through `sheetBoxStart`", () => {
    expect(sheet).toMatch(/displayText\(draft, sheetBoxStart\(\{ shownBrief, activeRollId, arrived: arrivedBrief \}\)\)/);
  });
});

/*
  #2388 — THE DOCK ROW WRAPS ON A PHONE. A stylesheet cannot be laid out in
  node, so the measured proof is the 390 drive recorded on the PR; this pins the
  two halves that make it possible: the row wears the class with no inline
  style that would overrule the wrap, and the class wraps under 460px.
*/
describe("the sheet dock's brief row on a phone", () => {
  const css = readFileSync(resolve(__dirname, "castingV2.css"), "utf8");

  it("the row wears the class and carries no inline style that would beat the stylesheet", () => {
    const row = sheet.match(/<div className="dp-row dpc-dockrow"[^>]*>/);
    expect(row).not.toBeNull();
    expect(row?.[0]).not.toContain("style=");
  });

  it("under 460px the row wraps and the box and the button each take the full width", () => {
    const narrow = css.match(/@media \(max-width: 460px\) \{\s*\.dp-row\.dpc-dockrow[\s\S]*?\n\}/);
    expect(narrow?.[0]).toMatch(/\.dp-row\.dpc-dockrow \{ flex-wrap: wrap; \}/);
    expect(narrow?.[0]).toMatch(/\.dp-row\.dpc-dockrow > \.dp-field \{ flex: 1 1 100%; \}/);
    expect(narrow?.[0]).toMatch(/\.dp-row\.dpc-dockrow > \.dp-btn \{ flex: 1 1 100%; \}/);
  });
});

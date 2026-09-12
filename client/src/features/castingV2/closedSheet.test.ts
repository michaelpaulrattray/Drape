import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  START_NEW_SHEET_LABEL,
  carriedBriefState,
  closedSheetLine,
  closedSheetStatus,
  readCarriedBrief,
} from "./closedSheet";

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const LOBBY = new URL("../../pages/CastingV2.tsx", import.meta.url);

describe("a closed sheet is one that cannot be rolled on", () => {
  it("names the two closed states and nothing else", () => {
    expect(closedSheetStatus("expired")).toBe("expired");
    expect(closedSheetStatus("abandoned")).toBe("abandoned");
    expect(closedSheetStatus("open")).toBeNull();
  });

  /*
    Absent is OPEN. The session query is in flight for a beat on every visit,
    and a dock that flashed "This sheet has expired" over a live sheet while
    the answer was still loading would be the closed dock at its most
    alarming — and wrong.
  */
  it("reads a session not yet loaded as open, never as closed", () => {
    expect(closedSheetStatus(undefined)).toBeNull();
    expect(closedSheetStatus(null)).toBeNull();
    expect(closedSheetStatus("")).toBeNull();
  });

  it("says expired for an expiry and closed for a Start over — never one for the other", () => {
    expect(closedSheetLine("expired")).toBe("This sheet has expired");
    expect(closedSheetLine("abandoned")).toBe("This sheet was closed");
  });

  it("offers the one thing the page can still do, in his words", () => {
    expect(START_NEW_SHEET_LABEL).toBe("Start a new sheet with these words");
  });
});

describe("the words travel to the casting box", () => {
  it("carries the box's words, trimmed", () => {
    expect(carriedBriefState("  a wiry cyclist in her 20s  ")).toEqual({
      brief: "a wiry cyclist in her 20s",
    });
  });

  it("reads back exactly what was carried", () => {
    expect(readCarriedBrief(carriedBriefState("a wiry cyclist in her 20s"))).toBe(
      "a wiry cyclist in her 20s",
    );
  });

  /*
    History state is untyped and arrives as `null` on a plain visit. Every
    shape that is not ours reads as an empty box — the lobby as it always was —
    rather than as a crash on the page every roll starts from.
  */
  it("reads anything that is not a carry as an empty box", () => {
    expect(readCarriedBrief(null)).toBe("");
    expect(readCarriedBrief(undefined)).toBe("");
    expect(readCarriedBrief("a string")).toBe("");
    expect(readCarriedBrief({})).toBe("");
    expect(readCarriedBrief({ brief: 42 })).toBe("");
    expect(readCarriedBrief({ brief: "   " })).toBe("");
  });
});

/*
  D-101's fourth gate, pointed at the two surfaces: the module above can be
  perfect and the pages can still not use it. These read the pages' bytes for
  the wiring — the sheet draws the closed dock from the module's own words and
  hands the lobby the module's own shape; the lobby reads that shape and
  nothing else.
*/
describe("the two pages are wired to it", () => {
  it("the sheet offers the new-sheet press from the module and never a literal", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("START_NEW_SHEET_LABEL");
    expect(sheet).toContain("closedSheetLine(");
    expect(sheet).toContain("closedSheetStatus(");
    expect(sheet).toContain("carriedBriefState(");
    expect(sheet).not.toContain('"Start a new sheet with these words"');
  });

  /*
    The press is FREE, and the sheet may not put it behind a paid mutation:
    the one function that starts a roll is the lobby's, and the money press
    stays on the surface that prices it. So the closed dock navigates and
    does nothing else.
  */
  it("the sheet carries the words by navigation, not by a roll", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toMatch(/navigate\("\/casting", \{ state: carriedBriefState\(/);
  });

  it("the lobby reads the carry through the module, as the box's initial value", async () => {
    const lobby = await readFile(LOBBY, "utf8");
    expect(lobby).toContain("readCarriedBrief(");
    expect(lobby).toContain("useHistoryState");
  });
});

import { describe, expect, it } from "vitest";

import { CASTING_PATHS } from "@shared/castingPaths";

import {
  CASTING_PATH_LINES,
  CASTING_PATH_NAMES,
  CASTING_PATH_ORDER,
  pathSwitchNote,
  wardrobeLineText,
} from "./castingPathCopy";

/*
  THE POPULATION IS DERIVED FROM THE VOCABULARY, NEVER RE-LISTED (working law
  4, and the list-stops-being-the-list class). A third path added to
  `CASTING_PATHS` reddens these arms rather than shipping an unlabelled pill.
*/
describe("every path the product has can be drawn and described", () => {
  it("names and describes each member of the closed vocabulary", () => {
    for (const path of CASTING_PATHS) {
      expect(CASTING_PATH_NAMES[path]?.length ?? 0).toBeGreaterThan(0);
      expect(CASTING_PATH_LINES[path]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("draws every one of them and invents none", () => {
    expect([...CASTING_PATH_ORDER]).toEqual([...CASTING_PATHS]);
  });

  /*
    §6: "default Wardrobe" — and the constant that says so is
    `DEFAULT_CASTING_PATH`, which carries the founder's own unprompted ruling.
    The control draws the default first; the order is the reading order.
  */
  it("puts the default first, because that is the one already chosen", () => {
    expect(CASTING_PATH_ORDER[0]).toBe("wardrobe");
  });
});

/*
  ⚠ §5.1, and it cost a court: the roll frame is WAIST-UP, so "tattoos
  anywhere" is a promise the picture cannot keep. This is the one word the copy
  may never contain, on either line.
*/
describe("neither line promises what a waist-up frame cannot deliver", () => {
  it("never says anywhere", () => {
    for (const path of CASTING_PATHS) {
      expect(CASTING_PATH_LINES[path].toLowerCase()).not.toContain("anywhere");
    }
  });

  /*
    And the positive half, which is what makes the arm above mean something:
    Basics states the capability it actually opens, and states it as the CHEST.
    Without this, deleting the whole Basics sentence would pass the guard.
  */
  it("says what Basics actually opens, which is the chest", () => {
    expect(CASTING_PATH_LINES.basics.toLowerCase()).toContain("chest piece");
  });

  /* Wardrobe's line carries its own bound rather than only its offer. */
  it("says where ink lands on the Wardrobe path", () => {
    expect(CASTING_PATH_LINES.wardrobe.toLowerCase()).toContain("shows skin");
  });
});

describe("the re-roll box says when the next roll will differ", () => {
  it("says nothing while the control rests on the sheet's own path", () => {
    expect(pathSwitchNote({ sheetPath: "wardrobe", selected: "wardrobe" })).toBeNull();
    expect(pathSwitchNote({ sheetPath: "basics", selected: "basics" })).toBeNull();
  });

  it("names the path the next roll will use once they part", () => {
    expect(pathSwitchNote({ sheetPath: "wardrobe", selected: "basics" })).toBe(
      "Roll again casts on Basics.",
    );
    expect(pathSwitchNote({ sheetPath: "basics", selected: "wardrobe" })).toBe(
      "Roll again casts on Wardrobe.",
    );
  });
});

/*
  ⚠ THE PLAN/RECORD DISTINCTION (ruled fable-1483 ASK 1(b)).

  A sheet cast before the paths existed has no path for the pills to be a LABEL
  of, so the note may never fall silent on one — silence would leave two pills
  standing over eight faces nobody chose a path for, which reads as a claim
  that somebody did.
*/
describe("an unpathed sheet's switch is a PLAN, never a label", () => {
  it("always speaks, on either selection", () => {
    for (const selected of CASTING_PATHS) {
      const note = pathSwitchNote({ sheetPath: null, selected });
      expect(note, selected).not.toBeNull();
      expect(note).toContain(CASTING_PATH_NAMES[selected]);
    }
  });

  /*
    And it says the ABSENCE first. The plan alone ("Roll again casts on
    Wardrobe.") is true and would still leave the pills unexplained; naming
    what these eight are is what makes them unmistakably about the next roll.
  */
  it("says what these eight are before it says what comes next", () => {
    expect(pathSwitchNote({ sheetPath: null, selected: "wardrobe" })).toBe(
      "Nothing was chosen for these eight — Roll again casts on Wardrobe.",
    );
  });

  /*
    THE CONTROL that proves the case above can fail: a sheet that HAS a path
    and rests on it is the one state that is silent, and it must stay silent —
    otherwise "always speaks" would be true by the function never returning
    null at all.
  */
  it("CONTROL — a pathed sheet resting on its own path is still silent", () => {
    expect(pathSwitchNote({ sheetPath: "basics", selected: "basics" })).toBeNull();
  });
});

describe("the sheet's wardrobe line", () => {
  const line = "dark canvas work jacket, straight jeans, plain boots";

  /*
    §4.1(1): an engine-picked outfit is labelled where she reads it, because she
    is never told she asked for something she did not.
  */
  it("labels an engine pick as one", () => {
    expect(wardrobeLineText({ line, enginePicked: true })).toBe(`${line} · engine's pick`);
  });

  /*
    And it labels NOTHING ELSE. Her own stated outfit carrying "engine's pick"
    would be the same promise broken from the other side.
  */
  it("leaves her own outfit unlabelled", () => {
    expect(wardrobeLineText({ line, enginePicked: false })).toBe(line);
  });
});

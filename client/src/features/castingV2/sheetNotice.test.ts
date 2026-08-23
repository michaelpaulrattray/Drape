import { describe, expect, it } from "vitest";

import {
  BASICS_WARDROBE_NOTICE,
  FELL_BACK_NOTICE,
  STATED_WARDROBE_NOTICE,
  sheetNotice,
} from "./sheetNotice";

const quiet = {
  fellBack: false,
  statedWardrobe: false,
  /* Every roll in production, and every roll a test wrote before the paths
     existed: the default here is the world this file was written in. */
  wardrobePath: null,
  expiryNotice: null,
} as const;

describe("the sheet says one thing at a time", () => {
  it("says nothing when there is nothing to say", () => {
    expect(sheetNotice(quiet)).toBeNull();
  });

  /*
    The whole reason there is a slot rather than three lines: all three can be
    true at once on one sheet, and three grey sentences over the grid is how the
    one that mattered stops being read.
  */
  it("never stacks — the loudest wins outright", () => {
    expect(
      sheetNotice({
        ...quiet,
        fellBack: true,
        statedWardrobe: true,
        expiryNotice: "This sheet expires today — keep what's worth holding.",
      }),
    ).toBe(FELL_BACK_NOTICE);
  });

  it("puts the lost brief above the kept tee", () => {
    expect(sheetNotice({ ...quiet, fellBack: true, statedWardrobe: true })).toBe(
      FELL_BACK_NOTICE,
    );
  });

  it("puts the kept tee above the expiry, which is about the future", () => {
    expect(
      sheetNotice({
        ...quiet,
        statedWardrobe: true,
        expiryNotice: "This sheet expires tomorrow — keep what's worth holding.",
      }),
    ).toBe(STATED_WARDROBE_NOTICE);
  });

  it("still shows expiry when it is the only thing true", () => {
    const line = "This sheet expires today — keep what's worth holding.";
    expect(sheetNotice({ ...quiet, expiryNotice: line })).toBe(line);
  });
});

describe("what the lines actually say", () => {
  /*
    The fallback line describes an outage, not a user error, and must not push
    the user toward a paid retry over our own bad day.
  */
  it("never tells the user to pay again to fix our outage", () => {
    expect(FELL_BACK_NOTICE.toLowerCase()).not.toContain("roll again");
    expect(FELL_BACK_NOTICE.toLowerCase()).not.toContain("try again");
  });

  /*
    The wardrobe line names where clothes DO belong. A refusal that points
    somewhere is a direction; one that does not is just a no.
  */
  it("sends the outfit somewhere rather than only refusing it", () => {
    expect(STATED_WARDROBE_NOTICE).toContain("takes");
  });
});

/*
  THE TWO PATHS' THREE CELLS (design §6/§3.3).

  The rung that used to be one boolean is now a boolean and a path, and the
  three answers are three different products. Driven as a matrix rather than as
  three independent assertions, because the failure this guards against is one
  cell quietly borrowing another's sentence.
*/
describe("the stated-outfit line follows the path the sheet was cast on", () => {
  const stated = { ...quiet, statedWardrobe: true };

  it("keeps today's sentence on an unpathed sheet, which is every sheet in production", () => {
    expect(sheetNotice(stated)).toBe(STATED_WARDROBE_NOTICE);
  });

  /*
    §4(a): her words WIN on the Wardrobe path. Confessing that the sheet kept
    the studio tee would be a confession about something that did not happen —
    and the sheet is at that moment rendering the outfit she named.
  */
  it("says nothing on the Wardrobe path, because her outfit is what she is looking at", () => {
    expect(sheetNotice({ ...stated, wardrobePath: "wardrobe" })).toBeNull();
  });

  /* And suppression is suppression of THIS rung only — a lower line still
     gets the slot rather than the sheet going silent altogether. */
  it("hands the slot down to the expiry rather than swallowing it", () => {
    const line = "This sheet expires today — keep what's worth holding.";
    expect(sheetNotice({ ...stated, wardrobePath: "wardrobe", expiryNotice: line })).toBe(line);
  });

  it("says the Basics sentence on the Basics path, where the outfit really was set aside", () => {
    expect(sheetNotice({ ...stated, wardrobePath: "basics" })).toBe(BASICS_WARDROBE_NOTICE);
  });

  /*
    A path with NO stated outfit has no news at all on this rung — the line is
    about her instruction, not about the path. Without this the Basics arm
    could pass by firing on every Basics sheet ever cast.
  */
  it("is silent on both paths when she never named an outfit", () => {
    expect(sheetNotice({ ...quiet, wardrobePath: "basics" })).toBeNull();
    expect(sheetNotice({ ...quiet, wardrobePath: "wardrobe" })).toBeNull();
  });

  /* The top of the precedence is untouched by any of this. */
  it("still loses to a lost interpretation on either path", () => {
    expect(sheetNotice({ ...stated, fellBack: true, wardrobePath: "basics" })).toBe(
      FELL_BACK_NOTICE,
    );
  });
});

describe("what the Basics line actually says", () => {
  /*
    The remedy it names must be a control the customer can reach on the same
    screen — the re-roll box's own switch (§6). A refusal that names a road
    nobody can walk is the dead end D-180 forbids.
  */
  it("names the path that would honour the outfit, and names it as a roll", () => {
    expect(BASICS_WARDROBE_NOTICE).toContain("Wardrobe");
    expect(BASICS_WARDROBE_NOTICE.toLowerCase()).toContain("roll again");
  });

  /*
    And it must NOT borrow the unpathed sentence's promise. "Outfits come after
    Sign, in takes" is true of a studio-tee sheet; on Basics the record STAYS in
    basics, and takes are where an outfit arrives later — but the near-term
    remedy is the other path, which is what this line is for.
  */
  it("is not the studio-tee sentence wearing a new coat", () => {
    expect(BASICS_WARDROBE_NOTICE).not.toBe(STATED_WARDROBE_NOTICE);
    expect(BASICS_WARDROBE_NOTICE).not.toContain("studio tee");
  });
});

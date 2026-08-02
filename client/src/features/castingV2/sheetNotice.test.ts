import { describe, expect, it } from "vitest";

import {
  FELL_BACK_NOTICE,
  STATED_WARDROBE_NOTICE,
  sheetNotice,
} from "./sheetNotice";

const quiet = { fellBack: false, statedWardrobe: false, expiryNotice: null };

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

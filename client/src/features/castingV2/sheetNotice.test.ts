import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import {
  FELL_BACK_NOTICE,
  STATED_WARDROBE_NOTICE,
  sheetNotice,
} from "./sheetNotice";

/*
  The live road is the AUTHOR road — every production account has been on it
  since 2026-09-24 — so the shared fixture is an author-road sheet with nothing
  to say. Every arm below that expects the studio-tee sentence therefore has to
  say `authorRoad: false` out loud, which is the point: that sentence belongs to
  the house road and the reader should not have to go and find that out (#1262).
*/
const quiet = {
  fellBack: false,
  statedWardrobe: false,
  authorRoad: true,
  expiryNotice: null,
} as const;

/** A HOUSE-road sheet whose brief named an outfit — the rung's live cell. */
const houseStated = { ...quiet, statedWardrobe: true, authorRoad: false } as const;

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
        ...houseStated,
        fellBack: true,
        expiryNotice: "This sheet expires today — keep what's worth holding.",
      }),
    ).toBe(FELL_BACK_NOTICE);
  });

  it("puts the lost brief above the kept tee", () => {
    expect(sheetNotice({ ...houseStated, fellBack: true })).toBe(FELL_BACK_NOTICE);
  });

  it("puts the kept tee above the expiry, which is about the future", () => {
    expect(
      sheetNotice({
        ...houseStated,
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
  ⚠ **THE THREE CELLS ARE ONE AGAIN — AND THE SURVIVOR IS THE ONE A NAME-LED
  SWEEP WOULD HAVE DELETED** (#203 slice 2 step c).

  The rung was a boolean AND a path. Two of its three answers were the path's —
  a Basics sentence, and silence on Wardrobe — and both were reached only
  through `RollProjection.wardrobe?.path`, which has answered `null` for every
  roll a customer can open since slice 1. The cell that SURVIVES is the `null`
  branch, which is live copy on every stated-outfit sheet in production.

  So the arms below are written the way the predecessor's empty-list lesson
  demands: **every absence arm is preceded by a positive control that proves the
  subject still exists.** "No sentence mentions Basics" is satisfied by a module
  that returns null for everything, and a guard that cannot tell those two apart
  is not a guard.
*/
describe("the stated-outfit line is one sentence again, and it is the live one", () => {
  const stated = houseStated;

  /* THE POSITIVE CONTROL. Everything below is an absence; this is the presence
     it is an absence against. */
  it("still says the studio-tee sentence when she stated clothes", () => {
    expect(sheetNotice(stated)).toBe(STATED_WARDROBE_NOTICE);
  });

  /*
    ⚠ AND IT NO LONGER DEPENDS ON ANYTHING BUT THAT. The retired branch keyed on
    a second field; if one came back, some population of sheets would fall
    through to a different answer. Driven over the whole input space the type
    still admits rather than asserted about the source.
  */
  it("says it for every remaining combination of the facts it is handed", () => {
    for (const expiryNotice of [null, "This sheet expires today — keep what's worth holding."]) {
      expect(sheetNotice({ ...stated, expiryNotice })).toBe(STATED_WARDROBE_NOTICE);
    }
  });

  /* The rung is still about HER INSTRUCTION, not about the sheet. */
  it("is silent when she never named an outfit", () => {
    expect(sheetNotice(quiet)).toBeNull();
  });

  /* The top of the precedence is untouched by the retirement. */
  it("still loses to a lost interpretation", () => {
    expect(sheetNotice({ ...stated, fellBack: true })).toBe(FELL_BACK_NOTICE);
  });
});

/*
  ⚠ **THE STATED-OUTFIT RUNG IS THE HOUSE ROAD'S, AND ONLY THE HOUSE ROAD'S**
  (#1262). On the author road the brief reaches the engine verbatim, so the
  eight come back WEARING what she named — the sentence told her the opposite of
  what her own sheet showed.

  Written the way this module's other absence block demands: **every absence arm
  is preceded by the positive control that proves the subject still exists.** A
  `sheetNotice` that returned `null` for everything would satisfy every
  `toBeNull()` here on its own.
*/
describe("the studio-tee sentence never speaks over a sheet that wore the outfit", () => {
  const expiry = "This sheet expires today — keep what's worth holding.";

  /* THE POSITIVE CONTROL. Same facts, other road — the sentence is still there. */
  it("still says it on the house road, where it is true", () => {
    expect(sheetNotice(houseStated)).toBe(STATED_WARDROBE_NOTICE);
  });

  it("says nothing at all on an author-road sheet whose brief named an outfit", () => {
    expect(sheetNotice({ ...quiet, statedWardrobe: true })).toBeNull();
  });

  /*
    ⚠ AND IT YIELDS THE SLOT RATHER THAN BLOCKING IT. The rung used to sit above
    expiry; a fix that merely blanked the string would have left a stated-outfit
    author-road sheet silent about an expiry it was two days from, which is a
    second defect wearing the first one's fix.
  */
  it("hands the slot down to the expiry line instead of swallowing it", () => {
    expect(sheetNotice({ ...quiet, statedWardrobe: true, expiryNotice: expiry })).toBe(expiry);
  });

  /* The top of the precedence is untouched by the road. */
  it("still loses to a lost interpretation on either road", () => {
    expect(sheetNotice({ ...quiet, statedWardrobe: true, fellBack: true })).toBe(FELL_BACK_NOTICE);
    expect(sheetNotice({ ...houseStated, fellBack: true })).toBe(FELL_BACK_NOTICE);
  });

  /*
    The road alone is not a reason to say anything. An author-road sheet that
    never named an outfit is quiet for the reason it always was.
  */
  it("is not itself a line — an author-road sheet with nothing to say says nothing", () => {
    expect(sheetNotice(quiet)).toBeNull();
  });
});

describe("the Basics sentence and the path input are gone from the module", () => {
  const SOURCE = new URL("./sheetNotice.ts", import.meta.url);

  /*
    ⚠ THE POSITIVE CONTROL FOR THE ABSENCES BELOW — read at the SOURCE, because
    that is where they are read. A deleted or emptied module satisfies every
    `not.toContain` in this block; this arm is what says the subject survived.
  */
  it("still declares the sentence that survived", async () => {
    const source = await readFile(SOURCE, "utf8");
    expect(source).toContain("export const STATED_WARDROBE_NOTICE");
    expect(source).toContain("export function sheetNotice");
  });

  it("no longer declares a sentence naming a path nobody can buy", async () => {
    const source = await readFile(SOURCE, "utf8");
    expect(source).not.toContain("export const BASICS_WARDROBE_NOTICE");
  });

  /*
    ⚠ AND THE INPUT IS GONE, NOT MERELY UNREAD. A field left on the type with no
    reader is the shape `wardrobeEditsEnabled` was in one file over — it reads as
    a live fact to the next person who opens it.
  */
  it("no longer asks its caller which path the roll was cast on", async () => {
    const source = await readFile(SOURCE, "utf8");
    const type = source.slice(source.indexOf("export type SheetNoticeInput"));
    expect(type.slice(0, type.indexOf("};"))).not.toContain("wardrobePath");
  });

  /*
    ⚠ AND IT DOES ASK WHICH ROAD (#1262). The behaviour arms above would all
    still pass if the field were dropped from the TYPE and the caller stopped
    sending it, because `authorRoad: undefined` is falsy and every one of them
    that expects silence passes `true` explicitly — this arm is what says the
    question is declared rather than inferred from an absent property.
  */
  it("asks its caller which road the roll composed on", async () => {
    const source = await readFile(SOURCE, "utf8");
    const type = source.slice(source.indexOf("export type SheetNoticeInput"));
    expect(type.slice(0, type.indexOf("};"))).toContain("authorRoad: boolean");
  });
});

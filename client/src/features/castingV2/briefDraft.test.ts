import { describe, expect, it } from "vitest";

import {
  displayText,
  sameBrief,
  shownRollChanged,
  typed,
  type BriefDraft,
} from "./briefDraft";

/**
 * The founder's bug, as a sequence.
 *
 * Every test here drives the box the way the sheet drives it: a series of
 * events, then one question — what does it SAY? That is the only property the
 * user can check, and the one the old mechanism got wrong.
 */

/** The box, played forward. Returns what it displays at the end. */
function play(events: Array<["typed", string] | ["roll", string]>): string {
  let draft: BriefDraft = null;
  let shown = "";
  for (const event of events) {
    if (event[0] === "typed") draft = typed(event[1]);
    else {
      shown = event[1];
      draft = shownRollChanged(draft, shown);
    }
  }
  return displayText(draft, shown);
}

describe("the brief box shows the brief that produced the roll you are looking at", () => {
  /*
    THE REGRESSION TEST. The one the old mechanism cannot pass.

    Two rolls arrive with nothing typed in between — which is exactly what a
    remount during the compile window looks like, and what a warm query cache
    looks like on return. The seeded-string version wrote roll N−1's sentence
    into the empty box, spent its one-shot, and then refused to re-seed because
    the box was no longer empty. It displayed the old sentence forever.
  */
  it("follows the roll when the sheet was seeded from a stale one", () => {
    expect(
      play([
        ["roll", "a dad in his 30s"],
        ["roll", "a dad in his 30s, chunky glasses"],
      ]),
    ).toBe("a dad in his 30s, chunky glasses");
  });

  it("shows an edited re-roll's own sentence once the roll lands", () => {
    expect(
      play([
        ["roll", "a dad in his 30s"],
        ["typed", "a dad in his 30s, chunky glasses"],
        ["roll", "a dad in his 30s, chunky glasses"],
      ]),
    ).toBe("a dad in his 30s, chunky glasses");
  });

  it("shows each roll's own sentence when the history rail is walked", () => {
    expect(
      play([
        ["roll", "a dad in his 30s"],
        ["roll", "a dad in his 30s, chunky glasses"],
        ["roll", "a dad in his 30s"],
      ]),
    ).toBe("a dad in his 30s");
  });
});

describe("the user's own typing", () => {
  /*
    The backspace defect, which the first version of the seed produced and
    which must stay fixed: the box could not be emptied at all, because an
    empty box looked identical to a fresh sheet and the sentence sprang back.
  */
  it("stays cleared while you are on the roll you cleared it on", () => {
    expect(play([["roll", "a dad in his 30s"], ["typed", ""]])).toBe("");
  });

  /*
    A roll takes 66-82 seconds. Typing the NEXT edit while waiting is ordinary,
    and the landing must not swallow it — "arriving somewhere new should never
    overwrite words the user has already typed".
  */
  it("survives the roll it was typed over landing", () => {
    expect(
      play([
        ["roll", "a dad in his 30s"],
        ["typed", "a dad in his 30s, chunky glasses"],
        ["roll", "a dad in his 30s, chunky glasses"],
        ["typed", "a dad in his 30s, chunky glasses and a beard"],
        ["roll", "a dad in his 30s, chunky glasses"],
      ]),
    ).toBe("a dad in his 30s, chunky glasses and a beard");
  });

  it("survives a history walk, because it has words the roll does not", () => {
    expect(
      play([
        ["roll", "a dad in his 30s"],
        ["typed", "a fitness creator in their 30s"],
        ["roll", "an older woman, silver hair"],
      ]),
    ).toBe("a fitness creator in their 30s");
  });

  /*
    An empty draft has no words to protect. Following the user around as a
    blank box would make every roll they walk to look briefless.
  */
  it("does not follow the user to another roll once it is empty", () => {
    expect(
      play([
        ["roll", "a dad in his 30s"],
        ["typed", ""],
        ["roll", "an older woman, silver hair"],
      ]),
    ).toBe("an older woman, silver hair");
  });
});

describe("spending a draft", () => {
  /*
    Whitespace is not a different sentence. The server normalizes before
    compiling, so a draft differing only in spacing HAS been spent — leaving it
    alive would let it ride into a later history walk and mask that roll.
  */
  it("treats a re-spaced sentence as the same sentence", () => {
    expect(sameBrief("a dad  in his 30s ", "a dad in his 30s")).toBe(true);
    expect(shownRollChanged("a dad  in his 30s ", "a dad in his 30s")).toBeNull();
  });

  it("keeps a draft that says something the roll does not", () => {
    expect(shownRollChanged("a dad in his 30s, glasses", "a dad in his 30s")).toBe(
      "a dad in his 30s, glasses",
    );
  });

  it("has nothing to spend when the user has not typed", () => {
    expect(shownRollChanged(null, "a dad in his 30s")).toBeNull();
  });
});

describe("what a roll and a follow spend", () => {
  /*
    THE POISONED FOLLOW, stated as a property.

    A follow sends the visible box — that is the design, and it is right. The
    bug was that the box could be showing a sentence no roll on this sheet was
    cast from. Whatever the box says is what fires; the guarantee this module
    provides is that what it says is either the user's own words or the viewed
    roll's own brief, and never a third thing.
  */
  it("is always either the user's words or the viewed roll's brief", () => {
    expect(displayText(null, "a dad in his 30s, chunky glasses")).toBe(
      "a dad in his 30s, chunky glasses",
    );
    expect(displayText("a dad in his 30s, no glasses", "a dad in his 30s")).toBe(
      "a dad in his 30s, no glasses",
    );
  });
});

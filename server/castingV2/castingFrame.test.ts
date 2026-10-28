import { describe, expect, it } from "vitest";

import { facetsWrittenBy } from "./refineDelta";

import {
  FRAMING_PREMISE,
  everyFeatureOutOfFrame,
  nameWhatIsMissing,
  outOfFrame,
  outOfFrameMessage,
  partlyOutOfFrameNote,
  withoutWhatIsOutOfFrame,
} from "./castingFrame";
import { photorealHumanConstant } from "./cohortPhotorealHuman";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import { FREE_SUBJECT_KEYS } from "./refineSubjects";

/**
 * THE PREMISE THIS TABLE STANDS ON, ASSERTED RATHER THAN ASSUMED.
 *
 * `castingFrame` declares a shortcut: the product makes exactly ONE framing, so
 * whether her waist is in the picture needs no read. That is true today and it
 * is true because of a prompt constant fifty files away. The day someone ships a
 * full-length frame, this test fails and the table must become a measurement —
 * which is the whole reason the shortcut is allowed to exist.
 */
describe("the frame the table is keyed to", () => {
  it("is still the framing every roll asks for", () => {
    const prompt = photorealHumanConstant(null).toLowerCase();
    expect(prompt).toContain(FRAMING_PREMISE);
    /* The same sentence in its other half — a prompt that said "waist-up" while
       framing full length would pass a one-string check. */
    expect(prompt).toContain("mid-torso up");
  });

  it("⚠ AND IT PINS THE INSTRUCTION, NOT THE PICTURE — proven, so nobody reads its green as coverage", () => {
    /*
      THE LIMIT, MADE EXECUTABLE (opus-1112 §2c, from the Two Paths court).

      The guard above is the tripwire `castingFrame.ts` declares its shortcut on:
      *"the day someone ships a full-length frame, this test fails."* It cannot.
      It reads a PROMPT CONSTANT, and on 2026-08-23 a wider frame shipped on two
      paths **without that constant moving one byte**: the delivered masters of
      the Two Paths court's Wardrobe and Basics sheets are cropped at the hips
      with the hands in shot, against an unpathed dev roll from the same day
      cropped at the chest (`output/two-paths-court/FRAMING-STRIP.jpg`).

      What moved was the WARDROBE sentence inside the same block, which now names
      legs and feet, and what the engine did with it.

      So this arm asserts the blindness rather than describing it: the premise
      passes for the very wardrobe lines whose delivered frames disobey it. A
      seat that wants a guard against a wider frame has to READ A DELIVERED
      PHOTOGRAPH — that instrument does not exist and this is not it.
    */
    for (const line of [basicsWardrobeLine(null), basicsWardrobeLine("male"), HOUSE_WARDROBE_LINE]) {
      const prompt = photorealHumanConstant(line).toLowerCase();
      expect(prompt, line).toContain(FRAMING_PREMISE);
      expect(prompt, line).toContain("mid-torso up");
    }
    /* And the thing that DID move is in the same block, so the two are not even
       far apart — which is why the guard looks like it is watching. */
    expect(photorealHumanConstant(basicsWardrobeLine(null))).toContain("plain black fitted shorts");
  });
});

describe("what the photograph does not contain", () => {
  it("⚠ is NOTHING in the closed vocabulary since #2671 — the waist is in shot, on his word: 'I like B.'", () => {
    /*
      The table held `waist: "her waist"` until 2026-10-21. A mid-torso-up frame
      shows the waist's two side contours, and the relay court measured the
      painter slimming them 3 of 3 while the customer was told the waist was
      "left out of this take". So every free subject — the waist among them —
      now reads as IN frame, and the product's own list of what the camera
      cannot take is empty.
    */
    expect(outOfFrame("waist")).toBeNull();
    for (const subject of FREE_SUBJECT_KEYS) expect(outOfFrame(subject), subject).toBeNull();
    expect(everyFeatureOutOfFrame()).toEqual([]);
  });

  it("a waist ask leaves the strip WHOLE — the real table, driven", () => {
    const asked = { free: { waist: "a smaller waist", lips: "red lipstick" } };
    const { delta, dropped } = withoutWhatIsOutOfFrame(asked);
    expect(dropped).toEqual([]);
    expect(delta.free?.waist, "the waist is served, not stripped").toBe("a smaller waist");
  });

  it("declines in one sentence, offers nothing, and says nothing was charged", () => {
    const said = outOfFrameMessage("hips");
    expect(said).toContain("so the hips is not in it");
    expect(said).toContain("Nothing was charged");
    /* No recast offer (founder ruling, fable-382 §3) — an offer to photograph
       the cast again is a different product decision wearing a refusal's clothes. */
    expect(said.toLowerCase()).not.toContain("re-cast");
    expect(said.toLowerCase()).not.toContain("recast");
    expect(said.toLowerCase()).not.toContain("roll again");
    /* One sentence about the frame, one about the money. Not a paragraph. */
    expect(said.split(". ").length).toBeLessThanOrEqual(2);
  });
});

/**
 * NO OUT-OF-FRAME SENTENCE CARRIES A PERSON'S PRONOUN (#2671).
 *
 * The note said "so her waist is not in it" to every customer, whatever the
 * cast — the possessive came from the table's own phrase. Both sentences now
 * supply the article themselves and replace a gendered word that reaches them,
 * so the guard is on the SENTENCE and not on what a future table entry happens
 * to spell.
 */
describe("the out-of-frame sentences never gender anyone", () => {
  const GENDERED = /\b(?:she|he|her|his|him|hers)\b/i;

  it("a bare noun is given the article, not a possessive", () => {
    expect(partlyOutOfFrameNote("waist")).toContain("so the waist is not in it");
    expect(outOfFrameMessage("waist")).toContain("so the waist is not in it");
  });

  it("a gendered phrase handed to either sentence is not printed", () => {
    for (const what of ["her waist", "his waist", "her waist and her hips"]) {
      expect(partlyOutOfFrameNote(what), what).not.toMatch(GENDERED);
      expect(outOfFrameMessage(what), what).not.toMatch(GENDERED);
    }
    expect(partlyOutOfFrameNote("her waist")).toContain("so the waist is not in it");
  });

  it("CONTROL — a phrase that already reads plainly is left as it is", () => {
    expect(partlyOutOfFrameNote("the waist")).toContain("so the waist is not in it");
    expect(partlyOutOfFrameNote("the waist")).not.toContain("the the");
    /* "other" holds "he" and "her" as letters, never as words. */
    expect(partlyOutOfFrameNote("the other side")).toContain("the other side is not in it");
  });
});

/**
 * THE STRIP — that what cannot be photographed LEAVES the ask.
 *
 * The refusal has always been the loud half. This is the quiet one, and it is
 * the half that was costing something: before it existed, a waist asked for
 * beside a servable facet rode into the prompt, the caption, the verification
 * and the STORED recipe, which is composed into every later render on that
 * branch. These drive the removal itself; `refineService.test.ts` drives that
 * the service actually asks for it, on the wire, where the money is.
 */
describe("what the photograph does not contain leaves the ask", () => {
  /* The product's own table is empty since #2671, so the mechanism a facet
     below the crop would ride is driven with a FIXTURE table — the same
     function, the same lanes, handed one entry. */
  const BELOW: Record<string, string> = { waist: "waist" };

  it("takes the waist out and leaves everything else exactly as it was", () => {
    const { delta, dropped } = withoutWhatIsOutOfFrame({
      free: { waist: "a smaller waist", arms: "bigger arms" },
    }, BELOW);
    expect(dropped).toEqual(["waist"]);
    expect(delta.free?.waist, "gone from the recipe, not merely unsaid").toBeUndefined();
    expect(delta.free?.arms, "and the servable half is untouched").toBe("bigger arms");
  });

  it("does not touch an ask that is entirely in the picture", () => {
    const asked = { eyeColour: "green" as const, free: { arms: "bigger arms" } };
    const { delta, dropped } = withoutWhatIsOutOfFrame(asked, BELOW);
    expect(dropped).toEqual([]);
    expect(delta).toEqual(asked);
  });

  it("keeps an OPEN KIND, so a servable half is not counted as nothing", () => {
    /*
      THE SWEEP'S SECOND FIND (fable-900 §2b). The caller decides whether
      anything survives, and it counted FACETS — which an open kind has none of.
      So *"give her a halo"* beside an out-of-shot waist read as nothing
      surviving and the whole ask was refused, including the half this product
      could serve. The strip itself was innocent: it spreads the delta, so `open`
      was always carried through. This arm pins that, and the caller's own
      condition is asserted beside it.
    */
    const { delta, dropped } = withoutWhatIsOutOfFrame({
      open: { halo: { noun: "halo", words: "a halo" } },
      free: { waist: "a smaller waist" },
    }, BELOW);
    expect(dropped).toEqual(["waist"]);
    expect(delta.free?.waist).toBeUndefined();
    expect(delta.open?.halo).toEqual({ noun: "halo", words: "a halo" });
    /* And the count the caller uses: facets alone say nothing survives, which is
       exactly the reading that refused the halo. */
    expect(facetsWrittenBy(delta).size).toBe(0);
    expect(Object.keys(delta.open ?? {}).length).toBe(1);
  });

  it("does not mutate the delta it was handed", () => {
    /* It is called on `editDelta` before composition, and a strip that reached
       back into the caller's object would take the waist out of the sentence's
       own record as well as out of the render. */
    const asked = { free: { waist: "a smaller waist", arms: "bigger arms" } };
    withoutWhatIsOutOfFrame(asked, BELOW);
    expect(asked.free.waist).toBe("a smaller waist");
  });

  it("empties the ask when the WHOLE sentence is out of frame — the refusal's own condition", () => {
    /* The service derives its refusal from this rather than counting facets
       itself, so this is the refusal's arithmetic, driven here. */
    const { delta, dropped } = withoutWhatIsOutOfFrame({ free: { waist: "a smaller waist" } }, BELOW);
    expect(dropped).toEqual(["waist"]);
    expect(delta.free, "an emptied lane is removed, not left as {}").toBeUndefined();
  });

  it("sweeps the DEPARTURE lane too, not only the positive one", () => {
    /* Both lanes are facts about her that reach the painter. A rule that swept
       one of them would be the misaimed-guard class: correct on the ask it was
       written against, silently absent on the other. */
    const { delta, dropped } = withoutWhatIsOutOfFrame({
      absent: { waist: ["a corset"], arms: ["sleeves"] },
    }, BELOW);
    expect(dropped).toEqual(["waist"]);
    expect(delta.absent?.waist).toBeUndefined();
    expect(delta.absent?.arms).toEqual(["sleeves"]);
  });

  it("names one missing thing plainly and several as a list", () => {
    expect(nameWhatIsMissing(["waist"])).toBe("waist");
    expect(nameWhatIsMissing(["waist", "hips"])).toBe("waist and hips");
    expect(nameWhatIsMissing(["a", "b", "c"])).toBe("a, b and c");
  });
});

describe("the sentence a half-served ask is delivered with", () => {
  const said = partlyOutOfFrameNote("hips");

  it("names the half that was not done, and leaves the rest to the owed list's one closing", () => {
    expect(said).toContain("so the hips is not in it");
    expect(said).toContain("so that part was left out of this take");
    /* #2713: "everything else you asked for was done" claimed a finished paint
       on a receipt read while the paint runs; the rest is now said ONCE for
       the whole owed list (`owedSentences`). */
    expect(said.toLowerCase()).not.toContain("everything else you asked for");
  });

  it("does NOT say nothing was charged, because something was", () => {
    /* The negative control, and the one that matters: this is a DELIVERED take.
       Borrowing the refusal's most reassuring sentence for a paid outcome would
       be the exact reverse of the honesty this line exists for. */
    expect(said.toLowerCase()).not.toContain("nothing was charged");
  });

  it("makes no offer, exactly like its refusing sibling", () => {
    expect(said.toLowerCase()).not.toContain("recast");
    expect(said.toLowerCase()).not.toContain("re-cast");
    expect(said.toLowerCase()).not.toContain("roll again");
  });

  it("shares the framing clause with the refusal, so the two cannot drift", () => {
    const clause = "This photograph is framed from the mid-torso up";
    expect(said).toContain(clause);
    expect(outOfFrameMessage("hips")).toContain(clause);
  });
});

import { describe, expect, it } from "vitest";

import { facetsWrittenBy } from "./refineDelta";

import {
  FRAMING_PREMISE,
  nameWhatIsMissing,
  outOfFrame,
  outOfFrameMessage,
  partlyOutOfFrameNote,
  withoutWhatIsOutOfFrame,
} from "./castingFrame";
import { photorealHumanConstant } from "./cohortPhotorealHuman";
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
});

describe("what the photograph does not contain", () => {
  it("names her waist, and nothing that is on her face", () => {
    expect(outOfFrame("waist")).toBe("her waist");
    for (const facet of ["lips", "brows", "skinTone", "bust", "shoulders", "arms", "build"]) {
      expect(outOfFrame(facet), facet).toBeNull();
    }
  });

  it("defaults a facet nobody listed to IN frame", () => {
    /* The safe direction: a wrong `false` refuses an edit the customer could
       have had, and this door charges nothing either way. */
    for (const subject of FREE_SUBJECT_KEYS) {
      if (subject === "waist") continue;
      expect(outOfFrame(subject), subject).toBeNull();
    }
  });

  it("declines in one sentence, offers nothing, and says nothing was charged", () => {
    const said = outOfFrameMessage("her waist");
    expect(said).toContain("her waist is not in it");
    expect(said).toContain("Nothing was charged");
    /* No recast offer (founder ruling, fable-382 §3) — an offer to photograph
       her again is a different product decision wearing a refusal's clothes. */
    expect(said.toLowerCase()).not.toContain("re-cast");
    expect(said.toLowerCase()).not.toContain("recast");
    expect(said.toLowerCase()).not.toContain("roll again");
    /* One sentence about the frame, one about the money. Not a paragraph. */
    expect(said.split(". ").length).toBeLessThanOrEqual(2);
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
  it("takes the waist out and leaves everything else exactly as it was", () => {
    const { delta, dropped } = withoutWhatIsOutOfFrame({
      free: { waist: "a smaller waist", arms: "bigger arms" },
    });
    expect(dropped).toEqual(["her waist"]);
    expect(delta.free?.waist, "gone from the recipe, not merely unsaid").toBeUndefined();
    expect(delta.free?.arms, "and the servable half is untouched").toBe("bigger arms");
  });

  it("does not touch an ask that is entirely in the picture", () => {
    const asked = { eyeColour: "green" as const, free: { arms: "bigger arms" } };
    const { delta, dropped } = withoutWhatIsOutOfFrame(asked);
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
    });
    expect(dropped).toEqual(["her waist"]);
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
    withoutWhatIsOutOfFrame(asked);
    expect(asked.free.waist).toBe("a smaller waist");
  });

  it("empties the ask when the WHOLE sentence is out of frame — the refusal's own condition", () => {
    /* The service derives its refusal from this rather than counting facets
       itself, so this is the refusal's arithmetic, driven here. */
    const { delta, dropped } = withoutWhatIsOutOfFrame({ free: { waist: "a smaller waist" } });
    expect(dropped).toEqual(["her waist"]);
    expect(delta.free, "an emptied lane is removed, not left as {}").toBeUndefined();
  });

  it("sweeps the DEPARTURE lane too, not only the positive one", () => {
    /* Both lanes are facts about her that reach the painter. A rule that swept
       one of them would be the misaimed-guard class: correct on the ask it was
       written against, silently absent on the other. */
    const { delta, dropped } = withoutWhatIsOutOfFrame({
      absent: { waist: ["a corset"], arms: ["sleeves"] },
    });
    expect(dropped).toEqual(["her waist"]);
    expect(delta.absent?.waist).toBeUndefined();
    expect(delta.absent?.arms).toEqual(["sleeves"]);
  });

  it("names one missing thing plainly and several as a list", () => {
    expect(nameWhatIsMissing(["her waist"])).toBe("her waist");
    expect(nameWhatIsMissing(["her waist", "her hips"])).toBe("her waist and her hips");
    expect(nameWhatIsMissing(["a", "b", "c"])).toBe("a, b and c");
  });
});

describe("the sentence a half-served ask is delivered with", () => {
  const said = partlyOutOfFrameNote("her waist");

  it("names the half that was not done, and says the rest was", () => {
    expect(said).toContain("her waist is not in it");
    expect(said).toContain("everything else you asked for was done");
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
    expect(outOfFrameMessage("her waist")).toContain(clause);
  });
});

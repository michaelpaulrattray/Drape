import { describe, expect, it } from "vitest";

import { FRAMING_PREMISE, outOfFrame, outOfFrameMessage } from "./castingFrame";
import { PHOTOREAL_HUMAN_CONSTANT } from "./cohortPhotorealHuman";
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
    const prompt = PHOTOREAL_HUMAN_CONSTANT.toLowerCase();
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

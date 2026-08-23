import { describe, expect, it } from "vitest";

import {
  CHANGE_AMPLITUDE,
  amplitudeFor,
  unmeasuredAmplitudes,
} from "./changeAmplitude";
import { FREE_SUBJECT_KEYS } from "./refineSubjects";

describe("every class says how big its own change is", () => {
  it("covers the subject vocabulary exactly, from both directions", () => {
    /* The compiler refuses a MISSING subject; only this catches an entry left
       behind by one that was renamed away. */
    expect(Object.keys(CHANGE_AMPLITUDE).sort()).toEqual([...FREE_SUBJECT_KEYS].sort());
  });

  it("never lets a threshold be zero or absent", () => {
    for (const subject of FREE_SUBJECT_KEYS) {
      expect(amplitudeFor(subject), `${subject} has no usable threshold`).toBeGreaterThan(0);
    }
  });

  it("puts the surface classes BELOW the replacement classes", () => {
    /*
      THE WHOLE POINT, as an assertion. A freckle is worth about four levels and
      the program's habitual threshold was 25: measured there it does not exist,
      and the instrument reports "the painter did nothing" about a face visibly
      covered in them. If a skin class ever creeps up to a replacement class's
      threshold, the sweep starts calling honest subtle deliveries failures.
    */
    for (const surface of ["marks", "skinTone", "skinCharacter"] as const) {
      for (const replacement of ["statedAccessories", "hairCut", "hairShade"] as const) {
        expect(
          amplitudeFor(surface),
          `${surface} must be measured more finely than ${replacement}`,
        ).toBeLessThan(amplitudeFor(replacement));
      }
    }
  });

  it("keeps marks at the amplitude the control actually read", () => {
    /* freckles-layers.mts and marks-prose.mts both read freckles at >4 and lose
       them entirely at >25. This is the one number in the table with a picture
       behind it, so it is pinned rather than left to drift. */
    expect(amplitudeFor("marks")).toBe(4);
  });

  it("makes every entry state where its number came from", () => {
    for (const subject of FREE_SUBJECT_KEYS) {
      const basis = CHANGE_AMPLITUDE[subject].basis;
      const text = "measured" in basis ? basis.measured : basis.reasoned;
      expect(text.length, `${subject} does not say where its number came from`).toBeGreaterThan(20);
    }
  });

  it("names the reasoned ones OUT LOUD, as a work list", () => {
    /*
      A declared shortcut is engineering; a reasoned threshold wearing a
      measured one's clothes is how a constant survives years of being wrong.
      Most of this table is reasoned today and the count is asserted rather than
      hidden — it should fall as controls are run, and a rise means somebody
      added a class without measuring it.
    */
    const reasoned = unmeasuredAmplitudes();
    expect(reasoned).toContain("skinTone");
    expect(reasoned).not.toContain("marks");
    /*
      24 since the body row landed: five classes arrived together (bust, waist,
      shoulders, arms, build) and every one of them is REASONED, from the jaw's
      measured behaviour over a longer arc. That is a rise, and a rise is what
      this bar exists to make visible rather than to forbid — what would measure
      them is a before/after pair on one anchor with the outline's own
      displacement read off it, and nobody has run one.
    */
    /*
      25 since horns landed. Its amplitude is REASONED — horns put opaque
      material where hair or background was, which is the replacement band's own
      sentence — and the courts that promoted it measured delivery, detection,
      survival and removal rather than a per-channel threshold. So the rise is
      declared here in the open, which is what this bar is for: it forbids a
      class arriving unmeasured and UNNOTICED, not a class arriving unmeasured.
    */
    /*
      26 since `wardrobe` landed (item 8, 2026-08-23). Its amplitude is REASONED
      for the replacement band's own sentence — an outfit puts different fabric
      where the old fabric was, over a wide area — and there is nothing to
      measure yet, because the path that serves it is dark on every account. The
      rise is declared here in the open, which is exactly what this bar is for.
    */
    expect(reasoned.length, "more classes are guessed than this table admits").toBeLessThanOrEqual(26);
  });
});

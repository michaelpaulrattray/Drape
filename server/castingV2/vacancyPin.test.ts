/**
 * THE ABSENCE SENTENCES, PINNED BEFORE THEY MOVED (V3 slice (b), fable-531 §4b).
 *
 * Slice (b) moves the vacancy phrase off the accessory placement table and onto
 * a home keyed by KIND, so a beard can say it is gone. The acceptance for the
 * move is that **nothing changes**: the three accessory sentences are to be
 * MOVED, not rewritten, and the difference between those two is invisible in a
 * diff and loud in production — these strings go into paid prompts.
 *
 * `vacancyPin.json` was captured with `git show HEAD:accessoryKinds.ts` BEFORE
 * the new module existed, and it is not regenerated. A golden refreshed when it
 * fails is a golden that agrees with whatever it is shown; a golden taken from
 * the thing it is meant to check is not one at all.
 *
 * The em dash is the reason this is compared in BYTES rather than by eye: this
 * project has twice had a Windows console re-encode one silently, and a
 * sentence that differs by one character is a different sentence to a model.
 */
import { describe, expect, it } from "vitest";

import pin from "./vacancyPin.json";
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { VACANCY_BY_KIND, vacantPhraseFor } from "./vacancyPhrases";

describe("the move did not rewrite a single sentence", () => {
  it("holds every accessory phrase byte for byte", () => {
    for (const [kind, says] of Object.entries(pin.vacantPhrase)) {
      expect(VACANCY_BY_KIND[kind]?.says, kind).toBe(says);
      /* And through the door every caller actually uses, so a lookup that
         started answering from somewhere else would show up here. */
      expect(vacantPhraseFor(kind), kind).toBe(says);
    }
  });

  it("holds the per-instance form byte for byte, side and all", () => {
    for (const [kind, form] of Object.entries(pin.vacantPhrasePerInstance)) {
      expect(VACANCY_BY_KIND[kind]?.perInstance, kind).toBe(form);
      expect(vacantPhraseFor(kind, "left"), kind).toBe(form.replace("{side}", "left"));
    }
  });

  it("covers every kind that could say it was gone before the move", () => {
    /* The vacuous-pin check. If the golden were empty every assertion above
       would pass over nothing, and this file would be the checker that cannot
       fail — the exact shape the vocabulary pin was written to refuse. */
    expect(Object.keys(pin.vacantPhrase).sort())
      .toEqual(LANDMARK_OF_ACCESSORY.map((entry) => entry.region).sort());
    expect(Object.keys(pin.vacantPhrase).length).toBe(3);
  });

  it("has gained exactly the kind this slice adds, and no others", () => {
    /*
      An addition is neither a move nor a change, and it is answered by naming
      it — the same rule the vocabulary pin learned when horns arrived. Adding a
      kind without a line here is indistinguishable from a kind that arrived by
      accident.
    */
    const added = Object.keys(VACANCY_BY_KIND).filter((kind) => !(kind in pin.vacantPhrase));
    expect(added).toEqual(["facial hair"]);
  });

  it("CAN FAIL — the comparison, driven on a sentence with one character moved", () => {
    /* Without this the byte comparison above could be passing on a fixture
       shape nobody has checked (a `toBe` against `undefined` on both sides). */
    const tampered = `${pin.vacantPhrase.glasses} `;
    expect(tampered).not.toBe(pin.vacantPhrase.glasses);
    expect(VACANCY_BY_KIND.glasses?.says).not.toBe(tampered);
  });
});

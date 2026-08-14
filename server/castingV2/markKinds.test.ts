/**
 * THE MARK VOCABULARY, AND THE SHORTCUT MADE VISIBLE (V3(b), fable-537 §2).
 *
 * One kind ships with a sentence. The value of these arms is not that freckles
 * work — it is that the OTHERS still refuse, because a shortcut that quietly
 * widened would be the ceiling nobody meant to set.
 */
import { describe, expect, it } from "vitest";

import { MARK_KINDS, markCanDepart, markKindOf } from "./markKinds";
import { vacantPhraseFor } from "./vacancyPhrases";

describe("what kind of mark a sentence names", () => {
  it("reads the kind out of the user's own words", () => {
    expect(markKindOf("her freckles")).toBe("freckles");
    expect(markKindOf("the scar on her cheek")).toBe("scar");
    expect(markKindOf("that birthmark")).toBe("birthmark");
  });

  it("takes the LONGEST match, so a beauty spot is a mole and not nothing", () => {
    expect(markKindOf("the beauty spot above her lip")).toBe("mole");
  });

  it("says NOTHING about a sentence naming no mark — never a default", () => {
    /* The accessory table's own defect is why: a hardcoded fallback once
       harvested wherever her earrings were. */
    expect(markKindOf("her earrings")).toBeNull();
    expect(markKindOf(null)).toBeNull();
    expect(markKindOf("")).toBeNull();
  });
});

describe("the declared shortcut is visible in the table", () => {
  it("ships NO kind that can say it is gone — the court shut the one door", () => {
    /*
      Freckles' sentence is written and its court came back SHORT: they vanish
      on their own (1 of 3 survived an unrelated edit nobody asked to change
      them) and the skin came back airbrushed where they were. So the capability
      waits for the surface carrier work — the tan's own owner — and this list
      is the record of that, not an oversight.
    */
    const departable = MARK_KINDS.filter((entry) => entry.canDepart).map((entry) => entry.kind);
    expect(departable).toEqual([]);
  });

  it("keeps the sentence ready for the run that earns it", () => {
    /* The phrase is correct and stays; `canDepart` is the door. Deleting the
       sentence would throw away the thing the next court needs. */
    expect(vacantPhraseFor("freckles")).toContain("no freckles");
    expect(markCanDepart("freckles")).toBe(false);
    for (const entry of MARK_KINDS.filter((one) => !one.canDepart)) {
      expect(markCanDepart(entry.kind), entry.kind).toBe(false);
    }
  });

  it("names the kinds it cannot yet say, rather than omitting them", () => {
    /* A kind missing from the table is indistinguishable from a kind nobody
       thought of. These are decisions, and they are visible where the next
       person looks. */
    expect(MARK_KINDS.map((entry) => entry.kind).sort())
      .toEqual(["birthmark", "freckles", "mole", "scar"]);
  });
});

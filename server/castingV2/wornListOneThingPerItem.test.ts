/**
 * ONE WORN THING PER ITEM — the instruction that is the only thing standing
 * between the worn list and #2639, pinned on the OUTGOING request.
 *
 * # The defect this guards, and it is latent rather than live
 *
 * Everything a cast wears rides one subject (`statedAccessories`). Since #2612
 * the product splits that list by what each item IS, and #2616 carried the
 * split to the mint and the library. **The split can only ever see items it is
 * given**, and nothing splits an item after the parse — deliberately: a code
 * split on "and" is a phrasing list by another name and D-163 outlaws that
 * class (`refineDelta.ts`: *"The interpreter splits, because a code split on
 * 'and' is a phrasing list by another name"*).
 *
 * So one joined item — `["gold hoop earrings, round glasses"]` instead of two —
 * collapses the whole list onto one kind by longest match, and the glasses are
 * painted, filed and checked on the earlobes. Driven below rather than argued.
 *
 * **Measured on production when #2639 was filed: 4 variants carry a worn list,
 * 6 items between them, 0 separators inside any of them.** Nobody can hit this
 * today. What makes it worth a guard is that only ONE sentence prevents it, it
 * lives in a prompt, and prompts are edited.
 *
 * # Why the pin is here and not on a constant
 *
 * Invariant 5: the contract is about what gets SENT. `basePromptLines` is a
 * module-level array in `refineInterpreter.ts` and is not exported; a test that
 * read it would pass just as happily on the day the lines stopped riding. These
 * arms drive the real `interpretRefinement` with a recording engine and read
 * the system turn it actually posted — the shape
 * `refineInterpreterReferenceEntrance.test.ts` already uses one module over.
 *
 * # ⚠ AND THE GUARD #2639 PROPOSED INSTEAD MUST NOT BE BUILT — the last arm is
 * the measurement that says so
 *
 * That card's road 1 was *"assert at the parse that an item names at most one
 * kind (`accessoryKindOf` already answers it)"*. It does not: `accessoryKindOf`
 * answers *which one kind is this*, by longest match, and the naive extension
 * of it to *how many kinds does this name* refuses ordinary single items —
 * "a nose stud", "gold nose hoop" and "nostril stud" each touch the earring
 * entry as well as the nose one, because "stud" and "hoop" are earring words.
 * That overlap is the exact thing `accessoryEntry`'s longest-match rule exists
 * to resolve, and no threshold separates it from a genuinely joined item.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement } from "./refineInterpreter";
import { LANDMARK_OF_ACCESSORY, accessoryKindOf } from "./accessoryKinds";
import { familyKindsOf, repaintAsksFor, type EditProse } from "./repaintAsks";
import { facetOfSubject } from "./refineFacets";
import type { CastPronouns } from "./castPronouns";

/** An engine that records every request and answers the same thing forever. */
function recording(reply: string): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  return {
    id: "recording",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      return {
        text: reply,
        provenance: { provider: "openrouter" as const, model: "recording" },
        latencyMs: 0,
      };
    },
  } as never;
}

const ANY_EDIT = JSON.stringify({ intent: "edit", eyeShape: "fox eyes" });

async function systemSent(): Promise<string> {
  const engine = recording(ANY_EDIT);
  await interpretRefinement({ instruction: "give her small gold hoops", engine } as never);
  expect(engine.seen.length, "the interpreter was never asked anything").toBeGreaterThan(0);
  return String(engine.seen[0]!.system ?? "");
}

const prose: EditProse = {
  eyeColour: (v) => `iris ${v}`,
  eyeShape: (v) => `shape ${v}`,
  hairStyle: (v) => `a ${v}`,
  hairColour: (v) => `colour ${v}`,
  hairTexture: (v) => `texture ${v}`,
};
const her: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };

function readersOn(items: readonly string[]) {
  const delta = { free: { statedAccessories: items } } as never;
  const kinds = familyKindsOf(
    facetOfSubject("statedAccessories"),
    delta,
    accessoryKindOf(items.join(", ")),
  );
  const asks = repaintAsksFor({ pronouns: her, prose, delta });
  return { kinds, slots: asks.ok ? asks.asks.map((ask) => ask.slot) : null };
}

describe("a worn list arrives as separate items, or the split downstream has nothing to work with", () => {
  it("TELLS THE READER each item is one thing, on the request it actually posts", async () => {
    const system = await systemSent();
    /*
      The two halves of the sentence, because they fail differently: losing
      "one thing" lets a model answer with a run-on it believes is tidy, and
      losing "never one run-on sentence" removes the prohibition that names the
      shape. Both are asserted on the outgoing system turn, so a clause that
      stops riding goes red where a constant-equality test would not.
    */
    expect(system).toContain("Each item is");
    expect(system).toContain("one thing");
    expect(system).toContain("never one run-on sentence");
    /* And that it is said ABOUT the subject that holds the set — the rule is
       worthless if it ever comes to be scoped to marks and ink alone. */
    expect(system).toContain("statedAccessories");
  });

  it("WHY IT MATTERS, driven at the real readers — a joined item loses every kind but the longest", () => {
    const joined = readersOn(["gold hoop earrings, round glasses"]);
    expect(joined.kinds).toEqual(["earring"]);
    /* The glasses are inside those words and land on the earlobes. No `glasses`
       slot is filed at all, so the next render has no record of them. */
    expect(joined.slots).toEqual(["earring@left", "earring@right"]);
    expect(joined.slots).not.toContain("glasses");
  });

  it("POSITIVE CONTROL — the same two things as two items file both kinds", () => {
    const split = readersOn(["gold hoop earrings", "round glasses"]);
    expect(split.kinds).toEqual(["earring", "glasses"]);
    expect(split.slots).toEqual(["earring@left", "earring@right", "glasses"]);
  });

  it("THE GUARD #2639 PROPOSED CANNOT BE BUILT FROM accessoryKindOf — measured, not argued", () => {
    /*
      A reader that answers "how many kinds does this item name" by counting the
      table entries its words touch. This is the shape road 1 asks for, and the
      arm exists to keep it from being written: it refuses ordinary SINGLE items.
    */
    const entriesTouched = (said: string): string[] => {
      const low = said.toLowerCase();
      const hit = new Set<string>();
      for (const entry of LANDMARK_OF_ACCESSORY) {
        for (const word of entry.words) if (low.includes(word)) hit.add(entry.region);
      }
      return [...hit];
    };

    /* Each of these is ONE thing a customer would plainly ask for, and each
       touches the earring entry as well as its own, because "stud" and "hoop"
       are earring words. `accessoryKindOf` gets all three right by longest
       match — counting does not. */
    for (const single of ["a nose stud", "gold nose hoop", "nostril stud"]) {
      expect(entriesTouched(single).length, single).toBeGreaterThan(1);
      expect(accessoryKindOf(single), single).toBe("nose stud");
    }

    /* And the joined item the guard is MEANT to catch is indistinguishable by
       that count — it is two, exactly as "a nose stud" is two. There is no
       threshold between them, which is the whole finding. */
    expect(entriesTouched("gold hoop earrings, round glasses")).toHaveLength(2);
    expect(entriesTouched("a nose stud")).toHaveLength(2);

    /* The clean single items, as the other half of the control: a counting
       guard would pass these, so the failure above is about the overlap and
       not about the reader being broken generally. */
    for (const single of ["small gold hoop earrings", "round glasses", "septum ring"]) {
      expect(entriesTouched(single), single).toHaveLength(1);
    }
  });
});

/**
 * TWO MORE WAYS AN UNDERSTOOD SENTENCE WAS CALLED UNCLEAR — #2730 and #2731,
 * the siblings #2714's sweep filed.
 *
 * # The defect this guard holds shut
 *
 * Both used to return the whole-delta `null` with NO wall set from `readDelta`,
 * which falls out of the interpreter's samplings as `unreadable`: *"That one
 * didn't come through clearly. Try naming what you want changed about them."*
 * Both sentences had come through perfectly:
 *
 *   - **#2730** — more separate items under one set subject than a set keeps.
 *     Nine marks, each well inside its own length cap; the same sentence with
 *     eight files every one.
 *   - **#2731** — a value the brand scrub emptied, because it was nothing but a
 *     house name the customer typed. The scrub is correct and is untouched;
 *     the silence is what ends.
 *
 * And in both, every unrelated change in the same sentence died beside it.
 *
 * # What is deliberately NOT changed, and is asserted as kept
 *
 * **The all-or-nothing rule stays** — every arm asserts the null AND the named
 * wall together, so a later "fix" into a partial file reddens here. **The cap
 * stays** (#2730: *do not fix this by raising it*). **The scrub stays**
 * (#2731: *do not fix this by letting brands through*).
 *
 * # The re-sample decision, which is the relay's lesson from PR #2732
 *
 * Both walls are facts about OUR reply rather than their sentence — how many
 * items we split and restated a set into; a value we filed as the bare name the
 * prompt told us to drop — so both are re-sampled on attempts 1 and 2 and
 * answer only if the last sampling still raises them. The union members carry
 * the argument and the measurement; the last block here is the proof, a rescue
 * arm and a persistent arm for each, as PR #2732's repair had for its own wall.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { REFINE_REFUSALS, REFUSAL_REASONS } from "./refineRefusals";
import { refusalIsAnswerableByAReader } from "./referenceWordsLane";
import { readDelta, type FreeLaneCheck, type RefineRefusal } from "./refineDelta";

const check = (instruction: string, extra: Partial<FreeLaneCheck> = {}): FreeLaneCheck => ({
  instruction, ...extra,
});

/** The `refineInterpreterCeiling` harness, as `overlongValueRefusal.test` uses it. */
function scripted(replies: string[]): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return {
        text: reply!,
        provenance: { provider: "openrouter" as const, model: "scripted" },
        latencyMs: 0,
      } as Awaited<ReturnType<TextEngine["complete"]>>;
    },
  };
}

/*
  THE MARKS, from the court that measured the door (2026-10-28): these eight
  came back as eight items and were SERVED through the real interpreter on 6 of
  6, and the nine came back as nine on 36 of 36. So the control below is a set
  the reader really files, rather than one that passes by failing a guard early.
*/
const EIGHT = [
  "freckles across her nose", "a mole on her left cheek", "a small scar on her chin",
  "a birthmark on her neck", "a beauty mark above her lip", "a scar through her right eyebrow",
  "a mole on her jaw", "freckles on her shoulders",
];
const NINE = [...EIGHT, "a small scar on her forehead"];
const NINE_SENTENCE = `give her ${NINE.slice(0, -1).join(", ")}, and ${NINE[NINE.length - 1]}`;

/** Read a field off whichever member the wall is, without narrowing by hand. */
const field = (wall: RefineRefusal | undefined, key: string): unknown =>
  (wall && key in wall ? (wall as Record<string, unknown>)[key] : undefined);

describe("#2730 — more items than a set keeps is refused BY NAME", () => {
  /*
    THE NUMBER IS WRITTEN OUT, `overlongValueRefusal.test`'s lesson: an arm
    probing at "the cap + 1" moves with the cap, so a cap sabotaged to 100000
    would leave every arm passing. `MAX_ITEMS` is 8 and is not exported; a
    shift that means to move it moves this line too, on purpose.
  */
  it("pins the count this file probes at", () => {
    expect(EIGHT).toHaveLength(8);
    expect(NINE).toHaveLength(9);
  });

  it("names the wall, and carries the subject, the count and the limit for the log", () => {
    const state = check(NINE_SENTENCE);
    expect(readDelta({ free: { marks: NINE } }, state), "the delta still nulls").toBeNull();

    expect(state.wall?.reason, "named, never left to read as an unclear sentence").toBe("wall_too_many");
    expect(field(state.wall, "asked")).toBe("marks");
    expect(field(state.wall, "count")).toBe(9);
    expect(field(state.wall, "limit")).toBe(8);
  });

  it("CONTROL — the same marks, eight of them, all file and nothing walls", () => {
    /* Without this, "nine walls" is satisfied by a reader that walls every set. */
    const state = check(NINE_SENTENCE);
    expect(readDelta({ free: { marks: EIGHT } }, state)?.free?.marks).toEqual(EIGHT);
    expect(state.wall).toBeUndefined();
  });

  it("⚠ THE NEIGHBOUR still dies, and is now TOLD", () => {
    const together = check(`${NINE_SENTENCE} and thick straight brows`);
    expect(readDelta({ free: { marks: NINE, brows: "thick straight" } }, together)).toBeNull();
    expect(together.wall?.reason).toBe("wall_too_many");

    /* The positive control: the brows on their own file, so the arm above is
       measuring the count and not a broken brows read. */
    const alone = check("thick straight brows");
    expect(readDelta({ free: { brows: "thick straight" } }, alone)?.free?.brows).toBe("thick straight");
    expect(alone.wall).toBeUndefined();
  });

  it("⚠ a customer who typed TWO things meets it too — the count includes what we restated", () => {
    /*
      The court's second sentence: seven marks on record, two asked for. The
      prompt tells the model to restate the whole set, so the reply is nine —
      and the sentence the customer reads therefore talks about what it WOULD
      COME TO, never about how many they asked for.
    */
    const prior = { marks: EIGHT.slice(0, 7) };
    const state = check("add a small scar on her forehead and freckles on her shoulders", { prior });
    expect(readDelta({ free: { marks: NINE } }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_too_many");
  });

  it("is a property of SETS, not of marks — an over-full accessory set names it the same way", () => {
    const pieces = Array.from({ length: 9 }, (_, at) => `a gold ring number ${at + 1}`);
    const state = check(`give her ${pieces.join(", ")}`);
    expect(readDelta({ free: { statedAccessories: pieces } }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_too_many");
    expect(field(state.wall, "asked")).toBe("statedAccessories");
  });

  it("⚠ THE READER SPLIT HOLDS — a caller with no `check` is byte-unchanged", () => {
    /* Our own record re-entering: corruption with nobody to tell. It must
       still null and must not throw reaching for a `check` that is not there. */
    expect(readDelta({ free: { marks: NINE } })).toBeNull();
    expect(() => readDelta({ free: { marks: NINE } })).not.toThrow();
  });

  it("NOT THIS WALL — a singular subject sent as a list is a reply-shape slip, and keeps its own road", () => {
    /*
      `!plural && rawItems.length > 1` sits one line above and is a different
      fact: two items where the subject holds one is how WE shaped the reply,
      not a count the customer could act on. It is examined and left on the
      re-sample road rather than given this sentence, which would tell somebody
      who asked for one pair of brows to ask for fewer.
    */
    const state = check("thick straight brows");
    expect(readDelta({ free: { brows: ["thick", "straight"] } }, state)).toBeNull();
    expect(state.wall?.reason).not.toBe("wall_too_many");
  });
});

describe("#2731 — a value that was nothing but THEIR brand is refused BY NAME", () => {
  it("names the wall under `marks`, and carries the subject and the bare value", () => {
    const state = check("put her in Gucci");
    expect(readDelta({ free: { marks: "Gucci" } }, state), "the delta still nulls").toBeNull();
    expect(state.wall?.reason).toBe("wall_brand_only");
    expect(field(state.wall, "asked")).toBe("marks");
    expect(field(state.wall, "value")).toBe("Gucci");
  });

  it("names it under `wardrobe` — the card's second subject", () => {
    const state = check("put her in Gucci");
    expect(readDelta({ free: { wardrobe: "Gucci" } }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_brand_only");
    expect(field(state.wall, "asked")).toBe("wardrobe");
  });

  it("names it in the MAKEUP slot — the card's third, and #2714's second instance of the class", () => {
    const state = check("give her Gucci makeup");
    expect(readDelta({ makeup: "Gucci" }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_brand_only");
    expect(field(state.wall, "asked")).toBe("makeup");
  });

  it("⚠ THE NEIGHBOUR — the brows still die beside the bare brand, and now the customer is TOLD", () => {
    const together = check("put her in Gucci with thick and straight brows");
    expect(readDelta({ free: { wardrobe: "Gucci", brows: "thick and straight" } }, together)).toBeNull();
    expect(together.wall?.reason).toBe("wall_brand_only");

    const alone = check("thick and straight brows");
    expect(readDelta({ free: { brows: "thick and straight" } }, alone)?.free?.brows).toBe("thick and straight");
    expect(alone.wall).toBeUndefined();
  });

  it("CONTROL — a brand WITH a description keeps the description, files, and walls nothing", () => {
    /*
      The scrub's own design, and what the live model does on 24 of 24: the
      name goes, the look stays. Without this arm, "a bare brand walls" is
      satisfied by a reader that walls every value naming a brand — which is
      exactly the over-reach of walling on "the customer named a brand".
    */
    const accessories = check("give her Cartier earrings");
    expect(readDelta({ free: { statedAccessories: ["Cartier earrings"] } }, accessories)?.free?.statedAccessories)
      .toEqual(["earrings"]);
    expect(accessories.wall).toBeUndefined();

    const lip = check("give her a Chanel red lip");
    expect(readDelta({ makeup: "Chanel red lip" }, lip)?.makeup).toBe("red lip");
    expect(lip.wall).toBeUndefined();
  });

  it("⚠ NEVER SAID OF A BRAND THEY DID NOT TYPE — a model-introduced mark keeps the old road", () => {
    /*
      The sentence tells somebody to stop naming a brand. Said to a customer
      who never named one, it is false — so a bare brand the MODEL brought in
      walls nothing here and nulls exactly as before, for the loop to re-sample.
    */
    const invented = check("give her a luxurious look");
    expect(readDelta({ free: { marks: "Gucci" } }, invented)).toBeNull();
    expect(invented.wall, "no brand sentence for a brand nobody typed").toBeUndefined();

    /* And a brand swapped for theirs is not theirs either. */
    const swapped = check("put her in Prada");
    expect(readDelta({ free: { wardrobe: "Gucci" } }, swapped)).toBeNull();
    expect(swapped.wall).toBeUndefined();
  });

  it("compares the MARK, not the whole value — a connective the model added does not hide their brand", () => {
    /*
      Why `bareBrandWall` is not whole-value containment: "inspired by Gucci"
      scrubs to nothing, and containment would refuse it on "inspired", a word
      the customer never typed — sending them back to "didn't come through".
    */
    const state = check("put her in Gucci");
    expect(readDelta({ free: { marks: "inspired by Gucci" } }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_brand_only");
  });

  it("folds accents, because the list carries both spellings and a reply may use the other one", () => {
    const state = check("give her Hermès makeup");
    expect(readDelta({ makeup: "Hermes" }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_brand_only");
  });

  it("NOT THIS WALL — a value the scrub empties for some OTHER reason is a reply-shape slip", () => {
    /* A lone connective scrubs to nothing with no brand in it. Telling the
       customer about brand names there would be false. */
    const state = check("give her freckles and a mole");
    expect(readDelta({ free: { marks: "and" } }, state)).toBeNull();
    expect(state.wall).toBeUndefined();
  });

  it("⚠ THE READER SPLIT HOLDS — a caller with no `check` is byte-unchanged", () => {
    expect(readDelta({ free: { marks: "Gucci" } })).toBeNull();
    expect(readDelta({ makeup: "Gucci" })).toBeNull();
    expect(() => readDelta({ free: { wardrobe: "Gucci" }, makeup: "Gucci" })).not.toThrow();
  });
});

describe("what the customer reads, and what it costs (#2730, #2731)", () => {
  const cases: Array<{ refusal: RefineRefusal; must: string[] }> = [
    {
      refusal: { reason: "wall_too_many", asked: "marks", count: 9, limit: 8 },
      must: ["I understood that", "none of it was applied", "fewer"],
    },
    {
      refusal: { reason: "wall_brand_only", asked: "wardrobe", value: "Gucci" },
      must: ["I understood that", "none of it was applied", "brand name", "the look itself"],
    },
  ];

  for (const { refusal, must } of cases) {
    describe(refusal.reason, () => {
      const said = refusalMessage({ ok: false, refusal });

      it("is free, reports as a wall, and ends with the money", () => {
        expect(REFINE_REFUSALS[refusal.reason].charge).toBe("free");
        /* It used to be counted under `unreadable`, class `unread` — a sentence
           that did not come through. It DID come through. */
        expect(REFINE_REFUSALS[refusal.reason].report).toBe("wall");
        expect(said.endsWith("Nothing was charged."), said).toBe(true);
      });

      it("says it was understood, and says the rest of the sentence went with it", () => {
        for (const words of must) expect(said, words).toContain(words);
      });

      it("⚠ never the false thing, never a number, never the machinery, never a pronoun for a person", () => {
        /* The sentence these cards exist to stop saying. */
        expect(said).not.toContain("come through");
        /* Clause 6 as an assertion: the refusal CARRIES its count and limit, or
           the bare brand, and the sentence leaks no digit. */
        expect(said, "no digit reaches the customer").not.toMatch(/\d/);
        /* Nor a count spelled out — #2730's body suggested "I can keep eight",
           and the copy rule says no. ("One kind of thing" is not a count.) */
        expect(said, "no count in words either")
          .not.toMatch(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i);
        expect(said).not.toContain("Gucci");
        /* Nothing changes on its own here, so a retry offer is a dead end. */
        expect(said).not.toContain("in a moment");
        /* #2714's advice is a different fact's: nothing here is too long. */
        expect(said).not.toContain("fewer words");
        /* The subject key is the pipeline's vocabulary, not theirs. */
        expect(said).not.toMatch(/statedAccessories|wardrobe|marks\b/);
        /* Never gender anyone — no pronoun for the cast at all. */
        expect(said).not.toMatch(/\b(she|her|hers|he|him|his)\b/i);
      });
    });
  }

  it("the re-sampled set is EXACTLY these three — a fourth must bring its argument, not slip in", () => {
    /*
      The field replaced a one-id branch in the loop. Pinning the set here is
      deliberate: a refusal that starts re-sampling changes what a customer
      waits for and what the house pays, and should redden a test that makes
      somebody write down why.
    */
    expect(REFUSAL_REASONS.filter((reason) => REFINE_REFUSALS[reason].resampled).sort())
      .toEqual(["wall_brand_only", "wall_too_long", "wall_too_many"]);
    /* The model-caused wall that is NOT re-sampled, because its re-ask is the
       echo pass — the field's own warning, held. */
    expect(REFINE_REFUSALS.wall_unfileable.resampled).toBe(false);
  });

  it("keeps the picture-reader road the brand case already had — and closes the count's, on purpose", () => {
    /*
      Both used to arrive as `unreadable`, which a words-take sentence with a
      picture attached could be answered over. The brand keeps that road: the
      picture's own words ARE the look without the label. The count does not:
      the readers read hair colour and makeup, and no picture fills a count of
      marks — the old road offered the makeup and dropped the set in silence.
    */
    expect(refusalIsAnswerableByAReader("wall_brand_only")).toBe(true);
    expect(refusalIsAnswerableByAReader("wall_too_many")).toBe(false);
    /* The controls: the list still answers the road it inherits, and is still closed. */
    expect(refusalIsAnswerableByAReader("unreadable")).toBe(true);
    expect(refusalIsAnswerableByAReader("wall_content")).toBe(false);
  });
});

describe("⚠ THE LAST SAMPLING ANSWERS — a rescue arm and a persistent arm for each wall", () => {
  /*
    The pair PR #2732's repair proved its own wall with, for each new one. The
    rescue arm is the one the relay's finding was about: a first reply that hit
    the wall and a second that does not must be SERVED, never refused. The
    persistent arm proves the wall is DISCARDED on 1 and 2 (three samplings,
    not one) and still answers in its own words rather than `unreadable`'s.
  */
  const reply = (body: Record<string, unknown>) => JSON.stringify({ intent: "edit", ...body });
  const ask = (instruction: string, engine: TextEngine) => interpretRefinement({
    instruction,
    currentEyeColour: "brown",
    currentEyeShape: null,
    engine,
  });

  it("#2730 RESCUE — nine on the first sampling, eight on the second: SERVED", async () => {
    const engine = scripted([reply({ free: { marks: NINE } }), reply({ free: { marks: EIGHT } })]);
    const parsed = await ask(NINE_SENTENCE, engine);

    expect(parsed.ok, "a servable ask must be served").toBe(true);
    expect(parsed.ok && "delta" in parsed && parsed.delta.free?.marks).toEqual(EIGHT);
    expect(engine.seen.length, "the second sampling answered, so there is no third").toBe(2);
  });

  it("#2730 PERSISTENT — nine every time: this door's words, after all three", async () => {
    const engine = scripted([reply({ free: { marks: NINE } })]);
    const parsed = await ask(NINE_SENTENCE, engine);

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.refusal.reason, "never `unreadable`").toBe("wall_too_many");
    expect(engine.seen.length, "three samplings — discarded on 1 and 2").toBe(3);
  });

  it("#2731 RESCUE — the bare brand first, the described look second: SERVED", async () => {
    const engine = scripted([reply({ makeup: "Chanel" }), reply({ makeup: "red lip" })]);
    const parsed = await ask("give her a Chanel red lip", engine);

    expect(parsed.ok, "the described half is servable and must be served").toBe(true);
    expect(parsed.ok && "delta" in parsed && parsed.delta.makeup).toBe("red lip");
    expect(engine.seen.length).toBe(2);
  });

  it("#2731 PERSISTENT — the bare brand every time: this door's words, after all three", async () => {
    const engine = scripted([reply({ makeup: "Chanel" })]);
    const parsed = await ask("give her Chanel makeup", engine);

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.refusal.reason, "never `unreadable`").toBe("wall_brand_only");
    expect(engine.seen.length, "three samplings — discarded on 1 and 2").toBe(3);
  });

  it("#2731 NEGATIVE — a brand nobody typed, every time, ends where it always did", async () => {
    /* The loop-level half of the reader's negative control: no wall is set,
       so the three samplings fall through to the old door and the customer is
       never told to stop naming a brand they did not name. */
    const engine = scripted([reply({ makeup: "Chanel" })]);
    const parsed = await ask("give her a red lip", engine);

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.refusal.reason).toBe("unreadable");
    expect(engine.seen.length).toBe(3);
  });
});

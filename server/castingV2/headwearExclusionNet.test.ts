import { describe, expect, it } from "vitest";

import { CAST_STYLES } from "../../shared/castStyles";
import { HOUSE_LANES } from "./houseBlock";
import { photorealHumanConstant } from "./cohortPhotorealHuman";
import { seedPromptRecord } from "./promptAuthor";
import { STATED_COVERING_WORDS, statedCovering } from "./statedCovering";

/**
 * THE NET UNDER HIS *"LEAVE IT AS IT IS"* — #1574, filed on his answer to #1503
 * (Desk reply #246, 2026-09-30, verbatim): *"Leave it as it is — your words go to
 * the engine on their own"*.
 *
 * # What this suite is about, and it is not a defect
 *
 * Nothing is broken today. #1503's court measured 80 renders across five
 * garments and all five come back correct from the customer's words alone, which
 * is why he chose to leave the road as it is. **This is the safety net under
 * that answer**, and #1503's own body named it as the follow-up his choice would
 * earn: *"a safety net so that if anyone ever adds a 'no hats' rule to the
 * studio's standard instructions, these garments cannot quietly start failing
 * again. That was the real reason the description existed."*
 *
 * # The thing that is gone, which is why a net is owed
 *
 * In February the founder typed *"a woman in her 30s wearing a hijab"* and got
 * back a woman in a loosely draped fashion scarf with her hair showing at the
 * front (D-124). That is not a near-miss; it is a different garment from the one
 * she asked for. The repair then was two halves: a written description of how the
 * garment sits, and a **carve-out** so the prompt's own *no hats* line could not
 * overrule it.
 *
 * **The carve-out is what is gone.** `statedCovering.ts` stopped being sent when
 * the author road became every account's road — read at the code 2026-09-30, it
 * has zero production readers — and his ruling is that it stays gone because the
 * engine no longer needs it. So if a headwear-exclusion sentence is ever added to
 * the author road's shared instructions, **there is nothing left standing between
 * it and her garment, and the failure would be silent, because a picture still
 * comes back.**
 *
 * # Why the HOUSE road is deliberately out of scope
 *
 * `cohortPhotorealHuman.ts` carries the exclusions AND the `STATED COVERINGS`
 * door that overrules them — a matched pair, consistent, and not on the author
 * road. An arm that reddened on a `no hats` line there would be red on correct
 * code. That constant is used here for one purpose only: as the POSITIVE CONTROL
 * that proves this suite's detector can actually see such a sentence when one is
 * present (working law 2 — a guard that cannot fire is not a guard).
 *
 * # Asserted at the wire (invariant 5)
 *
 * The prompt under test is composed by `seedPromptRecord`, the single production
 * composer `briefCompiler.ts` calls, over every style and lane the road can take
 * — both derived from their own exported enums rather than listed here, so a
 * second lane arrives in this population instead of slipping past it. The
 * garments are `STATED_COVERING_WORDS`, exported from the module that owns them
 * for the same reason (working law 4).
 */
describe("a headwear exclusion never reaches the author road's prompt for a stated covering (#1574)", () => {
  /**
   * The vocabulary D-124's carve-out existed to overrule.
   *
   * Written as whole words so that ordinary prose about a person cannot trip it
   * — the same posture `statedCovering` itself takes on its nouns, and the reason
   * `chador` (which contains no match) and `shadow` (which contains "had") are
   * not hits. `headwear` and `head covering` are here because they are the two
   * ways the same rule gets written when somebody rephrases rather than deletes.
   */
  const HEADWEAR_EXCLUSION = /\b(?:no|never|without)\b[^.]{0,40}\b(?:hats?|caps?|headwear|head coverings?|headgear)\b/i;

  /* A brief that states a covering, one per noun the module knows. */
  const briefFor = (word: string) => `a person in their 30s wearing a ${word}, editorial lighting`;

  it("CONTROL — the detector can see a real exclusion sentence, and the house road has one", () => {
    /*
      THE POSITIVE CONTROL COMES FIRST AND THE REST OF THIS FILE IS WORTHLESS
      WITHOUT IT. Every other arm here asserts an ABSENCE, and an absence passes
      just as happily against a detector that matches nothing at all — which is
      how a guard ships green while protecting nothing.

      The specimen is not a fixture: it is the HOUSE road's own live constant,
      which genuinely carries the sentence this suite is about.
    */
    const houseBlock = photorealHumanConstant(null);
    expect(houseBlock).toMatch(HEADWEAR_EXCLUSION);

    /* And its carve-out rides beside it, which is WHY the house road is out of
       scope rather than an oversight. If this line ever fails, the house road has
       become the thing this suite was written to prevent on the author road. */
    expect(houseBlock).toContain("STATED COVERINGS");

    /* The detector is not a substring scan for the word "hat": a garment noun on
       its own, or ordinary prose, must not read as an exclusion. */
    expect("she is wearing a wide-brimmed hat").not.toMatch(HEADWEAR_EXCLUSION);
    expect("a chador, softly lit, no shadow across the face").not.toMatch(HEADWEAR_EXCLUSION);
  });

  it("CONTROL — the composed prompt really is the author road's, not an empty string", () => {
    /*
      THE SECOND WAY AN ABSENCE ARM PASSES FOR NOTHING: composing the wrong
      thing. #1503's court pinned this by asserting its control arm WAS
      `seedPromptRecord(...)` byte for byte; the equivalent here is that what is
      being scanned carries both halves of the real prompt — the customer's own
      sentence and the locked house block.
    */
    const brief = briefFor("hijab");
    const record = seedPromptRecord({ briefText: brief, style: "photoreal", lane: "human", clause: null });
    expect(record.prompt).toContain(brief);
    expect(record.houseBlockWords).toBeGreaterThan(50);
    /* The block's own bytes are in there, so a scan of `prompt` is a scan of the
       instructions a headwear line would be added to. */
    expect(record.prompt.length).toBeGreaterThan(brief.length + 200);
  });

  it("carries no headwear exclusion for any covering the product knows, on any style or lane", () => {
    /* The population is the module's own list and the road's own enums. */
    expect(STATED_COVERING_WORDS.length).toBeGreaterThanOrEqual(5);
    expect(CAST_STYLES.length).toBeGreaterThan(0);
    expect(HOUSE_LANES.length).toBeGreaterThan(0);

    for (const word of STATED_COVERING_WORDS) {
      const brief = briefFor(word);
      /* The brief really does state a covering — otherwise this arm is testing a
         sentence the product would not treat as one. */
      expect(statedCovering(brief), `"${word}" must read as a stated covering`).not.toBeNull();

      for (const style of CAST_STYLES) {
        for (const lane of HOUSE_LANES) {
          const { prompt } = seedPromptRecord({ briefText: brief, style, lane, clause: null });
          expect(
            prompt,
            `${word} · ${style} · ${lane}: a headwear exclusion would overrule a garment the `
            + "customer asked for by name, and D-124's carve-out is gone (#1574)",
          ).not.toMatch(HEADWEAR_EXCLUSION);
        }
      }
    }
  });

  it("NEGATIVE CONTROL — a brief with no covering states none, and the road is the same one", () => {
    /*
      The no-covering brief is what makes the arm above about COVERINGS rather
      than about the author road in general. It states no covering, and its prompt
      is composed by the same call — so if a headwear line ever arrives, it
      arrives for both, and the arm above is the one that says why that matters.
    */
    const bare = "a person in their 30s, editorial lighting";
    expect(statedCovering(bare)).toBeNull();
    const { prompt } = seedPromptRecord({ briefText: bare, style: "photoreal", lane: "human", clause: null });
    expect(prompt).toContain(bare);
    expect(prompt).not.toMatch(HEADWEAR_EXCLUSION);
  });
});

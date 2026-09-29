/**
 * ⚠ A LANE THAT SILENCES IS NOT A LANE THAT SPEAKS — the founder's bald cast,
 * and the premise this file's subject stated twice and could not keep.
 *
 * # The incident
 *
 * His brief opens *"Bald male, mid-40s, pale porcelain skin…"* and roll 208 came
 * back **eight of eight with hair**. His words: *"what went wrong why did
 * everything change"*.
 *
 * Nothing changed. Roll 206 is the same 553 characters six days earlier and it
 * delivered — `SYSTEM_PROMPT` is byte-identical between the two trees, the
 * gated wardrobe and born-ink blocks were off, and the notes never overflowed
 * (149–172 against a 180 cap), so the compression was never in it either.
 *
 * # The premise, quoted from the two places that held it
 *
 * `cohortPhotorealHuman` said it in as many words, twice:
 *
 *   at the coverage guard   *"the user's own words carry it through the role
 *                            and character fields — the path that has always
 *                            worked"*
 *   at the stated-cut guard *"the honest degrade is whole-axis silence: the
 *                            user's own words still reach the picture through
 *                            the role and character fields"*
 *
 * **Both rest on `characterNotes` carrying her word.** It is written by a model
 * asked to summarise a brief, and driven through the real entrance — survival
 * counted as *present in all eight compiled prompts* — it carries it like this:
 *
 * ```
 *                    BEFORE          AFTER
 *   "bald"           1 of 3  (33%)   4 of 4  (100%)
 *   "buzzed"         1 of 4  (25%)   4 of 4  (100%)
 *   "shaved"         4 of 4 (100%)   4 of 4  (100%)   ← unmoved
 *   nine other words unmoved, inside noise (the non-additive check)
 * ```
 *
 * `statedHair` was a SUPPRESSION SIGNAL — it stopped the engine authoring a cut
 * and never said what the cut was. Right about authoring, wrong about silence.
 *
 * # What these arms hold
 *
 * They drive the WHOLE compiler with a stubbed interpreter — `partialDeference`'s
 * shape, and for its reason: *a test that supplies the input the bug corrupts
 * cannot see the bug*. The assertion is on the eight PROMPTS, because "reaches
 * the image model" is a claim about the string that is sent.
 *
 * ⚠ **And they assert the word in ALL EIGHT, never in one.** A word in some
 * prompts and not others is a sheet that disagrees with itself about the person,
 * which is worse than a clean loss and would pass a `some` check.
 */
import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/** An interpreter that says exactly this and nothing else. */
function engine(intent: Record<string, unknown>): TextEngine {
  return {
    id: "stub",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", ...intent }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

async function prompts(briefText: string, intent: Record<string, unknown>): Promise<string[]> {
  const out = (await castingBriefCompiler({
    briefText,
    candidateCount: 8,
    rollSeed: "stated-hair",
    engine: engine(intent),
  } as never)) as unknown as { candidates: Array<{ prompt: string }> };
  return out.candidates.map((one) => one.prompt);
}

const HIS_BRIEF = "Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone "
  + "structure: pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks.";

/**
 * ⚠ THE INTERPRETER AT ITS WORST — `characterNotes` WITHOUT the word.
 *
 * This is the reply roll 208 actually got, reduced to its essential shape: the
 * summary dropped "Bald" and everything else is present. If the arms below
 * passed with the word in the notes they would be proving nothing — the notes
 * are exactly the channel that fails 2 times in 3.
 */
const NOTES_WITHOUT_IT = "Weathered pale skin, pronounced brow ridge, deep-set eyes, hard jawline";

describe("a stated cut reaches the prompt, not just the record", () => {
  it("⚠ SAYS HER WORD when the notes dropped it — the founder's own case", async () => {
    const eight = await prompts(HIS_BRIEF, {
      sex: "male",
      characterNotes: NOTES_WITHOUT_IT,
      statedHair: { cutLength: "Bald", colour: null, texture: null, greying: false },
    });
    expect(eight).toHaveLength(8);
    /* ALL EIGHT. A sheet that says it about some of the people is a sheet that
       disagrees with itself about who this is. */
    for (const [index, prompt] of eight.entries()) {
      expect(prompt, `candidate ${index}`).toMatch(/\bBald\b/);
    }
    /* And the notes really did not carry it, so the sentence above is the only
       thing that could have. Without this the arm passes on a fixture that
       quietly fixed the bug for it. */
    expect(NOTES_WITHOUT_IT).not.toMatch(/bald/i);
  });

  /*
    TWO ARMS STOOD HERE — the founder's bald cast. Both read the composed hair
    sentence: one that nothing is authored AROUND a stated bald head, and its
    paired control that an empty lane says nothing at all. ⚠ The control is named
    here on purpose, because deleting an arm and keeping its control would leave
    a control over nothing, and deleting a control silently is how a suite starts
    proving less than it claims.

    ⚠ **DELETED WITH THE HOUSE ROAD — #1490 act 1, and FOLDED INTO #1125 rather
    than re-pointed.** Every one of these arms asserted that a resolved and
    persisted value left a FOOTPRINT IN THE PER-SLICE COMPOSED PROMPT. The author
    road composes no per-slice prompt: one authored prompt paints all eight and
    the dice records are marked `unsent` (#176), so there is no per-tier sentence
    to look for and nothing for the arm to be right or wrong about.

    ⚠ **THIS IS A FLOOR DROP AND IT IS SAID OUT LOUD.** The class these arms
    guard is the UNOWNED-AXIS COLLAPSE — an axis nobody owns is decided by
    whichever prior is loudest, identically on every tile — and it was caught
    FIVE separate times by the founder's own eye. It is not abandoned: #1125
    (`debt`, `rung:N3`) is exactly this loss, filed by the #180 ghost audit
    BEFORE these arms fell over, and its ruling is that the question — did the
    delivered picture carry what she asked for — is #30's, asked of a FRAME
    rather than of a prompt string.

    What survives in this file is everything that reads the PARSE or the
    RESOLVER directly, which is the half that still decides a real record.
  */

  it("⚠ HER WORD VERBATIM — the coverage case, which is the one that was broken", async () => {
    /*
      Source containment (D-172) at the place it would be easiest to lose: the
      value is hers and only the frame is ours. A composer that normalised
      "completely bald" to "bald" would be asserting a form of her sentence she
      never used.

      ⚠ **THIS ARM WENT THROUGH TWO WRONG FIXTURES AND BOTH ARE WORTH THE LINE.**
      It first used "shaved head" and was a FALSE PASS — it stayed green through
      a sabotage that silenced the fix, because a brief naming a shaved head
      pulls in the STRUCTURAL FEATURES block, whose own text lists *"a shaved
      head"*. It then used "a shaggy mullet" and went RED against working code —
      a mullet is a realizable style, so it composes normally as *"a grey
      straight shaggy mullet"* and was never broken.

      **The first fixture could not fail and the second could not pass.** Only a
      COVERAGE word exercises the defect, because only the coverage guard
      returns before her word can be said.
    */
    const eight = await prompts("A completely bald woman in her early 50s, olive-skinned.", {
      sex: "female",
      characterNotes: "Olive-skinned woman, early 50s",
      statedHair: { cutLength: "completely bald", colour: null, texture: null, greying: false },
    });
    for (const prompt of eight) expect(prompt).toMatch(/completely bald/i);
  });

});

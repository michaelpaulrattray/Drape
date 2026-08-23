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

  it("⚠ THE CONTROL — with the lane EMPTY it says nothing, exactly as before", async () => {
    /*
      The change is strictly additive and this is what proves it. An interpreter
      that leaves `cutLength` null is every roll cast before 2026-08-23, because
      the prompt told it not to fill this field for precisely these briefs. Those
      rolls must compose character for character as they did.
    */
    const eight = await prompts(HIS_BRIEF, {
      sex: "male",
      characterNotes: NOTES_WITHOUT_IT,
      statedHair: { cutLength: null, colour: null, texture: null, greying: false },
    });
    for (const prompt of eight) expect(prompt).not.toMatch(/\bBald\b/);
    /* And it did not author a cut instead — the coverage guard still holds, and
       this is the founding bug of the whole deference doctrine. */
    for (const prompt of eight) expect(prompt).not.toMatch(/HAIR: a /);
  });

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

  it("⚠ DOES NOT AUTHOR AROUND IT — no length, no texture, no worn state", async () => {
    /*
      The half the deference doctrine already owned and must keep. Saying her
      word must not become licence to hang the engine's own adjectives off it:
      "HAIR: bald" is a fact she gave us, "a tousled shoulder-length bald" is the
      contradiction D-79 was rolled back for.
    */
    const eight = await prompts(HIS_BRIEF, {
      sex: "male",
      characterNotes: NOTES_WITHOUT_IT,
      statedHair: { cutLength: "Bald", colour: null, texture: null, greying: false },
    });
    for (const prompt of eight) {
      const hair = /HAIR:[^.]*\./.exec(prompt)?.[0] ?? "";
      expect(hair, "the hair sentence").toMatch(/\bBald\b/);
      /* The realized vocabulary's own words for a cut. None of them may appear
         in a sentence about a cut she stated. */
      expect(hair).not.toMatch(/shoulder-length|cropped|tousled|swept|layered|bob\b/i);
    }
  });
});

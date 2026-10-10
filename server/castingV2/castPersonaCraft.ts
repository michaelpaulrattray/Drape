/**
 * THE CRAFT RULES BOTH PERSONA INSTRUCTIONS OBEY — extracted, not copied (#2196).
 *
 * Door 1 of #2137 asks for SIX alternative personality reads, and its card says
 * in so many words: *"Reuse `castPersonaSystemPrompt`'s rules rather than
 * writing a second copy of them (working law 4)."* A second copy is exactly
 * what this file exists to prevent — the six reads and the one drafted line are
 * the same craft asked for a different number of times, and a rule tightened in
 * one instruction while the other kept the old wording would put two different
 * house styles on one card.
 *
 * ⚠ **EVERY LINE BELOW IS THE LIVE INSTRUCTION'S OWN, MOVED RATHER THAN
 * REWRITTEN.** They were sliced out of `castPersona.ts` by a script and pasted
 * here unaltered, because retyping them is how a rule he courted comes back
 * subtly different — #2136 measured drafts 150 characters off his examples from
 * wording alone, and *context is not additive* is a measured law here.
 * `castPersonaCraft.test.ts` holds `castPersonaSystemPrompt`'s output
 * BYTE-IDENTICAL across this extraction, for all three pronoun sets, so the
 * refactor is provably not a change to what any cast is drafted from.
 *
 * ONE phrase is parameterised and it is the only divergence: the pronoun rule
 * ends *"and no other pronoun in either line"*, which is true of a two-line
 * draft and false of six reads. It is passed in rather than duplicated.
 */
import type { CastPronouns } from "./castPronouns";

/**
 * WHAT A PERSONALITY READ IS MADE OF — two sentences, each with its own job.
 *
 * His craft ruling (#2136): sentence one is REST plus the single break,
 * sentence two is TIMING. That shape is what makes a line directable, and it is
 * what every one of the six reads must also be, because a customer comparing
 * six alternatives can only compare them if they are the same kind of thing.
 */
export function personalityCraftLines(pronouns: CastPronouns): string[] {
  const object = pronouns.object;
  const possessive = pronouns.possessive;
  return [
    "PERSONALITY — exactly two sentences, and each one has its own job.",
    "SENTENCE ONE is how this performer is at REST: the set of the body, where the",
    `gaze goes, what ${possessive} hands are doing when nothing is being asked of`,
    `${object}. Inside that first sentence, name the ONE thing that breaks the`,
    "rest — a baseline and a single break, never a list of quirks.",
    "SENTENCE TWO is TIMING: how this performer moves and when they react. Speed",
    "of movement, how long a reply takes, what happens on the way from still to",
    "moving.",
  ];
}

/**
 * THE RULE THAT TURNS A FEELING INTO SOMETHING A CAMERA CAN SEE.
 *
 * His rule 2, and the one most worth sharing: a reader asked for six
 * alternatives without it writes six adjectives, and six adjectives are six
 * settings rather than six people — which is precisely how door 1 fails its own
 * disappearing-technology gate.
 */
export function cameraVisibleLines(): string[] {
  return [
    "Describe ONLY what a camera can see. A feeling-word on its own is not a line",
    "we can store: menacing, warm, confident, kind and trustworthy are claims",
    "nobody can point at. Turning a feeling into something visible is YOUR work",
    "and not the customer's — so do not write that this performer is menacing,",
    "write the physical tell: the movement that would read as menacing to",
    "someone watching it happen.",
  ];
}

/**
 * THE THREE PRONOUNS, AND NO FOURTH.
 *
 * `where` names what the rule binds — *"either line"* for the two-line draft,
 * *"any of the six"* for the reads. It is a parameter rather than two copies
 * because the rest of the rule, including the clause about never reading
 * pronouns off a face, is identical and must stay identical.
 */
export function pronounRuleLines(pronouns: CastPronouns, where: string): string[] {
  const subject = pronouns.subject;
  const object = pronouns.object;
  const possessive = pronouns.possessive;
  return [
    `Write about ${object} in the third person. Use ONLY the three pronouns given`,
    `below — "${subject}", "${object}", "${possessive}" — and no other pronoun in`,
    `${where}. The pronouns are a fact about this performer that you are given;`,
    "they are never read off the face or guessed from the picture.",
  ];
}

/** What may never be mentioned, whatever is being written. */
export function forbiddenMentionLines(): string[] {
  return [
    "Do not use a name. Do not mention photography, framing, lighting, cameras,",
    "image quality, or that this is a generated picture. Do not mention clothing",
    "unless the way it is worn is itself a physical mannerism.",
  ];
}

/**
 * HIS LENGTH RULING, VERBATIM — *"the character limit is a ceiling for rare
 * cases, never a target to fill"* (2026-10-09). It carries no number on
 * purpose; `castPersona.ts`'s `fitToCap` explains why at length.
 */
export function lengthRuleLines(): string[] {
  return [
    "Every sentence states one new thing the camera can see, said once. Match the",
    "length of the founder's examples — the character limit is a ceiling for rare",
    "cases, never a target to fill.",
  ];
}

/**
 * THE PERSONALITY EXAMPLE — handed over as SHAPE and said to be shape.
 *
 * The clause that says so travels with it in both instructions, because a
 * reader given an exemplar copies its wording if nothing stops it.
 */
export function personalityFormExampleLines(): string[] {
  return [
    "  PERSONALITY: Sits back with the shoulders dropped and both hands loose and",
    "  open on the table, the gaze level and parked on whoever is speaking; the one",
    "  break is the left hand, which turns a ring over and over and is never looked",
    "  at. Answers almost before a question has landed, then stops dead in the",
    "  middle of a sentence to think, and starts again somewhere else.",
  ];
}

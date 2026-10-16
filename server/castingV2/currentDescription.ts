/**
 * ONE CURRENT DESCRIPTION OF THE CAST — #2565 slice 1, with #2545 folded in.
 *
 * His word closing the #801 court, 2026-10-16: *"okay cool im happy with the
 * build"*, after round 2's verdict *"looks like A4 · master + one current
 * description was the best"* and *"A1+A4 · master + previous + description.
 * degraded massive by edit 6"*. And the rule for the words themselves, on
 * #2545: *"it must read naturally into the description not as an edit list"*.
 *
 * So every paid refine renders from the cast's untouched original (that was
 * already true — `claimVariant` takes the base from the CANDIDATE row), and
 * what carries the edits already made is ONE paragraph saying who they are now.
 * This module owns both halves of that paragraph's life:
 *
 *   - `writeCurrentDescription` asks the house text model to rewrite it from
 *     the previous description plus the one edit being made. It NEVER throws: a
 *     failure is a value (`{ ok: false }`) the caller answers by riding today's
 *     prompt, because a paid render must not fail, or charge differently, over
 *     a decoration. Money is untouched by construction — this runs after the
 *     claim and before the render, and nothing it returns reaches the ledger.
 *   - `describedNowSentence` is the one sentence the refine prompt carries in
 *     place of today's "Change only …" clause — A4's own wording.
 *
 * ⚠ THE PREVIOUS DESCRIPTION IS THE ONLY MEMORY, so where it is missing the
 * writer is given what it would have been built from: the roll's brief (the
 * customer's own words, which on the author road reached the engine verbatim —
 * never the per-slice `resolved` record, which is unsent dice fiction, #176)
 * and the asks already applied to this version, in order. That is how a
 * version made before the flag, or one whose writer failed, is folded in on the
 * next edit rather than lost.
 */
import { EYE_COLOURS } from "../../shared/castingRealization";
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import type { CastPronouns } from "./castPronouns";
import { pictureHalfPhrase } from "./sidePhrasing";

const log = createModuleLogger("castingV2/currentDescription");

/** A description longer than this is not a description, it is a runaway. */
export const CURRENT_DESCRIPTION_MAX_LENGTH = 2400;

/**
 * THE WRITER'S OWN DEADLINE AND RETRY BUDGET — a paid render waits on both, so
 * both are sized from what the work actually takes (the relay's finding on
 * PR #2571, which read the docblock's *"short"* against the code).
 *
 * MEASURED on the slice-1 court, 31 calls: median **1.6 s**, range
 * **1.46–3.16 s**, against renders of 70–166 s. So the engine's 45 s default
 * was fourteen times the worst reading — and `timeoutMs` is per ATTEMPT inside
 * the retry loop, so passing no `retries` (the transport's default of 2) held
 * the customer for up to **135 s** before the render even started, over a
 * decoration whose failure is free.
 *
 * 20 s is six times the measured worst case, which is headroom for a slow day
 * rather than for a hung provider; one retry absorbs a single transport blip,
 * which is worth having because a lost description is not merely a slower
 * render — the next edit re-seeds and this version stores nothing. Worst case
 * is therefore 2 × 20 s, down from 3 × 45 s.
 *
 * ⚠ THE QUEUE WAIT SITS OUTSIDE BOTH NUMBERS and is not bounded by them: this
 * call shares `openrouter-text` (concurrency 4) with 120 s interpreter calls,
 * so a busy queue can still hold it. What these two bound is this call's own
 * share of the wait, and that is all they claim.
 */
export const CURRENT_DESCRIPTION_TIMEOUT_MS = 20_000;
export const CURRENT_DESCRIPTION_RETRIES = 1;

export const CURRENT_DESCRIPTION_SYSTEM = [
  "You keep one description of a character for a casting studio: who they are and how they look right now.",
  "You are given what they looked like before one change, and the change itself. Write the description as it is after the change.",
  "",
  "Rules:",
  "- One natural paragraph of plain prose in the present tense, written in the third person with they/their. It must read as a description of a person, never as a list of edits.",
  "- Never use the words now, changed, added, removed, new, no longer, instead or anymore, and never describe the change itself. Describe the result.",
  "- Keep every fact from the previous description that the change does not touch, in its own words where you can.",
  "- When the change takes something away (glasses, a scar, horns), leave it out of the description and add one plain clause stating its absence, such as \"They wear no glasses.\"",
  "- When the change contradicts an earlier fact (a new eye colour, a shorter beard), keep only the new fact.",
  "- The description is read beside their ORIGINAL photograph. A change worded as a comparison (deeper, darker, shorter, heavier, neater) stays a comparison against how they first looked, such as \"scales a deeper emerald than their original colouring\" — never a plain \"deep emerald\", which the original photograph already satisfies.",
  "- Hair on the head and facial hair are separate features: a change to their hair never changes their beard, and a change to their beard never changes their hair.",
  "- Describe only the person: face, features, hair, skin, markings, accessories and clothing. Never the setting, background, lighting, camera, pose or picture style.",
  "- Describe the person, never the picture. Say which side of THEIR body a feature is on (their right eye, their left shoulder) and never which side of the image it appears on: no \"as you look at it\", no \"on the left of the picture\", no viewer, camera or frame talk of any kind.",
  "- Do not invent anything the previous description and the change do not say.",
  "- Reply with the description paragraph and nothing else.",
].join("\n");

export type CurrentDescriptionInput = {
  /** The previous version's own description, when it has one. */
  previous: string | null;
  /**
   * What the previous description would have been built from, used only when
   * `previous` is null: the roll's brief and the asks already applied.
   */
  seed: { brief: string; earlierAsks: readonly string[] };
  /** The one edit being made, in the customer's own words. */
  change: string;
};

export type CurrentDescriptionResult =
  | { ok: true; description: string; latencyMs: number; tokens?: { in: number; out: number }; model: string | null }
  | { ok: false; reason: "no_engine" | "failed" | "blank" | "too_long" | "edit_list" | "picture_talk"; latencyMs: number };

/** The user turn, built in one place so a test can read exactly what was asked. */
export function currentDescriptionUserTurn(input: CurrentDescriptionInput): string {
  const before = input.previous !== null && input.previous.trim() !== ""
    ? `How they looked before this change:\n${input.previous.trim()}`
    : [
      `How they were first described:\n${input.seed.brief.trim()}`,
      ...(input.seed.earlierAsks.length > 0
        ? [`Changes already made since, in order (fold them into the description):\n${input.seed.earlierAsks.map((ask) => `- ${ask.trim()}`).join("\n")}`]
        : []),
    ].join("\n\n");
  return `${before}\n\nThe change:\n${input.change.trim()}`;
}

/**
 * A REPLY THAT TALKS ABOUT THE PICTURE IS REFUSED — the wall on the stored
 * paragraph (ruled fable-20261016-2030 on #2578 §4).
 *
 * The instruction above tells the writer to describe the person and never the
 * frame. This is the backstop, and it exists because the downstream is
 * CUSTOMER-VISIBLE: #2545 hands this paragraph to the signed views, the
 * persona, the voice and the creation record. Measured on this card, a writer
 * handed the picture-half parenthetical leaked *"a right eye (on the left of
 * the picture as you look at it) of emerald green"* into the stored description
 * 2 of 3 times. The input is fixed too (the facts rendering in
 * `recipeAssembler`), so this is the second of two independent arms rather than
 * the only one.
 *
 * # It is derived from the phrase's own owner, never respelled here
 *
 * `pictureHalfPhrase` writes the sentence both halves of the product say; a
 * second spelling of it here would be the parallel copy that drifts at exactly
 * the place the phrase exists to hold still (law 4). Both halves are matched
 * because a writer paraphrases: the full phrase, and the frame-relative opener
 * on its own.
 *
 * # What it must NOT refuse
 *
 * An anatomical side is the whole point of the description — *"their right eye
 * is emerald green"* is a fact about the person and must pass. So this matches
 * the PICTURE-relative family only, and `currentDescription.test.ts` keeps an
 * anatomical arm beside every refusing one. That control is the reason the
 * match is anchored on the picture nouns rather than on "left" and "right",
 * which would refuse nearly every sided description there is.
 */
export function mentionsThePicture(text: string): boolean {
  const said = text.toLowerCase();
  /* The owner's own words for both halves, so the spelling cannot drift. */
  if (said.includes("as you look at it")) return true;
  for (const half of ["left", "right"] as const) {
    if (said.includes(pictureHalfPhrase(half))) return true;
  }
  /* The paraphrases that are still the frame rather than the body. A noun of
     the picture joined to a side is picture-talk however it is worded; "their
     left" alone never is. */
  return /\b(?:on|to|at|in|toward|towards)\s+the\s+(?:\w+\s+){0,2}?(?:left|right)\s+(?:side\s+)?of\s+the\s+(?:picture|image|photo|photograph|frame|shot)\b/.test(said)
    || /\b(?:picture|image|photo|photograph|frame|viewer|camera)(?:'s)?\s+(?:left|right)\b/.test(said);
}

/**
 * A REPLY THAT IS AN EDIT LIST IS REFUSED, NOT REPAIRED — the one shape his
 * ruling names. Bullets, numbered lines or several lines of prose are the list
 * shape; a description is one paragraph.
 */
export function looksLikeAnEditList(text: string): boolean {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
  if (lines.length > 1) return true;
  return /^\s*(?:[-*•]|\d+[.)])\s/.test(text);
}

export async function writeCurrentDescription(
  engine: TextEngine | null,
  input: CurrentDescriptionInput,
): Promise<CurrentDescriptionResult> {
  const started = Date.now();
  if (!engine) return { ok: false, reason: "no_engine", latencyMs: 0 };
  try {
    const result = await engine.complete({
      system: CURRENT_DESCRIPTION_SYSTEM,
      user: currentDescriptionUserTurn(input),
      about: "refine.describe",
      maxOutputTokens: 2000,
      timeoutMs: CURRENT_DESCRIPTION_TIMEOUT_MS,
      retries: CURRENT_DESCRIPTION_RETRIES,
    });
    const text = result.text.trim().replace(/^"([\s\S]*)"$/, "$1").trim();
    const latencyMs = result.latencyMs ?? Date.now() - started;
    if (text === "" || result.truncated) return { ok: false, reason: "blank", latencyMs };
    if (text.length > CURRENT_DESCRIPTION_MAX_LENGTH) return { ok: false, reason: "too_long", latencyMs };
    if (looksLikeAnEditList(text)) return { ok: false, reason: "edit_list", latencyMs };
    /* The render then rides today's prompt and stores nothing, which is the
       designed free failure — never a repaired paragraph, because a stripped
       sentence is a sentence nobody wrote. */
    if (mentionsThePicture(text)) return { ok: false, reason: "picture_talk", latencyMs };
    return {
      ok: true,
      description: text,
      latencyMs,
      ...(result.tokens ? { tokens: result.tokens } : {}),
      model: result.provenance?.model ?? null,
    };
  } catch (error) {
    /* The error's class only — a provider error can echo the request body, and
       the request body is the customer's brief. */
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "[currentDescription] the writer did not answer — this render rides today's prompt",
    );
    return { ok: false, reason: "failed", latencyMs: Date.now() - started };
  }
}

/**
 * THE SENTENCE THE REFINE PROMPT CARRIES, in place of "Change only …".
 *
 * Round 2's A4 arm, word for word apart from the pronoun, which tracks the cast
 * the way the identity clause beside it does: *"This is how they look now:
 * <description> Everything else about them stays exactly as in Reference 1."*
 */
export function describedNowSentence(description: string, pronouns: CastPronouns): string {
  const subject = pronouns.subject;
  const verb = pronouns.plural ? "look" : "looks";
  const body = description.trim().replace(/\s+/g, " ");
  const ended = /[.!?]$/.test(body) ? body : `${body}.`;
  return `This is how ${subject} ${verb} now: ${ended} Everything else about ${pronouns.object} stays exactly as in Reference 1.`;
}

/* ======================================================================== */
/*  THE FOLLOW BRIEF — #2576, his word 2026-10-16: "build it" (option 3).    */
/* ======================================================================== */

/**
 * WHEN A FOLLOW IS PRESSED ON A VERSION THAT HAS EDITS, the brief the cousins
 * are cast from is the roll's brief rewritten to carry the DIRECTION those edits
 * took — server-side, in the same click, before the claim. The rewritten words
 * become the new roll's recorded brief, so the new sheet shows exactly what the
 * cousins were made from and the customer can change it for the next roll.
 *
 * His ruling it is bound by, verbatim: *"following a cast is meant to show
 * cousins of that direction of cast not exact replicas of the same person you
 * followed"*. So the split the prompt pins is the whole job: what a stylist
 * would call the LOOK (hair, colour, style, augments, outfit direction, build)
 * goes in; what belongs to ONE person (an exact scar, a single mole, a
 * particular tattoo, eye colour the brief never asked for) stays out.
 *
 * Same engine, transport and failure contract as the description writer above:
 * it NEVER throws, and every failure is a value the caller answers by sending
 * the box's own words — a Follow must never fail, wait long, or cost
 * differently over a rewrite.
 */

/**
 * THE FOLLOW WAITS ON THIS ONE, SO IT IS SHORTER THAN THE REFINE'S 20 s. The
 * description writer measured median 1.6 s, worst 3.16 s over 31 calls on the
 * same engine; 8 s is two and a half times that worst case, and one retry
 * absorbs a single transport blip.
 */
export const FOLLOW_BRIEF_TIMEOUT_MS = 8_000;
export const FOLLOW_BRIEF_RETRIES = 1;

/**
 * ⚠ **ONE DEADLINE FROM THE PRESS, AND IT COVERS THE QUEUE (#2582 item 4, a
 * must-fix before the flag widens).** This docblock ended *"Worst case before
 * the roll starts: 2 × 8 s. The queue wait sits outside both numbers"* — and
 * for the refine's own writer that sentence is an honest limit, because that
 * call runs AFTER the claim and delays only a render the customer has already
 * bought. **Here it was a promise the code could not keep**: a Follow waits on
 * this before its claim, `timeoutMs` is per ATTEMPT inside the retry loop, and
 * the attempt does not begin until `openrouter-text` has a slot — concurrency
 * 4, depth 32, shared with interpreter calls of up to 120 s. `ProviderQueue.run`
 * takes no signal, so the wait for a slot is bounded by nothing at all.
 *
 * **So the number does not grow — it starts covering what it already claimed.**
 * 16.5 s is exactly the attempt budget the design already accepted (8 s + the
 * retry's 500 ms backoff + 8 s), measured off `withRetry`'s own
 * `baseDelayMs`; what changes is that the queue wait now sits INSIDE it instead
 * of on top of it. At the deadline the box's own words are sent — the roll is
 * never held past it, which is #2576's own *"never delays the roll beyond its
 * short timeout"*.
 *
 * ⚠ **BOTH HALVES ARE NEEDED AND NEITHER IS SUFFICIENT.** The signal stops the
 * retry loop dispatching again (`withRetry` checks `aborted` before each
 * attempt) and aborts an in-flight request; the race stops the customer WAITING
 * on a promise that is still queued behind four long interpreter calls, which
 * no signal the queue ignores could ever do.
 */
export const FOLLOW_BRIEF_DEADLINE_MS = 16_500;

/**
 * THE SPECIFICS THAT BELONG TO ONE FACE, NAMED ONCE (#2582 item 5).
 *
 * His ruling is the reason this is a refusal and not only a prompt rule:
 * *"cousins of that direction of cast not exact replicas"*. A rewrite that
 * invents a scar, a mole, a freckle, a tattoo or an eye colour the brief never
 * stated re-locks a whole casting call onto one face — so the brief goes out
 * carrying a feature the customer never asked for, and every cousin wears it.
 *
 * ⚠ **The prompt's own sentence is BUILT from these words** rather than
 * repeating them, because a backstop that forbids one list while the prompt
 * names another is working law 4's exact failure — and the drift would be
 * invisible, since the prompt would still read correctly. The eye-colour half
 * derives from `EYE_COLOURS`, the product's own eye vocabulary, for the same
 * reason.
 */
export const ONE_PERSON_SPECIFICS = {
  scar: { word: "scar", alsoWritten: ["scars", "scarred", "scarring"] },
  mole: { word: "mole", alsoWritten: ["moles"] },
  freckle: { word: "freckle", alsoWritten: ["freckles", "freckled", "freckling"] },
  tattoo: { word: "tattoo", alsoWritten: ["tattoos", "tattooed", "tattooing"] },
} as const;

type OnePersonSpecific = (typeof ONE_PERSON_SPECIFICS)[keyof typeof ONE_PERSON_SPECIFICS];

/**
 * Does this text state the feature, in any of the ways English writes it?
 *
 * ⚠ **EVERY WRITING OF THE WORD IS NAMED, BECAUSE THE STEM ALONE MATCHED WORDS
 * THAT ARE NOT THE FEATURE** (the relay's finding on PR #2586). This was a
 * boundary at the FRONT of the stem and nothing at the back — so **`scar`
 * matched *a red scarf* and *a scarlet coat*, and `mole` matched *molecule*
 * and *molehill***. A correct edit folded into a rewrite was then refused as an
 * invented scar, and the Follow went out silently on the box's words: the one
 * failure direction that costs a customer the feature they just asked for.
 *
 * ⚠ **The forms are WRITTEN DOWN rather than derived from the stem.** An
 * inflection rule would have to know that *scar* doubles its r and *freckle*
 * drops its e, and a fifth feature whose rule it guessed wrong would silently
 * stop being checked — where a list that is missing a form can at least be
 * read. `alsoWritten` never repeats `word`, and the suite holds every entry's forms to
 * beginning with its own word.
 */
function mentionsSpecific(text: string, specific: OnePersonSpecific): boolean {
  const forms = [specific.word, ...specific.alsoWritten].join("|");
  return new RegExp(`\\b(?:${forms})\\b`, "i").test(text);
}

/**
 * Does this text state an EYE COLOUR? The colour has to be next to the eyes:
 * a brief may say "moody teal and magenta light" without saying anything about
 * anyone's eyes, and `grey` is a colour of many things.
 */
export function statesAnEyeColour(text: string): boolean {
  const normalised = normaliseForClauses(text);
  return EYE_COLOURS.some((colour) => {
    const word = colour.replace(/[-\s]/g, "[-\\s]");
    /*
      ⚠ **THE COLOUR HAS TO BE SAYING SOMETHING ABOUT THE EYES, AND A PROXIMITY
      WINDOW IS NOT THAT — its own control caught this one.** The first version
      also matched a colour within twenty characters of "eyes", and
      *"deep-set eyes and a grey stubbled jaw"* read as an eye colour: it would
      have refused a correct rewrite of the fisherman brief in this module's own
      suite, silently, by sending the box's words. `grey` is the colour of
      weather, a coat and a jaw. Adjacency only, and the three ways English
      attaches a colour to eyes.
    */
    return new RegExp(`${word}[-\\s]eyes?\\b`).test(normalised)
      || new RegExp(`${word}[-\\s]eyed\\b`).test(normalised)
      || new RegExp(`\\beyes?\\s+(?:are|is|of)\\s+(?:a\\s+)?${word}\\b`).test(normalised);
  });
}

/**
 * The one-person specific a reply introduced that the brief never stated, or
 * null. Checked against the BRIEF rather than against a vocabulary of allowed
 * features: a brief that already says "a scar through one eyebrow" may keep it,
 * because the customer wrote it and it is the family's own direction.
 */
export function introducedOnePersonSpecific(brief: string, reply: string): string | null {
  for (const specific of Object.values(ONE_PERSON_SPECIFICS)) {
    if (mentionsSpecific(reply, specific) && !mentionsSpecific(brief, specific)) return specific.word;
  }
  if (statesAnEyeColour(reply) && !statesAnEyeColour(brief)) return "eye colour";
  return null;
}

export const FOLLOW_BRIEF_SYSTEM = [
  "You rewrite a casting brief for a casting studio. The customer cast someone from this brief, edited that cast, and now wants more people like the edited version: new people in the same direction, cousins and never copies of one person.",
  "You are given the brief and who the edited cast is now. Rewrite the brief so it naturally carries the direction their edits took.",
  "",
  "Rules:",
  "- Keep the brief's own voice, register, person and roughly its length. It must read as if the customer had always written it this way, never as a list of edits.",
  "- Never use the words now, changed, edited, updated, added, removed, new, no longer, instead or anymore, and never describe the edits themselves.",
  "- Fold in DIRECTION-LEVEL changes, the kind a whole casting call could share: hair colour, hair cut and hairstyle, overall style and look, augments, prosthetics and cybernetics, outfit direction, build, overall palette.",
  `- Leave out ONE-PERSON SPECIFICS, the kind that belong to a single face: an exact ${ONE_PERSON_SPECIFICS.scar.word}, a single ${ONE_PERSON_SPECIFICS.mole.word} or ${ONE_PERSON_SPECIFICS.freckle.word}, one particular ${ONE_PERSON_SPECIFICS.tattoo.word} or its exact placement, a precise facial feature, and eye colour unless the brief itself already states an eye colour.`,
  "- Where an edit contradicts the brief (dark hair in the brief, platinum blonde after the edit), keep only the edited direction.",
  "- The edits only ever change the PERSON. Everything in the brief that is not the person (the setting, the light, the camera and framing, the picture style and the mood) is the look of the whole casting: keep every one of those phrases word for word.",
  "- Keep everything else the brief says that the edits do not touch, in its own words where you can.",
  "- Do not invent anything the brief and the edited cast do not say.",
  "- Reply with the rewritten brief and nothing else.",
].join("\n");

export type FollowBriefInput = {
  /** The followed face's own roll brief — the customer's words. */
  brief: string;
  /** That version's current description (#2565 slice 1), when it has one. */
  description: string | null;
  /** The version's asks in order — used only when there is no description. */
  asks: readonly string[];
};

export type FollowBriefResult =
  | { ok: true; brief: string; latencyMs: number; tokens?: { in: number; out: number }; model: string | null }
  | {
    ok: false;
    reason:
      | "no_engine"
      | "no_edits"
      | "failed"
      | "blank"
      | "too_long"
      | "edit_list"
      /* The brief's other clauses did not come back — {@link clauseBalance}. */
      | "dropped_clauses"
      /* A feature of one face that the brief never stated — #2582 item 5. */
      | "one_person_specific"
      /* The deadline from the press passed, queue wait included — #2582 item 4. */
      | "deadline";
    latencyMs: number;
  };

/**
 * A REWRITE THAT LOST THE BRIEF'S OTHER CLAUSES IS REFUSED (the reviewer's risk
 * the relay verified on #2576): the failure that matters is a brief carrying
 * scene and style — "a rain-soaked alley at night, low angle, cinematic" —
 * coming back as a person-only paragraph, which loses the look of the whole
 * family. The prompt forbids it; this is the backstop a model cannot rescue
 * (law 3).
 *
 * ⚠ **IT WAS A LENGTH FLOOR — `FOLLOW_BRIEF_MIN_LENGTH_RATIO = 0.7` — AND IT
 * WAS WEAK IN BOTH DIRECTIONS (#2582 item 2, a must-fix before the flag
 * widens).** A ratio asks *how much text came back*, and that is not the
 * question:
 *
 *   - **It refused a correct removal.** "long curly red hair down to her waist"
 *     → "shaved head" is 56% of the length, so the edit's own direction was
 *     silently dropped and the Follow went out on the box's words.
 *   - **It passed the exact collapse it existed to catch.** A long brief whose
 *     scene clause is under 30% of it comes back person-only at 71% and the
 *     floor is satisfied, with the alley, the angle and the light gone.
 *
 * **What replaced it is the card's own sentence made mechanical: edits swap a
 * phrase for a phrase.** So the question is not length, it is how many of the
 * brief's clauses went missing — and the allowance is the number of edits
 * being folded in, because one edit swaps at most one phrase.
 * {@link clauseBalance} counts them; a brief clause survives if its words
 * appear verbatim ANYWHERE in the reply, so re-punctuating or merging two kept
 * phrases is not a loss.
 *
 * ⚠ **IT READ `dropped > added`, AND ADDED CLAUSES PAID FOR DROPPED ONES**
 * (the relay's finding on PR #2586). A rewrite that lost the brief's scene and
 * put back two person clauses had dropped 1 and added 2, so it PASSED — which
 * is the exact collapse this check replaced the length floor to catch, with the
 * rewrite handed a way to buy its way out. **What came back cannot pay for what
 * went missing**: the reply's own clauses are counted for the log and decide
 * nothing. {@link droppedClauseBudget} is the allowance, and it is read from the
 * edits rather than from the reply.
 *
 * ⚠ **WHAT THIS STILL DOES NOT CATCH, named rather than left to be found:**
 * the budget cannot tell WHICH clause an edit was entitled to swap, so a cast
 * carrying six edits may lose six clauses and they may be the wrong six. Telling
 * a scene clause from a person clause needs a vocabulary of scene words, and
 * that is the one thing this check may not have (below). A tighter rule is his
 * call, not a guess.
 *
 * ⚠ **It needs no vocabulary of its own, and that is deliberate** — his N3
 * ruling (*"we really cannot be working from fixed lists in a fluid editing
 * application"*) bites hardest here, because a list of scene words would decide
 * what a customer is allowed to write a brief about. This asks only what the
 * customer's own brief said and what came back.
 *
 * Both of the directions above are driven in `followBrief.test.ts`.
 */
/** Case, spacing and surrounding punctuation are never the question here. */
function normaliseForClauses(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * THE BRIEF'S CLAUSES — what a customer separates with a comma, a semicolon, a
 * full stop or a line. Single words count (`cinematic` is a whole style clause
 * and the existing arm pins its survival); a fragment under three characters is
 * punctuation noise rather than a clause.
 */
export function briefClauses(text: string): readonly string[] {
  return normaliseForClauses(text)
    .split(/[,;.!?\n\r]+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length >= 3);
}

/**
 * HOW MANY OF THE BRIEF'S CLAUSES THIS REWRITE IS ALLOWED TO LOSE.
 *
 * One edit swaps one phrase, so the edits already applied to the followed
 * version are the allowance — and a version with no asks recorded (edited
 * before the flag, or whose instructions did not survive) still gets one, so a
 * single legitimate swap is never refused.
 */
export function droppedClauseBudget(asks: readonly string[]): number {
  return Math.max(1, asks.filter((ask) => ask.trim() !== "").length);
}

/**
 * How many of the brief's clauses the reply dropped, and how many it brought.
 *
 * `dropped` is a clause whose words appear nowhere in the reply; `added` is a
 * clause of the reply that was not in the brief. ⚠ **`added` is REPORTED and
 * decides nothing** — it gated the refusal until PR #2586's finding, where new
 * person clauses were found paying for a lost scene. It stays because the two
 * numbers side by side are what a diagnosis starts from.
 */
export function clauseBalance(brief: string, reply: string): { dropped: number; added: number } {
  const replyText = normaliseForClauses(reply);
  const briefText = normaliseForClauses(brief);
  const dropped = briefClauses(brief).filter((clause) => !replyText.includes(clause)).length;
  const added = briefClauses(reply).filter((clause) => !briefText.includes(clause)).length;
  return { dropped, added };
}

/** The user turn, built in one place so a test reads exactly what was asked. */
export function followBriefUserTurn(input: FollowBriefInput): string {
  const description = input.description?.trim() ?? "";
  const after = description !== ""
    ? `Who the edited cast is:\n${description}`
    : `The edits they made to that cast, in order:\n${input.asks.map((ask) => `- ${ask.trim()}`).join("\n")}`;
  return `The brief:\n${input.brief.trim()}\n\n${after}`;
}

export async function writeFollowBrief(
  engine: TextEngine | null,
  input: FollowBriefInput,
  maxLength: number,
): Promise<FollowBriefResult> {
  const started = Date.now();
  if (!engine) return { ok: false, reason: "no_engine", latencyMs: 0 };
  const hasDescription = (input.description?.trim() ?? "") !== "";
  if (!hasDescription && input.asks.filter((ask) => ask.trim() !== "").length === 0) {
    return { ok: false, reason: "no_edits", latencyMs: 0 };
  }
  /*
    THE DEADLINE IS ARMED BEFORE THE CALL, SO THE QUEUE WAIT IS INSIDE IT
    (#2582 item 4). The signal stops the retry loop dispatching again and aborts
    an in-flight request; the race below stops the customer waiting on a promise
    the queue has not started. A caller that hands its own signal keeps it — the
    roll's own cancellation outranks this one.
  */
  /*
    A CONTROLLER RATHER THAN `AbortSignal.timeout`, for two reasons that both
    earn their line: the timer is CLEARED on every road out, so a follow that
    answered in 1.6 s leaves nothing holding a handle for the remaining fifteen
    seconds — and a suite's fake clock can drive it, where `AbortSignal.timeout`
    runs on an internal timer no fake clock patches, which is how the first
    version of this arm "passed" by timing the test out instead.
  */
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), FOLLOW_BRIEF_DEADLINE_MS);
  try {
    const answered = await Promise.race([
      engine.complete({
        system: FOLLOW_BRIEF_SYSTEM,
        user: followBriefUserTurn(input),
        about: "follow.brief",
        maxOutputTokens: 2000,
        timeoutMs: FOLLOW_BRIEF_TIMEOUT_MS,
        retries: FOLLOW_BRIEF_RETRIES,
        signal: deadline.signal,
      }),
      new Promise<"deadline">((resolve) => {
        deadline.signal.addEventListener("abort", () => resolve("deadline"), { once: true });
      }),
    ]);
    if (answered === "deadline") {
      return { ok: false, reason: "deadline", latencyMs: Date.now() - started };
    }
    const result = answered;
    const text = result.text.trim().replace(/^"([\s\S]*)"$/, "$1").trim();
    const latencyMs = result.latencyMs ?? Date.now() - started;
    if (text === "" || result.truncated) return { ok: false, reason: "blank", latencyMs };
    if (text.length > maxLength) return { ok: false, reason: "too_long", latencyMs };
    /* A one-paragraph brief that comes back as lines or bullets came back as an
       edit list. A brief the customer wrote on several lines may keep them. */
    if (!/\n/.test(input.brief.trim()) && looksLikeAnEditList(text)) {
      return { ok: false, reason: "edit_list", latencyMs };
    }
    /* The brief's other clauses must come back — a swap moves one for one, and
       what the reply ADDED never pays for what it dropped. */
    const balance = clauseBalance(input.brief, text);
    const budget = droppedClauseBudget(input.asks);
    if (balance.dropped > budget) {
      log.warn(
        { dropped: balance.dropped, added: balance.added, budget, latencyMs },
        "[currentDescription] the rewrite dropped more of the brief than the edits allow — this follow sends the box's words",
      );
      return { ok: false, reason: "dropped_clauses", latencyMs };
    }
    /* And it may not hand a whole casting call one face's scar. */
    const specific = introducedOnePersonSpecific(input.brief, text);
    if (specific !== null) {
      log.warn(
        { specific, latencyMs },
        "[currentDescription] the rewrite introduced a one-person specific — this follow sends the box's words",
      );
      return { ok: false, reason: "one_person_specific", latencyMs };
    }
    return {
      ok: true,
      brief: text,
      latencyMs,
      ...(result.tokens ? { tokens: result.tokens } : {}),
      model: result.provenance?.model ?? null,
    };
  } catch (error) {
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "[currentDescription] the follow brief writer did not answer — this follow sends the box's words",
    );
    return { ok: false, reason: "failed", latencyMs: Date.now() - started };
  } finally {
    /* Every road out, including the deadline's own: a 16.5 s handle left behind
       by a follow that answered in 1.6 s would hold a process from exiting. */
    clearTimeout(timer);
  }
}

/**
 * WHO SHE IS ON CAMERA, AND HOW SHE SOUNDS — N2b's reader (#1242).
 *
 * His brief, verbatim on the card: *"Personality and voice are born at Sign, as
 * editable text."* Two short artifacts derived once inside the package mint, no
 * step added to the Sign ceremony and no question before the button.
 *
 * ============================================================================
 * THE THREE SOURCES, AND WHY ALL THREE
 * ============================================================================
 *
 * His brief names them and the reason is in the naming: *"the brief supplies
 * the register; the picture personalizes."*
 *
 *  1. **The roll brief** — her ROLE, in the customer's own typed words. This is
 *     `casting_rolls.briefText` and never `models.masterPrompt`: the latter is
 *     the whole composed roll prompt, carrying framing, camera, realism,
 *     negatives and an authority paragraph, and feeding it to a reader asked
 *     *"who is this person"* would have it describing our photography
 *     instruction. The orchestrator's own `description` field carries that
 *     measurement.
 *  2. **Her edit sentences** — every correction she typed while refining this
 *     face. His brief: *"each correction is the user describing who she is."*
 *     The signed variant's `instructions`, which the schema calls *"the user's
 *     OWN sentences, in order, oldest first"*.
 *  3. **The signed picture** — a vision read of the specific frame she chose.
 *     This is what makes two siblings signed from one roll come out as two
 *     different people: the brief is identical for both, the photograph is not.
 *
 * ⚠ **ONE CALL PRODUCES BOTH LINES, and that is a cost decision rather than a
 * convenience.** Voice and personality are two readings of one photograph and
 * one brief; asking twice would post the same frame twice and pay twice to
 * learn one thing. The disappearing-technology law's third clause obliges the
 * price to be stated, so it is stated on one bucket: `about: "persona"`, its
 * own census word for exactly this reason.
 *
 * ============================================================================
 * LAW 9 — THIS READER PROPOSES, IT NEVER RULES
 * ============================================================================
 *
 * *"the engine lies and cannot be trusted"* (founder, 2026-08-16). So:
 *
 *  - every line it writes arrives BADGED as a draft and is hers to rewrite;
 *  - a read that fails writes NOTHING — `null`, both lines absent, no badge —
 *    because a blank card with a badge on it is a feature that looks broken,
 *    and an invented line is worse than no line;
 *  - nothing reads these two lines to build a prompt anywhere. They are shown
 *    to their owner and to nobody and nothing else until she has seen them.
 *
 * ============================================================================
 * WHAT IT IS NOT ALLOWED TO SAY
 * ============================================================================
 *
 * **Camera-visible traits only** — posture, gaze, tempo, hands. His brief's own
 * exclusion: *"never inner states without a physical tell."* A reader told to
 * describe a personality from a photograph will otherwise write *"warm and
 * trustworthy"*, which is a claim about a person nobody can see and the kind of
 * sentence a customer cannot act on.
 *
 * **The form is a baseline plus one exception**, which is his specimen's shape:
 * a steady state, then the one thing that breaks it. That shape is what makes a
 * line directable — a director can ask for the exception.
 *
 * ⚠ **HIS SPECIMENS ARE HANDED OVER AS SHAPE AND SAID TO BE SHAPE.** A reader
 * given an exemplar copies its wording if nothing stops it, and *"holds eye
 * contact a beat too long"* arriving on every cast in the product would be this
 * feature failing in the most visible way available. The system prompt says the
 * examples are form and that their wording may not be reused; the court reads
 * real output for the echo, because a prompt instruction is a request and not a
 * guarantee.
 */
import { z } from "zod";

import { CAST_PERSONALITY_MAX_LENGTH, CAST_VOICE_MAX_LENGTH } from "../../shared/inputLimits";
import { createModuleLogger } from "../logging/logger";
import { ProviderError, type ReferenceImage, type TextEngine } from "../providers/types";
import type { CastPronouns } from "./castPronouns";
import { boundForJudge } from "./judgeFrame";

const log = createModuleLogger("castingV2/castPersona");

/** The two lines, as they are written to the Cast's own row. */
export type CastPersonaDraft = {
  /** At most two sentences: a camera-visible baseline, then its one exception. */
  personality: string;
  /** One line of register and delivery. */
  voice: string;
};

/**
 * HOW MANY OF HER OWN SENTENCES RIDE ALONG, newest last.
 *
 * Her edit history is unbounded — a face can be refined any number of times —
 * and an unbounded customer field going into a prompt is both a cost with no
 * ceiling and a read whose later sentences get buried. Twenty is far past any
 * refine stack this product has measured and keeps the ask small.
 *
 * The NEWEST are kept rather than the oldest, because a correction supersedes
 * the thing it corrected: *"actually make her hair shorter"* said last is the
 * state of the face, and the sentence it overruled is not.
 */
export const PERSONA_EDIT_SENTENCE_LIMIT = 20;

/** One sentence's own ceiling, so a single long paste cannot become the whole ask. */
export const PERSONA_EDIT_SENTENCE_MAX_CHARS = 240;

/**
 * THE CEILING IS FOR TWO SHORT LINES AND NOTHING MAY EAT IT.
 *
 * Two sentences and one line is ~120 tokens. 800 is six times the answer and
 * still small — the judge's own note one file over records what happens when a
 * served model spends its completion on reasoning first: an empty reply, twice
 * in thirty seconds, on a view the customer had already paid for. `reasoning`
 * is asked off below and the ceiling is sized as though it were ignored, because
 * a transport must not depend on a model honouring a request.
 */
export const PERSONA_MAX_OUTPUT_TOKENS = 800;

/**
 * THE DEADLINE, AND WHY IT IS THE JUDGE'S RATHER THAN A SMALLER GUESS.
 *
 * The conformance judge posts TWO full-resolution frames — 7,578 prompt tokens
 * measured — and its answers came back in 23.3 s and 36.3 s on the founder's own
 * frames, which is why it sits at 75 s with one retry. This call posts ONE
 * frame and a few hundred characters of text, so the judge's measurement is an
 * upper bound on it rather than a comparison.
 *
 * It is set to the same 75 s anyway, deliberately: a deadline is a bound and not
 * a buy, it costs nothing when the answer arrives in a third of it, and sizing
 * it from a guess about how much faster one frame is than two is how a call
 * comes to be cut off for a reason nobody measured. The court's measured latency
 * is reported on the card beside the price.
 */
export const PERSONA_TIMEOUT_MS = 75_000;

const linesSchema = z
  .object({
    personality: z.string(),
    voice: z.string(),
  })
  .strict();

export type CastPersonaRequest = {
  /** The frame she signed — source 3, and the only reason two siblings differ. */
  anchor: ReferenceImage;
  /** Her own typed brief for the roll, or null for a Cast with no source roll. */
  brief: string | null;
  /** Her own correction sentences, oldest first; empty when she refined nothing. */
  editSentences: readonly string[];
  /**
   * What a kept sentence above once asked for and no longer does (#2669).
   *
   * Optional because most Casts never had a step pruned, and a caller that
   * cannot derive the ancestry passes nothing rather than guessing — the
   * reader then behaves exactly as it did before this card.
   */
  takenBack?: readonly string[];
  /** The three words the product uses for her, so the lines read as English. */
  pronouns: CastPronouns;
  signal?: AbortSignal;
};

export type CastPersonaReader = {
  /** The two lines, or `null` when the read could not be made at all. */
  read(request: CastPersonaRequest): Promise<CastPersonaDraft | null>;
};

/**
 * THE INSTRUCTION. Kept here, in one string, because every clause in it is a
 * rule from his brief and a reader of this file should be able to check it
 * against the card without opening a prompt builder.
 */
export function castPersonaSystemPrompt(pronouns: CastPronouns): string {
  const rules = castPersonaCraftRules(pronouns);
  return [
    "You write two short lines for a casting studio's cast page. They describe a",
    "performer the customer has just cast, and the customer reads them as a first",
    "draft they are free to rewrite.",
    "",
    ...rules.personality,
    "",
    ...rules.cameraOnly,
    "",
    ...rules.voice,
    "",
    ...rules.writing,
    "",
    ...rules.length,
    "",
    "The two examples below are the FORM to produce — the two jobs per line, the",
    "rhythm, and the length. Their WORDING is not available to you: do",
    "not reuse their phrases, and do not describe this performer as doing the",
    "same things.",
    ...rules.personalityExample,
    ...rules.voiceExample,
    "",
    'Answer with JSON only: {"personality": "...", "voice": "..."}',
  ].join("\n");
}

/**
 * THE CRAFT RULES, ONE COPY — shared by the Sign's draft above and by the
 * "say it your way" translation (`castPersonaTranslate.ts`, #2197 / #2205).
 *
 * His craft note for that door is why it reuses these rather than carrying its
 * own: *"The translation from feeling-words to camera-words is the engine's
 * job, never the customer's."* That sentence is already the camera-only block
 * below, and a second copy of it would be the first thing to drift (working
 * law 4). Each block is exactly the lines the Sign's instruction has always
 * carried: `castPersonaSystemPrompt` is composed from them, and its bytes did
 * not move when they were factored out — `castPersonaTranslate.test.ts` pins
 * the composed text against a digest of the instruction as it stood before.
 */
export type CastPersonaCraftRules = {
  /** The PERSONALITY paragraph: rest with one break, then timing. */
  personality: string[];
  /** Feeling-words become physical tells — the customer never does that work. */
  cameraOnly: string[];
  /** The VOICE paragraph and the rule on where its break may land. */
  voice: string[];
  /** Third person, the given pronouns only, no name, no photography. */
  writing: string[];
  /** One new thing per sentence, his examples' length, the cap is a ceiling. */
  length: string[];
  /** His personality specimen, indented, for FORM only. */
  personalityExample: string[];
  /** His voice specimen, indented, for FORM only. */
  voiceExample: string[];
};

export function castPersonaCraftRules(
  pronouns: CastPronouns,
  /*
    WHAT THE PRONOUN RULE BINDS, and the ONE thing a caller may vary (#2196).

    The rule ends "and no other pronoun in either line", which is true of the
    two-line draft and of one translated line, and FALSE of the six
    alternatives door 1 offers. It is a parameter rather than a second copy of
    the block because the rest of the sentence — including the clause about
    never reading pronouns off a face — is identical and must stay identical.

    The default is the drafted line's own wording, so every caller that does
    not pass it renders exactly the bytes it rendered before this parameter
    existed; `castPersonaCraft.test.ts` holds that against a golden.
  */
  where: string = "either line",
): CastPersonaCraftRules {
  const subject = pronouns.subject;
  /*
    ⚠ THE OBJECT FORM IS A SEPARATE WORD AND TWO CLAUSES NEED IT.

    Both of them read correctly for a "she" cast, which is why neither was ever
    seen: "asked of her" and "Write about her" are both grammatical because
    SHE's subject and object forms differ only in the subject slot. Rendered for
    a "he" cast — his own Pigman — the same two clauses said "when nothing is
    being asked of he" and "Write about he in the third person", and for a
    "they" cast "asked of they". The suite's only prompt fixture is `she`, so a
    grammar defect in the live instruction for every other cast could not show
    there either. Found by printing the instruction for `he` before the court
    ran, which is working law 1: the artifact, at the resolution the claim needs.
  */
  const object = pronouns.object;
  const possessive = pronouns.possessive;
  return {
    personality: [
      "PERSONALITY — exactly two sentences, and each one has its own job.",
      "SENTENCE ONE is how this performer is at REST: the set of the body, where the",
      `gaze goes, what ${possessive} hands are doing when nothing is being asked of`,
      `${object}. Inside that first sentence, name the ONE thing that breaks the`,
      "rest — a baseline and a single break, never a list of quirks.",
      "SENTENCE TWO is TIMING: how this performer moves and when they react. Speed",
      "of movement, how long a reply takes, what happens on the way from still to",
      "moving.",
    ],
    cameraOnly: [
      "Describe ONLY what a camera can see. A feeling-word on its own is not a line",
      "we can store: menacing, warm, confident, kind and trustworthy are claims",
      "nobody can point at. Turning a feeling into something visible is YOUR work",
      "and not the customer's — so do not write that this performer is menacing,",
      "write the physical tell: the movement that would read as menacing to",
      "someone watching it happen.",
    ],
    voice: [
      "VOICE — two parts in one short passage. FIRST the sound of it: timbre, pitch,",
      "weight, texture, and the one thing that breaks the pattern. THEN how this",
      `performer USES it — the pace, how much ${subject} says, and how a question`,
      "gets answered. Both halves are required: a line that only says what the voice",
      "sounds like is half the line.",
      "",
      "Whatever breaks the voice lands on something a performer can DO: a breath, an",
      "exhale, a laugh, a pause, the end of a sentence, a question. Never a speech",
      'sound and never a letter — not "on certain vowels", not "on a hard',
      'consonant" — because nobody can rehearse which sounds those are.',
    ],
    writing: [
      `Write about ${object} in the third person. Use ONLY the three pronouns given`,
      `below — "${subject}", "${object}", "${possessive}" — and no other pronoun in`,
      `${where}. The pronouns are a fact about this performer that you are given;`,
      "they are never read off the face or guessed from the picture.",
      "Do not use a name. Do not mention photography, framing, lighting, cameras,",
      "image quality, or that this is a generated picture. Do not mention clothing",
      "unless the way it is worn is itself a physical mannerism.",
    ],
    length: [
      "Every sentence states one new thing the camera can see, said once. Match the",
      "length of the founder's examples — the character limit is a ceiling for rare",
      "cases, never a target to fill.",
    ],
    personalityExample: [
      "  PERSONALITY: Sits back with the shoulders dropped and both hands loose and",
      "  open on the table, the gaze level and parked on whoever is speaking; the one",
      "  break is the left hand, which turns a ring over and over and is never looked",
      "  at. Answers almost before a question has landed, then stops dead in the",
      "  middle of a sentence to think, and starts again somewhere else.",
    ],
    voiceExample: [
      "  VOICE: A dry, light voice pitched higher than the frame suggests, even and",
      "  unhurried until a laugh clips it short. Talks in long unbroken runs",
      "  and meets a question with a question, giving the answer two turns later.",
    ],
  };
}

/** Her own words, bounded and in order, or a sentence saying there are none. */
export function castPersonaEditBlock(sentences: readonly string[]): string {
  const kept = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .slice(-PERSONA_EDIT_SENTENCE_LIMIT)
    .map((sentence) => sentence.slice(0, PERSONA_EDIT_SENTENCE_MAX_CHARS));
  if (kept.length === 0) return "The customer refined nothing — there are no correction sentences.";
  return kept.map((sentence) => `- ${sentence}`).join("\n");
}

/**
 * THE CORRECTIONS, AND WHAT A LATER STEP TOOK BACK OUT OF ONE (#2669).
 *
 * ============================================================================
 * WHAT GOES WRONG, MEASURED BEFORE IT WAS FIXED
 * ============================================================================
 *
 * A pruned refine step KEEPS ITS SENTENCE — `chainAfterRemoval`, D-171, because
 * the record is what the customer typed and rewriting it to match the outcome
 * is the record drifting from the person. So after *"remove the fangs"* the
 * record still reads *"add fangs and horns"*, and both of these readers were
 * handed that sentence under the line *"each one is the customer telling you
 * who this person is"* with nothing beside it saying half of it was taken back.
 *
 * ⚠ **THE CARD THAT FILED THIS CALLED IT LOWER RISK BECAUSE BOTH READERS WRITE
 * CAMERA-VISIBLE MANNER RATHER THAN FEATURES. THE MEASUREMENT RAN THE OTHER
 * WAY, AND THE CRAFT RULE IS THE MECHANISM.** `castPersonaCraftRules` asks for
 * a baseline and then *"the ONE thing that breaks the rest"* — so a reader
 * hunting a distinctive break reaches for the most distinctive thing in front
 * of it, which is the sentence. Driven through both real entrances on a dev
 * signed cast with **no external ears at all** and a closed mouth of small even
 * teeth, three repeats an arm (`_2669-pruned-leak-court-disposable.mts`):
 *
 * ```
 *                    persona   six reads
 *   control            0/3        0/3     ← its own sentences; nothing pruned
 *   a pruned sentence  3/3        1/3
 *   "add fangs …"      0/3        2/3
 * ```
 *
 * The control is what makes it attributable: neither reader invents these from
 * the photograph. What it wrote, verbatim, on a cast that has no ears — *"the
 * one break is the notched left ear, which twitches at any sound from that
 * side"* — three times out of three, in the very slot the craft rule asks for.
 *
 * ============================================================================
 * ⚠ AND A REWORDING WAS TRIED FIRST AND MEASURED NOT TO WORK
 * ============================================================================
 *
 * The cheaper repair is one clause naming the photograph as the authority over
 * the sentences: no read at either entrance, and it would have covered a
 * correction that was never painted as well as one taken back. It was built and
 * re-driven on the same fixture, and it is **not here because it did not
 * work** — leaking rows went **6 of 18 → 7 of 18**, and the arm that leaks
 * worst did not move at all (persona 3/3 → 3/3). Both runs are on #2669.
 *
 * That is this repository's own measured class rather than a surprise — #1612:
 * *"a vision model reading a two-part prose rule answers the easy half"*, after
 * three rewordings were courted on #1582 and each one broke a correct picture.
 * **So the words are handed over as a LIST of what is no longer true**, which
 * is the shape the description writer already proved on this exact defect
 * (`currentDescription.ts`'s `takenBack`, #2665/#2668) rather than a second
 * invention. Measured the same way: **0 of 12**, both readers, both features.
 *
 * ⚠ **WHAT THIS DOES NOT DO, NAMED:** it does not make the photograph beat the
 * sentence in general, so a correction that was never PAINTED — the same defect
 * from the same slot, with nothing in the lineage to derive — is untouched by
 * it. That is a floor rather than coverage.
 */
export function castPersonaEditAsk(input: {
  sentences: readonly string[];
  /**
   * What a kept sentence above once asked for and no longer does.
   *
   * `takenFromKeptSentences` (`refineRemoval.ts`) derives these from the
   * version ancestry; empty is the ordinary case and costs nothing.
   */
  takenBack?: readonly string[];
}): string {
  const heading = [
    "CORRECTIONS THE CUSTOMER MADE while refining this face, oldest first.",
    "Each one is the customer telling you who this person is:",
    castPersonaEditBlock(input.sentences),
  ];
  const taken = (input.takenBack ?? [])
    .map((words) => words.trim())
    .filter((words) => words !== "")
    .slice(0, PERSONA_EDIT_SENTENCE_LIMIT)
    .map((words) => words.slice(0, PERSONA_EDIT_SENTENCE_MAX_CHARS));
  /* Nothing to say when nothing was taken back, which is almost every cast —
     a paragraph about an empty list is tokens spent to confuse. */
  if (taken.length === 0) return heading.join("\n");
  return [
    ...heading,
    "",
    "PART OF A CORRECTION ABOVE WAS TAKEN BACK AFTERWARDS. The words below are",
    "no longer true of this performer and the photograph does not show them.",
    "Nothing you write may name any of them:",
    ...taken.map((words) => `- ${words}`),
  ].join("\n");
}

export function createCastPersonaReader(config: { engine: TextEngine }): CastPersonaReader {
  return {
    async read(request) {
      /*
        BOUND THE FRAME WITH THE JUDGE'S OWN BOUNDER, not a second one.

        `judgeFrame` exists because this exact road has a measured cliff: above
        ~8–9 MB of base64 no answer came back inside the deadline at all. A
        second resizer here would be a copy of that knowledge that drifts from
        it (working law 4), and the first thing it would drift on is the number.
      */
      let boundedImage: ReferenceImage;
      try {
        boundedImage = (await boundForJudge(request.anchor)).image;
      } catch (error) {
        log.warn({ err: error }, "[castPersona] the signed frame could not be bounded — no lines derived");
        return null;
      }

      const pronouns = request.pronouns;
      const brief = request.brief?.trim();
      const user = [
        "IMAGE 1 is the photograph of this performer that the customer signed.",
        "",
        `PRONOUNS: ${pronouns.subject} / ${pronouns.object} / ${pronouns.possessive}`,
        "",
        "WHAT THE CUSTOMER ASKED FOR when casting, in their own words:",
        brief ? brief : "Nothing was typed — read the photograph alone.",
        "",
        castPersonaEditAsk({ sentences: request.editSentences, takenBack: request.takenBack }),
      ].join("\n");

      let text: string;
      try {
        const reply = await config.engine.complete({
          system: castPersonaSystemPrompt(pronouns),
          user,
          about: "persona",
          images: [boundedImage],
          json: true,
          temperature: 0,
          reasoning: "off",
          maxOutputTokens: PERSONA_MAX_OUTPUT_TOKENS,
          timeoutMs: PERSONA_TIMEOUT_MS,
          retries: 1,
          signal: request.signal,
        });
        /*
          A reply cut off at the ceiling is a FRAGMENT, and a fragment of JSON
          fails the whole parse rather than degrading to a missing field. It is
          not retried here — the engine has already paid its one retry, and this
          read is worth no more than that: two empty lines cost the customer
          nothing, and a third attempt costs the house money on every Sign.
        */
        if (reply.truncated) {
          log.warn("[castPersona] the read was cut off at the token ceiling — no lines derived");
          return null;
        }
        text = reply.text;
      } catch (error) {
        const retryable = error instanceof ProviderError && error.retryable;
        log.warn({ err: error, retryable }, "[castPersona] the read did not come back — no lines derived");
        return null;
      }

      return parseCastPersonaDraft(text);
    },
  };
}

/**
 * The reply, read strictly — EXPORTED so the parse can be driven without an
 * engine, and so a court can read a real reply through the same code the mint
 * uses rather than through a second reader of the same JSON.
 */
export function parseCastPersonaDraft(raw: string): CastPersonaDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    log.warn("[castPersona] the reply was not JSON — no lines derived");
    return null;
  }
  const read = linesSchema.safeParse(parsed);
  if (!read.success) {
    log.warn("[castPersona] the reply did not carry both lines — no lines derived");
    return null;
  }
  /*
    FIT EACH LINE TO THE CAP THE CUSTOMER IS HELD TO — the relay's finding 3
    on PR #2114.

    `inputLimits.ts` says of these two numbers: *"the sizes are the CUSTOMER's
    ceiling, not the drafter's"*. That was the hole. Nothing bounded the
    DRAFTER, so a long reply was stored and drawn, and then the first thing done
    with it was refused: `editCastPersonaField` rejects over the cap, and the
    textarea's own `maxLength` will not even let them type — **so a one-word
    change to a line the product wrote could not be saved, and nothing on the
    card could say why.** A customer meeting our own number as a wall is the
    disappearing-technology law failing.

    It is fitted here rather than refused, because the alternative throws away a
    good line: the "both lines or neither" rule below means one long voice line
    would take a perfectly fine personality down with it.
  */
  /*
    Cleaned as well as fitted (#2276): litter the model left after the last
    sentence — `</s>` on five of six reads on the sibling road — and a stray
    trailing fragment are cut before the fit, so a marker is never saved on
    the card.

    ⚠ **`keepWhenEmptied` AND THE REASON IS THE BOTH-OR-NEITHER ARM TEN LINES
    BELOW (the relay's finding on PR #2278).** The cleaning may cut this line;
    it may not empty it. On the reads an emptied line costs one read of six;
    here it costs the customer their whole personality and voice card on a cast
    they have just paid to sign, and the shapes that would empty it — a line
    with no final full stop, or ending on a one-word sentence — are ordinary
    model replies rather than litter.
  */
  const personality = fitProseToCap(read.data.personality, CAST_PERSONALITY_MAX_LENGTH, {
    keepWhenEmptied: true,
  });
  const voice = fitProseToCap(read.data.voice, CAST_VOICE_MAX_LENGTH, { keepWhenEmptied: true });
  /*
    BOTH LINES OR NEITHER, and that is a product rule rather than strictness.

    One line present and one empty draws a card with a badge over nothing,
    which is the "feature that looks broken" his brief rules out. A partial
    answer is a failed read.

    ⚠ It is also where an unfittable line lands: `fitToCap` returns `""` when
    it cannot cut one, so an over-long reply with no sentence end in reach is a
    FAILED READ — no lines, no badge, no card — rather than a truncation mid-word
    or a line the customer cannot edit.
  */
  if (!personality || !voice) {
    log.warn(
      { hasPersonality: Boolean(personality), hasVoice: Boolean(voice) },
      "[castPersona] only one of the two lines came back — no lines derived",
    );
    return null;
  }
  return { personality, voice };
}

/**
 * CUT A DRAFTED LINE TO THE CUSTOMER'S CEILING, AT A SENTENCE END OR NOT AT ALL.
 *
 * Returns the line when it already fits, the longest whole-sentence prefix that
 * fits when it does not, and `""` when even the first sentence is over — which
 * `parseCastPersonaDraft`'s both-or-neither arm turns into a failed read.
 *
 * ⚠ **A SENTENCE BOUNDARY AND NEVER A CHARACTER COUNT.** Cutting at the cap
 * would hand back *"…holds eye contact a beat too long and then lo"*, which
 * reads as a bug rather than as a draft, and the customer would have to finish
 * our sentence before saving their own edit. A line cut after a full stop reads as a
 * shorter line, which is what a draft is allowed to be.
 *
 * ⚠ **THE INSTRUCTION STILL CARRIES NO NUMBER, AND HIS OWN RULE IS WHY THAT
 * DISTINCTION IS WORTH KEEPING.** Telling the model a character budget is the
 * tempting second half and it is not taken: *context is not additive* is a
 * measured law here, one clause moves every cast, and a deterministic bound at
 * the parse costs nothing and cannot regress the writing. What his craft ruling
 * of 2026-10-09 added is the OPPOSITE of a budget and is in the instruction
 * verbatim — *"the character limit is a ceiling for rare cases, never a target
 * to fill"* — because the first court measured drafts 150 characters longer than
 * his own examples saying the same facts. A ceiling named without its number
 * cannot be filled to; a number given would be. The craft stays in the
 * instruction (camera-visible, rest then timing, match his lengths); the
 * arithmetic stays here.
 */
export function fitToCap(line: string, cap: number): string {
  if (line.length <= cap) return line;
  /* Look only inside what fits, so the boundary we find is one we can keep. */
  const reach = line.slice(0, cap);
  const end = Math.max(reach.lastIndexOf("."), reach.lastIndexOf("!"), reach.lastIndexOf("?"));
  /* `< 1` and not `< 0`: a full stop at index 0 is punctuation with no sentence
     in front of it, and cutting there would draw a card reading "." with a
     Drafted badge on it. */
  if (end < 1) {
    log.warn(
      { cap, length: line.length },
      "[castPersona] a drafted line was over the cap with no sentence end inside it — no lines derived",
    );
    return "";
  }
  const cut = reach.slice(0, end + 1).trim();
  log.info(
    { cap, from: line.length, to: cut.length },
    "[castPersona] a drafted line was over the cap and was cut at a sentence end",
  );
  return cut;
}

/**
 * CUT ANYTHING THE MODEL LEFT AFTER THE LAST FULL STOP — measured, not feared.
 *
 * ⚠ **THE SIX READS CAME BACK CARRYING RAW TRANSPORT MARKERS, AND A CUSTOMER
 * WOULD HAVE READ THEM.** The court's third run produced six good reads for
 * his own Pigman and every one of them ended in litter: five closed
 * `…outran the decision.</s>` and one `…behind the other.»,`. `</s>` is an
 * end-of-sequence token; it parsed as part of the string, so nothing threw,
 * and it would have been stored on the Cast and drawn on the card.
 *
 * ⚠ **IT IS A POSITIVE RULE AND DELIBERATELY NOT A DENYLIST OF `</s>` AND `»`.**
 * A denylist only ever removes the junk somebody has already seen, and the next
 * model, or the next release of this one, emits different junk — which would
 * ship to a customer exactly the way this did. Keeping everything up to the
 * last sentence end instead throws away whatever is there, named or not, and
 * it is the same cut `fitToCap` already makes for a different reason.
 *
 * A LABEL has no sentence end to find, so it is cut at the last letter, digit
 * or closing bracket instead.
 *
 * ⚠ **THE SIBLINGS ARE SWEPT NOW — #2276 — AND THIS PARAGRAPH SAID "FILED"
 * WHEN NOTHING WAS.** Until 2026-10-11 it read *"Filed rather than fixed
 * blind"* of the drafted line, and no card existed until the relay's N2b
 * milestone-close review went looking for one and filed #2276. The class is
 * "transport markers in prose a customer reads", and it had two more
 * instances on the same model and the same card: the Sign's drafted lines
 * (`parseCastPersonaDraft`) and "Say it your way"
 * (`parseCastPersonaTranslation`). All three roads now run one composition,
 * `fitProseToCap` below, so none of them can be fixed without the others.
 * Only the post-processing moved — the Sign's instruction is untouched and its
 * golden stays byte-identical.
 *
 * ⚠ **A CLOSING QUOTE THAT CLOSES AN OPEN QUOTE IS KEPT (#2276).** A persona
 * line can end on a quoted word — *answers with "Maybe."* — and cutting at the
 * full stop alone would store an unbalanced `"Maybe.` on the card, which is
 * litter of our own making. The quote is kept only when the kept text has one
 * left open, so `…late.»,` (nothing opened) still loses its tail.
 */
export function trimTrailingJunk(value: string, options: { sentence: boolean }): string {
  if (!value) return value;
  if (options.sentence) {
    const end = Math.max(value.lastIndexOf("."), value.lastIndexOf("!"), value.lastIndexOf("?"));
    /* `< 1` for the same reason `fitToCap` uses it: punctuation at index 0 is
       not a sentence, and cutting there would store a single full stop. */
    if (end < 1) return value;
    const cut = value.slice(0, end + 1);
    const next = value[end + 1];
    if (next === '"' && countOf(cut, '"') % 2 === 1) return cut + next;
    if (next === "”" && countOf(cut, "“") > countOf(cut, "”")) return cut + next;
    return cut;
  }
  /*
    A LABEL IS CUT AT THE FIRST CHARACTER IT MAY NOT CONTAIN, which is the
    opposite question from the one asked of a sentence and has to be.

    ⚠ **THE FIRST SHAPE OF THIS BRANCH WALKED BACK TO THE LAST LETTER, AND THE
    SUITE CAUGHT IT: `"The quiet one</s>"` came back as `"The quiet one</s"`,
    because the `s` inside the marker is a letter.** Trailing litter is not
    reliably punctuation, so "where does it end" cannot be answered from the
    end. What a label may HOLD is answerable: two or three plain words, so
    letters, digits, spaces, and the hyphen and apostrophe that live inside
    ordinary words. Everything from the first character outside that set is
    dropped.

    The letter test is `toLowerCase() !== toUpperCase()` rather than a unicode
    property escape, because this build's target predates the `u` flag and a
    plain `[A-Za-z]` would cut a label at its first accented letter.
  */
  let end = 0;
  while (end < value.length) {
    const ch = value[end]!;
    const isLetter = ch.toLowerCase() !== ch.toUpperCase();
    if (!isLetter && !/[0-9 \-‐-―'’]/.test(ch)) break;
    end += 1;
  }
  return value.slice(0, end).trim();
}

/**
 * A READ ENDS ON A WHOLE SENTENCE OR IS DROPPED — #2238, his word: *"One also
 * has a stray "able." on the end."*
 *
 * ⚠ **WHY `trimTrailingJunk` LET IT THROUGH.** That cut keeps everything up to
 * the LAST full stop, and a fragment that ends in a full stop — `…holding the
 * new ground. able.` — has one. So the litter survived the very rule written
 * against litter, because the rule asked "where does the prose end" and the
 * fragment answered for it.
 *
 * The question asked here is the other one: is the LAST sentence a sentence? A
 * real one in a read starts on a capital (the craft asks for two sentences, each
 * opening a job) and is more than one word. A tail that fails either is
 * cut back to the sentence before it; if nothing whole is left, the read is
 * `""` and the six-or-nothing rule drops the list rather than drawing it.
 */
export function dropTrailingFragments(value: string): string {
  let text = value.trim();
  for (;;) {
    if (!text) return "";
    /* A sentence may close on a quote — `…with "Maybe."` — which
       `trimTrailingJunk` keeps when it closes an open one. */
    const core = /[.!?]["”]$/.test(text) ? text.slice(0, -1) : text;
    const ends = /[.!?]$/.test(core);
    const body = ends ? core.slice(0, -1) : core;
    const before = Math.max(body.lastIndexOf("."), body.lastIndexOf("!"), body.lastIndexOf("?"));
    const tail = text.slice(before + 1).trim();
    const firstLetter = tail.split("").find((ch) => ch.toLowerCase() !== ch.toUpperCase()) ?? "";
    const whole = ends
      && firstLetter !== ""
      && firstLetter === firstLetter.toUpperCase()
      && tail.split(/\s+/).filter(Boolean).length > 1;
    if (whole) return text;
    if (before < 1) return "";
    text = text.slice(0, before + 1).trim();
  }
}

function countOf(text: string, ch: string): number {
  return text.split(ch).length - 1;
}

/**
 * CLEAN A LINE OF MODEL PROSE AND FIT IT TO ITS CAP — the one composition every
 * road that stores model prose on a persona card runs (#2276): the six reads,
 * the Sign's drafted lines, and "Say it your way".
 *
 * Litter after the last sentence end is cut, a trailing fragment is cut, the
 * line is fitted to the customer's ceiling at a sentence end, and a fragment
 * the fit exposed is cut again. What comes back ends on a whole sentence, or is
 * `""` — which each road already treats as a failed read rather than a line.
 *
 * ⚠ **ONE FUNCTION AND NOT THREE CALL CHAINS, because the three were already
 * one fix that had been made on one road.** The reads got the trim and the
 * fragment cut after five of six reads on his Pigman ended in `</s>`; the two
 * other roads on the same model kept `fitToCap` alone, so the marker would have
 * been saved on a cast's card the day it reached them.
 *
 * ⚠ **`keepWhenEmptied` IS WHY THE THREE ROADS SHARE THE FUNCTION WITHOUT
 * SHARING ITS STRICTNESS — the relay's finding on PR #2278, and the correction
 * is worth more than the flag.** The first shape of this composition gave all
 * three roads the READS' rule, and the reads' rule is *a read ends on a whole
 * sentence or is dropped*: a line with no final full stop, or ending on a
 * one-word sentence with nothing whole before it, came back `""`. On the reads
 * that is right — a dropped read is one of six and the list is retried. On the
 * SIGN it is not: `parseCastPersonaDraft`'s both-lines-or-neither arm turns one
 * emptied line into NO personality and NO voice card at all, so a voice line
 * like *"Low and gravelly, unhurried"* — a plausible reply on that road, and
 * nothing has measured how often it comes back — would have cost a freshly
 * signed cast its whole card. **The card asked to strip end markers, not to
 * tighten what counts as a line.** So with this option the cleaning may still
 * CUT, and may never EMPTY: when the fragment cut would return `""`, the
 * marker-stripped text is fitted and kept instead.
 *
 * ⚠ **IT DOES NOT SOFTEN `fitToCap`, DELIBERATELY.** An over-long line with no
 * sentence end inside the cap still comes back `""` on every road, because that
 * `""` is the Sign's own documented failed-read road (its docblock above) and
 * predates #2276 — there is nothing to keep that the customer could then edit.
 *
 * ⚠ **AND THE LIMIT IT LEAVES IS NAMED RATHER THAN PAPERED OVER: a reply that
 * is NOTHING BUT a marker — `"</s>"`, no sentence end anywhere — is kept under
 * this option**, because the positive rule cannot tell it from a short line
 * that simply has no full stop, which is the shape the option exists to keep.
 * That is the behaviour this road had before #2276 and is not a new hole. The
 * tempting repair is a denylist of the markers somebody has already seen, and
 * `trimTrailingJunk`'s own docblock rules it out for the reason that matters:
 * the next model emits different junk.
 */
export function fitProseToCap(
  line: string,
  cap: number,
  options: { keepWhenEmptied?: boolean } = {},
): string {
  const keep = options.keepWhenEmptied === true;
  const stripped = trimTrailingJunk(line.trim(), { sentence: true });
  const trimmed = dropTrailingFragments(stripped);
  const fitted = fitToCap(trimmed || (keep ? stripped : trimmed), cap);
  const cleaned = dropTrailingFragments(fitted);
  return cleaned || (keep ? fitted : cleaned);
}

/** Some models fence JSON despite being asked for an object. */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

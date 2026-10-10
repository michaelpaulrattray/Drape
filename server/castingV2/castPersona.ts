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

export function castPersonaCraftRules(pronouns: CastPronouns): CastPersonaCraftRules {
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
      "either line. The pronouns are a fact about this performer that you are given;",
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
        "CORRECTIONS THE CUSTOMER MADE while refining this face, oldest first.",
        "Each one is the customer telling you who this person is:",
        castPersonaEditBlock(request.editSentences),
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
  const personality = fitToCap(read.data.personality.trim(), CAST_PERSONALITY_MAX_LENGTH);
  const voice = fitToCap(read.data.voice.trim(), CAST_VOICE_MAX_LENGTH);
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

/** Some models fence JSON despite being asked for an object. */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

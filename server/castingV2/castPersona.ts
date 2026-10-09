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
  const subject = pronouns.subject;
  const possessive = pronouns.possessive;
  return [
    "You write two short lines for a casting studio's cast page. They describe a",
    "performer the customer has just cast, and the customer reads them as a first",
    "draft they are free to rewrite.",
    "",
    "PERSONALITY — at most two sentences. Describe ONLY what a camera can see:",
    `posture, gaze, tempo, what ${possessive} hands do. Shape it as a baseline and`,
    "then the one exception that breaks it. Never state an inner feeling unless you",
    "name the physical tell that shows it: words like warm, confident, kind or",
    "trustworthy, on their own, are claims nobody can see and are not acceptable.",
    "",
    "VOICE — exactly one line. Register and delivery only: pitch, pace, control,",
    "and the one thing that breaks the pattern. You are describing how a voice",
    "sounds, never what it says.",
    "",
    `Write about ${subject} in the third person and use the pronouns given below.`,
    "Do not use a name. Do not mention photography, framing, lighting, cameras,",
    "image quality, or that this is a generated picture. Do not mention clothing",
    "unless the way it is worn is itself a physical mannerism.",
    "",
    "The two examples below are the FORM to produce — the length, the rhythm, and",
    "the baseline-then-exception shape. Their WORDING is not available to you: do",
    "not reuse their phrases, and do not describe this performer as doing the same",
    "things.",
    "  PERSONALITY: Unhurried and sure of herself — deliberate movements, holds eye",
    "  contact a beat too long. Cracks into a sudden wide grin only when something",
    "  genuinely surprises her.",
    "  VOICE: Low, unhurried, well-controlled; cracks upward only on an outburst.",
    "",
    'Answer with JSON only: {"personality": "...", "voice": "..."}',
  ].join("\n");
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
    FIT EACH LINE TO THE CAP SHE WILL BE HELD TO — the relay's finding 3 on
    PR #2114.

    `inputLimits.ts` says of these two numbers: *"the sizes are HER ceiling, not
    the drafter's"*. That was the hole. Nothing bounded the DRAFTER, so a long
    reply was stored and drawn, and then the first thing she did with it was
    refused: `editCastPersonaField` rejects over the cap, and the textarea's own
    `maxLength` will not even let her type — **so she could not save a one-word
    change to a line the product wrote her, and nothing on the card could tell
    her why.** A customer meeting our own number as a wall is the
    disappearing-technology law failing.

    It is fitted here rather than refused, because the alternative throws away a
    good line: the "both lines or neither" rule below means one long voice line
    would take a perfectly fine personality down with it.
  */
  const personality = fitToHerCap(read.data.personality.trim(), CAST_PERSONALITY_MAX_LENGTH);
  const voice = fitToHerCap(read.data.voice.trim(), CAST_VOICE_MAX_LENGTH);
  /*
    BOTH LINES OR NEITHER, and that is a product rule rather than strictness.

    One line present and one empty draws a card with a badge over nothing,
    which is the "feature that looks broken" his brief rules out. A partial
    answer is a failed read.

    ⚠ It is also where an unfittable line lands: `fitToHerCap` returns `""` when
    it cannot cut one, so an over-long reply with no sentence end in reach is a
    FAILED READ — no lines, no badge, no card — rather than a truncation mid-word
    or a line she cannot edit.
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
 * CUT A DRAFTED LINE DOWN TO HER OWN CEILING, AT A SENTENCE END OR NOT AT ALL.
 *
 * Returns the line when it already fits, the longest whole-sentence prefix that
 * fits when it does not, and `""` when even the first sentence is over — which
 * `parseCastPersonaDraft`'s both-or-neither arm turns into a failed read.
 *
 * ⚠ **A SENTENCE BOUNDARY AND NEVER A CHARACTER COUNT.** Cutting at the cap
 * would hand her *"…holds eye contact a beat too long and then lo"*, which reads
 * as a bug rather than as a draft, and she would have to finish our sentence
 * before she could save her own edit. A line cut after a full stop reads as a
 * shorter line, which is what a draft is allowed to be.
 *
 * ⚠ **THE INSTRUCTION IS DELIBERATELY NOT CHANGED TO CARRY THESE NUMBERS.**
 * Telling the model a character budget is the tempting second half and it is
 * not taken here: *context is not additive* is a measured law in this
 * repository, one clause moves every cast, and a deterministic bound at the
 * parse costs nothing and cannot regress the writing. The craft stays in the
 * instruction (camera-visible, baseline then exception); the arithmetic stays
 * here.
 */
export function fitToHerCap(line: string, cap: number): string {
  if (line.length <= cap) return line;
  /* Look only inside what fits, so the boundary we find is one we can keep. */
  const reach = line.slice(0, cap);
  const end = Math.max(reach.lastIndexOf("."), reach.lastIndexOf("!"), reach.lastIndexOf("?"));
  /* `< 1` and not `< 0`: a full stop at index 0 is punctuation with no sentence
     in front of it, and cutting there would draw her a card reading "." with a
     Drafted badge on it. */
  if (end < 1) {
    log.warn(
      { cap, length: line.length },
      "[castPersona] a drafted line was over her cap with no sentence end inside it — no lines derived",
    );
    return "";
  }
  const cut = reach.slice(0, end + 1).trim();
  log.info(
    { cap, from: line.length, to: cut.length },
    "[castPersona] a drafted line was over her cap and was cut at a sentence end",
  );
  return cut;
}

/** Some models fence JSON despite being asked for an object. */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

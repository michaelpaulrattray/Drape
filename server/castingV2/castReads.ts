/**
 * SIX WAYS THIS CAST COULD CARRY THEMSELVES — door 1 of #2137 (#2196).
 *
 * His approved Desk design, section 1: under the open Personality card, a row
 * reading *"Pick a different read"* opens six alternatives, each a short label
 * plus the exact two sentences it would store. The customer picks the one they
 * recognise and presses Keep.
 *
 * ============================================================================
 * IT WRITES NOTHING, AND THAT IS THE WHOLE REASON THIS CARD IS SMALL
 * ============================================================================
 *
 * A read's two sentences ARE a personality line. So keeping one is the edit the
 * product already has — `castingV2.editCastPersonaField` with `line:
 * "personality"`, owner in the statement, badge cleared by arithmetic. **No new
 * column, no migration, no second write path, and nothing new to scrub.**
 *
 * That is worth saying out loud because the sibling doors (#2197, #2205) DO
 * need a store, and a reader meeting three "say it your way"-ish cards could
 * reasonably assume this one did too.
 *
 * ============================================================================
 * THE CRAFT IS THE DRAFTED LINE'S CRAFT, SHARED RATHER THAN RESTATED
 * ============================================================================
 *
 * `castPersonaCraftRules` in `castPersona.ts` holds the rules every persona
 * instruction obeys — rest-then-timing, camera-visible only, the three
 * pronouns, his length ruling, the form example — and this road composes from
 * it rather than restating any of them. The card asked for exactly this
 * (*"Reuse `castPersonaSystemPrompt`'s rules rather than writing a second copy
 * of them"*).
 *
 * What is NOT shared is this file's own job: that there are six, that they must
 * differ from each other AND from the line already on the card, and that each
 * one carries a label.
 *
 * ============================================================================
 * NO FIXED LIST — HIS N3 RULING, APPLIED BEFORE N3
 * ============================================================================
 *
 * *"we really cannot be working from fixed lists in a fluid editing application
 * it means no sense to be rigid like this"* (2026-09-24). His frame's six names
 * — *The patient hulk*, *The old soldier* and the rest — are the SHAPE of a
 * label and never a menu to choose from. They are deliberately **not** in the
 * instruction below: six names shipped as exemplars are six names that would
 * arrive on every cast in the product, which is #2136's measured echo failing
 * in the most visible place available. The one example that IS here is the
 * drafted line's own, already marked as wording that may not be reused.
 *
 * ============================================================================
 * LAW 9 — IT PROPOSES, IT NEVER RULES
 * ============================================================================
 *
 * Six drafts the customer may ignore entirely. A read that fails produces
 * NOTHING — no partial list, no five-of-six — because a list that is sometimes
 * six and sometimes four is a surface nobody designed and reads as a bug.
 */
import { z } from "zod";

import { CAST_PERSONALITY_MAX_LENGTH } from "../../shared/inputLimits";
import { createModuleLogger } from "../logging/logger";
import { ProviderError, type ReferenceImage, type TextEngine } from "../providers/types";
import { castPersonaCraftRules, castPersonaEditBlock, fitToCap } from "./castPersona";
import type { CastPronouns } from "./castPronouns";
import { interpreterTextQueue } from "./interpreter";
import { boundForJudge } from "./judgeFrame";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";

const log = createModuleLogger("castingV2/castReads");

/** How many alternatives the door offers. His design, and it is not a range. */
export const CAST_READS_COUNT = 6;

/**
 * THE LABEL'S CEILING.
 *
 * His frame's longest is *"The quiet professional"* at 22 characters. 48 is
 * twice that and still a label rather than a sentence — a reader that returns
 * a clause here has misunderstood the field, and a row whose name wraps onto
 * three lines is not the list he drew.
 */
export const CAST_READ_LABEL_MAX_LENGTH = 48;

/** One alternative: what to call it, and the exact line it would store. */
export type CastRead = {
  /**
   * Two or three plain words — what a casting director would call this.
   *
   * ⚠ **IT IS `label` AND NOT `name`, AND THAT WAS MEASURED RATHER THAN
   * CHOSEN.** The first court run came back with six perfectly good reads and
   * `"name_unused": true` appended to every one of them, so the strict parse
   * refused all three fixtures. The cause is a collision with the craft rules
   * this instruction shares: `forbiddenMentionLines()` says *"Do not use a
   * name"* — meaning the performer's own name — and a field called `name` sat
   * underneath it. The reader obeyed the rule and told us it had. Renaming the
   * field is the repair that keeps the shared line untouched, which matters
   * because that line is part of the drafted-line instruction he courted.
   */
  label: string;
  /** The two sentences, ready to store on the Cast's `personality`. */
  personality: string;
};

/**
 * THE CEILING, SIZED FROM THE ANSWER RATHER THAN FROM THE DRAFTED LINE'S.
 *
 * Six reads is six labels plus six two-sentence lines — about 630 tokens of
 * answer measured against his own frame's six. 2,500 is roughly four times
 * that, on `castPersona.ts`'s own reasoning: the ceiling is sized as though
 * `reasoning: "off"` were ignored, because a transport must not depend on a
 * model honouring a request.
 */
export const CAST_READS_MAX_OUTPUT_TOKENS = 2_500;

/**
 * THE DEADLINE, AND WHY IT IS NOT THE DRAFTED LINE'S 75 SECONDS.
 *
 * That call posts one frame and returns ~120 tokens. This one posts the same
 * frame and returns six times the prose, and output length is what a deadline
 * on this road actually buys time for. 120 s is the drafted line's bound with
 * room for that, chosen before the measurement rather than after it so the
 * measured latency below is a reading and not a thing the bound produced.
 *
 * ⚠ **MEASURED, and the number is on #2196**: the figure the card carries is
 * what this road actually took through the real entrance, not this constant.
 */
export const CAST_READS_TIMEOUT_MS = 120_000;

const readSchema = z
  .object({
    label: z.string(),
    personality: z.string(),
  })
  .strict();

const readsSchema = z
  .object({
    reads: z.array(readSchema),
  })
  .strict();

/**
 * THE SHAPE, AS THE PROVIDER IS ASKED TO ENFORCE IT — derived, never written twice.
 *
 * ⚠ **THE LOOSE JSON HINT WAS NOT ENOUGH ON THIS ROAD, AND THE FAILURE WAS THE
 * QUIET KIND.** Three fixtures, three different malformations: a reply fenced
 * with trailing commas; a reply whose `reads` held strings instead of objects;
 * and — the one worth the schema on its own — **a reply that lost its
 * per-entry braces and arrived as ONE object carrying twelve duplicate keys.**
 * `JSON.parse` keeps the last of each duplicate, so that reply is *valid JSON
 * of the declared shape* holding exactly one read. Nothing throws; six
 * alternatives silently become one.
 *
 * `z.toJSONSchema` derives this from `readsSchema` itself, so the thing the
 * provider enforces and the thing the parser checks cannot disagree — the
 * mirror working law 4 forbids, in the place it would be most expensive.
 */
const READS_WIRE_SCHEMA = z.toJSONSchema(readsSchema);

export type CastReadsRequest = {
  /** The frame the customer signed — the same anchor the drafted line used. */
  anchor: ReferenceImage;
  /** Their own typed brief for the roll, or null for a Cast with no source roll. */
  brief: string | null;
  /** Their own correction sentences, oldest first. */
  editSentences: readonly string[];
  /**
   * THE LINE ALREADY ON THE CARD, so the six can be alternatives to it.
   *
   * Without it the door is "six reads" rather than "six DIFFERENT reads", and
   * the most likely single answer — the one the drafted line already is — would
   * come back as one of the six. `null` for a Cast whose draft failed.
   */
  current: string | null;
  pronouns: CastPronouns;
  signal?: AbortSignal;
};

export type CastReadsReader = {
  /** Six alternatives, or `null` when the read could not be made at all. */
  read(request: CastReadsRequest): Promise<CastRead[] | null>;
};

/**
 * THE INSTRUCTION. One string, every clause traceable to his design or to the
 * craft rules both instructions share.
 */
export function castReadsSystemPrompt(pronouns: CastPronouns): string {
  /*
    THE SAME RULES THE DRAFTED LINE OBEYS, from the one place that holds them.

    ⚠ **THIS FILE SHIPPED ITS OWN `castPersonaCraft.ts` FOR HALF A DAY AND IT
    IS GONE.** #2197's server half landed the same extraction on main, hours
    apart and for the same reason, which is two answers to one need — exactly
    the second-list shape working law 4 forbids, and the thing the card asked
    this road to avoid. `castPersonaCraftRules` is the one with real customers
    (the drafted line AND the translator), so it is the one that stands, and
    this road composes from it. The only thing that came across from the
    deleted module is its `where` parameter, because the pronoun rule's last
    clause is the single sentence that cannot be shared verbatim.
  */
  const rules = castPersonaCraftRules(pronouns, `any of the ${CAST_READS_COUNT}`);
  return [
    `You write ${CAST_READS_COUNT} alternative reads of ONE performer for a casting`,
    "studio's cast page. The customer has already cast this performer and is",
    "looking at one description of them; you are offering other ways the same",
    "person could be played. They pick the one they recognise, or none of them.",
    "",
    "Each read is a LABEL and then the description itself.",
    "",
    "The LABEL is two or three plain words naming a KIND of person — what a",
    "casting director would say out loud across a room. Not a sentence, not a",
    "trait, not a job title unless the job is the read. It is never this",
    "performer's own name, which the rule further down forbids; it is a name for",
    "the reading, not for them.",
    "",
    "The description follows exactly the rules below.",
    "",
    ...rules.personality,
    "",
    /*
      ⚠ TWO REQUIREMENTS THE SHARED BLOCK STATES SOFTLY, MADE HARD FOR THE SIX
      (#2238, his reviewer on the six his own Pigman got). Added HERE and never
      into `rules.personality`, so the Sign's instruction is byte-identical.
       - GAZE: the shared block lists "where the gaze goes" among three things,
         and 3 of 6 reads said nothing about the eyes.
       - TRIGGERS: one read broke into motion "once something has definitely
         been decided" — an inner state no camera can see.
    */
    "FOR EVERY READ, the first sentence must state BOTH the posture AND where the",
    "eyes are — where the gaze rests, what it follows, or what it avoids. A read",
    "that does not say where the eyes are is not finished.",
    "",
    "Any change — a move, a turn, a reaction — is set off by something the camera",
    "can see or hear: a sound, a voice, a question, a touch, someone stepping",
    "closer, something entering the frame. Never by a thought, a decision, a",
    "realisation or a feeling; the camera cannot see those happen.",
    "",
    ...rules.cameraOnly,
    "",
    `All ${CAST_READS_COUNT} are the SAME person — the one in the photograph, with the same`,
    "body, the same face and the same history. You are not casting six people;",
    "you are showing how this one could be played. Keep every physical fact the",
    "picture gives you and change only how this performer carries it.",
    "",
    `Make the ${CAST_READS_COUNT} genuinely different from EACH OTHER. Six readings of the same`,
    "temperament, reworded, is one read written six times — and a customer",
    "comparing them would have nothing to compare. They should disagree about",
    "what this performer does with stillness, with speed, and with being looked",
    "at.",
    "",
    ...rules.writing,
    "",
    ...rules.length,
    /*
      ⚠ THE READS' OWN TIGHTENING, ADDED BESIDE THE SHARED BLOCK AND NEVER INTO
      IT (#2238). His word, 2026-10-11: *"The options are walls of text. Each
      one is a 4 to 5 line paragraph"*. Measured on the six his own Pigman got,
      the reads ran ~350–420 characters against the shared example's length.
      The ruling forwarded on the card is to hold length through the
      INSTRUCTION, not a cutting cap: every clause one new fact, nothing said
      twice, and his examples' length as the target. `rules.length` and
      `rules.personalityExample` are untouched, so the Sign and the translator
      render byte-identical instructions (their golden holds them); the 500
      ceiling stays a safety net and nothing is truncated to fit a smaller one.
    */
    "Six of these sit side by side next to the face, so each one must be read at a",
    "glance. Every clause adds one NEW thing the camera can see; never restate a",
    "fact another clause already gave, and never pad a sentence with a second way",
    "of saying the first. Aim for about 300 to 330 characters per description —",
    "the length of the example below, not longer. End on a full sentence.",
    "",
    "The example below is the FORM to produce — a label, then the two jobs in",
    "two sentences, at that rhythm and that length. Its WORDING is not available",
    "to you: do not reuse its phrases, and do not describe this performer as",
    "doing the same things.",
    "  LABEL: The ring-turner",
    ...rules.personalityExample,
    "",
    "Answer with JSON only, with exactly " + CAST_READS_COUNT + " entries, and with",
    "no field on an entry beyond these two:",
    '{"reads": [{"label": "...", "personality": "..."}, …]}',
  ].join("\n");
}

/**
 * THE LINE ALREADY ON THE CARD, as a block the instruction can refuse to repeat.
 *
 * Exported so the ask can be asserted at the wire (invariant 5) rather than on
 * a constant near it.
 */
export function castReadsCurrentBlock(current: string | null): string {
  const trimmed = current?.trim();
  if (!trimmed) {
    return "There is no description on the card yet — nothing to differ from.";
  }
  return [
    "THE DESCRIPTION ALREADY ON THE CARD. Every read you write must be a genuine",
    "alternative to it, and none of them may be this one reworded:",
    trimmed,
  ].join("\n");
}

export function createCastReadsReader(config: { engine: TextEngine }): CastReadsReader {
  return {
    async read(request) {
      /* The judge's own bounder, never a second one — `castPersona.ts` carries
         the measured cliff this exists for. */
      let boundedImage: ReferenceImage;
      try {
        boundedImage = (await boundForJudge(request.anchor)).image;
      } catch (error) {
        log.warn({ err: error }, "[castReads] the signed frame could not be bounded — no reads derived");
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
        "",
        castReadsCurrentBlock(request.current),
      ].join("\n");

      let text: string;
      try {
        const reply = await config.engine.complete({
          system: castReadsSystemPrompt(pronouns),
          user,
          about: "reads",
          images: [boundedImage],
          json: true,
          /* The dedicated tool for "the reply must have this shape", rather
             than a hint and a parser that hopes. The fidelity law's own
             sentence: use the proven tool, not the nearer approximation. */
          jsonSchema: { name: "cast_reads", schema: READS_WIRE_SCHEMA },
          temperature: 0,
          reasoning: "off",
          maxOutputTokens: CAST_READS_MAX_OUTPUT_TOKENS,
          timeoutMs: CAST_READS_TIMEOUT_MS,
          retries: 1,
          signal: request.signal,
        });
        if (reply.truncated) {
          log.warn("[castReads] the read was cut off at the token ceiling — no reads derived");
          return null;
        }
        text = reply.text;
      } catch (error) {
        const retryable = error instanceof ProviderError && error.retryable;
        log.warn({ err: error, retryable }, "[castReads] the read did not come back — no reads derived");
        return null;
      }

      return parseCastReads(text);
    },
  };
}

/**
 * The reply, read strictly — EXPORTED so the parse can be driven without an
 * engine, and so the court reads a real reply through the code the door uses.
 */
export function parseCastReads(raw: string): CastRead[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    log.warn("[castReads] the reply was not JSON — no reads derived");
    return null;
  }
  const read = readsSchema.safeParse(parsed);
  if (!read.success) {
    log.warn("[castReads] the reply did not carry a list of reads — no reads derived");
    return null;
  }

  const kept: CastRead[] = [];
  for (const entry of read.data.reads) {
    const label = trimTrailingJunk(entry.label.trim(), { sentence: false });
    /* The drafted line's own fitter, so a read is held to the cap the customer
       is held to — and cut at a sentence end or not at all. A stray fragment is
       cut off before and after the fit (#2238), so a read ends on a whole
       sentence or is dropped. */
    const personality = dropTrailingFragments(
      fitToCap(
        dropTrailingFragments(trimTrailingJunk(entry.personality.trim(), { sentence: true })),
        CAST_PERSONALITY_MAX_LENGTH,
      ),
    );
    if (!label || label.length > CAST_READ_LABEL_MAX_LENGTH || !personality) continue;
    kept.push({ label, personality });
  }

  /*
    SIX OR NOTHING, and it is a product rule rather than strictness.

    A list that is sometimes six and sometimes four is a surface nobody drew:
    his frame has six rows, the copy under it says six, and a customer meeting
    four would be looking at a feature that had half failed with nothing saying
    so. The partial cases this closes are real rather than theoretical — one
    read over the cap with no sentence end in reach returns `""` from
    `fitToCap`, and a label that came back as a clause is dropped above.
  */
  if (kept.length !== CAST_READS_COUNT) {
    log.warn(
      { got: kept.length, want: CAST_READS_COUNT },
      "[castReads] the reply did not carry exactly six usable reads — no reads derived",
    );
    return null;
  }

  /*
    TWO ROWS WITH ONE LABEL IS A BROKEN LIST, and it is cheaper to refuse than
    to draw. The customer picks by recognising a name; two identical names make
    the pick meaningless and the `Keep "<name>"` button ambiguous.
  */
  const labels = new Set(kept.map((entry) => entry.label.toLowerCase()));
  if (labels.size !== kept.length) {
    log.warn("[castReads] two reads came back under one label — no reads derived");
    return null;
  }

  return kept;
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
 * ⚠ **THE SIBLING IS NAMED RATHER THAN SWEPT (law 7).** The drafted line
 * (`castPersona.ts`) stores model prose on the same card and would show the
 * same litter the day it arrived there. It is NOT changed here: that
 * instruction and its parser are the ones he courted at #2136, and this run
 * saw no litter on that road because it does not ask for a schema. Filed
 * rather than fixed blind — the class is "transport markers in prose a
 * customer reads", and its other instance is one function away.
 */
export function trimTrailingJunk(value: string, options: { sentence: boolean }): string {
  if (!value) return value;
  if (options.sentence) {
    const end = Math.max(value.lastIndexOf("."), value.lastIndexOf("!"), value.lastIndexOf("?"));
    /* `< 1` for the same reason `fitToCap` uses it: punctuation at index 0 is
       not a sentence, and cutting there would store a single full stop. */
    if (end < 1) return value;
    return value.slice(0, end + 1);
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
    const ends = /[.!?]$/.test(text);
    const body = ends ? text.slice(0, -1) : text;
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

/** Some models fence JSON despite being asked for an object. */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

let readerMemo: CastReadsReader | null = null;

/**
 * THE DOOR'S READER, ON THE SHARED TEXT ALLOWANCE RATHER THAN A NEW ONE.
 *
 * ⚠ **IT DOES NOT COPY THE DRAFTED LINE'S QUEUE, AND THE DIFFERENCE IS THE
 * CUSTOMER.** `castingCastPersonaReader` holds its own queue at ONE in flight,
 * for a stated reason that is true of its road and false of this one: a Sign
 * makes exactly one of those calls and nobody is watching it happen. This call
 * fires when somebody PRESSES something and waits ~14 seconds for the answer,
 * so a 1-wide queue would make the second customer through the door wait 28.
 *
 * `interpreterTextQueue()` is the product's one OpenRouter text allowance (4 in
 * flight, depth 32). Building a second engine with its own queue is how the
 * provider comes to see eight concurrent calls where the product declares
 * four — the fal-allowance class on the side of the house with no
 * `assertFalBudget` — so the queue is borrowed and never rebuilt.
 */
export function castingCastReadsReader(): CastReadsReader | null {
  if (!readerMemo) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    readerMemo = createCastReadsReader({
      engine: createOpenRouterTextEngine({
        apiKey,
        model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
        queue: interpreterTextQueue(),
      }),
    });
  }
  return readerMemo;
}

/*
  NO TEST SEAM HERE, AND THAT IS DELIBERATE RATHER THAN AN OMISSION.

  Its siblings export a `reset…ForTests` beside their memo, so one was written
  here too — and `check-cleanup-dispositions` called it `unread` at the first
  preflight, correctly: this road's suite builds its reader directly with
  `createCastReadsReader` and a fake engine, so nothing ever needed it. An
  export added because the neighbours have one is the dead-control shape with a
  test's name on it. The day a suite needs the memo dropped, that suite adds it.
*/

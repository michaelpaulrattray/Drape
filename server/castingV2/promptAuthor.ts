/**
 * THE PROMPT AUTHOR — the user's words go to the engine verbatim, the author
 * writes CONTENT and nothing else, and CODE appends the locked house block
 * (founder ruling, `docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md` — his
 * verdict on the court (Crew reply #8) and then, watching the first live rolls,
 * his corrected spec in §5b and §5c; issues #131 and #139).
 *
 * # The pipeline, in his words (§5b)
 *
 * > User seed + imagination slider → Author writes one image prompt → that
 * > exact prompt is sent to GPT Image 2 8 times → 8 different cast portraits.
 * > Anything stated is locked across all 8. Anything unstated is left to GPT
 * > Image 2. That is how we get 8 different people.
 *
 * # The four defects the first build had, and what closes each (§5b)
 *
 * 1. **It locked a person, not a camera** (exact bob, septum ring, lipstick →
 *    8 clones). MAX now writes aesthetic LANGUAGE only — mood, materials,
 *    makeup language, hair language, lighting taste — and is told by name
 *    never to specify an exact face, hairstyle, eye colour, jewellery item,
 *    garment, body type or expression.
 * 2. **The camera/studio block was missing or buried.** It was handed to the
 *    MODEL as an instruction ("add the preset sentences…"), so the model
 *    paraphrased, buried or dropped it (§5c). Now `HOUSE_BLOCK` is appended by
 *    CODE, verbatim, last, on every roll — `houseBlock.ts`, derived from the
 *    old studio's locked block. The author never sees a studio sentence.
 * 3. **Pipeline notes leaked into the image prompt** ("expression left unset",
 *    "across all eight", "per subject", "left open", "pick one" — and on dev
 *    roll 95 the engine painted the set in one frame: 7 of 8 contact-sheet
 *    grids). They are `NEVER_WRITTEN` now: a draft carrying one is refused and
 *    re-asked once, the sternum guard's shape.
 * 4. **The slider was ignored** (LOW invented looks; MAX invented one
 *    identity). LOW = seed + camera/studio ONLY — so at LOW there is NO author
 *    call at all: the seed is the customer's words, already first and
 *    verbatim, and the block is code. MAX = seed + camera/studio + art
 *    direction, and *"MAX must not leave the studio. More taste, not more
 *    world."*
 *
 * # What is STRUCTURAL rather than promised
 *
 *   - Verbatim first, by code: the brief is the first paragraph; the author is
 *     told to write only what follows (the court's free-reword arm lost a fact
 *     2/2; append-only held 33/33, 19/19, 3/3).
 *   - The house block is last, by code, byte-identical on every roll.
 *   - One prompt per sheet ("the answer is one prompt for a cast sheet not 8").
 *   - Never "sternum" (refused 8/8 at fal's checker), never a pipeline note,
 *     never a house sentence in the author's text — all three refused at the
 *     reply and re-asked once, then the static prompt (seed + block) stands
 *     with `mode: "static"` recorded, because a prompt nobody authored must
 *     never be mistaken for one somebody did.
 *
 * # Budget (rule 14)
 *
 * The author's allowance is ~400 words minus the brief (floor 40), re-asked
 * once to trim itself. The locked block is OUTSIDE that budget — his §5c word
 * is the full old block, and the B+R court (#128) is where the full block is
 * measured against the distilled clause, on his eye, with the refusal count
 * beside it. The total is recorded on the row (`houseBlockWords`) so the
 * census can read it rather than anyone assuming it.
 */
import type { TextEngine } from "../providers/types";
import { INTERPRET_TIMEOUT_MS } from "./interpreter";
import { createModuleLogger } from "../logging/logger";
import { containsHouseSentence, houseBlockForStyle } from "./houseBlock";
import { DEFAULT_CAST_STYLE, type CastStyle } from "../../shared/castStyles";

const log = createModuleLogger("promptAuthor");

/*
  The meter's two positions live in `shared/imagination.ts` (slice E) — the
  client draws the control and this module reads the value. Re-exported so
  every existing reader keeps its import.
*/
export { DEFAULT_IMAGINATION, type Imagination } from "../../shared/imagination";
import { DEFAULT_IMAGINATION, type Imagination } from "../../shared/imagination";

/** Rule 14 — a tested constant, the court's own. */
export const WORD_BUDGET = 400;
/** The author always gets at least this many words, however long the brief. */
export const AUTHOR_ALLOWANCE_FLOOR = 40;
/** A draft may exceed its allowance by this fraction before it is re-asked. */
export const OVERRUN_TOLERANCE = 0.1;

/**
 * Words this studio never sends to the engine, each with its measurement.
 * A reply carrying one is refused and re-asked once (the author is told which
 * word), then the static prompt stands. Lower-cased, matched as whole words
 * (a multi-word entry matches as a phrase).
 */
export const NEVER_WRITTEN: ReadonlyArray<{ word: string; because: string }> = [
  { word: "sternum", because: "refused 2/2 alone and 8/8 in a passing brief (court §4); 'collarbones' passes" },
  /*
    PIPELINE NOTES (§5b rule: "Do not put pipeline notes in the image prompt")
    and SET WORDS — dev roll 95, the first MAX roll through the real entrance:
    "pick one direction per subject", "must repeat across all eight", "left
    open across the set" → 7 of 8 tiles were contact-sheet grids of one woman.
  */
  { word: "across all eight", because: "pipeline note (§5b); set narration painted grids (dev roll 95)" },
  { word: "eight", because: "counting the casts made the engine paint them all in one frame (dev roll 95)" },
  { word: "per subject", because: "pipeline note (§5b)" },
  { word: "each subject", because: "pipeline note; set narration (dev roll 95)" },
  { word: "some subjects", because: "set narration (dev roll 95)" },
  { word: "across the set", because: "set narration (dev roll 95)" },
  { word: "the set", because: "set narration (dev roll 95)" },
  { word: "left open", because: "pipeline note (§5b)" },
  { word: "left unset", because: "pipeline note (§5b): 'expression left unset'" },
  { word: "unspecified", because: "pipeline note (§5b): 'build unspecified'" },
  { word: "pick one", because: "pipeline note (§5b)" },
  { word: "cast member", because: "pipeline note (§5b)" },
  { word: "cast members", because: "pipeline note (§5b)" },
  { word: "leans toward", because: "pipeline note (§5b): 'bone structure direction leans toward…'" },
  { word: "varies", because: "set narration (dev roll 95)" },
  { word: "lineup", because: "a lineup is a set in one frame" },
  { word: "line-up", because: "a lineup is a set in one frame" },
  { word: "contact sheet", because: "a contact sheet is a set in one frame" },
  { word: "grid", because: "a grid is a set in one frame" },
];

const APPEND_RULE =
  "The user's request is placed VERBATIM before your text by the studio. Write ONLY the text that follows it — "
  + "do not repeat, paraphrase or restate the request itself.";

const FILTER_RULE =
  "Keep wording GPT Image 2 safe: no nudity, no sexual language, no gore, no named real person or named character, "
  + "and avoid explicit sheer or revealing clothing language. Never name the breastbone.";

const NO_STUDIO_RULE =
  "Do NOT write any camera, lens, framing, crop, lighting, background, resolution or realism language — the studio "
  + "appends its own locked camera/studio block after your text, on every roll, and yours would compete with it.";

const NO_NOTES_RULE =
  "Do NOT write notes about the series or the process — nothing about how many portraits will be made, what is "
  + "unstated or undecided, what changes between them, or which option to choose. Write only what the picture should contain.";

/**
 * His MAX instruction, §5b verbatim where it speaks: seed + studio/camera +
 * invented aesthetic LANGUAGE — mood, materials, makeup language, hair
 * language, lighting taste — and never an exact face, hairstyle, eye colour,
 * jewellery item, garment, body type or expression. "MAX must not leave the
 * studio. More taste, not more world." The studio/camera half is code's.
 */
export function maxSystemPrompt(allowance: number): string {
  return [
    "You are the prompt author for a casting studio image engine.",
    "",
    "Imagination level: MAX",
    "",
    "The user's request is the seed. Your text adds ART DIRECTION to it — aesthetic language only:",
    "- Invent mood, materials, makeup language, hair language and lighting taste that belong to the seed's world (an editorial line, a universe of styling).",
    "- Do NOT specify an exact face, exact hairstyle, exact eye colour, exact jewellery item, exact garment, exact body type or exact expression. Anything you state is locked on every portrait; anything you leave unsaid the engine decides differently each time — that is how the casting stays a cast and not one person. Never lock a repeating signature item.",
    "- Stay in the studio: more taste, not more world. No scene, no story, no environment, no props.",
    "- Stay true to the seed's core: its sex, age, and the aesthetic direction it names.",
    `- ${NO_STUDIO_RULE}`,
    `- ${NO_NOTES_RULE}`,
    "- Every fact the user states must survive exactly — never dropped, softened or contradicted. You may add; you may not take away.",
    `- Word allowance for YOUR text: at most ${allowance} words. If you are over, cut your own additions first — never the user's facts.`,
    `- ${FILTER_RULE}`,
    `- ${APPEND_RULE}`,
    "",
    "Output only your text: two to four sentences of art direction, in clean prose, nothing else.",
  ].join("\n");
}

/** Whitespace-delimited words; the same count the court used. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Rule 14: the brief is never cut; the author fits in what is left. */
export function authorAllowance(briefText: string): number {
  return Math.max(AUTHOR_ALLOWANCE_FLOOR, WORD_BUDGET - countWords(briefText));
}

/** The first of `NEVER_WRITTEN` found in `text` as a whole word or phrase, or null. */
export function neverWrittenIn(text: string): string | null {
  /* Whitespace normalised first, so a phrase split by a newline or a double space cannot slip (review of #141, finding 4). */
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  for (const { word } of NEVER_WRITTEN) {
    const re = new RegExp(`(^|[^a-z])${word.replace(/[-]/g, "\\-")}([^a-z]|$)`);
    if (re.test(lower)) return word;
  }
  return null;
}

/**
 * THE ONE COMPOSITION on the author road, pure so the suite asserts it at the
 * byte: the brief first and unchanged, the FAMILY CLAUSE when a follow or a
 * chip edit is carried (#154 — code's, from the anchor and the overrides,
 * `familyClause.ts`), the author's content (MAX only), and the locked house
 * block LAST — each its own paragraph.
 */
export function composeFinalPrompt(
  briefText: string,
  content: string | null,
  style: CastStyle = DEFAULT_CAST_STYLE,
  clause: string | null = null,
): string {
  const parts = [briefText.trim()];
  if (clause && clause.trim().length > 0) parts.push(clause.trim());
  if (content && content.trim().length > 0) parts.push(content.trim());
  /* The block is the STYLE's (#142) — one member today, so these are `HOUSE_BLOCK`'s bytes. */
  parts.push(houseBlockForStyle(style));
  return parts.join("\n\n");
}

/** Seed (+ the family clause when one is carried) + block: what every LOW roll gets, and what a MAX roll falls back to. */
export function staticPrompt(briefText: string, style: CastStyle = DEFAULT_CAST_STYLE, clause: string | null = null): string {
  return composeFinalPrompt(briefText, null, style, clause);
}

export type AuthoredPrompt = {
  /** The whole prompt the eight frames are painted from — brief, content, block. */
  prompt: string;
  imagination: Imagination;
  /** Which locked bundle closed the prompt (#142) — the settings modal's style, photoreal unless told otherwise. */
  style: CastStyle;
  /**
   * `seed` — LOW: no author call by design (seed + block is the whole spec);
   * `authored` — MAX: a text call wrote the content;
   * `static` — MAX: the author failed or was refused twice, seed + block stands.
   */
  mode: "seed" | "authored" | "static";
  /** True only for `authored` — kept so a census reading the older rows still means the same thing. */
  authored: boolean;
  /** The author's content alone, null unless `authored`. */
  content: string | null;
  /** Words the author added (0 unless `authored`). */
  addedWords: number;
  /** Words the locked block adds, recorded so the total is read and never assumed. */
  houseBlockWords: number;
  allowance: number;
  model: string | null;
  latencyMs: number | null;
  /** How many text calls were made, so a census can price the road. */
  attempts: number;
};

/** The author's output budget — the interpreter's figure, for its reason (reasoning tokens count). */
export const AUTHOR_MAX_OUTPUT_TOKENS = 5000;

function cleanReply(raw: string): string {
  return raw.replace(/^```[a-z]*\n?|```$/g, "").replace(/\r\n/g, "\n").trim();
}

/** Why a draft is refused, or null when it may stand. */
export function draftRefusal(addition: string, allowance: number): string | null {
  if (addition.length === 0) return "Your previous reply was empty.";
  if (countWords(addition) > allowance * (1 + OVERRUN_TOLERANCE)) {
    return `Your previous draft was ${countWords(addition)} words; the allowance is ${allowance}. Rewrite it within ${allowance} words, cutting your own additions and never the user's facts.`;
  }
  const forbidden = neverWrittenIn(addition);
  if (forbidden) return `Your previous draft used the word "${forbidden}", which this studio never sends. Rewrite it without that word — and without any note about the series or the process.`;
  const house = containsHouseSentence(addition);
  if (house) return "Your previous draft contained camera/studio language. The studio appends its own locked block; write only the art direction for the person.";
  return null;
}

/**
 * Author the prompt. LOW makes NO text call (§5b: seed + camera/studio only).
 * MAX makes at most two — a draft, and one re-ask when the draft is empty,
 * overruns, carries a word this studio never sends, or writes studio language
 * — then the static prompt stands. Never throws: the caller is a paid roll's
 * compile, and an author outage must cost the customer the AUTHOR, not the roll.
 */
export async function authorPrompt(input: {
  engine: TextEngine;
  briefText: string;
  imagination?: Imagination;
  /** The settings modal's style (#142). Absent means photoreal, the only style and the default. */
  style?: CastStyle;
  /**
   * THE FAMILY CLAUSE (#154) — a follow's anchor and the chip edits, already
   * rendered to one paragraph by code. It sits between the brief and the
   * author's content on every road (seed, authored, static), and the author
   * SEES it beneath the brief as context so its art direction does not restate
   * the identity — but it is code's paragraph, outside the author's word
   * allowance the way the block is. Null on a plain authored roll.
   */
  clause?: string | null;
  signal?: AbortSignal;
}): Promise<AuthoredPrompt> {
  const imagination = input.imagination ?? DEFAULT_IMAGINATION;
  const style = input.style ?? DEFAULT_CAST_STYLE;
  const briefText = input.briefText.trim();
  const clause = input.clause?.trim() || null;
  const allowance = authorAllowance(briefText);
  const houseBlockWords = countWords(houseBlockForStyle(style));

  if (imagination === "low") {
    return {
      prompt: staticPrompt(briefText, style, clause), imagination, style, mode: "seed", authored: false, content: null,
      addedWords: 0, houseBlockWords, allowance, model: null, latencyMs: null, attempts: 0,
    };
  }

  const system = maxSystemPrompt(allowance);
  let attempts = 0;
  /** Latency the road has already spent, kept if a later call throws. */
  let spentMs: number | null = null;
  const ask = (systemText: string, temperature: number) => {
    attempts += 1;
    return input.engine.complete({
      about: "author",
      system: systemText,
      /* The clause rides beneath the brief so the author writes around the family, never a second description of it. */
      user: clause ? `${briefText}

${clause}` : briefText,
      temperature,
      maxOutputTokens: AUTHOR_MAX_OUTPUT_TOKENS,
      signal: input.signal,
      timeoutMs: INTERPRET_TIMEOUT_MS,
      /* No transport retries: this function re-asks once itself, and an inner
         retry under a 120 s deadline multiplies a hung provider. */
      retries: 0,
    });
  };

  const fallback = (latencyMs: number | null): AuthoredPrompt => ({
    prompt: staticPrompt(briefText, style, clause), imagination, style, mode: "static", authored: false, content: null,
    addedWords: 0, houseBlockWords, allowance, model: null, latencyMs, attempts,
  });

  try {
    const first = await ask(system, 0.8);
    let content = cleanReply(first.text);
    let model = first.provenance.model;
    let latencyMs = first.latencyMs;
    spentMs = latencyMs;
    const why = draftRefusal(content, allowance);
    if (why) {
      log.warn({ imagination, allowance, why }, "[promptAuthor] re-asking once");
      const second = await ask(`${system}\n\n${why}\n\nPREVIOUS DRAFT:\n${content}`, 0.3);
      content = cleanReply(second.text);
      model = second.provenance.model;
      latencyMs += second.latencyMs;
      if (draftRefusal(content, allowance)) {
        log.warn({ imagination, allowance }, "[promptAuthor] second draft refused too — the static prompt stands");
        return fallback(latencyMs);
      }
    }
    return {
      prompt: composeFinalPrompt(briefText, content, style, clause), imagination, style, mode: "authored", authored: true, content,
      addedWords: countWords(content), houseBlockWords, allowance, model, latencyMs, attempts,
    };
  } catch (error) {
    log.warn({ error: String(error), imagination, attempts }, "[promptAuthor] the author call failed — the static prompt stands");
    return fallback(spentMs);
  }
}

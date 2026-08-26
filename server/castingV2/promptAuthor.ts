/**
 * THE PROMPT AUTHOR — the user's words go to the engine verbatim, and ONE text
 * call adds what an expert prompter would (founder ruling,
 * `docs/specs/PROMPT_AUTHOR_RULING_2026-08-26.md`; his verdict on the court,
 * Crew reply #8, 2026-08-26: *"B is the studio, for both the rich prompt and
 * the thin one — build the author verbatim-first with LOW as the default. MAX
 * as written gives one face eight times; rewrite the MAX instruction so it
 * always leaves the face and a few axes open (casting call, not a portrait)
 * … Never say 'sternum'."*; issue #131).
 *
 * # What it replaces
 *
 * The creative register of PR #94 composed eight slices from house scaffolding
 * plus a per-slice variance card. The court (`PROMPT_AUTHOR_COURT_2026-08-26.md`)
 * measured that road losing the ask (arm D: "goth woman mid 30s" → eight women
 * with no goth styling; his 73-word brief → the grey tee on 7/8) and measured
 * arm B — the brief verbatim plus a LOW author — delivering the sheet he
 * described: six distinct goth women in their thirties, clean studio, the
 * spread intact. So this module is arm B as a product: one prompt per sheet,
 * the eight frames the engine's to vary.
 *
 * # The three things that are STRUCTURAL rather than promised
 *
 * 1. **Verbatim first, by code.** The customer's brief is the first paragraph
 *    of the prompt and the author is told to write ONLY what follows it. The
 *    court's one free-reword arm (Cr) contradicted a stated fact 2 of 2; the
 *    append-only arms held 33/33, 19/19, 3/3. Rule 4's "facts must survive"
 *    is therefore satisfied by construction, and no fact-comparison reader
 *    stands between the author and the engine.
 * 2. **One prompt per sheet.** Ruled the same afternoon ("the answer is one
 *    prompt for a cast sheet not 8"). Spread is the engine's on everything
 *    the prompt leaves open — and at MAX the author is told, in his words, to
 *    leave the face and a few axes open, because MAX as first specified
 *    produced one identity eight times (court §0 item 2).
 * 3. **Never "sternum".** The word alone flipped a passing prompt to 8/8
 *    refused at fal's content checker (court §4, probe 2/2); "collarbones"
 *    passes 2/2. It is absent from every instruction here, and a reply that
 *    carries it is refused and re-asked once — the suite asserts both.
 *
 * # What it does NOT do, and where each lives
 *
 *   - it never READS the brief for facts — the interpreter runs beside it as
 *     the reader (panel, locks, born ink, coverage) and never authors;
 *   - it does not rewrite the customer's words to pass the checker — that is
 *     #93's rewrite-and-retry on a `content_policy` refusal, disclosed;
 *   - the framing sentence's numbers are #130's to calibrate (his 28% head
 *     share); the realism clause from arm D is #128's to court before it
 *     enters the bundle. Both change WORDS in `PHOTOREAL_BUNDLE` and nothing
 *     else here.
 *
 * # Budget (rule 14)
 *
 * ~400 words to the engine in total. The brief is never cut; the author gets
 * what is left (floor 40) and is asked once to trim itself if it overruns by
 * more than a tenth — then the sheet renders on the STATIC bundle with
 * `authored: false` recorded, because a prompt nobody authored must never be
 * mistaken for one somebody did.
 *
 * Worst case under the flag, serialized before the claim: the interpreter's
 * 120 s plus two author calls of 120 s each, which can pass the ~305 s gateway
 * wall the refine-dispatch design records — free by construction (nothing is
 * claimed until the compile returns) but a visibly dead request. The deadline
 * keeps that rare; it does not make it impossible.
 */
import type { TextEngine } from "../providers/types";
import { INTERPRET_TIMEOUT_MS } from "./interpreter";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("promptAuthor");

export type Imagination = "low" | "max";

/** His word: LOW is the default; MAX is a per-sheet choice. */
export const DEFAULT_IMAGINATION: Imagination = "low";

/** Rule 14 — a tested constant, the court's own. */
export const WORD_BUDGET = 400;
/** The author always gets at least this many words, however long the brief. */
export const AUTHOR_ALLOWANCE_FLOOR = 40;
/** A draft may exceed its allowance by this fraction before it is re-asked. */
export const OVERRUN_TOLERANCE = 0.1;

/**
 * THE PHOTOREAL BUNDLE — the one style and its defaults (ruling §3 rule 11a,
 * §3a), in the court's arm-B wording. The prompt overrides any of it (rule 8):
 * the sentence says so to the engine in its own first clause.
 *
 * ⚠ "collarbones", never "sternum" — see the header. #130 calibrates the
 * framing words to his reference frame; until it reports, this is the text
 * that measured 93–96% fact fidelity and the spread he wants on arm B.
 */
export const PHOTOREAL_BUNDLE =
  "STYLE PRESET (photoreal — the default; anything the user's request states overrides it): "
  + "A photorealistic high-fashion casting portrait. Chest-up framing: the subject centred and facing the camera "
  + "square-on, shoulders running off both edges of the frame, the crop just below the collarbones, a small margin of "
  + "headroom above the hair. Neutral grey seamless studio background with a soft gradient, lighter behind the face. "
  + "Soft frontal studio lighting with subtle specular highlights on skin and materials and deep but open shadows. "
  + "Ultra-detailed textures, sharp focus, photorealistic.";

/**
 * Words this studio never sends to the engine, each with its measurement.
 * A reply carrying one is refused and re-asked once (the author is told which
 * word), then the static bundle stands. Lower-cased, matched as whole words.
 */
export const NEVER_WRITTEN: ReadonlyArray<{ word: string; because: string }> = [
  { word: "sternum", because: "refused 2/2 alone and 8/8 in a passing brief (court §4); 'collarbones' passes" },
];

const APPEND_RULE =
  "The user's request is placed VERBATIM before your text by the studio. Write ONLY the text that follows it — "
  + "do not repeat, paraphrase or restate the request itself.";

const FILTER_RULE =
  "Filter-safe wording only: no nudity, no sexual language, no gore, no named real person or named character. "
  + "Name the crop line by the collarbones, never by the breastbone.";

/** Arm B's instruction (court §2), the sheet he judged the studio. */
export function lowSystemPrompt(allowance: number): string {
  return [
    "You are the prompt author for a casting studio image engine.",
    "",
    "Imagination level: LOW",
    "",
    "Your job at LOW imagination:",
    "- Do not invent anything about the person. No new hair, makeup, clothing, jewellery, features or expression.",
    "- Add ONLY the studio's style preset sentences (framing, background, lighting, photoreal quality), and only for the things the user's request is silent about. Where the request already states a framing, background, lighting or style, add nothing on that point.",
    `- Word allowance for your text: at most ${allowance} words.`,
    `- ${FILTER_RULE}`,
    `- ${APPEND_RULE}`,
    "",
    PHOTOREAL_BUNDLE,
    "",
    "Output only your text.",
  ].join("\n");
}

/**
 * His MAX instruction (ruling §5) with his own amendment written into it — the
 * author writes a CASTING CALL, not a portrait: it chooses what to pin and
 * deliberately leaves the face and a few axes open, so eight different people
 * share the look. The court measured why the amendment is load-bearing: the
 * instruction as first written produced one woman eight times on both briefs.
 */
export function maxSystemPrompt(allowance: number): string {
  return [
    "You are the prompt author for a casting studio image engine.",
    "",
    "Imagination level: MAX",
    "",
    "Your job at MAX imagination:",
    "- Treat the user request only as a seed.",
    "- Invent a highly distinctive, memorable, Midjourney-level identity around that seed.",
    "- Maximise visual uniqueness: specific hair architecture, intense but coherent makeup, interesting facial structure, strong texture, deliberate asymmetry, and atmospheric lighting.",
    "- Keep the shot as a clean casting studio portrait (plain or softly graded background, character-focused, no environments or storytelling scenes).",
    "- Stay true to the core identity (age range, gender presentation, and the requested aesthetic direction).",
    "- Write a rich, detailed, opinionated prompt that feels like high-end Midjourney character design, but worded cleanly for GPT Image 2 (no NSFW triggers).",
    "",
    "THIS IS A CASTING CALL, NOT A PORTRAIT. The engine will cast EIGHT different people from your one prompt, and they must be eight different people who share the look. So choose deliberately what to pin and what to leave open: pin the things that make the look ownable (a hair cut and colour, a makeup signature, a piece of jewellery, a bone-structure direction) and LEAVE OPEN the face itself and a few axes — some of hair, build, age within the band, expression — so no two of the eight are the same person. Never describe one specific individual so completely that the engine can only paint her once.",
    "",
    "HOUSE RULES (the studio's, after the instruction above):",
    `- ${PHOTOREAL_BUNDLE}`,
    "- Every fact the user states (sex, age, skin, hair, features, clothing, jewellery, tattoos, expression, framing, lighting, style) must survive exactly — never dropped, softened or contradicted. You may add; you may not take away.",
    `- Word allowance for YOUR text: at most ${allowance} words. If you are over, cut your own additions first — never the user's facts.`,
    `- ${FILTER_RULE}`,
    `- ${APPEND_RULE}`,
    "",
    "Output only your text.",
  ].join("\n");
}

export function systemPromptFor(imagination: Imagination, allowance: number): string {
  return imagination === "max" ? maxSystemPrompt(allowance) : lowSystemPrompt(allowance);
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

/** The first of `NEVER_WRITTEN` found in `text` as a whole word, or null. */
export function neverWrittenIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { word } of NEVER_WRITTEN) {
    const re = new RegExp(`(^|[^a-z])${word}([^a-z]|$)`);
    if (re.test(lower)) return word;
  }
  return null;
}

/**
 * The prompt as sent: the brief first and unchanged, one blank line, then the
 * author's text (or the static bundle). This is the ONE composition on the
 * author road, and it is pure so the suite can assert it at the byte.
 */
export function composeAuthoredPrompt(briefText: string, addition: string): string {
  return `${briefText.trim()}\n\n${addition.trim()}`;
}

/** The sheet a roll gets when nobody authored — the brief and the bundle. */
export function staticPrompt(briefText: string): string {
  return composeAuthoredPrompt(briefText, PHOTOREAL_BUNDLE);
}

export type AuthoredPrompt = {
  /** The whole prompt the eight frames are painted from. */
  prompt: string;
  imagination: Imagination;
  /** True when a text call wrote the addition; false when the static bundle stands. */
  authored: boolean;
  /** Words the author added (the bundle's count when `authored` is false). */
  addedWords: number;
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

/**
 * Author the prompt: at most two text calls (a draft, and one re-ask when the
 * draft overruns its allowance or carries a word this studio never sends),
 * then the static bundle. Never throws — the caller is a paid roll's compile,
 * and an author outage must cost the customer the AUTHOR, not the roll.
 */
export async function authorPrompt(input: {
  engine: TextEngine;
  briefText: string;
  imagination?: Imagination;
  signal?: AbortSignal;
}): Promise<AuthoredPrompt> {
  const imagination = input.imagination ?? DEFAULT_IMAGINATION;
  const briefText = input.briefText.trim();
  const allowance = authorAllowance(briefText);
  const system = systemPromptFor(imagination, allowance);
  let attempts = 0;
  /** Latency the road has already spent, kept if a later call throws. */
  let spentMs: number | null = null;

  const ask = (systemText: string, temperature: number) => {
    attempts += 1;
    return input.engine.complete({
      about: "author",
      system: systemText,
      user: briefText,
      temperature,
      maxOutputTokens: AUTHOR_MAX_OUTPUT_TOKENS,
      signal: input.signal,
      timeoutMs: INTERPRET_TIMEOUT_MS,
      /* No transport retries: this function re-asks once itself, and an inner
         retry under a 120 s deadline multiplies a hung provider. */
      retries: 0,
    });
  };

  try {
    const first = await ask(system, imagination === "max" ? 0.8 : 0.3);
    let addition = cleanReply(first.text);
    let model = first.provenance.model;
    let latencyMs = first.latencyMs;
    spentMs = latencyMs;

    const overrun = countWords(addition) > allowance * (1 + OVERRUN_TOLERANCE);
    const forbidden = neverWrittenIn(addition);
    if (addition.length === 0 || overrun || forbidden) {
      const why = addition.length === 0
        ? "Your previous reply was empty."
        : overrun
          ? `Your previous draft was ${countWords(addition)} words; the allowance is ${allowance}. Rewrite it within ${allowance} words, cutting your own additions and never the user's facts.`
          : `Your previous draft used the word "${forbidden}", which this studio never sends. Rewrite it without that word.`;
      log.warn({ imagination, allowance, overrun, forbidden, empty: addition.length === 0 }, "[promptAuthor] re-asking once");
      const second = await ask(`${system}\n\n${why}\n\nPREVIOUS DRAFT:\n${addition}`, 0.3);
      addition = cleanReply(second.text);
      model = second.provenance.model;
      latencyMs += second.latencyMs;
      if (addition.length === 0 || countWords(addition) > allowance * (1 + OVERRUN_TOLERANCE) || neverWrittenIn(addition)) {
        log.warn({ imagination, allowance }, "[promptAuthor] second draft refused too — the static bundle stands");
        return {
          prompt: staticPrompt(briefText), imagination, authored: false,
          addedWords: countWords(PHOTOREAL_BUNDLE), allowance, model: null, latencyMs, attempts,
        };
      }
    }
    return {
      prompt: composeAuthoredPrompt(briefText, addition), imagination, authored: true,
      addedWords: countWords(addition), allowance, model, latencyMs, attempts,
    };
  } catch (error) {
    log.warn({ error: String(error), imagination, attempts }, "[promptAuthor] the author call failed — the static bundle stands");
    return {
      prompt: staticPrompt(briefText), imagination, authored: false,
      addedWords: countWords(PHOTOREAL_BUNDLE), allowance, model: null, latencyMs: spentMs, attempts,
    };
  }
}

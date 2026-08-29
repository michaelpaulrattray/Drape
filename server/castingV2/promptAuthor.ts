/**
 * THE PROMPT AUTHOR — at LOW the user's words go to the engine verbatim, at
 * MAX the author REWRITES them into one paragraph (#230), and either way CODE
 * appends the locked house block
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
 * # ⚠ THE APPEND IS DEAD — MAX REWRITES NOW (#230, 2026-08-29)
 *
 * The founder watched a live MAX sheet and refused the shape itself
 * (verbatim): *"This MAX sheet is still wrong … user seed / then a second
 * director paragraph pasted under it … **Engine gets one brief, not a
 * stack.** LOW: user seed unchanged + studio block. **MAX: author rewrites
 * the seed into a single type + look paragraph. Facts stay. Taste goes up. No
 * second essay underneath.** Keep the raw seed internally for the fidelity
 * check. The record can show 'your words → authored brief.' The roll only
 * gets authored brief + studio block."*
 *
 * So on MAX the author's paragraph REPLACES the seed on the wire, and the
 * seed survives internally in two places and no others: the row (`briefSent`,
 * which the sheet shows as *your words*) and the fidelity check below.
 *
 * ⚠ **THIS REVERSES A MEASURED COURT FINDING, ON HIS EYE (law 9), AND THE
 * REVERSAL IS NOT FREE.** `PROMPT_AUTHOR_COURT_2026-08-26.md` finding 5: the
 * free-reword arm CONTRADICTED a fact on 2 of 2 runs while append-only held
 * 33/33, 19/19, 3/3. His own mitigation is what pays for it —
 * `seedFidelity.ts` reads the raw seed, the author is re-asked once naming the
 * fact it dropped, and a second failure falls back to the customer's own words
 * plus the block. **What that floor does NOT catch is the very thing the court
 * measured — an adjective moving ("subtle" → "crisp") — and that limit is
 * declared in `seedFidelity.ts` rather than papered over.**
 *
 * His own four-way list of how the first rewrite failed, each answered here:
 * still stacked (the compose below); a differ-by caption (the sheet's echo,
 * `briefEcho.ts`); new inventory on a finished seed (the
 * FINISHED-seed rule in `maxSystemPrompt`, with the growth recorded on the row
 * as `addedWords` so the rate is a reading rather than an anecdote — a NOUN
 * diff is not mechanical and is deliberately not faked); and skin words that
 * fight the block's own realism negatives (`SKIN_CONTRADICTIONS`).
 *
 * # What is STRUCTURAL rather than promised
 *
 *   - ONE brief on the wire: the composed prompt is the authored paragraph (or,
 *     at LOW and on the fallback, the customer's own) and then the block. There
 *     is no shape in which two briefs are sent.
 *   - One paragraph: a draft carrying a blank line is refused and re-asked —
 *     "no second essay underneath" as a check, not a hope.
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
 * ⚠ **THE ALLOWANCE ARITHMETIC HAD TO INVERT WITH THE REWRITE (#230).** It
 * was ~400 words MINUS the brief, because the author was writing an addition
 * that sat beside the brief. The author's text now IS the brief, so the same
 * subtraction would demand that a 380-word seed come back as 40 words — which
 * is an instruction to cut the customer's facts, the one thing his ruling
 * forbids. The allowance is the budget, and never less than the seed's own
 * length plus headroom: a rewrite can always afford to say everything the
 * customer said. The locked block is OUTSIDE it — his §5c word is the full
 * old block, and the B+R court (#128) is where the full block is measured
 * against the distilled clause, on his eye, with the refusal count beside it.
 * The total is recorded on the row (`houseBlockWords`) so the census can read
 * it rather than anyone assuming it.
 */
import type { TextEngine } from "../providers/types";
import { INTERPRET_TIMEOUT_MS } from "./interpreter";
import { createModuleLogger } from "../logging/logger";
import { containsHouseSentence, houseBlockForStyle } from "./houseBlock";
import { DEFAULT_CAST_STYLE, type CastStyle } from "../../shared/castStyles";
import { ageContradictionIn, droppedFactIn, seedFactsOf, type SeedFacts, type StatedAge } from "./seedFidelity";
import type { Sex } from "../../shared/castingVocabularies";

/*
  The age machinery moved to `seedFidelity.ts` when the rewrite landed (#230) —
  the presence check and the contradiction check read the same vocabulary, and
  two copies of a decade table is working law 4 in the small. Re-exported so
  every existing reader keeps its import.
*/
export {
  ageClaimsIn,
  ageContradictionIn,
  droppedFactIn,
  saysSex,
  seedFactsOf,
  type SeedFacts,
  type StatedAge,
} from "./seedFidelity";

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
  /*
    #230 — MEASURED ON THE REWRITE'S OWN FIRST DRIVE, and it is defect 3 of
    §5b wearing new clothes. Told to keep the customer's facts and add no new
    nouns, the author started narrating its COMPLIANCE to the image engine:
    *"the sense of manufactured texture the user specified"*. There is no
    reading in which an image prompt addresses a user, so the ban is safe in
    the way this repo requires — unlike `cropped` or `framing`, the phrase has
    no second sense — and the customer's own words are exempt anyway.
  */
  { word: "the user", because: "the rewrite narrated its own compliance to the engine (#230, first drive)" },
];

/**
 * #230, his sentence: *"The roll only gets authored brief + studio block."*
 * The old rule said the opposite — that the request was placed verbatim
 * before the author's text and the author must not restate it — and it is
 * gone with the append.
 */
const REPLACE_RULE =
  "What you write REPLACES the request on the wire: the engine receives your paragraph and then the studio's "
  + "own locked block, and nothing else. Its own text is not sent separately, so anything you leave out is lost.";

/** "No second essay underneath" (#230) said to the author as well as checked in code. */
const ONE_PARAGRAPH_RULE =
  "Write ONE paragraph and nothing else — no second paragraph, no blank line, no heading, no list, no notes after it.";

const FILTER_RULE =
  "Keep wording GPT Image 2 safe: no nudity, no sexual language, no gore, no named real person or named character, "
  + "and avoid explicit sheer or revealing clothing language. Never name the breastbone.";

const NO_STUDIO_RULE =
  "Do NOT write any camera, lens, framing, crop, lighting, background, resolution or realism language — the studio "
  + "appends its own locked camera/studio block after your text, on every roll, and yours would compete with it.";

const NO_NOTES_RULE =
  "Do NOT write notes about the series or the process — nothing about how many portraits will be made, what is "
  + "unstated or undecided, what changes between them, or which option to choose. "
  /* #230, measured on the rewrite's first drive: the author narrated its own obedience into the image prompt. */
  + "Never mention the request, the person who wrote it, or your own instructions, and never say what you did or did not add. "
  + "Write only what the picture should contain.";

/**
 * #230 item 4, his own reading of a live sheet: *"youthful + translucency +
 * exposed torso fights the house ban on doll/plastic skin and will refuse more
 * often."* The locked block's own negatives ban plastic skin, a doll look, a
 * wax figure and beauty-app smoothing; a paragraph asking for translucent,
 * poreless, flawless skin asks the engine for the thing the same prompt
 * forbids, and the provider's checker is what settles the argument.
 *
 * ⚠ **A word here is refused only where the author ADDED it** (see
 * `skinContradictionIn`). *"Porcelain-pale is that goth brief's"* is the
 * founder's own sentence in `houseBlock.ts`: a customer may write any of these
 * about her own cast, and refusing her rewrite for a word she typed would drop
 * her to a static prompt that sends the same word anyway.
 */
export const SKIN_CONTRADICTIONS: ReadonlyArray<{ phrase: string; because: string }> = [
  { phrase: "translucent", because: "his own named specimen (#230 item 4); reads as the block's banned doll skin" },
  { phrase: "translucency", because: "his own named specimen (#230 item 4)" },
  { phrase: "poreless", because: "the block bans beauty-app smoothing by name" },
  { phrase: "flawless skin", because: "the block bans beauty-app smoothing by name" },
  { phrase: "airbrushed", because: "the block bans beauty-app smoothing by name" },
  { phrase: "plastic skin", because: "the block's own negative, word for word" },
  { phrase: "doll-like", because: "the block bans a doll look by name" },
  { phrase: "waxy", because: "the block bans a wax figure by name" },
  { phrase: "wax-like", because: "the block bans a wax figure by name" },
  { phrase: "perfect symmetry", because: "the block's own negative, word for word" },
];

/*
  ⚠ THE "UNLESS SHE WROTE IT" CLAUSE IS NOT POLITENESS — it is what stops this
  rule contradicting FACTS STAY. Driven on his own roll-228 seed, which says
  *"doll-like porcelain android presence"*: an unqualified ban tells the author
  not to write the very look she asked for, and what it actually produces is
  synonym-hunting ("waxy") until the draft is refused twice and she loses MAX
  altogether. The guard has always exempted her own words (`skinContradictionIn`);
  the instruction now says the same thing, because a rule the check does not
  enforce and a check the rule does not describe are how both drift.
*/
const SKIN_RULE =
  "Do NOT ADD skin or surface words that fight the studio's own realism rules — no translucent, poreless, flawless, "
  + "airbrushed, waxy or doll-like skin, and no perfect symmetry — and do not reach for a synonym of one either. "
  + "If the request uses such a word, keep it: it is a stated fact. Skin it does not describe has texture, pores and life.";

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
    `The request below is the seed. Your job is to REWRITE it into a single casting paragraph — who is being cast, and what the look is. ${REPLACE_RULE}`,
    "",
    /* §5g (#171), his sentence, kept verbatim through the rewrite. */
    "FACTS STAY. Every fact the request states survives, in your own sentence: sex, age, heritage, build, hair, wardrobe, features, materials, mood. Facts cannot move at any level or in any wording — \"mid 30s\" must never surface as \"young woman\", and an adjective the request chose (\"subtle\") must not become a different one (\"crisp\"). Never dropped, never softened, never contradicted, never re-described. Taste can be added. Facts cannot be rewritten.",
    "",
    "TASTE GOES UP. What you add is heat and aesthetic language — mood, materials, makeup language, hair language, lighting taste — never a second description arguing with what it already says.",
    "",
    "FIRST decide what kind of seed it is — the decision is by CONTENT, never length: if the request already fixes the world (the aesthetic, the skin language, the face language), the seed is FINISHED; otherwise it is thin.",
    "",
    "On a FINISHED seed: HEAT ONLY, inside the same paragraph. Return that look with its pressure raised — more severe, more editorial, denser texture, stronger mood — and add NO new parts. Forbidden on a finished seed: new nouns. No new garment, no jewellery item, no named haircut, no new material, no body part brought into frame that the request did not name, no younger age, no sharper named face. If you catch yourself naming a thing the request did not name, delete it.",
    /*
      #230 item 3, his own failing sheet quoted as the example — the seed and
      the reply are the production rows this build was driven on (roll 230),
      and the words he listed are the ones the draft actually invented. An
      instruction that names the rule and shows the miss is the shape
      `conceptDescribe.ts` already uses for his granularity ruling.
    */
    "Worked example of getting a finished seed WRONG. Seed: \"Female android type with a youthful face, sculpted pastel pink hair, pale synthetic skin with visible mechanical paneling beneath.\" A draft then invented colour-coded filaments, lit conduits, hairline seams, chrome, pearlescent white and jewellery-as-anatomy. That is a second wardrobe bible, not heat. Heat would be: the same paneling read harder — colder, more clinical, more couture — with nothing named that the request did not name.",
    "",
    "On a thin seed: keep the stated facts and add ART DIRECTION around them — aesthetic language only:",
    "- Invent mood, materials, makeup language, hair language and lighting taste that belong to the seed's world (an editorial line, a universe of styling).",
    "- Do NOT specify an exact face, exact hairstyle, exact eye colour, exact jewellery item, exact garment, exact body type or exact expression. Anything you state is locked on every portrait; anything you leave unsaid the engine decides differently each time — that is how the casting stays a cast and not one person. Never lock a repeating signature item.",
    "- Stay in the studio: more taste, not more world. No scene, no story, no environment, no props.",
    `- ${NO_STUDIO_RULE}`,
    `- ${NO_NOTES_RULE}`,
    `- ${SKIN_RULE}`,
    `- Word allowance for YOUR paragraph: at most ${allowance} words. If you are over, cut your own additions first — never a stated fact.`,
    `- ${FILTER_RULE}`,
    `- ${ONE_PARAGRAPH_RULE}`,
    "",
    /* The format line must not out-argue the finished-seed rule (measured: four full sentences on the specimen finished seed, #171 drive). */
    "Output only the paragraph, in clean prose, nothing else.",
  ].join("\n");
}

/** Whitespace-delimited words; the same count the court used. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Rule 14, inverted by the rewrite (#230). The author's paragraph IS the brief
 * now, so it must always be able to hold everything the customer said and then
 * some: the allowance is the budget, or the seed's own length plus headroom
 * when the seed is longer than the budget. Subtracting the brief — what this
 * did while the author wrote an addition — would order a long brief cut to the
 * floor, which is the one instruction his ruling forbids.
 */
export function authorAllowance(briefText: string): number {
  return Math.max(WORD_BUDGET, countWords(briefText) + AUTHOR_ALLOWANCE_FLOOR);
}

/**
 * The first of `NEVER_WRITTEN` found in `text` as a whole word or phrase, or
 * null.
 *
 * ⚠ **`seedText` EXEMPTS THE CUSTOMER'S OWN WORDS, and the rewrite is why**
 * (#230). While the author wrote an addition, every one of these words was
 * unambiguously the author's. The author's paragraph now carries the
 * customer's facts, so a brief that itself says "grid" or "contact sheet"
 * would make every rewrite refusable — and the fallback sends the customer's
 * own sentence, containing that same word, to the same engine. Refusing it
 * therefore buys nothing and costs the customer MAX. What the guard still
 * catches is the whole of what it was built for: a word the AUTHOR introduced.
 */
export function neverWrittenIn(text: string, seedText?: string): string | null {
  /* Whitespace normalised first, so a phrase split by a newline or a double space cannot slip (review of #141, finding 4). */
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const seed = seedText === undefined ? null : seedText.toLowerCase().replace(/\s+/g, " ");
  for (const { word } of NEVER_WRITTEN) {
    const re = new RegExp(`(^|[^a-z])${word.replace(/[-]/g, "\\-")}([^a-z]|$)`);
    if (!re.test(lower)) continue;
    if (seed !== null && re.test(seed)) continue;
    return word;
  }
  return null;
}

/**
 * The skin word the AUTHOR added that fights the locked block's own realism
 * negatives (#230 item 4), or null. Seed-exempt for the same reason
 * `neverWrittenIn` is, and here it is load-bearing rather than a nicety: the
 * founder's own goth brief says "porcelain-pale".
 */
export function skinContradictionIn(text: string, seedText: string): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const seed = seedText.toLowerCase().replace(/\s+/g, " ");
  for (const { phrase } of SKIN_CONTRADICTIONS) {
    if (!lower.includes(phrase)) continue;
    if (seed.includes(phrase)) continue;
    return phrase;
  }
  return null;
}

/**
 * True when the draft is a stack rather than one paragraph — his *"no second
 * essay underneath"* as a check (#230 item 1). A blank line is the whole
 * signal: it is what a second block looks like, and it is what the shipped
 * prompt he refused actually contained.
 */
export function isStacked(text: string): boolean {
  return /\n[ \t]*\n/.test(text.trim());
}

/**
 * §5g item 4 — the founder's checklist for judging any MAX sheet, verbatim.
 * ONE owner: the eye caption of every MAX sheet filed to his gallery QUOTES
 * this string beside the frames (the briefing is hand-written prose, so the
 * wiring is this constant plus the arm that keeps its clauses verbatim — a
 * caption is quotation, and this is the thing it quotes). It is judging
 * language for his eye, never engine-bound text, so `NEVER_WRITTEN` does not
 * apply to it.
 */
export const MAX_SHEET_CHECKLIST =
  "Facts intact · same studio · same designed universe across all eight · eight different faces · "
  + "bookable for one lookbook. Clones = too tight. Eight unrelated genres = too loose. "
  + "They got younger = author rewrote the seed.";

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
  /*
    ⚠ THE AUTHOR'S PARAGRAPH REPLACES THE SEED (#230) — it does not follow it.
    This one line is the whole of his *"Engine gets one brief, not a stack"*,
    and every other guard in this module exists to make it safe. `content` is
    null at LOW and on the fallback, and there the customer's own words are the
    brief, unchanged, which is his LOW spec word for word.
  */
  const authored = content !== null && content.trim().length > 0;
  const parts = [authored ? content!.trim() : briefText.trim()];
  if (clause && clause.trim().length > 0) parts.push(clause.trim());
  /* The block is the STYLE's (#142) — one member today, so these are `HOUSE_BLOCK`'s bytes. */
  parts.push(houseBlockForStyle(style));
  return parts.join("\n\n");
}

/** Seed (+ the family clause when one is carried) + block: what every LOW roll gets, and what a MAX roll falls back to. */
export function staticPrompt(briefText: string, style: CastStyle = DEFAULT_CAST_STYLE, clause: string | null = null): string {
  return composeFinalPrompt(briefText, null, style, clause);
}

export type AuthoredPrompt = {
  /** The whole prompt the eight frames are painted from — the one brief, then the block. */
  prompt: string;
  /**
   * WHICH SHAPE WROTE THIS PROMPT (#230), recorded because the meaning of
   * `content` changed under it: `rewrite` — the content IS the brief the
   * engine received and the customer's own words were not sent; `append` —
   * the shape every row written before 2026-08-29 has, where the content sat
   * BENEATH the customer's words. Rows carrying no `compose` at all are
   * `append` rows, and the sheet reads them in the past tense rather than
   * redrawing them as something they were not.
   */
  compose: "rewrite" | "append";
  /** Words the customer's own seed held — the denominator for how far a rewrite grew. */
  seedWords: number;
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
  /** The author's paragraph, null unless `authored`. On a `rewrite` row this IS the brief the engine got. */
  content: string | null;
  /**
   * How many words the author's paragraph runs to beyond the seed's own
   * length (0 unless `authored`, and negative when a rewrite came back
   * shorter than the seed). It was the author's addition when the author
   * wrote one; under the rewrite it is the growth, which is the number
   * *"heat only, no new nouns"* will be read against.
   */
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

/**
 * Why a draft is refused, or null when it may stand.
 *
 * `seed` is the raw seed his ruling ordered kept (#230) — it is what the
 * fidelity check reads, and what exempts the customer's own words from the
 * two word guards. `seed.facts` is what the seed stated in a shape code can
 * read (`seedFidelity.ts`); empty facts check nothing, which is the correct
 * behaviour for a brief that named neither a sex nor an age.
 */
export function draftRefusal(
  addition: string,
  allowance: number,
  statedAge?: StatedAge | null,
  seed?: { text: string; facts: SeedFacts },
): string | null {
  if (addition.length === 0) return "Your previous reply was empty.";
  if (isStacked(addition)) {
    return "Your previous draft was more than one paragraph. The engine receives ONE brief — rewrite it as a single paragraph, with no blank line, no heading and no list.";
  }
  if (countWords(addition) > allowance * (1 + OVERRUN_TOLERANCE)) {
    return `Your previous draft was ${countWords(addition)} words; the allowance is ${allowance}. Rewrite it within ${allowance} words, cutting your own additions and never a stated fact.`;
  }
  const forbidden = neverWrittenIn(addition, seed?.text);
  if (forbidden) return `Your previous draft used the word "${forbidden}", which this studio never sends. Rewrite it without that word — and without any note about the series or the process.`;
  const house = containsHouseSentence(addition);
  if (house) return "Your previous draft contained camera/studio language. The studio appends its own locked block; write only the casting paragraph for the person.";
  if (seed) {
    /* #230 item 4: a skin word the AUTHOR added that this same prompt's locked negatives ban. */
    const skin = skinContradictionIn(addition, seed.text);
    if (skin) {
      return `Your previous draft said "${skin}", which fights the studio's own locked realism rules and makes the engine refuse the picture. Rewrite it with real skin — texture, pores, life.`;
    }
  }
  /* §5g (#171): the reader's recorded value against the author's text — an aged-down seed reddens here. */
  if (statedAge) {
    const drifted = ageContradictionIn(addition, statedAge);
    if (drifted) {
      const statedValue = `${statedAge.phase ? `${statedAge.phase} ` : ""}${statedAge.band}`;
      return `Your previous draft said "${drifted}", which moves the stated age (${statedValue}). Stated facts cannot be rewritten, even as a paraphrase — rewrite without changing or re-describing the age.`;
    }
  }
  /*
    #230 — LAST, and the order is the point: a draft that says the WRONG thing
    gets the precise sentence about what it moved, and only a draft that says
    NOTHING about a stated fact is told it dropped one. "A young woman" on a
    mid-30s seed is both at once, and the useful message is the first.
  */
  if (seed) {
    const dropped = droppedFactIn(addition, seed.facts);
    if (dropped) {
      return `Your previous draft dropped ${dropped}, which the request stated. Your paragraph replaces the request entirely, so every stated fact has to be inside it. Rewrite it keeping that fact.`;
    }
  }
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
   * rendered to one paragraph by code. It sits between the brief and the block
   * on every road (seed, authored, static), and the author SEES it beneath the
   * brief as context so its paragraph does not restate the identity — but it
   * is code's paragraph, outside the author's word allowance the way the block
   * is. Null on a plain authored roll, and in practice null on every AUTHORED
   * one: the compiler forces LOW whenever a clause is carried (#177 Row A), so
   * the clause and a rewrite do not meet today.
   */
  clause?: string | null;
  /**
   * The READER's record of the brief's stated age (§5g, #171) — the value the
   * fidelity check compares the author's text against. Null when the brief
   * states none; at LOW it is unused by construction, since the author writes
   * nothing that could drift.
   */
  statedAge?: StatedAge | null;
  /**
   * The READER's recorded sex (#230) — the second half of the fidelity check.
   * It is demanded of the rewrite only where the SEED ITSELF says it in words
   * (`seedFactsOf`), never where the reader inferred it from a role noun.
   */
  statedSex?: Sex | null;
  signal?: AbortSignal;
}): Promise<AuthoredPrompt> {
  const imagination = input.imagination ?? DEFAULT_IMAGINATION;
  const style = input.style ?? DEFAULT_CAST_STYLE;
  const briefText = input.briefText.trim();
  const clause = input.clause?.trim() || null;
  const allowance = authorAllowance(briefText);
  const houseBlockWords = countWords(houseBlockForStyle(style));
  const seedWords = countWords(briefText);
  /* THE RAW SEED, kept internally for the fidelity check — his own sentence (#230). */
  const seed = {
    text: briefText,
    facts: seedFactsOf(briefText, { sex: input.statedSex ?? null, age: input.statedAge ?? null }),
  };

  if (imagination === "low") {
    return {
      prompt: staticPrompt(briefText, style, clause), imagination, style, compose: "rewrite", seedWords,
      mode: "seed", authored: false, content: null,
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
    prompt: staticPrompt(briefText, style, clause), imagination, style, compose: "rewrite", seedWords,
    mode: "static", authored: false, content: null,
    addedWords: 0, houseBlockWords, allowance, model: null, latencyMs, attempts,
  });

  try {
    const first = await ask(system, 0.8);
    let content = cleanReply(first.text);
    let model = first.provenance.model;
    let latencyMs = first.latencyMs;
    spentMs = latencyMs;
    const why = draftRefusal(content, allowance, input.statedAge, seed);
    if (why) {
      log.warn({ imagination, allowance, why }, "[promptAuthor] re-asking once");
      const second = await ask(`${system}\n\n${why}\n\nPREVIOUS DRAFT:\n${content}`, 0.3);
      content = cleanReply(second.text);
      model = second.provenance.model;
      latencyMs += second.latencyMs;
      const stillWhy = draftRefusal(content, allowance, input.statedAge, seed);
      if (stillWhy) {
        log.warn({ imagination, allowance, why: stillWhy }, "[promptAuthor] second draft refused too — the customer's own words stand");
        return fallback(latencyMs);
      }
    }
    return {
      prompt: composeFinalPrompt(briefText, content, style, clause), imagination, style, compose: "rewrite", seedWords,
      mode: "authored", authored: true, content,
      addedWords: countWords(content) - seedWords, houseBlockWords, allowance, model, latencyMs, attempts,
    };
  } catch (error) {
    log.warn({ error: String(error), imagination, attempts }, "[promptAuthor] the author call failed — the static prompt stands");
    return fallback(spentMs);
  }
}

/**
 * THE ROLL'S COMPOSITION, AND THE GUARDS THE AUTHOR ROAD SHARES.
 *
 * # The contract (#535, his "build it", 2026-09-06 — superseding the
 * imagination meter this module carried since #131)
 *
 * Every roll on the author road sends ONE brief: **the customer's own words,
 * the family clause when a follow or a chip edit is carried (code's paragraph,
 * `familyClause.ts`), and the locked house block LAST, appended by CODE and
 * byte-identical on every roll** (`houseBlock.ts`). That is the whole wire.
 * His law holds literally: the words in the box are the words sent, always
 * (`PROMPT_AUTHOR_RULING_2026-08-26.md` §1).
 *
 * ⚠ **THE MAX AUTHOR IS GONE FROM THE ROLL ROAD — the author is a VISIBLE
 * writing assistant now** (`reimagine.ts`, #535). Until 2026-09-06 this module
 * held a two-position imagination meter: LOW sent the seed verbatim and MAX
 * made a hidden text call that REWROTE the seed on the wire. Measured on #252,
 * MAX was refused by our own guards 54% of the time and silently became LOW in
 * 21% — one setting that works and one that sometimes quietly becomes the
 * first, with the sheet still saying "Max". His design replaces the mode with
 * a press: the author writes INTO the brief box, visibly, editable, with
 * undo, and casting always uses whatever is in the box. So there is no author
 * call at the roll, no `mode: "static"` fallback on new rows, and no hidden
 * mode to fall out of. The instruction the press runs, and every rule of his
 * that shaped it, live in `reimagine.ts`; this module keeps the composition
 * and the word guards both roads share. The MAX instruction's own history —
 * #230's rewrite, #237's pieces, #327's over-authoring, #477's
 * verbatim-first — is in this file's git history and the spec, and the rules
 * it taught survive where they were always enforced: in the guards below and
 * in the Re-imagine instruction.
 *
 * # What is STRUCTURAL rather than promised
 *
 *   - ONE brief on the wire: the customer's words, then the block. There is
 *     no shape in which two briefs are sent, and no shape in which prose the
 *     customer has not read is sent.
 *   - The house block is last, by code, byte-identical on every roll.
 *   - One prompt per sheet ("the answer is one prompt for a cast sheet not 8").
 *   - Never "sternum" (refused 8/8 at fal's checker), never a pipeline note,
 *     never a house sentence in authored text — refused at the Re-imagine
 *     press (`reimagineRefusal`), where the words are still the customer's to
 *     read and keep or undo.
 */
import type { TextEngine } from "../providers/types";
import { interpreterTextQueue } from "./interpreter";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";
import { DEFAULT_HOUSE_LANE, houseBlockForStyle, type HouseLane } from "./houseBlock";
import { DEFAULT_CAST_STYLE, type CastStyle } from "../../shared/castStyles";

/*
  The age machinery lives in `seedFidelity.ts` — the guards read one
  vocabulary, and two copies of a decade table is working law 4 in the small.
  Re-exported so every existing reader keeps its import. (`droppedFactIn` and
  `seedFactsOf` retired with the MAX author, #535: presence-of-every-fact was
  the pieces road his two rolled courts rejected, and the editable box is the
  new fidelity control.)
*/
export {
  ageClaimsIn,
  ageContradictionIn,
  saysSex,
  type StatedAge,
} from "./seedFidelity";

/**
 * THE AUTHOR'S OWN MODEL — one line, and swapping it swaps nothing else (#466).
 *
 * His order (Crew reply #105) asked for the author half of the Grok bench, and
 * the card carries the same condition the reader half did under #231: the model
 * is its own constant, so a verdict either way is one line and reversible. The
 * Re-imagine press (`reimagine.ts`) is this engine's one caller now.
 *
 * ⚠ **TODAY IT IS THE INTERPRETER'S SLUG, DELIBERATELY.** The bench record
 * (`docs/specs/CONCEPT_READER_COURT_2026-08-30.md`, the author bench) is what
 * may move it, and only through his eye on the pairs — law 9.
 *
 * A CONSTANT rather than an env var, for `CONCEPT_READER_MODEL`'s own reason: a
 * per-deployment override would be an undocumented flag, and a bench arm
 * drives whatever engine it likes without configuring the service.
 */
export const AUTHOR_MODEL = DEFAULT_INTERPRETER_MODEL;

let authorEngineMemo: TextEngine | null = null;

/**
 * The author's engine: its own model, the interpreter's ONE allowance.
 *
 * The queue is shared rather than built here, and that is the load-bearing half
 * of this function — see {@link interpreterTextQueue}: `createOpenRouterTextEngine`
 * builds its OWN `ProviderQueue` when handed none, so a second engine with a
 * second queue would quietly double what the product is willing to have in
 * flight at OpenRouter (the fal-allowance class, on the side of the house that
 * has no `assertFalBudget`).
 */
export function authorTextEngine(): TextEngine | null {
  if (authorEngineMemo) return authorEngineMemo;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  authorEngineMemo = createOpenRouterTextEngine({
    apiKey,
    model: AUTHOR_MODEL,
    queue: interpreterTextQueue(),
  });
  return authorEngineMemo;
}

/** Test seam: drops the memoized author engine so config changes take effect. */
export function resetAuthorEngineForTests(): void {
  authorEngineMemo = null;
}

/**
 * Words this studio never sends to the engine, each with its measurement.
 * A Re-imagine draft carrying one is refused and re-asked once (the author is
 * told which word). Lower-cased, matched as whole words (a multi-word entry
 * matches as a phrase).
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
 * about her own cast, and refusing a draft for a word she typed would cost
 * her the press while the roll sends the same word anyway.
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

/**
 * THE PIECES — nouns that name a specific manufactured ARMOUR part, refused
 * when the AUTHOR introduces one the request did not (#237).
 *
 * Founder, verbatim (terminal, 2026-08-29), on his sphinx MAX sheet: *"The
 * paragraph is still a build sheet. One block is necessary. It is not
 * sufficient. This sphinx MAX named a kit: angular pauldrons, banded
 * vambraces, a high sculpted collar. That's the clone path inside a single
 * paragraph."* — with the law: *"Pin materials, mood, species facts. Never pin
 * exact garments, cuts, jewellery, or armour pieces unless the user typed
 * them. Faces stay free. Facts stay put."*
 *
 * Under #535 qualities-never-pieces became the WHOLE instruction
 * (`reimagine.ts`), and this list is its backstop — kept narrow for the
 * declared reason below.
 *
 * ⚠ **THE LIST IS ARMOUR PIECES AND HIS OWN THIRD NOUN, AND THAT NARROWNESS IS
 * A DECLARED JUDGEMENT RATHER THAN AN OVERSIGHT.** His law names four classes;
 * three of them (garments, cuts, jewellery) are INSTRUCTION rules, because a
 * word ban over the world's garments either sweeps ordinary prose or is a
 * taxonomy nobody wrote — this module's own admission test. Armour pieces are
 * different in the one way that matters: each word below names exactly one
 * manufactured plate and has no second sense in a casting paragraph. `collar`
 * is his own failing noun and is here on that evidence; `collarbones` is a
 * DIFFERENT WHOLE WORD and passes, which the suite asserts as a positive
 * control, because the court's own finding is that `collarbones` is the word
 * that gets a prompt through where `sternum` does not.
 *
 * **The check is SEED-EXEMPT, and that is his own clause** (*"unless the user
 * typed them"* / *"FACTS STAY PUT"*): a customer who writes "pauldrons" keeps
 * them, and refusing a draft for a word she typed would cost her the press
 * while a roll of her own words sends it to the same engine anyway.
 */
export const PIECE_NOUNS: ReadonlyArray<{ word: string; because: string }> = [
  { word: "pauldron", because: "his own failing fixture (#237)" },
  { word: "vambrace", because: "his own failing fixture (#237)" },
  { word: "collar", because: "his own failing fixture, 'a high sculpted collar' (#237); 'collarbones' is a different whole word and passes" },
  { word: "collared", because: "the same piece as a garment CUT — his law names cuts beside pieces" },
  { word: "gorget", because: "an armour plate; one manufactured part, no second sense" },
  { word: "greave", because: "an armour plate; one manufactured part, no second sense" },
  { word: "cuirass", because: "an armour plate; one manufactured part, no second sense" },
  { word: "breastplate", because: "an armour plate; one manufactured part, no second sense" },
  { word: "chestplate", because: "an armour plate; one manufactured part, no second sense" },
  { word: "bracer", because: "an armour plate; his #231 rule 3 names 'an arm bracer' as a SKU" },
  { word: "gauntlet", because: "an armour piece; below the frame and still a locked costume part" },
  { word: "spaulder", because: "an armour plate; one manufactured part, no second sense" },
  { word: "rerebrace", because: "an armour plate; one manufactured part, no second sense" },
  { word: "faulds", because: "an armour plate; one manufactured part, no second sense" },
  { word: "brigandine", because: "a named armour garment; one manufactured part, no second sense" },
  { word: "codpiece", because: "an armour piece; one manufactured part, no second sense" },
];

/**
 * The first `PIECE_NOUNS` entry the AUTHOR introduced, as a whole word, or
 * null. Seed-exempt for the reason in that constant's docblock — his own
 * *"unless the user typed them"*.
 *
 * ⚠ **THE PLURAL IS PART OF THE MATCH, and it is here because the canonical
 * author fixture in the suite said "high collarS".** A whole-word list that
 * holds the singular alone catches *"a high sculpted collar"* and misses *"high
 * collars"* — the same defect with an `s` on it, and the shape a draft actually
 * reaches for. So one optional trailing `s` is part of the pattern rather than
 * a second row per noun. The boundary still holds where it matters:
 * `collarbones` is not `collar` or `collars`, and the suite asserts that as a
 * positive control, because `collarbones` is the word the court found gets a
 * prompt through where `sternum` does not.
 */
export function pieceNounIn(text: string, seedText: string): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const seed = seedText.toLowerCase().replace(/\s+/g, " ");
  for (const { word } of PIECE_NOUNS) {
    const re = new RegExp(`(^|[^a-z])${word}s?([^a-z]|$)`);
    if (!re.test(lower)) continue;
    if (re.test(seed)) continue;
    return word;
  }
  return null;
}

/** Whitespace-delimited words; the same count the court used. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * The first of `NEVER_WRITTEN` found in `text` as a whole word or phrase, or
 * null.
 *
 * ⚠ **`seedText` EXEMPTS THE CUSTOMER'S OWN WORDS** (#230): an authored
 * paragraph carries the customer's facts, so a brief that itself says "grid"
 * or "contact sheet" would make every draft refusable — and the roll sends the
 * customer's own sentence, containing that same word, to the same engine.
 * Refusing it therefore buys nothing and costs the customer the press. What
 * the guard still catches is the whole of what it was built for: a word the
 * AUTHOR introduced.
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
 * THE ONE COMPOSITION on the author road, pure so the suite asserts it at the
 * byte: the brief first and unchanged, the FAMILY CLAUSE when a follow is
 * carried (#154 — code's, from the anchor, `familyClause.ts`), and the locked
 * house block LAST — each its own paragraph.
 *
 * ⚠ Since #535 there is no authored content at the roll: the customer's words
 * ARE the brief, always — the Re-imagine press writes into the box BEFORE
 * anything rolls, so whatever it contributed is already inside `briefText`,
 * read and kept by the customer.
 */
export function composeFinalPrompt(
  briefText: string,
  style: CastStyle = DEFAULT_CAST_STYLE,
  clause: string | null = null,
  lane: HouseLane = DEFAULT_HOUSE_LANE,
): string {
  const parts = [briefText.trim()];
  if (clause && clause.trim().length > 0) parts.push(clause.trim());
  /*
    The block is the STYLE's (#142) and the LANE's (#232/#237) — one style
    today, and the human lane is `HOUSE_BLOCK`'s bytes exactly as before.
  */
  parts.push(houseBlockForStyle(style, lane));
  return parts.join("\n\n");
}

/** Seed (+ the family clause when one is carried) + block: what every roll gets. */
export function staticPrompt(
  briefText: string,
  style: CastStyle = DEFAULT_CAST_STYLE,
  clause: string | null = null,
  lane: HouseLane = DEFAULT_HOUSE_LANE,
): string {
  return composeFinalPrompt(briefText, style, clause, lane);
}

/**
 * What the register records about a roll's composition (#535 — the shape
 * `authorPrompt` used to return, minus every author-call field: there is no
 * call at the roll any more, so `attempts`/`refusals`/`model`/`latencyMs`/
 * `imagination`/`allowance` stopped being facts a roll has). The field names
 * that survive keep their historical meanings so a census over old and new
 * rows reads one vocabulary.
 */
export type SeedPromptRecord = {
  /** The whole prompt the eight frames are painted from — the one brief, then the block. */
  prompt: string;
  /** The composition shape (#230's vocabulary): the brief IS the wire — nothing sits beneath it. */
  compose: "rewrite";
  /** Words the customer's own brief held. */
  seedWords: number;
  /** Which locked bundle closed the prompt (#142). */
  style: CastStyle;
  /** WHICH LANE the locked block was composed in (#232/#237). */
  lane: HouseLane;
  /** The one road left (§5b's word for it): the customer's words + the block, no text call. */
  mode: "seed";
  /** Nobody rewrote this prompt — kept so a census reading the older rows still means the same thing. */
  authored: false;
  content: null;
  /** Words the locked block adds, recorded so the total is read and never assumed. */
  houseBlockWords: number;
};

/** Compose the roll's prompt and its record — pure, synchronous, no engine. */
export function seedPromptRecord(input: {
  briefText: string;
  style?: CastStyle;
  lane?: HouseLane;
  clause?: string | null;
}): SeedPromptRecord {
  const style = input.style ?? DEFAULT_CAST_STYLE;
  const lane = input.lane ?? DEFAULT_HOUSE_LANE;
  const briefText = input.briefText.trim();
  const clause = input.clause?.trim() || null;
  return {
    prompt: composeFinalPrompt(briefText, style, clause, lane),
    compose: "rewrite",
    seedWords: countWords(briefText),
    style,
    lane,
    mode: "seed",
    authored: false,
    content: null,
    houseBlockWords: countWords(houseBlockForStyle(style, lane)),
  };
}

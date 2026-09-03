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
 * # ⚠ ONE PARAGRAPH IS NECESSARY AND NOT SUFFICIENT — #237, 2026-08-29
 *
 * The rewrite above fixed the SHAPE and the founder then refused the CONTENT
 * inside it (verbatim): *"MAX is now one paragraph. Good. Don't stack again.
 * … The paragraph is still a build sheet. One block is necessary. It is not
 * sufficient. This sphinx MAX named a kit: angular pauldrons, banded
 * vambraces, a high sculpted collar. That's the clone path inside a single
 * paragraph."* — with the law: *"Pin materials, mood, species facts. Never pin
 * exact garments, cuts, jewellery, or armour pieces unless the user typed
 * them. Faces stay free. Facts stay put."*
 *
 * It is the SAME defect as locking one face, arriving through the wardrobe:
 * anything the paragraph states is locked on every portrait, so a named kit
 * dresses eight people in one costume. Two things carry it, and the division
 * between them is declared rather than assumed:
 *
 *   - the INSTRUCTION (`maxSystemPrompt`) carries all four of his classes,
 *     with his own golden sphinx target and his own failing kit shown and
 *     labelled — the shape `conceptDescribe.ts` uses for his granularity
 *     ruling;
 *   - the CHECK (`PIECE_NOUNS` / `pieceNounIn`) carries ONE of them, armour
 *     pieces, because those are the words that have no second sense in a
 *     casting paragraph. Its own docblock says why the other three are not
 *     banned words, and the suite asserts that non-catch out loud so a green
 *     run is never read as a reader that catches them.
 *
 * # ⚠ ONE PARAGRAPH IS NECESSARY, ONE BLOCK IS NOT SUFFICIENT, AND NEITHER IS
 * NOT-NAMING-A-PIECE — #327, 2026-08-31
 *
 * The founder read his own MAX draft of his own cyborg brief and refused it
 * again, one level in (verbatim): *"The max roll brief is over-authoring. The
 * source was a head/face/augmentation spec. The rewrite invented wardrobe,
 * black-ops backstory, and a full mood thesis … Max can sharpen and complete
 * the look, but it should not invent a new character."* Three more with it:
 * resolve a contradiction instead of stacking it; the lockable facts must stay
 * first-class instead of dissolving into character prose; and *"don't double
 * up identity constraints if the locked block is already being appended at
 * roll."*
 *
 * ⚠ **ALL FOUR WERE GAPS IN THE INSTRUCTION, NOT BREACHES OF IT** — checked at
 * this file before a line was written. `PIN THE WORLD, NEVER THE PIECES` bans
 * naming the PARTS of a subject and nothing banned introducing the SUBJECT;
 * `droppedFactIn` passes on every one of his failing drafts, because it tests
 * PRESENCE and he is asking for PROMINENCE. So the rules are
 * `NO_NEW_SUBJECT_RULE`, `RESOLVE_NOT_STACK_RULE`, `FACTS_FIRST_RULE` and the
 * widened `NO_STUDIO_RULE`, and **no word ban rides with any of them** — the
 * fifth time this repository has met its own admission test.
 *
 * ⚠ **AND THE FOURTH RULE TURNED UP A STRUCTURAL DEFECT: SIX UNIVERSAL RULES
 * WERE FILED UNDER THE THIN-SEED FORK.** `NO_STUDIO_RULE`, `NO_NOTES_RULE`,
 * `SKIN_RULE`, the word allowance, `FILTER_RULE` and `ONE_PARAGRAPH_RULE` were
 * bullets under *"On a thin seed:"* while the CODE enforced all six on both
 * branches — and his failing draft was of a FINISHED seed, so the very
 * no-studio rule his rule 4 is about was filed under the other fork. They sit
 * under `UNIVERSAL_RULES_HEADING` now.
 *
 * **The before/after his card required, driven on his own 553-character brief
 * (3 author drafts and 4 painted frames per arm, house money, no roll and no
 * credit):** invented backstory 3 of 3 → 0 of 3; invented wardrobe 1 of 3 → 0
 * of 3; stacked skin texture 3 of 3 → 1 of 3; language competing with the
 * locked block 3 of 3 → 0 of 3; every stated fact present in all six drafts
 * both ways. At the frames, the tactical kit the brief never asked for went
 * from 4 of 4 to 1 of 4 (a strap and a belt on the last). The paragraph got
 * shorter (348/296/296 → 246/262/247 words) and the FACT opening got longer,
 * which is the answer to *context is not additive*: what was cut is the story,
 * not the facts. **His eye on the strip is the gate; these numbers are
 * pointers.**
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
import { INTERPRET_TIMEOUT_MS, interpreterTextQueue } from "./interpreter";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";
import { createModuleLogger } from "../logging/logger";
import { containsHouseSentence, DEFAULT_HOUSE_LANE, houseBlockForStyle, type HouseLane } from "./houseBlock";
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

/**
 * THE AUTHOR'S OWN MODEL — one line, and swapping it swaps nothing else (#466).
 *
 * His order (Crew reply #105) asked for the author half of the Grok bench, and
 * the card carries the same condition the reader half did under #231: the model
 * becomes its own constant in the same PR as the bench, so a verdict either way
 * is one line and reversible. Until now the author had no model of its own — the
 * compile site (`briefCompiler.ts`) reached for `interpreterEngine()` whole, so
 * the only way to try a different author was to move the slug every brief in
 * the product is interpreted by.
 *
 * ⚠ **TODAY IT IS THE SAME SLUG, DELIBERATELY, so nothing about the shipped
 * author moves in the commit that makes it swappable.** The bench record
 * (`docs/specs/CONCEPT_READER_COURT_2026-08-30.md`, the author bench) is what
 * may move it, and only through his eye on the pairs — law 9.
 *
 * A CONSTANT rather than an env var, for `CONCEPT_READER_MODEL`'s own reason: a
 * per-deployment override would be an undocumented flag, and the bench does not
 * need one — `BriefCompilerInput.engine` already takes an engine, so an arm
 * drives whatever model it likes without configuring the service.
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

/**
 * #327 rule 4, his sentence: *"don't double up identity constraints if the
 * locked block is already being appended at roll"* — *"One brief, not a story
 * plus a brief."*
 *
 * ⚠ **THE MEASURED DEFECT IS WORSE THAN A DUPLICATE: IT IS A CONTRADICTION.**
 * On the BEFORE arm of his own cyborg brief, draft 0 wrote *"hard light
 * catching the brow ridge and jaw plate, deep shadow pooling in the eye
 * sockets"* while the appended block says *"Large soft frontal key just above
 * the lens, high fill, open shadows"*. Draft 1 wrote a *"glacial palette"*
 * against the block's *"Skin colour and sheen come from the person, not from a
 * house grade"*. Draft 2 restated the block's own negatives (no smoothing, no
 * symmetry). Two prompts arguing is not redundancy — the picture gets the
 * argument.
 *
 * ⚠ **AND THE RULE'S POSITION WAS HALF THE PROBLEM — see `maxSystemPrompt`.**
 */
const NO_STUDIO_RULE =
  "Do NOT write any camera, lens, framing, crop, lighting, background, colour-grade, resolution or realism "
  + "language, and do not restate or paraphrase the studio's own rules or its negatives — the studio appends its "
  + "own locked camera/studio block after your text, on every roll. Yours would not merely repeat it, it would "
  + "ARGUE with it: no light direction, no shadow placement, no palette, no \"no smoothing / no symmetry\" "
  + "negatives of your own. One brief, not a story plus a brief.";

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
/**
 * #327 rule 1, his sentence: *"Max can sharpen and complete the look, but it
 * should not invent a new character. Keep costume generic or omitted unless
 * the user specified it."*
 *
 * ⚠ **IT IS A GAP IN THE INSTRUCTION, NOT A BREACH OF ONE** — checked at his
 * own draft before a line was written. `PIN THE WORLD, NEVER THE PIECES` bans
 * naming the PARTS of a subject; nothing banned introducing the SUBJECT. So
 * *"dark, utilitarian, high-performance textiles with a tactical severity …
 * without fixing on any particular garment"* passes the piece rule and still
 * invents a wardrobe the brief never mentions, and *"elite black-ops
 * bio-engineering"* is a backstory no rule here mentioned at all.
 *
 * Measured on the BEFORE arm of his own cyborg brief (3 of 3 drafts): a
 * soldier/operative history in all three, a dossier-photo frame, and an
 * invented wardrobe paragraph in one.
 *
 * NO WORD BAN RIDES WITH IT, and that is a declared judgement rather than an
 * omission: "soldier", "wardrobe", "history" and "built" are ordinary prose
 * about a face, and this module has five recorded instances of an over-broad
 * ban (`cropped`, `framing`, `reminiscent of`, and the two named in
 * `PIECE_NOUNS`). The instruction carries it and his eye is the gate.
 */
/**
 * The heading the six universal rules sit under. A CONSTANT because the arm
 * that proves they are not branch-local reads this exact string rather than a
 * copy of it — a mirrored heading is a heading that can drift.
 */
export const UNIVERSAL_RULES_HEADING = "THESE RULES HOLD WHICHEVER KIND OF SEED IT IS:";

export const NO_NEW_SUBJECT_RULE =
  "NO NEW SUBJECT. Sharpen and complete what the request names; never introduce a subject it is silent on. "
  + "WARDROBE is the live case: if the request does not describe clothing, keep it generic or leave it out "
  + "entirely — do not invent an outfit, a fabric world or a styling direction for one. The same holds for WHO "
  + "he is: no profession, no employer, no organisation, no backstory, no history, no what-he-has-been-through, "
  + "no world he comes from. You are writing a casting note about a look, not a character.";

/**
 * #327 rule 2, his sentence: *"'Pale porcelain skin' and 'heavily weathered'
 * are both in the source — Max kept both and then added dry/taut/creased/
 * weather-written-into-skin. Resolve that into one coherent skin read instead
 * of stacking both."*
 *
 * ⚠ **RESOLVING IS NOT DROPPING, and the clause saying so is load-bearing** —
 * without it this rule reads as permission to delete one of two stated facts,
 * which is exactly what `FACTS STAY` forbids and what the court measured the
 * free-reword arm doing. What must not survive is the ARGUMENT between them
 * and the third pile of texture words stacked on top.
 */
export const RESOLVE_NOT_STACK_RULE =
  "RESOLVE A CONTRADICTION, NEVER STACK IT. Where the request describes one surface two ways, write the single "
  + "coherent reading that holds both — not both readings side by side, and never a third layer of texture words "
  + "piled on afterwards. \"Pale porcelain\" and \"heavily weathered\" are ONE skin: say what that skin actually "
  + "looks like, once. Resolving is not dropping — both stated facts survive inside the one description; what "
  + "must not survive is the argument between them.";

/**
 * #327 rule 3, his sentence: *"The lockable facts are getting buried. Bald,
 * mid-40s, right-temple ports, scalp plate joins, jaw plate, studs under both
 * ears, faint amber-red right eye, surgically integrated not worn — those need
 * to stay first-class and explicit. Don't dissolve them into a long prose
 * paragraph of character writing."*
 *
 * ⚠ **THE SHAPE DECISION IS AN ORDERING RULE, and it is taken from his own
 * approved worked example rather than invented.** The card left it open — *"a
 * plain clause, a leading sentence, or an ordering rule"* — and the golden
 * sphinx target already in this instruction, which he wrote and passed, opens
 * with exactly that: a compact plain list of the stated facts ("Adult feline
 * humanoid, hairless violet-blue skin, large ears, whiskers, luminous amber
 * eyes, long tail."), and only then the presence and the materials. So the
 * rule is what his own example already demonstrates, which is the cheapest
 * possible thing for a model to obey.
 *
 * ⚠ **AND NOTHING MEASURES IT, WHICH IS SAID OUT LOUD RATHER THAN PAPERED
 * OVER.** `droppedFactIn` tests PRESENCE; he is asking for PROMINENCE. Every
 * before-arm draft PASSES the fidelity guard — the facts are all there, and
 * they are dissolved. There is no honest mechanical reader for "legible at a
 * glance", so his eye on the drafts is the gate and this instruction is the
 * control (law 9's shape: the reader is not the judge).
 */
export const FACTS_FIRST_RULE =
  "STATED FACTS COME FIRST AND STAY LEGIBLE. Open with the request's own facts, plainly and compactly, before any "
  + "mood or character writing — the way the worked example above opens. Each stated fact gets its own clause in "
  + "the request's own terms, readable at a glance, with its placement and its side attached to it (\"above the "
  + "right temple\", \"below each ear\", \"the right eye\"). Never dissolve a fact into a sentence about who he "
  + "is: \"a man rebuilt for function\" does not carry \"a dark mechanical plate along the jawline\". Taste comes "
  + "AFTER the facts, never wrapped around them.";

const SKIN_RULE =
  "Do NOT ADD skin or surface words that fight the studio's own realism rules — no translucent, poreless, flawless, "
  + "airbrushed, waxy or doll-like skin, and no perfect symmetry — and do not reach for a synonym of one either. "
  + "If the request uses such a word, keep it: it is a stated fact. Skin it does not describe has texture, pores and life.";

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
 * ⚠ **THE LIST IS ARMOUR PIECES AND HIS OWN THIRD NOUN, AND THAT NARROWNESS IS
 * A DECLARED JUDGEMENT RATHER THAN AN OVERSIGHT.** His law names four classes;
 * three of them (garments, cuts, jewellery) have been INSTRUCTION rules in
 * `maxSystemPrompt` since #131 and stay instruction rules, because a word ban
 * over the world's garments either sweeps ordinary prose or is a taxonomy
 * nobody wrote — this module's own admission test, and the fourth time this
 * repo has met it (`cropped`, `framing`, `reminiscent of` in
 * `conceptDescribe.ts`). Armour pieces are different in the one way that
 * matters: each word below names exactly one manufactured plate and has no
 * second sense in a casting paragraph. `collar` is his own failing noun and is
 * here on that evidence; `collarbones` is a DIFFERENT WHOLE WORD and passes,
 * which the suite asserts as a positive control, because the court's own
 * finding is that `collarbones` is the word that gets a prompt through where
 * `sternum` does not.
 *
 * **The check is SEED-EXEMPT, and that is his own clause** (*"unless the user
 * typed them"* / *"FACTS STAY PUT"*): a customer who writes "pauldrons" keeps
 * them, and refusing her rewrite for a word she typed would drop her to a
 * static prompt that sends the same word to the same engine anyway — the
 * argument `skinContradictionIn` already had to make about "porcelain-pale".
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
    /*
      #237, his law verbatim where it speaks. One paragraph was necessary and
      is not sufficient: the sphinx sheet came back as a KIT inside a single
      paragraph, which is the clone path wearing the right shape.
    */
    "PIN THE WORLD, NEVER THE PIECES. Pin materials, mood and species facts. NEVER pin an exact garment, an exact cut, a jewellery piece or an armour piece the request did not name — no pauldrons, no vambraces, no sculpted collar, no named coat, boot, buckle or ring. Naming a kit locks one costume onto every portrait, which is the same failure as locking one face. Say what the wardrobe is MADE OF and what it FEELS like, and leave the parts to the engine. FACES STAY FREE. FACTS STAY PUT.",
    "",
    /*
      #279, his ruling verbatim where it speaks: *"a machine part fitted to a
      cyborgs face is apart of that being . as long as its actually fitted and
      not worn"* — *"A choker is an accessory. A horn is a feature. A
      mechanical eye bolted into the skull is a feature. Write it as a type,
      not a SKU."*

      IT SITS DIRECTLY UNDER THE PIECES RULE BECAUSE THAT IS WHERE THE TWO
      COLLIDE. The sentence above says never name a part; the FACTS STAY rule
      says every stated feature survives. A bolted-in eye is caught by both,
      and until this clause nothing here said which wins — the READER half
      (`conceptDescribe.ts`) carried his test and the author did not.

      ⚠ MEASURED BEFORE IT WAS WRITTEN, and the honest reading is that this
      PINS the behaviour rather than repairs it (#279, 2026-08-31). Eighteen
      real drafts across four seed shapes — his own 553-character cyborg brief,
      a thin cyborg seed, a fitted-eye-plus-worn-choker seed, and his armoured
      feline with a fused jaw plate — kept the fitted hardware in EVERY
      non-refused draft and named a product in none; and the paid frames gate
      delivered it on 8 of 8 faces (roll 237). So the model was already reading
      the collision his way. That is exactly the state this repo has a law
      about: a rule the model happens to guess right is a coin, and the rule
      belongs on the sentence. Nothing here bans a word — his two wrong
      examples are SHOWN as shapes, never swept, because "harness", "piece" and
      "eye" are ordinary prose and this file has five recorded instances of an
      over-broad ban.
    */
    "FITTED IS NOT A PIECE. Draw the line by where the thing sits, not by what it is made of. Fitted INTO the body it is a FEATURE and it stays, exactly like a horn or a tail: a mechanical eye set into the skull, a jaw plate, an implant port, plating grown into bone. WORN on the body it is an accessory and the rule above governs it: a choker, a mask, a strap, a piece of jewellery. Name a fitted feature as a TYPE and never as a product — \"fitted mechanical eye\", \"integrated facial hardware\" — never \"spiked eye harness\", never \"sleek mechanical eye piece\". Do not flatten one away either: a being's own hardware is part of what is being cast.",
    "",
    /*
      His own golden target and his own failing kit, labelled — the shape
      `conceptDescribe.ts` uses for his granularity ruling, and the specimen is
      the sheet he refused.
    */
    "Worked example of the PIECES rule. An armoured feline humanoid should come back like this: \"Adult feline humanoid, hairless violet-blue skin, large ears, whiskers, luminous amber eyes, long tail. Sphinx-cat presence, sovereign and predatory. Dark structured armour in aged bronze and gold with jewel-toned inlay — ceremonial, worn, formidable.\" Heat on top of that is pressure, never parts: \"Metal hand-finished and battle-worn, not costume-clean. Eyes still and calculating. No soft youthful rounding.\" What it must never become is a kit — \"angular pauldrons, banded vambraces, a high sculpted collar\" — which is a build sheet, not a casting note.",
    "",
    /*
      #327 rules 1-3, his four corrections read at his own MAX draft. They sit
      HERE — after the worked example rule 3 points at, and ABOVE the
      FINISHED/thin fork — because all three are true of both branches: his
      failing draft was of a seed that fixes the world, and a rule about
      inventing a character is not a property of how thin the seed was.
    */
    `${NO_NEW_SUBJECT_RULE}`,
    "",
    `${RESOLVE_NOT_STACK_RULE}`,
    "",
    `${FACTS_FIRST_RULE}`,
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
    "",
    /*
      ⚠ THESE SIX WERE BULLETS UNDER "On a thin seed:" AND THEY ARE UNIVERSAL —
      found while building #327 rule 4, and it is working law 4's shape rather
      than a style preference. The CODE enforces all six on both branches
      (`neverWrittenIn`, `skinContradictionIn`, `containsHouseSentence`, the
      allowance re-ask, the blank-line check), so on a FINISHED seed the model
      was being checked against rules its own instruction filed under the other
      fork — including the very no-studio rule his rule 4 is about, and his
      failing draft was of a finished seed. A rule the check enforces and the
      instruction does not describe is how both drift.
    */
    UNIVERSAL_RULES_HEADING,
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
  lane: HouseLane = DEFAULT_HOUSE_LANE,
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
  /*
    The block is the STYLE's (#142) and now the LANE's (#232/#237) — one style
    today, and the human lane is `HOUSE_BLOCK`'s bytes exactly as before.
  */
  parts.push(houseBlockForStyle(style, lane));
  return parts.join("\n\n");
}

/** Seed (+ the family clause when one is carried) + block: what every LOW roll gets, and what a MAX roll falls back to. */
export function staticPrompt(
  briefText: string,
  style: CastStyle = DEFAULT_CAST_STYLE,
  clause: string | null = null,
  lane: HouseLane = DEFAULT_HOUSE_LANE,
): string {
  return composeFinalPrompt(briefText, null, style, clause, lane);
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
   * WHICH LANE the locked block was composed in (#232/#237) — `human` unless
   * the reader called the subject a `being`. Recorded so a sheet can say which
   * block it was painted under without re-deriving it from a reading that may
   * since have changed, and so a census can count the creature road.
   */
  lane: HouseLane;
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
    /* #237: a manufactured PIECE the author introduced — the kit inside the one paragraph. */
    const piece = pieceNounIn(addition, seed.text);
    if (piece) {
      return `Your previous draft named "${piece}", a specific piece the request never named. Do not pin an exact garment, cut, jewellery piece or armour piece — pin materials, mood and species facts instead, and leave the parts to the engine. Rewrite it without that noun.`;
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
   * WHICH LANE the locked block is composed in (#232/#237). The caller derives
   * it ONCE per roll from the reader's subject (`houseLaneFor`); absent means
   * the human lane, whose bytes are today's exactly.
   */
  lane?: HouseLane;
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
  const lane = input.lane ?? DEFAULT_HOUSE_LANE;
  const briefText = input.briefText.trim();
  const clause = input.clause?.trim() || null;
  const allowance = authorAllowance(briefText);
  /* The lane's own block, so the recorded total is the one that was actually sent (#232). */
  const houseBlockWords = countWords(houseBlockForStyle(style, lane));
  const seedWords = countWords(briefText);
  /* THE RAW SEED, kept internally for the fidelity check — his own sentence (#230). */
  const seed = {
    text: briefText,
    facts: seedFactsOf(briefText, { sex: input.statedSex ?? null, age: input.statedAge ?? null }),
  };

  if (imagination === "low") {
    return {
      prompt: staticPrompt(briefText, style, clause, lane), imagination, style, lane, compose: "rewrite", seedWords,
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
    prompt: staticPrompt(briefText, style, clause, lane), imagination, style, lane, compose: "rewrite", seedWords,
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
      prompt: composeFinalPrompt(briefText, content, style, clause, lane), imagination, style, lane, compose: "rewrite", seedWords,
      mode: "authored", authored: true, content,
      addedWords: countWords(content) - seedWords, houseBlockWords, allowance, model, latencyMs, attempts,
    };
  } catch (error) {
    log.warn({ error: String(error), imagination, attempts }, "[promptAuthor] the author call failed — the static prompt stands");
    return fallback(spentMs);
  }
}

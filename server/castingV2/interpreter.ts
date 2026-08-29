/**
 * The interpreter (plan §E, Path A).
 *
 * One text call turns a sentence into a `CastingIntent`. It runs before the
 * claim, so it is free to fail, and it is never trusted: the response goes
 * through `parseCastingIntent`, which keeps what is in the allowlist and drops
 * everything else.
 *
 * The system prompt below is the restraint doctrine (catalog H7), and the
 * reason it is written this way is worth stating plainly, because the opposite
 * instruction is the one that failed. M3's interpreter was asked for "one
 * vivid, concrete description" and produced a rich, specific character —
 * complete with a plaid shirt and a captioned mug that every candidate then
 * inherited. Rich output from this stage is not a feature. Legacy learned the
 * same lesson the same way: *"If you fill them with plausible defaults, you
 * constrain the engine and produce a generic Brazilian cast every time. Empty
 * fields become creative opportunities for the engine; wrong fields become
 * user-trust violations."*
 */
import { createModuleLogger } from "../logging/logger";
import { createOpenRouterTextEngine } from "../providers/openrouterText";
import { ProviderQueue } from "../providers/providerQueue";
import type { TextEngine } from "../providers/types";
import {
  AGE_BANDS,
  ARCHETYPE_KEYS,
  LOOK_KEYS,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  NOTES_MAX,
  NOTES_MAX_FIDELITY,
  SEXES,
  cleanCharacterNotes,
  freeTextOverflow,
  parseCastingIntent,
  type CastingIntent,
  type SubjectReading,
  type SubjectRefusal,
} from "./castingIntent";
import { BODY_ANCHOR_REGIONS } from "../../shared/bodyAnchorRegions";
import { containsBrand } from "./brandScrub";
import { namesUnknownProperNoun } from "./properNouns";

const log = createModuleLogger("castingV2/interpreter");

/**
 * Parse-failure telemetry, in the shape of the roll-failure alarm.
 *
 * The class this closes: a truncated reply fails the whole parse, the compiler
 * falls back, and every lock the user stated is lost — SILENTLY. It has now
 * happened at three different ceilings (500, 1200, 1800), each time discovered
 * by someone tripping over it rather than by anything announcing it, and the
 * most recent was a 50% rate found only because a paid A/B measurement happened
 * to be running.
 *
 * A ceiling will always be a guess. Whether we are hitting it must not be, so
 * the rate is counted and crosses into `log.error` on its own — the same
 * "stop, something is wrong with US not the brief" shape the provider-account
 * alarm uses, rather than per-request noise nobody aggregates.
 */
const parseStats = { attempts: 0, failures: 0, truncations: 0 };

/** Exported so a test can assert the alarm fires rather than trusting it does. */
export function interpreterParseStats(): Readonly<typeof parseStats> {
  return { ...parseStats };
}

/**
 * THE ROLE RE-ASK, COUNTED — because its absence is what let this hide.
 *
 * `role` is the ONLY field in the product that produces the `CASTING CATEGORY
 * (ABSOLUTE)` block. When it comes back null the block never renders, the
 * engine is never told what it is casting, and the eight come back as generic
 * people — the founder has now reported that outcome TWICE, five months apart
 * ("generic women" on a high-fashion editorial brief, identical cyborgs on his
 * augmented-man brief), each time by tripping over it.
 *
 * Nothing counted it either time. So the rate ships with the repair: one grep
 * for `roleNull` gives the number that previously needed a court.
 *
 * **The prior, from that court** (`output/role-court/`, 12 compiles of his
 * 553-character brief): role came back null 2 of 6 with the fidelity lane on
 * and 0 of 5 with it off — a difference of p = 0.45, which is noise. Read
 * across 213 real production rolls the null rate is 12.2% (26 of 213), and
 * **25 of those 26 are short briefs that name no category at all**, which is an
 * honest silence rather than a miss. That is the population this repair must
 * NOT fire on.
 */
const roleStats = { nullOnCompile: 0, reaskRan: 0, rescued: 0 };

/** Exported so a test can assert the counter moves rather than trusting it does. */
export function interpreterRoleStats(): Readonly<typeof roleStats> {
  return { ...roleStats };
}

const ALARM_AFTER_ATTEMPTS = 20;
const ALARM_FAILURE_RATE = 0.2;

function recordParseOutcome(failed: boolean, truncated: boolean): void {
  parseStats.attempts += 1;
  if (failed) parseStats.failures += 1;
  if (truncated) parseStats.truncations += 1;

  if (parseStats.attempts < ALARM_AFTER_ATTEMPTS) return;
  const rate = parseStats.failures / parseStats.attempts;
  if (rate >= ALARM_FAILURE_RATE) {
    log.error(
      {
        attempts: parseStats.attempts,
        failures: parseStats.failures,
        truncations: parseStats.truncations,
        // Same units and same key as the roll alarm, so the two read alike.
        failureRate: Math.round(rate * 100),
      },
      "[interpreter] PARSE FAILURES ABOVE THRESHOLD — briefs are losing their stated locks to the fallback; check the token ceiling first",
    );
  }
  // Roll the window so one bad hour does not alarm forever.
  if (parseStats.attempts >= ALARM_AFTER_ATTEMPTS * 5) {
    parseStats.attempts = 0;
    parseStats.failures = 0;
    parseStats.truncations = 0;
  }
}

/**
 * Did an aesthetic reference land nowhere at all?
 *
 * PROVABLE, not heuristic: a listed fashion token in the brief is evidence the
 * user named a reference, so all three channels coming back null is a
 * demonstrable miss rather than an honest silence. That is what makes this the
 * role-repair pattern rather than a guess — it can never fire on a true null.
 */
function needsAestheticRetry(briefText: string, intent: CastingIntent): boolean {
  if (!namesSomethingSpecific(briefText)) return false;
  return intent.composedDirection === null && intent.look === null && intent.archetype === null;
}


/**
 * Did a brief rich enough to describe a CHARACTER come back with no kind of
 * person at all?
 *
 * PROVABLE rather than heuristic, in `needsAestheticRetry`'s shape and for its
 * reason: it must never fire on an honest silence. "a redhead in her 30s" names
 * no category and a null `role` there is correct — re-asking it invites the
 * model to INVENT one, which is precisely the bug `promoteStatedRole` was
 * narrowed to stop (its docblock: promoting on a loose trigger "was installing
 * the whole sentence as a casting category on briefs that named none").
 *
 * The signal is the model's OWN uncapped `characterNotes` measured against
 * `NOTES_MAX` — an existing constant, not a new number chosen to fit. A model
 * that writes more than the product's long-standing bound for character detail
 * has found a specific person, and a specific person has a kind.
 *
 * **Measured on 213 real production rolls before this was written.** Of the 26
 * with a null role, twenty-five have raw notes of 62 characters or fewer (most
 * have none at all) and are short briefs naming no category. The twenty-sixth
 * is the founder's 553-character cyborg brief at 448 characters of notes —
 * seven times the next highest. The separation is not a threshold anyone had to
 * tune; anything between them works, and `NOTES_MAX` sits inside that gap.
 *
 * It reads the RAW notes, not the stored ones, so it behaves identically inside
 * and outside `CASTING_BRIEF_FIDELITY_SCOPE` — the stored value is capped at
 * 180 on today's road and could never exceed it, which would have made this
 * repair silently lane-only.
 */
function needsRoleRetry(intent: CastingIntent, rawNotes: string | null): boolean {
  if (intent.role !== null) return false;
  return (rawNotes?.length ?? 0) > NOTES_MAX;
}

/**
 * Does the brief name something SPECIFIC that we might have failed to capture?
 *
 * **A listless detector, deliberately** (founder amendment). Two signals, and
 * the union is the point:
 *
 *   - a **proper-noun shape**: capitalized, not sentence-initial, and absent
 *     from our own vocabularies. That catches a director, a film, a scene, a
 *     house — anything a person names — without a list of them existing
 *     anywhere, which is the ruling that keeps this from becoming a culture
 *     dictionary we would have to maintain and defend.
 *   - a **listed fashion token**, still, because the shape alone is not
 *     enough: "miu miu" is typed lowercase, so the founder's own golden brief
 *     would slip past a pure proper-noun test. The list keeps its real job in
 *     `brandScrub` and merely contributes here.
 *
 * **False positives are acceptable by design.** The only cost of a wrong
 * detection is one cheap re-interpretation, so the detector may be sloppy
 * where the guards may not — an asymmetry worth naming, because the same
 * looseness in `scrubBrands` or the garment guard would be a defect.
 */
function namesSomethingSpecific(briefText: string): boolean {
  if (containsBrand(briefText)) return true;
  // Sentence-initial capitals say nothing — every brief starts with one.
  return namesUnknownProperNoun(briefText, { mode: "sentence" });
}

/** Exported for the prompt-contract tests; never used at runtime. */
export const SYSTEM_PROMPT_FOR_TESTS = () => SYSTEM_PROMPT;

/**
 * THE WARDROBE BLOCK — appended only when the roll will actually use a pick
 * (design `CASTING_V2_TWO_PATHS_DESIGN.md` §4, case (b)).
 *
 * ⚠ **IT IS CONDITIONAL BECAUSE A PROMPT IS LIVE BEHAVIOUR, and adding a field
 * to it is not a dark landing.** Every fact on a paid sheet comes out of this
 * one reply, and this campaign has MEASURED that context is not additive: a
 * SUBSET of prompt context raised the stage wall twice as often as its
 * superset, so per-line attribution is invalid and claim rates swing tens of
 * percent between windows. Sending this block to an account outside
 * `CASTING_TWO_PATHS_SCOPE` would therefore change what that account's sheet
 * says about age, heritage and hair — in a direction nobody has measured — in
 * exchange for a field their roll cannot read.
 *
 * So the flag decides the prompt, and outside it the bytes on the wire are
 * byte-identical to yesterday's. `interpreterSystemPrompt` is the one composer;
 * `SYSTEM_PROMPT` remains the base and is what every existing contract test
 * reads.
 *
 * # ⚠ THE BOREDOM CLAUSE CAME OUT ON 2026-08-25, AND IT WAS NEVER ONE CLAUSE
 *
 * Founder order (relayed fable-1595, verbatim): *"whats up with the wardrobe
 * choosing the aboslute lamest uninspired outfits?"* Design
 * `docs/specs/CASTING_V2_WARDROBE_PICKER_DESIGN.md`, countersigned fable-1609,
 * court run and shape A ruled in.
 *
 * **Nothing was ever being truncated.** Read at production's four pathed rolls
 * — the picker's entire delivered output, ever — it spent **10 words of an
 * announced 30 and 79 characters of a 180-character door**, and the word
 * *plain* was in **4 of 4** picks. His cyborg brief, 553 characters of implant
 * ports and plate joins, produced *"a plain charcoal grey crew-neck tee"* —
 * **7 of its 12 tokens shared with `HOUSE_WARDROBE_LINE`**, the fallback the
 * picker exists to beat. The block rationed REGISTER the way `characterNotes`'
 * announced cap rationed LENGTH: *an announced adjective is a brief.*
 *
 * ⚠ **AND THE WORKED EXAMPLES WERE THE STRONGER INSTRUCTION, WHICH THE COURT
 * PROVED RATHER THAN ASSUMED.** The court ran a third side — the same rails and
 * the same deletions but a NEUTRAL register direction that KEPT the old caveman
 * example — and on the caveman brief **both of its drives came back
 * byte-identical to a drive of today's prompt**, where every other brief on
 * both shapes was 0 of 2 identical. Where the old example survived, the old
 * answer survived. So an edit here changes the EXAMPLES or it changes nothing.
 *
 * **Every rail is unchanged and enumerated**: props, weapons, headwear, logos,
 * numbers, setting/activity/pose, completeness, the whole-reply refusal, and
 * `wardrobeDoor.ts` behind all of it. The one deletion inside the safety
 * paragraph is the ADJECTIVE — *"PLAIN, AND NEVER COSTUME"* became *"CLOTHES
 * ONLY"* — because `costume` was doing taste work under a safety word and would
 * have sat four lines from a costume-designer direction, contradicting it in
 * one breath. The trailing *"so keep it simple rather than interesting"* went
 * with it: that clause joined the RAILS to a TASTE instruction with a *so*, and
 * taught the model that the way not to be refused is to be dull.
 *
 * Measured, five briefs x three sides x two drives, one tree: *plain* fell from
 * **8 of 10 to 2 of 10**, **zero door refusals and zero cohort walls on any
 * side**, `cohort`/`sex`/`ageBand`/`build` identical across all three sides on
 * all five briefs, the *"a woman in her 30s"* negative control stayed out of
 * costume, and the barista's apron survived every drive.
 *
 * ⚠ **What to watch is LENGTH, and it is counted rather than hoped for.** A
 * bolder pick is a longer pick and the door refuses over 180 characters into
 * the greyest sentence in the product — the complaint reproduced by a different
 * mechanism. Longest seen: 112 in the court, 131 in the probe. That is what
 * `WARDROBE_PICK_REFUSED` (`wardrobeDoor.ts`) exists to make readable.
 */
const WARDROBE_BLOCK = `ONE MORE KEY, in the same JSON object and nowhere else:

  "wardrobe": string | null

- "wardrobe": THE ONE OUTFIT ALL EIGHT OF THESE PEOPLE WEAR.
  This sheet dresses its cast, so unlike every other field here you should fill
  this one even when the brief says nothing about clothes — that is the normal
  case and choosing well is the job.
  IF THE BRIEF NAMES AN OUTFIT, that outfit is the answer, in their words, and
  you complete it in the register the brief itself set: "a barista in a red
  apron" gives "a red apron over a soft white tee, dark straight jeans, worn
  leather low shoes".
  OTHERWISE DRESS THEM FOR THEIR OWN SHOOT. You are the costume designer on this
  job: read who this person is and choose what THEY would wear in front of this
  camera, with taste, and specific about fabric, cut and colour. A cybernetically
  augmented man gets matte black technical layers with hard seams. A runway model
  gets something sharp and current with a strong line. A caveman gets a rough
  one-shoulder hide and bare feet. A surgeon gets scrubs in their real colour.
  Someone the brief describes only as "a woman in her 30s" has no character to
  dress, and gets well-cut everyday clothes rather than anything loud.
  ALWAYS COMPLETE — top, bottoms, footwear, in one phrase under 30 words. The
  sheet is waist-up but the signed portrait set is full length, so an outfit
  that stops at the waist is an outfit those pictures have to invent.
  CLOTHES ONLY. No props and nothing held. No weapons. No hats, caps or anything
  on the head. No logos, brand names, slogans or writing of any kind. No numbers.
  No setting, no activity, no pose — say what they are wearing and stop.
  A reply that breaks any of those is thrown away whole and the sheet falls back
  to its plain studio clothes.`;

/**
 * THE INK BLOCK — asked only inside `CASTING_BORN_INK_SCOPE` (7b(a), gating
 * endorsed fable-1412 (a)).
 *
 * The reason is `WARDROBE_BLOCK`'s, verbatim, and it is the reason this field
 * waited for its consumer rather than shipping with its parser: **context is
 * not additive in this program, measured.** A SUBSET of prompt context raised
 * the stage wall twice as often as its superset, so adding a section changes
 * what a sheet says about age, heritage and hair in a direction nobody has
 * measured. Sending it to an account whose roll cannot write a `bornInk:` row
 * would buy that risk for nothing.
 *
 * So outside the flag the bytes on the wire are byte-identical to yesterday's,
 * and `SYSTEM_PROMPT` stays the base every existing contract test reads.
 *
 * # What it asks, and the two things it must not do
 *
 * The brief is the document (D-137, fable-1381), so this asks for exactly what
 * the brief SAID and nothing about what a tattooed person usually has. The
 * regions are the closed eight; anything else is dropped by the parser rather
 * than argued with here.
 */
const BORN_INK_BLOCK = `ONE MORE KEY, in the same JSON object and nowhere else:

  "statedInk": { "words": string[], "regions": string[] } | null

- "statedInk": TATTOOS THE BRIEF ITSELF DESCRIBED — the person is being cast
  already wearing them.
  null is the ordinary answer and means the brief named none. Most briefs do.
  "words": their own phrases for the ink, up to three, as short phrases —
  ["extensive black-and-grey ornamental tattoos"], ["a sleeve of fine linework"].
  USE ONLY WORDS THAT APPEAR IN THE BRIEF, the same rule as "statedHair" and
  "statedAccessories": anything containing a word the user did not type is
  dropped, so a paraphrase is worse than a null.
  "regions": where the brief puts it, from this closed list and nothing else —
  ${BODY_ANCHOR_REGIONS.map((region) => `"${region}"`).join(", ")}.
  Several are normal: a brief naming chest, shoulders and upper arms answers
  with the regions that cover them. Leave the array EMPTY rather than guessing
  when the brief describes ink without saying where.
  NEVER INFER. A biker, a sailor and a punk are not evidence of tattoos; only
  the brief saying so is. A brief that does not mention ink answers null, and a
  cast this field invents ink for is a person the user did not ask for.
  IT IS RECORDED, NOT DRAWN. Nothing here changes the picture — this is the
  product remembering what the brief said, so it can say it back.`;

/**
 * ⚠ **THE STATED SKIN LANE'S BLOCK** — one more key, asked only inside
 * `CASTING_BRIEF_FIDELITY_SCOPE` (`CASTING_V2_BRIEF_FIDELITY_BUILD.md` section
 * 3c; the shape is the stopped design's section 5, unchanged).
 *
 * # Why a BLOCK and not a field in the base schema
 *
 * `BORN_INK_BLOCK`'s argument, unchanged and for the same measurement: a field
 * in the base prompt is a field EVERY account's roll pays for in context, and
 * this program has measured that a SUBSET of prompt context raised the stage
 * wall twice as often as its superset. Outside the flag the bytes on the wire
 * are byte-identical to yesterday's, and `SYSTEM_PROMPT` stays the base every
 * existing contract test reads.
 *
 * # Why the lane exists at all when the budget is being fixed in the same commit
 *
 * The obvious objection, and it has an answer: a budget with room means the
 * tone USUALLY survives, and *usually* is the answer this whole item exists to
 * stop giving. A lane is not summarised at all. And it is not merely insurance
 * — `olive` is measured being TRANSLATED out of the notes into `heritage`
 * (0/3 hyphenated against 3/3 not), which no amount of budget repairs.
 *
 * # ⚠ The half that is NOT here, and shipping it alone would be the old defect
 *
 * A lane that fills a field and never speaks is `statedHair`'s original defect
 * — right about authoring, wrong about silence — and his bald cast came back
 * with hair because of it. So the composer sentence and the deference widening
 * land in the same commit as this block, and none of the three ships alone.
 */
const SKIN_LANE_BLOCK = `ONE MORE KEY, in the same JSON object and nowhere else:

  "statedSkin": { "tone": string | null, "character": string | null }

- "statedSkin": WHAT THE BRIEF ITSELF SAID ABOUT THIS PERSON'S SKIN.
  Both halves null is the ordinary answer and means the brief said nothing about
  skin. Most briefs do not.
  "tone": the colour or complexion in THEIR OWN WORDS — "pale porcelain",
  "olive", "deep brown", "ruddy", "sallow", "a deep tan".
  "character": what the skin DOES rather than what colour it is — "weathered",
  "deeply lined", "scarred", "pockmarked", "freckled".
  USE ONLY WORDS THAT APPEAR IN THE BRIEF, the same rule as "statedHair" and
  "statedAccessories": anything containing a word the user did not type is
  dropped, so a paraphrase is worse than a null. Do not normalise "porcelain"
  to "pale" or "sallow" to "yellowish" — the specific word is the whole point of
  this field.
  NEVER INFER. A heritage is not a skin tone, an age is not a texture, and an
  occupation is not weathering. Only the brief saying so is.
  THIS IS IN ADDITION TO, NEVER INSTEAD OF, "role" and "characterNotes". A fact
  recorded here must still appear in "characterNotes" if it belongs there — a
  lane is not a place to move a fact OUT of the summary.`;

/**
 * THE ANNOUNCED CAP, AND ITS REPLACEMENT — the one sentence
 * `CASTING_BRIEF_FIDELITY_SCOPE` swaps (`CASTING_V2_BRIEF_FIDELITY_BUILD.md`
 * section 3a, countersigned fable-1600).
 *
 * **A cap the ask announces is not a filter, it is a BRIEF.** Production says
 * so at 211 rolls: the longest `characterNotes` any customer has ever received
 * is 25 words, and the four densest briefs sit at 21, 24, 25, 25 — the model
 * writes to the number. His own 553-character brief lost seven of the fourteen
 * facts he typed to it, and the seven that lived were the seven inside the
 * first 180 characters.
 *
 * Released, the model still summarises — measured, the notes came back SHORTER
 * THAN THE BRIEF on 8 of 8 drives — so **this sentence was never restraining
 * padding; it was rationing content.** The replacement says what the field is
 * FOR instead of how long it may be, and every other restraint clause on the
 * field (write only what can be SEEN, no mood words, no brands, no numbers) is
 * untouched.
 *
 * The text below is the text the two courts actually drove, so what ships is
 * what was measured.
 */
export const NOTES_CAP_SENTENCE = "Under 25 words.";
export const NOTES_CAP_RELEASED =
  "Say every concrete, visible fact the brief states. Do not pad, do not repeat, "
  + "and add nothing the brief does not contain.";

/**
 * THE SUBJECT QUESTION — one slot in the system prompt, two shapes (#131
 * slice C, the ruling's §6).
 *
 * Outside `CASTING_CREATIVE_REGISTER_SCOPE` the reader is asked today's
 * two-valued cohort question, and "other" walls the roll as
 * `unsupported_cohort` — creature, anime, robot and named likeness alike,
 * because the only certified adapter paints photographic humans and the house
 * composer would bill for a photograph of someone vaguely anime-adjacent. On
 * THE AUTHOR ROAD the customer's words reach the engine verbatim, so that
 * premise is gone, and the ruling (`PROMPT_AUTHOR_RULING_2026-08-26.md` §6)
 * kills the stage wall and keeps exactly two refusals: no likeness of a real
 * person or a named character (KEPT), and ONE new wall — *this is a casting
 * studio; a subject that is not a being refuses free before the charge*
 * (founder, verbatim: "someone asking for an object should be refused like a
 * car"). So the flagged reader is asked a FOUR-valued question in the SAME
 * slot, and the compiler reads the four: `photoreal_human` and `being` cast,
 * `likeness` and `not_a_being` refuse free.
 *
 * The unflagged prompt is composed from the SAME constants, so it is
 * byte-identical to the text that stood here before they were named; the
 * flagged one is made by `String.replace` that ASSERTS it applied — the
 * fidelity swap's own reason, one block up. Both texts are exported so the
 * suite asserts the swap at the request rather than at a constant near it.
 */
export const COHORT_SCHEMA_LINE = `"cohort": "photoreal_human" | "other",`;
export const SUBJECT_SCHEMA_LINE = `"cohort": "photoreal_human" | "being" | "likeness" | "not_a_being",`;
export const COHORT_INSTRUCTION = `- "cohort": "photoreal_human" for any real-looking human. Use "other" for
  anime, illustration, animals, robots, fantasy creatures, or any brief that is
  not a photograph of a person.
  ALSO use "other" when the brief asks for a SPECIFIC PERSON OR CHARACTER —
  a named actor, musician, athlete or public figure, or a named fictional
  character from a game, film, comic or show. "Master Chief from Halo", "a
  Spider-Man look-alike", "someone who looks like <name>" are all "other".
  This holds however it is phrased: "look-alike", "inspired by", "in the style
  of", "vibes of", "reminds me of" are the same request wearing softer words.
  Two reasons, and both matter. We do not manufacture a likeness of a real
  person or someone else's character — the same principle that says a
  customer's own cast is theirs. And we cannot: the frame is a plain studio
  portrait with no costume, armour, mask or props, so the thing that makes
  that character recognisable is exactly what the frame strips away.
  A GENRE is not a character. "a space marine", "a superhero type", "a fantasy
  ranger" describe a kind of person and are ordinary photoreal briefs — cast
  them normally.`;
export const SUBJECT_INSTRUCTION = `- "cohort": WHAT KIND OF SUBJECT the brief asks to cast. This studio casts
  BEINGS — photoreal humans first, and also sci-fi humans, creatures,
  monsters, aliens, robots, androids, and illustrated or anime people. Use
  "photoreal_human" for a real-looking human; "being" for any other kind of
  creature or character that has a face or a body to cast (a lizard man, a
  chrome android, an anime girl, a swamp monster, a talking fox); and
  "not_a_being" when the brief asks for something that is NOT a being at all
  — an object, a vehicle, a landscape, a building, a logo, food, a pattern, a
  scene with nobody in it ("a red sports car", "a mountain at dawn", "a
  kitchen"). A brief that names a being AND a setting or an object is a
  being: cast the being.
  Use "likeness" when the brief asks for a SPECIFIC PERSON OR CHARACTER —
  a named actor, musician, athlete or public figure, or a named fictional
  character from a game, film, comic or show. "Master Chief from Halo", "a
  Spider-Man look-alike", "someone who looks like <name>" are all "likeness".
  This holds however it is phrased: "look-alike", "inspired by", "in the style
  of", "vibes of", "reminds me of" are the same request wearing softer words.
  We do not manufacture a likeness of a real person or someone else's
  character — the same principle that says a customer's own cast is theirs.
  A GENRE is not a character. "a space marine", "a superhero type", "a fantasy
  ranger", "an orc warlord", "a cyber-goth woman" describe a kind of being and
  are cast normally.`;

/**
 * The system prompt this roll will actually send.
 *
 * One composer, so there is no second copy of the base to drift. Each option is
 * its own flag's question and nothing else changes with it; the blocks append in
 * a FIXED ORDER so that two accounts with the same pair of flags get the same
 * bytes, and an account with neither gets `SYSTEM_PROMPT` itself.
 *
 * ⚠ **The fidelity swap ASSERTS IT APPLIED.** `String.replace` that matches
 * nothing returns its input silently, so an edit to the cap sentence would
 * leave a flagged account quietly running the UNFLAGGED prompt — the footprint
 * class this repository has already been bitten by. A miss throws here rather
 * than shipping a prompt nobody chose.
 */
export function interpreterSystemPrompt(
  options?: { wardrobe?: boolean; ink?: boolean; fidelity?: boolean; author?: boolean },
): string {
  let base = SYSTEM_PROMPT;
  if (options?.fidelity === true) {
    if (!base.includes(NOTES_CAP_SENTENCE)) {
      throw new Error(
        `[interpreter] the announced cap sentence "${NOTES_CAP_SENTENCE}" is not in the system `
        + "prompt — the brief-fidelity swap cannot apply, and shipping the unflagged prompt to a "
        + "flagged account would be a silent no-op",
      );
    }
    base = base.replace(NOTES_CAP_SENTENCE, NOTES_CAP_RELEASED);
  }
  if (options?.author === true) {
    /* The subject swap asserts it applied, for the fidelity swap's reason. */
    for (const [from, to] of [
      [COHORT_SCHEMA_LINE, SUBJECT_SCHEMA_LINE],
      [COHORT_INSTRUCTION, SUBJECT_INSTRUCTION],
    ] as const) {
      if (!base.includes(from)) {
        throw new Error(
          `[interpreter] the cohort text beginning "${from.slice(0, 32)}" is not in the system prompt `
          + "— the author-road subject swap cannot apply, and shipping the two-valued question to a "
          + "flagged account would wall every creature brief silently",
        );
      }
      base = base.replace(from, to);
    }
  }
  const blocks: string[] = [];
  if (options?.fidelity === true) blocks.push(SKIN_LANE_BLOCK);
  if (options?.wardrobe === true) blocks.push(WARDROBE_BLOCK);
  if (options?.ink === true) blocks.push(BORN_INK_BLOCK);
  return blocks.length === 0 ? base : [base, ...blocks].join("\n");
}

const SYSTEM_PROMPT = `You read a casting brief and extract only what it actually says about WHO to cast.

Reply with a single JSON object and nothing else:

{
  ${COHORT_SCHEMA_LINE}
  "role": string | null,
  "characterNotes": string | null,
  "sex": ${SEXES.map((value) => `"${value}"`).join(" | ")} | null,
  "ageBand": ${AGE_BANDS.map((value) => `"${value}"`).join(" | ")} | null,
  "agePhase": "early" | "mid" | "late" | null,
  "heritage": [{ "heritage": one of ${HERITAGES.join(", ")}, "pct": number }] (0, 1 or 2 entries),
  "build": ${BUILDS.map((value) => `"${value}"`).join(" | ")} | null,
  "energy": ${ENERGY_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "archetype": ${ARCHETYPE_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "variationAxis": "look" | "disposition" | null,
  "look": ${LOOK_KEYS.map((value) => `"${value}"`).join(" | ")} | null,
  "reads": [8 short strings] | null,
  "composedDirection": { "thesis": string, "avoid": string } | null,
  "statedHair": { "cutLength": string | null, "colour": string | null, "texture": string | null, "greying": boolean },
  "statedAccessories": string[],
  "poolTendencies": { "ageLean": ageBand value | null, "facialHairLean": "clean" | "beard" | "any" | null, "heritageLean": heritage value | null, "leanStrength": "centres" | "defines" | null, "avoidFamilies": [hair family values] }
}

THE ONE RULE THAT MATTERS: null means the brief did not say. Leave every field
null unless the brief states it or unmistakably implies it. Do not fill fields
with plausible defaults. A field you guess wrong is a broken promise to the
user; a field you leave null is creative room for the casting engine, which
will vary it across the eight candidates.

THE OTHER HALF OF THAT RULE, AND IT IS EQUALLY BINDING: restraint means never
INVENTING. It never means discarding. If the brief plainly states a fact —
an age, a sex, a heritage, a build — you MUST record it. Dropping something
the user actually said is not caution; it is losing their instruction, and it
produces a sheet that ignores what they asked for. Read the brief twice and
check you have captured every fact it contains before you answer.

Worked example: "Mediterranean man in his 70s, weathered face" states three
facts. sex = "male". ageBand = "70s+". heritage = Mediterranean. All three are
stated; none of them may come back null.

WHAT TO EXTRACT
- "role": THE CASTING CATEGORY, in the user's own words, under 12 words — "a dad
  in his 30s", "punk drummer", "wiry cyclist", "corporate lawyer", "high-fashion
  editorial model", "beauty creator".
  REQUIRED whenever the brief names any occupation, type, category or kind of
  person — INCLUDING fashion and modelling categories. "editorial model",
  "runway model", "beauty creator" and "influencer" are all categories and all
  belong here. This field is the only thing that carries the category to the
  casting engine, and losing it produces a sheet of generic people instead of
  the casting the user asked for.
  Keep THEIR words. The rule is never to paraphrase a specific archetype UP into
  a vaguer one — do not turn "punk drummer" into "musician" or "model". It is
  not a reason to drop a category for being broad: if the user's own words are
  "editorial model", then "editorial model" is the role.
  "archetype" NEVER substitutes for this. That field is a closed list of casting
  DIRECTIONS and setting it does not capture the category; a brief can have both,
  and a brief that names a category must fill this one whatever else it fills.
  Leave it null only when the brief names no category at all — "someone with
  kind eyes", "a person in their 40s".
- "characterNotes": short character-side detail the brief gave — bearing,
  demeanour, hair, distinguishing features, any accessory the brief says they
  are WEARING, and any makeup it names. Under 25 words.
  This field and "role" are the only text that reaches the image model, and the
  image model is literal. Write only what can be SEEN. "Wide-set almond eyes
  with monolids" produces exactly that; "editorially magnetic" produces
  nothing, and spends the field. No mood words, no marketing language, no
  "stunning", "beautiful", "striking" or "effortless" — if a phrase does not
  name something a photograph could show, leave it out.
  Never write numbers, percentages, ratios or control-signal language in either
  field. Image models render digits as text artefacts in the picture.
  NEVER write a fashion house, magazine or brand name in either field —
  not "Versace editorial style", not "a Vogue cover look". Translate the
  aesthetic into castable direction instead ("sculpted, high-glamour editorial
  casting") and put the house in "archetype" if one fits. A trademark in these
  fields goes straight to the image provider, which refuses it — a real roll
  lost five of eight candidates that way.
- "sex": only from an explicit word or pronoun. "her", "she", "woman", "guy",
  "man" decide it. Never infer sex from a hairstyle, a colour, or an occupation.
  Never output "nonbinary" unless the brief says so explicitly.
- "ageBand": from a stated age or an age idiom ("in her 20s", "mid-forties" →
  "40s", "late teens" → "teens").
  A FUZZY AGE IS STILL A STATED AGE. This is the rule most often got wrong:
  "young" is vaguer than "24" and it is not silence, and dropping it produces a
  sheet running 40s–60s for a brief that said young. Map the idiom, then let the
  phase carry the vagueness:
      young, youthful, twenty-something, in their twenties  → "20s"
      teenage, teen, adolescent, schoolgirl, schoolboy      → "teens"
      young adult, early career, graduate, junior           → "20s"
      thirty-something, early career-established            → "30s"
      middle-aged, midlife, mid-career                      → "40s"
      older, mature, senior, veteran                        → "60s"
      elderly, elder, old, aged, pensioner, retired         → "70s+"
  "Greying" is NOT an age idiom and must not set ageBand. It is a statement
  about HAIR, and absorbing it into an age band is how the grey stops reaching
  the picture: the band is a number, and nothing downstream can recover a
  colour from it. Record what the brief said about the hair in
  "characterNotes" and leave the age alone unless the brief also gives one.
  Set "agePhase" only where the brief pins the part of the decade. "Young" gives
  ageBand "20s" and agePhase NULL — the band is what they said, the phase is the
  latitude they left. That pairing is the whole point: it honours the fact
  without inventing precision the brief did not carry.
  Leave ageBand null only when the brief truly says nothing about age at all.
- "agePhase": set it ONLY when the brief pins where in the decade. "early 20s"
  → "early"; "mid-forties" → "mid"; "late teens" → "late"; a bare "in her 20s"
  → null. This is a second, separate lock: filling it wrongly narrows the
  casting pool, and leaving it null when the user said "early" lets the sheet
  drift a decade older than they asked for.
- "heritage": only when stated. A nationality maps to the nearest listed
  heritage. Bare "mixed" or "ambiguous" is not a heritage — leave it empty.
  A hyphenated or dual heritage gives TWO entries, not one: "Nigerian-British"
  is West African + British Isles, "Korean-American" is East Asian alone
  unless the brief says more. Dropping half of a stated dual heritage loses a
  fact the user pinned, so return both and let the percentages split.
- "energy": only when the brief describes how the person carries themselves.
- "archetype": only when the brief clearly points at one of the listed
  directions. Otherwise null.
- "variationAxis": what should differ between the eight candidates.
  Use "look" when the brief asks for a KIND OF FACE — a model, editorial,
  fashion, runway, beauty or campaign casting. Eight models differ by the sort
  of face a house casts, not by mood; varying mood there returns one look
  wearing eight expressions.
  Use "disposition" when the brief asks for a KIND OF PERSON — a character, an
  occupation, a UGC creator, anyone you would meet. There, eight different
  temperaments is exactly the right difference.
  Null if you genuinely cannot tell.
- "look": only when the brief names a specific casting look. A stated look
  locks across all eight; leave it null and the eight will each take a
  different one.
- "composedDirection": when the brief carries a STRONG DOCUMENTED AESTHETIC that
  none of the listed "archetype" values fits. Two sources qualify:
      an aesthetic REFERENCE — a fashion house, a director, a film, a scene; or
      a CASTING CATEGORY with a strong aesthetic of its own — a k-pop idol, a
      drill sergeant, a monk, a Viking, a biker gang leader.
  An ORDINARY OCCUPATION never qualifies. A skincare founder, a nurse, an
  accountant, a teacher have no documented casting aesthetic, and inventing one
  for them narrows the sheet for no reason — leave this null, as you would any
  other field the brief did not fill.
  Compose it in the same shape the archetype list uses:
      "thesis": what kind of FACE, BEARING and SILHOUETTE this casting wants,
                under 30 words. Bearing is half of an aesthetic and usually the
                missing half: a house that commands the lens, a casting that is
                doe-eyed and slightly awkward, the soft stage-charisma of an
                idol, the flint of a man who leads a gang. Name how the person
                HOLDS THEMSELVES, not only how they are built.
                You may also name the world's TYPICAL SILHOUETTES — "soft
                see-through fringes", "a two-block silhouette", "close-barbered
                and squared off" — because a silhouette is the level this
                casting is described at. NEVER a named cut, and never one cut
                for the whole sheet: you are describing the world these people
                live in, and the engine still varies who each of them is.
      "avoid":  the anti-pattern — what it must not collapse into, under 20.
  ADDITIVE, NEVER A SUBSTITUTE. Keep filling "archetype", "look" and every
  other field exactly as you would have. If a listed archetype fits, use it and
  leave this null — this field is for references the list cannot hold, not a
  second place to put things that already have a home.
  FACE, HAIR AND BEARING ONLY. Never clothing, accessories, makeup, fabric,
  logos or setting — the photograph is a plain grey tee on seamless paper, so a
  direction about clothes describes something that cannot appear.
  NEVER NAME THE REFERENCE. Not the house, not the designer, not the film.
  Describe the casting, not the brand: "quirky, slightly awkward prep-school
  beauty — unconventional features worn with total ease", never "the X girl".
  A reference to someone's AESTHETIC is direction and belongs here. Casting the
  PERSON is refused — that rule is unchanged and this field never overrides it.
- "reads": exactly eight short labels — two or three words each, under 26
  characters — describing eight different people who all fit this brief. They
  caption the tiles, so write them in the brief's OWN register: a nurse sheet
  might read "Steady", "Seen it all", "Quietly funny"; a punk drummer sheet
  would read nothing like that. Describe the person at rest, never an action or
  an expression being performed. These are labels, not sentences, and they
  never affect the image — only what the tile is called.
  ALWAYS return eight. This is the one field that is not subject to the
  leave-it-null rule: it is a caption, not a casting fact, so there is no
  wrong guess to make — and falling back to a generic set makes every sheet
  read like every other sheet.
- "statedHair": WHAT the brief said about each part of the hair, in the user's
  own words. Copy their words; do not translate, normalise or improve them.
      "cutLength": the length or the cut — "long", "a bob", "shoulder-length".
      "colour":    the colour — "pastel pink", "auburn", "jet black".
      "texture":   how it grows — "curly", "straight", "coiled".
      "greying":   true when the brief describes greying rather than naming a
                   colour — "salt and pepper", "silver at the temples",
                   "greying at the sides". This is a PROCESS, not a shade: the
                   colour underneath is still open, so set this true and leave
                   "colour" null.
  Leave a part null when the brief did not speak to it. A brief that mentions
  only the colour fills only "colour" — the cut and the texture stay null and
  the casting engine will vary them across the eight, which is the point.
  USE ONLY WORDS THAT APPEAR IN THE BRIEF. Anything you write here is checked
  against the user's sentence and dropped if it contains a word they did not
  type, so a paraphrase is worse than a null — it is silently discarded.
  A BRIEF THAT SAYS THE HAIR IS GONE STILL FILLS "cutLength", in their word:
  "bald", "shaved", "shaved head", "buzzed", "hairless", "a buzzcut". That IS
  the cut. Leaving it null does not make the engine cautious — it makes the fact
  depend on a summary that may not carry it.
  THIS IS IN ADDITION TO, NEVER INSTEAD OF, "role" and "characterNotes". If the
  brief says "a redhead in her 30s", "redhead" belongs in the hair colour AND
  the sentence still gets whatever role and character detail it would otherwise
  have had. Filling this field is never a reason to leave another one empty.
- "statedAccessories": the worn things the brief NAMED, in the user's own words,
  as short phrases — ["chunky glasses"], ["a nose stud", "a wedding ring"],
  ["a red lip"]. Makeup counts. So do earrings, a necklace and any other
  jewellery: they are worn things the brief named, and they belong here.
  This does not change the picture — "characterNotes" is what reaches the image
  model. But it is READ TWICE, and the second reader matters: the sheet says
  back what it was told, AND the editing gate later treats this as the record of
  what she is wearing, which is what decides whether "take her earrings off" is
  something the product can do. A worn thing you leave out here is a thing she
  can never be asked to take off.
  USE ONLY WORDS THAT APPEAR IN THE BRIEF, the same rule as "statedHair" —
  anything containing a word the user did not type is dropped, so a paraphrase
  is worse than an empty list.
  Empty when the brief names nothing worn. Never invent, never infer from an
  occupation, and never list clothing: a jacket is wardrobe and the sheet does
  not render it.
- "poolTendencies": what the CASTING CATEGORY typically implies about axes the
  brief did not state. This is a TENDENCY, never a fact: it nudges the odds
  across the eight candidates and can never override anything the brief said.
      "ageLean": the age band this kind of casting centres on, when it clearly
                 centres on one. A Twitch streamer or a university student
                 leans "20s"; a retirement-community resident leans "70s+".
                 PHYSICAL TRADES AND PHYSICALLY DEMANDING WORK lean working-age
                 — a lumberjack, a roofer, a soldier, a deckhand centre on
                 "30s", because the pool genuinely does. A lawyer or a teacher
                 spans every working decade and leans nothing — leave it null.
      "facialHairLean": "clean" when the category is conventionally clean-shaven
                 (k-pop idol, cabin crew, competitive swimmer); "beard" when it
                 conventionally is not (lumberjack, biker, craft brewer); "any"
                 when the category genuinely spans both and you want the sheet
                 to show the range. Null when the category implies nothing.
      "heritageLean": the heritage this casting's real pool predominantly draws
                 from, when it genuinely does — a k-pop idol leans "East Asian",
                 a Bollywood casting leans "South Asian", a Nordic folk singer
                 leans "Nordic". This describes a POOL, never a requirement:
                 most of the sheet will lean this way and some of it will not,
                 which is correct, because those castings really do include
                 people from elsewhere. Leave it null for anything
                 international or unmarked — a doctor, a model, a streamer.
      "leanStrength": how HARD this pool's edges are.
                 "centres" — the pool has a clear centre and real edges. This is
                 the default and the right answer for almost everything: a
                 streamer casting genuinely can include a 58-year-old, and a
                 sheet that cannot show one is a stereotype.
                 "defines" — the pool's edges are nearly absolute, so an
                 outsider would read as a mistake rather than as range. Reserve
                 it for industries with genuinely hard edges: a k-pop idol, a
                 sumo wrestler, a Maasai warrior. If you are unsure, "centres".
      "avoidFamilies": silhouette FAMILIES this casting's pool essentially never
                 wears, from: shaved, cropped, short, mid-length, long, coiled.
                 A k-pop idol casting excludes "shaved" and "cropped"; a serving
                 soldier excludes "long". Families only — never a specific cut,
                 because naming a cut would decide every tile instead of
                 describing the pool. Empty for almost everything: most castings
                 genuinely span the range, and an exclusion you invent removes
                 faces the user might have wanted.
  Only fill these from the CATEGORY, never from the individual. If the brief
  states an age or facial hair, that is a fact and belongs in its own field —
  putting it here instead would weaken a thing the user actually said.
  Leave both null when the brief names no category, or names one that implies
  nothing. A tendency you invent narrows the casting for no reason.
${COHORT_INSTRUCTION}

WHAT TO IGNORE COMPLETELY — the engine owns these, and anything you say about
them is discarded before it reaches the image model:
- The photograph: camera, lens, lighting, background, crop, pose, composition.
- The setting: locations, rooms, weather, activities, times of day. "In a
  cluttered garage" tells you this person works with their hands; it does not
  put a garage in the picture.
- Wardrobe, props, objects held, or anything with writing on it.
  EXCEPT accessories the brief explicitly says the person is WEARING — glasses,
  a nose stud, a named earring, a chain, a wedding ring. Those are stated facts
  about this person and belong in "characterNotes" in the user's own words
  ("wearing chunky glasses"). Dropping one is losing an instruction the user
  typed. Never invent an accessory the brief did not name.
- Makeup, on the SAME terms as accessories. A face is bare unless the brief
  says otherwise — never add makeup nobody asked for — but when the brief names
  it ("a red lip", "heavy mascara", "bold brows"), that is a stated fact and it
  belongs in "characterNotes" in the user's own words.
- Mood words that are not castable ("magnetic", "stunning", "iconic").
- Celebrity likeness. "Looks like Zendaya" gives you sex and maybe age. Stop
  there.

Never invent a detail the brief did not contain. Never write prose outside the
JSON.`;

/**
 * WHY the interpreter had no answer — the caller's decision hangs on it (#126).
 *
 *   - `thrown` — the call itself failed: the deadline fired, the transport
 *     died, the provider was down. The brief was never read at all.
 *   - `unconfigured` — no text engine exists in this deployment. Never read.
 *   - `unparsed` — the provider ANSWERED and the reply could not be read as
 *     an intent (a refusal in prose, a truncated object, a schema failure).
 *
 * The founder's ruling (Crew reply #7, "refuse-free") is about the first two:
 * a roll whose brief was never read refuses free instead of charging for a
 * sheet cast from `briefText.slice(0, 80)`. The third is a different question
 * — a reply we could not parse — and keeps the compiler's fallback until he
 * says otherwise; the compiler's own docblock says which is which.
 */
export type InterpreterUnavailableCause = "thrown" | "unconfigured" | "unparsed";

export type InterpretOutcome =
  | { ok: true; intent: CastingIntent; subject: SubjectReading; latencyMs: number; model: string }
  | { ok: false; reason: SubjectRefusal }
  | { ok: false; reason: "unavailable"; latencyMs: number; cause: InterpreterUnavailableCause };

let engine: TextEngine | null = null;

/**
 * The shared text transport. Exported because the refinement interpreter
 * (M8) needs the SAME one: two engines would mean two credentials, two
 * queues, and a config change that silently applies to one of them.
 */
/**
 * THE BRIEF INTERPRETER'S DEADLINE — sized to its population, not to the
 * transport's default (#121, roll 219).
 *
 * The OpenRouter text engine's default deadline is 45 s, and every other
 * reader on the shared engine (a describer, a hair or ink take, a refine ask)
 * fits inside it. The brief interpreter does not: it reads up to 2,000
 * characters and answers a wide JSON schema, and its latency scales with the
 * brief. Read at production's `interpreterLatencyMs`: short briefs 4–17 s;
 * the founder's 553-character brief 21,221–41,995 ms across seven rolls
 * (roll 206 was THREE SECONDS under the wire); his 1,494-character cyber-goth
 * brief, re-driven three times through this compile, 36,491 / 36,446 ms and
 * then **45,012 ms — the deadline** (`output/_shift121/drive-219.json`).
 *
 * What the deadline firing cost is the whole point: the call THROWS, the
 * compiler fell back to `fallbackIntent`, and the roll was charged 160
 * credits for eight people cast from `briefText.slice(0, 80)` — sex null,
 * hair null, skin null, ink null, register house. That is roll 219's row
 * exactly (`interpreted: false`, no `interpreterModel`): "a young woman with
 * an intense cyber-goth aesthetic" delivered men and women, and the founder
 * called it a complete failure. A deadline that fires on one in three of the
 * richest briefs is not a safety, it is the defect. (Since #126 the thrown
 * deadline REFUSES FREE at the compiler instead of charging — the deadline
 * below is what keeps that refusal rare, not what makes it safe.)
 *
 * 120 s is ~3× the measured rich-brief median and ~2.7× the worst observed
 * success. It is per CALL (`TextRequest.timeoutMs`), so the shared engine and
 * every other reader keep the 45 s deadline they were sized for.
 *
 * ⚠ THE DEADLINE IS PER ATTEMPT AND STACKS UNDER RETRY (the gate's review of
 * PR #124, finding 1). It sits inside the transport's retry loop and a timeout
 * is retryable, so with the default two retries a HUNG provider would hold one
 * interpretation for ~3 × 120 s ≈ 6 min. The interpreter therefore asks for
 * ONE retry (`INTERPRET_RETRIES`): a transient 429 or 5xx is still re-tried,
 * and the worst hang is ~2 × 120 s + backoff ≈ 4 min. That is still past the
 * gateway's ~305 s wall once the card and the render follow — so on a genuinely
 * hung provider the compile can outlive the socket. Money-safe: the compile
 * runs before the roll's claim, so nothing is charged; the customer's retry
 * re-runs the compile from scratch rather than replaying it.
 *
 * And the QUEUE is shared (finding 2): the text engine's queue serves every
 * reader at concurrency 4, so four concurrent rich-brief interpretations can
 * hold all four slots for up to 120 s each and a describer or a reference
 * take waits behind them — the queue (depth 32) waits rather than refuses.
 * Other readers keep their 45 s DEADLINE; their queue wait is now bounded by
 * this number, not theirs.
 */
export const INTERPRET_TIMEOUT_MS = 120_000;
/** One retry, not the transport's two — see the stacking paragraph above. */
export const INTERPRET_RETRIES = 1;

/**
 * THE ONE OPENROUTER TEXT ALLOWANCE, held here rather than inside the engine.
 *
 * `createOpenRouterTextEngine` builds its own `ProviderQueue` when it is handed
 * none — so a SECOND engine is a second allowance, and the provider sees eight
 * concurrent calls where the product declares four. That is the fal-allowance
 * class arriving on the text side (`assertFalBudget`'s whole reason for
 * existing), and it would have arrived silently: nothing sums text concurrency.
 *
 * The numbers are the ones the engine would have created for itself — name,
 * concurrency 4, depth 32 — so every reader on this queue behaves exactly as it
 * did before this function existed. What changed is that a reader may now be
 * pinned to a DIFFERENT MODEL (the concept reader is, #231) without buying four
 * more slots along with it: a model is a per-call field, an allowance is not.
 *
 * The Sign view judge keeps its own named queue on purpose — it is a separate,
 * declared budget with its own number (3), not an accidental second copy.
 */
let textQueue: ProviderQueue | null = null;
export function interpreterTextQueue(): ProviderQueue {
  if (!textQueue) {
    textQueue = new ProviderQueue({ name: "openrouter-text", concurrency: 4, maxQueueDepth: 32 });
  }
  return textQueue;
}

export function interpreterEngine(): TextEngine | null {
  if (engine) return engine;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  engine = createOpenRouterTextEngine({ apiKey, queue: interpreterTextQueue() });
  return engine;
}

/** Test seam: drops the memoized engine so config changes take effect. */
export function resetInterpreterForTests(): void {
  engine = null;
  textQueue = null;
}

/**
 * Read one brief.
 *
 * Three outcomes, and the difference between the last two is the difference
 * between a product decision and an outage:
 *
 *   - an intent;
 *   - `unsupported_cohort` — a real answer. The brief asks for something no
 *     certified adapter can cast, so the caller refuses for free rather than
 *     producing a photograph of someone vaguely anime-adjacent;
 *   - `unavailable` — the transport failed, or the reply was unreadable, and
 *     `cause` says which. Not the user's problem — and since #126 (founder:
 *     "refuse-free") not a reason to charge them either: a brief that was
 *     NEVER READ (`thrown`, `unconfigured`) is refused free by the compiler,
 *     because a sheet cast from the first 80 characters is a sheet that
 *     ignored the customer's words (roll 219, 160 credits). H30's fail-open
 *     policy for CHECKERS never fit a reader that produces what is rendered.
 *     A reply the provider gave and we could not parse (`unparsed`) still
 *     falls back, as it always has.
 */
/**
 * THE REASON A ROLL'S CHARACTER DETAIL WAS SHORTENED — one string, so the count
 * is one grep (fable-1415 (b)).
 *
 *     grep notesOverflow <the service log>
 *
 * counts every roll whose interpreted detail did not fit, and each line carries
 * how much overran, whether the compression re-ask ran, and whether it worked.
 * The old behaviour was a silent `.slice` and it survived a founder-visible
 * contact sheet and an entire sign court: two production rolls lost their whole
 * ink description mid-word and the only symptom was masters with no tattoos.
 *
 * # ⚠ THE TWO THINGS THIS COUNTER IS FOR, so neither is taken in passing
 *
 * The measurement gate (fable-1415 (c), driven and reported opus-1054) found
 * the compression **keeps the ink in 2 of 2 and gets under the bound in 1 of
 * 2** — strictly better than the guillotine on every cell, and a partial
 * rescue. What was deliberately NOT done on the strength of that court's own
 * two numbers, because choosing a fix after seeing them is optional stopping:
 *
 *   THE SHARPENED INSTRUCTION — the model is told *"Limit: 180 characters"*
 *   and answered 208. Parked behind a DATA TRIGGER, not a whim (fable-1416):
 *   when `outcome: "reaskFailed"` has accumulated FIVE real instances, a
 *   fresh-sample court runs on THOSE — never on the gate's original two.
 *
 *   ⚠ **THAT TRIGGER RETIRED 2026-08-23 (ruled fable-1431 §3), because it
 *   COULD NOT BE COUNTED.** `reaskFailed` is written HERE and nowhere else —
 *   no column, no table, only a log line over rotating logs — so a park behind
 *   it was a park nobody could ever close. The honest instrument is the
 *   population census below, and the trigger is now: **re-run it when
 *   `CASTING_BORN_INK_SCOPE` widens, or on the next real cap-hit seen in a
 *   report.** The five-instances number is retired.
 *
 *   RAISING `NOTES_MAX` — ⚠ **CLOSED 2026-08-23 as NOT WORTH IT** (ruled
 *   fable-1431 §1), which is a different and more honest disposition than the
 *   UNMEASURED it sat at. Measured over production, 207 rolls / 22 days:
 *
 *       carrying characterNotes             96
 *       length min/median/p90/max     4 / 20 / 34 / 180
 *       within 10 of the cap                 2   (rolls 128 and 129)
 *       …and both are ONE SITTING, 09:20 and 09:35 on 2026-08-01
 *
 *   Raising the cap would change the outcome for two rolls in three weeks,
 *   against a measured context risk: this program has seen a SUBSET of prompt
 *   context move the stage wall twice as often as its superset.
 *
 *   ⚠ **AND THE CLOSURE IS CONDITIONAL ON A POPULATION THAT IS ABOUT TO
 *   CHANGE.** Those two rolls are the BORN-INK pair — the only briefs long
 *   enough to be cut are the only briefs that describe tattoos, which makes
 *   sense, because ink takes words. So the cap's population and
 *   `CASTING_BORN_INK_SCOPE`'s population are ONE population. The day that flag
 *   widens, tattooed briefs stop being rare and this census is re-read BEFORE
 *   the flip, not after. A closure whose premise is "this is rare" must name
 *   the thing that would make it common.
 */
export const NOTES_OVERFLOW = "notesOverflow";

/**
 * THE REASON A BRIEF WAS READ TWICE BEFORE IT WAS WALLED — one string, so the
 * count is one grep.
 *
 *     grep cohortWallRetried <the service log>
 *
 * counts every brief the cohort classifier refused on its first read, and each
 * line says whether the second read cast it or agreed.
 *
 * ⚠ **It is the ONLY record this wall has ever had.** `unsupported_cohort` is
 * thrown as a `BriefRefusal` before a roll row exists, so there is no row, no
 * operation, no ledger entry and no counter anywhere — the product could not
 * answer *how often does the cohort wall fire* in either world. That absence is
 * what let a ~30% misfire rate on a real brief go unnoticed until the founder
 * met it twice in an hour.
 */
export const COHORT_WALL_RETRIED = "cohortWallRetried";


/**
 * ⚠ COMPRESS RATHER THAN GUILLOTINE — one re-ask, on about 2% of rolls
 * (ruled fable-1415 (c)).
 *
 * `characterNotes` and `role` are the ONLY text that reaches the image model,
 * and the cap on the first was enforced by cutting the string in half wherever
 * 180 characters landed. Measured in production: 2 of 96 rolls with notes were
 * cut, and they were rolls 128 and 129 — the only two that named tattoos. Both
 * also lost hair content (*"cornrows into fa"*), so the harm was never
 * ink-specific; ink was simply last in the sentence.
 *
 * A word-boundary cut (`cleanFreeText`) makes the remainder READABLE and still
 * loses everything past the bound. So an overflowing reply is asked ONCE to say
 * the same facts shorter, which is the echo-pass shape this product already
 * runs, on the overflowing population only.
 *
 * # THREE THINGS IT MAY NOT DO
 *
 *   invent      it is handed the model's OWN sentence and asked to compress it,
 *               never the brief — a re-read of the brief is a second
 *               interpretation and would need the whole containment apparatus
 *   be trusted  the answer is LENGTH-CHECKED. Still over, and the
 *               word-boundary cut applies and the counter says `reaskFailed` —
 *               a re-ask that quietly returns something longer would be the
 *               original defect with an extra call billed for it
 *   loop        one attempt. A stochastic failure repeated without bound is how
 *               a bad day at the provider becomes an unbounded spend
 */
const NOTES_COMPRESSION_SYSTEM = `You shorten one sentence of casting notes so it fits a hard limit.

You are given a CHARACTER DETAIL line written for an image model. It is too
long. Rewrite it shorter.

KEEP EVERY CONCRETE, VISIBLE FACT — every colour, every body part, every
garment, every marking, every hairstyle, every accessory. If the line says
tattoos on the chest and arms, the short version still says tattoos on the chest
and arms.

DROP ONLY FILLER — intensifiers ("extremely", "subtly", "exceptionally"),
restatements, and any word that describes a mood rather than a thing you could
photograph.

Reply with the shortened line and NOTHING else. No quotes, no preamble, no
JSON.`;

/**
 * The shortened line, or `null` when the re-ask cannot help.
 *
 * Null on every failure — no engine, a throw, an empty answer, or an answer
 * that is not actually shorter — because every one of them means the caller
 * should keep the word-boundary cut it already has.
 */
export async function compressCharacterNotes(input: {
  notes: string;
  max: number;
  engine: TextEngine;
  signal?: AbortSignal;
}): Promise<string | null> {
  try {
    const result = await input.engine.complete({
      about: "interpret",
      system: NOTES_COMPRESSION_SYSTEM,
      user: `Limit: ${input.max} characters.\n\nCHARACTER DETAIL:\n${input.notes}`,
      /* Extraction, not authorship — the same temperature the interpretation
         itself runs at, for the same reason. */
      temperature: 0.2,
      /* One short line. Generous against the bound rather than equal to it, so
         a reply that overruns is REFUSED by the length check below rather than
         cut off by the transport and refused as unreadable. */
      maxOutputTokens: 400,
      signal: input.signal,
    });
    const said = result.text.trim().replace(/^["'\u201c\u2018]|["'\u201d\u2019]$/g, "").trim();
    if (said === "") return null;
    /* Not trusted: an answer that is longer than what it was given has done the
       opposite of the job, and adopting it would be worse than the cut. */
    if (said.length >= input.notes.length) return null;
    return said;
  } catch {
    /* A compression that fails is not a roll that fails. The caller has a
       readable cut in hand and the customer has a sheet coming. */
    return null;
  }
}

export async function interpretBrief(input: {
  briefText: string;
  engine?: TextEngine;
  signal?: AbortSignal;
  /**
   * Ask for a wardrobe pick as well — the Wardrobe path's case (b), §4.
   *
   * Absent means no, and no means the prompt is the one every account has been
   * getting. See `WARDROBE_BLOCK` for why this is a flag rather than a
   * permanent addition.
   */
  wardrobe?: boolean;
  /**
   * Ask about tattoos the brief described — 7b(a), inside
   * `CASTING_BORN_INK_SCOPE`.
   *
   * Absent means no, and no means the prompt is the one every account has been
   * getting. See `BORN_INK_BLOCK` for why this is a flag rather than a
   * permanent addition — it is `WARDROBE_BLOCK`'s argument and the same
   * measurement.
   */
  ink?: boolean;
  /**
   * READ THE BRIEF WITHOUT RATIONING IT — inside `CASTING_BRIEF_FIDELITY_SCOPE`.
   *
   * Absent means no, and no means the bytes on the wire are byte-identical to
   * today's: the announced cap stands, the reply is bounded at `NOTES_MAX`, and
   * nothing about this call moves. On, the cap sentence is swapped
   * (`interpreterSystemPrompt`) and the bound becomes `NOTES_MAX_FIDELITY`.
   *
   * The two travel TOGETHER and that is the whole point of the flag being one
   * boolean rather than two: a raised announcement with the old bound is
   * measurably WORSE than neither — the model says everything and the guillotine
   * takes it, which the budget court watched happen 3 drives out of 3.
   */
  fidelity?: boolean;
  /**
   * ASK THE FOUR-VALUED SUBJECT QUESTION — the author road (#131 slice C).
   *
   * Absent means no, and no means the cohort question and the wall it feeds
   * are today's to the byte. On, the same slot asks `photoreal_human` /
   * `being` / `likeness` / `not_a_being` (`SUBJECT_INSTRUCTION`), a `being`
   * is cast, and the two refusals the ruling keeps come back by name.
   */
  author?: boolean;
}): Promise<InterpretOutcome> {
  const notesMax = input.fidelity === true ? NOTES_MAX_FIDELITY : NOTES_MAX;
  const textEngine = input.engine ?? interpreterEngine();
  if (!textEngine) {
    log.warn({}, "[interpreter] no OPENROUTER_API_KEY — the brief cannot be read");
    return { ok: false, reason: "unavailable", latencyMs: 0, cause: "unconfigured" };
  }

  const startedAt = Date.now();
  /** One sampling of the interpreter. Named so the retry can repeat it exactly. */
  const runOnce = () =>
    textEngine.complete({
      about: "interpret",
      system: interpreterSystemPrompt({
        wardrobe: input.wardrobe === true,
        ink: input.ink === true,
        fidelity: input.fidelity === true,
        author: input.author === true,
      }),
      user: input.briefText,
      json: true,
      // Low, because this is extraction. Creativity belongs downstream, in the
      // adapter's variation axes and in the image model itself.
      temperature: 0.2,
      /*
        Headroom, deliberately generous. The eight `reads` labels roughly
        doubled the reply length, and at 500 the JSON began truncating
        mid-object on longer briefs — which does not degrade to "no reads", it
        fails the whole parse and drops the intent to `unavailable`. A brief
        that interpreted fine yesterday silently lost every one of its locks.
        The cost of the extra ceiling is a fraction of a cent; the cost of
        truncation is the user's stated facts.

        Raised 1200 → 1800 when `composedDirection` landed. The A/B measured
        HALF of the Margiela samples failing to parse on the new prompt against
        none on the old — the extra thesis-and-avoid pushes a reply that also
        carries eight `reads` past the old ceiling. Same lesson as the 500, one
        field later: a truncated reply does not degrade to a missing field, it
        fails the whole parse and drops every lock the brief stated.

        **Raised 1800 → 5000 on 2026-08-03, and this one was MEASURED BEFORE it
        shipped rather than after a silent loss.** Every previous raise was
        reactive; `scripts/measure-role-null.mts` was pointed at the ceiling
        instead, and found it still biting hard on the briefs that produce the
        most content:

          "a 30 year old heavy metal bogan", n=40 at 1800:
            truncated on the first attempt  10/40 (25%)
            compile FELL BACK                2/40 (5%)   <- every lock lost
            latency p50/p95                  19.5s / 44.0s

          the same brief, n=40 at 5000:
            truncated on the first attempt   0/40 (0%)
            compile fell back                0/40 (0%)
            latency p50/p95                  21.4s / 28.0s

        One in twenty of those rolls was being cast from the raw sentence with
        every stated fact gone, on a paid roll, silently — D-83's retry was
        catching the rest and hiding how close the class still was. The screen
        showed the same bite at 25% on "a Margiela runway face" and 10% on the
        miu miu brief, and 0% on the six plainer briefs, so it is the
        content-heavy replies that overrun.

        **p95 latency IMPROVED**, because a retry is a whole second round trip:
        the tight ceiling was costing time as well as locks. And the ceiling is
        a CAP, not a reservation — an unused token is not billed — so the
        headroom is free. There is no reason to keep this number close.
      */
      maxOutputTokens: 5000,
      signal: input.signal,
      timeoutMs: INTERPRET_TIMEOUT_MS,
      retries: INTERPRET_RETRIES,
    });

  try {
    const result = await runOnce();
    const parseOptions = { author: input.author === true };
    let parsed = parseCastingIntent(result.text, input.briefText, notesMax, parseOptions);
    recordParseOutcome(!parsed.ok, result.truncated === true);

    /*
      A REPLY CUT OFF FOR LENGTH IS TRANSPORT, NOT A VERDICT.

      This is the gravest class in the subsystem wearing a transport costume:
      the fragment fails the parse, the compiler falls back, and the sheet is
      cast as though the brief had said nothing — losing the sex, the age, the
      heritage the user actually typed. Silently, and identically to a genuine
      "the model returned nonsense".

      So it is retried once as the transport failure it is, rather than
      swallowed. A truncated interpretation can never masquerade as an honest
      null.
    */
    if (!parsed.ok && result.truncated) {
      log.warn(
        { latencyMs: result.latencyMs },
        "[interpreter] reply was CUT OFF at the token ceiling — retrying rather than dropping the brief's locks",
      );
      const retry = await runOnce();
      const reparsed = parseCastingIntent(retry.text, input.briefText, notesMax, parseOptions);
      recordParseOutcome(!reparsed.ok, retry.truncated === true);
      if (reparsed.ok) {
        return {
          ok: true,
          intent: reparsed.intent,
          subject: reparsed.subject,
          latencyMs: result.latencyMs + retry.latencyMs,
          model: retry.provenance.servedModel ?? retry.provenance.model,
        };
      }
    }

    if (!parsed.ok) {
      /*
        ⚠ **ASK TWICE BEFORE YOU WALL** — the cohort wall's double check
        (`CASTING_V2_COHORT_WALL_DOUBLE_CHECK_DESIGN.md`, ordered fable-1588
        from a live founder walling, built fable-1602 ruling 2 after its own
        court closed).

        The wall's answer is a MODEL'S JUDGEMENT taken once and acted on as
        though it were a fact about the brief. Measured on the founder's own
        553-character cybernetics brief — a photographable person, nobody in
        particular, with surgically integrated implants:

          8 refusals in 27 pooled drives (~30%) across three instruments,
          two of which were looking for something else entirely

        And measured on the mechanism this line is:

          3 of 3 refusals PASSED on an immediate second read
          2 of 2 named-character asks refused BOTH reads, twice

        **So the two reads are not locked together and the second one is a
        genuinely independent draw** — the independence the arithmetic assumes,
        tested rather than inherited, which is the only evidence anyone has for
        it.

        # THREE THINGS IT MAY NOT DO

          loop      ONE extra read. A stochastic failure repeated without bound
                    is how a bad day at the provider becomes an unbounded spend
                    — the aesthetic retry's own sentence, unchanged
          soften    the second ask is the SAME ask. A nudge would not be a
                    second opinion, it would be arguing the model out of a
                    refusal, and it would weaken the wall on exactly the briefs
                    the wall is right about
          open      anything other than a clean second intent still WALLS.
                    Fail-closed, unchanged
      */
      /*
        Since #131 slice C the wall has three names on the author road
        (`likeness`, `not_a_being`) and one off it (`unsupported_cohort`); all
        of them are a MODEL'S JUDGEMENT and all of them get the second read.
        `unreadable` is not a judgement and never did.
      */
      if (parsed.reason !== "unreadable") {
        const second = await runOnce();
        const reread = parseCastingIntent(second.text, input.briefText, notesMax, parseOptions);
        const rescued = reread.ok;
        /*
          COUNTED WHATEVER HAPPENS, because the absence of a count is what let
          this hide. Nothing in the product has ever recorded this wall firing:
          the refusal is thrown before a roll row exists, so there is no row, no
          operation and no ledger entry — only this line. One string, so the
          rate is one grep.
        */
        log.warn(
          {
            reason: COHORT_WALL_RETRIED,
            outcome: rescued ? "rescued" : "walled",
            firstLatencyMs: result.latencyMs,
            secondLatencyMs: second.latencyMs,
          },
          rescued
            ? "[interpreter] cohortWallRetried — the second read cast it; the first refusal was a wobble"
            : "[interpreter] cohortWallRetried — both reads refused, and the brief is walled",
        );
        if (!reread.ok) return { ok: false, reason: reread.reason === "unreadable" ? parsed.reason : reread.reason };
        parsed = reread;
      }
    }

    if (!parsed.ok) {
      log.warn(
        { latencyMs: result.latencyMs, truncated: result.truncated === true },
        "[interpreter] reply could not be read as an intent — falling back",
      );
      return { ok: false, reason: "unavailable", latencyMs: result.latencyMs, cause: "unparsed" };
    }

    /*
      M3 condition 4 closed. The report could not evaluate §E.1's "+5s median"
      budget because the harness recorded image latency only, and said so:
      "Recording per-call text latency is a one-line harness change for the
      next run." This is that line, in the product rather than the harness, so
      the treatment stage's cost is measurable the day it lands.
    */
    log.info(
      { stage: "interpreter", latencyMs: result.latencyMs, model: result.provenance.servedModel },
      "[interpreter] brief interpreted",
    );

    /*
      THE AESTHETIC-REFERENCE RETRY.

      Narrow, provable, and it can never fire on a true null — the role-repair
      pattern. The condition is: the brief contains a LISTED FASHION TOKEN, and
      the interpretation landed the aesthetic nowhere at all. A brand token in
      the sentence is proof the user named a reference, so "all three null" is
      demonstrably a miss rather than an honest silence.

      One re-sample, never a loop. The failure is stochastic — measured at
      roughly one run in three — so a single retry collapses it without turning
      a bad day at the provider into an unbounded spend.

      GENERAL references get the same promise tier as fashion ones, and the
      former named limit is closed. The detector is LISTLESS: a proper-noun
      shape none of our vocabularies claims, plus the fashion tokens for the
      lowercase case. So "a Wes Anderson casting" is repaired exactly as "a miu
      miu campaign model" is, and no film or culture list exists — or is
      wanted.
    */
    let intent = parsed.intent;
    /* The subject travels WITH the intent that ships: a re-ask that replaces the intent replaces this too (review of #136, finding 2). */
    let subject = parsed.subject;

    /*
      ⚠ THE DETAIL DID NOT FIT — compress it rather than let the cap eat it
      (ruled fable-1415 (c); the finding is `NOTES_OVERFLOW`'s docblock).

      About 2% of rolls with notes reach here, measured across production's 96.
      What they lost was never noise: rolls 128 and 129 lost their entire ink
      description and part of their hair, and the only symptom anyone saw was
      eight masters with no tattoos.

      The COUNT fires whatever happens, because it is the thing whose absence
      let this hide — one line per overflowing roll, saying how much overran and
      what became of it.

      The re-ask is handed the model's OWN sentence, never the brief: re-reading
      the brief would be a second interpretation and would need the containment
      apparatus the first one has. Its answer is length-checked and adopted only
      if it is genuinely shorter and still parses to something; on any failure
      the word-boundary cut already in `intent` stands, which is today's
      behaviour made readable.
    */
    if (parsed.notes.overflow > 0) {
      const raw = parsed.notes.raw;
      const compressed = raw === null
        ? null
        : await compressCharacterNotes({
          notes: raw, max: notesMax, engine: textEngine, signal: input.signal,
        });
      const fitted = compressed === null ? null : cleanCharacterNotes(compressed, notesMax);
      const kept = fitted !== null && freeTextOverflow(compressed ?? "", notesMax) === 0;
      if (kept) intent = { ...intent, characterNotes: fitted };
      log.warn(
        {
          reason: NOTES_OVERFLOW,
          over: parsed.notes.overflow,
          limit: notesMax,
          reaskRan: raw !== null,
          outcome: kept ? "compressed" : "reaskFailed",
          detail: intent.characterNotes,
        },
        kept
          ? "[interpreter] notesOverflow — the character detail did not fit and was compressed to fit"
          : "[interpreter] notesOverflow — the character detail did not fit and was CUT at a word boundary",
      );
    }

    /*
      A CATEGORY THE MODEL FOUND AND DID NOT NAME — asked once more.

      Same shape as the aesthetic retry below it and for the same reason: one
      more sample of the SAME interpretation, never a differently-worded second
      question. That is what makes it unable to invent — if the model names no
      category the second time either, nothing changes and the sheet compiles
      exactly as it would have.

      ⚠ ONLY THE ROLE IS ADOPTED, never the whole reparsed intent. The first
      parse's other facts are the ones the customer's brief was read for, and on
      a rich brief that is a great many of them; replacing all of them to
      recover one field would put fourteen facts at risk to rescue a category.
      The aesthetic retry adopts wholesale because its subject IS the whole
      aesthetic; this one has a single subject.
    */
    if (needsRoleRetry(intent, parsed.notes.raw)) {
      roleStats.nullOnCompile += 1;
      roleStats.reaskRan += 1;
      const retry = await runOnce();
      const reparsed = parseCastingIntent(retry.text, input.briefText, notesMax, parseOptions);
      recordParseOutcome(!reparsed.ok, retry.truncated === true);
      const rescuedRole = reparsed.ok ? reparsed.intent.role : null;
      if (rescuedRole !== null) {
        intent = { ...intent, role: rescuedRole };
        roleStats.rescued += 1;
      }
      log.info(
        {
          stage: "interpreter",
          reason: "roleNull",
          rawNotesChars: parsed.notes.raw?.length ?? 0,
          outcome: rescuedRole === null ? "stillNull" : "rescued",
          role: rescuedRole,
          nullOnCompile: roleStats.nullOnCompile,
          rescued: roleStats.rescued,
        },
        rescuedRole === null
          ? "[interpreter] roleNull — a rich brief named no category, and the re-ask agreed; the sheet compiles without a CASTING CATEGORY block"
          : "[interpreter] roleNull — a rich brief named no category and the re-ask recovered one",
      );
    }

    if (needsAestheticRetry(input.briefText, intent)) {
      log.info({ stage: "interpreter" }, "[interpreter] aesthetic reference landed nowhere — re-sampling once");
      const retry = await runOnce();
      const reparsed = parseCastingIntent(retry.text, input.briefText, notesMax, parseOptions);
      // Counted like any other attempt. A denominator that skips the retries
      // is a rate nobody can act on — this one keeps the same brief's second
      // reply in the same window as its first.
      recordParseOutcome(!reparsed.ok, retry.truncated === true);
      if (reparsed.ok && !needsAestheticRetry(input.briefText, reparsed.intent)) {
        intent = reparsed.intent;
        subject = reparsed.subject;
      }
    }

    return {
      ok: true,
      intent,
      subject,
      latencyMs: result.latencyMs,
      model: result.provenance.servedModel ?? result.provenance.model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    log.warn({ err: error, latencyMs }, "[interpreter] unavailable — the brief was not read");
    return { ok: false, reason: "unavailable", latencyMs, cause: "thrown" };
  }
}

export { SYSTEM_PROMPT as INTERPRETER_SYSTEM_PROMPT };

/**
 * GENERATED CHIPS — a few directions in the brief's own world, beside the box
 * (#535 decision 12, verbatim: *"Generated chips replace the legacy look
 * list. At roll time the author also returns a few directions per OPEN axis,
 * in the brief's own register, as qualities; stored on the roll; tapping one
 * writes the phrase into the dock box. Fact chips (sex, age band, kind) stay
 * a FIXED vocabulary because they are the studio's checkable reading. A brief
 * that pins everything shows no taste chips."*).
 *
 * # The defect it answers, in his own words
 *
 * Crew reply #144, on a sheet of eight ogres: *"The chip options come from
 * the old lists ("slim build" offered on an ogre) and the edit gets tacked
 * onto the end of the prompt instead of rewritten into it."* Both halves are
 * fixed by different code: the OFFER is this module (it is written from her
 * brief, so an ogre is never offered a body word off a six-item list), and
 * the EDIT lands through the Re-imagine fold (`reimagine.ts`, `direction`),
 * which rewrites the brief with the direction inside it rather than appending
 * a sentence to its end.
 *
 * # What a chip is
 *
 * A short fragment — two to eight words — naming something the brief LEFT
 * OPEN, in the register the brief is already written in. Not an instruction,
 * not a piece, not a colour, not a light. On *"an ogre chieftain in his
 * 50s"*: *"weathered by a hard country"*, *"gear of old iron and hide"*.
 *
 * # Why it is a list of strings and nothing else
 *
 * The axis a chip came from is the machinery, and naming it on the surface
 * would be the disappearing-technology law failing in the small (a customer
 * reading "BEARING · weathered by a hard country" has been handed our
 * vocabulary to learn). The instruction uses open axes to get SPREAD — a
 * generator asked for four directions without them writes four about the
 * face — and the axis stays inside the instruction, where it belongs.
 *
 * # Zero chips is a state, not a failure
 *
 * His own sentence: *"A brief that pins everything shows no taste chips."*
 * So an empty list is correct, and the surface draws nothing rather than
 * apologising. A refusal, an outage and a genuinely pinned brief all read the
 * same way to the customer — nothing to tap — because their next act is
 * identical in all three.
 */
import type { TextEngine } from "../providers/types";
import { INTERPRET_TIMEOUT_MS } from "./interpreter";
import { createModuleLogger } from "../logging/logger";
import { containsHouseSentence } from "./houseBlock";
import { countWords, neverWrittenIn, pieceNounIn, skinContradictionIn } from "./promptAuthor";
import {
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "../../shared/castingVocabularies";
import { ageClaimsIn, ageContradictionIn, saysSex } from "./seedFidelity";
import { speciesGroupsIn } from "./reimagine";

const log = createModuleLogger("briefChips");

/** How many survive to the surface. Four is his "a few" and two rows at dock width. */
export const BRIEF_CHIPS_MAX = 4;
/**
 * A chip is a fragment. Ten words is the BACKSTOP; the instruction asks for
 * two to six, and the measured drive lands at four to six.
 *
 * ⚠ It was eight until it was driven (law 6), and eight threw away *"a calm
 * that settles a room before he speaks"* — nine words, on his ogre, and the
 * best line of that list. A ceiling one word above the design's own ask is a
 * ceiling that spends good work on a boundary nobody chose.
 */
export const BRIEF_CHIP_MAX_WORDS = 10;
/** Output budget — small, but reasoning tokens count against it like everywhere else on this road. */
export const BRIEF_CHIPS_MAX_OUTPUT_TOKENS = 2000;

/**
 * Words a chip may never carry, on top of the guards it shares with the
 * author road. Its job is the gap `containsHouseSentence` cannot cover: that
 * guard reads for the studio's own SENTENCES, and a bare two-word fragment
 * ("warm backlight") is not one of them while being exactly the thing
 * decision 7 bans — and an authored lighting clause can out-argue the house
 * block's AUTHORITY line, which is measured (#327), not theoretical.
 *
 * ⚠ **IT WAS TWICE THIS SIZE UNTIL IT WAS DRIVEN, AND THE TYPO-GATE CLASS
 * CAUGHT IT IN ONE RUN** (law 6, on the five briefs of #535 §7). The first
 * draft banned bare `light`, `lit`, `shadow`, `shot`, `set`, `framed` and
 * `crop`, and the drive refused *"hair cropped brutally short, self-cut"* on
 * his cyborg — while **his own standing test brief says *"close-cropped
 * hair"***. Every one of those words is ordinary casting prose: a set jaw,
 * shadows under the eyes, a light step, status lights, shot through with old
 * wounds. A guard that owns a real word costs the feature its best lines, and
 * this repo has been bitten by exactly that five times.
 *
 * What is left is words with no second sense in a sentence about a PERSON.
 * Lighting is caught by SHAPE instead (`CHIP_LIGHTING_SHAPES`), which is what
 * "lit from below" actually looks like and what "three small red status
 * lights" does not.
 */
export const CHIP_BANNED_WORDS = [
  "lighting",
  "backlight",
  "backlighting",
  "backlit",
  "camera",
  "lens",
  "framing",
  "backdrop",
  "background",
  "scene",
  "studio",
  "portrait",
  "photo",
  "photograph",
  "bokeh",
  "vignette",
  "exposure",
  "pose",
  "posed",
] as const;

/**
 * Lighting as a SHAPE rather than as a word — *"lit from below"*, *"a soft
 * key light"* — so the ban survives without owning `light` itself.
 *
 * The declared limit: a lighting clause phrased in some way none of these
 * match gets through to a box the customer reads, where the worst case is one
 * odd suggestion they do not tap. The instruction bans it too; this is the
 * backstop, not the mechanism.
 */
export const CHIP_LIGHTING_SHAPES: readonly RegExp[] = [
  /(^|[^a-z])lit (from|by|against|in)(?![a-z])/,
  /(^|[^a-z])(soft|hard|harsh|warm|cool|dim|low|rim|key|side|top|back|golden|natural|studio) light(ing|s)?(?![a-z])/,
  /(^|[^a-z])(light|lighting) (falls|catches|rakes|pools|spills)(?![a-z])/,
];

/**
 * THE OLD LISTS THEMSELVES, DERIVED — his defect's own source (Crew reply
 * #144: *"The chip options come from the old lists ("slim build" offered on
 * an ogre)"*).
 *
 * ⚠ **Read out of `shared/castingVocabularies.ts`, never transcribed**
 * (working law 4). Decision 12's first sentence is *"Generated chips replace
 * the legacy look list"* — so a generated chip that IS a legacy list value is
 * the retired feature growing back, and the only honest way to check that is
 * to ask the retired lists themselves. A word added to `BUILDS` tomorrow is
 * covered here the same day with no edit.
 *
 * ⚠ **THE TEST IS "EVERY content word", NOT "any"** — and that is the whole
 * design of it. These lists hold ordinary register words ("quiet", "raw",
 * "warm", "broad"), so refusing on ANY of them would gut the feature: *"broad
 * through the shoulders"* and *"a quiet menace"* are exactly the chips this
 * is meant to produce. A fragment made of NOTHING but list words, though —
 * *"slim build"*, *"warm and open"* — has no brief in it at all, which is
 * what made his ogre's offer wrong. **The declared cost: two legacy words
 * joined by "and" is refused even when it reads well.** One suggestion, on a
 * list of four the customer never knew was coming.
 */
const LEGACY_VOCABULARY_WORDS: ReadonlySet<string> = new Set(
  [...BUILDS, ...ENERGY_KEYS, ...LOOK_KEYS, ...HERITAGES]
    .flatMap((value) => value.toLowerCase().split(/[^a-z]+/))
    .filter((word) => word.length > 2),
);

/**
 * The nouns those lists were labelled with on the sheet — the other half of
 * *"slim build"*. They name an AXIS rather than a person, which is the
 * machinery showing (the disappearing-technology law), so a chip is never
 * made of them either.
 */
const GENERIC_AXIS_NOUNS = [
  "build", "look", "looks", "presence", "energy", "heritage", "features", "feature",
  "vibe", "aesthetic", "style", "appearance", "physique", "frame", "body", "complexion",
  "disposition", "demeanour", "demeanor", "type",
] as const;

/**
 * Colours (decision 6, verbatim: *"No colours, positions, cuts, items or
 * sounds the customer didn't write"*), seed-exempt like every other word
 * guard on this road — a colour SHE wrote is hers, and a chip carrying it
 * back is echoing her, not inventing.
 *
 * Materials are deliberately absent: *"old iron and hide"* is what a chip
 * should say. It is the naming of a COLOUR that pins a pixel the customer
 * never asked for.
 */
export const CHIP_COLOUR_WORDS = [
  "black", "white", "grey", "gray", "red", "blue", "green", "yellow", "orange",
  "purple", "violet", "pink", "brown", "blonde", "blond", "ginger", "auburn",
  "silver", "gold", "golden", "copper", "bronze", "crimson", "scarlet", "teal",
  "turquoise", "amber", "ivory", "jade", "emerald", "sapphire", "ruby", "olive",
] as const;

/** Instruction shapes — a chip is a quality the customer adopts, never an order they read. */
const CHIP_IMPERATIVE = /^(make|give|turn|add|show|put|set|keep|use|try)\b/i;

/** Whole-word presence, the fidelity module's own boundary shape. */
function saysWord(lower: string, word: string): boolean {
  return new RegExp(`(^|[^a-z])${word}(?![a-z'’])`).test(lower);
}

/*
  Words too common to prove a chip is repeating the brief. Deliberately tiny:
  it exists to stop "of", "and" and "a" from making every chip look like a
  repeat, not to model English.
*/
const CHIP_STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "her", "his", "in", "into", "is", "it",
  "its", "of", "on", "or", "that", "the", "their", "them", "they", "to", "with", "who",
]);

/**
 * Does this chip only tell her what she already said?
 *
 * His named defect is the studio not having read the customer, and the
 * loudest form of it is offering back her own words. Two shapes count: the
 * chip appears verbatim inside the brief, or every content word of it does.
 * A chip sharing ONE content word with the brief is not a repeat — *"gear of
 * old iron and hide"* on a brief that says "gear" is doing its job.
 */
export function chipRepeatsBrief(chip: string, briefText: string): boolean {
  const lowerBrief = briefText.toLowerCase().replace(/\s+/g, " ");
  const lowerChip = chip.toLowerCase().replace(/\s+/g, " ").trim();
  if (lowerChip.length === 0) return true;
  if (lowerBrief.includes(lowerChip)) return true;
  const content = contentWordsOf(chip);
  if (content.length === 0) return false;
  return content.every((word) => saysWord(lowerBrief, word));
}

/** The words a chip is actually made of — no punctuation, no stopwords, nothing under three letters. */
function contentWordsOf(chip: string): string[] {
  return chip
    .toLowerCase()
    .split(/[^a-z'’-]+/)
    .flatMap((word) => word.split("-"))
    .filter((word) => word.length > 2 && !CHIP_STOPWORDS.has(word));
}

/**
 * Is this chip made of NOTHING but the retired lists and their axis nouns —
 * *"slim build"* on an ogre, and every sibling of it?
 */
export function chipIsOffTheOldLists(chip: string): boolean {
  const content = contentWordsOf(chip);
  if (content.length === 0) return false;
  return content.every(
    (word) =>
      LEGACY_VOCABULARY_WORDS.has(word) ||
      (GENERIC_AXIS_NOUNS as readonly string[]).includes(word),
  );
}

/**
 * Why one chip is dropped, or null when it may stand.
 *
 * Per-chip rather than per-list on purpose: three good directions and one bad
 * one is a list of three, and throwing the good ones away to punish the bad
 * one would cost the customer the feature over a word.
 */
export function chipRefusal(chip: string, briefText: string): string | null {
  const trimmed = chip.trim();
  if (trimmed.length === 0) return "empty";
  const words = countWords(trimmed);
  if (words < 2) return "a single word is a label, not a direction";
  if (words > BRIEF_CHIP_MAX_WORDS) return `${words} words — a chip is a fragment`;
  if (CHIP_IMPERATIVE.test(trimmed)) return "an instruction, not a quality";
  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
  const banned = CHIP_BANNED_WORDS.find((word) => saysWord(lower, word));
  if (banned) return `"${banned}" — the studio owns the camera and the room`;
  if (CHIP_LIGHTING_SHAPES.some((shape) => shape.test(lower))) {
    return "lighting — the studio owns the camera and the room";
  }
  if (chipIsOffTheOldLists(trimmed)) return "a fragment off the old lists, not out of the brief";
  const lowerBrief = briefText.toLowerCase().replace(/\s+/g, " ");
  const colour = CHIP_COLOUR_WORDS.find(
    (word) => saysWord(lower, word) && !saysWord(lowerBrief, word),
  );
  if (colour) return `"${colour}" pins a colour the brief never asked for`;
  const forbidden = neverWrittenIn(trimmed, briefText);
  if (forbidden) return `"${forbidden}" is never sent`;
  if (containsHouseSentence(trimmed)) return "studio language";
  const skin = skinContradictionIn(trimmed, briefText);
  if (skin) return `"${skin}" fights the studio's realism rules`;
  const piece = pieceNounIn(trimmed, briefText);
  if (piece) return `"${piece}" is a piece, not a quality`;
  /*
    THE LOCKED TRIO IS THE CUSTOMER'S TO TYPE, so a chip may not claim one
    SHE DID NOT. Decision 12 keeps the fact chips (sex, age band, kind) a
    FIXED vocabulary precisely because they are the studio's checkable
    reading — a generated chip that quietly ages or re-species the subject
    would be writing into the one place the customer owns.

    ⚠ **Seed-exempt, like every other word guard on this road, and it is
    load-bearing rather than tidy** — driven before it was written: without
    the exemption, `saysSex` reads the *"he"* in *"scars he never explains"*
    as a claim, so the guard meant to protect his ogre refused the best chip
    written for him. A chip in a brief's own register uses that brief's own
    pronouns; what must not happen is a chip introducing a fact the brief
    never carried.
  */
  const briefBands = ageClaimsIn(briefText);
  const strayBand = ageClaimsIn(trimmed).find((band) => !briefBands.includes(band));
  if (strayBand !== undefined) return "claims an age";
  /*
    And the youth words, through `seedFidelity.ts`'s own reader rather than a
    second copy of it (working law 4, the same call `reimagineRefusal` makes):
    *"still young enough to prove it"* claims no BAND and moves the age of a
    brief that stated one. Only when the brief pinned exactly one band — with
    two, there is nothing single to contradict.

    ⚠ **Declared limit, pinned in the suite: `ageClaimsIn` reads "in his
    twenties" and not "barely into his twenties".** A bare unreadable shape
    is a floor here exactly as the species check is, and it falls the safe
    way — the chip lands in a box the customer reads and can undo.
  */
  const uniqueBands = Array.from(new Set(briefBands));
  if (uniqueBands.length === 1) {
    const moved = ageContradictionIn(trimmed, { band: uniqueBands[0], phase: null });
    if (moved && !saysWord(briefText.toLowerCase().replace(/\s+/g, " "), moved.toLowerCase())) {
      return "claims an age";
    }
  }
  const straySex = SEXES.find((sex) => saysSex(trimmed, sex) && !saysSex(briefText, sex));
  if (straySex !== undefined) return "claims a sex";
  const briefSpecies = speciesGroupsIn(briefText);
  const strayKind = speciesGroupsIn(trimmed).find((group) => !briefSpecies.includes(group));
  if (strayKind !== undefined) return "claims a species";
  if (chipRepeatsBrief(trimmed, briefText)) return "already in the brief";
  return null;
}

/**
 * Strip what a model puts around a line it was asked to give bare — a bullet,
 * a number, a quote, a trailing full stop.
 *
 * Normalising rather than refusing: a good direction wearing a hyphen is a
 * good direction, and refusing it would spend the customer's list on our
 * formatting preference.
 */
export function normalizeChip(raw: string): string {
  return raw
    .replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .trim();
}

/**
 * The instruction. Same shape as the author's own (`reimagine.ts`): name the
 * rule, then SHOW the miss — his named defect is in it by name, because an
 * instruction that shows what "slim build on an ogre" was wrong about is the
 * one a model follows.
 */
export function briefChipsSystemPrompt(): string {
  return [
    "You are the writing assistant of a casting studio. Below is a customer's own casting brief.",
    "",
    "Offer a few SHORT DIRECTIONS they might take it further in — things they have NOT said, each written in the brief's own register and world. Tapping one writes it into their brief, so each must read as though the person who wrote the brief wrote it.",
    "",
    "THE RULES:",
    "- Each direction is about a DIFFERENT open aspect of the person — their bearing, what their life has done to them, what their gear or clothing is MADE OF, their grooming world, the energy they carry. Never two about the same aspect.",
    "- Only what the brief LEAVES OPEN. Never offer a direction about something the brief already pins. That is the worst failure here: the customer reads it as the studio not having read them.",
    "- QUALITIES, NEVER PIECES. Say what something is made of and what it feels like. Never a specific garment, cut, hairstyle, jewellery piece, colour or item.",
    "- Never lighting, camera, lens, framing, crop, backdrop, background, scene, props or story-setting. The studio owns those.",
    "- Never their sex, their age or what kind of being they are — those are the customer's to type.",
    /*
      His decision 6 bans "sounds"; a smell belongs to the same family and the
      drive produced one ("scent of clean sweat and menthol"). A picture cannot
      carry it, so it is a suggestion that changes nothing — instruction only,
      deliberately not a word guard: `scent`, `sound` and `taste` all have
      second senses in a sentence about a person, and this repo has been bitten
      five times by a guard that owns a real word.
    */
    "- Never a smell, a sound or a taste. The picture cannot carry them, so a direction made of one changes nothing.",
    "- Two to six words each. A fragment, not a sentence and not an order: write \"salt-cured and slow to anger\", never \"make him salt-cured\". No full stop, no quotes.",
    "- If the brief already pins everything worth pinning, return NOTHING AT ALL.",
    "",
    /*
      ⚠ THE WORKED EXAMPLE IS DELIBERATELY NOT AN OGRE, and it was changed to
      this after the first live drive (law 6). With an ogre example in the
      instruction, an ogre BRIEF came back with the example's four lines
      almost verbatim — the instruction leaking rather than the generator
      working, and invisible on any brief except the one that matters, since
      an ogre is the subject of the very defect this feature answers.
    */
    "Worked example. Brief: \"a lighthouse keeper in her 60s\"",
    "salt-cured and slow to alarm",
    "clothing of oiled wool and old rubber",
    "hands ruined by rope and weather",
    "a quiet that comes from long silences",
    "",
    "Those are that keeper's own world. \"slim build\" would not be — a body word off a generic list, and it is what an ogre was once offered. Neither would \"blue eyes\": it pins a colour the brief never asked about.",
    "",
    `Output one direction per line and nothing else. No numbering, no bullets, no heading, no commentary. At most ${BRIEF_CHIPS_MAX} lines.`,
  ].join("\n");
}

/** What a generation returns. `chips` may be empty — his "a brief that pins everything shows no taste chips". */
export type BriefChipsOutcome = {
  chips: string[];
  /** Log-only, like the author road's: the reasons each dropped chip was dropped. */
  dropped: string[];
  attempts: number;
  latencyMs: number | null;
  model: string | null;
};

const EMPTY: BriefChipsOutcome = { chips: [], dropped: [], attempts: 0, latencyMs: null, model: null };

/**
 * One generation. At most two text calls — a draft, and one re-ask when
 * nothing at all survived — then an empty list.
 *
 * Never throws: the caller is a free query behind a surface that draws
 * nothing when there is nothing, so an outage must read as a brief with no
 * directions rather than as a broken sheet.
 */
export async function briefChipsFor(input: {
  engine: TextEngine;
  briefText: string;
  signal?: AbortSignal;
}): Promise<BriefChipsOutcome> {
  const briefText = input.briefText.trim();
  if (briefText.length === 0) return EMPTY;
  const system = briefChipsSystemPrompt();
  let attempts = 0;
  let latencyMs: number | null = null;
  const dropped: string[] = [];

  const ask = (systemText: string, temperature: number) => {
    attempts += 1;
    /* `about: "author"` — this is the author road's own engine on its own
       errand, and a census pricing authored prose should count these with the
       presses beside them. */
    return input.engine.complete({
      about: "author",
      system: systemText,
      user: briefText,
      temperature,
      maxOutputTokens: BRIEF_CHIPS_MAX_OUTPUT_TOKENS,
      signal: input.signal,
      timeoutMs: INTERPRET_TIMEOUT_MS,
      retries: 0,
    });
  };

  const readReply = (raw: string): string[] => {
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
      const chip = normalizeChip(line);
      if (chip.length === 0) continue;
      const why = chipRefusal(chip, briefText);
      if (why) {
        dropped.push(`${chip} — ${why}`);
        continue;
      }
      const key = chip.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(chip);
      if (kept.length === BRIEF_CHIPS_MAX) break;
    }
    return kept;
  };

  try {
    const first = await ask(system, 0.8);
    latencyMs = first.latencyMs;
    let chips = readReply(first.text);
    let model = first.provenance.model;
    /*
      ONE re-ask, and only when NOTHING survived. A partial list is a good
      list — re-asking to top it up would spend a second call on a suggestion
      the customer never knew was missing. A list of zero, though, is either a
      brief that genuinely pins everything or a draft that broke every rule at
      once, and the second is worth one correction.
    */
    if (chips.length === 0 && dropped.length > 0) {
      const why = dropped.slice(0, BRIEF_CHIPS_MAX).join("; ");
      log.warn({ why }, "[briefChips] nothing survived — re-asking once");
      const second = await ask(
        `${system}\n\nYour previous directions were all rejected: ${why}\n\nWrite new ones that avoid exactly those faults.`,
        0.4,
      );
      latencyMs += second.latencyMs;
      model = second.provenance.model;
      chips = readReply(second.text);
    }
    return { chips, dropped, attempts, latencyMs, model };
  } catch (error) {
    log.warn({ error: String(error), attempts }, "[briefChips] the call failed — the brief shows no directions");
    return { chips: [], dropped, attempts, latencyMs, model: null };
  }
}

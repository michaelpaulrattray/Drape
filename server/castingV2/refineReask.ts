/**
 * When the product has to ask — and the two cases where it is allowed to
 * (D-178, D-179, D-180).
 *
 * # Asking is a failure mode, not a feature
 *
 * A product that asks often is a product that has not decided. So the re-ask
 * fires **rarely by construction**: history wins silently for an unqualified
 * colour, and only a genuine cold start or a genuine near-miss typo produces a
 * question. Everything else resolves without troubling anybody.
 *
 * # The two questions
 *
 * **Cold start (D-178).** "Pinker" with no colour-bearing edit in the session
 * has no referent. Guessing would be a rule's clothes on a coin toss, and
 * defaulting silently to makeup is what it used to do. So it asks — in their own
 * words, with the candidate facets as the answers.
 *
 * **Near-miss typo (D-179).** "Piink hair" files verbatim today and then costs
 * 25 credits to render something nobody asked for. Correcting it silently would
 * be the model authoring the record, which D-172 forbids. The third answer is to
 * ask, for free: *"Did you mean pink?"* — and the CONFIRMATION is what keeps
 * D-172 intact, because the user chose the word.
 *
 * # The form (D-180)
 *
 * An inline sentence with tappable chips, in the same conversational frame the
 * refusals and confessions already use. Never a modal, never a dialog, never an
 * error state — and **never a dead end**: the box is the interface, so typing
 * the answer resolves the question exactly as tapping it would.
 */
import { mentionsUpsweptAsk } from "./eyeShapeRouting";
import {
  HAIR_TAKES,
  asksAboutHair,
  hairTakeEntry,
  hairTakeNamedIn,
} from "./hairReferenceTake";
import { HAIR_COLOURS, type HairColour } from "../../shared/castingVocabularies";
import { EYE_COLOURS, type EyeColour } from "../../shared/castingRealization";
import { facetOfSubject, type Facet } from "./refineFacets";
import { FREE_SUBJECTS, FREE_SUBJECT_KEYS } from "./refineSubjects";
import { itemsOf, type RefineDelta } from "./refineDelta";
import { REFINABLE_AXES } from "./refineDelta";
import { facetOfAxis } from "./refineFacets";

/**
 * Every question this product can ask, ENUMERABLE.
 *
 * It was a union spelled inline on `Reask["kind"]`, which a suite cannot walk —
 * so the sweep that proves every question is answerable had nothing to sweep
 * over, and a question could join the family without one. A list, and the type
 * read off it (law 4): a new kind arrives in the sweep on the day it is
 * declared, or the sweep goes red for not covering it.
 */
export const REASK_KINDS = [
  "which-facet",
  "did-you-mean",
  "already-upswept",
  "glasses-hide-eyes",
  "same-again",
] as const;

export type ReaskKind = (typeof REASK_KINDS)[number];

/**
 * A question the product needs answered before it can act — and never a charge.
 *
 * `options` are the tappable chips; `resolves` is what a tap or a typed answer
 * turns into, so both routes end in the same instruction and neither is a
 * second implementation of the other.
 */
export type Reask = {
  kind: ReaskKind;
  /** The sentence, in their words. */
  question: string;
  options: Array<{ label: string; resolves: string }>;
  /**
   * THE SENTENCE THIS QUESTION IS ABOUT, when it is not the one they typed.
   *
   * A question travels back as `answering`, and the server re-derives what was
   * asked from it. That works while the question is ABOUT their sentence — a
   * typo, a colour with no referent. The same-again offer is about the sentence
   * that made the VERSION, which may be worded differently from the repeat that
   * raised it ("gold hoops please" against "give her gold hoop earrings"), and
   * a question that cannot be answered because the words drifted is the
   * dead-end D-180 forbids.
   *
   * So the question carries its own subject and the client echoes it back.
   * Absent means "the sentence they typed", which is every other question here.
   *
   * # AND IT IS ALSO THE QUESTION'S HANDLE — see {@link reaskHandle}
   *
   * A question raised on something the WORDS do not say — her glasses are over
   * her eyes; a model read a placement out of her sentence — cannot be rebuilt
   * by {@link pendingReaskFor}, which re-reads the words alone. Such a question
   * puts its own name in here, and the door in front of `pendingReaskFor`
   * rebuilds it by that name. Server-authored, echoed back verbatim, never
   * displayed.
   */
  about?: string;
};

/**
 * THE QUESTION'S OWN NAME, travelling in `about` — the answer path's handle
 * (found opus-827 §0, ruled fable-1120 §2).
 *
 * # The defect it closes, which was live
 *
 * The client submits a chip's LABEL, never its `resolves`. So the server has to
 * rebuild the outstanding question from `answering` and map that label back —
 * and `pendingReaskFor` rebuilds from the WORDS. Three of the four questions
 * are about the words and rebuild fine. `glasses-hide-eyes` is about the
 * PICTURE: the reading failed and there are frames over her eyes, and no amount
 * of re-reading her sentence recovers that. It rebuilt as nothing, so both its
 * chips ran as raw instructions — *"Take them off first"* with no referent for
 * *them*, and *"Go ahead anyway"* discarding her eye ask.
 *
 * Its sibling twenty lines above it in `refineService.ts` carries a comment
 * naming this exact defect as fixed. The class was named once and swept never;
 * this is the sweep (law 7).
 *
 * # Why a handle rather than re-running the gate
 *
 * Re-running it costs a segmenter read on a picture that may have changed, and
 * a second reading of an unstable instrument can disagree with the first — so
 * the question a customer is answering would not be the question she was
 * asked. The handle carries the DECISION rather than re-taking it, which is the
 * same-again precedent generalised: that offer is re-derived by comparing two
 * strings this server wrote.
 *
 * # What a forged handle buys, stated rather than implied
 *
 * Nothing. Every `resolves` reachable through this door is a sentence the
 * customer could have typed unaided — *"remove her glasses"*, her own sentence,
 * {@link LEAVE_AS_SHE_IS}. **`same-again` is deliberately NOT reachable through
 * it**: answering that offer sets `confirmedRegenerate`, which stands down
 * doors that exist to stop somebody paying for a render that changes nothing,
 * and a handle must never be the thing that turns a door off. It keeps its own
 * re-derivation, against the version's own `requestText`.
 */
const HANDLE = /^«([a-z-]+)»\s([\s\S]+)$/;

export function reaskHandle(kind: ReaskKind, asked: string): string {
  return `«${kind}» ${asked.trim()}`;
}

/**
 * The longest a handle's own prefix can be, DERIVED over the kinds.
 *
 * The wire caps `answering` and `instruction` at the same number, and `about`
 * defaults to the instruction — so a handle prefixed onto a full-length
 * sentence overflows the field the client echoes it in, and the ANSWER would be
 * refused by the schema. That is a worse dead end than the one this closes.
 *
 * So the allowance is derived here and spent at the door (`routes/castingV2.ts`),
 * and `refineReask.test.ts` asserts the derivation rather than the number: a
 * longer kind name moves the cap by existing.
 */
export const REASK_HANDLE_MAX_LENGTH = REASK_KINDS.reduce(
  (longest, kind) => Math.max(longest, reaskHandle(kind, "").length),
  0,
);

/**
 * The questions rebuilt BY NAME rather than from the words, and their builders.
 *
 * A map rather than a `switch` so the sweep can walk it, and deliberately not
 * total over {@link REASK_KINDS}: a question the words already rebuild does not
 * need a handle, and `same-again` must not have one (see above). The sweep
 * proves every kind is covered by one route or the other.
 */
const BY_HANDLE: Partial<Record<ReaskKind, (asked: string) => Reask>> = {
  "glasses-hide-eyes": (asked) => glassesHideEyesReask(asked),
};

/**
 * The question named in an `answering`, or `null` — positive admission against
 * the closed set.
 *
 * A name outside {@link BY_HANDLE} is not a handle, whatever it spells: the
 * sentence falls through to the word doors exactly as it does today, which is
 * the behaviour every caller had before this existed.
 */
export function reaskByHandle(answering: string): Reask | null {
  const match = HANDLE.exec(answering.trim());
  if (!match) return null;
  const build = BY_HANDLE[match[1] as ReaskKind];
  return build ? build(match[2]!) : null;
}

/**
 * Facets that can carry a colour — the candidates a cold-start question offers.
 *
 * Deliberately short. A question with seven answers is an interrogation; these
 * are the three places a colour word plausibly lands on a face.
 */
const COLOUR_BEARING: Array<{ facet: Facet; label: string }> = [
  { facet: facetOfSubject("hairShade"), label: "the hair" },
  { facet: facetOfSubject("eyeColourFree"), label: "the eyes" },
  { facet: facetOfAxis("makeup"), label: "makeup" },
];

/** Which facet a delta wrote that could carry a colour — the history D-178 uses. */
export function colourFacetOf(delta: RefineDelta | null | undefined): Facet | null {
  if (!delta) return null;
  for (const axis of REFINABLE_AXES) {
    if (delta[axis] == null) continue;
    const facet = facetOfAxis(axis);
    if (COLOUR_BEARING.some((entry) => entry.facet === facet)) return facet;
  }
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    if (itemsOf(value).length === 0) continue;
    const facet = facetOfSubject(subject as Parameters<typeof facetOfSubject>[0]);
    if (COLOUR_BEARING.some((entry) => entry.facet === facet)) return facet;
  }
  return null;
}

/** The label a facet answers to, for a question written in ordinary words. */
export function colourFacetLabel(facet: Facet): string {
  return COLOUR_BEARING.find((entry) => entry.facet === facet)?.label ?? facet;
}

/**
 * Colour words with nothing attached — the asks that need a referent (D-178).
 *
 * A comparative or a bare colour and no feature noun anywhere. "Pinker", "a bit
 * more pink", "lighter". If the sentence names a feature the question does not
 * arise, because they already said which part.
 */
const COLOUR_COMPARATIVES = [
  "lighter", "darker", "brighter", "warmer", "cooler", "deeper", "paler",
  "richer", "softer", "pastel", "muted",
];

/** Words that carry no referent themselves — verbs, articles, degree, politeness. */
const FILLER = [
  "a", "an", "the", "it", "its", "her", "his", "their", "them", "she", "he",
  "make", "makes", "made", "go", "get", "give", "do", "please", "pls", "can",
  "you", "u", "bit", "little", "more", "less", "much", "slightly", "way", "up",
  "down", "and", "but", "just", "some", "colour", "color", "shade", "tone",
  "hue", "tint", "on", "to", "of", "in", "at", "be", "is", "look", "looks",
];

/**
 * True when a colour ask has NOTHING in the sentence to attach itself to.
 *
 * The test is a residue: strike out the filler and the colour words, and if
 * anything at all is left standing then that word is the referent and this is
 * not the question's case. "Pinker" leaves nothing and earns the question;
 * "make the lighting warmer" leaves *lighting*, so it goes to the parser and
 * meets the stage wall it deserves rather than being asked about hair.
 */
export function needsColourReferent(instruction: string): boolean {
  const words = instruction.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const isColour = (word: string) => (KNOWN_COLOUR_WORDS as readonly string[]).includes(word)
    || COLOUR_COMPARATIVES.includes(word)
    || (word.endsWith("er") && (KNOWN_COLOUR_WORDS as readonly string[]).includes(word.slice(0, -2)));
  if (!words.some(isColour)) return false;
  return words.every((word) => isColour(word) || FILLER.includes(word));
}

/** The colour value a delta filed, wherever the model chose to put it. */
function colourValueOf(delta: RefineDelta): string | null {
  const free = delta.free ?? {};
  return delta.hairColour
    ?? itemsOf(free.hairShade)[0]
    ?? delta.eyeColour
    ?? itemsOf(free.eyeColourFree)[0]
    ?? delta.makeup
    ?? null;
}

/**
 * D-178's BACKSTOP: the referent is enforced, not merely instructed.
 *
 * The prompt is told which facet the last colour edit touched, and on a bare
 * "pinker" it obeyed on one run and filed makeup on the next — which is exactly
 * the shape D-176 and D-177 both landed on. A law that only lives in a prompt
 * is a law with a coin toss in it, so the drawer is corrected here.
 *
 * Only ever moves a colour, and only when the sentence had nothing else to
 * attach one to. A delta that already writes the remembered facet is returned
 * untouched, so the common case costs nothing.
 */
export function redirectColourTo(delta: RefineDelta, facet: Facet): RefineDelta {
  if (colourFacetOf(delta) === facet) return delta;
  const value = colourValueOf(delta);
  if (!value) return delta;

  const next: RefineDelta = { ...delta, free: { ...(delta.free ?? {}) } };
  delete next.hairColour;
  delete next.eyeColour;
  delete next.makeup;
  delete next.free!.hairShade;
  delete next.free!.eyeColourFree;

  const label = colourFacetLabel(facet);
  if (label === "the hair") {
    /* Promoted when the closed vocabulary can hold it, free-lane otherwise —
       the same two doors every other colour edit uses (D-166). */
    if ((HAIR_COLOURS as readonly string[]).includes(value)) next.hairColour = value as HairColour;
    else next.free!.hairShade = value;
  } else if (label === "the eyes") {
    if ((EYE_COLOURS as readonly string[]).includes(value)) next.eyeColour = value as EyeColour;
    else next.free!.eyeColourFree = value;
  } else {
    next.makeup = value;
  }
  if (Object.keys(next.free!).length === 0) delete next.free;
  return next;
}

/**
 * The cold-start question (D-178).
 *
 * Only reachable when nothing in the session has touched a colour. The options
 * resolve into ordinary instructions, so answering is indistinguishable from
 * having typed it that way in the first place.
 */
export function whichFacetReask(instruction: string): Reask {
  const asked = instruction.trim().replace(/[.!?]+$/, "");
  return {
    kind: "which-facet",
    /*
      THE ANSWERS LEFT THE SENTENCE WHEN THE CHIPS ARRIVED.

      It ended "Say the hair, the eyes, makeup" for exactly as long as there
      were no chips — a stopgap by its own definition. With the options rendered
      under it, naming them again is the sentence repeating the interface.
      Typing still answers it; the box being live is what says so.
    */
    question: `${asked} — which part? Nothing's been coloured yet, so I don't want to guess.`,
    options: COLOUR_BEARING.map((entry) => ({
      label: entry.label,
      resolves: `${asked} — ${entry.label}`,
    })),
  };
}

/**
 * Words a colour ask might be a typo OF (D-179).
 *
 * The closed vocabularies plus the handful of shades people actually type. It
 * is deliberately a KNOWN-WORD list rather than a spellchecker: the question is
 * "did you mean one of the things this product understands", and anything
 * further away keeps its current honest handling.
 */
const KNOWN_COLOUR_WORDS = [
  ...HAIR_COLOURS,
  ...EYE_COLOURS,
  "pink", "purple", "lilac", "lavender", "silver", "teal", "peach", "rose",
];

/**
 * Everything a near-miss is measured against — colours AND the features.
 *
 * "Pink hiar" is the same defect as "piink hair" and deserves the same free
 * question: the slip is in the word that names the DRAWER rather than the
 * value, and the render it would otherwise buy is exactly as wrong.
 *
 * **The feature half is DERIVED, and the founder's walk is why.** It used to be
 * hand-listed, the hand-list omitted `nose` — a word that is a free subject of
 * this very product — and "add light freckles around her nose" came back asking
 * *"did you mean rose?"* on a correctly spelled word. A second list that is
 * supposed to mirror a vocabulary will drift from it; the fix is to stop having
 * a second list. Anything nameable is spelled correctly by definition.
 */
const KNOWN_WORDS: readonly string[] = [
  ...KNOWN_COLOUR_WORDS,
  ...FREE_SUBJECT_KEYS.flatMap((subject) => FREE_SUBJECTS[subject].toLowerCase().split(" ")),
  "hair", "eyes", "lips", "brows", "lashes", "skin", "nails", "makeup",
  "cheeks", "beard", "freckles", "hairline",
];

/**
 * ORDINARY WORDS THAT LIVE ONE SLIP FROM SOMETHING THE PRODUCT KNOWS.
 *
 * The derived list above closes the case where the typed word is a thing we can
 * name. It does not close the general one: `brow` is a slip from `brown`, `lash`
 * from `hash`, `wider` from `wilder`. Every one of those is a correctly spelled
 * English word doing its job in a refine instruction, and asking "did you mean
 * brown?" about it is the same insult in a different costume.
 *
 * **The founder's rule, and it is absolute: the question never fires on a word
 * that is valid in context.** Erring the other way costs a typo its free
 * correction; erring this way calls the user illiterate and stops the work.
 *
 * This is a curated list, not a dictionary, and it is honest about that: it was
 * built by walking the one-slip neighbourhood of every known word and writing
 * down the real words found there. When a new colour or subject joins the
 * vocabulary, walk its neighbourhood too — `refineReask.test.ts` fails if any
 * word here is treated as a typo, which is the only reason this stays true.
 */
const VALID_IN_CONTEXT: readonly string[] = [
  // Face and body, singular and plural, whether or not we can edit them.
  "brow", "lash", "nose", "chin", "jaws", "ear", "neck", "face", "head",
  "cheek", "temple", "temples", "forehead", "mouth", "tooth", "eyelid",
  "eyelids", "nostril", "nostrils", "lobe", "lobes", "hand", "hands",
  // Worn things, since accessories are a legitimate refine subject.
  "hoop", "hoops", "stud", "studs", "glass", "glasses", "frame", "frames",
  "lens", "lenses", "chain", "chains", "band", "bands", "ring", "rings",
  /*
    "CLIPS" IS ONE SLIP FROM "LIPS", and the product's own hair rule names hair
    clips as the thing that must NOT be read as a haircut — so the gate would
    have asked a customer taking clips out of her hair whether she meant her
    lips. Caught by the vocabulary sweep the day the rule shipped, before any
    user saw it (the "shave"→"shape" class, again).
  */
  "clip", "clips", "pins", "grip", "grips", "slide", "slides",
  // The shape words people actually type next to a feature.
  "wider", "wilder", "older", "boldest", "bolder", "thicker", "thinner",
  "fuller", "paler", "darker", "lighter", "softer", "sharper", "rounder",
  "shorter", "longer", "straighter", "curlier", "waves", "wavier", "curl",
  "curls", "coils", "parted", "parting", "swept", "tousled", "cropped",
  "less", "more", "same", "slight", "light", "heavy", "clear", "clean",
  // Verbs and connectives long enough to reach the length filter.
  "make", "give", "keep", "take", "turn", "leave", "remove", "delete",
  "lose", "drop", "raise", "lower", "across", "around", "under", "over",
  "near", "onto", "with", "without", "them", "their", "hers", "them",
  // Words that sit one slip from a colour and mean something else entirely.
  "reach", "beach", "peace", "real", "deal", "heal", "team", "pine",
  "line", "link", "pin", "grew", "prey", "crew", "block", "blank", "blue",
  "blur", "glue", "greed", "alive", "live", "haze", "ember", "cooper",
  "rows", "hose", "rise", "rest", "west", "best", "wide", "side", "hide",
  /*
    Common English, because the neighbourhood is bigger than it looks.
    "Thin" is one slip from "chin" — and "give her thin wire glasses" is a
    sentence a user types every day. This test caught that before a user did;
    the previous instance reached production.
  */
  "thin", "thick", "than", "that", "this", "then", "there", "these", "those",
  "when", "what", "which", "whole", "were", "will", "would", "could", "should",
  "shape", "shade", "share", "sharp", "short", "shine", "shiny", "skin",
  "hair", "have", "half", "hard", "high", "help", "hold", "home", "hour",
  "back", "bald", "bare", "base", "bind", "bone", "both", "bright", "bring",
  "call", "calm", "cast", "come", "cool", "cover", "cute", "dark", "deep",
  "does", "done", "down", "draw", "dyed", "each", "edge", "else", "even",
  "ever", "eyes", "fade", "fair", "fine", "firm", "flat", "from", "full",
  "glow", "gold", "gone", "good", "here", "into", "just", "keep", "kind",
  "know", "last", "left", "like", "long", "look", "made", "many", "mark",
  "mask", "much", "must", "need", "nice", "none", "note", "only", "open",
  "pale", "part", "pick", "plain", "pull", "push", "quite", "read", "ready",
  /*
    THE SWEEP'S OWN HARVEST (opus-347), and the instance that started it:
    **"shave her head" was answered with "Did you mean shape?"** — the
    founder's own phrasing for a bald edit, stopped at the door by a typo
    question about shaping her head, before the interpreter ever saw it.

    `shave` is not a typo, it is a barber's verb. Rather than add that one
    word, `sweep-nearmiss-falsepositives-disposable.mts` put every word the
    PRODUCT ITSELF writes — its roll prompt, its refine prose, its refusal
    sentences, its catalogue notes — through its own typo gate, on the
    principle that a word this product uses is a real word in this domain by
    construction. 70,867 tokens, 4,749 distinct, and these are what came back.
    A guard test keeps the neighbourhood walked from now on, so the list
    cannot silently fall behind the vocabulary again.
  */
  "shave", "shaves", "shaven", "buzz", "trim", "grow", "grows", "grown",
  "crown", "frown", "part", "pair", "tell", "hips", "chip", "chips",
  "coin", "cone", "born", "built", "busy", "chair", "checks", "earn",
  "earns", "fails", "flips", "heard", "lies", "node", "noise", "nope",
  "prose", "rode", "role", "skim", "skip", "slips", "tear", "tenth",
  "torn", "tune", "wait", "waits", "warn", "while", "word", "wore",
  "write", "years", "zone",
  "right", "rough", "same", "seen", "sets", "show", "size", "slim", "small",
  "smile", "some", "soft", "sort", "stay", "still", "stop", "such", "sure",
  "take", "tall", "text", "they", "thing", "time", "tiny", "tone", "tint",
  "tidy", "very", "want", "warm", "wash", "wear", "well", "were", "went",
  "were", "wave", "weak", "wear", "well", "wire", "wispy", "work", "your",
  /* Found by the guard test on 2026-08-15, in this repository's own prose: a
     comment reading "it errs toward splitting" put `errs` one letter from
     `ears`. An ordinary English word, so the rule is absolute — the question
     never fires on it. */
  "errs",
  /*
    AND `pose` ONE SLIP FROM `rose` — the nose/rose neighbourhood again, caught
    by the same guard on 2026-08-17 the moment the bald row's catalogue note
    wrote "hidden by hair or pose". It is a word a photographer says all day,
    and "keep the pose, change the hair" is a sentence this product exists to
    receive.
  */
  "pose", "poses", "posed",
];

/**
 * SPELLINGS THAT ARE NOT MISTAKES — the other half of "valid in context".
 *
 * `color` is one slip from `colour` and `gray` from `grey`, so a US customer
 * typing the spelling they were taught is asked whether they meant ours. That
 * is not a correction, it is a nationality quiz in front of the work. `blond`
 * is the same shape with a different history — both spellings are standard and
 * the product happens to store one.
 *
 * Separated from the curated list rather than folded into it, because these are
 * a CLASS with a rule ("a standard alternate spelling of a word we know is
 * never a typo") and the list below is a neighbourhood walk.
 */
const ALTERNATE_SPELLINGS: readonly string[] = ["color", "gray", "blond", "grey", "colour", "blonde"];

/** A word we can name, or an ordinary word — either way, not a typo. */
const NEVER_A_TYPO = new Set<string>([...KNOWN_WORDS, ...VALID_IN_CONTEXT, ...ALTERNATE_SPELLINGS]);

/**
 * Valid, including the shapes English puts a word into.
 *
 * The corpus sweep found "a few grey **hairs** at the temples" asking whether
 * they meant "hair" — a plural of a word we ourselves know. Listing every
 * inflection would be the hand-maintained-list mistake a third time, so the
 * suffixes come off instead. A genuine typo survives it: "hiars" reduces to
 * "hiar", which is still nothing we know, and still gets its free question.
 */
const INFLECTIONS = ["s", "es", "ed", "d", "ing", "er", "ers", "y", "ier", "iest"];

/**
 * Known, or one suffix away from known.
 *
 * The vocabulary stores `freckles`, `cheekbones`, `brows`, `eyes` — PLURALS,
 * because that is how a face is talked about. Stripping suffixes off the TYPED
 * word can never reach them, so `freckle` and `cheekbone` reduced to nothing we
 * knew and were offered their own plural back as a correction.
 */
function knownOrInflectionOf(word: string): boolean {
  if (NEVER_A_TYPO.has(word)) return true;
  return INFLECTIONS.some((suffix) => NEVER_A_TYPO.has(`${word}${suffix}`));
}

function validInContext(token: string): boolean {
  if (knownOrInflectionOf(token)) return true;
  /*
    Both directions, and they compose: `freckled` takes `ed` off to `freckl`,
    which is not a word we know — but `freckle` plus `s` is. One-directional
    matching missed the whole family; the sweep over the product's own
    vocabulary is what showed the shape (opus-347).
  */
  return INFLECTIONS.some((suffix) => {
    if (!token.endsWith(suffix) || token.length - suffix.length < 3) return false;
    const stem = token.slice(0, -suffix.length);
    return knownOrInflectionOf(stem) || knownOrInflectionOf(`${stem}e`);
  });
}

/**
 * Levenshtein, capped — near-miss means ONE slip, not a different word.
 *
 * A distance of two would offer "pink" for "pine" and start guessing at
 * meaning, which is the thing this exists to avoid.
 */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  /*
    A SWAP IS ONE SLIP, and plain Levenshtein calls it two.

    "Hiar" for "hair" is the commonest typo there is — two fingers arriving out
    of order — and without this it scored as a different word entirely and the
    corpus caught it asking the wrong question.
  */
  if (a.length === b.length) {
    const differ: number[] = [];
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) differ.push(i);
    if (
      differ.length === 2
      && differ[1] === differ[0] + 1
      && a[differ[0]] === b[differ[1]]
      && a[differ[1]] === b[differ[0]]
    ) return true;
  }
  let i = 0;
  let j = 0;
  let slips = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    slips += 1;
    if (slips > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return slips + (a.length - i) + (b.length - j) <= 1;
}

/** A token that is one slip from something the product knows. */
export function nearMiss(instruction: string): { typed: string; meant: string } | null {
  const tokens = instruction.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 3);
  for (const token of tokens) {
    /* A word that is valid in context is not a typo of anything (D-205). */
    if (validInContext(token)) continue;
    const meant = KNOWN_WORDS.find((word) => withinOne(token, word));
    if (meant) return { typed: token, meant };
  }
  return null;
}

/**
 * The question a previous instruction raised — re-derived, never trusted.
 *
 * The client sends back WHICH instruction is outstanding, not the question
 * itself. Both questions are pure functions of that sentence plus the history,
 * so the server rebuilds them and the options cannot be forged into an edit the
 * user never saw offered.
 */
export function pendingReaskFor(
  instruction: string,
  hasColourHistory: boolean,
): Reask | null {
  /*
    THE HANDLE FIRST, because it is the only route that KNOWS which question was
    asked rather than inferring it (see `reaskHandle`).

    It has to be in front of the word doors and not behind them: *"fox eyes"*
    raised the glasses question and ALSO satisfies `mentionsUpsweptAsk`, so a
    handle read last would be shadowed by a rebuild of the wrong question — and
    the wrong question's chips do not match, which is the dead end this door
    exists to close, arriving one line later.
  */
  const handled = reaskByHandle(instruction);
  if (handled) return handled;

  const miss = nearMiss(instruction);
  if (miss) return didYouMeanReask(instruction, miss);
  if (!hasColourHistory && needsColourReferent(instruction)) return whichFacetReask(instruction);
  /*
    LAST, because it is the widest.

    The other two are questions about the WORDS; this one is a question about
    the FACE, and it is re-derived from the sentence alone. A typo'd "fox eyess"
    should still be offered the correction first — the near-miss door is the more
    specific reading of the same sentence.
  */
  if (mentionsUpsweptAsk(instruction)) return alreadyUpsweptReask(instruction);
  return null;
}

/**
 * A STANDARD ALTERNATE SPELLING IS THE SAME ANSWER — the near-miss gate's own
 * rule, arriving one door along.
 *
 * `ALTERNATE_SPELLINGS` exists because asking a US customer whether she meant
 * our spelling is "a nationality quiz in front of the work". The identical
 * insult wearing a worse costume is accepting her tap on a chip and refusing
 * the same word typed: `color` failing to match an option labelled *the colour*
 * is a question that dead-ends on a correctly spelled word, which is D-180's
 * one condition broken by a vocabulary difference.
 *
 * Fixed for EVERY question rather than for the one that surfaced it — the class,
 * not the instance. It is deliberately one-way and tiny: it normalises what SHE
 * typed onto the spelling the product stores, and never the other direction.
 */
function ours(said: string): string {
  return said
    .replace(/\bcolors?\b/g, (word) => (word.endsWith("s") ? "colours" : "colour"))
    .replace(/\bgray\b/g, "grey")
    .replace(/\bblond\b/g, "blonde");
}

const YES = ["yes", "yeah", "yep", "yup", "y", "correct", "right", "ok", "okay"];
const NO = ["no", "nope", "nah", "n"];

/**
 * A typed answer, resolved into the instruction it stands for — or null.
 *
 * **Null is the important return.** The question must never dead-end, and the
 * way a sentence-shaped question dead-ends is by refusing everything that is
 * not one of its two answers. So an unrecognised reply is not an error: they
 * have moved on, and it runs as a fresh instruction. The only thing this
 * function decides is whether the words in front of it are an ANSWER.
 */
export function resolveAnswer(reask: Reask, typed: string): string | null {
  const said = ours(typed.trim().toLowerCase().replace(/^[-—]\s*/, "").replace(/[.!?]+$/, ""));
  if (!said) return null;
  const bare = said.replace(/^(the|my|her|his|their)\s+/, "");

  for (const option of reask.options) {
    const label = option.label.toLowerCase();
    const core = label.replace(/^(yes|no)\b[\s,—-]*/, "").replace(/^the\s+/, "").trim();
    /* They typed the chip, or the noun inside it: "the hair", "hair". */
    if (said === label || bare === core || said === core) return option.resolves;
  }

  if (
    reask.kind === "did-you-mean"
    || reask.kind === "already-upswept"
    || reask.kind === "glasses-hide-eyes"
    /* The offer is a yes/no question like the three above it: "want a fresh
       take of it?" is answered by tapping the chip OR by typing "yes", which is
       D-180's rule and the reason this branch is a list rather than a special
       case per question. */
    || reask.kind === "same-again"
  ) {
    if (YES.includes(bare)) return reask.options[0]?.resolves ?? null;
    if (NO.includes(bare)) return reask.options[1]?.resolves ?? null;
    return null;
  }

  /* "Which part?" answered with a feature word anywhere in the sentence —
     "the hair please", "do the eyes". One match only: two named parts is a new
     instruction, not an answer to this question. */
  const words = bare.split(/[^a-z]+/).filter(Boolean);
  const hits = reask.options.filter((option) => {
    const core = option.label.replace(/^the\s+/, "");
    const singular = core.replace(/s$/, "");
    return words.includes(core) || words.includes(`${singular}s`) || words.includes(singular);
  });
  return hits.length === 1 ? hits[0].resolves : null;
}

/**
 * The answer that means "don't". Free, and it lands on the picture she has.
 *
 * Every other option in this module resolves into an ORDINARY INSTRUCTION, so
 * that tapping and typing end in one code path. A decline cannot: there is no
 * sentence that means "render nothing". So it resolves into this one shared
 * string, which `refineCandidate` recognises before the parse and answers with
 * a free outcome — one constant, read in two places, rather than a sentinel
 * spelled out at each of them.
 */
export const LEAVE_AS_SHE_IS = "leave her as she is";

/**
 * THE REFUSAL THAT BECAME AN OFFER — asking the same thing again (founder,
 * 2026-08-15; shaped in fable-575 §2).
 *
 * The already-true door refuses an ask the face already satisfies, free, and
 * that protection stays exactly where it is: an accidental repeat must never
 * cost anybody 25 credits for the picture they are looking at.
 *
 * But the founder asked for a way to re-roll a version he does not like —
 * *"allow a refresh or regeneration of the same edit"* — and the moment the
 * door catches an EXACT repeat of the edit that made this frame is precisely
 * when that is what he means. So the sentence stops being only a refusal and
 * becomes a question with a price on it.
 *
 * Three standing rulings meet here and none of them bends: the typed box is
 * still the interface (the chip and typing "yes" are one code path, D-180), the
 * price is said BEFORE the money moves (D-109), and the one-way door is stated
 * in the words he confirmed — the current picture is replaced.
 */
export function sameAgainReask(input: { asked: string; priceCredits: number }): Reask {
  return {
    kind: "same-again",
    /*
      THE SENTENCE QUOTES THE ASK RATHER THAN OWNING IT — because the ask is a
      whole instruction, not a noun. "She already has make her hair jet black"
      was on screen in the first browser check, and it is the kind of sentence
      that makes a careful product look careless.
    */
    question: `You already asked for this — "${input.asked}". Want a fresh take of it? `
      + `The picture you are looking at is replaced · ${input.priceCredits} credits.`,
    options: [
      { label: `Yes — a fresh take · ${input.priceCredits} credits`, resolves: input.asked },
      { label: "No, leave it", resolves: LEAVE_AS_SHE_IS },
    ],
    /* The version's own words, so answering lands on this question however the
       repeat that raised it was worded. */
    about: input.asked,
  };
}


/**
 * THE ALREADY-TRUE QUESTION — the third one, and the first about the FACE
 * rather than about the words (founder ruling, 2026-08-07).
 *
 * She asks for eyes that sweep up and her eyes measurably already do. Rendering
 * that spends 25 credits to produce the picture she is looking at and then asks
 * a reader whether it complied, which is how a false pass gets manufactured
 * (D-235). So the product asks instead, for free.
 *
 * **The offer resolves as an intensification, not as a second run at the same
 * absolute ask** — "fox eyes" on a face that already reads as fox eyes is the
 * request that has nowhere to go, so the resolved sentence says *further than
 * they already are*, and the gate stands down once something has been answered.
 *
 * The question text is a constant rather than a rendering of the measurement:
 * a degree count is the instrument's language, not the stylist's (working law
 * 8), and it is also what lets this be rebuilt identically on the answer path,
 * where no image has been read.
 */
export function alreadyUpsweptReask(instruction: string): Reask {
  const asked = instruction.trim().replace(/[.!?]+$/, "");
  return {
    kind: "already-upswept",
    question: "Her eyes already sweep up at the outer corners. Push them further, "
      + "or leave her as she is? Either way this costs nothing.",
    options: [
      { label: "More tilt", resolves: `${asked} — further than they already are` },
      /* As easy as the accept, and genuinely free: it lands on her current
         picture and never reaches the claim. */
      { label: "Never mind", resolves: LEAVE_AS_SHE_IS },
    ],
  };
}

/**
 * THE QUESTION FOR WHEN HER GLASSES ARE IN THE WAY OF THE MEASUREMENT.
 *
 * Sibling of `alreadyUpsweptReask`, and it exists because the gate above can
 * only protect a face it can measure. Measured on 2026-08-09: the canthal tilt
 * reads on **6 of 6** bare faces and **4 of 8** bespectacled ones. When it does
 * not read, nothing fires, and she is charged for an eye edit that may be a
 * no-op — the protection is silently unavailable to people who wear glasses.
 *
 * **The glasses are a correlate, not a proven cause**, and the code says so
 * rather than implying more: the same woman's master read 2.0° with her frames
 * on while a later frame of her, also bespectacled, would not read at all. What
 * we know is that the reading failed and that there are frames over her eyes;
 * that is enough to ask and not enough to explain.
 *
 * So the product says the true thing — *I cannot see your eyes well enough to
 * tell* — and offers the two real answers. Free, like every member of this
 * family, and it never dead-ends: "go ahead" is as easy as the alternative.
 *
 * No degree count in the copy: a measurement is the instrument's language, not
 * the stylist's (working law 8). She is told what the product can and cannot
 * see, which is a fact about her picture, not about our arithmetic.
 *
 * # THE FIRST CHIP SUBMITS ONE INSTRUCTION, AND IT USED TO SUBMIT TWO
 *
 * It resolved to *"remove her glasses, then fox eyes"* — a removal and an edit
 * in one sentence, which reads to a person as exactly the right order to work
 * in. Driven through the live interpreter before it shipped
 * (`scripts/drive-compound-chip.mts`, 5 readings per row):
 *
 *     COMPOUND — the chip's own sentence      0/5 carried every half
 *     control: the removal alone              5/5
 *     control: the eye ask alone              5/5
 *
 * The compound files as `intent: remove, subject: statedAccessories, match:
 * glasses` and **the eye ask is gone**. That is not a prompt to tune: the parse
 * is a union, an edit carries a `delta` and a removal carries an intent, and no
 * variant of it can hold both. A compound sentence must drop a half to be
 * representable at all.
 *
 * So the chip submits the removal ALONE — the thing its label promises — and
 * her eye ask is one sentence away, on a face the gate can finally measure.
 * Handing our own button a sentence the parser mangles would have been the
 * absorbed-ask defect, delivered by us rather than typed by her.
 */
export function glassesHideEyesReask(instruction: string): Reask {
  const asked = instruction.trim().replace(/[.!?]+$/, "");
  return {
    kind: "glasses-hide-eyes",
    /*
      ITS OWN NAME, because the words cannot rebuild it (opus-827 §0).

      This question is raised on the PICTURE — a reading that failed and frames
      over her eyes — and her sentence says none of that. Without the handle it
      rebuilt as nothing (or, for an upswept-shaped ask, as the wrong question),
      and both chips ran as raw instructions. See `reaskHandle`.
    */
    about: reaskHandle("glasses-hide-eyes", asked),
    question: "Her glasses are sitting over her eyes, so I can't tell whether "
      + "they already do this. Take the glasses off first, or go ahead anyway? "
      + "Either way this costs nothing.",
    options: [
      /* One fact, the one the label names. See the header: two facts in one
         sentence cost the second one. */
      { label: "Take them off first", resolves: "remove her glasses" },
      { label: "Go ahead anyway", resolves: asked },
    ],
  };
}

/**
 * The typo question (D-179).
 *
 * One tap, and the answer is THEIR word because they chose it — which is what
 * keeps D-172 intact while still sparing them a paid render of a misspelling.
 */
export function didYouMeanReask(instruction: string, miss: { typed: string; meant: string }): Reask {
  const corrected = instruction.replace(new RegExp(miss.typed, "i"), miss.meant);
  return {
    kind: "did-you-mean",
    /* The chips carry the two answers now (D-180). "Yes" still works typed. */
    question: `Did you mean ${miss.meant}?`,
    options: [
      { label: `Yes — ${miss.meant}`, resolves: corrected },
      /* Their word, unchanged, is always an answer. A question that can only be
         answered one way is not a question. */
      { label: `No, ${miss.typed} is right`, resolves: `${instruction} (exactly as written)` },
    ],
  };
}

/*
  THE HAIR-FROM-REFERENCE QUESTION IS GONE, and its builder went with it
  (founder ruling 2026-08-19, relayed fable-1087, superseding fable-1047 §3).

  It asked *"the colour, the style, or the whole look?"* whenever a picture was
  attached and the words named no take. His newer word retires it — *"if they
  are vague and say copy this hair it just means the whole lot unless they
  specify"* — so the default moved to `hairReferenceTake.hairTakeFor` and
  nothing here asks anything. A take NAMED in words still routes exactly as it
  did; only the silence changed meaning.

  Deleted rather than left standing behind its flag: an export nobody calls is a
  claim, and a question builder sitting in the reask family reads to the next
  person as a question this product asks. The `Reask` kind went with it for the
  same reason — a client switching on a kind that can never arrive is a branch
  nobody can ever test.

  What did NOT go: the D-180 mechanism itself, which predates this and serves
  genuine unreadability, and every other question in this file.
*/

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
import { HAIR_COLOURS, type HairColour } from "../../shared/castingVocabularies";
import { EYE_COLOURS, type EyeColour } from "../../shared/castingRealization";
import { facetOfSubject, type Facet } from "./refineFacets";
import { FREE_SUBJECTS, FREE_SUBJECT_KEYS } from "./refineSubjects";
import { itemsOf, type RefineDelta } from "./refineDelta";
import { REFINABLE_AXES } from "./refineDelta";
import { facetOfAxis } from "./refineFacets";

/**
 * A question the product needs answered before it can act — and never a charge.
 *
 * `options` are the tappable chips; `resolves` is what a tap or a typed answer
 * turns into, so both routes end in the same instruction and neither is a
 * second implementation of the other.
 */
export type Reask = {
  kind: "which-facet" | "did-you-mean";
  /** The sentence, in their words. */
  question: string;
  options: Array<{ label: string; resolves: string }>;
};

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
  "right", "rough", "same", "seen", "sets", "show", "size", "slim", "small",
  "smile", "some", "soft", "sort", "stay", "still", "stop", "such", "sure",
  "take", "tall", "text", "they", "thing", "time", "tiny", "tone", "tint",
  "tidy", "very", "want", "warm", "wash", "wear", "well", "were", "went",
  "were", "wave", "weak", "wear", "well", "wire", "wispy", "work", "your",
];

/** A word we can name, or an ordinary word — either way, not a typo. */
const NEVER_A_TYPO = new Set<string>([...KNOWN_WORDS, ...VALID_IN_CONTEXT]);

/**
 * Valid, including the shapes English puts a word into.
 *
 * The corpus sweep found "a few grey **hairs** at the temples" asking whether
 * they meant "hair" — a plural of a word we ourselves know. Listing every
 * inflection would be the hand-maintained-list mistake a third time, so the
 * suffixes come off instead. A genuine typo survives it: "hiars" reduces to
 * "hiar", which is still nothing we know, and still gets its free question.
 */
const INFLECTIONS = ["s", "es", "ed", "ing", "er", "ers", "y", "ier", "iest"];

function validInContext(token: string): boolean {
  if (NEVER_A_TYPO.has(token)) return true;
  return INFLECTIONS.some((suffix) => {
    if (!token.endsWith(suffix) || token.length - suffix.length < 3) return false;
    const stem = token.slice(0, -suffix.length);
    return NEVER_A_TYPO.has(stem) || NEVER_A_TYPO.has(`${stem}e`);
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
export function pendingReaskFor(instruction: string, hasColourHistory: boolean): Reask | null {
  const miss = nearMiss(instruction);
  if (miss) return didYouMeanReask(instruction, miss);
  if (!hasColourHistory && needsColourReferent(instruction)) return whichFacetReask(instruction);
  return null;
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
  const said = typed.trim().toLowerCase().replace(/^[-—]\s*/, "").replace(/[.!?]+$/, "");
  if (!said) return null;
  const bare = said.replace(/^(the|my|her|his|their)\s+/, "");

  for (const option of reask.options) {
    const label = option.label.toLowerCase();
    const core = label.replace(/^(yes|no)\b[\s,—-]*/, "").replace(/^the\s+/, "").trim();
    /* They typed the chip, or the noun inside it: "the hair", "hair". */
    if (said === label || bare === core || said === core) return option.resolves;
  }

  if (reask.kind === "did-you-mean") {
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

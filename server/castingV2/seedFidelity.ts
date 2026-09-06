/**
 * SEED FIDELITY — the check that makes a REWRITE safe (#230, his ruling).
 *
 * # Why this module exists at all
 *
 * Until 2026-08-29 the author road was APPEND-ONLY by construction: the
 * customer's brief was the first paragraph, placed by code, and the author
 * wrote only what followed. A fact could not be lost because the fact was
 * still sitting there in the customer's own words. That construction was the
 * court's pick for exactly that reason (`PROMPT_AUTHOR_COURT_2026-08-26.md`
 * finding 5: the free-reword arm CONTRADICTED a fact on 2 of 2 runs, the
 * verbatim arm held 33/33, 19/19, 3/3).
 *
 * The founder overruled it at his own eye, watching a live MAX sheet
 * (#230, verbatim): *"Engine gets one brief, not a stack … MAX: author
 * rewrites the seed into a single type + look paragraph. Facts stay. Taste
 * goes up. No second essay underneath."* — and in the same breath he named
 * the mitigation: *"Keep the raw seed internally for the fidelity check."*
 *
 * This module is that check. It is not a nicety: with the rewrite in, the
 * author's paragraph is the ONLY place the customer's facts exist on the
 * wire, so a dropped fact is a fact the customer paid for and did not get.
 *
 * # What it checks, and what it deliberately does not
 *
 * It is anchored on the RAW SEED, never on the reader's record, and that is
 * the load-bearing decision. The reader (`interpreter.ts`) sets `ageBand`
 * from an idiom as well as from a stated age, and sets `sex` from a role noun
 * as well as from a pronoun — so a check that demanded the rewrite restate
 * the READER's value would refuse good rewrites of briefs that never said the
 * thing out loud, and every such refusal costs the customer MAX and drops
 * them silently back to their own words. So: **a fact is checked only where
 * the customer's own sentence states it in a shape this module can read.**
 *
 * CHECKED — the two facts with closed, enumerable surface forms, and the two
 * the founder's own MAX checklist names (*"They got younger = author rewrote
 * the seed"*):
 *
 *   - SEX, by presence. The seed said "her"/"woman"/"male"; the paragraph
 *     must still say something from that sex's vocabulary.
 *   - AGE, by presence AND by contradiction. Presence: the seed made a
 *     readable age claim, so the paragraph must make one too. Contradiction
 *     (§5g, #171, older than this module): the claim it makes must resolve to
 *     the band the reader recorded.
 *
 * NOT CHECKED, and each for a stated reason rather than by omission:
 *
 *   - HERITAGE, HAIR COLOUR, LOOK, ROLE, BUILD — their surface forms are
 *     open ("Nordic" is a legitimate "Scandinavian"), so a presence check
 *     would refuse synonyms, which is the typo-gate class this repo has been
 *     bitten by four times (`cropped`, `framing`, `shave`, `reminiscent of`).
 *     They are carried by the instruction and by his eye.
 *   - AN ADJECTIVE FLIP. ⚠ **This is the exact loss the court measured** —
 *     *"subtle specular highlights"* → *"crisp specular highlights"* — and no
 *     closed-vocabulary check can see it. It is the honest limit of this
 *     module: the mechanical floor catches a DROPPED person, not a MOVED
 *     adjective. The controls against it are the instruction ("facts cannot
 *     be rewritten, at any level and in any wording") and the founder's eye
 *     on the sheet, which is what his success test is.
 *   - A SEX FLIP that keeps both vocabularies ("a striking man, her jaw
 *     cut…"). An ordinary flip drops the seed's own sex words and reddens
 *     here; a paragraph naming both does not. Declared rather than guarded,
 *     because a contradiction arm over "men's tailoring" and "a man's white
 *     shirt" on a woman's brief refuses ordinary editorial English.
 *
 * # What a failure costs
 *
 * Nothing the customer can see, and never a refusal: the author is re-asked
 * once naming the fact it dropped, and a second failure falls back to the
 * static prompt — the customer's own words plus the locked block, which is
 * the LOW spec and cannot lose a fact by construction. The outcome is
 * recorded on the row so the rate is a reading rather than an anecdote.
 */
import { AGE_BANDS, SEXES, type AgeBand, type AgePhase, type Sex } from "../../shared/castingVocabularies";

/** The reader's recorded age — the value a claim in the author's text is compared against. */
export type StatedAge = { band: AgeBand; phase: AgePhase | null };

/**
 * Decade words → the band they claim. Consulted ONLY inside an age-stating
 * shape ("in her …", "early/mid/late …", "…-something", "aged NN") — a bare
 * "70s" or "80s" is era styling ("70s disco"), not an age claim, which is the
 * anchored-matcher lesson the review of #173 taught `briefRewrite.ts`.
 * Decades past the vocabulary's top band claim "70s+".
 */
const BAND_OF_WORD: Readonly<Record<string, AgeBand>> = {
  teens: "teens", teenage: "teens", teenaged: "teens", teenager: "teens",
  "20s": "20s", twenties: "20s", twenty: "20s",
  "30s": "30s", thirties: "30s", thirty: "30s",
  "40s": "40s", forties: "40s", forty: "40s",
  "50s": "50s", fifties: "50s", fifty: "50s",
  "60s": "60s", sixties: "60s", sixty: "60s",
  "70s": "70s+", seventies: "70s+", seventy: "70s+",
  "80s": "70s+", eighties: "70s+", eighty: "70s+",
  "90s": "70s+", nineties: "70s+", ninety: "70s+",
};

function bandOfYears(years: number): AgeBand | null {
  if (years < 13 || years > 120) return null;
  if (years < 20) return "teens";
  if (years < 30) return "20s";
  if (years < 40) return "30s";
  if (years < 50) return "40s";
  if (years < 60) return "50s";
  if (years < 70) return "60s";
  return "70s+";
}

/**
 * Age-stating shapes; each captures the one token `BAND_OF_WORD` or
 * `bandOfYears` reads. The non-possessive early/mid/late shape is marked
 * `eraAmbiguous`: "late 70s disco" / "early 90s minimalism" are genre names in
 * exactly the aesthetic language MAX is told to write (Fable review of #174,
 * finding 1), so in THAT shape alone a numeric decade above 60s is declined —
 * the possessive shape ("in her late 70s") still catches a real elder-age
 * claim, and the word forms ("late seventies") stay age claims everywhere.
 */
const AGE_CLAIM_SHAPES: ReadonlyArray<{ shape: RegExp; eraAmbiguous?: true }> = [
  { shape: /\bin (?:her|his|their) (?:(?:early|mid|late)[ -])?([a-z0-9]+)\b/g },
  { shape: /\b(?:early|mid|late)[ -]([a-z0-9]+)\b/g, eraAmbiguous: true },
  { shape: /\b([a-z]+)-something\b/g },
  { shape: /\baged? (\d{1,3})\b/g },
  { shape: /\b(\d{1,3})[ -]years?[ -]old\b/g },
  { shape: /\b(teenage[dr]?|teenager)\b/g },
];

/** Numeric decades that double as era genres; declined only in the `eraAmbiguous` shape. */
const ERA_DECADES = new Set(["70s", "80s", "90s"]);

/**
 * Words that age a seed DOWN without naming a decade — the measured failure
 * direction ("mid 30s" must never become "young woman"). They contradict a
 * stated band of 30s or older; on a teens/20s seed "young" states nothing the
 * seed did not. UP-drift is caught only in the decade-stating shapes above —
 * elder adjectives ("aged", "mature") double as material/styling words and a
 * guard that refuses "aged leather" would be the typo gate owning a real word.
 */
/**
 * Exported since #535: the Re-imagine steering rule reads the same list, and
 * a private copy over there is working law 4's mirror (review of PR #598,
 * finding 3 — the copies agreed the day they were written, which is when
 * mirrors always agree).
 */
export const YOUTH_WORDS = ["young", "younger", "youthful", "childlike"] as const;

/** Every age band a readable claim in `text` resolves to, in the order the claims appear. */
export function ageClaimsIn(text: string): AgeBand[] {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const claims: AgeBand[] = [];
  for (const { shape, eraAmbiguous } of AGE_CLAIM_SHAPES) {
    for (const match of Array.from(lower.matchAll(shape))) {
      const token = match[1] ?? match[0];
      if (eraAmbiguous && ERA_DECADES.has(token)) continue;
      const claimed = /^\d+$/.test(token) ? bandOfYears(Number(token)) : BAND_OF_WORD[token] ?? null;
      if (claimed !== null) claims.push(claimed);
    }
  }
  return claims;
}

/**
 * WHERE the readable claims sit — the same shapes, the same era filter, as
 * character spans over the whitespace-normalised lowercase text (#535: the
 * Re-imagine steering rule needs positions, and a second copy of the shapes
 * over there would be working law 4's mirror). A span is reported only for a
 * match that actually resolves to a band, exactly as `ageClaimsIn` counts it.
 */
export function ageClaimSpans(text: string): Array<{ start: number; end: number }> {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const spans: Array<{ start: number; end: number }> = [];
  for (const { shape, eraAmbiguous } of AGE_CLAIM_SHAPES) {
    for (const match of Array.from(lower.matchAll(shape))) {
      const token = match[1] ?? match[0];
      if (eraAmbiguous && ERA_DECADES.has(token)) continue;
      const claimed = /^\d+$/.test(token) ? bandOfYears(Number(token)) : BAND_OF_WORD[token] ?? null;
      if (claimed === null) continue;
      spans.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    }
  }
  return spans;
}

/**
 * The phrase in `content` that claims an age other than `stated`, or null.
 * §5g (#171) — the check compares VALUES, never substrings: the READER
 * already recorded the brief's age, and this asks whether the author's text
 * claims a DIFFERENT one. "mid 30s" → "in her mid-thirties" passes; → "young"
 * is a contradiction (his own specimen).
 */
export function ageContradictionIn(content: string, stated: StatedAge): string | null {
  const lower = content.toLowerCase().replace(/\s+/g, " ");
  for (const { shape, eraAmbiguous } of AGE_CLAIM_SHAPES) {
    for (const match of Array.from(lower.matchAll(shape))) {
      const token = match[1] ?? match[0];
      if (eraAmbiguous && ERA_DECADES.has(token)) continue;
      const claimed = /^\d+$/.test(token) ? bandOfYears(Number(token)) : BAND_OF_WORD[token] ?? null;
      if (claimed !== null && claimed !== stated.band) return match[0];
    }
  }
  if (AGE_BANDS.indexOf(stated.band) >= AGE_BANDS.indexOf("30s")) {
    for (const word of YOUTH_WORDS) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) return word;
    }
  }
  return null;
}

/**
 * The words that SAY a sex, per value. Broad on purpose: this list decides
 * whether the customer said it and whether the author kept saying it, and a
 * paragraph about a woman that says only "she" has kept the fact.
 *
 * It is NOT used to detect a contradiction — see this module's header for
 * why ("men's tailoring" on a woman's brief is ordinary editorial English).
 */
const SEX_WORDS: Readonly<Record<Sex, readonly string[]>> = {
  female: ["woman", "women", "female", "she", "her", "hers", "girl", "lady", "feminine"],
  male: ["man", "men", "male", "he", "his", "him", "boy", "guy", "gentleman", "masculine"],
  nonbinary: ["nonbinary", "non-binary", "agender", "androgynous", "gender-neutral", "they", "them", "their"],
};

/**
 * Whole-word match that does not run into a possessive or a longer word:
 * "man" must not match "woman" or "man's", "men" must not match "menswear"
 * or "men's". Both of those are phrases a real editorial paragraph contains.
 */
function saysWord(lower: string, word: string): boolean {
  const escaped = word.replace(/[-]/g, "\\-");
  return new RegExp(`(^|[^a-z])${escaped}(?![a-z'’])`).test(lower);
}

/** True when `text` says the given sex in any of its surface forms. */
export function saysSex(text: string, sex: Sex): boolean {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  return SEX_WORDS[sex].some((word) => saysWord(lower, word));
}

/*
  `SeedFacts`, `seedFactsOf` and `droppedFactIn` RETIRED WITH THE MAX AUTHOR
  (#535). Presence-of-every-stated-fact was that road's contract, and it IS
  the pieces road the founder's two rolled courts rejected (rolls 244/245 and
  243/246, his eye) — the Re-imagine press locks only sex, age and species
  when typed (`reimagine.ts`, `lockedTrioOf`), and the result lands editable
  in the customer's own box, which is the new fidelity control.
*/

/** Every sex value has surface words — asserted here so a widened vocabulary cannot ship a silent hole. */
{
  for (const sex of SEXES) {
    if (!SEX_WORDS[sex] || SEX_WORDS[sex].length === 0) {
      throw new Error(`[seedFidelity] no surface words for sex "${sex}" — the fidelity check would pass it blind`);
    }
  }
}

/**
 * THE BRIEF REWRITE — a chip edit applied to the sentence itself (#164;
 * founder verbatim, 2026-08-27, looking at a shown prompt carrying his brief's
 * "in their 30s", a chip's 40s and a tie-breaker: *"i mean its rediculous to
 * have fighting within the prompt sent to the engine right? wouldnt you just
 * send a new prompt with the specific edits required?"*).
 *
 * The ruling: a chip edit is the CUSTOMER'S OWN change, so the engine receives
 * ONE clean, self-consistent prompt with the edit in place — never the
 * original plus an override plus a precedence sentence. Verbatim-first is not
 * violated: that law protects his words from the AUTHOR's drift, not from his
 * own edits. The product's own courts are the evidence that competing
 * instructions degrade the engine (`context-is-not-additive`).
 *
 * How the edit lands, per field:
 *
 *   - **REPLACED** where the brief states the fact in a form the matchers
 *     recognise — every span stating it is rewritten to the new value, and
 *     every byte outside those spans is untouched (asserted in the suite).
 *     A brief that says the fact twice gets both said right, because leaving
 *     one behind is the contradiction this module exists to kill.
 *   - **APPENDED** as one plain sentence where the brief never states it.
 *     No precedence clause — there is nothing to take precedence over.
 *
 * The matchers are deliberately conservative: a decade token, a gender noun,
 * a heritage vocabulary word, a build adjective anchored to the word "build",
 * a look key's own phrase. A fact stated in words they cannot see falls to
 * APPEND — which can leave the old wording standing beside the new sentence.
 * That is the declared limit (the alternative, a model rewriting his words,
 * is the author-drift the verbatim law forbids), and the drive on #164 is
 * where its rate is read rather than guessed at.
 *
 * Author road only: the house road composes per-candidate prose from the
 * intent, which `applyOverrides` already edits structurally — its prompts
 * never carried the contradiction.
 */
import type { LockOverrides } from "./briefCompiler";
import type { AgeBand, AgePhase, Build, EnergyKey, Heritage, LookKey, Sex } from "./castingIntent";
import { HERITAGES, LOOK_KEYS } from "./castingIntent";
import { agePhrase } from "./familyClause";

export type BriefEditMode = "replaced" | "appended";
export type BriefEdit = { field: keyof LockOverrides; mode: BriefEditMode; to: string };
export type RewrittenBrief = { text: string; edits: BriefEdit[] };

const SUBJECT_NOUN: Record<Sex, string> = {
  female: "a woman",
  male: "a man",
  nonbinary: "an androgynous person",
};

/** The bare noun, for replacing a gender noun in place ("woman", not "a woman"). */
const BARE_NOUN: Record<Sex, string> = { female: "woman", male: "man", nonbinary: "androgynous person" };

/** The adjective form, for a brief that used one — "a female pilot" edited to male stays grammatical. */
const SEX_ADJECTIVE: Record<Sex, string> = { female: "female", male: "male", nonbinary: "androgynous" };
const ADJECTIVE_GENDER_WORDS = new Set(["male", "female"]);

/** "a" or "an" for the word that follows — this vocabulary has no silent-h or you-sound edge cases. */
function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/**
 * Decade spans, digit or spelled, with an optional phase prefix — the whole
 * span is replaced so "mid 30s" becomes "late 40s" rather than "mid late 40s".
 */
const AGE_SPAN =
  /\b(?:(?:early|mid|late)[ -])?(?:teens|20s|30s|40s|50s|60s|70s\+?|twenties|thirties|forties|fifties|sixties|seventies)\b/gi;

const GENDER_NOUN = /\b(?:woman|man|female|male|lady|gentleman|guy|girl|boy)\b/gi;

/** The build adjective only when anchored to the word "build" — "broad" alone is a shoulder, a smile, a brief. */
const BUILD_SPAN = /\b(?:slight|slim|average|athletic|broad|heavy)(?=[ -]build\b)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anyOf(values: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${values.map(escapeRegExp).join("|")})\\b`, "gi");
}

/** "in their late 40s" without the leading "in their" — the token that sits where "30s" sat. */
function ageToken(band: AgeBand, phase: AgePhase | null): string {
  const bare = band === "70s+" ? "70s" : band;
  return phase ? `${phase} ${bare}` : bare;
}

type FieldWriter = {
  field: keyof LockOverrides;
  /** Spans stating the fact today; every match is replaced. */
  matcher: RegExp | null;
  /** What a matched span becomes — a function where the span's own grammar shapes the result. */
  replacement: string | ((match: string) => string);
  /** The token recorded on the edit — the primary form of the new value. */
  to: string;
  /** The plain sentence appended when no span exists. */
  appended: string;
};

function writersOf(overrides: LockOverrides): FieldWriter[] {
  const writers: FieldWriter[] = [];
  if (overrides.ageBand) {
    const token = ageToken(overrides.ageBand, overrides.agePhase ?? null);
    writers.push({
      field: "ageBand",
      matcher: AGE_SPAN,
      replacement: token,
      to: token,
      appended: `${agePhrase(overrides.ageBand, overrides.agePhase ?? null).replace(/^in their/, "In their")}.`,
    });
  }
  if (overrides.sex) {
    const sex = overrides.sex as Sex;
    writers.push({
      field: "sex",
      matcher: GENDER_NOUN,
      /* The span's own grammar decides the form: "a female pilot" stays adjectival, "a woman" stays a noun. */
      replacement: (matched) => (ADJECTIVE_GENDER_WORDS.has(matched.toLowerCase()) ? SEX_ADJECTIVE[sex] : BARE_NOUN[sex]),
      to: BARE_NOUN[sex],
      appended: `Cast ${SUBJECT_NOUN[sex]}.`,
    });
  }
  if (overrides.heritage) {
    writers.push({
      field: "heritage",
      matcher: anyOf(HERITAGES),
      replacement: overrides.heritage as Heritage,
      to: overrides.heritage as Heritage,
      appended: `Of ${overrides.heritage} heritage.`,
    });
  }
  if (overrides.build) {
    writers.push({
      field: "build",
      matcher: BUILD_SPAN,
      replacement: overrides.build as Build,
      to: overrides.build as Build,
      appended: `${(overrides.build as string).charAt(0).toUpperCase()}${(overrides.build as string).slice(1)} build.`,
    });
  }
  if (overrides.look) {
    writers.push({
      field: "look",
      matcher: anyOf(LOOK_KEYS as readonly string[]),
      replacement: overrides.look as LookKey,
      to: overrides.look as LookKey,
      appended: `A ${overrides.look} look.`,
    });
  }
  if (overrides.energy) {
    /* An energy key is studio vocabulary — a brief never states "dry" as a presence. Append only. */
    writers.push({ field: "energy", matcher: null, replacement: "", to: "", appended: energySentence(overrides.energy as EnergyKey) });
  }
  if (overrides.archetype) {
    writers.push({ field: "archetype", matcher: null, replacement: "", to: "", appended: `Cast in the ${overrides.archetype} direction.` });
  }
  return writers;
}

const ENERGY_SENTENCE: Record<EnergyKey, string> = {
  warm: "A warm, unhurried presence.",
  dry: "A dry, flat presence.",
  bright: "A bright, quick presence.",
  grave: "A still, grave presence.",
  open: "An open, easy presence.",
  guarded: "A guarded presence.",
  wry: "A wry presence.",
  plain: "A plain, direct presence.",
};

function energySentence(energy: EnergyKey): string {
  return ENERGY_SENTENCE[energy];
}

/**
 * The brief with the customer's chip edits in place, or null when there is
 * nothing to write. Appended sentences ride after the brief's own text,
 * separated by a sentence break; replaced spans leave every other byte alone.
 */
export function rewriteBrief(briefText: string, overrides: LockOverrides | undefined): RewrittenBrief | null {
  const writers = writersOf(overrides ?? {});
  if (writers.length === 0) return null;

  let text = briefText;
  const edits: BriefEdit[] = [];
  const appendices: string[] = [];
  for (const writer of writers) {
    /*
      The span is matched WITH its article when one leads it, so "an athletic
      build" edited to broad reads "a broad build" — the article is part of
      the fact's grammar, and agreement is part of the edit. A fresh regex per
      use: the module-level matchers are global and carry lastIndex.
    */
    const composed = writer.matcher
      ? new RegExp(`\\b(a|an)(\\s+)(${writer.matcher.source})|${writer.matcher.source}`, writer.matcher.flags)
      : null;
    if (composed && composed.test(text)) {
      text = text.replace(
        new RegExp(composed.source, composed.flags),
        (whole, article: string | undefined, spacing: string | undefined, articled: string | undefined) => {
          const core = articled ?? whole;
          const replaced = typeof writer.replacement === "function" ? writer.replacement(core) : writer.replacement;
          return article ? `${articleFor(replaced)}${spacing}${replaced}` : replaced;
        },
      );
      edits.push({ field: writer.field, mode: "replaced", to: writer.to });
    } else {
      appendices.push(writer.appended);
      edits.push({ field: writer.field, mode: "appended", to: writer.appended });
    }
  }
  if (appendices.length > 0) {
    const trimmed = text.trimEnd();
    const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    text = `${punctuated} ${appendices.join(" ")}`;
  }
  return { text, edits };
}

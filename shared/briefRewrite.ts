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
 *     recognise — every recognised span is rewritten to the new value, and
 *     every byte outside those spans is untouched (asserted in the suite).
 *     A brief that says the fact twice gets both said right, because leaving
 *     one behind is the contradiction this module exists to kill.
 *   - **APPENDED** as one plain sentence where the brief never states it.
 *     No precedence clause — there is nothing to take precedence over.
 *
 * The matchers are ANCHORED TO FACT-STATING SHAPES, not bare tokens (review
 * of PR #173, finding 1): a decade counts only inside "in her/his/their
 * <decade>" or "aged <decade>", so a "60s bouffant" is a hairstyle era and
 * never rewritten; a heritage word counts only against a person shape ("of
 * Nordic heritage", "a Nordic woman"), so a Mediterranean rooftop keeps its
 * sea; a build adjective only against the word "build". A gender noun cannot
 * be anchored by shape, so it is replaced only when the brief holds exactly
 * ONE — a second person in frame ("a woman beside an older man") makes the
 * subject ambiguous and the edit falls to APPEND.
 *
 * TWO DECLARED LIMITS, one per branch. A fact stated in words the anchors
 * cannot see falls to APPEND — which can leave the old wording standing
 * beside the new sentence. And an anchored span can still belong to a
 * NON-subject person ("a woman in her 30s beside a man in his 50s" + an age
 * chip rewrites both) — this product frames a single figure, so a second
 * aged person is rare, but the class exists. The alternative to both — a
 * model rewriting his words — is the author-drift the verbatim law forbids;
 * the drive on #164 is where these rates are read rather than guessed at.
 *
 * Author road only: the house road composes per-candidate prose from the
 * intent, which `applyOverrides` already edits structurally — its prompts
 * never carried the contradiction.
 *
 * ⚠ **IT MOVED OUT OF `server/castingV2/` INTO `shared/` ON 2026-09-05 (#534),
 * AND THE MOVE IS THE POINT.** The founder, verbatim: *"a chip edit writes
 * straight into the prompt box, the box is the next brief … Chips and box can
 * never disagree, and the guard must prove that before it merges."* Under #164
 * this ran at COMPILE time, so the customer's box still said "in their 30s"
 * while the engine was sent "40s" — the disagreement he was looking at. Run it
 * at the CHIP CLICK instead and the box carries the edit, the box is what the
 * roll sends, and there is no second channel left to disagree with it. That
 * needs one rewriter reachable from both sides, which is this file's address.
 * A second copy in `client/` would be working law 4 exactly.
 *
 * One consequence, named rather than discovered: the APPENDED sentences are
 * now CUSTOMER-VISIBLE, because they land in the box the customer is reading.
 * They are ordinary casting English for that reason — "Of Nordic heritage.",
 * "Athletic build.", "A warm, unhurried presence." — and never studio
 * machinery. Nothing from the locked house block is in here and none may be
 * added: what the sheet may show is #534's own rule.
 */
import type { AgeBand, AgePhase, Build, EnergyKey, Heritage, LookKey, Sex } from "./castingVocabularies";
import { HERITAGES, LOOK_KEYS } from "./castingVocabularies";

/**
 * The facts a chip edit may write into the brief.
 *
 * Structurally the server's `LockOverrides` (`briefCompiler.ts`) and the
 * client's (`sheetState.ts`) — all three are built from the same shared
 * vocabularies, so each caller passes its own type and neither has to import
 * the other's. It is declared here rather than imported because this module is
 * the one both sides now share (#534): a shared module reaching into `server/`
 * is exactly the dependency that would stop the client from ever calling it.
 *
 * `archetype` is `string` rather than the server's `ArchetypeKey` because the
 * archetype prose is prompt craft and stays server-side. No chip sets it — the
 * echo's fields are sex, age, heritage, build, presence and look — so the
 * client never supplies one, and the server's narrower union is assignable.
 */
export type BriefFactOverrides = Partial<{
  sex: Sex;
  ageBand: AgeBand;
  agePhase: AgePhase;
  heritage: Heritage;
  build: Build;
  energy: EnergyKey;
  look: LookKey;
  archetype: string;
}>;

/**
 * The age fact as a phrase — "in their late 40s", "in their seventies or older".
 *
 * It lives beside the rewriter that appends it; `familyClause.ts` re-exports it
 * for the follow clause, so there is ONE owner and the two surfaces cannot come
 * to word the same fact differently (working law 4).
 */
export function agePhrase(band: AgeBand, phase: AgePhase | null): string {
  const qualifier = phase ? `${phase} ` : "";
  if (band === "70s+") return `in their ${qualifier}seventies or older`;
  if (band === "teens") return `in their ${qualifier}teens`;
  return `in their ${qualifier}${band}`;
}

export type BriefEditMode = "replaced" | "appended";
export type BriefEdit = { field: keyof BriefFactOverrides; mode: BriefEditMode; to: string };
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
 * A decade with its optional phase, as the tail of an ANCHORED age statement.
 * `70s\+` is listed before `70s` and the close is `(?!\w)` rather than `\b`,
 * because a word boundary after "+" never matches and the regex would
 * silently backtrack to "70s", leaving "+" behind in the rewritten text
 * (review of PR #173, finding 4a).
 */
const DECADE =
  "(?:(?:early|mid|late)[ -])?(?:teens|20s|30s|40s|50s|60s|70s\\+|70s|twenties|thirties|forties|fifties|sixties|seventies)(?!\\w)";

/**
 * The decade only inside a fact-stating shape — "in her 30s", "in their
 * early 40s", "aged 50s". A bare token ("a 60s bouffant") is some other
 * fact's era and is never touched; the subject's age then lands by APPEND.
 * The anchor words are kept; only the decade tail is replaced.
 */
const AGE_SPAN = new RegExp(`\\b(?:in (?:her|his|their)|aged)\\s+${DECADE}`, "gi");

/** The decade tail alone, for swapping inside an anchored span. */
const DECADE_TAIL = new RegExp(DECADE, "i");

const GENDER_NOUN = /\b(?:woman|man|female|male|lady|gentleman|guy|girl|boy)\b/gi;

/** The build adjective only when anchored to the word "build" — "broad" alone is a shoulder, a smile, a brief. */
const BUILD_SPAN = /\b(?:slight|slim|average|athletic|broad|heavy)(?=[ -]build\b)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anyOf(values: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${values.map(escapeRegExp).join("|")})\\b`, "gi");
}

/**
 * A heritage word only where it describes a PERSON — "of Nordic heritage",
 * "South Asian descent", "a Mediterranean man" — never scenery ("a
 * Mediterranean rooftop" keeps its sea; the chip's heritage then APPENDS).
 */
function heritageSpan(values: readonly string[]): RegExp {
  const words = values.map(escapeRegExp).join("|");
  const person = "heritage|descent|man|woman|person|male|female|lady|gentleman|guy|girl|boy";
  return new RegExp(`\\b(?:${words})(?=\\s+(?:${person})\\b)|(?<=\\bof\\s)(?:${words})\\b`, "gi");
}

/** "in their late 40s" without the leading "in their" — the token that sits where "30s" sat. */
function ageToken(band: AgeBand, phase: AgePhase | null): string {
  const bare = band === "70s+" ? "70s" : band;
  return phase ? `${phase} ${bare}` : bare;
}

type FieldWriter = {
  field: keyof BriefFactOverrides;
  /** Spans stating the fact today; every match is replaced. */
  matcher: RegExp | null;
  /** What a matched span becomes — a function where the span's own grammar shapes the result. */
  replacement: string | ((match: string) => string);
  /** The token recorded on the edit — the primary form of the new value. */
  to: string;
  /** The plain sentence appended when no span exists. */
  appended: string;
  /**
   * Replace only when the brief holds exactly ONE span — for a fact whose
   * matcher cannot be anchored by shape (a gender noun), a second match means
   * a second person and an ambiguous subject, so the edit falls to APPEND.
   */
  requireSingle?: boolean;
};

function writersOf(overrides: BriefFactOverrides): FieldWriter[] {
  const writers: FieldWriter[] = [];
  if (overrides.ageBand) {
    const token = ageToken(overrides.ageBand, overrides.agePhase ?? null);
    writers.push({
      field: "ageBand",
      matcher: AGE_SPAN,
      /* The anchor words are hers; only the decade tail is swapped. */
      replacement: (matched) => matched.replace(DECADE_TAIL, token),
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
      requireSingle: true,
    });
  }
  if (overrides.heritage) {
    writers.push({
      field: "heritage",
      matcher: heritageSpan(HERITAGES),
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

/** The possessive that agrees with a subject of this sex. */
const POSSESSIVE: Record<Sex, string> = { female: "her", male: "his", nonbinary: "their" };

/**
 * THE POSSESSIVE FOLLOWS THE NOUN IT BELONGS TO.
 *
 * ⚠ **Found on 2026-09-05 while wiring #534, and it is a defect this file has
 * always had** — it simply could not be SEEN before. `writersOf` replaces the
 * gender NOUN and nothing else, so "a Nordic woman in her 30s" edited to male
 * came out "a Nordic man in **her** 30s". Until today that sentence went
 * straight to the engine and no human read it; from today it is written into
 * the customer's own brief box, in front of them, at the click. Broken English
 * in his box is not a thing to leave standing on the surface his eye judges.
 *
 * It is deliberately NARROW, and the attribution is **ADJACENCY**: the only
 * possessive touched is the one in an anchored age span sitting IMMEDIATELY
 * AFTER the gender noun this pass just replaced — "man **in his** 30s". That
 * is the one construction in which the pronoun provably refers to the subject,
 * because the subject noun is the word before it.
 *
 * ⚠ **TWO WEAKER ANCHORS WERE TRIED FIRST AND BOTH LET A SECOND PERSON THROUGH**
 * (rounds 1 and 2 of the review of PR #567), which is why the rule is stated
 * this way rather than as a span filter:
 *
 *   - *"every anchored span"* misgendered a second aged person —
 *     *"a woman in her 30s, her daughter in her teens"* + male gave
 *     *"…her daughter in HIS teens"*. `GENDER_NOUN` does not list "daughter",
 *     so the subject noun read as unique while the age spans did not.
 *   - *"the sole anchored span"* was no better, only rarer: **exactly one is
 *     not the same as the subject's.** When the subject's age is UNSTATED and
 *     a second person's is stated, the only span in the sentence belongs to
 *     the other person — *"a woman, her daughter in her teens"* + male gave
 *     *"a man, her daughter in HIS teens"*. Span-count was a proxy for
 *     attribution and the proxy held only when the subject happened to be
 *     among the aged.
 *
 * Adjacency is not a proxy. Everything else is left exactly alone — a bare
 * "her jacket", "his brother", or any age span belonging to someone else —
 * because nothing here can tell whose they are, and this file's standing
 * lesson (review of PR #173) is that an unanchored token is a guess. The
 * fallback is the behaviour this module had before the pass existed: a stale
 * possessive on the subject. It can leave a word behind; it cannot write a new
 * wrong one.
 *
 * It runs only where the sex was REPLACED. An APPENDED sex ("Cast a man.")
 * leaves the brief's own subject wording untouched by design, so there is no
 * noun for a possessive to have followed.
 */
function agreePossessives(text: string, sex: Sex): string {
  const possessive = POSSESSIVE[sex];
  /*
    The noun as it now reads — this runs AFTER the replacement, so the word to
    anchor on is the new one. Escaped because "androgynous person" holds a
    space and nothing else; kept in step with `BARE_NOUN` by reading it.
  */
  const noun = escapeRegExp(BARE_NOUN[sex]);
  const adjacent = new RegExp(`(\\b${noun}\\s+in\\s+)(?:her|his|their)(\\s+${DECADE})`, "gi");
  return text.replace(adjacent, (_whole, head: string, tail: string) => `${head}${possessive}${tail}`);
}

/**
 * The brief with the customer's chip edits in place, or null when there is
 * nothing to write. Appended sentences ride after the brief's own text,
 * separated by a sentence break; replaced spans leave every other byte alone.
 */
export function rewriteBrief(briefText: string, overrides: BriefFactOverrides | undefined): RewrittenBrief | null {
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
    const matches = composed ? Array.from(text.matchAll(new RegExp(composed.source, composed.flags))) : [];
    const replaceable = matches.length > 0 && (!writer.requireSingle || matches.length === 1);
    if (composed && replaceable) {
      text = text.replace(
        new RegExp(composed.source, composed.flags),
        (whole, article: string | undefined, spacing: string | undefined, articled: string | undefined) => {
          const core = articled ?? whole;
          const replaced = typeof writer.replacement === "function" ? writer.replacement(core) : writer.replacement;
          if (!article) return replaced;
          /* Sentence case survives the edit: "An athletic…" stays "A broad…" (review of #173, 4b). */
          const agreed = articleFor(replaced);
          const cased = article.charAt(0) === "A" ? `${agreed.charAt(0).toUpperCase()}${agreed.slice(1)}` : agreed;
          return `${cased}${spacing}${replaced}`;
        },
      );
      edits.push({ field: writer.field, mode: "replaced", to: writer.to });
      /*
        A replaced gender noun takes its possessives with it — see
        `agreePossessives`. Inside the loop and keyed on THIS writer, so it
        cannot fire on a brief where the sex only appended.
      */
      if (writer.field === "sex" && overrides?.sex) text = agreePossessives(text, overrides.sex);
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

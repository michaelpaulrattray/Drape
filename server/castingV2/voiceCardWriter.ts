/**
 * THE HIDDEN VOICE CARD — card #2498 (N4b), the "F" road of his listening test.
 *
 * His word, 2026-10-14: *"our voices in text are designed for the video
 * generator to generate her voice not for ellevenlabs"*, and closing the test:
 * **"F sounds awesome for both."** Arm F was a vision-capable writer
 * (`x-ai/grok-4.7` through OpenRouter) writing a voice-designer description
 * from the customer's words AND the cast's master picture, plus a line in
 * character for the three voices to read. This module is that writer, ported.
 *
 * The customer never sees the card or the line. The visible voice line stays
 * exactly as it is, for the video generator.
 *
 * # THE THREE RULES THE PICTURE MUST NOT BREAK ARE ENFORCED IN CODE, NOT ASKED
 *
 * A reader can be wrong about what it sees (law 9), and a rule that lives only
 * in a prompt is a rule the model can break (law 3). So the writer is asked for
 * the creative part — persona, emotion, pitch and texture, delivery, the line —
 * plus its proposal for sex and age, and the card's opening is COMPOSED here:
 *
 *   1. **Sex and age come from the customer's own words when they state them**
 *      ({@link sexFromWords}, {@link ageFromWords}); the writer's proposal,
 *      read off the picture, only fills what the words leave open.
 *   2. **The accent is never inferred from appearance or ethnicity.** The writer
 *      is not asked for one at all: it is the customer's own phrase when their
 *      words name an accent ({@link accentFromWords}), and "Native English"
 *      otherwise.
 *   3. **Normal speaking volume unless the customer's words ask for a whisper.**
 *      Whispered, hushed or breathy sentences are dropped from the card and the
 *      volume is stated outright ({@link asksForWhisper}).
 *
 * "The customer's own words" is {@link customerWords}: the brief they typed,
 * the sentences they gave behind either line, and either line ONLY once they
 * rewrote it — a line still in its Sign-time draft is ours, not theirs.
 *
 * # WHAT LEAVES THE BUILDING, AND TO WHOM
 *
 * The words above, the cast's description paragraph, both lines, and the
 * master picture (bounded, inline as a data URI — a URL to xAI was refused in
 * the spike and is never sent) go to OpenRouter, which routes them to xAI.
 * **xAI is a new sub-processor for this product's customer pictures.** Nothing
 * here is logged: not the words, not the card, not the line.
 */
import { createHash } from "node:crypto";

import { createModuleLogger } from "../logging/logger";
import { ProviderQueue } from "../providers/providerQueue";
import { createOpenRouterTextEngine } from "../providers/openrouterText";
import { ProviderError, type ReferenceImage, type TextEngine } from "../providers/types";
import {
  ELEVENLABS_DESCRIPTION_MAX_CHARS,
  ELEVENLABS_PREVIEW_TEXT_MAX_CHARS,
  ELEVENLABS_PREVIEW_TEXT_MIN_CHARS,
} from "../providers/elevenlabsVoice";
import type { CastVoiceCardSources } from "../db/castVoiceCards";
import { boundForJudge } from "./judgeFrame";

const log = createModuleLogger("castingV2/voiceCardWriter");

/**
 * THE WRITER, PINNED — chosen 2026-10-14 by his ear on arm F (Kiki and
 * Pigman, his account): *"F sounds awesome for both."* Arm E, our interpreter
 * model writing in the same style from the words alone, was the comparison.
 * Changing it is a decision about voices, re-asked with a listening test
 * (the disappearing-technology law, clauses 1–2), never a version bump.
 */
const VOICE_CARD_WRITER_MODEL = "x-ai/grok-4.7";

/**
 * Bumped whenever the prompt or the composition below changes, so every kept
 * card is re-written on its next design (it is part of the source hash).
 */
const VOICE_CARD_WRITER_VERSION = 1;

/** Asked of the writer; the provider's floor is 100 and its ceiling 1000. */
export const VOICE_PREVIEW_ASK = { min: 180, max: 350 } as const;

/** Parse failures happen (the spike lost three Pigman cards to them). */
const WRITER_ATTEMPTS = 2;
const WRITER_TIMEOUT_MS = 90_000;
const WRITER_MAX_OUTPUT_TOKENS = 4_000;

/** Bound on each piece of prose sent, so no single field can swamp a call. */
const SOURCE_FIELD_MAX_CHARS = 2_000;

/* ─────────────────────────────── the customer's own words ─────────────── */

/**
 * The customer's own words — the only text allowed to override the picture.
 * A line counts only once the CUSTOMER rewrote it (`…EditedAt` set).
 */
export function customerWords(sources: CastVoiceCardSources): string {
  return [
    sources.briefText,
    sources.voiceOwnWords,
    sources.personalityOwnWords,
    sources.voiceEditedAt ? sources.voice : null,
    sources.personalityEditedAt ? sources.personality : null,
  ]
    .map((text) => (text ?? "").trim())
    .filter((text) => text.length > 0)
    .join("\n");
}

/** The cast's description paragraph: `masterPrompt` up to its FRAMING block. */
export function castDescriptionParagraph(masterPrompt: string): string {
  return (masterPrompt ?? "").split(/\n\s*FRAMING:/)[0].trim().slice(0, SOURCE_FIELD_MAX_CHARS);
}

export type VoiceSex = "Female" | "Male" | "Androgynous";

const ANDROGYNOUS_WORDS = /\b(non-?binary|androgynous|genderless|agender)\b/i;
const FEMALE_WORDS =
  /\b(woman|women|girl|girls|female|lady|she|her|hers|herself|mother|mum|mom|daughter|queen|princess|wife|sister|grandmother|granny|witch|actress|heroine|matriarch|goddess)\b/i;
const MALE_WORDS =
  /\b(man|men|boy|boys|male|guy|gentleman|he|him|his|himself|father|dad|son|king|prince|husband|brother|grandfather|grandpa|wizard|actor|hero|patriarch|god)\b/i;

/**
 * A NEGATOR IMMEDIATELY IN FRONT OF SOMETHING — *"never whispers"*, *"not a
 * teenager"*, *"with no Scottish accent"*, *"rather than a murmur"*.
 *
 * ⚠ **ONE READER FOR ALL FOUR OF THIS FILE'S WORD READERS, AND THE REASON IS
 * MEASURED.** The relay's finding 4 on PR #2500 named `asksForWhisper` — a bare
 * `test`, so a brief DEMANDING the character never whisper was read as asking
 * for one. Sweeping the class (working law 7) found the SAME defect in two
 * readers the finding did not name: `ageFromWords("not a teenager")` returned
 * *"teenager"*, and `accentFromWords("with no Scottish accent")` returned
 * *"Scottish accent"* — the second hidden by `ACCENT_FILLER` swallowing the
 * *"no"* before anything could notice it. **Three readers, one mistake**, so
 * one reader answers it everywhere rather than three copies that would drift.
 *
 * Bounded to two words between the negator and the thing, so a negator earlier
 * in the sentence — *"never shouts, with a breathy edge"* — does not silence
 * something the customer really did ask for.
 */
const NEGATORS =
  /\b(never|not|no|nor|without|isn'?t|aren'?t|doesn'?t|don'?t|won'?t|avoid|avoids|avoiding|rather than|instead of|free of|far from)\s+(?:[\w'-]+\s+){0,2}$/i;

/** Whether what sits at `index` in `text` is negated by the words before it. */
function negatedAt(text: string, index: number): boolean {
  return NEGATORS.test(text.slice(0, index));
}

/** The first match of `pattern` that the words do not negate, or `null`. */
function firstUnnegated(pattern: RegExp, text: string): RegExpExecArray | null {
  /* `exec` in a loop rather than `matchAll`: no `target` is set in this
     repository's tsconfig, so iterating an iterator in production source is a
     `pnpm check` error (it compiles only in the excluded test files). */
  const scan = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match = scan.exec(text);
  while (match !== null) {
    if (!negatedAt(text, match.index)) return match;
    match = scan.exec(text);
  }
  return null;
}

/** Where a pattern first matches UN-NEGATED, or `Infinity` when it does not. */
function firstMatchAt(pattern: RegExp, text: string): number {
  return firstUnnegated(pattern, text)?.index ?? Number.POSITIVE_INFINITY;
}

/**
 * Sex as the customer's words state it, or `null` when they name none.
 *
 * ⚠ **THE EARLIEST GENDERED WORD WINS, BECAUSE IT IS THE BRIEF'S SUBJECT.**
 * This asked `female && !male` until the relay's finding 3 on PR #2500, so any
 * brief that mentioned somebody ELSE settled nothing: *"a woman searching for
 * her lost son"* hits both lists, returned `null`, and handed the decision to
 * the PICTURE — which is the exact female-written-as-male failure this whole
 * card exists to close. A brief names its subject before it names anyone
 * else's relatives, so the first gendered word is the one the customer meant.
 *
 * **Where only one sex is named the answer is unchanged** — the old rule is a
 * special case of this one, not a second road beside it, so nothing that read
 * correctly before can read differently now.
 *
 * Its limit, stated rather than left to be discovered: a brief whose first
 * gendered word belongs to somebody else (*"my son's teacher, a stern woman"*)
 * is read wrong. That is a floor and not coverage — and it is still strictly
 * better than the picture deciding, which is what used to happen.
 */
export function sexFromWords(words: string): VoiceSex | null {
  if (ANDROGYNOUS_WORDS.test(words)) return "Androgynous";
  const female = firstMatchAt(FEMALE_WORDS, words);
  const male = firstMatchAt(MALE_WORDS, words);
  if (female === male) return null;
  return female < male ? "Female" : "Male";
}

const AGE_PATTERNS: readonly RegExp[] = [
  /\b\d{1,3}[- ]?(?:years?|yrs?)[- ]old\b/i,
  /\baged? \d{1,3}\b/i,
  /\b(?:early|mid|late)[- ]?(?:teens|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties|[1-9]0s)\b/i,
  /\bin (?:her|his|their) (?:teens|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties|[1-9]0s)\b/i,
  /\b(?:teenage|teenager|elderly|middle-aged|adolescent)\b/i,
];

/**
 * The age the customer's words state, verbatim, or `null`.
 *
 * ⚠ A NEGATED age is not a stated one — *"not a teenager"* used to return
 * *"teenager"* and put it in the card's opening clause. See {@link NEGATORS}:
 * this is the same defect as the whisper reader's, found by its sweep.
 */
export function ageFromWords(words: string): string | null {
  for (const pattern of AGE_PATTERNS) {
    const match = firstUnnegated(pattern, words);
    if (match) return match[0].trim();
  }
  return null;
}

const ACCENT_FILLER = new Set([
  "a", "an", "the", "with", "and", "in", "of", "her", "his", "their", "its", "has", "have", "speaks",
  "speaking", "voice", "no", "any", "some", "real", "own", "native",
  /* Determiners and counts carry no accent either — "one brass accent". */
  "one", "two", "three", "single", "few", "just", "only",
]);

/**
 * A FURNISHING, NOT A VOICE — the nouns that follow a decorative "accent", and
 * the colours and materials that stand in front of one. A real accent is named
 * by a PLACE or a thickness; nobody has ever had a brass one.
 */
const ACCENT_DECORATION_NOUNS =
  /^(colour|color|colours|colors|wall|walls|lighting|light|lights|piece|pieces|detail|details|trim|cushion|cushions|pillow|pillows|rug|rugs|chair|chairs|table|tables|lamp|lamps|tile|tiles|paint|furniture|fabric|stitching|panel|panels|stripe|stripes)\b/i;
const ACCENT_DECORATION_WORDS = new Set([
  "red", "blue", "green", "gold", "golden", "brass", "copper", "black", "white", "silver", "teal",
  "pink", "orange", "purple", "violet", "yellow", "grey", "gray", "brown", "cream", "navy", "beige",
  "bronze", "chrome", "pastel", "metallic", "wooden", "leather", "velvet",
  /* ⚠ ONE GLOWING COLOUR IS DELIBERATELY ABSENT, AND IT CANNOT BE NAMED HERE:
     `d246VerificationBar.test.ts` bans that word from EVERY source file —
     comments included, since it lowercases the whole file — so that
     fable-166's never-built iris refusal cannot creep back in. A decorative
     colour in an accent list is not that refusal, but the guard is blunt on
     purpose and the word earns this list nothing, so the list gives way
     rather than the guard. (It caught this on the first preflight.) */
]);

/**
 * The accent the customer's words NAME — their own phrase, e.g. "thick
 * Scottish accent" — or `null`. Never anything read off a picture.
 *
 * ⚠ **A DECORATIVE "ACCENT" IS NOT AN ACCENT** (the relay's finding 4 on PR
 * #2500): *"a red accent colour"* in a brief about a jacket read as a speech
 * accent and went into the card's opening clause. Two refusals, both narrow:
 * a furnishing noun behind the word, and a phrase in front of it made only of
 * colours and materials. Neither can refuse a place-named accent, because a
 * place is in neither list.
 */
export function accentFromWords(words: string): string | null {
  const match = words.match(/((?:[A-Za-z][A-Za-z'-]*\s+){1,3})accent\b/i);
  if (!match || match.index === undefined) return null;
  if (ACCENT_DECORATION_NOUNS.test(words.slice(match.index + match[0].length).trimStart())) return null;
  /*
    ⚠ A NEGATED accent is not a named one — *"with no Scottish accent"* used to
    return "Scottish accent", and `ACCENT_FILLER` swallowing the "no" is what
    hid it. The negator can sit INSIDE the captured phrase as well as in front
    of it, which is why both are read. See {@link NEGATORS}.
  */
  if (negatedAt(words, match.index) || NEGATORS.test(`${match[1]} `)) return null;
  const kept = match[1].trim().split(/\s+/);
  while (kept.length > 0 && ACCENT_FILLER.has(kept[0].toLowerCase())) kept.shift();
  if (kept.length === 0 || kept.every((word) => ACCENT_FILLER.has(word.toLowerCase()))) return null;
  if (kept.every((word) => ACCENT_DECORATION_WORDS.has(word.toLowerCase()))) return null;
  return `${kept.join(" ")} accent`;
}

const WHISPER_WORDS = /\b(whisper\w*|hushed|hush|breathy|breathily|murmur\w*|sotto voce|barely audible|inaudible)\b/i;

/**
 * Whether these words ask for a whisper — used BOTH on the customer's words and
 * on each of the writer's own sentences, so one reader answers the question
 * everywhere it is asked (working law 4).
 *
 * ⚠ **NEGATION IS HONOURED** (the relay's finding 4 on PR #2500): this was a
 * bare `test`, so *"never whispers"* asked for a whisper — and the card then
 * dropped its own "Normal speaking volume." line on a brief that had demanded
 * exactly that. A text that negates one and asks for another (*"never whispers,
 * but a breathy edge"*) still asks: the answer is true when ANY match stands
 * un-negated.
 *
 * Its limit: a negator this list does not hold (*"nothing whispered"*) reads as
 * an ask. A floor, and it fails toward the card being quieter than asked rather
 * than louder.
 */
export function asksForWhisper(words: string): boolean {
  return firstUnnegated(WHISPER_WORDS, words) !== null;
}

/**
 * Dialect words that name an accent WITHOUT the word "accent" — the shape that
 * let *"a Scottish lilt"* and *"a Southern drawl"* through the body on a brief
 * that named no accent at all (the relay's finding 4 on PR #2500). The "never
 * from appearance" rule was enforced on the literal word alone.
 */
const DIALECT_WORDS = /\b(lilt|lilting|lilts|drawl|drawls|drawling|brogue|twang|twangy|burr|dialect|patois|vernacular)\b/i;

/* ───────────────────────────────────────────────────── the writer ─────── */

function voiceCardSystemPrompt(): string {
  return [
    "You are a voice director writing a Voice Design card for one character in a film studio.",
    "Write vividly and naturally — a casting note a sound designer would love, not a checklist.",
    "",
    "You are given the customer's own words, the character's description, two lines about who the",
    "character is and how they come across on camera, and (when present) the character's picture.",
    "",
    "Return ONLY a JSON object with exactly these keys:",
    '  "sex": "female" | "male" | "androgynous" — the CUSTOMER\'S WORDS decide when they say it; the',
    "         picture only fills what the words leave open.",
    '  "age": an age range such as "late 20s to early 30s" — the customer\'s words decide when they',
    "         state an age; otherwise read it from the picture and the description.",
    '  "body": the card from "Persona:" onwards, in this order: "Persona: …", "Emotion: …", then pitch',
    '         and texture (say "low-pitched" or "deep", never a bare "low"), then delivery and pace, then',
    "         what kind of person this voice belongs to. Do NOT mention an accent, the sex or the age —",
    "         those are added separately. The voice speaks at a normal speaking volume: never describe it",
    "         as whispered, hushed or breathy unless the customer's own words ask for that.",
    `  "preview": ${VOICE_PREVIEW_ASK.min}–${VOICE_PREVIEW_ASK.max} characters this character would plausibly say,`,
    "         in English, plain speech — no stage directions, no brackets, no sound effects.",
    "",
    "Never name a real person or a known fictional character.",
    "",
    "An example of the body wanted, for a different character:",
    "Persona: weathered lighthouse keeper who has outlived most of their stories. Emotion: patient, wry,",
    "stubborn underneath. Deep, low-pitched chest voice with a salt-worn, gravelly texture and a little",
    "air at the ends of words. Unhurried delivery, long vowels, a dry half-laugh before the punchline.",
    "Speaks like someone who has said everything twice and means it more the second time.",
  ].join("\n");
}

function userTurn(sources: CastVoiceCardSources, hasPicture: boolean): string {
  const bound = (text: string | null | undefined) => (text ?? "").trim().slice(0, SOURCE_FIELD_MAX_CHARS);
  const words = customerWords(sources);
  return [
    hasPicture ? "IMAGE 1 is the character's master picture." : "There is no picture — work from the words alone.",
    "",
    "THE CUSTOMER'S OWN WORDS:",
    words ? bound(words) : "(none)",
    "",
    "THE CHARACTER'S DESCRIPTION:",
    bound(castDescriptionParagraph(sources.masterPrompt)) || "(none)",
    "",
    `WHO THEY ARE ON CAMERA: ${bound(sources.personality) || "(none)"}`,
    `HOW THEY SOUND ON CAMERA (written for a video generator): ${bound(sources.voice) || "(none)"}`,
  ].join("\n");
}

export type WrittenVoiceCard = {
  voiceCard: string;
  previewLine: string;
  writerModel: string;
  latencyMs: number;
  tokens?: { in: number; out: number };
  /**
   * Whether the master picture ACTUALLY went with the ask.
   *
   * ⚠ **THE CALLER HASHES WHAT WAS SENT, NOT WHAT IT MEANT TO SEND** (the
   * relay's finding 2 on PR #2500). The picture can fall away inside this
   * function — {@link boundForJudge} throws and the ask goes with words alone —
   * and the caller cannot see that from the outside. It used to key the kept
   * card on the picture's storage key regardless, so a words-only card was
   * filed under the with-picture hash and reused for the life of the cast: the
   * picture was bought and never read, and nothing would ever try again.
   */
  withPicture: boolean;
};

type WriterDraft = { sex: string; age: string; body: string; preview: string };

/** The reply, read strictly. `null` when it is not the four strings. */
export function parseVoiceCardDraft(text: string): WriterDraft | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const draft = parsed as Partial<Record<keyof WriterDraft, unknown>>;
  if (
    typeof draft.sex !== "string"
    || typeof draft.age !== "string"
    || typeof draft.body !== "string"
    || typeof draft.preview !== "string"
  ) {
    return null;
  }
  return { sex: draft.sex, age: draft.age, body: draft.body, preview: draft.preview };
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normaliseSex(value: string): VoiceSex | null {
  const lower = value.trim().toLowerCase();
  if (lower === "female") return "Female";
  if (lower === "male") return "Male";
  if (lower === "androgynous") return "Androgynous";
  return null;
}

/**
 * Whether a sentence names the OTHER sex than the one the opening states — a
 * contradiction the opening cannot win on its own, because the voice designer
 * reads the whole card. `null` sex contradicts nothing; for an androgynous
 * cast either named sex is the contradiction.
 */
function namesOtherSex(sentence: string, sex: VoiceSex | null): boolean {
  if (!sex) return false;
  const female = FEMALE_WORDS.test(sentence);
  const male = MALE_WORDS.test(sentence);
  if (sex === "Female") return male;
  if (sex === "Male") return female;
  return female || male;
}

/**
 * THE CARD, COMPOSED — where the three rules are enforced. Pure, exported, and
 * driven directly by the suite with drafts that break every rule, because a
 * backstop that is only ever tested through a model that usually behaves is
 * untested (law 3).
 *
 * ⚠ **THE OPENING IS NOT ENOUGH ON ITS OWN, AND THAT WAS THE DEFECT** (the
 * relay's findings 3 and 4 on PR #2500). Sex, age and the accent were fixed in
 * the opening clause and then left to be contradicted three sentences later —
 * *"a gravelly man's baritone"* under `Female, late 20s.`, or *"a soft Scottish
 * lilt"* under `Native English.` The voice designer reads the whole card and
 * has no reason to prefer the first sentence, so a rule enforced in the opening
 * alone is a rule the body breaks. **Every one of them is now enforced across
 * the whole card**, by dropping the sentence that breaks it.
 */
export function composeVoiceCard(draft: WriterDraft, words: string): { voiceCard: string; previewLine: string } {
  const accent = accentFromWords(words);
  const sex = sexFromWords(words) ?? normaliseSex(draft.sex);
  const age = ageFromWords(words) ?? (draft.age.trim().slice(0, 48) || null);
  const whisper = asksForWhisper(words);

  const opening = [
    accent ? `${accent.charAt(0).toUpperCase()}${accent.slice(1)}.` : "Native English.",
    sex && age ? `${sex}, ${age}.` : sex ? `${sex}.` : age ? `${age.charAt(0).toUpperCase()}${age.slice(1)}.` : null,
    "Studio quality.",
  ].filter((part): part is string => Boolean(part));

  /*
    THE BODY LOSES EVERY SENTENCE THAT WOULD OVERRIDE THE OPENING: any accent
    or "Studio quality" the writer added anyway; a dialect named where the
    customer named none; the other sex; an age where the opening already gives
    one; and — unless the customer asked for one — anything whispered, hushed
    or breathy.

    A dropped sentence costs one line of prose the writer was told not to write
    ("Do NOT mention an accent, the sex or the age"), and a kept one costs the
    voice designer a card that argues with itself. The trade is not close.
  */
  const body = sentences(draft.body).filter((sentence) => {
    if (/\baccent\b|\bnative english\b/i.test(sentence)) return false;
    if (!accent && DIALECT_WORDS.test(sentence)) return false;
    if (/^studio quality/i.test(sentence)) return false;
    if (!whisper && asksForWhisper(sentence)) return false;
    if (namesOtherSex(sentence, sex)) return false;
    if (age && ageFromWords(sentence)) return false;
    return true;
  });
  const closing = !whisper && !body.some((sentence) => /\bnormal (?:speaking )?volume\b/i.test(sentence))
    ? ["Normal speaking volume."]
    : [];

  /* Within the provider's ceiling, cut at a sentence and never mid-word. */
  const fixed = [...opening, ...closing].join(" ").length + 1;
  const kept: string[] = [];
  let length = fixed;
  for (const sentence of body) {
    if (length + sentence.length + 1 > ELEVENLABS_DESCRIPTION_MAX_CHARS) break;
    kept.push(sentence);
    length += sentence.length + 1;
  }
  const voiceCard = [...opening, ...kept, ...closing].join(" ");

  /* Stage directions read aloud are a defect, so any bracketed run goes. */
  const previewLine = draft.preview
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { voiceCard, previewLine };
}

/** sha256 of everything a card is written from — never the sources themselves. */
export function voiceCardSourceHash(sources: CastVoiceCardSources, pictureKey: string | null): string {
  return createHash("sha256")
    .update(JSON.stringify([
      VOICE_CARD_WRITER_VERSION,
      VOICE_CARD_WRITER_MODEL,
      sources.briefText ?? null,
      castDescriptionParagraph(sources.masterPrompt),
      sources.personality ?? null,
      sources.voice ?? null,
      sources.personalityOwnWords ?? null,
      sources.voiceOwnWords ?? null,
      Boolean(sources.personalityEditedAt),
      Boolean(sources.voiceEditedAt),
      pictureKey,
    ]))
    .digest("hex");
}

let writerEngine: TextEngine | null = null;

/** The production engine, or `null` with no OpenRouter credential. */
export function voiceCardWriterEngine(): TextEngine | null {
  if (!writerEngine) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    writerEngine = createOpenRouterTextEngine({
      apiKey,
      model: VOICE_CARD_WRITER_MODEL,
      queue: new ProviderQueue({ name: "openrouter-voice-card", concurrency: 2, maxQueueDepth: 32 }),
    });
  }
  return writerEngine;
}

/**
 * Write one cast's card. Throws a {@link ProviderError} when no usable card
 * came back — the voice road then refuses before any voice is designed, rather
 * than falling back to the line that gave a cast written as female three male voices.
 */
export async function writeVoiceCard(input: {
  sources: CastVoiceCardSources;
  picture: ReferenceImage | null;
  engine: TextEngine;
  signal?: AbortSignal;
}): Promise<WrittenVoiceCard> {
  let image: ReferenceImage | null = null;
  if (input.picture) {
    try {
      image = (await boundForJudge(input.picture)).image;
    } catch {
      /*
        ⚠ **THIS CATCH CANNOT FIRE TODAY, AND IT IS LABELLED SO NOBODY READS IT
        AS A ROAD.** `boundForJudge`'s own contract is *"never throws"* — it
        fails OPEN by design and hands back the original bytes with the record
        reading `unreadable`, so a picture that sharp cannot measure still goes
        to the writer. The relay's finding 2 on PR #2500 named this as one of
        two ways a card could lose its picture, read off the shape rather than
        the contract; it is kept as depth against that contract changing, never
        as evidence the road exists. **The road that IS real is the one before
        this function** — the bytes failing to read at all, in `voiceService`'s
        `ensureVoiceCard` — and `withPicture` below answers for both, which is
        why the repair did not need this clause to be reachable.
      */
      log.warn("[voiceCard] the master picture could not be bounded — writing from the words alone");
    }
  }

  const words = customerWords(input.sources);
  let lastFailure: ProviderError | null = null;
  for (let attempt = 1; attempt <= WRITER_ATTEMPTS; attempt += 1) {
    const reply = await input.engine.complete({
      system: voiceCardSystemPrompt(),
      user: userTurn(input.sources, Boolean(image)),
      about: "voice.card",
      ...(image ? { images: [image] } : {}),
      temperature: 0.7,
      maxOutputTokens: WRITER_MAX_OUTPUT_TOKENS,
      timeoutMs: WRITER_TIMEOUT_MS,
      retries: 1,
      signal: input.signal,
    });
    const draft = reply.truncated ? null : parseVoiceCardDraft(reply.text);
    if (!draft) {
      lastFailure = new ProviderError("capability", "The voice card writer returned no usable card", {
        providerRef: reply.provenance?.providerRef,
      });
      log.warn({ attempt, truncated: reply.truncated }, "[voiceCard] unusable reply");
      continue;
    }
    const composed = composeVoiceCard(draft, words);
    if (
      composed.previewLine.length < ELEVENLABS_PREVIEW_TEXT_MIN_CHARS
      || composed.previewLine.length > ELEVENLABS_PREVIEW_TEXT_MAX_CHARS
    ) {
      /* Never padded by repetition — a repeated line is a worse audition. */
      lastFailure = new ProviderError("capability", "The voice card writer's preview line is out of bounds");
      log.warn({ attempt, previewChars: composed.previewLine.length }, "[voiceCard] preview line out of bounds");
      continue;
    }
    return {
      ...composed,
      writerModel: VOICE_CARD_WRITER_MODEL,
      latencyMs: reply.latencyMs,
      ...(reply.tokens ? { tokens: reply.tokens } : {}),
      withPicture: Boolean(image),
    };
  }
  throw lastFailure ?? new ProviderError("capability", "The voice card writer returned no usable card");
}

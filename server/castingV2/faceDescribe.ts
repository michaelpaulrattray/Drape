/**
 * WHAT THE SCAN CAN SAY ABOUT THE TWO FEATURES NOBODY IS ALLOWED TO PHOTOGRAPH
 * (fable-388 §1 and fable-389 §1).
 *
 * # The founder's own look at the shipped panel
 *
 * *"Obviously missing her body"*, and then, the same evening, her skin. Both
 * rows exist in the catalogue and neither appears on a face nobody has edited,
 * because a row draws when it has a picture or something said about it and
 * those two have neither.
 *
 * # And they are missing for a REASON that is written down
 *
 * `build` and `skin` are the only two rows in the whole catalogue carrying
 * `question: { from: "none" }` — the scan is structurally forbidden to picture
 * them, with the reasons in the catalogue itself:
 *
 * ```
 * build  "a crop of HER filed as her build is a second master" — measured at
 *        +7% to +10% face-height drift when a reference at the wrong scale rides
 *        a render (fable-381 §A.5)
 * skin   "a face crop filed as her skin is a partial wearing the name of the
 *        whole ... it would read complete against the wrong boundary"
 * ```
 *
 * So words are not a fallback for these two. **They are the only honest answer,
 * and the catalogue said so before anybody noticed the rows were empty.**
 *
 * # THIS IS DISPLAY, AND IT NEVER BECOMES AN INSTRUCTION
 *
 * The scan mints nothing (fable-373 ruling 4a) and this widens that promise
 * rather than bending it: a description produced here is handed to the PANEL and
 * to nothing else. It is not a library row, so it is never carried into a
 * recipe, never composed into a prompt, and never checked by the verification
 * net. That boundary is the whole reason this can exist at all — a sentence a
 * reader invented about a person, riding into every future render of her, is
 * D-183's crime with better manners.
 *
 * # A DESCRIPTION IT CANNOT MAKE IS NO DESCRIPTION
 *
 * `null` rather than a hedge, for `presentationState`'s reason said about prose
 * instead of pins: the panel is her record, and a row saying something vague
 * about her is worse than a row that is not there — she cannot tell an invented
 * sentence from a read one, and it is written under her own face.
 *
 * # What it may not say
 *
 * The frame is waist-up by construction (`castingFrame.ts`: every roll is asked
 * for *"from mid-torso up in a 2:3 portrait"*, and the delivered masters were
 * opened and looked at). A description that mentions a waist, hips, legs or
 * height is describing a photograph that does not exist — the same law that
 * made the waist leave the recipe, applied to the words that describe her.
 */
import { createModuleLogger } from "../logging/logger";
import { catalogueSlots, isAskable } from "./referenceSlotCatalogue";
import { interpreterEngine } from "./interpreter";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/faceDescribe");

/** One line each, or null where the photograph will not support one. */
export type FaceDescriptions = {
  build: string | null;
  skin: string | null;
  teeth: string | null;
};

/**
 * The shape the FIRST bench's two arms answer in — build and skin, no teeth.
 *
 * They are kept because they are the artifact the shipped arm was chosen on,
 * and a bench arm that quietly grew a third question would make its own result
 * unreproducible. Nothing in the product calls them.
 */
export type TwoQuestionDescriptions = Omit<FaceDescriptions, "teeth">;

/**
 * The rules both arms are given, verbatim, so the arms differ in ONE thing.
 *
 * A bench whose arms differ in their prompts as well as their call count cannot
 * attribute what it measures — the reason the mirror experiment kept its
 * phrasings identical across sides.
 */
const RULES = [
  "You are looking at a casting portrait. Describe ONLY what this photograph shows.",
  "",
  "THE FRAME: the picture is cropped at roughly the lower ribs. Her waist, hips, legs",
  "and height are NOT in it. Never mention them — describing what the camera did not",
  "take is describing a different photograph.",
  "",
  "Each answer is ONE short phrase, six to twelve words, in the voice of a casting",
  "director's note. Not a sentence about her as a person, not a compliment, not a",
  "judgement about her health or her weight, and never a guess at her age or ancestry.",
  "",
  "If the photograph does not let you answer one of them — the light is flat, the",
  "shoulders are out of shot, the skin is not readable — answer null for that one.",
  "A null is a better answer than a safe phrase that would fit anybody: what you write",
  "is shown to her under her own picture, as a description of her.",
].join("\n");

/**
 * THE FEATURES THIS READER SPEAKS FOR, and the check that they are the right
 * ones.
 *
 * Not a list of what the panel is missing — a list would drift the moment the
 * catalogue grew a third row that can never be pictured. `describedFeatures()`
 * DERIVES that set from the catalogue (a row of its own, and no question a
 * segmenter could be asked), and `assertEveryDescribedFeatureHasAnAsk` refuses
 * at the call site if the two disagree. A new wordless row would otherwise be
 * silently empty forever, which is the defect this whole chunk exists to fix,
 * arriving a second time.
 */
export const DESCRIBED_ASKS: Record<string, string> = {};

const BUILD_ASK = [
  "HER BUILD: her frame and her shoulder line as this photograph shows them —",
  'e.g. "narrow-shouldered and slight, long neck" or "broad through the shoulders, athletic".',
].join("\n");

const SKIN_ASK = [
  "HER SKIN: its tone and its surface —",
  'e.g. "warm olive, freckled across the nose" or "fair and even, a light flush on the cheeks".',
  "Her skin, not her makeup and not the lighting.",
].join("\n");

/**
 * HER TEETH — joined on fable-402 §2's own conditional, after the bench.
 *
 * The ask is written against the catalogue's reason for refusing teeth a
 * picture — *"that question is the mouth, so a crop of it filed as her teeth is
 * the lips' crop under a second name"*. The same mistake in words is a line
 * about her lips filed as a line about her teeth, so it is forbidden by name,
 * along with the worse one: describing what a closed mouth hides.
 */
const TEETH_ASK = [
  "HER TEETH: only if her teeth can actually be SEEN in this photograph —",
  'what the picture shows of them, e.g. "even and bright, a small gap at the front".',
  "If her lips are together, or her mouth is closed, or her teeth are not visible for any",
  "other reason, answer null for this one. Never describe her lips, her mouth or her smile",
  "here — those are not her teeth — and never guess at what a closed mouth is hiding.",
].join("\n");

DESCRIBED_ASKS.build = BUILD_ASK;
DESCRIBED_ASKS.skin = SKIN_ASK;
DESCRIBED_ASKS.teeth = TEETH_ASK;

/**
 * The features that draw a row and can never be photographed — derived.
 *
 * `isAskable` false is the catalogue saying no segmenter can be asked for this
 * slot — either it has no question at all, or its region is composed and its key
 * is not a question anyone may ask (her build). `panel.row === "own"` is it
 * saying the row is drawn anyway. Exactly those two facts together mean "a row
 * that can only ever hold words", and
 * build and skin are the only members today. cheekbones, jaw and chin have no
 * question either and draw NO row (`STRUCTURE_IS_WORDS`), so they are correctly
 * outside this set rather than excluded by name.
 */
export function describedFeatures(): string[] {
  return Array.from(new Set(
    catalogueSlots()
      .filter((definition) => !isAskable(definition) && definition.panel.row === "own")
      .map((definition) => definition.feature),
  )).sort();
}

/**
 * A ROW THAT DRAWS, CANNOT BE PICTURED, AND IS DELIBERATELY NOT DESCRIBED —
 * with the reason, because "nobody wrote one" is not one.
 *
 * **Empty today, and that is a result rather than an oversight.** `teeth` lived
 * here from the moment the guard below found it (the founder named body and
 * skin from his own look at the panel; the catalogue said there were THREE rows
 * in that state) until the bench fable-402 §2 ordered was run. It is now asked,
 * so the exception is spent. The record of why is in {@link describeFace}.
 *
 * The next wordless row the catalogue grows lands here or in `DESCRIBED_ASKS`,
 * and the guard refuses until one of them is chosen deliberately.
 */
export const NOT_DESCRIBED: Record<string, string> = {};

/** Refuse rather than describe half the rows that need describing. */
export function assertEveryDescribedFeatureHasAnAsk(features: readonly string[] = describedFeatures()): void {
  const missing = features.filter((feature) => !(feature in DESCRIBED_ASKS) && !(feature in NOT_DESCRIBED));
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(", ")} draws a panel row and has no question a segmenter can answer, and no `
      + `description ask either — its row would be permanently empty. Give it an ask in `
      + `DESCRIBED_ASKS, or a written reason in NOT_DESCRIBED`,
    );
  }
}

/** The reply shape, parsed defensively — a model's JSON is input, not a promise. */
function readLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const plain = value.trim().replace(/\s+/g, " ");
  if (!plain || /^(null|none|n\/a|unknown|unclear)$/i.test(plain)) return null;
  /*
    A PHRASE, NOT AN ESSAY. The bar the arms were measured under is a casting
    note; a paragraph has not obeyed the instruction the measurement was made
    on, and it would be rendered into a row built for one line.
  */
  if (plain.length > 120) return null;
  return plain;
}

function parse(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

type ReadInput = {
  bytes: Buffer;
  contentType: string;
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

async function ask(
  input: ReadInput,
  user: string,
  keys: readonly string[],
): Promise<Record<string, string | null>> {
  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  const blank = Object.fromEntries(keys.map((key) => [key, null]));
  if (!engine) {
    /* No transport, no description — the scan's own rule: it degrades to
       today's panel rather than to an error or to a guess. */
    return blank;
  }
  try {
    const reply = await engine.complete({
      system: RULES,
      user,
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      /* ROOM FOR THE TRANSPORT'S OWN PREAMBLE, measured rather than guessed.
         At 200 this engine returned an empty completion with `finishReason:
         length` on a two-field JSON ask — it spends output tokens before the
         object, and the ceiling is what it hit. A ceiling costs nothing unused
         (billing is per token produced) and an empty completion here would
         degrade to "no description", which is indistinguishable from a face the
         reader honestly could not describe. */
      maxOutputTokens: 600,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    const parsed = parse(reply.text ?? "");
    if (!parsed) return blank;
    return Object.fromEntries(keys.map((key) => [key, readLine(parsed[key])]));
  } catch (error) {
    log.warn({ err: error }, "[faceDescribe] could not read the frame — no description");
    return blank;
  }
}

/**
 * ARM 3Q — one read, all three descriptions. **This is the shipped reader.**
 *
 * Deliberately identical to {@link describeTogether} in everything but the
 * question list: the arms of the bench that compared them differ in ONE thing,
 * which is the rule the mirror experiment and the first describe bench were
 * both built on. What it cost to add the third question, measured rather than
 * assumed, is recorded on {@link describeFace}.
 */
export async function describeWithTeeth(input: ReadInput): Promise<FaceDescriptions> {
  const answered = await ask(
    input,
    [
      BUILD_ASK, "", SKIN_ASK, "", TEETH_ASK, "",
      'Reply with JSON: {"build": "...", "skin": "...", "teeth": "..."} and nothing else.',
    ].join("\n"),
    ["build", "skin", "teeth"],
  );
  return {
    build: answered.build ?? null,
    skin: answered.skin ?? null,
    teeth: answered.teeth ?? null,
  };
}

/**
 * ARM A — one read, both descriptions.
 *
 * The cheap arm, and the one with the failure mode worth measuring: a single
 * read can blur the two, answering the same observation twice in different
 * words. That is the same shape as a normalizer answering one word to
 * everything, so it needs a discriminating bar rather than a plausibility read.
 */
export async function describeTogether(input: ReadInput): Promise<TwoQuestionDescriptions> {
  const answered = await ask(
    input,
    [BUILD_ASK, "", SKIN_ASK, "", 'Reply with JSON: {"build": "...", "skin": "..."} and nothing else.'].join("\n"),
    ["build", "skin"],
  );
  return { build: answered.build ?? null, skin: answered.skin ?? null };
}

/**
 * ARM B — one read each, so neither question can hear the other's answer.
 *
 * Twice the calls (~$0.01 apiece on the interpreter transport, house money
 * either way) and it cannot blur by construction.
 */
export async function describeSeparately(input: ReadInput): Promise<TwoQuestionDescriptions> {
  const [build, skin] = await Promise.all([
    ask(input, [BUILD_ASK, "", 'Reply with JSON: {"build": "..."} and nothing else.'].join("\n"), ["build"]),
    ask(input, [SKIN_ASK, "", 'Reply with JSON: {"skin": "..."} and nothing else.'].join("\n"), ["skin"]),
  ]);
  return { build: build.build ?? null, skin: skin.skin ?? null };
}

/**
 * THE ARM, SET BY THE MEASUREMENT (fable-389 §1: *"measure, don't guess"*).
 *
 * `bench-face-describe-disposable.mts`, six dev faces spread evenly across the
 * pool, four bars written into the script before the first call, both judges
 * given a control that had to fire and did:
 *
 * ```
 *            coverage      discrimination   blurs   below-the-crop
 *  arm A     6/6 · 6/6     11/12  PASS       0        0            ← ships
 *  arm B     6/6 · 6/6      9/12  FAIL       0        0
 * ```
 *
 * **The worry the bench was ordered for did not happen, and its opposite did.**
 * One read was supposed to risk BLURRING the two subjects; it blurred none, and
 * it was the SEPARATE reads that produced interchangeable notes — all three of
 * arm B's misses were on `build`, where a question asked with nothing else in
 * view drifted to what any slim person looks like ("slim shoulders, medium
 * frame" twice, and the garment named in three of six). Asked together, each
 * answer has the other to be different from.
 *
 * Bar 1 is the one to read: without it, arm B looks like a clean pass on every
 * other column while describing nobody in particular.
 *
 * # AND THEN THE THIRD QUESTION (fable-402 §2, `bench-teeth-describe-disposable.mts`)
 *
 * `teeth` was held out of that chunk because the verdict above is a fact about
 * a TWO-question reader. The second bench ran the shipped arm and the
 * three-question arm on the same six faces on the same evening, so the cost of
 * the third question is attributable rather than atmospheric:
 *
 * ```
 *            coverage      discrimination   blurs   below-the-crop
 *  arm 2Q    6/6 · 6/6     12/12            0        0
 *  arm 3Q    6/6 · 6/6     12/12            0        0            ← ships
 * ```
 *
 * It cost nothing, and two bars were added for the question teeth actually
 * raises:
 *
 * - **NO INVENTION — 0 of 17.** Every distinct dev master answers `null` for
 *   teeth. Every frame this product CASTS has a closed mouth by prompt law
 *   (`cohortPhotorealHuman.ts`: *"Mouth closed, lips together and relaxed …
 *   a broad smile is not"*), so this is the column where a sentence about
 *   teeth nobody can see would have appeared. None did.
 * - **CAN BE ANSWERED.** Seventeen nulls are only evidence if the reader could
 *   have said something. It can: on three synthetic smiling fixtures it
 *   answered 3/3 and a judge matched note to face 3/3 — and then on a REAL
 *   product frame, a delivered `"give her a broad smile"` refine, it wrote
 *   *"even and white, upper row shown in smile"*, which is what the picture
 *   shows and only what it shows.
 *
 * The row still draws nothing on a closed mouth: no content, no row, which is
 * the founder's own panel rule doing the work.
 */
export const describeFace = describeWithTeeth;

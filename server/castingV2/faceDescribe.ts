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
import { catalogueSlots } from "./referenceSlotCatalogue";
import { interpreterEngine } from "./interpreter";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/faceDescribe");

/** One line each, or null where the photograph will not support one. */
export type FaceDescriptions = {
  build: string | null;
  skin: string | null;
};

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

DESCRIBED_ASKS.build = BUILD_ASK;
DESCRIBED_ASKS.skin = SKIN_ASK;

/**
 * The features that draw a row and can never be photographed — derived.
 *
 * `question === null` is the catalogue saying there is no honest question for
 * this slot; `panel.row === "own"` is it saying the row is drawn anyway. Exactly
 * those two facts together mean "a row that can only ever hold words", and
 * build and skin are the only members today. cheekbones, jaw and chin have no
 * question either and draw NO row (`STRUCTURE_IS_WORDS`), so they are correctly
 * outside this set rather than excluded by name.
 */
export function describedFeatures(): string[] {
  return Array.from(new Set(
    catalogueSlots()
      .filter((definition) => definition.question === null && definition.panel.row === "own")
      .map((definition) => definition.feature),
  )).sort();
}

/**
 * A ROW THAT DRAWS, CANNOT BE PICTURED, AND IS DELIBERATELY NOT DESCRIBED —
 * with the reason, because "nobody wrote one" is not one.
 *
 * `teeth` was found by the guard below on its first run, which is the guard
 * earning itself: the founder named body and skin from his own look at the
 * panel, and the catalogue says there are THREE rows in that state. It is not
 * quietly bundled in, for a reason that is about the measurement rather than
 * about teeth: {@link describeFace}'s arm was chosen on a bench that asked
 * TWO questions in one read, and its discrimination bar is a fact about that
 * artifact. A third question makes it a different reader, and adopting a
 * measured verdict for an unmeasured thing is how a number outlives what it
 * was measured on.
 *
 * Filed for a ruling (opus-310), not forgotten.
 */
export const NOT_DESCRIBED: Record<string, string> = {
  teeth:
    "found by this guard rather than by anybody's eye, and held out of the chunk that "
    + "shipped build and skin: the one-read arm was MEASURED on two questions and a third "
    + "would make it an unmeasured reader. A closed mouth is also the common case in a "
    + "casting portrait, so the honest answer would be null on most frames — which is a "
    + "reason to price the read before buying it, not a reason to skip the row forever",
};

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
 * ARM A — one read, both descriptions.
 *
 * The cheap arm, and the one with the failure mode worth measuring: a single
 * read can blur the two, answering the same observation twice in different
 * words. That is the same shape as a normalizer answering one word to
 * everything, so it needs a discriminating bar rather than a plausibility read.
 */
export async function describeTogether(input: ReadInput): Promise<FaceDescriptions> {
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
export async function describeSeparately(input: ReadInput): Promise<FaceDescriptions> {
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
 */
export const describeFace = describeTogether;

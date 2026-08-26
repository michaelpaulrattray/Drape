/**
 * THE LOCKED HOUSE BLOCK — appended by CODE after the author's text, on every
 * roll of the author road, never written or edited by the model (founder,
 * ruling §5c, verbatim: *"why was camera language, framing, world never
 * locked in the prompt? our original studio produces amazingly high quality
 * realistic casts because of all the locked micro-details, negatives, camera
 * language, lighting, and so on … the author only changes the prompt
 * content"*; #139).
 *
 * # What it is — REBUILT to §5d + §5e (#144)
 *
 * The first cut of this file (PR #141) DERIVED the block from the old
 * studio's arrays by filtering, and the founder read the prompt behind rolls
 * 221/222 and ruled on what came out (§5e, verbatim): *"Keep everything
 * except lighting + those two conflicts"* — *"it will reproduce your current
 * flash studio, not the two editorials."* So this file now OWNS the block's
 * sentences. What it still takes from `cohortPhotorealHuman.ts` it takes by
 * name (`take` — exactly one match or the module refuses to load), so the
 * house composer's own bytes cannot move under it unseen and this file cannot
 * quietly hold a second copy of a sentence the cohort also owns (law 4). What
 * it no longer takes is listed here, sentence by sentence:
 *
 *   - LIGHTING → his line verbatim (§5e). OUT: the flash line (*"Direct
 *     on-camera … front flash … No gels, no diffusion"*), *"How the skin
 *     RESPONDS to this light"* (it addresses the flash block by name), *"Specular
 *     highlights sit … where the flash strikes"*, and the BACKGROUND's flash
 *     falloff sentence — his line carries the falloff itself.
 *   - EXPRESSION → his line verbatim (§5e). OUT: the four cohort expression
 *     sentences (the one naming *"the DIRECTION block"* has no referent here).
 *   - COLOUR → his line verbatim (§5e). OUT: *"5500–5800K … warm and
 *     dimensional"* — one skin temperature, cool-neutral.
 *   - POSTURE → §5d's rule, one line: faces the camera, still, casting
 *     presence — not a pose. OUT: *"head straight with no tilt"*, *"Shoulders
 *     level, spine straight … Arms relaxed at the sides. Mouth closed."* A hand
 *     raised to an eyepatch, a slight tilt, a closed-mouth snarl: admissible.
 *   - NEGATIVES → logos / watermarks / captions / signage, and props /
 *     furniture / environment / scene. OUT: the mouth / teeth / laugh / hand
 *     line, and *"NO text, letters, numbers, words"* — text is allowed (§5d).
 *   - PHOTOREAL-ONLY → out of the UNIVERSAL block and into the photoreal
 *     PRESET's own sentences (`PHOTOREAL_PRESET`, §5d: *"photoreal is default
 *     for photoreal not everything"*). ⚠ The preset is STILL APPENDED on every
 *     roll today, because photoreal is the only style and the default (ruling
 *     §2); the settings modal (#142) is what makes it a choice. Splitting the
 *     constant without the modal changes no bytes' MEANING — it moves the ban
 *     to the place the modal will swap.
 *   - AUTHORITY → rewritten to the road: settings are DEFAULTS and the
 *     description overrides them (ruling rules 5/8). The old paragraph said the
 *     block *"always wins"* over the description, which is the compiler's
 *     contract and not the author's.
 *
 * KEPT from the cohort, by name: the two hair-silhouette CROP sentences, the
 * BACKGROUND sentence, the CAMERA sensor/lens line, the noise line, and the
 * three REALISM micro-detail sentences. Chest-up framing is
 * `AUTHOR_ROAD_FRAMING`, calibrated by #130 against his two reference frames.
 *
 * # Guards (in the suite)
 *
 * Present byte-identical at the END of every authored prompt; the author's
 * text contains none of its sentences; it carries no word from
 * `NEVER_WRITTEN`; it contains none of the dropped phrases (the forbidden-
 * token arm — the thing #144 exists for); his three §5e lines appear in it
 * verbatim; the universal block carries no style word.
 *
 * # Two limits, declared rather than implied (review of #141, still true)
 *
 *   - `containsHouseSentence` is a VERBATIM backstop: it catches a draft that
 *     copies a block sentence and nothing else. A MAX draft that PARAPHRASES
 *     camera language passes it and competes with the block — the primary
 *     control against that is the instruction (`NO_STUDIO_RULE`) and the gate
 *     is the founder's eye on the frames.
 *   - `take` ASSERTS AT MODULE LOAD, and this module is imported
 *     unconditionally through `promptAuthor.ts` → `briefCompiler.ts`, so an
 *     edit to the cohort's arrays that removes or duplicates a sentence taken
 *     here fails boot for EVERY account, not just the flagged road. The next
 *     editor of those arrays meets this file here, not in a production boot
 *     loop.
 */
import { PHOTOREAL_HUMAN_BLOCKS } from "./cohortPhotorealHuman";

/** Exactly one sentence of `from` starts with `prefix`, or the module refuses to load. */
function take(from: readonly string[], prefix: string): string {
  const hits = from.filter((sentence) => sentence.startsWith(prefix));
  if (hits.length !== 1) {
    throw new Error(`[houseBlock] the cohort's sentences moved — expected exactly one starting "${prefix}", found ${hits.length}`);
  }
  return hits[0]!;
}

/**
 * Chest-up, his word — the framing pair. Calibrated by #130; "collarbones",
 * never the breastbone. *"head straight with no tilt"* is out (§5d).
 */
export const AUTHOR_ROAD_FRAMING: readonly string[] = [
  "FRAMING: Single figure only, chest-up, centred, square to camera.",
  "Frame from the chest up in a 2:3 portrait: the crop just below the collarbones, shoulders running off both edges of the frame, a small margin of headroom above the hair.",
];

/** §5d, his words paraphrased into one rule: *"casting posture communicates energy/vibe not a pose."* */
export const POSTURE_LINE =
  "POSTURE: Faces the camera and holds still — casting presence, not a pose. No turned-away heads.";

/** §5e, verbatim. */
export const LIGHTING_LINE =
  "LIGHTING: Large soft frontal key just above the lens, high fill, open shadows. Soft chin and jaw shadow only. Grey seamless slightly brighter behind the head, gentle falloff to the edges, no hard vignette. Minimal rim. No coloured gels. Speculars appear where the person's skin and wardrobe naturally catch the source — not as a forced flash sheen on every face.";

/** §5e, verbatim (the label is the block's own convention; his words are untouched after it). */
export const EXPRESSION_LINE =
  "EXPRESSION: Eyes into the lens, present, mouth closed. Self-possessed. No broad smile, no laugh, no blank stare, no horror grimace.";

/** §5e, verbatim (same convention). */
export const COLOUR_LINE = "COLOUR: Neutral daylight, 5500K. Skin stays true to the person. No teal-orange, no beauty-app grade.";

/** §5d: logos/watermarks/captions/signage and props/environment/scene. Text on a garment is admissible. */
export const NEGATIVE_LINES: readonly string[] = [
  "NO logos, watermarks, captions or signage anywhere in the frame.",
  "NO props, furniture, environment, location or scene — the backdrop is empty studio paper.",
];

/**
 * The photoreal PRESET's own sentences — the style ban lives here and not in
 * the universal block (§5d). Today's only preset and the default; #142's
 * modal is what makes it a choice. The ban was MOVED, not re-ruled, so it is
 * TAKEN from the cohort by name (law 4; review of #145 finding 1) — the day the
 * modal forks the preset is the day this becomes its own text, declared.
 */
export const PHOTOREAL_PRESET: readonly string[] = [
  `STYLE: ${take(PHOTOREAL_HUMAN_BLOCKS.negativeSentences, "PHOTOREALISTIC ONLY")}`,
  take(PHOTOREAL_HUMAN_BLOCKS.negativeSentences, "NO CGI"),
];

/** Rules 5/8: the block is the studio's defaults; a fact the description states beats any default or negative in it. */
export const AUTHORITY_LINE =
  "AUTHORITY: The description says WHO to cast; this block says HOW the studio photographs them by default. "
  + "Anything the description states outright — a look, a feature, a garment, a mood — is a fact and overrides any default or negative here. "
  + "Where the description is silent, this block governs: plain studio frame, no scene, no props.";

const framingSentences: readonly string[] = [
  ...AUTHOR_ROAD_FRAMING,
  take(PHOTOREAL_HUMAN_BLOCKS.framingSentences, "CROP: The subject's ENTIRE HAIR SILHOUETTE"),
  take(PHOTOREAL_HUMAN_BLOCKS.framingSentences, "Nothing on the head is clipped"),
  POSTURE_LINE,
  EXPRESSION_LINE,
  take(PHOTOREAL_HUMAN_BLOCKS.framingSentences, "BACKGROUND:"),
];

const captureSentences: readonly string[] = [
  take(PHOTOREAL_HUMAN_BLOCKS.captureSentences, "CAMERA:"),
  take(PHOTOREAL_HUMAN_BLOCKS.captureSentences, "Fine luminance-dominant noise"),
  LIGHTING_LINE,
  COLOUR_LINE,
];

/** The block minus the style preset — what every preset will share once there is more than one. */
export const UNIVERSAL_BLOCK_SENTENCES: readonly string[] = [
  ...framingSentences,
  ...captureSentences,
  ...PHOTOREAL_HUMAN_BLOCKS.realismSentences,
  ...NEGATIVE_LINES,
];

/** Every sentence of the block, in order — exported so the suite can assert the author wrote none of them. */
export const HOUSE_BLOCK_SENTENCES: readonly string[] = [...UNIVERSAL_BLOCK_SENTENCES, ...PHOTOREAL_PRESET, AUTHORITY_LINE];

/**
 * The block as sent: framing, capture, realism and negatives as one paragraph
 * each, the preset, then the authority paragraph last.
 */
export const HOUSE_BLOCK: string = [
  framingSentences.join(" "),
  captureSentences.join(" "),
  PHOTOREAL_HUMAN_BLOCKS.realismSentences.join(" "),
  NEGATIVE_LINES.join(" "),
  PHOTOREAL_PRESET.join(" "),
  AUTHORITY_LINE,
].join("\n");

/**
 * The phrases §5d/§5e took OUT, each with the sentence it lived in — the
 * forbidden-token arm reads this list, so a re-derivation from the cohort
 * cannot bring one back unnoticed (#144).
 */
export const DROPPED_FROM_BLOCK: ReadonlyArray<{ phrase: string; from: string }> = [
  { phrase: "no tilt", from: "FRAMING (§5d posture)" },
  { phrase: "Shoulders level", from: "pose line (§5d)" },
  { phrase: "Arms relaxed", from: "pose line (§5d)" },
  /* Not the bare word: his own LIGHTING line says "not as a forced flash sheen". These are the flash STUDIO's phrases. */
  { phrase: "front flash", from: "LIGHTING (§5e)" },
  { phrase: "flash strikes", from: "speculars sentence (§5e)" },
  { phrase: "flash falls off", from: "BACKGROUND falloff sentence (§5e)" },
  { phrase: "No gels, no diffusion", from: "LIGHTING (§5e)" },
  { phrase: "warm and dimensional", from: "COLOUR (§5e)" },
  { phrase: "5800K", from: "COLOUR (§5e)" },
  { phrase: "cool clinical", from: "COLOUR (§5e)" },
  { phrase: "open mouth", from: "NEGATIVES (§5d)" },
  { phrase: "showing teeth", from: "NEGATIVES (§5d)" },
  { phrase: "hand gestures", from: "NEGATIVES (§5d)" },
  { phrase: "letters, numbers", from: "NEGATIVES — text allowed (§5d)" },
  { phrase: "DIRECTION block", from: "EXPRESSION (dangling referent)" },
  { phrase: "Eight candidates", from: "CAPTURE (set narration, §5b)" },
  { phrase: "always wins", from: "AUTHORITY (rule 8)" },
  { phrase: "waist-up", from: "FRAMING (chest-up, §3a)" },
  { phrase: "mid-torso", from: "FRAMING (chest-up, §3a)" },
  { phrase: "sternum", from: "FRAMING (court §4)" },
];

/*
  THE FORBIDDEN-TOKEN GUARD, at module load (#144): if any dropped phrase is
  back in the block — a re-derivation from the cohort, a pasted old line —
  the module refuses to load, on every account, before a single roll composes
  the flash studio again. The suite's arm proves the list reads real sentences
  (each phrase IS in the old studio's block); this proves the block is clean.
*/
{
  const lower = HOUSE_BLOCK.toLowerCase();
  for (const { phrase, from } of DROPPED_FROM_BLOCK) {
    if (lower.includes(phrase.toLowerCase())) {
      throw new Error(`[houseBlock] "${phrase}" is back in the locked block (dropped from ${from} by §5d/§5e, #144)`);
    }
  }
}

/** True when `text` contains any sentence of the block — the author is never allowed to. */
export function containsHouseSentence(text: string): string | null {
  const lower = text.toLowerCase();
  for (const sentence of HOUSE_BLOCK_SENTENCES) {
    if (lower.includes(sentence.toLowerCase())) return sentence;
  }
  return null;
}

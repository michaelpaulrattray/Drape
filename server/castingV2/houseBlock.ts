/**
 * THE LOCKED HOUSE BLOCK — appended by CODE after the author's text, on every
 * roll of the author road, never written or edited by the model (founder,
 * ruling §5c, verbatim: *"why was camera language, framing, world never
 * locked in the prompt? our original studio produces amazingly high quality
 * realistic casts because of all the locked micro-details, negatives, camera
 * language, lighting, and so on … the author only changes the prompt
 * content"*; #139).
 *
 * # What it is
 *
 * The OLD studio's locked block — the CAPTURE, REALISM, FRAMING and NEGATIVES
 * material of `cohortPhotorealHuman.ts` plus its AUTHORITY paragraph — and
 * NOT the anatomy, identity, priority or dice blocks, which authored the
 * person and are retired on this road (ruling §2 rule 7). It is DERIVED from
 * that module's exported sentences (working law 4: a second copy of the camera
 * block is a copy that drifts), with the differences below stated by name.
 *
 * # Reviewed once for competing instructions (§5c), each exclusion named
 *
 *   - FRAMING: the house composer's two framing sentences say *waist-up* /
 *     *mid-torso up*. The author road is CHEST-UP by his own word (rule 11a,
 *     §3a's reference frame, §5b's block), so those two are replaced by
 *     `AUTHOR_ROAD_FRAMING` — the only sentences here not taken from the
 *     cohort verbatim. #130 calibrates their numbers to his 28% head-share
 *     frame; nothing else in this file is #130's.
 *   - FRAMING: the expression sentence that names *"the DIRECTION block"* is
 *     dropped — no such block exists on this road, and a dangling referent is
 *     an instruction the engine resolves by ignoring it.
 *   - CAPTURE: *"Eight candidates must not share one skin…"* is dropped — it
 *     narrates the SET, which is exactly the language that painted contact-
 *     sheet grids on dev roll 95 (§5b's rule: no pipeline notes in the prompt).
 *   - REALISM: only the three skin-realism sentences; EYES / CATCHLIGHTS /
 *     SCLERA and the rest are the anatomy blocks and stay retired.
 *
 * # Guards (in the suite)
 *
 * Present byte-identical at the END of every authored prompt; the author's
 * text contains none of its sentences; it carries no word from
 * `NEVER_WRITTEN`; it changes only with the settings modal (the style preset;
 * advanced framing/lighting later) — which today means it is a tested constant.
 */
import { PHOTOREAL_HUMAN_BLOCKS } from "./cohortPhotorealHuman";

/**
 * Chest-up, his word — the two sentences that replace the cohort's waist-up
 * pair. Calibrated by #130; "collarbones", never the breastbone.
 */
export const AUTHOR_ROAD_FRAMING: readonly string[] = [
  "FRAMING: Single figure only, chest-up, centred, square to camera, head straight with no tilt.",
  "Frame from the chest up in a 2:3 portrait: the crop just below the collarbones, shoulders running off both edges of the frame, a small margin of headroom above the hair.",
];

const DIRECTION_REFERENT = "Unless the DIRECTION block names";
const SET_SENTENCE = "Eight candidates must not share one skin";
const WAIST_UP = "waist-up";
const MID_TORSO = "Frame from mid-torso up";

/** The cohort's framing sentences with the two waist-up ones and the DIRECTION referent out, by name. */
function framingSentences(): string[] {
  const kept = PHOTOREAL_HUMAN_BLOCKS.framingSentences.filter(
    (sentence) => !sentence.includes(WAIST_UP) && !sentence.startsWith(MID_TORSO) && !sentence.includes(DIRECTION_REFERENT),
  );
  if (kept.length !== PHOTOREAL_HUMAN_BLOCKS.framingSentences.length - 3) {
    throw new Error("[houseBlock] the cohort's framing sentences moved — the three named exclusions no longer match exactly three sentences");
  }
  return [...AUTHOR_ROAD_FRAMING, ...kept];
}

function captureSentences(): string[] {
  const kept = PHOTOREAL_HUMAN_BLOCKS.captureSentences.filter((sentence) => !sentence.startsWith(SET_SENTENCE));
  if (kept.length !== PHOTOREAL_HUMAN_BLOCKS.captureSentences.length - 1) {
    throw new Error("[houseBlock] the cohort's capture sentences moved — the set sentence is no longer exactly one of them");
  }
  return kept;
}

/** Every sentence of the block, in order — exported so the suite can assert the author wrote none of them. */
export const HOUSE_BLOCK_SENTENCES: readonly string[] = [
  ...framingSentences(),
  ...captureSentences(),
  ...PHOTOREAL_HUMAN_BLOCKS.realismSentences,
  ...PHOTOREAL_HUMAN_BLOCKS.negativeSentences,
];

/**
 * The block as sent: framing, capture, realism and negatives as one paragraph
 * each (the cohort's own joining), then the authority paragraph last — the
 * sentence that says the photograph is not up for negotiation.
 */
export const HOUSE_BLOCK: string = [
  framingSentences().join(" "),
  captureSentences().join(" "),
  PHOTOREAL_HUMAN_BLOCKS.realismSentences.join(" "),
  PHOTOREAL_HUMAN_BLOCKS.negativeSentences.join(" "),
  PHOTOREAL_HUMAN_BLOCKS.authority,
].join("\n");

/** True when `text` contains any sentence of the block — the author is never allowed to. */
export function containsHouseSentence(text: string): string | null {
  const lower = text.toLowerCase();
  for (const sentence of [...HOUSE_BLOCK_SENTENCES, PHOTOREAL_HUMAN_BLOCKS.authority]) {
    if (lower.includes(sentence.toLowerCase())) return sentence;
  }
  return null;
}

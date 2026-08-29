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
 *   - EXPRESSION → his line verbatim (§5e, NARROWED by §5f, #146). OUT: the
 *     four cohort expression sentences (the one naming *"the DIRECTION
 *     block"* has no referent here) — and then, by §5f, *"Self-possessed"*
 *     and *"no broad smile … no horror grimace"*: mood is the CAST layer's
 *     (*"'Never grim, sullen or severe' kills a war orc, a villain, a stern
 *     founder"*). What stays universal is the geometry of an expression.
 *   - COLOUR → his line verbatim (§5e, NARROWED by §5f, #146). OUT: *"5500–5800K
 *     … warm and dimensional"* — and then, by §5f, the 5500K pin and the
 *     teal-orange / beauty-app grade language: skin temperature and finish
 *     come from the person (*"porcelain-pale is that goth brief's; 'warm and
 *     dimensional' would fail a weathered man or a white orc"*). §5e's
 *     "cool-neutral" is withdrawn as universal.
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
 * # ⚠ THE BLOCK HAS TWO LANES NOW — #232 and #237, 2026-08-29
 *
 * It was ONE text for every subject this studio casts, and the founder found
 * the two places where the human rules break a creature. His words, one
 * message each:
 *
 *   - *"Creature mouths are broken by the human headshot rule. Fix the house
 *     block by lane. People / androids that read as people — Mouth closed. …
 *     Creatures — Mouth is anatomy when it's who they are. … Still ban: laugh,
 *     speech, acted roar, poster tongue-out. … Pose off. Anatomy on."* (#232)
 *   - *"Listed anatomy is losing to the human crop. `long tail` is in the
 *     brief. The generations still have no tail. Chest-up + square-on +
 *     shoulders off the edges hides it behind the back and cuts it off. More
 *     adjectives will not fix that."* (#237)
 *
 * Both are the same law he has now ruled three times — the mechanical eye
 * (#185 reply #28), the tusks, the tail: **if it is who they are, show it.**
 * And both are properties of the LOCKED BLOCK rather than of the author's
 * paragraph, because an adjective cannot out-argue a crop and a ban on teeth
 * cannot be talked round by taste.
 *
 * The split is deliberately as small as a split can be: **two sentences**, one
 * SWAPPED (`EXPRESSION_LINE` → `CREATURE_EXPRESSION_LINE`) and one ADDED
 * (`ANATOMY_VISIBILITY_LINE`, which the human lane does not have at all). The
 * suite asserts that difference set exactly, so a third divergence cannot
 * arrive without saying so, and it asserts that
 * `houseBlockForStyle("photoreal")` is `HOUSE_BLOCK` byte for byte — **every
 * human roll, and every roll off this road, receives what it received before
 * this commit.**
 *
 * The lane is chosen by the READER's four-valued subject answer
 * (`houseLaneFor`), once per roll, in `briefCompiler.ts`. Never per slice,
 * never by scanning the brief for creature words here, and never by the style
 * — a style is a bundle (#142) and a lane is a subject; they are different
 * questions and they compose (`houseBlockForStyle(style, lane)`).
 *
 * # Guards (in the suite)
 *
 * Present byte-identical at the END of every authored prompt; the author's
 * text contains none of its sentences; it carries no word from
 * `NEVER_WRITTEN`; it contains none of the dropped phrases (the forbidden-
 * token arm — the thing #144 exists for); his §5e lighting line and his §5f expression and colour lines appear
 * in it verbatim; the universal block carries no style word.
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
import type { CastStyle } from "../../shared/castStyles";
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
 * Mid-torso, his word — the framing pair. Founder (terminal, 2026-08-27,
 * verbatim): *"our pictures are 2:3 the one i sent you was 9:16 i wanted to
 * test the framing on 2:3 same as our cards it works. chest up is far too
 * tight we need to see the outfit more. run it"* — with his own 2:3 reference
 * filed at `docs/specs/references/prompt-author/framing-reference-midtorso-2x3.png`
 * (measured: face share 22.0%). This REVERSES §3a's chest-up ruling and
 * supersedes his reply-#13 F2 pick, so "mid-torso" comes OFF the
 * forbidden-token list in the same commit (#182).
 *
 * The second sentence is written to the reference's MEASURED geometry and
 * courted (#182, `docs/specs/FRAMING_COURT_2_2026-08-27.md`): delivered
 * median 23.0% face share (20.7–28.1, n=10) against the old pair's 32.1%
 * replication — the outfit's upper body visible on every delivered frame.
 * The trim's T moved to 0.230 with it (interplay declared on the card);
 * the mid-torso sentence refused 6/16 vs K's 1/8 on the goth brief — the
 * per-render coin (#93), recorded for #129.
 *
 * RATIFIED at his eye, so this pair is settled rather than provisional —
 * Crew reply #19, 2026-08-27 20:53:16Z, verbatim: *"M — the framing is
 * right, keep it as the default. The refusal rate on M needs figuring out
 * (fewer on the second pass, so it smells like the coin again) — put it on
 * the refusal patrol, but don't hold the framing on it."* #182 closed on
 * that word. The revert the court held in reserve is off the table, and the
 * refusal number is #129's, NOT a reason to touch these two sentences: he
 * said so in the same breath he approved them.
 */
export const AUTHOR_ROAD_FRAMING: readonly string[] = [
  "FRAMING: Single figure only, mid-torso up, centred, square to camera.",
  "Frame from mid-torso up in a 2:3 portrait: the face takes up about a fifth of the frame's height, the eyes about a third of the way down from the top edge, a small margin of headroom above the hair, the crop line at mid-torso between the chest and the waist so the outfit's upper body is fully visible, both shoulders fully inside the frame with air at both sides.",
];

/** §5d, his words paraphrased into one rule: *"casting posture communicates energy/vibe not a pose."* */
export const POSTURE_LINE =
  "POSTURE: Faces the camera and holds still — casting presence, not a pose. No turned-away heads.";

/** §5e, verbatim. */
export const LIGHTING_LINE =
  "LIGHTING: Large soft frontal key just above the lens, high fill, open shadows. Soft chin and jaw shadow only. Grey seamless slightly brighter behind the head, gentle falloff to the edges, no hard vignette. Minimal rim. No coloured gels. Speculars appear where the person's skin and wardrobe naturally catch the source — not as a forced flash sheen on every face.";

/**
 * §5f, verbatim (the label is the block's own convention; his words are
 * untouched after it). ONLY the geometry of an expression is universal —
 * "self-possessed", "severe", "warm" are the seed's or the author's, per cast.
 *
 * ⚠ **THIS IS THE HUMAN LANE'S LINE NOW, NOT THE BLOCK'S** (#232). It is
 * unchanged byte for byte and every human roll still receives it; a creature
 * roll receives `CREATURE_EXPRESSION_LINE` instead. See `HouseLane` below.
 */
export const EXPRESSION_LINE = "EXPRESSION: Eyes into the lens, present, mouth closed. No laugh, no speech, no blank CGI stare.";

/**
 * THE CREATURE LANE'S EXPRESSION LINE (#232) — founder, verbatim (terminal,
 * 2026-08-29): *"Creature mouths are broken by the human headshot rule. Fix
 * the house block by lane. People / androids that read as people — Mouth
 * closed. No teeth, no tongue, no laugh, no speech. Creatures — Mouth is
 * anatomy when it's who they are. Allow at rest: oni tusks / non-human
 * dentition · underbites, split lips · a long tongue if it's in the upload as
 * a species trait. Still ban: laugh, speech, acted roar, poster tongue-out.
 * … Same law as the mechanical eye and the tail. Pose off. Anatomy on."*
 *
 * `mouth closed` is what strips a tusked being of its own dentition, so the
 * geometry becomes **mouth at rest** and his own sentence — *pose off, anatomy
 * on* — carries the logic. Every ban he kept is kept, in his own nouns; the
 * one he did not name (`no blank CGI stare`) survives because it is the human
 * line's and has nothing to do with the mouth.
 */
export const CREATURE_EXPRESSION_LINE =
  "EXPRESSION: Eyes into the lens, present, mouth at rest — pose off, anatomy on. "
  + "Where the mouth is the being's own anatomy it stays visible at rest: non-human dentition, tusks, an underbite, a split lip, a species tongue. "
  + "No laugh, no speech, no acted roar, no tongue out as a pose, no blank CGI stare.";

/**
 * THE CREATURE LANE'S ANATOMY VISIBILITY CLAUSE (#237 half 2) — founder,
 * verbatim: *"Listed anatomy is losing to the human crop. `long tail` is in
 * the brief. The generations still have no tail. Chest-up + square-on +
 * shoulders off the edges hides it behind the back and cuts it off. More
 * adjectives will not fix that."* — with his own house-block sentence: *"If
 * the being has a tail, wing, or other listed anatomy, it must be visible in
 * the chest-up frame — over a shoulder, beside the ribcage, or rising into
 * the picture. Do not hide it behind the back. Do not switch to a full-body
 * shot."*
 *
 * ⚠ **TWO WORDS OF HIS SENTENCE ARE ADAPTED AND BOTH ARE DECLARED HERE, because
 * the block would otherwise argue with itself.**
 *
 *   - *"the chest-up frame"* → *"this frame"*. The block's own crop has been
 *     MID-TORSO since #182, on his own reversal (*"chest up is far too tight
 *     we need to see the outfit more"*), and `AUTHOR_ROAD_FRAMING` says so two
 *     sentences earlier. Naming a second crop here would hand the engine two.
 *     His diagnosis is about the crop HIDING anatomy, and the crop's name is
 *     the block's, not this sentence's.
 *   - *"other listed anatomy"* → *"other anatomy the description names"*.
 *     "Listed" has no referent inside the block; `AUTHORITY_LINE` already
 *     establishes "the description" as the thing that states facts.
 *
 * His three placements and both prohibitions are verbatim.
 */
export const ANATOMY_VISIBILITY_LINE =
  "ANATOMY: If the being has a tail, wings, or other anatomy the description names, it must be visible in this frame "
  + "— over a shoulder, beside the ribcage, or rising into the picture. Do not hide it behind the back. Do not switch to a full-body shot.";

/**
 * WHICH LANE THE BLOCK IS COMPOSED IN (#232, #237) — the founder's own split:
 * *"People / androids that read as people"* against *"Creatures"*.
 *
 * The lane is chosen ONCE per roll, from what the READER established about the
 * subject (`register.subject`, the four-valued question of the ruling's §6) —
 * never by a per-slice guess, and never by scanning the brief for creature
 * words here.
 *
 * ⚠ **THE WRONG-LANE FAILURE MODE, both directions, stated rather than
 * assumed.** A creature brief the reader calls `human` gets the strict human
 * line — which is exactly today's behaviour for every roll, so a misread costs
 * the feature and never a regression. A human brief the reader calls `being`
 * gets the creature line and the anatomy clause; both are CONDITIONAL prose
 * (*"where the mouth is the being's own anatomy"*, *"if the being has a tail,
 * wings, or other anatomy the description names"*), so on a human they assert
 * nothing. That asymmetry is deliberate: the reader's mistakes are cheap in
 * one direction and free in the other.
 */
export type HouseLane = "human" | "creature";
export const HOUSE_LANES = ["human", "creature"] as const satisfies readonly HouseLane[];
export const DEFAULT_HOUSE_LANE: HouseLane = "human";

/**
 * The reader's subject reading → the lane. `being` is the creature lane;
 * `human`, `unread` (the reply could not be parsed and the sheet went out on
 * the verbatim brief) and an absent reading are all the human lane, because
 * the human lane is today's bytes and an unknown subject must not change them.
 */
export function houseLaneFor(subject: "human" | "being" | "unread" | null | undefined): HouseLane {
  return subject === "being" ? "creature" : "human";
}

/** §5f, verbatim (same convention). No temperature pin, no grade language: the person decides. */
export const COLOUR_LINE = "COLOUR: Neutral daylight. Skin colour and sheen come from the person, not from a house grade.";

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

/**
 * The framing paragraph, per lane. The two lanes differ in EXACTLY two places
 * and nowhere else, which is what makes "the human lane is byte-identical to
 * today" a property of the code rather than a claim in a docblock:
 *
 *   - the EXPRESSION sentence (#232), and
 *   - the ANATOMY sentence (#237), which the creature lane ADDS and the human
 *     lane does not have at all.
 *
 * The anatomy clause sits with the crop sentences on purpose: it is a FRAMING
 * fact, which is his own diagnosis (*"More adjectives will not fix that"*).
 */
function framingSentencesFor(lane: HouseLane): readonly string[] {
  return [
    ...AUTHOR_ROAD_FRAMING,
    take(PHOTOREAL_HUMAN_BLOCKS.framingSentences, "CROP: The subject's ENTIRE HAIR SILHOUETTE"),
    take(PHOTOREAL_HUMAN_BLOCKS.framingSentences, "Nothing on the head is clipped"),
    ...(lane === "creature" ? [ANATOMY_VISIBILITY_LINE] : []),
    POSTURE_LINE,
    lane === "creature" ? CREATURE_EXPRESSION_LINE : EXPRESSION_LINE,
    take(PHOTOREAL_HUMAN_BLOCKS.framingSentences, "BACKGROUND:"),
  ];
}

const framingSentences: readonly string[] = framingSentencesFor("human");

const captureSentences: readonly string[] = [
  take(PHOTOREAL_HUMAN_BLOCKS.captureSentences, "CAMERA:"),
  take(PHOTOREAL_HUMAN_BLOCKS.captureSentences, "Fine luminance-dominant noise"),
  LIGHTING_LINE,
  COLOUR_LINE,
];

/** Every sentence of a lane's block, in order — the suite asserts the author wrote none of them. */
/** The block minus the style preset — what every preset will share once there is more than one. HUMAN lane's. */
export const UNIVERSAL_BLOCK_SENTENCES: readonly string[] = [
  ...framingSentences,
  ...captureSentences,
  ...PHOTOREAL_HUMAN_BLOCKS.realismSentences,
  ...NEGATIVE_LINES,
];

/** Every sentence of the HUMAN lane's block, in order — the meaning this constant has always had. */
export const HOUSE_BLOCK_SENTENCES: readonly string[] = [...UNIVERSAL_BLOCK_SENTENCES, ...PHOTOREAL_PRESET, AUTHORITY_LINE];

/**
 * Every sentence of a lane's block, in order. The HUMAN lane RETURNS
 * `HOUSE_BLOCK_SENTENCES` itself rather than rebuilding the same list beside
 * it (working law 4) — which also keeps that constant wired to production
 * code rather than to the suite alone, the thing `pnpm check`'s uncalled-
 * export sweep caught the first time this function was written.
 */
export function houseBlockSentencesFor(lane: HouseLane): readonly string[] {
  if (lane === "human") return HOUSE_BLOCK_SENTENCES;
  return [
    ...framingSentencesFor(lane),
    ...captureSentences,
    ...PHOTOREAL_HUMAN_BLOCKS.realismSentences,
    ...NEGATIVE_LINES,
    ...PHOTOREAL_PRESET,
    AUTHORITY_LINE,
  ];
}

/**
 * The block as sent: framing, capture, realism and negatives as one paragraph
 * each, the preset, then the authority paragraph last.
 */
function composeBlock(lane: HouseLane): string {
  return [
    framingSentencesFor(lane).join(" "),
    captureSentences.join(" "),
    PHOTOREAL_HUMAN_BLOCKS.realismSentences.join(" "),
    NEGATIVE_LINES.join(" "),
    PHOTOREAL_PRESET.join(" "),
    AUTHORITY_LINE,
  ].join("\n");
}

/** THE HUMAN LANE'S BLOCK — what every roll received before #232/#237, and what every human roll still receives. */
export const HOUSE_BLOCK: string = composeBlock("human");

/** THE CREATURE LANE'S BLOCK (#232, #237) — the same bytes with his two sentences swapped in. */
export const CREATURE_HOUSE_BLOCK: string = composeBlock("creature");

/**
 * THE BLOCK, CHOSEN BY STYLE (#142, the minimal settings modal) — the style
 * selector swaps the PRESET here and nowhere else (ruling §3 rule 11a: *"a
 * style is a bundle"*). One member today, so every roll still receives
 * `HOUSE_BLOCK` byte for byte; the exhaustive switch is what makes a second
 * style a compile error at this one site until its preset is written,
 * declared and courted — never a silent fall-through to the photoreal bytes.
 */
export function houseBlockForStyle(style: CastStyle, lane: HouseLane = DEFAULT_HOUSE_LANE): string {
  switch (style) {
    case "photoreal":
      return lane === "creature" ? CREATURE_HOUSE_BLOCK : HOUSE_BLOCK;
    default: {
      const never: never = style;
      throw new Error(`[houseBlock] no preset for style ${String(never)}`);
    }
  }
}

/**
 * The phrases §5d/§5e/§5f took OUT, each with the sentence it lived in — the
 * forbidden-token arm reads this list, so a re-derivation from the cohort
 * cannot bring one back unnoticed (#144). The §5f entries guard the HOUSE
 * layer only: this list is read against `HOUSE_BLOCK`, never against the
 * seed or the author's text, where "self-possessed" stays legal (#146).
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
  /* §5f (#146): mood and skin temperature belong to the CAST layer. */
  { phrase: "self-possessed", from: "EXPRESSION (§5f — mood is the cast's)" },
  { phrase: "horror grimace", from: "EXPRESSION (§5f — mood is the cast's)" },
  { phrase: "5500K", from: "COLOUR (§5f — no temperature pin)" },
  { phrase: "teal-orange", from: "COLOUR (§5f — no house grade)" },
  /* Review of #147: the other two §5f drops, so the guard holds the property its docblock claims, not the suite alone.
     "beauty-app grade" and never "beauty-app": the preset KEEPS the cohort's "beauty-app smoothing" style ban by name. */
  { phrase: "broad smile", from: "EXPRESSION (§5f — mood is the cast's)" },
  { phrase: "beauty-app grade", from: "COLOUR (§5f — no house grade)" },
  { phrase: "open mouth", from: "NEGATIVES (§5d)" },
  { phrase: "showing teeth", from: "NEGATIVES (§5d)" },
  { phrase: "hand gestures", from: "NEGATIVES (§5d)" },
  { phrase: "letters, numbers", from: "NEGATIVES — text allowed (§5d)" },
  { phrase: "DIRECTION block", from: "EXPRESSION (dangling referent)" },
  { phrase: "Eight candidates", from: "CAPTURE (set narration, §5b)" },
  { phrase: "always wins", from: "AUTHORITY (rule 8)" },
  /* "mid-torso" was on this list under §3a's chest-up ruling and came OFF it
     2026-08-27 when the founder reversed the framing itself ("chest up is far
     too tight we need to see the outfit more", #182) — the block now SAYS
     mid-torso. "waist-up" stays out: the crop is mid-torso, never the waist. */
  { phrase: "waist-up", from: "FRAMING (mid-torso, #182)" },
  { phrase: "sternum", from: "FRAMING (court §4)" },
];

/*
  THE FORBIDDEN-TOKEN GUARD, at module load (#144, widened #146): if any dropped phrase is
  back in the block — a re-derivation from the cohort, a pasted old line —
  the module refuses to load, on every account, before a single roll composes
  the flash studio again. The suite's arm proves the list reads real sentences
  (each phrase IS in the old studio's block); this proves the block is clean.
*/
/* BOTH LANES (#232): a phrase back in the creature lane alone would be invisible to a guard reading the human bytes. */
for (const [lane, block] of [["human", HOUSE_BLOCK], ["creature", CREATURE_HOUSE_BLOCK]] as const) {
  const lower = block.toLowerCase();
  for (const { phrase, from } of DROPPED_FROM_BLOCK) {
    if (lower.includes(phrase.toLowerCase())) {
      throw new Error(`[houseBlock] "${phrase}" is back in the locked block's ${lane} lane (dropped from ${from} by §5d/§5e/§5f, #144/#146)`);
    }
  }
}

/**
 * True when `text` contains any sentence of EITHER lane's block — the author is
 * never allowed to. It reads both because the author is not told which lane
 * the roll took, and a draft copying the creature EXPRESSION sentence is the
 * same defect as one copying the human sentence (#232).
 */
export function containsHouseSentence(text: string): string | null {
  const lower = text.toLowerCase();
  for (const lane of HOUSE_LANES) {
    for (const sentence of houseBlockSentencesFor(lane)) {
      if (lower.includes(sentence.toLowerCase())) return sentence;
    }
  }
  return null;
}

/**
 * The photoreal-human cohort adapter (plan §I, cohort quality law).
 *
 * Two jobs, and the split between them is the whole architecture:
 *
 *   **The constant.** Framing, camera, light, grade, skin, negatives and
 *   neutral wardrobe are written here, in code, and are identical for all
 *   eight candidates and every roll. The founder ruling is that this layer is
 *   "a code-owned cohort constant that interpreter and treatment output can
 *   never touch — variety lives in *who* the character is, never in how they
 *   are photographed". That is why eight candidates are comparable at all: they
 *   are eight people photographed the same way, not eight art directions.
 *
 *   **The variation.** Everything the brief left open is resolved here too,
 *   deterministically, from weighted vocabularies. This is the other half of
 *   M3's finding: with only a temperature knob for difference, "the eight
 *   candidates read as one man photographed eight times". Difference has to be
 *   authored somewhere, and under Path A that somewhere is this file.
 *
 * The craft in the constant is ported from the legacy photoreal engine, which
 * the founder named as the thing that made the old output excellent.
 *
 * **Which items, and at what strength, is recorded in
 * `docs/specs/CASTING_V2_CRAFT_PORT_AUDIT.md` — not here.** This comment used
 * to carry the list, and the list was wrong: it named A5–A8 as adopted when
 * three of those four were compressed to their headlines, and elsewhere in this
 * file a comment claimed C5's priority hierarchy was ported "in four lines"
 * when nothing in the prompt stated it at all. A comment asserting a port is
 * not evidence of one, and a list maintained by hand next to the code it
 * describes will drift from it again. The audit is the record; it goes item by
 * item through catalog sections A, B, C and D, and every entry is ported,
 * consciously adapted with a reason, or explicitly dropped with a reason.
 *
 * Left behind, and worth knowing without opening that document: the
 * bare-face/undergarment rules, retired as presentation by the
 * wardrobe-baseline ruling — V2 presentation views are clothed.
 */
import {
  AGE_PHASES,
  ARCHETYPES,
  LOOKS,
  LOOK_KEYS,
  ARCHETYPE_KEYS,
  AGE_BANDS,
  BUILDS,
  ENERGIES,
  ENERGY_KEYS,
  HAIR_FAMILIES,
  HERITAGES,
  type ArchetypeKey,
  type AgeBand,
  type AgePhase,
  type Build,
  type CastingIntent,
  type EnergyKey,
  type Hair,
  type HairColour,
  type HairFamily,
  type Heritage,
  type LookKey,
  type HeritageComponent,
  type ResolvedIdentity,
  type Sex,
} from "./castingIntent";

/* --------------------------------------------------------- the constant */

/**
 * The casting frame. Fixed for every candidate so that comparing two of them
 * compares two people (E1).
 *
 * Waist-up rather than legacy's headshot: V2's sheet sells a person, and a
 * comp-card crop cannot show bearing. Clothed rather than legacy's bare
 * shoulders, per the wardrobe-baseline ruling — the minimal-clothing plate is
 * an internal VTO slot now, not what the customer looks at.
 */
const FRAMING = [
  /*
    CROP (founder gate, 2026-07-31): the first sheets cropped scalps and read
    as mugshots. A casting frame has air above the head — a tight crop reads as
    a booking photo no matter how good the light is.
  */
  "FRAMING: Single subject, waist-up, centred, square to camera, head straight with no tilt.",
  /*
    Hair, not just head. The first version said "the entire head" and crowns
    were still clipped — an afro, an updo or any volume sits well above the
    skull, and a model told to keep the head in frame will happily crop the
    hair off the top of it.
  */
  "CROP: The subject's ENTIRE HAIR SILHOUETTE is inside the frame with natural headroom above it — including afros, curls, volume, updos, buns and any height the hair carries. Clear space between the topmost hair and the top edge.",
  "Nothing on the head is clipped: not the crown, not the hairline, not a single strand at the outline. If the hair is tall, frame wider rather than cropping it.",
  /*
    The ratio has to match what is actually requested of the generator. This
    said 4:5 while every roll asks for 1024×1536, which is 2:3 — the prompt was
    describing a frame the image was never going to be. Legacy named its ratio
    (A2, "sensor ratio 3:4") precisely because a stated crop that fights the
    output crop is where clipped crowns come from.
  */
  "Frame from mid-torso up in a 2:3 portrait. Shoulders fully inside the frame with margin at both sides.",
  "Shoulders level, spine straight, neck relaxed. Arms relaxed at the sides. Mouth closed.",
  /*
    EXPRESSION — composed but ALIVE.

    Two corrections, in order. First: energy words like "fast talker" were
    being read as instructions to act, so candidates came back mid-laugh and
    mid-word, and you cannot read bone structure through a laugh. Then the fix
    overshot — the founder's second grade called the result vacant and grim,
    which is its own failure: a dead-eyed sheet is as uncastable as a
    performing one.

    Legacy solved this with a *whisper* (catalog C3) rather than a suppression
    — "Mouth closed, soft. Eyes direct into lens, quietly alert and
    observant." Present and engaged, holding still. That is the target, and
    the negative list below only forbids performance, never life.
  */
  "EXPRESSION: Eyes looking directly into the lens, engaged and unmistakably alive — someone present in the room, meeting the camera.",
  "Mouth closed, lips together and relaxed. A faint closed-mouth warmth is welcome where the subject's presence calls for it; a broad smile is not.",
  "Energy reads in the eyes and brow. The default is interested, not neutral — a casting polaroid of someone who wants the job, holding still.",
  "Never vacant, blank, sedated, grim, sullen or severe. Equally never performing — no mid-laugh, no mid-speech, no acted moment.",
  /*
    BACKDROP: the founder's note was "flat penal grey". Legacy's seamless is
    *bright* and has falloff — it is lit paper, not a painted wall, and that
    luminance is a large part of why legacy output reads as a studio rather
    than an intake room.
  */
  "BACKGROUND: Bright light-grey seamless paper, luminous rather than flat, filling the entire frame. No texture, no pattern, no corners, no floor line, no black borders.",
  "The flash falls off naturally across the paper — brighter immediately behind the subject, gently deeper toward the frame edges. Soft gradient, never a hard vignette.",
  "WARDROBE: plain unbranded clothing in neutral grey or off-white — a simple crew-neck tee or plain shirt.",
  "No jackets, no accessories, no jewellery, no hats, no props of any kind, nothing held in the hands.",
].join(" ");

/**
 * A2 + A3 + A4, kept close to the legacy wording because the wording is the
 * craft — a named sensor class and aperture produce a lens signature that
 * "high quality photo" does not.
 */
const CAPTURE = [
  "CAMERA: Medium-format sensor, Hasselblad class. 85mm equivalent, f/5.6–f/8, sensor ratio 2:3. Subject sharp front to back.",
  "Fine luminance-dominant noise, barely visible, like fine sand. No colour noise.",
  "LIGHTING: Direct on-camera or slightly off-axis front flash. Sharp, honest, bright and even light with shadows falling directly behind the subject. No gels, no diffusion.",
  /*
    A3's deferral — but pointed at something that exists.

    Legacy deferred to "the casting spec's skin finish", a field the user
    picked from a matrix (A9). V2 has no such field, so the sentence was
    deferring to nothing: an instruction with a dangling referent, which the
    model resolves by ignoring it. The craft in A3 is that the light block must
    NOT decide the sheen — so the deferral is kept and given a real referent.
  */
  "How the skin RESPONDS to this light — specular, matte, dry or dewy — is decided by THIS person: their age, their condition, their work and anything the character description says about their skin. The lighting block never flattens that into one sheen.",
  "Eight candidates must not share one skin. A weathered outdoor face and a groomed indoor one respond to the same flash completely differently, and that difference must be visible.",
  "Specular highlights sit on the forehead, nose and cheekbones where the flash strikes.",
  "COLOUR: Neutral daylight, 5500–5800K. Skin tones warm and dimensional with visible subsurface scattering. No stylized grading, no teal-orange, no filter look, no cool clinical cast.",
].join(" ");

/**
 * A5–A10. The macro protocols are the difference between a face and a render:
 * dead glassy eyes and drawn-on brows are the two tells a casting director
 * sees first, and each needs naming individually or the model averages them
 * away.
 */
const SKIN_AND_FEATURES = [
  "REALISM: RAW skin with high micro-contrast — visible pores, vellus fuzz, uneven tone, real blemishes and asymmetry.",
  /*
    A1's operative half, which this file had compressed away. "High
    micro-contrast" is a term; the sentence that makes it renderable is the one
    naming what it produces — tactile, three-dimensional local contrast that
    makes a surface feel physical. Without it the phrase reads as a quality
    adjective and the model treats it as one.
  */
  "Skin, vellus hair and fine texture carry tactile, three-dimensional local contrast that makes the surface feel physical — a face you could touch, not a surface that has been rendered.",
  "No beauty retouching, no surface smoothing, no CGI sheen, no painterly softness, no excessive symmetry.",
  "EYES: the iris is not a flat disc — render radial striations and fibre-like collagen structure, lighter near the pupil and deepening to richer saturation toward the outer edge, closed by a distinct dark limbal ring where the iris meets the sclera.",
  "CATCHLIGHTS: one or two small, sharp specular reflections of the studio flash, high on the cornea. Without them the eyes read dead. Render the wet corneal gloss over the whole eye surface — visible, not glassy.",
  "SCLERA: never pure white — a faint warm undertone with subtle vascularity toward the corners. A perfectly white sclera looks synthetic.",
  /*
    OCULAR SYMMETRY — founder-reported, 2026-08-01, and a legacy artifact too.

    Mismatched pupils recur across sheets, and the realism block above is part
    of the cause: "real blemishes and asymmetry" plus "no excessive symmetry"
    is a licence the model applies to the whole face, eyes included. Facial
    asymmetry is what makes a face real; pupil asymmetry is what makes it look
    generated — a viewer reads it as a rendering fault or a head injury, never
    as character.

    So the exception has to be stated as loudly as the rule it carves out of.
    Same shape as the interpreter's restraint doctrine: a one-directional
    instruction gets over-applied until its other half is named.
  */
  "PUPILS: perfectly round, concentric within the iris, and IDENTICAL to each other in size and shape. Under studio flash both are moderately constricted, with a clean sharp edge where pupil meets iris. Never dilated, never oversized.",
  "Both catchlights match — same count, same relative position — because they come from one light. Both eyes are open to the same degree and converge on the lens together.",
  "The asymmetry licensed above is bone, soft tissue and skin. It is NEVER the eyes: mismatched pupils, a wandering eye or uneven catchlights read as a rendering fault, not as character, and fail the candidate.",
  /*
    A6/A7/A8 restored to full strength. Each had been compressed to its
    headline, and in every case what was cut was the anti-uniformity half —
    varying lash length, colour variation across the lip and through the brow.
    That half is the craft: a lash line of identical strands and a brow of one
    flat colour are the two tells that survive an otherwise convincing face.
  */
  "LASHES: individual strands clumping in irregular groups, with varying length and slight curl variation, each catching light on its own and casting micro-shadows on the skin below. Bare and natural, never a solid dark mass, never mascara-heavy uniformity.",
  "LIPS: vertical plicae and a natural moisture gradient, glossier at the centre and drier toward the edges, with natural colour variation from the vermillion border inward. Lips have topography, never a flat matte fill. The border is organic and slightly irregular, never a vector-sharp line.",
  "BROWS: individual hairs with visible growth direction — upward near the nose, arching laterally, tapering at the tail — with natural gaps, overlapping strands and subtle colour variation from root to tip. Never a solid drawn-on block.",
  "Vellus fuzz is translucent and near-invisible, catching light only at extreme angles — it is NOT terminal hair, NOT stubble, NOT dark and NOT pigmented.",
  /*
    STRUCTURAL FEATURES — licensed explicitly (founder ruling, 2026-08-01).

    Two seed tiles asked for a broken nose and neither rendered one: the face
    came back intact and handsome both times. The realism block was fighting
    the brief. "No excessive symmetry" nudges toward an *interesting* face, but
    nothing above licensed actual structural damage, and the model's prior for
    a studio portrait is an undamaged one — so a named permanent feature lost
    to the prior every time.

    This does not invent features. It permits the ones the brief names, which
    is the difference between a casting system that can cast a retired boxer
    and one that quietly recasts him as a model.

    The full marks vocabulary — the ink/scar/pigmentation/piercing detector and
    its persistence rules (catalog H2/H3) — is scheduled with M12. This clause
    is the narrow part that unblocks briefs today.
  */
  "STRUCTURAL FEATURES: When the character description names a permanent physical feature — a broken or crooked nose, a scar, a cleft, cauliflower ear, a missing or chipped tooth, asymmetry, a birthmark, freckling, active acne or acne scarring, weathered or sun-damaged skin, a shaved head, a tattoo — render it plainly and accurately as a real, healed, permanent part of this person.",
  "These are casting facts, not blemishes to correct. Do not idealise them away, do not soften them, and do not substitute an unmarked face. A named feature that fails to appear is a failed candidate.",
  "Render only what the description names. Never invent damage, scars or ink that was not asked for.",
].join(" ");

/**
 * B2 — the ethnicity phenotype lock, restored by the craft-port audit
 * (2026-08-01).
 *
 * This was the audit's most consequential absence. Legacy placed it FIRST in
 * every new-generation prompt; V2 had nothing at all, while making heritage its
 * PRIMARY diversity axis. Ethnicity washing — the model drifting toward a
 * Eurocentric face when handed pale skin or light hair, and mixed heritage
 * collapsing to one parent — is therefore the failure mode V2 was most exposed
 * to and least defended against.
 *
 * The craft is that heritage is defended as BONE, independent of styling. A
 * heritage that survives only until the brief mentions blonde hair is not a
 * lock.
 */
const IDENTITY_INTEGRITY = [
  "HERITAGE IS BONE: the subject's stated heritage determines eye shape and set, brow ridge, nose bridge and width, cheekbone height and projection, jaw and chin form, lip form, and hair growth pattern.",
  "These are determined by bone and genetics. They do NOT change with hair colour, skin tone, grooming or styling. A platinum-blonde East Asian person still has East Asian bone structure and eyes; a pale-skinned West African person still has West African bone structure.",
  "Where two heritages are named, BOTH must be legible in the face. Never collapse a mixed-heritage subject into one parent, and never resolve them into a generic ambiguous face that reads as neither.",
  /*
    D1/D4's half that survives without a colour picker. V2 has no eye-colour or
    skin-tone field, so the fifteen engineered iris descriptions have nothing to
    attach to — but the diversity risk they existed to solve is live: with no
    direction at all, every candidate defaults to mid-brown eyes and the sheet
    loses an axis of difference it should have had for free.
  */
  "When the description does not state them, eye colour, hair colour and skin tone belong to this specific person and follow plausibly from their heritage and age. Do not default every subject to the same mid-brown eyes, and do not push a heritage toward its lightest or darkest stereotype.",
  /*
    D2, which the audit had recorded as "folded in" and Fable's skim showed was
    not. The clause above resolves WHETHER an unusual colour is allowed; D2's
    craft is HOW it renders — as this person's own pigment, not as an applied
    product. Legacy learned this the hard way: without it, "mint eyes" comes
    back with a visible contact-lens ring and "platinum on dark skin" comes back
    looking like an obvious dye job.

    It also has to be stated separately because the sentence above leans the
    other way: "follow plausibly from their heritage" is prior-reinforcing
    language, and on its own it invites reconciling a stated mint eye back to
    brown.
  */
  "When the description DOES state a colour, render it as this person's natural born pigment — real iris tissue, real grown hair — never as contact lenses, a visible dye job, a wig, or anything applied.",
  /*
    A13, in the only form a per-candidate prompt can honestly carry it.

    Legacy told the spec-writing text model "each cast should feel like a
    DIFFERENT PERSON" and "two casts with the same brand and ethnicity should
    not produce similar feature sets". V2 has no spec-writing stage, and each
    candidate is generated without sight of the other seven, so a
    cross-candidate instruction would be a claim the prompt cannot keep. What
    ports is the per-face half: specificity over averageness.
  */
  "SPECIFICITY: this is one particular person, not a type. Two or three features should sit clearly beyond average — the nose, the jaw, the brow, the ears, the hairline — and read as inherited, not as damage.",
  "Those features must still belong to someone this casting category would book: memorable within the casting, never disqualified by it.",
  "Never render the smooth, symmetrical, conventionally attractive average face that every casting brief converges on. A face a casting director would remember is the requirement.",
].join(" ");

/**
 * C5 — the signal priority hierarchy, restored by the craft-port audit.
 *
 * The code has always resolved locks first (`resolveCandidateIdentity` fills
 * only the gaps), and a comment in this file claimed that was C5 "in four
 * lines". It is not: code precedence decides what goes INTO the prompt, and
 * says nothing about how the image model resolves a conflict between two things
 * that are both in it. DIRECTION could quietly pull a face away from a stated
 * heritage or build, and nothing said it must not.
 *
 * Legacy's worked example is the one V2 could not express: pale skin on a West
 * African subject means pale-skinned WITH West African bone structure — not a
 * different person.
 */
const PRIORITY = [
  "PRIORITY WHEN INSTRUCTIONS CONFLICT: the SUBJECT block is absolute. Every fact stated there — sex, age, heritage, build — outranks the DIRECTION block, the LOOK, the expression whisper and any aesthetic association they carry.",
  "Direction shapes HOW a subject is cast; it never changes WHO. If a direction's usual face disagrees with a stated fact, the stated fact wins and the direction bends around it.",
  "An unusual combination is a deliberate casting choice, never an error to reconcile: pale skin on a West African subject means a pale-skinned person with West African bone structure, not a different person.",
].join(" ");

/**
 * A12, plus the two additions this milestone's evidence demands: no text of
 * any kind, and no scene. The mug that started all of this said "World's
 * Okayest Handyman", so text is named in the negative list as well as being
 * structurally excluded upstream.
 */
const NEGATIVES = [
  "PHOTOREALISTIC ONLY — a real photograph from a real camera.",
  "NO text, letters, numbers, words, logos, captions, labels, watermarks or signage anywhere in the frame.",
  "NO props, furniture, environment, location or scene — the backdrop is empty studio paper.",
  "NO open mouth, no showing teeth, no laughing, no acted expression, no hand gestures near the face.",
  "NO CGI, cartoon, anime, 3D render, illustration, plastic skin, doll look, wax figure, perfect symmetry, or beauty-app smoothing.",
].join(" ");

/**
 * The override sentence.
 *
 * This paragraph, and the fact that it is appended LAST, is the actual
 * guarantee behind the precedence fix. Everything above it describes a person;
 * this says the photograph is not up for negotiation regardless of what the
 * description asked for. A capped free-text field can still mention a garage —
 * it cannot outrank a rule that is stated after it and claims authority over
 * it.
 */
const OVERRIDE = [
  "AUTHORITY: The FRAMING, CAPTURE, REALISM and NEGATIVE rules above override the character description entirely.",
  "If the description implies a location, an activity, a costume, a prop, or any text, ignore that implication and render this person in the plain studio frame described here.",
  "The description says WHO to cast. This block says HOW to photograph them, and it always wins.",
].join(" ");

/**
 * Everything code owns, in order, as one block.
 *
 * PRIORITY sits last before the authority paragraph on purpose: it resolves
 * conflicts, so it has to be read after the things it arbitrates between.
 */
export const PHOTOREAL_HUMAN_CONSTANT = [
  FRAMING,
  CAPTURE,
  SKIN_AND_FEATURES,
  IDENTITY_INTEGRITY,
  NEGATIVES,
  PRIORITY,
  OVERRIDE,
].join("\n");

/* --------------------------------------------------------- determinism */

/** FNV-1a. A stable number from a string — no randomness anywhere in a roll. */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/**
 * Weighted pick, D14's lesson made general.
 *
 * The legacy randomizer moved off a uniform distribution because "the old
 * uniform pick over eight colors gave Silver+Platinum a combined 25% — every
 * fourth randomized cast read grey/white". A sheet is a casting pool, and a
 * casting pool that is uniform over rare options does not look like one.
 */
function weightedPick<T extends string>(entries: readonly (readonly [T, number])[], seed: number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seed % total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** Roughly a real casting call, not a uniform sample of decades. */
const AGE_WEIGHTS: readonly (readonly [AgeBand, number])[] = [
  ["teens", 6],
  ["20s", 30],
  ["30s", 26],
  ["40s", 17],
  ["50s", 11],
  ["60s", 7],
  ["70s+", 3],
];

const BUILD_WEIGHTS: readonly (readonly [Build, number])[] = [
  ["slight", 10],
  ["slim", 22],
  ["average", 32],
  ["athletic", 20],
  ["broad", 11],
  ["heavy", 5],
];

/**
 * Heritage variation when the brief did not say.
 *
 * Flat across the ten, because weighting this list would be encoding a claim
 * about who "should" show up in an unspecified casting call — and the founder
 * ruling calls unstated heritage "a prime treatment-variation axis" for
 * exactly the reason that real casting diversity is the desirable outcome.
 * D15's 30% blend chance carries over.
 */
function varyHeritage(position: number, rollSeed: string): HeritageComponent[] {
  /*
    Cycle, do not sample.

    Heritage is the PRIMARY diversity axis when the brief leaves it open, and a
    hash-sample over ten values collides constantly — a graded sheet came back
    Polynesian, Polynesian, Middle Eastern, Middle Eastern, Latino, and read as
    four people rather than eight. Cycling with a per-roll offset guarantees
    eight distinct heritages out of ten while keeping two rolls of the same
    brief from opening identically. Same reasoning as the energy axis, which
    was cycled from the start for exactly this reason.
  */
  const offset = hash(`${rollSeed}:heritage`) % HERITAGES.length;
  const primary = HERITAGES[(position + offset) % HERITAGES.length] as Heritage;

  // D15's 30% blend chance, kept.
  const blendRoll = hash(`${rollSeed}:blend:${position}`) % 10;
  if (blendRoll >= 3) return [{ heritage: primary, pct: 100 }];

  const step = 1 + (hash(`${rollSeed}:blend2:${position}`) % (HERITAGES.length - 1));
  const secondary = HERITAGES[
    (position + offset + step) % HERITAGES.length
  ] as Heritage;
  return [
    { heritage: primary, pct: 60 },
    { heritage: secondary, pct: 40 },
  ];
}

/**
 * Sex, when unstated.
 *
 * Alternating rather than weighted: over eight candidates a coin flip lands
 * 8–0 often enough to matter, and a sheet that is accidentally all-male for an
 * open brief is a worse outcome than a slightly artificial balance.
 *
 * Non-binary is never inferred (H11) — it appears only when the brief says so,
 * which means it arrives as a lock and never reaches this function.
 */
function varySex(position: number, rollSeed: string): Sex {
  // Strict alternation off a per-roll offset, not a per-candidate sample. A
  // coin flip lands 8–0 often enough to matter, and an accidentally all-male
  // sheet for an open brief is a worse outcome than an even split. The offset
  // is what stops every sheet starting with the same one.
  return (position + (hash(`${rollSeed}:sex`) % 2)) % 2 === 0 ? "female" : "male";
}


/* ------------------------------------------------------------------ hair */

/**
 * Hair colour, conditioned on heritage — the trap in authoring hair at all.
 *
 * An unconditioned colour pick is a heritage-washing vector: it would cheerfully
 * hand a West African candidate blonde hair a third of the time, and that fights
 * `IDENTITY_INTEGRITY` head-on. So the weights are per-heritage, and grey/white
 * is not in them at all — it comes from age, below, because grey is something
 * that happens to a person rather than something they are born with.
 *
 * These are casting-pool plausibilities, not genetics. The point is that a sheet
 * looks like a room of real people.
 */
const HAIR_COLOUR_WEIGHTS: Record<string, readonly (readonly [HairColour, number])[]> = {
  Nordic: [["blonde", 40], ["brown", 25], ["red", 10], ["dark brown", 15], ["auburn", 10]],
  "British Isles": [["brown", 30], ["dark brown", 25], ["blonde", 20], ["red", 12], ["auburn", 13]],
  "Western European": [["brown", 32], ["dark brown", 28], ["blonde", 22], ["auburn", 12], ["red", 6]],
  Slavic: [["dark brown", 32], ["brown", 30], ["blonde", 22], ["auburn", 10], ["red", 6]],
  Mediterranean: [["black", 30], ["dark brown", 40], ["brown", 22], ["auburn", 8]],
  "Middle Eastern": [["black", 45], ["dark brown", 40], ["brown", 15]],
  "East Asian": [["black", 78], ["dark brown", 22]],
  "South Asian": [["black", 72], ["dark brown", 28]],
  "West African": [["black", 82], ["dark brown", 18]],
  "Afro-Caribbean": [["black", 78], ["dark brown", 22]],
  Latino: [["black", 40], ["dark brown", 42], ["brown", 18]],
  Polynesian: [["black", 80], ["dark brown", 20]],
};

const DEFAULT_HAIR_COLOURS: readonly (readonly [HairColour, number])[] = [
  ["dark brown", 34],
  ["black", 26],
  ["brown", 24],
  ["blonde", 10],
  ["auburn", 6],
];

/** Greying is a function of age, so it is applied after colour, not instead. */
const GREY_CHANCE: Record<AgeBand, number> = {
  teens: 0,
  "20s": 0,
  "30s": 4,
  "40s": 14,
  "50s": 38,
  "60s": 58,
  "70s+": 74,
};

const HAIR_FAMILY_WEIGHTS: readonly (readonly [HairFamily, number])[] = [
  ["shaved", 5],
  ["cropped", 14],
  ["short", 24],
  ["mid-length", 26],
  ["long", 24],
  ["coiled", 7],
];

function varyHair(
  heritage: HeritageComponent[],
  ageBand: AgeBand,
  seed: number,
): Hair {
  const family = weightedPick(HAIR_FAMILY_WEIGHTS, seed >>> 5);
  const primary = heritage[0]?.heritage ?? "";
  const palette = HAIR_COLOUR_WEIGHTS[primary] ?? DEFAULT_HAIR_COLOURS;
  let colour = weightedPick(palette, seed >>> 13);

  const greyRoll = (seed >>> 19) % 100;
  if (greyRoll < GREY_CHANCE[ageBand]) {
    // Salt-and-pepper reads as grey; a full head of white belongs to the
    // oldest bands, where it is common rather than remarkable.
    colour = ageBand === "70s+" && greyRoll < GREY_CHANCE[ageBand] / 2 ? "white" : "grey";
  }
  return { family, colour };
}

/**
 * What a follow inherits from the candidate it follows.
 *
 * Deliberately NOT merged into `CastingIntent`, and that distinction is the
 * whole design. A non-null intent field means *the brief said it* — that
 * convention feeds `lockFactsOf`, `validateLocks` and the brief echo. An
 * anchored trait smuggled in there would become a lock the user never wrote, a
 * validator violation the moment a cousin legitimately varies, and a fact in
 * the echo's sentence claiming the brief pinned something it never mentioned.
 *
 * The previous `followFrom` did exactly that, copying the parent's heritage
 * into the intent — which under the founder's ruling is doubly wrong, because
 * an inherited *lock* produces eight clones with identical heritage rather
 * than eight cousins.
 */
export type FollowAnchor = {
  /** Locked. "Sex holds absolutely" — the adapter never varies it. */
  sex: Sex;
  /** The primary component holds; the secondary varies per candidate. */
  heritage: HeritageComponent[];
  ageBand: AgeBand;
  hair: Hair | null;
  look: LookKey | null;
};

/**
 * Heritage in a follow: cousins, not clones and never unrelated.
 *
 * The parent's PRIMARY heritage is kept on every candidate — that is the
 * "never unrelated" half, and it also keeps `IDENTITY_INTEGRITY` honest, since
 * a mixed-heritage parent never collapses to one parent. What varies is the
 * second component: some candidates carry the parent's blend, some are
 * single-heritage, some pick up a different second heritage. Eight relatives
 * rather than eight copies.
 */
function anchoredHeritage(
  anchor: FollowAnchor,
  position: number,
  rollSeed: string,
): HeritageComponent[] {
  const primary = anchor.heritage[0];
  if (!primary) return varyHeritage(position, rollSeed);

  const roll = hash(`${rollSeed}:followHeritage:${position}`) % 10;
  if (roll < 4) return [{ heritage: primary.heritage, pct: 100 }];
  if (roll < 7 && anchor.heritage[1]) return anchor.heritage;

  const step = 1 + (hash(`${rollSeed}:followBlend:${position}`) % (HERITAGES.length - 1));
  const secondary = HERITAGES[
    (HERITAGES.indexOf(primary.heritage as Heritage) + step) % HERITAGES.length
  ] as Heritage;
  return [
    { heritage: primary.heritage, pct: 60 },
    { heritage: secondary, pct: 40 },
  ];
}

/** Hair in a follow: the family and colour carry; everything else stays free. */
function anchoredHair(anchor: FollowAnchor, heritage: HeritageComponent[], ageBand: AgeBand, seed: number): Hair | null {
  return anchor.hair ?? varyHair(heritage, ageBand, seed);
}

/**
 * Resolve one candidate.
 *
 * Locks first, always: anything the brief stated is copied straight through,
 * and only the gaps are filled. That ordering is C5's signal hierarchy and
 * H15's precedence chain in four lines — a user's explicit choice can never be
 * overwritten by a variation axis, because the variation axis is only
 * consulted where the user was silent.
 */
export function resolveCandidateIdentity(
  intent: CastingIntent,
  position: number,
  rollSeed: string,
  anchor: FollowAnchor | null = null,
): ResolvedIdentity {
  const seed = hash(`${rollSeed}:${position}`);

  /*
    Precedence inside a follow, and it matches the ratified chain everywhere
    else: the brief still outranks the anchor. Follow a woman, then type "man"
    into the box, and the brief wins — the anchor supplies what the brief left
    unsaid, exactly as the variation vocabularies do.
  */
  const ageBand = intent.ageBand ?? anchor?.ageBand ?? weightedPick(AGE_WEIGHTS, seed >>> 3);
  const heritage =
    intent.heritage.length > 0
      ? intent.heritage
      : anchor
        ? anchoredHeritage(anchor, position, rollSeed)
        : varyHeritage(position, rollSeed);

  return {
    sex: intent.sex ?? anchor?.sex ?? varySex(position, rollSeed),
    ageBand,
    /*
      A stated phase is a lock. Only an unstated one varies — otherwise
      "early 20s" gets re-rolled into mid and late across the sheet, which is
      exactly how the founder's brief came back reading 28-35.
    */
    agePhase: intent.agePhase ?? AGE_PHASES[(seed >>> 11) % AGE_PHASES.length],
    heritage,
    /*
      Stated build wins. Otherwise: if the brief named a casting category, the
      category owns physique and this stays null — varying it would cast
      outside the category the user asked for (founder gate B5). With no
      category, street-real variety across builds is exactly right.
    */
    build: intent.build ?? (intent.role ? null : weightedPick(BUILD_WEIGHTS, seed >>> 7)),
    /*
      Hair carries on a follow and varies otherwise. Conditioned on the
      resolved heritage rather than the brief's, so a candidate who varied into
      a different heritage gets hair that belongs to the face they actually
      have.
    */
    hair: anchor ? anchoredHair(anchor, heritage, ageBand, seed) : varyHair(heritage, ageBand, seed),
    // Energy is the one axis that cycles rather than samples: eight candidates
    // against eight energies gives one of each, which is the most legible
    // difference a sheet can carry. Stated energy locks it flat across all
    // eight (plan line 205).
    energy: intent.energy ?? ENERGY_KEYS[position % ENERGY_KEYS.length],
    /*
      The look axis. A stated look locks flat across the sheet (archetype law);
      otherwise, when the brief named a casting category whose job IS a kind of
      face, each candidate takes a different look — eight houses' casting, not
      eight moods. Offset by the roll so two rolls of the same brief do not
      open with the same look.
    */
    look:
      intent.look
      ?? anchor?.look
      ?? (varyByLook(intent)
        ? LOOK_KEYS[(position + (hash(`${rollSeed}:look`) % LOOK_KEYS.length)) % LOOK_KEYS.length]
        : null),
  };
}

/**
 * Does this sheet vary by look rather than disposition?
 *
 * The interpreter decides, full stop — it read the brief and knows whether the
 * job is a kind of face or a kind of person. When it declines to say, the
 * sheet varies by disposition, which is the safer default: a character sheet
 * that varies looks is stranger than a model sheet that varies mood.
 *
 * An earlier version of this comment described a keyword fallback on the role
 * text. That was never implemented, and the mismatch is worth naming rather
 * than quietly deleting: a comment claiming behaviour the code does not have
 * is how a reviewer signs off on something that is not there.
 */
function varyByLook(intent: CastingIntent): boolean {
  if (intent.variationAxis) return intent.variationAxis === "look";
  return false;
}

/**
 * The sheet's direction, chosen once per roll rather than per candidate.
 *
 * Per-candidate archetypes would vary the art direction, which the framing law
 * forbids — the sheet must read as one casting call. H15's rule that an absent
 * brand resolves to a recorded pick on the paid path is what makes this
 * honest: the choice is written into `compiledBrief`, so a roll can always say
 * what direction it was cast under.
 */
export function resolveArchetype(intent: CastingIntent, rollSeed: string): ArchetypeKey {
  if (intent.archetype) return intent.archetype;
  return ARCHETYPE_KEYS[hash(`${rollSeed}:archetype`) % ARCHETYPE_KEYS.length];
}

/* ---------------------------------------------------------- composition */

/**
 * Years per band phase.
 *
 * "Early 20s" came back reading 28–35 (founder gate). Prose alone does not
 * hold an age: the image model has a strong prior toward a generically adult
 * face, and a phrase like "early twenties" loses to it. Naming the years, and
 * then naming the physiology that must NOT be present, is what legacy's age
 * handling did (catalog H12 mapped idioms to exact ages; A11 reconciled age
 * against skin texture so a 23-year-old never came back with crow's feet).
 */
const AGE_YEARS: Record<AgeBand, [string, string, string]> = {
  teens: ["16–17", "17–18", "18–19"],
  "20s": ["20–23", "24–26", "27–29"],
  "30s": ["30–33", "34–36", "37–39"],
  "40s": ["40–43", "44–46", "47–49"],
  "50s": ["50–53", "54–56", "57–59"],
  "60s": ["60–63", "64–66", "67–69"],
  "70s+": ["70–74", "75–79", "80+"],
};

function describeAge(band: AgeBand, phase: AgePhase): string {
  const phaseIndex = AGE_PHASES.indexOf(phase);
  const years = AGE_YEARS[band][phaseIndex];
  const spoken =
    band === "70s+"
      ? "in their seventies or older"
      : band === "teens"
        ? `in their ${phase} teens`
        : `in their ${phase} ${band.replace("s", "")}s`;

  /*
    Stated as an absolute with a corroborating negative. The negative is the
    half that works: telling the model what a 22-year-old does NOT have
    (nasolabial depth, eye-area lines, jowl softening) is far more effective
    than asking again for "early twenties".
  */
  const guard =
    band === "teens" || band === "20s"
      ? " Skin, bone maturity and the eye area must corroborate this age — taut jawline, no nasolabial depth, no crow's feet, no under-eye hollowing, no adult heaviness through the jaw."
      : band === "70s+" || band === "60s" || band === "50s"
        ? " Age must be genuinely present in the skin and structure — do not render a younger face with grey hair."
        : "";

  return `${spoken}, apparent age ${years} years — this is an absolute casting requirement, not an approximation.${guard}`;
}

/**
 * C8 + C9 — build, translated into what the frame can actually show.
 *
 * The audit found build reaching the prompt as a bare adjective ("a slim
 * woman"), which the model is free to read as a styling note and ignore.
 * Legacy translated it into named, renderable anatomy — the neck, the
 * collarbones, the traps — precisely because a bare adjective got ignored, and
 * added an explicit "this is a deliberate casting choice" so it would not be
 * regressed to the default runway physique.
 *
 * V2's frame is waist-up rather than legacy's headshot, so more of the body is
 * visible and the translation matters more, not less.
 */
const BUILD_ANATOMY: Record<Build, string> = {
  slight: "a narrow neck, visible collarbones and tendons, slender shoulders, a leaner face",
  slim: "a slim neck, clearly visible collarbones, narrow shoulders, little soft tissue at the jaw",
  average: "an ordinary neck and shoulder line, collarbones softly visible, nothing exaggerated in either direction",
  athletic: "a thicker neck, defined trapezius and shoulders filling the frame, a firmer jawline",
  broad: "a wide, solid neck and shoulder frame, heavy trapezius, substantial bone width through the shoulders",
  heavy: "a fuller neck and jawline, soft tissue at the chin and under the chin, rounded shoulders and a broader torso",
};

function describeBuild(build: Build | null, role: string | null): string {
  if (build) {
    return ` PHYSIQUE: ${build} build — this is a deliberate casting choice and must be visible in the frame: ${BUILD_ANATOMY[build]}. Do not default to a slim runway physique.`;
  }
  /*
    Build is null on purpose when a casting category was named: gate B5 gives
    the category ownership of physique, so varying it would cast outside the
    category the user asked for.

    But "the category owns it" was being implemented as saying nothing at all,
    which is not the same thing — and saying nothing is precisely the condition
    C9 exists for. With no physique line, the model falls back to its prior for
    a studio portrait, which is a slim runway body. A blacksmith with a runway
    physique is C9's failure case exactly, arriving through the gate that was
    supposed to protect the category.

    So the category is told to own it out loud.
  */
  if (role) {
    return " PHYSIQUE: whatever this casting category genuinely requires — the build, weight and musculature a real person doing this work or holding this position would have. Do not default to a slim runway physique unless the category itself calls for one.";
  }
  return "";
}

/**
 * Hair, said plainly.
 *
 * A realized trait that never reaches the prompt would be a record that lies:
 * the follow would claim to carry hair while the image model kept picking its
 * own. Family and colour only — length, parting and fringe stay latitude, so
 * eight cousins still look like eight people.
 */
function describeHair(hair: Hair | null): string {
  if (!hair) return "";
  const family =
    hair.family === "shaved"
      ? "a shaved head"
      : hair.family === "coiled"
        ? "coiled natural hair"
        : `${hair.family} hair`;
  return hair.family === "shaved"
    ? ` HAIR: ${family}, ${hair.colour} where it is grown out.`
    : ` HAIR: ${hair.colour} ${family}. The exact cut, parting and styling are open.`;
}

function describeHeritage(components: HeritageComponent[]): string {
  if (components.length === 0) return "";
  if (components.length === 1) return `${components[0].heritage} heritage`;
  // A15: no raw numbers in the prompt. Percentages are control signal, and
  // image models render digits as artefacts or mis-weight them, so the blend
  // is expressed as dominance language instead — the legacy dominance-band
  // craft the heritage ruling names for porting.
  const [dominant, secondary] = components;
  const band = dominant.pct >= 70 ? "predominantly" : "mostly";
  return `${band} ${dominant.heritage} heritage with ${secondary.heritage} features`;
}

/**
 * The final per-candidate prompt.
 *
 * Order is the contract. Character first, direction second, the code-owned
 * constant last with its authority paragraph — so that on the one axis where a
 * language model's output could still misbehave (two capped free-text fields),
 * the rules it might contradict are stated after it and claim precedence over
 * it explicitly.
 */
export function composeCandidatePrompt(input: {
  intent: CastingIntent;
  resolved: ResolvedIdentity;
  archetype: ArchetypeKey;
  seed: number;
}): string {
  const { intent, resolved, archetype } = input;
  const direction = ARCHETYPES[archetype];

  /*
    CASTING CATEGORY — a stated role is a LOCK, not a flavour (founder gate,
    2026-07-31, B5).

    The brief "female model early 20s editorial fashion model" returned people
    who were not plausibly editorial models. The old line — "They read as: X"
    — invited the model to treat the role as an energy to suggest rather than
    a category to cast within, so diversity wandered straight out of the
    category it was supposed to vary inside.

    Legacy enforced this implicitly: every prompt was written from a casting
    director's chair, and a casting director does not put forward someone who
    would be rejected at the door. Made explicit here. Variation still runs
    across heritage, features and energy — but *within* the category, never
    out of it.
  */
  const category = intent.role
    ? [
        `CASTING CATEGORY (ABSOLUTE): This person is cast as — ${intent.role}.`,
        "Every candidate must be a genuinely plausible, castable member of that category: the bone structure, proportions, grooming and bearing a professional casting director would require before putting them forward for it.",
        "Vary heritage, features, colouring and energy WITHIN this category. Never cast outside it. A candidate who would not be credible in this role is a failed candidate, however interesting the face.",
        "Keep the user's own words for the category — do not substitute a generic type for the specific one they named.",
      ].join(" ")
    : "";

  const subject = [
    `SUBJECT: A ${resolved.build ? `${resolved.build} ` : ""}${resolved.sex === "nonbinary" ? "androgynous person" : resolved.sex}, ${describeAge(resolved.ageBand, resolved.agePhase)}, ${describeHeritage(resolved.heritage)}.${describeBuild(resolved.build, intent.role)}${describeHair(resolved.hair)}`,
    intent.characterNotes ? `Character detail: ${intent.characterNotes}.` : "",
    /*
      One axis or the other, never both shouting. A look carries its own
      expression whisper (C3), so stacking a disposition line on top would
      give the image model two different instructions for one face.
    */
    resolved.look
      ? `LOOK: ${LOOKS[resolved.look].thesis} ${LOOKS[resolved.look].avoid} EXPRESSION WHISPER: ${LOOKS[resolved.look].whisper}`
      : `PRESENCE: ${ENERGIES[resolved.energy]}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const directionBlock = `DIRECTION: ${direction.thesis} ${direction.avoid}`;

  // Category first: it decides who is eligible at all, before direction shapes
  // how they are cast and before the constant fixes how they are photographed.
  return [category, subject, directionBlock, PHOTOREAL_HUMAN_CONSTANT]
    .filter(Boolean)
    .join("\n");
}

/**
 * The label under a tile.
 *
 * Names whichever axis this sheet actually varies along, so the caption
 * explains the difference the user is looking at: the look for a modelling
 * brief, the disposition for a character one.
 */
export function personaLineFor(resolved: ResolvedIdentity, read?: string | null): string {
  // A read written for THIS brief beats a label recycled across every sheet.
  if (read) return read;
  if (resolved.look) {
    // Sentence case: these sit under a tile, not in a mono status pill.
    return resolved.look.charAt(0).toUpperCase() + resolved.look.slice(1);
  }
  const labels: Record<EnergyKey, string> = {
    warm: "Warm, unhurried",
    dry: "Dry and flat",
    bright: "Bright, quick",
    grave: "Still and grave",
    open: "Open, easy",
    guarded: "Guarded",
    wry: "Wry",
    plain: "Plain and direct",
  };
  return labels[resolved.energy];
}

/** Exported for the contract test: the constant must survive composition. */
export const COHORT_CONSTANT_MARKERS = [
  FRAMING,
  CAPTURE,
  /*
    SKIN_AND_FEATURES was missing from this array — including from the version
    that shipped before the craft-port audit, and including from the version
    the audit itself declared a working guard. It is the most craft-dense block
    in the file (A1, A5–A10, the structural-features clause), so the one block
    the guard did not cover was the one the audit was triggered by. Caught by
    Fable's skim of the audit, which is the argument for the review step.
  */
  SKIN_AND_FEATURES,
  IDENTITY_INTEGRITY,
  NEGATIVES,
  PRIORITY,
  OVERRIDE,
] as const;

export { AGE_BANDS, BUILDS };

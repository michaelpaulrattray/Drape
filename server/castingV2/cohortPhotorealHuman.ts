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
 * the founder named as the thing that made the old output excellent (catalog
 * §A). Adopted per item, not wholesale: A1 studio directives, A2 sensor
 * physics, A4 neutral grade, A5–A8 macro protocols for eyes/lashes/lips/brows,
 * A9 skin realism clamp, A10 vellus disambiguation, A12 negative list, A14
 * anti-mood-word discipline, A15 no raw numbers, E1 fixed pose. Left behind:
 * the bare-face/undergarment rules, retired as presentation by the
 * wardrobe-baseline ruling — V2 presentation views are clothed.
 */
import {
  ARCHETYPES,
  ARCHETYPE_KEYS,
  AGE_BANDS,
  BUILDS,
  ENERGIES,
  ENERGY_KEYS,
  HERITAGES,
  type ArchetypeKey,
  type AgeBand,
  type Build,
  type CastingIntent,
  type EnergyKey,
  type Heritage,
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
  "FRAMING: Single subject, waist-up, centred, square to camera, head straight with no tilt.",
  "Shoulders level. Arms relaxed at the sides or loosely crossed. Mouth closed.",
  "Background: seamless mid-grey studio backdrop filling the entire frame, no edges, no borders, no floor line.",
  "WARDROBE: plain unbranded clothing in neutral grey or off-white — a simple crew-neck tee or plain shirt.",
  "No jackets, no accessories, no jewellery, no hats, no props of any kind, nothing held in the hands.",
].join(" ");

/**
 * A2 + A3 + A4, kept close to the legacy wording because the wording is the
 * craft — a named sensor class and aperture produce a lens signature that
 * "high quality photo" does not.
 */
const CAPTURE = [
  "CAPTURE: Medium-format sensor, 85mm equivalent, f/5.6–f/8, subject sharp front to back.",
  "Bare direct near-axis flash, shadow falling behind the subject, no gels and no diffusion — a true casting polaroid, unflattering and honest.",
  "Neutral daylight grade, 5500–5800K. No stylized colour grading, no teal-orange, no filter look.",
  "Fine luminance-dominant grain, barely visible, like fine sand. No colour noise.",
].join(" ");

/**
 * A5–A10. The macro protocols are the difference between a face and a render:
 * dead glassy eyes and drawn-on brows are the two tells a casting director
 * sees first, and each needs naming individually or the model averages them
 * away.
 */
const SKIN_AND_FEATURES = [
  "REALISM: RAW skin with high micro-contrast — visible pores, vellus fuzz, uneven tone, real blemishes and asymmetry.",
  "No beauty retouching, no surface smoothing, no CGI sheen, no painterly softness, no excessive symmetry.",
  "EYES: the iris is not a flat disc — render striations radiating from the pupil, a distinct limbal ring, crisp catchlights, corneal gloss, and faint sclera vascularity. A perfectly white sclera looks synthetic.",
  "LASHES: individual strands clumping in irregular groups, casting micro-shadows. Bare and natural, never a solid dark mass.",
  "LIPS: vertical plicae and a natural moisture gradient, glossier at the centre. The lip border is organic and slightly irregular, never a vector-sharp line.",
  "BROWS: individual hairs with visible growth direction — upward near the nose, arching laterally, tapering at the tail. Never a solid drawn-on block.",
  "Vellus fuzz is translucent and near-invisible, catching light only at extreme angles — it is NOT stubble and NOT pigmented.",
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

/** Everything code owns, in order, as one block. */
export const PHOTOREAL_HUMAN_CONSTANT = [FRAMING, CAPTURE, SKIN_AND_FEATURES, NEGATIVES, OVERRIDE].join(
  "\n",
);

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
function varyHeritage(seed: number): HeritageComponent[] {
  const primary = HERITAGES[seed % HERITAGES.length] as Heritage;
  if (seed % 10 >= 3) return [{ heritage: primary, pct: 100 }];
  const offset = 1 + ((seed >>> 8) % (HERITAGES.length - 1));
  const secondary = HERITAGES[(seed % HERITAGES.length + offset) % HERITAGES.length] as Heritage;
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
): ResolvedIdentity {
  const seed = hash(`${rollSeed}:${position}`);

  return {
    sex: intent.sex ?? varySex(position, rollSeed),
    ageBand: intent.ageBand ?? weightedPick(AGE_WEIGHTS, seed >>> 3),
    heritage: intent.heritage.length > 0 ? intent.heritage : varyHeritage(seed >>> 5),
    build: intent.build ?? weightedPick(BUILD_WEIGHTS, seed >>> 7),
    // Energy is the one axis that cycles rather than samples: eight candidates
    // against eight energies gives one of each, which is the most legible
    // difference a sheet can carry. Stated energy locks it flat across all
    // eight (plan line 205).
    energy: intent.energy ?? ENERGY_KEYS[position % ENERGY_KEYS.length],
  };
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

function describeAge(band: AgeBand, seed: number): string {
  if (band === "70s+") return "in their seventies or older";
  const decade = band.replace("s", "");
  const phase = ["early", "mid", "late"][seed % 3];
  return band === "teens" ? `in their ${phase} teens` : `in their ${phase} ${decade}s`;
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

  const subject = [
    `SUBJECT: A ${resolved.build} ${resolved.sex === "nonbinary" ? "androgynous person" : resolved.sex}, ${describeAge(resolved.ageBand, input.seed)}, ${describeHeritage(resolved.heritage)}.`,
    // C6's archetype fidelity gate: the user's own words survive into every
    // candidate. "Punk drummer" becoming a generic editorial face is the
    // failure this line exists to prevent.
    intent.role ? `They read as: ${intent.role}.` : "",
    intent.characterNotes ? `Character detail: ${intent.characterNotes}.` : "",
    `PRESENCE: ${ENERGIES[resolved.energy]}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const directionBlock = `DIRECTION: ${direction.thesis} ${direction.avoid}`;

  return [subject, directionBlock, PHOTOREAL_HUMAN_CONSTANT].join("\n");
}

/** The label under a tile. Derived from the energy the adapter resolved. */
export function personaLineFor(resolved: ResolvedIdentity): string {
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
export const COHORT_CONSTANT_MARKERS = [FRAMING, CAPTURE, NEGATIVES, OVERRIDE] as const;

export { AGE_BANDS, BUILDS };

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
  AGE_PHASES,
  ARCHETYPES,
  ARCHETYPE_KEYS,
  AGE_BANDS,
  BUILDS,
  ENERGIES,
  ENERGY_KEYS,
  HERITAGES,
  type ArchetypeKey,
  type AgeBand,
  type AgePhase,
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
  /*
    CROP (founder gate, 2026-07-31): the first sheets cropped scalps and read
    as mugshots. A casting frame has air above the head — a tight crop reads as
    a booking photo no matter how good the light is.
  */
  "FRAMING: Single subject, waist-up, centred, square to camera, head straight with no tilt.",
  "CROP: The entire head is inside the frame with natural headroom — clear space above the hair, never touching or cutting the top edge. The scalp and hairline must never be cropped.",
  "Frame from mid-torso up in a 4:5 portrait. Shoulders fully inside the frame with margin at both sides.",
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
  "CAMERA: Medium-format sensor, Hasselblad class. 85mm equivalent, f/5.6–f/8. Subject sharp front to back.",
  "Fine luminance-dominant noise, barely visible, like fine sand. No colour noise.",
  "LIGHTING: Direct on-camera or slightly off-axis front flash. Sharp, honest, bright and even light with shadows falling directly behind the subject. No gels, no diffusion.",
  /*
    A3's deferral, kept whole. Without it the lighting block silently
    overrides whatever skin finish the character calls for, and every
    candidate comes back with the same sheen.
  */
  "How the skin RESPONDS to this light — specular, matte or dewy — is defined by the subject's own skin finish. Defer to that.",
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
    /*
      A stated phase is a lock. Only an unstated one varies — otherwise
      "early 20s" gets re-rolled into mid and late across the sheet, which is
      exactly how the founder's brief came back reading 28-35.
    */
    agePhase: intent.agePhase ?? AGE_PHASES[(seed >>> 11) % AGE_PHASES.length],
    heritage: intent.heritage.length > 0 ? intent.heritage : varyHeritage(seed >>> 5),
    /*
      Stated build wins. Otherwise: if the brief named a casting category, the
      category owns physique and this stays null — varying it would cast
      outside the category the user asked for (founder gate B5). With no
      category, street-real variety across builds is exactly right.
    */
    build: intent.build ?? (intent.role ? null : weightedPick(BUILD_WEIGHTS, seed >>> 7)),
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
    `SUBJECT: A ${resolved.build ? `${resolved.build} ` : ""}${resolved.sex === "nonbinary" ? "androgynous person" : resolved.sex}, ${describeAge(resolved.ageBand, resolved.agePhase)}, ${describeHeritage(resolved.heritage)}.`,
    intent.characterNotes ? `Character detail: ${intent.characterNotes}.` : "",
    `PRESENCE: ${ENERGIES[resolved.energy]}.`,
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

/**
 * The axis registry — one place that knows every identity axis exists.
 *
 * M7 slice zero. The problem it closes is not any single bug; it is the shape
 * six of them shared. Six times an axis was added, wired into resolution, and
 * then missed by one of the things that has to know about it — the deference
 * check, the follow anchor, the taste pass, the composer, the record. Every one
 * was found by the founder's eye rather than by a test, because the contract
 * "everything that resolves an axis must also do X" was a discipline invariant
 * repeated across files rather than a thing code could check.
 *
 * The identity space is three shelves and they were enumerated three different
 * ways:
 *
 *   1. **resolver axes** — sex, age, heritage, build, hair colour, energy,
 *      look. Enumerated only by convention: a `??` chain in
 *      `resolveCandidateIdentity` and nothing else. All six drop-a-stated-fact
 *      bugs lived here.
 *   2. **realized axes** — the eight under `REALIZED_AXIS_KEYS`. Already
 *      registry-shaped, already test-pinned, and the model for the rest.
 *   3. **roll-level treatments** — archetype, skin finish, variation axis.
 *      Per-sheet by framing law, still lockable when the brief states them.
 *
 * This module is shelf 2's structure applied to all three, and **the union is
 * pinned by one test** (`axisRegistry.test.ts`), so a new axis anywhere fails
 * the build until it is registered.
 *
 * ---
 *
 * **WHAT IS DELIBERATELY NOT HERE.** The registry describes; it does not
 * resolve. `resolveCandidateIdentity` keeps its `??` chains for now, because
 * they are not one rule applied eight times — `agePhase` never consults the
 * anchor, `build` has the category-null rule, `sex` carries the sex-coded
 * implication, `energy` cycles with a per-roll offset, `look` drifts
 * positionally. A generic resolver has to reproduce every one of those exactly,
 * and "the suite is green" would then rest on golden tests over stochastic
 * output. The single fact resolver arrives with its first consumer, one axis at
 * a time, under the tests this module makes possible.
 *
 * What IS structural here, because a registry nothing depends on is a document
 * that the code drifts away from — which is the exact failure this whole
 * milestone is paying off:
 *
 *   - **Keys are derived, never listed.** `AxisKey` is composed from
 *     `keyof LockFacts`, `REALIZED_AXIS_KEYS` and the resolved-identity fields;
 *     a hand-kept list would be the parallel-list failure wearing the fix's
 *     clothes.
 *   - **The taste pass writes through a typed surface** whose key type is
 *     exactly the taste-writable set, and that set is provably a subset of the
 *     realized shelf. The per-rule skip lists become a compile error.
 *   - **Every entry carries a live accessor and a live footprint function** the
 *     sweep executes. A row that merely declares something cannot be inert.
 */

import {
  ARCHETYPES,
  ENERGIES,
  LOOKS,
  type AgeBand,
  type AgePhase,
  type ArchetypeKey,
  type Build,
  type CastingIntent,
  type EnergyKey,
  type Heritage,
  type HeritageComponent,
  type LockFacts,
  type LookKey,
  type ResolvedIdentity,
  type Sex,
  type VariationAxis,
} from "./castingIntent";
import type { HairColour } from "../../shared/castingVocabularies";
import {
  REALIZED_AXIS_KEYS,
  type BrowStyle,
  type EyeColour,
  type FacialHair,
  type HairModifiers,
  type HairStyle,
  type HairTexture,
  type RealizedAxes,
  type SkinCharacter,
  type SkinFinish,
  type WornState,
} from "../../shared/castingRealization";
import { BEARD_BIAS_PROSE, HAIR_BIAS_PROSE, type StylingResolution } from "./stylingResolution";
import { FINISH_RENDER } from "./hairStyles";
import { beardBucket } from "./heritageNeighbourhoods";

/* --------------------------------------------------------------- the keys */

/**
 * Every axis, with the type of the value it resolves to.
 *
 * This map is the registry's spine: `AxisKey` is `keyof` it, the taste-write
 * surface is a `Pick` of it, and the declarations are typed against it. One
 * definition, so an axis cannot exist in one of those and not the others.
 *
 * `hairColour` is the one key whose name differs from where it is stored. It
 * lives at `identity.hair.colour` for historical reasons — see
 * `IDENTITY_FIELD_AXES` — and it is registered on the REALIZED shelf, because
 * by every behavioural test that is what it is: drawn by `varyHair`, never a
 * member of `LockFacts`, inherited through the follow anchor, and rewritten by
 * the taste pass's colour pair-breaker. Calling it a resolver axis and then
 * carving an exception into the taste-write law would hollow out the law to
 * accommodate a filing mistake.
 */
export type AxisValues = {
  /* shelf 1 — resolver axes */
  sex: Sex;
  ageBand: AgeBand;
  agePhase: AgePhase;
  heritage: HeritageComponent[];
  build: Build | null;
  energy: EnergyKey;
  look: LookKey | null;
  /* shelf 2 — realized axes (the eight of `RealizedAxes`, plus hair colour) */
  eyeColour: EyeColour;
  hairStyle: HairStyle | null;
  facialHair: FacialHair | null;
  hairTexture: HairTexture | null;
  hairModifiers: HairModifiers | null;
  wornState: WornState | null;
  browStyle: BrowStyle;
  skinCharacter: SkinCharacter;
  hairColour: HairColour | null;
  /* shelf 3 — roll-level treatments */
  archetype: ArchetypeKey;
  skinFinish: SkinFinish;
  variationAxis: VariationAxis | null;
};

export type AxisKey = keyof AxisValues;

export type AxisShelf = "resolver" | "realized" | "treatment";

/**
 * The realized SHELF, which is `RealizedAxes`' keys plus hair colour.
 *
 * Derived from `REALIZED_AXIS_KEYS` rather than restated, so the eight stay in
 * one place. The shelf is deliberately the broader concept: `RealizedAxes` is
 * an object shape, and hair colour is a realized axis that happens to be stored
 * outside it.
 */
export const REALIZED_SHELF = [...REALIZED_AXIS_KEYS, "hairColour"] as const;
export type RealizedShelfAxis = (typeof REALIZED_SHELF)[number];

/* ------------------------------------------------- the completeness bindings */

/*
  These four lines are the union completeness test's type-level half, and they
  fail the BUILD rather than a suite. A test can be skipped; a compile error
  cannot. Each one says "this other enumeration is fully covered by the
  registry", from a direction the registry cannot fake.
*/

/** Every fact the brief can pin is a registered axis. */
type LocksAreRegistered = keyof LockFacts extends AxisKey ? true : never;
const _locksAreRegistered: LocksAreRegistered = true;

/** Every realized axis is a registered axis. */
type RealizedAreRegistered = (typeof REALIZED_AXIS_KEYS)[number] extends AxisKey ? true : never;
const _realizedAreRegistered: RealizedAreRegistered = true;

/** `RealizedAxes` has no field that `REALIZED_AXIS_KEYS` forgot. */
type RealizedFieldsEnumerated = keyof RealizedAxes extends (typeof REALIZED_AXIS_KEYS)[number] ? true : never;
const _realizedFieldsEnumerated: RealizedFieldsEnumerated = true;

/**
 * Every field of `ResolvedIdentity` maps to the axes it carries.
 *
 * This is the binding that actually catches the next person: adding a field to
 * `ResolvedIdentity` without registering an axis for it stops compiling here,
 * which is precisely the moment six previous axes slipped through.
 *
 * `stylingResolution` is excluded because it is not an axis — it is the record
 * of which TIER the styling axes were authored at, i.e. metadata about the other
 * rows rather than a row itself. `realized` is excluded because its contents are
 * enumerated by `REALIZED_AXIS_KEYS` above.
 */
type IdentityAxisField = Exclude<keyof ResolvedIdentity, "stylingResolution" | "realized">;

export const IDENTITY_FIELD_AXES = {
  sex: ["sex"],
  ageBand: ["ageBand"],
  agePhase: ["agePhase"],
  heritage: ["heritage"],
  build: ["build"],
  energy: ["energy"],
  look: ["look"],
  /*
    One field, one axis — the colour. `Hair` also carries a `family`, and that
    is D-87: it is drawn independently of `hairStyle`, persisted on every
    candidate, and composed into nothing. Registering it as an axis would make
    the sweep fail on a value that has no owner; leaving it unregistered would
    be the silence the registry exists to end. So it is named here, in the
    mapping, as a known gap with a decision attached.
  */
  hair: ["hairColour"],
} satisfies Record<IdentityAxisField, readonly AxisKey[]>;

/* ------------------------------------------------------ the taste-write law */

/**
 * The axes the sheet-level taste pass may rewrite.
 *
 * **This tuple is the law's single source.** The registry's `tasteWritable`
 * flag is computed from it, the write surface's key type is derived from it,
 * and the line below proves it never escapes the realized shelf. The ratified
 * rule — *only realized values are writable by the sheet taste pass* — was
 * previously enforced by per-rule skip lists inside `applySheetTaste`, i.e. by
 * remembering. Now adding `sex` here is a compile error.
 */
export const TASTE_WRITABLE_AXES = [
  "hairStyle",
  "hairTexture",
  "hairModifiers",
  "wornState",
  "facialHair",
  "hairColour",
] as const;
export type TasteWritableAxis = (typeof TASTE_WRITABLE_AXES)[number];

/** THE LAW, as a type. Only realized values are writable by the taste pass. */
type OnlyRealizedIsTasteWritable = TasteWritableAxis extends RealizedShelfAxis ? true : never;
const _onlyRealizedIsTasteWritable: OnlyRealizedIsTasteWritable = true;

/**
 * What one candidate's taste pass may change, and nothing else.
 *
 * An object literal carrying `eyeColour` fails to compile against this, which
 * is the whole point: the biology tier is not the taste pass's to touch, and
 * that used to be true only for as long as everyone remembered it.
 */
export type TasteWrite = Partial<Pick<AxisValues, TasteWritableAxis>>;

/** The minimum shape the taste pass writes through. */
export type TasteTarget = {
  hair: { family: string; colour: HairColour } | null;
  realized: RealizedAxes;
};

/**
 * Apply a taste decision, routing each axis to wherever it is actually stored.
 *
 * The routing lives here, once, so that `hairColour`'s odd home is a fact this
 * module knows and no rule elsewhere has to. A rule says *what* it decided; it
 * never says where the value goes.
 */
export function applyTasteWrite<T extends TasteTarget>(candidate: T, write: TasteWrite): T {
  const keys = Object.keys(write) as TasteWritableAxis[];
  if (keys.length === 0) return candidate;

  let hair = candidate.hair;
  const realized = { ...candidate.realized };

  for (const key of keys) {
    if (key === "hairColour") {
      const colour = write.hairColour;
      // A suppressed hair axis has nowhere to put a colour, and inventing a
      // `hair` object here would resurrect the record it was nulled to prevent.
      if (colour != null && hair) hair = { ...hair, colour };
      continue;
    }
    (realized as Record<string, unknown>)[key] = write[key];
  }

  /*
    THE SILHOUETTE FOLLOWS THE CUT — D-87's other half, and the reason this is
    a helper rather than a spread at each call site.

    `hair.family` is a denormalized mirror of the cut's family. It used to be an
    independent draw, which is how a candidate came to persist "buzz cut" beside
    "long". Deriving it once at resolution fixed the draw and did NOT fix the
    divergence, because two more writers change the cut afterwards: the sheet
    taste pass swapping a style, and the variance budget's adjacent-cut rung.
    Each of them would have had to remember, which is the discipline invariant
    this whole milestone exists to delete.

    So the mirror is maintained HERE, by the one surface every non-resolution
    write goes through. A rule says which cut it chose; it never has to know
    that a second field shadows it.
  */
  if (write.hairStyle && hair) hair = { ...hair, family: write.hairStyle.family };

  return { ...candidate, hair, realized };
}

/* ------------------------------------------------------ tagged lock-states */

/**
 * Open, or locked to a value.
 *
 * The convention this makes explicit is `CastingIntent`'s load-bearing one:
 * **null means the brief did not say.** That convention stays exactly as it is
 * on the wire, in the chips, in the echo and in the persisted `compiledBrief` —
 * this is a DERIVED VIEW at the resolver boundary, never a change to the intent
 * shape. Rewriting the intent into tagged unions would break the wire schema,
 * every chip reader and every row already on disk, to buy a clarity that a
 * derivation provides for free.
 *
 * What it buys: a resolver can ask "is this axis open?" once, instead of every
 * reader re-deciding what null means for its particular axis — which is how
 * `heritage` (empty array, not null) and `build` (null both when unstated AND
 * when a category owns it) came to mean two different things at two sites.
 */
export type AxisState<T> = { kind: "open" } | { kind: "locked"; value: T };

const OPEN = { kind: "open" } as const;

/**
 * The lockable axes' state, read from the intent.
 *
 * Only the lockable ones have a state to read: an axis the brief cannot pin is
 * open by construction, and offering `lockStateOf(intent, "eyeColour")` would
 * invite a caller to believe otherwise.
 */
export function lockStateOf<K extends keyof LockFacts>(
  intent: CastingIntent,
  axis: K,
): AxisState<NonNullable<AxisValues[K]>> {
  if (axis === "heritage") {
    // Heritage says "unstated" with an empty array rather than a null, because
    // it is a blend and a blend of nothing is a list of nothing.
    return intent.heritage.length > 0
      ? { kind: "locked", value: intent.heritage as NonNullable<AxisValues[K]> }
      : OPEN;
  }
  const value = intent[axis as Exclude<K, "heritage">];
  return value == null ? OPEN : { kind: "locked", value: value as NonNullable<AxisValues[K]> };
}

/* ------------------------------------------- cross-axis implications */

/**
 * An implication is a registry citizen, not a special case in the resolver.
 *
 * Two strengths, and the difference is ratified (founder, 2026-08-01):
 *
 *   - **hard** — a stated fact on one axis RESOLVES another, because leaving it
 *     open would manufacture a contradiction. "A 25 year old heavy metal bogan
 *     with a beard" left sex open, so it alternated, and four candidates
 *     resolved female while carrying the stated beard. Shipped.
 *   - **soft** — a fact RE-WEIGHTS another axis without deciding it
 *     (`poolTendencies`: a category implying an age skew or a clean-shaven
 *     lean). Held, and deliberately not built here.
 *
 * **The test any implication must pass: RESOLVE ONLY WHAT WOULD OTHERWISE
 * CONTRADICT, NEVER INFER BEYOND.** A stated beard forces a contradiction on an
 * alternated sheet, so sex is resolved to remove it. "Clean-shaven" forces no
 * contradiction on anyone — every woman is clean-shaven — so inferring male
 * from it would invent a lock out of a fact that carries none.
 *
 * Registered rather than merely implemented so that the second one is added
 * beside the first, under the same test, instead of somewhere else.
 */
export type CrossAxisImplication = {
  /** What the brief has to have stated. */
  from: string;
  /** The axis it resolves or re-weights. */
  to: AxisKey;
  strength: "hard" | "soft";
  /** Why leaving `to` open would produce a contradiction rather than variety. */
  because: string;
};

export const CROSS_AXIS_IMPLICATIONS: readonly CrossAxisImplication[] = [
  {
    from: "sex-coded facial hair (beard, moustache, stubble, goatee…)",
    to: "sex",
    strength: "hard",
    because:
      "An unstated sex alternates across the sheet, so half the candidates carry a stated beard on a female face — a contradiction neither axis can see on its own. A stated sex is read first, so 'a bearded woman' renders as written.",
  },
];

/* ------------------------------------------------------------ suppressors */

/**
 * The named, closed reasons an axis composes nothing while holding a value.
 *
 * This list is the sweep's only escape hatch, and its shape is deliberate. A
 * per-axis `composesWhen` predicate would be satisfied by `() => false` and the
 * sweep would quietly become decorative; a SHARED, NAMED suppressor cannot be
 * written to excuse one axis, has to state its reason, and shows up as a
 * visible diff when someone adds one.
 *
 * The sweep asserts both halves: when a suppressor is active the axis may be
 * silent, and **when none is active the footprint MUST appear**.
 *
 * Note how few there are. Deference does not appear, because deference does not
 * suppress — it NULLS (`withHonestRecord`), and a null value is covered by the
 * sweep's null arm. An axis that deference silences without nulling is a record
 * that lies, and the sweep is supposed to catch it rather than excuse it.
 */
export type SuppressorKey =
  /** A look that VARIES across the eight carries its own expression whisper, so
   *  a presence line on top would give the model two instructions for one face.
   *  A LOCKED look does not suppress it — that was the sameness bug. */
  | "varying-look"
  /** The brief spoke about the eyes, so no authored eye line is emitted. */
  | "stated-eyes"
  /** The brief spoke about the brows. */
  | "stated-brows"
  /** The brief spoke about the skin. */
  | "stated-skin"
  /** The cut's own NAME already says how it is worn — "a ponytail, in a
   *  ponytail" is doubling the model reads as emphasis. */
  | "cut-names-its-worn-state";

/**
 * Which suppressors are active for one candidate.
 *
 * Takes plain booleans rather than reaching for the composer's own predicates,
 * for two reasons. It keeps this module free of an import cycle when the
 * composer eventually reads the registry; and more importantly it keeps the
 * sweep's excuse-list from being derived from the very code it is auditing —
 * an assertion that asks the composer whether the composer was right is not an
 * assertion.
 */
export function suppressorsFor(input: {
  tier: StylingResolution;
  /** The sheet varies BY look, so each candidate's whisper is the difference. */
  lookVaries: boolean;
  statedEyes: boolean;
  statedBrows: boolean;
  statedSkin: boolean;
  /** The resolved cut's own name already says how it is worn. */
  cutNamesWornState: boolean;
}): ReadonlySet<SuppressorKey> {
  const active = new Set<SuppressorKey>();
  if (input.lookVaries) active.add("varying-look");
  if (input.statedEyes) active.add("stated-eyes");
  if (input.statedBrows) active.add("stated-brows");
  if (input.statedSkin) active.add("stated-skin");
  /*
    Only at prescribe tier. The bias line states the worn state outright
    regardless of the cut's name, because at that tier there is no name in the
    prompt for it to double up against — and worn state is the axis that
    survives a heavily-locked sheet, so it must not be excused there.
  */
  if (input.cutNamesWornState && input.tier === "prescribe") active.add("cut-names-its-worn-state");
  return active;
}

/* --------------------------------------------------------- the declaration */

/**
 * What the sweep needs in order to look at one axis on one candidate.
 *
 * Carries the whole context rather than a bare value because several axes only
 * make sense against another: `agePhase`'s footprint is a year range chosen by
 * the BAND, `hairStyle`'s is its name at prescribe tier and its family's bias
 * line at bias tier.
 */
export type AxisContext = {
  identity: ResolvedIdentity;
  treatments: RollTreatments;
  /** The tier the styling axes were authored at for this candidate. */
  tier: StylingResolution;
  /** Suppressors active for this candidate. */
  suppressed: ReadonlySet<SuppressorKey>;
};

/** The roll-level treatments — chosen once per sheet by the framing law. */
export type RollTreatments = {
  archetype: ArchetypeKey;
  skinFinish: SkinFinish;
  variationAxis: VariationAxis | null;
};

export type AxisDecl<K extends AxisKey> = {
  key: K;
  shelf: AxisShelf;
  /**
   * **described** — the axis names a fact about the picture, so a non-null
   * value must leave a footprint in the composed prompt.
   * **selector** — the axis governs how resolution behaves and describes
   * nothing, so it composes nothing by design. There is exactly one, and the
   * count is pinned; a second needs a reason.
   */
  kind: "described" | "selector";
  /** The brief can pin it (i.e. it is in `LockFacts`). */
  lockable: boolean;
  /** A chip can unpin it. */
  unlockable: boolean;
  /** The user can set it by hand from the brief echo. */
  overridable: boolean;
  /** The styling tiers in which a value of this axis is expected to compose. */
  tiers: readonly StylingResolution[];
  /** Suppressors that legitimately silence this axis. */
  suppressors: readonly SuppressorKey[];
  /**
   * Real values that deliberately compose nothing — enumerated, never a
   * predicate. "plain" skin and "loose" hair are the ordinary cases: saying
   * them out loud would spend a prompt line on the absence of a feature.
   */
  silent: readonly string[];
  /** Read the persisted value. */
  read: (ctx: AxisContext) => AxisValues[K] | null | undefined;
  /** Does this value leave a mark on the composed prompt? */
  footprint: (value: NonNullable<AxisValues[K]>, prompt: string, ctx: AxisContext) => boolean;
};

const ALL_TIERS = ["stated", "prescribe", "bias"] as const;
/** Styling tiers where an authored styling line reaches the prompt at all. */
const AUTHORED_TIERS = ["prescribe", "bias"] as const;

const has = (prompt: string, needle: string) => prompt.includes(needle);

/**
 * Years per band phase, mirrored from the composer.
 *
 * A deliberate second copy, and the only one in this file. `describeAge` is
 * private to the composer, and exporting it so a test could reach it would make
 * the assertion circular — the sweep would be checking that the composer agrees
 * with itself. An independent statement of what the prompt must contain is the
 * only kind that can fail.
 */
const AGE_YEARS: Record<AgeBand, readonly [string, string, string]> = {
  teens: ["16–17", "17–18", "18–19"],
  "20s": ["20–23", "24–26", "27–29"],
  "30s": ["30–33", "34–36", "37–39"],
  "40s": ["40–43", "44–46", "47–49"],
  "50s": ["50–53", "54–56", "57–59"],
  "60s": ["60–63", "64–66", "67–69"],
  "70s+": ["70–74", "75–79", "80+"],
};
const AGE_PHASE_ORDER = ["early", "mid", "late"] as const;

/**
 * THE REGISTRY.
 *
 * Rows are grouped by shelf and each one carries a live accessor and a live
 * footprint. Nothing here is a claim the suite cannot execute.
 */
export const AXIS_REGISTRY = {
  /* ---------------------------------------------------- shelf 1: resolver */
  sex: {
    key: "sex",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: true,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.sex,
    footprint: (value, prompt) =>
      has(prompt, value === "nonbinary" ? "androgynous person" : value),
  },
  ageBand: {
    key: "ageBand",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: true,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.ageBand,
    footprint: (value, prompt) =>
      has(prompt, value === "70s+" ? "in their seventies or older" : `in their `)
      && AGE_YEARS[value].some((years) => has(prompt, years)),
  },
  agePhase: {
    key: "agePhase",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: false,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.agePhase,
    /*
      The phase reaches the prompt as a YEAR RANGE, and at "70s+" that is the
      only way it reaches it at all — the spoken form there is "in their
      seventies or older" for every phase. Checking the year range rather than
      the word is what makes this assertion true in all seven bands.
    */
    footprint: (value, prompt, ctx) =>
      has(prompt, AGE_YEARS[ctx.identity.ageBand][AGE_PHASE_ORDER.indexOf(value)]),
  },
  heritage: {
    key: "heritage",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: true,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.heritage,
    /*
      Every component, not just the dominant one. A blend that silently drops
      its secondary is a stated fact lost — the exact defect the two-value
      heritage extension was ruled in to fix.
    */
    footprint: (value, prompt) =>
      value.length > 0 && value.every((component) => has(prompt, component.heritage)),
  },
  build: {
    key: "build",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: true,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    /*
      Null is the honest reading, not an omission: a stated casting category
      owns physique (gate B5), so build stays null and the category is told to
      own it out loud. The sweep's null arm covers exactly that.
    */
    read: (ctx) => ctx.identity.build,
    footprint: (value, prompt) => has(prompt, `PHYSIQUE: ${value} build`),
  },
  energy: {
    key: "energy",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: true,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: ["varying-look"],
    silent: [],
    read: (ctx) => ctx.identity.energy,
    footprint: (value, prompt) => has(prompt, ENERGIES[value]),
  },
  look: {
    key: "look",
    shelf: "resolver",
    kind: "described",
    lockable: true,
    unlockable: false,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.look,
    footprint: (value, prompt) => has(prompt, LOOKS[value].thesis),
  },

  /* ---------------------------------------------------- shelf 2: realized */
  eyeColour: {
    key: "eyeColour",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: ALL_TIERS,
    suppressors: ["stated-eyes"],
    silent: [],
    read: (ctx) => ctx.identity.realized.eyeColour,
    footprint: (value, prompt) => has(prompt, `EYE COLOUR: ${value}`),
  },
  browStyle: {
    key: "browStyle",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: ALL_TIERS,
    suppressors: ["stated-brows"],
    silent: [],
    read: (ctx) => ctx.identity.realized.browStyle,
    footprint: (value, prompt) => has(prompt, `BROW CHARACTER: ${value}`),
  },
  skinCharacter: {
    key: "skinCharacter",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: ALL_TIERS,
    suppressors: ["stated-skin"],
    /*
      "Plain" is most faces. Spending a prompt line to say a person has no
      distinguishing skin feature would crowd the lines that do carry one, and
      the weights are tuned so that a sheet reads like a street rather than like
      a casting gimmick where everybody has something.
    */
    silent: ["plain"],
    read: (ctx) => ctx.identity.realized.skinCharacter,
    footprint: (value, prompt) =>
      value === "a beauty mark" ? has(prompt, "beauty mark") : has(prompt, value),
  },
  hairStyle: {
    key: "hairStyle",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: AUTHORED_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.realized.hairStyle,
    /*
      Two resolutions, one axis. At prescribe tier the cut has a NAME and the
      name is what carries a person's taste; at bias tier a named cut would
      compete with the casting the user asked for, so only the silhouette
      speaks. Asserting the name in both would demand the defect D-80 removed.
    */
    footprint: (value, prompt, ctx) =>
      ctx.tier === "bias"
        ? has(prompt, HAIR_BIAS_PROSE[value.family] ?? "")
        : has(prompt, value.name),
  },
  hairTexture: {
    key: "hairTexture",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: AUTHORED_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.realized.hairTexture,
    /*
      A plain substring, and the first version of this was cleverer and wrong.

      A cut whose own name carries the grain does not say it twice — "a black
      curly curly crop" came out of an early live sheet — so the composer emits
      the name alone there. The first footprint mirrored that branch and looked
      for the NAME, which is absent at bias tier where no cut is ever named, and
      it reported seven false findings on perfectly correct prompts.

      The plain check covers both without knowing which branch ran: "curly crop"
      contains "curly", and so does "Naturally curly". A footprint should ask
      whether the fact reached the picture, not re-derive how the sentence was
      built — that second question is the composer's, and asking it here is what
      makes an assertion circular.
    */
    footprint: (value, prompt) => has(prompt, value),
  },
  hairModifiers: {
    key: "hairModifiers",
    shelf: "realized",
    kind: "described",
    /*
      PRESCRIBE ONLY. In bias mode the prompt carries a silhouette rather than a
      named cut, so the components that belong to the cut were never asked for
      either — and they persist null there, which the null arm covers.
    */
    tiers: ["prescribe"],
    lockable: false,
    unlockable: false,
    overridable: false,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.realized.hairModifiers,
    /*
      A composite, so the footprint is every component that resolved. All-null
      is the ordinary case — four candidates in five wear at most two — and it
      reads as silence rather than as a miss.
    */
    footprint: (value, prompt) => {
      const worn = Object.values(value).filter((part): part is string => Boolean(part));
      return worn.length === 0 || worn.every((part) => has(prompt, part));
    },
  },
  wornState: {
    key: "wornState",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: AUTHORED_TIERS,
    suppressors: ["cut-names-its-worn-state"],
    /*
      "Loose" is the commonest answer and the one the prompt leaves unsaid, for
      the same reason "plain" skin is unsaid. The axis exists because nothing
      owning it made every sheet loose; naming the exceptions is what makes it
      vary.
    */
    silent: ["loose"],
    read: (ctx) => ctx.identity.realized.wornState,
    footprint: (value, prompt) => has(prompt, value.replace(/^worn /, "")),
  },
  facialHair: {
    key: "facialHair",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: AUTHORED_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.realized.facialHair,
    /*
      Bias tier collapses five enum values into two buckets and says the bucket,
      never the length — deferring a fact is not licence to invent a bigger one.
    */
    footprint: (value, prompt, ctx) =>
      ctx.tier === "bias"
        ? has(prompt, BEARD_BIAS_PROSE[beardBucket(value) ?? ""] ?? "")
        : has(prompt, value),
  },
  hairColour: {
    key: "hairColour",
    shelf: "realized",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: AUTHORED_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.identity.hair?.colour ?? null,
    footprint: (value, prompt) => has(prompt, value),
  },

  /* --------------------------------------------------- shelf 3: treatments */
  archetype: {
    key: "archetype",
    shelf: "treatment",
    kind: "described",
    /*
      Lockable, and it matters that it is: the treatments are per-sheet by the
      framing law, but a brief that NAMES a direction has pinned it, and the
      framing law is about comparability across the eight rather than about the
      user not being allowed to choose.
    */
    lockable: false,
    unlockable: true,
    overridable: true,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.treatments.archetype,
    footprint: (value, prompt) => has(prompt, ARCHETYPES[value].thesis),
  },
  skinFinish: {
    key: "skinFinish",
    shelf: "treatment",
    kind: "described",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: ALL_TIERS,
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.treatments.skinFinish,
    footprint: (value, prompt) => has(prompt, FINISH_RENDER[value]),
  },
  variationAxis: {
    key: "variationAxis",
    shelf: "treatment",
    /*
      THE ONE SELECTOR. It decides whether the eight differ by look or by
      disposition, which changes what gets composed without ever being composed
      itself. The count is pinned by test: a second selector is a claim that
      another axis describes nothing, and that claim should have to be made out
      loud.
    */
    kind: "selector",
    lockable: false,
    unlockable: false,
    overridable: false,
    tiers: [],
    suppressors: [],
    silent: [],
    read: (ctx) => ctx.treatments.variationAxis,
    footprint: () => false,
  },
} satisfies { [K in AxisKey]: AxisDecl<K> };

export const AXIS_KEYS = Object.keys(AXIS_REGISTRY) as AxisKey[];

export function axesOnShelf(shelf: AxisShelf): AxisKey[] {
  return AXIS_KEYS.filter((key) => AXIS_REGISTRY[key].shelf === shelf);
}

/** Is this axis writable by the sheet taste pass? Derived, never declared twice. */
export function isTasteWritable(key: AxisKey): key is TasteWritableAxis {
  return (TASTE_WRITABLE_AXES as readonly string[]).includes(key);
}

/* ------------------------------------------------------------- the sweep */

export type SweepFinding = {
  axis: AxisKey;
  tier: StylingResolution;
  value: string;
  reason: "persisted-but-never-composed";
};

/**
 * The unowned-axis sweep, as a loop over the registry.
 *
 * **The class this closes, stated once.** An axis nobody owns is not free — it
 * is decided by whichever prior is loudest, identically on every tile. Found
 * five times, every time by the founder's eye: eye colour and four others left
 * unrealized while legacy assigned them; worn state, unowned in one tier and
 * handed to the category prior in the other; texture at bias tier, resolved and
 * persisted and never rendered, so the editorial prior answered it.
 *
 * The founder named the mechanizable tell: **a resolved value that is persisted
 * but never composed into the prompt in the tier it was resolved in.** That is
 * what this asserts, for every axis, in every tier — a loop rather than five
 * hand-written checks, because hand-written checks are what kept missing it.
 *
 * The contract, in full:
 *
 *   - a null value composes nothing, and that is correct — deference NULLS
 *     rather than merely silencing, so a suppressed axis has no value to lie
 *     about;
 *   - a value in the axis's enumerated `silent` set composes nothing, and the
 *     set is pinned so adding to it is a visible diff;
 *   - an active suppressor excuses silence, and the suppressor list is closed,
 *     named and shared, so it cannot be bent to excuse one axis;
 *   - a tier the axis does not claim excuses it;
 *   - **otherwise the value must leave a footprint, or it is a finding.**
 */
export function sweepComposedPrompt(prompt: string, ctx: AxisContext): SweepFinding[] {
  const findings: SweepFinding[] = [];

  for (const key of AXIS_KEYS) {
    const decl = AXIS_REGISTRY[key] as AxisDecl<AxisKey>;
    if (decl.kind === "selector") continue;
    if (!decl.tiers.includes(ctx.tier)) continue;
    if (decl.suppressors.some((suppressor) => ctx.suppressed.has(suppressor))) continue;

    const value = decl.read(ctx);
    if (value == null) continue;
    if (typeof value === "string" && decl.silent.includes(value)) continue;

    if (!decl.footprint(value as never, prompt, ctx)) {
      findings.push({
        axis: key,
        tier: ctx.tier,
        value: typeof value === "string" ? value : JSON.stringify(value),
        reason: "persisted-but-never-composed",
      });
    }
  }

  return findings;
}

/*
  Referenced so the compile-time bindings above are not stripped as unused.
  They exist for their TYPES; this is what keeps a linter from deleting the
  guarantee along with the variable.
*/
export const AXIS_REGISTRY_BINDINGS = {
  locksAreRegistered: _locksAreRegistered,
  realizedAreRegistered: _realizedAreRegistered,
  realizedFieldsEnumerated: _realizedFieldsEnumerated,
  onlyRealizedIsTasteWritable: _onlyRealizedIsTasteWritable,
} as const;

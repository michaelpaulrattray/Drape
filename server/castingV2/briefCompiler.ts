/**
 * The brief seam (plan §E "Brief compiler").
 *
 * A sentence in, eight prompts out. Three stages, and the boundaries between
 * them are where the design lives:
 *
 *   1. **Interpret** — `interpreter.ts` reads the brief into a `CastingIntent`
 *      of closed vocabularies and two capped free-text fields. It runs before
 *      the claim, so a refusal or an outage costs nothing.
 *   2. **Resolve** — `cohortPhotorealHuman.ts` fills everything the brief left
 *      open, deterministically and differently for each of the eight, then
 *      composes each prompt with the code-owned cohort constant appended last.
 *   3. **Check** — the resolved identities are validated against the facts the
 *      brief pinned. Under Path A a violation is a bug in our own adapter, so
 *      the check is loud; under Path B it becomes the runtime gate that lets
 *      the treatment stage ship at all.
 *
 * Three contract properties hold for whatever eventually implements stage 1:
 *
 *   - Compilation is **async** and happens **before the claim**, so a refusal
 *     costs nothing and leaves no operation behind.
 *   - Refusal is a typed outcome, never a guess — "the interpreter proposes,
 *     code disposes".
 *   - The result is **opaque to rollService**, which persists it and never
 *     inspects it. Everything the sheet needs arrives as chips and per-
 *     candidate specs; everything else is internal (§J).
 *
 * PATH B IS NOT HERE, and that is a ratified sequencing condition rather than
 * an omission. M3's A/B measured 10.9% treatment-level lock violations — a
 * brief saying "her" came back male in 7 of 8 Kimi treatments — so the plan
 * makes the lock validator the treatment stage's unlock rather than its
 * companion. `validateLocks` now exists and the cyclist brief is its permanent
 * regression fixture, which is what Path B was waiting for; when it lands it
 * validates every treatment, drops violators, and falls back to Path A if
 * fewer than eight survive. Until then `ROLL_TREATMENT_STAGE` has nothing to
 * turn on.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import {
  lockFactsOf,
  validateLocks,
  type AgeBand,
  type AgePhase,
  type ArchetypeKey,
  type Build,
  type CastingIntent,
  type EnergyKey,
  type Heritage,
  type LockFacts,
  type LookKey,
  type ResolvedIdentity,
  type Sex,
} from "./castingIntent";
import {
  composeCandidatePrompt,
  personaLineFor,
  resolveArchetype,
  resolveCandidateIdentity,
  type FollowAnchor,
} from "./cohortPhotorealHuman";
import { scrubBrands } from "./brandScrub";
import { promoteStatedHeritage } from "./heritagePromotion";
import { interpretBrief } from "./interpreter";

const log = createModuleLogger("castingV2/briefCompiler");

/** A removable interpretation chip, the sheet's only view of the brief (§J). */
export type CastingChip = {
  label: string;
  kind: "subject" | "style" | "direction" | "lineage";
  removable: boolean;
  /**
   * Which intent field this chip stands for, when it stands for one. The
   * sheet sends it back as an `unlock` to say "stop pinning this" — which is
   * the only thing chip removal can mean, because rolls are immutable. A
   * removed chip changes the NEXT roll; it cannot edit one already cast.
   */
  field?: UnlockableField;
};

export const UNLOCKABLE_FIELDS = ["sex", "ageBand", "heritage", "build", "energy", "archetype"] as const;
export type UnlockableField = (typeof UNLOCKABLE_FIELDS)[number];

/**
 * Fields the user can SET by hand, as opposed to merely unpin.
 *
 * `agePhase` and `look` join the unlockable list here because setting a value
 * is a different act from clearing one: "make it late 40s" is a sentence a user
 * says, while "stop pinning where in the decade" is not.
 */
export const OVERRIDABLE_FIELDS = [
  "sex",
  "ageBand",
  "agePhase",
  "heritage",
  "build",
  "energy",
  "look",
  "archetype",
] as const;
export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

/**
 * A hand-made adjustment, carried separately from the interpreter's reading.
 *
 * Heritage is a single value rather than a blend: replacing a heritage or
 * letting it vary is the whole v1 affordance, and a two-component percentage
 * composer inside a popover is the heaviest control in the design for no
 * benefit yet.
 */
export type LockOverrides = Partial<{
  sex: Sex;
  ageBand: AgeBand;
  agePhase: AgePhase;
  heritage: Heritage;
  build: Build;
  energy: EnergyKey;
  look: LookKey;
  archetype: ArchetypeKey;
}>;

/** One of the eight. `prompt` is internal and never projected. */
export type CandidateSpec = {
  position: number;
  prompt: string;
  personaLine: string | null;
  /** Structured, so the validator compares values instead of grepping prose. */
  resolvedIdentity: ResolvedIdentity;
};

export type CompiledRollBrief = {
  /** Persisted to `casting_rolls.compiledBrief`. Internal (§G). */
  compiledBrief: Record<string, unknown>;
  /** The facts the brief pinned. Internal; the validator's input. */
  lockContract: Record<string, unknown>;
  cohortKey: string;
  styleKey: string | null;
  styleProfile: Record<string, unknown> | null;
  chips: CastingChip[];
  candidates: CandidateSpec[];
  /** Sheet candidates render at 1K, medium quality (§H.10). */
  size: `${number}x${number}`;
  quality: "low" | "medium" | "high";
};

export type BriefRefusalCode =
  /** The brief carries no subject the compiler can work with. */
  | "uninterpretable"
  /** A cohort exists in the sentence that no adapter is certified for (§I). */
  | "unsupported_cohort";

/**
 * A refusal, raised before anything is claimed or charged.
 *
 * Free by construction: `rollService` compiles first, so there is no operation
 * and no ledger entry to unwind. That ordering is the reason a refusal can be
 * honest instead of apologetic.
 */
export class BriefRefusal extends Error {
  readonly code: BriefRefusalCode;
  constructor(code: BriefRefusalCode, message: string) {
    super(message);
    this.name = "BriefRefusal";
    this.code = code;
  }
}

export type BriefCompilerInput = {
  briefText: string;
  candidateCount: number;
  /**
   * Per-roll entropy. The client request id, which means a replay of the same
   * request recompiles to the identical sheet while a genuine second roll of
   * the same sentence casts eight different people.
   */
  rollSeed: string;
  /** Facts the user unpinned by removing a chip. Applied to the next roll. */
  unlock?: readonly UnlockableField[];
  /**
   * Facts the user set by hand from the brief echo. Applied LAST, after
   * interpretation and after unpins — see `applyOverrides` for why position is
   * the whole guarantee.
   */
  overrides?: LockOverrides;
  /** Set on a follow roll; the sheet narrows around this candidate. */
  followPersonaLine?: string | null;
  followIdentity?: ResolvedIdentity | null;
  /**
   * Test seam. Supplying an engine is how a test drives the interpreter's
   * exact output — including output built to misbehave, which is the only way
   * to prove the precedence fix rather than assert it. Production never sets
   * this, and unit tests must always set it: without one the compiler reaches
   * for a real transport, and a suite that quietly calls a paid API is a suite
   * nobody can trust to run offline.
   */
  engine?: TextEngine;
};

export type BriefCompiler = (input: BriefCompilerInput) => Promise<CompiledRollBrief>;

function normalizeBrief(briefText: string): string {
  return briefText.replace(/\s+/g, " ").trim();
}

/**
 * The intent used when the interpreter could not be reached.
 *
 * The user's sentence becomes the role and nothing is pinned, so the adapter
 * varies every axis. A sheet cast this way is less precisely targeted than an
 * interpreted one, and it is still eight distinct people photographed
 * identically — which is the promise. An interpreter outage must never cost
 * someone their roll (catalog H30's fail-open policy for checkers).
 */
function fallbackIntent(briefText: string): CastingIntent {
  return {
    cohort: "photoreal_human",
    role: briefText.slice(0, 80),
    characterNotes: null,
    sex: null,
    ageBand: null,
    agePhase: null,
    heritage: [],
    build: null,
    energy: null,
    archetype: null,
    variationAxis: null,
    look: null,
    reads: [],
  };
}

/**
 * Follow: eight cousins of one candidate, not eight copies and not strangers.
 *
 * The founder's report — followed a blonde woman, next roll held four men —
 * had two causes stacked. The reader discarded the parent identity over a
 * legitimately-null `build` (fixed in `rollService`), and this function was the
 * wrong shape even when it did receive one: it copied the parent's heritage
 * into the *intent*, which makes it a LOCK. Eight candidates with identical
 * heritage is the opposite failure — clones rather than relatives.
 *
 * So inheritance no longer touches the intent at all, except for sex. A
 * non-null intent field means "the brief said it", and that convention feeds
 * `lockFactsOf`, `validateLocks` and the brief echo's sentence — an anchored
 * trait in there would be a lock the user never wrote and a fact the echo would
 * claim they had pinned. Everything else travels as a `FollowAnchor` into the
 * resolver, where it biases the neighborhood instead of fixing it.
 *
 * Sex is the exception because the ruling makes it absolute. The brief still
 * outranks it, which is the same precedence chain that governs everything else
 * here, and unlocking still beats both because it runs after.
 */
function anchorFrom(parent: ResolvedIdentity | null): FollowAnchor | null {
  if (!parent) return null;
  return {
    sex: parent.sex,
    heritage: parent.heritage,
    ageBand: parent.ageBand,
    hair: parent.hair ?? null,
    look: parent.look ?? null,
  };
}

function applyUnlocks(intent: CastingIntent, unlock: readonly UnlockableField[]): CastingIntent {
  if (unlock.length === 0) return intent;
  const next = { ...intent };
  for (const field of unlock) {
    if (field === "heritage") next.heritage = [];
    else next[field] = null;
  }
  return next;
}

/**
 * A hand-made adjustment beats everything, and it runs LAST to say so.
 *
 * Founder ruling, 2026-08-01, ratified as law: *"a hand-made adjustment
 * outranks the interpreter's re-reading on every subsequent roll — this is the
 * legacy parser's override mechanism (catalog H8, 'the core innovation')
 * reborn."*
 *
 * The failure it prevents is specific and quiet. A roll re-reads the brief
 * every time, so a user who adjusts age to 40s and rolls again would have the
 * interpreter derive "early 20s" from the unchanged brief text and hand it
 * straight back. Their adjustment would not be refused — it would simply
 * evaporate, which is worse, because nothing tells them it happened.
 *
 * H8's spirit is that the user's own statement is carried in its own channel
 * rather than being reconciled into the enum and lost. Same here: the override
 * never passes through interpretation, so nothing can re-derive it away.
 *
 * Position is the whole guarantee. This runs after `followFrom` (lineage) and
 * after `applyUnlocks`, so:
 *   interpreter → lineage → unpins → hand adjustments
 * and each stage beats the one before it. Setting a field the user also
 * unpinned in the same roll resolves to the set value, which is the right
 * reading of "vary this" followed by "no, make it 40s".
 */
function applyOverrides(intent: CastingIntent, overrides: LockOverrides | undefined): CastingIntent {
  if (!overrides) return intent;
  const entries = Object.entries(overrides).filter(([, value]) => value != null);
  if (entries.length === 0) return intent;

  const next = { ...intent };
  for (const [field, value] of entries) {
    if (field === "heritage") {
      // Single-value replace: the popover offers one heritage or none, so an
      // override always resolves the blend to one component rather than
      // editing percentages.
      next.heritage = [{ heritage: value as Heritage, pct: 100 }];
      continue;
    }
    (next as Record<string, unknown>)[field] = value;
  }
  return next;
}

function buildChips(intent: CastingIntent, followPersonaLine: string | null): CastingChip[] {
  const chips: CastingChip[] = [];

  if (intent.role) {
    // The user's own words. Not removable, because removing the brief is not
    // a thing a chip can do — clearing the field is.
    chips.push({ label: intent.role, kind: "subject", removable: false });
  }

  const derived: Array<[UnlockableField, string | null]> = [
    ["sex", intent.sex],
    ["ageBand", intent.ageBand],
    ["build", intent.build],
    ["energy", intent.energy],
    ["archetype", intent.archetype],
  ];
  for (const [field, value] of derived) {
    if (!value) continue;
    chips.push({ label: value, kind: field === "archetype" ? "direction" : "subject", removable: true, field });
  }
  if (intent.heritage.length > 0) {
    chips.push({
      label: intent.heritage.map((component) => component.heritage).join(" · "),
      kind: "subject",
      removable: true,
      field: "heritage",
    });
  }
  if (followPersonaLine) {
    chips.push({ label: `Following ${followPersonaLine}`, kind: "lineage", removable: true });
  }

  return chips.slice(0, 12);
}

/**
 * Compile one brief into eight prompts.
 *
 * The `engine` seam exists so tests can drive the interpreter's exact output —
 * including output designed to misbehave, which is the only way to prove the
 * precedence fix holds rather than asserting that it does.
 */
export const castingBriefCompiler: BriefCompiler = async (input) => {
  const briefText = normalizeBrief(input.briefText);
  if (briefText.length < 3) {
    throw new BriefRefusal(
      "uninterpretable",
      "That brief is too short to cast from. Describe the person in a sentence.",
    );
  }

  const outcome = await interpretBrief({ briefText, engine: input.engine });

  /*
    DEFENCE IN DEPTH: an interpreter outage must never become a photoreal
    charge for a brief that asked for something else.

    Falling back to a photoreal compile is right for an ordinary brief — an
    outage should not cost someone their roll (catalog H30). It is wrong the
    moment the sentence names a visual style we cannot cast, because then the
    fallback silently produces, and bills for, output that ignores a stated
    fact. That is exactly what happened: a reply correctly identifying an
    uncertified cohort was lost to a schema technicality, and the fallback
    charged 160 credits for eight photoreal humans.

    So the fallback screens for style words itself. A keyword list is a blunt
    instrument and would be the wrong tool for a creative decision — but this
    is not a creative decision, it is a refusal-to-spend, and the failure modes
    are asymmetric: refusing a photoreal brief that happens to say "cartoonish"
    costs the user nothing and is one edit away from working, while casting an
    anime brief as photoreal costs them money for something they did not ask
    for. It only ever runs when the interpreter could not answer.
  */
  /*
    Token membership rather than a regex. The first version of this line was
    written with word-boundary escapes that a shell heredoc silently turned
    into literal backspace characters, so the pattern matched nothing and the
    guard was dead while looking correct in review. Plain string comparison
    cannot be mangled that way.
  */
  const STYLE_WORDS = new Set([
    "anime", "manga", "cartoon", "cartoonish", "cel", "celshaded",
    "illustrated", "illustration", "painterly", "comic", "chibi", "waifu",
    "cgi", "pixar", "disney", "render", "rendered", "3d", "toon",
  ]);
  const styledBrief = briefText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((token) => STYLE_WORDS.has(token));
  if (!outcome.ok && outcome.reason === "unavailable" && styledBrief) {
    log.warn(
      { briefText: briefText.slice(0, 80) },
      "[briefCompiler] interpreter unavailable on a styled brief — refusing rather than casting photoreal",
    );
    throw new BriefRefusal(
      "unsupported_cohort",
      "Casting makes photographic people, and only ones who are nobody in particular — not a named person, not a character from a game or film, and not anime or illustration yet. Describe the kind of face you want and we'll cast that. You have not been charged.",
    );
  }

  if (!outcome.ok && outcome.reason === "unsupported_cohort") {
    throw new BriefRefusal(
      "unsupported_cohort",
      "Casting makes photographic people, and only ones who are nobody in particular — not a named person, not a character from a game or film, and not anime or illustration yet. Describe the kind of face you want and we'll cast that. You have not been charged.",
    );
  }

  const interpreted = outcome.ok ? outcome.intent : fallbackIntent(briefText);
  /*
    Repair a heritage the interpreter stated in prose but left out of the lock.
    Runs before everything else so unlocks and overrides still outrank it.
  */
  const recovered = promoteStatedHeritage(interpreted, briefText);

  const anchor = anchorFrom(input.followIdentity ?? null);
  /*
    Sex is the only inherited fact that becomes a lock, because it is the only
    one the ruling makes absolute. It rides the intent so the validator checks
    it and the echo can say it; every other inherited trait rides the anchor.
  */
  const inherited: CastingIntent =
    anchor && !recovered.sex ? { ...recovered, sex: anchor.sex } : recovered;
  const adjusted = applyOverrides(applyUnlocks(inherited, input.unlock ?? []), input.overrides);
  /*
    Brand names never reach the image engine (founder gate 21). The two
    free-text fields are the only things here that travel to the provider as
    the user's own words, so they are scrubbed last, after every other
    transform has finished writing to them.
  */
  const intent: CastingIntent = {
    ...adjusted,
    role: scrubBrands(adjusted.role),
    characterNotes: scrubBrands(adjusted.characterNotes),
  };
  const locks: LockFacts = lockFactsOf(intent);
  const archetype = resolveArchetype(intent, input.rollSeed);

  const candidates: CandidateSpec[] = [];
  const violations: string[] = [];

  for (let position = 0; position < input.candidateCount; position += 1) {
    const resolved = resolveCandidateIdentity(intent, position, input.rollSeed, anchor);
    const broken = validateLocks(locks, resolved);
    if (broken.length > 0) {
      /*
        Under Path A this cannot happen unless the adapter is broken: it
        composes *from* the locks, so a violation means resolution stopped
        honouring them. Logged loudly rather than thrown — a compiler bug must
        not become a user-facing refusal on the eve of a paid roll — and the
        contract test is what makes sure it never ships.
      */
      violations.push(`${position}:${broken.map((violation) => violation.field).join(",")}`);
    }
    candidates.push({
      position,
      prompt: composeCandidatePrompt({ briefText, intent, resolved, archetype, seed: position }),
      personaLine: personaLineFor(resolved, intent.reads[position] ?? null),
      resolvedIdentity: resolved,
    });
  }

  if (violations.length > 0) {
    log.error({ violations }, "[briefCompiler] resolved identities broke the brief's locks");
  }

  return {
    compiledBrief: {
      // How this roll was compiled, recorded so it can always say. When the
      // treatment stage lands, its pinned model id joins these fields.
      compiler: "pathA-v1",
      interpreted: outcome.ok,
      ...(outcome.ok ? { interpreterModel: outcome.model, interpreterLatencyMs: outcome.latencyMs } : {}),
      briefText,
      intent,
      archetype,
      chips: buildChips(intent, input.followPersonaLine ?? null),
    },
    lockContract: locks as Record<string, unknown>,
    cohortKey: intent.cohort,
    styleKey: null,
    styleProfile: null,
    chips: buildChips(intent, input.followPersonaLine ?? null),
    candidates,
    size: "1024x1536",
    quality: "medium",
  };
};

/**
 * Kept as an explicit seam for tests and for any caller that must compile
 * without a network round trip. Same shape, no interpreter.
 */
export const deterministicBriefCompiler: BriefCompiler = async (input) => {
  const briefText = normalizeBrief(input.briefText);
  if (briefText.length < 3) {
    throw new BriefRefusal(
      "uninterpretable",
      "That brief is too short to cast from. Describe the person in a sentence.",
    );
  }
  const intent = applyUnlocks(fallbackIntent(briefText), input.unlock ?? []);
  const archetype = resolveArchetype(intent, input.rollSeed);
  const candidates: CandidateSpec[] = Array.from({ length: input.candidateCount }, (_, position) => {
    const resolved = resolveCandidateIdentity(intent, position, input.rollSeed);
    return {
      position,
      prompt: composeCandidatePrompt({ briefText, intent, resolved, archetype, seed: position }),
      personaLine: personaLineFor(resolved, intent.reads[position] ?? null),
      resolvedIdentity: resolved,
    };
  });

  return {
    compiledBrief: { compiler: "deterministic-v1", briefText, intent, archetype },
    lockContract: {},
    cohortKey: "photoreal_human",
    styleKey: null,
    styleProfile: null,
    chips: buildChips(intent, input.followPersonaLine ?? null),
    candidates,
    size: "1024x1536",
    quality: "medium",
  };
};

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
  EMPTY_STATED_HAIR,
  NO_TENDENCIES,
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
  briefStatesHair,
  hairDeferenceFor,
  statedAxis,
  type FollowAnchor,
} from "./cohortPhotorealHuman";
import { scrubBrands } from "./brandScrub";
import { namesUnknownProperNoun } from "./properNouns";
import { promoteStatedHeritage, promoteStatedRole } from "./heritagePromotion";
import { interpretBrief } from "./interpreter";
import { bornWardrobeLine, sheetBasicsSex } from "./wardrobeLine";
import type { CastingPath } from "../../shared/castingPaths";
import { breakSignatureClusters, type VarianceReport } from "./varianceBudget";
import { HAIR_PARTS, type HairPart } from "../../shared/castingRealization";

/**
 * A name never becomes a casting category. The second half of gate 21.
 *
 * `scrubBrands` is a list of fashion houses, and a list can only ever catch
 * what is on it. Live measurement on "a Wes Anderson casting, mid 30s": the
 * interpreter returned `role: null` on six of six — it never wrote the name —
 * and then OUR OWN `promoteStatedRole` repair promoted the whole brief,
 * putting a director into `CASTING CATEGORY (ABSOLUTE): This person is cast as
 * — a Wes Anderson casting, mid 30s` on every candidate. Same shape as the
 * Versace roll that lost five of eight to provider refusal, authored this time
 * by the repair built to prevent a different bug.
 *
 * So the check is LISTLESS and it sits here, at intent finalization, rather
 * than at prompt assembly. `role` is read by gate B5's category-owns-physique
 * rule and by the echo; guarding only the prompt would leave B5 clamping
 * variation and the echo claiming a category the prompt does not carry — three
 * readers disagreeing about the same field. Null it once and they all agree.
 *
 * It FAILS CLOSED to null and never edits the span, which is the ratified
 * garment-guard shape: reject, fall back to shelf behaviour, never fail a roll.
 * A brief whose only "category" was a person's name has no category, and the
 * aesthetic still lands through the direction, look and archetype channels.
 */
function guardRole(role: string | null): string | null {
  if (!role) return role;
  // Every token counts: a role is not a sentence, and "Zendaya lookalike"
  // leads with the name.
  if (!namesUnknownProperNoun(role, { mode: "phrase" })) return role;
  log.warn({ stage: "guardRole" }, "[compiler] role named someone we cannot vouch for — dropping it to null");
  return null;
}
import { applySheetTaste } from "./realizedAxes";
import { stylingResolutionFor, type StylingResolution } from "./stylingResolution";

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
  /**
   * How varied this sheet actually is, and what was done about it.
   *
   * Persisted with the compiled brief because it is the evidence for a taste
   * decision the user is paying for: when the echo confesses that the eight
   * will differ mainly in expression, this is the count that said so.
   */
  variance: VarianceReport;
  /** Sheet candidates render at 1K, medium quality (§H.10). */
  size: `${number}x${number}`;
  quality: "low" | "medium" | "high";
  /**
   * THE OUTFIT THIS SHEET WEARS — resolved, complete, and the SAME STRING the
   * eight prompts were composed from.
   *
   * ⚠ **Resolved HERE rather than by the caller, and that is the whole point.**
   * Item 4 returned the raw pick and let `rollService` call `bornWardrobeLine`
   * on it, which was correct while the line only had to reach a column. The
   * moment it also reaches the eight PROMPTS, two callers resolving the same
   * sentence is the parallel-copy shape (working law 4) with a picture on one
   * side and a database row on the other — a sheet painted in one outfit and
   * recorded in another, which Sign then judges against the record.
   *
   * So `bornWardrobeLine` is called exactly once, in `resolveSheet`, before
   * composition; this field is that call's answer; and the caller WRITES it
   * rather than re-deriving it.
   *
   * An explicit field rather than something lifted out of `compiledBrief`:
   * that column's docblock says INTERNAL and never projected, and a durable
   * fact read out of an internal blob is the shape §3.2 refuses by name.
   *
   * `null` whenever `path` was null — the unpathed roll, which is every roll
   * outside the flag.
   */
  wardrobeLine: string | null;
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
  /**
   * WHICH PATH this sheet is cast on, resolved by the caller before the
   * compile because the born line reaches the eight PROMPTS (§3.3).
   *
   * `null` — absent, outside the flag, or a roll cast before the paths existed
   * — composes the constant exactly as it always has, character for character.
   */
  path?: CastingPath | null;
  /**
   * On a FOLLOW: the parent sheet's pair, read owner-scoped before the compile
   * and used VERBATIM — including its nulls.
   *
   * A follow inherits both columns (§3.1) and the db layer performs that
   * inheritance in the statement that writes the row. It cannot help the
   * PROMPT, which is composed first — so without this the eight would be
   * PAINTED in a freshly resolved outfit and RECORDED in the parent's, and
   * then six signed views judged against a line they were never painted in.
   *
   * ⚠ **Verbatim means the NULLS too.** Following a candidate from a sheet cast
   * before the paths existed must produce an unpathed prompt, because the db is
   * about to write that parent's NULL pair — resolving a line here "because the
   * account is inside the flag" is the same divergence with its sign flipped.
   */
  inheritedWardrobe?: { path: CastingPath | null; line: string | null };
  /**
   * Ask the interpreter for a WARDROBE PICK as well — cases (a) and (b) of the
   * Wardrobe path (design §4).
   *
   * Absent means no, which is every caller outside `CASTING_TWO_PATHS_SCOPE`
   * and every Basics roll and every Follow. It is a question about the PROMPT,
   * not about the sheet: see `WARDROBE_BLOCK` in `interpreter.ts` for why a
   * field nobody will read is not free to ask for.
   */
  pickWardrobe?: boolean;
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
    composedDirection: null,
    /*
      The fallback states nothing about hair, which is the honest reading: the
      interpreter never ran, so nothing was extracted. The code-owned gate still
      reads the user's raw sentence, so a "shaved head" brief is still deferred
      to — the gate is the authority on WHETHER, and it does not need the
      interpreter to have worked (D-89).
    */
    statedHair: EMPTY_STATED_HAIR,
    // The fallback compiles from the raw sentence, so nothing was interpreted
    // and there is nothing to say back.
    statedAccessories: [],
    /*
      No ink read, and `null` is the honest answer rather than a silent
      fallback: the interpreter never ran, so nothing about this brief was read
      at all. That is a different fact from *she named ink and no region
      survived*, which is `readFailed` on a real reading — and the difference
      matters, because an outage is already loud (the parse-failure alarm) while
      a bad reader is not.

      The cost is stated rather than hidden: a brief naming ink that arrives
      here is born WITHOUT its row, and the raw sentence still reaches the image
      model, so the picture is unaffected — only the record is.
    */
    statedInk: null,
    // No interpreter ran, so no category was read and nothing is implied.
    poolTendencies: NO_TENDENCIES,
    /*
      No pick, and the fallback is exactly where that is safest: `null` resolves
      to §4(c), the house line, which is today's picture. An interpreter outage
      costs a Wardrobe roll its engine-chosen outfit and nothing else.
    */
    wardrobe: null,
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
    realized: parent.realized ?? null,
  };
}

/**
 * Strip the anchor's supply of any axis the user unpinned.
 *
 * Only the three axes a follow actually carries and a chip can remove overlap:
 * sex, age band and heritage. The rest of the anchor — hair, look, the realized
 * axes — has no chip, so nothing can unpin it here.
 */
function withUnlocksApplied(anchor: FollowAnchor, unlock: readonly UnlockableField[]): FollowAnchor {
  if (unlock.length === 0) return anchor;
  return {
    ...anchor,
    sex: unlock.includes("sex") ? null : anchor.sex,
    ageBand: unlock.includes("ageBand") ? null : anchor.ageBand,
    heritage: unlock.includes("heritage") ? [] : anchor.heritage,
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
 * Blank what the prompt never carried, so the persisted identity is honest.
 *
 * **The M7 registry reads the persisted `resolvedIdentity` as sole truth**, so
 * fiction here becomes fiction there. Two kinds were being recorded:
 *
 *   - **Suppressed axes with fabricated values.** A shaved-head brief defers the
 *     whole hair axis, and the record still carried `hair: long, brown` — a cut
 *     and a colour no prompt asked for and no image ever wore. That is the
 *     record-that-lies failure this file's own comments keep warning about, and
 *     it is how the founder's sameness report was first misdiagnosed.
 *   - **Over-claimed resolution.** Under bias mode the prompt carries a
 *     silhouette and a beard bucket; the record carried a named cut and a
 *     six-value facial-hair enum. A follow of that candidate would inherit
 *     specificity the lineage never had.
 *
 * The resolution tier is recorded beside the identity rather than degrading the
 * values, because the family and the bucket are both derivable from what is
 * there — but a reader has to be told which resolution actually reached the
 * image, and now it is written down.
 */
function withHonestRecord(
  identity: ResolvedIdentity,
  resolution: StylingResolution,
  statedFacialHair: boolean,
  /*
    Which parts of hair actually reached the prompt — D-79's per-part mask.

    Blanking used to be all-or-nothing with the resolution, which under partial
    deference would null a colour the prompt HAD authored: the record would say
    the candidate has no hair while the picture shows the colour we asked for.
    That is the record-that-lies class, and it would have been minted by the fix
    for it. The record blanks exactly what was suppressed and nothing else.
  */
  authoredParts: ReadonlySet<HairPart>,
  /*
    D-88: the biology tier nulls what deference silenced, exactly as hair does.
    A "green eyes" brief emits no eye line, so persisting a fabricated colour
    was a record that lied — and a follow inherits biology whole, so the
    fabrication travelled and could COMPOSE on the next sheet.
  */
  statedBiology: { eyes: boolean; brows: boolean; skin: boolean },
): ResolvedIdentity {
  /*
    BIAS TIER RECORDS NO COMPONENTS.

    The prompt in bias mode carries a silhouette rather than a named cut, so the
    authored components BELOW the cut — the fringe, the parting — were never
    asked for. Recording a curtain fringe the prompt never mentioned is the same
    defect as recording a named cut it never carried. The registry reads this
    record as sole truth and can never re-derive it.

    The heading used to say "NO CUT AND NO COMPONENTS", which the code below has
    never done: the cut is KEPT at bias tier, because the sheet-taste rules and
    the follow anchor both need to know which silhouette this candidate ended up
    with, and the registry's sweep asserts the family's bias prose rather than
    the name. Only the components are nulled.
  */
  const biasNulls = resolution === "bias" ? { hairModifiers: null } : {};

  const biologyNulls = {
    ...(statedBiology.eyes ? { eyeColour: null } : {}),
    ...(statedBiology.brows ? { browStyle: null } : {}),
    ...(statedBiology.skin ? { skinCharacter: null } : {}),
  };
  const authorsColour = authoredParts.has("colour");
  const authorsCut = authoredParts.has("cutLength");
  const authorsTexture = authoredParts.has("texture");

  if (resolution !== "stated" && !statedFacialHair) {
    return {
      ...identity,
      stylingResolution: resolution,
      realized: { ...identity.realized, ...biasNulls, ...biologyNulls },
    } as ResolvedIdentity;
  }
  return {
    ...identity,
    stylingResolution: resolution,
    ...(resolution === "stated" && !authorsColour ? { hair: null } : {}),
    realized: {
      ...identity.realized,
      ...biasNulls,
      /*
        Deference: the brief owns the parts it spoke to, so nothing authored
        survives for those — the cut, its texture, and the components that
        belong to the cut go together. A part the brief left open keeps its
        authored value, because the prompt carried it.
      */
      ...(resolution === "stated" && !authorsCut
        ? { hairStyle: null, hairModifiers: null, wornState: null }
        : {}),
      ...(resolution === "stated" && !authorsTexture ? { hairTexture: null } : {}),
      ...(statedFacialHair ? { facialHair: null } : {}),
      ...biologyNulls,
    },
  } as ResolvedIdentity;
}

/**
 * Resolve the whole sheet, apply the sheet-level taste rules, then compose.
 *
 * That order is the point, and it is why this is a function rather than two
 * loops. The founder's hairstyle rules — at most one statement cut, at least
 * five distinct cuts — are properties of a SET of eight, and the first
 * implementation tried to enforce them inside the per-candidate realizer by
 * guessing what the other positions had drawn. It guessed from the wrong
 * weighted list whenever heritage varied, which is every open brief.
 *
 * Composition happens AFTER the pass, so the persisted `resolvedIdentity` is
 * the same person the prompt describes. Adjusting a record after composing its
 * prompt would leave a stored identity that quietly contradicts the image the
 * customer was actually sent.
 *
 * Two cases skip the pass entirely:
 *
 *   - **A follow.** Every candidate copies the anchor's realized axes on
 *     purpose; eight inherited pixies is the follow working, not a sheet
 *     failing. Neither bar applies there.
 *   - **A brief that states hair.** Then no candidate emits a hair line at all
 *     (deference), so there is nothing on the sheet for the rules to govern.
 */
function resolveSheet(input: {
  intent: CastingIntent;
  briefText: string;
  archetype: ArchetypeKey;
  candidateCount: number;
  rollSeed: string;
  anchor?: FollowAnchor;
  /** Whether the interpreter was asked for a pick — see the gate below. */
  pickWardrobe?: boolean;
  /** The two paths (§3.1). `null` composes exactly today's constant. */
  path?: CastingPath | null;
  /** A follow's inherited pair, used verbatim when present — nulls too (§3.1). */
  inheritedWardrobe?: { path: CastingPath | null; line: string | null };
}): { candidates: CandidateSpec[]; variance: VarianceReport; wardrobeLine: string | null } {
  const { intent, briefText, archetype, rollSeed, anchor } = input;
  /*
    Derived ONCE, before anything resolves, and handed to every reader — the
    resolver, the taste pass and the composer. Three readers deriving their own
    answer to "what did the brief settle" is the shape that produced gate 21.
  */
  const deference = hairDeferenceFor({ briefText, intent });
  const resolved = Array.from({ length: input.candidateCount }, (_, position) =>
    resolveCandidateIdentity(intent, position, rollSeed, anchor, 0, deference),
  );

  const stated = [briefText, intent.role ?? "", intent.characterNotes ?? ""].join(" ");
  /*
    Keyed on the FOLLOW, not on the anchor's contents.

    It used to read `anchor?.realized != null`, which asks whether the parent
    happened to carry realized axes — and a parent cast before those axes
    existed carries none. On that lineage the pass believed it was not looking
    at a follow at all and rewrote the anchored hair, which is the one thing a
    follow exists to preserve. Whether this is a follow is a fact about the
    request; the anchor's vintage is not part of it.
  */
  const inherited = anchor != null;
  /*
    A follow is the one full skip: every candidate copies the anchor's realized
    axes on purpose, so eight inherited pixies is the follow working.

    Stated hair is NOT a full skip, and treating it as one was a real gap. The
    founder's own brief — "a skincare founder in his 40s, silver at the
    temples" — mentions hair, which suppressed every authored hair line AND, in
    the first version of this, the whole taste pass with it. The twin rule's
    second axis is facial hair, which deference over HAIR has nothing to say
    about, so the sheet that prompted the twin-breaker was the one sheet it
    would never have run on.
  */
  const statedFacialHairHere = statedAxis("facialHair", stated);
  const sheetResolution = stylingResolutionFor({
    intent,
    briefStatesHair: briefStatesHair(stated),
    anchored: anchor != null,
  });
  /*
    THE PER-PART MASK, derived ONCE — D-79's re-ship (D-89).

    The taste pass, the signature cap and the composer all need to know which
    parts of hair the brief settled. Deriving it here and passing it down is what
    stops three readers disagreeing about the same field, which is the shape that
    produced gate 21 and the role-guard rework.

    With the flag off this collapses to today's answer: any hair word masks every
    part, so nothing authored survives.
  */
  const authoredParts = new Set<HairPart>(
    HAIR_PARTS.filter((part) => !deference.coverage && !deference.spoken.has(part)),
  );

  const tasted = inherited
    ? resolved
    : applySheetTaste(resolved, rollSeed, {
        /*
          Deference reaches the taste pass too. A brief that named facial hair
          suppresses the realized line, so flipping the value would change
          nothing visible while making the stored identity disagree with the
          prompt that was sent.
        */
        statedFacialHair: statedAxis("facialHair", stated),
        /*
          When the brief states hair, none of the authored hair reaches the
          prompt. Mutating it would edit a record the image never saw, so the
          hair rules stand down and the twin rule falls back to separating on
          its second axis alone.
        */
        authoredParts,
        // The pool's absent silhouettes, so a re-pick cannot hand them back.
        avoidFamilies: authoredParts.has("cutLength")
          ? intent.poolTendencies?.avoidFamilies ?? []
          : [],
        biasResolution:
          stylingResolutionFor({ intent, briefStatesHair: briefStatesHair(stated) }) === "bias",
      });

  /*
    THE VARIANCE BUDGET (founder ruling, 2026-08-01).

    Counted after resolution and before composition, which is the only window
    where the sheet exists as a whole and nothing has been written to a prompt
    yet.

    The release is deliberately NOT applied by mutating identities here. Every
    lever the ladder names — more drift tiles, texture and worn state moving
    where the cut holds, a wider secondary heritage — belongs to the resolver
    that owns that axis, and reaching in from outside is how a record starts
    disagreeing with its own prompt. So this stage measures, records the plan,
    and re-resolves through the owning path with the plan in hand.

    What it will never do is touch a stated lock. A sheet that quietly varies a
    fact the user pinned is a worse failure than a boring sheet: the boring one
    is at least honest, and the honest answer to "everything is held" is to say
    so before the money moves.
  */
  /*
    THE SIGNATURE CAP (founder ruling, 2026-08-01).

    Applied after the taste pass and before composition — the only window where
    the sheet exists whole and nothing has been written to a prompt yet, so the
    persisted identity stays the person the prompt describes.

    It replaced an axis COUNT, which cleared its own floor on the re-rolled
    Versace sheet while five identical low buns sat in the middle of it. Axes
    were a proxy for what the eye measures and they proxied badly.
  */
  const { sheet: freed, report: variance } = breakSignatureClusters(tasted, {
    rollSeed,
    // Deference outranks everything here: when the brief states its own hair,
    // none of it reaches the prompt, so freeing it would edit a record the
    // image never saw.
    hairStated: briefStatesHair(stated),
    facialHairStated: statedFacialHairHere,
    avoidFamilies: authoredParts.has("cutLength")
      ? intent.poolTendencies?.avoidFamilies ?? []
      : [],
  });
  const sheet = freed;

  /*
    WHAT THIS SHEET IS WEARING — resolved ONCE, here, in the only window where
    the sheet exists whole and nothing has been written to a prompt yet.

    That window is the same one the taste pass and the signature cap use, and
    for the same reason: on the Basics path the outfit's form depends on the
    RESOLVED sexes of the eight (`sheetBasicsSex`), which do not exist until
    resolution has finished — and it must exist before composition, because
    every prompt carries it.

    A FOLLOW takes the parent sheet's born line verbatim. Not out of caution:
    the db layer will inherit that pair anyway when the row is written, so
    re-resolving here would paint eight people in an outfit the row is about to
    contradict.
  */
  const path = input.inheritedWardrobe ? input.inheritedWardrobe.path : input.path ?? null;
  /*
    ⚠ AN UNASKED WARDROBE IS DISCARDED, and it is discarded rather than trusted
    not to arrive.

    A language model may volunteer a field it was never offered — the M3 defect
    this module exists for was exactly that, a plaid shirt and a captioned mug
    nobody asked for, inherited by all eight. The PARSE cannot tell an answer
    from an offer, because it does not know what was asked. This function does,
    so the question and the answer are gated at the same place.
  */
  const pick = input.pickWardrobe === true ? intent.wardrobe : null;
  const wardrobeLine = input.inheritedWardrobe
    ? input.inheritedWardrobe.line
    : path === null
      ? null
      : bornWardrobeLine({
        path,
        sex: sheetBasicsSex(sheet.map((identity) => identity.sex)),
        named: pick,
      });

  return {
    variance,
    wardrobeLine,
    candidates: sheet.map((identity, position) => ({
      position,
      prompt: composeCandidatePrompt({
        briefText,
        intent,
        resolved: identity,
        archetype,
        seed: position,
        wardrobeLine,
        // Anchored styling renders at full fidelity: the user chose that cut.
        anchored: anchor != null,
      }),
      personaLine: personaLineFor(identity, intent.reads[position] ?? null),
      resolvedIdentity: withHonestRecord(identity, sheetResolution, statedFacialHairHere, authoredParts, {
        eyes: statedAxis("eyes", stated),
        brows: statedAxis("brows", stated),
        skin: statedAxis("skin", stated),
      }),
    })),
  };
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

  const outcome = await interpretBrief({
    briefText,
    engine: input.engine,
    wardrobe: input.pickWardrobe === true,
  });

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
  const recovered = promoteStatedRole(promoteStatedHeritage(interpreted, briefText), briefText);

  const anchor = anchorFrom(input.followIdentity ?? null);
  /*
    Sex is the only inherited fact that becomes a lock, because it is the only
    one the ruling makes absolute. It rides the intent so the validator checks
    it and the echo can say it; every other inherited trait rides the anchor.
  */
  const unlock = input.unlock ?? [];
  const inherited: CastingIntent =
    anchor && !recovered.sex && anchor.sex ? { ...recovered, sex: anchor.sex } : recovered;
  const adjusted = applyOverrides(applyUnlocks(inherited, unlock), input.overrides);
  /*
    The unlock has to reach the ANCHOR too, not just the intent.

    Clearing `intent.sex` alone was inert on a follow: the resolver reads
    `intent.sex ?? anchor?.sex`, so the anchor immediately put it back and the
    user watched a chip disappear while the sheet stayed identical. An unpinned
    axis has to lose both of its suppliers.
  */
  const effectiveAnchor = anchor ? withUnlocksApplied(anchor, unlock) : null;
  /*
    Brand names never reach the image engine (founder gate 21). The two
    free-text fields are the only things here that travel to the provider as
    the user's own words, so they are scrubbed last, after every other
    transform has finished writing to them.
  */
  const intent: CastingIntent = {
    ...adjusted,
    role: guardRole(scrubBrands(adjusted.role)),
    characterNotes: scrubBrands(adjusted.characterNotes),
  };
  const locks: LockFacts = lockFactsOf(intent);
  const archetype = resolveArchetype(intent, input.rollSeed);

  const sheet = resolveSheet({
    intent,
    briefText,
    archetype,
    candidateCount: input.candidateCount,
    rollSeed: input.rollSeed,
    anchor: effectiveAnchor ?? undefined,
    path: input.path ?? null,
    inheritedWardrobe: input.inheritedWardrobe,
    pickWardrobe: input.pickWardrobe,
  });
  const candidates = sheet.candidates;

  const violations = candidates
    .map((candidate) => {
      const broken = validateLocks(locks, candidate.resolvedIdentity);
      /*
        Under Path A this cannot happen unless the adapter is broken: it
        composes *from* the locks, so a violation means resolution stopped
        honouring them. Logged loudly rather than thrown — a compiler bug must
        not become a user-facing refusal on the eve of a paid roll — and the
        contract test is what makes sure it never ships.
      */
      return broken.length > 0
        ? `${candidate.position}:${broken.map((violation) => violation.field).join(",")}`
        : null;
    })
    .filter(Boolean);

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
    variance: sheet.variance,
    size: "1024x1536",
    quality: "medium",
    /*
      The line the eight prompts above were composed from, returned so the
      caller writes it rather than resolving it a second time.
    */
    wardrobeLine: sheet.wardrobeLine,
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
  // The same helper the real compiler uses. Two hand-written loops is how the
  // fallback path drifts into producing sheets the main path would not.
  const { candidates, variance, wardrobeLine } = resolveSheet({
    intent,
    briefText,
    archetype,
    candidateCount: input.candidateCount,
    rollSeed: input.rollSeed,
    path: input.path ?? null,
    inheritedWardrobe: input.inheritedWardrobe,
    pickWardrobe: input.pickWardrobe,
  });

  return {
    /*
      `interpreted: false` is literally true here and it matters.

      This compiler never asks the interpreter, so a sheet it produces has lost
      every fact the brief stated — exactly the condition the sheet's highest
      confession describes. It is test-only today, and its own doc invites live
      callers; if one ever arrives, the confession must already be honest rather
      than depend on somebody remembering to add it. Absent would have projected
      as "nothing to confess".
    */
    compiledBrief: { compiler: "deterministic-v1", interpreted: false, briefText, intent, archetype },
    lockContract: {},
    cohortKey: "photoreal_human",
    styleKey: null,
    styleProfile: null,
    chips: buildChips(intent, input.followPersonaLine ?? null),
    candidates,
    variance,
    size: "1024x1536",
    quality: "medium",
    /* No interpreter runs here at all, so there is nothing to pick with; the
       path still resolves, so a Basics roll compiled this way is still dressed
       in basics. §4(c) is the Wardrobe fallback. */
    wardrobeLine,
  };
};

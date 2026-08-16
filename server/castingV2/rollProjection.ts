/**
 * Client projections for the roll domain (plan §J).
 *
 * These are explicit allowlist DTOs. Nothing here spreads a database row, and
 * that is the rule rather than a preference: a spread row is how `passwordHash`
 * once reached `auth.me` and how image URLs reached the moderator surface
 * (access-control invariant 8).
 *
 * What may never appear in anything this module returns:
 * `compiledBrief`, `internalPrompt`, provider names, provider models, provider
 * request ids, storage keys, queue internals, or any row belonging to another
 * user. The types below are constructed field by field so adding one of those
 * is a deliberate edit, not an accident of shape.
 *
 * **Amendment, 2026-08-01 (brief echo).** `lockContract` was on that list and
 * is now partly off it, which is the kind of change that has to be stated
 * rather than made quietly. The *raw column* still never crosses — it is
 * compiler-written JSON, and forwarding it would be the injection path this
 * module exists to close. What crosses is `readBriefFacts`: a validated
 * projection of the pinned facts, every value checked against a closed
 * vocabulary, no free text, no percentages, no prompts.
 *
 * The reason it is safe is not that it is small. It is that these are the
 * user's own stated facts, returned to the user who stated them, on a
 * projection that is already owner-scoped. Nothing here is a recipe: the
 * cast's creative content — the composed prompt, the archetype thesis, the
 * character notes — stays inside `compiledBrief` and stays here.
 */
import type { CastingCandidate, CastingRoll, CastingSession } from "../../drizzle/schema";
import { storagePublicUrl } from "../storage";
import { UNLOCKABLE_FIELDS, type CastingChip, type UnlockableField } from "./briefCompiler";
import { statesWardrobe } from "./statedWardrobe";
import { tokensComeFromBrief } from "./castingIntent";
import {
  AGE_BANDS,
  AGE_PHASES,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "./castingIntent";

/**
 * §J's enum, plus `signed` — a deliberate addition, not a drift.
 *
 * `signed` used to collapse into `ready`, and the consequence was the founder
 * losing a Cast he had just paid 500 credits for: the tile looked exactly like
 * every other candidate, offered to sign her again, and led nowhere. A
 * permanent purchase has to be reachable from the place it was made.
 */
export type CandidateProjectionStatus = "casting" | "ready" | "failed-refunded" | "signed";

export type CandidateProjection = {
  candidateId: string;
  position: number;
  indexLabel: string;
  status: CandidateProjectionStatus;
  imageUrl: string | null;
  thumbUrl: string | null;
  personaLine: string | null;
  kept: boolean;
  /**
   * The Cast this candidate became, when it became one.
   *
   * The public KI id — the only Cast identifier that leaves the server (§J) —
   * so the tile can link to her room rather than merely showing a badge that
   * goes nowhere.
   */
  castId: string | null;
};

export type RollProjection = {
  rollId: string;
  rollIndex: number;
  status: CastingRoll["status"];
  briefText: string;
  chips: CastingChip[];
  /** The brief echo's facts — see `readBriefFacts`. */
  facts: BriefFacts;
  /**
   * Which FACE this roll followed, not merely which roll.
   *
   * `fromRollId` alone made the sheet say "the eight follow roll 01", which is
   * true and useless — a roll has eight faces and the user pointed at one.
   */
  lineage: { fromCandidateId?: string; fromCandidateLabel?: string; fromRollId?: string };
  /**
   * The sheet could not be varied, and the user is entitled to know.
   *
   * A boolean, not the count: the count is a taste instrument and belongs
   * inside `compiledBrief` with the rest of the internals. What crosses the
   * boundary is the one thing the user can act on.
   */
  varianceHeld: boolean;
  /**
   * The interpreter could not be read and this roll was compiled from the raw
   * sentence — so nothing the brief stated was pinned. See `readFellBack`.
   */
  fellBack: boolean;
  /**
   * The brief said what they were wearing, and the sheet kept the studio tee.
   *
   * The override is law; the silence about it was not. See `statedWardrobe.ts`
   * for why this is a narrower question than the composed-direction guard asks.
   */
  statedWardrobe: boolean;
  priceCredits: number;
  counts: { total: number; ready: number; casting: number; failed: number };
  createdAt: string;
  /**
   * HOW LONG THIS ROLL HAS BEEN WAITING, subtracted here rather than there
   * (entry 13 of the instrument doctrine; fable-670).
   *
   * The sheet says so past about two minutes — the supervised-wait promise —
   * and it used to decide that from `createdAt` minus the BROWSER's clock. Two
   * moments off two clocks: a laptop two minutes fast confessed an unusual wait
   * on every roll one second in, and a laptop two minutes slow never confessed
   * one at all, which is the same silence as the promise not existing. The
   * server holds both terms, so it does the subtraction and ships the answer.
   *
   * The same reasoning `variants.pending[].stage` already gives for keeping the
   * lease decision here (`routes/castingV2.ts`): a clock question belongs to
   * the side that owns the clock.
   */
  ageMs: number;
  candidates: CandidateProjection[];
};

export type SessionProjection = {
  sessionId: string;
  status: CastingSession["status"];
  originType: CastingSession["originType"];
  activeRollId: string | null;
  signedCastCount: number;
  createdAt: string;
  expiresAt: string | null;
};

/**
 * The facts behind the brief echo.
 *
 * Founder condition, 2026-08-01: *"the sentence generates from the same
 * validated lock contract the compiler enforces (one source of truth)."* So
 * this reads `roll.lockContract` — the column `validateLocks` checks every
 * candidate against — rather than re-deriving anything from the compiled brief.
 * If the sentence and the sheet ever disagree, it is because the validator
 * would also have disagreed, which is the only honest failure mode available.
 *
 * `open` is the other half of the law and the half the pill row could not show:
 * a field that is null is not unknown, it is deliberately varying, and the user
 * could not see that or pin it.
 *
 * Invariant 8: an explicit projection of named fields. The compiled brief is
 * written by a compiler that is an LLM behind a seam, so nothing crosses this
 * boundary without being checked against a closed list first.
 */
export type BriefFacts = {
  /**
   * The casting category, in the user's own words.
   *
   * Not in `lockContract`, because `LockFacts` is the validator's input and
   * has no role field — but it IS a lock, and the loudest one: the prompt
   * carries it as "CASTING CATEGORY (ABSOLUTE)" and a candidate who would not
   * be credible in it is a failed candidate (gate B5). An echo that omitted it
   * was omitting the single strongest constraint on the sheet.
   */
  role: string | null;
  locks: {
    sex?: string;
    ageBand?: string;
    agePhase?: string;
    heritage?: string[];
    build?: string;
    energy?: string;
    look?: string;
  };
  /** Fields the roll deliberately varied. Named, up to three; else collapsed. */
  open: string[];
  /** Which axis the eight differ along, when the compiler recorded one. */
  variationAxis: "look" | "disposition" | null;
  /**
   * Worn things the brief named, in the user's own words.
   *
   * NOT a lock — an accessory neither varies across the eight nor pins an
   * identity axis — which is why the echo renders it at full ink with no
   * picker. It is here because the sentence claims to say what the brief said,
   * and staying silent about a stated fact made that claim quietly incomplete.
   */
  statedAccessories: string[];
};

/** Closed lists, so a compiler-side surprise cannot reach the client. */
const FACT_VOCABULARIES: Record<string, readonly string[]> = {
  sex: SEXES,
  ageBand: AGE_BANDS,
  agePhase: AGE_PHASES,
  build: BUILDS,
  energy: ENERGY_KEYS,
  look: LOOK_KEYS,
};

/** Everything the echo can name as varying, in the order it reads best. */
const OPEN_AXES = ["sex", "ageBand", "heritage", "build", "energy", "look"] as const;

export function readBriefFacts(
  lockContract: unknown,
  compiledBrief: unknown,
  briefText = "",
): BriefFacts {
  const raw = (lockContract ?? {}) as Record<string, unknown>;
  const locks: BriefFacts["locks"] = {};

  for (const [field, vocabulary] of Object.entries(FACT_VOCABULARIES)) {
    const value = raw[field];
    if (typeof value === "string" && vocabulary.includes(value)) {
      (locks as Record<string, string>)[field] = value;
    }
  }

  if (Array.isArray(raw.heritage)) {
    const heritages = raw.heritage
      .map((entry) =>
        entry && typeof entry === "object" ? (entry as { heritage?: unknown }).heritage : null,
      )
      .filter((value): value is string => typeof value === "string" && HERITAGES.includes(value as never));
    if (heritages.length > 0) locks.heritage = heritages.slice(0, 2);
  }

  const open = OPEN_AXES.filter((axis) => !(axis in locks));

  const intent = (compiledBrief as { intent?: Record<string, unknown> } | null)?.intent;
  const axis = intent?.variationAxis;
  const variationAxis = axis === "look" || axis === "disposition" ? axis : null;

  /*
    Free text, so it is bounded and stripped rather than enum-checked — the
    only field here that cannot be. The interpreter caps it at 12 words; this
    is the belt to that braces, because the compiled brief is written by a
    model behind a seam.
  */
  const rawRole = intent?.role;
  const role =
    typeof rawRole === "string" && rawRole.trim().length > 0
      ? rawRole.replace(/\s+/g, " ").trim().slice(0, 60)
      : null;

  /*
    CHECKED AGAIN, HERE, against the user's own sentence.

    The interpreter already refuses a phrase carrying a word the brief does not
    contain, and this asks the same question a second time at the boundary the
    text actually crosses — the same reason `readVarianceHeld` re-validates a
    stored JSON column rather than forwarding it. The compiled brief is written
    by a model behind a seam, and a projection that trusted it would be an
    injection path to the client (invariant 8).

    Every word rendered in the echo is therefore provably the user's own.
  */
  const rawAccessories = intent?.statedAccessories;
  const statedAccessories = Array.isArray(rawAccessories)
    ? rawAccessories
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.replace(/\s+/g, " ").trim().slice(0, 40))
        .filter((entry) => tokensComeFromBrief(entry, briefText))
        .slice(0, 3)
    : [];

  return { role, locks, open, variationAxis, statedAccessories };
}

const CHIP_KINDS = new Set<CastingChip["kind"]>(["subject", "style", "direction", "lineage"]);

/**
 * Chips are stored inside the internal compiled brief, so they are read back
 * through a validator rather than trusted. The compiled brief is written by a
 * compiler that will one day be an LLM behind a seam — a projection that
 * forwarded whatever it found there would be an injection path straight to
 * the client.
 */
export function readChips(compiledBrief: unknown): CastingChip[] {
  if (!compiledBrief || typeof compiledBrief !== "object") return [];
  const raw = (compiledBrief as { chips?: unknown }).chips;
  if (!Array.isArray(raw)) return [];
  const chips: CastingChip[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { label, kind, removable, field } = entry as Record<string, unknown>;
    if (typeof label !== "string" || !label) continue;
    if (typeof kind !== "string" || !CHIP_KINDS.has(kind as CastingChip["kind"])) continue;
    chips.push({
      label: label.slice(0, 60),
      kind: kind as CastingChip["kind"],
      removable: removable === true,
      // Checked against the closed list, not forwarded: the sheet sends this
      // back as an `unlock`, so a value invented upstream would be a value the
      // client then posts to a strict enum and gets refused for.
      ...(typeof field === "string" && UNLOCKABLE_FIELDS.includes(field as UnlockableField)
        ? { field: field as UnlockableField }
        : {}),
    });
  }
  return chips.slice(0, 12);
}

/**
 * A candidate's public status.
 *
 * `discarded` returns null — a discarded card is gone from the sheet, and the
 * client's undo affordance holds the id it just discarded rather than reading
 * it back from a projection.
 *
 * `expired` projects as `failed-refunded` WITH ITS IMAGE SUPPRESSED, and the
 * distinction between those two halves is the whole rule.
 *
 * An expired candidate arrived after its roll was cancelled and was refunded
 * under the generosity ruling (2026-07-31), which is only defensible because
 * the user never receives the image. That constraint is about the IMAGE, not
 * about the tile — and the first version enforced it by returning null, which
 * removed the tile as well.
 *
 * The founder found what that costs: cancel a roll whose eight were already
 * dispatched, every candidate lands and expires, and the sheet empties out
 * completely. Not even skeletons — a blank page where eight faces had been,
 * with no account of what happened to them. A sheet that erases itself is a
 * worse answer than one that says "cancelled · refunded" eight times.
 *
 * So the tile stays and the image does not. `imageUrl` and `thumbUrl` are
 * nulled for every refunded candidate below, at the projection rather than in
 * the component, so no future caller can reintroduce the leak by rendering a
 * field it found on the object.
 *
 * `cancelled` — the slices that never ran — projects as `failed-refunded`,
 * and the sheet reads the roll's own `cancelled` status to say so in the
 * user's own terms rather than blaming us for a failure they chose. The §J
 * enum stays as ratified; the copy is derived, not a fourth state.
 */
export function projectCandidateStatus(
  status: CastingCandidate["status"],
): CandidateProjectionStatus | null {
  switch (status) {
    case "queued":
    case "dispatched":
      return "casting";
    case "ready":
      return "ready";
    case "signed":
      return "signed";
    case "failed":
    case "cancelled":
    case "expired":
      return "failed-refunded";
    case "discarded":
      return null;
  }
}

/**
 * What a candidate looks like RIGHT NOW — the row, plus the face it shows.
 *
 * The face fields are REQUIRED, and that is the design rather than pedantry.
 * `CandidateWithFace` extends `CastingCandidate`, so a projection that took a
 * plain candidate would still compile when handed the richer row and would
 * quietly render the ORIGINAL while Sign spent the refinement — a surface
 * lying about what its own button does, with nothing failing to say so.
 * Requiring the fields makes that a compile error at every call site.
 */
export type ProjectableCandidate = CastingCandidate & {
  selectedVariantPublicId: string | null;
  faceImageKey: string | null;
  faceThumbKey: string | null;
};

export function projectCandidate(
  candidate: ProjectableCandidate,
  castPublicId?: string | null,
): CandidateProjection | null {
  const status = projectCandidateStatus(candidate.status);
  if (!status) return null;
  return {
    candidateId: candidate.publicId,
    position: candidate.position,
    // "01" through "08" — display metadata only. Nothing is ever keyed by it.
    indexLabel: String(candidate.position + 1).padStart(2, "0"),
    status,
    /*
      Built from the key at read time; the key itself never leaves the server.

      A REFUNDED CANDIDATE NEVER CARRIES ITS IMAGE. An `expired` one has a real
      `imageKey` — it landed, just too late to be shown — and the generosity
      refund is only defensible because the user does not receive it. Suppressed
      here rather than left to the tile, so the rule holds for every caller
      including ones that do not exist yet.
    */
    imageUrl: status === "failed-refunded" || !candidate.faceImageKey
      ? null
      : storagePublicUrl(candidate.faceImageKey),
    castId: castPublicId ?? null,
    thumbUrl: status === "failed-refunded" || !candidate.faceThumbKey
      ? null
      : storagePublicUrl(candidate.faceThumbKey),
    personaLine: candidate.personaLine,
    kept: candidate.keptAt !== null,
  };
}

/**
 * Did the sheet fail to reach the variance floor even after the release?
 *
 * Validated rather than trusted, like every other read of a json column — the
 * shape is written by the compiler today, but a column parsed as whatever it
 * happens to contain is one migration away from being a lie the echo repeats.
 */
function readVarianceHeld(compiledBrief: unknown): boolean {
  if (!compiledBrief || typeof compiledBrief !== "object") return false;
  const variance = (compiledBrief as { variance?: unknown }).variance;
  if (!variance || typeof variance !== "object") return false;
  return (variance as { confess?: unknown }).confess === true;
}

/**
 * Was this roll compiled from a READ brief, or from the raw sentence?
 *
 * The compiler has recorded this since Path A shipped and nothing has ever
 * shown it. That silence is the bug: when the interpreter is unreachable, or
 * its reply cannot be read, the compile falls back to the sentence itself and
 * **every lock the user stated is lost** — the sex, the age, the heritage they
 * typed. The roll still runs and is still charged, and the sheet looks exactly
 * like an ordinary one. A paid roll that quietly ignored half the brief.
 *
 * Fail-open on purpose (catalog H30): an interpreter outage must never cost
 * someone their roll. Nothing here changes that. It only stops the outage being
 * invisible to the person who paid for it.
 *
 * `=== false` rather than falsy, and the reason matters: rolls compiled before
 * this field existed have no value, and "absent" is not "it fell back". An
 * unknown must never be reported as a failure.
 */
function readFellBack(compiledBrief: unknown): boolean {
  if (!compiledBrief || typeof compiledBrief !== "object") return false;
  return (compiledBrief as { interpreted?: unknown }).interpreted === false;
}

export function projectRoll(input: {
  roll: CastingRoll;
  candidates: readonly ProjectableCandidate[];
  parentCandidatePublicId?: string | null;
  parentCandidatePosition?: number | null;
  parentRollPublicId?: string | null;
  /** Signed candidates → their Cast's public id, resolved owner-scoped. */
  castPublicIdByCandidateId?: ReadonlyMap<number, string>;
  /**
   * The moment this projection is made, defaulting to one reading taken here.
   *
   * `ageMs` subtracts it from `roll.createdAt`, which the roll's own insert
   * wrote off this same clock (`db/castingV2.ts` supplies `createdAt`; the
   * column's `defaultNow()` is never reached). Both terms, one clock, one
   * reading — which is the whole of entry 13. Injectable so the test can fix
   * the instant rather than sleep.
   */
  now?: Date;
}): RollProjection {
  const now = input.now ?? new Date();
  const candidates = input.candidates
    .map((candidate) =>
      projectCandidate(candidate, input.castPublicIdByCandidateId?.get(candidate.id) ?? null))
    .filter((candidate): candidate is CandidateProjection => candidate !== null)
    .sort((left, right) => left.position - right.position);

  return {
    rollId: input.roll.publicId,
    rollIndex: input.roll.rollIndex,
    status: input.roll.status,
    // The user's own sentence, returned to them. Never the compiled brief.
    briefText: input.roll.briefText,
    chips: readChips(input.roll.compiledBrief),
    varianceHeld: readVarianceHeld(input.roll.compiledBrief),
    fellBack: readFellBack(input.roll.compiledBrief),
    /*
      Derived from the sentence rather than persisted beside it.

      A stored copy would be a second copy of a fact the roll already carries —
      the class the `expiredReason` ruling named ("a second copy of a fact is a
      copy that can be wrong"). `briefText` is immutable on a committed roll, so
      deriving here is stable for the life of the roll, needs no migration, and
      cannot drift from the sentence it describes.
    */
    statedWardrobe: statesWardrobe(input.roll.briefText),
    facts: readBriefFacts(input.roll.lockContract, input.roll.compiledBrief, input.roll.briefText),
    lineage: {
      ...(input.parentCandidatePublicId ? { fromCandidateId: input.parentCandidatePublicId } : {}),
      ...(typeof input.parentCandidatePosition === "number"
        ? { fromCandidateLabel: String(input.parentCandidatePosition + 1).padStart(2, "0") }
        : {}),
      ...(input.parentRollPublicId ? { fromRollId: input.parentRollPublicId } : {}),
    },
    priceCredits: input.roll.priceCredits,
    counts: {
      total: input.candidates.length,
      ready: candidates.filter((candidate) => candidate.status === "ready").length,
      casting: candidates.filter((candidate) => candidate.status === "casting").length,
      failed: candidates.filter((candidate) => candidate.status === "failed-refunded").length,
    },
    createdAt: input.roll.createdAt.toISOString(),
    /*
      Never negative. A row written a few milliseconds ahead of this reading —
      two app processes, or a clock nudged between the insert and the read — is
      a roll zero seconds old, not one that started in the future. Clamping
      here keeps a nonsense value from reaching a threshold comparison as a very
      large negative number, which reads as "brand new" forever.
    */
    ageMs: Math.max(0, now.getTime() - input.roll.createdAt.getTime()),
    candidates,
  };
}

export type ShortlistEntry = {
  candidateId: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  personaLine: string | null;
  sourceRollIndex: number;
  indexLabel: string;
  signed: boolean;
};

export function projectShortlist(
  entries: readonly { candidate: ProjectableCandidate; rollIndex: number }[],
): ShortlistEntry[] {
  return entries.map(({ candidate, rollIndex }) => ({
    candidateId: candidate.publicId,
    // The face, for the same reason the tile shows it: the dock's Sign spends
    // the selected refinement, and the tray is where that Sign is aimed.
    thumbUrl: candidate.faceThumbKey ? storagePublicUrl(candidate.faceThumbKey) : null,
    imageUrl: candidate.faceImageKey ? storagePublicUrl(candidate.faceImageKey) : null,
    personaLine: candidate.personaLine,
    sourceRollIndex: rollIndex,
    // The face's own label, so the dock's Sign can NAME who it is about to
    // spend on rather than saying "sign the selection".
    indexLabel: String(candidate.position + 1).padStart(2, "0"),
    // A kept candidate that has already been signed stays in the tray — it is
    // still part of this sheet's story — but it can never be a Sign target.
    signed: candidate.status === "signed",
  }));
}

export function projectSession(session: CastingSession): SessionProjection {
  return {
    sessionId: session.publicId,
    status: session.status,
    originType: session.originType,
    // Deliberately null here: the numeric id is internal. The session
    // projection carries the active roll's *public* id, resolved by the
    // caller that already loaded it.
    activeRollId: null,
    signedCastCount: session.signedCastCount,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
  };
}

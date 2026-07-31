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
import {
  AGE_BANDS,
  AGE_PHASES,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "./castingIntent";

/** §J's exact enum. Internal lifecycle states collapse into these three. */
export type CandidateProjectionStatus = "casting" | "ready" | "failed-refunded";

export type CandidateProjection = {
  candidateId: string;
  position: number;
  indexLabel: string;
  status: CandidateProjectionStatus;
  imageUrl: string | null;
  thumbUrl: string | null;
  personaLine: string | null;
  kept: boolean;
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
  priceCredits: number;
  counts: { total: number; ready: number; casting: number; failed: number };
  createdAt: string;
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

export function readBriefFacts(lockContract: unknown, compiledBrief: unknown): BriefFacts {
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

  return { role, locks, open, variationAxis };
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
 * `expired` also returns null, and that omission is now load-bearing in a way
 * it was not before. An expired candidate arrived after its roll was
 * cancelled, and under the generosity ruling (2026-07-31) it was refunded —
 * which is only defensible *because* it is never shown. Project it and
 * cancelling becomes a way to buy images for nothing. The roll reads as
 * cancelled; the tile does not exist.
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
    case "signed":
      return "ready";
    case "failed":
    case "cancelled":
      return "failed-refunded";
    case "discarded":
    case "expired":
      return null;
  }
}

export function projectCandidate(candidate: CastingCandidate): CandidateProjection | null {
  const status = projectCandidateStatus(candidate.status);
  if (!status) return null;
  return {
    candidateId: candidate.publicId,
    position: candidate.position,
    // "01" through "08" — display metadata only. Nothing is ever keyed by it.
    indexLabel: String(candidate.position + 1).padStart(2, "0"),
    status,
    // Built from the key at read time; the key itself never leaves the server.
    imageUrl: candidate.imageKey ? storagePublicUrl(candidate.imageKey) : null,
    thumbUrl: candidate.thumbKey ? storagePublicUrl(candidate.thumbKey) : null,
    personaLine: candidate.personaLine,
    kept: candidate.keptAt !== null,
  };
}

export function projectRoll(input: {
  roll: CastingRoll;
  candidates: readonly CastingCandidate[];
  parentCandidatePublicId?: string | null;
  parentCandidatePosition?: number | null;
  parentRollPublicId?: string | null;
}): RollProjection {
  const candidates = input.candidates
    .map(projectCandidate)
    .filter((candidate): candidate is CandidateProjection => candidate !== null)
    .sort((left, right) => left.position - right.position);

  return {
    rollId: input.roll.publicId,
    rollIndex: input.roll.rollIndex,
    status: input.roll.status,
    // The user's own sentence, returned to them. Never the compiled brief.
    briefText: input.roll.briefText,
    chips: readChips(input.roll.compiledBrief),
    facts: readBriefFacts(input.roll.lockContract, input.roll.compiledBrief),
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
    candidates,
  };
}

export type ShortlistEntry = {
  candidateId: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  personaLine: string | null;
  sourceRollIndex: number;
};

export function projectShortlist(
  entries: readonly { candidate: CastingCandidate; rollIndex: number }[],
): ShortlistEntry[] {
  return entries.map(({ candidate, rollIndex }) => ({
    candidateId: candidate.publicId,
    thumbUrl: candidate.thumbKey ? storagePublicUrl(candidate.thumbKey) : null,
    imageUrl: candidate.imageKey ? storagePublicUrl(candidate.imageKey) : null,
    personaLine: candidate.personaLine,
    sourceRollIndex: rollIndex,
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

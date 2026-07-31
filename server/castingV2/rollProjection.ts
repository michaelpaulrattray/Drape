/**
 * Client projections for the roll domain (plan §J).
 *
 * These are explicit allowlist DTOs. Nothing here spreads a database row, and
 * that is the rule rather than a preference: a spread row is how `passwordHash`
 * once reached `auth.me` and how image URLs reached the moderator surface
 * (access-control invariant 8).
 *
 * What may never appear in anything this module returns:
 * `compiledBrief`, `lockContract`, `internalPrompt`, provider names, provider
 * models, provider request ids, storage keys, queue internals, or any row
 * belonging to another user. The types below are constructed field by field
 * so adding one of those is a deliberate edit, not an accident of shape.
 */
import type { CastingCandidate, CastingRoll, CastingSession } from "../../drizzle/schema";
import { storagePublicUrl } from "../storage";
import { UNLOCKABLE_FIELDS, type CastingChip, type UnlockableField } from "./briefCompiler";

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
  lineage: { fromCandidateId?: string; fromRollId?: string };
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
    lineage: {
      ...(input.parentCandidatePublicId ? { fromCandidateId: input.parentCandidatePublicId } : {}),
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

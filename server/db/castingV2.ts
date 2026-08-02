/**
 * Casting V2 roll-domain persistence (plan §F, §G).
 *
 * Every statement in this module carries the owner in its own WHERE clause.
 * That is invariant 1, and it is not a style preference: a SELECT that checks
 * ownership followed by a write keyed on id alone leaves a check-then-write
 * race, and that is precisely the defect class the July 2026 audit found. The
 * denormalized `userId` on rolls and candidates exists so a child mutation
 * needs no join to prove ownership — and where a join is still required to
 * re-anchor a client-supplied id to an owned parent, it happens inside the
 * same statement or the same locked transaction.
 *
 * The state machine lives in §F. Its mechanical expression here is that every
 * transition is a CAS — `UPDATE … WHERE status = <expected>` — and callers
 * read `affectedRows` to learn whether they won. Nothing in this module does
 * read-modify-write on a status, because two tabs would both read `ready` and
 * both believe they won.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, isNotNull, lt, or, sql } from "drizzle-orm";

import {
  boardItems,
  boards,
  castingCandidates,
  castingRolls,
  castingSessions,
  models,
  type CastingCandidate,
  type CastingRoll,
  type CastingSession,
} from "../../drizzle/schema";
import { availableModelWhere } from "../casting/modelAvailability";
import { CASTING_V2_COSTS } from "../casting/castingCreditCosts";
import { getDb, withTransaction, type TransactionHandle } from "./connection";

/** Sessions are the resumable unsigned sheet: 7 idle days (§G.6). */
export const CASTING_SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A discarded candidate stays undoable until the next roll, and never for less
 * than this (§G.6). Both conditions must hold before its object may be purged.
 */
export const CASTING_DISCARD_RETENTION_MS = 24 * 60 * 60 * 1000;

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function assertPositiveId(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/* --------------------------------------------------------------- sessions */

export type CreateCastingSessionInput = {
  userId: number;
  originType?: "roster" | "canvas" | "wardrobe";
  /** Canvas return destination. Verified against board ownership, not trusted. */
  originBoardId?: number | null;
  originItemId?: number | null;
  /** Fork-from-room lineage. Verified through the owner's available casts. */
  parentCastId?: number | null;
  now?: Date;
};

/**
 * Creates a session, proving every client-supplied lineage id belongs to this
 * user *inside the transaction that inserts the row*.
 *
 * The origin board/item and the parent cast arrive from the client. A session
 * that recorded an unverified `originBoardId` would later hand the canvas a
 * return destination on someone else's board — so each is locked and matched
 * on `userId` here, in the repo's `assertOwnedAvailableModelIn` idiom, rather
 * than checked in a route and hoped to still be true at insert time.
 */
export async function createCastingSession(
  input: CreateCastingSessionInput,
): Promise<CastingSession> {
  assertPositiveId(input.userId, "userId");
  const now = input.now ?? new Date();
  const publicId = randomUUID();

  return withTransaction(async (tx) => {
    if (input.originBoardId != null) {
      assertPositiveId(input.originBoardId, "originBoardId");
      const [board] = await tx
        .select({ id: boards.id })
        .from(boards)
        .where(and(eq(boards.id, input.originBoardId), eq(boards.userId, input.userId)))
        .limit(1)
        .for("update");
      if (!board) throw new CastingV2OwnershipError("board");

      if (input.originItemId != null) {
        assertPositiveId(input.originItemId, "originItemId");
        // Re-anchored to the owned board in the same statement (invariant 2):
        // verifying the board says nothing about the item id sent beside it.
        const [item] = await tx
          .select({ id: boardItems.id })
          .from(boardItems)
          .where(and(eq(boardItems.id, input.originItemId), eq(boardItems.boardId, input.originBoardId)))
          .limit(1)
          .for("update");
        if (!item) throw new CastingV2OwnershipError("board item");
      }
    } else if (input.originItemId != null) {
      // An item without its board cannot be anchored to an owner at all.
      throw new CastingV2OwnershipError("board item");
    }

    if (input.parentCastId != null) {
      assertPositiveId(input.parentCastId, "parentCastId");
      const [cast] = await tx
        .select({ id: models.id })
        .from(models)
        .where(and(
          eq(models.id, input.parentCastId),
          eq(models.userId, input.userId),
          availableModelWhere(),
        ))
        .limit(1)
        .for("update");
      if (!cast) throw new CastingV2OwnershipError("cast");
    }

    await tx.insert(castingSessions).values({
      publicId,
      userId: input.userId,
      originType: input.originType ?? "roster",
      originBoardId: input.originBoardId ?? null,
      originItemId: input.originItemId ?? null,
      parentCastId: input.parentCastId ?? null,
      status: "open",
      expiresAt: new Date(now.getTime() + CASTING_SESSION_IDLE_MS),
    });

    const [session] = await tx
      .select()
      .from(castingSessions)
      .where(and(eq(castingSessions.publicId, publicId), eq(castingSessions.userId, input.userId)))
      .limit(1);
    if (!session) throw new Error("Casting session insert did not commit");
    return session;
  });
}

/** Raised when a client-supplied id does not resolve inside the owner's data. */
export class CastingV2OwnershipError extends Error {
  readonly subject: string;
  constructor(subject: string) {
    super(`Casting ${subject} not found`);
    this.name = "CastingV2OwnershipError";
    this.subject = subject;
  }
}

export async function getOwnedCastingSession(
  userId: number,
  publicId: string,
): Promise<CastingSession | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [session] = await db
    .select()
    .from(castingSessions)
    .where(and(eq(castingSessions.publicId, publicId), eq(castingSessions.userId, userId)))
    .limit(1);
  return session ?? null;
}

/**
 * Slides the idle window. Navigation never destroys work (§G.6), so activity
 * only ever pushes expiry further out; it can never bring it closer.
 */
export async function touchCastingSession(
  userId: number,
  sessionId: number,
  now = new Date(),
): Promise<void> {
  assertPositiveId(userId, "userId");
  assertPositiveId(sessionId, "sessionId");
  const db = await requireDb();
  await db
    .update(castingSessions)
    .set({ expiresAt: new Date(now.getTime() + CASTING_SESSION_IDLE_MS) })
    .where(and(
      eq(castingSessions.id, sessionId),
      eq(castingSessions.userId, userId),
      eq(castingSessions.status, "open"),
    ));
}

/* ------------------------------------------------------------------ rolls */

export type CandidateSeed = {
  publicId: string;
  position: number;
  personaLine: string | null;
  internalPrompt: unknown;
};

export type CreateRollInput = {
  userId: number;
  sessionPublicId: string;
  operationId: string;
  briefText: string;
  compiledBrief?: unknown;
  cohortKey?: string | null;
  styleKey?: string | null;
  styleProfile?: unknown;
  lockContract?: unknown;
  /** Follow lineage. Resolved through this user's candidates, never trusted. */
  parentCandidatePublicId?: string | null;
  candidates: readonly CandidateSeed[];
  now?: Date;
};

export type CreatedRoll = {
  session: CastingSession;
  roll: CastingRoll;
  candidates: CastingCandidate[];
};

/**
 * The locked transaction from the roll sequence:
 * claim → **locked transaction → rows** → running → pinned deduct → dispatch.
 *
 * `SELECT … FOR UPDATE` on the session row is what makes two tabs rolling at
 * once produce roll 3 and roll 4 rather than a duplicate-key failure on
 * `unique(sessionId, rollIndex)` — and the failure would land *after* the
 * charge in a naive ordering, which is why the allocation is serialized here
 * and the charge happens afterwards.
 *
 * Nothing in this function spends money. That is deliberate: the recovery
 * adjudicator treats "operation exists, roll does not" as *nothing was
 * charged*, so a crash anywhere inside this transaction must be exactly that.
 */
export async function createRollWithCandidates(input: CreateRollInput): Promise<CreatedRoll> {
  assertPositiveId(input.userId, "userId");
  if (input.candidates.length !== CASTING_V2_COSTS.rollCandidateCount) {
    throw new TypeError(
      `A roll is exactly ${CASTING_V2_COSTS.rollCandidateCount} candidates`,
    );
  }
  const now = input.now ?? new Date();
  const rollPublicId = randomUUID();

  return withTransaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(castingSessions)
      .where(and(
        eq(castingSessions.publicId, input.sessionPublicId),
        eq(castingSessions.userId, input.userId),
        eq(castingSessions.status, "open"),
      ))
      .limit(1)
      .for("update");
    if (!session) throw new CastingV2OwnershipError("session");

    let parentRollId: number | null = null;
    let parentCandidateId: number | null = null;
    if (input.parentCandidatePublicId) {
      // Follow lineage (§G): the parent candidate is resolved through this
      // user's own rows. A client-supplied lineage id can therefore never
      // reference a foreign candidate — the worst it can do is fail to
      // resolve, which is a refusal, not a leak.
      const [parent] = await tx
        .select({ id: castingCandidates.id, rollId: castingCandidates.rollId })
        .from(castingCandidates)
        .where(and(
          eq(castingCandidates.publicId, input.parentCandidatePublicId),
          eq(castingCandidates.userId, input.userId),
          eq(castingCandidates.sessionId, session.id),
          eq(castingCandidates.status, "ready"),
        ))
        .limit(1);
      if (!parent) throw new CastingV2OwnershipError("candidate");
      parentCandidateId = parent.id;
      parentRollId = parent.rollId;
    }

    const [highest] = await tx
      .select({ rollIndex: castingRolls.rollIndex })
      .from(castingRolls)
      .where(and(eq(castingRolls.sessionId, session.id), eq(castingRolls.userId, input.userId)))
      .orderBy(desc(castingRolls.rollIndex))
      .limit(1);
    const rollIndex = (highest?.rollIndex ?? 0) + 1;

    await tx.insert(castingRolls).values({
      publicId: rollPublicId,
      sessionId: session.id,
      userId: input.userId,
      rollIndex,
      briefText: input.briefText,
      compiledBrief: input.compiledBrief ?? null,
      cohortKey: input.cohortKey ?? null,
      styleKey: input.styleKey ?? null,
      styleProfile: input.styleProfile ?? null,
      lockContract: input.lockContract ?? null,
      parentRollId,
      parentCandidateId,
      status: "pending",
      priceCredits: CASTING_V2_COSTS.rollCandidate * input.candidates.length,
      operationId: input.operationId,
      createdAt: now,
    });

    const [roll] = await tx
      .select()
      .from(castingRolls)
      .where(and(eq(castingRolls.publicId, rollPublicId), eq(castingRolls.userId, input.userId)))
      .limit(1);
    if (!roll) throw new Error("Casting roll insert did not commit");

    await tx.insert(castingCandidates).values(
      input.candidates.map((candidate) => ({
        publicId: candidate.publicId,
        rollId: roll.id,
        sessionId: session.id,
        userId: input.userId,
        position: candidate.position,
        status: "queued" as const,
        // The refundable unit is persisted per row, so refund authority reads
        // what was charged instead of dividing a total (§H.3).
        pointsCost: CASTING_V2_COSTS.rollCandidate,
        personaLine: candidate.personaLine,
        internalPrompt: candidate.internalPrompt ?? null,
        createdAt: now,
      })),
    );

    await tx
      .update(castingSessions)
      .set({
        activeRollId: roll.id,
        expiresAt: new Date(now.getTime() + CASTING_SESSION_IDLE_MS),
      })
      .where(and(eq(castingSessions.id, session.id), eq(castingSessions.userId, input.userId)));

    const candidates = await tx
      .select()
      .from(castingCandidates)
      .where(and(eq(castingCandidates.rollId, roll.id), eq(castingCandidates.userId, input.userId)))
      .orderBy(asc(castingCandidates.position));

    return { session, roll, candidates };
  });
}

export async function getOwnedRoll(userId: number, rollPublicId: string): Promise<CastingRoll | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [roll] = await db
    .select()
    .from(castingRolls)
    .where(and(eq(castingRolls.publicId, rollPublicId), eq(castingRolls.userId, userId)))
    .limit(1);
  return roll ?? null;
}

/**
 * A follow roll's parent, as public ids.
 *
 * `casting_rolls` stores lineage as internal numeric ids, which must never
 * leave the server (§J). This turns them into the opaque public ids the sheet
 * can use, scoped to the owner in the statements that read them — a roll of
 * someone else's cannot be resolved into a lineage label on this user's sheet.
 *
 * Both halves are nullable, and the asymmetry is real rather than defensive:
 * the parent **candidate** row can be purged while the parent **roll**
 * survives (a discarded candidate past its 24h floor is purgeable once it is
 * no longer the active roll's — §G.6), so a roll can legitimately know which
 * roll it came from but no longer which candidate. Callers key the lineage
 * pill on the roll.
 */
export async function getRollLineage(
  userId: number,
  roll: Pick<CastingRoll, "parentRollId" | "parentCandidateId">,
): Promise<{
  parentRollPublicId: string | null;
  parentCandidatePublicId: string | null;
  /** The parent candidate's position, so lineage can name the FACE. */
  parentCandidatePosition: number | null;
}> {
  assertPositiveId(userId, "userId");
  if (!roll.parentRollId && !roll.parentCandidateId) {
    return { parentRollPublicId: null, parentCandidatePublicId: null, parentCandidatePosition: null };
  }
  const db = await requireDb();

  const [parentRoll] = roll.parentRollId
    ? await db
        .select({ publicId: castingRolls.publicId })
        .from(castingRolls)
        .where(and(eq(castingRolls.id, roll.parentRollId), eq(castingRolls.userId, userId)))
        .limit(1)
    : [];

  const [parentCandidate] = roll.parentCandidateId
    ? await db
        .select({ publicId: castingCandidates.publicId, position: castingCandidates.position })
        .from(castingCandidates)
        .where(and(
          eq(castingCandidates.id, roll.parentCandidateId),
          eq(castingCandidates.userId, userId),
        ))
        .limit(1)
    : [];

  return {
    parentRollPublicId: parentRoll?.publicId ?? null,
    parentCandidatePublicId: parentCandidate?.publicId ?? null,
    parentCandidatePosition: parentCandidate?.position ?? null,
  };
}

export async function getRollByOperation(userId: number, operationId: string): Promise<CastingRoll | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [roll] = await db
    .select()
    .from(castingRolls)
    .where(and(eq(castingRolls.operationId, operationId), eq(castingRolls.userId, userId)))
    .limit(1);
  return roll ?? null;
}

export async function listRollCandidates(userId: number, rollId: number): Promise<CastingCandidate[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(rollId, "rollId");
  const db = await requireDb();
  return db
    .select()
    .from(castingCandidates)
    .where(and(eq(castingCandidates.rollId, rollId), eq(castingCandidates.userId, userId)))
    .orderBy(asc(castingCandidates.position));
}

export async function listSessionRolls(userId: number, sessionId: number): Promise<CastingRoll[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(sessionId, "sessionId");
  const db = await requireDb();
  return db
    .select()
    .from(castingRolls)
    .where(and(eq(castingRolls.sessionId, sessionId), eq(castingRolls.userId, userId)))
    .orderBy(asc(castingRolls.rollIndex));
}

/**
 * This user's unsigned sheets, most recently worked on first.
 *
 * A session is a durable seven-day object, and until something can list them
 * that durability is unreachable: close the tab and the sheet you paid for
 * exists only in a URL you no longer have. This is the read behind "resume".
 *
 * **A session with no rolls is not a sheet yet** (founder bug, 2026-08-01).
 * The client creates the session in its own mutation *before* compiling, so a
 * brief that is refused — anime, a named person, an uninterpretable
 * sentence — throws before any roll commits and leaves an empty row behind.
 * The card it produced had no brief (`briefText` is read from the latest roll),
 * no images and no rolls: a blank tile the user has to tidy up after an error
 * they were already told about.
 *
 * The filter is on ROLLS, deliberately, and not on landed candidates. A roll
 * commits its rows before dispatch, so this hides only the seconds during
 * compilation — whereas a "has a ready candidate" filter would hide a sheet
 * for the whole 66–82s it takes to generate, which is exactly the sheet
 * someone reopening the lobby is looking for.
 *
 * A roll whose candidates all failed keeps its sheet listed on purpose. That
 * one has a brief, a roll and a charge with its refund, so it is a workspace
 * to retry in rather than debris — the sheet page's composer is the designed
 * retry surface for it.
 */
export async function listOpenCastingSessions(
  userId: number,
  limit = 6,
): Promise<CastingSession[]> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  return db
    .select()
    .from(castingSessions)
    .where(
      and(
        eq(castingSessions.userId, userId),
        eq(castingSessions.status, "open"),
        sql`EXISTS (SELECT 1 FROM ${castingRolls} WHERE ${castingRolls.sessionId} = ${castingSessions.id})`,
      ),
    )
    .orderBy(desc(castingSessions.lastActivityAt))
    .limit(limit);
}

/**
 * One ready candidate of this user's, by public id.
 *
 * Read before a follow roll compiles, so the new sheet can be conditioned on
 * who the parent actually was rather than starting from the sentence again.
 * The ownership predicate is in this statement, not checked beforehand
 * (invariant 1) — but this read is *not* the authority for the lineage link.
 * `createRollWithCandidates` re-resolves the same candidate inside its
 * transaction, scoped to the session it is writing into, and that is what the
 * stored `parentCandidateId` comes from. A foreign id fails here and fails
 * there; it cannot be laundered by passing through this function.
 */
export async function getOwnedReadyCandidate(
  userId: number,
  candidatePublicId: string,
): Promise<CastingCandidate | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [candidate] = await db
    .select()
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
      eq(castingCandidates.status, "ready"),
    ))
    .limit(1);
  return candidate ?? null;
}

/** The cross-roll tray: kept candidates of one session, oldest keep first. */
export async function listKeptCandidates(userId: number, sessionId: number): Promise<CastingCandidate[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(sessionId, "sessionId");
  const db = await requireDb();
  return db
    .select()
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.sessionId, sessionId),
      eq(castingCandidates.userId, userId),
      isNotNull(castingCandidates.keptAt),
      inArray(castingCandidates.status, ["ready", "signed"]),
    ))
    .orderBy(asc(castingCandidates.keptAt));
}

/**
 * Roll status CAS. Terminal states are immutable (§F: rolls are versions), so
 * the predicate names the non-terminal states rather than trusting the caller
 * to have read a fresh row.
 */
export async function setRollStatus(input: {
  userId: number;
  rollId: number;
  status: "generating" | "complete" | "partial" | "failed" | "cancelled";
  from?: readonly ("pending" | "generating")[];
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.rollId, "rollId");
  const db = await requireDb();
  const result = await db
    .update(castingRolls)
    .set({ status: input.status })
    .where(and(
      eq(castingRolls.id, input.rollId),
      eq(castingRolls.userId, input.userId),
      inArray(castingRolls.status, [...(input.from ?? ["pending", "generating"])]),
    ));
  return affectedRows(result) === 1;
}

/* ------------------------------------------------------- candidate states */

/** `queued → dispatched`. Losing the CAS means the roll was cancelled first. */
export async function markCandidateDispatched(input: {
  userId: number;
  candidateId: number;
  provider: string;
  providerModel: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({
      status: "dispatched",
      provider: input.provider,
      providerModel: input.providerModel,
      attemptCount: sql`${castingCandidates.attemptCount} + 1`,
    })
    .where(and(
      eq(castingCandidates.id, input.candidateId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "queued"),
    ));
  return affectedRows(result) === 1;
}

export type CandidateLanding = "ready" | "expired" | "lost";

/**
 * `dispatched → ready | expired`, deciding which by reading the roll's status
 * **in the same statement** (§F cancellation).
 *
 * This is the statement that makes "a candidate can never be both refunded and
 * delivered" true. If cancel already refunded this slice, the roll is
 * `cancelled` and the landing becomes `expired` — the image exists in storage
 * but is never shown and is purged; the user keeps their credits. If cancel
 * has not committed, this write wins and the candidate is delivered, so the
 * cancel CAS will find it non-`queued` and refund nothing for it.
 *
 * Correlating on `casting_rolls` from an `UPDATE casting_candidates` is legal
 * in MySQL (the restriction is on selecting from the table being updated).
 */
export async function landCandidate(input: {
  userId: number;
  candidateId: number;
  imageKey: string;
  thumbKey?: string | null;
  provider: string;
  providerModel: string;
  providerRef?: string | null;
}): Promise<CandidateLanding> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({
      status: sql`CASE WHEN (
        SELECT r.status FROM casting_rolls r WHERE r.id = casting_candidates.rollId
      ) = 'cancelled' THEN 'expired' ELSE 'ready' END`,
      /*
        WHY it expired, written in the SAME statement as the status — migration
        0018. The two meanings of `expired` could not be told apart before, so
        the generosity refund had to fire inline here and the recovery sweep had
        to keep its hands off entirely, leaving a crash between this CAS and the
        refund as a slice nobody ever paid back.

        Atomic with the status by construction: one statement, one CASE, so the
        reason can never disagree with the fact it explains.
      */
      expiredReason: sql`CASE WHEN (
        SELECT r.status FROM casting_rolls r WHERE r.id = casting_candidates.rollId
      ) = 'cancelled' THEN 'cancelled_unseen' ELSE NULL END`,
      imageKey: input.imageKey,
      thumbKey: input.thumbKey ?? null,
      provider: input.provider,
      providerModel: input.providerModel,
      providerRef: input.providerRef ?? null,
    })
    .where(and(
      eq(castingCandidates.id, input.candidateId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "dispatched"),
    ));
  if (affectedRows(result) !== 1) return "lost";

  const [row] = await db
    .select({ status: castingCandidates.status })
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.id, input.candidateId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  return row?.status === "expired" ? "expired" : "ready";
}

export async function failCandidate(input: {
  userId: number;
  candidateId: number;
  failureClass: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({ status: "failed", failureClass: input.failureClass.slice(0, 24) })
    .where(and(
      eq(castingCandidates.id, input.candidateId),
      eq(castingCandidates.userId, input.userId),
      inArray(castingCandidates.status, ["queued", "dispatched"]),
    ));
  return affectedRows(result) === 1;
}

/**
 * `queued → cancelled` for one candidate.
 *
 * Deliberately per-candidate rather than one bulk UPDATE: MySQL has no
 * RETURNING, and the refund must go to exactly the rows this CAS won. A bulk
 * update would tell us how many rows changed but not *which*, and refunding
 * "eight minus however many were already dispatched" is arithmetic on a race.
 */
export async function cancelQueuedCandidate(input: {
  userId: number;
  candidateId: number;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({ status: "cancelled" })
    .where(and(
      eq(castingCandidates.id, input.candidateId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "queued"),
    ));
  return affectedRows(result) === 1;
}

/**
 * The recovery sweep's claim on a candidate.
 *
 * Recovery must win this row *before* it refunds the slice, never after. A
 * live process can outlive its lease — a single heartbeat failure stops the
 * heartbeat permanently while dispatch keeps running — so between the sweep
 * reading the candidates and settling one, that process may have landed it.
 * Claiming first means a lost race costs nothing; refunding first meant the
 * money was already gone when we discovered the candidate had been delivered.
 *
 * The `ready`-without-`imageKey` arm is the torn write: `ready` is only
 * written after bytes are in our storage, so such a row means the user cannot
 * see the image and is still owed its slice.
 */
export async function claimCandidateForRecovery(input: {
  userId: number;
  candidateId: number;
  failureClass: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({ status: "failed", failureClass: input.failureClass.slice(0, 24) })
    .where(and(
      eq(castingCandidates.id, input.candidateId),
      eq(castingCandidates.userId, input.userId),
      or(
        inArray(castingCandidates.status, ["queued", "dispatched"]),
        and(eq(castingCandidates.status, "ready"), isNull(castingCandidates.imageKey)),
      ),
    ));
  return affectedRows(result) === 1;
}

/* ------------------------------------------------- user-facing candidate ops */

/**
 * Keep is a desired-state CAS, never a toggle (§F Keep). The client sends the
 * state it wants; the statement asserts the state it is coming from. Two tabs
 * pressing Keep produce one keep, not a keep and an unkeep.
 */
export async function setCandidateKept(input: {
  userId: number;
  candidatePublicId: string;
  kept: boolean;
  now?: Date;
}): Promise<{ changed: boolean; found: boolean }> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const now = input.now ?? new Date();
  const result = await db
    .update(castingCandidates)
    .set({ keptAt: input.kept ? now : null })
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "ready"),
      input.kept ? isNull(castingCandidates.keptAt) : isNotNull(castingCandidates.keptAt),
    ));
  if (affectedRows(result) === 1) return { changed: true, found: true };

  // Distinguish "already in the desired state" (idempotent success) from
  // "no such candidate of yours" (a refusal). Both are zero affected rows.
  const [existing] = await db
    .select({ keptAt: castingCandidates.keptAt, status: castingCandidates.status })
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  if (!existing || existing.status !== "ready") return { changed: false, found: false };
  return { changed: false, found: Boolean(existing.keptAt) === input.kept };
}

/**
 * Discard: `ready → discarded`, and it **also clears kept** — a card cannot be
 * both discarded and shortlisted (§F). Double-click is idempotent because the
 * second call finds no `ready` row.
 *
 * `expiresAt` is stamped here rather than at insert because a candidate's
 * expiry is unknowable when it is created: it depends on the user discarding
 * it (§G.6).
 */
export async function discardCandidate(input: {
  userId: number;
  candidatePublicId: string;
  now?: Date;
}): Promise<{ changed: boolean; found: boolean }> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const now = input.now ?? new Date();
  const result = await db
    .update(castingCandidates)
    .set({
      status: "discarded",
      discardedAt: now,
      keptAt: null,
      expiresAt: new Date(now.getTime() + CASTING_DISCARD_RETENTION_MS),
    })
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "ready"),
    ));
  if (affectedRows(result) === 1) return { changed: true, found: true };

  const [existing] = await db
    .select({ status: castingCandidates.status })
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  return { changed: false, found: existing?.status === "discarded" };
}

/**
 * Undo: `discarded → ready`, anchored to the session's **active** roll.
 *
 * That anchor is the server-side expression of "the undo stack clears on the
 * next roll" (§F). It is not a client courtesy: a stale tab holding an old
 * candidate id cannot resurrect a discard from an earlier roll, because the
 * subquery no longer matches. Kept state is deliberately not restored — the
 * card comes back unkept.
 */
export async function undoDiscardCandidate(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({ status: "ready", discardedAt: null, expiresAt: null })
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "discarded"),
      sql`${castingCandidates.rollId} = (
        SELECT s.activeRollId FROM casting_sessions s
        WHERE s.id = ${castingCandidates.sessionId} AND s.userId = ${input.userId}
      )`,
    ));
  return affectedRows(result) === 1;
}

/* ---------------------------------------------------------- cleanup feeds */

export type PurgeableCandidate = {
  id: number;
  userId: number;
  imageKey: string | null;
  thumbKey: string | null;
};

/**
 * Candidates whose objects may be deleted (§G.6).
 *
 * Two independent sources, both conservative:
 *  - a discard that is past its 24h floor **and** no longer the active roll's,
 *    so it can no longer be undone;
 *  - `expired` — delivered after a cancel, never shown, never refunded.
 *
 * `cancelled` is deliberately absent. Those rows hold no storage object (they
 * never reached the provider), so purging them frees nothing — and they carry
 * the refund story the sheet shows as "didn't run — refunded". Deleting them
 * an hour later would make a cancelled roll's history quietly rewrite itself.
 * They go with their session at expiry, like everything else.
 *
 * Signed candidates and kept candidates are never selected here. Kept siblings
 * of a signed cast are retained by the same rule that retains kept candidates
 * generally — nothing in this query can reach a row with `keptAt` set.
 */
export async function listPurgeableCandidates(input: {
  limit?: number;
  now?: Date;
}): Promise<PurgeableCandidate[]> {
  const db = await requireDb();
  const now = input.now ?? new Date();
  return db
    .select({
      id: castingCandidates.id,
      userId: castingCandidates.userId,
      imageKey: castingCandidates.imageKey,
      thumbKey: castingCandidates.thumbKey,
    })
    .from(castingCandidates)
    .where(and(
      isNull(castingCandidates.keptAt),
      isNull(castingCandidates.signedCastId),
      sql`(
        (${castingCandidates.status} = 'discarded'
          AND ${castingCandidates.expiresAt} IS NOT NULL
          AND ${castingCandidates.expiresAt} <= ${now}
          AND ${castingCandidates.rollId} <> COALESCE((
            SELECT s.activeRollId FROM casting_sessions s WHERE s.id = ${castingCandidates.sessionId}
          ), 0))
        OR ${castingCandidates.status} = 'expired'
      )`,
    ))
    .limit(input.limit ?? 200);
}

/**
 * Sessions past their idle window. Everything under them purges except signed
 * candidates and the kept siblings of a signed candidate (§G.6) — that
 * exemption is applied by the purge itself, not by this selection.
 */
export async function listExpiredSessions(input: {
  limit?: number;
  now?: Date;
}): Promise<{ id: number; userId: number }[]> {
  const db = await requireDb();
  const now = input.now ?? new Date();
  return db
    .select({ id: castingSessions.id, userId: castingSessions.userId })
    .from(castingSessions)
    .where(and(
      eq(castingSessions.status, "open"),
      isNotNull(castingSessions.expiresAt),
      lt(castingSessions.expiresAt, now),
    ))
    .limit(input.limit ?? 50);
}

/**
 * Abandon a sheet on purpose.
 *
 * The user's own disposal of exploratory work. It writes the same terminal
 * status the 7-day sweep writes, so everything downstream — the object purge,
 * the kept/signed exemptions — is the machinery that already exists rather
 * than a second path that has to agree with the first.
 *
 * Owner-scoped in the statement (invariant 1), and only from `open`: a sheet
 * that already expired is not abandoned twice.
 */
export async function abandonCastingSession(input: {
  userId: number;
  sessionPublicId: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingSessions)
    .set({ status: "abandoned" })
    .where(and(
      eq(castingSessions.publicId, input.sessionPublicId),
      eq(castingSessions.userId, input.userId),
      eq(castingSessions.status, "open"),
    ));
  return affectedRows(result) === 1;
}

export async function markSessionExpired(sessionId: number): Promise<boolean> {
  assertPositiveId(sessionId, "sessionId");
  const db = await requireDb();
  const result = await db
    .update(castingSessions)
    .set({ status: "expired" })
    .where(and(eq(castingSessions.id, sessionId), eq(castingSessions.status, "open")));
  return affectedRows(result) === 1;
}

/**
 * Marks an expired session's unprotected candidates as `expired` so the object
 * sweep above can see them. Signed candidates and kept siblings of a signed
 * candidate survive with the Cast (§G.6); a session that never signed anything
 * protects nothing, so its kept candidates expire with it.
 */
export async function expireSessionCandidates(input: {
  sessionId: number;
  userId: number;
}): Promise<number> {
  assertPositiveId(input.sessionId, "sessionId");
  assertPositiveId(input.userId, "userId");

  /*
    The "did this session sign anything" question is asked as its own
    statement, not as a subquery, because MySQL refuses to read the table an
    UPDATE is writing (ER_UPDATE_TABLE_USED). Both statements run inside one
    transaction that holds the session row, so the answer cannot change under
    us between them.

    M7 NOTE: the Sign ceremony must take this same session-row lock. It already
    has reason to — it increments `signedCastCount` — and that shared lock is
    what stops a Sign landing between these two statements and having its kept
    siblings expired out from under it.
  */
  return withTransaction(async (tx) => {
    await tx
      .select({ id: castingSessions.id })
      .from(castingSessions)
      .where(and(eq(castingSessions.id, input.sessionId), eq(castingSessions.userId, input.userId)))
      .limit(1)
      .for("update");

    const [signed] = await tx
      .select({ id: castingCandidates.id })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.sessionId, input.sessionId),
        eq(castingCandidates.userId, input.userId),
        isNotNull(castingCandidates.signedCastId),
      ))
      .limit(1);

    const result = await tx
      .update(castingCandidates)
      /*
        The OTHER meaning of `expired`, and the one that must never be refunded:
        the user received these candidates and looked at them for a week. Stamped
        in the same statement as the status so the sweep can tell them apart from
        a cancelled-unseen landing (migration 0018).
      */
      .set({ status: "expired", expiredReason: "retention" })
      .where(and(
        eq(castingCandidates.sessionId, input.sessionId),
        eq(castingCandidates.userId, input.userId),
        isNull(castingCandidates.signedCastId),
        inArray(castingCandidates.status, ["queued", "dispatched", "ready", "failed", "discarded"]),
        // Kept siblings survive only where there is a Cast for them to be
        // siblings *of* (§G.6). A session that never signed protects nothing.
        ...(signed ? [isNull(castingCandidates.keptAt)] : []),
      ));
    return affectedRows(result);
  });
}

/** Deletes candidate rows whose objects the cleanup worker has been handed. */
export async function deleteCandidateRowsIn(
  tx: TransactionHandle,
  input: { userId: number; candidateIds: readonly number[] },
): Promise<number> {
  if (input.candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingCandidates)
    .where(and(
      eq(castingCandidates.userId, input.userId),
      inArray(castingCandidates.id, [...input.candidateIds]),
      isNull(castingCandidates.signedCastId),
      isNull(castingCandidates.keptAt),
    ));
  return affectedRows(result);
}

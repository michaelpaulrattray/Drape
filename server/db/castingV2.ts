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

import type { CastingPath } from "../../shared/castingPaths";

import {
  boardItems,
  boards,
  castingCandidates,
  castingCandidateVariants,
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
  /**
   * THE TWO PATHS (design §3.1). Both or neither — a path without a line is
   * the `incoherent` resolution `wardrobeLine.ts` refuses to paint.
   *
   * ⚠ On a FOLLOW these are IGNORED and the parent roll's are inherited, in
   * the same statement that re-anchors the parent candidate to this user. A
   * Follow deliberately wants the SHEET's outfit rather than this person's.
   */
  path?: CastingPath | null;
  wardrobeLine?: string | null;
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
    let parentVariantId: number | null = null;
    let inheritedPath: CastingPath | null = null;
    let inheritedWardrobeLine: string | null = null;
    if (input.parentCandidatePublicId) {
      // Follow lineage (§G): the parent candidate is resolved through this
      // user's own rows. A client-supplied lineage id can therefore never
      // reference a foreign candidate — the worst it can do is fail to
      // resolve, which is a refusal, not a leak.
      const [parent] = await tx
        .select({
          id: castingCandidates.id,
          rollId: castingCandidates.rollId,
          selectedVariantId: castingCandidates.selectedVariantId,
        })
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
      /*
        WHICH face this family descends from (D-123). Read from the parent row
        that was just re-anchored to this user, never taken from the caller —
        so the lineage cannot name a variant the follower does not own.

        NULL when the parent is showing its original, which is every roll
        written before M8.
      */
      parentVariantId = parent.selectedVariantId;

      /*
        THE PATH AND THE OUTFIT TRAVEL WITH THE LINEAGE (design §3.1), read
        here rather than taken from the caller — the `parentVariantId`
        precedent, and the same reason: lineage is cheap to write while the row
        is being created and painful to backfill.

        THE BORN LINE, NOT THE EDITED ONE, and that is decided rather than left
        to absence. If the followed variant has had a wardrobe edit, that edit
        does NOT travel: a Follow casts a fresh eight, and dressing eight
        strangers in one person's mid-session outfit change is a momentary
        choice made permanent for eight strangers. The edited look stays on the
        person it was made for.

        ⚠ THIS IS THE ONE PLACE IN THE PRODUCT THAT MAY READ THE BORN COLUMN BY
        NAME. Everything else goes through `currentWardrobeLine(branch)` —
        condition (v), fable-1334 §2 — because a branch that has been edited is
        no longer wearing what it was born in, and six views judged against the
        wrong line is refunded slices.

        Owner-scoped in the statement that reads it (invariant 1), even though
        `parentRollId` came from a row already anchored to this user.
      */
      const [parentRoll] = await tx
        .select({ path: castingRolls.path, wardrobeLine: castingRolls.wardrobeLine })
        .from(castingRolls)
        .where(and(eq(castingRolls.id, parent.rollId), eq(castingRolls.userId, input.userId)))
        .limit(1);
      inheritedPath = parentRoll?.path ?? null;
      inheritedWardrobeLine = parentRoll?.wardrobeLine ?? null;
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
      parentVariantId,
      /* A follow wears the sheet it descends from; a fresh roll wears what the
         service resolved for it. Both columns move together or neither does. */
      path: parentCandidateId === null ? input.path ?? null : inheritedPath,
      wardrobeLine: parentCandidateId === null ? input.wardrobeLine ?? null : inheritedWardrobeLine,
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

/**
 * A candidate row plus THE FACE IT SHOWS — what every display path wants.
 *
 * The tile, the viewer and the echo must show the refinement the user selected,
 * for the plainest possible reason: a surface that shows the original while
 * Sign would spend the variant is a surface that lies about what the button
 * does. `variantId` is null for an unrefined candidate, which is the ordinary
 * case and the shape everything already handles.
 */
export type CandidateWithFace = CastingCandidate & {
  selectedVariantPublicId: string | null;
  faceImageKey: string | null;
  faceThumbKey: string | null;
};

export async function listRollCandidates(
  userId: number,
  rollId: number,
): Promise<CandidateWithFace[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(rollId, "rollId");
  const db = await requireDb();
  const rows = await db
    .select({
      candidate: castingCandidates,
      variantPublicId: castingCandidateVariants.publicId,
      variantImageKey: castingCandidateVariants.imageKey,
      variantThumbKey: castingCandidateVariants.thumbKey,
    })
    .from(castingCandidates)
    // Owner-scoped in the join, not inherited from the pointer — see
    // `getOwnedCandidateWithSelectedFace` for why the pointer is not enough.
    .leftJoin(castingCandidateVariants, and(
      eq(castingCandidateVariants.id, castingCandidates.selectedVariantId),
      eq(castingCandidateVariants.userId, userId),
      eq(castingCandidateVariants.candidateId, castingCandidates.id),
      eq(castingCandidateVariants.status, "ready"),
    ))
    .where(and(eq(castingCandidates.rollId, rollId), eq(castingCandidates.userId, userId)))
    .orderBy(asc(castingCandidates.position));
  return rows.map((row) => ({
    ...row.candidate,
    selectedVariantPublicId: row.variantPublicId,
    /* Both keys move together or neither does — a variant's picture must never
       be shown under the original's thumbnail. */
    faceImageKey: row.variantPublicId ? row.variantImageKey : row.candidate.imageKey,
    faceThumbKey: row.variantPublicId ? row.variantThumbKey : row.candidate.thumbKey,
  }));
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
/**
 * The ceiling, and why there still is one.
 *
 * It was 6, and that was a cap the user could not see past: the lobby's strip
 * scrolls sideways without limit, so sheets seven and beyond were not merely
 * further along the row — they were unreachable from the lobby entirely, with
 * no affordance saying anything was missing. A sheet you paid for and cannot
 * find is the same failure as a sheet that was never kept.
 *
 * Not unbounded, though. Sessions expire after seven quiet days, so the set is
 * bounded in PRACTICE — but bounded by behaviour is not bounded by the
 * statement, and an owner SELECT with no ceiling is one unusual week away from
 * being a page-load that reads everything. Forty covers a heavy week several
 * times over while keeping the query honest about having a limit at all.
 */
const OPEN_SESSION_CEILING = 40;

export async function listOpenCastingSessions(
  userId: number,
  limit = OPEN_SESSION_CEILING,
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

/*
  `getOwnedReadyCandidate` is GONE (M8), and it was deleted rather than left
  unused on purpose.

  It returned the candidate ROW, which stopped being the same thing as the
  candidate's FACE the moment refinements existed. Its one caller — Follow —
  now reads through selection below, and an unused helper that quietly answers
  the wrong question is worse than no helper at all: it is precisely what the
  next person writing a follow-shaped path would reach for.
*/

/**
 * An owned, ready candidate AND the face it currently shows (M8 §11).
 *
 * The read every caller wants once refinements exist, and the reason
 * `getOwnedReadyCandidate` is not enough: a candidate row holds the face the
 * SHEET rolled, which stops being the face the USER is looking at the moment
 * they refine it. Follow reading the row directly is §11's second landmine —
 * refine her eyes green, follow her, and get eight brown-eyed cousins.
 *
 * **A variant is addressable only THROUGH its owned parent.** There is
 * deliberately no `getVariant(publicId)` anywhere in this module: the join
 * re-proves the variant's user and its parent candidate in the same statement
 * that finds it, so no caller can hold a variant id and ask for it directly.
 * That is invariant 1 applied to a child of a child.
 */
export type OwnedCandidateFace = {
  candidate: CastingCandidate;
  /** The selected refinement, or null when the original is the face. */
  variantId: number | null;
  variantPublicId: string | null;
  imageKey: string | null;
  thumbKey: string | null;
  internalPrompt: unknown;
  /**
   * WHAT THE ROLL THIS FACE CAME FROM WAS CAST ON, and what it was born wearing
   * (item 7a).
   *
   * Joined here rather than read a second time, and joined THROUGH the owned
   * candidate so the roll is reached only by somebody who already owns the face
   * — the same shape the compiled brief's join uses, for the same reason.
   *
   * `null` on both is the honest state of every roll cast before the paths, and
   * `currentWardrobeLine` reads that pair as `unpathed`: paint what you always
   * painted. They travel as the ROW'S OWN two fields rather than as a resolved
   * line, because a caller needs to tell *"this cast wears the house line"* from
   * *"this cast predates the paths"* and a bare string cannot say the second.
   */
  rollPath: string | null;
  rollWardrobeLine: string | null;
};

export async function getOwnedCandidateWithSelectedFace(
  userId: number,
  candidatePublicId: string,
): Promise<OwnedCandidateFace | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [row] = await db
    .select({
      candidate: castingCandidates,
      variantId: castingCandidateVariants.id,
      variantPublicId: castingCandidateVariants.publicId,
      variantImageKey: castingCandidateVariants.imageKey,
      variantThumbKey: castingCandidateVariants.thumbKey,
      variantInternalPrompt: castingCandidateVariants.internalPrompt,
      rollPath: castingRolls.path,
      rollWardrobeLine: castingRolls.wardrobeLine,
    })
    .from(castingCandidates)
    .leftJoin(castingCandidateVariants, and(
      eq(castingCandidateVariants.id, castingCandidates.selectedVariantId),
      eq(castingCandidateVariants.userId, userId),
      eq(castingCandidateVariants.candidateId, castingCandidates.id),
      eq(castingCandidateVariants.status, "ready"),
    ))
    /* THROUGH the owned candidate, and scoped to the same owner in the same
       statement — enforcement invariant 1, on a join rather than on a check. */
    .leftJoin(castingRolls, and(
      eq(castingRolls.id, castingCandidates.rollId),
      eq(castingRolls.userId, userId),
    ))
    .where(and(
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
      eq(castingCandidates.status, "ready"),
    ))
    .limit(1);
  if (!row) return null;
  /* All of the face or none of it — never a variant's image with the
     original's record, which is the mix that makes a record lie. */
  /* The roll's two fields belong to the CANDIDATE and not to whichever face is
     selected, so they are the same either way — written once rather than in
     both branches, where a copy would be free to drift. */
  const roll = { rollPath: row.rollPath, rollWardrobeLine: row.rollWardrobeLine };
  return row.variantId
    ? {
      candidate: row.candidate,
      variantId: row.variantId,
      variantPublicId: row.variantPublicId,
      imageKey: row.variantImageKey,
      thumbKey: row.variantThumbKey,
      internalPrompt: row.variantInternalPrompt,
      ...roll,
    }
    : {
      candidate: row.candidate,
      variantId: null,
      variantPublicId: null,
      imageKey: row.candidate.imageKey,
      thumbKey: row.candidate.thumbKey,
      internalPrompt: row.candidate.internalPrompt,
      ...roll,
    };
}

/**
 * WHAT THE BRIEF SAID SHE WEARS — the base-worn inventory (D-206).
 *
 * The founder typed "remove her glasses" at a face visibly wearing glasses and
 * was told *"I can't find any glasses on this face"*. The removal matcher was
 * consulting the refine recipe, and her glasses came from the BRIEF — so the
 * record it asked was authoritative about everything except the thing being
 * asked about.
 *
 * The roll's compiled brief is the record that knows. It is joined here rather
 * than passed in, and joined **through the owned candidate** so the roll is
 * re-proved to belong to this user in the same statement that finds it
 * (invariant 1) — a caller holding a candidate id cannot reach a stranger's
 * brief through this.
 */
export type BaseWornSource = {
  compiledBrief: unknown;
  lockContract: unknown;
  briefText: string;
};

export async function getBriefForOwnedCandidate(
  userId: number,
  candidatePublicId: string,
): Promise<BaseWornSource | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [row] = await db
    .select({
      compiledBrief: castingRolls.compiledBrief,
      lockContract: castingRolls.lockContract,
      briefText: castingRolls.briefText,
    })
    .from(castingCandidates)
    .innerJoin(castingRolls, and(
      eq(castingRolls.id, castingCandidates.rollId),
      eq(castingRolls.userId, userId),
    ))
    .where(and(
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
    ))
    .limit(1);
  if (!row) return null;
  return {
    compiledBrief: row.compiledBrief,
    lockContract: row.lockContract,
    briefText: typeof row.briefText === "string" ? row.briefText : "",
  };
}

/**
 * WHAT THE SHEET A FOLLOW DESCENDS FROM IS WEARING — the born pair, read
 * BEFORE compilation (design §3.1, item 5 of §10's build).
 *
 * # Why this read exists at all, and it is a debt item 5 created
 *
 * `createRollWithCandidates` already inherits the parent roll's `path` and
 * `wardrobeLine` inside its own transaction, and that statement stays the
 * authority for what is WRITTEN. It cannot help the PROMPT: the eight prompts
 * are composed before the transaction opens, so once the wardrobe line reaches
 * the roll prompt, a follow would be PAINTED in a freshly resolved outfit and
 * RECORDED in the parent's — eight pictures disagreeing with the row that
 * describes them, and then six signed views judged against a line they were
 * never painted in. That is the refunded-slices class condition (v) exists for,
 * arriving through the one door condition (v) does not cover.
 *
 * # The BORN column, by name, and this is the one caller allowed it
 *
 * `wardrobeLine.ts`'s header names exactly one exception to
 * `currentWardrobeLine`: the Follow, because a Follow deliberately wants the
 * SHEET's outfit rather than this person's. An edited look stays on the person
 * it was made for — *a momentary choice made permanent for eight strangers* is
 * the sentence `refineSubjects.ts` already uses about `expression`.
 *
 * Joined THROUGH the owned candidate so the roll is re-proved to belong to this
 * user in the same statement that finds it (invariant 1), exactly as
 * `getBriefForOwnedCandidate` above — a caller holding a candidate id cannot
 * reach a stranger's sheet through this.
 */
export type OwnedRollWardrobe = {
  path: CastingPath | null;
  wardrobeLine: string | null;
};

export async function getRollWardrobeForOwnedCandidate(
  userId: number,
  candidatePublicId: string,
): Promise<OwnedRollWardrobe | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [row] = await db
    .select({
      path: castingRolls.path,
      wardrobeLine: castingRolls.wardrobeLine,
    })
    .from(castingCandidates)
    .innerJoin(castingRolls, and(
      eq(castingRolls.id, castingCandidates.rollId),
      eq(castingRolls.userId, userId),
    ))
    .where(and(
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
    ))
    .limit(1);
  if (!row) return null;
  return { path: row.path ?? null, wardrobeLine: row.wardrobeLine ?? null };
}

/**
 * The cross-roll tray: kept candidates of one session, oldest keep first.
 *
 * **`signed` is excluded, and that is the plan's own law** (§F Shortlist:
 * "signing removes nothing from the tray except the signed candidate, which
 * becomes the Cast"). It was never implemented, and the cost was two visible
 * defects: a spent candidate sat in the tray offering to be signed again, and
 * the sheet card's preview — which prefers kept faces — went blank after a
 * Sign, because the only kept face was no longer projectable.
 *
 * Her row is NOT deleted: it stays as the Cast's lineage, and her kept siblings
 * stay protected from retention while the Cast lives (§G.6). She simply stops
 * being a thing this sheet is still deciding about.
 */
export async function listKeptCandidates(
  userId: number,
  sessionId: number,
): Promise<CandidateWithFace[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(sessionId, "sessionId");
  const db = await requireDb();
  const rows = await db
    .select({
      candidate: castingCandidates,
      variantPublicId: castingCandidateVariants.publicId,
      variantImageKey: castingCandidateVariants.imageKey,
      variantThumbKey: castingCandidateVariants.thumbKey,
    })
    .from(castingCandidates)
    // The tray shows faces, and a face is the selected one — same join, same
    // owner scoping, same reason as `listRollCandidates`.
    .leftJoin(castingCandidateVariants, and(
      eq(castingCandidateVariants.id, castingCandidates.selectedVariantId),
      eq(castingCandidateVariants.userId, userId),
      eq(castingCandidateVariants.candidateId, castingCandidates.id),
      eq(castingCandidateVariants.status, "ready"),
    ))
    .where(and(
      eq(castingCandidates.sessionId, sessionId),
      eq(castingCandidates.userId, userId),
      isNotNull(castingCandidates.keptAt),
      eq(castingCandidates.status, "ready"),
    ))
    .orderBy(asc(castingCandidates.keptAt));
  return rows.map((row) => ({
    ...row.candidate,
    selectedVariantPublicId: row.variantPublicId,
    faceImageKey: row.variantPublicId ? row.variantImageKey : row.candidate.imageKey,
    faceThumbKey: row.variantPublicId ? row.variantThumbKey : row.candidate.thumbKey,
  }));
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
 * The user's own disposal of exploratory work — and until 2026-08-02 it did
 * almost nothing.
 *
 * **The bug this closes.** It wrote `status = 'abandoned'` and stopped, while
 * `listExpiredSessions` selected `status = 'open'` past its expiry. So a sheet
 * the user deleted was never swept: its candidates stayed `ready`, the purge
 * requires `expired`, and the objects lived in the bucket forever. This comment
 * previously claimed the opposite — "everything downstream is the machinery
 * that already exists" — which is how it survived review. The intent was
 * written down and the wire was never connected: invariant 7, in the one place
 * that promised it was fine.
 *
 * **The release now runs INLINE, in the same transaction as the status change.**
 * Not by widening the sweep, which looked cheaper and is wrong twice over: an
 * abandoned sheet's `expiresAt` is whatever the last activity set, so the purge
 * would be deferred up to seven days after the user asked for it; and
 * `markSessionExpired` only transitions from `open`, so the sweep would
 * re-select every abandoned sheet on every 60-second tick, forever, eventually
 * crowding real expiries out of its own row limit.
 *
 * `abandoned` stays a DISTINCT terminal status. That row is the only record of
 * whether the user deleted this sheet or it aged out, and support answers those
 * two questions differently.
 *
 * Owner-scoped in the statement (invariant 1), and only from `open`: a sheet
 * that already expired is not abandoned twice, and the CAS is what makes the
 * candidate release run exactly once.
 */
export async function abandonCastingSession(input: {
  userId: number;
  sessionPublicId: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  return withTransaction(async (tx) => {
    const [session] = await tx
      .select({ id: castingSessions.id })
      .from(castingSessions)
      .where(and(
        eq(castingSessions.publicId, input.sessionPublicId),
        eq(castingSessions.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!session) return false;

    const result = await tx
      .update(castingSessions)
      .set({ status: "abandoned" })
      .where(and(
        eq(castingSessions.id, session.id),
        eq(castingSessions.userId, input.userId),
        eq(castingSessions.status, "open"),
      ));
    if (affectedRows(result) !== 1) return false;

    /*
      The §G.6 carve-outs, verbatim and shared: a signed candidate survives, and
      so do the kept siblings of a Cast this sheet produced. Everything else is
      released for the purge feed. The session row is already locked above,
      which is the same serialization point the Sign ceremony takes — so a Sign
      cannot land between the status change and the release and have its
      siblings expired out from under it.
    */
    await expireSessionCandidatesIn(tx, { sessionId: session.id, userId: input.userId });
    return true;
  });
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
  return withTransaction((tx) => expireSessionCandidatesIn(tx, input));
}

/**
 * The same release, inside a caller's transaction.
 *
 * Split out so **abandoning a sheet can run it inline** rather than hoping a
 * sweep picks the sheet up later — which it never did (see
 * `abandonCastingSession`). One body, one set of §G.6 carve-outs, two callers;
 * a second implementation that had to agree with this one is exactly the shape
 * the retention law does not survive.
 */
export async function expireSessionCandidatesIn(
  tx: TransactionHandle,
  input: { sessionId: number; userId: number },
): Promise<number> {
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
  {
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
  }
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

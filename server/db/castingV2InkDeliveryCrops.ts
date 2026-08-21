/**
 * THE DELIVERED-TATTOO STORE'S DATABASE HALF — migrations 0049 and 0050,
 * countersigned fable-1194 §2 and re-keyed by fable-1197 §1.
 *
 * One row is the frame that delivered ink onto a Cast at one placement, cut
 * down to the tattoo as it sits on her, and where OUR copy of that cut lives.
 * It is what the carry lane sends instead of the customer's artwork, and the
 * whole reason is in 0049's header: the artwork has no size in it and the
 * master has no tattoo on it, so a carry told to keep "the same size" had
 * nothing to measure and put the design on his shirt three times out of three.
 *
 * # A ROW IS A DELIVERY, AND IT IS NOT ALWAYS A DESIGN
 *
 * D-137's words road paints real ink from the customer's own sentence with no
 * design row anywhere. That delivery is as real as any other and carries the
 * same way, so `designId` is PROVENANCE here rather than key: present on the
 * picture road, NULL on the words road, and never part of what a row is found
 * by. The chain names the crop's own `publicId` instead.
 *
 * # Three rules, and two of them are somebody's scar
 *
 * 1. **The owner is in the statement that writes** (invariant 1). The
 *    candidate, the design and the variant are all re-proved against
 *    `userId` inside the transaction that inserts, and every id written into
 *    the row is taken from a row just proved rather than from a number a
 *    caller passed.
 * 2. **MINTED ONCE is the database's rule, not this file's.** There is no
 *    read-then-insert here and deliberately no update: the insert runs and a
 *    duplicate on `uq_casting_ink_delivery_crops_delivery` comes back as
 *    `already`, which is a fact rather than an error. A check-then-write would
 *    be the race invariant 1 exists about, and a rule enforced by a writer is
 *    a rule the next writer does not inherit. Since 0050 the key is the
 *    DELIVERY — (candidateId, variantId, slot) — so the rule reads *once per
 *    delivering frame*, which is what the mint's never-on-a-carry condition
 *    already enforces one layer up.
 * 3. **The manifest is discharged in the transaction that files the row.** The
 *    bytes go to a permanently public key BEFORE this runs, registered for
 *    cleanup first and released here — a crash in between collects itself. The
 *    ink design store's own rule, for the same reason: on this road the litter
 *    would be a picture of a real person's neck.
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers at the bottom take a transaction handle because they run
 * inside the candidate sweep's own transaction. A delivered crop's lifetime is
 * its Cast's, unconditionally — no flag governs whether it is purged, and the
 * sweep clause lands in the same commit as the writer rather than after it.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

import {
  castingCandidateVariants,
  castingCandidates,
  castingInkDeliveryCrops,
  castingInkDesigns,
  storageCleanupBatches,
  storageCleanupItems,
} from "../../drizzle/schema";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { undischargedStorageCleanupBatchWhere } from "./storageCleanup";

/**
 * The shape this product mints for a public name — `randomUUID`, and the same
 * fence `inkApplied`'s reader keeps one layer up, for the same reason: this
 * value crosses a JSON boundary on its way here, and *"it can only have come
 * from us"* is the sentence that precedes every input-validation incident.
 */
const CROP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

/**
 * IS THIS THE UNIQUE INDEX SAYING NO? — asked of the WHOLE CHAIN.
 *
 * Read off the driver's own code rather than off the message text, which is
 * localized and versioned. Anything else is re-thrown: a mint that swallowed a
 * connection error as "already minted" would report a crop that does not exist,
 * and the carry would fall back to the artwork with nothing in the log to say
 * why.
 *
 * ⚠ **THE CHAIN WALK IS THE WHOLE OF IT, and this file shipped without it.**
 * Drizzle wraps the driver's error in a `DrizzleQueryError` and hangs the
 * original off `cause`, so a top-level `error.code` read never matches and the
 * duplicate escapes as a throw — the mint then reports `failed` over a
 * perfectly working index. Driven live on the second delivery of one design
 * (variant `486` after `492`): expected `already`, got `failed / threw`.
 *
 * EXPORTED so both shapes can be driven without a database — the arm that was
 * missing is the arm that would have caught it, and one that can only run
 * through a live insert is one nobody runs.
 *
 * It is the SAME MISTAKE `candidateRetention.isMissingTable` made and wrote
 * down — *"the first version read `error.code` off the top-level error, which
 * is the shape a hand-written test error has and NOT the shape the real path
 * produces"* — and the reason it repeated is that the arm was written with an
 * invented error, so the invention was what got tested. Both shapes are
 * asserted now.
 */
export function isDuplicateKey(error: unknown): boolean {
  for (let link: unknown = error, depth = 0; link && depth < 5; depth += 1) {
    const { code, errno, cause } = link as { code?: string; errno?: number; cause?: unknown };
    if (code === "ER_DUP_ENTRY" || errno === 1062) return true;
    link = cause;
  }
  return false;
}

/** The Cast, the design or the frame is not this account's. */
export class InkDeliveryCropOwnershipError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "InkDeliveryCropOwnershipError";
  }
}

export type InkDeliveryCropToRecord = {
  userId: number;
  candidatePublicId: string;
  /**
   * THE NAME THE CHAIN ALREADY GAVE THIS CROP — pre-allocated by the caller
   * before the render, ruled fable-1199 §1.
   *
   * Not generated here, and the reason is a sequencing fact rather than a
   * preference: the delta is written at CLAIM time and no path amends it
   * afterwards (`landVariant` takes an `internalPrompt` and no deltas), while
   * this row is only minted once the frame exists. So the chain names the crop
   * before the crop exists, and this writer is handed the name to honour.
   *
   * The case where the mint never happens — `no-cut`, `failed` — leaves the
   * chain naming a row that is not there, and that is this path's oldest law
   * rather than a new hole: THE ID POINTS AND THE ROW DECIDES, the same
   * sentence `inkApplied` was written under for a design the customer has since
   * deleted. The carry side skips it loudly.
   */
  publicId: string;
  /**
   * The design that was delivered, by the name the chain carries — or ABSENT on
   * D-137's words road, where the ink came out of her own sentence and there is
   * no design row anywhere (migration 0050).
   */
  designPublicId?: string;
  /** The frame it was cut from, by the name the ledger carries. */
  variantPublicId: string;
  slot: string;
  /** The segmentation question that drew the cut. */
  region: string;
  storageKey: string;
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  frameWidth: number;
  frameHeight: number;
  maskPixels: number;
  keptPixels: number;
  /** The manifest holding these bytes until a row points at them. */
  cleanupBatchId?: string;
};

export type InkDeliveryCropRecorded =
  /** Written. The bytes are now a row's and the manifest is discharged. */
  | { outcome: "minted"; publicId: string }
  /**
   * The unique index refused it: this frame already has its delivery crop at
   * this placement, and MINTED ONCE means the first one stands.
   *
   * **The manifest is NOT discharged in this case**, and that is the design:
   * nothing points at the bytes just written, so they must remain the cleanup
   * worker's — discharging would strand a picture of a person at a public key
   * with no row naming it.
   */
  | { outcome: "already" };

/**
 * Keep the crop this render's delivery earned.
 *
 * Never called on a carry render — the caller decides that, and the reason is
 * fable-1193 §3b's chained-anchor trap — but the index means a caller that got
 * it wrong writes nothing rather than a copy of a copy.
 */
export async function recordInkDeliveryCrop(
  input: InkDeliveryCropToRecord,
): Promise<InkDeliveryCropRecorded> {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new Error("userId must be a positive integer");
  }
  /*
    The name is the CALLER'S, and it is checked rather than trusted: it is
    written into the chain a hundred lines before it reaches here, and a row
    whose `publicId` is not the shape this product mints is a row the carry can
    never look up. Refused loudly here because the caller catches — a bad name
    costs a crop, never a picture.
  */
  if (!CROP_ID.test(input.publicId.trim())) {
    throw new Error("publicId must be the uuid the chain named");
  }
  const publicId = input.publicId.trim();

  return withTransaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: castingCandidates.id })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.publicId, input.candidatePublicId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1);
    if (!candidate) throw new InkDeliveryCropOwnershipError("candidate");

    /* The design is re-proved on BOTH sides of its own join — this account AND
       this Cast — so a design id from another of her Casts cannot file a
       delivery against this one.

       Skipped entirely, never loosened, when there is no design: D-137's words
       road delivers real ink with no design row anywhere, and a lookup of
       nothing is not a weaker check but a different fact. The column that
       records it is nullable for that one case (migration 0050), and NULL here
       means painted-from-words rather than unproven. */
    const design = input.designPublicId === undefined
      ? null
      : (await tx
        .select({ id: castingInkDesigns.id })
        .from(castingInkDesigns)
        .where(and(
          eq(castingInkDesigns.publicId, input.designPublicId),
          eq(castingInkDesigns.userId, input.userId),
          eq(castingInkDesigns.candidateId, candidate.id),
        ))
        .limit(1))[0] ?? undefined;
    if (design === undefined) throw new InkDeliveryCropOwnershipError("design");

    /* And the frame, scoped through the candidate it belongs to: a crop
       claiming to come from somebody else's render would be geometry about a
       picture this Cast has never seen. */
    const [variant] = await tx
      .select({ id: castingCandidateVariants.id })
      .from(castingCandidateVariants)
      .where(and(
        eq(castingCandidateVariants.publicId, input.variantPublicId),
        eq(castingCandidateVariants.candidateId, candidate.id),
      ))
      .limit(1);
    if (!variant) throw new InkDeliveryCropOwnershipError("variant");

    try {
      await tx.insert(castingInkDeliveryCrops).values({
        publicId,
        userId: input.userId,
        candidateId: candidate.id,
        designId: design === null ? null : design.id,
        variantId: variant.id,
        slot: input.slot,
        region: input.region,
        storageKey: input.storageKey,
        digest: input.digest,
        mime: input.mime,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        bboxX: input.bboxX,
        bboxY: input.bboxY,
        bboxW: input.bboxW,
        bboxH: input.bboxH,
        frameWidth: input.frameWidth,
        frameHeight: input.frameHeight,
        maskPixels: input.maskPixels,
        keptPixels: input.keptPixels,
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { outcome: "already" } as const;
      throw error;
    }

    if (input.cleanupBatchId) {
      await tx.delete(storageCleanupItems)
        .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
      const removed = await tx.delete(storageCleanupBatches).where(and(
        eq(storageCleanupBatches.id, input.cleanupBatchId),
        eq(storageCleanupBatches.userId, input.userId),
        undischargedStorageCleanupBatchWhere(),
      ));
      if (affectedRows(removed) !== 1) throw new InkDeliveryCropOwnershipError("crop");
    }

    return { outcome: "minted", publicId } as const;
  });
}

export type StoredInkDeliveryCrop = {
  /**
   * THE NAME THE CHAIN NAMES — this crop's own `publicId`, and what the carry
   * matches on since 0050.
   *
   * It matched on (design, slot) before, which stopped being the row's key the
   * day a words-only delivery had no design to be keyed by. Matching on less
   * than the thing is keyed by is `uniqueness-proves-the-key`, and this is the
   * repair rather than a second spelling of it.
   */
  publicId: string;
  /**
   * The design this crop is OF, by the name the chain's `inkApplied` carries —
   * or NULL when the ink was painted from her words and there is no design.
   *
   * Provenance for a reader, never the thing the crop is found by.
   */
  designPublicId: string | null;
  slot: string;
  storageKey: string;
  digest: string;
  width: number;
  height: number;
};

/**
 * Every delivered-tattoo crop on this Cast — owner-scoped in the read itself,
 * and joined to the design so the caller can see the name the chain holds
 * rather than an internal id it has no business seeing.
 *
 * **A LEFT join, and that is the words road's whole seat at this table.** An
 * inner join here would silently drop every crop with no design — which is
 * every words-only delivery, which is the lane this store was extended for.
 * The join CONDITION is unchanged and still proves both keys.
 *
 * An explicit projection (invariant 8): the geometry stays in the row. It is
 * evidence for somebody re-reading a delivery, and the carry needs the name,
 * the key and the digest and nothing else.
 */
export async function listInkDeliveryCrops(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<readonly StoredInkDeliveryCrop[]> {
  const db = await requireDb();
  const projection: Record<keyof StoredInkDeliveryCrop, AnyMySqlColumn> = {
    publicId: castingInkDeliveryCrops.publicId,
    designPublicId: castingInkDesigns.publicId,
    slot: castingInkDeliveryCrops.slot,
    storageKey: castingInkDeliveryCrops.storageKey,
    digest: castingInkDeliveryCrops.digest,
    width: castingInkDeliveryCrops.width,
    height: castingInkDeliveryCrops.height,
  };
  return ownedCropsOf<StoredInkDeliveryCrop>(db, projection, input);
}

/**
 * ONE OWNER FOR THE OWNERSHIP STATEMENT — the joins and the `WHERE`, shared by
 * every read of this table that answers *"this account's crops on this Cast"*.
 *
 * There are two such reads now (the carry's, and the panel's below) and they
 * differ ONLY in their projection, which is invariant 8's whole shape: an
 * explicit projection per caller, over one scoping statement. Copying the three
 * `eq`s into the second reader would be the thing invariant 1 is written
 * against — a second place for the owner check to be got wrong, and it would go
 * wrong silently, since a read that forgets `userId` returns MORE rows rather
 * than failing.
 *
 * The design is joined ON THE CANDIDATE as well as on the id, so the row's own
 * two keys have to agree before a crop can be named — the ink-design route's
 * both-sides rule, one store along. LEFT, because a words-only delivery has no
 * design and must not be dropped by its own absence.
 */
function ownedCropsOf<R>(
  db: Awaited<ReturnType<typeof requireDb>>,
  /*
    THE PROJECTION IS TYPED AT ITS CALL SITE, NOT HERE (see both callers): each
    is declared `Record<keyof R, AnyMySqlColumn>`, which makes excess-property
    checking refuse a column the result type does not declare AND refuse a
    declared field the projection forgets. That is what makes the one cast below
    safe in both directions — without it, a column added to the projection and
    not to the type would arrive as an untyped extra, and a field dropped from
    the projection would read `undefined` at runtime while typechecking clean.
  */
  projection: Record<string, AnyMySqlColumn>,
  input: { userId: number; candidatePublicId: string },
): Promise<R[]> {
  return db
    .select(projection as never)
    .from(castingInkDeliveryCrops)
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDeliveryCrops.candidateId))
    .leftJoin(castingInkDesigns, and(
      eq(castingInkDesigns.id, castingInkDeliveryCrops.designId),
      eq(castingInkDesigns.candidateId, castingInkDeliveryCrops.candidateId),
    ))
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
      eq(castingInkDeliveryCrops.userId, input.userId),
    )) as unknown as Promise<R[]>;
}

/**
 * WHERE EACH DELIVERED TATTOO SITS ON HER — the panel's own projection
 * (1246/1248's ink row).
 *
 * # Why this is a second projection and not a widened first one
 *
 * The read above deliberately drops the geometry, and its docblock says why:
 * the carry needs the name, the key and the digest and nothing else. Handing it
 * six more columns to satisfy a different caller is how a projection stops
 * describing what its caller needs. So: same table, same scoping statement,
 * different explicit projection — invariant 8 as written.
 *
 * # It is the ONLY source that can answer the question
 *
 * A delivery crop's six geometry columns (migration 0049) are the tattoo's box
 * IN THE FRAME IT WAS DELIVERED IN, which is exactly the panel's `PanelBox`.
 * The alternative pointer a chain carries — `inkApplied`, slot to DESIGN — can
 * only reach `casting_ink_designs`, whose `width`/`height` are the size of the
 * ARTWORK and say nothing about where it landed on her. Deriving the row from
 * the design would be a box invented from the wrong measurement (law 4, and the
 * wrong-boundary class this repo has paid for four times).
 *
 * # The words-born lane needs no branch
 *
 * `designId` is nullable and the join is LEFT, so a tattoo painted from her
 * words alone — no design row anywhere — carries its box here exactly as a
 * reference-born one does. One source, both lanes, which is what let 1248 §2
 * say *"a words-born tattoo's crop carries its box the same way"*.
 */
export type InkDeliveryPlacement = {
  publicId: string;
  slot: string;
  /** The placement word the row was minted under — `neck`, `upperArm`… */
  region: string;
  storageKey: string;
  /** The box in the delivered frame, and the frame it was measured against. */
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  frameWidth: number;
  frameHeight: number;
};

export async function listInkDeliveryPlacements(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<readonly InkDeliveryPlacement[]> {
  const db = await requireDb();
  const projection: Record<keyof InkDeliveryPlacement, AnyMySqlColumn> = {
    publicId: castingInkDeliveryCrops.publicId,
    slot: castingInkDeliveryCrops.slot,
    region: castingInkDeliveryCrops.region,
    storageKey: castingInkDeliveryCrops.storageKey,
    bboxX: castingInkDeliveryCrops.bboxX,
    bboxY: castingInkDeliveryCrops.bboxY,
    bboxW: castingInkDeliveryCrops.bboxW,
    bboxH: castingInkDeliveryCrops.bboxH,
    frameWidth: castingInkDeliveryCrops.frameWidth,
    frameHeight: castingInkDeliveryCrops.frameHeight,
  };
  return ownedCropsOf<InkDeliveryPlacement>(db, projection, input);
}

/**
 * Every crop object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a crop minted between the read and the delete cannot slip
 * through and outlive the Cast it was cut for.
 */
export async function listPurgeableInkDeliveryCropsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  return tx
    .select({ id: castingInkDeliveryCrops.id, storageKey: castingInkDeliveryCrops.storageKey })
    .from(castingInkDeliveryCrops)
    .where(inArray(castingInkDeliveryCrops.candidateId, [...candidateIds]));
}

export async function deleteInkDeliveryCropRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingInkDeliveryCrops)
    .where(inArray(castingInkDeliveryCrops.candidateId, [...candidateIds]));
  return affectedRows(result);
}

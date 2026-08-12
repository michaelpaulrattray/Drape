/**
 * R7-5B storage-cleanup manifest persistence.
 *
 * These helpers are deliberately not routed and never call storage. R7-5C
 * creates a manifest inside its deletion transaction; R7-5D later owns the
 * lease/worker state machine.
 */
import { and, asc, eq, inArray, isNull, lte, notExists, or, sql } from "drizzle-orm";
import {
  castingEvidenceIngestions,
  generationOperations,
  storageCleanupBatches,
  storageCleanupItems,
  type StorageCleanupBatch,
  type StorageCleanupItem,
} from "../../drizzle/schema";
import type { TransactionHandle } from "./connection";
import { getDb, withTransaction } from "./connection";
import { DEFAULT_GENERATION_OPERATION_LEASE_MS } from "./generationOperations";
import {
  buildStorageCleanupManifest,
  assertStorageCleanupCounts,
  type StorageCleanupManifest,
} from "../casting/storageCleanupContract";

export interface ClaimedStorageCleanupBatch {
  batch: StorageCleanupBatch;
  leaseToken: string;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

/**
 * How long a manifest holds itself while its writer is still writing.
 *
 * DERIVED, not chosen: it is the same lease an in-flight generation operation
 * holds, which is already this program's sized answer to "how long may a unit in
 * flight keep its claim". One constant, one meaning — a writer that outlives it
 * is a latency finding, not an argument for a longer hold.
 */
export const STORAGE_CLEANUP_MANIFEST_HOLD_MS = DEFAULT_GENERATION_OPERATION_LEASE_MS;

/** The instant a manifest born now stops holding itself. */
export function storageCleanupManifestHeldUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + STORAGE_CLEANUP_MANIFEST_HOLD_MS);
}

/**
 * The batch is still exactly as its writer left it — nothing has swept it.
 *
 * `pending` is the plain case: born unheld, never claimed. `processing` with NO
 * lease token AND NO `attemptedAt` is a BORN HELD manifest the worker has never
 * touched — `claimNextStorageCleanupBatch` stamps both on every claim, and
 * `finalizeStorageCleanupBatch` can leave a batch `processing` with a null token
 * but never with a null `attemptedAt`. So the null attempt is the claim's own
 * absence, and not a state any swept batch can return to.
 *
 * Shared rather than restated at each discharge: three writers hold their
 * manifests this way, and three copies of this predicate would be three chances
 * for one of them to drift into accepting a batch the worker is deleting.
 */
export function undischargedStorageCleanupBatchWhere() {
  return or(
    eq(storageCleanupBatches.status, "pending"),
    and(
      eq(storageCleanupBatches.status, "processing"),
      isNull(storageCleanupBatches.leaseToken),
      isNull(storageCleanupBatches.attemptedAt),
    ),
  );
}

export async function createStorageCleanupManifestIn(
  tx: TransactionHandle,
  input: Parameters<typeof buildStorageCleanupManifest>[0] & {
    /**
     * BORN HELD — the instant this manifest stops holding itself.
     *
     * A writer that registers a manifest BEFORE writing the bytes it names is
     * protected from its own cleanup worker only by the in-flight fence, and
     * that fence tests the batch's `operationId` against a live operation row.
     * The writers that carry a SYNTHETIC operation id match no operation, so the
     * fence passes trivially and the manifest is claimable the instant it is
     * written — while the writer is still encoding and storing. That race really
     * fired: it deleted a delivered feature's crop mid-mint, and the render's
     * rows were then correctly refused because their bytes were being deleted.
     *
     * Passing a hold makes the batch unclaimable until it expires, in the state
     * machine the worker already speaks — no schema change, no new worker rule.
     * If the writer dies, the hold lapses and the worker collects it exactly as
     * it does today, so the failure path still collects itself.
     */
    heldUntil?: Date | null;
  },
): Promise<StorageCleanupManifest> {
  const manifest = buildStorageCleanupManifest(input);
  const heldUntil = input.heldUntil ?? null;
  await tx.insert(storageCleanupBatches).values({
    id: manifest.id,
    userId: manifest.userId,
    operationId: manifest.operationId,
    kind: manifest.kind,
    status: heldUntil ? "processing" : "pending",
    leaseExpiresAt: heldUntil,
    expectedCount: manifest.expectedCount,
    deletedCount: 0,
    failedCount: 0,
  });
  if (manifest.storageItems.length > 0) {
    await tx.insert(storageCleanupItems).values(
      manifest.storageItems.map((item) => ({
        batchId: manifest.id,
        storageKey: item.storageKey,
        storageBackend: item.storageBackend,
        status: "pending" as const,
        attempts: 0,
      })),
    );
  }
  return manifest;
}

/**
 * Reserve one exact candidate key under the operation's single cleanup
 * batch. Evidence package retries and multi-view requests append to that
 * locked batch rather than creating conflicting per-attempt batches.
 */
export async function reserveStorageCleanupItemForOperation(input: {
  userId: number;
  operationId: string;
  /* `casting_diagnostic_cleanup` (0024) reserves refused-render frames. It
     shares this path deliberately: the appendable-batch-per-operation shape is
     exactly right for a capture that writes several frames for one refusal. */
  kind: "candidate_cleanup" | "casting_diagnostic_cleanup";
  storageKey: string;
  storageBackend: "public_r2" | "private_evidence_r2";
}): Promise<string> {
  return withTransaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.userId, input.userId),
        eq(storageCleanupBatches.operationId, input.operationId),
      ))
      .limit(1)
      .for("update");
    if (!existing) {
      const manifest = await createStorageCleanupManifestIn(tx, {
        userId: input.userId,
        operationId: input.operationId,
        kind: input.kind,
        storageItems: [{
          storageKey: input.storageKey,
          storageBackend: input.storageBackend,
        }],
      });
      return manifest.id;
    }
    if (
      existing.kind !== input.kind
      || existing.status !== "pending"
      || existing.deletedCount !== 0
      || existing.failedCount !== 0
      || existing.leaseToken !== null
    ) {
      throw new Error("Storage-cleanup reservation is not appendable");
    }
    await tx.insert(storageCleanupItems).values({
      batchId: existing.id,
      storageKey: input.storageKey,
      storageBackend: input.storageBackend,
      status: "pending",
      attempts: 0,
    });
    const incremented = await tx
      .update(storageCleanupBatches)
      .set({
        expectedCount: sql`${storageCleanupBatches.expectedCount} + 1`,
      })
      .where(and(
        eq(storageCleanupBatches.id, existing.id),
        eq(storageCleanupBatches.status, "pending"),
        eq(storageCleanupBatches.expectedCount, existing.expectedCount),
      ));
    if (affectedRows(incremented) !== 1) {
      throw new Error("Storage-cleanup reservation count changed");
    }
    return existing.id;
  });
}

/**
 * Consume exact reserved keys after they were either deleted or atomically
 * adopted as canonical. Any other pending keys remain durably owned by the
 * same batch for the cleanup worker.
 */
export async function consumeStorageCleanupReservationsIn(
  tx: TransactionHandle,
  input: {
    batchId: string;
    userId: number;
    operationId: string;
    kind: "candidate_cleanup";
    storageItems: Array<{
      storageKey: string;
      storageBackend: "public_r2" | "private_evidence_r2";
    }>;
  },
): Promise<void> {
  const unique = new Map(
    input.storageItems.map((item) => [
      `${item.storageBackend}:${item.storageKey}`,
      item,
    ]),
  );
  if (unique.size !== input.storageItems.length || unique.size === 0) {
    throw new Error("Storage-cleanup consumption is invalid");
  }
  const [batch] = await tx
    .select()
    .from(storageCleanupBatches)
    .where(and(
      eq(storageCleanupBatches.id, input.batchId),
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.operationId, input.operationId),
      eq(storageCleanupBatches.kind, input.kind),
      eq(storageCleanupBatches.status, "pending"),
    ))
    .limit(1)
    .for("update");
  if (
    !batch
    || batch.deletedCount !== 0
    || batch.failedCount !== 0
    || batch.leaseToken !== null
  ) {
    throw new Error("Storage-cleanup reservation is invalid");
  }
  const allItems = await tx
    .select()
    .from(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, batch.id))
    .orderBy(asc(storageCleanupItems.id))
    .for("update");
  if (allItems.length !== batch.expectedCount) {
    throw new Error("Storage-cleanup reservation count is invalid");
  }
  const consumed = allItems.filter((item) =>
    unique.has(`${item.storageBackend}:${item.storageKey}`)
    && item.status === "pending"
  );
  if (consumed.length !== unique.size) {
    throw new Error("Storage-cleanup reservation item is invalid");
  }
  const removed = await tx
    .delete(storageCleanupItems)
    .where(and(
      eq(storageCleanupItems.batchId, batch.id),
      inArray(storageCleanupItems.id, consumed.map((item) => item.id)),
      eq(storageCleanupItems.status, "pending"),
    ));
  if (affectedRows(removed) !== consumed.length) {
    throw new Error("Storage-cleanup reservation item changed");
  }
  const remaining = allItems.length - consumed.length;
  if (remaining === 0) {
    const removedBatch = await tx
      .delete(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, batch.id),
        eq(storageCleanupBatches.status, "pending"),
        eq(storageCleanupBatches.expectedCount, batch.expectedCount),
      ));
    if (affectedRows(removedBatch) !== 1) {
      throw new Error("Storage-cleanup reservation batch changed");
    }
    return;
  }
  const updated = await tx
    .update(storageCleanupBatches)
    .set({ expectedCount: remaining })
    .where(and(
      eq(storageCleanupBatches.id, batch.id),
      eq(storageCleanupBatches.status, "pending"),
      eq(storageCleanupBatches.expectedCount, batch.expectedCount),
    ));
  if (affectedRows(updated) !== 1) {
    throw new Error("Storage-cleanup reservation count changed");
  }
}

export async function releaseStorageCleanupReservation(input: {
  batchId: string;
  userId: number;
  operationId: string;
  kind: "candidate_cleanup";
  storageKey: string;
  storageBackend: "public_r2" | "private_evidence_r2";
}): Promise<void> {
  await withTransaction((tx) =>
    consumeStorageCleanupReservationsIn(tx, {
      batchId: input.batchId,
      userId: input.userId,
      operationId: input.operationId,
      kind: input.kind,
      storageItems: [{
        storageKey: input.storageKey,
        storageBackend: input.storageBackend,
      }],
    })
  );
}

export async function getStorageCleanupBatchByOperation(
  userId: number,
  operationId: string,
): Promise<StorageCleanupBatch | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [batch] = await db
    .select()
    .from(storageCleanupBatches)
    .where(and(
      eq(storageCleanupBatches.userId, userId),
      eq(storageCleanupBatches.operationId, operationId),
    ))
    .limit(1);
  return batch ?? null;
}

export async function getStorageCleanupItemsForBatch(
  batchId: string,
): Promise<StorageCleanupItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, batchId))
    .orderBy(asc(storageCleanupItems.id));
}

/** Claim one due batch. An expired lease is the only crash-recovery signal;
 * item rows left processing by the old owner are returned to pending. */
export async function claimNextStorageCleanupBatch(input: {
  leaseToken: string;
  now: Date;
  leaseExpiresAt: Date;
  privateEvidenceAvailable?: boolean;
}): Promise<ClaimedStorageCleanupBatch | null> {
  return withTransaction(async (tx) => {
    const privateEvidenceFence = () => input.privateEvidenceAvailable
      ? undefined
      : notExists(
        tx
          .select({ one: sql`1` })
          .from(storageCleanupItems)
          .where(and(
            eq(storageCleanupItems.batchId, storageCleanupBatches.id),
            eq(storageCleanupItems.storageBackend, "private_evidence_r2"),
          )),
      );
    const inFlightOperationFence = () => notExists(
      tx
        .select({ one: sql`1` })
        .from(generationOperations)
        .where(and(
          eq(generationOperations.id, storageCleanupBatches.operationId),
          inArray(generationOperations.status, ["claimed", "running"]),
        )),
    );
    const [batch] = await tx
      .select()
      .from(storageCleanupBatches)
      .where(and(
        or(
          eq(storageCleanupBatches.status, "pending"),
          and(
            eq(storageCleanupBatches.status, "processing"),
            or(
              isNull(storageCleanupBatches.leaseExpiresAt),
              lte(storageCleanupBatches.leaseExpiresAt, input.now),
            ),
          ),
        ),
        // Without the private adapter, keep private and mixed batches wholly
        // pending without attempt burn or wrong-bucket false success.
        privateEvidenceFence(),
        // A Fork commits cleanup authority before it starts copying. Keep that
        // manifest held at the durable claim boundary until the owning
        // operation succeeds, fails, or becomes recovery-required.
        inFlightOperationFence(),
      ))
      .orderBy(asc(storageCleanupBatches.createdAt))
      .limit(1)
      .for("update");
    if (!batch) return null;
    const claimed = await tx
      .update(storageCleanupBatches)
      .set({
        status: "processing",
        leaseToken: input.leaseToken,
        leaseExpiresAt: input.leaseExpiresAt,
        heartbeatAt: input.now,
        attemptedAt: input.now,
      })
      .where(and(
        eq(storageCleanupBatches.id, batch.id),
        or(
          eq(storageCleanupBatches.status, "pending"),
          and(
            eq(storageCleanupBatches.status, "processing"),
            or(
              isNull(storageCleanupBatches.leaseExpiresAt),
              lte(storageCleanupBatches.leaseExpiresAt, input.now),
            ),
          ),
        ),
        privateEvidenceFence(),
        inFlightOperationFence(),
      ));
    if (affectedRows(claimed) !== 1) return null;
    await tx
      .update(storageCleanupItems)
      .set({ status: "pending", nextAttemptAt: null })
      .where(and(
        eq(storageCleanupItems.batchId, batch.id),
        eq(storageCleanupItems.status, "processing"),
      ));
    return {
      batch: {
        ...batch,
        status: "processing",
        leaseToken: input.leaseToken,
        leaseExpiresAt: input.leaseExpiresAt,
        heartbeatAt: input.now,
        attemptedAt: input.now,
      },
      leaseToken: input.leaseToken,
    };
  });
}

export async function renewStorageCleanupLease(input: {
  batchId: string;
  leaseToken: string;
  now: Date;
  leaseExpiresAt: Date;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const renewed = await db
    .update(storageCleanupBatches)
    .set({ heartbeatAt: input.now, leaseExpiresAt: input.leaseExpiresAt })
    .where(and(
      eq(storageCleanupBatches.id, input.batchId),
      eq(storageCleanupBatches.status, "processing"),
      eq(storageCleanupBatches.leaseToken, input.leaseToken),
    ));
  return affectedRows(renewed) === 1;
}

export async function claimNextStorageCleanupItem(input: {
  batchId: string;
  leaseToken: string;
  now: Date;
}): Promise<(StorageCleanupItem & { attempts: number }) | null> {
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) return null;
    const [item] = await tx
      .select()
      .from(storageCleanupItems)
      .where(and(
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "pending"),
        or(
          isNull(storageCleanupItems.nextAttemptAt),
          lte(storageCleanupItems.nextAttemptAt, input.now),
        ),
      ))
      .orderBy(asc(storageCleanupItems.id))
      .limit(1)
      .for("update");
    if (!item) return null;
    const attempts = item.attempts + 1;
    const claimed = await tx
      .update(storageCleanupItems)
      .set({ status: "processing", attempts, nextAttemptAt: null })
      .where(and(
        eq(storageCleanupItems.id, item.id),
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "pending"),
      ));
    return affectedRows(claimed) === 1 ? { ...item, status: "processing", attempts } : null;
  });
}

export async function settleStorageCleanupItemSuccess(input: {
  batchId: string;
  itemId: number;
  leaseToken: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const [batch] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) throw new Error("Storage-cleanup lease was lost before success settlement");
    const removed = await tx
      .delete(storageCleanupItems)
      .where(and(
        eq(storageCleanupItems.id, input.itemId),
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "processing"),
      ));
    if (affectedRows(removed) !== 1) throw new Error("Storage-cleanup item success lost its state race");
    const incremented = await tx
      .update(storageCleanupBatches)
      .set({ deletedCount: sql`${storageCleanupBatches.deletedCount} + 1` })
      .where(eq(storageCleanupBatches.id, input.batchId));
    if (affectedRows(incremented) !== 1) throw new Error("Storage-cleanup batch count update failed");
  });
}

export async function settleStorageCleanupItemFailure(input: {
  batchId: string;
  itemId: number;
  leaseToken: string;
  errorCode: string;
  retryAt: Date | null;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const [batch] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) throw new Error("Storage-cleanup lease was lost before failure settlement");
    const terminal = input.retryAt === null;
    const settled = await tx
      .update(storageCleanupItems)
      .set({
        status: terminal ? "failed" : "pending",
        nextAttemptAt: input.retryAt,
        lastErrorCode: input.errorCode.slice(0, 64),
      })
      .where(and(
        eq(storageCleanupItems.id, input.itemId),
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "processing"),
      ));
    if (affectedRows(settled) !== 1) throw new Error("Storage-cleanup item failure lost its state race");
  });
}

export async function finalizeStorageCleanupBatch(input: {
  batchId: string;
  leaseToken: string;
  now: Date;
}): Promise<StorageCleanupBatch> {
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) throw new Error("Storage-cleanup lease was lost before batch settlement");
    const items = await tx
      .select()
      .from(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, input.batchId))
      .orderBy(asc(storageCleanupItems.id))
      .for("update");
    const failedCount = items.filter((item) => item.status === "failed").length;
    const unsettled = items.filter((item) => item.status !== "failed");
    if (batch.deletedCount + items.length !== batch.expectedCount) {
      throw new Error("Storage-cleanup manifest count conservation failed");
    }
    const status = unsettled.length > 0
      ? "processing" as const
      : failedCount > 0
        ? (batch.deletedCount > 0 ? "partial" as const : "failed" as const)
        : "succeeded" as const;
    assertStorageCleanupCounts({
      status,
      expectedCount: batch.expectedCount,
      deletedCount: batch.deletedCount,
      failedCount,
    });
    const dueAt = unsettled.reduce<Date | null>((earliest, item) => {
      const candidate = item.nextAttemptAt ?? input.now;
      return !earliest || candidate < earliest ? candidate : earliest;
    }, null);
    const finalized = await tx
      .update(storageCleanupBatches)
      .set({
        status,
        failedCount,
        leaseToken: null,
        leaseExpiresAt: status === "processing" ? dueAt : null,
        heartbeatAt: input.now,
      })
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ));
    if (affectedRows(finalized) !== 1) throw new Error("Storage-cleanup batch settlement lost its state race");
    return {
      ...batch,
      status,
      failedCount,
      leaseToken: null,
      leaseExpiresAt: status === "processing" ? dueAt : null,
      heartbeatAt: input.now,
    };
  });
}

export async function getStorageCleanupHealth(now = new Date()): Promise<{
  pendingBatches: number;
  processingBatches: number;
  succeededBatches: number;
  partialBatches: number;
  failedBatches: number;
  retainedFailedItems: number;
  staleLeases: number;
  plannedEvidenceReceipts: number;
  storedEvidenceReceipts: number;
  cleanupPendingEvidenceReceipts: number;
  failedEvidenceManifests: number;
  pendingPrivateBatches: number;
  oldestNonAttachedEvidenceAgeMs: number | null;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const batches = await db.select({
    id: storageCleanupBatches.id,
    status: storageCleanupBatches.status,
    leaseToken: storageCleanupBatches.leaseToken,
    leaseExpiresAt: storageCleanupBatches.leaseExpiresAt,
  })
    .from(storageCleanupBatches);
  const failedItems = await db.select({ id: storageCleanupItems.id }).from(storageCleanupItems)
    .where(eq(storageCleanupItems.status, "failed"));
  const privateItems = await db
    .select({ batchId: storageCleanupItems.batchId })
    .from(storageCleanupItems)
    .where(eq(storageCleanupItems.storageBackend, "private_evidence_r2"));
  const evidenceReceipts = await db
    .select({
      status: castingEvidenceIngestions.status,
      cleanupBatchId: castingEvidenceIngestions.cleanupBatchId,
      createdAt: castingEvidenceIngestions.createdAt,
    })
    .from(castingEvidenceIngestions)
    .where(inArray(castingEvidenceIngestions.status, [
      "planned",
      "stored",
      "cleanup_pending",
    ]));
  const batchStatusById = new Map(batches.map((batch) => [batch.id, batch.status]));
  const pendingPrivateBatches = new Set(
    privateItems
      .map((item) => item.batchId)
      .filter((batchId) => {
        const status = batchStatusById.get(batchId);
        return status === "pending" || status === "processing";
      }),
  ).size;
  const oldestNonAttached = evidenceReceipts.reduce<Date | null>(
    (oldest, receipt) => !oldest || receipt.createdAt < oldest
      ? receipt.createdAt
      : oldest,
    null,
  );
  return {
    pendingBatches: batches.filter((row) => row.status === "pending").length,
    processingBatches: batches.filter((row) => row.status === "processing").length,
    succeededBatches: batches.filter((row) => row.status === "succeeded").length,
    partialBatches: batches.filter((row) => row.status === "partial").length,
    failedBatches: batches.filter((row) => row.status === "failed").length,
    retainedFailedItems: failedItems.length,
    staleLeases: batches.filter((row) =>
      row.status === "processing"
      && row.leaseToken !== null
      && row.leaseExpiresAt !== null
      && row.leaseExpiresAt <= now
    ).length,
    plannedEvidenceReceipts: evidenceReceipts.filter((row) => row.status === "planned").length,
    storedEvidenceReceipts: evidenceReceipts.filter((row) => row.status === "stored").length,
    cleanupPendingEvidenceReceipts: evidenceReceipts
      .filter((row) => row.status === "cleanup_pending").length,
    failedEvidenceManifests: evidenceReceipts.filter((row) => {
      if (!row.cleanupBatchId) return false;
      const status = batchStatusById.get(row.cleanupBatchId);
      return status === "partial" || status === "failed";
    }).length,
    pendingPrivateBatches,
    oldestNonAttachedEvidenceAgeMs: oldestNonAttached
      ? Math.max(0, now.getTime() - oldestNonAttached.getTime())
      : null,
  };
}

export async function inspectStorageCleanupReconciliation(): Promise<{
  batches: number;
  retainedItems: number;
  countMismatches: number;
  failedCountMismatches: number;
  succeededWithRetainedKeys: number;
  itemsWithoutBatch: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const batches = await db.select().from(storageCleanupBatches);
  const items = await db.select({
    id: storageCleanupItems.id,
    batchId: storageCleanupItems.batchId,
    status: storageCleanupItems.status,
  }).from(storageCleanupItems);
  const byBatch = new Map<string, typeof items>();
  for (const item of items) byBatch.set(item.batchId, [...(byBatch.get(item.batchId) ?? []), item]);
  const known = new Set(batches.map((batch) => batch.id));
  return {
    batches: batches.length,
    retainedItems: items.length,
    countMismatches: batches.filter((batch) =>
      batch.deletedCount + (byBatch.get(batch.id)?.length ?? 0) !== batch.expectedCount
    ).length,
    failedCountMismatches: batches.filter((batch) =>
      (byBatch.get(batch.id) ?? []).filter((item) => item.status === "failed").length !== batch.failedCount
    ).length,
    succeededWithRetainedKeys: batches.filter((batch) =>
      batch.status === "succeeded" && (byBatch.get(batch.id)?.length ?? 0) > 0
    ).length,
    itemsWithoutBatch: items.filter((item) => !known.has(item.batchId)).length,
  };
}

/** Explicit support repair: make terminal failed keys eligible again. */
export async function requeueFailedStorageCleanupBatch(input: {
  batchId: string;
  now?: Date;
}): Promise<number> {
  return withTransaction(async (tx) => {
    const [batch] = await tx.select().from(storageCleanupBatches)
      .where(eq(storageCleanupBatches.id, input.batchId)).limit(1).for("update");
    if (!batch || (batch.status !== "partial" && batch.status !== "failed")) return 0;
    const reset = await tx.update(storageCleanupItems).set({
      status: "pending",
      attempts: 0,
      nextAttemptAt: input.now ?? new Date(),
    }).where(and(
      eq(storageCleanupItems.batchId, input.batchId),
      eq(storageCleanupItems.status, "failed"),
    ));
    const count = affectedRows(reset);
    if (count > 0) {
      await tx.update(storageCleanupBatches).set({
        status: "processing",
        failedCount: 0,
        leaseToken: null,
        leaseExpiresAt: input.now ?? new Date(),
      }).where(eq(storageCleanupBatches.id, input.batchId));
    }
    return count;
  });
}

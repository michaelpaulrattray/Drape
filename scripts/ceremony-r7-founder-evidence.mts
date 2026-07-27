/**
 * Bounded R7-7C founder-only production evidence ceremony.
 *
 * Stage and discard are separate phases so the authenticated owner-delivery
 * GET can be proven in the founder's real browser between them. This script
 * never loads .env, creates a model, invokes a provider, or touches credits.
 */
import { createHash, randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import sharp from "sharp";
import type { TrpcContext } from "../server/_core/context";
import {
  assertFounderEvidenceScope,
  assertFounderEvidenceSettledState,
  assertFounderEvidenceStageBaseline,
  assertFounderEvidenceStagedState,
  founderEvidenceSafeError,
  parseFounderEvidenceCeremonyArgs,
  type FounderEvidenceCeremonyArgs,
  type FounderEvidenceCounts,
} from "../server/casting/evidence/founderEvidenceCeremony";
import type { PrivateEvidenceStorageAdapter } from "../server/casting/evidence/evidenceDelivery";
import {
  getConfiguredPrivateEvidenceStorageAdapter,
  parsePrivateEvidenceStorageConfig,
} from "../server/casting/evidence/privateEvidenceStorage";
import { canonicalizeEvidenceDataUrl } from "../server/casting/evidence/imageValidation";
import { getStorageCleanupHealth } from "../server/db/storageCleanup";
import { getDb } from "../server/db/connection";
import { getUserById } from "../server/db/users";
import { appRouter } from "../server/routers";

interface TargetRow extends RowDataPacket {
  userEmail: string | null;
  modelName: string | null;
  modelStatus: string;
  modelDeletedAt: Date | null;
  modelUserId: number;
  currentPackageSnapshotId: string | null;
  stateVersion: number;
  identityRevisionId: string | null;
}

interface ReceiptRow extends RowDataPacket {
  id: string;
  status: string;
  cleanupBatchId: string | null;
  storageKey: string;
  contentHash: string;
  byteSize: number;
  attachedEntityId: string | null;
}

interface BatchRow extends RowDataPacket {
  id: string;
  status: string;
  expectedCount: number;
  deletedCount: number;
  failedCount: number;
}

interface OperationRow extends RowDataPacket {
  id: string;
  clientRequestId: string;
  kind: string;
  status: string;
  plannedCredits: number;
  chargedCredits: number;
  refundedCredits: number;
}

interface CreditTruth {
  balance: number | null;
  transactions: number;
  generations: number;
}

let args: FounderEvidenceCeremonyArgs;
let connection: Connection;
let connectionOpen = false;
let adapter: PrivateEvidenceStorageAdapter;

function numberValue(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("founder_evidence_invalid_count");
  }
  return result;
}

async function scalar(statement: string, params: readonly unknown[] = []): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(statement, [...params]);
  return numberValue(rows[0]?.value ?? 0);
}

async function target(): Promise<TargetRow> {
  const [rows] = await connection.execute<TargetRow[]>(
    `SELECT
       users.email AS userEmail,
       models.name AS modelName,
       models.status AS modelStatus,
       models.deletedAt AS modelDeletedAt,
       models.userId AS modelUserId,
       models.currentPackageSnapshotId,
       models.stateVersion,
       models.identityRevisionId
     FROM models
     INNER JOIN users ON users.id = models.userId
     WHERE models.id = ? AND users.id = ?
     LIMIT 1`,
    [args.modelId, args.userId],
  );
  const row = rows[0];
  if (
    !row
    || row.modelUserId !== args.userId
    || row.userEmail?.toLowerCase() !== args.userEmail
    || row.modelName !== args.modelName
    || row.modelStatus !== "draft"
    || row.modelDeletedAt !== null
  ) {
    throw new Error("founder_evidence_subject_confirmation_mismatch");
  }
  return row;
}

function sameHead(left: TargetRow, right: TargetRow): boolean {
  return left.currentPackageSnapshotId === right.currentPackageSnapshotId
    && left.stateVersion === right.stateVersion
    && left.identityRevisionId === right.identityRevisionId
    && left.modelStatus === right.modelStatus
    && left.modelDeletedAt === right.modelDeletedAt;
}

async function creditTruth(): Promise<CreditTruth> {
  const [creditRows] = await connection.execute<RowDataPacket[]>(
    "SELECT balance FROM points WHERE userId = ? LIMIT 1",
    [args.userId],
  );
  return {
    balance: creditRows[0] ? numberValue(creditRows[0].balance) : null,
    transactions: await scalar(
      "SELECT COUNT(*) AS value FROM point_transactions WHERE userId = ?",
      [args.userId],
    ),
    generations: await scalar(
      "SELECT COUNT(*) AS value FROM generations WHERE userId = ?",
      [args.userId],
    ),
  };
}

function sameCreditTruth(left: CreditTruth, right: CreditTruth): boolean {
  return left.balance === right.balance
    && left.transactions === right.transactions
    && left.generations === right.generations;
}

async function counts(): Promise<FounderEvidenceCounts> {
  return {
    objects: (await adapter.listCanonicalKeys({ maxKeys: 100 })).length,
    receipts: await scalar(
      "SELECT COUNT(*) AS value FROM casting_evidence_ingestions",
    ),
    plates: await scalar("SELECT COUNT(*) AS value FROM model_reference_plates"),
    crops: await scalar("SELECT COUNT(*) AS value FROM model_evidence_crops"),
    evidenceOperations: await scalar(
      `SELECT COUNT(*) AS value
       FROM generation_operations
       WHERE kind IN (
         'evidence_plate_ingest',
         'evidence_crop_ingest',
         'evidence_plate_discard'
       )`,
    ),
    evidenceOperationLocks: await scalar(
      `SELECT COUNT(*) AS value
       FROM generation_operation_locks
       WHERE kind IN (
         'evidence_plate_ingest',
         'evidence_crop_ingest',
         'evidence_plate_discard'
       )`,
    ),
    cleanupBatches: await scalar(
      "SELECT COUNT(*) AS value FROM storage_cleanup_batches WHERE kind = 'evidence_cleanup'",
    ),
    cleanupItems: await scalar(
      "SELECT COUNT(*) AS value FROM storage_cleanup_items WHERE storageBackend = 'private_evidence_r2'",
    ),
  };
}

async function receipts(): Promise<ReceiptRow[]> {
  const [rows] = await connection.execute<ReceiptRow[]>(
    `SELECT id, status, cleanupBatchId, storageKey, contentHash, byteSize, attachedEntityId
     FROM casting_evidence_ingestions
     ORDER BY createdAt, id`,
  );
  return rows;
}

async function evidenceOperations(): Promise<OperationRow[]> {
  const [rows] = await connection.execute<OperationRow[]>(
    `SELECT id, clientRequestId, kind, status, plannedCredits, chargedCredits, refundedCredits
     FROM generation_operations
     WHERE kind IN (
       'evidence_plate_ingest',
       'evidence_crop_ingest',
       'evidence_plate_discard'
     )
     ORDER BY createdAt, id`,
  );
  return rows;
}

function assertZeroCreditOperations(rows: readonly OperationRow[]): void {
  if (rows.some((row) =>
    row.status !== "succeeded"
    || row.plannedCredits !== 0
    || row.chargedCredits !== 0
    || row.refundedCredits !== 0
  )) {
    throw new Error("founder_evidence_operation_truth_mismatch");
  }
}

function context(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>): TrpcContext {
  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    correlationId: `founder-evidence-${args.mode}`,
  };
}

async function readHash(input: {
  storageKey: string;
  expectedByteSize: number;
}): Promise<string> {
  const object = await adapter.readCanonical({
    key: input.storageKey,
    expectedByteSize: input.expectedByteSize,
  });
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of object.body) {
      bytes += chunk.byteLength;
      hash.update(chunk);
    }
  } finally {
    object.abort();
  }
  if (bytes !== input.expectedByteSize) {
    throw new Error("founder_evidence_private_read_size_mismatch");
  }
  return hash.digest("hex");
}

async function stage(): Promise<void> {
  const beforeTarget = await target();
  const beforeCredit = await creditTruth();
  assertFounderEvidenceStageBaseline(await counts());
  const user = await getUserById(args.userId);
  if (!user) throw new Error("founder_evidence_user_unavailable");
  const caller = appRouter.createCaller(context(user));
  const capability = await caller.evidence.capability();
  if (capability.referencePlateIngestion !== true) {
    throw new Error("founder_evidence_capability_unavailable");
  }
  const png = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  }).png({ compressionLevel: 9 }).toBuffer();
  const imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const expected = await canonicalizeEvidenceDataUrl(imageDataUrl);
  const clientRequestId = randomUUID();
  const result = await caller.evidence.stageReferencePlate({
    modelId: args.modelId,
    clientRequestId,
    imageDataUrl,
  });
  // This recovery-safe line is emitted immediately after the only storage
  // mutation returns. It makes discard possible even if a later proof fails.
  process.stdout.write(`${JSON.stringify({
    mode: "founder-evidence-stage-returned",
    verificationPending: true,
    plateId: result.plateId,
    clientRequestId,
    delivery: result.delivery,
    byteSize: result.byteSize,
    contentHash: result.contentHash,
  })}\n`);
  if (
    result.mime !== expected.mime
    || result.width !== expected.width
    || result.height !== expected.height
    || result.byteSize !== expected.byteSize
    || result.contentHash !== expected.contentHash
    || result.delivery !== `/api/evidence/plate/${result.plateId}`
  ) {
    throw new Error("founder_evidence_stage_result_mismatch");
  }
  const rows = await receipts();
  if (
    rows.length !== 1
    || rows[0].status !== "attached"
    || rows[0].attachedEntityId !== result.plateId
    || rows[0].contentHash !== result.contentHash
    || rows[0].byteSize !== result.byteSize
  ) {
    throw new Error("founder_evidence_attached_receipt_mismatch");
  }
  if (await readHash({
    storageKey: rows[0].storageKey,
    expectedByteSize: result.byteSize,
  }) !== result.contentHash) {
    throw new Error("founder_evidence_private_read_hash_mismatch");
  }
  assertFounderEvidenceStagedState(await counts());
  const operations = await evidenceOperations();
  assertZeroCreditOperations(operations);
  if (
    operations.length !== 1
    || operations[0].kind !== "evidence_plate_ingest"
    || operations[0].clientRequestId !== clientRequestId
  ) {
    throw new Error("founder_evidence_ingest_operation_mismatch");
  }
  const afterTarget = await target();
  const afterCredit = await creditTruth();
  if (!sameHead(beforeTarget, afterTarget) || !sameCreditTruth(beforeCredit, afterCredit)) {
    throw new Error("founder_evidence_stage_side_effect_mismatch");
  }
  process.stdout.write(`${JSON.stringify({
    mode: "founder-evidence-stage",
    success: true,
    target: {
      appId: args.appId,
      host: args.host,
      database: args.database,
      userId: args.userId,
      modelId: args.modelId,
    },
    capability: true,
    plateId: result.plateId,
    clientRequestId,
    delivery: result.delivery,
    mime: result.mime,
    width: result.width,
    height: result.height,
    byteSize: result.byteSize,
    contentHash: result.contentHash,
    privateRead: { exactBytes: true, hashMatch: true },
    unchanged: {
      modelHead: true,
      credits: true,
      creditTransactions: true,
      generationRows: true,
    },
  })}\n`);
}

async function discard(): Promise<void> {
  const beforeTarget = await target();
  const beforeCredit = await creditTruth();
  assertFounderEvidenceStagedState(await counts());
  const rows = await receipts();
  if (
    rows.length !== 1
    || rows[0].status !== "attached"
    || rows[0].attachedEntityId !== args.plateId
    || rows[0].contentHash !== args.expectedContentHash
    || rows[0].byteSize !== args.expectedByteSize
  ) {
    throw new Error("founder_evidence_discard_preflight_mismatch");
  }
  const existingOperations = await evidenceOperations();
  if (
    existingOperations.length !== 1
    || existingOperations[0].kind !== "evidence_plate_ingest"
    || existingOperations[0].clientRequestId !== args.ingestClientRequestId
  ) {
    throw new Error("founder_evidence_ingest_confirmation_mismatch");
  }
  const user = await getUserById(args.userId);
  if (!user) throw new Error("founder_evidence_user_unavailable");
  const caller = appRouter.createCaller(context(user));
  const capability = await caller.evidence.capability();
  if (capability.referencePlateIngestion !== true) {
    throw new Error("founder_evidence_capability_unavailable");
  }
  const discardClientRequestId = randomUUID();
  const discarded = await caller.evidence.discardReferencePlate({
    plateId: args.plateId!,
    clientRequestId: discardClientRequestId,
  });
  if (discarded.plateId !== args.plateId || discarded.discarded !== true) {
    throw new Error("founder_evidence_discard_result_mismatch");
  }

  const deadline = Date.now() + 5 * 60_000;
  let settled = false;
  while (Date.now() < deadline) {
    const currentReceipts = await receipts();
    const [batchRows] = await connection.execute<BatchRow[]>(
      `SELECT id, status, expectedCount, deletedCount, failedCount
       FROM storage_cleanup_batches
       WHERE kind = 'evidence_cleanup'
       ORDER BY createdAt, id`,
    );
    const currentCounts = await counts();
    if (
      currentReceipts.length === 1
      && currentReceipts[0].status === "cleaned"
      && currentReceipts[0].cleanupBatchId !== null
      && batchRows.length === 1
      && batchRows[0].id === currentReceipts[0].cleanupBatchId
      && batchRows[0].status === "succeeded"
      && batchRows[0].expectedCount === 1
      && batchRows[0].deletedCount === 1
      && batchRows[0].failedCount === 0
      && currentCounts.objects === 0
      && currentCounts.plates === 0
      && currentCounts.cleanupItems === 0
    ) {
      settled = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (!settled) throw new Error("founder_evidence_cleanup_did_not_converge");

  assertFounderEvidenceSettledState(await counts());
  const operations = await evidenceOperations();
  assertZeroCreditOperations(operations);
  if (
    operations.length !== 2
    || !operations.some((operation) =>
      operation.kind === "evidence_plate_ingest"
      && operation.clientRequestId === args.ingestClientRequestId)
    || !operations.some((operation) =>
      operation.kind === "evidence_plate_discard"
      && operation.clientRequestId === discardClientRequestId)
  ) {
    throw new Error("founder_evidence_operation_residue_mismatch");
  }
  const health = await getStorageCleanupHealth();
  if (
    health.partialBatches !== 0
    || health.failedBatches !== 0
    || health.staleLeases !== 0
    || health.cleanupPendingEvidenceReceipts !== 0
    || health.failedEvidenceManifests !== 0
    || health.pendingPrivateBatches !== 0
  ) {
    throw new Error("founder_evidence_cleanup_health_attention");
  }
  const afterTarget = await target();
  const afterCredit = await creditTruth();
  if (!sameHead(beforeTarget, afterTarget) || !sameCreditTruth(beforeCredit, afterCredit)) {
    throw new Error("founder_evidence_discard_side_effect_mismatch");
  }
  process.stdout.write(`${JSON.stringify({
    mode: "founder-evidence-discard",
    success: true,
    target: {
      appId: args.appId,
      host: args.host,
      database: args.database,
      userId: args.userId,
      modelId: args.modelId,
    },
    discarded: true,
    settled: true,
    liveEvidence: { objects: 0, plates: 0, crops: 0 },
    durableAudit: {
      cleanedReceipts: 1,
      succeededCleanupBatches: 1,
      zeroCreditOperations: 2,
    },
    unchanged: {
      modelHead: true,
      credits: true,
      creditTransactions: true,
      generationRows: true,
    },
  })}\n`);
}

async function main(): Promise<void> {
  args = parseFounderEvidenceCeremonyArgs(process.argv.slice(2));
  assertFounderEvidenceScope(process.env.R7_EVIDENCE_INGEST_SCOPE, args.userId);
  if (process.env.ENABLE_STORAGE_CLEANUP_WORKER !== "true") {
    throw new Error("founder_evidence_cleanup_worker_not_enabled");
  }
  const storageConfig = parsePrivateEvidenceStorageConfig(process.env);
  if (!storageConfig || storageConfig.bucket !== args.evidenceBucket) {
    throw new Error("founder_evidence_bucket_confirmation_mismatch");
  }
  process.env.DATABASE_URL = args.databaseUrl;
  try {
    connection = await mysql.createConnection({
      uri: args.databaseUrl,
      connectTimeout: 15_000,
    });
    connectionOpen = true;
    const configuredAdapter = getConfiguredPrivateEvidenceStorageAdapter();
    if (!configuredAdapter) {
      throw new Error("founder_evidence_adapter_unconfigured");
    }
    adapter = configuredAdapter;
    if (args.mode === "stage") await stage();
    else await discard();
  } finally {
    if (connectionOpen) await connection.end();
    const db = await getDb();
    if (db) {
      await (db as { $client: { end: () => Promise<void> } }).$client.end();
    }
    delete process.env.DATABASE_URL;
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(
      `${founderEvidenceSafeError(error)}\n`,
      () => process.exit(1),
    );
  },
);

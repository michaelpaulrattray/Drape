/**
 * C5D counts-only database/private-bucket audit. It performs a frozen,
 * read-only database inspection and ListObjectsV2 through the production
 * adapter. It never prints keys, URLs, customer data, or credentials.
 */
import "dotenv/config";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { auditEvidenceOrphans } from "../server/casting/evidence/evidenceOrphanAudit";
import {
  getConfiguredPrivateEvidenceStorageAdapter,
  parsePrivateEvidenceStorageConfig,
} from "../server/casting/evidence/privateEvidenceStorage";
import {
  assertPrivateEvidenceScopeOff,
  parsePrivateEvidenceCeremonyArgs,
  summarizePrivateEvidenceBucket,
} from "../server/casting/evidence/privateEvidenceCeremony";
import { assertReadOnlyAuditSql } from "../server/casting/deletionAudit";

async function main(): Promise<void> {
  const args = parsePrivateEvidenceCeremonyArgs(
    process.argv.slice(2),
    "audit",
  );
  assertPrivateEvidenceScopeOff(process.env.R7_EVIDENCE_INGEST_SCOPE);
  const config = parsePrivateEvidenceStorageConfig(process.env);
  if (!config || config.bucket !== args.evidenceBucket) {
    throw new Error("private_evidence_bucket_confirmation_mismatch");
  }
  const adapter = getConfiguredPrivateEvidenceStorageAdapter();
  if (!adapter) throw new Error("private_evidence_adapter_unconfigured");
  const connection = await mysql.createConnection({
    uri: args.databaseUrl,
    connectTimeout: 15_000,
  });
  const rows = async (statement: string): Promise<RowDataPacket[]> => {
    assertReadOnlyAuditSql(statement);
    const [result] = await connection.query<RowDataPacket[]>(statement);
    return result;
  };
  let transactionOpen = false;
  try {
    assertReadOnlyAuditSql("START TRANSACTION READ ONLY");
    await connection.query("START TRANSACTION READ ONLY");
    transactionOpen = true;
    const users = (await rows("SELECT id FROM users")).map((row) => ({
      id: Number(row.id),
    }));
    const models = (await rows("SELECT id, userId FROM models")).map((row) => ({
      id: Number(row.id),
      userId: Number(row.userId),
    }));
    const operations = (await rows(
      "SELECT id, userId, modelId, kind, subjectDeletedAt FROM generation_operations WHERE kind IN ('evidence_plate_ingest', 'evidence_crop_ingest', 'evidence_plate_discard')",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: row.modelId == null ? null : Number(row.modelId),
      kind: String(row.kind),
      subjectDeletedAt: row.subjectDeletedAt == null
        ? null
        : String(row.subjectDeletedAt),
    }));
    const receipts = (await rows(
      "SELECT id, userId, modelId, operationId, purpose, status, storageKey, attachedEntityKind, attachedEntityId, cleanupBatchId FROM casting_evidence_ingestions",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: Number(row.modelId),
      operationId: String(row.operationId),
      purpose: String(row.purpose),
      status: String(row.status),
      storageKey: String(row.storageKey),
      attachedEntityKind: row.attachedEntityKind == null
        ? null
        : String(row.attachedEntityKind),
      attachedEntityId: row.attachedEntityId == null
        ? null
        : String(row.attachedEntityId),
      cleanupBatchId: row.cleanupBatchId == null
        ? null
        : String(row.cleanupBatchId),
    }));
    const referencePlates = (await rows(
      "SELECT id, userId, modelId, storageKey, createdByOperationId FROM model_reference_plates",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: Number(row.modelId),
      storageKey: String(row.storageKey),
      createdByOperationId: String(row.createdByOperationId),
    }));
    const crops = (await rows(
      "SELECT id, userId, modelId, plateId, storageKey, createdByOperationId FROM model_evidence_crops",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: Number(row.modelId),
      plateId: String(row.plateId),
      storageKey: String(row.storageKey),
      createdByOperationId: String(row.createdByOperationId),
    }));
    const cleanupBatches = (await rows(
      "SELECT id, userId, operationId, kind FROM storage_cleanup_batches WHERE kind = 'evidence_cleanup'",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      operationId: String(row.operationId),
      kind: String(row.kind),
    }));
    const cleanupItems = (await rows(
      "SELECT batchId, storageKey, storageBackend FROM storage_cleanup_items WHERE storageBackend = 'private_evidence_r2'",
    )).map((row) => ({
      batchId: String(row.batchId),
      storageKey: String(row.storageKey),
      storageBackend: String(row.storageBackend),
    }));
    assertReadOnlyAuditSql("ROLLBACK");
    await connection.query("ROLLBACK");
    transactionOpen = false;

    if (
      receipts.length !== args.expectedReceiptCount
      || referencePlates.length !== args.expectedPlateCount
      || crops.length !== args.expectedCropCount
    ) {
      throw new Error("private_evidence_database_count_mismatch");
    }
    const evidence = auditEvidenceOrphans({
      users,
      models,
      operations,
      receipts: receipts as Parameters<typeof auditEvidenceOrphans>[0]["receipts"],
      referencePlates,
      crops,
      cleanupBatches,
      cleanupItems,
    });
    const objects = await adapter.listCanonicalKeys({
      maxKeys: Math.max(100, args.expectedObjectCount! + 1),
    });
    const referenced = [
      ...referencePlates.map((row) => row.storageKey),
      ...crops.map((row) => row.storageKey),
      ...receipts
        .filter((row) => row.status === "stored" || row.status === "attached")
        .map((row) => row.storageKey),
    ];
    const bucket = summarizePrivateEvidenceBucket({
      objects,
      referenced,
      queued: cleanupItems.map((row) => row.storageKey),
    });
    const clean = evidence.clean
      && bucket.objects === args.expectedObjectCount
      && bucket.orphanCandidates === 0
      && bucket.missingReferencedObjects === 0;
    process.stdout.write(`${JSON.stringify({
      mode: "production-private-evidence-audit",
      target: { appId: args.appId, host: args.host, database: args.database },
      expected: {
        objects: args.expectedObjectCount,
        receipts: args.expectedReceiptCount,
        referencePlates: args.expectedPlateCount,
        crops: args.expectedCropCount,
      },
      evidence,
      bucket,
      clean,
    })}\n`);
    if (!clean) process.exitCode = 2;
  } finally {
    if (transactionOpen) {
      try {
        await connection.query("ROLLBACK");
      } catch {
        // Connection cleanup is best-effort after a failed read-only audit.
      }
    }
    await connection.end();
  }
}

main().catch(() => {
  process.stderr.write("private_evidence_audit_failed\n");
  process.exitCode = 1;
});

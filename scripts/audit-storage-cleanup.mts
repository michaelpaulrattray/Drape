/**
 * R7-5D read-only manifest/orphan audit. It prints aggregate counts only —
 * never URLs, storage keys, prompts, metadata or credentials.
 *
 * Manifest-only:
 *   pnpm exec tsx scripts/audit-storage-cleanup.mts --database-url mysql://... --app-id drape-local --r2-public-url https://...
 * Bucket orphan counts (read-only ListObjectsV2): add --include-bucket.
 */
import "dotenv/config";
import mysql, { type RowDataPacket } from "mysql2/promise";
import {
  classifyStorageReference,
  normalizeOwnedStorageKey,
  parseCastDeletionAuditArgs,
  parseJsonValue,
} from "../server/casting/deletionAudit";
import type { ModelReferencePlateKind } from "../drizzle/schema";
import { auditEvidenceOrphans } from "../server/casting/evidence/evidenceOrphanAudit";
import { openDatabase } from "./lib/dbConnection.mts";

const args = parseCastDeletionAuditArgs(process.argv.slice(2));
process.env.DATABASE_URL = args.databaseUrl;
process.env.R2_PUBLIC_URL = args.currentPublicUrl;
const connection = await openDatabase({ uri: args.databaseUrl, connectTimeout: 15_000 });

type Reference = { storageKey?: unknown; url?: unknown };
const referenced = new Set<string>();
const referenceCounts = { exact: 0, external: 0, invalid: 0, missing: 0 };
function add(reference: Reference): void {
  const result = classifyStorageReference({ ...reference, currentPublicUrl: args.currentPublicUrl });
  if (result.kind === "explicit_key" || result.kind === "current_origin_url") {
    referenced.add(result.key);
    referenceCounts.exact += 1;
  } else if (result.kind === "external_url") referenceCounts.external += 1;
  else if (result.kind === "invalid") referenceCounts.invalid += 1;
  else referenceCounts.missing += 1;
}

async function rows(sql: string): Promise<RowDataPacket[]> {
  const [result] = await connection.query<RowDataPacket[]>(sql);
  return result;
}

try {
  const simpleQueries = [
    "SELECT avatarKey AS storageKey, avatarUrl AS url FROM users UNION ALL SELECT bannerKey, bannerUrl FROM users",
    "SELECT storageKey, storageUrl AS url FROM model_assets",
    "SELECT NULL AS storageKey, resultUrl AS url FROM generations",
    "SELECT fileKey AS storageKey, url FROM change_request_attachments",
    "SELECT originalImageKey AS storageKey, originalImageUrl AS url FROM wardrobe_garments UNION ALL SELECT isolatedImageKey, isolatedImageUrl FROM wardrobe_garments UNION ALL SELECT sourceImageKey, sourceImageUrl FROM wardrobe_garments",
    "SELECT resultThumbKey AS storageKey, resultThumbUrl AS url FROM wardrobe_outfits",
    "SELECT NULL AS storageKey, imageUrl AS url FROM wardrobe_looks",
    "SELECT thumbnailKey AS storageKey, thumbnailUrl AS url FROM boards",
    "SELECT imageKey AS storageKey, imageUrl AS url FROM board_items",
    "SELECT NULL AS storageKey, imageUrl AS url FROM board_item_versions",
  ];
  for (const query of simpleQueries) {
    for (const row of await rows(query)) add({ storageKey: row.storageKey, url: row.url });
  }
  for (const session of await rows("SELECT modelImageUrl, history FROM wardrobe_sessions")) {
    add({ url: session.modelImageUrl });
    const history = parseJsonValue(session.history);
    if (Array.isArray(history)) for (const url of history) add({ url });
  }

  const batchRows = await rows("SELECT id, status, expectedCount, deletedCount, failedCount, leaseExpiresAt FROM storage_cleanup_batches");
  const itemRows = await rows(
    "SELECT batchId, storageKey, storageBackend, status FROM storage_cleanup_items",
  );
  const queued = new Set<string>();
  for (const item of itemRows) {
    const key = normalizeOwnedStorageKey(item.storageKey);
    if (key) queued.add(key);
  }
  const itemsByBatch = new Map<string, RowDataPacket[]>();
  for (const item of itemRows) itemsByBatch.set(String(item.batchId), [...(itemsByBatch.get(String(item.batchId)) ?? []), item]);
  const reconciliation = {
    batches: batchRows.length,
    retainedItems: itemRows.length,
    countMismatches: batchRows.filter((batch) =>
      Number(batch.deletedCount) + (itemsByBatch.get(String(batch.id))?.length ?? 0) !== Number(batch.expectedCount)
    ).length,
    failedCountMismatches: batchRows.filter((batch) =>
      (itemsByBatch.get(String(batch.id)) ?? []).filter((item) => item.status === "failed").length !== Number(batch.failedCount)
    ).length,
    succeededWithRetainedKeys: batchRows.filter((batch) =>
      batch.status === "succeeded" && (itemsByBatch.get(String(batch.id))?.length ?? 0) > 0
    ).length,
  };
  const evidence = auditEvidenceOrphans({
    users: (await rows("SELECT id FROM users")).map((row) => ({
      id: Number(row.id),
    })),
    models: (await rows("SELECT id, userId FROM models")).map((row) => ({
      id: Number(row.id),
      userId: Number(row.userId),
    })),
    // Keep this closed list aligned with evidence operation kinds that may own
    // an evidence_cleanup manifest.
    operations: (await rows(
      "SELECT id, userId, modelId, kind, subjectDeletedAt FROM generation_operations WHERE kind IN ('evidence_plate_ingest', 'evidence_crop_ingest', 'evidence_plate_discard')",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: row.modelId == null ? null : Number(row.modelId),
      kind: String(row.kind),
      subjectDeletedAt: row.subjectDeletedAt == null ? null : String(row.subjectDeletedAt),
    })),
    receipts: (await rows(
      "SELECT id, userId, modelId, operationId, purpose, status, storageKey, attachedEntityKind, attachedEntityId, cleanupBatchId FROM casting_evidence_ingestions",
    )).map((row) => ({
      ...row,
      id: String(row.id),
      userId: Number(row.userId),
      modelId: Number(row.modelId),
      operationId: String(row.operationId),
      storageKey: String(row.storageKey),
      attachedEntityKind: row.attachedEntityKind == null ? null : String(row.attachedEntityKind),
      attachedEntityId: row.attachedEntityId == null ? null : String(row.attachedEntityId),
      cleanupBatchId: row.cleanupBatchId == null ? null : String(row.cleanupBatchId),
    })) as Parameters<typeof auditEvidenceOrphans>[0]["receipts"],
    referencePlates: (await rows(
      "SELECT id, userId, modelId, kind, storageKey, createdByOperationId FROM model_reference_plates",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: Number(row.modelId),
      /* #308 — a plate's own provenance decides which object namespace its key
         may name, so the audit is given it rather than assuming. */
      kind: String(row.kind) as ModelReferencePlateKind,
      storageKey: String(row.storageKey),
      createdByOperationId: String(row.createdByOperationId),
    })),
    crops: (await rows(
      "SELECT id, userId, modelId, plateId, storageKey, createdByOperationId FROM model_evidence_crops",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      modelId: Number(row.modelId),
      plateId: String(row.plateId),
      storageKey: String(row.storageKey),
      createdByOperationId: String(row.createdByOperationId),
    })),
    cleanupBatches: (await rows(
      "SELECT id, userId, operationId, kind FROM storage_cleanup_batches WHERE kind = 'evidence_cleanup'",
    )).map((row) => ({
      id: String(row.id),
      userId: Number(row.userId),
      operationId: String(row.operationId),
      kind: String(row.kind),
    })),
    cleanupItems: itemRows.map((row) => ({
      batchId: String(row.batchId),
      storageKey: String(row.storageKey),
      storageBackend: String(row.storageBackend),
    })),
  });

  let bucket: null | {
    objects: number;
    protectedStaticObjects: number;
    referencedObjects: number;
    queuedObjects: number;
    orphanCandidates: number;
  } = null;
  if (process.argv.includes("--include-bucket")) {
    const { storageListKeys } = await import("../server/storage");
    const objects = (await storageListKeys()).map(normalizeOwnedStorageKey).filter((key): key is string => !!key);
    const protectedPrefixes = ["assets/", "hero/"];
    bucket = {
      objects: objects.length,
      protectedStaticObjects: objects.filter((key) => protectedPrefixes.some((prefix) => key.startsWith(prefix))).length,
      referencedObjects: objects.filter((key) => referenced.has(key)).length,
      queuedObjects: objects.filter((key) => queued.has(key)).length,
      orphanCandidates: objects.filter((key) =>
        !referenced.has(key) && !queued.has(key) && !protectedPrefixes.some((prefix) => key.startsWith(prefix))
      ).length,
    };
  }
  process.stdout.write(`${JSON.stringify({
    mode: "read-only",
    referenceCounts,
    reconciliation,
    evidence,
    bucket,
  })}\n`);
} finally {
  await connection.end();
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

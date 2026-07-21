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

const args = parseCastDeletionAuditArgs(process.argv.slice(2));
process.env.DATABASE_URL = args.databaseUrl;
process.env.R2_PUBLIC_URL = args.currentPublicUrl;
const connection = await mysql.createConnection({ uri: args.databaseUrl, connectTimeout: 15_000 });

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
  const itemRows = await rows("SELECT batchId, storageKey, status FROM storage_cleanup_items");
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
  process.stdout.write(`${JSON.stringify({ mode: "read-only", referenceCounts, reconciliation, bucket })}\n`);
} finally {
  await connection.end();
}

/**
 * READ-ONLY R7-5A Cast-deletion dependency audit.
 *
 * The target database, app id and current public bucket must all be explicit.
 * Production is refused unless the separately reviewed read-only flag is
 * supplied. Every SQL statement passes a runtime read-only tripwire and runs
 * inside a READ ONLY transaction. This script has no storage client import.
 *
 * Usage (non-production):
 *   pnpm exec tsx scripts/audit-cast-deletion.ts \
 *     --database-url mysql://... --app-id drape-local \
 *     --r2-public-url https://example.r2.dev [--model-id 123]
 *
 * Production additionally requires explicit authorization represented by:
 *   --allow-production-read-only
 *
 * Standalone strict typecheck (scripts/ is outside the app tsconfig include):
 *   pnpm exec tsc --noEmit --strict --skipLibCheck --esModuleInterop \
 *     --module ESNext --moduleResolution bundler --types node \
 *     scripts/audit-cast-deletion.ts
 */
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import {
  assertReadOnlyAuditSql,
  classifyStorageReference,
  collectHttpReferences,
  countReferenceKinds,
  hasForbiddenDeletedSubjectMetadata,
  parseCastDeletionAuditArgs,
  parseJsonValue,
  readCastProvenance,
} from "../server/casting/deletionAudit";

type AuditRow = RowDataPacket & Record<string, unknown>;

interface ModelRow extends AuditRow {
  id: number;
  userId: number;
  status: string;
  preferences: unknown;
  deletedAt?: Date | null;
}

interface AssetRow extends AuditRow {
  id: number;
  storageUrl: string;
  storageKey: string | null;
  provenance: unknown;
}

interface BoardItemRow extends AuditRow {
  id: number;
  boardId: number;
  boardUserId: number;
  sourceModelId: number | null;
  imageUrl: string | null;
  imageKey: string | null;
  metadata: unknown;
}

async function rows<T extends AuditRow>(
  connection: Connection,
  statement: string,
  params: unknown[] = [],
): Promise<T[]> {
  assertReadOnlyAuditSql(statement);
  try {
    const [result] = await connection.query<T[]>(statement, params);
    return result;
  } catch (error) {
    const queryShape = statement.replace(/\s+/g, " ").trim().slice(0, 180);
    const reason = error instanceof Error ? error.message : "unknown database error";
    throw new Error(`Read-only audit query failed: ${queryShape} — ${reason}`);
  }
}

async function scalar(
  connection: Connection,
  statement: string,
  params: unknown[] = [],
): Promise<number> {
  const result = await rows<AuditRow>(connection, statement, params);
  return Number(result[0]?.count ?? 0);
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(", ");
}

function stringsFromJson(value: unknown): string[] {
  const result: string[] = [];
  const seen = new Set<object>();
  const visit = (current: unknown): void => {
    const parsed = parseJsonValue(current);
    if (typeof parsed === "string") {
      result.push(parsed);
      return;
    }
    if (!parsed || typeof parsed !== "object" || seen.has(parsed)) return;
    seen.add(parsed);
    if (Array.isArray(parsed)) {
      for (const item of parsed) visit(item);
    } else {
      for (const item of Object.values(parsed as Record<string, unknown>)) visit(item);
    }
  };
  visit(value);
  return result;
}

function topLevelReferenceImage(preferences: unknown): string | null {
  const parsed = parseJsonValue(preferences);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = (parsed as Record<string, unknown>).referenceImage;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function originCounts(
  references: Array<{ storageKey?: unknown; url?: unknown }>,
  currentPublicUrl: string,
  includeOriginHosts: boolean,
): { classifications: ReturnType<typeof countReferenceKinds>; nonCurrentOrigins?: Record<string, number> } {
  const classifications = countReferenceKinds(references, currentPublicUrl);
  if (!includeOriginHosts) return { classifications };
  const hosts = new Map<string, number>();
  for (const reference of references) {
    const classified = classifyStorageReference({ ...reference, currentPublicUrl });
    if (classified.kind !== "external_url") continue;
    hosts.set(classified.origin, (hosts.get(classified.origin) ?? 0) + 1);
  }
  return { classifications, nonCurrentOrigins: Object.fromEntries(Array.from(hosts).sort()) };
}

async function auditModel(input: {
  connection: Connection;
  model: ModelRow;
  allModels: ModelRow[];
  hasDeletedAt: boolean;
  currentPublicUrl: string;
  includeOriginHosts: boolean;
}) {
  const { connection, model } = input;
  const assets = await rows<AssetRow>(connection, `
    SELECT id, storageUrl, storageKey, provenance
    FROM model_assets
    WHERE modelId = ?
    ORDER BY id
  `, [model.id]);
  const assetUrls = Array.from(new Set(assets.map((asset) => asset.storageUrl).filter(Boolean)));

  const attempts = await rows<AuditRow>(connection, `
    SELECT id, userId, resultUrl, errorMessage, metadata
    FROM generations
    WHERE modelId = ?
    ORDER BY id
  `, [model.id]);
  const operations = await rows<AuditRow>(connection, `
    SELECT id, userId, result, publicMessage, errorCode, originBoardId, originItemId
    FROM generation_operations
    WHERE modelId = ?
    ORDER BY createdAt, id
  `, [model.id]);

  const urlPredicate = assetUrls.length > 0
    ? ` OR bi.imageUrl IN (${placeholders(assetUrls)})`
    : "";
  const boardItems = await rows<BoardItemRow>(connection, `
    SELECT bi.id, bi.boardId, b.userId AS boardUserId, bi.sourceModelId,
           bi.imageUrl, bi.imageKey, bi.metadata
    FROM board_items bi
    INNER JOIN boards b ON b.id = bi.boardId
    WHERE bi.sourceModelId = ?
       OR CAST(JSON_UNQUOTE(JSON_EXTRACT(bi.metadata, '$.provenance.modelId')) AS UNSIGNED) = ?
       OR CAST(JSON_UNQUOTE(JSON_EXTRACT(bi.metadata, '$.modelId')) AS UNSIGNED) = ?
       ${urlPredicate}
    ORDER BY bi.id
  `, [model.id, model.id, model.id, ...assetUrls]);

  const linkedItemIds = boardItems.map((item) => item.id);
  const versions = assetUrls.length > 0
    ? await rows<AuditRow>(connection, `
        SELECT biv.id, biv.itemId, biv.imageUrl, b.userId AS boardUserId
        FROM board_item_versions biv
        INNER JOIN board_items bi ON bi.id = biv.itemId
        INNER JOIN boards b ON b.id = bi.boardId
        WHERE biv.imageUrl IN (${placeholders(assetUrls)})
        ORDER BY biv.id
      `, assetUrls)
    : [];
  const edges = linkedItemIds.length > 0
    ? await rows<AuditRow>(connection, `
        SELECT id
        FROM board_edges
        WHERE sourceItemId IN (${placeholders(linkedItemIds)})
           OR targetItemId IN (${placeholders(linkedItemIds)})
      `, [...linkedItemIds, ...linkedItemIds])
    : [];
  const thumbnails = assetUrls.length > 0
    ? await rows<AuditRow>(connection, `
        SELECT id, userId, thumbnailUrl, thumbnailKey
        FROM boards
        WHERE thumbnailUrl IN (${placeholders(assetUrls)})
      `, assetUrls)
    : [];

  const wardrobeSessions = await rows<AuditRow>(connection, `
    SELECT id, userId, modelImageUrl, history
    FROM wardrobe_sessions
    WHERE modelId = ?
    ORDER BY id
  `, [model.id]);
  const wardrobeLooks = await rows<AuditRow>(connection, `
    SELECT id, userId, sessionId, imageUrl
    FROM wardrobe_looks
    WHERE modelId = ?
    ORDER BY id
  `, [model.id]);
  const bugReports = await rows<AuditRow>(connection, `
    SELECT id, userId FROM bug_reports WHERE modelId = ? ORDER BY id
  `, [model.id]);
  const auditLogs = await rows<AuditRow>(connection, `
    SELECT id, userId, metadata
    FROM audit_logs
    WHERE CAST(resourceType AS BINARY) = CAST('model' AS BINARY)
      AND CAST(resourceId AS BINARY) = CAST(CAST(? AS CHAR) AS BINARY)
    ORDER BY id
  `, [model.id]);

  let directCanvas = 0;
  let jsonOnlyCanvas = 0;
  let urlOnlyCanvas = 0;
  let directJsonMismatch = 0;
  let unrecognizedJsonCandidates = 0;
  let crossOwnerCanvas = 0;
  for (const item of boardItems) {
    const provenance = readCastProvenance(item.metadata);
    const directMatch = item.sourceModelId === model.id;
    const jsonMatch = provenance?.modelId === model.id;
    const urlMatch = !!item.imageUrl && assetUrls.includes(item.imageUrl);
    if (directMatch) directCanvas += 1;
    if (!directMatch && jsonMatch) jsonOnlyCanvas += 1;
    if (!directMatch && !jsonMatch && urlMatch) urlOnlyCanvas += 1;
    if (!directMatch && !jsonMatch && !urlMatch) unrecognizedJsonCandidates += 1;
    if (item.sourceModelId && provenance && item.sourceModelId !== provenance.modelId) {
      directJsonMismatch += 1;
    }
    if (item.boardUserId !== model.userId) crossOwnerCanvas += 1;
  }
  const crossOwnerVersions = versions.filter((version) => version.boardUserId !== model.userId).length;
  const crossOwnerThumbnails = thumbnails.filter((board) => board.userId !== model.userId).length;
  const crossOwnerWardrobe = wardrobeSessions.filter((session) => session.userId !== model.userId).length
    + wardrobeLooks.filter((look) => look.userId !== model.userId).length;
  const crossOwnerAttempts = attempts.filter((attempt) => attempt.userId !== model.userId).length;
  const crossOwnerOperations = operations.filter((operation) => operation.userId !== model.userId).length;
  const crossOwnerBugReports = bugReports.filter((report) => report.userId !== model.userId).length;
  const crossOwnerAuditLogs = auditLogs.filter(
    (report) => report.userId !== null && report.userId !== model.userId,
  ).length;
  const crossOwnerReferences = crossOwnerCanvas + crossOwnerVersions + crossOwnerThumbnails
    + crossOwnerWardrobe + crossOwnerAttempts + crossOwnerOperations + crossOwnerBugReports
    + crossOwnerAuditLogs;

  const targetReference = topLevelReferenceImage(model.preferences);
  const sharedReferenceModels = targetReference
    ? input.allModels.filter((candidate) => candidate.id !== model.id && topLevelReferenceImage(candidate.preferences) === targetReference).length
    : 0;

  const references: Array<{ storageKey?: unknown; url?: unknown }> = [];
  for (const asset of assets) {
    references.push({ storageKey: asset.storageKey, url: asset.storageUrl });
    for (const url of collectHttpReferences(asset.provenance)) references.push({ url });
  }
  for (const attempt of attempts) {
    references.push({ url: attempt.resultUrl });
    for (const url of collectHttpReferences(attempt.metadata)) references.push({ url });
    for (const url of collectHttpReferences(attempt.errorMessage)) references.push({ url });
  }
  for (const operation of operations) {
    for (const url of collectHttpReferences(operation.result)) references.push({ url });
    for (const url of collectHttpReferences(operation.publicMessage)) references.push({ url });
  }
  for (const item of boardItems) {
    references.push({ storageKey: item.imageKey, url: item.imageUrl });
    for (const url of collectHttpReferences(item.metadata)) references.push({ url });
  }
  for (const version of versions) references.push({ url: version.imageUrl });
  for (const board of thumbnails) references.push({ storageKey: board.thumbnailKey, url: board.thumbnailUrl });
  for (const session of wardrobeSessions) {
    references.push({ url: session.modelImageUrl });
    for (const url of collectHttpReferences(session.history)) references.push({ url });
  }
  for (const look of wardrobeLooks) references.push({ url: look.imageUrl });
  for (const auditLog of auditLogs) {
    for (const url of collectHttpReferences(auditLog.metadata)) references.push({ url });
  }
  if (targetReference && /^https?:\/\//i.test(targetReference)) references.push({ url: targetReference });

  const wardrobeUrlCount = wardrobeSessions.reduce(
    (count, session) => count + 1 + stringsFromJson(session.history).filter((value) => /^https?:\/\//i.test(value)).length,
    0,
  ) + wardrobeLooks.length;

  return {
    modelId: model.id,
    lifecycle: {
      status: model.status,
      deletedAtPresent: input.hasDeletedAt ? model.deletedAt != null : false,
      legacyArchivedWithoutDeletedAt: model.status === "archived" && (!input.hasDeletedAt || model.deletedAt == null),
    },
    assets: {
      rows: assets.length,
      explicitKeys: assets.filter((asset) => !!asset.storageKey).length,
      missingKeys: assets.filter((asset) => !asset.storageKey).length,
    },
    generations: { attempts: attempts.length, operations: operations.length },
    canvas: {
      direct: directCanvas,
      jsonOnly: jsonOnlyCanvas,
      urlOnly: urlOnlyCanvas,
      directJsonMismatches: directJsonMismatch,
      unrecognizedJsonCandidates,
      crossOwnerReferences,
      matchingVersions: versions.length,
      incidentEdges: edges.length,
      matchingThumbnails: thumbnails.length,
    },
    wardrobe: {
      sessions: wardrobeSessions.length,
      looks: wardrobeLooks.length,
      urlReferences: wardrobeUrlCount,
    },
    bugReports: bugReports.length,
    auditLogs: {
      rows: auditLogs.length,
      withForbiddenIdentityMetadata: auditLogs.filter(
        (auditLog) => hasForbiddenDeletedSubjectMetadata(auditLog.metadata),
      ).length,
    },
    temporaryReferenceImage: {
      present: targetReference !== null,
      sharedByOtherModels: sharedReferenceModels,
    },
    storageEvidence: originCounts(references, input.currentPublicUrl, input.includeOriginHosts),
  };
}

async function main() {
  const args = parseCastDeletionAuditArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  console.log(
    `[cast-deletion-audit] READ ONLY app=${args.appId} host=${target.host} database=${target.pathname.slice(1)}`,
  );
  if (args.allowProductionReadOnly) {
    console.warn("[cast-deletion-audit] explicit production read-only authorization flag is present");
  }

  const connection = await mysql.createConnection(args.databaseUrl);
  await rows(connection, "START TRANSACTION READ ONLY");
  try {
    const hasDeletedAt = await scalar(connection, `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'models'
        AND COLUMN_NAME = 'deletedAt'
    `) === 1;
    const finalSchema = {
      modelsDeletedAt: hasDeletedAt,
      operationSubjectDeletedAt: await scalar(connection, `
        SELECT COUNT(*) AS count FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'generation_operations'
          AND COLUMN_NAME = 'subjectDeletedAt'
      `) === 1,
      cleanupBatches: await scalar(connection, `
        SELECT COUNT(*) AS count FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storage_cleanup_batches'
      `) === 1,
      cleanupItems: await scalar(connection, `
        SELECT COUNT(*) AS count FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storage_cleanup_items'
      `) === 1,
      boardSourceModelIndex: await scalar(connection, `
        SELECT COUNT(*) AS count FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'board_items'
          AND INDEX_NAME = 'idx_board_items_source_model'
      `) > 0,
    };
    const selectedDeletedAt = hasDeletedAt ? ", deletedAt" : "";
    const allModels = await rows<ModelRow>(connection, `
      SELECT id, userId, status, preferences${selectedDeletedAt}
      FROM models
      ORDER BY id
    `);
    const models = args.modelId
      ? allModels.filter((model) => model.id === args.modelId)
      : allModels;
    if (args.modelId && models.length === 0) {
      throw new Error(`Model ${args.modelId} was not found`);
    }

    const reports: Awaited<ReturnType<typeof auditModel>>[] = [];
    for (const model of models) {
      reports.push(await auditModel({
        connection,
        model,
        allModels,
        hasDeletedAt,
        currentPublicUrl: args.currentPublicUrl,
        includeOriginHosts: args.includeOriginHosts,
      }));
    }

    const summary = {
      auditedModels: reports.length,
      finalSchema,
      statuses: Object.fromEntries(
        Array.from(new Set(reports.map((report) => report.lifecycle.status)))
          .sort()
          .map((status) => [status, reports.filter((report) => report.lifecycle.status === status).length]),
      ),
      legacyArchivedWithoutDeletedAt: reports.filter((report) => report.lifecycle.legacyArchivedWithoutDeletedAt).length,
      directJsonMismatches: reports.reduce((sum, report) => sum + report.canvas.directJsonMismatches, 0),
      unrecognizedJsonCandidates: reports.reduce((sum, report) => sum + report.canvas.unrecognizedJsonCandidates, 0),
      crossOwnerReferences: reports.reduce((sum, report) => sum + report.canvas.crossOwnerReferences, 0),
      jsonOnlyCanvasReferences: reports.reduce((sum, report) => sum + report.canvas.jsonOnly, 0),
      sharedTemporaryReferences: reports.filter((report) => report.temporaryReferenceImage.sharedByOtherModels > 0).length,
      auditLogsWithForbiddenIdentityMetadata: reports.reduce(
        (sum, report) => sum + report.auditLogs.withForbiddenIdentityMetadata,
        0,
      ),
    };
    console.log(JSON.stringify({ summary, models: reports }, null, 2));
    if (
      summary.directJsonMismatches > 0 ||
      summary.unrecognizedJsonCandidates > 0 ||
      summary.crossOwnerReferences > 0 ||
      summary.auditLogsWithForbiddenIdentityMetadata > 0 ||
      (Object.values(finalSchema).some(Boolean) && !Object.values(finalSchema).every(Boolean))
    ) {
      console.error("ATTENTION: dependency discrepancies found. No rows were changed.");
      process.exitCode = 2;
    } else {
      console.log("PASS: dependency inventory completed; no rows were changed.");
    }
  } finally {
    await rows(connection, "ROLLBACK");
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[cast-deletion-audit] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

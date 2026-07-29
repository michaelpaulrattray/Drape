/**
 * Exact R7-7E production migration runner. It refuses unless 0014 is the sole
 * pending migration, production is exactly at 0013, package sync is off, and
 * the existing feature-version count matches the reviewed fence.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import {
  assertEvidencePackageScopeOff,
  parseEvidenceAcceptedAssetMigrationArgs,
} from "../server/casting/evidence/evidenceAcceptedAssetMigrationCeremony";
import {
  assertEvidenceComposerSchemaWithClient,
} from "../server/casting/evidence/evidenceComposerSchema";

const PREVIOUS_TAG = "0013_r7_ink_add_candidates";
const TARGET_TAG = "0014_r7_evidence_accepted_asset";

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function main(): Promise<void> {
  const args = parseEvidenceAcceptedAssetMigrationArgs(process.argv.slice(2));
  assertEvidencePackageScopeOff(process.env.R7_EVIDENCE_PACKAGE_SCOPE);
  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  ) as { entries?: JournalEntry[] };
  const entries = journal.entries ?? [];
  const previous = entries.at(-2);
  const target = entries.at(-1);
  if (
    previous?.tag !== PREVIOUS_TAG
    || target?.tag !== TARGET_TAG
    || target.idx !== previous.idx + 1
  ) {
    throw new Error("accepted_asset_local_migration_range_mismatch");
  }
  const previousSql = await readFile(`drizzle/${PREVIOUS_TAG}.sql`, "utf8");
  const targetSql = await readFile(`drizzle/${TARGET_TAG}.sql`, "utf8");
  const previousHash = createHash("sha256").update(previousSql).digest("hex");
  const targetHash = createHash("sha256").update(targetSql).digest("hex");

  const pool = mysql.createPool({
    uri: args.databaseUrl,
    connectTimeout: 15_000,
    connectionLimit: 1,
  });
  try {
    const [migrationRows] = await pool.query<RowDataPacket[]>(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    if (
      migrationRows.length !== 1
      || Number(migrationRows[0].created_at) !== previous.when
      || String(migrationRows[0].hash) !== previousHash
    ) {
      throw new Error("accepted_asset_production_migration_precondition_failed");
    }
    const [columnRows] = await pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'model_identity_feature_versions'
          AND COLUMN_NAME IN ('sourceAssetId','acceptedAssetId')
        ORDER BY ORDINAL_POSITION`,
    );
    if (
      columnRows.length !== 1
      || columnRows[0].COLUMN_NAME !== "sourceAssetId"
      || String(columnRows[0].COLUMN_TYPE).toLowerCase() !== "int"
      || columnRows[0].IS_NULLABLE !== "NO"
    ) {
      throw new Error("accepted_asset_production_schema_precondition_failed");
    }
    const [[before]] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS featureVersions FROM model_identity_feature_versions",
    );
    if (Number(before.featureVersions) !== args.expectedVersionCount) {
      throw new Error("accepted_asset_feature_version_count_mismatch");
    }

    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await assertEvidenceComposerSchemaWithClient(pool);

    const [postRows] = await pool.query<RowDataPacket[]>(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    if (
      postRows.length !== 1
      || Number(postRows[0].created_at) !== target.when
      || String(postRows[0].hash) !== targetHash
    ) {
      throw new Error("accepted_asset_production_migration_postcondition_failed");
    }
    const [[after]] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS featureVersions,
         SUM(CASE WHEN sourceAssetId IS NULL THEN 1 ELSE 0 END) AS nullSources,
         SUM(CASE WHEN acceptedAssetId IS NULL THEN 1 ELSE 0 END) AS pendingLinks
       FROM model_identity_feature_versions`,
    );
    if (
      Number(after.featureVersions) !== args.expectedVersionCount
      || Number(after.nullSources) !== 0
      || Number(after.pendingLinks) !== args.expectedVersionCount
    ) {
      throw new Error("accepted_asset_existing_rows_changed");
    }
    process.stdout.write(`${JSON.stringify({
      mode: "production-evidence-accepted-asset-migration",
      target: { appId: args.appId, host: args.host, database: args.database },
      from: PREVIOUS_TAG,
      to: TARGET_TAG,
      featureVersions: args.expectedVersionCount,
      pendingLinks: args.expectedVersionCount,
      schemaVerified: true,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  process.stderr.write("accepted_asset_migration_failed\n");
  process.exitCode = 1;
});

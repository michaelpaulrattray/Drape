/**
 * Exact R7-7D D6 production migration runner. It refuses unless local
 * migration 0013 is the sole pending migration, production is exactly at
 * 0012, evidence/composer authority is off, and the target is confirmed.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import {
  assertEvidenceComposerMigrationScopesOff,
  parseEvidenceComposerMigrationArgs,
} from "../server/casting/evidence/evidenceComposerDeploymentCeremony";
import {
  assertEvidenceComposerSchemaWithClient,
} from "../server/casting/evidence/evidenceComposerSchema";
import {
  assertPrivateEvidenceCleanupSchemaWithClient,
} from "../server/casting/evidence/privateEvidenceSchema";

const PREVIOUS_TAG = "0012_r7_private_evidence_cleanup_backend";
const TARGET_TAG = "0013_r7_ink_add_candidates";
const NEW_TABLES = [
  "casting_evidence_candidate_attempts",
  "casting_evidence_candidates",
  "model_identity_feature_intents",
  "model_identity_feature_versions",
  "model_identity_features",
  "model_snapshot_feature_selections",
] as const;

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function main(): Promise<void> {
  const args = parseEvidenceComposerMigrationArgs(process.argv.slice(2));
  assertEvidenceComposerMigrationScopesOff({
    composerScope: process.env.R7_EVIDENCE_COMPOSER_SCOPE,
    composerRecipe: process.env.R7_EVIDENCE_COMPOSER_RECIPE,
    candidateWorker: process.env.ENABLE_EVIDENCE_CANDIDATE_WORKER,
    ingestScope: process.env.R7_EVIDENCE_INGEST_SCOPE,
  });

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
    throw new Error("evidence_composer_local_migration_range_mismatch");
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
      throw new Error("evidence_composer_production_migration_precondition_failed");
    }
    await assertPrivateEvidenceCleanupSchemaWithClient(pool);

    const [newTableRows] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${NEW_TABLES.map(() => "?").join(",")})`,
      NEW_TABLES,
    );
    const [newColumnRows] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME, COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND (
            (TABLE_NAME = 'casting_evidence_ingestions' AND COLUMN_NAME = 'stepKey')
            OR (TABLE_NAME = 'model_evidence_crops' AND COLUMN_NAME = 'createdByOperationStepKey')
            OR (
              TABLE_NAME = 'model_reference_plates'
              AND COLUMN_NAME IN ('featureIntentId','createdByOperationStepKey')
            )
          )`,
    );
    if (newTableRows.length !== 0 || newColumnRows.length !== 0) {
      throw new Error("evidence_composer_production_schema_precondition_failed");
    }

    const [[beforeCounts]] = await pool.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM casting_evidence_ingestions) AS receipts,
        (SELECT COUNT(*) FROM model_reference_plates) AS plates,
        (SELECT COUNT(*) FROM model_evidence_crops) AS crops,
        (SELECT COUNT(*) FROM storage_cleanup_items
          WHERE storageBackend = 'private_evidence_r2') AS privateCleanupItems`,
    );

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
      throw new Error("evidence_composer_production_migration_postcondition_failed");
    }

    const [[afterCounts]] = await pool.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM casting_evidence_ingestions) AS receipts,
        (SELECT COUNT(*) FROM model_reference_plates) AS plates,
        (SELECT COUNT(*) FROM model_evidence_crops) AS crops,
        (SELECT COUNT(*) FROM storage_cleanup_items
          WHERE storageBackend = 'private_evidence_r2') AS privateCleanupItems,
        (SELECT COUNT(*) FROM model_identity_feature_intents) AS intents,
        (SELECT COUNT(*) FROM casting_evidence_candidates) AS candidates,
        (SELECT COUNT(*) FROM casting_evidence_candidate_attempts) AS attempts,
        (SELECT COUNT(*) FROM model_identity_features) AS features,
        (SELECT COUNT(*) FROM model_identity_feature_versions) AS featureVersions,
        (SELECT COUNT(*) FROM model_snapshot_feature_selections) AS featureSelections`,
    );
    for (const field of ["receipts", "plates", "crops", "privateCleanupItems"]) {
      if (Number(beforeCounts?.[field]) !== Number(afterCounts?.[field])) {
        throw new Error("evidence_composer_existing_row_count_changed");
      }
    }
    for (const field of [
      "intents",
      "candidates",
      "attempts",
      "features",
      "featureVersions",
      "featureSelections",
    ]) {
      if (Number(afterCounts?.[field]) !== 0) {
        throw new Error("evidence_composer_new_table_not_empty");
      }
    }

    process.stdout.write(`${JSON.stringify({
      mode: "production-evidence-composer-migration",
      target: { appId: args.appId, host: args.host, database: args.database },
      from: PREVIOUS_TAG,
      to: TARGET_TAG,
      preservedRows: {
        receipts: Number(afterCounts?.receipts),
        referencePlates: Number(afterCounts?.plates),
        crops: Number(afterCounts?.crops),
        privateCleanupItems: Number(afterCounts?.privateCleanupItems),
      },
      newRows: {
        intents: 0,
        candidates: 0,
        attempts: 0,
        features: 0,
        featureVersions: 0,
        featureSelections: 0,
      },
      schemaVerified: true,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch(() => {
  process.stderr.write("evidence_composer_migration_failed\n");
  process.exit(1);
});

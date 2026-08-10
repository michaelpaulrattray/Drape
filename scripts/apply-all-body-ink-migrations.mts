/**
 * Exact R7-7G production migration runner. It refuses unless 0015 and 0016
 * are the only pending migrations, production is exactly at 0014, all
 * evidence authorities are off, and existing lifecycle rows pass the
 * reviewed compatibility checks.
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
import { assertEvidencePackageScopeOff } from "../server/casting/evidence/evidenceAcceptedAssetMigrationCeremony";
import { assertEvidenceComposerSchemaWithClient } from "../server/casting/evidence/evidenceComposerSchema";

const PREVIOUS_TAG = "0014_r7_evidence_accepted_asset";
const TARGET_TAGS = [
  "0015_r7_all_body_ink",
  "0016_r7_all_body_ink_projection_targets",
] as const;

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

const PRESERVED_COUNTS = {
  intents: "model_identity_feature_intents",
  candidates: "casting_evidence_candidates",
  attempts: "casting_evidence_candidate_attempts",
  features: "model_identity_features",
  featureVersions: "model_identity_feature_versions",
  featureSelections: "model_snapshot_feature_selections",
} as const;

async function main(): Promise<void> {
  const args = parseEvidenceComposerMigrationArgs(process.argv.slice(2));
  assertEvidenceComposerMigrationScopesOff({
    composerScope: process.env.R7_EVIDENCE_COMPOSER_SCOPE,
    composerRecipe: process.env.R7_EVIDENCE_COMPOSER_RECIPE,
    candidateWorker: process.env.ENABLE_EVIDENCE_CANDIDATE_WORKER,
    ingestScope: process.env.R7_EVIDENCE_INGEST_SCOPE,
  });
  assertEvidencePackageScopeOff(process.env.R7_EVIDENCE_PACKAGE_SCOPE);

  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  ) as { entries?: JournalEntry[] };
  const entries = journal.entries ?? [];
  const previous = entries.at(-3);
  const targets = entries.slice(-2);
  if (
    previous?.tag !== PREVIOUS_TAG
    || targets.length !== 2
    || targets.some(
      (entry, index) =>
        entry.tag !== TARGET_TAGS[index]
        || entry.idx !== previous.idx + index + 1,
    )
  ) {
    throw new Error("all_body_ink_local_migration_range_mismatch");
  }
  const previousSql = await readFile(`drizzle/${PREVIOUS_TAG}.sql`, "utf8");
  const previousHash = createHash("sha256").update(previousSql).digest("hex");
  const targetHashes = await Promise.all(
    TARGET_TAGS.map(async (tag) =>
      createHash("sha256")
        .update(await readFile(`drizzle/${tag}.sql`, "utf8"))
        .digest("hex"),
    ),
  );

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
      throw new Error("all_body_ink_production_migration_precondition_failed");
    }

    const [unexpectedTables] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'model_identity_feature_projection_evidence',
            'casting_evidence_candidate_feature_targets'
          )`,
    );
    const [unexpectedColumns] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME, COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND (
            (TABLE_NAME = 'casting_evidence_candidates' AND COLUMN_NAME = 'purpose')
            OR (
              TABLE_NAME = 'casting_evidence_candidate_attempts'
              AND COLUMN_NAME = 'priorInkOutcome'
            )
            OR (
              TABLE_NAME IN (
                'model_identity_features',
                'model_identity_feature_versions'
              )
              AND COLUMN_NAME = 'createdByOperationStepKey'
            )
          )`,
    );
    if (unexpectedTables.length !== 0 || unexpectedColumns.length !== 0) {
      throw new Error("all_body_ink_production_schema_precondition_failed");
    }

    const [activeDuplicates] = await pool.query<RowDataPacket[]>(
      `SELECT modelId
         FROM casting_evidence_candidates
        WHERE activeSlot = 'active'
        GROUP BY modelId
       HAVING COUNT(*) > 1
        LIMIT 1`,
    );
    if (activeDuplicates.length !== 0) {
      throw new Error("all_body_ink_active_candidate_conflict");
    }

    const before: Record<string, number> = {};
    for (const [label, table] of Object.entries(PRESERVED_COUNTS)) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM \`${table}\``,
      );
      before[label] = Number(row.count);
    }

    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await assertEvidenceComposerSchemaWithClient(pool);

    const [postRows] = await pool.query<RowDataPacket[]>(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    const finalTarget = targets.at(-1)!;
    if (
      postRows.length !== 1
      || Number(postRows[0].created_at) !== finalTarget.when
      || String(postRows[0].hash) !== targetHashes.at(-1)
    ) {
      throw new Error("all_body_ink_production_migration_postcondition_failed");
    }

    const after: Record<string, number> = {};
    for (const [label, table] of Object.entries(PRESERVED_COUNTS)) {
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM \`${table}\``,
      );
      after[label] = Number(row.count);
      if (after[label] !== before[label]) {
        throw new Error("all_body_ink_existing_row_count_changed");
      }
    }
    const [[defaults]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM casting_evidence_candidates
           WHERE purpose <> 'feature_authoring') AS nonAuthoringCandidates,
         (SELECT COUNT(*) FROM model_identity_features
           WHERE createdByOperationStepKey <> 'primary') AS nonPrimaryFeatures,
         (SELECT COUNT(*) FROM model_identity_feature_versions
           WHERE createdByOperationStepKey <> 'primary')
           AS nonPrimaryFeatureVersions,
         (SELECT COUNT(*) FROM casting_evidence_candidate_attempts
           WHERE priorInkOutcome IS NOT NULL) AS priorInkOutcomes`,
    );
    if (
      Number(defaults?.nonAuthoringCandidates ?? 0) !== 0
      || Number(defaults?.nonPrimaryFeatures ?? 0) !== 0
      || Number(defaults?.nonPrimaryFeatureVersions ?? 0) !== 0
      || Number(defaults?.priorInkOutcomes ?? 0) !== 0
    ) {
      throw new Error("all_body_ink_mixed_version_defaults_changed");
    }

    const [[newRows]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM model_identity_feature_projection_evidence)
           AS projections,
         (SELECT COUNT(*) FROM casting_evidence_candidate_feature_targets)
           AS projectionTargets`,
    );
    if (
      Number(newRows.projections) !== 0
      || Number(newRows.projectionTargets) !== 0
    ) {
      throw new Error("all_body_ink_new_table_not_empty");
    }

    process.stdout.write(`${JSON.stringify({
      mode: "production-all-body-ink-migrations",
      target: { appId: args.appId, host: args.host, database: args.database },
      from: PREVIOUS_TAG,
      to: TARGET_TAGS.at(-1),
      preservedRows: after,
      newRows: { projections: 0, projectionTargets: 0 },
      schemaVerified: true,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch(() => {
  process.stderr.write("all_body_ink_migration_failed\n");
  process.exit(1);
});

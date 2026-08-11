/**
 * Exact C5D production migration runner. It refuses unless local migration
 * 0012 is the sole pending migration and production is still at 0011.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import {
  assertPrivateEvidenceCleanupSchemaWithClient,
} from "../server/casting/evidence/privateEvidenceSchema";
import {
  assertPrivateEvidenceScopeOff,
  parsePrivateEvidenceCeremonyArgs,
} from "../server/casting/evidence/privateEvidenceCeremony";
import { openPool } from "./lib/dbConnection.mts";

const PREVIOUS_TAG = "0011_r7_evidence_ingestion";
const TARGET_TAG = "0012_r7_private_evidence_cleanup_backend";

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function main(): Promise<void> {
  const args = parsePrivateEvidenceCeremonyArgs(
    process.argv.slice(2),
    "migration",
  );
  assertPrivateEvidenceScopeOff(process.env.R7_EVIDENCE_INGEST_SCOPE);
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
    throw new Error("private_evidence_local_migration_range_mismatch");
  }
  const previousSql = await readFile(`drizzle/${PREVIOUS_TAG}.sql`, "utf8");
  const targetSql = await readFile(`drizzle/${TARGET_TAG}.sql`, "utf8");
  const previousHash = createHash("sha256").update(previousSql).digest("hex");
  const targetHash = createHash("sha256").update(targetSql).digest("hex");
  const pool = openPool({
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
      throw new Error("private_evidence_production_migration_precondition_failed");
    }
    const [[counts]] = await pool.query<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM casting_evidence_ingestions) AS receipts, (SELECT COUNT(*) FROM model_reference_plates) AS plates, (SELECT COUNT(*) FROM model_evidence_crops) AS crops",
    );
    if (
      Number(counts?.receipts) !== 0
      || Number(counts?.plates) !== 0
      || Number(counts?.crops) !== 0
    ) {
      throw new Error("private_evidence_migration_requires_empty_evidence_tables");
    }
    const [columnRows] = await pool.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storage_cleanup_items' AND COLUMN_NAME = 'storageBackend'",
    );
    const [indexRows] = await pool.query<RowDataPacket[]>(
      "SELECT NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'storage_cleanup_items' AND INDEX_NAME = 'uq_storage_cleanup_items_batch_key' ORDER BY SEQ_IN_INDEX",
    );
    if (
      columnRows.length !== 0
      || indexRows.length !== 2
      || indexRows.some((row, index) => (
        Number(row.NON_UNIQUE) !== 0
        || Number(row.SEQ_IN_INDEX) !== index + 1
        || String(row.COLUMN_NAME) !== ["batchId", "storageKey"][index]
      ))
    ) {
      throw new Error("private_evidence_production_schema_precondition_failed");
    }
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await assertPrivateEvidenceCleanupSchemaWithClient(pool);
    const [postRows] = await pool.query<RowDataPacket[]>(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    if (
      postRows.length !== 1
      || Number(postRows[0].created_at) !== target.when
      || String(postRows[0].hash) !== targetHash
    ) {
      throw new Error("private_evidence_production_migration_postcondition_failed");
    }
    process.stdout.write(`${JSON.stringify({
      mode: "production-private-evidence-migration",
      target: { appId: args.appId, host: args.host, database: args.database },
      from: PREVIOUS_TAG,
      to: TARGET_TAG,
      evidenceRows: { receipts: 0, referencePlates: 0, crops: 0 },
      schemaVerified: true,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch(() => {
  process.stderr.write("private_evidence_migration_failed\n");
  process.exit(1);
});

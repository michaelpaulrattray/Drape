import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CASTING_EVIDENCE_ENTITY_KINDS,
  CASTING_EVIDENCE_INGESTION_PURPOSES,
  CASTING_EVIDENCE_INGESTION_STATUSES,
  MODEL_REFERENCE_PLATE_KINDS,
  STORAGE_CLEANUP_BATCH_KINDS,
} from "../drizzle/schema";
import {
  GENERATION_OPERATION_KINDS,
  assertGenerationOperationKind,
} from "./casting/operationContract";

describe("R7-7C1 owned-evidence schema contract", () => {
  async function runtimeSources(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return runtimeSources(path);
      if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.(?:test|integration\.test)\.(?:ts|tsx)$/.test(entry.name)) {
        return [];
      }
      return [path];
    }));
    return nested.flat();
  }

  it("keeps every C1 vocabulary closed and excludes premature candidate policy", () => {
    expect(CASTING_EVIDENCE_INGESTION_PURPOSES).toEqual([
      "reference_plate",
      "evidence_crop",
    ]);
    expect(CASTING_EVIDENCE_INGESTION_STATUSES).toEqual([
      "planned",
      "stored",
      "attached",
      "cleanup_pending",
      "cleaned",
    ]);
    expect(CASTING_EVIDENCE_ENTITY_KINDS).toEqual([
      "reference_plate",
      "evidence_crop",
    ]);
    expect(MODEL_REFERENCE_PLATE_KINDS).toEqual(["uploaded_reference"]);
    expect(STORAGE_CLEANUP_BATCH_KINDS).toEqual([
      "model_delete",
      "account_delete",
      "evidence_cleanup",
    ]);
    expect(GENERATION_OPERATION_KINDS).toContain("evidence_plate_ingest");
    expect(GENERATION_OPERATION_KINDS).toContain("evidence_plate_discard");
    expect(() => assertGenerationOperationKind("evidence_plate_ingest")).not.toThrow();
    expect(() => assertGenerationOperationKind("evidence_plate_discard")).not.toThrow();
    expect([
      ...CASTING_EVIDENCE_INGESTION_PURPOSES,
      ...MODEL_REFERENCE_PLATE_KINDS,
    ]).not.toContain("candidate_output");
    expect([
      ...CASTING_EVIDENCE_INGESTION_PURPOSES,
      ...MODEL_REFERENCE_PLATE_KINDS,
    ]).not.toContain("legacy_adoption");
  });

  it("keeps migration 0011 additive, URL-free, FK-free and exactly bounded", async () => {
    const sql = await readFile(
      new URL("../drizzle/0011_r7_evidence_ingestion.sql", import.meta.url),
      "utf8",
    );
    const statements = sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean);

    expect(statements).toHaveLength(9);
    expect(statements.filter((statement) => /^CREATE TABLE/i.test(statement))).toHaveLength(3);
    expect(statements.filter((statement) => /^CREATE INDEX/i.test(statement))).toHaveLength(5);
    expect(statements.filter((statement) => /^ALTER TABLE/i.test(statement))).toEqual([
      expect.stringMatching(
        /ALTER TABLE `storage_cleanup_batches` MODIFY COLUMN `kind` enum\('model_delete','account_delete','evidence_cleanup'\) NOT NULL/i,
      ),
    ]);
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|RENAME)\b/i);
    expect(sql).not.toMatch(/\b(FOREIGN KEY|REFERENCES|CASCADE)\b/i);
    expect(sql).not.toMatch(/url/i);
    expect(sql).not.toMatch(/\b(?:prompt|descriptor|providerResponse|rawBytes|base64)\b/i);
    expect(sql).not.toMatch(/casting_evidence_candidates|candidate_output|accepted_candidate|legacy_adoption/);
    expect(sql).toContain("`cleanupBatchId` varchar(36)");
    expect(sql).toContain("`status` enum('planned','stored','attached','cleanup_pending','cleaned')");
    expect(sql).toContain("CONSTRAINT `uq_casting_evidence_ingestions_operation` UNIQUE(`operationId`)");
    expect(sql).toContain("CONSTRAINT `uq_casting_evidence_ingestions_storage_key` UNIQUE(`storageKey`)");
    expect(sql).toContain("CONSTRAINT `uq_model_reference_plates_storage_key` UNIQUE(`storageKey`)");
    expect(sql).toContain("CONSTRAINT `uq_model_evidence_crops_storage_key` UNIQUE(`storageKey`)");
  });

  it("changes the 0010 snapshot only by three tables and the cleanup-kind widening", async () => {
    const before = JSON.parse(await readFile(
      new URL("../drizzle/meta/0010_snapshot.json", import.meta.url),
      "utf8",
    ));
    const after = JSON.parse(await readFile(
      new URL("../drizzle/meta/0011_snapshot.json", import.meta.url),
      "utf8",
    ));
    expect(after.prevId).toBe(before.id);

    const expected = structuredClone(before);
    expected.id = after.id;
    expected.prevId = before.id;
    for (const table of [
      "casting_evidence_ingestions",
      "model_reference_plates",
      "model_evidence_crops",
    ]) {
      expected.tables[table] = after.tables[table];
      expect(Object.keys(after.tables[table].foreignKeys)).toEqual([]);
    }
    expected.tables.storage_cleanup_batches.columns.kind =
      after.tables.storage_cleanup_batches.columns.kind;
    expect(after).toEqual(expected);
  });

  it("keeps C1 inert and the existing cleanup delete loop kind-agnostic", async () => {
    const evidenceTokens = [
      "castingEvidenceIngestions",
      "modelReferencePlates",
      "modelEvidenceCrops",
    ];
    const callers: string[] = [];
    for (const file of await runtimeSources("server")) {
      const source = await readFile(file, "utf8");
      if (evidenceTokens.some((token) => source.includes(token))) {
        callers.push(file.replaceAll("\\", "/"));
      }
    }
    expect(callers).toEqual([
      "server/db/evidenceIngestion.ts",
    ]);

    const cleanupDb = await readFile(
      new URL("./db/storageCleanup.ts", import.meta.url),
      "utf8",
    );
    expect(cleanupDb).not.toContain("storageCleanupBatches.kind");
    expect(cleanupDb).not.toMatch(/switch\s*\([^)]*kind[^)]*\)/);
  });

  it("pins the guarded disposable driver to migration 0011 only", async () => {
    const driver = await readFile(
      new URL("../scripts/drive-r7-evidence-schema-disposable.mts", import.meta.url),
      "utf8",
    );
    expect(driver).toContain('const PREFIX = "drape_r7_7c1_disposable_"');
    expect(driver).toContain('process.env.VITE_APP_ID !== "drape-local"');
    expect(driver).toContain("Refusing disposable database work outside the documented local app id");
    expect(driver).toContain("configured development URL must target the railway MySQL database");
    expect(driver).toContain("applyMigrationRange(connection, 0, 10)");
    expect(driver).toContain("applyMigrationRange(connection, 11, 11)");
    expect(driver).toContain("DROP DATABASE IF EXISTS");
    expect(driver).not.toMatch(/storage(Put|Delete|List)|Gemini|generateContent|deductPoints/i);
  });
});

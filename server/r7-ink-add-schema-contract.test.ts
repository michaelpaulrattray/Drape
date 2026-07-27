import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  GENERATION_OPERATION_KINDS,
  GENERATION_OPERATION_PHASES,
  assertGenerationOperationKind,
  assertGenerationOperationPhase,
} from "./casting/operationContract";

async function readJson(path: URL): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sourceFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: URL[] = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(url);
    }
  }
  return files;
}

describe("R7-7D migration and reachability contract", () => {
  it("contains only the reviewed additive/widening 0013 schema operations", async () => {
    const sql = await readFile(
      new URL("../drizzle/0013_r7_ink_add_candidates.sql", import.meta.url),
      "utf8",
    );
    for (const table of [
      "model_identity_feature_intents",
      "casting_evidence_candidates",
      "casting_evidence_candidate_attempts",
      "model_identity_features",
      "model_identity_feature_versions",
      "model_snapshot_feature_selections",
    ]) {
      expect(sql).toContain(`CREATE TABLE \`${table}\``);
    }
    expect(sql).toContain(
      "ADD `stepKey` varchar(64) DEFAULT 'primary' NOT NULL",
    );
    expect(sql).toContain(
      "ADD `createdByOperationStepKey` varchar(64) DEFAULT 'primary' NOT NULL",
    );
    expect(sql).toContain(
      "UNIQUE(`operationId`,`stepKey`)",
    );
    expect(sql).toContain(
      "UNIQUE(`createdByOperationId`,`createdByOperationStepKey`)",
    );
    expect(sql).toContain("'provisioning'");
    expect(sql).toContain("'evidenceCandidate'");
    expect(sql).toContain("'candidate_cleanup'");
    expect(sql).toContain("'accepted_candidate'");
    expect(sql).toContain("'fork_copy'");
    expect(sql).toContain("'evidence_accept'");
    expect(sql).toContain(
      "CONSTRAINT `chk_evidence_candidate_attempt_number` CHECK",
    );
    expect(sql).toContain("`attemptNumber` in (1, 2)");
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b/i);
    for (const [added, retired] of [
      [
        "ADD CONSTRAINT `uq_casting_evidence_ingestions_operation_step`",
        "DROP INDEX `uq_casting_evidence_ingestions_operation`",
      ],
      [
        "ADD CONSTRAINT `uq_model_evidence_crops_operation_step`",
        "DROP INDEX `uq_model_evidence_crops_operation`",
      ],
      [
        "ADD CONSTRAINT `uq_model_reference_plates_operation_step`",
        "DROP INDEX `uq_model_reference_plates_operation`",
      ],
    ]) {
      expect(sql.indexOf(added)).toBeGreaterThan(0);
      expect(sql.indexOf(retired)).toBeGreaterThan(sql.indexOf(added));
    }
  });

  it("preserves the complete 0012 schema outside the explicit D1 delta", async () => {
    const before = await readJson(
      new URL("../drizzle/meta/0012_snapshot.json", import.meta.url),
    );
    const after = await readJson(
      new URL("../drizzle/meta/0013_snapshot.json", import.meta.url),
    );
    const normalized = structuredClone(after.tables);

    for (const table of [
      "model_identity_feature_intents",
      "casting_evidence_candidates",
      "casting_evidence_candidate_attempts",
      "model_identity_features",
      "model_identity_feature_versions",
      "model_snapshot_feature_selections",
    ]) {
      delete normalized[table];
    }

    for (const [table, column] of [
      ["models", "status"],
      ["generations", "type"],
      ["storage_cleanup_batches", "kind"],
      ["model_package_snapshots", "reason"],
      ["model_package_snapshot_slots", "selectionReason"],
      ["model_reference_plates", "kind"],
      ["casting_evidence_ingestions", "purpose"],
    ]) {
      normalized[table].columns[column] =
        structuredClone(before.tables[table].columns[column]);
    }

    delete normalized.model_reference_plates.columns.featureIntentId;
    delete normalized.model_reference_plates.columns.createdByOperationStepKey;
    delete normalized.model_reference_plates.indexes
      .uq_model_reference_plates_feature_intent;
    delete normalized.model_reference_plates.indexes
      .uq_model_reference_plates_operation_step;
    normalized.model_reference_plates.indexes
      .uq_model_reference_plates_operation = structuredClone(
        before.tables.model_reference_plates.indexes
          .uq_model_reference_plates_operation,
      );

    delete normalized.model_evidence_crops.columns.createdByOperationStepKey;
    delete normalized.model_evidence_crops.indexes
      .uq_model_evidence_crops_operation_step;
    normalized.model_evidence_crops.indexes.uq_model_evidence_crops_operation =
      structuredClone(
        before.tables.model_evidence_crops.indexes
          .uq_model_evidence_crops_operation,
      );

    delete normalized.casting_evidence_ingestions.columns.stepKey;
    delete normalized.casting_evidence_ingestions.indexes
      .uq_casting_evidence_ingestions_operation_step;
    normalized.casting_evidence_ingestions.indexes
      .uq_casting_evidence_ingestions_operation = structuredClone(
        before.tables.casting_evidence_ingestions.indexes
          .uq_casting_evidence_ingestions_operation,
      );

    expect(normalized).toEqual(before.tables);
  });

  it("adds the closed parent-operation kinds and phases", () => {
    for (const kind of [
      "evidence_intent_begin",
      "evidence_intent_reference",
      "evidence_candidate_generate",
      "evidence_candidate_retry",
      "evidence_candidate_accept",
      "evidence_candidate_cancel",
      "evidence_fork_copy",
    ] as const) {
      expect(GENERATION_OPERATION_KINDS).toContain(kind);
      expect(() => assertGenerationOperationKind(kind)).not.toThrow();
    }
    for (const phase of [
      "validating",
      "probing",
      "awaiting_acceptance",
      "cleaning",
    ] as const) {
      expect(GENERATION_OPERATION_PHASES).toContain(phase);
      expect(() => assertGenerationOperationPhase(phase)).not.toThrow();
    }
  });

  it("keeps the D1 candidate contract private while allowing only the closed D4A scope route", async () => {
    const routes = await sourceFiles(new URL("./routes/", import.meta.url));
    const scopeCallers: string[] = [];
    for (const file of routes) {
      const source = await readFile(file, "utf8");
      expect(source).not.toMatch(/evidenceCandidateContract|evidenceComposerSchema/);
      if (source.includes("evidenceComposerScope")) {
        scopeCallers.push(file.pathname.replace(/^.*\/server\//, "server/"));
      }
    }
    expect(scopeCallers).toEqual(["server/routes/evidence.ts"]);
  });
});

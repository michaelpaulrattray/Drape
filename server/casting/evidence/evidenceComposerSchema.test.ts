import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  EvidenceComposerSchemaMismatchError,
  EvidenceComposerSchemaUnavailableError,
  assertEvidenceComposerSchema,
  assertEvidenceComposerSchemaWithClient,
} from "./evidenceComposerSchema";

interface SnapshotColumn {
  name: string;
  type: string;
  notNull: boolean;
  default?: unknown;
}

interface SnapshotIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
}

interface SnapshotTable {
  columns: Record<string, SnapshotColumn>;
  indexes: Record<string, SnapshotIndex>;
  compositePrimaryKeys: Record<string, { columns: string[] }>;
  checkConstraint: Record<string, { name: string; value: string }>;
}

interface Snapshot {
  tables: Record<string, SnapshotTable>;
}

function mysqlDefault(value: unknown): string | null {
  if (value === undefined) return null;
  const rendered = String(value);
  if (rendered.startsWith("'") && rendered.endsWith("'")) {
    return rendered.slice(1, -1);
  }
  return rendered;
}

async function snapshotRows() {
  const snapshot = JSON.parse(await readFile(
    new URL("../../../drizzle/meta/0017_snapshot.json", import.meta.url),
    "utf8",
  )) as Snapshot;
  const columns = Object.entries(snapshot.tables).flatMap(
    ([TABLE_NAME, table]) => Object.values(table.columns).map((column) => ({
      TABLE_NAME,
      COLUMN_NAME: column.name,
      COLUMN_TYPE: column.type,
      IS_NULLABLE: column.notNull ? "NO" : "YES",
      COLUMN_DEFAULT: mysqlDefault(column.default),
    })),
  );
  // Drizzle snapshots follow declaration order. MySQL appends a column added
  // by ALTER TABLE, so model the physical order verified at startup.
  const priorInkIndex = columns.findIndex(
    (row) =>
      row.TABLE_NAME === "casting_evidence_candidate_attempts"
      && row.COLUMN_NAME === "priorInkOutcome",
  );
  if (priorInkIndex < 0) throw new Error("prior ink outcome fixture missing");
  const [priorInkColumn] = columns.splice(priorInkIndex, 1);
  const lastAttemptIndex = columns.findLastIndex(
    (row) => row.TABLE_NAME === "casting_evidence_candidate_attempts",
  );
  columns.splice(lastAttemptIndex + 1, 0, priorInkColumn);
  // And migration 0024, which has no snapshot to read: it is the ceremony
  // migration the FOUNDER runs against production by hand (applied 2026-08-08),
  // so drizzle-kit never generated one. The fixture models the live database,
  // and the live database has run it — the same reasoning that kept this value
  // OUT of the pinned DDL until the day it landed. Modelled here rather than
  // hardcoded beside the pin so the two cannot agree with each other by being
  // copies of each other.
  const batchKind = columns.find(
    (row) => row.TABLE_NAME === "storage_cleanup_batches" && row.COLUMN_NAME === "kind",
  );
  if (!batchKind) throw new Error("storage cleanup batch kind fixture missing");
  batchKind.COLUMN_TYPE = batchKind.COLUMN_TYPE.replace(
    /\)$/,
    ",'casting_diagnostic_cleanup')",
  );
  const indexes = Object.entries(snapshot.tables).flatMap(
    ([TABLE_NAME, table]) => {
      const ordinary = Object.values(table.indexes).flatMap((index) =>
        index.columns.map((COLUMN_NAME, offset) => ({
          TABLE_NAME,
          INDEX_NAME: index.name,
          NON_UNIQUE: index.isUnique ? 0 : 1,
          SEQ_IN_INDEX: offset + 1,
          COLUMN_NAME,
        })));
      const primary = Object.values(table.compositePrimaryKeys).flatMap(
        (index) => index.columns.map((COLUMN_NAME, offset) => ({
          TABLE_NAME,
          INDEX_NAME: "PRIMARY",
          NON_UNIQUE: 0,
          SEQ_IN_INDEX: offset + 1,
          COLUMN_NAME,
        })),
      );
      return [...ordinary, ...primary];
    },
  );
  const checks = Object.values(
    snapshot.tables.casting_evidence_candidate_attempts.checkConstraint,
  ).map((constraint) => ({
    CONSTRAINT_NAME: constraint.name,
    CHECK_CLAUSE: constraint.value,
  }));
  return { columns, indexes, checks };
}

function client(rows: Awaited<ReturnType<typeof snapshotRows>>) {
  return {
    query: vi.fn(async (statement: string) => (
      statement.includes("information_schema.COLUMNS")
        ? [rows.columns, []]
        : statement.includes("information_schema.STATISTICS")
          ? [rows.indexes, []]
          : [rows.checks, []]
    )),
  };
}

describe("R7-7G composer startup schema fence", () => {
  it("accepts the current generated shape and rejects partial or stale shapes", async () => {
    const healthy = await snapshotRows();
    await expect(assertEvidenceComposerSchemaWithClient(client(healthy)))
      .resolves.toBeUndefined();
    const mysqlCanonicalCheck = structuredClone(healthy);
    mysqlCanonicalCheck.checks[0].CHECK_CLAUSE =
      "((`attemptNumber` in (1, 2)))";
    await expect(assertEvidenceComposerSchemaWithClient(
      client(mysqlCanonicalCheck),
    )).resolves.toBeUndefined();

    const missingColumn = structuredClone(healthy);
    missingColumn.columns = missingColumn.columns.filter(
      (row) => !(
        row.TABLE_NAME === "casting_evidence_candidates"
        && row.COLUMN_NAME === "activeSlot"
      ),
    );
    await expect(assertEvidenceComposerSchemaWithClient(client(missingColumn)))
      .rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);

    const staleEnum = structuredClone(healthy);
    const modelStatus = staleEnum.columns.find(
      (row) => row.TABLE_NAME === "models" && row.COLUMN_NAME === "status",
    );
    if (!modelStatus) throw new Error("models.status fixture missing");
    modelStatus.COLUMN_TYPE = "enum('draft','active','locked','archived')";
    await expect(assertEvidenceComposerSchemaWithClient(client(staleEnum)))
      .rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);

    const stalePurpose = structuredClone(healthy);
    const candidatePurpose = stalePurpose.columns.find(
      (row) =>
        row.TABLE_NAME === "casting_evidence_candidates"
        && row.COLUMN_NAME === "purpose",
    );
    if (!candidatePurpose) throw new Error("candidate purpose fixture missing");
    candidatePurpose.COLUMN_TYPE = "enum('feature_authoring')";
    await expect(assertEvidenceComposerSchemaWithClient(client(stalePurpose)))
      .rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);

    const staleProjectionShape = structuredClone(healthy);
    staleProjectionShape.columns = staleProjectionShape.columns.filter(
      (row) => !(
        row.TABLE_NAME === "casting_evidence_candidate_feature_targets"
        && row.COLUMN_NAME === "coverageBasis"
      ),
    );
    await expect(assertEvidenceComposerSchemaWithClient(
      client(staleProjectionShape),
    )).rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);

    const stalePriorInk = structuredClone(healthy);
    const priorInk = stalePriorInk.columns.find(
      (row) =>
        row.TABLE_NAME === "casting_evidence_candidate_attempts"
        && row.COLUMN_NAME === "priorInkOutcome",
    );
    if (!priorInk) throw new Error("prior ink outcome fixture missing");
    priorInk.COLUMN_TYPE = "varchar(16)";
    await expect(assertEvidenceComposerSchemaWithClient(client(stalePriorInk)))
      .rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);

    const staleIndex = structuredClone(healthy);
    staleIndex.indexes.push({
      TABLE_NAME: "casting_evidence_ingestions",
      INDEX_NAME: "uq_casting_evidence_ingestions_operation",
      NON_UNIQUE: 0,
      SEQ_IN_INDEX: 1,
      COLUMN_NAME: "operationId",
    });
    await expect(assertEvidenceComposerSchemaWithClient(client(staleIndex)))
      .rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);

    const missingCheck = structuredClone(healthy);
    missingCheck.checks = [];
    await expect(assertEvidenceComposerSchemaWithClient(client(missingCheck)))
      .rejects.toBeInstanceOf(EvidenceComposerSchemaMismatchError);
  });

  it("retries only unavailable schema reads and exposes closed errors", async () => {
    const healthy = client(await snapshotRows());
    const getClient = vi.fn()
      .mockRejectedValueOnce(new Error("temporary database startup failure"))
      .mockResolvedValue(healthy);
    await expect(assertEvidenceComposerSchema({
      attempts: 2,
      retryDelayMs: 0,
      getClient,
    })).resolves.toBeUndefined();
    expect(getClient).toHaveBeenCalledTimes(2);

    const unavailable = new Error("still unavailable");
    await expect(assertEvidenceComposerSchema({
      attempts: 2,
      retryDelayMs: 0,
      getClient: vi.fn(async () => {
        throw unavailable;
      }),
    })).rejects.toMatchObject({
      name: "EvidenceComposerSchemaUnavailableError",
      cause: unavailable,
    });
    expect(new EvidenceComposerSchemaUnavailableError(unavailable).message)
      .not.toContain("0013");
  });

  it("runs the conditional composer proof before Express can accept traffic", async () => {
    const source = await readFile(
      new URL("../../_core/index.ts", import.meta.url),
      "utf8",
    );
    const condition = source.indexOf("if (evidenceComposerSchemaRequired())");
    const assertion = source.indexOf("await assertEvidenceComposerSchema()");
    const express = source.indexOf("const app = express()");
    expect(condition).toBeGreaterThan(0);
    expect(assertion).toBeGreaterThan(condition);
    expect(assertion).toBeLessThan(express);
  });
});

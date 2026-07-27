import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  PrivateEvidenceSchemaMismatchError,
  PrivateEvidenceSchemaUnavailableError,
  assertPrivateEvidenceCleanupSchema,
  assertPrivateEvidenceCleanupSchemaWithClient,
  promiseSchemaQueryClient,
} from "./privateEvidenceSchema";

function client(input: {
  columnType?: string;
  nullable?: string;
  defaultValue?: string | null;
  indexColumns?: readonly string[];
}) {
  const query = vi.fn(async (statement: string) => {
    if (statement.includes("information_schema.COLUMNS")) {
      return [[{
        COLUMN_TYPE:
          input.columnType ?? "enum('public_r2','private_evidence_r2')",
        IS_NULLABLE: input.nullable ?? "NO",
        COLUMN_DEFAULT:
          input.defaultValue === undefined ? "public_r2" : input.defaultValue,
      }], []];
    }
    return [[...(input.indexColumns ?? [
      "batchId",
      "storageBackend",
      "storageKey",
    ])].map((COLUMN_NAME, index) => ({
      NON_UNIQUE: 0,
      SEQ_IN_INDEX: index + 1,
      COLUMN_NAME,
    })), []];
  });
  return { query };
}

describe("R7-7C5B adapter-capable startup schema fence", () => {
  it("accepts only the exact closed column and tuple uniqueness law", async () => {
    await expect(assertPrivateEvidenceCleanupSchemaWithClient(client({})))
      .resolves.toBeUndefined();
    for (const invalid of [
      { columnType: "varchar(32)" },
      { nullable: "YES" },
      { defaultValue: null },
      { indexColumns: ["batchId", "storageKey"] },
      { indexColumns: ["batchId", "storageKey", "storageBackend"] },
    ]) {
      await expect(assertPrivateEvidenceCleanupSchemaWithClient(client(invalid)))
        .rejects.toEqual(new PrivateEvidenceSchemaMismatchError());
    }
  });

  it("is invoked before Express can accept traffic", async () => {
    const source = await readFile(
      new URL("../../_core/index.ts", import.meta.url),
      "utf8",
    );
    const assertion = source.indexOf("await assertPrivateEvidenceCleanupSchema()");
    const express = source.indexOf("const app = express()");
    expect(assertion).toBeGreaterThan(0);
    expect(assertion).toBeLessThan(express);
  });

  it("crosses the production mysql2 pool's promise boundary before querying", async () => {
    const promised = client({});
    const rawQuery = vi.fn(() => {
      throw new Error("callback Query must never be awaited");
    });
    const promise = vi.fn(() => promised);

    await expect(assertPrivateEvidenceCleanupSchemaWithClient(
      promiseSchemaQueryClient({ query: rawQuery, promise }),
    )).resolves.toBeUndefined();
    expect(promise).toHaveBeenCalledTimes(1);
    expect(rawQuery).not.toHaveBeenCalled();
    expect(promised.query).toHaveBeenCalledTimes(2);

    const source = await readFile(
      new URL("./privateEvidenceSchema.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("promiseSchemaQueryClient(db.$client)");
  });

  it("retries transient verification failures but never retries a proven mismatch", async () => {
    const healthy = client({});
    const transientClient = vi.fn()
      .mockRejectedValueOnce(new Error("temporary connection refusal"))
      .mockResolvedValue(healthy);
    await expect(assertPrivateEvidenceCleanupSchema({
      attempts: 2,
      retryDelayMs: 0,
      getClient: transientClient,
    })).resolves.toBeUndefined();
    expect(transientClient).toHaveBeenCalledTimes(2);

    const unavailable = new Error("database still unreachable");
    await expect(assertPrivateEvidenceCleanupSchema({
      attempts: 2,
      retryDelayMs: 0,
      getClient: vi.fn(async () => {
        throw unavailable;
      }),
    })).rejects.toMatchObject({
      name: "PrivateEvidenceSchemaUnavailableError",
      cause: unavailable,
    });

    const mismatchClient = vi.fn(async () => client({ nullable: "YES" }));
    await expect(assertPrivateEvidenceCleanupSchema({
      attempts: 4,
      retryDelayMs: 0,
      getClient: mismatchClient,
    })).rejects.toBeInstanceOf(PrivateEvidenceSchemaMismatchError);
    expect(mismatchClient).toHaveBeenCalledTimes(1);
    expect(new PrivateEvidenceSchemaUnavailableError(unavailable).message)
      .not.toContain("migration");
  });
});

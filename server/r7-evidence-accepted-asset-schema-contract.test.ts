import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readJson(path: URL): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("R7-7E accepted-asset relation schema contract", () => {
  it("keeps 0014 DDL-only and limited to the reviewed relation", async () => {
    const sql = await readFile(
      new URL("../drizzle/0014_r7_evidence_accepted_asset.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain(
      "ALTER TABLE `model_identity_feature_versions`",
    );
    expect(sql).toMatch(
      /\bMODIFY COLUMN `sourceAssetId` int\b/,
    );
    expect(sql).toMatch(
      /\bADD `acceptedAssetId` int\b/,
    );
    expect(sql).toContain(
      "CONSTRAINT `uq_identity_feature_versions_accepted_asset` UNIQUE(`acceptedAssetId`)",
    );
    expect(sql.match(/\bALTER\s+TABLE\b/gi)).toHaveLength(1);
    expect(sql).not.toContain("statement-breakpoint");
    expect(sql).not.toMatch(
      /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|DROP\s+COLUMN)\b/i,
    );
    expect(sql).not.toMatch(/\b(?:FOREIGN\s+KEY|REFERENCES)\b/i);
  });

  it("preserves the complete 0013 schema outside the explicit 0014 delta", async () => {
    const before = await readJson(
      new URL("../drizzle/meta/0013_snapshot.json", import.meta.url),
    );
    const after = await readJson(
      new URL("../drizzle/meta/0014_snapshot.json", import.meta.url),
    );
    const normalized = structuredClone(after.tables);
    const versionTable = normalized.model_identity_feature_versions;
    delete versionTable.columns.acceptedAssetId;
    delete versionTable.indexes.uq_identity_feature_versions_accepted_asset;
    versionTable.columns.sourceAssetId = structuredClone(
      before.tables.model_identity_feature_versions.columns.sourceAssetId,
    );
    expect(normalized).toEqual(before.tables);
  });
});

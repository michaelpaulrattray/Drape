import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertEvidencePackageScopeOff,
  parseEvidenceAcceptedAssetMigrationArgs,
} from "./casting/evidence/evidenceAcceptedAssetMigrationCeremony";

const common = [
  "--database-url", "mysql://user:pass@example.test:3306/railway",
  "--app-id", "drape-production",
  "--confirm-app-id", "drape-production",
  "--confirm-host", "example.test:3306",
  "--confirm-database", "railway",
  "--expected-version-count", "1",
  "--allow-production-evidence-accepted-asset-migration",
];

describe("R7-7E accepted-asset migration ceremony", () => {
  it("requires exact production target confirmations and count fence", () => {
    expect(parseEvidenceAcceptedAssetMigrationArgs(common)).toMatchObject({
      appId: "drape-production",
      host: "example.test:3306",
      database: "railway",
      expectedVersionCount: 1,
    });
    expect(parseEvidenceAcceptedAssetMigrationArgs(
      common.map((value) => value === "1" ? "0" : value),
    )).toMatchObject({ expectedVersionCount: 0 });
    expect(() => parseEvidenceAcceptedAssetMigrationArgs(
      common.map((value) => value === "1" ? "01" : value),
    )).toThrow("non-negative integer");
    expect(() => parseEvidenceAcceptedAssetMigrationArgs(
      common.filter((value) =>
        value !== "--allow-production-evidence-accepted-asset-migration"
      ),
    )).toThrow("explicit authority");
    expect(() => parseEvidenceAcceptedAssetMigrationArgs(
      common.map((value) => value === "example.test:3306" ? "other.test:3306" : value),
    )).toThrow("confirmation mismatch");
  });

  it("requires package scope off without disabling the other evidence scopes", () => {
    expect(() => assertEvidencePackageScopeOff(undefined)).not.toThrow();
    expect(() => assertEvidencePackageScopeOff("off")).not.toThrow();
    expect(() => assertEvidencePackageScopeOff("users:1"))
      .toThrow("must remain off");
  });

  it("pins the sole migration range and performs no backfill DML", async () => {
    const [script, migration] = await Promise.all([
      readFile(
        new URL(
          "../scripts/apply-evidence-accepted-asset-migration.mts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../drizzle/0014_r7_evidence_accepted_asset.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    expect(script).toContain('const PREVIOUS_TAG = "0013_r7_ink_add_candidates"');
    expect(script).toContain('const TARGET_TAG = "0014_r7_evidence_accepted_asset"');
    expect(script).toContain("assertEvidencePackageScopeOff");
    expect(script).not.toContain("UPDATE model_identity_feature_versions");
    expect(migration).not.toMatch(/\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\b/i);
  });
});

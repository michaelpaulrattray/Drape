import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  parseEvidenceIdentityRevisionRepairArgs,
} from "./evidenceIdentityRevisionRepair";

const DATABASE_URL =
  "mysql://operator:secret@hayabusa.proxy.rlwy.net:23768/railway";

describe("bounded evidence identity-revision repair", () => {
  it("refuses unbounded, malformed and unconfirmed production invocations", () => {
    expect(() => parseEvidenceIdentityRevisionRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--allow-production-read-only",
    ])).toThrow("full-database repair is refused");

    expect(() => parseEvidenceIdentityRevisionRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "01",
      "--allow-production-read-only",
    ])).toThrow("--expected-repair-count must be non-negative");

    expect(() => parseEvidenceIdentityRevisionRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--apply",
      "--allow-evidence-identity-repair-write",
      "--allow-production-evidence-identity-repair",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "wrong.proxy.rlwy.net:23768",
      "--confirm-database", "railway",
    ])).toThrow("--confirm-host must exactly match");
  });

  it("accepts a bounded read-only plan and the full exact apply ceremony", () => {
    expect(parseEvidenceIdentityRevisionRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--allow-production-read-only",
    ])).toMatchObject({
      apply: false,
      userId: 1,
      modelIds: [35],
      expectedModelCount: 1,
      expectedRepairCount: 1,
    });

    expect(parseEvidenceIdentityRevisionRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--apply",
      "--allow-evidence-identity-repair-write",
      "--allow-production-evidence-identity-repair",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "hayabusa.proxy.rlwy.net:23768",
      "--confirm-database", "railway",
    ])).toMatchObject({
      apply: true,
      allowWrite: true,
      allowProductionWrite: true,
      confirmHost: "hayabusa.proxy.rlwy.net:23768",
    });
  });

  it("pins one atomic two-row correction with lock and postflight fences", async () => {
    const source = await readFile(
      new URL("./evidenceIdentityRevisionRepair.ts", import.meta.url),
      "utf8",
    );
    const script = await readFile(
      new URL("../../../scripts/repair-evidence-identity-revisions.ts", import.meta.url),
      "utf8",
    );

    expect(source.match(/\.update\(models\)/g)).toHaveLength(1);
    expect(source.match(/\.update\(modelAssets\)/g)).toHaveLength(1);
    expect(source).not.toMatch(/\.insert\(|\.delete\(/);
    expect(source).toContain("generationOperationLocks");
    expect(source).toContain('.for("update")');
    expect(source).toContain("acceptedAssetId");
    expect(source).toContain("identity.anchorAssetId");
    expect(source).toContain("sameDocuments(identity, parents[0])");
    expect(source).toContain("eq(models.userId, assessment.userId)");
    expect(source).toContain("expectedRepairCount: 0");
    expect(source).toContain('row.status !== "repaired"');
    expect(source).toContain("JSON_SET");
    expect(source).toContain("JSON_UNQUOTE(JSON_EXTRACT");
    expect(script).not.toMatch(/--all|storagePut|deductPoints|generateContent/);
  });
});

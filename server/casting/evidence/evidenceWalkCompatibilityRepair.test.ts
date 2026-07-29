import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  parseEvidenceWalkCompatibilityRepairArgs,
} from "./evidenceWalkCompatibilityRepair";

const DATABASE_URL =
  "mysql://operator:secret@hayabusa.proxy.rlwy.net:23768/railway";

describe("bounded evidence Walk compatibility repair", () => {
  it("refuses unbounded, malformed and unconfirmed production invocations", () => {
    expect(() => parseEvidenceWalkCompatibilityRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--allow-production-read-only",
    ])).toThrow("full-database repair is refused");

    expect(() => parseEvidenceWalkCompatibilityRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "01",
      "--allow-production-read-only",
    ])).toThrow("--expected-repair-count must be non-negative");

    expect(() => parseEvidenceWalkCompatibilityRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--apply",
      "--allow-evidence-walk-compatibility-repair-write",
      "--allow-production-evidence-walk-compatibility-repair",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "wrong.proxy.rlwy.net:23768",
      "--confirm-database", "railway",
    ])).toThrow("--confirm-host must exactly match");
  });

  it("accepts a bounded read-only plan and the full exact apply ceremony", () => {
    expect(parseEvidenceWalkCompatibilityRepairArgs([
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

    expect(parseEvidenceWalkCompatibilityRepairArgs([
      "--database-url", DATABASE_URL,
      "--app-id", "drape-production",
      "--user-id", "1",
      "--model-id", "35",
      "--expected-model-count", "1",
      "--expected-repair-count", "1",
      "--apply",
      "--allow-evidence-walk-compatibility-repair-write",
      "--allow-production-evidence-walk-compatibility-repair",
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

  it("pins one compatibility-only transaction with exact witnesses and postflight", async () => {
    const source = await readFile(
      new URL("./evidenceWalkCompatibilityRepair.ts", import.meta.url),
      "utf8",
    );
    const script = await readFile(
      new URL("../../../scripts/repair-evidence-walk-compatibility.ts", import.meta.url),
      "utf8",
    );

    expect(source.match(/\.update\(modelAssets\)/g)).toHaveLength(1);
    expect(source.match(/\.update\(modelPackageSnapshotSlots\)/g)).toHaveLength(1);
    expect(source).not.toMatch(/\.update\(models\)|\.insert\(|\.delete\(/);
    expect(source).toContain("generationOperationLocks");
    expect(source).toContain('.for("update")');
    expect(source).toContain('eq(modelPackageSnapshotSlots.viewAngle, "sideFull")');
    expect(source).toContain('eq(modelPackageSnapshotSlots.compatibility, "stale")');
    expect(source).toContain('eq(modelPackageSnapshotSlots.selectionReason, "carried")');
    expect(source).toContain('parentSlot.compatibility !== "current"');
    expect(source).toContain('directive.existingSelectionImpact !== "unaffected"');
    expect(source).toContain('directive.visibility !== "hidden_omit"');
    expect(source).toContain("expectedRepairCount: 0");
    expect(source).toContain('row.status !== "repaired"');
    expect(script).not.toMatch(/--all|storagePut|deductPoints|generateContent/);
  });
});

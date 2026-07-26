import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertPrivateEvidenceScopeOff,
  parsePrivateEvidenceCeremonyArgs,
  summarizePrivateEvidenceBucket,
} from "./casting/evidence/privateEvidenceCeremony";

const databaseUrl = "mysql://user:secret@hayabusa.proxy.rlwy.net:23768/railway";
const common = [
  "--database-url", databaseUrl,
  "--app-id", "drape-production",
  "--confirm-app-id", "drape-production",
  "--confirm-host", "hayabusa.proxy.rlwy.net:23768",
  "--confirm-database", "railway",
];

describe("R7-7C5D private evidence ceremony", () => {
  it("requires the full production migration ceremony and exact target", () => {
    expect(parsePrivateEvidenceCeremonyArgs([
      ...common,
      "--allow-production-private-evidence-migration",
    ], "migration")).toMatchObject({
      appId: "drape-production",
      host: "hayabusa.proxy.rlwy.net:23768",
      database: "railway",
    });
    for (const args of [
      common,
      [...common, "--allow-production-private-evidence-migration", "--unknown"],
      [
        ...common,
        "--confirm-host", "other.proxy.rlwy.net:23768",
        "--allow-production-private-evidence-migration",
      ],
    ]) {
      expect(() => parsePrivateEvidenceCeremonyArgs(args, "migration"))
        .toThrow();
    }
  });

  it("requires strict expected fences for probe and audit", () => {
    expect(parsePrivateEvidenceCeremonyArgs([
      ...common,
      "--confirm-evidence-bucket", "drape-production-private-evidence",
      "--expected-object-count", "0",
      "--allow-production-private-evidence-probe",
    ], "probe")).toMatchObject({
      evidenceBucket: "drape-production-private-evidence",
      expectedObjectCount: 0,
    });
    expect(parsePrivateEvidenceCeremonyArgs([
      ...common,
      "--confirm-evidence-bucket", "drape-production-private-evidence",
      "--expected-object-count", "0",
      "--expected-receipt-count", "0",
      "--expected-plate-count", "0",
      "--expected-crop-count", "0",
      "--allow-production-private-evidence-audit",
    ], "audit")).toMatchObject({
      expectedObjectCount: 0,
      expectedReceiptCount: 0,
      expectedPlateCount: 0,
      expectedCropCount: 0,
    });
    for (const count of ["", "00", "-1", "1.5", "1e2", "100000"]) {
      expect(() => parsePrivateEvidenceCeremonyArgs([
        ...common,
        "--confirm-evidence-bucket", "drape-production-private-evidence",
        "--expected-object-count", count,
        "--allow-production-private-evidence-probe",
      ], "probe")).toThrow();
    }
  });

  it("keeps the ceremony off and reports only aggregate bucket truth", () => {
    expect(() => assertPrivateEvidenceScopeOff(undefined)).not.toThrow();
    expect(() => assertPrivateEvidenceScopeOff("")).not.toThrow();
    expect(() => assertPrivateEvidenceScopeOff("off")).not.toThrow();
    expect(() => assertPrivateEvidenceScopeOff("users:1")).toThrow();
    expect(summarizePrivateEvidenceBucket({
      objects: ["attached", "queued", "orphan"],
      referenced: ["attached", "missing"],
      queued: ["queued"],
    })).toEqual({
      objects: 3,
      referencedObjects: 1,
      queuedObjects: 1,
      orphanCandidates: 1,
      missingReferencedObjects: 1,
    });
  });

  it("pins read-only audit, bounded probe cleanup, and exact migration", async () => {
    const [probe, audit, migration] = await Promise.all([
      readFile("scripts/probe-private-evidence-storage.mts", "utf8"),
      readFile("scripts/audit-private-evidence-storage.mts", "utf8"),
      readFile("scripts/apply-private-evidence-migration.mts", "utf8"),
    ]);
    expect(probe).toContain("START TRANSACTION READ ONLY");
    expect(probe).toContain("finally");
    expect(probe).toContain("deleteExact(key)");
    expect(probe).toContain("after.includes(key)");
    expect(probe).not.toMatch(/console\.(log|error)\([^)]*(key|databaseUrl)/);
    expect(audit).toContain("assertReadOnlyAuditSql(statement)");
    expect(audit).toContain("START TRANSACTION READ ONLY");
    expect(audit).toContain("summarizePrivateEvidenceBucket");
    expect(migration).toContain("0011_r7_evidence_ingestion");
    expect(migration).toContain("0012_r7_private_evidence_cleanup_backend");
    expect(migration).toContain("assertPrivateEvidenceCleanupSchemaWithClient");
    expect(migration).toContain("private_evidence_migration_requires_empty_evidence_tables");
  });
});

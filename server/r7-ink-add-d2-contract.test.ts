import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

function runtimeSources(root: string): string {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return runtimeSources(fullPath);
      if (
        !entry.name.endsWith(".ts")
        || entry.name.endsWith(".test.ts")
        || entry.name.endsWith(".spec.ts")
      ) {
        return [];
      }
      return [read(fullPath)];
    })
    .join("\n");
}

describe("R7-7D D2 inert durability contract", () => {
  it("uses one positive availability law and bans fail-open archived predicates", () => {
    const availability = read("server/casting/modelAvailability.ts");
    expect(availability).toContain('"draft"');
    expect(availability).toContain('"active"');
    expect(availability).toContain('"locked"');
    expect(availability).not.toContain('"archived"');
    expect(availability).not.toContain('"provisioning"');

    const runtime = [
      "server/casting/effectiveCastState.ts",
      "server/casting/finalCastDeletion.ts",
      "server/casting/identity/identityCommit.ts",
      "server/casting/snapshotBootstrap.ts",
      "server/casting/snapshotCohortInventory.ts",
      "server/casting/snapshotConvergence.ts",
      "server/casting/snapshotPinConvergence.ts",
      "server/casting/snapshotShadow.ts",
      "server/casting/snapshotTransitions.ts",
      "server/db/evidenceDelivery.ts",
      "server/db/generationOperations.ts",
      "server/db/modelReferenceFence.ts",
      "server/db/models.ts",
    ].map(read).join("\n");
    expect(runtime).not.toMatch(/ne\s*\(\s*models\.status\s*,\s*["']archived["']/);
    expect(runtime).toContain("availableModelWhere()");
  });

  it("keeps candidate delivery owner-scoped, ready-only and read-only", () => {
    const query = read("server/db/evidenceDelivery.ts");
    expect(query).toContain('input.kind === "candidate"');
    expect(query).toContain('eq(castingEvidenceCandidates.status, "ready")');
    expect(query).toContain("gt(castingEvidenceCandidates.expiresAt, new Date())");
    expect(query).toContain("availableModelWhere()");
    expect(query).not.toMatch(/\.(insert|update|delete)\s*\(/);
    const route = read("server/routes/evidenceDelivery.ts");
    expect(route).toContain('kind !== "candidate"');
    expect(route).toContain("evidence.kind !== identity.kind");
  });

  it("keeps Fork free, providerless, pre-recorded and atomically published", () => {
    const fork = read("server/casting/evidence/evidenceFork.ts");
    expect(fork).toContain('status: "provisioning"');
    expect(fork).toContain("createStorageCleanupManifestIn");
    expect(fork).toContain("copyCanonicalEvidenceExact");
    expect(fork).toContain("storageCopyExact");
    expect(fork).toContain('status: "draft"');
    expect(fork).toContain("finalizeClaimedGenerationOperationSuccessIn");
    expect(fork).toContain("pointsCost: 0");
    expect(fork).not.toMatch(/deductPoints|recordRefund|generateCastingImage/);
    expect(fork).not.toMatch(/from\s+["'][^"']*(?:credits|gemini|provider)[^"']*["']/i);
    const cleanup = read("server/db/storageCleanup.ts");
    expect(cleanup).toContain("inFlightOperationFence()");
    expect(cleanup).toContain(
      'inArray(generationOperations.status, ["claimed", "running"])',
    );
  });

  it("threads explicit operation step keys through every evidence object", () => {
    const contract = read("server/casting/evidence/referencePlateIngestion.ts");
    const persistence = read("server/db/evidenceOperations.ts");
    expect(contract).toContain("stepKey: string");
    expect(contract).toContain("stepKey: input.stepKey");
    expect(persistence).toContain("stepKey: input.stepKey");
    expect(persistence).toContain("createdByOperationStepKey");
    expect(persistence).toContain(
      "eq(castingEvidenceIngestions.stepKey, input.prepared.stepKey)",
    );
  });

  it("extends both deletion boundaries over every D1 table and candidate key", () => {
    for (const path of [
      "server/casting/finalCastDeletion.ts",
      "server/db/accountDeletion.ts",
    ]) {
      const source = read(path);
      for (const token of [
        "castingEvidenceCandidateAttempts",
        "castingEvidenceCandidates",
        "modelIdentityFeatureIntents",
        "modelIdentityFeatures",
        "modelIdentityFeatureVersions",
        "modelSnapshotFeatureSelections",
        'parsed.kind !== "candidate"',
      ]) {
        expect(source, `${path} must carry ${token}`).toContain(token);
      }
    }
  });

  it("wires one D7 product caller while keeping generation authority out of cleanup", () => {
    const runtimeCallers = [
      runtimeSources("server/routes"),
      runtimeSources("server/_core"),
      read("server/routers.ts"),
      read("server/casting/storageCleanupWorker.ts"),
    ].join("\n");
    expect(runtimeCallers.match(/forkEvidenceAwareCast\(/g)).toHaveLength(1);
    expect(read("server/routes/boardOps.ts")).toContain(
      'kind: "evidence_fork_copy"',
    );
    const worker = read("server/casting/storageCleanupWorker.ts");
    expect(worker).toContain(
      'process.env.ENABLE_EVIDENCE_CANDIDATE_WORKER === "true"',
    );
  });
});

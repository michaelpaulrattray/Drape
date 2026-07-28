import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function runtimeTsFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...runtimeTsFiles(path));
    } else if (
      path.endsWith(".ts")
      && !path.endsWith(".test.ts")
      && !path.endsWith(".spec.ts")
      && !path.endsWith(".d.ts")
    ) {
      files.push(path);
    }
  }
  return files;
}

describe("R7-7E2 evidence package execution contract", () => {
  it("keeps one routed executor behind stored-kind and disabled package gates", () => {
    const callers = runtimeTsFiles("server")
      .filter((path) =>
        readFileSync(path, "utf8").includes("executeEvidencePackageSync")
      )
      .map((path) => relative(".", path).replaceAll("\\", "/"))
      .sort();
    expect(callers).toEqual([
      "server/casting/evidence/evidencePackageExecution.ts",
      "server/routes/generation/castingExport.ts",
    ]);

    const route = readFileSync(
      "server/routes/generation/castingExport.ts",
      "utf8",
    );
    expect(route.indexOf("getGenerationOperationKindByRequest"))
      .toBeLessThan(route.indexOf("classifyEvidencePackageRouteAuthority"));
    expect(route).toContain("captureEvidencePackageEnabled(ctx.user.id)");
    expect(route).toContain("resolveOperationKindForReplay");
    expect(route).toContain("const operationKind = kindResolution.kind");
    expect(route).toContain("kind: operationKind");
    expect(route).toContain("updateGenerationOperationProgress");
    expect(route).toContain(
      "error instanceof EvidencePackageSettlementUncertainError",
    );
    expect(route).toContain("handoffGenerationOperationToRecovery");
    const uncertainBranchStart = route.indexOf(
      "error instanceof EvidencePackageSettlementUncertainError",
    );
    const uncertainBranchEnd = route.indexOf(
      "await completeDirectOperationFailure",
      uncertainBranchStart,
    );
    const uncertainBranch = route.slice(
      uncertainBranchStart,
      uncertainBranchEnd,
    );
    expect(uncertainBranch).toContain(
      "await handoffGenerationOperationToRecovery",
    );
    expect(uncertainBranch.indexOf("await handoffGenerationOperationToRecovery"))
      .toBeLessThan(uncertainBranch.indexOf("throw new TRPCError"));
    expect(route.indexOf("updateGenerationOperationProgress"))
      .toBeLessThan(route.lastIndexOf("executeEvidencePackageSync"));
  });

  it("pins one parent charge, one included retry, bounded reads, and exact cleanup", () => {
    const source = readFileSync(
      "server/casting/evidence/evidencePackageExecution.ts",
      "utf8",
    );
    expect(source.match(/dependencies\.deduct \?\? deductPoints/g)).toHaveLength(1);
    expect(source).toContain("attemptNumber: 1");
    expect(source).toContain("attemptNumber: 2");
    expect(source).not.toMatch(/\bwhile\s*\(/);
    expect(source).toContain("MAX_EVIDENCE_CANONICAL_BYTES");
    expect(source).toContain('createHash("sha256")');
    expect(source).toContain("fetchTrustedImage");
    expect(source).toContain("reserveStorageCleanupItemForOperation");
    expect(source.indexOf("reserveStorageCleanupItemForOperation"))
      .toBeLessThan(source.indexOf("createAudit ?? createGeneration"));
    expect(source).toContain("releaseStorageCleanupReservation");
    expect(source).toContain("storageDelete");
    expect(source).toContain("recordRefund");
    expect(source).toContain(
      "throw new EvidencePackageSettlementUncertainError(error)",
    );
  });

  it("keeps settlement atomic and independent from the effective-state reader", () => {
    const source = readFileSync(
      "server/casting/snapshotTransitions.ts",
      "utf8",
    );
    const start = source.indexOf(
      "export async function commitEvidencePackageSyncSnapshot",
    );
    const end = source.indexOf(
      "const CANVAS_RECAST_IDENTITY_RECIPE_VERSION",
      start,
    );
    const settlement = source.slice(start, end);
    expect(source).toContain(
      'from "./evidence/evidencePackageFeatureRows"',
    );
    expect(source).not.toContain(
      'from "./evidence/evidencePackageAuthority"',
    );
    expect(settlement).toContain('expectedKind: "evidence_package_sync"');
    expect(settlement).toContain('featureAuthority: "evidence_aware"');
    expect(settlement).toContain("readEvidencePackageFeatureRowsIn");
    expect(settlement).toContain("source.pinned");
    expect(settlement).toContain("consumeStorageCleanupReservationsIn");
    const plan = readFileSync(
      "server/casting/evidence/evidencePackagePlan.ts",
      "utf8",
    );
    expect(plan).toContain('"pinned"');
    expect(plan).toContain("if (slot.pinned)");
    const cleanup = readFileSync("server/db/storageCleanup.ts", "utf8");
    expect(cleanup).toContain("reserveStorageCleanupItemForOperation");
    expect(cleanup).toContain("consumeStorageCleanupReservationsIn");
    expect(cleanup).toContain("allItems.length !== batch.expectedCount");
    expect(cleanup).toContain("affectedRows(removed) !== consumed.length");
  });

  it("validates the separate package rollout scope at boot and recovery uses persisted steps", () => {
    const env = readFileSync("server/_core/env.ts", "utf8");
    const scope = readFileSync(
      "server/casting/evidence/evidencePackageScope.ts",
      "utf8",
    );
    const recovery = readFileSync(
      "server/casting/operationRecovery.ts",
      "utf8",
    );
    expect(env).toContain("validateEvidencePackageEnvironment");
    expect(scope).toContain('R7_EVIDENCE_PACKAGE_SCOPE');
    expect(scope).toContain(
      "must be a subset of R7_EVIDENCE_COMPOSER_SCOPE",
    );
    expect(recovery).toContain("assertGenerationOperationProgress");
    expect(recovery).toContain("Recovery refund: evidence package view did not settle");
    expect(recovery).toContain("model.currentPackageSnapshotId !== snapshot.id");

    const operations = readFileSync(
      "server/db/generationOperations.ts",
      "utf8",
    );
    const stopStart = operations.indexOf(
      "async function stopOperationHeartbeat",
    );
    const stopEnd = operations.indexOf(
      "function startOperationHeartbeat",
      stopStart,
    );
    const stop = operations.slice(stopStart, stopEnd);
    expect(stop.indexOf("clearInterval(active.timer)"))
      .toBeLessThan(stop.indexOf("await active.inFlight"));

    const handoffStart = operations.indexOf(
      "export async function handoffGenerationOperationToRecovery",
    );
    const handoffEnd = operations.indexOf(
      "export async function updateGenerationOperationProgress",
      handoffStart,
    );
    const handoff = operations.slice(handoffStart, handoffEnd);
    expect(handoff.indexOf("await stopOperationHeartbeat"))
      .toBeLessThan(handoff.indexOf("await withTransaction"));
    expect(handoff).toContain(
      'eq(generationOperations.status, "running")',
    );
    expect(handoff).toContain(".set({ heartbeatAt: now, leaseExpiresAt: now })");
    expect(handoff).toContain(".set({ expiresAt: now })");
    expect(handoff).not.toContain(".delete(generationOperationLocks)");
  });
});

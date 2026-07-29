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

describe("R7-7E3 progressive evidence mint contract", () => {
  it("keeps one routed zero-generation executor with no spend/provider/storage authority", () => {
    const callers = runtimeTsFiles("server")
      .filter((path) => readFileSync(path, "utf8").includes("executeEvidenceMint"))
      .map((path) => relative(".", path).replaceAll("\\", "/"))
      .sort();
    expect(callers).toEqual([
      "server/casting/evidence/evidenceMint.ts",
      "server/routes/generation/castingExport.ts",
    ]);

    const source = readFileSync(
      "server/casting/evidence/evidenceMint.ts",
      "utf8",
    );
    expect(source).not.toMatch(
      /\b(?:deductPoints|deductCredits|addCredits|storagePut|storageDelete|generateCastingImage|generateFullBody|generateRemainingViews|generatePackageSlotCandidate)\b/,
    );
    expect(source).toContain("withUniqueCastPublicId");
    expect(source).toContain("commitEvidenceMintSnapshot");
    expect(source).toContain("zeroGeneration: true");
    expect(source).toContain("MINT_TIER_SLOTS[tier]");
  });

  it("pins stored-kind-first routing, zero accounting, reproof, and uncertain handoff", () => {
    const route = readFileSync(
      "server/routes/generation/castingExport.ts",
      "utf8",
    );
    expect(route.indexOf("getGenerationOperationKindByRequest"))
      .toBeLessThan(route.indexOf("classifyEvidenceMintRouteAuthority"));
    expect(route).toContain('derivedKind = "evidence_mint"');
    expect(route).toContain('operationKind === "evidence_mint"');
    expect(route).toContain("classified.plan.tiers[input.tier].ready");
    expect(route).toContain("plannedCredits = 0");
    expect(route).toContain("executeEvidenceMint({},");
    expect(route).toContain(
      "error instanceof EvidenceMintSettlementUncertainError",
    );
    const uncertainStart = route.indexOf(
      "error instanceof EvidenceMintSettlementUncertainError",
    );
    const uncertainEnd = route.indexOf(
      "return completeDirectOperationFailure",
      uncertainStart,
    );
    const uncertain = route.slice(uncertainStart, uncertainEnd);
    expect(uncertain).toContain("handoffGenerationOperationToRecovery");
    expect(uncertain.indexOf("handoffGenerationOperationToRecovery"))
      .toBeLessThan(uncertain.indexOf("throw new TRPCError"));
  });

  it("seals one carried package snapshot and changes no identity, feature, slot, or asset truth", () => {
    const source = readFileSync(
      "server/casting/snapshotTransitions.ts",
      "utf8",
    );
    const start = source.indexOf(
      "export async function commitEvidenceMintSnapshot",
    );
    const end = source.indexOf(
      "const CANVAS_RECAST_IDENTITY_RECIPE_VERSION",
      start,
    );
    const settlement = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(settlement).toContain('expectedKind: "evidence_mint"');
    expect(settlement).toContain('featureAuthority: "evidence_aware"');
    expect(settlement).toContain("readEvidencePackageFeatureRowsIn");
    expect(settlement).toContain("computeMintIntegrityForSelection");
    expect(settlement).toContain("requiredSlotsCurrent");
    expect(settlement).toContain('packageReason: "mint"');
    expect(settlement).toContain("seal: true");
    expect(settlement).not.toContain("slotChanges:");
    expect(settlement).not.toContain("identity:");
    expect(settlement).not.toContain(".insert(modelAssets)");
    expect(settlement).not.toContain("featureChanges");
  });

  it("recovers only an exact operation-created seal and permits post-mint package expansion", () => {
    const recovery = readFileSync(
      "server/casting/operationRecovery.ts",
      "utf8",
    );
    const start = recovery.indexOf(
      "export async function recoverEvidenceMintOperation",
    );
    const end = recovery.indexOf(
      "export async function adjudicateStaleGenerationOperation",
      start,
    );
    const mintRecovery = recovery.slice(start, end);
    expect(mintRecovery).toContain("createdByOperationId");
    expect(mintRecovery).toContain("operation.plannedCredits !== 0");
    expect(mintRecovery).toContain("accountingRows.length > 0");
    expect(mintRecovery).toContain("model.sealedPackageSnapshotId !== snapshot.id");
    expect(mintRecovery).toContain(
      "model.sealedIdentitySnapshotId !== snapshot.identitySnapshotId",
    );
    expect(mintRecovery).toContain('selectionReason !== "carried"');
    expect(mintRecovery).toContain("MINT_TIER_SLOTS[tier]");
    expect(mintRecovery).toContain("assessSupportedInkFeatureGraph");
    expect(mintRecovery).toContain("chargedCredits: 0");
    expect(mintRecovery).toContain("refundedCredits: 0");

    const plan = readFileSync(
      "server/casting/evidence/evidencePackagePlan.ts",
      "utf8",
    );
    expect(plan).toContain("isModelAvailableStatus(input.modelStatus)");
    expect(plan.indexOf("if (!modelAvailable)"))
      .toBeLessThan(plan.indexOf("const actionable = slots.filter"));
    expect(plan).toContain("const modelDraft = isModelDraftStatus");
    expect(plan).toContain("modelDraft");
  });
});

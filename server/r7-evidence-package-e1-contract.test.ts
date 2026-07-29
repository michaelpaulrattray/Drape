import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GENERATION_OPERATION_KINDS } from "./casting/operationContract";
import {
  OPERATION_REPLAY_FAMILY_BY_KIND,
} from "./casting/evidence/operationReplayFamily";
import {
  INK_ADD_PACKAGE_DIRECTIVES,
} from "./casting/evidence/evidencePackageRegistry";
import {
  CANONICAL_VIEW_ANGLES,
} from "../shared/boardTypes";

const E1_RUNTIME_FILES = [
  "casting/castingCreditCosts.ts",
  "casting/packagePricing.ts",
  "casting/evidence/operationReplayFamily.ts",
  "casting/evidence/evidencePackageRegistry.ts",
  "casting/evidence/evidencePackagePlan.ts",
  "casting/evidence/evidencePackageComposition.ts",
  "casting/evidence/evidencePackageProbe.ts",
] as const;

async function runtimeSources(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return runtimeSources(path);
    if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.(?:test|integration\.test)\.(?:ts|tsx)$/.test(entry.name)) {
      return [];
    }
    return [path];
  }));
  return nested.flat();
}

describe("R7-7E1 evidence-aware package foundation contract", () => {
  it("keeps replay authority and view directives exhaustive", () => {
    expect(GENERATION_OPERATION_KINDS).toContain("evidence_package_sync");
    expect(GENERATION_OPERATION_KINDS).toContain("evidence_mint");
    expect(Object.keys(OPERATION_REPLAY_FAMILY_BY_KIND).sort())
      .toEqual([...GENERATION_OPERATION_KINDS].sort());
    expect(Object.keys(INK_ADD_PACKAGE_DIRECTIVES).sort())
      .toEqual([...CANONICAL_VIEW_ANGLES].sort());
  });

  it("keeps the E1 foundation pure while E2 runtime reachability stays exact", async () => {
    const serverRoot = new URL("./", import.meta.url);
    const sources = await Promise.all(E1_RUNTIME_FILES.map(async (relativePath) => ({
      relativePath,
      source: await readFile(new URL(relativePath, serverRoot), "utf8"),
    })));
    const forbidden = /(?:\b(?:getDb|withTransaction|deductPoints|storagePut|storageDelete|generateCastingImage|generatePackageSlotCandidate)\s*\(|from\s+["'][^"']*(?:\/db|\/storage|geminiService|aiService)|\b(?:router|procedure|mutation)\s*\()/i;

    for (const { relativePath, source } of sources) {
      expect(source, relativePath).not.toMatch(forbidden);
    }

    const rootPath = fileURLToPath(serverRoot);
    const importers: string[] = [];
    const moduleNames = E1_RUNTIME_FILES.map((path) =>
      path.slice(path.lastIndexOf("/") + 1, -".ts".length)
    );
    for (const path of await runtimeSources(rootPath)) {
      const source = await readFile(path, "utf8");
      if (moduleNames.some((moduleName) =>
        new RegExp(`from\\s+["'][^"']*\\/?${moduleName}["']`).test(source))) {
        importers.push(relative(rootPath, path).replaceAll("\\", "/"));
      }
    }
    expect(importers.sort()).toEqual([
      "casting/aiService.ts",
      "casting/evidence/evidenceIdentityRevisionRepair.ts",
      "casting/evidence/evidenceMint.ts",
      "casting/evidence/evidencePackageAuthority.ts",
      "casting/evidence/evidencePackageComposition.ts",
      "casting/evidence/evidencePackageExecution.ts",
      "casting/evidence/evidencePackageFeatureRows.ts",
      "casting/evidence/evidencePackagePlan.ts",
      "casting/evidence/evidencePackageProbe.ts",
      "casting/evidence/inkViewImpact.ts",
      "casting/mintPackage.ts",
      "casting/operationRecovery.ts",
      "casting/packagePricing.ts",
      "casting/snapshotTransitions.ts",
      "routes/generation/castingExport.ts",
    ]);

    const route = await readFile(
      new URL("./routes/generation/castingExport.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("captureEvidencePackageEnabled");
    expect(route).toContain("executeEvidencePackageSync");
    expect(route).toContain("resolveOperationKindForReplay");
  });

  it("keeps recovery policy exhaustive for the declared operation kinds", async () => {
    const source = await readFile(
      new URL("./casting/operationRecovery.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("PUBLIC_RESULT_RECOVERY_BY_KIND");
    expect(source).toContain("STALE_RECOVERY_BY_KIND");
    expect(source).toContain("LANDING_RECOVERY_BY_KIND");
    expect(source).toContain("Record<GenerationOperationKind");
    expect(source).toContain("evidence_package_sync");
    expect(source).toContain("evidence_mint");
  });
});

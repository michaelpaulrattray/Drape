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

  /*
    ⚠ A LONGER CLOCK, because this one reads FILES (opus-1055, ordered
    fable-1418).

    It went red once and green twice on 2026-08-22 — `Test timed out in 5000ms`,
    never an assertion — on the run that started seconds after both atlas
    generators had finished hammering the disk. It reads every E1 runtime source
    off the filesystem and greps each one, so it is I/O bound in a suite where
    almost nothing else is, and vitest's default 5s is a clock sized for pure
    functions.

    Taken the day it was seen rather than after three sightings: a known-shape
    flake left alone is how the faceScan one needed three before anybody sized
    it, and by then nobody remembered the load conditions.
  */
  it("keeps the E1 foundation pure while E2 runtime reachability stays exact", async () => {
    const serverRoot = new URL("./", import.meta.url);
    const sources = await Promise.all(E1_RUNTIME_FILES.map(async (relativePath) => ({
      relativePath,
      source: await readFile(new URL(relativePath, serverRoot), "utf8"),
    })));
    const forbidden = /(?:\b(?:getDb|withTransaction|deductPoints|deductCredits|withAtomicCredits|storagePut|storageDelete|generateCastingImage|generatePackageSlotCandidate)\s*\(|from\s+["'][^"']*(?:\/db|\/storage|atomicCredits|geminiService|aiService)|\b(?:router|procedure|mutation)\s*\()/i;

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
      "casting/evidence/evidenceWalkCompatibilityRepair.ts",
      "casting/evidence/inkAcceptanceCommit.ts",
      "casting/evidence/inkCandidateGeneration.ts",
      "casting/evidence/inkFeatureGraph.ts",
      "casting/evidence/inkPackageImpactV2.ts",
      "casting/evidence/inkViewImpact.ts",
      "casting/mintPackage.ts",
      "casting/operationRecovery.ts",
      "casting/packagePricing.ts",
      "casting/snapshotTransitions.ts",
      // Casting V2 (M4) imports the declaration-only price module. The purity
      // rule this test enforces is about what `castingCreditCosts.ts` may
      // depend on, not about who may read a price — and a new consumer of the
      // prices is exactly the kind of change this inventory should surface.
      // Sign (M7) reads the same declaration-only prices: the package module
      // derives the Sign total from its own view list, and the service quotes
      // it. Two more readers of a price, no new dependency on anything.
      // ⚠ TWO MORE READERS ARRIVED ON 2026-10-01 (#1601 item 1), and this
      // inventory is what surfaced them — which is the job it was written for.
      // The paid Try again stopped being a view's price and became its own, so
      // the room's projection and the entrance that spends the money both read
      // `CASTING_V2_VIEW_RETRY_PRICE_CREDITS` instead of passing
      // `CAST_PACKAGE_VIEW_PRICE` into `castSlotRetryOffer`. Still a
      // declaration-only read: neither import adds a dependency to the price
      // module, which is the purity this suite is actually about.
      "castingV2/castProjection.ts",
      "castingV2/castViewPackage.ts",
      // ⚠ A FOURTH PRICE READER ARRIVED ON 2026-10-07 (#1903 slice 2), and this
      // inventory surfaced it before the gate did — again, which is the job it
      // was written for. The paid redo quotes
      // `CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS` per view. Still a
      // declaration-only read: no dependency is added to the price module,
      // which is the purity this suite is actually about. Worth noticing what
      // is NOT here beside it — the redo declares no package TOTAL, because
      // `castPackageRedoOffer` prices the slots a Cast actually owns, so the
      // projection above reads the slice and nothing reads a total.
      "castingV2/packageRedoService.ts",
      // Refine (M8) quotes its one-unit price the same way. The adjudicator is
      // deliberately NOT here: it reads the charge back off the ledger rather
      // than re-deriving it from today's price, so a price change can never
      // retroactively alter what an old operation is owed.
      "castingV2/refineService.ts",
      // retryService.ts LEFT this list with #1601 item 2, and for the same
      // reason signService.ts did below: its only import of
      // castingCreditCosts was the retry price, and a retry is now charged
      // from the TILE'S OWN ROW (`candidate.pointsCost`) rather than from the
      // roll's slice constant — so a Follow tile cannot be charged a Roll's
      // price and then have that price written back as its refund authority.
      // It reads no price module at all now. `CASTING_V2_RETRY_PRICE_CREDITS`
      // still exists and is still read, by routes/castingV2.ts below, as the
      // account-level quote the client draws on the button.
      "castingV2/rollService.ts",
      // The Sign adjudicator reads the promotion price to cross-check the
      // promised package against what was actually charged (package v2).
      "castingV2/signRecovery.ts",
      "castingV2/viewRetryService.ts",
      // signService.ts LEFT this list with #108 slice 2b: its only import of
      // castingCreditCosts fed a re-export (`CASTING_V2_SIGN_COSTS`) nothing
      // read through it; the sign price it charges comes via castViewPackage.
      "db/castingV2.ts",
      "db/inkAddCandidates.ts",
      // ⚠ A BILLING SURFACE ARRIVED ON 2026-10-02 (#1606 slice 2) — the third
      // time this inventory has surfaced a new price READER, which is the job
      // it was written for. The Add credits pane tells a customer what a credit
      // pack buys in Rolls and Signs, and D-15's rule is that the client is
      // SERVED the number and never carries a literal — so `getPlans` quotes
      // `CASTING_V2_ROLL_PRICE_CREDITS` and `CASTING_V2_SIGN_PRICE_CREDITS` on
      // the same projection that already serves `oneFinishedCharacterCredits`.
      // Still a declaration-only read, which is the purity this suite is about:
      // the price modules gain no dependency, and the alternative — the modal
      // opening `castingV2.config` to price a pack — would put a money surface
      // behind the casting scope chain.
      "routes/billing.ts",
      "routes/castingV2.ts",
      "routes/generation/castingExport.ts",
    ]);

    const route = await readFile(
      new URL("./routes/generation/castingExport.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("captureEvidencePackageEnabled");
    expect(route).toContain("executeEvidencePackageSync");
    expect(route).toContain("resolveOperationKindForReplay");
    /* 30s rather than the default 5 — it reads the whole runtime tree off disk
       and greps it, and the default clock is sized for pure functions. See the
       docblock above. */
  }, 30_000);

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

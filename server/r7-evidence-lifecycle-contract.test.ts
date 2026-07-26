import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("R7-7C3 evidence lifecycle contract", () => {
  it("wires bounded recovery into the existing cleanup worker before deletion", async () => {
    const worker = await readFile(
      new URL("./casting/storageCleanupWorker.ts", import.meta.url),
      "utf8",
    );
    const runStart = worker.indexOf("const run = async () =>");
    const run = worker.slice(runStart);
    const staleSweep = run.indexOf("sweepStaleGenerationOperations");
    const plan = run.indexOf("planNextEvidenceIngestionCleanup");
    const settleBefore = run.indexOf("settleCompletedEvidenceCleanups");
    const deleteBatch = run.indexOf("processNextStorageCleanupBatch");
    const settleAfter = run.indexOf("settleCompletedEvidenceCleanups", settleBefore + 1);
    expect(staleSweep).toBeGreaterThan(0);
    expect(staleSweep).toBeLessThan(plan);
    expect(plan).toBeLessThan(settleBefore);
    expect(settleBefore).toBeLessThan(deleteBatch);
    expect(deleteBatch).toBeLessThan(settleAfter);
    expect(run).toContain("storageCleanupHealthRequiresAttention(health)");
    const healthGuard = worker.slice(
      worker.indexOf("export function storageCleanupHealthRequiresAttention"),
      worker.indexOf("export async function processNextStorageCleanupBatch"),
    );
    expect(healthGuard).toContain("cleanupPendingEvidenceReceipts");
    expect(healthGuard).toContain("failedEvidenceManifests");
    expect(healthGuard).toContain("pendingPrivateBatches");
    expect(healthGuard).toContain("oldestNonAttachedEvidenceAgeMs");
  });

  it("pins the shorter recovery window, active-operation fence and exact manifest binding", async () => {
    const source = await readFile(
      new URL("./db/evidenceRecovery.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("EVIDENCE_INGESTION_RECOVERY_WINDOW_MS = 10 * 60 * 1000");
    expect(source).toContain("recoveryWindowMs >= 15 * 60 * 1000");
    expect(source).toContain('"claimed"');
    expect(source).toContain('"running"');
    expect(source).toContain('"recovery_required"');
    expect(source).toContain("notExists(activeOperation)");
    expect(source).toContain('kind: "evidence_cleanup"');
    expect(source).toContain("items.length !== 1");
    expect(source).toContain("items[0]?.storageKey !== receipt.storageKey");
    expect(source).toContain('status: "cleanup_pending"');
    expect(source).toContain('set({ status: "cleaned" })');
  });

  it("requires Cast and account deletion to manifest evidence before removing rows", async () => {
    const finalDeletion = await readFile(
      new URL("./casting/finalCastDeletion.ts", import.meta.url),
      "utf8",
    );
    const manifest = finalDeletion.indexOf("createStorageCleanupManifestIn");
    const cropDelete = finalDeletion.indexOf("tx.delete(modelEvidenceCrops)");
    const plateDelete = finalDeletion.indexOf("tx.delete(modelReferencePlates)");
    const receiptDelete = finalDeletion.indexOf("tx.delete(castingEvidenceIngestions)");
    expect(manifest).toBeGreaterThan(0);
    expect(manifest).toBeLessThan(cropDelete);
    expect(cropDelete).toBeLessThan(plateDelete);
    expect(plateDelete).toBeLessThan(receiptDelete);
    expect(finalDeletion).toContain("assertOwnedEvidenceStorageKey");

    const accountDeletion = await readFile(
      new URL("./db/accountDeletion.ts", import.meta.url),
      "utf8",
    );
    const accountManifest = accountDeletion.lastIndexOf("createStorageCleanupManifestIn");
    const accountCropDelete = accountDeletion.indexOf("delete(modelEvidenceCrops)");
    expect(accountManifest).toBeGreaterThan(0);
    expect(accountManifest).toBeLessThan(accountCropDelete);
    expect(accountDeletion).toContain("assertOwnedEvidenceStorageKey");
  });

  it("keeps GDPR owner-only and the rollback audit counts-only", async () => {
    const gdpr = await readFile(
      new URL("./db/gdprExport.ts", import.meta.url),
      "utf8",
    );
    expect(gdpr).toContain("resolveEvidenceOwnerDelivery");
    expect(gdpr).toContain("assertOwnedEvidenceStorageKey");
    const evidenceDto = gdpr.slice(
      gdpr.indexOf("evidence: {"),
      gdpr.indexOf("generations: Array"),
    );
    expect(evidenceDto).not.toMatch(/storageKey|operationId|cleanupBatchId|receipt/i);

    const audit = await readFile(
      new URL("./casting/evidence/evidenceOrphanAudit.ts", import.meta.url),
      "utf8",
    );
    expect(audit).toContain("parseEvidenceStorageKey");
    expect(audit).toContain("outstandingNonAttachedReceipts");
    expect(audit).toContain("cleanupLinkMismatches");
    expect(audit).not.toMatch(/console\.|createModuleLogger|storagePut|storageDelete/);
    const script = await readFile(
      new URL("../scripts/audit-storage-cleanup.mts", import.meta.url),
      "utf8",
    );
    expect(script).toContain("auditEvidenceOrphans");
    expect(script).toContain('mode: "read-only"');
  });

  it("keeps the route capability absent through C3", async () => {
    const callers: string[] = [];
    for (const file of await runtimeSources("server/routes")) {
      const source = await readFile(file, "utf8");
      if (
        source.includes("stageCanonicalReferencePlate")
        || source.includes("dbReferencePlateIngestionPersistence")
        || source.includes("evidence_plate_ingest")
        || source.includes("evidence_plate_discard")
      ) {
        callers.push(file.replaceAll("\\", "/"));
      }
    }
    expect(callers).toEqual([]);
  });
});

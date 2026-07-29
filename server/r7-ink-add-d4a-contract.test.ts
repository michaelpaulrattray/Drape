import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("R7-7D D4A intent/reference contract", () => {
  it("opens the D7 product build while keeping boot and request scope fail-closed", async () => {
    const [scope, env, route] = await Promise.all([
      source("./casting/evidence/evidenceComposerScope.ts"),
      source("./_core/env.ts"),
      source("./routes/evidence.ts"),
    ]);
    expect(scope).toContain("INK_ADD_PRODUCT_READY = true");
    expect(scope).toContain("INK_ADD_PRODUCT_READY\n    &&");
    expect(env).toContain(
      "productReady: EVIDENCE_PRODUCT_DELIVERY_READY && INK_ADD_PRODUCT_READY",
    );
    expect(route).toContain("if (!captureEvidenceComposerEnabled(userId))");
    expect(route).toContain("requireInkCapability(ctx.user.id)");
    expect(route).not.toContain("publicProcedure");
  });

  it("keeps authority server-owned and every new wire schema strict", async () => {
    const route = await source("./routes/evidence.ts");
    expect(route).toContain("beginInkAddIntent: protectedProcedure");
    expect(route).toContain("attachInkIntentReference: protectedProcedure");
    expect(route).toContain("generateInkAddCandidate: protectedProcedure");
    expect(route).toContain("retryInkAddCandidate: protectedProcedure");
    expect(route).toContain("inkCapability: protectedProcedure");
    expect(route.match(/\.input\(z\.object\(\{/g)?.length).toBe(
      route.match(/\.strict\(\)/g)?.length,
    );
    expect(route).not.toContain(".passthrough()");
    expect(route).not.toMatch(
      /userId:\s*z\.|ownerId:\s*z\.|packageSnapshotId:\s*z\.|identitySnapshotId:\s*z\.|storageKey:\s*z\.|contentHash:\s*z\./,
    );
  });

  it("binds the selected source and empty feature set under the durable model lock", async () => {
    const db = await source("./db/inkAddIntents.ts");
    const modelLock = db.indexOf("lockOwnedDraftModelIn(tx, input)");
    const operationLock = db.indexOf("lockClaimedIntentOperationIn(tx, input)");
    const snapshotRead = db.indexOf("readSnapshotShadowStateIn(tx");
    const featureRead = db.indexOf(".from(modelSnapshotFeatureSelections)");
    const intentInsert = db.indexOf(
      "await tx.insert(modelIdentityFeatureIntents)",
    );
    expect(modelLock).toBeGreaterThan(-1);
    expect(operationLock).toBeGreaterThan(modelLock);
    expect(snapshotRead).toBeGreaterThan(operationLock);
    expect(featureRead).toBeGreaterThan(snapshotRead);
    expect(intentInsert).toBeGreaterThan(featureRead);
    expect(db).toContain("source.asset.id !== input.sourceAssetId");
    expect(db).toContain('source.compatibility !== "current"');
    expect(db).toContain("finalizeClaimedGenerationOperationSuccessIn(tx");
    expect(db).not.toMatch(
      /deductPoints|refundPoints|storagePut|putCanonical|generateContent|castingEvidenceCandidates/,
    );
  });

  it("reuses the canonical private plate path with intent ownership in the insert", async () => {
    const [service, db, operations] = await Promise.all([
      source("./casting/evidence/evidenceOperations.ts"),
      source("./db/evidenceOperations.ts"),
      source("./db/generationOperations.ts"),
    ]);
    expect(service).toContain("stageOwnedInkIntentReference");
    expect(service).toContain('kind: "evidence_intent_reference"');
    expect(service).toContain("featureIntentId: intent.id");
    expect(service).toContain("resumeClaimedEvidence: true");
    expect(operations).toContain(
      'preexisting.kind === "evidence_intent_reference"',
    );
    expect(db).toContain("modelReferencePlates.featureIntentId");
    expect(db).toContain(
      "id, userId, modelId, featureIntentId, kind, storageKey",
    );
    expect(db).toContain("intent.activeCapabilityKey");
    expect(db).toContain("intent.packageSnapshotId = models.currentPackageSnapshotId");
  });

  it("keeps the D5 client door query-owned and click-driven", async () => {
    const route = await source("./routes/evidence.ts");
    expect(route).toContain("inkCapability");
    const [workspace, viewer, workflow, panel] = await Promise.all([
      source("../client/src/features/studio/components/CastingWorkspace.tsx"),
      source("../client/src/features/casting/ImageViewerPanel.tsx"),
      source("../client/src/features/casting/evidence/useInkAddWorkflow.ts"),
      source("../client/src/features/casting/evidence/InkAddPanel.tsx"),
    ]);
    expect(workspace).toContain("onInkAccepted={handleInkAccepted}");
    expect(viewer).toContain("useInkAddWorkflow");
    expect(workflow).toContain("trpc.evidence.inkCapability.useQuery");
    expect(workflow).toContain("subscribeCastProjectionChanged");
    expect(panel).toContain("onClick={() => void workflow.generate()}");
    expect(panel).toContain("onClick={() => void workflow.accept()}");
  });
});

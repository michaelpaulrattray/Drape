import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  INK_REFERENCE_MAX_BYTES,
  inkCandidateIsExpired,
  inkDescriptionReady,
  inkReferenceFileError,
} from "../client/src/features/casting/evidence/inkAddUxPolicy";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("R7-7D D5 inline Studio contract", () => {
  it("validates the local-only reference and description before the click boundary", () => {
    expect(inkReferenceFileError({
      type: "image/png",
      size: INK_REFERENCE_MAX_BYTES,
    } as File)).toBeNull();
    expect(inkReferenceFileError({
      type: "image/gif",
      size: 100,
    } as File)).toContain("JPEG");
    expect(inkReferenceFileError({
      type: "image/webp",
      size: INK_REFERENCE_MAX_BYTES + 1,
    } as File)).toContain("10 MB");
    expect(inkDescriptionReady(" fine-line star ")).toBe(true);
    expect(inkDescriptionReady("  ")).toBe(false);
    expect(inkCandidateIsExpired(
      "2026-07-01T00:00:00.000Z",
      Date.parse("2026-07-02T00:00:00.000Z"),
    )).toBe(true);
  });

  it("keeps every mutation behind a named user callback", async () => {
    const [workflow, panel] = await Promise.all([
      source("../client/src/features/casting/evidence/useInkAddWorkflow.ts"),
      source("../client/src/features/casting/evidence/InkAddPanel.tsx"),
    ]);
    expect(workflow.match(/\.mutateAsync\(/g)).toHaveLength(6);
    expect(workflow).toContain("const generate = useCallback(async () =>");
    expect(workflow).toContain("const accept = useCallback(async () =>");
    expect(workflow).toContain("const retry = useCallback(async () =>");
    expect(workflow).toContain("const cancel = useCallback(async () =>");
    expect(panel).toContain("onClick={() => void workflow.generate()}");
    expect(panel).toContain("onClick={() => void workflow.accept()}");
    expect(panel).toContain("void workflow.retry()");
    expect(panel).toContain("void workflow.cancel()");
    expect(panel).not.toMatch(/autoFocus|onMouseEnter=.*workflow|onLoad=.*workflow/);
  });

  it("resumes server truth and syncs tabs without a write loop", async () => {
    const [workflow, bridge, sync] = await Promise.all([
      source("../client/src/features/casting/evidence/useInkAddWorkflow.ts"),
      source("../client/src/features/operations/GenerationOperationBridge.tsx"),
      source("../client/src/features/operations/castProjectionSync.ts"),
    ]);
    expect(workflow).toContain("trpc.evidence.inkCapability.useQuery");
    expect(workflow).toContain('candidateStatus === "processing" ? 2_500 : false');
    expect(workflow).toContain("subscribeCastProjectionChanged");
    expect(workflow).toContain("utils.evidence.inkCapability.invalidate");
    expect(workflow).toContain("publishCastProjectionChanged(changedModelId)");
    expect(bridge).toContain("utils.evidence.inkCapability.invalidate({ modelId })");
    expect(sync).toContain("receivers merely");
    expect(sync).not.toContain("listener(value);\n    publishCastProjectionChanged");
  });

  it("never gives a transient private URL directly to the browser image element", async () => {
    const [privateImage, workflow, viewer] = await Promise.all([
      source("../client/src/features/casting/evidence/PrivateEvidenceImage.tsx"),
      source("../client/src/features/casting/evidence/useInkAddWorkflow.ts"),
      source("../client/src/features/casting/ImageViewerPanel.tsx"),
    ]);
    expect(privateImage).toContain("loadPrivateEvidenceImage");
    expect(privateImage).toContain("URL.createObjectURL");
    expect(workflow).toContain("setLocalReferenceUrl(objectUrl)");
    expect(workflow).toContain("URL.revokeObjectURL(objectUrl)");
    expect(workflow).not.toContain("const localReferenceUrl = useMemo");
    expect(workflow).toContain("candidateImage,");
    expect(viewer).toContain("inkWorkflow.candidateImage.objectUrl");
    expect(viewer).not.toContain("activeIntent.candidateDeliveryUrl");
  });

  it("keeps the candidate noncanonical until explicit Accept", async () => {
    const [viewer, panel, workspace] = await Promise.all([
      source("../client/src/features/casting/ImageViewerPanel.tsx"),
      source("../client/src/features/casting/evidence/InkAddPanel.tsx"),
      source("../client/src/features/studio/components/CastingWorkspace.tsx"),
    ]);
    expect(viewer).toContain("Preview · not part of this Cast");
    expect(viewer).toContain("Not part of this Cast yet");
    expect(panel).toContain("Accept");
    expect(panel).toContain("Retry ·");
    expect(panel).toContain("Cancel preview");
    expect(panel).toContain("does not refund its completed generation");
    expect(panel).toContain("Accepting saves this tattoo to the Cast");
    expect(workspace).toContain("utils.models.get.fetch({ modelId })");
    expect(workspace).toContain('setActiveView("frontFull")');
    expect(workspace).not.toContain("candidateDeliveryUrl");
  });

  it("makes the model-specific capability and accepted-feature lock server-owned", async () => {
    const [service, db, viewer, panel] = await Promise.all([
      source("./casting/evidence/inkAddIntent.ts"),
      source("./db/inkAddIntents.ts"),
      source("../client/src/features/casting/ImageViewerPanel.tsx"),
      source("../client/src/features/casting/evidence/InkAddPanel.tsx"),
    ]);
    expect(service).toContain("subjectStatus:");
    expect(service).toContain("inspectOwnedInkAddAvailability");
    expect(db).toContain('eq(models.status, "draft")');
    expect(db).toContain("readSnapshotShadowStateIn(tx, input)");
    expect(db).toContain('view.angle === INK_ADD_TARGET_VIEW');
    expect(db).toContain(".from(modelSnapshotFeatureSelections)");
    expect(viewer).toContain('subjectStatus === "feature_selected"');
    expect(viewer).toContain("<InkFeatureAcceptedPanel modelId={currentModelId} />");
    expect(panel).toContain('refreshAngles(["sideFull"])');
    expect(panel).toContain("Update Walk");
    expect(panel).toContain("Views that can show it are current.");
  });

  it("projects durable evidence work into Studio and disables cross-tab actions", async () => {
    const [projection, viewer, panel] = await Promise.all([
      source("../client/src/features/operations/generationOperationProjection.ts"),
      source("../client/src/features/casting/ImageViewerPanel.tsx"),
      source("../client/src/features/casting/evidence/InkAddPanel.tsx"),
    ]);
    for (const kind of [
      "evidence_candidate_generate",
      "evidence_candidate_retry",
      "evidence_candidate_accept",
      "evidence_candidate_cancel",
    ]) {
      expect(projection).toContain(`"${kind}"`);
    }
    expect(projection).toContain('validating: "Checking request…');
    expect(projection).toContain('cleaning: "Removing private preview…');
    expect(viewer).toContain("externallyBusy={genState.isGenerating}");
    expect(panel).toContain("const controlsBusy = workflow.action !== null || externallyBusy");
    expect(panel).toContain("Finishing this request in another tab…");
  });

  it("keeps expiry, price, and inline confirmation UX live without hardcoded authority", async () => {
    const panel = await source(
      "../client/src/features/casting/evidence/InkAddPanel.tsx",
    );
    expect(panel).toContain("const scheduleExpiryCheck = () =>");
    expect(panel).toContain("Math.min(remaining + 50, 2_147_483_647)");
    expect(panel).toContain("refreshExpiry((value) => value + 1)");
    expect(panel).toContain("confirmSafeActionRef.current?.focus()");
    expect(panel).toContain("ref={retryTriggerRef}");
    expect(panel).toContain("ref={cancelTriggerRef}");
    expect(panel).toContain("restoreConfirmationFocusRef.current = true");
    expect(panel).toContain("target?.focus()");
    expect(panel).not.toContain("confirmationTriggerRef");
    expect(panel).toContain("disabled={expired || controlsBusy}");
    expect(panel).toContain("`${workflow.capability.priceCredits} credits`");
    expect(panel).toContain('"Loading quote…"');
    expect(panel).not.toMatch(/priceCredits\s*\?\?\s*350/);
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  FEATURE_BLIND_OPERATION_MESSAGE,
  featureTransitionAuthorityFor,
} from "./casting/evidence/featureTransitionAuthority";
import { projectEvidenceCandidateForModerator } from "./casting/evidence/moderatorEvidenceProjection";
import { GENERATION_OPERATION_KINDS } from "./casting/operationContract";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("R7-7D D4D2 recovery, feature fences, and privacy contract", () => {
  it("makes every operation kind choose an explicit feature-transition authority", () => {
    expect(
      GENERATION_OPERATION_KINDS.map((kind) => [
        kind,
        featureTransitionAuthorityFor(kind),
      ]),
    ).toEqual([
      ["model.create", "not_applicable"],
      ["casting.headshot", "evidence_blind"],
      ["casting.iterate", "evidence_blind"],
      ["casting.mint", "evidence_blind"],
      ["casting.add_views", "evidence_blind"],
      ["evidence_plate_ingest", "not_applicable"],
      ["evidence_plate_discard", "not_applicable"],
      ["evidence_intent_begin", "not_applicable"],
      ["evidence_intent_reference", "not_applicable"],
      ["evidence_candidate_generate", "evidence_aware"],
      ["evidence_candidate_retry", "evidence_aware"],
      ["evidence_candidate_accept", "evidence_aware"],
      ["evidence_candidate_cancel", "evidence_aware"],
      ["evidence_fork_copy", "evidence_aware"],
      ["evidence_package_sync", "evidence_aware"],
      ["evidence_mint", "evidence_aware"],
      ["casting.refresh", "evidence_blind"],
      ["casting.restore", "evidence_blind"],
      ["casting.restore_state", "evidence_aware"],
      ["casting.pin", "not_applicable"],
      ["casting.compact", "document_only"],
      ["model.delete", "not_applicable"],
      ["canvas.cast", "not_applicable"],
      ["canvas.recast", "evidence_blind"],
      ["canvas.fork", "evidence_blind"],
      ["canvas.variations", "evidence_blind"],
      // Pre-Sign: a roll has no model, so there is no feature state to be
      // aware of or blind to.
      ["castingV2.roll", "not_applicable"],
      // Sign CREATES the Cast, so there is no prior feature state for it to be
      // aware of or blind to: a newly signed Cast has no accepted ink evidence
      // by construction.
      ["castingV2.sign", "not_applicable"],
      // A refine edits a pre-Sign candidate, which has no ink evidence to be
      // aware of — evidence attaches to a Cast, and there is no Cast yet.
      ["castingV2.refine", "not_applicable"],
    ]);
    expect(FEATURE_BLIND_OPERATION_MESSAGE).toContain("tattoo evidence");
    expect(FEATURE_BLIND_OPERATION_MESSAGE).toContain("unavailable");
  });

  it("fences evidence-blind work before execution and again inside every snapshot write", async () => {
    const [operations, transitions] = await Promise.all([
      source("./db/generationOperations.ts"),
      source("./casting/snapshotTransitions.ts"),
    ]);
    const runningStart = operations.indexOf(
      "export async function markGenerationOperationRunning",
    );
    const featureRead = operations.indexOf(
      ".from(modelSnapshotFeatureSelections)",
      runningStart,
    );
    const runningWrite = operations.indexOf(
      ".update(generationOperations)",
      runningStart,
    );
    expect(featureRead).toBeGreaterThan(runningStart);
    expect(runningWrite).toBeGreaterThan(featureRead);
    expect(operations).toContain("featureTransitionAuthorityFor(operation.kind");
    expect(operations).toContain("FEATURE_BLIND_OPERATION_MESSAGE");

    const calls = transitions.split("commitModelSnapshotTransition({").slice(1);
    expect(calls.length).toBeGreaterThanOrEqual(8);
    for (const call of calls) {
      const preMutation = call.slice(0, call.indexOf("mutate:"));
      expect(preMutation).toMatch(
        /featureAuthority:\s*"(?:evidence_blind|document_only|evidence_aware)"/,
      );
    }
    expect(transitions).toContain(
      'input.featureAuthority === "evidence_blind"',
    );
    expect(transitions).toContain(
      'input.featureAuthority === "document_only"',
    );
    expect(transitions).toContain("featureSelections: { carryCurrent: true }");
  });

  it("uses candidate rows as recovery truth and one parent refund reference", async () => {
    const [recovery, candidateRecovery] = await Promise.all([
      source("./casting/operationRecovery.ts"),
      source("./db/inkAddRecovery.ts"),
    ]);
    expect(recovery).toContain("adjudicateStaleInkEvidenceOperation");
    expect(recovery).toContain("recordRefund(");
    expect(candidateRecovery).toContain("candidate.readyAttemptId");
    expect(candidateRecovery).toContain('overallOutcome === "pass"');
    expect(candidateRecovery).toContain('status: "invalid"');
    expect(candidateRecovery).toContain("activeSlot: null");
    expect(candidateRecovery).toContain("createStorageCleanupManifestIn(tx");
    expect(candidateRecovery).not.toMatch(
      /storageGet|storageDelete|headObject|listObjects|resultUrl\s*!==\s*null/,
    );
    expect(recovery).not.toMatch(
      /candidate:.*refund|attempt:.*refund|childRefundReference\(operation, child\)[\s\S]{0,80}evidence_candidate/,
    );
  });

  it("keeps Retry cleanup from scrubbing the active intent or being selected forever", async () => {
    const lifecycle = await source("./db/evidenceCandidates.ts");
    expect(lifecycle).toContain("intent.status !== \"pending\"");
    expect(lifecycle).toContain(
      'inArray(modelIdentityFeatureIntents.status, [\n                  "resolved",\n                  "cancelled",',
    );
    expect(lifecycle).toMatch(
      /eq\(\s*castingEvidenceCandidateAttempts\.status,\s*"cleanup_pending"/,
    );
  });

  it("projects evidence children through a closed moderator/admin allowlist", () => {
    const projected = projectEvidenceCandidateForModerator({
      id: 1,
      type: "evidenceCandidate",
      status: "failed",
      resultUrl: "https://secret.example/candidate.webp",
      errorMessage: "provider secret and signed URL",
      metadata: {
        candidateId: "candidate-1",
        attemptNumber: 2,
        billingRole: "included_retry",
        engine: "gemini-pro-image",
        recipeVersion: "ink-v1",
        normalizedDescriptor: "private tattoo wording",
        privateStorageKey: "users/1/private.webp",
        probeResponse: "raw model prose",
      },
    });
    expect(projected).toEqual({
      id: 1,
      type: "evidenceCandidate",
      status: "failed",
      resultUrl: null,
      errorMessage:
        "The tattoo preview could not be created. Any charged credits were refunded.",
      metadata: {
        candidateId: "candidate-1",
        attemptNumber: 2,
        billingRole: "included_retry",
        engine: "gemini-pro-image",
        recipeVersion: "ink-v1",
      },
    });
    expect(JSON.stringify(projected)).not.toMatch(
      /private tattoo|privateStorageKey|raw model prose|secret\.example/,
    );
  });

  it("keeps model and account deletion closed over every D evidence table and key class", async () => {
    const [modelDeletion, accountDeletion] = await Promise.all([
      source("./casting/finalCastDeletion.ts"),
      source("./db/accountDeletion.ts"),
    ]);
    for (const table of [
      "castingEvidenceCandidateAttempts",
      "castingEvidenceCandidates",
      "modelIdentityFeatureIntents",
      "modelIdentityFeatures",
      "modelIdentityFeatureVersions",
      "modelSnapshotFeatureSelections",
      "modelReferencePlates",
      "modelEvidenceCrops",
    ]) {
      expect(modelDeletion).toContain(table);
      expect(accountDeletion).toContain(table);
    }
    for (const field of [
      "privateStorageKey",
      "promotedPublicStorageKey",
      "storageBackend",
    ]) {
      expect(modelDeletion).toContain(field);
      expect(accountDeletion).toContain(field);
    }
  });
});

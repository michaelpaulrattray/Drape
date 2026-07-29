import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function runtimeFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        output.push(full);
      }
    }
  }
  await walk(root);
  return output;
}

describe("R7-7D D4C atomic Ink acceptance contract", () => {
  it("keeps the Accept wire owner-derived, strict, free, and compile-closed", async () => {
    const route = await readFile(new URL("./routes/evidence.ts", import.meta.url), "utf8");
    const service = await readFile(
      new URL("./casting/evidence/inkCandidateAcceptance.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("acceptInkAddCandidate: protectedProcedure");
    expect(route).toMatch(
      /acceptInkAddCandidate:\s*protectedProcedure[\s\S]*?candidateId:\s*z\.string\(\)\.uuid\(\)[\s\S]*?clientRequestId:\s*z\.string\(\)\.uuid\(\)[\s\S]*?\.strict\(\)/,
    );
    expect(route).not.toMatch(
      /acceptInkAddCandidate:\s*protectedProcedure[\s\S]{0,500}?(userId|modelId|price|storageKey|publicStorageKey|snapshotId|featureId):\s*z\./,
    );
    expect(route).toMatch(
      /acceptInkAddCandidate\(\{ delivery \},\s*\{[\s\S]*?userId:\s*ctx\.user\.id/,
    );
    expect(service).toContain("captureEvidenceComposerEnabled");
    expect(service).toContain('plannedCredits: 0');
    expect(service).not.toMatch(/withAtomicCredits|deductPoints|generateContent|withImageQueue/);
  });

  it("replays only the exact candidate claim before storage or canon work", async () => {
    const source = await readFile(
      new URL("./casting/evidence/inkCandidateAcceptance.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("getGenerationOperationOutcomeByClaim");
    expect(source).toContain('kind: "evidence_candidate_accept"');
    expect(source).toContain("payload: { candidateId: input.candidateId }");
    expect(source.indexOf("const existing = await getOutcome({")).toBeLessThan(
      source.indexOf("const gate = await"),
    );
    expect(source).toContain("closedAcceptedResult");
    expect(source).toContain("readCanonicalEvidenceBytesExact");
    expect(source).toContain("queueUnacceptedPublicCopyCleanup");
    expect(source).toContain("requireDirectOperationRecovery");
  });

  it("reserves the public key only after exact owner, lock, head, candidate and attempt proof", async () => {
    const source = await readFile(
      new URL("./db/inkAddAcceptance.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('.for("update")');
    expect(source).toContain("generationOperationLocks");
    expect(source).toContain("modelOperationLockKey(input.modelId)");
    expect(source).toContain('eq(castingEvidenceCandidates.status, "ready")');
    expect(source).toContain("gt(castingEvidenceCandidates.expiresAt");
    expect(source).toContain('eq(castingEvidenceCandidateAttempts.status, "probe_passed")');
    expect(source).toContain('eq(castingEvidenceCandidateAttempts.overallOutcome, "pass")');
    expect(source).toContain("operation.expectedStateVersion !== model.stateVersion");
    expect(source).toContain("modelSnapshotFeatureSelections");
    expect(source).toContain("promotedPublicStorageKey");
    expect(source).toContain("public_key_changed");
  });

  it("commits the complete feature graph, snapshot pair and free receipt atomically", async () => {
    const commit = await readFile(
      new URL("./casting/evidence/inkAcceptanceCommit.ts", import.meta.url),
      "utf8",
    );
    const transitions = await readFile(
      new URL("./casting/snapshotTransitions.ts", import.meta.url),
      "utf8",
    );
    expect(commit).toContain("commitModelSnapshotTransition");
    expect(commit).toContain("modelReferencePlates");
    expect(commit).toContain('kind: "accepted_candidate"');
    expect(commit).toContain("modelIdentityFeatures");
    expect(commit).toContain("modelIdentityFeatureVersions");
    expect(commit).toContain('reason: "evidence_accept"');
    expect(commit).toContain('selectionReason: "evidence_accept"');
    expect(commit).toContain("affectedViewsForInkAdd");
    expect(commit).toContain(
      "intent.capabilityKey !== input.prepared.capabilityKey",
    );
    expect(commit).toContain(
      "intent.activeCapabilityKey === INK_ACTIVE_FAMILY_KEY",
    );
    expect(commit).toContain("intent.ontologyVersion !== input.prepared.ontologyVersion");
    expect(commit).toContain('attempt.priorInkOutcome !== "pass"');
    expect(commit).toContain("staleViewAngles: affectedViewAngles");
    expect(commit).toContain("featureSelections");
    expect(commit).toContain("carryCurrent: true");
    expect(commit).toContain("sourceViewAngle: input.prepared.sourceViewAngle");
    expect(commit).toContain("acceptsAnchorBearingEvidence");
    expect(commit).toContain("currentRevisionId(context.model)");
    expect(commit).not.toContain("mintRevisionId");
    expect(commit).not.toMatch(/\.update\(models\)[\s\S]*identityRevisionId/);
    expect(commit).toContain("finalizeRunningGenerationOperationSuccessIn");
    expect(commit).toContain('status: "accepted"');
    expect(commit).toContain('status: "resolved"');
    expect(commit).toContain('status: "promoted"');
    expect(commit).not.toMatch(/storagePut|readCanonical|withAtomicCredits|generateContent/);
    expect(transitions).toContain('evidence_accept: "evidence_accept"');
    expect(transitions).toContain("Identity transition is not feature-selection aware");
    expect(transitions).toContain("modelSnapshotFeatureSelections");
    expect(transitions).toContain('input.featureAuthority !== "evidence_aware"');
    expect(transitions).toContain("uniqueAngles.size === 0");
    expect(transitions).toContain("selectivelyStaleAngles");
    expect(transitions).toContain(
      "Evidence acceptance anchor authority is invalid",
    );
    expect(transitions).toContain("eq(modelIdentityFeatures.modelId, input.modelId)");
    expect(transitions).toContain(
      "eq(modelIdentityFeatureVersions.featureId, selection.featureId)",
    );
    expect(transitions).toContain("if (input.finalize) await input.finalize(tx, committed)");
  });

  it("limits D5 acceptance reachability to the explicit loaded-preview callback", async () => {
    const hits: string[] = [];
    for (const file of await runtimeFiles("client/src")) {
      const source = await readFile(file, "utf8");
      if (
        source.includes("acceptInkAddCandidate")
        || source.includes("evidence.accept")
        || source.includes("ink.add.front_upper_torso.v1")
      ) {
        hits.push(file.replaceAll("\\", "/"));
      }
    }
    expect(hits).toEqual([
      "client/src/features/casting/evidence/useInkAddWorkflow.ts",
    ]);
    const workflow = await readFile(hits[0]!, "utf8");
    expect(workflow).toContain("const accept = useCallback(async () =>");
    expect(workflow).toContain('candidateImage.phase !== "loaded"');
    expect(workflow).toContain("await acceptCandidate.mutateAsync");
  });
});

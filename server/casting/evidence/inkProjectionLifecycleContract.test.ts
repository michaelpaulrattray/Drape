import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

function between(value: string, start: string, end: string): string {
  const from = value.indexOf(start);
  const to = value.indexOf(end, from + start.length);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return value.slice(from, to);
}

describe("R7-7G private tattoo projection lifecycle", () => {
  it("accepts N exact feature targets through one shared 1K asset and plate", async () => {
    const commit = await source("./inkAcceptanceCommit.ts");
    const projection = commit.slice(
      commit.indexOf(
        "export async function commitInkProjectionCandidateAcceptance",
      ),
    );
    expect(projection.match(/\.insert\(modelAssets\)/g)).toHaveLength(1);
    expect(projection.match(/\.insert\(modelReferencePlates\)/g)).toHaveLength(1);
    expect(projection).toContain(
      ".insert(modelIdentityFeatureProjectionEvidence).values(",
    );
    expect(projection).toContain("expectedTargets.map((target) => ({");
    expect(projection).toContain("acceptedAssetId: insertedAsset.id");
    expect(projection).toContain(
      "acceptedCandidatePlateId: input.prepared.privatePlateId",
    );
    expect(projection).toContain(
      "pointsCost: slotCost(input.prepared.targetViewAngle)",
    );
    expect(projection).toContain(
      "actualTargets.length !== expectedTargets.length",
    );
    expect(projection).toContain("target.featureVersionId");
    expect(projection).toContain("target.coverageBasis");
    expect(projection.match(/slotChanges:\s*\[\{/g)).toHaveLength(1);
  });

  it("expires and scrubs projection candidates without inventing an intent", async () => {
    const lifecycle = await source("../../db/evidenceCandidates.ts");
    const expiry = between(
      lifecycle,
      "export async function expireNextReadyEvidenceCandidate",
      "/**\n * A failed first attempt",
    );
    expect(expiry).toContain('candidate.purpose === "feature_projection"');
    expect(expiry).toContain("candidate.intentId !== null");
    expect(expiry).toContain("const [intent] = isAuthoring");
    expect(expiry).toContain("intentId: intent?.id ?? null");
    expect(expiry).toContain("purpose: candidate.purpose");

    const cleanup = between(
      lifecycle,
      "export async function settleNextCompletedCandidateCleanup",
      "/**\n * Cancel can resolve an intent",
    );
    expect(cleanup).toContain('row.candidate.purpose === "feature_projection"');
    expect(cleanup).toContain("row.candidate.intentId !== null");
    expect(cleanup).toContain("const [intent] = isAuthoring");
    expect(cleanup).toContain("privateStorageKey: null");
  });

  it("recovers generation, acceptance, and cancellation from durable projection truth", async () => {
    const recovery = await source("../../db/inkAddRecovery.ts");
    expect(recovery).toContain('candidate.purpose === "feature_projection"');
    expect(recovery).toContain("castingEvidenceCandidateFeatureTargets");
    expect(recovery).toContain("modelIdentityFeatureProjectionEvidence");
    expect(recovery).toContain(
      "targetKeys.length !== projectionKeys.length",
    );
    expect(recovery).toContain(
      'purpose: "feature_projection"',
    );
    expect(recovery).toContain("projectedFeatureVersionIds");

    const cancellation = await source("./inkIntentCancellation.ts");
    const projectionCancel = cancellation.slice(
      cancellation.indexOf("export async function cancelInkProjectionCandidate"),
    );
    expect(projectionCancel).toContain(
      'subject.purpose !== "feature_projection"',
    );
    expect(projectionCancel).toContain(
      'payload: {\n      candidateId: input.candidateId,\n      purpose: "feature_projection"',
    );
    expect(projectionCancel).toContain("commitCancelInkProjectionCandidate");
  });

  it("keeps the natural-language wire free of client anatomy authority", async () => {
    const route = await source("../../routes/evidence.ts");
    const begin = between(
      route,
      "beginInkAddIntent: protectedProcedure",
      "attachInkIntentReference: protectedProcedure",
    );
    expect(begin).toContain("instruction: z.string()");
    expect(begin).toContain("clientRequestId: z.string().uuid()");
    expect(begin).toContain("beginInkAnywhereIntent");
    expect(begin).not.toMatch(
      /sourceAssetId:\s*z\.|zone:\s*z\.|surface:\s*z\.|side:\s*z\.|placement/,
    );

    const generation = await source("./inkCandidateGeneration.ts");
    const projection = generation.slice(
      generation.indexOf("async function executeProjectionCandidate"),
      generation.indexOf("export function generateInkProjectionCandidate"),
    );
    expect(projection).toContain(
      "const projectionPrice = slotCost(input.targetViewAngle)",
    );
    expect(projection).toContain("plannedCredits: projectionPrice");
    expect(projection).toContain("amount: projectionPrice");
    expect(projection).toContain("chargedCredits: projectionPrice");

    const intent = await source("./inkAddIntent.ts");
    const capabilityDto = between(
      intent,
      "export interface InkAddCapabilityDto",
      "type BeginOperation",
    );
    expect(capabilityDto).not.toContain("placements:");
    expect(capabilityDto).not.toContain("sourceAssetId:");
    expect(capabilityDto).not.toContain("anatomy:");
  });

  it("admits only explicit current or stale exact projection sources", async () => {
    const candidateRows = await source("../../db/inkAddCandidates.ts");
    expect(candidateRows).toContain(
      '(exact.compatibility !== "current" && exact.compatibility !== "stale")',
    );
    expect(candidateRows).not.toContain(
      'exact.compatibility === "unverified"',
    );
  });

  it("uses each projection slot price for operation locks and reconciliation", async () => {
    const candidateRows = await source("../../db/inkAddCandidates.ts");
    expect(candidateRows).toContain(
      "eq(generationOperations.plannedCredits, plannedCredits)",
    );
    expect(candidateRows).toContain("slotCost(input.targetViewAngle)");
    expect(candidateRows).toContain(
      "priceCredits: slotCost(current.targetViewAngle)",
    );
    expect(candidateRows).toContain(
      "pointsCost: input.attemptNumber === 1 ? input.priceCredits : 0",
    );
    expect(candidateRows).toContain(
      "plannedCreditsForPrepared(input.prepared)",
    );
  });
});

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrivateEvidenceStorageAdapter } from "./evidenceDelivery";
import type { PreparedInkCandidateAcceptance } from "../../db/inkAddAcceptance";
import {
  acceptInkAddCandidate,
  type InkCandidateAcceptanceDependencies,
} from "./inkCandidateAcceptance";
import type { InkCandidateAcceptedResult } from "./inkAcceptanceCommit";

const bytes = Buffer.from("private-canonical-webp");
const prepared: PreparedInkCandidateAcceptance = {
  userId: 7,
  modelId: 11,
  operationId: "11111111-1111-4111-8111-111111111111",
  candidateId: "22222222-2222-4222-8222-222222222222",
  intentId: "33333333-3333-4333-8333-333333333333",
  attemptId: "44444444-4444-4444-8444-444444444444",
  privatePlateId: "55555555-5555-4555-8555-555555555555",
  privateStorageKey:
    "users/7/models/11/evidence/candidates/55555555-5555-4555-8555-555555555555.webp",
  byteSize: bytes.length,
  contentHash: createHash("sha256").update(bytes).digest("hex"),
  width: 512,
  height: 768,
  publicStorageKey:
    "users/7/models/11/generated/ink/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111.webp",
  expectedStateVersion: 4,
  identitySnapshotId: "66666666-6666-4666-8666-666666666666",
  packageSnapshotId: "77777777-7777-4777-8777-777777777777",
  sourceAssetId: 31,
  sourceReferencePlateId: null,
  ontologyVersion: "ink.add.ontology.v1",
  zone: "front_upper_torso",
  surface: "anterior",
  side: "left",
  normalizedDescriptor: "small black geometric sun",
  composerRecipeVersion: "ink.add.front_upper_torso.composer.v1",
  actualImageEngine: "gemini-3-pro-image-preview",
};

const accepted: InkCandidateAcceptedResult = {
  candidateId: prepared.candidateId,
  status: "accepted",
  modelId: prepared.modelId,
  assetId: 99,
  featureId: "88888888-8888-4888-8888-888888888888",
  featureVersionId: "99999999-9999-4999-8999-999999999999",
  identitySnapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  packageSnapshotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  stateVersion: 5,
  chargedCredits: 0,
};

function delivery(): PrivateEvidenceStorageAdapter {
  return {
    putCanonical: vi.fn(async (key) => ({ key })),
    resolveOwnerDelivery: vi.fn(async () => "/candidate"),
    deleteExact: vi.fn(async () => ({ success: true })),
    listCanonicalKeys: vi.fn(async () => []),
    readCanonical: vi.fn(async ({ key, expectedByteSize }) => ({
      key,
      mime: "image/webp" as const,
      byteSize: expectedByteSize,
      body: {
        async *[Symbol.asyncIterator]() {
          yield bytes;
        },
      },
      abort: vi.fn(),
    })),
  };
}

function dependencies(
  overrides: Partial<InkCandidateAcceptanceDependencies> = {},
): InkCandidateAcceptanceDependencies {
  return {
    delivery: delivery(),
    enabledForUser: () => true,
    findClaimSubject: vi.fn(async () => ({
      modelId: prepared.modelId,
      identityRevisionId: "revision-4",
    })),
    getOutcomeByClaim: vi.fn(async () => null),
    begin: vi.fn(async () => ({
      type: "execute",
      operationId: prepared.operationId,
    })),
    markRunning: vi.fn(async () => ({
      operationId: prepared.operationId,
      chargeReferenceId: `op:${prepared.operationId}:charge`,
    })),
    prepare: vi.fn(async (input) => ({
      ...prepared,
      publicStorageKey: input.publicStorageKey,
    })),
    putPublic: vi.fn(async (key) => ({
      key,
      url: `https://public.invalid/${key}`,
    })),
    commit: vi.fn(async () => accepted),
    queueCleanup: vi.fn(async () => undefined),
    completeFailure: vi.fn(async (input) => {
      throw input.error;
    }) as never,
    requireRecovery: vi.fn(async () => {
      throw new Error("recovery_required");
    }) as never,
    ...overrides,
  };
}

describe("ink candidate acceptance", () => {
  it("copies exact private bytes once and commits one free accepted result", async () => {
    const deps = dependencies();
    await expect(acceptInkAddCandidate(deps, {
      userId: prepared.userId,
      candidateId: prepared.candidateId,
      clientRequestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    })).resolves.toEqual(accepted);
    expect(deps.delivery.readCanonical).toHaveBeenCalledWith({
      key: prepared.privateStorageKey,
      expectedByteSize: prepared.byteSize,
    });
    expect(deps.putPublic).toHaveBeenCalledWith(
      expect.stringContaining(`/generated/ink/${prepared.candidateId}/`),
      bytes,
      "image/webp",
    );
    expect(deps.commit).toHaveBeenCalledWith(expect.objectContaining({
      prepared: expect.objectContaining({
        candidateId: prepared.candidateId,
      }),
      publicStorageUrl: expect.stringMatching(/^https:\/\/public\.invalid\//),
    }));
    expect(deps.queueCleanup).not.toHaveBeenCalled();
    expect(deps.completeFailure).not.toHaveBeenCalled();
  });

  it("replays an exact accepted receipt without storage or mutation", async () => {
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => ({
        type: "replay_success",
        operationId: prepared.operationId,
        result: accepted,
      })),
    });
    await expect(acceptInkAddCandidate(deps, {
      userId: prepared.userId,
      candidateId: prepared.candidateId,
      clientRequestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    })).resolves.toEqual(accepted);
    expect(deps.begin).not.toHaveBeenCalled();
    expect(deps.delivery.readCanonical).not.toHaveBeenCalled();
    expect(deps.putPublic).not.toHaveBeenCalled();
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it("refuses while the compile door is closed before any claim or read", async () => {
    const deps = dependencies({ enabledForUser: () => false });
    await expect(acceptInkAddCandidate(deps, {
      userId: prepared.userId,
      candidateId: prepared.candidateId,
      clientRequestId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deps.findClaimSubject).not.toHaveBeenCalled();
    expect(deps.begin).not.toHaveBeenCalled();
  });

  it("queues the pre-recorded public key and fails free when copy refuses", async () => {
    let outcomeReads = 0;
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => {
        outcomeReads += 1;
        return outcomeReads === 1
          ? null
          : {
              type: "in_progress" as const,
              operationId: prepared.operationId,
              status: "running" as const,
            };
      }),
      putPublic: vi.fn(async () => {
        throw new Error("provider-private-detail");
      }),
    });
    await expect(acceptInkAddCandidate(deps, {
      userId: prepared.userId,
      candidateId: prepared.candidateId,
      clientRequestId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.not.stringContaining("provider-private-detail"),
    });
    expect(deps.queueCleanup).toHaveBeenCalledWith(expect.objectContaining({
      publicStorageKey: expect.stringContaining(prepared.candidateId),
    }));
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.completeFailure).toHaveBeenCalledWith(expect.objectContaining({
      chargedCredits: 0,
      refundedCredits: 0,
    }));
  });

  it("recovers a committed outcome after an ambiguous commit response", async () => {
    let outcomeReads = 0;
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => {
        outcomeReads += 1;
        return outcomeReads === 1
          ? null
          : {
              type: "replay_success" as const,
              operationId: prepared.operationId,
              result: accepted,
            };
      }),
      commit: vi.fn(async () => {
        throw new Error("commit response lost");
      }),
    });
    await expect(acceptInkAddCandidate(deps, {
      userId: prepared.userId,
      candidateId: prepared.candidateId,
      clientRequestId: "12121212-1212-4212-8212-121212121212",
    })).resolves.toEqual(accepted);
    expect(deps.queueCleanup).not.toHaveBeenCalled();
    expect(deps.completeFailure).not.toHaveBeenCalled();
  });
});

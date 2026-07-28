import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/connection")>();
  return { ...actual, getDb: vi.fn() };
});
vi.mock("../../db/credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/credits")>();
  return { ...actual, addCredits: vi.fn() };
});
vi.mock("../../db/generationOperations", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../db/generationOperations")
  >();
  return {
    ...actual,
    finalizeGenerationOperationFailure: vi.fn(),
    finalizeGenerationOperationSuccess: vi.fn(),
  };
});

import type { GenerationOperation } from "../../../drizzle/schema";
import { addCredits, normalizeCreditReferenceId } from "../../db/credits";
import { getDb } from "../../db/connection";
import {
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
} from "../../db/generationOperations";
import {
  recoverEvidencePackageSyncOperation,
} from "../operationRecovery";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const CHARGE_REFERENCE = `op:${OPERATION_ID}:charge`;

function operation(
  overrides: Partial<GenerationOperation> = {},
): GenerationOperation {
  return {
    id: OPERATION_ID,
    userId: 1,
    clientRequestId: "22222222-2222-4222-8222-222222222222",
    kind: "evidence_package_sync",
    modelId: 4,
    originBoardId: null,
    originItemId: null,
    payloadHash: "a".repeat(64),
    status: "running",
    expectedIdentityRevisionId: "rev-1",
    expectedStateVersion: 3,
    expectedIdentitySnapshotId: "identity-1",
    expectedPackageSnapshotId: "package-1",
    plannedCredits: 300,
    chargedCredits: 0,
    refundedCredits: 0,
    chargeReferenceId: CHARGE_REFERENCE,
    result: null,
    errorCode: null,
    publicMessage: null,
    phase: "refreshing",
    progress: {
      total: 1,
      completed: 0,
      failed: 0,
      steps: [{
        stepKey: "view:sideFull",
        viewAngle: "sideFull",
        status: "processing",
      }],
    },
    heartbeatAt: new Date(),
    leaseExpiresAt: new Date(),
    landingStatus: "not_applicable",
    landedItemId: null,
    landingAcknowledgedAt: null,
    recoveryAttemptedAt: null,
    subjectDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

function queryResult(value: unknown[]) {
  const chain = {
    from() { return chain; },
    where() { return chain; },
    limit() { return Promise.resolve(value); },
    then(resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return chain;
}

function mockSelects(...results: unknown[][]) {
  const queue = [...results];
  const db = {
    select: vi.fn(() => queryResult(queue.shift() ?? [])),
  };
  vi.mocked(getDb).mockResolvedValue(db as never);
  return db;
}

beforeEach(() => {
  vi.mocked(addCredits).mockReset().mockResolvedValue({ success: true });
  vi.mocked(finalizeGenerationOperationFailure).mockReset();
  vi.mocked(finalizeGenerationOperationSuccess).mockReset();
  vi.mocked(getDb).mockReset();
});

describe("evidence package stale-operation recovery", () => {
  it("refunds the exact persisted requested view after a charged pre-commit crash", async () => {
    mockSelects(
      [{ type: "generation", amount: -300, referenceId: CHARGE_REFERENCE }],
      [],
      [],
    );

    const result = await recoverEvidencePackageSyncOperation(operation());

    expect(result).toEqual({
      type: "terminal_failure",
      chargedCredits: 300,
      refundedCredits: 300,
    });
    expect(addCredits).toHaveBeenCalledWith(
      1,
      300,
      "refund",
      "Recovery refund: evidence package view did not settle",
      expect.any(String),
    );
    expect(finalizeGenerationOperationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION_ID,
        chargedCredits: 300,
        refundedCredits: 300,
      }),
    );
  });

  it("reconstructs a committed partial snapshot and refunds only the failed view", async () => {
    const snapshot = { id: "package-2" };
    mockSelects(
      [{ type: "generation", amount: -600, referenceId: CHARGE_REFERENCE }],
      [snapshot],
      [],
      [{ id: 4, currentPackageSnapshotId: "package-2" }],
      [
        {
          viewAngle: "sideFull",
          selectedAssetId: 901,
          compatibility: "current",
          selectionReason: "refreshed",
        },
      ],
      [{
        id: 901,
        viewType: "sideFull",
        storageUrl: "https://r2/walk.png",
        pointsCost: 300,
        provenance: {
          source: "evidence_package_sync",
          acceptedFeatureVersionId: "version-1",
        },
      }],
    );

    const result = await recoverEvidencePackageSyncOperation(operation({
      plannedCredits: 600,
      progress: {
        total: 2,
        completed: 1,
        failed: 1,
        steps: [
          {
            stepKey: "view:sideFull",
            viewAngle: "sideFull",
            status: "completed",
          },
          {
            stepKey: "view:threeQuarter",
            viewAngle: "threeQuarter",
            status: "failed",
          },
        ],
      },
    }));

    expect(result).toEqual({ type: "durable_success" });
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(finalizeGenerationOperationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION_ID,
        chargedCredits: 600,
        refundedCredits: 300,
        terminalStatus: "partial",
        result: {
          refreshed: [{ angle: "sideFull", assetId: 901 }],
          failedAngles: ["threeQuarter"],
        },
      }),
    );
  });

  it("does not guess when the package snapshot is not the model's live head", async () => {
    mockSelects(
      [{ type: "generation", amount: -300, referenceId: CHARGE_REFERENCE }],
      [{ id: "package-2" }],
      [],
      [{ id: 4, currentPackageSnapshotId: "package-other" }],
    );

    await expect(recoverEvidencePackageSyncOperation(operation())).resolves
      .toEqual({
        type: "recovery_required",
        chargedCredits: 300,
        refundedCredits: 0,
      });
    expect(addCredits).not.toHaveBeenCalled();
    expect(finalizeGenerationOperationSuccess).not.toHaveBeenCalled();
    expect(finalizeGenerationOperationFailure).not.toHaveBeenCalled();
  });

  it("does not finalize a committed view whose refund already exists", async () => {
    const refundReference = normalizeCreditReferenceId(
      `refund:${CHARGE_REFERENCE}:slot:sideFull`,
    );
    mockSelects(
      [{ type: "generation", amount: -300, referenceId: CHARGE_REFERENCE }],
      [{ id: "package-2" }],
      [{ type: "refund", amount: 300, referenceId: refundReference }],
      [{ id: 4, currentPackageSnapshotId: "package-2" }],
      [{
        viewAngle: "sideFull",
        selectedAssetId: 901,
        compatibility: "current",
        selectionReason: "refreshed",
      }],
      [{
        id: 901,
        viewType: "sideFull",
        storageUrl: "https://r2/walk.png",
        pointsCost: 300,
        provenance: {
          source: "evidence_package_sync",
          acceptedFeatureVersionId: "version-1",
        },
      }],
    );

    await expect(recoverEvidencePackageSyncOperation(operation())).resolves
      .toEqual({
        type: "recovery_required",
        chargedCredits: 300,
        refundedCredits: 300,
      });
    expect(finalizeGenerationOperationSuccess).not.toHaveBeenCalled();
  });

  it("hands a pre-charge receipt back to generic free-failure recovery", async () => {
    mockSelects([], []);
    await expect(recoverEvidencePackageSyncOperation(operation({
      chargeReferenceId: CHARGE_REFERENCE,
      progress: null,
    }))).resolves.toEqual({ type: "not_committed" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const recoveryTx = vi.hoisted(() => ({
  current: null as unknown,
}));

vi.mock("../../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/connection")>();
  return {
    ...actual,
    getDb: vi.fn(),
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(recoveryTx.current)
    ),
  };
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
vi.mock("./evidencePackageFeatureRows", () => ({
  readEvidencePackageFeatureRowsIn: vi.fn(),
}));
vi.mock("./evidencePackagePlan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./evidencePackagePlan")>();
  return {
    ...actual,
    assessSupportedInkFeatureGraph: vi.fn(),
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
  recoverEvidenceMintOperation,
  recoverEvidencePackageSyncOperation,
} from "../operationRecovery";
import { readEvidencePackageFeatureRowsIn } from "./evidencePackageFeatureRows";
import { assessSupportedInkFeatureGraph } from "./evidencePackagePlan";

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
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(db)
    ),
  };
  recoveryTx.current = db;
  vi.mocked(getDb).mockResolvedValue(db as never);
  return db;
}

beforeEach(() => {
  vi.mocked(addCredits).mockReset().mockResolvedValue({ success: true });
  vi.mocked(finalizeGenerationOperationFailure).mockReset();
  vi.mocked(finalizeGenerationOperationSuccess).mockReset();
  vi.mocked(getDb).mockReset();
  vi.mocked(readEvidencePackageFeatureRowsIn).mockReset().mockResolvedValue({
    graph: {
      identities: [],
      selections: [],
      versions: [],
      dependencies: [],
    },
    hasUnresolvedIntentOrReadyCandidate: false,
  });
  vi.mocked(assessSupportedInkFeatureGraph).mockReset().mockReturnValue({
    selection: {},
    version: {},
    dependency: {},
  } as never);
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

describe("zero-generation evidence mint recovery", () => {
  function mintOperation(
    overrides: Partial<GenerationOperation> = {},
  ): GenerationOperation {
    return operation({
      kind: "evidence_mint",
      plannedCredits: 0,
      expectedIdentitySnapshotId: "identity-1",
      expectedPackageSnapshotId: "package-1",
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        steps: [{
          stepKey: "mint:core",
          viewAngle: null,
          status: "pending",
        }],
      },
      ...overrides,
    });
  }

  it("reconstructs one sealed mint snapshot with zero accounting", async () => {
    mockSelects(
      [],
      [{
        id: "package-2",
        modelId: 4,
        reason: "mint",
        parentPackageSnapshotId: "package-1",
        identitySnapshotId: "identity-1",
      }],
      [{
        id: 4,
        userId: 1,
        status: "active",
        agencyId: "KI-2345-6789-ABCD-EFGH",
        mintedAt: new Date(),
        currentPackageSnapshotId: "package-2",
        sealedPackageSnapshotId: "package-2",
        sealedIdentitySnapshotId: "identity-1",
        stateVersion: 4,
      }],
      [
        ...["frontClose", "threeQuarter", "sideClose", "frontFull"].map(
          (viewAngle, index) => ({
            packageSnapshotId: "package-2",
            viewAngle,
            selectedAssetId: 100 + index,
            compatibility: "current",
            selectionReason: "carried",
            sourceSelectionId: `source-${index}`,
          }),
        ),
        {
          packageSnapshotId: "package-2",
          viewAngle: "sideFull",
          selectedAssetId: 104,
          compatibility: "stale",
          selectionReason: "carried",
          sourceSelectionId: "source-4",
        },
      ],
      [
        ...["frontClose", "threeQuarter", "sideClose", "frontFull", "sideFull"]
          .map((viewType, index) => ({
            id: 100 + index,
            modelId: 4,
            viewType,
            storageUrl: `https://r2.invalid/${viewType}.png`,
          })),
      ],
    );

    await expect(recoverEvidenceMintOperation(mintOperation())).resolves
      .toEqual({ type: "durable_success" });
    expect(finalizeGenerationOperationSuccess).toHaveBeenCalledWith({
      userId: 1,
      operationId: OPERATION_ID,
      result: {
        agencyId: "KI-2345-6789-ABCD-EFGH",
        minted: true,
        tier: "core",
        generated: [],
        failedAngles: [],
      },
      chargedCredits: 0,
      refundedCredits: 0,
    });
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("finalizes a provably unchanged pre-commit draft as a free failure", async () => {
    mockSelects(
      [],
      [],
      [{
        id: 4,
        userId: 1,
        status: "draft",
        agencyId: null,
        mintedAt: null,
        currentPackageSnapshotId: "package-1",
        sealedPackageSnapshotId: null,
        sealedIdentitySnapshotId: null,
        stateVersion: 3,
      }],
    );

    await expect(recoverEvidenceMintOperation(mintOperation())).resolves
      .toEqual({ type: "free_failure" });
    expect(finalizeGenerationOperationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        chargedCredits: 0,
        refundedCredits: 0,
      }),
    );
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("refuses to guess when money moved or the live seal differs", async () => {
    mockSelects([{ id: 1 }]);
    await expect(recoverEvidenceMintOperation(mintOperation())).resolves
      .toEqual({ type: "recovery_required" });
    expect(finalizeGenerationOperationSuccess).not.toHaveBeenCalled();
    expect(finalizeGenerationOperationFailure).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GenerationOperationDto } from "@/features/operations/generationOperationProjection";
import {
  operationToGenerationJob,
  projectServerJobs,
} from "@/features/operations/generationOperationProjection";
import { useGenerationJobs } from "@/features/boards/stores/useGenerationJobs";
import { modelCreateInputSchema } from "./routes/modelCreateInput";

const OPERATION_ID = "6fa459ea-ee8a-4ca4-894e-db77e160355e";
const REQUEST_ID = "7fa459ea-ee8a-4ca4-894e-db77e160355f";
const NOW = "2026-07-19T00:00:00.000Z";

function operation(overrides: Partial<GenerationOperationDto> = {}): GenerationOperationDto {
  return {
    operationId: OPERATION_ID,
    clientRequestId: REQUEST_ID,
    kind: "casting.headshot",
    modelId: null,
    originBoardId: 8,
    originItemId: 9,
    status: "running",
    phase: "generating",
    progress: null,
    plannedCredits: 300,
    chargedCredits: 300,
    refundedCredits: 0,
    netCredits: 300,
    result: null,
    publicMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    heartbeatAt: NOW,
    leaseExpiresAt: NOW,
    cancellable: false,
    landingStatus: "not_applicable",
    landedItemId: null,
    landingAcknowledgedAt: null,
    children: [],
    ...overrides,
  };
}

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

beforeEach(() => {
  useGenerationJobs.setState({ jobs: {}, operations: [] });
});

describe("R7-2D server-backed Canvas operation projection", () => {
  it("projects a pre-headshot model-null receipt onto its origin Cast node", () => {
    const job = operationToGenerationJob(operation({ kind: "model.create", plannedCredits: 0, chargedCredits: 0 }));
    expect(job).toMatchObject({
      itemId: 9,
      operationId: OPERATION_ID,
      source: "server",
      status: "running",
    });
  });

  it("lets current server work outrank an older terminal receipt for the same node", () => {
    const older = operation({
      operationId: "1fa459ea-ee8a-4ca4-894e-db77e160355a",
      status: "succeeded",
      completedAt: NOW,
      landingStatus: "not_applicable",
      updatedAt: "2026-07-19T00:00:01.000Z",
    });
    const active = operation({ updatedAt: "2026-07-19T00:00:00.000Z" });
    expect(projectServerJobs([older, active])[9]).toMatchObject({
      operationId: OPERATION_ID,
      status: "running",
    });
  });

  it("removes stale server jobs without deleting unrelated optimistic work", () => {
    const store = useGenerationJobs.getState();
    store.startJob({ itemId: 30, operation: "local", estimatedDurationMs: 1_000 });
    store.syncServerOperations([operation()]);
    expect(useGenerationJobs.getState().jobs[9]?.source).toBe("server");
    expect(useGenerationJobs.getState().jobs[30]?.source).toBe("local");

    useGenerationJobs.getState().syncServerOperations([]);
    expect(useGenerationJobs.getState().jobs[9]).toBeUndefined();
    expect(useGenerationJobs.getState().jobs[30]?.source).toBe("local");
  });

  it("requires Canvas origin ids as an all-or-nothing strict pair", () => {
    const base = { clientRequestId: REQUEST_ID, preferences: {} };
    expect(modelCreateInputSchema.safeParse({ ...base, originBoardId: 8, originItemId: 9 }).success).toBe(true);
    expect(modelCreateInputSchema.safeParse({ ...base, originBoardId: 8 }).success).toBe(false);
    expect(modelCreateInputSchema.safeParse({ ...base, originItemId: 9 }).success).toBe(false);
  });

  it("has one durable ceremony owner and a non-destructive relink surface", () => {
    const app = source("client/src/App.tsx");
    const bridge = source("client/src/features/operations/GenerationOperationBridge.tsx");
    const board = source("client/src/features/boards/BoardPage.tsx");
    const castNode = source("client/src/features/boards/canvas/nodes/CastNode.tsx");
    const imaging = source("server/routes/generation/castingImaging.ts");

    expect(app).toContain("<GenerationOperationBridge />");
    expect(app).not.toContain("CastingOperationOwner");
    expect(bridge).toContain("settled.landedNow");
    expect(bridge).toContain("settled.acknowledgedNow");
    expect(board).toContain("Your cast finished");
    expect(board).toContain("Place result");
    expect(board).toContain("Keep in Models");
    expect(board).toContain("target?.kind === 'cast_config' && !target.imageUrl && !target.sourceModelId");
    expect(castNode).toContain("progressLabel={controller.progressLabel}");
    expect(imaging).toMatch(/result:\s*\{[\s\S]*?modelId: input\.modelId,[\s\S]*?assetId: assetResult\.assetId![\s\S]*?imageUrl: result\.imageUrl/);
    expect(imaging).toContain('landing: { status: "pending" as const }');
  });
});

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import type { GenerationJob, GenerationJobStatus } from "../boards/stores/useGenerationJobs";
import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "@shared/boardTypes";

export type GenerationOperationDto =
  inferRouterOutputs<AppRouter>["generation"]["activeOperations"][number];

const ACTIVE_STATUSES = new Set(["claimed", "running"]);

const PHASE_COPY: Record<string, string> = {
  planning: "Preparing…",
  generating: "Generating…",
  saving: "Saving result…",
  refreshing: "Refreshing views…",
  minting: "Casting model…",
  landing: "Placing result…",
  finalizing: "Finishing…",
  reconciling: "Checking result…",
};

const ESTIMATED_MS: Record<string, number> = {
  "model.create": 15_000,
  "casting.headshot": 30_000,
  "casting.iterate": 25_000,
  "casting.mint": 90_000,
  "casting.add_views": 75_000,
  "casting.refresh": 75_000,
  "canvas.cast": 30_000,
  "canvas.recast": 30_000,
  "canvas.fork": 30_000,
  "canvas.variations": 45_000,
};

export function isOperationActive(operation: GenerationOperationDto): boolean {
  return ACTIVE_STATUSES.has(operation.status);
}

export function operationDedupeKey(operation: GenerationOperationDto): string {
  return `${operation.operationId}:${operation.updatedAt}:${operation.status}:${operation.landingStatus}`;
}

export function operationPhaseLabel(operation: GenerationOperationDto): string {
  if (operation.status === "recovery_required") return operation.publicMessage || "Generation needs attention";
  if (operation.status === "failed") return operation.publicMessage || "Generation failed";
  if (operation.phase && PHASE_COPY[operation.phase]) return PHASE_COPY[operation.phase];
  return operation.status === "claimed" ? "Preparing…" : "Generating…";
}

function projectedStatus(operation: GenerationOperationDto): GenerationJobStatus {
  if (operation.status === "claimed" || operation.status === "running") return "running";
  if (operation.status === "failed" || operation.status === "recovery_required") return "failed";
  return "done";
}

export function operationToGenerationJob(
  operation: GenerationOperationDto,
): GenerationJob | null {
  if (!operation.originItemId) return null;
  const status = projectedStatus(operation);
  return {
    itemId: operation.originItemId,
    operation: operation.kind,
    operationId: operation.operationId,
    source: "server",
    status,
    phaseLabel: operationPhaseLabel(operation),
    startedAt: Date.parse(operation.createdAt),
    estimatedDurationMs: ESTIMATED_MS[operation.kind] ?? 45_000,
    ...(status === "failed"
      ? { error: operation.publicMessage || "Generation needs attention." }
      : {}),
  };
}

function operationRank(operation: GenerationOperationDto): number {
  if (operation.status === "running") return 4;
  if (operation.status === "claimed") return 3;
  if (operation.status === "recovery_required") return 2;
  return 1;
}

/** One server operation owns one origin node. If old unacknowledged terminal
 * work and a newer active operation share that origin, active truth wins. */
export function projectServerJobs(
  operations: readonly GenerationOperationDto[],
): Record<number, GenerationJob> {
  const chosen = new Map<number, GenerationOperationDto>();
  for (const operation of operations) {
    if (!operation.originItemId) continue;
    const current = chosen.get(operation.originItemId);
    if (
      !current ||
      operationRank(operation) > operationRank(current) ||
      (operationRank(operation) === operationRank(current) && operation.updatedAt > current.updatedAt)
    ) chosen.set(operation.originItemId, operation);
  }
  return Object.fromEntries(
    Array.from(chosen.entries()).flatMap(([itemId, operation]) => {
      const job = operationToGenerationJob(operation);
      return job ? [[itemId, job]] : [];
    }),
  );
}

const CANONICAL_ANGLE_SET = new Set<string>(CANONICAL_VIEW_ANGLES);

function canonicalAngle(value: string | null | undefined): CanonicalViewAngle | null {
  return value && CANONICAL_ANGLE_SET.has(value)
    ? value as CanonicalViewAngle
    : null;
}

/** Server-owned per-view busy truth. Completed/failed children stop spinning
 * independently while their sibling attempts continue. */
export function projectRefreshingByModel(
  operations: readonly GenerationOperationDto[],
): Record<number, CanonicalViewAngle[]> {
  const projected = new Map<number, Set<CanonicalViewAngle>>();
  for (const operation of operations) {
    if (!isOperationActive(operation) || operation.modelId === null) continue;
    const modelAngles = projected.get(operation.modelId) ?? new Set<CanonicalViewAngle>();
    const childRows = operation.children.length > 0
      ? operation.children
      : operation.progress?.steps ?? [];
    for (const child of childRows) {
      if (child.status !== "pending" && child.status !== "processing") continue;
      const angle = canonicalAngle(child.viewAngle);
      if (angle) modelAngles.add(angle);
    }
    if (modelAngles.size > 0) projected.set(operation.modelId, modelAngles);
  }
  return Object.fromEntries(
    Array.from(projected.entries()).map(([modelId, angles]) => [modelId, Array.from(angles)]),
  );
}

function studioOperationRank(operation: GenerationOperationDto): number {
  if (operation.status === "recovery_required") return 5;
  if (operation.status === "running") return 4;
  if (operation.status === "claimed") return 3;
  return 0;
}

const STUDIO_HEADLINE_KINDS = new Set([
  "model.create",
  "casting.headshot",
  "casting.iterate",
  "casting.mint",
]);

/** One durable operation owns Studio's headline state for a model. Recovery
 * truth outranks an active spinner; otherwise the newest equally-ranked row
 * wins. Terminal success/failure is handled by query invalidation and the
 * saved model/package read models, not a client settlement payload. */
export function selectStudioOperation(
  operations: readonly GenerationOperationDto[],
  modelId: number | null,
): GenerationOperationDto | null {
  if (modelId === null) return null;
  let chosen: GenerationOperationDto | null = null;
  for (const operation of operations) {
    if (
      operation.modelId !== modelId
      || !STUDIO_HEADLINE_KINDS.has(operation.kind)
      || studioOperationRank(operation) === 0
    ) continue;
    if (
      !chosen ||
      studioOperationRank(operation) > studioOperationRank(chosen) ||
      (studioOperationRank(operation) === studioOperationRank(chosen)
        && operation.updatedAt > chosen.updatedAt)
    ) {
      chosen = operation;
    }
  }
  return chosen;
}

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import type { GenerationJob, GenerationJobStatus } from "../boards/stores/useGenerationJobs";

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

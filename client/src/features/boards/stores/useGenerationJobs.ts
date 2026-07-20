/**
 * useGenerationJobs — the ONE global Zustand store canvas code may use
 * (CANVAS_FOUNDATIONS.md Decision 4). Orchestration only: in-flight job
 * status keyed by itemId. It never holds form values.
 *
 * D-18 contract: media- and engine-agnostic, tolerant of minutes-long jobs
 * (video, pass 4). Progress is time-based against estimatedDurationMs —
 * nothing assumes a fast image round-trip or a single-image result.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  projectServerJobs,
  type GenerationOperationDto,
} from "../../operations/generationOperationProjection";

export type GenerationJobStatus = "queued" | "running" | "failed" | "done";

export interface GenerationJob {
  itemId: number;
  operation: string; // "runGeneration" | "generateViews" | "runRefinement" | …
  engine?: string;
  status: GenerationJobStatus;
  phaseLabel?: string; // "Writing casting spec…" — optional server-driven phase
  startedAt: number; // Date.now()
  estimatedDurationMs: number;
  error?: string;
  operationId?: string;
  source?: "local" | "server";
}

interface GenerationJobsState {
  jobs: Record<number, GenerationJob>;
  operations: GenerationOperationDto[];
  startJob: (job: Omit<GenerationJob, "status" | "startedAt"> & { startedAt?: number }) => void;
  setPhase: (itemId: number, phaseLabel: string) => void;
  completeJob: (itemId: number) => void;
  failJob: (itemId: number, error: string) => void;
  clearJob: (itemId: number) => void;
  syncServerOperations: (operations: GenerationOperationDto[]) => void;
  isGenerating: (itemId: number) => boolean;
}

export const useGenerationJobs = create<GenerationJobsState>()(
  devtools(
    (set, get) => ({
      jobs: {},
      operations: [],

      startJob: (job) =>
        set(
          (s) => ({
            jobs: {
              ...s.jobs,
              [job.itemId]: {
                ...job,
                source: job.source ?? "local",
                status: "running",
                startedAt: job.startedAt ?? Date.now(),
              },
            },
          }),
          false,
          "startJob",
        ),

      setPhase: (itemId, phaseLabel) =>
        set(
          (s) => {
            const job = s.jobs[itemId];
            if (!job) return s;
            return { jobs: { ...s.jobs, [itemId]: { ...job, phaseLabel } } };
          },
          false,
          "setPhase",
        ),

      completeJob: (itemId) =>
        set(
          (s) => {
            const job = s.jobs[itemId];
            if (!job) return s;
            return { jobs: { ...s.jobs, [itemId]: { ...job, status: "done" } } };
          },
          false,
          "completeJob",
        ),

      failJob: (itemId, error) =>
        set(
          (s) => {
            const job = s.jobs[itemId];
            if (!job) return s;
            return { jobs: { ...s.jobs, [itemId]: { ...job, status: "failed", error } } };
          },
          false,
          "failJob",
        ),

      clearJob: (itemId) =>
        set(
          (s) => {
            const { [itemId]: _, ...rest } = s.jobs;
            return { jobs: rest };
          },
          false,
          "clearJob",
        ),

      syncServerOperations: (operations) =>
        set(
          (s) => {
            const localJobs = Object.fromEntries(
              Object.entries(s.jobs).filter(([, job]) => job.source !== "server"),
            ) as Record<number, GenerationJob>;
            return {
              operations: [...operations],
              jobs: { ...localJobs, ...projectServerJobs(operations) },
            };
          },
          false,
          "syncServerOperations",
        ),

      isGenerating: (itemId) => get().jobs[itemId]?.status === "running",
    }),
    { name: "GenerationJobs" },
  ),
);

/**
 * Time-based progress for a running job: asymptotically approaches (never
 * reaches) 97% against estimatedDurationMs, so long jobs keep visibly moving
 * without lying about completion.
 */
export function jobProgressFraction(job: GenerationJob | undefined, now = Date.now()): number {
  if (!job) return 0;
  if (job.status === "done") return 1;
  const elapsed = Math.max(0, now - job.startedAt);
  const linear = elapsed / Math.max(1, job.estimatedDurationMs);
  return Math.min(0.97, 1 - Math.exp(-1.6 * linear));
}

export function jobElapsedSeconds(job: GenerationJob | undefined, now = Date.now()): number {
  if (!job) return 0;
  return Math.max(0, Math.round((now - job.startedAt) / 1000));
}

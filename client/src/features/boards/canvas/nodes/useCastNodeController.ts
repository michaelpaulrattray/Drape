/**
 * useCastNodeController — binds a cast node to boardOps + useGenerationJobs
 * (DESIGN_SYSTEM.md §5.11). All mutation plumbing lives here; CastNode stays
 * thin. This is the node-local CastingBindings-style surface — no legacy
 * casting store may be imported here (D-24).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  useGenerationJobs,
  jobProgressFraction,
  jobElapsedSeconds,
} from "../../stores/useGenerationJobs";
import type { NodePromptState } from "../NodeInlinePrompt";
import type { CastNodeData } from "./CastNode";

export function useCastNodeController(data: CastNodeData) {
  const utils = trpc.useUtils();
  const { startJob, completeJob, failJob } = useGenerationJobs();
  const job = useGenerationJobs((s) => s.jobs[data.itemId]);

  const [promptValue, setPromptValue] = useState<string>(data.userPrompt ?? "");
  // Progress re-render ticker while a job runs (time-based progress, D-18)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (job?.status !== "running") return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [job?.status]);

  const generating = job?.status === "running";
  // Generating takes precedence: a node mid-generation is NOT "empty" — the
  // paid wait must render progress, never the placeholder (VC2 fix #1).
  const isEmpty = !data.imageUrl && data.status?.type !== "error" && !generating;

  // Cost before Run — always from the server plan (Decision 6)
  const planQuery = trpc.boardOps.runGeneration.plan.useQuery(
    { boardId: data.boardId, itemId: data.itemId },
    { enabled: isEmpty && !generating, staleTime: 60_000 },
  );
  const runCost = planQuery.data?.estimatedCreditCost ?? null;

  const runMutation = trpc.boardOps.runGeneration.execute.useMutation({
    onSuccess: () => {
      completeJob(data.itemId);
      utils.boards.getItems.invalidate({ boardId: data.boardId });
      utils.credits.getBalance.invalidate();
    },
    onError: (err) => {
      failJob(data.itemId, err.message);
      // Server stamped the error status + refunded — refetch shows the error card
      utils.boards.getItems.invalidate({ boardId: data.boardId });
      toast.error(err.message);
    },
  });

  const fillMutation = trpc.boardOps.fillFromLibrary.useMutation({
    onSuccess: () => {
      utils.boards.getItems.invalidate({ boardId: data.boardId });
      toast.success("Model placed");
    },
    onError: (err) => toast.error(err.message),
  });

  const canRun = promptValue.trim().length > 0;

  const run = useCallback(() => {
    if (!canRun || generating) return;
    startJob({
      itemId: data.itemId,
      operation: "runGeneration",
      estimatedDurationMs: planQuery.data?.estimatedDurationMs ?? 20_000,
    });
    runMutation.mutate({
      boardId: data.boardId,
      itemId: data.itemId,
      userPrompt: promptValue.trim(),
    });
  }, [canRun, generating, data.boardId, data.itemId, promptValue, planQuery.data, runMutation, startJob]);

  const retry = useCallback(() => {
    // Clear the error status, then rerun with the same prompt
    startJob({
      itemId: data.itemId,
      operation: "runGeneration",
      estimatedDurationMs: 20_000,
    });
    runMutation.mutate({
      boardId: data.boardId,
      itemId: data.itemId,
      userPrompt: (promptValue || data.userPrompt || "").trim() || undefined,
    });
  }, [data.boardId, data.itemId, data.userPrompt, promptValue, runMutation, startJob]);

  const fillFromLibrary = useCallback(
    (modelId: number) => {
      fillMutation.mutate({ boardId: data.boardId, itemId: data.itemId, modelId });
    },
    [data.boardId, data.itemId, fillMutation],
  );

  const promptState: NodePromptState = generating
    ? "generating"
    : data.imageUrl
      ? "complete"
      : "ready"; // "ready" vs "empty" is expressed via canRun on the Run button

  const runOrEdit = useCallback(() => {
    if (promptState === "complete") {
      toast.info("Refinement studio arrives in M8");
      return;
    }
    run();
  }, [promptState, run]);

  return {
    promptValue,
    setPromptValue,
    promptState,
    isEmpty,
    canRun,
    runCost,
    runOrEdit,
    retry,
    fillFromLibrary,
    fillPending: fillMutation.isPending,
    progressFraction: jobProgressFraction(job),
    progressSeconds: jobElapsedSeconds(job),
  };
}

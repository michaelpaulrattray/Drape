/**
 * useCastActions — the boardOps mutation surface for one cast node, shared by
 * the node controller (retry) and the CastPickerModal (run / fill). Lives
 * outside the node component so the picker survives the optimistic temp→real
 * id remount (VC2 fix #3 aftermath). No legacy casting store imports (D-24).
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useGenerationJobs } from "../stores/useGenerationJobs";

export function useCastActions(options: {
  boardId: number;
  itemId: number;
  /** Plan (cost preview) only runs when the caller says the node is runnable. */
  enablePlan: boolean;
}) {
  const { boardId, itemId, enablePlan } = options;
  const utils = trpc.useUtils();
  const { startJob, completeJob, failJob } = useGenerationJobs();
  const job = useGenerationJobs((s) => s.jobs[itemId]);
  const generating = job?.status === "running";

  // Cost before Run — always from the server plan (Decision 6). Gated on a
  // confirmed server id: optimistic temp nodes (negative id) can't plan yet.
  const planQuery = trpc.boardOps.runGeneration.plan.useQuery(
    { boardId, itemId },
    { enabled: enablePlan && !generating && itemId > 0, staleTime: 60_000 },
  );
  const runCost = planQuery.data?.estimatedCreditCost ?? null;

  const runMutation = trpc.boardOps.runGeneration.execute.useMutation({
    onSuccess: () => {
      completeJob(itemId);
      utils.boards.getItems.invalidate({ boardId });
      utils.credits.getBalance.invalidate();
    },
    onError: (err) => {
      failJob(itemId, err.message);
      // Server stamped the error status + refunded — refetch shows the error card
      utils.boards.getItems.invalidate({ boardId });
      toast.error(err.message);
    },
  });

  const fillMutation = trpc.boardOps.fillFromLibrary.useMutation({
    onSuccess: () => {
      utils.boards.getItems.invalidate({ boardId });
      toast.success("Model placed");
    },
    onError: (err) => toast.error(err.message),
  });

  const run = useCallback(
    (prompt: string) => {
      if (!prompt.trim() || generating || itemId < 0) return;
      startJob({
        itemId,
        operation: "runGeneration",
        estimatedDurationMs: planQuery.data?.estimatedDurationMs ?? 20_000,
      });
      runMutation.mutate({ boardId, itemId, userPrompt: prompt.trim() });
    },
    [generating, boardId, itemId, planQuery.data, runMutation, startJob],
  );

  const retry = useCallback(
    (userPrompt?: string) => {
      startJob({ itemId, operation: "runGeneration", estimatedDurationMs: 20_000 });
      runMutation.mutate({
        boardId,
        itemId,
        userPrompt: (userPrompt ?? "").trim() || undefined,
      });
    },
    [boardId, itemId, runMutation, startJob],
  );

  const fillFromLibrary = useCallback(
    (modelId: number) => {
      if (itemId < 0) return;
      fillMutation.mutate({ boardId, itemId, modelId });
    },
    [boardId, itemId, fillMutation],
  );

  return {
    run,
    retry,
    fillFromLibrary,
    fillPending: fillMutation.isPending,
    runCost,
    generating,
    job,
  };
}

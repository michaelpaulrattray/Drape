/**
 * useCastActions — the boardOps mutation surface for one cast node, shared by
 * the node controller (retry) and the CastPickerModal (fill). Lives outside
 * the node component so the picker survives the optimistic temp→real id
 * remount. No legacy casting store imports (D-24). New-cast generation goes
 * through the takeover environment (D-35), not through here.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useGenerationJobs } from "../stores/useGenerationJobs";

export function useCastActions(options: { boardId: number; itemId: number }) {
  const { boardId, itemId } = options;
  const utils = trpc.useUtils();
  const { startJob, completeJob, failJob } = useGenerationJobs();
  const job = useGenerationJobs((s) => s.jobs[itemId]);
  const generating = job?.status === "running";

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
    // Reconcile in both directions (D-38): success confirms the optimistic
    // fill; an error refetches back to server truth. No success toast — the
    // node filling IS the feedback (feedback renders where the action
    // happened, D-40).
    onSuccess: () => {
      utils.boards.getItems.invalidate({ boardId });
    },
    onError: (err) => {
      utils.boards.getItems.invalidate({ boardId });
      toast.error(err.message);
    },
  });

  /** Rerun after a failed generation, with the prompt stamped on the node. */
  const retry = useCallback(
    (userPrompt?: string) => {
      if (generating || itemId < 0) return;
      startJob({ itemId, operation: "runGeneration", estimatedDurationMs: 20_000 });
      runMutation.mutate({
        boardId,
        itemId,
        userPrompt: (userPrompt ?? "").trim() || undefined,
      });
    },
    [generating, boardId, itemId, runMutation, startJob],
  );

  const fillFromLibrary = useCallback(
    (modelId: number, preview?: { headshotUrl?: string | null; name?: string | null; draft?: boolean }) => {
      if (itemId < 0) return;
      // Optimistic fill (D-38): the picker already holds the model's
      // canonical headshot — the node fills the instant it's picked (drafts
      // wear their badge immediately, D-42)
      if (preview?.headshotUrl) {
        utils.boards.getItems.setData({ boardId }, (old) =>
          old?.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  imageUrl: preview.headshotUrl ?? i.imageUrl,
                  label: preview.name ?? i.label,
                  metadata: {
                    ...((i.metadata as Record<string, unknown> | null) ?? {}),
                    provenance: {
                      type: "library_cast",
                      modelId,
                      viewAngle: "frontClose",
                      ...(preview.draft ? { draft: true } : {}),
                    },
                    status: null,
                    isGenerating: false,
                  },
                }
              : i,
          ),
        );
      }
      fillMutation.mutate({ boardId, itemId, modelId });
    },
    [boardId, itemId, fillMutation, utils],
  );

  return {
    retry,
    fillFromLibrary,
    fillPending: fillMutation.isPending,
  };
}

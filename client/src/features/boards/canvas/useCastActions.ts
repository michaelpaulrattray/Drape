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
import { useOptimisticFills } from "../stores/useOptimisticFills";
import { createClientRequestId } from "@shared/clientRequestId";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { placementAnnouncement, PLACEMENT_ANNOUNCEMENT_MS } from "./placementAnnouncement";

export function useCastActions(options: { boardId: number; itemId: number }) {
  const { boardId, itemId } = options;
  const utils = trpc.useUtils();
  const { startJob, completeJob, failJob } = useGenerationJobs();
  const job = useGenerationJobs((s) => s.jobs[itemId]);
  const generating = job?.status === "running";

  const runMutation = trpc.boardOps.runGeneration.execute.useMutation({
    onSuccess: (result) => {
      completeJob(itemId);
      /*
        ⚠ **THE CAST WAS PAID FOR AND NEVER PLACED — SAY SO (#1571).**

        Past the durable boundary the server keeps the cast and never refunds:
        the picture exists, it is in the Library, and the money is right. What
        can still fail is stamping it onto the board — and until now that was
        told to nobody. The server writes the sentence (`boardOps.ts`), puts it
        on the response, and **no component, hook or toast in the client read
        it**; the only reader anywhere was a server test, which kept a dead
        field looking alive.

        So the customer saw a cast they were charged for simply not appear, with
        the screen saying nothing at all.

        ⚠ **A TOAST IS RIGHT HERE AND IT IS NOT A RELAXATION OF D-40.** That
        rule — feedback renders where the action happened — is why the fill
        mutation below has no success toast: the node filling IS the feedback.
        **This is the branch where the node does NOT fill.** There is no longer
        anywhere for feedback to render, which is exactly the case a toast
        exists for.

        `warning`, never `error`: the cast succeeded and was charged correctly,
        and calling it an error would tell someone their money went wrong when
        the sentence's whole job is to say it did not. 9 s matches the duration
        this app already gives a money-adjacent sentence — a two-clause line
        about where a paid-for cast went is not a 4-second read.
      */
      const announcement = placementAnnouncement(result);
      if (announcement) toast.warning(announcement, { duration: PLACEMENT_ANNOUNCEMENT_MS });
      utils.boards.getItems.invalidate({ boardId });
      utils.credits.getBalance.invalidate();
    },
    onError: (err) => {
      failJob(itemId, err.message);
      // Server stamped the error status + refunded — refetch shows the error card
      utils.boards.getItems.invalidate({ boardId });
      logRawFailure("boards.castNode", err);
      toast.error(readableFailure(err, "That cast could not be started."));
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
      useOptimisticFills.getState().clearFill(itemId);
      utils.boards.getItems.invalidate({ boardId });
      logRawFailure('boards.fillNode', err);
      toast.error(readableFailure(err, 'That fill could not be applied.'));
    },
  });

  /** Rerun after a failed generation, with the prompt stamped on the node. */
  const retry = useCallback(
    (userPrompt?: string) => {
      if (generating || itemId < 0) return;
      startJob({ itemId, operation: "runGeneration", estimatedDurationMs: 20_000 });
      runMutation.mutate({
        clientRequestId: createClientRequestId(),
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
      // Optimistic fill via the LEDGER, never the query cache (D-38): a
      // cache write loses to any in-flight refetch resolving late with
      // pre-fill data. The ledger overlays canvasItems and self-prunes when
      // the server row carries the image. Drafts wear their badge
      // immediately (D-42).
      if (preview?.headshotUrl) {
        useOptimisticFills.getState().setFill(itemId, {
          imageUrl: preview.headshotUrl,
          label: preview.name ?? null,
          modelId,
          draft: preview.draft,
        });
      }
      fillMutation.mutate({ boardId, itemId, modelId });
    },
    [boardId, itemId, fillMutation],
  );

  return {
    retry,
    fillFromLibrary,
    fillPending: fillMutation.isPending,
  };
}

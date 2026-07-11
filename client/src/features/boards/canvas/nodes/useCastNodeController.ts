/**
 * useCastNodeController — binds a cast node to boardOps + useGenerationJobs
 * (DESIGN_SYSTEM.md §5.11). CastNode stays thin; the mutation surface lives
 * in useCastActions (shared with CastPickerModal, which is hosted by
 * BoardPage — D-33). No legacy casting store may be imported here (D-24).
 */
import { useCallback, useEffect, useState } from "react";
import {
  useGenerationJobs,
  jobProgressFraction,
  jobElapsedSeconds,
} from "../../stores/useGenerationJobs";
import { useCastActions } from "../useCastActions";
import type { NodePromptState } from "../CastImageArea";
import type { CastNodeData } from "./CastNode";

export function useCastNodeController(data: CastNodeData) {
  const job = useGenerationJobs((s) => s.jobs[data.itemId]);

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

  const actions = useCastActions({ boardId: data.boardId, itemId: data.itemId });

  const retry = useCallback(() => {
    // Clear the error status, then rerun with the same prompt
    actions.retry(data.userPrompt);
  }, [actions, data.userPrompt]);

  const promptState: NodePromptState = generating
    ? "generating"
    : data.imageUrl
      ? "complete"
      : "ready";

  return {
    promptState,
    isEmpty,
    retry,
    progressFraction: jobProgressFraction(job),
    progressSeconds: jobElapsedSeconds(job),
  };
}

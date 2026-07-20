import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  getActiveCastingOperations,
  subscribeCastingOperations,
} from "@/features/casting/pendingCastRegistry";
import { useGenerationJobs } from "@/features/boards/stores/useGenerationJobs";
import {
  isOperationActive,
  operationDedupeKey,
  type GenerationOperationDto,
} from "./generationOperationProjection";

const VISIBLE_POLL_MS = 2_500;

/** The single client owner of durable generation receipts. Zustand remains a
 * render cache; server rows decide progress, settlement and landing. */
export function GenerationOperationBridge() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" || document.visibilityState === "visible"
  );
  const [localActiveCount, setLocalActiveCount] = useState(() => getActiveCastingOperations().length);
  const previousRef = useRef(new Map<string, GenerationOperationDto>());
  const processingRef = useRef(new Set<string>());
  const handledRef = useRef(new Set<string>());
  const retryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const operationsQuery = trpc.generation.activeOperations.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 1,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => {
      if (!visible) return false;
      const operations = query.state.data as GenerationOperationDto[] | undefined;
      return localActiveCount > 0 || (operations?.length ?? 0) > 0
        ? VISIBLE_POLL_MS
        : false;
    },
  });
  const acknowledge = trpc.generation.acknowledgeOperation.useMutation();
  const land = trpc.generation.landOperationResult.useMutation();
  const refetchRef = useRef(operationsQuery.refetch);
  refetchRef.current = operationsQuery.refetch;
  const acknowledgeRef = useRef(acknowledge.mutateAsync);
  acknowledgeRef.current = acknowledge.mutateAsync;
  const landRef = useRef(land.mutateAsync);
  landRef.current = land.mutateAsync;

  const invalidateResult = async (operation: GenerationOperationDto) => {
    const work: Promise<unknown>[] = [
      utils.credits.getBalance.invalidate(),
      utils.boardOps.listCastableModels.invalidate(),
      utils.models.list.invalidate(),
    ];
    if (operation.originBoardId) {
      work.push(utils.boards.getItems.invalidate({ boardId: operation.originBoardId }));
      work.push(utils.boardOps.listEdges.invalidate({ boardId: operation.originBoardId }));
    }
    if (operation.modelId) {
      work.push(utils.models.get.invalidate({ modelId: operation.modelId }));
      work.push(utils.generation.packageState.invalidate({ modelId: operation.modelId }));
    }
    await Promise.allSettled(work);
  };
  const invalidateResultRef = useRef(invalidateResult);
  invalidateResultRef.current = invalidateResult;
  const invalidateOperationsRef = useRef(utils.generation.activeOperations.invalidate);
  invalidateOperationsRef.current = utils.generation.activeOperations.invalidate;

  useEffect(() => {
    const onVisibility = () => {
      const nextVisible = document.visibilityState === "visible";
      setVisible(nextVisible);
      if (nextVisible && isAuthenticated) void refetchRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isAuthenticated]);

  useEffect(() => subscribeCastingOperations((event) => {
    setLocalActiveCount(getActiveCastingOperations().length);
    if (event.phase === "settle" && event.operation.origin) {
      const jobs = useGenerationJobs.getState();
      const job = jobs.jobs[event.operation.origin.itemId];
      if (job?.source !== "server") jobs.clearJob(event.operation.origin.itemId);
    }
    void invalidateOperationsRef.current();
  }), []);

  useEffect(() => () => {
    for (const timer of Array.from(retryTimersRef.current.values())) clearTimeout(timer);
    retryTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      previousRef.current.clear();
      handledRef.current.clear();
      useGenerationJobs.getState().syncServerOperations([]);
      return;
    }
    const operations = operationsQuery.data ?? [];
    useGenerationJobs.getState().syncServerOperations(operations);

    const currentIds = new Set(operations.map((operation) => operation.operationId));
    for (const previous of Array.from(previousRef.current.values())) {
      if (isOperationActive(previous) && !currentIds.has(previous.operationId)) {
        void invalidateResultRef.current(previous);
      }
    }
    previousRef.current = new Map(operations.map((operation) => [operation.operationId, operation]));
  }, [isAuthenticated, operationsQuery.data]);

  useEffect(() => {
    if (!isAuthenticated) return;
    for (const operation of operationsQuery.data ?? []) {
      if (isOperationActive(operation) || operation.status === "recovery_required") continue;
      if (operation.landingStatus === "relink_required") continue;
      const dedupeKey = operationDedupeKey(operation);
      if (handledRef.current.has(dedupeKey) || processingRef.current.has(dedupeKey)) continue;
      processingRef.current.add(dedupeKey);

      void (async () => {
        try {
          if (
            operation.landingStatus === "pending" &&
            operation.originBoardId &&
            operation.originItemId
          ) {
            const settled = await landRef.current({
              operationId: operation.operationId,
              boardId: operation.originBoardId,
              itemId: operation.originItemId,
            });
            if (settled.landedNow) {
              await invalidateResultRef.current(settled.operation);
              toast.success("Draft generated and placed on your canvas");
            }
          } else if (operation.landingStatus !== "pending" && !operation.landingAcknowledgedAt) {
            const settled = await acknowledgeRef.current({ operationId: operation.operationId });
            if (settled.acknowledgedNow) {
              await invalidateResultRef.current(settled.operation);
              if (settled.operation.status === "failed" && settled.operation.publicMessage) {
                toast.error(settled.operation.publicMessage);
              }
            }
          }
          handledRef.current.add(dedupeKey);
        } catch {
          // Server truth remains visible. Retry after a bounded delay rather
          // than dropping the durable result or spinning an invalidation loop.
          if (!retryTimersRef.current.has(dedupeKey)) {
            const timer = setTimeout(() => {
              retryTimersRef.current.delete(dedupeKey);
              processingRef.current.delete(dedupeKey);
              void invalidateOperationsRef.current();
            }, 5_000);
            retryTimersRef.current.set(dedupeKey, timer);
          }
          return;
        } finally {
          if (!retryTimersRef.current.has(dedupeKey)) {
            processingRef.current.delete(dedupeKey);
            void invalidateOperationsRef.current();
          }
        }
      })();
    }
  }, [isAuthenticated, operationsQuery.data]);

  return null;
}

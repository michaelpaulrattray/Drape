import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingRefreshStore } from '@/features/casting/stores/useCastingRefreshStore';
import { beginCastingOperation } from '@/features/casting/pendingCastRegistry';
import { createClientRequestId } from '@shared/clientRequestId';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import { slotFailureMessage } from '@shared/refundCopy';

const EMPTY_REFRESHING_ANGLES: CanonicalViewAngle[] = [];

export function shouldClearIdentityWarning(
  slots: Array<{ stale: boolean; failed: unknown }>,
  refreshingAngles: readonly CanonicalViewAngle[],
): boolean {
  return refreshingAngles.length === 0
    && slots.every((slot) => !slot.stale && !slot.failed);
}

/** One Studio refresh door shared by the strip and the temporary details
 * surface. The route always re-plans under the model lock before spending;
 * client plan rows are display truth only. */
export function useCastingPackageRefresh(modelId: number | null) {
  const setCurrentAssets = useCastingGenerationStore((state) => state.setCurrentAssets);
  const utils = trpc.useUtils();
  const serverRefreshing = useCastingRefreshStore((state) =>
    modelId ? state.refreshingByModel[modelId] : undefined,
  ) ?? EMPTY_REFRESHING_ANGLES;
  const localRefreshing = useCastingRefreshStore((state) =>
    modelId ? state.localRefreshingByModel[modelId] : undefined,
  ) ?? EMPTY_REFRESHING_ANGLES;

  const invalidate = useCallback(async (targetModelId: number) => {
    await Promise.all([
      utils.generation.packageState.invalidate({ modelId: targetModelId }),
      utils.generation.refreshSlotsPlan.invalidate({ modelId: targetModelId }),
      utils.generation.mintPackagePlan.invalidate({ modelId: targetModelId }),
      utils.credits.getBalance.invalidate(),
    ]);
  }, [utils]);

  const refreshMutation = trpc.generation.refreshSlots.useMutation({
    onMutate: ({ clientRequestId, modelId: targetModelId, angles }) => {
      const operation = beginCastingOperation({
        kind: 'refresh',
        modelId: targetModelId,
        angles,
        clientRequestIds: [clientRequestId],
      });
      useCastingRefreshStore.getState().beginLocalRefresh(targetModelId, angles);
      void utils.generation.activeOperations.invalidate();
      return { operation };
    },
    onSuccess: (result, variables, context) => {
      context?.operation.succeed({ modelId: variables.modelId, background: false });
      const castingState = useCastingGenerationStore.getState();
      const refreshedByAngle = new Map(result.refreshed.map((row) => [row.angle, row]));
      if (castingState.currentModelId === variables.modelId && refreshedByAngle.size > 0) {
        setCurrentAssets([
          ...castingState.currentAssets.filter((asset) => !refreshedByAngle.has(asset.viewType as CanonicalViewAngle)),
          ...result.refreshed.map((row) => ({
            id: row.assetId,
            viewType: row.angle,
            storageUrl: row.imageUrl,
          })),
        ]);
      }
      for (const failure of result.failed) {
        toast.error(slotFailureMessage(failure), { duration: 9000 });
      }
    },
    onError: (error, _variables, context) => {
      context?.operation.fail({ message: error.message, background: false });
      toast.error(error.message);
    },
    onSettled: async (_data, _error, variables) => {
      let localCleared = false;
      try {
        await Promise.all([
          invalidate(variables.modelId),
          utils.generation.activeOperations.invalidate(),
        ]);
        const freshPackage = await utils.generation.packageState.fetch({ modelId: variables.modelId });
        useCastingRefreshStore.getState().endLocalRefresh(variables.modelId, variables.angles);
        localCleared = true;
        const refreshState = useCastingRefreshStore.getState();
        const settledAngles = new Set(variables.angles);
        const remaining = Array.from(new Set([
          ...(refreshState.refreshingByModel[variables.modelId] ?? []).filter((angle) => !settledAngles.has(angle)),
          ...(refreshState.localRefreshingByModel[variables.modelId] ?? []),
        ]));
        const castingState = useCastingGenerationStore.getState();
        if (
          castingState.currentModelId === variables.modelId
          && shouldClearIdentityWarning(freshPackage.slots, remaining)
        ) {
          castingState.setIdentityWarning(null);
        }
      } catch {
        // The warning remains until fresh server truth proves every view is
        // healthy. Optimistic clearing would let the strip and banner diverge.
      } finally {
        if (!localCleared) {
          useCastingRefreshStore.getState().endLocalRefresh(variables.modelId, variables.angles);
        }
      }
    },
  });

  const refreshing = useMemo(
    () => Array.from(new Set([...serverRefreshing, ...localRefreshing])),
    [localRefreshing, serverRefreshing],
  );
  const refreshingSet = useMemo(() => new Set(refreshing), [refreshing]);

  const refreshAngles = useCallback((angles: CanonicalViewAngle[]) => {
    if (!modelId || angles.length === 0 || refreshMutation.isPending) return;
    refreshMutation.mutate({
      clientRequestId: createClientRequestId(),
      modelId,
      angles,
    });
  }, [modelId, refreshMutation]);

  return {
    invalidate,
    isPending: refreshMutation.isPending,
    refreshing,
    refreshingSet,
    refreshAngles,
  };
}

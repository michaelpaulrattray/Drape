import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import { createClientRequestId } from '@shared/clientRequestId';

interface SlotVersionHistoryProps {
  modelId: number;
  angle: CanonicalViewAngle;
  onUsed?: () => void;
  className?: string;
}

export type SlotVersionAvailability = 'current' | 'compatible' | 'earlier_identity';

export function slotVersionAvailability(version: {
  isHead: boolean;
  revisionCompatible: boolean;
}): SlotVersionAvailability {
  if (version.isHead) return 'current';
  return version.revisionCompatible ? 'compatible' : 'earlier_identity';
}

/** One version-selection interaction for Cast views in Studio and Canvas.
 * "Use" is copy-forward reuse inside the current identity, never rollback. */
export function SlotVersionHistory({ modelId, angle, onUsed, className }: SlotVersionHistoryProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const versionsQuery = trpc.generation.slotVersions.useQuery(
    { modelId, angle },
    { staleTime: 0 },
  );

  useEffect(() => setSelectedAssetId(null), [angle, modelId]);

  const restoreMutation = trpc.generation.restoreSlotVersion.useMutation({
    onSuccess: (result) => {
      const castingState = useCastingGenerationStore.getState();
      if (castingState.currentModelId === result.modelId) {
        castingState.setCurrentAssets([
          ...castingState.currentAssets.filter((asset) => asset.viewType !== result.angle),
          { id: result.assetId, viewType: result.angle, storageUrl: result.url },
        ]);
      }
      utils.generation.packageState.setData({ modelId: result.modelId }, (current) =>
        current
          ? {
              ...current,
              slots: current.slots.map((slot) =>
                slot.angle === result.angle
                  ? { ...slot, url: result.url, version: result.version, stale: false, pinned: false }
                  : slot,
              ),
            }
          : current,
      );
      setSelectedAssetId(null);
      onUsed?.();
    },
    onError: (error) => toast.error(error.message),
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        utils.generation.slotVersions.invalidate({ modelId: variables.modelId, angle: variables.angle }),
        utils.generation.packageState.invalidate({ modelId: variables.modelId }),
        utils.generation.refreshSlotsPlan.invalidate({ modelId: variables.modelId }),
        utils.generation.mintPackagePlan.invalidate({ modelId: variables.modelId }),
      ]);
    },
  });

  const versions = versionsQuery.data?.versions ?? [];
  const selected = versions.find((version) => version.assetId === selectedAssetId);
  const hasEarlierIdentity = versions.some((version) => !version.isHead && !version.revisionCompatible);

  if (versionsQuery.isLoading) {
    return (
      <div className={cn('flex items-center gap-2 py-3 text-canvas-sm text-canvas-ink-faint', className)} role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading versions…
      </div>
    );
  }

  if (versionsQuery.error) {
    return (
      <div className={cn('py-2 text-canvas-sm text-canvas-ink-soft', className)}>
        Couldn&apos;t load versions — {versionsQuery.error.message}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="View versions">
        {versions.map((version) => {
          const availability = slotVersionAvailability(version);
          const unavailable = availability === 'earlier_identity';
          const selectedEarlier = selectedAssetId === version.assetId;
          const label = availability === 'current'
            ? 'Current version — in use'
            : availability === 'earlier_identity'
              ? 'Earlier identity — unavailable for this cast'
              : 'Earlier compatible version';
          return (
            <button
              key={version.assetId}
              type="button"
              disabled={restoreMutation.isPending || unavailable}
              aria-label={label}
              aria-pressed={version.isHead || selectedEarlier}
              title={label}
              onClick={() => setSelectedAssetId(version.isHead ? null : version.assetId)}
              className={cn(
                'relative h-[72px] w-[54px] flex-shrink-0 overflow-hidden rounded-canvas-sm bg-canvas-surface transition-opacity',
                version.isHead || selectedEarlier
                  ? 'border border-canvas-ink'
                  : 'border-hairline border-canvas-border hover:border-canvas-border-strong',
                unavailable && 'cursor-not-allowed opacity-45',
              )}
            >
              <img src={version.url} alt="" className="h-full w-full object-cover" draggable={false} />
              <span
                className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[8px] font-medium"
                style={{ background: 'rgba(10,10,10,0.62)', color: 'var(--color-canvas-surface)' }}
              >
                {availability === 'current' ? 'In use' : unavailable ? 'Earlier identity' : 'Earlier'}
              </span>
            </button>
          );
        })}
      </div>

      {restoreMutation.isPending ? (
        <div className="flex items-center gap-1.5 text-canvas-xs text-canvas-ink-faint" role="status">
          <Loader2 className="h-3 w-3 animate-spin" /> Using version…
        </div>
      ) : selected?.revisionCompatible && !selected.isHead ? (
        <div className="rounded-canvas-sm bg-canvas-surface-inset px-2.5 py-2">
          <button
            type="button"
            className="text-canvas-sm font-medium text-canvas-ink hover:text-canvas-ink-soft"
            onClick={() => restoreMutation.mutate({
              clientRequestId: createClientRequestId(),
              modelId,
              angle,
              assetId: selected.assetId,
            })}
          >
            Use this version
          </button>
          <div className="mt-0.5 text-canvas-xs text-canvas-ink-faint">
            Free · saves a new current copy and keeps the history.
          </div>
        </div>
      ) : (
        <div className="text-canvas-xs text-canvas-ink-faint">
          {versions.length > 1 ? 'Select an earlier version to compare it.' : 'No earlier versions yet.'}
        </div>
      )}

      {hasEarlierIdentity && (
        <div className="text-canvas-xs leading-normal text-canvas-ink-soft">
          Earlier-identity images stay visible for reference, but cannot replace this cast.
        </div>
      )}
    </div>
  );
}

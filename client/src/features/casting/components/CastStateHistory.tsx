import { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { createClientRequestId } from '@shared/clientRequestId';
import { publishCastProjectionChanged } from '@/features/operations/castProjectionSync';

interface CastStateHistoryProps {
  modelId: number;
  className?: string;
}

const UNAVAILABLE_COPY = {
  current: 'Current',
  pair_unavailable: 'Incomplete history',
  anchor_unavailable: 'Headshot unavailable',
  feature_unavailable: 'Evidence unavailable',
} as const;

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function CastStateHistory({ modelId, className }: CastStateHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const historyQuery = trpc.generation.castStateHistory.useQuery(
    { modelId },
    { staleTime: 0 },
  );
  const restoreMutation = trpc.generation.restoreCastState.useMutation({
    onSuccess: async (result) => {
      setSelectedId(null);
      publishCastProjectionChanged(result.modelId);
      toast.success('Cast state restored');
      await Promise.all([
        utils.models.get.invalidate({ modelId: result.modelId }),
        utils.generation.castStateHistory.invalidate({ modelId: result.modelId }),
        utils.generation.packageState.invalidate({ modelId: result.modelId }),
        utils.generation.refreshSlotsPlan.invalidate({ modelId: result.modelId }),
        utils.generation.mintPackagePlan.invalidate({ modelId: result.modelId }),
        utils.generation.slotVersions.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => setSelectedId(null), [modelId]);

  if (historyQuery.isLoading) return null;
  if (historyQuery.error) {
    return (
      <div className={cn('rounded-canvas-md bg-canvas-surface-inset px-3 py-2.5 text-canvas-sm text-canvas-ink-soft', className)}>
        Couldn&apos;t load Cast history — {historyQuery.error.message}
      </div>
    );
  }
  const history = historyQuery.data;
  if (!history?.enabled) return null;
  const selected = history.restorePoints.find(
    (point) => point.restorePointId === selectedId,
  );

  const openFork = () => {
    window.dispatchEvent(new CustomEvent('casting-fork-from-refusal', {
      detail: { editText: '' },
    }));
  };

  return (
    <section className={cn('rounded-canvas-md border-hairline border-canvas-border bg-canvas-surface px-3 py-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-canvas-md font-medium text-canvas-ink">Cast history</div>
          <div className="mt-0.5 text-canvas-xs leading-normal text-canvas-ink-soft">
            Restore a complete earlier identity state. Every version stays in history.
          </div>
        </div>
        {history.forkRequired ? (
          <button
            type="button"
            onClick={openFork}
            className="flex-shrink-0 text-canvas-sm font-medium text-canvas-ink hover:text-canvas-ink-soft"
          >
            Fork to edit
          </button>
        ) : null}
      </div>

      {history.blockedByPendingEvidence ? (
        <div className="mt-2 rounded-canvas-sm bg-canvas-surface-inset px-2.5 py-2 text-canvas-xs leading-normal text-canvas-ink-soft">
          Finish or discard the current evidence edit before restoring this Cast.
        </div>
      ) : null}

      <div className="mt-2 space-y-1">
        {history.restorePoints.map((point) => {
          const chosen = point.restorePointId === selectedId;
          const disabled =
            !point.available
            || history.lifecycle !== 'draft'
            || restoreMutation.isPending;
          return (
            <button
              key={point.restorePointId}
              type="button"
              disabled={disabled}
              aria-pressed={chosen}
              onClick={() => setSelectedId(chosen ? null : point.restorePointId)}
              className={cn(
                'w-full rounded-canvas-sm px-2 py-2 text-left flex items-center gap-2.5 transition-colors',
                chosen ? 'bg-canvas-border' : 'bg-canvas-surface-inset',
                !disabled && 'hover:bg-canvas-border',
                disabled && !point.current && 'opacity-55 cursor-not-allowed',
              )}
            >
              <span className="h-10 w-8 flex-shrink-0 overflow-hidden rounded-canvas-sm bg-canvas-border">
                {point.previewUrl ? (
                  <img src={point.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-canvas-sm font-medium text-canvas-ink">
                    {point.label}
                  </span>
                  <span className="text-canvas-xs text-canvas-ink-faint">
                    {shortDate(point.createdAt)}
                  </span>
                </span>
                <span className="block text-canvas-xs text-canvas-ink-soft">
                  {point.selectedViewCount} view{point.selectedViewCount === 1 ? '' : 's'}
                  {point.featureCount > 0
                    ? ` · ${point.featureCount} feature${point.featureCount === 1 ? '' : 's'}`
                    : ''}
                </span>
              </span>
              <span className="flex-shrink-0 text-canvas-xs font-medium text-canvas-ink-faint">
                {point.current
                  ? 'Current'
                  : point.unavailableReason
                    ? UNAVAILABLE_COPY[point.unavailableReason]
                    : 'Restore'}
              </span>
            </button>
          );
        })}
      </div>

      {selected?.available ? (
        <div className="mt-2 rounded-canvas-sm bg-canvas-surface-inset px-2.5 py-2.5 flex items-center justify-between gap-3">
          <div className="text-canvas-xs leading-normal text-canvas-ink-soft">
            Free · creates a new current state and keeps this history.
          </div>
          <button
            type="button"
            disabled={restoreMutation.isPending}
            onClick={() => restoreMutation.mutate({
              clientRequestId: createClientRequestId(),
              modelId,
              restorePointId: selected.restorePointId,
            })}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-canvas-md bg-canvas-ink px-3 py-1.5 text-canvas-sm font-medium disabled:opacity-40"
            style={{ color: 'var(--color-canvas-surface)' }}
          >
            {restoreMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            {restoreMutation.isPending ? 'Restoring…' : 'Restore this Cast state'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

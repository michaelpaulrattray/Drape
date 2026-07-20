import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingRefreshStore } from '@/features/casting/stores/useCastingRefreshStore';
import { slotFailureMessage } from '@shared/refundCopy';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import { createClientRequestId } from '@shared/clientRequestId';
import { beginCastingOperation } from '@/features/casting/pendingCastRegistry';

const OPEN_PACKAGE_HEALTH = 'casting-open-package-health';
const EMPTY_REFRESHING_ANGLES: CanonicalViewAngle[] = [];

export function openPackageHealth(angle?: CanonicalViewAngle) {
  window.dispatchEvent(new CustomEvent(OPEN_PACKAGE_HEALTH, { detail: { angle } }));
}

export function shouldClearIdentityWarning(
  slots: Array<{ stale: boolean; failed: unknown }>,
  refreshingAngles: readonly CanonicalViewAngle[],
): boolean {
  return refreshingAngles.length === 0
    && slots.every((slot) => !slot.stale && !slot.failed);
}

export function PackageHealthDialog() {
  const modelId = useCastingGenerationStore((s) => s.currentModelId);
  const setCurrentAssets = useCastingGenerationStore((s) => s.setCurrentAssets);
  const [versionAngle, setVersionAngle] = useState<CanonicalViewAngle | null>(null);
  const open = useCastingRefreshStore((s) => s.packageHealthOpen);
  const setOpen = useCastingRefreshStore((s) => s.setPackageHealthOpen);
  const utils = trpc.useUtils();

  useEffect(() => {
    const onOpen = (event: Event) => {
      const angle = (event as CustomEvent<{ angle?: CanonicalViewAngle }>).detail?.angle;
      setVersionAngle(angle ?? null);
      setOpen(true);
    };
    window.addEventListener(OPEN_PACKAGE_HEALTH, onOpen);
    return () => window.removeEventListener(OPEN_PACKAGE_HEALTH, onOpen);
  }, []);

  useEffect(() => {
    if (!modelId) setOpen(false);
  }, [modelId, setOpen]);

  useEffect(() => () => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: open && !!modelId, staleTime: 0 },
  );
  const planQuery = trpc.generation.refreshSlotsPlan.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: open && !!modelId, staleTime: 0 },
  );
  const mintPlanQuery = trpc.generation.mintPackagePlan.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: open && !!modelId, staleTime: 0 },
  );
  const versionsQuery = trpc.generation.slotVersions.useQuery(
    { modelId: modelId ?? 0, angle: versionAngle ?? 'frontClose' },
    { enabled: open && !!modelId && versionAngle !== null, staleTime: 0 },
  );

  const serverRefreshing = useCastingRefreshStore((s) =>
    modelId ? s.refreshingByModel[modelId] : undefined,
  ) ?? EMPTY_REFRESHING_ANGLES;

  const invalidate = async (targetModelId: number) => {
    await Promise.all([
      utils.generation.packageState.invalidate({ modelId: targetModelId }),
      utils.generation.refreshSlotsPlan.invalidate({ modelId: targetModelId }),
      utils.generation.mintPackagePlan.invalidate({ modelId: targetModelId }),
      utils.credits.getBalance.invalidate(),
    ]);
  };

  const refreshMutation = trpc.generation.refreshSlots.useMutation({
    onMutate: ({ clientRequestId, modelId: targetModelId, angles }) => {
      const operation = beginCastingOperation({
        kind: 'refresh',
        modelId: targetModelId,
        angles,
        clientRequestIds: [clientRequestId],
      });
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
      await invalidate(variables.modelId);
      await utils.generation.activeOperations.invalidate();
      try {
        const freshPackage = await utils.generation.packageState.fetch({ modelId: variables.modelId });
        const remaining = useCastingRefreshStore.getState().refreshingByModel[variables.modelId] ?? [];
        const castingState = useCastingGenerationStore.getState();
        if (
          castingState.currentModelId === variables.modelId
          && shouldClearIdentityWarning(freshPackage.slots, remaining)
        ) {
          castingState.setIdentityWarning(null);
        }
      } catch {
        // Server truth could not be confirmed. Leave the warning standing;
        // clearing optimistically would make the strip and banner disagree.
      }
    },
  });

  const localRefreshing = refreshMutation.isPending
    && refreshMutation.variables?.modelId === modelId
    ? refreshMutation.variables.angles
    : EMPTY_REFRESHING_ANGLES;
  const refreshing = useMemo(
    () => Array.from(new Set([...serverRefreshing, ...localRefreshing])),
    [localRefreshing, serverRefreshing],
  );
  const refreshingSet = useMemo(() => new Set(refreshing), [refreshing]);

  const pinMutation = trpc.generation.setSlotPinned.useMutation({
    onSuccess: (_result, variables) => { void invalidate(variables.modelId); },
    onError: (error) => toast.error(error.message),
  });

  const restoreMutation = trpc.generation.restoreSlotVersion.useMutation({
    onSuccess: (result) => {
      const castingState = useCastingGenerationStore.getState();
      if (castingState.currentModelId === result.modelId) {
        setCurrentAssets([
          ...castingState.currentAssets.filter((asset) => asset.viewType !== result.angle),
          { id: result.assetId, viewType: result.angle, storageUrl: result.url },
        ]);
      }
      setVersionAngle(null);
      void invalidate(result.modelId);
      void utils.generation.slotVersions.invalidate({ modelId: result.modelId, angle: result.angle });
    },
    onError: (error) => toast.error(error.message),
  });

  if (!open) return null;

  const slots = packageQuery.data?.slots ?? [];
  const planRows = new Map((planQuery.data?.slots ?? []).map((row) => [row.angle, row]));
  const integrity = mintPlanQuery.data?.integrity.production;
  const blockers = new Map(
    (integrity?.tierViews ?? []).filter((view) => !view.ok).map((view) => [view.angle, view]),
  );
  const headshotIssue = integrity && (!integrity.anchor.ok || !integrity.displayHeadshot.ok)
    ? integrity.anchor.message ?? integrity.displayHeadshot.message ?? 'The headshot needs attention before minting.'
    : null;
  const actionable = slots.filter((slot) => {
    const plan = planRows.get(slot.angle);
    return !!plan && plan.refusal === null && !refreshingSet.has(slot.angle)
      && (slot.stale || !!slot.failed || blockers.has(slot.angle));
  });
  const issueAngles = new Set(
    slots.filter((slot) => slot.stale || !!slot.failed || blockers.has(slot.angle)).map((slot) => slot.angle),
  );
  if (headshotIssue) issueAngles.add('frontClose');
  const issueCount = issueAngles.size;
  const actionableCost = actionable.reduce((total, slot) => total + (planRows.get(slot.angle)?.cost ?? 0), 0);
  const loadError = packageQuery.error ?? planQuery.error ?? mintPlanQuery.error;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[520px] max-h-[82vh] overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong flex flex-col">
        <div className="px-5 py-4 border-b-hairline border-canvas-border flex items-start justify-between gap-4">
          <div>
            <div className="text-canvas-lg font-medium text-canvas-ink">Package health</div>
            <div className="text-canvas-md text-canvas-ink-soft mt-0.5">
              Refresh only what is out of sync, or reuse a compatible earlier version.
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-1 text-canvas-ink-faint hover:text-canvas-ink" aria-label="Close package health">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 space-y-1.5">
          {packageQuery.isLoading || planQuery.isLoading || mintPlanQuery.isLoading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-canvas-md text-canvas-ink-soft">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking the package…
            </div>
          ) : loadError ? (
            <div className="py-8 text-center">
              <div className="text-canvas-md text-canvas-ink-soft">Couldn't load package health — {loadError.message}</div>
              <button
                type="button"
                onClick={() => {
                  void packageQuery.refetch();
                  void planQuery.refetch();
                  void mintPlanQuery.refetch();
                }}
                className="mt-3 text-canvas-md font-medium text-canvas-ink hover:text-canvas-ink-soft"
              >
                Try again
              </button>
            </div>
          ) : slots.map((slot) => {
            const plan = planRows.get(slot.angle);
            const blocker = blockers.get(slot.angle);
            const headshotBlock = slot.angle === 'frontClose' ? headshotIssue : null;
            const busy = refreshingSet.has(slot.angle);
            const needsAction = slot.stale || !!slot.failed || !!blocker || !!headshotBlock;
            const canRefresh = needsAction && plan?.refusal === null;
            const canOpenVersions = slot.version > 1;
            const versionsOpen = versionAngle === slot.angle;
            return (
              <div key={slot.angle} className="rounded-canvas-md bg-canvas-surface-inset overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-9 h-11 rounded-canvas-sm overflow-hidden bg-canvas-border flex-shrink-0">
                    {slot.url && <img src={slot.url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-canvas-md font-medium text-canvas-ink">{slot.label}</span>
                      {slot.version > 0 && <span className="text-canvas-xs text-canvas-ink-faint">v{slot.version}</span>}
                    </div>
                    <div className="text-canvas-sm text-canvas-ink-soft leading-normal">
                      {busy
                        ? 'Refreshing against the current identity…'
                        : headshotBlock
                          ? `${headshotBlock} Use a compatible version below, or continue editing the headshot.`
                          : blocker?.message
                          ? blocker.message
                          : slot.failed
                          ? `Retry needed — ${slot.failed.reason}`
                          : slot.stale && slot.pinned
                            ? 'Pinned and out of sync — unpin first'
                            : slot.stale
                              ? 'Out of sync with the current identity'
                              : slot.filled
                                ? 'Current identity version'
                                : 'Not added yet'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {needsAction && plan?.refusal === 'pinned' ? (
                      <button type="button" onClick={() => modelId && pinMutation.mutate({ clientRequestId: createClientRequestId(), modelId, angle: slot.angle, pinned: false })} disabled={pinMutation.isPending} className="text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink disabled:opacity-40">
                        Unpin
                      </button>
                    ) : canRefresh ? (
                      <button type="button" onClick={() => modelId && refreshMutation.mutate({ clientRequestId: createClientRequestId(), modelId, angles: [slot.angle] })} disabled={busy || refreshMutation.isPending} className="px-3 py-1.5 rounded-canvas-md bg-canvas-ink text-canvas-sm font-medium disabled:opacity-40" style={{ color: 'var(--color-canvas-surface)' }}>
                        {busy ? 'Refreshing…' : `${slot.failed ? 'Retry' : 'Refresh'} · ${(plan?.cost ?? 0).toLocaleString()} credits`}
                      </button>
                    ) : null}
                    {canOpenVersions && (
                      <button type="button" onClick={() => setVersionAngle(versionsOpen ? null : slot.angle)} className="flex items-center gap-1 text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink">
                        Versions <ChevronDown className={`w-3 h-3 transition-transform ${versionsOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {versionsOpen && (
                  <div className="border-t-hairline border-canvas-border px-3 py-2.5 flex gap-2 overflow-x-auto">
                    {versionsQuery.isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-canvas-ink-faint" />
                    ) : (versionsQuery.data?.versions ?? []).filter((version) => !version.isHead).map((version) => (
                      <div key={version.assetId} className="w-20 flex-shrink-0">
                        <img src={version.url} alt="Earlier version" className="w-20 h-24 object-cover rounded-canvas-sm" />
                        <button
                          type="button"
                          disabled={!version.revisionCompatible || restoreMutation.isPending}
                          onClick={() => modelId && restoreMutation.mutate({ clientRequestId: createClientRequestId(), modelId, angle: slot.angle, assetId: version.assetId })}
                          className="mt-1 w-full text-canvas-xs font-medium text-canvas-ink-soft hover:text-canvas-ink disabled:text-canvas-ink-faint disabled:cursor-not-allowed"
                          title={version.revisionCompatible ? 'Use this version' : 'This belongs to an earlier identity'}
                        >
                          {version.revisionCompatible ? 'Use this version' : 'Earlier identity'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t-hairline border-canvas-border flex items-center justify-between gap-4">
          <div className="text-canvas-sm text-canvas-ink-soft">
            {loadError
              ? 'Package status unavailable'
              : actionable.length > 0
              ? `${actionable.length} view${actionable.length === 1 ? '' : 's'} · ${actionableCost.toLocaleString()} credits`
              : issueCount > 0
                ? `${issueCount} item${issueCount === 1 ? '' : 's'} need attention`
                : 'Everything shown is in sync'}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className="text-canvas-md font-medium text-canvas-ink-soft hover:text-canvas-ink">Done</button>
            {!loadError && actionable.length > 1 && (
              <button type="button" onClick={() => modelId && refreshMutation.mutate({ clientRequestId: createClientRequestId(), modelId, angles: actionable.map((slot) => slot.angle) })} disabled={refreshMutation.isPending} className="px-4 py-2 rounded-canvas-md bg-canvas-ink text-canvas-md font-medium disabled:opacity-40" style={{ color: 'var(--color-canvas-surface)' }}>
                Refresh all · {actionableCost.toLocaleString()} credits
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

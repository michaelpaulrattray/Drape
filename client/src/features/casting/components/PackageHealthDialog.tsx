import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingRefreshStore } from '@/features/casting/stores/useCastingRefreshStore';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import { useCastingPackageRefresh } from '@/features/casting/hooks/useCastingPackageRefresh';
import { SlotVersionHistory } from '@/features/casting/components/SlotVersionHistory';
import { CastStateHistory } from '@/features/casting/components/CastStateHistory';
import {
  evidencePackageRefusalMessage,
  evidencePackageSlotNeedsAction,
} from '@/features/casting/evidence/evidencePackageDisplay';
import { requestInkProjection } from '@/features/casting/evidence/inkProjectionEvents';

const OPEN_CASTING_DETAILS = 'casting-open-details';

export function openCastingDetails(angle?: CanonicalViewAngle) {
  window.dispatchEvent(new CustomEvent(OPEN_CASTING_DETAILS, { detail: { angle } }));
}

export function CastingDetailsDialog() {
  const modelId = useCastingGenerationStore((s) => s.currentModelId);
  const [versionAngle, setVersionAngle] = useState<CanonicalViewAngle | null>(null);
  const open = useCastingRefreshStore((s) => s.detailsOpen);
  const setOpen = useCastingRefreshStore((s) => s.setDetailsOpen);
  const {
    isPending: refreshPending,
    refreshingSet,
    refreshAngles,
  } = useCastingPackageRefresh(modelId);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const angle = (event as CustomEvent<{ angle?: CanonicalViewAngle }>).detail?.angle;
      setVersionAngle(angle ?? null);
      setOpen(true);
    };
    window.addEventListener(OPEN_CASTING_DETAILS, onOpen);
    return () => window.removeEventListener(OPEN_CASTING_DETAILS, onOpen);
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
  if (!open) return null;

  const slots = packageQuery.data?.slots ?? [];
  const evidencePackage = planQuery.data && 'evidencePackage' in planQuery.data
    ? planQuery.data.evidencePackage
    : undefined;
  const evidenceAware = Boolean(evidencePackage);
  const evidenceByAngle = new Map(
    (evidencePackage?.slots ?? []).map((row) => [row.angle, row]),
  );
  const planRows = new Map(
    (evidencePackage?.slots ?? planQuery.data?.slots ?? []).map((row) => [row.angle, row]),
  );
  const integrity = mintPlanQuery.data?.integrity.production;
  const blockers = new Map(
    (evidenceAware ? [] : integrity?.tierViews ?? [])
      .filter((view) => !view.ok)
      .map((view) => [view.angle, view]),
  );
  const headshotIssue = integrity && (!integrity.anchor.ok || !integrity.displayHeadshot.ok)
    ? integrity.anchor.message ?? integrity.displayHeadshot.message ?? 'The headshot needs attention before minting.'
    : null;
  const actionable = slots.filter((slot) => {
    const plan = planRows.get(slot.angle);
    const evidenceNeedsAction = evidencePackageSlotNeedsAction(
      evidenceByAngle.get(slot.angle),
    );
    return !!plan && plan.refusal === null && !refreshingSet.has(slot.angle)
      && (
        evidenceAware
          ? evidenceNeedsAction
          : slot.stale || !!slot.failed || blockers.has(slot.angle)
      );
  });
  const issueAngles = new Set(
    slots.filter((slot) => {
      return evidenceAware
        ? evidencePackageSlotNeedsAction(evidenceByAngle.get(slot.angle))
        : slot.stale || !!slot.failed || blockers.has(slot.angle);
    }).map((slot) => slot.angle),
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
            <div className="text-canvas-lg font-medium text-canvas-ink">
              {evidenceAware ? 'Coverage & versions' : 'Versions & details'}
            </div>
            <div className="text-canvas-md text-canvas-ink-soft mt-0.5">
              {evidenceAware
                ? 'Add only the views that make this Cast more useful.'
                : 'Review the card, or reuse a compatible earlier version.'}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-1 text-canvas-ink-faint hover:text-canvas-ink" aria-label="Close versions and details">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 space-y-1.5">
          {modelId ? <CastStateHistory modelId={modelId} className="mb-2" /> : null}
          {packageQuery.isLoading || planQuery.isLoading || mintPlanQuery.isLoading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-canvas-md text-canvas-ink-soft">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking views…
            </div>
          ) : loadError ? (
            <div className="py-8 text-center">
              <div className="text-canvas-md text-canvas-ink-soft">Couldn&apos;t load view details — {loadError.message}</div>
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
            const evidenceStatus = evidenceByAngle.get(slot.angle)?.status;
            const evidenceRefusal = evidencePackageRefusalMessage(
              evidenceByAngle.get(slot.angle)?.refusal,
            );
            const requiresProjection = Boolean(
              plan && 'action' in plan && plan.action === 'projection',
            );
            const busy = refreshingSet.has(slot.angle);
            const needsAction = evidenceAware
              ? evidencePackageSlotNeedsAction(evidenceByAngle.get(slot.angle))
                || !!headshotBlock
              : slot.stale || !!slot.failed || !!blocker || !!headshotBlock;
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
                        ? requiresProjection
                          ? 'Generating a private tattoo preview…'
                          : evidenceAware
                            ? 'Updating from saved tattoo evidence…'
                            : 'Refreshing against the current identity…'
                        : headshotBlock
                          ? `${headshotBlock} Use a compatible version below, or continue editing the headshot.`
                          : evidenceRefusal
                            ? evidenceRefusal
                          : blocker?.message
                          ? blocker.message
                          : slot.failed
                          ? `Retry needed — ${slot.failed.reason}`
                          : requiresProjection && needsAction
                            ? 'Tattoo preview needed for this view'
                            : evidenceAware && needsAction
                              ? 'Tattoo update suggested for this view'
                              : slot.stale
                                ? 'Out of sync with the current identity'
                            : slot.filled
                              ? evidenceAware
                                ? 'Current Cast view'
                                : 'Current identity version'
                              : 'Not added yet'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canRefresh ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (requiresProjection) {
                            setOpen(false);
                            requestInkProjection(slot.angle);
                          } else {
                            refreshAngles([slot.angle]);
                          }
                        }}
                        disabled={busy || refreshPending}
                        className="px-3 py-1.5 rounded-canvas-md bg-canvas-ink text-canvas-sm font-medium disabled:opacity-40"
                        style={{ color: 'var(--color-canvas-surface)' }}
                      >
                        {busy
                          ? (evidenceAware ? 'Updating…' : 'Refreshing…')
                          : requiresProjection
                            ? `Preview · ${(plan?.cost ?? 0).toLocaleString()} credits`
                            : `${slot.failed
                            ? (evidenceAware ? 'Try again' : 'Retry')
                            : evidenceStatus === 'missing'
                              ? 'Add'
                              : evidenceAware
                                ? 'Update'
                                : 'Refresh'} · ${(plan?.cost ?? 0).toLocaleString()} credits`}
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
                  <div className="border-t-hairline border-canvas-border px-3 py-2.5">
                    {modelId && (
                      <SlotVersionHistory
                        modelId={modelId}
                        angle={slot.angle}
                        onUsed={() => setVersionAngle(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t-hairline border-canvas-border flex items-center justify-between gap-4">
          <div className="text-canvas-sm text-canvas-ink-soft">
            {loadError
              ? 'View status unavailable'
              : actionable.length > 0
              ? evidenceAware
                ? `${actionable.length} suggested update${actionable.length === 1 ? '' : 's'} · ${actionableCost.toLocaleString()} credits`
                : `${actionable.length} view${actionable.length === 1 ? '' : 's'} · ${actionableCost.toLocaleString()} credits`
              : issueCount > 0
                ? `${issueCount} item${issueCount === 1 ? '' : 's'} need attention`
                : 'Everything shown is in sync'}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className="text-canvas-md font-medium text-canvas-ink-soft hover:text-canvas-ink">Done</button>
            {!loadError
              && actionable.length > 1
              && actionable.every(
                (slot) => {
                  const plan = planRows.get(slot.angle);
                  return !plan
                    || !('action' in plan)
                    || plan.action !== 'projection';
                },
              ) && (
              <button type="button" onClick={() => refreshAngles(actionable.map((slot) => slot.angle))} disabled={refreshPending} className="px-4 py-2 rounded-canvas-md bg-canvas-ink text-canvas-md font-medium disabled:opacity-40" style={{ color: 'var(--color-canvas-surface)' }}>
                {evidenceAware ? 'Update coverage' : 'Refresh all'} · {actionableCost.toLocaleString()} credits
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Loader2, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { refundOutcomeText } from '@shared/refundCopy';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { openCastingDetails } from '@/features/casting/components/PackageHealthDialog';
import { useCastingPackageRefresh } from '@/features/casting/hooks/useCastingPackageRefresh';
import {
  evidencePackageRefusalMessage,
  evidencePackageSlotIsOutOfSync,
  evidencePackageSlotNeedsAction,
} from '@/features/casting/evidence/evidencePackageDisplay';
import { requestInkProjection } from '@/features/casting/evidence/inkProjectionEvents';
import {
  MINT_TIER_SLOTS,
  PACKAGE_SLOTS as SHARED_PACKAGE_SLOTS,
  type CanonicalViewAngle,
  type MintTier,
} from '@shared/boardTypes';

// ============ Types ============

export type ViewType = CanonicalViewAngle;

export interface GeneratedAsset {
  id: number;
  viewType: ViewType | string;
  storageUrl: string;
}

// ============ ViewThumbnail ============

function ViewThumbnail({
  src,
  label,
  isActive,
  onSelect,
  isHovered,
  isStale,
  coverageUnavailable = false,
  isRefreshing,
  refreshCost,
  refreshVerb = 'Refresh',
  evidenceAware = false,
  onRefresh,
}: {
  src: string;
  label: string;
  isActive: boolean;
  onSelect: () => void;
  isHovered: boolean;
  isStale: boolean;
  coverageUnavailable?: boolean;
  isRefreshing: boolean;
  refreshCost?: number;
  refreshVerb?: 'Refresh' | 'Update' | 'Preview';
  evidenceAware?: boolean;
  onRefresh?: () => void;
}) {
  const stateLabel = isRefreshing
    ? refreshVerb === 'Preview'
      ? `${label} tattoo preview is generating`
      : evidenceAware
        ? `${label} is updating from saved tattoo evidence`
        : `${label} is refreshing against the current identity`
    : isStale
      ? coverageUnavailable
        ? `${label} is out of sync; tattoo coverage is unavailable in this release`
        : refreshVerb === 'Preview'
          ? `${label} needs a tattoo preview`
          : evidenceAware
            ? `${label} has a suggested tattoo update`
            : `${label} is out of sync with the current identity`
      : label;
  return (
    <div
      className="relative overflow-hidden transition-all duration-200 rounded-canvas-md bg-canvas-surface"
      style={{
        width: 72,
        height: 90,
        border: isActive
          ? '1px solid var(--color-canvas-ink)'
          : '0.5px solid var(--color-canvas-border)',
        opacity: isHovered || isActive ? 1 : 0.75,
      }}
    >
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
        aria-label={stateLabel}
        aria-busy={isRefreshing || undefined}
        title={stateLabel}
        className="absolute inset-0 block h-full w-full"
      >
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover transition-opacity duration-200"
          style={{ opacity: isRefreshing ? 0.42 : isStale ? 0.58 : 1 }}
        />
        <span
          className="absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-canvas-xs font-medium"
          style={{ background: 'rgba(10,10,10,0.55)', color: 'var(--color-canvas-surface)' }}
        >
          {label}
        </span>
      </button>
      {isRefreshing ? (
        <span
          className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-canvas-surface text-canvas-ink"
          style={{ width: 17, height: 17, boxShadow: '0 0 0 1px var(--color-canvas-border-strong)' }}
          aria-hidden="true"
        >
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        </span>
      ) : onRefresh && refreshCost !== undefined ? (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onRefresh(); }}
          aria-label={`${refreshVerb} ${label} for ${refreshCost.toLocaleString()} credits`}
          title={`${refreshVerb} ${label} · ${refreshCost.toLocaleString()} credits`}
          className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-canvas-surface px-1.5 py-1 text-canvas-ink shadow-sm transition-colors hover:bg-canvas-surface-inset"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          <span className="text-[9px] font-medium leading-none">{refreshCost.toLocaleString()}</span>
        </button>
      ) : null}
    </div>
  );
}

function RefreshingSlot({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-canvas-md bg-canvas-surface-inset text-canvas-ink-soft"
      style={{ width: 72, height: 90, border: '0.5px solid var(--color-canvas-border-strong)' }}
      role="status"
      aria-label={`${label} is generating`}
      aria-live="polite"
    >
      <Loader2 className="w-3 h-3 animate-spin" />
      <span className="text-canvas-xs font-medium">{label}</span>
      <span className="text-canvas-xs text-canvas-ink-faint">Generating</span>
    </div>
  );
}

// ============ GhostSlot (D-39c) ============
// An empty package slot on a minted model — the upgrade affordance.
// Clicking any ghost opens the tier dialog (upgrade-anytime-same-cost).

function GhostSlot({
  label,
  cost,
  action = 'Add views',
  onClick,
}: {
  label: string;
  cost?: number;
  action?: 'Add' | 'Add views' | 'Preview';
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center justify-center gap-1 transition-colors duration-200 rounded-canvas-md text-canvas-ink-soft bg-canvas-surface/60 hover:bg-canvas-surface"
      title={`${action}${cost === undefined ? '' : ` · ${cost.toLocaleString()} credits`}`}
      style={{
        width: 72,
        height: 90,
        border: '1px dashed var(--color-canvas-border-strong)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-canvas-ink-faint)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-canvas-border-strong)'; }}
    >
      <Plus className="h-3 w-3" />
      <span className="text-canvas-xs font-medium">{label}</span>
      <span className="text-[9px] leading-none text-canvas-ink-faint">
        {cost === undefined ? action : `${action} · ${cost.toLocaleString()}`}
      </span>
    </button>
  );
}

// ============ FailedSlot (D-40; hue per R6 ruling R-1) ============
// A slot whose generation failed the identity gate — named, and retryable
// only when the shared server plan permits another attempt. It stays
// HONEST about the money (Batch C final correction 1): the refund line
// derives from what the ledger actually recorded, never an unconditional
// "you weren't charged". Failure wears the destructive-red glyph (§2.1.3).

function FailedSlot({
  label,
  failure,
  cost,
  action = 'Retry',
  onRetry,
}: {
  label: string;
  failure: { reason: string; refunded: number; refundReference?: string };
  cost?: number;
  action?: 'Retry' | 'Preview';
  onRetry?: () => void;
}) {
  const retryable = Boolean(onRetry);
  const retryLabel = `${label} failed — ${failure.reason}. ${refundOutcomeText(failure)}${
    retryable && cost !== undefined
      ? ` ${action} for ${cost.toLocaleString()} credits.`
      : ''
  }`;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
      disabled={!onRetry}
      className="flex flex-col items-center justify-center gap-1 transition-colors duration-200 rounded-canvas-md bg-canvas-surface-inset hover:bg-canvas-surface text-canvas-ink-soft disabled:cursor-default disabled:opacity-60"
      aria-label={retryLabel}
      title={retryLabel}
      style={{
        width: 72,
        height: 90,
        border: '0.5px solid var(--color-canvas-border-strong)',
      }}
    >
      <RefreshCw className="h-3 w-3" />
      <span className="text-canvas-xs font-medium">{label}</span>
      <span className="text-[9px] leading-none text-canvas-ink-faint">
        {!retryable
          ? 'Needs attention'
          : cost === undefined
            ? action
            : `${action} · ${cost.toLocaleString()}`}
      </span>
    </button>
  );
}

// ============ Main Component ============

/**
 * The strip's short labels — a SEPARATE vocabulary from `VIEW_ANGLE_LABELS`,
 * and deliberately so: these render inside a tab a few characters wide, where
 * "Three-quarter" and "Full front" do not fit.
 *
 * Typed as a total `Record` rather than a list, so the completeness is the
 * compiler's job: a seventh slot added to `CanonicalViewAngle` cannot arrive
 * here unlabelled.
 */
const SLOT_LABELS: Record<ViewType, string> = {
  frontClose: 'Head',
  threeQuarter: '3/4',
  sideClose: 'Side',
  frontFull: 'Full',
  sideFull: 'Walk',
  backFull: 'Back',
};

/**
 * The canonical package order (D-39): face cluster, then body cluster.
 *
 * ⚠ DERIVED, because this was a hand-written copy of the closed list until
 * 2026-08-24 and it had already drifted from it (triage §29d). The order lives
 * in `shared/boardTypes.ts`'s `PACKAGE_SLOTS` — which was reordered to the
 * clusters this comment has always claimed, so what the customer sees here is
 * unchanged — and `boardTypes.test.ts` pins that against
 * `CANONICAL_VIEW_ANGLES` in membership AND order.
 *
 * The family has a paid incident on its record: iterating the wrong six is how
 * package v3's close-up was generated, charged, refunded and then never drawn.
 */
const PACKAGE_SLOTS: ReadonlyArray<{ vt: ViewType; label: string }> =
  SHARED_PACKAGE_SLOTS.map((vt) => ({ vt, label: SLOT_LABELS[vt] }));

/** Missing views use the existing tier ceremony. We do not invent a second
 * generation path just to make a tile appear independent. */
export function addTierForAngle(angle: CanonicalViewAngle): MintTier {
  if (angle === 'frontClose') return 'draft';
  return MINT_TIER_SLOTS.core.includes(angle) ? 'core' : 'production';
}

export function ViewTabs() {
  const currentAssets = useCastingGenerationStore((s) => s.currentAssets);
  const currentModelId = useCastingGenerationStore((s) => s.currentModelId);
  const { activeView, setActiveView } = useCastingUIStore();
  // ONE view system (D-46): the six-slot package renders for drafts and minted
  // models alike — filled slots as thumbnails, empty ones as ghosts. The only
  // difference is where a ghost leads: a draft's ghost opens the MINT gate
  // ("adding views is a Core mint away"); a minted model's ghost opens the
  // UPGRADE dialog (add to the existing package). The old head→lock→body
  // ladder and its StageLockModal are retired.
  const isMintedProfile = useStudioStore((s) =>
    s.mintedEditContext?.modelId != null || s.canvas.isMinted,
  );
  const hasMissingView = PACKAGE_SLOTS.some(
    ({ vt }) => !currentAssets.some((asset) => asset.viewType === vt),
  );
  const openPackage = (tier: MintTier) =>
    window.dispatchEvent(new CustomEvent(
      isMintedProfile ? 'casting-open-package-upgrade' : 'casting-open-mint',
      { detail: { tier } },
    ));
  // F5: read the package state for the CURRENT model — draft OR minted (the
  // old query only ran on minted edits, so a draft's stale marks and failed
  // slots never reached the strip, the very surface where the edit is made).
  // Audit V15: ONE cadence with the board's observer (useSheetController) —
  // two staleTimes made the strip and the mosaic disagree across a takeover
  // hop. Post-edit freshness comes from performIteration's explicit
  // invalidate, not a faster poll.
  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId != null, staleTime: 15_000 },
  );
  const refreshPlanQuery = trpc.generation.refreshSlotsPlan.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId != null, staleTime: 15_000 },
  );
  const mintPlanQuery = trpc.generation.mintPackagePlan.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId != null && hasMissingView, staleTime: 15_000 },
  );
  const { isPending, refreshingSet, refreshAngles } = useCastingPackageRefresh(currentModelId);
  const packageSlots = packageQuery.data?.slots ?? [];
  const evidencePackage = refreshPlanQuery.data && 'evidencePackage' in refreshPlanQuery.data
    ? refreshPlanQuery.data.evidencePackage
    : undefined;
  const evidenceAware = Boolean(evidencePackage);
  const packageByAngle = useMemo(
    () => new Map(packageSlots.map((slot) => [slot.angle, slot])),
    [packageSlots],
  );
  const planByAngle = useMemo(
    () => new Map((refreshPlanQuery.data?.slots ?? []).map((slot) => [slot.angle, slot])),
    [refreshPlanQuery.data?.slots],
  );
  const evidenceByAngle = useMemo(
    () => new Map((evidencePackage?.slots ?? []).map((slot) => [slot.angle, slot])),
    [evidencePackage?.slots],
  );
  const actionable = evidencePackage
    ? evidencePackage.slots.filter((slot) =>
        slot.status !== 'current'
        && slot.refusal === null
        && !refreshingSet.has(slot.angle))
    : packageSlots.filter((slot) => {
        const plan = planByAngle.get(slot.angle);
        return (slot.stale || !!slot.failed)
          && plan?.refusal === null
          && !refreshingSet.has(slot.angle);
      });
  const actionableCost = actionable.reduce(
    (total, slot) => total + (
      evidenceByAngle.get(slot.angle)?.cost
      ?? planByAngle.get(slot.angle)?.cost
      ?? 0
    ),
    0,
  );
  const bulkRefreshable = actionable.filter((slot) => {
    const plan = evidenceByAngle.get(slot.angle)
      ?? planByAngle.get(slot.angle);
    return !plan || !('action' in plan) || plan.action !== 'projection';
  });
  const hasDetails = packageSlots.some((slot) => slot.version > 1);
  const [hovered, setHovered] = useState(false);

  const getAsset = (vt: ViewType) => currentAssets.find((a) => a.viewType === vt);

  if (currentAssets.length === 0) return null;

  return (
    <div
      className="absolute left-4 top-16 z-30 flex flex-col gap-2 transition-opacity duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ opacity: hovered ? 1 : 0.75 }}
    >
      <div className="contents pointer-events-auto">
        {PACKAGE_SLOTS.map(({ vt, label }) => {
          const asset = getAsset(vt);
          const slot = packageByAngle.get(vt);
          const evidenceSlot = evidenceByAngle.get(vt);
          const plan = evidenceSlot ?? planByAngle.get(vt);
          const requiresProjection = Boolean(
            plan && 'action' in plan && plan.action === 'projection',
          );
          const refreshing = refreshingSet.has(vt);
          const evidenceNeedsAction = evidencePackageSlotNeedsAction(evidenceSlot);
          const isOutOfSync = evidencePackageSlotIsOutOfSync({
            packageStale: !!slot?.stale,
            evidenceSlot,
          });
          const coverageUnavailable =
            evidencePackageRefusalMessage(evidenceSlot?.refusal) !== null;

          if (refreshing && !asset) return <RefreshingSlot key={vt} label={label} />;
          if (asset) {
            const canRefresh =
              (evidenceAware ? evidenceNeedsAction : !!slot?.stale)
              && plan?.refusal === null
              && !refreshing;
            return (
              <ViewThumbnail
                key={vt}
                src={asset.storageUrl}
                label={label}
                isActive={activeView === vt}
                onSelect={() => setActiveView(vt)}
                isHovered={hovered}
                isStale={evidenceAware ? isOutOfSync : !!slot?.stale}
                coverageUnavailable={coverageUnavailable}
                isRefreshing={refreshing}
                refreshCost={canRefresh ? plan.cost : undefined}
                refreshVerb={requiresProjection
                  ? 'Preview'
                  : evidenceAware
                    ? 'Update'
                    : 'Refresh'}
                evidenceAware={evidenceAware}
                onRefresh={canRefresh
                  ? () => requiresProjection
                    ? requestInkProjection(vt)
                    : refreshAngles([vt])
                  : undefined}
              />
            );
          }
          if (slot?.failed) {
            return (
              <FailedSlot
                key={vt}
                label={label}
                failure={slot.failed}
                cost={plan?.refusal === null ? plan.cost : undefined}
                action={requiresProjection ? 'Preview' : 'Retry'}
                onRetry={plan?.refusal === null
                  ? () => requiresProjection
                    ? requestInkProjection(vt)
                    : refreshAngles([vt])
                  : undefined}
              />
            );
          }

          const tier = addTierForAngle(vt);
          if (evidenceSlot?.refusal === null) {
            return (
              <GhostSlot
                key={vt}
                label={label}
                cost={evidenceSlot.cost}
                action={requiresProjection ? "Preview" : "Add"}
                onClick={() => requiresProjection
                  ? requestInkProjection(vt)
                  : refreshAngles([vt])}
              />
            );
          }
          const cost = mintPlanQuery.data?.tiers[tier].cost;
          return <GhostSlot key={vt} label={label} cost={cost} onClick={() => openPackage(tier)} />;
        })}
        {(
          (
            bulkRefreshable.length > 1
            && bulkRefreshable.length === actionable.length
          )
          || hasDetails
        ) && (
          <div className="flex w-[72px] flex-col gap-1">
            {bulkRefreshable.length > 1
              && bulkRefreshable.length === actionable.length && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  refreshAngles(bulkRefreshable.map((slot) => slot.angle));
                }}
                disabled={isPending}
                className="rounded-canvas-md bg-canvas-ink px-1.5 py-1.5 text-center text-[9px] font-medium leading-tight disabled:opacity-40"
                style={{ color: 'var(--color-canvas-surface)' }}
                aria-label={evidenceAware
                  ? `Update coverage for ${actionableCost.toLocaleString()} credits`
                  : `Refresh all ${bulkRefreshable.length} views for ${actionableCost.toLocaleString()} credits`}
              >
                {evidenceAware ? 'Update coverage' : 'Refresh all'}<br />{actionableCost.toLocaleString()} credits
              </button>
            )}
            {hasDetails && (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); openCastingDetails(); }}
                className="flex items-center justify-center gap-1 px-1 py-1 text-canvas-xs font-medium text-canvas-ink-faint transition-colors hover:text-canvas-ink"
              >
                <MoreHorizontal className="h-3 w-3" /> Details
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewTabs;

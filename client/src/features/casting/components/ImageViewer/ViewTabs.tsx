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
  MINT_TIER_SLOTS,
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
  isRefreshing,
  refreshCost,
  onRefresh,
}: {
  src: string;
  label: string;
  isActive: boolean;
  onSelect: () => void;
  isHovered: boolean;
  isStale: boolean;
  isRefreshing: boolean;
  refreshCost?: number;
  onRefresh?: () => void;
}) {
  const stateLabel = isRefreshing
    ? `${label} is refreshing against the current identity`
    : isStale
      ? `${label} is out of sync with the current identity`
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
          aria-label={`Refresh ${label} for ${refreshCost.toLocaleString()} credits`}
          title={`Refresh ${label} · ${refreshCost.toLocaleString()} credits`}
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

function GhostSlot({ label, cost, onClick }: { label: string; cost?: number; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center justify-center gap-1 transition-colors duration-200 rounded-canvas-md text-canvas-ink-soft bg-canvas-surface/60 hover:bg-canvas-surface"
      title={`Add views${cost === undefined ? '' : ` · ${cost.toLocaleString()} credits`}`}
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
        {cost === undefined ? 'Add views' : `Add · ${cost.toLocaleString()}`}
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
  onRetry,
}: {
  label: string;
  failure: { reason: string; refunded: number; refundReference?: string };
  cost?: number;
  onRetry?: () => void;
}) {
  const retryable = Boolean(onRetry);
  const retryLabel = `${label} failed — ${failure.reason}. ${refundOutcomeText(failure)}${
    retryable && cost !== undefined ? ` Retry for ${cost.toLocaleString()} credits.` : ''
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
        {!retryable ? 'Needs attention' : cost === undefined ? 'Retry' : `Retry · ${cost.toLocaleString()}`}
      </span>
    </button>
  );
}

// ============ Main Component ============

// The canonical package order (D-39): face cluster, then body cluster
const PACKAGE_SLOTS: Array<{ vt: ViewType; label: string }> = [
  { vt: 'frontClose', label: 'Head' },
  { vt: 'threeQuarter', label: '3/4' },
  { vt: 'sideClose', label: 'Side' },
  { vt: 'frontFull', label: 'Full' },
  { vt: 'sideFull', label: 'Walk' },
  { vt: 'backFull', label: 'Back' },
];

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
  const packageByAngle = useMemo(
    () => new Map(packageSlots.map((slot) => [slot.angle, slot])),
    [packageSlots],
  );
  const planByAngle = useMemo(
    () => new Map((refreshPlanQuery.data?.slots ?? []).map((slot) => [slot.angle, slot])),
    [refreshPlanQuery.data?.slots],
  );
  const actionable = packageSlots.filter((slot) => {
    const plan = planByAngle.get(slot.angle);
    return (slot.stale || !!slot.failed)
      && plan?.refusal === null
      && !refreshingSet.has(slot.angle);
  });
  const actionableCost = actionable.reduce(
    (total, slot) => total + (planByAngle.get(slot.angle)?.cost ?? 0),
    0,
  );
  const pinningAvailable = packageQuery.data?.pinningAvailable !== false;
  const hasDetails = packageSlots.some(
    (slot) => slot.version > 1 || (pinningAvailable && slot.stale && slot.pinned),
  );
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
          const plan = planByAngle.get(vt);
          const refreshing = refreshingSet.has(vt);

          if (refreshing && !asset) return <RefreshingSlot key={vt} label={label} />;
          if (asset) {
            const canRefresh = !!slot?.stale && plan?.refusal === null && !refreshing;
            return (
              <ViewThumbnail
                key={vt}
                src={asset.storageUrl}
                label={label}
                isActive={activeView === vt}
                onSelect={() => setActiveView(vt)}
                isHovered={hovered}
                isStale={!!slot?.stale}
                isRefreshing={refreshing}
                refreshCost={canRefresh ? plan.cost : undefined}
                onRefresh={canRefresh ? () => refreshAngles([vt]) : undefined}
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
                onRetry={plan?.refusal === null ? () => refreshAngles([vt]) : undefined}
              />
            );
          }

          const tier = addTierForAngle(vt);
          const cost = mintPlanQuery.data?.tiers[tier].cost;
          return <GhostSlot key={vt} label={label} cost={cost} onClick={() => openPackage(tier)} />;
        })}
        {(actionable.length > 1 || hasDetails) && (
          <div className="flex w-[72px] flex-col gap-1">
            {actionable.length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  refreshAngles(actionable.map((slot) => slot.angle));
                }}
                disabled={isPending}
                className="rounded-canvas-md bg-canvas-ink px-1.5 py-1.5 text-center text-[9px] font-medium leading-tight disabled:opacity-40"
                style={{ color: 'var(--color-canvas-surface)' }}
                aria-label={`Refresh all ${actionable.length} views for ${actionableCost.toLocaleString()} credits`}
              >
                Refresh all<br />{actionableCost.toLocaleString()} credits
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

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { refundOutcomeText } from '@shared/refundCopy';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useStudioStore } from '@/features/studio/stores/useStudioStore';

// ============ Types ============

export type ViewType = 'frontClose' | 'threeQuarter' | 'frontFull' | 'sideClose' | 'sideFull' | 'backFull';

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
  onClick,
  isHovered,
  isStale,
}: {
  src: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isHovered: boolean;
  /** F5: the same stale treatment the board mosaic uses (D-37 dot + dim) —
   *  the strip is where the divergent edit is MADE, so the consequence must
   *  be visible here first (D-40). */
  isStale?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="relative overflow-hidden transition-all duration-200 rounded-canvas-md bg-canvas-surface"
      style={{
        width: 72,
        height: 90,
        border: isActive
          ? '1px solid var(--color-canvas-ink)'
          : '0.5px solid var(--color-canvas-border)',
        opacity: isHovered || isActive ? 1 : 0.75,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = 'var(--color-canvas-border-strong)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = 'var(--color-canvas-border)';
      }}
    >
      <img
        src={src}
        alt={label}
        className="w-full h-full object-cover transition-opacity duration-200"
        style={{ opacity: isStale ? 0.6 : 1 }}
      />
      {/* Stale dot — ink, top-right, screen-legible (matches the mosaic tile) */}
      {isStale && (
        <span
          className="absolute top-1 right-1 rounded-full bg-canvas-ink"
          style={{ width: 6, height: 6, boxShadow: '0 0 0 1.5px var(--color-canvas-surface)' }}
          title="Out of sync with a recent edit — refresh from the comp card"
        />
      )}
      <div
        className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
        style={{ background: 'rgba(10,10,10,0.55)' }}
      >
        <span className="text-canvas-xs font-medium" style={{ color: 'var(--color-canvas-surface)' }}>
          {label}
        </span>
      </div>
    </button>
  );
}

// ============ GhostSlot (D-39c) ============
// An empty package slot on a minted model — the upgrade affordance.
// Clicking any ghost opens the tier dialog (upgrade-anytime-same-cost).

function GhostSlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center justify-center gap-1 transition-colors duration-200 rounded-canvas-md text-canvas-ink-soft bg-canvas-surface/60 hover:bg-canvas-surface"
      title="Add this view — complete the comp card"
      style={{
        width: 72,
        height: 90,
        border: '1px dashed var(--color-canvas-border-strong)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-canvas-ink-faint)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-canvas-border-strong)'; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="text-canvas-xs font-medium">{label}</span>
    </button>
  );
}

// ============ FailedSlot (D-40; hue per R6 ruling R-1) ============
// A slot whose generation failed the identity gate — named, retryable, and
// HONEST about the money (Batch C final correction 1): the refund line
// derives from what the ledger actually recorded, never an unconditional
// "you weren't charged". Failure wears the destructive-red glyph (§2.1.3).

function FailedSlot({
  label,
  failure,
  onRetry,
}: {
  label: string;
  failure: { reason: string; refunded: number; refundReference?: string };
  onRetry: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onRetry(); }}
      className="flex flex-col items-center justify-center gap-1 transition-colors duration-200 rounded-canvas-md bg-canvas-surface-inset hover:bg-canvas-surface text-canvas-ink-soft"
      title={`${label} didn't pass the identity check — ${failure.reason}. ${refundOutcomeText(failure)} Click to try again.`}
      style={{
        width: 72,
        height: 90,
        border: '0.5px solid var(--color-canvas-border-strong)',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-destructive)" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
      <span className="text-canvas-xs font-medium">{label} · Retry</span>
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
  const mintedModelId = useStudioStore((s) => s.mintedEditContext?.modelId ?? null);
  const isMintedEdit = mintedModelId !== null;
  const openPackage = () =>
    window.dispatchEvent(
      new CustomEvent(isMintedEdit ? 'casting-open-package-upgrade' : 'casting-open-mint'),
    );
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
  const failedByAngle = new Map(
    (packageQuery.data?.slots ?? [])
      .filter((s) => s.failed)
      .map((s) => [s.angle as ViewType, s.failed!]),
  );
  // F5: stale = a sibling out of sync with a recent divergent edit (F6 writer),
  // not pinned. Same rule the board mosaic uses.
  const staleAngles = new Set(
    (packageQuery.data?.slots ?? [])
      .filter((s) => s.stale && !s.pinned && s.filled)
      .map((s) => s.angle as ViewType),
  );
  const [hovered, setHovered] = useState(false);

  const getAsset = (vt: ViewType) => currentAssets.find((a) => a.viewType === vt);
  const hasAsset = (vt: ViewType) => currentAssets.some((a) => a.viewType === vt);

  if (currentAssets.length === 0) return null;

  return (
    <div
      className="absolute left-4 top-16 z-30 flex flex-col gap-2 transition-opacity duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ opacity: hovered ? 1 : 0.75 }}
    >
      <div className="contents pointer-events-auto">
        {PACKAGE_SLOTS.map(({ vt, label }) =>
          hasAsset(vt) ? (
            <ViewThumbnail
              key={vt}
              src={getAsset(vt)!.storageUrl}
              label={label}
              isActive={activeView === vt}
              onClick={() => setActiveView(vt)}
              isHovered={hovered}
              // Audit V15: no active-view suppression — the ledger already
              // guarantees a just-edited view isn't stale (the writer marks
              // siblings only); a stale view you SWITCH to must say so.
              isStale={staleAngles.has(vt)}
            />
          ) : failedByAngle.has(vt) ? (
            <FailedSlot key={vt} label={label} failure={failedByAngle.get(vt)!} onRetry={openPackage} />
          ) : (
            <GhostSlot key={vt} label={label} onClick={openPackage} />
          ),
        )}
      </div>
    </div>
  );
}

export default ViewTabs;

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
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

interface NextStage {
  label: string;
  action: () => void;
  step: number;
  total: number;
}

interface ViewTabsProps {
  nextStage: NextStage | null;
}

// ============ ViewThumbnail ============

function ViewThumbnail({
  src,
  label,
  isActive,
  onClick,
  isHovered,
}: {
  src: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isHovered: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="relative overflow-hidden transition-all duration-200"
      style={{
        width: 72,
        height: 90,
        borderRadius: 12,
        border: isActive ? '2px solid #1a1a1a' : '2px solid rgba(255,255,255,0.6)',
        boxShadow: isActive
          ? '0 4px 16px rgba(0,0,0,0.15)'
          : '0 2px 10px rgba(0,0,0,0.08)',
        background: '#fff',
        transform: isActive ? 'scale(1.05)' : 'scale(1)',
        opacity: isHovered || isActive ? 1 : 0.75,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
        }
      }}
    >
      <img src={src} alt={label} className="w-full h-full object-cover" />
      <div
        className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
    </button>
  );
}

// ============ AddViewButton ============

function AddViewButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5"
      style={{
        width: 72,
        height: 90,
        borderRadius: 12,
        border: '2px dashed rgba(0,0,0,0.1)',
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(8px)',
        fontSize: 10,
        fontWeight: 600,
        color: '#52524B',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.9)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
        e.currentTarget.style.transform = visible ? 'scale(1)' : 'scale(0.9)';
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
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
      className="flex flex-col items-center justify-center gap-1 transition-all duration-200"
      title="Add this view — complete the package"
      style={{
        width: 72,
        height: 90,
        borderRadius: 12,
        border: '2px dashed rgba(0,0,0,0.12)',
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(8px)',
        color: '#71716A',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.25)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </button>
  );
}

// ============ FailedSlot (D-40) ============
// A slot whose generation failed the identity gate — named + refunded, and
// retryable. Distinct from an empty ghost: the user was told, not charged.

function FailedSlot({ label, reason, onRetry }: { label: string; reason: string; onRetry: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onRetry(); }}
      className="flex flex-col items-center justify-center gap-1 transition-all duration-200"
      title={`${label} didn't pass the identity check — ${reason}. You weren't charged. Click to try again.`}
      style={{
        width: 72,
        height: 90,
        borderRadius: 12,
        border: '2px solid rgba(180,90,20,0.35)',
        background: 'rgba(180,90,20,0.06)',
        color: '#8a4a10',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180,90,20,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(180,90,20,0.06)'; }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label} · Retry
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

export function ViewTabs({ nextStage }: ViewTabsProps) {
  const currentAssets = useCastingGenerationStore((s) => s.currentAssets);
  const { activeView, setActiveView } = useCastingUIStore();
  // Minted models surface the full package: filled slots as thumbnails,
  // empty ones as upgrade ghosts (VC-R3b bug 3 — the upgrade path's home)
  const mintedModelId = useStudioStore((s) => s.mintedEditContext?.modelId ?? null);
  const isMintedEdit = mintedModelId !== null;
  // Named-and-refunded slot failures (D-40) surface as retryable failed slots
  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: mintedModelId ?? 0 },
    { enabled: isMintedEdit },
  );
  const failedByAngle = new Map(
    (packageQuery.data?.slots ?? [])
      .filter((s) => s.failed)
      .map((s) => [s.angle as ViewType, s.failed!.reason]),
  );
  const [hovered, setHovered] = useState(false);

  const getAsset = (vt: ViewType) => currentAssets.find((a) => a.viewType === vt);
  const hasAsset = (vt: ViewType) => currentAssets.some((a) => a.viewType === vt);

  if (currentAssets.length === 0) return null;

  const thumbnail = (vt: ViewType, label: string) => (
    <ViewThumbnail
      key={vt}
      src={getAsset(vt)!.storageUrl}
      label={label}
      isActive={activeView === vt}
      onClick={() => setActiveView(vt)}
      isHovered={hovered}
    />
  );

  return (
    <div
      className="absolute left-4 top-16 z-30 flex flex-col gap-2 transition-opacity duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ opacity: hovered ? 1 : 0.75 }}
    >
      <div className="contents pointer-events-auto">
        {isMintedEdit ? (
          // Minted: the six-slot package (D-39) — filled thumbnails, failed
          // slots as named+retryable (D-40), the rest as upgrade ghosts
          PACKAGE_SLOTS.map(({ vt, label }) =>
            hasAsset(vt) ? (
              thumbnail(vt, label)
            ) : failedByAngle.has(vt) ? (
              <FailedSlot
                key={vt}
                label={label}
                reason={failedByAngle.get(vt)!}
                onRetry={() => window.dispatchEvent(new CustomEvent('casting-open-package-upgrade'))}
              />
            ) : (
              <GhostSlot
                key={vt}
                label={label}
                onClick={() => window.dispatchEvent(new CustomEvent('casting-open-package-upgrade'))}
              />
            ),
          )
        ) : (
          // Authoring: the staged ladder (head → full → side), extra views shown as they exist
          <>
            {getAsset('frontClose') && thumbnail('frontClose', 'Head')}
            {hasAsset('threeQuarter') && thumbnail('threeQuarter', '3/4')}
            {hasAsset('frontFull') ? (
              thumbnail('frontFull', 'Full')
            ) : (
              <AddViewButton
                visible={hovered}
                onClick={() => nextStage?.step === 2 && nextStage.action()}
              />
            )}
            {hasAsset('frontFull') && (
              hasAsset('sideClose') ? (
                <>
                  {thumbnail('sideClose', 'Side')}
                  {hasAsset('sideFull') && thumbnail('sideFull', 'Walk')}
                  {hasAsset('backFull') && thumbnail('backFull', 'Back')}
                </>
              ) : (
                <AddViewButton
                  visible={hovered}
                  onClick={() => nextStage?.step === 3 && nextStage.action()}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ViewTabs;

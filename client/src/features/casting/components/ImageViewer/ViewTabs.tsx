import { useState } from 'react';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';

// ============ Types ============

export type ViewType = 'frontClose' | 'frontFull' | 'sideClose' | 'sideFull' | 'backFull';

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
        color: '#52525B',
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

// ============ Main Component ============

export function ViewTabs({ nextStage }: ViewTabsProps) {
  const currentAssets = useCastingGenerationStore((s) => s.currentAssets);
  const { activeView, setActiveView } = useCastingUIStore();
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
        {/* HEAD */}
        {getAsset('frontClose') && (
          <ViewThumbnail
            src={getAsset('frontClose')!.storageUrl}
            label="Head"
            isActive={activeView === 'frontClose'}
            onClick={() => setActiveView('frontClose')}
            isHovered={hovered}
          />
        )}

        {/* FULL BODY */}
        {hasAsset('frontFull') ? (
          <ViewThumbnail
            src={getAsset('frontFull')!.storageUrl}
            label="Full"
            isActive={activeView === 'frontFull'}
            onClick={() => setActiveView('frontFull')}
            isHovered={hovered}
          />
        ) : (
          <AddViewButton
            visible={hovered}
            onClick={() => nextStage?.step === 2 && nextStage.action()}
          />
        )}

        {/* SIDE */}
        {hasAsset('frontFull') && (
          hasAsset('sideClose') ? (
            <>
              <ViewThumbnail
                src={getAsset('sideClose')!.storageUrl}
                label="Side"
                isActive={activeView === 'sideClose'}
                onClick={() => setActiveView('sideClose')}
                isHovered={hovered}
              />
              {hasAsset('sideFull') && (
                <ViewThumbnail
                  src={getAsset('sideFull')!.storageUrl}
                  label="Walk"
                  isActive={activeView === 'sideFull'}
                  onClick={() => setActiveView('sideFull')}
                  isHovered={hovered}
                />
              )}
              {hasAsset('backFull') && (
                <ViewThumbnail
                  src={getAsset('backFull')!.storageUrl}
                  label="Back"
                  isActive={activeView === 'backFull'}
                  onClick={() => setActiveView('backFull')}
                  isHovered={hovered}
                />
              )}
            </>
          ) : (
            <AddViewButton
              visible={hovered}
              onClick={() => nextStage?.step === 3 && nextStage.action()}
            />
          )
        )}
      </div>
    </div>
  );
}

export default ViewTabs;

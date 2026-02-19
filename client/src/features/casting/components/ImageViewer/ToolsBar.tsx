import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';

// ============ Types ============

interface ToolsBarProps {
  isIterationAllowed: boolean;
  isViewLocked: boolean;
  hasDownstreamDependencies: boolean;
  isMasking: boolean;
  imageAreaHovered: boolean;
}

// ============ SVG Icons ============

const SurgicalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const EraserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
);

// ============ Main Component ============

export function ToolsBar({
  isIterationAllowed,
  isViewLocked,
  hasDownstreamDependencies,
  isMasking,
  imageAreaHovered,
}: ToolsBarProps) {
  const genState = useCastingGenerationStore((state) => state.genState);
  const currentAssets = useCastingGenerationStore((state) => state.currentAssets);
  const { activeTool, setActiveTool, unlockMode } = useCastingUIStore();

  const showToolsBar = !genState.isGenerating && currentAssets.length > 0;
  const showSurgical = isIterationAllowed && (!isViewLocked || unlockMode);
  const showEraser = !hasDownstreamDependencies || unlockMode;

  return (
    <>
      {/* Tools bar — right side of image, fades on hover */}
      {showToolsBar && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 z-30 transition-opacity duration-200"
          style={{
            opacity: imageAreaHovered ? 1 : 0,
            pointerEvents: imageAreaHovered ? 'auto' : 'none',
          }}
        >
          {showSurgical && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTool(activeTool === 'surgical' ? 'none' : 'surgical');
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: activeTool === 'surgical' ? '#1a1a1a' : 'rgba(255,255,255,0.85)',
                color: activeTool === 'surgical' ? '#fff' : '#888',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                backdropFilter: 'blur(8px)',
              }}
              title="Surgical Edit"
            >
              <SurgicalIcon />
            </button>
          )}

          {showEraser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser');
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: activeTool === 'eraser' ? '#1a1a1a' : 'rgba(255,255,255,0.85)',
                color: activeTool === 'eraser' ? '#fff' : '#888',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                backdropFilter: 'blur(8px)',
              }}
              title="Magic Eraser"
            >
              <EraserIcon />
            </button>
          )}
        </div>
      )}

      {/* Status pills — top left */}
      {(isViewLocked || activeTool !== 'none') && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 items-start">
          {isViewLocked && (
            <div
              className="flex items-center gap-1.5"
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.85)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                backdropFilter: 'blur(8px)',
                fontSize: 9,
                fontWeight: 600,
                color: '#999',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Locked Source
            </div>
          )}
          {activeTool !== 'none' && (
            <div
              className="flex items-center gap-1.5"
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.85)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: activeTool === 'eraser' ? '#7c6bef' : '#dc3545',
                }}
              />
              <span style={{ fontSize: 9, fontWeight: 600, color: '#777' }}>
                {activeTool === 'eraser' ? 'Magic Eraser' : 'Surgical Edit'}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default ToolsBar;

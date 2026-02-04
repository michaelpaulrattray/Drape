import React from 'react';

// ============ Types ============

type EditTool = 'none' | 'surgical' | 'eraser';

interface ToolsBarProps {
  activeTool: EditTool;
  setActiveTool: (tool: EditTool) => void;
  isGenerating: boolean;
  hasAssets: boolean;
  isIterationAllowed: boolean;
  isViewLocked: boolean;
  unlockMode: boolean;
  hasDownstreamDependencies: boolean;
  isMasking: boolean;
}

// ============ SVG Icons ============

const SurgicalEditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const MagicEraserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
);

const SurgicalEditIconSmall = () => (
  <svg className="w-3 h-3 text-red-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const MagicEraserIconSmall = () => (
  <svg className="w-3 h-3 text-purple-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
);

// ============ ToolButton Sub-component ============

const ToolButton = ({ 
  isActive, 
  onClick, 
  icon, 
  label,
  color = "red" 
}: { 
  isActive: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  color?: "red" | "purple";
}) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`relative group w-10 h-10 flex items-center justify-center rounded-lg border transition-all duration-200 shadow-lg backdrop-blur-sm
      ${isActive 
        ? color === 'red' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-purple-500/10 border-purple-500 text-purple-400'
        : 'bg-white/80 border-slate-accent text-gray-700 hover:text-obsidian hover:border-slate-accent'
      }
    `}
    title={label}
  >
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    
    {isActive && (
      <span className={`absolute top-0 right-0 -mt-1 -mr-1 flex h-2.5 w-2.5`}>
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color === 'red' ? 'bg-red-500' : 'bg-purple-500'}`}></span>
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color === 'red' ? 'bg-red-500' : 'bg-purple-500'}`}></span>
      </span>
    )}
  </button>
);

// ============ Tool Mode Badge Sub-component ============

const ToolModeBadge = ({ activeTool }: { activeTool: EditTool }) => (
  <div className="absolute top-4 right-4 z-50 pointer-events-none select-none animate-in fade-in slide-in-from-top-1 duration-300">
    <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-200 flex items-center space-x-2 shadow-lg">
      {activeTool === 'eraser' ? <MagicEraserIconSmall /> : <SurgicalEditIconSmall />}
      <span className={`text-xs font-medium ${activeTool === 'eraser' ? 'text-purple-500' : 'text-red-500'}`}>
        {activeTool === 'eraser' ? 'Magic Eraser' : 'Surgical Edit'}
      </span>
    </div>
  </div>
);

// ============ Main Component ============

export function ToolsBar({
  activeTool,
  setActiveTool,
  isGenerating,
  hasAssets,
  isIterationAllowed,
  isViewLocked,
  unlockMode,
  hasDownstreamDependencies,
  isMasking,
}: ToolsBarProps) {
  const showToolsBar = !isGenerating && hasAssets;
  const showSurgicalEdit = isIterationAllowed && (!isViewLocked || unlockMode);
  const showMagicEraser = !hasDownstreamDependencies || unlockMode;

  return (
    <>
      {/* Tools Bar - positioned at right edge of image */}
      {showToolsBar && (
        <div className="absolute top-1/2 -translate-y-1/2 -right-2 flex flex-col gap-2 z-30 animate-in fade-in slide-in-from-right-4 duration-500" style={{marginRight: '15px'}}>
          {/* Surgical Edit */}
          {showSurgicalEdit && (
            <ToolButton 
              isActive={activeTool === 'surgical'} 
              onClick={() => setActiveTool(activeTool === 'surgical' ? 'none' : 'surgical')}
              icon={<SurgicalEditIcon />}
              label="Surgical Edit"
              color="red"
            />
          )}
          
          {/* Magic Eraser */}
          {showMagicEraser && (
            <ToolButton 
              isActive={activeTool === 'eraser'} 
              onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}
              icon={<MagicEraserIcon />}
              label="Magic Eraser"
              color="purple"
            />
          )}
        </div>
      )}

      {/* Tool Mode Overlay Badge */}
      {isMasking && <ToolModeBadge activeTool={activeTool} />}
    </>
  );
}

export default ToolsBar;

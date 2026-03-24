import { useState, useCallback } from 'react';
import { Camera, Shirt, Download, Home } from 'lucide-react';
import { useStudioStore } from '../stores/useStudioStore';
import { useSessionReset } from '../hooks/useSessionReset';
import {
  type StudioTool,
  STUDIO_TOOLS,
  getToolAvailability,
} from '../types';
import type { CanvasState } from '../types';
import { ToolSwitchConfirmDialog } from './ToolSwitchConfirmDialog';

/** Icon mapping for each tool */
const TOOL_ICONS: Record<StudioTool, React.ComponentType<{ className?: string }>> = {
  casting: Camera,
  wardrobe: Shirt,
  export: Download,
};

/** Human-readable labels for confirmation dialog */
const TOOL_LABELS: Record<string, string> = {
  casting: 'Casting Studio',
  wardrobe: 'Wardrobe Studio',
  export: 'Export Pack',
  home: 'Start',
};

interface ToolRailProps {
  canvas: CanvasState;
}

export function ToolRail({ canvas }: ToolRailProps) {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const { resetToLobby, resetAndSwitchTo } = useSessionReset();

  // Confirmation dialog state — pendingAction can be a tool ID or 'home'
  const [pendingAction, setPendingAction] = useState<StudioTool | 'home' | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  /**
   * Determine whether any active session exists that would be lost
   * by navigating away (Home or tool switch).
   */
  const hasActiveSession = canvas.hasModel || canvas.uploadedModelUrl !== null || canvas.castModelId !== null;

  const handleToolClick = useCallback((toolId: StudioTool) => {
    const availability = getToolAvailability(toolId, canvas);
    if (!availability.enabled) return;

    if (availability.needsConfirm) {
      setPendingAction(toolId);
      setConfirmMessage(availability.confirmMessage || 'This action will reset your current progress.');
    } else {
      setActiveTool(toolId);
    }
  }, [canvas, setActiveTool]);

  const handleHomeClick = useCallback(() => {
    if (hasActiveSession) {
      setPendingAction('home');
      setConfirmMessage('Returning to start will clear your current model and any unsaved wardrobe progress. This cannot be undone.');
    } else {
      setActiveTool(null);
    }
  }, [hasActiveSession, setActiveTool]);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;

    if (pendingAction === 'home') {
      // Full reset — clear everything, return to lobby
      resetToLobby();
    } else {
      // Tool switch — clear model + wardrobe, go to target tool
      resetAndSwitchTo(pendingAction);
    }

    setPendingAction(null);
    setConfirmMessage('');
  }, [pendingAction, resetToLobby, resetAndSwitchTo]);

  const handleCancel = useCallback(() => {
    setPendingAction(null);
    setConfirmMessage('');
  }, []);

  return (
    <>
      <div
        className="hidden lg:flex flex-col items-center py-3 gap-1 flex-shrink-0"
        style={{
          width: 48,
          background: '#fff',
          borderRight: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Home / Lobby button */}
        <button
          onClick={handleHomeClick}
          title="Back to start"
          className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group mb-1"
          style={{
            background: activeTool === null ? '#f5f3ef' : 'transparent',
            color: activeTool === null ? '#1a1a1a' : '#bbb',
          }}
          onMouseEnter={(e) => {
            if (activeTool !== null) {
              e.currentTarget.style.background = '#f5f3ef';
              e.currentTarget.style.color = '#1a1a1a';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTool !== null) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#bbb';
            }
          }}
        >
          <Home className="w-4 h-4" />
          <div
            className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
            style={{ background: '#1a1a1a', color: '#fff', fontSize: 10 }}
          >
            Start
          </div>
        </button>

        {/* Divider */}
        <div className="w-6 h-px mb-1" style={{ background: 'rgba(0,0,0,0.06)' }} />

        {/* Tool buttons */}
        {STUDIO_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          const availability = getToolAvailability(tool.id, canvas);
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              disabled={!availability.enabled}
              title={availability.tooltip}
              className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group"
              style={{
                background: isActive ? '#1a1a1a' : 'transparent',
                color: isActive
                  ? '#fff'
                  : availability.enabled
                    ? '#999'
                    : '#d4d4d4',
                cursor: availability.enabled ? 'pointer' : 'not-allowed',
                opacity: availability.enabled ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (!isActive && availability.enabled) {
                  e.currentTarget.style.background = '#f5f3ef';
                  e.currentTarget.style.color = '#1a1a1a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && availability.enabled) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#999';
                }
              }}
            >
              <Icon className="w-4 h-4" />

              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="absolute -left-px top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full transition-all duration-200"
                  style={{ background: '#1a1a1a' }}
                />
              )}

              {/* Tooltip on hover */}
              <div
                className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                style={{
                  background: '#1a1a1a',
                  color: '#fff',
                  fontSize: 10,
                }}
              >
                {availability.tooltip}
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirmation dialog — rendered via Portal at document.body */}
      <ToolSwitchConfirmDialog
        isOpen={pendingAction !== null}
        message={confirmMessage}
        targetToolLabel={pendingAction ? TOOL_LABELS[pendingAction] : ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

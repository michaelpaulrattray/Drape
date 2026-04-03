import { useState, useCallback, useEffect, useRef } from 'react';
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

/** Track which tools were previously enabled to detect unlock transitions */
type ToolEnabledMap = Record<StudioTool, boolean>;

interface ToolRailProps {
  canvas: CanvasState;
  /** Called when user clicks Wardrobe but model needs casting first */
  onWardrobeGate?: () => void;
}

export function ToolRail({ canvas, onWardrobeGate }: ToolRailProps) {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const { resetToLobby, resetAndSwitchTo } = useSessionReset();

  // Confirmation dialog state — pendingAction can be a tool ID or 'home'
  const [pendingAction, setPendingAction] = useState<StudioTool | 'home' | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  // Glow animation state — tracks which tools are currently glowing
  const [glowingTools, setGlowingTools] = useState<Set<StudioTool>>(new Set());
  const prevEnabledRef = useRef<ToolEnabledMap | null>(null);

  // Detect when any tool transitions from disabled → enabled
  useEffect(() => {
    const currentEnabled: ToolEnabledMap = {} as ToolEnabledMap;
    for (const tool of STUDIO_TOOLS) {
      currentEnabled[tool.id] = getToolAvailability(tool.id, canvas).enabled;
    }

    const prev = prevEnabledRef.current;
    if (prev) {
      const newlyUnlocked: StudioTool[] = [];
      for (const tool of STUDIO_TOOLS) {
        if (!prev[tool.id] && currentEnabled[tool.id] && activeTool !== tool.id) {
          newlyUnlocked.push(tool.id);
        }
      }
      if (newlyUnlocked.length > 0) {
        setGlowingTools((s) => {
          const next = new Set(s);
          newlyUnlocked.forEach((id) => next.add(id));
          return next;
        });
        // Auto-clear glow after 3 breathing cycles (~4.5s)
        const timer = setTimeout(() => {
          setGlowingTools((s) => {
            const next = new Set(s);
            newlyUnlocked.forEach((id) => next.delete(id));
            return next;
          });
        }, 4500);
        return () => clearTimeout(timer);
      }
    }

    prevEnabledRef.current = currentEnabled;
  }, [canvas, activeTool]);

  // Clear glow when user clicks a glowing tool
  const clearGlow = useCallback((toolId: StudioTool) => {
    if (glowingTools.has(toolId)) {
      setGlowingTools((s) => {
        const next = new Set(s);
        next.delete(toolId);
        return next;
      });
    }
  }, [glowingTools]);

  /**
   * Determine whether any active session exists that would be lost
   * by navigating away (Home or tool switch).
   */
  const hasActiveSession = canvas.hasModel || canvas.uploadedModelUrl !== null || canvas.castModelId !== null;

  const handleToolClick = useCallback((toolId: StudioTool) => {
    const availability = getToolAvailability(toolId, canvas);
    if (!availability.enabled) return;

    clearGlow(toolId);

    // Intercept wardrobe click for draft models — show cast modal
    if (toolId === 'wardrobe' && onWardrobeGate && !canvas.isMinted && canvas.modelSource === 'cast') {
      onWardrobeGate();
      return;
    }

    if (availability.needsConfirm) {
      setPendingAction(toolId);
      setConfirmMessage(availability.confirmMessage || 'This action will reset your current progress.');
    } else {
      setActiveTool(toolId);
    }
  }, [canvas, setActiveTool, clearGlow]);

  const handleHomeClick = useCallback(() => {
    // Session is auto-saved to DB — safe to navigate without confirmation.
    // The lobby's "Continue Session" card will let the user resume.
    setActiveTool(null);
  }, [setActiveTool]);

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
            background: activeTool === null ? '#F5F3F0' : 'transparent',
            color: activeTool === null ? '#1a1a1a' : '#bbb',
          }}
          onMouseEnter={(e) => {
            if (activeTool !== null) {
              e.currentTarget.style.background = '#F5F3F0';
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
            style={{ background: '#1a1a1a', color: '#fff', fontSize: 12 }}
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
          const isGlowing = glowingTools.has(tool.id);

          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              disabled={!availability.enabled}
              title={availability.tooltip}
              className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group"
              style={{
                background: isActive
                  ? '#1a1a1a'
                  : isGlowing
                    ? '#F5F3F0'
                    : 'transparent',
                color: isActive
                  ? '#fff'
                  : isGlowing
                    ? '#1a1a1a'
                    : availability.enabled
                      ? '#999'
                      : '#d4d4d4',
                cursor: availability.enabled ? 'pointer' : 'default',
                opacity: availability.enabled ? 1 : 0.5,
                animation: isGlowing ? 'toolGlow 1.5s ease-in-out 3' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive && availability.enabled) {
                  e.currentTarget.style.background = '#F5F3F0';
                  e.currentTarget.style.color = '#1a1a1a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && availability.enabled && !isGlowing) {
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
                  fontSize: 12,
                }}
              >
                {availability.tooltip}
              </div>
            </button>
          );
        })}
      </div>

      {/* Unlock glow animation keyframes — soft breathing box-shadow */}
      <style>{`
        @keyframes toolGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(26, 26, 26, 0);
          }
          50% {
            box-shadow: 0 0 10px 2px rgba(26, 26, 26, 0.15);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(26, 26, 26, 0);
          }
        }
      `}</style>

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

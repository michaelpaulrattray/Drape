/**
 * CanvasToolbar — Floating tool pill pinned bottom-center of canvas.
 *
 * Matches the Luma Labs toolbar pattern: wide capsule pill, large white
 * circle highlight on the active tool, generous icon spacing, no dividers.
 * Rendered in white frosted glass to match FormaStudio's light theme.
 *
 * Icons use integer pixel sizes and shapeRendering="geometricPrecision"
 * for crisp rendering at all zoom levels.
 */
import { useCallback } from 'react';
import {
  MousePointer2,
  ScanFace,
  Shirt,
  Upload,
  StickyNote,
  ImagePlus,
  Frame,
  type LucideIcon,
} from 'lucide-react';

export type CanvasToolId = 'select' | 'cast' | 'wardrobe' | 'reference' | 'upload' | 'note' | 'frame';

type ToolDef = {
  id: CanvasToolId;
  icon: LucideIcon;
  label: string;
};

const tools: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'cast', icon: ScanFace, label: 'Cast Model' },
  { id: 'wardrobe', icon: Shirt, label: 'Style Outfit' },
  { id: 'reference', icon: ImagePlus, label: 'Add Reference' },
  { id: 'upload', icon: Upload, label: 'Upload Media' },
  { id: 'note', icon: StickyNote, label: 'Add Note' },
  { id: 'frame', icon: Frame, label: 'Add Frame' },
];

type CanvasToolbarProps = {
  activeTool: CanvasToolId;
  onToolSelect: (tool: CanvasToolId) => void;
};

/** Shared SVG props for crisp icon rendering */
const crispSvgProps = {
  shapeRendering: 'geometricPrecision' as const,
  style: { willChange: 'auto' as const },
};

export function CanvasToolbar({ activeTool, onToolSelect }: CanvasToolbarProps) {
  const handleClick = useCallback(
    (toolId: CanvasToolId) => {
      onToolSelect(toolId);
    },
    [onToolSelect],
  );

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center select-none"
      style={{
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 26,
        border: '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        height: 52,
        padding: '0 6px',
        gap: 2,
      }}
    >
      {tools.map((tool, index) => {
        const isActive = activeTool === tool.id;
        const Icon = tool.icon;
        // Add divider before Note/Frame group (after Upload)
        const showDivider = index === 5; // before 'note'

        return (
          <div key={tool.id} className="flex items-center" style={{ gap: 0 }}>
            {showDivider && (
              <div
                style={{
                  width: 1,
                  height: 24,
                  background: 'rgba(0, 0, 0, 0.06)',
                  margin: '0 4px',
                  flexShrink: 0,
                }}
              />
            )}
            <button
              onClick={() => handleClick(tool.id)}
              className="relative flex items-center justify-center"
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                border: 'none',
                background: isActive ? '#ffffff' : 'transparent',
                boxShadow: isActive
                  ? '0 1px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04)'
                  : 'none',
                color: isActive ? '#1a1a1a' : '#71716a',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#3a3a3a';
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#71716a';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              title={tool.label}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.75} {...crispSvgProps} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

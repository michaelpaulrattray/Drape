/**
 * CanvasToolbar — Floating tool pill pinned bottom-center of canvas.
 *
 * Luma-style icon toolbar for selecting tools.
 * Each icon triggers a tool action (open panel, etc.).
 */
import { useCallback } from 'react';
import {
  MousePointer2,
  ScanFace,
  Shirt,
  Upload,
  StickyNote,
  ImagePlus,
  type LucideIcon,
} from 'lucide-react';

export type CanvasToolId = 'select' | 'cast' | 'wardrobe' | 'reference' | 'upload' | 'note';

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
];

type CanvasToolbarProps = {
  activeTool: CanvasToolId;
  onToolSelect: (tool: CanvasToolId) => void;
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
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 select-none"
      style={{
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        height: 44,
        padding: '0 4px',
      }}
    >
      {tools.map((tool, index) => {
        const isActive = activeTool === tool.id;
        const Icon = tool.icon;
        const isFirstGroup = index === 0;
        const showDivider = index === 1; // divider after Select

        return (
          <div key={tool.id} className="flex items-center">
            {showDivider && (
              <div
                style={{
                  width: 1,
                  height: 20,
                  background: 'rgba(0, 0, 0, 0.08)',
                  marginLeft: 2,
                  marginRight: 2,
                  flexShrink: 0,
                }}
              />
            )}
            <button
              onClick={() => handleClick(tool.id)}
              className="relative flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: isActive ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                color: isActive ? '#1a1a1a' : '#71716A',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.color = '#1a1a1a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#71716A';
                }
              }}
              title={tool.label}
            >
              <Icon size={18} strokeWidth={isFirstGroup ? 2 : 1.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

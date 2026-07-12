/**
 * NoteNode — editable note on the canvas, in the canvas language (R6 design
 * pass). Double-click to edit, click away to save.
 *
 * RULING R-6 (VC-R6b, in situ): the yellow's fate. Two variants behind ONE
 * constant — flip NOTE_SURFACE to compare live:
 *  - 'monochrome': plain surface card — D-7's position (silhouette
 *    distinguishes types; a bare text card reads as a note).
 *  - 'paper': one muted paper tint as the single sanctioned note surface
 *    (would need a §2.1 sentence if ruled in).
 */
import { memo, useState, useEffect, useRef } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';

const NOTE_SURFACE: 'monochrome' | 'paper' = 'monochrome';
const NOTE_BG = NOTE_SURFACE === 'paper' ? '#FBF8EF' : 'var(--color-canvas-surface)';

/* ── Types ────────────────────────────────────────────────── */

export type NoteNodeData = {
  itemId: number;
  label: string | null;
  onRename?: (itemId: number, label: string) => void;
  onDelete?: (itemId: number) => void;
  onResize?: (itemId: number, width: number, height: number) => void;
};

export type NoteFlowNode = Node<NoteNodeData, 'note'>;

/* ── Component ────────────────────────────────────────────── */

function NoteNodeInner({ data, selected }: NodeProps<NoteFlowNode>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(data.label ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for rename trigger from context menu
  useEffect(() => {
    function handleRenameEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemId === data.itemId) {
        setEditText(data.label ?? '');
        setIsEditing(true);
      }
    }
    window.addEventListener('board-rename-node', handleRenameEvent);
    return () => window.removeEventListener('board-rename-node', handleRenameEvent);
  }, [data.itemId, data.label]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        const len = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(len, len);
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  const handleSave = () => {
    if (data.onRename && editText.trim()) {
      data.onRename(data.itemId, editText.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Resize handles */}
      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={80}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: 'var(--color-canvas-ink)',
          border: '2px solid var(--color-canvas-surface)',
        }}
        lineStyle={{
          borderColor: 'transparent',
          borderWidth: 1,
        }}
        onResizeEnd={(_event, params) => {
          data.onResize?.(data.itemId, params.width, params.height);
        }}
      />

      {/* Note card */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'var(--radius-canvas-md)',
          background: NOTE_BG,
          // Selection = 1px ink, resting = hairline — the CanvasNodeShell
          // language (no shadows, no gold)
          border: selected
            ? '1px solid var(--color-canvas-ink)'
            : '0.5px solid var(--color-canvas-border)',
          overflow: 'hidden',
          transition: 'border-color 150ms ease',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Note content */}
        <div
          style={{
            flex: 1,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column' as const,
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditText(data.label ?? '');
                }
                // Ctrl/Cmd+Enter to save
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSave();
                }
              }}
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--color-canvas-ink)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                padding: 0,
              }}
              placeholder="Write a note..."
            />
          ) : (
            <div
              onDoubleClick={() => {
                setEditText(data.label ?? '');
                setIsEditing(true);
              }}
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 1.6,
                color: data.label ? 'var(--color-canvas-ink)' : 'var(--color-canvas-ink-faint)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                cursor: 'text',
                userSelect: 'none',
              }}
            >
              {data.label || 'Double-click to edit...'}
            </div>
          )}
        </div>

        {/* Quiet type label — sentence case, no letter-spacing (§13.9) */}
        <div
          style={{
            padding: '4px 12px 6px',
            fontSize: 10,
            color: 'var(--color-canvas-ink-faint)',
            fontWeight: 500,
          }}
        >
          Note
        </div>
      </div>
    </div>
  );
}

export const NoteNode = memo(NoteNodeInner);

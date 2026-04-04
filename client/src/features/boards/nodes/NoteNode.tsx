/**
 * NoteNode — Editable sticky note on the canvas.
 *
 * Renders as a warm-tinted card with editable text content.
 * Double-click to edit, click away to save.
 */
import { memo, useState, useEffect, useRef } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';

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
          background: '#b8860b',
          border: '2px solid #fff',
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
          borderRadius: 8,
          background: '#fffde7',
          border: selected
            ? '2px solid #d4a017'
            : '1px solid rgba(180,160,100,0.2)',
          boxShadow: selected
            ? '0 4px 16px rgba(180,160,100,0.2)'
            : '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          transition: 'box-shadow 150ms ease, border-color 150ms ease',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Note content */}
        <div
          style={{
            flex: 1,
            padding: '10px 12px',
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
                lineHeight: 1.5,
                color: '#4a4a4a',
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
                lineHeight: 1.5,
                color: data.label ? '#4a4a4a' : '#aaa',
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

        {/* Subtle footer */}
        <div
          style={{
            padding: '4px 12px 6px',
            fontSize: 9,
            color: '#bbb',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
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

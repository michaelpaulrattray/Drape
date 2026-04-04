/**
 * FrameNode — Resizable labeled container for grouping images on the canvas.
 *
 * Renders as a dashed-border rectangle with a label at the top.
 * Other nodes can be dragged inside to visually group them.
 */
import { memo, useState, useEffect, useRef } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';

/* ── Types ────────────────────────────────────────────────── */

export type FrameNodeData = {
  itemId: number;
  label: string | null;
  onRename?: (itemId: number, label: string) => void;
  onDelete?: (itemId: number) => void;
  onResize?: (itemId: number, width: number, height: number) => void;
};

export type FrameFlowNode = Node<FrameNodeData, 'frame'>;

/* ── Component ────────────────────────────────────────────── */

function FrameNodeInner({ data, selected }: NodeProps<FrameFlowNode>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label ?? 'Frame');
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for rename trigger from context menu
  useEffect(() => {
    function handleRenameEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemId === data.itemId) {
        setEditLabel(data.label ?? 'Frame');
        setIsEditing(true);
      }
    }
    window.addEventListener('board-rename-node', handleRenameEvent);
    return () => window.removeEventListener('board-rename-node', handleRenameEvent);
  }, [data.itemId, data.label]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  const handleRename = () => {
    if (data.onRename && editLabel.trim()) {
      data.onRename(data.itemId, editLabel.trim());
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
        minWidth={200}
        minHeight={150}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: '#666',
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

      {/* Frame container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          border: selected
            ? '2px solid #888'
            : '2px dashed rgba(0,0,0,0.15)',
          background: selected
            ? 'rgba(0,0,0,0.03)'
            : 'rgba(0,0,0,0.015)',
          transition: 'border-color 150ms ease, background 150ms ease',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Label header */}
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderBottom: '1px dashed rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              autoFocus
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditLabel(data.label ?? 'Frame');
                }
              }}
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 600,
                color: '#555',
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 4,
                outline: 'none',
                padding: '2px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            />
          ) : (
            <span
              onDoubleClick={() => {
                setEditLabel(data.label ?? 'Frame');
                setIsEditing(true);
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'text',
                userSelect: 'none',
              }}
              title="Double-click to rename"
            >
              {data.label ?? 'Frame'}
            </span>
          )}
        </div>

        {/* Content area — nodes can be placed inside */}
        <div style={{ flex: 1 }} />
      </div>
    </div>
  );
}

export const FrameNode = memo(FrameNodeInner);

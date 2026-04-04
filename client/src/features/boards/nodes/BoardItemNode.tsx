/**
 * BoardItemNode — Shared card shell for all canvas node types.
 *
 * Renders a draggable card with image, label, type badge, and selection ring.
 * Used as the single custom node type for React Flow.
 * 3-dot menu removed — right-click context menu replaces it.
 * Listens for 'board-rename-node' custom event to trigger inline rename.
 */
import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  ScanFace,
  Shirt,
  Image,
  Layers,
  StickyNote,
  GitBranch,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────── */

export type BoardItemNodeData = {
  itemId: number;
  type: 'model' | 'garment' | 'vto_result' | 'reference' | 'iteration' | 'note';
  label: string | null;
  imageUrl: string | null;
  width: number;
  height: number;
  metadata: Record<string, unknown> | null;
  onDelete?: (itemId: number) => void;
  onRename?: (itemId: number, label: string) => void;
};

export type BoardItemFlowNode = Node<BoardItemNodeData, 'boardItem'>;

/* ── Icon map ─────────────────────────────────────────────── */

const TYPE_ICONS: Record<BoardItemNodeData['type'], typeof ScanFace> = {
  model: ScanFace,
  garment: Shirt,
  vto_result: Layers,
  reference: Image,
  iteration: GitBranch,
  note: StickyNote,
};

const TYPE_LABELS: Record<BoardItemNodeData['type'], string> = {
  model: 'Model',
  garment: 'Garment',
  vto_result: 'Look',
  reference: 'Reference',
  iteration: 'Iteration',
  note: 'Note',
};

/* ── Component ────────────────────────────────────────────── */

function BoardItemNodeInner({ data, selected }: NodeProps<BoardItemFlowNode>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = TYPE_ICONS[data.type];
  const typeLabel = TYPE_LABELS[data.type];
  const isNote = data.type === 'note';

  // Listen for rename trigger from context menu
  useEffect(() => {
    function handleRenameEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemId === data.itemId) {
        setEditLabel(data.label ?? '');
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
      className="group relative"
      style={{
        width: data.width,
        minHeight: isNote ? 120 : undefined,
      }}
    >
      {/* Connection handles (hidden but functional) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 8, height: 8 }}
      />

      {/* Card */}
      <div
        style={{
          background: isNote ? '#fffbeb' : '#fff',
          borderRadius: 12,
          border: selected
            ? '2px solid #1a1a1a'
            : '1px solid rgba(0,0,0,0.08)',
          boxShadow: selected
            ? '0 4px 20px rgba(0,0,0,0.12)'
            : '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          transition: 'box-shadow 150ms ease, border-color 150ms ease',
          cursor: 'grab',
        }}
      >
        {/* Image area */}
        {data.imageUrl && !isNote && (
          <div
            style={{
              width: '100%',
              aspectRatio: '3/4',
              background: '#f5f3ef',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <img
              src={data.imageUrl}
              alt={data.label ?? typeLabel}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* No image placeholder */}
        {!data.imageUrl && !isNote && (
          <div
            style={{
              width: '100%',
              aspectRatio: '3/4',
              background: '#f5f3ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={32} strokeWidth={1.2} color="#bbb" />
          </div>
        )}

        {/* Note content */}
        {isNote && (
          <div style={{ padding: '12px 14px', minHeight: 80 }}>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: '#4a4a4a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {data.label ?? 'Empty note'}
            </p>
          </div>
        )}

        {/* Footer */}
        {!isNote && (
          <div
            style={{
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {/* Type badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 500,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              <Icon size={12} strokeWidth={1.5} />
              {typeLabel}
            </span>

            {/* Label — editable or static */}
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
                    setEditLabel(data.label ?? '');
                  }
                }}
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#1a1a1a',
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 4,
                  outline: 'none',
                  padding: '2px 6px',
                  minWidth: 0,
                }}
              />
            ) : (
              <span
                onDoubleClick={() => {
                  setEditLabel(data.label ?? '');
                  setIsEditing(true);
                }}
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#1a1a1a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'text',
                }}
                title="Double-click to rename"
              >
                {data.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const BoardItemNode = memo(BoardItemNodeInner);

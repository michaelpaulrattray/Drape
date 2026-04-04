/**
 * BoardItemNode — Shared card shell for all canvas node types.
 *
 * Renders a draggable card with image, label, type badge, and selection ring.
 * Used as the single custom node type for React Flow.
 */
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  ScanFace,
  Shirt,
  Image,
  Layers,
  StickyNote,
  GitBranch,
  MoreHorizontal,
  Trash2,
  Pencil,
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
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label ?? '');

  const Icon = TYPE_ICONS[data.type];
  const typeLabel = TYPE_LABELS[data.type];
  const isNote = data.type === 'note';

  const handleRename = () => {
    if (data.onRename && editLabel.trim()) {
      data.onRename(data.itemId, editLabel.trim());
    }
    setIsEditing(false);
    setShowMenu(false);
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

            {/* Label */}
            {isEditing ? (
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
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
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: 0,
                  minWidth: 0,
                }}
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#1a1a1a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {data.label}
              </span>
            )}

            {/* Context menu trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              style={{
                opacity: 0,
                transition: 'opacity 150ms',
                background: 'none',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: '#888',
                flexShrink: 0,
              }}
              className="group-hover:!opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 4,
            marginTop: 4,
            background: '#fff',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            padding: 4,
            zIndex: 50,
            minWidth: 120,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setShowMenu(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              color: '#444',
              background: 'none',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <Pencil size={12} />
            Rename
          </button>
          {data.onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.(data.itemId);
                setShowMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                color: '#dc2626',
                background: 'none',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220,38,38,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const BoardItemNode = memo(BoardItemNodeInner);

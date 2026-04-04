/**
 * BoardItemNode — Shared card shell for all canvas node types.
 *
 * Renders a draggable card with image, label, type badge, and selection ring.
 * Used as the single custom node type for React Flow.
 * 3-dot menu removed — right-click context menu replaces it.
 * Listens for 'board-rename-node' custom event to trigger inline rename.
 */
import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import {
  ScanFace,
  Shirt,
  Image,
  Layers,
  StickyNote,
  GitBranch,
} from 'lucide-react';
import { VersionHistoryBadge } from '../components/VersionHistoryBadge';

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
  onVersionHistory?: (itemId: number) => void;
  onResize?: (itemId: number, width: number, height: number) => void;
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
  const meta = data.metadata as Record<string, unknown> | null;
  const isGenerating = !!meta?.isGenerating && !data.imageUrl;
  const generatingStep = (meta?.generatingStep as string) || 'Generating...';

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
        width: '100%',
        height: '100%',
        minHeight: isNote ? 120 : undefined,
      }}
    >
      {/* Resize handle — visible on selection */}
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={isNote ? 80 : 160}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: '#1a1a1a',
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
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Image area */}
        {data.imageUrl && !isNote && (
          <div
            style={{
              width: '100%',
              flex: 1,
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
            {/* Version history badge — layers icon */}
            <VersionHistoryBadge
              itemId={data.itemId}
              onClick={() => data.onVersionHistory?.(data.itemId)}
            />
          </div>
        )}

        {/* No image placeholder / generating skeleton */}
        {!data.imageUrl && !isNote && (
          <div
            style={{
              width: '100%',
              flex: 1,
              background: isGenerating ? 'linear-gradient(110deg, #f5f3ef 30%, #ede9e3 50%, #f5f3ef 70%)' : '#f5f3ef',
              backgroundSize: isGenerating ? '200% 100%' : undefined,
              animation: isGenerating ? 'shimmer 1.5s ease-in-out infinite' : undefined,
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon size={32} strokeWidth={1.2} color={isGenerating ? '#999' : '#bbb'} />
            {isGenerating && (
              <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: '0.02em', textAlign: 'center', maxWidth: '80%' }}>
                {generatingStep}
              </span>
            )}
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

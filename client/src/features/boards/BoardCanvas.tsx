/**
 * BoardCanvas — Infinite canvas powered by React Flow.
 *
 * Renders board items as draggable cards with pan/zoom/drag.
 * Converts board_items DB records into React Flow nodes.
 *
 * Drag smoothness: React Flow manages node positions natively during drag.
 * We only sync external item changes (additions, deletions, image/label updates)
 * without overwriting positions that React Flow is actively managing.
 *
 * Background: CSS radial-gradient dots matching the original StudioCanvas.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type Viewport,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BoardItemNode, type BoardItemNodeData, type BoardItemFlowNode } from './nodes/BoardItemNode';

/* ── Types ────────────────────────────────────────────────── */

export type BoardItemRecord = {
  id: number;
  type: 'model' | 'garment' | 'vto_result' | 'reference' | 'iteration' | 'note';
  label: string | null;
  imageUrl: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  metadata: Record<string, unknown> | null;
};

type BoardCanvasProps = {
  items: BoardItemRecord[];
  viewport?: { x: number; y: number; zoom: number };
  onItemMove?: (itemId: number, x: number, y: number) => void;
  onItemDelete?: (itemId: number) => void;
  onItemRename?: (itemId: number, label: string) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onNodeSelect?: (itemId: number | null) => void;
  onNodeDoubleClick?: (itemId: number) => void;
  className?: string;
};

/* ── Node type registry (must be stable ref) ──────────────── */

const nodeTypes: NodeTypes = {
  boardItem: BoardItemNode,
};

/* ── Helpers ──────────────────────────────────────────────── */

function itemToNode(
  item: BoardItemRecord,
  onDelete?: (id: number) => void,
  onRename?: (id: number, label: string) => void,
): BoardItemFlowNode {
  return {
    id: `item-${item.id}`,
    type: 'boardItem',
    position: { x: item.positionX, y: item.positionY },
    zIndex: item.zIndex,
    data: {
      itemId: item.id,
      type: item.type,
      label: item.label,
      imageUrl: item.imageUrl,
      width: item.width,
      height: item.height,
      metadata: item.metadata,
      onDelete,
      onRename,
    },
  };
}

/** Build a fingerprint of item data (excluding position) for change detection */
function itemFingerprint(item: BoardItemRecord): string {
  return `${item.id}|${item.type}|${item.label ?? ''}|${item.imageUrl ?? ''}|${item.width}|${item.height}|${item.zIndex}`;
}

/* ── Component ────────────────────────────────────────────── */

export function BoardCanvas({
  items,
  viewport,
  onItemMove,
  onItemDelete,
  onItemRename,
  onViewportChange,
  onNodeSelect,
  onNodeDoubleClick,
  className,
}: BoardCanvasProps) {
  const rfInstance = useRef<ReactFlowInstance<BoardItemFlowNode> | null>(null);
  const prevFingerprintRef = useRef<string>('');
  const isDraggingRef = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<BoardItemFlowNode>([]);
  const [edges] = useEdgesState<Edge>([]);

  /**
   * Smart sync: only update React Flow nodes when the item LIST actually changes
   * (additions, deletions, image/label/type updates) — NOT on position-only changes
   * that come back from the server after a drag-end save.
   *
   * This prevents the "snap back" jank where React Flow's smooth drag position
   * gets overwritten by the server's rounded position.
   */
  useEffect(() => {
    // Build a fingerprint that excludes position
    const currentFingerprint = items.map(itemFingerprint).join('::');

    // Skip if nothing meaningful changed (position-only updates from drag save)
    if (currentFingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = currentFingerprint;

    // Don't reset nodes while user is actively dragging
    if (isDraggingRef.current) return;

    const nextNodes = items.map((item) =>
      itemToNode(item, onItemDelete, onItemRename),
    );
    setNodes(nextNodes);
  }, [items, onItemDelete, onItemRename, setNodes]);

  // Handle node drag + position persistence
  const handleNodesChange: OnNodesChange<BoardItemFlowNode> = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === 'position') {
          if (change.dragging) {
            isDraggingRef.current = true;
          } else if (!change.dragging && change.position) {
            isDraggingRef.current = false;
            const itemId = parseInt(change.id.replace('item-', ''), 10);
            if (!isNaN(itemId) && onItemMove) {
              onItemMove(itemId, Math.round(change.position.x), Math.round(change.position.y));
            }
          }
        }
      }
    },
    [onNodesChange, onItemMove],
  );

  // Handle node double-click
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!onNodeDoubleClick) return;
      const itemId = parseInt(node.id.replace('item-', ''), 10);
      if (!isNaN(itemId)) onNodeDoubleClick(itemId);
    },
    [onNodeDoubleClick],
  );

  // Handle selection
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      if (!onNodeSelect) return;
      if (selectedNodes.length === 1) {
        const itemId = parseInt(selectedNodes[0].id.replace('item-', ''), 10);
        onNodeSelect(isNaN(itemId) ? null : itemId);
      } else {
        onNodeSelect(null);
      }
    },
    [onNodeSelect],
  );

  // Handle viewport changes (debounced save)
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleMoveEnd = useCallback(
    (_event: unknown, vp: Viewport) => {
      if (!onViewportChange) return;
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
      viewportTimer.current = setTimeout(() => onViewportChange(vp), 500);
    },
    [onViewportChange],
  );

  const defaultViewport = useMemo(
    () => viewport ?? { x: 0, y: 0, zoom: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // Only use initial viewport
  );

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onMoveEnd={handleMoveEnd}
        onInit={(instance) => {
          rfInstance.current = instance as ReactFlowInstance<BoardItemFlowNode>;
        }}
        defaultViewport={defaultViewport}
        fitView={items.length > 0 && !viewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={3}
        panOnScroll
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
        style={{
          '--xy-background-color': '#f7f7f7',
          '--xy-background-color-props': '#f7f7f7',
        } as React.CSSProperties}
      >
        <Background
          variant={"dots" as any}
          gap={20}
          size={1.3}
          color="#d0d0d0"
        />
        <Controls
          showInteractive={false}
          style={{
            background: '#fff',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        />
      </ReactFlow>
    </div>
  );
}

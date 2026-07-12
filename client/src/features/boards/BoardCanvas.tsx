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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  SelectionMode,
  useNodesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type Viewport,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BoardItemNode, type BoardItemNodeData, type BoardItemFlowNode } from './nodes/BoardItemNode';
import { FrameNode, type FrameFlowNode } from './nodes/FrameNode';
import { NoteNode, type NoteFlowNode } from './nodes/NoteNode';
import { CastNode, type CastFlowNode, type CastNodeData } from './canvas/nodes/CastNode';
import { ImageNode, type ImageFlowNode } from './canvas/nodes/ImageNode';
import { CanvasZoomContext, useLiveCanvasZoom } from './canvas/canvasZoom';
import { GroupSelectionOverlay } from './canvas/GroupSelectionOverlay';
import type { BoardItemCanvasMetadata, Provenance } from '@shared/boardTypes';

/* ── Types ────────────────────────────────────────────────── */

export type BoardItemRecord = {
  id: number;
  type: 'model' | 'garment' | 'vto_result' | 'reference' | 'iteration' | 'note' | 'frame';
  kind?: 'image' | 'cast_config' | 'wardrobe_config' | 'note' | 'frame' | 'video' | null;
  label: string | null;
  imageUrl: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  metadata: Record<string, unknown> | null;
  sourceModelId?: number | null;
  sourceAssetId?: number | null;
};

type BoardCanvasProps = {
  items: BoardItemRecord[];
  viewport?: { x: number; y: number; zoom: number };
  onItemMove?: (itemId: number, x: number, y: number) => void;
  onItemResize?: (itemId: number, width: number, height: number) => void;
  onItemDelete?: (itemId: number) => void;
  onItemRename?: (itemId: number, label: string) => void;
  onVersionHistory?: (itemId: number) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onNodeSelect?: (itemId: number | null) => void;
  onNodeDoubleClick?: (itemId: number) => void;
  onNodeContextMenu?: (itemId: number, event: React.MouseEvent) => void;
  onPaneClick?: () => void;
  /** Called with flow-coordinates when the empty pane is clicked */
  onPaneClickWithPosition?: (flowPos: { x: number; y: number }) => void;
  className?: string;
  /** Rendered inside ReactFlow — has access to useReactFlow() context */
  children?: ReactNode;
  /** Expose a way for parent to read viewport center */
  onViewportCenterRef?: (getter: () => { x: number; y: number }) => void;
  /** When true, sets cursor to crosshair on the canvas pane */
  crosshairCursor?: boolean;
  /** Expose a way for parent to smoothly scroll to a node by item ID */
  onScrollToNodeRef?: (scroller: (itemId: number) => void) => void;
  /** Board id — threaded into node data for boardOps calls */
  boardId: number;
  /** Expose a way for parent to select a node (auto-select on drop) */
  onSelectNodeRef?: (selector: (itemId: number) => void) => void;
  /** Expose screen→flow coordinate conversion (right-click placement, VC2 #4) */
  onScreenToFlowRef?: (fn: (screen: { x: number; y: number }) => { x: number; y: number }) => void;
  /** R4 keyboard model (Decision 7): full multi-selection, reported alongside
   *  the legacy single-select callback */
  onSelectionIdsChange?: (itemIds: number[]) => void;
  /** Nudge every selected node by (dx, dy); returns what moved with prior
   *  positions (the caller batches undo entries + persistence) */
  onNudgeSelectionRef?: (
    nudger: (dx: number, dy: number) => Array<{ itemId: number; x: number; y: number; prevX: number; prevY: number }>,
  ) => void;
  /** Cmd+A */
  onSelectAllRef?: (selectAll: () => void) => void;
  /** Esc bottom layer */
  onClearSelectionRef?: (clear: () => void) => void;
  /** Move-undo restore: set node positions imperatively */
  onSetPositionsRef?: (setter: (moves: Array<{ itemId: number; x: number; y: number }>) => void) => void;
  /** VC-R4 ruling R1: 'select' = drag-on-empty marquees (Space or middle/right
   *  drag pans); 'hand' = drag pans. */
  pointerTool?: 'select' | 'hand';
  /** R5 lineage edges (D-50.5 lineage class only, endpoints alive) — rendered
   *  ambient per DS §8; full opacity when either endpoint is selected. */
  lineageEdges?: Array<{ id: number; source: number; target: number; relation: string }>;
  /** D-50 group actions (Focus is handled internally via fitView). */
  onGroupAction?: (action: 'duplicate' | 'download' | 'delete', itemIds: number[]) => void;
  /** D-50.1 parity surface: right-click on the multi-selection. */
  onSelectionContextMenu?: (itemIds: number[], position: { x: number; y: number }) => void;
};

/* ── Node type registry (must be stable ref) ──────────────── */

const nodeTypes: NodeTypes = {
  boardItem: BoardItemNode,
  frame: FrameNode,
  note: NoteNode,
  cast: CastNode,
  image: ImageNode,
};

/* ── Helpers ──────────────────────────────────────────────── */

type AnyFlowNode = BoardItemFlowNode | FrameFlowNode | NoteFlowNode | CastFlowNode | ImageFlowNode;

const CAST_PROVENANCE_TYPES = new Set(['cast_root', 'cast_view', 'library_cast']);

function itemToNode(
  item: BoardItemRecord,
  boardId: number,
  onDelete?: (id: number) => void,
  onRename?: (id: number, label: string) => void,
  onVersionHistory?: (id: number) => void,
  onResize?: (id: number, width: number, height: number) => void,
): AnyFlowNode {
  const meta = (item.metadata ?? {}) as BoardItemCanvasMetadata;
  const provenance = meta.provenance ?? null;

  // New canvas node types (kind-driven; CANVAS_FOUNDATIONS Decision 1).
  // cast_config = freshly-dropped empty cast; image + cast provenance = cast output.
  if (item.kind === 'cast_config' || (provenance && CAST_PROVENANCE_TYPES.has(provenance.type))) {
    return {
      id: `item-${item.id}`,
      type: 'cast',
      position: { x: item.positionX, y: item.positionY },
      zIndex: item.zIndex,
      data: {
        itemId: item.id,
        boardId,
        provenance: provenance as CastNodeData['provenance'],
        label: item.label,
        imageUrl: item.imageUrl,
        userPrompt: meta.userPrompt,
        attributes: meta.attributes,
        status: meta.status ?? null,
        pinned: meta.pinned === true,
        version: meta.version ?? 1, // stamped by landing ops (R3 fix — never hardcode)
      } satisfies CastNodeData,
    } as CastFlowNode;
  }

  if (item.kind === 'image') {
    return {
      id: `item-${item.id}`,
      type: 'image',
      position: { x: item.positionX, y: item.positionY },
      zIndex: item.zIndex,
      data: {
        itemId: item.id,
        boardId,
        provenance,
        label: item.label,
        imageUrl: item.imageUrl,
        width: item.width,
        height: item.height,
      },
    } as ImageFlowNode;
  }
  // Frame nodes
  if (item.type === 'frame') {
    return {
      id: `item-${item.id}`,
      type: 'frame',
      position: { x: item.positionX, y: item.positionY },
      zIndex: item.zIndex,
      style: { width: item.width, height: item.height },
      data: {
        itemId: item.id,
        label: item.label,
        onRename,
        onDelete,
        onResize,
      },
    } as FrameFlowNode;
  }

  // Note nodes
  if (item.type === 'note') {
    return {
      id: `item-${item.id}`,
      type: 'note',
      position: { x: item.positionX, y: item.positionY },
      zIndex: item.zIndex,
      style: { width: item.width, height: item.height },
      data: {
        itemId: item.id,
        label: item.label,
        onRename,
        onDelete,
        onResize,
      },
    } as NoteFlowNode;
  }

  // Default: image-based nodes (model, garment, vto_result, reference, iteration)
  return {
    id: `item-${item.id}`,
    type: 'boardItem',
    position: { x: item.positionX, y: item.positionY },
    zIndex: item.zIndex,
    style: { width: item.width, height: item.height },
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
      onVersionHistory,
      onResize,
    },
  };
}

/** Build a fingerprint of item data (excluding position) for change detection */
function itemFingerprint(item: BoardItemRecord): string {
  // Canvas-relevant metadata (status/pinned/attributes) must invalidate the
  // node — completion, errors, and staleness all arrive via metadata.
  const meta = (item.metadata ?? {}) as BoardItemCanvasMetadata;
  const metaSig = JSON.stringify({
    p: meta.provenance?.type ?? null,
    s: meta.status?.type ?? null,
    pin: meta.pinned === true,
    up: meta.userPrompt ?? '',
    a: meta.attributes ? Object.keys(meta.attributes).length : 0,
  });
  return `${item.id}|${item.type}|${item.kind ?? ''}|${item.label ?? ''}|${item.imageUrl ?? ''}|${item.width}|${item.height}|${item.zIndex}|${metaSig}`;
}

/* ── Component ────────────────────────────────────────────── */

export function BoardCanvas({
  items,
  viewport,
  onItemMove,
  onItemResize,
  onItemDelete,
  onItemRename,
  onVersionHistory,
  onViewportChange,
  onNodeSelect,
  onNodeDoubleClick,
  onNodeContextMenu,
  onPaneClick,
  onPaneClickWithPosition,
  className,
  children,
  onViewportCenterRef,
  crosshairCursor,
  onScrollToNodeRef,
  boardId,
  onSelectNodeRef,
  onScreenToFlowRef,
  onSelectionIdsChange,
  onNudgeSelectionRef,
  onSelectAllRef,
  onClearSelectionRef,
  onSetPositionsRef,
  pointerTool = 'select',
  lineageEdges,
  onGroupAction,
  onSelectionContextMenu,
}: BoardCanvasProps) {
  const rfInstance = useRef<ReactFlowInstance<AnyFlowNode> | null>(null);
  const prevFingerprintRef = useRef<string>('');
  const isDraggingRef = useRef(false);
  const pendingSelectRef = useRef<number | null>(null);

  // Expose auto-select: applies immediately if the node exists, otherwise on
  // the next rebuild (freshly-created items arrive via query invalidation)
  useEffect(() => {
    onSelectNodeRef?.((itemId: number) => {
      pendingSelectRef.current = itemId;
      setNodes((prev) => {
        if (!prev.some((n) => n.id === `item-${itemId}`)) return prev;
        pendingSelectRef.current = null;
        return prev.map((n) => ({ ...n, selected: n.id === `item-${itemId}` }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelectNodeRef]);

  const [nodes, setNodes, onNodesChange] = useNodesState<AnyFlowNode>([]);

  // D-50 Focus from the group context menu (the toolbar path calls fitView
  // directly) — zoom-to-selection is a viewport concern, so it lives here
  useEffect(() => {
    const onGroupFocus = (e: Event) => {
      const ids = (e as CustomEvent<{ itemIds: number[] }>).detail?.itemIds;
      if (!ids?.length) return;
      void rfInstance.current?.fitView({
        nodes: ids.map((id) => ({ id: `item-${id}` })),
        padding: 0.3,
        duration: 500,
      });
    };
    window.addEventListener('board-group-focus', onGroupFocus);
    return () => window.removeEventListener('board-group-focus', onGroupFocus);
  }, []);

  // R5 edge rendering (DS §8): lineage is ambient structure — hairline-strong
  // smoothstep at 40%, upgraded to full opacity when either endpoint is
  // selected. Edges are facts (D-50.5): never selectable, never deletable.
  const edges = useMemo<Edge[]>(() => {
    if (!lineageEdges?.length) return [];
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    return lineageEdges.map((e) => {
      const source = `item-${e.source}`;
      const target = `item-${e.target}`;
      const active = selectedIds.has(source) || selectedIds.has(target);
      return {
        id: `edge-${e.id}`,
        source,
        target,
        sourceHandle: 'out',
        targetHandle: 'in',
        type: 'smoothstep',
        selectable: false,
        focusable: false,
        style: {
          // ink-soft, not border-strong (VC-R5 fix 2): border-grey on the
          // grey board was nearly invisible — lineage stays quiet but findable
          stroke: 'var(--color-canvas-ink-soft)',
          strokeWidth: 1,
          opacity: active ? 1 : 0.4,
        },
      } satisfies Edge;
    });
  }, [lineageEdges, nodes]);

  // Latest nodes for imperative helpers (registered once — never stale, and
  // never inside a setNodes updater, which StrictMode double-invokes)
  const nodesRef = useRef<AnyFlowNode[]>(nodes);
  nodesRef.current = nodes;

  // R4 keyboard model: imperative selection/position helpers for the parent
  useEffect(() => {
    onNudgeSelectionRef?.((dx, dy) => {
      const moved: Array<{ itemId: number; x: number; y: number; prevX: number; prevY: number }> = [];
      const next = nodesRef.current.map((n) => {
        if (!n.selected) return n;
        const itemId = parseInt(n.id.replace('item-', ''), 10);
        if (isNaN(itemId)) return n;
        const x = n.position.x + dx;
        const y = n.position.y + dy;
        moved.push({ itemId, x, y, prevX: n.position.x, prevY: n.position.y });
        return { ...n, position: { x, y } };
      });
      if (moved.length > 0) setNodes(next);
      return moved;
    });
    onSelectAllRef?.(() => {
      setNodes(nodesRef.current.map((n) => (n.selected ? n : { ...n, selected: true })));
    });
    onClearSelectionRef?.(() => {
      setNodes(nodesRef.current.map((n) => (n.selected ? { ...n, selected: false } : n)));
    });
    onSetPositionsRef?.((moves) => {
      const byId = new Map(moves.map((m) => [`item-${m.itemId}`, m]));
      setNodes(
        nodesRef.current.map((n) => {
          const m = byId.get(n.id);
          return m ? { ...n, position: { x: m.x, y: m.y } } : n;
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNudgeSelectionRef, onSelectAllRef, onClearSelectionRef, onSetPositionsRef]);

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

    setNodes((prev) => {
      // Preserve selection across rebuilds; honor a pending auto-select
      // (freshly-dropped cast nodes must arrive selected — foundations 3a)
      const selectedIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      const pendingId = pendingSelectRef.current;
      if (pendingId !== null) {
        selectedIds.clear();
        selectedIds.add(`item-${pendingId}`);
        pendingSelectRef.current = null;
      }
      return items.map((item) => {
        const node = itemToNode(item, boardId, onItemDelete, onItemRename, onVersionHistory, onItemResize);
        return selectedIds.has(node.id) ? { ...node, selected: true } : node;
      });
    });
  }, [items, boardId, onItemDelete, onItemRename, onVersionHistory, onItemResize, setNodes]);

  // Handle node drag + position persistence
  const handleNodesChange: OnNodesChange<AnyFlowNode> = useCallback(
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
        // Handle resize dimension changes
        if (change.type === 'dimensions' && change.dimensions) {
          const itemId = parseInt(change.id.replace('item-', ''), 10);
          if (!isNaN(itemId) && onItemResize) {
            onItemResize(itemId, Math.round(change.dimensions.width), Math.round(change.dimensions.height));
          }
        }
      }
    },
    [onNodesChange, onItemMove, onItemResize],
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
      // Full multi-selection for the keyboard model (R4)
      onSelectionIdsChange?.(
        selectedNodes
          .map((n) => parseInt(n.id.replace('item-', ''), 10))
          .filter((id) => !isNaN(id)),
      );
      if (!onNodeSelect) return;
      if (selectedNodes.length === 1) {
        const itemId = parseInt(selectedNodes[0].id.replace('item-', ''), 10);
        onNodeSelect(isNaN(itemId) ? null : itemId);
      } else {
        onNodeSelect(null);
      }
    },
    [onNodeSelect, onSelectionIdsChange],
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
      className={`${className ?? ''} ${crosshairCursor ? 'placement-mode' : ''}`}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <ReactFlowProvider>
        <CanvasZoomBridge>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={(event, node) => {
          // Prevent the canvas-level context menu from also firing
          event.preventDefault();
          event.stopPropagation();
          const itemId = parseInt(node.id.replace('item-', ''), 10);
          if (isNaN(itemId)) return;
          // D-50.1: right-clicking a node inside a multi-selection opens the
          // GROUP menu (parity with the group toolbar), not the node menu
          const selectedIds = nodesRef.current
            .filter((n) => n.selected)
            .map((n) => parseInt(n.id.replace('item-', ''), 10))
            .filter((id) => !isNaN(id));
          if (selectedIds.length > 1 && selectedIds.includes(itemId) && onSelectionContextMenu) {
            const point = event as unknown as React.MouseEvent;
            onSelectionContextMenu(selectedIds, { x: point.clientX, y: point.clientY });
            return;
          }
          onNodeContextMenu?.(itemId, event as unknown as React.MouseEvent);
        }}
        onSelectionContextMenu={(event) => {
          // Right-click on the selection rect itself — same parity surface
          event.preventDefault();
          const selectedIds = nodesRef.current
            .filter((n) => n.selected)
            .map((n) => parseInt(n.id.replace('item-', ''), 10))
            .filter((id) => !isNaN(id));
          if (selectedIds.length > 1 && onSelectionContextMenu) {
            const point = event as unknown as React.MouseEvent;
            onSelectionContextMenu(selectedIds, { x: point.clientX, y: point.clientY });
          }
        }}
        onMoveEnd={handleMoveEnd}
        // R5 pin-spawn (D-36a, scoped): dragging from a cast's out-pin into
        // empty canvas opens the six-slot menu at the drop point — the one
        // thing pass 1 can honestly spawn is a popped-out package view
        onConnectEnd={(event, connectionState) => {
          if (connectionState.isValid) return; // dropped on a real handle — pass-2 wiring, not ours
          const fromNode = connectionState.fromNode;
          if (!fromNode || connectionState.fromHandle?.id !== 'out') return;
          const itemId = parseInt(fromNode.id.replace('item-', ''), 10);
          if (isNaN(itemId)) return;
          const point = 'changedTouches' in event ? event.changedTouches[0] : event;
          const flow = rfInstance.current?.screenToFlowPosition({ x: point.clientX, y: point.clientY });
          window.dispatchEvent(
            new CustomEvent('board-open-pin-spawn', {
              detail: {
                itemId,
                x: point.clientX,
                y: point.clientY,
                flowX: Math.round(flow?.x ?? 0),
                flowY: Math.round(flow?.y ?? 0),
              },
            }),
          );
        }}
        onPaneClick={(event) => {
          onPaneClick?.();
          // Convert screen click to flow coordinates for placement mode
          if (onPaneClickWithPosition && rfInstance.current) {
            const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
            if (bounds) {
              const vp = rfInstance.current.getViewport();
              const flowX = Math.round(((event as unknown as MouseEvent).clientX - bounds.left - vp.x) / vp.zoom);
              const flowY = Math.round(((event as unknown as MouseEvent).clientY - bounds.top - vp.y) / vp.zoom);
              onPaneClickWithPosition({ x: flowX, y: flowY });
            }
          }
        }}
        onInit={(instance) => {
          rfInstance.current = instance as ReactFlowInstance<AnyFlowNode>;
          // Expose viewport center getter to parent
          if (onViewportCenterRef) {
            onViewportCenterRef(() => {
              const vp = instance.getViewport();
              const container = document.querySelector('.react-flow');
              const w = container?.clientWidth ?? window.innerWidth;
              const h = container?.clientHeight ?? window.innerHeight;
              return {
                x: Math.round((-vp.x + w / 2) / vp.zoom),
                y: Math.round((-vp.y + h / 2) / vp.zoom),
              };
            });
          }
          // Expose screen→flow conversion (uses React Flow's own transform —
          // never hand-roll the pan/zoom math; that was VC2 bug #4)
          if (onScreenToFlowRef) {
            onScreenToFlowRef((screen) => instance.screenToFlowPosition(screen));
          }
          // Expose smooth scroll-to-node for parent
          if (onScrollToNodeRef) {
            onScrollToNodeRef((itemId: number) => {
              const nodeId = `item-${itemId}`;
              const node = instance.getNode(nodeId);
              if (!node) return;
              const vp = instance.getViewport();
              instance.setCenter(
                node.position.x + (node.measured?.width ?? 400) / 2,
                node.position.y + (node.measured?.height ?? 500) / 2,
                { zoom: vp.zoom, duration: 800 },
              );
            });
          }
        }}
        defaultViewport={defaultViewport}
        fitView={items.length > 0 && !viewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={3}
        deleteKeyCode={null}
        zoomOnScroll
        // R1 tool separation (VC-R4): Select = drag-on-empty marquees, pan
        // via Space (panActivationKeyCode) or middle/right drag; Hand = drag
        // pans. Partial-intersection marquee — touching a card selects it.
        selectionOnDrag={pointerTool === 'select'}
        panOnDrag={pointerTool === 'hand' ? true : [1, 2]}
        panActivationKeyCode="Space"
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        multiSelectionKeyCode={['Meta', 'Control']}
        // Click-vs-drag tolerance (VC-R4 fix 4): a few px of jitter is still
        // a click — selection must never be eaten by a 2px drag
        nodeDragThreshold={4}
        paneClickDistance={4}
        // The Decision-7 keyboard model owns arrows/delete/Esc at the window
        // level — React Flow's built-in arrow-move would double-nudge
        disableKeyboardA11y
        proOptions={{ hideAttribution: true }}
        style={{
          '--xy-background-color': '#DFDFDF',
          '--xy-background-color-props': '#DFDFDF',
        } as React.CSSProperties}
      >
        <Background
          variant={"dots" as any}
          gap={20}
          size={1.3}
          color="#c4c4c4"
        />
        {/* D-50: selection >1 renders as a GROUP — one container, one toolbar */}
        <GroupSelectionOverlay
          onGroupAction={(action, itemIds) => {
            if (action === 'focus') {
              // Zoom-to-selection lives here — it's a viewport concern
              void rfInstance.current?.fitView({
                nodes: itemIds.map((id) => ({ id: `item-${id}` })),
                padding: 0.3,
                duration: 500,
              });
              return;
            }
            onGroupAction?.(action, itemIds);
          }}
        />
        {children}
      </ReactFlow>
        </CanvasZoomBridge>
      </ReactFlowProvider>
    </div>
  );
}

/** Provides live zoom to screen-legible chrome (D-37). Must sit inside ReactFlowProvider. */
function CanvasZoomBridge({ children }: { children: ReactNode }) {
  const value = useLiveCanvasZoom();
  return <CanvasZoomContext.Provider value={value}>{children}</CanvasZoomContext.Provider>;
}

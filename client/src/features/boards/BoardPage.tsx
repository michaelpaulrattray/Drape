/**
 * BoardPage — The /app/board/:id workspace.
 *
 * Loads a board from DB, renders items on the infinite canvas,
 * and hosts a collapsible tool panel on the right side.
 * Bottom-of-canvas UI: centered toolbar, zoom controls (left), AI chat (right).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BoardCanvas, type BoardItemRecord } from './BoardCanvas';
import { BoardHeader } from './BoardHeader';
import { CanvasImageViewer } from './canvas/CanvasImageViewer';
import { AddNodeMenu, type AddNodeAction } from './components/AddNodeMenu';
import { type CanvasToolId } from './components/CanvasToolbar';
import { FloatingToolPill, type PillTool } from './canvas/FloatingToolPill';
import { CastPickerModal } from './canvas/CastPickerModal';
import { DottedGridBackground } from './canvas/DottedGridBackground';
import { BrandLoader } from '@/components/BrandLoader';
import { CastingTakeover, type CastEditContext } from '@/features/studio/takeover/CastingTakeover';
import { useGenerationJobs } from './stores/useGenerationJobs';
import { useOptimisticFills } from './stores/useOptimisticFills';
import { hasOpenCanvasLayers } from './stores/useCanvasLayers';
import { DeleteCascadeDialog } from './canvas/DeleteCascadeDialog';
import { useAuth } from '@/_core/hooks/useAuth';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { CanvasChatToggle } from './components/CanvasChatToggle';
import { NodeContextMenu, type NodeContextAction } from './components/NodeContextMenu';
import { NodeInfoPanel } from './components/NodeInfoPanel';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { isLineageEdge, type CanonicalViewAngle } from '@shared/boardTypes';
import { SpawnMenu } from './canvas/SpawnMenu';
import { GroupContextMenu } from './canvas/GroupContextMenu';
import JSZip from 'jszip';

/* ── Types ────────────────────────────────────────────────── */

type ToolPanelId = 'casting' | 'wardrobe' | 'export' | null;

/* ── Component ────────────────────────────────────────────── */

export function BoardPage() {
  return <BoardPageImpl />;
}

function BoardPageImpl() {
  const [, params] = useRoute('/app/board/:id');
  const [, navigate] = useLocation();
  const boardId = params?.id ? parseInt(params.id, 10) : NaN;

  const [activePanel, setActivePanel] = useState<ToolPanelId>(null);
  // 'hand' joins the legacy tool ids per VC-R4 ruling R1 (Select/Hand split)
  const [activeTool, setActiveTool] = useState<CanvasToolId | 'hand'>('select');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  // Double-click viewer — VIEW-ONLY by ruling (VC-R5 R3): zoom/pan/download
  const [imageViewer, setImageViewer] = useState<{ url: string; label: string | null } | null>(null);
  const [addNodeMenu, setAddNodeMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: number;
    imageUrl: string | null;
  } | null>(null);
  // R5 pin-spawn (D-36a): drag from a cast's out-pin into empty canvas
  const [spawnMenu, setSpawnMenu] = useState<{
    itemId: number;
    modelId: number;
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  } | null>(null);
  const [infoPanel, setInfoPanel] = useState<{ itemId: number; position: { x: number; y: number } } | null>(null);
  const [versionHistoryItemId, setVersionHistoryItemId] = useState<number | null>(null);
  // Cast picker (D-33) — hosted here, not in CastNode, so it survives the
  // optimistic temp→real id remount. Opened via the node's front-door event.
  const [castPickerItemId, setCastPickerItemId] = useState<number | null>(null);
  // Casting takeover (D-35) — opened from the picker's "Cast new"; on mint
  // the finished model lands on this node via fillFromLibrary.
  const [castTakeoverItemId, setCastTakeoverItemId] = useState<number | null>(null);
  // R3: Edit session on a placed cast (minted → D-11 routing; draft → promotion)
  const [castEditContext, setCastEditContext] = useState<CastEditContext | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { startJob, completeJob, failJob } = useGenerationJobs();

  // Viewport center getter exposed by BoardCanvas
  const viewportCenterGetterRef = useRef<(() => { x: number; y: number }) | null>(null);
  // Smooth scroll-to-node function exposed by BoardCanvas
  const scrollToNodeRef = useRef<((itemId: number) => void) | null>(null);
  // Auto-select function exposed by BoardCanvas (freshly-dropped nodes)
  const selectNodeRef = useRef<((itemId: number) => void) | null>(null);
  // Screen→flow converter exposed by BoardCanvas + the flow position captured
  // when a right-click menu opens (nodes spawn at the cursor, VC2 fix #4)
  const screenToFlowRef = useRef<((s: { x: number; y: number }) => { x: number; y: number }) | null>(null);
  const contextMenuFlowPosRef = useRef<{ x: number; y: number } | null>(null);
  // R4 keyboard model refs (Decision 7)
  const selectedItemIdsRef = useRef<number[]>([]);
  const nudgeSelectionRef = useRef<
    ((dx: number, dy: number) => Array<{ itemId: number; x: number; y: number; prevX: number; prevY: number }>) | null
  >(null);
  const selectAllRef = useRef<(() => void) | null>(null);
  const clearSelectionRef = useRef<(() => void) | null>(null);
  const setPositionsRef = useRef<((moves: Array<{ itemId: number; x: number; y: number }>) => void) | null>(null);
  const nodeGeometryRef = useRef<
    ((itemIds: number[]) => Array<{ itemId: number; x: number; y: number; width: number; height: number }>) | null
  >(null);
  // Cmd+C/V alias Duplicate for same-board (D-39 ratification line 5)
  const clipboardRef = useRef<number[]>([]);

  // Placement mode: 'note' — cursor becomes crosshair, next pane click places
  // the node. (Frames retired from the tools per VC-R4 ruling R3 — they
  // return at pass 3 as export units; existing frame nodes still render.)
  const [placementMode, setPlacementMode] = useState<'note' | null>(null);

  const utils = trpc.useUtils();

  // ── Queries ────────────────────────────────────────────────
  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = trpc.boards.get.useQuery(
    { id: boardId },
    { enabled: !isNaN(boardId), retry: 1 },
  );

  const {
    data: items,
    isLoading: itemsLoading,
  } = trpc.boards.getItems.useQuery(
    { boardId },
    { enabled: !isNaN(boardId) && !!board, staleTime: 10_000 },
  );
  // Fresh items for event listeners registered once (no re-subscription churn)
  const itemsRef = useRef<typeof items>(undefined);
  itemsRef.current = items;

  // R4: client-side cascade knowledge for the delete trust net (which nodes
  // fall with a root) — invalidated whenever an op adds edges
  const { data: boardEdges } = trpc.boardOps.listEdges.useQuery(
    { boardId },
    { enabled: !isNaN(boardId) && !!board, staleTime: 30_000 },
  );
  const boardEdgesRef = useRef<typeof boardEdges>(undefined);
  boardEdgesRef.current = boardEdges;

  // ── Mutations ──────────────────────────────────────────────

  const renameMutation = trpc.boards.update.useMutation({
    onSuccess: () => utils.boards.get.invalidate({ id: boardId }),
    onError: () => toast.error('Failed to rename canvas'),
  });

  const saveViewportMutation = trpc.boards.saveViewport.useMutation();

  const updateItemMutation = trpc.boards.updateItem.useMutation({
    onSuccess: () => utils.boards.getItems.invalidate({ boardId }),
  });

  // ── R4 delete trust net (Decision 7 / D-17): soft delete + Undo ──────────
  // Every canvas delete routes here — keyboard, toolbar, context menu, node
  // chrome. Cascade units (root + connected views) are predicted client-side
  // from the edge cache for the confirm dialog and the optimistic removal;
  // the server recomputes them authoritatively.

  type UndoEntry =
    | { kind: 'delete'; itemIds: number[]; rows: NonNullable<typeof items> }
    | { kind: 'move'; moves: Array<{ itemId: number; x: number; y: number }> };
  const undoStackRef = useRef<UndoEntry[]>([]);
  const pushUndo = (entry: UndoEntry) => {
    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ itemIds: number[]; cascadeCount: number } | null>(null);

  /** Client-side cascade prediction: selection + ALIVE generated_from_cast
   *  targets. Aliveness is checked against the items cache (soft-deleted rows
   *  never arrive in getItems) — the edge cache can hold optimistic appends
   *  and stale rows across a pop-out/collapse cycle at AU latency, and the
   *  one red dialog must never claim a blast radius that isn't there
   *  (VC-R5 fix 1). The server recomputes the unit authoritatively with the
   *  same alive-only rule. */
  const predictDeleteUnit = (itemIds: number[]) => {
    const unit = new Set(itemIds);
    const alive = new Set((itemsRef.current ?? []).map((i) => i.id));
    for (const edge of boardEdgesRef.current ?? []) {
      if (edge.relation === 'generated_from_cast' && unit.has(edge.source) && alive.has(edge.target)) {
        unit.add(edge.target);
      }
    }
    return unit;
  };

  const undoDeleteMutation = trpc.boardOps.undoDelete.useMutation({
    onSettled: () => utils.boards.getItems.invalidate({ boardId }),
    onError: (err) => toast.error(err.message),
  });

  const undoEntry = useCallback(
    (entry: UndoEntry) => {
      const idx = undoStackRef.current.indexOf(entry);
      if (idx >= 0) undoStackRef.current.splice(idx, 1);
      if (entry.kind === 'delete') {
        // Optimistic restore — the rows are client-held (D-38)
        utils.boards.getItems.setData({ boardId }, (old) => {
          const existing = old ?? [];
          const restored = entry.rows.filter((r) => !existing.some((i) => i.id === r.id));
          return [...existing, ...restored];
        });
        undoDeleteMutation.mutate({ boardId, itemIds: entry.itemIds });
      } else {
        setPositionsRef.current?.(entry.moves);
        for (const m of entry.moves) recentMovesRef.current.set(m.itemId, { x: m.x, y: m.y });
        const persistable = entry.moves.filter((m) => m.itemId > 0);
        if (persistable.length > 0) {
          moveNodesMutation.mutate({ boardId, moves: persistable.map((m) => ({ itemId: m.itemId, x: m.x, y: m.y })) });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId],
  );
  const undoEntryRef = useRef(undoEntry);
  undoEntryRef.current = undoEntry;

  const deleteNodesMutation = trpc.boardOps.deleteNodes.execute.useMutation({
    onMutate: async ({ itemIds }) => {
      await utils.boards.getItems.cancel({ boardId });
      const prev = utils.boards.getItems.getData({ boardId });
      const unit = predictDeleteUnit(itemIds);
      const removedRows = (prev ?? []).filter((i) => unit.has(i.id)) as NonNullable<typeof items>;
      utils.boards.getItems.setData({ boardId }, (old) => (old ? old.filter((i) => !unit.has(i.id)) : []));
      // Undo entry lands NOW, not on the server confirm — Cmd+Z must have no
      // dead window during the round trip (the founder drives at AU latency).
      // onSuccess reconciles the ids to server truth in place.
      const entry: UndoEntry = { kind: 'delete', itemIds: Array.from(unit), rows: removedRows };
      pushUndo(entry);
      return { prev, entry };
    },
    onSuccess: (result, _vars, ctx) => {
      const entry = ctx?.entry;
      if (entry) entry.itemIds = result.deletedItemIds;
      const rows = entry?.rows ?? [];
      // The trust net: soft-deleted, one toast, one restore path with Cmd+Z
      const label =
        rows.length === 1
          ? (rows[0].kind === 'cast_config' || rows[0].sourceModelId || rows[0].type === 'model'
              ? 'Cast deleted'
              : 'Node deleted')
          : `${result.deletedItemIds.length} nodes deleted`;
      toast(label, {
        duration: 8000,
        action: { label: 'Undo', onClick: () => entry && undoEntryRef.current(entry) },
      });
      utils.boards.getItems.invalidate({ boardId });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.entry) {
        const idx = undoStackRef.current.indexOf(ctx.entry);
        if (idx >= 0) undoStackRef.current.splice(idx, 1);
      }
      if (ctx?.prev) utils.boards.getItems.setData({ boardId }, ctx.prev);
      toast.error(err.message || 'Failed to delete');
    },
  });

  /** Entry point for every delete gesture. Cascades confirm first (red — the
   *  one D-8 moment); plain deletes go straight to soft-delete + Undo toast. */
  const handleDeleteNodes = useCallback(
    (itemIds: number[]) => {
      const ids = itemIds.filter((id) => id > 0);
      if (ids.length === 0) return;
      const unit = predictDeleteUnit(ids);
      const cascadeCount = unit.size - ids.length;
      if (cascadeCount > 0) {
        setDeleteConfirm({ itemIds: ids, cascadeCount });
        return;
      }
      deleteNodesMutation.mutate({ boardId, itemIds: ids });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId, deleteNodesMutation],
  );
  const handleDeleteRef = useRef(handleDeleteNodes);
  handleDeleteRef.current = handleDeleteNodes;

  // Move persistence for nudges + move-undo (wraps batchUpdatePositions)
  const moveNodesMutation = trpc.boardOps.moveNodes.useMutation({
    onError: () => utils.boards.getItems.invalidate({ boardId }),
  });

  // Optimistic for ALL node kinds (VC2 re-drive follow-up #1): notes, frames,
  // and any legacy-path item render instantly; the server confirm swaps the
  // temp id in place, exactly like cast creation.
  const addItemMutation = trpc.boards.addItem.useMutation({
    onMutate: async (vars) => {
      await utils.boards.getItems.cancel({ boardId });
      const prev = utils.boards.getItems.getData({ boardId });
      const tempId = -Date.now();
      type ItemsRow = NonNullable<typeof prev>[number];
      const tempRow = {
        id: tempId,
        boardId,
        type: vars.type,
        kind: vars.type === 'note' ? 'note' : vars.type === 'frame' ? 'frame' : 'image',
        label: vars.label ?? null,
        imageUrl: vars.imageUrl ?? null,
        imageKey: null,
        positionX: vars.positionX ?? 0,
        positionY: vars.positionY ?? 0,
        width: vars.width ?? 280,
        height: vars.height ?? 280,
        zIndex: vars.zIndex ?? 0,
        parentItemId: null,
        sourceModelId: vars.sourceModelId ?? null,
        sourceGarmentId: null,
        sourceSessionId: null,
        sourceLookId: null,
        metadata: vars.metadata ?? {},
        deletedAt: null,
        createdAt: new Date(),
      } as unknown as ItemsRow;
      utils.boards.getItems.setData({ boardId }, (old) => [...(old ?? []), tempRow]);
      return { prev, tempId };
    },
    onSuccess: (result, _vars, ctx) => {
      const move = ctx?.tempId ? recentMovesRef.current.get(ctx.tempId) : undefined;
      if (ctx?.tempId && move) {
        recentMovesRef.current.delete(ctx.tempId);
        recentMovesRef.current.set(result.id, move);
        updateItemMutation.mutate({ itemId: result.id, positionX: move.x, positionY: move.y });
      }
      utils.boards.getItems.setData({ boardId }, (old) =>
        old?.map((i) =>
          i.id === ctx?.tempId
            ? { ...i, id: result.id, positionX: move?.x ?? i.positionX, positionY: move?.y ?? i.positionY }
            : i,
        ),
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.getItems.setData({ boardId }, ctx.prev);
      toast.error('Failed to add node');
    },
  });

  // ── Handlers ───────────────────────────────────────────────

  const handleRename = useCallback(
    (name: string) => {
      renameMutation.mutate({ boardId, name });
    },
    [boardId, renameMutation],
  );

  /**
   * Local-moves ledger (VC2 fix #3): a user's position change ALWAYS wins over
   * any in-flight server confirm. Every drag-end is recorded here; canvasItems
   * overrides server positions with these until the server catches up (returned
   * position matches), at which point the entry self-prunes. This closes the
   * race where a refetch issued before the move persisted rebuilt the node at
   * its stale position ("snap back").
   */
  const recentMovesRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Drag-end undo batching (Decision 7): a multi-node drag emits one
  // position callback per node in the same tick — they collapse into ONE
  // undo entry holding the pre-drag positions.
  const dragUndoBatchRef = useRef<{
    moves: Array<{ itemId: number; x: number; y: number }>;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const handleItemMove = useCallback(
    (itemId: number, x: number, y: number) => {
      // Pre-drag position = the last local move if one is pending, else the
      // server row — captured BEFORE the ledger updates
      const prevLocal = recentMovesRef.current.get(itemId);
      const row = itemsRef.current?.find((i) => i.id === itemId);
      const prev = prevLocal ?? (row ? { x: row.positionX, y: row.positionY } : null);
      if (prev && !(prev.x === x && prev.y === y)) {
        const batch = dragUndoBatchRef.current ?? { moves: [], timer: null };
        batch.moves.push({ itemId, x: prev.x, y: prev.y });
        if (batch.timer) clearTimeout(batch.timer);
        batch.timer = setTimeout(() => {
          const b = dragUndoBatchRef.current;
          dragUndoBatchRef.current = null;
          if (b && b.moves.length > 0) pushUndo({ kind: 'move', moves: b.moves });
        }, 50);
        dragUndoBatchRef.current = batch;
      }

      recentMovesRef.current.set(itemId, { x, y });
      if (itemId > 0) {
        // Negative ids are optimistic temp nodes — their move is recorded and
        // transferred to the real id at swap time (see createCastNodeMutation)
        updateItemMutation.mutate({ itemId, positionX: x, positionY: y });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateItemMutation],
  );

  const handleItemResize = useCallback(
    (itemId: number, width: number, height: number) => {
      // Negative ids are optimistic temp nodes — React Flow emits a
      // dimensions change on first measure, which must not hit the server
      if (itemId <= 0) return;
      updateItemMutation.mutate({ itemId, width, height });
    },
    [updateItemMutation],
  );

  // All node-owned delete affordances (frames, notes, context menu) route
  // into the same trust net as the keyboard/toolbar (R4)
  const handleItemDelete = useCallback((itemId: number) => {
    handleDeleteRef.current([itemId]);
  }, []);

  const handleItemRename = useCallback(
    (itemId: number, label: string) => {
      // A NODE-LABEL tool, nothing more (founder-corrected, drive 2): the
      // node's label is board annotation ("character 1"), independent of the
      // model's name. Renaming the MODEL happens in the environment/library,
      // never from a placement.
      updateItemMutation.mutate({ itemId, label });
    },
    [updateItemMutation],
  );

  const handleViewportChange = useCallback(
    (vp: { x: number; y: number; zoom: number }) => {
      saveViewportMutation.mutate({
        id: boardId,
        viewportX: Math.round(vp.x),
        viewportY: Math.round(vp.y),
        viewportZoom: Math.round(vp.zoom * 100),
      });
    },
    [boardId, saveViewportMutation],
  );

  const handleNodeSelect = useCallback((itemId: number | null) => {
    setSelectedItemId(itemId);
  }, []);

  const handleNodeDoubleClick = useCallback((itemId: number) => {
    // Any image-bearing node opens the view-only viewer (VC-R5 R3); comp-card
    // tiles dispatch their own event with the CLICKED view's image (fix 5)
    const item = items?.find((i) => i.id === itemId);
    if (item?.imageUrl) {
      setImageViewer({ url: item.imageUrl, label: item.label ?? null });
    }
  }, [items]);

  // Warm the picker's models query on board load (D-38: the picker must open
  // against cache and revalidate, never open empty-then-load)
  useEffect(() => {
    if (!isNaN(boardId)) void utils.boardOps.listCastableModels.prefetch({ limit: 30 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // The cast node's front-door pill dispatches this (same pattern as
  // 'board-rename-node') — node-local modal state wouldn't survive remounts
  useEffect(() => {
    const onOpenPicker = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: number }>).detail?.itemId;
      if (typeof itemId === 'number') setCastPickerItemId(itemId);
    };
    window.addEventListener('board-open-cast-picker', onOpenPicker);
    return () => window.removeEventListener('board-open-cast-picker', onOpenPicker);
  }, []);

  // D-43: the v-chip opens version history directly (visible only at v2+)
  useEffect(() => {
    const onOpenHistory = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: number }>).detail?.itemId;
      if (typeof itemId === 'number' && itemId > 0) setVersionHistoryItemId(itemId);
    };
    window.addEventListener('board-open-version-history', onOpenHistory);
    return () => window.removeEventListener('board-open-version-history', onOpenHistory);
  }, []);

  // R3: the cast node's Edit action — the environment opens on the model
  useEffect(() => {
    const onEditCast = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; modelId: number | null; draft: boolean; openUpgrade?: boolean; initialAngle?: string }>).detail;
      if (!detail || typeof detail.itemId !== 'number' || !detail.modelId) return;
      setCastEditContext({
        boardId,
        itemId: detail.itemId,
        modelId: detail.modelId,
        draft: !!detail.draft,
        // D-51: ghost tiles + the package verb open the takeover WITH the
        // mint/upgrade dialog already up (mint gate for drafts, Rider 1)
        openUpgrade: !!detail.openUpgrade,
        // D-54: a tile double-click focuses the environment on that view
        initialAngle: detail.initialAngle,
      });
    };
    window.addEventListener('board-edit-cast', onEditCast);
    return () => window.removeEventListener('board-edit-cast', onEditCast);
  }, [boardId]);

  // R4: toolbar Info + the strip's ··· menu (same surfaces as right-click,
  // reached from the node's own chrome)
  useEffect(() => {
    const onInfo = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; x: number; y: number }>).detail;
      if (!detail || detail.itemId <= 0) return;
      setInfoPanel({ itemId: detail.itemId, position: { x: detail.x, y: detail.y } });
    };
    const onMenu = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; x: number; y: number }>).detail;
      if (!detail || detail.itemId <= 0) return;
      const item = itemsRef.current?.find((i) => i.id === detail.itemId);
      setNodeContextMenu({ x: detail.x, y: detail.y, nodeId: detail.itemId, imageUrl: item?.imageUrl ?? null });
    };
    window.addEventListener('board-node-info', onInfo);
    window.addEventListener('board-open-node-menu', onMenu);
    return () => {
      window.removeEventListener('board-node-info', onInfo);
      window.removeEventListener('board-open-node-menu', onMenu);
    };
  }, []);

  // The takeover's mint landing (D-35): the finished model fills the
  // originating node in place — same op as the picker's library path.
  // Optimistic (D-38): the client already holds the headshot, so the node
  // fills the instant the takeover closes; the server confirm reconciles
  // behind (an error refetches back to truth).
  const landMintedCastMutation = trpc.boardOps.fillFromLibrary.useMutation({
    onSuccess: () => {
      utils.boards.getItems.invalidate({ boardId });
      // Mint changed the model (name/status) — the next Edit must hydrate
      // fresh (bug-2b), and the picker must show the promotion (P2/D-38)
      utils.models.get.invalidate();
      utils.boardOps.listCastableModels.invalidate();
    },
    onError: (err) => {
      utils.boards.getItems.invalidate({ boardId });
      toast.error(err.message);
    },
  });

  const handleTakeoverMinted = useCallback(
    (modelId: number, info: { name: string; headshotUrl: string | null }) => {
      // New cast lands on the picker's node; a promoted draft (R3/D-42)
      // lands back on its own node — same fill op re-stamps label + clears
      // the draft badge. Optimistic via the fill LEDGER (D-38) — cache
      // writes lose stale-refetch races.
      const itemId = castEditContext?.itemId ?? castTakeoverItemId;
      setCastTakeoverItemId(null);
      setCastEditContext(null);
      if (itemId === null || itemId <= 0) return;
      if (info.headshotUrl) {
        useOptimisticFills.getState().setFill(itemId, {
          imageUrl: info.headshotUrl,
          label: info.name || null,
          modelId,
        });
      }
      // R5: a mint/upgrade changed the package — the comp card re-reads it
      void utils.generation.packageState.invalidate({ modelId });
      landMintedCastMutation.mutate({ boardId, itemId, modelId });
    },
    [boardId, castTakeoverItemId, castEditContext, landMintedCastMutation, utils],
  );

  // R3: the identity-event landing (D-11). Update regenerates THIS node
  // (job-driven progress on the card); fork lands a new draft node beside
  // the original, optimistically (D-38).
  //
  // Fork's pending node lives OUTSIDE the query cache (bug-3 fix): a cache
  // row would be clobbered by any refetch during the ~25s generation (that
  // was the vanish-then-materialize race). The overlay merges into
  // canvasItems and self-prunes once the server row arrives.
  const [pendingForks, setPendingForks] = useState<BoardItemRecord[]>([]);
  const optimisticFills = useOptimisticFills((s) => s.fills);
  useEffect(() => {
    if (!items) return;
    setPendingForks((pf) => pf.filter((p) => !items.some((i) => i.id === p.id)));
    // Fill-ledger entries prune once the server row carries the image
    for (const idStr of Object.keys(useOptimisticFills.getState().fills)) {
      const id = Number(idStr);
      if (items.some((i) => i.id === id && i.imageUrl)) {
        useOptimisticFills.getState().clearFill(id);
      }
    }
  }, [items]);

  // ── R5: pop out / collapse (DS §5.17) — placements referencing the model
  // package. Pop-out lands optimistically via the pendingForks overlay (D-38;
  // the op is a fast DB write, but the row must never vanish-then-appear) and
  // appends its edge to the listEdges cache so cascade prediction + edge
  // rendering have no gap.
  const popOutMutation = trpc.boardOps.popOutView.execute.useMutation({
    onMutate: async (vars) => {
      const source = items?.find((i) => i.id === vars.itemId);
      const tempId = -Date.now();
      const tempRow: BoardItemRecord = {
        id: tempId,
        type: 'model',
        kind: 'image',
        label: source?.label ?? null,
        imageUrl: null, // the server resolves the asset URL; sub-second
        positionX: vars.position?.x ?? (source?.positionX ?? 0) + (source?.width ?? 280) + 60,
        positionY: vars.position?.y ?? source?.positionY ?? 0,
        width: 200,
        height: 360,
        zIndex: 0,
        metadata: {
          provenance: {
            type: 'cast_view',
            modelId: -1,
            rootItemId: vars.itemId,
            viewAngle: vars.angle,
            attributes: {},
            engine: 'package',
            inputs: [],
          },
        },
        sourceModelId: null,
      };
      setPendingForks((pf) => [...pf, tempRow]);
      return { tempId };
    },
    onSuccess: (result, vars, ctx) => {
      if (ctx?.tempId) {
        setPendingForks((pf) =>
          pf.map((p) =>
            p.id === ctx.tempId ? { ...p, id: result.itemId, imageUrl: result.imageUrl } : p,
          ),
        );
      }
      // The cascade-bearing edge AND the confirmed row enter the caches
      // immediately (D-38): a delete in the refetch window must still predict
      // the popped child (R4 trust net), and the comp-card tile must learn
      // it's popped now — not a remote-DB refetch round-trip later
      utils.boardOps.listEdges.setData({ boardId }, (old) => [
        ...(old ?? []),
        { id: result.edgeId, source: vars.itemId, target: result.itemId, relation: 'generated_from_cast', metadata: null },
      ]);
      const source = items?.find((i) => i.id === vars.itemId);
      utils.boards.getItems.setData({ boardId }, (old) => {
        if (!old || old.some((i) => i.id === result.itemId)) return old;
        const template = old[0];
        if (!template) return old;
        return [
          ...old,
          {
            ...template,
            id: result.itemId,
            type: 'model',
            kind: 'image',
            label: source?.label ?? null,
            imageUrl: result.imageUrl,
            positionX: result.position.x,
            positionY: result.position.y,
            width: 200,
            height: 360,
            zIndex: 0,
            metadata: {
              provenance: {
                type: 'cast_view',
                modelId: -1, // reconciled by the refetch; display-only until then
                rootItemId: vars.itemId,
                viewAngle: result.viewAngle,
                attributes: {},
                engine: 'package',
                inputs: [],
              },
              version: 1,
            },
          } as (typeof old)[number],
        ];
      });
      utils.boards.getItems.invalidate({ boardId });
      utils.boardOps.listEdges.invalidate({ boardId });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.tempId) setPendingForks((pf) => pf.filter((p) => p.id !== ctx.tempId));
      toast.error(err.message);
    },
  });

  const collapseMutation = trpc.boardOps.collapseView.useMutation({
    onMutate: async ({ itemId }) => {
      // Optimistic removal, mirroring delete's onMutate (D-38) — and the
      // lineage edge leaves the cache WITH the placement, so cascade
      // prediction never sees a collapsed view (VC-R5 fix 1)
      await utils.boards.getItems.cancel({ boardId });
      const prev = utils.boards.getItems.getData({ boardId });
      utils.boards.getItems.setData({ boardId }, (old) => old?.filter((i) => i.id !== itemId));
      const prevEdges = utils.boardOps.listEdges.getData({ boardId });
      utils.boardOps.listEdges.setData({ boardId }, (old) =>
        old?.filter((e) => !(e.relation === 'generated_from_cast' && e.target === itemId)),
      );
      return { prev, prevEdges };
    },
    onSuccess: () => {
      utils.boardOps.listEdges.invalidate({ boardId });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.getItems.setData({ boardId }, ctx.prev);
      if (ctx?.prevEdges) utils.boardOps.listEdges.setData({ boardId }, ctx.prevEdges);
      toast.error(err.message);
    },
    onSettled: () => utils.boards.getItems.invalidate({ boardId }),
  });

  useEffect(() => {
    const onPopOut = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; angle: string; position?: { x: number; y: number } }>).detail;
      if (!detail || typeof detail.itemId !== 'number' || detail.itemId <= 0) return;
      popOutMutation.mutate({
        boardId,
        itemId: detail.itemId,
        angle: detail.angle as never,
        position: detail.position,
      });
    };
    const onCollapse = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number }>).detail;
      if (!detail || typeof detail.itemId !== 'number' || detail.itemId <= 0) return;
      collapseMutation.mutate({ boardId, itemId: detail.itemId });
    };
    const onPinSpawn = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; x: number; y: number; flowX: number; flowY: number }>).detail;
      if (!detail || typeof detail.itemId !== 'number' || detail.itemId <= 0) return;
      const item = itemsRef.current?.find((i) => i.id === detail.itemId);
      const meta = (item?.metadata ?? {}) as { provenance?: { type?: string; modelId?: number } };
      const p = meta.provenance;
      if (!p || (p.type !== 'cast_root' && p.type !== 'library_cast') || !p.modelId || p.modelId <= 0) return;
      setSpawnMenu({
        itemId: detail.itemId,
        modelId: p.modelId,
        x: detail.x,
        y: detail.y,
        flowX: detail.flowX,
        flowY: detail.flowY,
      });
    };
    // Any node chrome can open the D-52 viewer explicitly. (Comp-card tiles
    // no longer dispatch this — D-54 routes their dblclick into the
    // environment; the event stays for future image-class chrome.)
    const onOpenViewer = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string; label?: string | null }>).detail;
      if (!detail?.url) return;
      setImageViewer({ url: detail.url, label: detail.label ?? null });
    };
    window.addEventListener('board-pop-out-view', onPopOut);
    window.addEventListener('board-collapse-view', onCollapse);
    window.addEventListener('board-open-pin-spawn', onPinSpawn);
    window.addEventListener('board-open-image-viewer', onOpenViewer);
    return () => {
      window.removeEventListener('board-pop-out-view', onPopOut);
      window.removeEventListener('board-collapse-view', onCollapse);
      window.removeEventListener('board-open-pin-spawn', onPinSpawn);
      window.removeEventListener('board-open-image-viewer', onOpenViewer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Which angles this root already popped out (the spawn menu disables them)
  const pinSpawnPopped = useMemo(() => {
    const set = new Set<CanonicalViewAngle>();
    if (!spawnMenu || !boardEdges || !items) return set;
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const edge of boardEdges) {
      if (edge.relation !== 'generated_from_cast' || edge.source !== spawnMenu.itemId) continue;
      const target = itemById.get(edge.target);
      const meta = (target?.metadata ?? {}) as { provenance?: { type?: string; viewAngle?: CanonicalViewAngle } };
      if (meta.provenance?.type === 'cast_view' && meta.provenance.viewAngle) {
        set.add(meta.provenance.viewAngle);
      }
    }
    return set;
  }, [spawnMenu, boardEdges, items]);

  // R5 prefetch (D-38): comp cards must paint from cache, never open
  // empty-then-load — warm every placed cast's packageState as items arrive
  useEffect(() => {
    if (!items) return;
    const seen = new Set<number>();
    for (const item of items) {
      const meta = (item.metadata ?? {}) as { provenance?: { modelId?: number } };
      const modelId = meta.provenance?.modelId;
      if (typeof modelId === 'number' && modelId > 0 && !seen.has(modelId)) {
        seen.add(modelId);
        void utils.generation.packageState.prefetch({ modelId });
      }
    }
  }, [items, utils]);

  const applyModelEditMutation = trpc.boardOps.applyModelEdit.execute.useMutation({
    onMutate: async (vars) => {
      if (vars.decision !== 'fork') return {};
      const source = items?.find((i) => i.id === vars.itemId);
      const tempId = -Date.now();
      const tempRow: BoardItemRecord = {
        id: tempId,
        type: 'model',
        kind: 'image',
        label: null,
        imageUrl: null,
        positionX: (source?.positionX ?? 0) + (source?.width ?? 280) + 60,
        positionY: source?.positionY ?? 0,
        width: 280,
        height: 420,
        zIndex: 0,
        metadata: { provenance: { type: 'library_cast', modelId: -1, viewAngle: 'frontClose', draft: true } },
        sourceModelId: null,
      };
      setPendingForks((pf) => [...pf, tempRow]);
      startJob({ itemId: tempId, operation: 'applyModelEdit', estimatedDurationMs: 25_000 });
      return { tempId };
    },
    onSuccess: (result, vars, ctx) => {
      if (result.decision === 'fork' && ctx?.tempId) {
        completeJob(ctx.tempId);
        // Reveal the real node in place; the prune effect drops this entry
        // once the refetch delivers the server row. The real modelId must
        // land WITH the swap — an Edit click in the refetch window would
        // otherwise open a promotion session pointed at the -1 placeholder
        // (dead environment, mint never arms).
        setPendingForks((pf) =>
          pf.map((p) =>
            p.id === ctx.tempId
              ? {
                  ...p,
                  id: result.newItemId!,
                  imageUrl: result.imageUrl,
                  metadata: {
                    provenance: {
                      type: 'library_cast',
                      modelId: result.modelId,
                      viewAngle: 'frontClose',
                      draft: true,
                    },
                  },
                }
              : p,
          ),
        );
      } else {
        completeJob(vars.itemId);
      }
      utils.boards.getItems.invalidate({ boardId });
      utils.boardOps.listEdges.invalidate({ boardId }); // forks add edges
      utils.credits.getBalance.invalidate();
      // The next Edit on this cast must hydrate the post-update model (bug-2b)
      utils.models.get.invalidate();
    },
    onError: (err, vars, ctx) => {
      if (vars.decision === 'fork' && ctx?.tempId) {
        setPendingForks((pf) => pf.filter((p) => p.id !== ctx.tempId));
        failJob(ctx.tempId, err.message);
      } else {
        failJob(vars.itemId, err.message);
      }
      utils.boards.getItems.invalidate({ boardId });
      toast.error(err.message);
    },
  });

  const handleIdentityCommit = useCallback(
    (decision: 'update' | 'fork', changes: Record<string, unknown>) => {
      const ctx = castEditContext;
      setCastEditContext(null);
      if (!ctx || ctx.itemId <= 0) return;
      if (decision === 'update') {
        startJob({ itemId: ctx.itemId, operation: 'applyModelEdit', estimatedDurationMs: 25_000 });
      }
      applyModelEditMutation.mutate({ boardId, itemId: ctx.itemId, decision, changes });
    },
    [boardId, castEditContext, applyModelEditMutation, startJob],
  );

  // ── R4: fork / recast from the node's ForkRecastPopover (3f, D-43) ────────
  // Both are the same identity engine as the environment's D-11 landing
  // (applyModelEdit with empty changes); intent:'rerun' stamps the version
  // ledger honestly. Recast is draft-only — the popover seals it on minted
  // casts and the server guard refuses regardless.
  useEffect(() => {
    const onFork = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: number }>).detail?.itemId;
      if (typeof itemId !== 'number' || itemId <= 0) return;
      applyModelEditMutation.mutate({ boardId, itemId, decision: 'fork', changes: {}, intent: 'rerun' });
    };
    const onRecast = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: number }>).detail?.itemId;
      if (typeof itemId !== 'number' || itemId <= 0) return;
      startJob({ itemId, operation: 'applyModelEdit', estimatedDurationMs: 25_000 });
      applyModelEditMutation.mutate({ boardId, itemId, decision: 'update', changes: {}, intent: 'rerun' });
    };
    window.addEventListener('board-fork-cast', onFork);
    window.addEventListener('board-recast-cast', onRecast);
    return () => {
      window.removeEventListener('board-fork-cast', onFork);
      window.removeEventListener('board-recast-cast', onRecast);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // ── R4: variations — N sibling candidates land optimistically (D-38) ──────
  // Temp rows ride the pendingForks overlay (same lifecycle: outside the
  // query cache, self-pruning once server rows arrive); positions come from
  // the plan the popover already fetched, so temps land exactly where the
  // server will put the real rows.
  const variationTempsRef = useRef<Array<{ tempId: number; index: number }>>([]);
  const runVariationsMutation = trpc.boardOps.runVariations.execute.useMutation({
    onSuccess: (result) => {
      const temps = variationTempsRef.current;
      setPendingForks((pf) =>
        pf
          .filter((p) => {
            const temp = temps.find((t) => t.tempId === p.id);
            // Drop temps whose candidate failed (named-and-refunded below)
            return !(temp && result.failures.some((f) => f.index === temp.index));
          })
          .map((p) => {
            const temp = temps.find((t) => t.tempId === p.id);
            const landed = temp && result.variations.find((v) => v.index === temp.index);
            if (!landed) return p;
            completeJob(temp.tempId);
            return {
              ...p,
              id: landed.itemId,
              imageUrl: landed.imageUrl,
              metadata: {
                provenance: { type: 'library_cast', modelId: landed.modelId, viewAngle: 'frontClose', draft: true },
              },
            };
          }),
      );
      for (const failure of result.failures) {
        const temp = temps.find((t) => t.index === failure.index);
        if (temp) failJob(temp.tempId, failure.message);
        // The failed candidate's surface just vanished — a toast is the
        // correct fallback (D-40), named and refund-honest (D-12 amendment)
        toast.error(`Variation ${failure.index + 1} failed — you weren't charged for it.`);
      }
      variationTempsRef.current = [];
      utils.boards.getItems.invalidate({ boardId });
      utils.boardOps.listEdges.invalidate({ boardId });
      utils.credits.getBalance.invalidate();
    },
    onError: (err) => {
      const temps = variationTempsRef.current;
      variationTempsRef.current = [];
      setPendingForks((pf) => pf.filter((p) => !temps.some((t) => t.tempId === p.id)));
      for (const t of temps) failJob(t.tempId, err.message);
      utils.boards.getItems.invalidate({ boardId });
      toast.error(err.message);
    },
  });

  useEffect(() => {
    const onRunVariations = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; count: number; positions: Array<{ x: number; y: number }> }>).detail;
      if (!detail || detail.itemId <= 0 || runVariationsMutation.isPending) return;
      const temps = detail.positions.map((pos, index) => {
        const tempId = -(Date.now() + index);
        startJob({ itemId: tempId, operation: 'runVariations', estimatedDurationMs: 30_000 });
        return {
          temp: {
            id: tempId,
            type: 'model',
            kind: 'image',
            label: null,
            imageUrl: null,
            positionX: pos.x,
            positionY: pos.y,
            width: 280,
            height: 420,
            zIndex: 0,
            metadata: { provenance: { type: 'library_cast', modelId: -1, viewAngle: 'frontClose', draft: true } },
            sourceModelId: null,
          } as BoardItemRecord,
          tempId,
          index,
        };
      });
      variationTempsRef.current = temps.map(({ tempId, index }) => ({ tempId, index }));
      setPendingForks((pf) => [...pf, ...temps.map((t) => t.temp)]);
      runVariationsMutation.mutate({ boardId, itemId: detail.itemId, count: detail.count });
    };
    window.addEventListener('board-run-variations', onRunVariations);
    return () => window.removeEventListener('board-run-variations', onRunVariations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // ── R4: duplicate — Cmd+C/V alias here too (same-board, D-39 ruling 5) ────
  // A structural copy: provenance/attributes ride along, status/pin/version
  // history do not (the copy starts life clean at v1 with the same image).
  const duplicateNodeMutation = trpc.boardOps.createNode.execute.useMutation({
    onMutate: async (vars) => {
      await utils.boards.getItems.cancel({ boardId });
      const prev = utils.boards.getItems.getData({ boardId });
      const tempId = -Date.now();
      type ItemsRow = NonNullable<typeof prev>[number];
      const tempRow = {
        id: tempId,
        boardId,
        type: 'model',
        kind: vars.kind,
        label: vars.label ?? null,
        imageUrl: vars.imageUrl ?? null,
        imageKey: null,
        positionX: Math.round(vars.position.x),
        positionY: Math.round(vars.position.y),
        width: vars.size?.width ?? 280,
        height: vars.size?.height ?? 420,
        zIndex: 0,
        parentItemId: null,
        sourceModelId: null,
        sourceGarmentId: null,
        sourceSessionId: null,
        sourceLookId: null,
        metadata: vars.metadata ?? {},
        deletedAt: null,
        createdAt: new Date(),
      } as unknown as ItemsRow;
      utils.boards.getItems.setData({ boardId }, (old) => [...(old ?? []), tempRow]);
      return { prev, tempId };
    },
    onSuccess: (result, _vars, ctx) => {
      utils.boards.getItems.setData({ boardId }, (old) =>
        old?.map((i) => (i.id === ctx?.tempId ? { ...i, id: result.itemId } : i)),
      );
      utils.boards.getItems.invalidate({ boardId });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.getItems.setData({ boardId }, ctx.prev);
      toast.error(err.message);
    },
  });

  const handleDuplicateNode = useCallback(
    (itemId: number) => {
      const item = itemsRef.current?.find((i) => i.id === itemId);
      if (!item || itemId <= 0) return;
      const meta = (item.metadata ?? {}) as Record<string, unknown>;
      const metadata: Record<string, unknown> = {};
      if (meta.provenance) metadata.provenance = meta.provenance;
      if (meta.attributes) metadata.attributes = meta.attributes;
      if (meta.userPrompt) metadata.userPrompt = meta.userPrompt;
      duplicateNodeMutation.mutate({
        boardId,
        kind: (item.kind ?? 'image') as 'image' | 'cast_config' | 'note' | 'frame',
        provenance: (meta.provenance as Record<string, unknown> | undefined) ?? null,
        position: { x: item.positionX + 40, y: item.positionY + 40 },
        size: { width: item.width, height: item.height },
        label: item.label ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        metadata,
      });
    },
    [boardId, duplicateNodeMutation],
  );
  const handleDuplicateRef = useRef(handleDuplicateNode);
  handleDuplicateRef.current = handleDuplicateNode;
  // Group-action ref for the keyboard path (defined below; refs bridge the
  // declaration order the same way handleDuplicateRef does)
  const handleGroupActionRef = useRef<(action: 'duplicate' | 'download' | 'delete' | 'tidy', itemIds: number[]) => void>(() => {});

  useEffect(() => {
    const onDuplicate = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: number }>).detail?.itemId;
      if (typeof itemId === 'number') handleDuplicateRef.current(itemId);
    };
    window.addEventListener('board-duplicate-node', onDuplicate);
    return () => window.removeEventListener('board-duplicate-node', onDuplicate);
  }, []);

  // R4: toolbar Delete — routes into the same trust-net path as the keyboard
  useEffect(() => {
    const onDelete = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: number }>).detail?.itemId;
      if (typeof itemId === 'number' && itemId > 0) handleDeleteRef.current([itemId]);
    };
    window.addEventListener('board-delete-node', onDelete);
    return () => window.removeEventListener('board-delete-node', onDelete);
  }, []);

  // ── Keyboard model (Decision 7 — full table, R4) ─────────────────────────
  // Nudges batch into one undoable move: prev positions captured on the first
  // press, one undo entry + one moveNodes persist 500ms after the last press.
  const nudgeBatchRef = useRef<{
    prev: Map<number, { x: number; y: number }>;
    last: Map<number, { x: number; y: number }>;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const flushNudgeBatch = useCallback(() => {
    const batch = nudgeBatchRef.current;
    nudgeBatchRef.current = null;
    if (!batch || batch.prev.size === 0) return;
    pushUndo({
      kind: 'move',
      moves: Array.from(batch.prev, ([itemId, pos]) => ({ itemId, x: pos.x, y: pos.y })),
    });
    const moves = Array.from(batch.last, ([itemId, pos]) => ({ itemId, x: pos.x, y: pos.y }));
    for (const m of moves) recentMovesRef.current.set(m.itemId, { x: m.x, y: m.y });
    const persistable = moves.filter((m) => m.itemId > 0);
    if (persistable.length > 0) moveNodesMutation.mutate({ boardId, moves: persistable });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      // The takeover captures its own Esc; every other overlay makes the
      // board's keyboard inert (their own handlers own the keys)
      const overlayOpen =
        imageViewer !== null || castTakeoverItemId !== null || castEditContext !== null;

      // Esc — strictly the topmost layer (Decision 7 / DS §9)
      if (e.key === 'Escape') {
        if (typing || overlayOpen) return;
        if (hasOpenCanvasLayers()) return; // node popovers close themselves
        if (addNodeMenu) { setAddNodeMenu(null); return; }
        if (nodeContextMenu) { setNodeContextMenu(null); return; }
        if (deleteConfirm) { setDeleteConfirm(null); return; }
        if (infoPanel) { setInfoPanel(null); return; }
        if (versionHistoryItemId !== null) { setVersionHistoryItemId(null); return; }
        if (castPickerItemId !== null) { setCastPickerItemId(null); return; }
        if (placementMode) {
          setPlacementMode(null);
          setActiveTool('select');
          return;
        }
        // Bottom of the stack: clear selection
        clearSelectionRef.current?.();
        setSelectedItemId(null);
        return;
      }

      if (typing || overlayOpen || deleteConfirm) return;

      // Delete / Backspace — the trust net (soft delete + Undo)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = selectedItemIdsRef.current.filter((id) => id > 0);
        if (ids.length > 0) {
          e.preventDefault();
          handleDeleteRef.current(ids);
        }
        return;
      }

      // Arrow nudge — 1 canvas unit, Shift = 16; batched as one undoable move
      const arrow: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      if (arrow[e.key]) {
        const step = e.shiftKey ? 16 : 1;
        const [dx, dy] = arrow[e.key];
        const moved = nudgeSelectionRef.current?.(dx * step, dy * step) ?? [];
        if (moved.length === 0) return;
        e.preventDefault();
        const batch = nudgeBatchRef.current ?? { prev: new Map(), last: new Map(), timer: null };
        for (const m of moved) {
          if (!batch.prev.has(m.itemId)) batch.prev.set(m.itemId, { x: m.prevX, y: m.prevY });
          batch.last.set(m.itemId, { x: m.x, y: m.y });
        }
        if (batch.timer) clearTimeout(batch.timer);
        batch.timer = setTimeout(flushNudgeBatch, 500);
        nudgeBatchRef.current = batch;
        return;
      }

      // Cmd/Ctrl+A — select all
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllRef.current?.();
        return;
      }

      // Cmd/Ctrl+Z — undo (delete and move, scoped per D-17)
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const entry = undoStackRef.current[undoStackRef.current.length - 1];
        if (entry) {
          e.preventDefault();
          undoEntryRef.current(entry);
        }
        return;
      }

      // Cmd/Ctrl+C / V — alias Duplicate for same-board (founder ruling,
      // D-39 ratification line 5; cross-board paste is a logged future
      // D-16 amendment, not R4 scope)
      if (mod && e.key.toLowerCase() === 'c') {
        // Never hijack a real text copy
        if (window.getSelection()?.toString()) return;
        const ids = selectedItemIdsRef.current.filter((id) => id > 0);
        if (ids.length > 0) clipboardRef.current = ids;
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current.length === 0) return;
        e.preventDefault();
        // Through the GROUP path — a pasted set must carry its intra-set
        // edges (VC-R6b drive: the per-node loop pasted lineage-less pairs
        // while the toolbar Duplicate carried them)
        handleGroupActionRef.current('duplicate', clipboardRef.current);
        return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    imageViewer, castTakeoverItemId, castEditContext, placementMode,
    addNodeMenu, nodeContextMenu, infoPanel, versionHistoryItemId,
    castPickerItemId, deleteConfirm, flushNudgeBatch,
  ]);

  // ── Placement mode click handler ───────────────────────
  const handlePlacementClick = useCallback(
    (flowPos: { x: number; y: number }) => {
      if (!placementMode || !boardId) return;

      if (placementMode === 'note') {
        addItemMutation.mutate({
          boardId,
          type: 'note',
          label: '',
          width: 280,
          height: 200,
          positionX: flowPos.x,
          positionY: flowPos.y,
        });
      }

      setPlacementMode(null);
      setActiveTool('select');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placementMode, boardId],
  );

  // ── Inline cast creation (M4 — foundations 3a) ─────────────
  // Optimistic (VC2 fix #3): a temp row renders instantly; the server confirm
  // swaps the temp id for the real one in place (no invalidation flicker), and
  // any position the user set meanwhile transfers to the real id.
  const createCastNodeMutation = trpc.boardOps.createNode.execute.useMutation({
    onMutate: async (vars) => {
      await utils.boards.getItems.cancel({ boardId });
      const prev = utils.boards.getItems.getData({ boardId });
      const tempId = -Date.now();
      type ItemsRow = NonNullable<typeof prev>[number];
      const tempRow = {
        id: tempId,
        boardId,
        type: 'model',
        kind: 'cast_config',
        label: null,
        imageUrl: null,
        imageKey: null,
        positionX: Math.round(vars.position.x),
        positionY: Math.round(vars.position.y),
        width: vars.size?.width ?? 280,
        height: vars.size?.height ?? 420,
        zIndex: 0,
        parentItemId: null,
        sourceModelId: null,
        sourceGarmentId: null,
        sourceSessionId: null,
        sourceLookId: null,
        metadata: {},
        deletedAt: null,
        createdAt: new Date(),
      } as unknown as ItemsRow;
      utils.boards.getItems.setData({ boardId }, (old) => [...(old ?? []), tempRow]);
      selectNodeRef.current?.(tempId);
      return { prev, tempId };
    },
    onSuccess: (result, _vars, ctx) => {
      // Swap temp → real in place; transfer any local move to the real id
      const move = ctx?.tempId ? recentMovesRef.current.get(ctx.tempId) : undefined;
      if (ctx?.tempId && move) {
        recentMovesRef.current.delete(ctx.tempId);
        recentMovesRef.current.set(result.itemId, move);
        updateItemMutation.mutate({ itemId: result.itemId, positionX: move.x, positionY: move.y });
      }
      utils.boards.getItems.setData({ boardId }, (old) =>
        old?.map((i) =>
          i.id === ctx?.tempId
            ? { ...i, id: result.itemId, positionX: move?.x ?? i.positionX, positionY: move?.y ?? i.positionY }
            : i,
        ),
      );
      // If the picker/takeover was opened on the temp node, follow it to the real id
      setCastPickerItemId((prev) => (prev === ctx?.tempId ? result.itemId : prev));
      setCastTakeoverItemId((prev) => (prev === ctx?.tempId ? result.itemId : prev));
      selectNodeRef.current?.(result.itemId);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.getItems.setData({ boardId }, ctx.prev);
      toast.error('Failed to add cast node');
    },
  });

  const castDropCountRef = useRef(0);
  /** ONE creation path for every entry point (VC2 fix #4): right-click passes
   *  the cursor's flow position; the pill and Add menu default to center. */
  const handleAddCast = useCallback((flowPos?: { x: number; y: number } | null) => {
    let position: { x: number; y: number };
    if (flowPos) {
      position = { x: flowPos.x - 130, y: flowPos.y - 20 };
    } else {
      const center = viewportCenterGetterRef.current?.() ?? { x: 0, y: 0 };
      // Consecutive center-drops step right so nodes land beside each other
      const offset = (castDropCountRef.current++ % 4) * 300;
      position = { x: center.x - 130 + offset, y: center.y - 130 };
    }
    createCastNodeMutation.mutate({
      boardId,
      kind: 'cast_config',
      provenance: null,
      position,
      size: { width: 280, height: 420 }, // 280 × (3:4 image + prompt row)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const handleAddNodeAction = useCallback(
    (action: AddNodeAction) => {
      switch (action) {
        case 'cast':
          // Right-click menus carry the cursor's flow position; pill/center adds don't
          handleAddCast(contextMenuFlowPosRef.current);
          contextMenuFlowPosRef.current = null;
          break;
        case 'wardrobe':
          setActivePanel('wardrobe');
          setActiveTool('wardrobe');
          break;
        case 'note':
          setPlacementMode('note');
          setActiveTool('note');
          break;
        case 'upload':
        case 'reference':
          toast.info('Feature coming soon');
          break;
      }
      setAddNodeMenu(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleAddCast],
  );

  const handleToolSelect = useCallback(
    (tool: CanvasToolId | 'hand') => {
      setActiveTool(tool);
      // Clear placement mode when switching to a non-placement tool
      if (tool !== 'note') {
        setPlacementMode(null);
      }
      switch (tool) {
        case 'select':
        case 'hand': // R1 pointer cluster — pan tool, no panel
          setActivePanel(null);
          break;
        case 'cast':
          handleAddCast();
          break;
        case 'wardrobe':
          setActivePanel('wardrobe');
          break;
        case 'reference':
        case 'upload':
          toast.info('Feature coming soon');
          break;
        case 'note':
          setPlacementMode('note');
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleAddCast],
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setNodeContextMenu(null);
      // Capture the cursor's flow position NOW (pan/zoom may change before the pick)
      contextMenuFlowPosRef.current =
        screenToFlowRef.current?.({ x: e.clientX, y: e.clientY }) ?? null;
      setAddNodeMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleNodeContextMenu = useCallback(
    (itemId: number, e: React.MouseEvent) => {
      e.preventDefault();
      setAddNodeMenu(null);
      const item = items?.find((i) => i.id === itemId);
      setNodeContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: itemId,
        imageUrl: item?.imageUrl ?? null,
      });
    },
    [items],
  );

  // ── D-50 group actions — one handler behind both surfaces (toolbar +
  // context menu; Focus never reaches here — it's viewport work in BoardCanvas)
  const handleGroupAction = useCallback(
    (action: 'duplicate' | 'download' | 'delete' | 'tidy', itemIds: number[]) => {
      switch (action) {
        case 'tidy': {
          // D-50.3 (banked v1 spec): row-major pack over MEASURED dims,
          // reading-order sort (y then x), 60px gutters, row height = tallest
          // node in row, wrapped at the selection's own footprint width.
          // ONE batched moveNodes + ONE undo entry — Cmd+Z reverses the
          // whole tidy (ratified requirement).
          const geo = nodeGeometryRef.current?.(itemIds) ?? [];
          if (geo.length < 2) break;
          const GUTTER = 60;
          const originX = Math.min(...geo.map((g) => g.x));
          const originY = Math.min(...geo.map((g) => g.y));
          const rowWidth = Math.max(
            Math.max(...geo.map((g) => g.x + g.width)) - originX,
            Math.max(...geo.map((g) => g.width)),
          );
          const sorted = [...geo].sort((a, b) => a.y - b.y || a.x - b.x);
          const moves: Array<{ itemId: number; x: number; y: number }> = [];
          let cursorX = originX;
          let cursorY = originY;
          let rowHeight = 0;
          for (const g of sorted) {
            if (cursorX > originX && cursorX + g.width > originX + rowWidth) {
              cursorX = originX;
              cursorY += rowHeight + GUTTER;
              rowHeight = 0;
            }
            moves.push({ itemId: g.itemId, x: cursorX, y: cursorY });
            cursorX += g.width + GUTTER;
            rowHeight = Math.max(rowHeight, g.height);
          }
          const byId = new Map(geo.map((g) => [g.itemId, g]));
          if (moves.every((m) => byId.get(m.itemId)!.x === m.x && byId.get(m.itemId)!.y === m.y)) break;
          pushUndo({ kind: 'move', moves: geo.map((g) => ({ itemId: g.itemId, x: g.x, y: g.y })) });
          setPositionsRef.current?.(moves);
          for (const m of moves) recentMovesRef.current.set(m.itemId, { x: m.x, y: m.y });
          const persistable = moves.filter((m) => m.itemId > 0);
          if (persistable.length > 0) moveNodesMutation.mutate({ boardId, moves: persistable });
          break;
        }
        case 'duplicate': {
          // Single copy keeps the optimistic per-node path. A SET duplicates
          // with its relationships (VC-R6b bug 2): server-confirmed ids are
          // mapped old→new, then every edge whose BOTH endpoints were copied
          // is re-created between the copies — provenance carried, lineage
          // honest. (The set path trades the optimistic landing for id truth;
          // copies appear on the confirm roundtrip.)
          if (itemIds.length === 1) {
            window.dispatchEvent(new CustomEvent('board-duplicate-node', { detail: { itemId: itemIds[0] } }));
            break;
          }
          void (async () => {
            try {
              const idMap = new Map<number, number>();
              for (const id of itemIds) {
                const item = itemsRef.current?.find((i) => i.id === id);
                if (!item || id <= 0) continue;
                const meta = (item.metadata ?? {}) as Record<string, unknown>;
                const metadata: Record<string, unknown> = {};
                if (meta.provenance) metadata.provenance = meta.provenance;
                if (meta.attributes) metadata.attributes = meta.attributes;
                if (meta.userPrompt) metadata.userPrompt = meta.userPrompt;
                const result = await utils.client.boardOps.createNode.execute.mutate({
                  boardId,
                  kind: (item.kind ?? 'image') as 'image' | 'cast_config' | 'note' | 'frame',
                  provenance: (meta.provenance as Record<string, unknown> | undefined) ?? null,
                  position: { x: item.positionX + 40, y: item.positionY + 40 },
                  size: { width: item.width, height: item.height },
                  label: item.label ?? undefined,
                  imageUrl: item.imageUrl ?? undefined,
                  metadata,
                });
                idMap.set(id, result.itemId);
              }
              // Server truth, not the render cache — optimistic/raw-created
              // edges may not have reached the client cache yet
              const liveEdges = await utils.boardOps.listEdges.fetch({ boardId });
              for (const edge of liveEdges ?? []) {
                const s = idMap.get(edge.source);
                const t = idMap.get(edge.target);
                if (s && t) {
                  await utils.client.boardOps.addEdge.mutate({
                    boardId,
                    sourceItemId: s,
                    targetItemId: t,
                    relation: edge.relation as never,
                    metadata: (edge.metadata as Record<string, unknown> | null) ?? undefined,
                  });
                }
              }
              void utils.boards.getItems.invalidate({ boardId });
              void utils.boardOps.listEdges.invalidate({ boardId });
              // The copies become the live selection (founder, drive 2) —
              // originals deselect so the pasted group moves to clear space
              window.dispatchEvent(
                new CustomEvent('board-select-items', {
                  detail: { itemIds: Array.from(idMap.values()) },
                }),
              );
            } catch {
              toast.error("Couldn't duplicate the selection — try again");
              void utils.boards.getItems.invalidate({ boardId });
            }
          })();
          break;
        }
        case 'download': {
          // VC-R6b bug 5: one ZIP, fetched through the image proxy — N direct
          // cross-origin anchor downloads both spammed the browser and failed
          // ("file wasn't available on site"). The export pack's pattern.
          void (async () => {
            const targets = itemIds
              .map((id) => itemsRef.current?.find((i) => i.id === id))
              .filter((i): i is NonNullable<typeof i> => !!i?.imageUrl);
            if (targets.length === 0) return;
            try {
              const zip = new JSZip();
              const used = new Set<string>();
              for (const item of targets) {
                const proxy = await utils.client.generation.proxyImage.mutate({
                  imageUrl: item.imageUrl!,
                });
                if (!proxy.success || !proxy.base64) continue;
                const b64 = proxy.base64.split(',')[1] ?? proxy.base64;
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                let name = `${(item.label ?? `item-${item.id}`).replace(/[^a-zA-Z0-9 _-]/g, '')}.png`;
                if (used.has(name)) name = `${name.slice(0, -4)}-${item.id}.png`;
                used.add(name);
                zip.file(name, bytes);
              }
              const blob = await zip.generateAsync({ type: 'blob' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'drape-selection.zip';
              a.click();
              URL.revokeObjectURL(url);
            } catch {
              toast.error("Couldn't build the download — try again");
            }
          })();
          break;
        }
        case 'delete':
          // The existing trust net: cascade prediction + the one red confirm
          // covers the whole set (D-50.2)
          handleDeleteRef.current(itemIds);
          break;
      }
    },
    [],
  );
  handleGroupActionRef.current = handleGroupAction;

  const [groupContextMenu, setGroupContextMenu] = useState<{ x: number; y: number; itemIds: number[] } | null>(null);

  const handleNodeContextAction = useCallback(
    (action: NodeContextAction, nodeId: number) => {
      switch (action) {
        case 'rename': {
          // Dispatch a custom event that BoardItemNode listens for
          window.dispatchEvent(new CustomEvent('board-rename-node', { detail: { itemId: nodeId } }));
          break;
        }
        case 'info': {
          // Open info panel near the context menu position
          const pos = nodeContextMenu
            ? { x: nodeContextMenu.x, y: nodeContextMenu.y }
            : { x: 400, y: 300 };
          setInfoPanel({ itemId: nodeId, position: pos });
          break;
        }
        case 'collapse':
          // R5: the popped view returns to its comp card (DS §5.17)
          collapseMutation.mutate({ boardId, itemId: nodeId });
          break;
        case 'delete':
          handleItemDelete(nodeId);
          break;
        default:
          break;
      }
    },
    [handleItemDelete, nodeContextMenu, collapseMutation, boardId],
  );

  // ── Derived state ──────────────────────────────────────────

  const viewport = useMemo(() => {
    if (!board?.viewportX && !board?.viewportY) return undefined;
    return {
      x: board.viewportX ?? 0,
      y: board.viewportY ?? 0,
      zoom: (board.viewportZoom ?? 100) / 100,
    };
  }, [board]);

  const canvasItems: BoardItemRecord[] = useMemo(() => {
    const mapped = (items ?? []).map((item) => {
        // Apply the local-moves ledger: local position wins until the server
        // echoes it back, then the entry self-prunes (VC2 fix #3)
        const localMove = recentMovesRef.current.get(item.id);
        if (localMove && localMove.x === item.positionX && localMove.y === item.positionY) {
          recentMovesRef.current.delete(item.id);
        }
        const positionX = localMove?.x ?? item.positionX;
        const positionY = localMove?.y ?? item.positionY;
        // Fill-ledger overlay (D-38): client intent outlives cache churn —
        // applied until the server row itself carries the image
        const fill = !item.imageUrl ? optimisticFills[item.id] : undefined;
        return {
          id: item.id,
          type: item.type as BoardItemRecord['type'],
          kind: item.kind as BoardItemRecord['kind'],
          label: fill ? (fill.label ?? item.label) : item.label,
          imageUrl: item.imageUrl ?? fill?.imageUrl ?? null,
          positionX,
          positionY,
          width: item.width,
          height: item.height,
          zIndex: item.zIndex,
          metadata: fill
            ? {
                ...((item.metadata as Record<string, unknown> | null) ?? {}),
                provenance: {
                  type: 'library_cast',
                  modelId: fill.modelId,
                  viewAngle: 'frontClose',
                  ...(fill.draft ? { draft: true } : {}),
                },
                status: null,
                isGenerating: false,
              }
            : (item.metadata as Record<string, unknown> | null),
          sourceModelId: item.sourceModelId,
        };
      });
    // Pending forks overlay the cache (bug-3 fix) — refetches can't clobber
    // them; entries self-prune once the server row arrives (effect above)
    const pending = pendingForks.filter((p) => !mapped.some((m) => m.id === p.id));
    return pending.length > 0 ? [...mapped, ...pending] : mapped;
  }, [items, pendingForks, optimisticFills]);

  // R5 edge rendering feed: lineage class only (D-50.5 — input edges are
  // pass-2 dataflow), both endpoints alive (soft-deleted rows leave orphan
  // edges in the table by design; they must not render dangling)
  const lineageEdges = useMemo(() => {
    if (!boardEdges?.length) return [];
    const alive = new Set(canvasItems.map((i) => i.id));
    return boardEdges.filter(
      (e) => isLineageEdge(e.relation) && alive.has(e.source) && alive.has(e.target),
    );
  }, [boardEdges, canvasItems]);

  const isSaving =
    renameMutation.isPending ||
    saveViewportMutation.isPending ||
    updateItemMutation.isPending;

  // ── Error / loading states ─────────────────────────────────

  if (isNaN(boardId)) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#FAFAF8' }}>
        <p style={{ color: '#71716A', fontSize: 15 }}>Invalid canvas ID</p>
      </div>
    );
  }

  if (boardLoading || itemsLoading) {
    // Designed loading state (P1): the space reads as a board from frame one —
    // dotted grid immediately, centered mark, hairline progress. Never a bare
    // spinner.
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100vh', background: 'var(--color-canvas-field)' }}>
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{ height: 52, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="rounded animate-pulse" style={{ width: 80, height: 20, background: 'rgba(0,0,0,0.06)' }} />
        </div>
        <div className="flex-1 relative" style={{ background: 'var(--color-canvas-field)' }}>
          <DottedGridBackground />
          <BrandLoader />
        </div>
      </div>
    );
  }

  if (boardError || !board) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: '#FAFAF8' }}>
        <p style={{ color: '#71716A', fontSize: 15 }}>
          {boardError?.message === 'Board not found'
            ? "This canvas doesn't exist or was deleted."
            : 'Failed to load canvas.'}
        </p>
        <button
          onClick={() => navigate('/app')}
          className="px-4 py-2 rounded-lg"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: '#1a1a1a',
          }}
        >
          Back to boards
        </button>
      </div>
    );
  }

  return (
    // canvas-scope: light theme container for the canvas + its primitives (D-22).
    // overflow-hidden: the board page owns the viewport — page scroll must not
    // exist, so the wheel always reaches React Flow as zoom (VC2 fix #2).
    <div className="canvas-scope flex flex-col overflow-hidden" style={{ height: '100vh', background: 'var(--color-canvas-field)' }}>
      <BoardHeader
        name={board.name}
        onRename={handleRename}
        isSaving={isSaving}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area — full width, no left rail */}
        <div
          className="flex-1 relative"
          onContextMenu={handleCanvasContextMenu}
          onClick={() => {
            if (addNodeMenu) setAddNodeMenu(null);
            if (nodeContextMenu) setNodeContextMenu(null);
          }}
        >
          <BoardCanvas
            items={canvasItems}
            lineageEdges={lineageEdges}
            viewport={viewport}
            onItemMove={handleItemMove}
            onItemResize={handleItemResize}
            onItemDelete={handleItemDelete}
            onItemRename={handleItemRename}
            onVersionHistory={(itemId) => setVersionHistoryItemId(itemId)}
            onViewportChange={handleViewportChange}
            onNodeSelect={handleNodeSelect}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
            onGroupAction={handleGroupAction}
            onSelectionContextMenu={(itemIds, position) => {
              setAddNodeMenu(null);
              setNodeContextMenu(null);
              setGroupContextMenu({ x: position.x, y: position.y, itemIds });
            }}
            onPaneClick={() => {
              setAddNodeMenu(null);
              setNodeContextMenu(null);
              setGroupContextMenu(null);
            }}
            onPaneClickWithPosition={placementMode ? handlePlacementClick : undefined}
            crosshairCursor={!!placementMode}
            onViewportCenterRef={(getter) => {
              viewportCenterGetterRef.current = getter;
            }}
            onScrollToNodeRef={(scroller) => {
              scrollToNodeRef.current = scroller;
            }}
            boardId={boardId}
            onSelectNodeRef={(selector) => {
              selectNodeRef.current = selector;
            }}
            onScreenToFlowRef={(fn) => {
              screenToFlowRef.current = fn;
            }}
            onSelectionIdsChange={(ids) => {
              selectedItemIdsRef.current = ids;
            }}
            onNudgeSelectionRef={(nudger) => {
              nudgeSelectionRef.current = nudger;
            }}
            onSelectAllRef={(selectAll) => {
              selectAllRef.current = selectAll;
            }}
            onClearSelectionRef={(clear) => {
              clearSelectionRef.current = clear;
            }}
            onSetPositionsRef={(setter) => {
              setPositionsRef.current = setter;
            }}
            onGetNodeGeometryRef={(getter) => {
              nodeGeometryRef.current = getter;
            }}
            pointerTool={activeTool === 'hand' ? 'hand' : 'select'}
            className="absolute inset-0"
          >
            {/* Bottom canvas UI — rendered inside ReactFlow for context access */}
            <CanvasZoomControls />
            <FloatingToolPill
              activeTool={
                activeTool === 'note' ? 'note' : activeTool === 'hand' ? 'hand' : 'select'
              }
              onSelectTool={(tool: PillTool) => {
                if (tool === 'cast') {
                  // Ruling B: flat pill — Cast is a direct verb, no popup.
                  // Spawns at viewport center; right-click keeps the at-cursor menu.
                  contextMenuFlowPosRef.current = null;
                  handleAddCast(null);
                  return;
                }
                handleToolSelect(tool);
              }}
            />
            <CanvasChatToggle />
          </BoardCanvas>

          {/* Empty state (VC-R5 follow-up ruling A): QUIET — dotted grid + one
              tertiary line. No floating affordance, no modal; the pill carries
              the invitation (ruling B) and D-9's ghost-composition first-run
              owns onboarding when it lands (R6). */}
          {canvasItems.length === 0 && !itemsLoading && !boardLoading && !activePanel && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 5 }}
            >
              <p className="text-canvas-xs" style={{ color: '#a1a19a' }}>
                Add a cast to begin
              </p>
            </div>
          )}

        </div>

        {/* Right tool panel */}
        {activePanel && (
          <div
            className="flex flex-col flex-shrink-0 overflow-y-auto"
            style={{
              width: 380,
              background: '#fff',
              borderLeft: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-5 flex-shrink-0"
              style={{
                height: 52,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                {activePanel === 'wardrobe' && 'Style an Outfit'}
                {activePanel === 'export' && 'Export'}
              </span>
              <button
                onClick={() => {
                  setActivePanel(null);
                  setActiveTool('select');
                }}
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{
                  color: '#71716A',
                  fontSize: 16,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                ✕
              </button>
            </div>

            {/* Panel body — casting is now inline on the canvas (M4);
                wardrobe arrives as canvas nodes in pass 2 */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
                  {activePanel === 'wardrobe' && 'Wardrobe Panel'}
                  {activePanel === 'export' && 'Export Panel'}
                </p>
                <p style={{ fontSize: 13, color: '#a1a19a' }}>
                  Tool integration coming soon.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Node Menu — appears on + click or right-click */}
      {addNodeMenu && (
        <AddNodeMenu
          position={addNodeMenu}
          onSelect={handleAddNodeAction}
          onClose={() => setAddNodeMenu(null)}
        />
      )}

      {/* Group context menu (D-50.1) — parity with the group toolbar */}
      {groupContextMenu && (
        <GroupContextMenu
          x={groupContextMenu.x}
          y={groupContextMenu.y}
          itemIds={groupContextMenu.itemIds}
          onAction={(action, itemIds) => {
            if (action === 'focus') {
              // Focus routes through the canvas' viewport — reuse scroll-to on
              // the first node then let fitView handle it via the toolbar path
              window.dispatchEvent(new CustomEvent('board-group-focus', { detail: { itemIds } }));
              return;
            }
            handleGroupAction(action, itemIds);
          }}
          onClose={() => setGroupContextMenu(null)}
        />
      )}

      {/* Pin-spawn menu (R5/D-36a) — drag from an out-pin into empty canvas */}
      {spawnMenu && (
        <SpawnMenu
          itemId={spawnMenu.itemId}
          modelId={spawnMenu.modelId}
          x={spawnMenu.x}
          y={spawnMenu.y}
          flowX={spawnMenu.flowX}
          flowY={spawnMenu.flowY}
          poppedAngles={pinSpawnPopped}
          onClose={() => setSpawnMenu(null)}
        />
      )}

      {/* Node Context Menu — appears on right-click on a node */}
      {nodeContextMenu && (
        <NodeContextMenu
          position={{ x: nodeContextMenu.x, y: nodeContextMenu.y }}
          nodeId={nodeContextMenu.nodeId}
          imageUrl={nodeContextMenu.imageUrl}
          canCollapse={(() => {
            const item = items?.find((i) => i.id === nodeContextMenu.nodeId);
            const meta = (item?.metadata ?? {}) as { provenance?: { type?: string } };
            return meta.provenance?.type === 'cast_view';
          })()}
          onAction={handleNodeContextAction}
          onClose={() => setNodeContextMenu(null)}
        />
      )}

      {/* Delete cascade confirm — the one red confirm in the app (D-8/D-43) */}
      {deleteConfirm && (
        <DeleteCascadeDialog
          cascadeCount={deleteConfirm.cascadeCount}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            const ids = deleteConfirm.itemIds;
            setDeleteConfirm(null);
            deleteNodesMutation.mutate({ boardId, itemIds: ids });
          }}
        />
      )}

      {/* Node Info Panel — popout near the right-clicked image */}
      {infoPanel && (
        <NodeInfoPanel
          itemId={infoPanel.itemId}
          position={infoPanel.position}
          onClose={() => setInfoPanel(null)}
        />
      )}

      {/* Double-click image viewer — VIEW-ONLY on the canvas (VC-R5 R3):
          zoom/pan/download; editing lives in the environment via Edit */}
      {imageViewer && (
        <CanvasImageViewer
          imageUrl={imageViewer.url}
          label={imageViewer.label}
          onClose={() => setImageViewer(null)}
        />
      )}

      {/* Cast picker — the empty cast node's front door (D-32/D-33) */}
      {castPickerItemId !== null && (
        <CastPickerModal
          boardId={boardId}
          itemId={castPickerItemId}
          onClose={() => setCastPickerItemId(null)}
          onCastNew={() => {
            setCastTakeoverItemId(castPickerItemId);
            setCastPickerItemId(null);
          }}
        />
      )}

      {/* Casting takeover (D-35) — the environment opens over the untouched
          board: new casts, draft promotion, and minted edits (R3) */}
      {(castTakeoverItemId !== null || castEditContext !== null) && (
        <CastingTakeover
          user={user}
          isAuthenticated={isAuthenticated}
          editContext={castEditContext}
          onMinted={handleTakeoverMinted}
          onIdentityCommit={handleIdentityCommit}
          onClose={() => {
            setCastTakeoverItemId(null);
            setCastEditContext(null);
          }}
          // D-38 straggler: the session's client-held slot heads paint the
          // mosaic the instant the room folds — patch the packageState cache
          // from plain data, then revalidate behind (the mint path's pattern)
          onSessionSlots={(modelId, slots) => {
            utils.generation.packageState.setData({ modelId }, (old) =>
              old
                ? {
                    ...old,
                    slots: old.slots.map((s) => {
                      const held = slots.find((h) => h.angle === s.angle);
                      return held && held.url !== s.url ? { ...s, url: held.url } : s;
                    }),
                  }
                : old,
            );
            void utils.generation.packageState.invalidate({ modelId });
          }}
        />
      )}

      {/* Version history modal */}
      {versionHistoryItemId !== null && (() => {
        const vhItem = canvasItems.find((i) => i.id === versionHistoryItemId);
        return (
          <VersionHistoryModal
            itemId={versionHistoryItemId}
            boardId={boardId}
            currentImageUrl={vhItem?.imageUrl ?? null}
            onClose={() => setVersionHistoryItemId(null)}
          />
        );
      })()}
    </div>
  );
}

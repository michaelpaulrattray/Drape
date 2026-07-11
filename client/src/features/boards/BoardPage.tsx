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
import { Loader2, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BoardCanvas, type BoardItemRecord } from './BoardCanvas';
import { BoardHeader } from './BoardHeader';
import { ModelEditorOverlay } from './overlays/ModelEditorOverlay';
import { AddNodeMenu, type AddNodeAction } from './components/AddNodeMenu';
import { type CanvasToolId } from './components/CanvasToolbar';
import { FloatingToolPill, type PillTool } from './canvas/FloatingToolPill';
import { CastPickerModal } from './canvas/CastPickerModal';
import { DottedGridBackground } from './canvas/DottedGridBackground';
import { BrandLoader } from '@/components/BrandLoader';
import { CastingTakeover, type CastEditContext } from '@/features/studio/takeover/CastingTakeover';
import { useGenerationJobs } from './stores/useGenerationJobs';
import { useAuth } from '@/_core/hooks/useAuth';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { CanvasChatToggle } from './components/CanvasChatToggle';
import { NodeContextMenu, type NodeContextAction } from './components/NodeContextMenu';
import { NodeInfoPanel } from './components/NodeInfoPanel';
import { VersionHistoryModal } from './components/VersionHistoryModal';

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
  const [activeTool, setActiveTool] = useState<CanvasToolId>('select');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [editorItemId, setEditorItemId] = useState<number | null>(null);
  const [addNodeMenu, setAddNodeMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: number;
    imageUrl: string | null;
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

  // Placement mode: 'note' or 'frame' — cursor becomes crosshair, next pane click places the node
  const [placementMode, setPlacementMode] = useState<'note' | 'frame' | null>(null);

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

  // ── Mutations ──────────────────────────────────────────────

  const renameMutation = trpc.boards.update.useMutation({
    onSuccess: () => utils.boards.get.invalidate({ id: boardId }),
    onError: () => toast.error('Failed to rename canvas'),
  });

  const saveViewportMutation = trpc.boards.saveViewport.useMutation();

  const updateItemMutation = trpc.boards.updateItem.useMutation({
    onSuccess: () => utils.boards.getItems.invalidate({ boardId }),
  });

  const deleteItemMutation = trpc.boards.deleteItem.useMutation({
    onMutate: async ({ itemId }) => {
      await utils.boards.getItems.cancel({ boardId });
      const prev = utils.boards.getItems.getData({ boardId });
      utils.boards.getItems.setData({ boardId }, (old) =>
        old ? old.filter((i) => i.id !== itemId) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.getItems.setData({ boardId }, ctx.prev);
      toast.error('Failed to delete item');
    },
    onSettled: () => utils.boards.getItems.invalidate({ boardId }),
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

  const handleItemMove = useCallback(
    (itemId: number, x: number, y: number) => {
      recentMovesRef.current.set(itemId, { x, y });
      if (itemId > 0) {
        // Negative ids are optimistic temp nodes — their move is recorded and
        // transferred to the real id at swap time (see createCastNodeMutation)
        updateItemMutation.mutate({ itemId, positionX: x, positionY: y });
      }
    },
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

  const handleItemDelete = useCallback(
    (itemId: number) => {
      deleteItemMutation.mutate({ itemId });
    },
    [deleteItemMutation],
  );

  const handleItemRename = useCallback(
    (itemId: number, label: string) => {
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
    const item = items?.find((i) => i.id === itemId);
    if (item?.type === 'model') {
      setEditorItemId(itemId);
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

  // R3: the cast node's Edit action — the environment opens on the model
  useEffect(() => {
    const onEditCast = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: number; modelId: number | null; draft: boolean }>).detail;
      if (!detail || typeof detail.itemId !== 'number' || !detail.modelId) return;
      setCastEditContext({
        boardId,
        itemId: detail.itemId,
        modelId: detail.modelId,
        draft: !!detail.draft,
      });
    };
    window.addEventListener('board-edit-cast', onEditCast);
    return () => window.removeEventListener('board-edit-cast', onEditCast);
  }, [boardId]);

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
      // the draft badge
      const itemId = castEditContext?.itemId ?? castTakeoverItemId;
      setCastTakeoverItemId(null);
      setCastEditContext(null);
      if (itemId === null || itemId <= 0) return;
      utils.boards.getItems.setData({ boardId }, (old) =>
        old?.map((i) =>
          i.id === itemId
            ? {
                ...i,
                imageUrl: info.headshotUrl ?? i.imageUrl,
                label: info.name || i.label,
                metadata: {
                  ...((i.metadata as Record<string, unknown> | null) ?? {}),
                  provenance: { type: 'library_cast', modelId, viewAngle: 'frontClose' },
                  status: null,
                  isGenerating: false,
                },
              }
            : i,
        ),
      );
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
  useEffect(() => {
    if (!items) return;
    setPendingForks((pf) => pf.filter((p) => !items.some((i) => i.id === p.id)));
  }, [items]);

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
        // once the refetch delivers the server row
        setPendingForks((pf) =>
          pf.map((p) => (p.id === ctx.tempId ? { ...p, id: result.newItemId!, imageUrl: result.imageUrl } : p)),
        );
      } else {
        completeJob(vars.itemId);
      }
      utils.boards.getItems.invalidate({ boardId });
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

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape cancels placement mode
      if (e.key === 'Escape' && placementMode) {
        setPlacementMode(null);
        setActiveTool('select');
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // Don't delete while typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      // Don't delete while an overlay (editor, casting takeover) is open
      if (editorItemId !== null || castTakeoverItemId !== null || castEditContext !== null) return;
      if (selectedItemId !== null) {
        e.preventDefault();
        handleItemDelete(selectedItemId);
        setSelectedItemId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, editorItemId, castTakeoverItemId, castEditContext, handleItemDelete, placementMode]);

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
      } else if (placementMode === 'frame') {
        addItemMutation.mutate({
          boardId,
          type: 'frame',
          label: 'Untitled Frame',
          width: 600,
          height: 400,
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
        case 'frame':
          setPlacementMode('frame');
          setActiveTool('frame');
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
    (tool: CanvasToolId) => {
      setActiveTool(tool);
      // Clear placement mode when switching to a non-placement tool
      if (tool !== 'note' && tool !== 'frame') {
        setPlacementMode(null);
      }
      switch (tool) {
        case 'select':
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
        case 'frame':
          setPlacementMode('frame');
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
        case 'delete':
          handleItemDelete(nodeId);
          break;
        default:
          break;
      }
    },
    [handleItemDelete, nodeContextMenu],
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
        return {
          id: item.id,
          type: item.type as BoardItemRecord['type'],
          kind: item.kind as BoardItemRecord['kind'],
          label: item.label,
          imageUrl: item.imageUrl,
          positionX,
          positionY,
          width: item.width,
          height: item.height,
          zIndex: item.zIndex,
          metadata: item.metadata as Record<string, unknown> | null,
          sourceModelId: item.sourceModelId,
        };
      });
    // Pending forks overlay the cache (bug-3 fix) — refetches can't clobber
    // them; entries self-prune once the server row arrives (effect above)
    const pending = pendingForks.filter((p) => !mapped.some((m) => m.id === p.id));
    return pending.length > 0 ? [...mapped, ...pending] : mapped;
  }, [items, pendingForks]);

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
      <div className="flex flex-col overflow-hidden" style={{ height: '100vh', background: '#FAFAF8' }}>
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{ height: 52, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="rounded animate-pulse" style={{ width: 80, height: 20, background: 'rgba(0,0,0,0.06)' }} />
        </div>
        <div className="flex-1 relative" style={{ background: '#DFDFDF' }}>
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
    <div className="canvas-scope flex flex-col overflow-hidden" style={{ height: '100vh', background: '#FAFAF8' }}>
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
            onPaneClick={() => {
              setAddNodeMenu(null);
              setNodeContextMenu(null);
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
            className="absolute inset-0"
          >
            {/* Bottom canvas UI — rendered inside ReactFlow for context access */}
            <CanvasZoomControls />
            <FloatingToolPill
              activeTool={
                activeTool === 'note' ? 'note' : activeTool === 'frame' ? 'frame' : 'select'
              }
              onSelectTool={(tool: PillTool) => {
                if (tool === 'add') {
                  // Pill adds spawn at viewport center — clear any stale cursor pos
                  contextMenuFlowPosRef.current = null;
                  setAddNodeMenu({ x: window.innerWidth / 2 - 90, y: window.innerHeight - 320 });
                  return;
                }
                handleToolSelect(tool);
              }}
            />
            <CanvasChatToggle />
          </BoardCanvas>

          {/* Empty state — minimal "+" button */}
          {canvasItems.length === 0 && !itemsLoading && !boardLoading && !activePanel && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 5 }}
            >
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setAddNodeMenu({ x: rect.right + 8, y: rect.top });
                }}
                className="pointer-events-auto flex items-center justify-center rounded-full transition-all duration-200"
                style={{
                  width: 40,
                  height: 40,
                  background: 'rgba(0,0,0,0.05)',
                  color: '#52524B',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Plus size={18} strokeWidth={2} />
              </button>
              <p
                className="pointer-events-none mt-2.5"
                style={{ fontSize: 12, color: '#a1a19a', fontWeight: 400 }}
              >
                Click to add a node
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

      {/* Node Context Menu — appears on right-click on a node */}
      {nodeContextMenu && (
        <NodeContextMenu
          position={{ x: nodeContextMenu.x, y: nodeContextMenu.y }}
          nodeId={nodeContextMenu.nodeId}
          imageUrl={nodeContextMenu.imageUrl}
          onAction={handleNodeContextAction}
          onClose={() => setNodeContextMenu(null)}
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

      {/* Model Editor Overlay — popout, triggered by double-clicking a model card */}
      {editorItemId !== null && (() => {
        const editorItem = canvasItems.find((i) => i.id === editorItemId);
        return (
          <ModelEditorOverlay
            itemId={editorItemId}
            boardId={boardId}
            imageUrl={editorItem?.imageUrl ?? null}
            label={editorItem?.label}
            sourceModelId={editorItem?.sourceModelId ?? null}
            onClose={() => setEditorItemId(null)}
          />
        );
      })()}

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

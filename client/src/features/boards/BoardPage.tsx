/**
 * BoardPage — The /app/board/:id workspace.
 *
 * Loads a board from DB, renders items on the infinite canvas,
 * and hosts a collapsible tool panel on the right side.
 * Bottom-of-canvas UI: centered toolbar, zoom controls (left), AI chat (right).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BoardCanvas, type BoardItemRecord } from './BoardCanvas';
import { BoardHeader } from './BoardHeader';
import { BoardCastingPanel } from './panels/BoardCastingPanel';
import { ModelEditorOverlay } from './overlays/ModelEditorOverlay';
import { AddNodeMenu, type AddNodeAction } from './components/AddNodeMenu';
import { CanvasToolbar, type CanvasToolId } from './components/CanvasToolbar';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { CanvasChatToggle } from './components/CanvasChatToggle';
import { NodeContextMenu, type NodeContextAction, type ViewAngle } from './components/NodeContextMenu';
import { NodeInfoPanel } from './components/NodeInfoPanel';
import { VersionHistoryModal } from './components/VersionHistoryModal';

/* ── Types ────────────────────────────────────────────────── */

type ToolPanelId = 'casting' | 'wardrobe' | 'export' | null;

/* ── Dev-only density mock gate (PASS_1_BUILD_PLAN.md M1 / VC1) ── */

const DensityMock = import.meta.env.DEV
  ? lazy(() => import('./canvas/DensityMock'))
  : null;

/* ── Component ────────────────────────────────────────────── */

export function BoardPage() {
  if (DensityMock && new URLSearchParams(window.location.search).get('mock') === 'density') {
    return (
      <Suspense fallback={null}>
        <DensityMock />
      </Suspense>
    );
  }
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
    nodeType: string;
    imageUrl: string | null;
  } | null>(null);
  const [infoPanel, setInfoPanel] = useState<{ itemId: number; position: { x: number; y: number } } | null>(null);
  const [versionHistoryItemId, setVersionHistoryItemId] = useState<number | null>(null);

  // Viewport center getter exposed by BoardCanvas
  const viewportCenterGetterRef = useRef<(() => { x: number; y: number }) | null>(null);
  // Smooth scroll-to-node function exposed by BoardCanvas
  const scrollToNodeRef = useRef<((itemId: number) => void) | null>(null);

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

  const iterateMutation = trpc.generation.iterate.useMutation();
  const addVersionMutation = trpc.boards.addItemVersion.useMutation();
  const addItemMutation = trpc.boards.addItem.useMutation({
    onSuccess: () => {
      if (boardId) utils.boards.getItems.invalidate({ boardId });
    },
  });

  // ── Handlers ───────────────────────────────────────────────

  const handleRename = useCallback(
    (name: string) => {
      renameMutation.mutate({ boardId, name });
    },
    [boardId, renameMutation],
  );

  const handleItemMove = useCallback(
    (itemId: number, x: number, y: number) => {
      updateItemMutation.mutate({ itemId, positionX: x, positionY: y });
    },
    [updateItemMutation],
  );

  const handleItemResize = useCallback(
    (itemId: number, width: number, height: number) => {
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
      // Don't delete while editor overlay or context menu is open
      if (editorItemId !== null) return;
      if (selectedItemId !== null) {
        e.preventDefault();
        handleItemDelete(selectedItemId);
        setSelectedItemId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, editorItemId, handleItemDelete, placementMode]);

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

  const handleModelGenerated = useCallback((_itemId: number) => {
    // Model card was inserted onto the canvas
  }, []);

  const handleAddNodeAction = useCallback(
    (action: AddNodeAction) => {
      switch (action) {
        case 'cast':
          setActivePanel('casting');
          setActiveTool('cast');
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
    [],
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
          setActivePanel('casting');
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
    [],
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setNodeContextMenu(null);
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
        nodeType: item?.type ?? 'reference',
        imageUrl: item?.imageUrl ?? null,
      });
    },
    [items],
  );

  const handleNodeContextAction = useCallback(
    (action: NodeContextAction, nodeId: number) => {
      switch (action) {
        case 'modify_iterate':
          setEditorItemId(nodeId);
          break;
        case 'wardrobe':
          setSelectedItemId(nodeId);
          setActivePanel('wardrobe');
          setActiveTool('wardrobe');
          break;
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
        case 'remove_bg':
        case 'upscale':
        case 'extract_palette':
          toast.info('Feature coming soon');
          break;
        default:
          break;
      }
    },
    [handleItemDelete, items, nodeContextMenu],
  );

  const handleViewGenerate = useCallback(
    (nodeId: number, angle: ViewAngle) => {
      const angleName = angle === 'three_quarter' ? '3/4' : angle;
      toast.info(`Generating ${angleName} view — coming soon`);
    },
    [],
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

  const canvasItems: BoardItemRecord[] = useMemo(
    () =>
      (items ?? []).map((item) => ({
        id: item.id,
        type: item.type as BoardItemRecord['type'],
        label: item.label,
        imageUrl: item.imageUrl,
        positionX: item.positionX,
        positionY: item.positionY,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
        metadata: item.metadata as Record<string, unknown> | null,
        sourceModelId: item.sourceModelId,
      })),
    [items],
  );

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
    return (
      <div className="flex-1 flex flex-col" style={{ background: '#FAFAF8' }}>
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{ height: 52, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="rounded animate-pulse" style={{ width: 80, height: 20, background: 'rgba(0,0,0,0.06)' }} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a1a19a' }} />
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
    <div className="flex flex-col" style={{ height: '100vh', background: '#FAFAF8' }}>
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
            className="absolute inset-0"
          >
            {/* Bottom canvas UI — rendered inside ReactFlow for context access */}
            <CanvasZoomControls />
            <CanvasToolbar activeTool={activeTool} onToolSelect={handleToolSelect} />
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
                {activePanel === 'casting' && 'Cast a Model'}
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

            {/* Panel body */}
            {activePanel === 'casting' ? (
              <BoardCastingPanel
                boardId={boardId}
                onModelGenerated={handleModelGenerated}
                getViewportCenter={viewportCenterGetterRef.current ?? undefined}
                scrollToNode={scrollToNodeRef.current ?? undefined}
              />
            ) : (
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
            )}
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
          nodeType={nodeContextMenu.nodeType}
          imageUrl={nodeContextMenu.imageUrl}
          onAction={handleNodeContextAction}
          onViewGenerate={handleViewGenerate}
          onPromptSubmit={async (nId, prompt) => {
            const item = items?.find((i) => i.id === nId);
            if (!item?.sourceModelId) {
              toast.error('This item has no linked model for iteration');
              return;
            }
            // Get model info to find the latest asset ID
            const modelInfo = await utils.boards.getItemModelInfo.fetch({ itemId: nId });
            const assetId = modelInfo?.latestAssetId;
            if (!assetId) {
              toast.error('No asset found for this model');
              return;
            }
            setNodeContextMenu(null);
            const toastId = toast.loading(`Iterating: "${prompt}"...`);
            try {
              // Save current image as a version before iterating
              if (item.imageUrl) {
                await addVersionMutation.mutateAsync({
                  itemId: nId,
                  imageUrl: item.imageUrl,
                  prompt: 'Original',
                  tool: 'initial',
                });
              }
              // Call iterate
              const result = await iterateMutation.mutateAsync({
                modelId: item.sourceModelId,
                feedback: prompt,
                assetId,
              });
              if (result.success && result.imageUrl) {
                // Update the board item image
                await updateItemMutation.mutateAsync({
                  itemId: nId,
                  imageUrl: result.imageUrl,
                });
                // Save new version
                await addVersionMutation.mutateAsync({
                  itemId: nId,
                  imageUrl: result.imageUrl,
                  prompt,
                  tool: 'chat',
                });
                utils.boards.getItemVersionCount.invalidate({ itemId: nId });
                toast.success('Iteration complete', { id: toastId });
              } else {
                toast.error('Iteration failed — no image returned', { id: toastId });
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Iteration failed';
              toast.error(msg, { id: toastId });
            }
          }}
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

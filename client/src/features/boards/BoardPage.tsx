/**
 * BoardPage — The /app/board/:id workspace.
 *
 * Loads a board from DB, renders items on the infinite canvas,
 * and hosts a collapsible tool panel on the right side.
 * Bottom-of-canvas UI: centered toolbar, zoom controls (left), AI chat (right).
 */
import { useCallback, useMemo, useState } from 'react';
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
import { NodeContextMenu, type NodeContextAction } from './components/NodeContextMenu';

/* ── Types ────────────────────────────────────────────────── */

type ToolPanelId = 'casting' | 'wardrobe' | 'export' | null;

/* ── Component ────────────────────────────────────────────── */

export function BoardPage() {
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
    onError: () => toast.error('Failed to rename board'),
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
        case 'upload':
        case 'reference':
        case 'note':
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
        case 'note':
          toast.info('Feature coming soon');
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
        imageUrl: item?.imageUrl ?? null,
      });
    },
    [items],
  );

  const handleNodeContextAction = useCallback(
    (action: NodeContextAction, nodeId: number) => {
      switch (action) {
        case 'style_outfit':
          setSelectedItemId(nodeId);
          setActivePanel('wardrobe');
          setActiveTool('wardrobe');
          break;
        case 'rename': {
          // Trigger inline rename — for now toast
          toast.info('Double-click the node label to rename');
          break;
        }
        case 'delete':
          handleItemDelete(nodeId);
          break;
        case 'remove_bg':
        case 'upscale':
        case 'duplicate':
          toast.info('Feature coming soon');
          break;
        // open_new_tab, download, copy_url handled inline by NodeContextMenu
        default:
          break;
      }
    },
    [handleItemDelete],
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
        <p style={{ color: '#71716A', fontSize: 15 }}>Invalid board ID</p>
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
            ? "This board doesn't exist or was deleted."
            : 'Failed to load board.'}
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
            onItemDelete={handleItemDelete}
            onItemRename={handleItemRename}
            onViewportChange={handleViewportChange}
            onNodeSelect={handleNodeSelect}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneClick={() => {
              setAddNodeMenu(null);
              setNodeContextMenu(null);
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
          imageUrl={nodeContextMenu.imageUrl}
          onAction={handleNodeContextAction}
          onClose={() => setNodeContextMenu(null)}
        />
      )}

      {/* Model Editor Overlay — popout, triggered by double-clicking a model card */}
      {editorItemId !== null && (() => {
        const editorItem = canvasItems.find((i) => i.id === editorItemId);
        return (
          <ModelEditorOverlay
            itemId={editorItemId}
            imageUrl={editorItem?.imageUrl ?? null}
            label={editorItem?.label}
            onClose={() => setEditorItemId(null)}
          />
        );
      })()}
    </div>
  );
}

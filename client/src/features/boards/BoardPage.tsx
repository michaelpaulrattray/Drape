/**
 * BoardPage — The /app/board/:id workspace.
 *
 * Loads a board from DB, renders items on the infinite canvas,
 * and hosts a collapsible tool panel on the right side.
 * Casting panel is wired; double-click a model card to open the editor overlay.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { toast } from 'sonner';
import { Loader2, ScanFace, Palette, PackageCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { BoardCanvas, type BoardItemRecord } from './BoardCanvas';
import { BoardHeader } from './BoardHeader';
import { BoardCastingPanel } from './panels/BoardCastingPanel';
import { ModelEditorOverlay } from './overlays/ModelEditorOverlay';

/* ── Types ────────────────────────────────────────────────── */

type ToolPanelId = 'casting' | 'wardrobe' | 'export' | null;

/* ── Component ────────────────────────────────────────────── */

export function BoardPage() {
  const [, params] = useRoute('/app/board/:id');
  const [, navigate] = useLocation();
  const boardId = params?.id ? parseInt(params.id, 10) : NaN;

  const [activePanel, setActivePanel] = useState<ToolPanelId>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [editorItemId, setEditorItemId] = useState<number | null>(null);

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
    // Find the item to check if it's a model type
    const item = items?.find((i) => i.id === itemId);
    if (item?.type === 'model') {
      setEditorItemId(itemId);
    }
  }, [items]);

  const handleModelGenerated = useCallback((_itemId: number) => {
    // Model card was inserted onto the canvas — could scroll to it, etc.
  }, []);

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

  // ── Tool panel buttons ─────────────────────────────────────

  const toolButtons: { id: ToolPanelId; icon: typeof ScanFace; label: string }[] = [
    { id: 'casting', icon: ScanFace, label: 'Cast' },
    { id: 'wardrobe', icon: Palette, label: 'Style' },
    { id: 'export', icon: PackageCheck, label: 'Export' },
  ];

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: '#FAFAF8' }}>
      <BoardHeader
        name={board.name}
        onRename={handleRename}
        isSaving={isSaving}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Tool rail (left edge) */}
        <div
          className="flex flex-col items-center gap-1 py-3 flex-shrink-0"
          style={{
            width: 52,
            background: '#FAFAF8',
            borderRight: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {toolButtons.map(({ id, icon: Icon, label }) => {
            const isActive = activePanel === id;
            return (
              <button
                key={id}
                onClick={() => setActivePanel(isActive ? null : id)}
                className="w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-0.5"
                style={{
                  background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                  color: isActive ? '#1a1a1a' : '#888',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                title={label}
              >
                <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
                <span style={{ fontSize: 9, fontWeight: 500, lineHeight: 1 }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative">
          <BoardCanvas
            items={canvasItems}
            viewport={viewport}
            onItemMove={handleItemMove}
            onItemDelete={handleItemDelete}
            onItemRename={handleItemRename}
            onViewportChange={handleViewportChange}
            onNodeSelect={handleNodeSelect}
            onNodeDoubleClick={handleNodeDoubleClick}
            className="absolute inset-0"
          />

          {/* Empty state overlay — only show after data has loaded, hide when panel is open */}
          {canvasItems.length === 0 && !itemsLoading && !boardLoading && !activePanel && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 5 }}
            >
              <div
                className="flex flex-col items-center gap-4 pointer-events-auto"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 16,
                  padding: '32px 40px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#1a1a1a',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Your canvas is empty
                </p>
                <p style={{ fontSize: 13, color: '#71716A', textAlign: 'center', maxWidth: 280 }}>
                  Select a tool from the left rail to start creating, or drag assets onto the canvas.
                </p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setActivePanel('casting')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      background: '#1a1a1a',
                    }}
                  >
                    <ScanFace className="w-4 h-4" strokeWidth={1.5} />
                    Cast a Model
                  </button>
                  <button
                    onClick={() => setActivePanel('wardrobe')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      background: 'rgba(0,0,0,0.04)',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    <Palette className="w-4 h-4" strokeWidth={1.5} />
                    Style an Outfit
                  </button>
                </div>
              </div>
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
                onClick={() => setActivePanel(null)}
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
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: '#F5F3F0' }}
                  >
                    {activePanel === 'wardrobe' && <Palette className="w-5 h-5" style={{ color: '#52524B' }} strokeWidth={1.5} />}
                    {activePanel === 'export' && <PackageCheck className="w-5 h-5" style={{ color: '#52524B' }} strokeWidth={1.5} />}
                  </div>
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

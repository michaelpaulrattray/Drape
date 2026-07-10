/**
 * RecentWorkSection — the unified resume feed on /app.
 *
 * Renders lobby.recentWork as a card grid. Owns the non-board delete
 * mutations (wardrobe sessions, draft casts); board actions come in via
 * useBoardMutations from the parent. Renders nothing when the feed is
 * empty — the Tools index then leads the page.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { RecentWorkCard } from './RecentWorkCard';
import type { RecentWorkItem } from './types';

function itemKey(item: RecentWorkItem): string {
  switch (item.tool) {
    case 'canvas':
      return `canvas-${item.boardId}`;
    case 'wardrobe':
      return `wardrobe-${item.sessionId}`;
    case 'casting':
      return `casting-${item.modelId}`;
  }
}

interface RecentWorkSectionProps {
  items: RecentWorkItem[];
  onDeleteBoard: (boardId: number) => void;
  onRenameBoard: (boardId: number, name: string) => void;
  onArchiveBoard: (boardId: number) => void;
}

export function RecentWorkSection({
  items,
  onDeleteBoard,
  onRenameBoard,
  onArchiveBoard,
}: RecentWorkSectionProps) {
  const utils = trpc.useUtils();
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const deleteSessionMutation = trpc.wardrobe.sessions.delete.useMutation({
    onMutate: async ({ sessionId }) => {
      await utils.lobby.recentWork.cancel();
      const prev = utils.lobby.recentWork.getData();
      utils.lobby.recentWork.setData(undefined, (old) =>
        old ? old.filter((i) => !(i.tool === 'wardrobe' && i.sessionId === sessionId)) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.lobby.recentWork.setData(undefined, ctx.prev);
      toast.error('Failed to delete session');
    },
    onSuccess: () => toast.success('Session deleted'),
    onSettled: () => {
      utils.lobby.recentWork.invalidate();
      utils.wardrobe.sessions.getRecent.invalidate();
    },
  });

  const deleteDraftMutation = trpc.models.delete.useMutation({
    onMutate: async ({ modelId }) => {
      await utils.lobby.recentWork.cancel();
      const prev = utils.lobby.recentWork.getData();
      utils.lobby.recentWork.setData(undefined, (old) =>
        old ? old.filter((i) => !(i.tool === 'casting' && i.modelId === modelId)) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.lobby.recentWork.setData(undefined, ctx.prev);
      toast.error('Failed to delete draft');
    },
    onSuccess: () => toast.success('Draft deleted'),
    onSettled: () => {
      utils.lobby.recentWork.invalidate();
      utils.wardrobe.model.listDrafts.invalidate();
    },
  });

  if (items.length === 0) return null;

  const handleDelete = (item: RecentWorkItem) => {
    setDeletingKey(itemKey(item));
    switch (item.tool) {
      case 'canvas':
        onDeleteBoard(item.boardId);
        break;
      case 'wardrobe':
        deleteSessionMutation.mutate({ sessionId: item.sessionId });
        break;
      case 'casting':
        deleteDraftMutation.mutate({ modelId: item.modelId });
        break;
    }
  };

  return (
    <section>
      <h2
        className="mb-4"
        style={{ fontSize: 13, fontWeight: 600, color: '#71716A', letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        Recent
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => (
          <RecentWorkCard
            key={itemKey(item)}
            item={item}
            onDelete={handleDelete}
            onRenameBoard={onRenameBoard}
            onArchiveBoard={onArchiveBoard}
            isDeleting={deletingKey === itemKey(item)}
          />
        ))}
      </div>
    </section>
  );
}

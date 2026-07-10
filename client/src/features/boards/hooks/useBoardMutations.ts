/**
 * useBoardMutations — board create/rename/archive/delete for the lobby.
 *
 * Extracted from BoardLobby so the unified /app lobby can act on boards
 * without owning them. Optimistic updates target the lobby.recentWork
 * feed (the lobby's source of truth); boards.list is invalidated too so
 * any board-level views stay fresh.
 */
import { useCallback } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export function useBoardMutations() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const invalidate = () => {
    utils.lobby.recentWork.invalidate();
    utils.boards.list.invalidate();
  };

  const createBoardMutation = trpc.boards.create.useMutation({
    onSuccess: (board) => {
      invalidate();
      navigate(`/app/board/${board.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create canvas');
    },
  });

  const deleteBoardMutation = trpc.boards.delete.useMutation({
    onMutate: async ({ boardId }: { boardId: number }) => {
      await utils.lobby.recentWork.cancel();
      const prev = utils.lobby.recentWork.getData();
      utils.lobby.recentWork.setData(undefined, (old) =>
        old ? old.filter((i) => !(i.tool === 'canvas' && i.boardId === boardId)) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.lobby.recentWork.setData(undefined, ctx.prev);
      toast.error('Failed to delete canvas');
    },
    onSuccess: () => toast.success('Canvas deleted'),
    onSettled: invalidate,
  });

  const archiveBoardMutation = trpc.boards.update.useMutation({
    onMutate: async ({ boardId }: { boardId: number }) => {
      await utils.lobby.recentWork.cancel();
      const prev = utils.lobby.recentWork.getData();
      utils.lobby.recentWork.setData(undefined, (old) =>
        old ? old.filter((i) => !(i.tool === 'canvas' && i.boardId === boardId)) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.lobby.recentWork.setData(undefined, ctx.prev);
      toast.error('Failed to archive canvas');
    },
    onSuccess: () => toast.success('Canvas archived'),
    onSettled: invalidate,
  });

  const renameBoardMutation = trpc.boards.update.useMutation({
    onMutate: async ({ boardId, name }) => {
      await utils.lobby.recentWork.cancel();
      const prev = utils.lobby.recentWork.getData();
      utils.lobby.recentWork.setData(undefined, (old) =>
        old?.map((i) =>
          i.tool === 'canvas' && i.boardId === boardId ? { ...i, name: name! } : i,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.lobby.recentWork.setData(undefined, ctx.prev);
      toast.error('Failed to rename canvas');
    },
    onSettled: invalidate,
  });

  const createBoard = useCallback(
    (startedWith: 'casting' | 'wardrobe' | 'blank') => {
      if (createBoardMutation.isPending) return;
      createBoardMutation.mutate({ name: 'Untitled Canvas', startedWith });
    },
    [createBoardMutation],
  );

  const deleteBoard = useCallback(
    (boardId: number) => deleteBoardMutation.mutate({ boardId }),
    [deleteBoardMutation],
  );

  const archiveBoard = useCallback(
    (boardId: number) => archiveBoardMutation.mutate({ boardId, status: 'archived' }),
    [archiveBoardMutation],
  );

  const renameBoard = useCallback(
    (boardId: number, name: string) => renameBoardMutation.mutate({ boardId, name }),
    [renameBoardMutation],
  );

  return {
    createBoard,
    deleteBoard,
    archiveBoard,
    renameBoard,
    isCreating: createBoardMutation.isPending,
  };
}

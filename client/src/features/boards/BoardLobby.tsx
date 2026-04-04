/**
 * BoardLobby — The /app landing page.
 *
 * Shows a grid of the user's boards with "New Board" entry points.
 * Creating a board navigates to /app/board/:id.
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Plus, ScanFace, Palette, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { BoardCard } from './BoardCard';

interface BoardLobbyProps {
  user: { id: number; name: string | null; avatarUrl?: string | null } | null;
  onLogout: () => void;
}

export function BoardLobby({ user, onLogout }: BoardLobbyProps) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // ── Queries ────────────────────────────────────────────────
  const { data: boards, isLoading } = trpc.boards.list.useQuery(
    { status: 'active' },
    { staleTime: 15_000 },
  );

  // ── Mutations ──────────────────────────────────────────────
  const createBoardMutation = trpc.boards.create.useMutation({
    onSuccess: (board) => {
      navigate(`/app/board/${board.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create board');
    },
  });

  const deleteBoardMutation = trpc.boards.delete.useMutation({
    onMutate: async ({ boardId }: { boardId: number }) => {
      await utils.boards.list.cancel();
      const prev = utils.boards.list.getData({ status: 'active' });
      utils.boards.list.setData({ status: 'active' }, (old) =>
        old ? old.filter((b) => b.id !== boardId) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.list.setData({ status: 'active' }, ctx.prev);
      toast.error('Failed to delete board');
    },
    onSuccess: () => toast.success('Board deleted'),
    onSettled: () => utils.boards.list.invalidate(),
  });

  const archiveBoardMutation = trpc.boards.update.useMutation({
    onMutate: async ({ boardId }: { boardId: number }) => {
      await utils.boards.list.cancel();
      const prev = utils.boards.list.getData({ status: 'active' });
      utils.boards.list.setData({ status: 'active' }, (old) =>
        old ? old.filter((b) => b.id !== boardId) : [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.list.setData({ status: 'active' }, ctx.prev);
      toast.error('Failed to archive board');
    },
    onSuccess: () => toast.success('Board archived'),
    onSettled: () => utils.boards.list.invalidate(),
  });

  const renameBoardMutation = trpc.boards.update.useMutation({
    onMutate: async ({ boardId, name }) => {
      await utils.boards.list.cancel();
      const prev = utils.boards.list.getData({ status: 'active' });
      utils.boards.list.setData({ status: 'active' }, (old) =>
        old?.map((b) => (b.id === boardId ? { ...b, name: name! } : b)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.boards.list.setData({ status: 'active' }, ctx.prev);
      toast.error('Failed to rename board');
    },
    onSettled: () => utils.boards.list.invalidate(),
  });

  // ── Handlers ───────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = useCallback(
    (startedWith: 'casting' | 'wardrobe') => {
      if (createBoardMutation.isPending) return;
      createBoardMutation.mutate({ name: 'Untitled Board', startedWith });
    },
    [createBoardMutation],
  );

  const handleDelete = useCallback(
    (id: number) => {
      setDeletingId(id);
      deleteBoardMutation.mutate({ boardId: id });
    },
    [deleteBoardMutation],
  );

  const handleArchive = useCallback(
    (id: number) => {
      archiveBoardMutation.mutate({ boardId: id, status: 'archived' });
    },
    [archiveBoardMutation],
  );

  const handleRename = useCallback(
    (id: number, name: string) => {
      renameBoardMutation.mutate({ boardId: id, name });
    },
    [renameBoardMutation],
  );

  // ── Entrance animation ────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  const boardList = boards ?? [];

  // ── Loading skeleton ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-6 sm:p-10" style={{ background: '#f8f7f4' }}>
        <div className="w-full mx-auto" style={{ maxWidth: 1080 }}>
          <div className="rounded-lg animate-pulse mb-8" style={{ width: 200, height: 28, background: 'rgba(0,0,0,0.05)' }} />
          <div className="flex gap-5 mb-10">
            <div className="flex-1 rounded-2xl animate-pulse" style={{ height: 160, background: 'rgba(0,0,0,0.03)' }} />
            <div className="flex-1 rounded-2xl animate-pulse" style={{ height: 160, background: 'rgba(0,0,0,0.05)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ height: 240, background: 'rgba(0,0,0,0.03)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" style={{ background: '#f8f7f4' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 sm:px-10 py-5"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <img
          src="/drape-logo.svg"
          alt="drape"
          style={{ height: 22 }}
        />
        <div className="flex items-center gap-3">
          {user && (
            <button
              onClick={() => navigate('/studio')}
              className="px-3 py-1.5 rounded-lg"
              style={{
                fontSize: 13,
                color: '#71716A',
                background: 'rgba(0,0,0,0.04)',
                fontWeight: 500,
              }}
            >
              Classic Studio
            </button>
          )}
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.name ?? 'User'}
              className="w-8 h-8 rounded-full object-cover"
              style={{ border: '2px solid rgba(0,0,0,0.06)' }}
            />
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 sm:px-10 pb-10" style={{ maxWidth: 1080, width: '100%', margin: '0 auto' }}>
        {/* Title */}
        <div
          className="mb-8"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.05s',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 700,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            Your{' '}
            <span className="font-heading italic" style={{ fontWeight: 400 }}>boards</span>
          </h1>
          <p style={{ fontSize: 15, color: '#71716A', marginTop: 4 }}>
            Each board is a persistent workspace for your creative projects.
          </p>
        </div>

        {/* New Board CTAs */}
        <div
          className="flex flex-col sm:flex-row gap-4 mb-10"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
          }}
        >
          {/* Cast a Model */}
          <button
            onClick={() => handleCreate('casting')}
            disabled={createBoardMutation.isPending}
            className="group flex-1 flex items-center gap-4 px-6 py-5 rounded-2xl"
            style={{
              background: '#1a1a1a',
              cursor: createBoardMutation.isPending ? 'wait' : 'pointer',
              opacity: createBoardMutation.isPending ? 0.7 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              {createBoardMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fff' }} />
              ) : (
                <ScanFace className="w-5 h-5" style={{ color: '#fff' }} strokeWidth={1.5} />
              )}
            </div>
            <div className="text-left">
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', display: 'block' }}>
                Cast a Model
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', display: 'block', marginTop: 2 }}>
                AI-generate a model from your casting brief
              </span>
            </div>
            <Plus className="w-5 h-5 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>

          {/* Style an Outfit */}
          <button
            onClick={() => handleCreate('wardrobe')}
            disabled={createBoardMutation.isPending}
            className="group flex-1 flex items-center gap-4 px-6 py-5 rounded-2xl"
            style={{
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.08)',
              cursor: createBoardMutation.isPending ? 'wait' : 'pointer',
              opacity: createBoardMutation.isPending ? 0.7 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
              style={{ background: '#F5F3F0' }}
            >
              {createBoardMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#52524B' }} />
              ) : (
                <Palette className="w-5 h-5" style={{ color: '#52524B' }} strokeWidth={1.5} />
              )}
            </div>
            <div className="text-left">
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', display: 'block' }}>
                Style an Outfit
              </span>
              <span style={{ fontSize: 13, color: '#71716A', display: 'block', marginTop: 2 }}>
                Upload a model & dress them in any garment
              </span>
            </div>
            <Plus className="w-5 h-5 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ color: 'rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Board grid */}
        {boardList.length > 0 ? (
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
            }}
          >
            <h2
              className="mb-4"
              style={{ fontSize: 13, fontWeight: 600, color: '#71716A', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Recent
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {boardList.map((board) => (
                <BoardCard
                  key={board.id}
                  id={board.id}
                  name={board.name}
                  description={board.description}
                  startedWith={board.startedWith}
                  itemCount={0}
                  thumbnailUrl={board.thumbnailUrl}
                  updatedAt={board.updatedAt}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onArchive={handleArchive}
                  isDeleting={deletingId === board.id}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(12px)',
              transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,0,0,0.03)' }}
            >
              <Plus className="w-6 h-6" style={{ color: '#ccc' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              No boards yet
            </p>
            <p style={{ fontSize: 14, color: '#71716A', marginTop: 4, textAlign: 'center', maxWidth: 300 }}>
              Create your first board by casting a model or styling an outfit above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

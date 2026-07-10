/**
 * BoardsView — all active canvas boards, reached from the rail.
 *
 * Reuses RecentWorkCard (canvas variant) so board actions — open,
 * rename, archive, delete — behave exactly as they do in the Recent
 * feed on Home.
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useBoardMutations } from '@/features/boards/hooks/useBoardMutations';
import { RecentWorkCard } from './RecentWorkCard';
import { SearchField } from './SearchField';
import { NewItemTile } from './NewItemTile';
import type { RecentWorkItem } from './types';

type CanvasItem = Extract<RecentWorkItem, { tool: 'canvas' }>;

export function BoardsView() {
  const { data: boards, isLoading } = trpc.boards.list.useQuery(undefined, {
    staleTime: 15_000,
  });

  const { createBoard, deleteBoard, archiveBoard, renameBoard, isCreating } =
    useBoardMutations();

  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  const reveal = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  if (isLoading) {
    return (
      <div className="w-full px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12">
        <div className="rounded-lg animate-pulse mb-8" style={{ width: 160, height: 28, background: 'rgba(0,0,0,0.05)' }} />
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 240, background: 'rgba(0,0,0,0.03)' }} />
          ))}
        </div>
      </div>
    );
  }

  const items: CanvasItem[] = (boards ?? []).map((b) => ({
    tool: 'canvas' as const,
    boardId: b.id,
    name: b.name,
    thumbnailUrl: b.thumbnailUrl,
    startedWith: b.startedWith,
    updatedAt: b.updatedAt,
  }));

  const visibleItems = query.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div className="px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12 pb-16 w-full">
      {/* Title */}
      <div className="mb-10 flex items-end justify-between gap-6" style={reveal(0.05)}>
        <div>
          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 700,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            Canvas
          </h1>
          <p style={{ fontSize: 15, color: '#71716A', marginTop: 4 }}>
            {items.length === 0
              ? 'Open canvases to compose everything.'
              : `${items.length} ${items.length === 1 ? 'canvas' : 'canvases'}.`}
          </p>
        </div>
        {items.length > 0 && (
          <div className="hidden sm:block flex-shrink-0 pb-1">
            <SearchField value={query} onChange={setQuery} placeholder="Search canvases…" />
          </div>
        )}
      </div>

      {query.trim() && visibleItems.length === 0 ? (
        <p style={reveal(0.1)}>
          <span style={{ fontSize: 14, color: '#71716A' }}>
            No canvases match “{query.trim()}”.
          </span>
        </p>
      ) : (
        <div
          className="grid gap-5"
          style={{ ...reveal(0.1), gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {!query.trim() && (
            <NewItemTile
              label="New canvas"
              onClick={() => createBoard('blank')}
              pending={isCreating}
              style={{ minHeight: 246 }}
            />
          )}
          {visibleItems.map((item) => (
            <RecentWorkCard
              key={item.boardId}
              item={item}
              onDelete={() => deleteBoard(item.boardId)}
              onRenameBoard={renameBoard}
              onArchiveBoard={archiveBoard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

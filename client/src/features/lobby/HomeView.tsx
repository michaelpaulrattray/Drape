/**
 * HomeView — the default view of the /app lobby.
 *
 * Editorial index, two zones in priority order: Recent (resume work
 * across canvas boards, wardrobe sessions, and draft casts) → Tools
 * (Casting Studio / Wardrobe / New Canvas). Models, garments, and looks
 * moved to their own library views, reached from the rail.
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useBoardMutations } from '@/features/boards/hooks/useBoardMutations';
import { RecentWorkSection } from './RecentWorkSection';
import { ToolsIndex } from './ToolsIndex';

export function HomeView() {
  const { data: recentWork, isLoading } = trpc.lobby.recentWork.useQuery(undefined, {
    staleTime: 15_000,
  });

  const { createBoard, deleteBoard, archiveBoard, renameBoard, isCreating } =
    useBoardMutations();

  // ── Entrance animation ────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  const feed = recentWork ?? [];

  const reveal = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  // ── Loading skeleton ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12" style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div className="rounded-lg animate-pulse mb-8" style={{ width: 200, height: 28, background: 'rgba(0,0,0,0.05)' }} />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 240, background: 'rgba(0,0,0,0.03)' }} />
          ))}
        </div>
        <div className="flex flex-col gap-3" style={{ maxWidth: 1080 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg animate-pulse" style={{ height: 56, background: 'rgba(0,0,0,0.03)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12 pb-16"
      style={{ maxWidth: 1500, width: '100%', margin: '0 auto' }}
    >
      {/* Title */}
      <div className="mb-10" style={reveal(0.05)}>
        <h1
          style={{
            fontSize: 'clamp(24px, 4vw, 32px)',
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
          }}
        >
          Your{' '}
          <span className="font-heading italic" style={{ fontWeight: 400 }}>studio</span>
        </h1>
        <p style={{ fontSize: 15, color: '#71716A', marginTop: 4 }}>
          {feed.length > 0
            ? 'Your creative workspace. Resume recent work or start fresh.'
            : 'Start by casting your first model — then dress it in Wardrobe.'}
        </p>
      </div>

      <div className="flex flex-col gap-12">
        {feed.length > 0 && (
          <div style={reveal(0.1)}>
            <RecentWorkSection
              items={feed}
              onDeleteBoard={deleteBoard}
              onRenameBoard={renameBoard}
              onArchiveBoard={archiveBoard}
            />
          </div>
        )}

        {/* Text rows don't stretch with the workspace width — cap them */}
        <div style={{ ...reveal(feed.length > 0 ? 0.15 : 0.1), maxWidth: 1080 }}>
          <ToolsIndex
            onNewCanvas={() => createBoard('blank')}
            isCreatingCanvas={isCreating}
            firstRun={feed.length === 0}
          />
        </div>
      </div>
    </div>
  );
}

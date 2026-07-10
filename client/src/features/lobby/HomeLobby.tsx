/**
 * HomeLobby — the unified home base at /app.
 *
 * Editorial index page, three zones in priority order:
 *   Recent (resume work across canvas boards, wardrobe sessions, and
 *   draft casts) → Tools (Casting Studio / Wardrobe / New Canvas) →
 *   Library (models, garments, looks).
 *
 * Replaces both BoardLobby (/app) and StudioLobby (/studio landing).
 */
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useBoardMutations } from '@/features/boards/hooks/useBoardMutations';
import { RecentWorkSection } from './RecentWorkSection';
import { ToolsIndex } from './ToolsIndex';
import { LibrarySection } from './LibrarySection';

interface HomeLobbyProps {
  user: { id: number; name: string | null; avatarUrl?: string | null } | null;
  onLogout: () => void;
}

export function HomeLobby({ user, onLogout }: HomeLobbyProps) {
  const { data: recentWork, isLoading } = trpc.lobby.recentWork.useQuery(undefined, {
    staleTime: 15_000,
  });

  const { createBoard, deleteBoard, archiveBoard, renameBoard, isCreating } =
    useBoardMutations();

  const [menuOpen, setMenuOpen] = useState(false);

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
      <div className="flex-1 flex flex-col p-6 sm:p-10" style={{ background: '#f8f7f4' }}>
        <div className="w-full mx-auto" style={{ maxWidth: 1080 }}>
          <div className="rounded-lg animate-pulse mb-8" style={{ width: 200, height: 28, background: 'rgba(0,0,0,0.05)' }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ height: 240, background: 'rgba(0,0,0,0.03)' }} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg animate-pulse" style={{ height: 56, background: 'rgba(0,0,0,0.03)' }} />
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
        <img src="/drape-logo.svg" alt="drape" style={{ height: 22 }} />
        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="block"
              aria-label="Account menu"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: '2px solid rgba(0,0,0,0.06)' }}
                />
              ) : (
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: '#1a1a1a',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {(user.name ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-10 z-50 py-1.5 rounded-xl"
                  style={{
                    background: '#fff',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    minWidth: 140,
                  }}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2 text-left"
                    style={{ fontSize: 13, color: '#1a1a1a' }}
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 px-6 sm:px-10 pb-16" style={{ maxWidth: 1080, width: '100%', margin: '0 auto' }}>
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
            Your creative workspace. Resume recent work or start fresh.
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

          <div style={reveal(feed.length > 0 ? 0.15 : 0.1)}>
            <ToolsIndex
              onNewCanvas={() => createBoard('blank')}
              isCreatingCanvas={isCreating}
            />
          </div>

          <div style={reveal(feed.length > 0 ? 0.2 : 0.15)}>
            <LibrarySection />
          </div>
        </div>
      </div>
    </div>
  );
}

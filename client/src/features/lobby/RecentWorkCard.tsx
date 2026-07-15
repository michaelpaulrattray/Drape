/**
 * RecentWorkCard — one resumable item in the unified /app feed.
 *
 * Generalized from BoardCard: thumbnail, tool tag, name, timeAgo, and a
 * hover overflow menu whose actions depend on the item's tool.
 * Click resumes the work in its home tool.
 */
import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { MoreHorizontal, Trash2, Pencil, Archive } from 'lucide-react';
import type { RecentWorkItem } from './types';

const TOOL_LABELS: Record<RecentWorkItem['tool'], string> = {
  canvas: 'Canvas',
  wardrobe: 'Wardrobe',
  casting: 'Casting',
};

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function itemTitle(item: RecentWorkItem): string {
  switch (item.tool) {
    case 'canvas':
      return item.name;
    case 'wardrobe':
      return item.name ?? 'Uploaded model';
    case 'casting':
      return item.name ?? 'Untitled model';
  }
}

function itemMeta(item: RecentWorkItem): string {
  const ago = timeAgo(item.updatedAt);
  switch (item.tool) {
    case 'canvas':
      return ago;
    case 'wardrobe':
      return `${ago} · ${item.iterationCount} ${item.iterationCount === 1 ? 'iteration' : 'iterations'}`;
    case 'casting':
      return `${ago} · Draft`;
  }
}

function resumeUrl(item: RecentWorkItem): string {
  switch (item.tool) {
    case 'canvas':
      return `/app/board/${item.boardId}`;
    case 'wardrobe':
      return `/studio?tool=wardrobe&sessionId=${item.sessionId}`;
    case 'casting':
      return `/studio?tool=casting&modelId=${item.modelId}`;
  }
}

interface RecentWorkCardProps {
  item: RecentWorkItem;
  onDelete: (item: RecentWorkItem) => void;
  onRenameBoard: (boardId: number, name: string) => void;
  onArchiveBoard: (boardId: number) => void;
  isDeleting?: boolean;
}

export function RecentWorkCard({
  item,
  onDelete,
  onRenameBoard,
  onArchiveBoard,
  isDeleting,
}: RecentWorkCardProps) {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const title = itemTitle(item);
  const [editName, setEditName] = useState(title);

  const handleClick = useCallback(() => {
    if (isEditing || menuOpen || isDeleting) return;
    navigate(resumeUrl(item));
  }, [item, navigate, isEditing, menuOpen, isDeleting]);

  const handleRename = useCallback(() => {
    const trimmed = editName.trim();
    if (item.tool === 'canvas' && trimmed && trimmed !== title) {
      onRenameBoard(item.boardId, trimmed);
    }
    setIsEditing(false);
  }, [editName, title, item, onRenameBoard]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditing) handleClick();
      }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.06)',
        opacity: isDeleting ? 0.4 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: 180,
          background: item.thumbnailUrl ? undefined : '#F5F3F0',
        }}
      >
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              style={{
                fontSize: 40,
                fontWeight: 200,
                color: 'rgba(0,0,0,0.08)',
                fontFamily: 'var(--font-heading)',
                fontStyle: 'italic',
              }}
            >
              {TOOL_LABELS[item.tool].charAt(0)}
            </span>
          </div>
        )}

        {/* Tool badge */}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            fontSize: 11,
            fontWeight: 600,
            color: '#52524B',
            letterSpacing: '0.03em',
          }}
        >
          {TOOL_LABELS[item.tool]}
        </div>

        {/* Menu button — hover reveal */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <MoreHorizontal className="w-3.5 h-3.5" style={{ color: '#52524B' }} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                className="absolute right-0 top-9 z-50 py-1.5 rounded-xl"
                style={{
                  background: '#fff',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  minWidth: 140,
                }}
              >
                {item.tool === 'canvas' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        setIsEditing(true);
                        setEditName(title);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left"
                      style={{ fontSize: 13, color: '#1a1a1a' }}
                    >
                      <Pencil className="w-3.5 h-3.5" style={{ color: '#71716A' }} />
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onArchiveBoard(item.boardId);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left"
                      style={{ fontSize: 13, color: '#1a1a1a' }}
                    >
                      <Archive className="w-3.5 h-3.5" style={{ color: '#71716A' }} />
                      Archive
                    </button>
                    <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
                  </>
                )}
                {item.tool === 'casting' && !item.draft ? (
                  /* Batch 0 deletion ruling: minted identities cannot be
                     hard-deleted (server refuses); the affordance says so
                     honestly instead of failing on click. */
                  <div
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left cursor-default"
                    style={{ fontSize: 13, color: '#71716A' }}
                    title="Minted identities can't be deleted yet — deletion arrives with archiving."
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#B4B4AC' }} />
                    Minted — can't delete
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(item);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left"
                    style={{ fontSize: 13, color: '#dc2626' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info area */}
      <div className="px-4 py-3.5">
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full outline-none border-b"
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#1a1a1a',
              borderColor: '#1a1a1a',
              paddingBottom: 2,
              background: 'transparent',
            }}
          />
        ) : (
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#1a1a1a',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h3>
        )}
        <div
          className="flex items-center gap-2 mt-1.5"
          style={{ fontSize: 12, color: '#71716A' }}
        >
          <span>{itemMeta(item)}</span>
        </div>
      </div>

      {/* Hover border effect */}
      <style>{`
        .group:hover {
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
          border-color: rgba(0,0,0,0.1) !important;
        }
      `}</style>
    </div>
  );
}

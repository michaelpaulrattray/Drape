/**
 * BoardCard — Displays a single board in the lobby grid.
 *
 * Shows board name, thumbnail (first item image or placeholder),
 * last modified date, and item count. Click navigates to the board.
 */
import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { MoreHorizontal, Trash2, Pencil, Archive } from 'lucide-react';

interface BoardCardProps {
  id: number;
  name: string;
  description: string | null;
  startedWith: string;
  itemCount: number;
  thumbnailUrl: string | null;
  updatedAt: Date;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onArchive: (id: number) => void;
  isDeleting?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  casting: 'Casting',
  wardrobe: 'Styling',
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

export function BoardCard({
  id,
  name,
  description,
  startedWith,
  itemCount,
  thumbnailUrl,
  updatedAt,
  onDelete,
  onRename,
  onArchive,
  isDeleting,
}: BoardCardProps) {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const handleClick = useCallback(() => {
    if (isEditing || menuOpen || isDeleting) return;
    navigate(`/app/board/${id}`);
  }, [id, navigate, isEditing, menuOpen, isDeleting]);

  const handleRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed);
    }
    setIsEditing(false);
  }, [editName, name, id, onRename]);

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
          background: thumbnailUrl ? undefined : '#F5F3F0',
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
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
              {startedWith === 'casting' ? 'C' : 'S'}
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
          {TOOL_LABELS[startedWith] || startedWith}
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setIsEditing(true);
                    setEditName(name);
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
                    onArchive(id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left"
                  style={{ fontSize: 13, color: '#1a1a1a' }}
                >
                  <Archive className="w-3.5 h-3.5" style={{ color: '#71716A' }} />
                  Archive
                </button>
                <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left"
                  style={{ fontSize: 13, color: '#dc2626' }}
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                  Delete
                </button>
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
            {name}
          </h3>
        )}
        <div
          className="flex items-center gap-2 mt-1.5"
          style={{ fontSize: 12, color: '#71716A' }}
        >
          <span>{timeAgo(updatedAt)}</span>
          {itemCount > 0 && (
            <>
              <span style={{ color: 'rgba(0,0,0,0.15)' }}>·</span>
              <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            </>
          )}
        </div>
        {description && (
          <p
            className="mt-1"
            style={{
              fontSize: 12,
              color: '#999',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </p>
        )}
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

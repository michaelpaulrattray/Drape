/**
 * BoardHeader — the board's top bar: back, editable name, save indicator,
 * and the D-45(2) profile popover (balance line + Top up — no permanent
 * number on the canvas, keeping D-34's clean-canvas spirit).
 *
 * Canvas tokens throughout (R6 token pass — the hardcoded hex palette is
 * dead); chrome conventions mirror StudioSlimHeader, the one environment
 * header, so board and environment read as one system.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Check, Pencil } from 'lucide-react';

interface BoardHeaderProps {
  name: string;
  onRename: (name: string) => void;
  isSaving?: boolean;
  user?: { name?: string | null; email?: string | null } | null;
  profileImage?: string | null;
  /** null while loading — the popover shows the line once it resolves */
  creditsBalance?: number | null;
  onOpenTopup?: () => void;
}

export function BoardHeader({
  name,
  onRename,
  isSaving,
  user,
  profileImage,
  creditsBalance,
  onOpenTopup,
}: BoardHeaderProps) {
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setDraft(name);
    }
    setEditing(false);
  }, [draft, name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      }
      if (e.key === 'Escape') {
        setDraft(name);
        setEditing(false);
      }
    },
    [commitRename, name],
  );

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <header
      className="flex items-center gap-2.5 px-4 flex-shrink-0 bg-canvas-surface border-b-hairline border-canvas-border"
      style={{ height: 52 }}
    >
      {/* Back to lobby */}
      <button
        type="button"
        onClick={() => navigate('/app')}
        aria-label="Back to lobby"
        className="w-7 h-7 rounded-canvas-sm flex items-center justify-center flex-shrink-0 transition-colors text-canvas-ink-soft hover:bg-canvas-surface-inset"
      >
        <ArrowLeft size={15} strokeWidth={1.8} />
      </button>

      <div aria-hidden className="w-px h-4 bg-canvas-border" />

      {/* Board name */}
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitRename}
            maxLength={128}
            className="px-2 py-1 rounded-canvas-sm outline-none text-canvas-lg font-medium text-canvas-ink bg-canvas-surface-inset border-hairline border-canvas-border-strong"
            style={{ width: 240 }}
          />
          <button
            type="button"
            onClick={commitRename}
            aria-label="Save name"
            className="w-6 h-6 rounded-canvas-sm flex items-center justify-center text-canvas-ink-soft bg-canvas-surface-inset"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="group flex items-center gap-2 px-2 py-1 rounded-canvas-sm transition-colors hover:bg-canvas-surface-inset"
        >
          <span className="text-canvas-lg font-medium text-canvas-ink" style={{ letterSpacing: '-0.01em' }}>
            {name}
          </span>
          <Pencil
            className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity duration-200 text-canvas-ink-soft"
            strokeWidth={1.5}
          />
        </button>
      )}

      <div className="flex-1" />

      {isSaving && <span className="text-canvas-sm text-canvas-ink-faint font-medium">Saving...</span>}

      <img src="/drape-logo.svg" alt="drape" style={{ height: 16, opacity: 0.3 }} />

      {/* D-45(2): profile popover — balance line + Top up. The balance lives
          behind the avatar, not on the chrome (no permanent number on the
          canvas); the takeover header remains the in-flow balance surface. */}
      {user && onOpenTopup && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Profile"
            className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-canvas-surface-inset border-hairline border-canvas-border text-canvas-xs font-medium text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
          >
            {profileImage ? (
              <img src={profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-50 w-52 py-1.5 rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border-strong">
              <div className="px-3 pt-1.5 pb-2">
                <div className="text-canvas-md font-medium text-canvas-ink truncate">
                  {user.name || 'Account'}
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span
                    className="text-canvas-sm text-canvas-ink-soft"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {creditsBalance !== null && creditsBalance !== undefined
                      ? `${creditsBalance.toLocaleString()} credits`
                      : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenTopup();
                    }}
                    className="text-canvas-sm font-medium text-canvas-ink hover:underline"
                  >
                    Top up
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

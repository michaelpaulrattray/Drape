/**
 * BoardHeader — Top bar for the board workspace.
 *
 * Shows back arrow, editable board name, and status indicators.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Check, Pencil } from 'lucide-react';

interface BoardHeaderProps {
  name: string;
  onRename: (name: string) => void;
  isSaving?: boolean;
}

export function BoardHeader({ name, onRename, isSaving }: BoardHeaderProps) {
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

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

  return (
    <header
      className="flex items-center gap-3 px-4 flex-shrink-0"
      style={{
        height: 52,
        background: '#faf9f6',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/app')}
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          color: '#71716A',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)' }} />

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
            className="px-2 py-1 rounded-md outline-none"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a1a',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.1)',
              width: 240,
            }}
          />
          <button
            onClick={commitRename}
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ color: '#52524B', background: 'rgba(0,0,0,0.04)' }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="group flex items-center gap-2 px-2 py-1 rounded-md"
          style={{
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a1a',
              letterSpacing: '-0.01em',
            }}
          >
            {name}
          </span>
          <Pencil
            className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity duration-200"
            strokeWidth={1.5}
          />
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save indicator */}
      {isSaving && (
        <span
          style={{
            fontSize: 12,
            color: '#a1a19a',
            fontWeight: 500,
          }}
        >
          Saving...
        </span>
      )}

      {/* drape logo */}
      <img
        src="/drape-logo.svg"
        alt="drape"
        style={{ height: 16, opacity: 0.3 }}
      />
    </header>
  );
}

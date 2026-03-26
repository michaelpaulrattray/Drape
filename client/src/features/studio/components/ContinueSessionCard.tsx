/**
 * RecentSessionsRow — Lobby section showing up to 4 recent sessions as
 * stacked cards. The most recent session is larger/featured, the rest are
 * compact rows underneath. All cards are visible without horizontal scrolling.
 *
 * Receives pre-fetched sessions array from StudioLobby so loading is
 * coordinated across all lobby sections.
 * Renders nothing if no sessions are provided.
 */
import { useState, useCallback } from 'react';
import { Play, Clock, Layers } from 'lucide-react';
import { toast } from 'sonner';

/** Tool display config — extend when adding new studio tools */
const TOOL_LABELS: Record<string, string> = {
  wardrobe: 'Wardrobe',
  scenery: 'Scenery',
  editorial: 'Editorial',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface SessionData {
  tool: string;
  sessionId: number;
  modelId: number | null;
  modelName: string | null;
  masterPrompt: string | null;
  modelImageUrl: string;
  lastResultUrl: string;
  iterationCount: number;
  activeGarmentIds: number[];
  history: string[];
  historyIndex: number;
  tattooMapData: unknown;
  styleNotes: Record<string, string> | null;
  updatedAt: Date | string;
}

interface RecentSessionsRowProps {
  sessions: SessionData[];
  onContinue: (session: SessionData) => void;
}

/** Featured card — larger layout for the most recent session */
function FeaturedCard({
  session,
  onContinue,
}: {
  session: SessionData;
  onContinue: (session: SessionData) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleClick = useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = session.modelImageUrl;
        }),
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = session.lastResultUrl;
        }),
      ]);
      onContinue(session);
    } catch {
      toast.error('Failed to restore session');
      setIsRestoring(false);
    }
  }, [session, isRestoring, onContinue]);

  const toolLabel = TOOL_LABELS[session.tool] || session.tool;
  const displayName = session.modelName || 'Uploaded Model';

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isRestoring}
      className="w-full rounded-2xl overflow-hidden relative group text-left"
      style={{
        height: 96,
        background: '#fff',
        border: `1.5px solid ${isHovered ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
        opacity: isRestoring ? 0.7 : 1,
      }}
    >
      <div className="flex h-full">
        <div className="relative flex-shrink-0" style={{ width: 72 }}>
          <img src={session.modelImageUrl} alt={displayName} className="w-full h-full object-cover" loading="eager" />
          <div className="absolute inset-y-0 right-0 w-4" style={{ background: 'linear-gradient(to right, transparent, #fff)' }} />
        </div>
        <div className="flex-1 flex items-center px-3 gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>{displayName}</p>
            <div className="flex items-center gap-2.5 mt-1">
              <span className="flex items-center gap-1" style={{ fontSize: 10, color: '#999' }}>
                <Layers className="w-3 h-3" />{session.iterationCount} {session.iterationCount === 1 ? 'look' : 'looks'}
              </span>
              <span className="flex items-center gap-1" style={{ fontSize: 10, color: '#bbb' }}>
                <Clock className="w-3 h-3" />{timeAgo(new Date(session.updatedAt))}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 72, border: '1px solid rgba(0,0,0,0.06)' }}>
            <img src={session.lastResultUrl} alt="Last result" className="w-full h-full object-cover" loading="eager" />
          </div>
          <div
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full transition-all"
            style={{
              background: isHovered ? '#1a1a1a' : '#f5f3ef',
              color: isHovered ? '#fff' : '#777',
              fontSize: 10,
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <Play className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Continue in {toolLabel}</span>
            <span className="sm:hidden">Continue</span>
          </div>
        </div>
      </div>
    </button>
  );
}

/** Compact card — smaller row for older sessions */
function CompactCard({
  session,
  onContinue,
}: {
  session: SessionData;
  onContinue: (session: SessionData) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleClick = useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = session.modelImageUrl;
        }),
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = session.lastResultUrl;
        }),
      ]);
      onContinue(session);
    } catch {
      toast.error('Failed to restore session');
      setIsRestoring(false);
    }
  }, [session, isRestoring, onContinue]);

  const displayName = session.modelName || 'Uploaded Model';

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isRestoring}
      className="w-full rounded-xl overflow-hidden relative group text-left"
      style={{
        height: 56,
        background: '#fff',
        border: `1.5px solid ${isHovered ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.05)'}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 4px 16px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.02)',
        opacity: isRestoring ? 0.7 : 1,
      }}
    >
      <div className="flex h-full items-center">
        <div className="relative flex-shrink-0" style={{ width: 44 }}>
          <img src={session.modelImageUrl} alt={displayName} className="w-full h-full object-cover" loading="eager" />
          <div className="absolute inset-y-0 right-0 w-3" style={{ background: 'linear-gradient(to right, transparent, #fff)' }} />
        </div>
        <div className="flex-1 flex items-center px-3 gap-2 min-w-0">
          <p className="truncate flex-1" style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{displayName}</p>
          <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10, color: '#bbb' }}>
            <Layers className="w-2.5 h-2.5" />{session.iterationCount}
          </span>
          <span className="flex-shrink-0" style={{ fontSize: 10, color: '#ccc' }}>
            {timeAgo(new Date(session.updatedAt))}
          </span>
          <div
            className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: isHovered ? '#1a1a1a' : '#f5f3ef',
              color: isHovered ? '#fff' : '#999',
              fontSize: 9,
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <Play className="w-2 h-2" />Resume
          </div>
        </div>
      </div>
    </button>
  );
}

export function RecentSessionsRow({ sessions, onContinue }: RecentSessionsRowProps) {
  if (!sessions || sessions.length === 0) return null;

  const [featured, ...rest] = sessions;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Play className="w-3.5 h-3.5" style={{ color: '#999' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.05em' }}>
          {sessions.length === 1 ? 'CONTINUE WHERE YOU LEFT OFF' : 'RECENT SESSIONS'}
        </span>
      </div>

      {/* Featured (most recent) session */}
      <FeaturedCard session={featured} onContinue={onContinue} />

      {/* Older sessions — compact rows below */}
      {rest.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {rest.map((session) => (
            <CompactCard key={session.sessionId} session={session} onContinue={onContinue} />
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Use RecentSessionsRow instead — kept for backward compat */
export function ContinueSessionCard({
  session,
  onContinue,
}: {
  session: SessionData | null;
  onContinue: (session: SessionData) => void;
}) {
  if (!session) return null;
  return <RecentSessionsRow sessions={[session]} onContinue={onContinue} />;
}

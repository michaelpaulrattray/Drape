/**
 * DraftCastsRow — Shows unfinished casting sessions in the studio lobby.
 *
 * Displays draft models that have at least one generated asset (headshot)
 * but haven't been exported/minted yet. Allows users to resume casting.
 */
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { DeleteOverlayButton } from './DeleteOverlayButton';

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface DraftModel {
  id: number;
  name: string | null;
  masterPrompt: string;
  preferences: Record<string, unknown> | null;
  technicalSchema: Record<string, unknown> | null;
  thumbnailUrl: string;
  assetCount: number;
  createdAt: Date | string;
}

interface DraftCastsRowProps {
  drafts: DraftModel[];
  onResume: (draft: DraftModel) => void;
  onDelete?: (draftId: number) => void;
  isDeletingId?: number | null;
}

export function DraftCastsRow({ drafts, onResume, onDelete, isDeletingId }: DraftCastsRowProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (drafts.length === 0) return null;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Pencil className="w-3.5 h-3.5" style={{ color: '#71717A' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#71717A', letterSpacing: '0.05em' }}>
          DRAFT CASTS
        </span>
        <span
          className="px-1.5 py-0.5 rounded-full"
          style={{ fontSize: 9, fontWeight: 600, color: '#71717A', background: '#F4F4F5' }}
        >
          {drafts.length}
        </span>
      </div>

      {/* Draft cards */}
      <div className="flex flex-col gap-2">
        {drafts.map((draft) => {
          const isHovered = hoveredId === draft.id;
          const isDeleting = isDeletingId === draft.id;
          const ago = timeAgo(draft.createdAt);

          return (
            <div
              key={draft.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group"
              style={{
                background: isHovered ? 'rgba(0,0,0,0.03)' : 'transparent',
                border: '1px solid rgba(0,0,0,0.06)',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.5 : 1,
              }}
              onMouseEnter={() => setHoveredId(draft.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => !isDeleting && onResume(draft)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isDeleting) {
                  e.preventDefault();
                  onResume(draft);
                }
              }}
            >
              {/* Thumbnail */}
              <div
                className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{ width: 40, height: 48, background: '#F4F4F5' }}
              >
                <img
                  src={draft.thumbnailUrl}
                  alt={draft.name || 'Draft'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}
                >
                  {draft.name || 'Draft Model'}
                </p>
                <p style={{ fontSize: 11, color: '#71717A', marginTop: 1 }}>
                  {draft.assetCount} {draft.assetCount === 1 ? 'view' : 'views'} · {ago}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {onDelete && (
                  <DeleteOverlayButton
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDeleting) onDelete(draft.id);
                    }}
                    isDeleting={isDeleting}
                    size={18}
                    variant="inline"
                    title="Delete draft"
                  />
                )}
                <span
                  className="px-3 py-1 rounded-full text-nowrap"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isHovered ? '#fff' : '#1a1a1a',
                    background: isHovered ? '#1a1a1a' : '#F4F4F5',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Resume
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

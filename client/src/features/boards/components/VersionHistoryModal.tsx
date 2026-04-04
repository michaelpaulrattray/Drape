/**
 * VersionHistoryModal — Shows all iteration versions for a board item.
 *
 * Horizontal scrollable strip of thumbnails. Clicking one reverts the node
 * to that version's image. The current (latest) version is highlighted.
 */
import { useEffect, useCallback } from 'react';
import { X, Clock, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface VersionHistoryModalProps {
  itemId: number;
  boardId: number;
  currentImageUrl: string | null;
  onClose: () => void;
}

export function VersionHistoryModal({
  itemId,
  boardId,
  currentImageUrl,
  onClose,
}: VersionHistoryModalProps) {
  const utils = trpc.useUtils();

  const { data: versionsData, isLoading } = trpc.boards.getItemVersions.useQuery({
    itemId,
  });
  const versions = versionsData?.versions ?? [];

  const revertMutation = trpc.boards.revertItemVersion.useMutation({
    onSuccess: () => {
      toast.success('Reverted to selected version');
      utils.boards.getItems.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to revert');
    },
  });

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRevert = useCallback(
    (versionId: number) => {
      revertMutation.mutate({ itemId, versionId });
    },
    [itemId, revertMutation],
  );

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[95]"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[100] flex flex-col"
        style={{
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(90vw, 800px)',
          maxHeight: '50vh',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 16px 64px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          animation: 'version-modal-enter 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{
            height: 48,
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: '#71716A' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              Version History
            </span>
            {versions.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#a1a19a',
                  background: 'rgba(0, 0, 0, 0.04)',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {versions.length} version{versions.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#71716A' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
              e.currentTarget.style.color = '#1a1a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#71716A';
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a1a19a' }} />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Clock size={24} style={{ color: '#d4d0cb' }} />
              <p style={{ fontSize: 13, color: '#a1a19a' }}>No iteration history yet</p>
            </div>
          ) : (
            <div
              className="flex gap-3 p-5 overflow-x-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.1) transparent',
              }}
            >
              {versions.map((version, index) => {
                const isCurrent = version.imageUrl === currentImageUrl;
                const isLatest = index === 0;

                return (
                  <div
                    key={version.id}
                    className="flex flex-col flex-shrink-0 group"
                    style={{ width: 140 }}
                  >
                    {/* Thumbnail */}
                    <button
                      onClick={() => {
                        if (!isCurrent) handleRevert(version.id);
                      }}
                      disabled={isCurrent || revertMutation.isPending}
                      className="relative overflow-hidden transition-all"
                      style={{
                        width: 140,
                        height: 186,
                        borderRadius: 10,
                        border: isCurrent
                          ? '2px solid #1a1a1a'
                          : '1px solid rgba(0, 0, 0, 0.08)',
                        boxShadow: isCurrent
                          ? '0 2px 12px rgba(0, 0, 0, 0.12)'
                          : '0 1px 4px rgba(0, 0, 0, 0.04)',
                        cursor: isCurrent ? 'default' : 'pointer',
                        background: '#f5f3ef',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.2)';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
                          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.04)';
                        }
                      }}
                    >
                      <img
                        src={version.imageUrl}
                        alt={version.prompt || `Version ${versions.length - index}`}
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />

                      {/* Current badge */}
                      {isCurrent && (
                        <div
                          className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                          style={{
                            background: '#1a1a1a',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                          }}
                        >
                          <Check size={9} strokeWidth={2.5} />
                          CURRENT
                        </div>
                      )}

                      {/* Hover overlay for non-current */}
                      {!isCurrent && (
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{
                            background: 'rgba(0, 0, 0, 0.4)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#fff',
                              background: 'rgba(0, 0, 0, 0.6)',
                              padding: '4px 10px',
                              borderRadius: 6,
                            }}
                          >
                            Revert
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Meta */}
                    <div className="mt-1.5 px-1">
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#1a1a1a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={version.prompt || undefined}
                      >
                        {isLatest ? 'Latest' : version.prompt || `v${versions.length - index}`}
                      </p>
                      <p style={{ fontSize: 10, color: '#a1a19a', marginTop: 1 }}>
                        {formatDate(version.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes version-modal-enter {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </>
  );
}

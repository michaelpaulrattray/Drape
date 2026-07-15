/**
 * ModelGallery — Horizontal scrollable gallery of user's exported/minted models.
 *
 * Shown on the WardrobeStart screen. Receives pre-fetched model data
 * from its host so loading can be coordinated.
 * Click a model to load it into the wardrobe.
 */
import { useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Crown } from 'lucide-react';
import { DeleteOverlayButton } from './DeleteOverlayButton';

/** Shape returned by wardrobe.model.listMinted */
export interface MintedModel {
  id: number;
  name: string | null;
  /** Server lifecycle status — the read model's minted truth (Batch B).
   *  Consumers derive minted state via isModelMintedStatus(status), never
   *  from this row having arrived through a "minted" gallery. */
  status: string;
  agencyId: string | null;
  masterPrompt: string;
  thumbnailUrl: string;
  mintedAt: Date | null;
}

interface ModelGalleryProps {
  models: MintedModel[];
  onSelectModel: (model: MintedModel) => void;
  onDeleteModel?: (modelId: number) => void;
  deletingModelId?: number | null;
}

export function ModelGallery({ models, onSelectModel, onDeleteModel, deletingModelId }: ModelGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const scroll = useCallback((dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 200;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  // Don't render if no models
  if (models.length === 0) return null;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Crown className="w-3.5 h-3.5" style={{ color: '#52524B' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#52524B', letterSpacing: '0.05em' }}>
            MY MODELS
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{ fontSize: 11, fontWeight: 600, color: '#52524B', background: '#F5F3F0' }}
          >
            {models.length}
          </span>
        </div>

        {/* Scroll arrows (only if overflow) */}
        {models.length > 3 && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll('left')}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#52524B' }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#52524B' }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable gallery */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {models.map((model) => {
          const isHovered = hoveredId === model.id;
          return (
            <div
              key={model.id}
              onClick={() => onSelectModel(model)}
              onMouseEnter={() => setHoveredId(model.id)}
              onMouseLeave={() => setHoveredId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectModel(model);
                }
              }}
              role="button"
              tabIndex={0}
              className="flex-shrink-0 rounded-xl overflow-hidden relative group cursor-pointer"
              style={{
                width: 120,
                height: 160,
                background: '#F5F3F0',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: isHovered
                  ? '0 12px 24px rgba(0,0,0,0.12)'
                  : '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Thumbnail */}
              <img
                src={model.thumbnailUrl}
                alt={model.name || 'Model'}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Overlay gradient */}
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)',
                  opacity: isHovered ? 1 : 0.7,
                }}
              />

              {/* Model info */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p
                  className="truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    lineHeight: 1.2,
                  }}
                >
                  {model.name || 'Untitled'}
                </p>
                {model.agencyId && (
                  <p
                    className="truncate mt-0.5"
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.7)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {model.agencyId}
                  </p>
                )}
              </div>

              {/* Delete button — standardized overlay */}
              {onDeleteModel && (
                <DeleteOverlayButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteModel(model.id);
                  }}
                  isDeleting={deletingModelId === model.id}
                  requireConfirm
                  size={20}
                  placement="top-right"
                  title="Delete model"
                />
              )}


            </div>
          );
        })}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

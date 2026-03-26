/**
 * ModelGallery — Horizontal scrollable gallery of user's exported/minted models.
 *
 * Shown in the studio lobby. Receives pre-fetched model data from StudioLobby
 * so loading can be coordinated across all lobby sections.
 * Click a model to load it into the wardrobe.
 */
import { useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Crown } from 'lucide-react';

/** Shape returned by wardrobe.model.listMinted */
export interface MintedModel {
  id: number;
  name: string | null;
  agencyId: string | null;
  masterPrompt: string;
  thumbnailUrl: string;
  mintedAt: Date | null;
}

interface ModelGalleryProps {
  models: MintedModel[];
  onSelectModel: (model: MintedModel) => void;
}

export function ModelGallery({ models, onSelectModel }: ModelGalleryProps) {
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
          <Crown className="w-3.5 h-3.5" style={{ color: '#999' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.05em' }}>
            MY MODELS
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{ fontSize: 9, fontWeight: 600, color: '#999', background: '#f5f3ef' }}
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
              style={{ color: '#999' }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#999' }}
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
            <button
              key={model.id}
              onClick={() => onSelectModel(model)}
              onMouseEnter={() => setHoveredId(model.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="flex-shrink-0 rounded-xl overflow-hidden relative group"
              style={{
                width: 120,
                height: 160,
                background: '#f5f3ef',
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
                    fontSize: 11,
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
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.7)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {model.agencyId}
                  </p>
                )}
              </div>

              {/* Hover action hint */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
                style={{ opacity: isHovered ? 1 : 0 }}
              >
                <span
                  className="px-3 py-1.5 rounded-full backdrop-blur-sm"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#fff',
                    background: 'rgba(0,0,0,0.5)',
                  }}
                >
                  Load Model
                </span>
              </div>
            </button>
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

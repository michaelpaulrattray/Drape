/**
 * LibraryView — one library page (Models, Garments, or Looks), reached
 * from the rail.
 *
 * Grid of portrait thumbnails. Same behaviors as the old lobby Library
 * strips: minted models open in Wardrobe with the model loaded; garments
 * and looks open a lightweight preview (looks downloadable). The Models
 * page also lists draft casts under "In progress" — tagged Draft, and
 * clicking one resumes it in the Casting Studio.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Download, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { SearchField } from './SearchField';
import { NewItemTile } from './NewItemTile';

export type LibraryKind = 'models' | 'garments' | 'looks';

interface LibraryItem {
  key: string;
  imageUrl: string;
  title: string;
  tag?: string;
  onClick: () => void;
}

interface LibrarySection {
  label?: string;
  items: LibraryItem[];
}

interface PreviewState {
  imageUrl: string;
  title: string;
  downloadable?: boolean;
}

const COPY: Record<LibraryKind, { title: string; subtitle: string; empty: string; searchPlaceholder: string; emptyAction: { label: string; href: string } }> = {
  models: {
    title: 'Models',
    subtitle: 'AI models you’ve cast — minted and still in progress.',
    empty: 'No models yet.',
    searchPlaceholder: 'Search models…',
    emptyAction: { label: 'Cast your first in the Casting Studio', href: '/studio?tool=casting&new=1' },
  },
  garments: {
    title: 'Garments',
    subtitle: 'Your digitized clothing items.',
    empty: 'No garments yet.',
    searchPlaceholder: 'Search garments…',
    emptyAction: { label: 'Digitize one in Wardrobe', href: '/studio?tool=wardrobe' },
  },
  looks: {
    title: 'Looks',
    subtitle: 'Styled outfits saved from wardrobe sessions.',
    empty: 'No looks yet.',
    searchPlaceholder: 'Search looks…',
    emptyAction: { label: 'Dress a model in Wardrobe', href: '/studio?tool=wardrobe' },
  },
};

export function LibraryView({ kind }: { kind: LibraryKind }) {
  const [, navigate] = useLocation();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [query, setQuery] = useState('');

  const { data: models, isLoading: modelsLoading } = trpc.wardrobe.model.listMinted.useQuery(
    undefined,
    { staleTime: 30_000, enabled: kind === 'models' },
  );
  const { data: drafts } = trpc.wardrobe.model.listDrafts.useQuery(
    { limit: 10 },
    { staleTime: 30_000, enabled: kind === 'models' },
  );
  const { data: garments, isLoading: garmentsLoading } = trpc.wardrobe.garments.list.useQuery(
    undefined,
    { staleTime: 30_000, enabled: kind === 'garments' },
  );
  const { data: looks, isLoading: looksLoading } = trpc.wardrobe.looks.listAll.useQuery(
    undefined,
    { staleTime: 30_000, enabled: kind === 'looks' },
  );

  const isLoading =
    kind === 'models' ? modelsLoading : kind === 'garments' ? garmentsLoading : looksLoading;

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  const reveal = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  const sections: LibrarySection[] = [];
  if (kind === 'models') {
    const draftItems: LibraryItem[] = (drafts ?? []).map((d) => ({
      key: `draft-${d.id}`,
      imageUrl: d.thumbnailUrl,
      title: d.name ?? 'Untitled',
      tag: 'Draft',
      onClick: () => navigate(`/studio?tool=casting&modelId=${d.id}`),
    }));
    const mintedItems: LibraryItem[] = (models ?? []).map((m) => ({
      key: `model-${m.id}`,
      imageUrl: m.thumbnailUrl,
      title: m.name ?? 'Untitled',
      onClick: () => navigate(`/studio?tool=wardrobe&modelId=${m.id}`),
    }));
    if (draftItems.length > 0) sections.push({ label: 'In progress', items: draftItems });
    if (mintedItems.length > 0)
      sections.push({ label: draftItems.length > 0 ? 'Minted' : undefined, items: mintedItems });
  } else if (kind === 'garments') {
    const items = (garments ?? [])
      .filter((g) => g.status === 'ready')
      .flatMap((g) => {
        const imageUrl = g.isolatedImageUrl ?? g.originalImageUrl ?? g.sourceImageUrl;
        return imageUrl
          ? [{
              key: `garment-${g.id}`,
              imageUrl,
              title: g.shortName ?? 'Garment',
              onClick: () => setPreview({ imageUrl, title: g.shortName ?? 'Garment' }),
            }]
          : [];
      });
    if (items.length > 0) sections.push({ items });
  } else {
    const items = (looks ?? []).map((l) => ({
      key: `look-${l.id}`,
      imageUrl: l.imageUrl,
      title: l.name ?? 'Look',
      onClick: () =>
        setPreview({ imageUrl: l.imageUrl, title: l.name ?? 'Look', downloadable: true }),
    }));
    if (items.length > 0) sections.push({ items });
  }

  const totalCount = sections.reduce((n, s) => n + s.items.length, 0);

  const trimmedQuery = query.trim().toLowerCase();
  const visibleSections = trimmedQuery
    ? sections
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => i.title.toLowerCase().includes(trimmedQuery)),
        }))
        .filter((s) => s.items.length > 0)
    : sections;

  const copy = COPY[kind];

  if (isLoading) {
    return (
      <div className="w-full px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12">
        <div className="rounded-lg animate-pulse mb-8" style={{ width: 160, height: 28, background: 'rgba(0,0,0,0.05)' }} />
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{ aspectRatio: '3 / 4', background: 'rgba(0,0,0,0.03)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-12 xl:px-16 pt-8 sm:pt-12 pb-16 w-full">
      {/* Title */}
      <div className="mb-10 flex items-end justify-between gap-6" style={reveal(0.05)}>
        <div>
          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 700,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            {copy.title}{' '}
            {totalCount > 0 && (
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 400,
                  color: '#B0AFA8',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totalCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 15, color: '#71716A', marginTop: 4 }}>{copy.subtitle}</p>
        </div>
        {totalCount > 0 && (
          <div className="hidden sm:block flex-shrink-0 pb-1">
            <SearchField value={query} onChange={setQuery} placeholder={copy.searchPlaceholder} />
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        kind === 'models' ? (
          <div
            className="grid gap-5"
            style={{ ...reveal(0.1), gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          >
            <NewItemTile
              label="Cast a model"
              onClick={() => navigate('/studio?tool=casting&new=1')}
              style={{ aspectRatio: '3 / 4', minHeight: 0 }}
            />
          </div>
        ) : (
          <p style={reveal(0.1)}>
            <span style={{ fontSize: 14, color: '#71716A' }}>{copy.empty} </span>
            <button
              onClick={() => navigate(copy.emptyAction.href)}
              style={{
                fontSize: 14,
                color: '#1a1a1a',
                borderBottom: '1px solid rgba(0,0,0,0.4)',
              }}
            >
              {copy.emptyAction.label}
            </button>
          </p>
        )
      ) : visibleSections.length === 0 ? (
        <p style={reveal(0.1)}>
          <span style={{ fontSize: 14, color: '#71716A' }}>
            No {kind} match “{query.trim()}”.
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-10" style={reveal(0.1)}>
          {visibleSections.map((section, i) => (
            <section key={section.label ?? i}>
              {section.label && (
                <h2
                  className="mb-4"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#71716A',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {section.label}
                </h2>
              )}
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
              >
                {kind === 'models' && !trimmedQuery && i === 0 && (
                  <NewItemTile
                    label="Cast a model"
                    onClick={() => navigate('/studio?tool=casting&new=1')}
                    style={{ aspectRatio: '3 / 4', minHeight: 0 }}
                  />
                )}
                {section.items.map((item) => (
                  <button key={item.key} onClick={item.onClick} className="group/thumb text-left">
                    <div
                      className="relative overflow-hidden rounded-xl w-full"
                      style={{
                        aspectRatio: '3 / 4',
                        background: '#F5F3F0',
                        border: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
                      />
                      {item.tag && (
                        <span
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(8px)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#52524B',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <span
                      className="block mt-1.5"
                      style={{
                        fontSize: 12,
                        color: '#71716A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Preview overlay */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(20,20,18,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.imageUrl}
              alt={preview.title}
              className="rounded-xl"
              style={{ maxHeight: '78vh', maxWidth: '90vw', objectFit: 'contain' }}
            />
            <div className="flex items-center gap-3 mt-4">
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                {preview.title}
              </span>
              {preview.downloadable && (
                <a
                  href={preview.imageUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.12)', fontSize: 13, color: '#fff' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              )}
            </div>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.92)' }}
              aria-label="Close preview"
            >
              <X className="w-4 h-4" style={{ color: '#1a1a1a' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

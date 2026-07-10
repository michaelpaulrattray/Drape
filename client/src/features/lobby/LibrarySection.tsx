/**
 * LibrarySection — lobby-level browse of models, garments, and looks.
 *
 * Three horizontal thumbnail strips. Models open in Wardrobe with the
 * model loaded; garments and looks open a lightweight preview (no deep
 * link into wardrobe internals). Empty rows are hidden; if the user has
 * nothing yet the whole section disappears.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Download, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { LibraryRow, type LibraryItem } from './LibraryRow';

interface PreviewState {
  imageUrl: string;
  title: string;
  downloadable?: boolean;
}

export function LibrarySection() {
  const [, navigate] = useLocation();
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const { data: models } = trpc.wardrobe.model.listMinted.useQuery(undefined, {
    staleTime: 30_000,
  });
  const { data: garments } = trpc.wardrobe.garments.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const { data: looks } = trpc.wardrobe.looks.listAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const modelItems: LibraryItem[] = (models ?? []).map((m) => ({
    key: `model-${m.id}`,
    imageUrl: m.thumbnailUrl,
    title: m.name ?? 'Untitled',
    onClick: () => navigate(`/studio?tool=wardrobe&modelId=${m.id}`),
  }));

  const garmentItems: LibraryItem[] = (garments ?? [])
    .filter((g) => g.status === 'ready')
    .map((g) => {
      const imageUrl = g.isolatedImageUrl ?? g.originalImageUrl ?? g.sourceImageUrl;
      return imageUrl
        ? {
            key: `garment-${g.id}`,
            imageUrl,
            title: g.shortName ?? 'Garment',
            onClick: () => setPreview({ imageUrl, title: g.shortName ?? 'Garment' }),
          }
        : null;
    })
    .filter((g): g is LibraryItem => g !== null);

  const lookItems: LibraryItem[] = (looks ?? []).map((l) => ({
    key: `look-${l.id}`,
    imageUrl: l.imageUrl,
    title: l.name ?? 'Look',
    onClick: () =>
      setPreview({ imageUrl: l.imageUrl, title: l.name ?? 'Look', downloadable: true }),
  }));

  if (modelItems.length === 0 && garmentItems.length === 0 && lookItems.length === 0) {
    return null;
  }

  return (
    <section>
      <h2
        className="mb-4"
        style={{ fontSize: 13, fontWeight: 600, color: '#71716A', letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        Library
      </h2>
      <div className="flex flex-col gap-8">
        <LibraryRow label="Models" items={modelItems} />
        <LibraryRow label="Garments" items={garmentItems} />
        <LibraryRow label="Looks" items={lookItems} />
      </div>

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
    </section>
  );
}

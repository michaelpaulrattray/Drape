/**
 * ModelCardChooser — the A2(a) library-card chooser (modal-class per D-32:
 * one choose-and-dismiss purpose, canvas language). A minted model card
 * offers its four verbs instead of teleporting into wardrobe:
 *
 *   View comp card / Open in casting / Dress in wardrobe / Export identity pack
 *
 * "View comp card" renders the canonical composite statically — the same
 * CharacterSheetImageArea the board uses, fed from generation.packageState
 * (it is purely presentational; no new rendering system). "Dress in
 * wardrobe" keeps the legacy deep link as-is per the R6 wardrobe boundary.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, X, IdCard, Pencil, Shirt, Package } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { CharacterSheetImageArea, type SheetTile } from '@/features/boards/canvas/CharacterSheetImageArea';
import { ExportPackDialog } from '@/features/export';

export interface ChooserModel {
  id: number;
  name: string;
  imageUrl: string;
}

type Mode = 'menu' | 'card' | 'export';

export function ModelCardChooser({ model, onClose }: { model: ChooserModel | null; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>('menu');

  useEffect(() => {
    setMode('menu');
  }, [model?.id]);

  useEffect(() => {
    if (!model) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [model, onClose]);

  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: model?.id ?? 0 },
    { enabled: !!model && mode === 'card' },
  );

  const tiles: SheetTile[] = useMemo(
    () =>
      (packageQuery.data?.slots ?? []).map((s) => ({
        angle: s.angle,
        label: s.label,
        url: s.url,
        filled: s.filled,
        pinned: s.pinned,
        stale: s.stale,
        failed: s.failed ? { reason: s.failed.reason } : null,
        poppedOut: false,
        refreshing: false,
      })),
    [packageQuery.data],
  );

  if (!model) return null;

  if (mode === 'export') {
    return <ExportPackDialog modelId={model.id} isOpen onClose={onClose} />;
  }

  const actionClass =
    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas-surface-inset text-canvas-ink-soft hover:text-canvas-ink';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(10,10,10,0.3)' }} onClick={onClose} />
      <div
        className="relative w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong"
        style={{ maxWidth: mode === 'card' ? 420 : 340 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b-hairline border-canvas-border">
          <div className="flex items-center gap-2 min-w-0">
            {mode === 'card' && (
              <button
                type="button"
                onClick={() => setMode('menu')}
                aria-label="Back"
                className="w-6 h-6 -ml-1 rounded-canvas-sm flex items-center justify-center text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            )}
            <span className="truncate text-canvas-lg font-medium text-canvas-ink">{model.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-canvas-sm flex items-center justify-center text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        </div>

        {mode === 'card' ? (
          /* The canonical comp card, statically (D-51 vocabulary) */
          <div className="p-4">
            {packageQuery.isLoading ? (
              <div className="rounded-canvas-md animate-pulse bg-canvas-surface-inset" style={{ aspectRatio: '3 / 4' }} />
            ) : (
              <CharacterSheetImageArea
                tiles={tiles}
                activeTileAngle={null}
                onTileClick={() => {}}
                onTileDoubleClick={() => {}}
                onGhostClick={() => {}}
              />
            )}
          </div>
        ) : (
          <>
            {/* Menu — thumbnail strip + the four verbs */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-hairline border-canvas-border">
              <div className="w-10 h-[52px] rounded-canvas-sm overflow-hidden border-hairline border-canvas-border flex-shrink-0">
                <img src={model.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-canvas-md text-canvas-ink-soft">What would you like to do?</span>
            </div>
            <div className="py-1.5">
              <button type="button" className={actionClass} onClick={() => setMode('card')}>
                <IdCard className="w-4 h-4 flex-shrink-0" strokeWidth={1.6} />
                <span className="text-canvas-lg">View comp card</span>
              </button>
              <button
                type="button"
                className={actionClass}
                onClick={() => navigate(`/studio?tool=casting&modelId=${model.id}`)}
              >
                <Pencil className="w-4 h-4 flex-shrink-0" strokeWidth={1.6} />
                <span className="text-canvas-lg">Open in casting</span>
              </button>
              <button
                type="button"
                className={actionClass}
                onClick={() => navigate(`/studio?tool=wardrobe&modelId=${model.id}`)}
              >
                <Shirt className="w-4 h-4 flex-shrink-0" strokeWidth={1.6} />
                <span className="text-canvas-lg">Dress in wardrobe</span>
              </button>
              <button type="button" className={actionClass} onClick={() => setMode('export')}>
                <Package className="w-4 h-4 flex-shrink-0" strokeWidth={1.6} />
                <span className="text-canvas-lg">Export identity pack</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

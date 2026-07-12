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

  const actions: Array<{ icon: typeof IdCard; verb: string; desc: string; onPick: () => void }> = [
    {
      icon: IdCard,
      verb: 'View comp card',
      desc: 'The canonical card — every view in one place.',
      onPick: () => setMode('card'),
    },
    {
      icon: Pencil,
      verb: 'Open in casting',
      desc: 'Refine views, complete the card, or fork the identity.',
      onPick: () => navigate(`/studio?tool=casting&modelId=${model.id}`),
    },
    {
      icon: Shirt,
      verb: 'Dress in wardrobe',
      desc: 'Style them in garments from your library.',
      onPick: () => navigate(`/studio?tool=wardrobe&modelId=${model.id}`),
    },
    {
      icon: Package,
      verb: 'Export identity pack',
      desc: '2K views and the identity document, zipped.',
      onPick: () => setMode('export'),
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(10,10,10,0.3)' }} onClick={onClose} />
      <div
        className="relative w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong"
        style={{ maxWidth: mode === 'card' ? 420 : 520 }}
      >
        {mode === 'card' ? (
          <>
            {/* Header (card mode) */}
            <div className="flex items-center justify-between px-4 h-11 border-b-hairline border-canvas-border">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  aria-label="Back"
                  className="w-6 h-6 -ml-1 rounded-canvas-sm flex items-center justify-center text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
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
            {/* The canonical comp card, statically (D-51 vocabulary) */}
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
          </>
        ) : (
          /* Menu — picking up the model's card: the headshot anchors the
             modal at full height; the verbs read as a considered list
             beside it (VC-R6a fix 2 — never a system dialog) */
          <div className="flex" style={{ minHeight: 296 }}>
            <div className="relative flex-shrink-0 border-r-hairline border-canvas-border" style={{ width: 186 }}>
              <img src={model.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start justify-between pl-5 pr-3 pt-4 pb-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-canvas-ink" style={{ fontSize: 16 }}>
                    {model.name}
                  </div>
                  <div className="text-canvas-sm text-canvas-ink-faint mt-0.5">Minted model</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-6 h-6 mt-0.5 rounded-canvas-sm flex items-center justify-center flex-shrink-0 text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex-1 flex flex-col justify-center pb-3">
                {actions.map(({ icon: Icon, verb, desc, onPick }) => (
                  <button
                    key={verb}
                    type="button"
                    onClick={onPick}
                    className="group w-full flex items-start gap-3 pl-5 pr-4 py-2.5 text-left transition-colors hover:bg-canvas-surface-inset"
                  >
                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-canvas-ink-faint group-hover:text-canvas-ink transition-colors" strokeWidth={1.5} />
                    <span className="min-w-0">
                      <span className="block text-canvas-lg text-canvas-ink-soft group-hover:text-canvas-ink transition-colors">{verb}</span>
                      <span className="block text-canvas-sm text-canvas-ink-faint mt-px">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

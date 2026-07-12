/**
 * FirstRunIntro — D-9 / DS §11.1: the first-ever empty board, in Drape's
 * restrained language. Not a modal tour, not coach marks — a quiet
 * arrangement on the canvas itself: three ghost cards laid out like a real
 * workflow (cast card → comp card → connected work), one dark pill, one
 * ghost exit. It does not animate in (it is simply there, first) and any
 * interaction dismisses it permanently (profile-persisted flag).
 *
 * Captions speak the comp-card vocabulary (D-51) — the pre-R3b "five
 * views" language is dead.
 */
import { User } from 'lucide-react';

function GhostCard({ children, caption, onClick }: {
  children: React.ReactNode;
  caption: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 group"
    >
      {children}
      <span className="text-[11px] leading-snug text-canvas-ink-soft">{caption}</span>
    </button>
  );
}

const ghostFrame =
  'border border-dashed border-canvas-border-strong rounded-canvas-md bg-canvas-surface/40';

export function FirstRunIntro({
  onCastFirst,
  onDismiss,
}: {
  /** The dark pill — drops a cast node at center (the tool pill's action). */
  onCastFirst: () => void;
  /** Any ghost-card click or the blank-board exit. */
  onDismiss: () => void;
}) {
  return (
    <div
      data-first-run-intro
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-8">
        {/* The workflow composition — static art, not live nodes */}
        <div className="flex items-start gap-10">
          {/* 1 — a cast card */}
          <GhostCard caption="Cast a model from a sentence" onClick={onDismiss}>
            <div className={`${ghostFrame} flex items-center justify-center`} style={{ width: 96, height: 128 }}>
              <User className="w-6 h-6 text-canvas-ink-faint opacity-50" strokeWidth={1.2} />
            </div>
          </GhostCard>

          {/* 2 — the comp card (headshot-dominant mosaic) */}
          <GhostCard caption="Build their comp card" onClick={onDismiss}>
            <div className={`${ghostFrame} p-1.5`} style={{ width: 96, height: 128 }}>
              <div
                className="w-full h-full grid gap-1 opacity-50"
                style={{
                  gridTemplateColumns: '2fr 1fr',
                  gridTemplateRows: '1fr 1fr 1fr',
                }}
              >
                <span className="bg-canvas-surface-inset rounded-[3px]" style={{ gridRow: 'span 2' }} />
                <span className="bg-canvas-surface-inset rounded-[3px]" />
                <span className="bg-canvas-surface-inset rounded-[3px]" />
                <span className="bg-canvas-surface-inset rounded-[3px]" />
                <span className="bg-canvas-surface-inset rounded-[3px]" />
              </div>
            </div>
          </GhostCard>

          {/* 3 — connected work (two cards, one lineage line) */}
          <GhostCard caption="Everything stays connected" onClick={onDismiss}>
            <div className="relative" style={{ width: 96, height: 128 }}>
              <div className={`${ghostFrame} absolute left-0 top-2`} style={{ width: 52, height: 70 }} />
              <div className={`${ghostFrame} absolute right-0 bottom-2`} style={{ width: 52, height: 70 }} />
              <svg className="absolute inset-0 w-full h-full opacity-50" aria-hidden>
                <line x1="52" y1="37" x2="44" y2="91" stroke="var(--color-canvas-ink-faint)" strokeWidth="1" />
              </svg>
            </div>
          </GhostCard>
        </div>

        {/* The one dark pill + the ghost exit */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={onCastFirst}
            className="px-4 py-2 rounded-canvas-pill text-canvas-md font-medium bg-canvas-ink hover:opacity-90 transition-opacity"
            style={{ color: 'var(--color-canvas-surface)' }}
          >
            Cast your first model
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-canvas-sm text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors"
          >
            Start with a blank board
          </button>
        </div>
      </div>
    </div>
  );
}

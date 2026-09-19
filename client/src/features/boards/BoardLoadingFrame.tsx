/**
 * BoardLoadingFrame — the designed loading state a board shows before its data
 * arrives (P1): the space reads as a board from frame one — dotted grid
 * immediately, centered mark, hairline progress. Never a bare spinner.
 *
 * It lives in its own file because it is rendered from TWO places and must be
 * the same frame in both (#1036). `BoardPage` renders it while the board and
 * its items load; `App.tsx` renders it as the Suspense fallback for the
 * `/app/board/:id` route while the board page's own chunk downloads, which is
 * the one customer route that is lazy. A customer arriving on a slow
 * connection sees this frame from the first moment and the same frame until
 * the canvas appears — the chunk wait and the data wait are one loading state,
 * not a blank followed by a loader. Keep this file light: it is in the entry
 * chunk, and everything it imports rides with it.
 */
import { BrandLoader } from '@/components/BrandLoader';
import { DottedGridBackground } from './canvas/DottedGridBackground';

export function BoardLoadingFrame() {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh', background: 'var(--color-canvas-field)' }}>
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 52, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="rounded animate-pulse" style={{ width: 80, height: 20, background: 'rgba(0,0,0,0.06)' }} />
      </div>
      <div className="flex-1 relative" style={{ background: 'var(--color-canvas-field)' }}>
        <DottedGridBackground />
        <BrandLoader />
      </div>
    </div>
  );
}

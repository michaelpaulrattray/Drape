/**
 * BrandLoader — the designed loading state (post-VC-R3 P1). A quiet centered
 * wordmark over the surface with a hairline progress track: the space reads
 * as Klieg from frame one, never as an unstyled spinner. Position and
 * restraint per the Luma/Higgsfield references; the styling is ours.
 *
 * The host provides the background (board pages render the dotted grid
 * behind this; the takeover renders its studio surface).
 */
import { KliegWordmark } from '@/foundation/KliegWordmark';

export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
      <style>{`
        @keyframes brandLoaderPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes brandLoaderTrack {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
      {/* #1916: the mark is Klieg's. The wordmark's own type rules (lowercase,
          600, -0.015em tracking, the bulb) live in KliegWordmark, cut from the
          locked brand reference; what stays here is the LOADER's context — its
          grey and its pulse. The colour sits on the wrapper on purpose: the
          mark inherits `currentColor` and so does the bulb, so the two can
          never drift apart. */}
      <span
        style={{
          color: '#71716A',
          animation: 'brandLoaderPulse 1.8s ease-in-out infinite',
        }}
      >
        <KliegWordmark fontSize={15} />
      </span>
      <div
        className="mt-3 overflow-hidden"
        style={{ width: 120, height: 1, background: 'rgba(10,10,10,0.10)' }}
      >
        <div
          style={{
            width: 40,
            height: 1,
            background: 'rgba(10,10,10,0.45)',
            animation: 'brandLoaderTrack 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite',
          }}
        />
      </div>
      {label && (
        <span className="mt-3" style={{ fontSize: 11, color: '#a1a19a' }}>
          {label}
        </span>
      )}
    </div>
  );
}

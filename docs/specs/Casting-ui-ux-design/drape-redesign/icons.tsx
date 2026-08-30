/**
 * Klieg icons — the house set.
 *
 * Drawn for this product rather than pulled from a general set. The rule that
 * makes them cohere: every glyph is built from straight runs and one or two
 * arcs on a 24×24 grid, hinted to whole and half pixels, stroked and never
 * filled. Nothing is drawn that a 1.7px stroke at 15px cannot hold.
 *
 * WHERE THESE REPLACE LUCIDE
 *
 * Only where the icon carries meaning: the rail's destinations, the tool modes
 * in the composer, node kinds on the canvas, the settings sections. Everything
 * incidental — a close X, a chevron, a trash can, a magnifier — stays Lucide.
 * Redrawing a good general set to replace it is effort spent where nobody
 * looks, and the two are compatible by construction: same viewBox, same round
 * caps, and Lucide's default 2 sits beside our 1.7 without a visible seam.
 *
 * The one Lucide glyph to retire on sight is `Sparkles` for Create. It is the
 * universal "AI" mark, it says nothing about making a picture, and it is the
 * single icon most likely to make the product look like every other one.
 *
 * USAGE
 *
 *   <Icon d={P.studio} size={17} />
 *
 * Stroke width is fixed at 1.7 and should stay fixed. Icons get bigger, never
 * heavier — a heavier stroke at a larger size reads as a different family.
 * The rail's Lucide icons currently run at 1.8; match 1.7 when they change over.
 *
 * SIZES IN USE
 *   9–11px  inside pills and chips
 *   12–14px inline with body text, in menu rows
 *   15px    default
 *   17px    the rail
 */

export const P = {
  /* rail destinations */
  studio:   'M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  image:    'M3.5 5h17v14h-17zM3.5 15l4.5-4 3.5 3 4-3.5 5 4.5',
  thread:   'M4 5.5h7v6H4zM13 5.5h7v4h-7zM13 11.5h7v7h-7zM4 13.5h7v5H4z',
  campaign: 'M4 7l4-2 4 2 4-2 4 2v12H4z',
  avatar:   'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.2-3.4 4-5.2 7.5-5.2s6.3 1.8 7.5 5.2',
  asset:    'M3.5 5.5h17v13h-17zM3.5 14l4.5-4 4 3.5 3.5-3 5 4.5',
  library:  'M4 5h6v14H4zM12 5h3v14h-3zM17 5.5l3 .6-2.4 12.8-3-.6z',

  /* tool modes — the composer, and node kinds on the canvas */
  video:    'M4 6h11v12H4zM15 10.5l5-3v9l-5-3',
  tryon:    'M4 7l4-2 4 2 4-2 4 2v12H4z',
  ugc:      'M12 4a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  upscale:  'M4 9V4.5h5M20 15v4.5h-5M4 15v4.5h5M20 9V4.5h-5',
  voice:    'M4 11v2M8 8v8M12 4v16M16 8v8M20 11v2',

  /* settings sections */
  grid:     'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z',
  card:     'M3 6.5h18v11H3zM3 10.5h18M6 14.5h4',
  people:   'M9.5 12a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8M2.5 20c1-3 3.6-4.6 7-4.6s6 1.6 7 4.6M16 5.6a3.2 3.2 0 0 1 0 6.3M18 15.6c2 .7 3.2 2.2 3.5 4.4',
  bell:     'M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4zM10 18.5a2 2 0 0 0 4 0',
  shield:   'M12 3.5l7 2.5v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6zM9 12l2.2 2.2L15.5 10',
  book:     'M5 4h14v16l-7-3.5L5 20z',
} as const;

export type IconName = keyof typeof P;

/**
 * A path string may hold several subpaths. Split on M so each becomes its own
 * <path> — a single path with multiple M commands renders identically in every
 * browser we support, but splitting keeps the join behaviour predictable when
 * a glyph mixes closed shapes and open runs (video, library, upscale).
 */
export function Icon({
  d,
  size = 15,
  className,
}: {
  d: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d
        .split('M')
        .filter(Boolean)
        .map((s, i) => (
          <path key={i} d={'M' + s} />
        ))}
    </svg>
  );
}

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
 * Two Lucide glyphs to retire on sight:
 *
 *   `Sparkles` for Create   — the universal "AI" mark. It says nothing about
 *                             making a picture and is the single icon most
 *                             likely to make the product look like every
 *                             other one. Use `P.image`.
 *   `Settings` for the gear — eight teeth and an inner circle, illegible at
 *                             16px beside glyphs of three strokes, and the
 *                             most over-used icon on the internet.
 *                             Use `P.settings`.
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

  /*
   * Cinema — the eighth destination, drawn here because the set had no key for
   * it and `video` is spoken for by the composer's video mode. One glyph for
   * two things is the confusion this house set exists to remove.
   *
   * A film frame: the outer run plus two sprocket notches on each side. It
   * says *film* rather than *screen*, which is the distinction that matters —
   * Cinema is the wall, the shot list and the takes contact sheet, not a tool
   * that makes one clip.
   *
   * ⚠ CHOSEN AT THE FRAMES, NOT ON PAPER — and the first two drafts were wrong
   * in ways no amount of reasoning would have caught (founder law 6):
   *
   *   - A STRIP OF THREE CELLS ('M3 7h18v10H3zM9 7v10M15 7v10') was drafted
   *     first and FAILS at 17px: the cells mush into a dark block, and beside
   *     `library` — three vertical divisions in a rectangle — it is very
   *     nearly the same glyph. Rendered side by side they are confusable at
   *     rail size. `E4` in the working set is that shape retested; same result.
   *   - ITS OWN DOCBLOCK ARGUED PERFORATIONS COULD NOT HOLD at 1.7px/15px.
   *     That was reasoning, and the render disproves it: TWO notches a side,
   *     3 units long, hold cleanly at both 15px and 17px. A row of small round
   *     holes would indeed mush — two short ticks are not that.
   *
   * Seven candidates were drawn and looked at (screen+floor, two offset takes,
   * a 2-cell screen, sprockets top-and-bottom, rails, a bare 16:9 rectangle);
   * every "screen" shape reads as a MONITOR, and the offset pair reads as
   * *duplicate*. Only the film frame says cinema.
   *
   * The runner-up is ONE notch a side ('M4 5.5h16v13H4zM4 12h4M16 12h4') —
   * the most legible of all at 15px, and slightly less obviously film at size.
   * If this ever looks crowded in place, that is the swap.
   *
   * NOT a clapperboard: Lucide's is on Templates today, and it is the cliché
   * this set is getting away from.
   */
  cinema:   'M4 4.5h16v15H4zM4 9h3M4 15h3M17 9h3M17 15h3',

  /* tool modes — the composer, and node kinds on the canvas */
  video:    'M4 6h11v12H4zM15 10.5l5-3v9l-5-3',
  tryon:    'M4 7l4-2 4 2 4-2 4 2v12H4z',
  ugc:      'M12 4a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  upscale:  'M4 9V4.5h5M20 15v4.5h-5M4 15v4.5h5M20 9V4.5h-5',
  voice:    'M4 11v2M8 8v8M12 4v16M16 8v8M20 11v2',

  /*
   * Settings — the rail's foot, and anywhere else a gear is meant.
   *
   * Two horizontal rails with an offset handle on each: it says *adjust these*
   * without saying *cog*. Lucide's `Settings` is eight teeth plus an inner
   * circle, which mushes into a blurred ring at 16px beside glyphs that are
   * three or four strokes — and it is the most over-used icon on the internet,
   * the same objection as `Sparkles` for Create.
   *
   * `cog` below is the fallback if a cogwheel is genuinely wanted: four teeth
   * rather than eight, drawn at this set's density so it survives 16px.
   */
  settings: 'M3.5 9h10M17 9h3.5M15.2 9a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 0 0 3.6 0M3.5 15h3.5M10.5 15h10M8.8 15a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0',
  cog:      'M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2M12 3.5v2.6M12 17.9v2.6M20.5 12h-2.6M6.1 12H3.5M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6',

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

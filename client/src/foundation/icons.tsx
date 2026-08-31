/**
 * Klieg icons — the house set.
 *
 * Drawn for this product rather than pulled from a general set. The rule that
 * makes them cohere: every glyph is built from straight runs and one or two
 * arcs on a 24×24 grid, hinted to whole and half pixels, stroked and never
 * filled. Nothing is drawn that a 1.7px stroke at 15px cannot hold.
 *
 * PROVENANCE — and which copy is the real one (#280, #321)
 *
 * The founder drew this set and handed it over as
 * `docs/specs/Casting-ui-ux-design/drape-redesign/icons.tsx`, amended three
 * times (`P.settings`/`P.cog`; the `cinema` glyph; then the 27-glyph drop of
 * 2026-08-30 that added the topbar six and redrew `asset` and `cinema`).
 * **THIS file is the product's copy and the only one that compiles; the handoff
 * under `docs/` is the record of what he sent and is never edited to match
 * code.** A new glyph is added here. If the two ever disagree, this one is what
 * the app draws — say so in the PR rather than quietly syncing them, because
 * the handoff is evidence of a decision and not a second implementation.
 *
 * ⚠ **THE GLYPHS BELOW ARE HIS, BYTE FOR BYTE.** #321 copied his file in whole
 * rather than transcribing keys, which is why nothing in `P` can have drifted
 * in the copying. This paragraph is the ONLY thing this file adds to what he
 * sent, and it is about the two copies rather than about any glyph.
 *
 * WHERE THESE REPLACE LUCIDE
 *
 * Only where the icon carries meaning or is seen on every page: the rail's
 * destinations, the topbar chrome, the tool modes in the composer, node kinds
 * on the canvas, the settings sections.
 *
 * WHAT STAYS LUCIDE — and should
 *
 *   chevrons, arrows, plus, close X, check, trash, ellipsis, download,
 *   external-link, lock, star, eye, copy, folder, upload, play/pause
 *
 * Those are pure interface furniture: nobody reads them as brand, and Lucide
 * draws them well. Redrawing a good general set is effort spent where nobody
 * looks, and the two are compatible by construction — same viewBox, same round
 * caps, and Lucide's default 2 sits beside our 1.7 without a visible seam.
 *
 * The account and utility menu rows use these `P` keys where one fits
 * (`P.settings`, `P.people`, `P.card`, `P.book`, `P.shield`) and Lucide for the
 * rest. Menu rows are 13px, which is the smallest size anything in this set
 * should ever be drawn at.
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
  /*
   * Assets — a stack of two frames, offset.
   *
   * ⚠ REDRAWN 2026-08-30 on his word ("go with a"). What it replaced —
   * 'M3.5 5.5h17v13h-17zM3.5 14l4.5-4 4 3.5 3.5-3 5 4.5' — was a rectangle
   * with a peak line, i.e. `image` shifted by half a unit, and **at 17px the
   * two read as ONE glyph while sitting four rows apart on the same rail.**
   * That is the exact confusion this set exists to remove, and it was found by
   * comparing the paths, then confirmed at the frames.
   *
   * A stack is what Assets IS — plural, where Create is singular. Two strokes.
   *
   * Chosen from seven candidates rendered beside `image` at 17/15/44px
   * (`output/_assets-glyph/assets-candidates.png`). Two died on collisions of
   * their own: a four-square grid is `grid`, and every frame-with-peak variant
   * still echoes `image`. Runner-up was a corner-fold file shape.
   *
   * ⚠ THE KNOWN TRADEOFF, stated rather than hidden: two offset rectangles is
   * also how Lucide draws `copy`. Acceptable because the contexts never meet —
   * `copy` lives in menus and row actions, this is a rail destination — but if
   * a surface ever puts them side by side, this is the glyph that moves.
   */
  asset:    'M7 4.5h13.5v11H7zM3.5 8.5v11H17',
  library:  'M4 5h6v14H4zM12 5h3v14h-3zM17 5.5l3 .6-2.4 12.8-3-.6z',

  /*
   * Cinema — a clapperboard: the slate bar hinged over the body, with two
   * diagonal stripes. Deliberately NOT `video` (a frame with a play spout),
   * which is the composer's video mode; two destinations wearing one glyph is
   * the confusion the set exists to avoid.
   *
   * Four strokes plus two stripes, and the stripes are the widest-spaced marks
   * in the set — a real clapper has six or seven, which fills in at 17px.
   */
  cinema:   'M3.5 9.5h17v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM3.5 9.5 4.4 5.4l16.6 1.9-.5 2.2M9.6 9.2 8.2 5.9M15 9.8l-1.4-3.3',

  /* tool modes — the composer, and node kinds on the canvas */
  video:    'M4 6h11v12H4zM15 10.5l5-3v9l-5-3',
  tryon:    'M4 7l4-2 4 2 4-2 4 2v12H4z',
  ugc:      'M12 4a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  upscale:  'M4 9V4.5h5M20 15v4.5h-5M4 15v4.5h5M20 9V4.5h-5',
  voice:    'M4 11v2M8 8v8M12 4v16M16 8v8M20 11v2',

  /*
   * Topbar chrome — on every page, so the most-seen glyphs after the rail.
   *
   * Lucide's versions of these are the densest in its set: `Sun` is a circle
   * plus eight full-length rays, `Bug` carries antennae, legs and body
   * segments. At the 15px the topbar uses, both fill in. These are the same
   * subjects drawn at this set's density — shorter rays, fewer legs.
   */
  search:   'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14M15.5 15.5 20.5 20.5',
  sun:      'M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2M12 3.6v1.7M12 18.7v1.7M20.4 12h-1.7M5.3 12H3.6M17.9 6.1l-1.2 1.2M7.3 16.7l-1.2 1.2M17.9 17.9l-1.2-1.2M7.3 7.3 6.1 6.1',
  moon:     'M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6',
  bug:      'M12 7.4a4.6 4.6 0 0 1 4.6 4.6v2a4.6 4.6 0 0 1-9.2 0v-2A4.6 4.6 0 0 1 12 7.4M9.4 7 7.9 4.4M14.6 7l1.5-2.6M7.4 11.4H4.6M16.6 11.4h2.8M7.4 15.6H5.1M16.6 15.6h2.3',
  help:     'M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2M9.6 9.4a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2.1-2.5 3.6M12 16.9v.1',
  megaphone:'M4.5 10v4l12 4.4V5.6zM16.5 9h2a2.6 2.6 0 0 1 0 6h-2M7.2 14.6V19h2.6',

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

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
 * ⚠ **#382 EDITED THE HANDOFF, AND THE CLAUSE ABOVE IS WHY THAT NEEDS SAYING
 * OUT LOUD RATHER THAN BEING LEFT TO A READER.** *"Never edited to match code"*
 * bans papering over a transcription slip by moving his file to wherever ours
 * ended up. #382 ran the other way: **his own newer word moved the glyph, and
 * both copies were changed in one act** so the mirror arm still does its whole
 * job. The test of which kind a change is: did the source of the correction
 * come from him, or from this repository? `cog` came from him — reply #78,
 * *"the cog is incorrect its a star or sun."*
 *
 * ⚠ **AND ONE GLYPH IN `P` IS NO LONGER HIS DRAWING.** #321 copied his file in
 * whole rather than transcribing keys, so nothing in `P` drifted in the
 * copying, and that remains true of 26 of the 27. **`cog` is lucide-react's
 * `Settings` (ISC), path copied verbatim** — because reply #78 named a mark on
 * his screen (*"a cog like in the top bar profile drop down menu"*, which is
 * `UserCard.tsx` drawing exactly that at 16px) and a hand-drawn near-miss of a
 * glyph the product already renders would be a third gear, not an answer.
 *
 * WHERE THESE REPLACE LUCIDE
 *
 * Only where the icon carries meaning or is seen on every page: the rail's
 * destinations, the topbar chrome, the tool modes in the composer, node kinds
 * on the canvas, the settings sections.
 *
 * WHAT STAYS LUCIDE — and should
 *
 *   The list is `LUCIDE_FURNITURE` below — data, kept in one place so the
 *   specimen sheet at `/admin/foundation` can draw it under the gallery and
 *   this comment cannot drift from it (working law 4).
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
 *   `Settings` for the gear — ⚠ **THIS ENTRY IS SPENT, and it is left standing
 *                             because deleting it would hide a reversal he made
 *                             at the frames.** It read: *"eight teeth and an
 *                             inner circle, illegible at 16px … the most
 *                             over-used icon on the internet."* Two corrections
 *                             later (#373, then #382) `P.cog` IS that glyph —
 *                             lucide's `Settings`, copied. The legibility half
 *                             was answered by his eye at 16px in the profile
 *                             menu; the over-used half he simply outranked.
 *                             **The live rule is unchanged and is the only one
 *                             that matters: ONE gear, never two.** Import it
 *                             from `P`, not from `lucide-react`, so the set
 *                             stays a set and the size and stroke come from
 *                             `Icon`.
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
   * ⚠ **THESE SIX ARE THE PROTOTYPE'S OWN INLINE DRAWINGS, LIFTED VERBATIM
   * (#423), AND THE PARAGRAPH THAT USED TO SIT HERE IS THE REASON THEY WERE
   * NOT.** It read: *"Lucide's versions of these are the densest in its set …
   * These are the same subjects drawn at this set's density — shorter rays,
   * fewer legs."* Every word of that is true of Lucide and it answers the
   * wrong question. **The subject was never Lucide; it was the prototype**,
   * which draws its own chrome and had drawn all six.
   *
   * The road: #321 exported his icon MAP, and the prototype draws the topbar
   * inline in the markup rather than through that map — his own diagnosis —
   * so the chrome six were missing and were **drawn fresh to fill the hole**.
   * They were then checked, repeatedly, against the copy under `docs/` — which
   * held the same fresh drawings. **Two copies of one mistake agree.** His eye
   * closed it, 2026-09-02: *"the icons are not the same as the prototypes on
   * the top bar e.g the bug icon the theme icon notification icon etc."*
   *
   * They were not near-misses. `megaphone` was a MEGAPHONE where his is a
   * SPEAKER; `bug` had four legs against his six and no separate antennae
   * stroke. Different objects, not different roundings.
   *
   * ⚠ **`search` IS THE ONE THAT IS NOT A COPY, AND IT IS DECLARED RATHER THAN
   * QUIET.** The prototype draws it as a `<circle cx=11 cy=11 r=7>` ELEMENT
   * plus a path, and `Icon` splits on M and renders `<path>` and nothing else.
   * The circle is written here as the arc pair every other ring in this set
   * uses. **Measured rather than assumed** (#423's own instruction): rendered
   * against the prototype's `<circle>` at 13, 15 and 120px, the two differ
   * only in the renderer's antialiasing of the stroke edges — two hairlines,
   * max delta 66/255 on edge pixels alone — while the same comparison scores a
   * control moved one TENTH of a unit at 188. Same curve, same handle.
   *
   * Where his file and the prototype disagree, **the prototype is what he
   * pointed at**, and both copies moved together on #382's precedent.
   */
  search:   'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16.5 16.5 21 21',
  sun:      'M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0',
  moon:     'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  bug:      'M9 4.5l1.5 2.5h3L15 4.5M7 9.5h10v5a5 5 0 0 1-10 0zM3.5 11h3.5M17 11h3.5M4.5 16.5L7 15.5M19.5 16.5L17 15.5M5.5 6.5L7.5 8M18.5 6.5L16.5 8',
  help:     'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6M12 16.5v.6',
  megaphone:'M6 9.5h4l5-3.5v12l-5-3.5H6zM17.5 9.5a4 4 0 0 1 0 5',

  /*
   * Settings — the rail's foot, and anywhere else a gear is meant.
   *
   * Two horizontal rails with an offset handle on each: it says *adjust these*
   * without saying *cog*. `settings` is UNUSED since #373 moved the rail's
   * foot to `cog`; it stays because his rule is "don't use both", not "delete
   * the other one".
   *
   * ⚠ **`cog` WAS THE `sun` GLYPH UNDER ANOTHER NAME UNTIL #382, and the
   * sentence that used to sit here described teeth that were never drawn.**
   * It read *"four teeth rather than eight, drawn at this set's density"*; the
   * path was one circle plus EIGHT straight strokes at exactly 45° intervals —
   * measurably the same construction as `sun` two keys above, which the
   * topbar draws as the light-theme toggle. So the rail's foot and the theme
   * button were one picture. His eye caught it the day it shipped, reply #78,
   * verbatim: *"the cog is incorrect its a star or sun it should be a cog like
   * in the top bar profile drop down menu."*
   *
   * **So `cog` is now the gear that dropdown actually draws** — lucide-react's
   * `Settings` (ISC), path copied rather than redrawn, because he pointed at a
   * mark on his screen and a hand-drawn near-miss is a third gear. Its
   * `<circle>` is written as this set's arc pair since `Icon` splits on M and
   * renders nothing else. Two subpaths, one of them long.
   *
   * ⚠ The objection this docblock used to make against that glyph — *"mushes
   * into a blurred ring at 16px"* — is kept rather than deleted, and it is
   * ANSWERED by his own eye: `UserCard.tsx` renders it at 16px in the profile
   * menu, and that is the render he called correct.
   */
  settings: 'M3.5 9h10M17 9h3.5M15.2 9a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 0 0 3.6 0M3.5 15h3.5M10.5 15h10M8.8 15a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0',
  cog:      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',

  /* settings sections */
  grid:     'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z',
  card:     'M3 6.5h18v11H3zM3 10.5h18M6 14.5h4',
  people:   'M9.5 12a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8M2.5 20c1-3 3.6-4.6 7-4.6s6 1.6 7 4.6M16 5.6a3.2 3.2 0 0 1 0 6.3M18 15.6c2 .7 3.2 2.2 3.5 4.4',
  bell:     'M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4zM10 18.5a2 2 0 0 0 4 0',
  shield:   'M12 3.5l7 2.5v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6zM9 12l2.2 2.2L15.5 10',
  book:     'M5 4h14v16l-7-3.5L5 20z',

  /*
   * Leaving the account — the account menu's last row (#374, brief 04 §2e).
   *
   * ⚠ **HIS BRIEF SAYS `P.exit` IS IN `icons.tsx` AND IT IS NOT** — not in the
   * committed `drape-redesign/icons.tsx`, not in the superseded
   * `icons-original.tsx`. The fresh drop §2b promises has not arrived, and the
   * row cannot carry an icon he ruled it must carry without one.
   *
   * **So this is lucide-react's `log-out` (ISC), path copied rather than
   * redrawn** — the same answer #382 reached for `cog`, and for its reason:
   * *"he pointed at a mark on his screen and a hand-drawn near-miss is a third
   * gear."* A door open on the left, an arrow leaving through it. Drawn
   * through `Icon`, so it takes this set's 1.7 stroke rather than lucide's 2.
   *
   * lucide writes the arrow as a `<polyline>` and the bar as a `<line>`; both
   * are rewritten as subpaths here because `Icon` splits on M and renders
   * nothing else. Three subpaths.
   *
   * **It is his to overwrite.** The moment his set gains an `exit`, take his:
   * this is a stand-in for a glyph he owns, and it is flagged as one on #374.
   */
  exit:     'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
} as const;

export type IconName = keyof typeof P;

/**
 * THE SET IS SHOWN, NOT ONLY STORED (founder, 2026-09-02).
 *
 * His question: *"should the standardized icon family/glyphs we use be stored
 * somewhere to keep it consistent across the app build and design like on the
 * featured components page or something?"* — and his correction in the same
 * breath: *"29 glyphs isnt the cap its just what we have so far."*
 *
 * The storing half was already this file. The showing half is section 13 of
 * the specimen sheet (`pages/AdminFoundation.tsx`), which iterates `P` — it
 * never names a key by hand and never states a count, so a glyph added above
 * appears on the sheet with nobody touching the sheet (working law 4: derive,
 * never mirror). `icons-guard.test.ts` holds it to that.
 *
 * Two small pieces of data ride with it, kept HERE so the sheet stays derived:
 */

/**
 * What stays Lucide — interface furniture nobody reads as brand: the module
 * docblock's "WHAT STAYS LUCIDE" list, as data, so the sheet can draw the
 * boundary. Those are pure interface furniture: nobody reads them as brand,
 * and Lucide draws them well. Adding a house glyph for one of these is a
 * decision, not a tidy-up — it is exactly the effort-where-nobody-looks the
 * docblock warns against.
 */
export const LUCIDE_FURNITURE = [
  "chevrons",
  "arrows",
  "plus",
  "close X",
  "check",
  "trash",
  "ellipsis",
  "download",
  "external-link",
  "lock",
  "star",
  "eye",
  "copy",
  "folder",
  "upload",
  "play/pause",
] as const;

/**
 * Glyphs in `P` that are NOT his drawing, and why — so the sheet can say so
 * beside them rather than present a borrowed path as his authorship. Each key
 * must exist in `P` and its own docblock above must name lucide; the guard
 * checks both, so a borrowed glyph cannot be added here quietly, nor one of
 * his listed here by mistake.
 */
export const BORROWED: Readonly<Partial<Record<IconName, string>>> = {
  cog: "lucide-react's Settings, path copied on his word (card 382): he pointed at the gear already on his screen.",
  exit: "lucide-react's log-out, a stand-in until his set gains an exit glyph (card 374). His to overwrite.",
};

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

/**
 * KliegWordmark — the product's mark, cut from the LOCKED brand reference
 * (`docs/brand/klieg-logo-reference.html`, locked 2026-07-21).
 *
 * The reference's rules, carried here rather than re-decided:
 *   - always lowercase; no caps variant exists, in any context
 *   - semibold grotesque, tight tracking (600 / -0.015em)
 *   - the BULB is the signature: the i is a dotless ı and its tittle is drawn
 *     separately, raised and oversized
 *   - FLAT cut (light / print / watermark): no glow — the raised tittle alone
 *     carries the signature. The GLOWING cut is the dark lockup and has no
 *     consumer yet: both surfaces drawing this today sit on light paper,
 *     because the canvas is pinned light until its rebuild (`canvas-tokens.css`,
 *     the stated gap behind #916). It is deliberately not built unused.
 *   - no colour, ever; watermark use is corner-set at reduced opacity
 *
 * ⚠ IT IS RENDERED IN THE DOM, NOT AS AN `<img src>` SVG, AND THAT IS THE
 * WHOLE REASON THIS FILE EXISTS. An SVG loaded through `<img>` is a separate
 * document that cannot reach the page's webfonts, so the retired
 * `/drape-logo.svg` — a bare `<text>` naming Inter first — had always rendered
 * in whatever face the machine happened to have. The bulb is positioned in em
 * off the text's own metrics, so a face substituted underneath it would carry
 * the dot off the stem. Inline, the page's real Inter applies.
 *
 * ⚠ WHAT IS STILL OWED, DECLARED RATHER THAN IMPLIED (the fidelity law): the
 * reference's own last rule is *"Final cut: license a grotesque (Söhne class)
 * and re-tune dot metrics + glow to it; this file uses a system stand-in."*
 * That licence is not bought, so this is cut in Inter — the app's own type,
 * and the same class of stand-in the reference itself renders in. The dot
 * metrics below are the reference's values verbatim and are re-tuned with the
 * face when it lands.
 *
 * COLOUR IS INHERITED, never set here: the mark is monochrome by rule, so
 * `currentColor` is both the brand rule and the composable answer — and the
 * bulb reads it too, so a consumer can never colour the word and lose the dot.
 */

interface KliegWordmarkProps {
  /** Rendered size. The mark is metric-locked in em, so one number sets it. */
  fontSize: number;
  /** Watermark use: the reference's "corner-set, reduced opacity". */
  opacity?: number;
  /** Layout only — the mark's own type rules are not overridable. */
  className?: string;
}

export function KliegWordmark({ fontSize, opacity, className }: KliegWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="Klieg"
      className={className}
      style={{
        display: 'inline-block',
        whiteSpace: 'nowrap',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize,
        fontWeight: 600,
        letterSpacing: '-0.015em',
        lineHeight: 1,
        opacity,
        userSelect: 'none',
      }}
    >
      kl
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {/* U+0131 LATIN SMALL LETTER DOTLESS I — the tittle is the bulb below */}
        {'ı'}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '0.115em',
            width: '0.13em',
            height: '0.13em',
            borderRadius: '50%',
            background: 'currentColor',
            transform: 'translateX(-50%)',
          }}
        />
      </span>
      eg
    </span>
  );
}

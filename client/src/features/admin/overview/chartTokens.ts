import { useEffect, useState } from "react";

/**
 * The token values, read from `:root`, for the one place a token cannot BE a
 * token — a recharts prop (brief 07 §7, §12).
 *
 * Recharts takes `stroke`, `fill` and `tick.fill` as plain strings and hands
 * them to SVG attributes. `var(--ink)` in an SVG *attribute* does not resolve,
 * so every chart in this product has historically carried a hard-coded light
 * hex — which is his §7 sentence: *"hard-coded light hex in a chart is why
 * staff surfaces break in dark."*
 *
 * ## Why a hook and not a constant
 *
 * The theme is `data-theme` on `<html>` and nothing else (`foundation/theme.ts`).
 * A module-level read would capture whichever theme happened to be painted when
 * this module first evaluated and then be wrong forever after a toggle — the
 * charts would keep their light strokes on a dark page, which is the exact
 * defect this file exists to remove, moved one layer up. So the values are read
 * on mount AND re-read when that attribute changes.
 *
 * ## §12 asked for this to be one helper rather than three
 *
 * *"If `UserGrowthCard`, `CreditEconomyCard` and `GovernanceCard` each read
 * `:root` separately, that is three copies of the same six lines."* There are
 * five consumers, and this is the only reader.
 *
 * ## The degradation, stated rather than hidden
 *
 * `getPropertyValue` returns `""` for a custom property that is not defined —
 * which never happens in the running app (tokens.css is imported by
 * `index.css`) but is always true under jsdom, where no stylesheet is applied.
 * An empty string handed to SVG paints nothing, so an unresolved token falls
 * back to `currentColor`: it inherits the element's own colour, which is
 * already themed, and it is not a hex literal — `token-guard` covers this file.
 */
export interface ChartTokens {
  /** The primary series and the one bar that is today. */
  ink: string;
  /** The second series, and only where the second series is an attention state. */
  accent: string;
  /** Grid lines. */
  rule: string;
  /** Axis lines. */
  border: string;
  /** Axis ticks and labels. */
  faint: string;
  /** Tooltip surface. */
  surface: string;
  /** Tooltip border. */
  borderCard: string;
  /** Inactive sparkline bars, and the greyscale step below `--ink`. */
  dots: string;
  /** Secondary text inside a chart's own furniture. */
  metaStrong: string;
}

/** Every token this module reads, mapped to the field that carries it. */
const TOKENS: Record<keyof ChartTokens, string> = {
  ink: "--ink",
  accent: "--accentSolid",
  rule: "--rule",
  border: "--border",
  faint: "--faint",
  surface: "--surface",
  borderCard: "--borderCard",
  dots: "--dotsStrong",
  metaStrong: "--metaStrong",
};

/**
 * ⚠ Not a hex, deliberately — see the degradation note above. `token-guard`
 * enrols this file, and a literal here would be the very thing being removed.
 */
const UNRESOLVED = "currentColor";

function readTokens(): ChartTokens {
  /* `document` is absent under a non-DOM test environment; the fallback object
     is the same shape so a consumer never branches on undefined. */
  if (typeof document === "undefined") {
    return Object.fromEntries(
      Object.keys(TOKENS).map((k) => [k, UNRESOLVED]),
    ) as unknown as ChartTokens;
  }
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([field, token]) => [
      field,
      style.getPropertyValue(token).trim() || UNRESOLVED,
    ]),
  ) as unknown as ChartTokens;
}

export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(readTokens);

  useEffect(() => {
    /* Read once more on mount: the first render can happen before the
       stylesheet has applied, and `useState`'s initialiser runs then. */
    setTokens(readTokens());

    const observer = new MutationObserver(() => setTokens(readTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

/**
 * The tooltip's own style object, built from the tokens.
 *
 * Every card had its own `TT_STYLE` constant with the same five light-mode
 * literals in it — five copies, five files, all of them white on a dark page.
 */
export function tooltipStyle(t: ChartTokens) {
  return {
    background: t.surface,
    border: `1px solid ${t.borderCard}`,
    borderRadius: "var(--r-sm)",
    boxShadow: "var(--shadowPop)",
    font: "400 12px var(--font-sans)",
    color: t.ink,
  } as const;
}

/** Axis tick styling, identical on every chart (§7). */
export function axisTick(t: ChartTokens) {
  return { fontSize: 10, fill: t.faint, fontFamily: "var(--font-mono)" } as const;
}

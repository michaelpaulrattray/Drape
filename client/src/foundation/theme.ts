/**
 * Foundation theme truth (CASTING_V2_ARCHITECTURE_PLAN.md §D.8).
 *
 * The theme is an attribute on <html> and nothing else, so no component
 * ever branches on it. Three consumers must agree on the values here:
 *
 *   1. the inline first-paint script in client/index.html (a classic
 *      script — it cannot import this module and still beat first paint,
 *      so theme.test.ts asserts the script text embeds these constants),
 *   2. ThemeProvider (client/src/contexts/ThemeContext.tsx),
 *   3. the theme-parity screenshot drive (scripts/drive-foundation-theme-parity.mts).
 */

export type Theme = "light" | "dark";

/** Persistence key. The legacy `theme` key is dead and never read (§L.R item 3). */
export const THEME_STORAGE_KEY = "drape_theme";

/**
 * Light (founder decision, 2026-07-30 — supersedes §B-10's "dark for
 * continuity").
 *
 * §B-10 chose dark for continuity with the current product. Measurement at M2
 * showed the premise was wrong: every legacy surface rendered *light*
 * regardless of theme, because the shadcn slots were light-only and components
 * hardcoded their colours. Defaulting to dark therefore made the app look
 * mixed — themed lobby and Casting against a light studio, admin, moderator
 * and board canvas — until every surface migrates.
 *
 * Light is what the product actually looks like today, so nothing jars, and
 * dark is one toggle away. Flip this back once the remaining surfaces follow
 * tokens; it is the only place the default lives.
 */
export const DEFAULT_THEME: Theme = "light";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * The theme to paint with, given whatever was in storage. Anything
 * unrecognised (absent, corrupt, a value from an older build) falls back to
 * the default rather than throwing — a broken storage entry must never leave
 * the app unthemed.
 */
export function resolveInitialTheme(stored: string | null | undefined): Theme {
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Apply a theme to the document.
 *
 * `data-theme` on <html> is the whole mechanism. M1 also wrote a `dark` class
 * because the shadcn `dark:` utilities keyed off it; M2 redefined that custom
 * variant as `[data-theme="dark"]`, so the second write is gone and there is
 * exactly one switch.
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.setAttribute("data-theme", theme);
}

/** Never throws: storage can be unavailable (private mode, blocked cookies). */
export function readStoredTheme(fallback: Theme = DEFAULT_THEME): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A theme that cannot be persisted is still a theme worth painting.
  }
}

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

/** Dark, for continuity with the current product (§B-10). */
export const DEFAULT_THEME: Theme = "dark";

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
 * `data-theme` is the foundation switch. The `dark` class is kept in sync
 * because ~46 `dark:` Tailwind utilities on legacy surfaces still read it —
 * dropping it here would leave the lobby half-themed. M2 redefines the `dark`
 * custom variant as `[data-theme="dark"]` and this second write goes away.
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
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

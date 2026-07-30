import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  applyTheme,
  otherTheme,
  readStoredTheme,
  writeStoredTheme,
  type Theme,
} from "@/foundation/theme";

/**
 * Theme provider (CASTING_V2_ARCHITECTURE_PLAN.md §D.8).
 *
 * Rewritten at M1: the theme is persisted under `drape_theme`, applied as
 * `data-theme` on <html>, and always switchable. The old `switchable` prop is
 * gone — it defaulted to false, which meant persistence never ran and the
 * stored value was never read. The inline script in client/index.html applies
 * the stored theme before first paint; this provider is the runtime owner of
 * the same state.
 *
 * The toggle belongs to the app shell (foundation Topbar), never to a feature.
 */

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Only used when storage holds nothing usable. */
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  // A stored preference always wins; defaultTheme is only the cold-start fallback.
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(defaultTheme));

  useEffect(() => {
    applyTheme(document.documentElement, theme);
    writeStoredTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((prev) => otherTheme(prev)), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

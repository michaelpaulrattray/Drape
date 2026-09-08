/**
 * #686 — LIGHT IS THE DEFAULT THEME, DECLARED ONCE.
 *
 * Founder, 2026-09-08 (terminal), verbatim: *"light is default not dark theme"*
 * — and it already was, in `foundation/theme.ts` (`DEFAULT_THEME = "light"`,
 * his 2026-07-30 decision). What made the app open dark for six weeks was a
 * second declaration: `App.tsx` passed `<ThemeProvider defaultTheme="dark">`,
 * which `readStoredTheme(defaultTheme)` honoured over the foundation's value.
 * Two declarations of one fact, and the wrong one won (working law 4).
 *
 * Two arms: the foundation says light, and the app shell says nothing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_THEME } from "./theme";

const APP = path.join(process.cwd(), "client", "src", "App.tsx");

describe("#686 · light is the default theme, declared in one place", () => {
  it("the foundation's default is light", () => {
    expect(DEFAULT_THEME).toBe("light");
  });

  it("App.tsx passes ThemeProvider no defaultTheme override", () => {
    const source = readFileSync(APP, "utf8");
    expect(source).toMatch(/<ThemeProvider>/);
    expect(source).not.toMatch(/<ThemeProvider\s+defaultTheme=/);
  });

  it("POSITIVE CONTROL — the override that shipped is what the arm refuses", () => {
    const source = readFileSync(APP, "utf8");
    const sabotaged = source.replace("<ThemeProvider>", '<ThemeProvider defaultTheme="dark">');
    expect(sabotaged).not.toBe(source);
    expect(sabotaged).toMatch(/<ThemeProvider\s+defaultTheme=/);
  });
});

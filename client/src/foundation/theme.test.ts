import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  isTheme,
  otherTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
} from "./theme";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const indexHtmlPath = path.join(repoRoot, "client", "index.html");
const securityHeadersPath = path.join(repoRoot, "server", "security", "securityHeaders.ts");

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1],
  );
}

describe("theme boot", () => {
  it("defaults to light, matching how the product actually renders today", () => {
    // Founder decision 2026-07-30, superseding the plan's §B-10. Dark was
    // chosen "for continuity", but every legacy surface renders light, so the
    // dark default showed a mixed app. Revisit when the rest follow tokens.
    expect(DEFAULT_THEME).toBe("light");
  });

  it("falls back to the default instead of leaving the app unthemed", () => {
    expect(resolveInitialTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveInitialTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveInitialTheme("")).toBe(DEFAULT_THEME);
    expect(resolveInitialTheme("Dark")).toBe(DEFAULT_THEME);
    expect(resolveInitialTheme('"dark"')).toBe(DEFAULT_THEME);
    expect(resolveInitialTheme("system")).toBe(DEFAULT_THEME);
  });

  it("honours a stored preference", () => {
    expect(resolveInitialTheme("light")).toBe("light");
    expect(resolveInitialTheme("dark")).toBe("dark");
  });

  it("recognises exactly two themes", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
  });

  it("persists under drape_theme and never touches the dead `theme` key", () => {
    expect(THEME_STORAGE_KEY).toBe("drape_theme");
    const source = fs.readFileSync(path.join(__dirname, "theme.ts"), "utf8");
    expect(source).not.toMatch(/getItem\(\s*["']theme["']\s*\)/);
  });
});

describe("first-paint theme script", () => {
  const html = fs.readFileSync(indexHtmlPath, "utf8");
  const scripts = inlineScripts(html);

  it("ships exactly one inline script — every one needs its own CSP hash", () => {
    expect(scripts).toHaveLength(1);
  });

  it("is a classic script so it runs before first paint", () => {
    // `type="module"` is deferred: it would paint the wrong theme first.
    expect(html).not.toMatch(/<script\s+type="module"(?![^>]*\bsrc=)/);
  });

  it("agrees with theme.ts on the key, the values and the default", () => {
    const [script] = scripts;
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain('"light"');
    expect(script).toContain('"dark"');
    // The literal fallback in the script must be the module's default theme.
    expect(script).toContain(`t="${DEFAULT_THEME}"`);
    expect(script).toContain("data-theme");
  });

  it("writes only the data-theme switch", () => {
    // M2 redefined the `dark` custom variant as [data-theme="dark"], so the
    // class is gone. A second switch here would be a second source of truth.
    const [script] = scripts;
    expect(script).not.toContain("classList");
    const themeModule = fs.readFileSync(path.join(__dirname, "theme.ts"), "utf8");
    expect(themeModule).not.toContain("classList");
  });

  it("keys the Tailwind dark variant off the same attribute", () => {
    const indexCss = fs.readFileSync(
      path.join(repoRoot, "client", "src", "index.css"),
      "utf8",
    );
    const variant = indexCss.match(/@custom-variant dark \(([^)]*\))\);?/)?.[1] ?? "";
    expect(variant, "the dark variant must read data-theme, not a class").toContain(
      '[data-theme="dark"]',
    );
    expect(variant).not.toContain(".dark");
  });

  it("is allowed by the production CSP", () => {
    const expected = `sha256-${createHash("sha256").update(scripts[0], "utf8").digest("base64")}`;
    const headers = fs.readFileSync(securityHeadersPath, "utf8");
    const declared = headers.match(/THEME_BOOT_SCRIPT_HASH\s*=\s*"([^"]+)"/)?.[1];

    expect(
      declared,
      "securityHeaders.ts must declare THEME_BOOT_SCRIPT_HASH",
    ).toBeDefined();
    expect(
      declared,
      `Inline theme script changed. Update THEME_BOOT_SCRIPT_HASH to ${expected} or production loads will flash the wrong theme.`,
    ).toBe(expected);

    // And the hash has to actually reach the production directive.
    expect(headers).toMatch(/script-src 'self' '\$\{THEME_BOOT_SCRIPT_HASH\}'/);
  });
});

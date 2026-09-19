import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FONTS ARE NEVER INLINED INTO THE STYLESHEET (#1044).
 *
 * The production CSP says `font-src 'self' https://fonts.gstatic.com` and
 * `server/security/securityHeaders.test.ts` pins that string, so a font the
 * build folds into the CSS as a `data:` URL is a font the browser refuses.
 * Vite's default `build.assetsInlineLimit` (4096 bytes) folds six of the mono
 * face's subsets exactly that way — measured at the built stylesheet on
 * 2026-09-19, six CSP violations on every production page load, invisible on
 * the dev server because it inlines nothing.
 *
 * # Why this reads the CONFIG and not a constant beside it
 *
 * Invariant 5 — assert at the wire. The claim is about the answer vite is
 * handed for a font path, so the arm imports `vite.config.ts` and calls the
 * `assetsInlineLimit` it exports, with the two inputs that matter: a font
 * (must be `false`, whatever its size) and a non-font (must be `undefined`,
 * so the default still applies to everything else). The built CSS is the
 * final proof and it needs a build; this is the arm that runs in seconds.
 */

type InlineLimit = number | ((filePath: string, content: Buffer) => boolean | undefined);

async function loadInlineLimit(): Promise<InlineLimit | undefined> {
  vi.resetModules();
  const mod = (await import("../vite.config")) as {
    default: { build?: { assetsInlineLimit?: InlineLimit } };
  };
  return mod.default.build?.assetsInlineLimit;
}

afterEach(() => {
  vi.resetModules();
});

/** Every file `@fontsource/jetbrains-mono` and `@fontsource/archivo` ship, by format, plus the formats a future face could bring. */
const FONT_PATHS = [
  "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-ext-400-normal.woff2",
  "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-ext-400-normal.woff",
  // A Windows absolute path, upper-cased extension — the regex is anchored on
  // the extension alone and is case-insensitive.
  String.raw`C:\Users\x\Drape\node_modules\@fontsource\archivo\files\archivo-vietnamese-500-normal.WOFF2`,
  "client/src/assets/face.ttf",
  "client/src/assets/face.otf",
  "client/src/assets/face.eot",
];

const NON_FONT_PATHS = [
  "client/src/assets/swatch.png",
  "client/src/assets/logo.svg",
  "client/src/assets/mark.webp",
  // A path that merely CONTAINS a font extension is not a font.
  "client/src/assets/woff2-icon.png",
  "client/src/assets/fonts.json",
];

describe("vite.config — build.assetsInlineLimit never inlines a font", () => {
  it("is a function, not the default number", async () => {
    const limit = await loadInlineLimit();
    expect(typeof limit).toBe("function");
  });

  it("answers false for every font format, at any size", async () => {
    const limit = (await loadInlineLimit()) as Exclude<InlineLimit, number>;
    for (const filePath of FONT_PATHS) {
      // 1160 bytes is the smallest subset actually shipped; the answer must
      // not depend on the size at all.
      expect(limit(filePath, Buffer.alloc(1160)), filePath).toBe(false);
      expect(limit(filePath, Buffer.alloc(0)), `${filePath} (empty)`).toBe(false);
    }
  });

  it("answers undefined for everything else, so the default still governs it", async () => {
    const limit = (await loadInlineLimit()) as Exclude<InlineLimit, number>;
    for (const filePath of NON_FONT_PATHS) {
      expect(limit(filePath, Buffer.alloc(100)), filePath).toBeUndefined();
    }
  });
});

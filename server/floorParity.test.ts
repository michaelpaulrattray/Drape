/**
 * THE floor parity guard (R-7 as sharpened at VC-R6 final fix 3): ONE field
 * + dot token pair, ONE geometry — 24px rhythm, 0.75px dot radius — consumed
 * identically by every work surface. The board drifted once (React Flow
 * draws radius = size/2, so size 1 rendered 0.5px against the CSS surfaces'
 * 0.75px and read a step lighter at 100%). Source-level assertions so a
 * second dot constant can never creep in silently.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf-8");

const CSS_DOT_SURFACES = [
  "client/src/features/boards/canvas/CanvasImageViewer.tsx",
  "client/src/features/boards/canvas/DottedGridBackground.tsx",
  "client/src/features/studio/components/StudioCanvas.tsx",
];

describe("THE floor (R-7): one field + dot pair, one geometry", () => {
  it("every CSS dot surface draws the token at 0.75px on a 24px grid", () => {
    for (const rel of CSS_DOT_SURFACES) {
      const src = read(rel);
      // Nested-paren aware: var(--…) closes before the gradient does
      const gradients = src.match(/radial-gradient\((?:[^()]|\([^()]*\))*\)/g) ?? [];
      expect(gradients.length, `${rel} should draw a dot grid`).toBeGreaterThan(0);
      for (const g of gradients) {
        expect(g, `${rel} must consume the dot token`).toContain("var(--color-canvas-field-dot)");
        expect(g, `${rel} must draw the 0.75px dot`).toContain("0.75px");
      }
      expect(src, `${rel} must keep the 24px rhythm`).toContain('backgroundSize: "24px 24px"');
      expect(src, `${rel} must not hardcode a dot color`).not.toMatch(/radial-gradient\(circle,\s*#/);
    }
  });

  it("the board's React Flow background matches (radius = size/2 → size 1.5 = 0.75px, gap 24, same token)", () => {
    const src = read("client/src/features/boards/BoardCanvas.tsx");
    const bg = src.match(/<Background[\s\S]*?\/>/)?.[0] ?? "";
    expect(bg).toContain("gap={24}");
    expect(bg).toContain("size={1.5}");
    expect(bg).toContain('color="var(--color-canvas-field-dot)"');
  });

  it("the token pair is defined once, in canvas-tokens.css", () => {
    const tokens = read("client/src/styles/canvas-tokens.css");
    expect(tokens).toMatch(/--color-canvas-field:\s*#/);
    expect(tokens).toMatch(/--color-canvas-field-dot:\s*#/);
  });
});

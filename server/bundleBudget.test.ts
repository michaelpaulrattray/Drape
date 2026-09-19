/**
 * THE BUNDLE BUDGET'S OWN CONTROLS (#1035).
 *
 * The gate's `bundle-budget` job refuses when the JS a customer downloads
 * before first paint exceeds `FIRST_PAINT_JS_BUDGET_BYTES`. A refusal that has
 * never been seen to fire is a decoration (working law 2), so the arms here are
 * the negative and positive controls on each pure half:
 *
 *  - the HTML reader finds what the browser fetches before paint and REFUSES a
 *    page that loads nothing (a 0 kB pass is the one reading it must never give);
 *  - the judge is OVER past the line, OK at it, and REFUSES a file the build
 *    did not emit (two builds blended into one number);
 *  - the budget is one declared number above the reading it was set against,
 *    with headroom that is small enough to catch a staff page coming back
 *    eager — the measured sabotage on the day the budget was set.
 *
 * The real build is driven by `scripts/bundle-budget.mts` itself (in the gate
 * and in preflight); a `vite build` inside a unit suite would put ten seconds
 * on every `pnpm test` for a reading the gate takes anyway.
 */
import { describe, expect, it } from "vitest";

import type { EmittedAsset } from "../scripts/lib/bundleFold.mts";
import {
  FIRST_PAINT_JS_BUDGET_BYTES,
  FIRST_PAINT_JS_MEASURED_BYTES,
  firstPaintAssetsFromHtml,
  judgeFirstPaint,
  renderVerdict,
} from "../scripts/lib/bundleBudget.mts";

/** The shape Vite actually writes for this app (read from dist/public/index.html, 19 Sep 2026). */
const REAL_SHAPE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
    <script type="module" crossorigin src="/assets/index-OtJK0qhJ.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-ujdIhnuA.css">
  </head>
  <body><div id="root"></div></body>
</html>`;

const asset = (file: string, gzipBytes: number, kind: "js" | "css" = "js"): EmittedAsset => ({
  file,
  kind,
  rawBytes: gzipBytes * 3,
  gzipBytes,
});

describe("firstPaintAssetsFromHtml — what the browser fetches before it can paint", () => {
  it("finds the module script and the stylesheet in the real output shape, and drops the font host", () => {
    expect(firstPaintAssetsFromHtml(REAL_SHAPE)).toEqual([
      "assets/index-OtJK0qhJ.js",
      "assets/index-ujdIhnuA.css",
    ]);
  });

  it("counts a modulepreload — a split entry's pieces are before-paint bytes too", () => {
    const html =
      `<script type="module" src="/assets/index-a.js"></script>` +
      `<link rel="modulepreload" href="/assets/vendor-b.js">` +
      `<link rel="modulepreload" href="/assets/index-a.js">`;
    expect(firstPaintAssetsFromHtml(html)).toEqual(["assets/index-a.js", "assets/vendor-b.js"]);
  });

  it("ignores a classic (non-module) script and a link that is neither preload nor stylesheet", () => {
    const html =
      `<script src="/assets/legacy.js"></script>` +
      `<link rel="icon" href="/assets/icon.svg">` +
      `<script type="module" src="/assets/index-a.js"></script>`;
    expect(firstPaintAssetsFromHtml(html)).toEqual(["assets/index-a.js"]);
  });

  it("⚠ REFUSES a page that loads nothing under /assets/ — never a 0 kB pass", () => {
    expect(() => firstPaintAssetsFromHtml("<html><body><div id=root></div></body></html>")).toThrow(
      /names no module script/,
    );
    expect(() =>
      firstPaintAssetsFromHtml(`<script type="module" src="https://cdn.example/app.js"></script>`),
    ).toThrow(/names no module script/);
  });
});

describe("judgeFirstPaint — the verdict", () => {
  it("is OK at exactly the budget and OVER one byte past it (the boundary, both sides)", () => {
    const at = judgeFirstPaint(["assets/index-a.js"], [asset("assets/index-a.js", 1000)], 1000);
    expect(at.ok).toBe(true);
    expect(at.headroomBytes).toBe(0);
    const over = judgeFirstPaint(["assets/index-a.js"], [asset("assets/index-a.js", 1001)], 1000);
    expect(over.ok).toBe(false);
    expect(over.headroomBytes).toBe(-1);
  });

  it("sums every before-paint JS file and reports CSS beside it without budgeting it", () => {
    const v = judgeFirstPaint(
      ["assets/index-a.js", "assets/vendor-b.js", "assets/index-a.css"],
      [asset("assets/index-a.js", 600), asset("assets/vendor-b.js", 300), asset("assets/index-a.css", 5000, "css")],
      1000,
    );
    expect(v.ok).toBe(true);
    expect(v.totalGzipBytes).toBe(900);
    expect(v.cssGzipBytes).toBe(5000);
    expect(v.files.map((f) => f.file)).toEqual(["assets/index-a.js", "assets/vendor-b.js"]);
  });

  it("a chunk NOT loaded before paint is not counted — the split #832 made is allowed to grow", () => {
    const v = judgeFirstPaint(
      ["assets/index-a.js"],
      [asset("assets/index-a.js", 900), asset("assets/AdminOverview-x.js", 500_000)],
      1000,
    );
    expect(v.ok).toBe(true);
    expect(v.totalGzipBytes).toBe(900);
  });

  it("⚠ REFUSES a file index.html names that the build did not emit — two builds are not one number", () => {
    expect(() => judgeFirstPaint(["assets/index-old.js"], [asset("assets/index-new.js", 10)], 1000)).toThrow(
      /emitted no such asset/,
    );
  });

  it("⚠ REFUSES when the before-paint list holds only CSS — there is nothing to judge", () => {
    expect(() =>
      judgeFirstPaint(["assets/index-a.css"], [asset("assets/index-a.css", 10, "css")], 1000),
    ).toThrow(/names no JS/);
  });
});

describe("the declared budget", () => {
  it("is 480 kB (1024-byte kB, the ledger's unit), above the reading it was set against", () => {
    expect(FIRST_PAINT_JS_BUDGET_BYTES).toBe(480 * 1024);
    expect(FIRST_PAINT_JS_MEASURED_BYTES).toBeLessThan(FIRST_PAINT_JS_BUDGET_BYTES);
  });

  it("its headroom is smaller than the sabotage it exists to catch (an eager AdminOverview: +103.5 kB, measured)", () => {
    const headroom = FIRST_PAINT_JS_BUDGET_BYTES - FIRST_PAINT_JS_MEASURED_BYTES;
    expect(headroom).toBeGreaterThan(0);
    expect(headroom).toBeLessThan(103.5 * 1024);
  });

  it("the sabotage reading is OVER and the control reading is OK, through the real judge", () => {
    // Both figures were read on 2026-09-19 by driving scripts/bundle-budget.mts:
    // the tree as it stands, then the same tree with `import "./pages/AdminOverview"`
    // appended to App.tsx, then restored. The sabotage byte count is 555.9 kB
    // back-converted (the script prints kB); the verdict turns on the line, not the digit.
    const control = judgeFirstPaint(["assets/index-OtJK0qhJ.js"], [asset("assets/index-OtJK0qhJ.js", 463_219)]);
    const sabotage = judgeFirstPaint(["assets/index-CGpfznEO.js"], [asset("assets/index-CGpfznEO.js", 569_242)]);
    expect(control.ok).toBe(true);
    expect(sabotage.ok).toBe(false);
    expect(renderVerdict(sabotage)[0]).toMatch(/OVER, over by/);
    expect(renderVerdict(control)[0]).toMatch(/OK, headroom/);
  });
});

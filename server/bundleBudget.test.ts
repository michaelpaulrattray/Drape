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

/*
  THE SABOTAGE, RE-DRIVEN AT THE TREE THESE ARMS READ — 2026-09-26, `0ba7f9e4`.

  ⚠ Every figure below is from ONE sitting on ONE tree, which is the whole
  repair #1265 made. The arms it replaces mixed a control read on 19 Sep with a
  budget that had been correct for that day and a subject that had halved since;
  a control and a sabotage from two trees cannot prove a line between them.

  Road, both readings: `npx tsx scripts/bundle-budget.mts` (a real `vite build`,
  level-9 gzip of what `dist/public/index.html` names), first on the tree as it
  stands, then with `import "./pages/AdminOverview";` appended to
  `client/src/App.tsx`, then restored and the restore proven at `git diff`.

    control    assets/index-BLBlsaN3.js   266,595 B  (260.3 kB)
    sabotage   assets/index-ByjWyy9A.js   385,370 B  (376.3 kB)   +118,775 B = +116.0 kB

  ⚠ **AND THE SABOTAGE PASSED THE GUARD AS IT STOOD**: at the old 480 kB line
  the verdict on 376.3 kB was `OK, headroom 103.7 kB`. That is the finding
  #1265 is, stated as a reading rather than as arithmetic — the eager staff page
  this module was built to refuse was being waved through.
*/
const MEASURED_2026_09_26 = { controlBytes: 266_595, sabotageBytes: 385_370 } as const;
/** What the eager staff page cost on that tree, derived from the pair above. */
const EAGER_STAFF_PAGE_BYTES = MEASURED_2026_09_26.sabotageBytes - MEASURED_2026_09_26.controlBytes;

describe("the declared budget", () => {
  it("is 290 kB (1024-byte kB, the ledger's unit), above the reading it was set against", () => {
    expect(FIRST_PAINT_JS_BUDGET_BYTES).toBe(290 * 1024);
    expect(FIRST_PAINT_JS_MEASURED_BYTES).toBeLessThan(FIRST_PAINT_JS_BUDGET_BYTES);
  });

  /*
    ⚠ THE READING AND THE BUDGET ARE PINNED TO EACH OTHER, which is the arm the
    old suite did not have and the reason #1265 was possible. The pair went
    stale together on 2026-09-19: the measurement stopped describing the tree
    and nothing here noticed, because no arm compared the declared reading to
    anything a build had said. Now the declared reading IS the driven control
    byte count, so a split that halves the entry leaves this red until somebody
    re-reads both — a re-read is a two-line edit, and the alternative was a
    week of a blind gate.
  */
  it("the declared reading is the driven control, not a remembered number", () => {
    expect(FIRST_PAINT_JS_MEASURED_BYTES).toBe(MEASURED_2026_09_26.controlBytes);
  });

  it("its headroom is smaller than the sabotage it exists to catch (an eager AdminOverview: +116.0 kB, driven the same day)", () => {
    const headroom = FIRST_PAINT_JS_BUDGET_BYTES - FIRST_PAINT_JS_MEASURED_BYTES;
    expect(headroom).toBeGreaterThan(0);
    expect(headroom).toBeLessThan(EAGER_STAFF_PAGE_BYTES);
    /* And the cheapest instance of the class this guard names, not just today's:
       103.5 kB was the 19 Sep reading of the same sabotage. Whichever of the two
       is smaller is the line headroom must stay under. */
    expect(headroom).toBeLessThan(103.5 * 1024);
  });

  it("the sabotage reading is OVER and the control reading is OK, through the real judge", () => {
    const control = judgeFirstPaint(
      ["assets/index-BLBlsaN3.js"],
      [asset("assets/index-BLBlsaN3.js", MEASURED_2026_09_26.controlBytes)],
    );
    const sabotage = judgeFirstPaint(
      ["assets/index-ByjWyy9A.js"],
      [asset("assets/index-ByjWyy9A.js", MEASURED_2026_09_26.sabotageBytes)],
    );
    expect(control.ok).toBe(true);
    expect(sabotage.ok).toBe(false);
    expect(renderVerdict(sabotage)[0]).toMatch(/OVER, over by/);
    expect(renderVerdict(control)[0]).toMatch(/OK, headroom/);
  });

  /*
    THE NEGATIVE CONTROL ON THE MOVE ITSELF — the one arm that would have gone
    red on 2026-09-19 and the one this card exists because nobody had.

    It asks the question the old budget could not answer: judged at the LINE AS
    IT STOOD, was the sabotage caught? At 480 kB it was not — `ok: true`, and
    the verdict line reads `OK, headroom`. Kept as a standing arm rather than a
    note, because a budget's real failure mode is passing something it should
    refuse, and that is invisible to every arm that only judges at the current
    line.
  */
  it("⚠ the OLD 480 kB line would have passed today's sabotage — the blindness, driven", () => {
    const atTheOldLine = judgeFirstPaint(
      ["assets/index-ByjWyy9A.js"],
      [asset("assets/index-ByjWyy9A.js", MEASURED_2026_09_26.sabotageBytes)],
      480 * 1024,
    );
    expect(atTheOldLine.ok).toBe(true);
    expect(renderVerdict(atTheOldLine)[0]).toContain("OK, headroom 103.7 kB");
  });
});

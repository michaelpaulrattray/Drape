/**
 * THE BUNDLE BUDGET — the one number the gate refuses past (#1035).
 *
 * `pnpm machinist:bundle` reads what the client ships, and the ledger records
 * it once a week: 636.9 kB (10 Sep, one chunk) → 451.8 kB (#832, 12 Sep) →
 * 452.4 kB (19 Sep) → **260.3 kB (26 Sep)**. **Nothing reddened if it grew
 * back.** A single eager import of a staff page from a customer surface puts
 * its charts on every visitor's first download (an eager `AdminOverview` added
 * 103.5 kB when this was driven, 19 Sep 2026; **116.0 kB when it was driven
 * again on 26 Sep**), and the only reader was a command a Machinist runs by
 * hand on its clock. This module is the line the gate holds.
 *
 * ⚠ **AND THE LINE WENT BLIND FOR A WEEK, WHICH IS WHY THE RE-READ IS ITS OWN
 * PARAGRAPH (#1265).** The budget was set at 480 kB on 452.4 kB the SAME DAY
 * `b2be5a95` (#1036) split the board page out of the entry and halved it —
 * that commit's own subject line says `entry chunk 450 → 246 kB gzip (−45%)`.
 * Neither PR was careless; the budget simply had no reason to re-read itself.
 * The cost was not arithmetic: **driven on 2026-09-26 at `0ba7f9e4`, the exact
 * sabotage this guard exists to catch — `import "./pages/AdminOverview"`
 * appended to `App.tsx` — read 376.3 kB and the verdict said `OK, headroom
 * 103.7 kB`.** The guard passed its own positive control. At 290 kB the same
 * build is `OVER`. A budget whose subject has moved is not a conservative
 * budget; it is an absent one.
 *
 * The runner builds with no `.env`, so the `VITE_*` literals a local build
 * inlines are absent there: measured 452.3 kB on the runner-shaped build
 * against 452.4 kB locally, same tree. A tenth of a kilobyte, stated so the
 * two readings are not taken for a regression.
 *
 * # What is budgeted, and what is deliberately not
 *
 * **Only what a customer downloads before the first paint.** That is read out
 * of the built `index.html` — every `<script type="module" src>` and every
 * `<link rel="modulepreload" href>` it names — because the HTML is the
 * artifact the browser reads (working law 1), not a file-name convention.
 * Today that is exactly one file, `assets/index-<hash>.js`; if Vite ever
 * splits the entry and preloads the pieces, the pieces are in the sum without
 * anyone editing this file.
 *
 * NOT budgeted: the total across all chunks (651.6 kB over 21 chunks on the
 * day this was written; 674.3 kB over 31 on 26 Sep — total JS rose 22.7 kB
 * while the first download fell 192 kB, which is the navigation trade #1036
 * was asked to measure, landing the right way round). That number is ALLOWED
 * to grow — a staff page gaining
 * a chart adds to it and costs a customer nothing — and a budget over it would
 * redden the gate for exactly the split #832 made. CSS is reported beside the
 * verdict and not budgeted either: the card's number is JS, and adding CSS to
 * it would make the reading incomparable with every ledger row before it.
 *
 * # The reader is `bundleFold.mts`'s, never a second gzip
 *
 * The size is `readEmittedAssets`'s **level-9 gzip** of the emitted file —
 * the same reader the ledger quotes, stated on the verdict line. Vite's own
 * build report gzips at its default level and says 464.3 kB for the file this
 * reader calls 452.4 kB; two readers of one file would make the budget mean
 * two things, and the card names which one.
 *
 * # The budget, declared ONCE, here
 *
 * 290 kB, on 260.3 kB measured — 29.7 kB of room, ~11% headroom. The rule it
 * is set by is the one the first budget was set by and it has not changed:
 * **enough for ordinary feature work on a customer surface, and less than the
 * cheapest thing this guard exists to catch.** Both halves are readings, not
 * preferences — 29.7 kB of room against a staff page that costs 116.0 kB
 * driven on the same tree. The share is larger than the first budget's ~6%
 * only because the entry is now half the size, so the same absolute room is a
 * bigger fraction of it; the absolute room is what the sabotage is compared
 * against, and it is what `server/bundleBudget.test.ts` holds.
 *
 * Moving it — up OR down — is an edit to `FIRST_PAINT_JS_BUDGET_BYTES` with
 * the new reading beside it in `FIRST_PAINT_JS_MEASURED_BYTES`, never a change
 * to the reader. ⚠ **Lowering it is the same act as raising it and is the one
 * #1265 had to make**: the pair is stale the moment a split moves the subject,
 * and only a re-read notices.
 *
 * `scripts/bundle-budget.mts` is the runner (the gate's `bundle-budget` job and
 * `pnpm preflight` both call it); `server/bundleBudget.test.ts` drives the
 * pure halves below, including the arm that proves a verdict can be RED.
 */
import type { EmittedAsset } from "./bundleFold.mts";

/** kB in this module means 1024 bytes, as `bundleFold.kb` prints it. */
const KB = 1024;

/**
 * The line. Measured 260.3 kB (266,595 B) on 2026-09-26 at `0ba7f9e4`,
 * `npx tsx scripts/bundle-budget.mts`, level-9 gzip of `assets/index-*.js`.
 *
 * Was 480 kB on 452.4 kB (463,219 B, 2026-09-19 at `d9e04659`) until #1265 —
 * see the header for why that pair went stale on the day it was written.
 */
export const FIRST_PAINT_JS_BUDGET_BYTES = 290 * KB;

/**
 * The reading the budget was set against, kept beside it so the headroom is a
 * fact on the verdict line rather than arithmetic someone does later.
 */
export const FIRST_PAINT_JS_MEASURED_BYTES = 266_595;

/**
 * Every asset the built `index.html` makes the browser fetch before it can
 * paint: module scripts, modulepreloads and stylesheets. Paths are returned as
 * the reader keys them — `assets/<file>` — with the leading `/` of the HTML's
 * absolute URL removed. Anything not under `/assets/` (the favicon, Google
 * Fonts) is not ours to weigh and is dropped.
 *
 * ⚠ REFUSES an HTML with no module script. A page that loads nothing is not a
 * small bundle; it is the wrong file, an unfinished build, or a Vite output
 * shape this reader has not met — and every one of those must be a red, not a
 * pass at 0 kB.
 */
export function firstPaintAssetsFromHtml(html: string): string[] {
  const found: string[] = [];
  const tagRe = /<(script|link)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    if (tag === "script") {
      if (!/\btype\s*=\s*["']module["']/i.test(attrs)) continue;
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (src) found.push(src[1]);
      continue;
    }
    // A stylesheet is fetched before paint too; it lands in the verdict's CSS
    // line (reported, never budgeted — see the header).
    if (!/\brel\s*=\s*["'](modulepreload|stylesheet)["']/i.test(attrs)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (href) found.push(href[1]);
  }
  const assets = found
    .filter((url) => url.startsWith("/assets/") || url.startsWith("assets/"))
    .map((url) => url.replace(/^\//, ""));
  if (assets.length === 0) {
    throw new Error(
      "bundle-budget: the built index.html names no module script under /assets/ — " +
        "this is not a small bundle, it is an unfinished build or an output shape this reader does not know",
    );
  }
  return [...new Set(assets)];
}

export type BudgetVerdict = {
  readonly ok: boolean;
  /** the JS files the browser fetches before first paint, each with its gzip size */
  readonly files: ReadonlyArray<{ readonly file: string; readonly gzipBytes: number }>;
  readonly totalGzipBytes: number;
  readonly budgetBytes: number;
  /** positive under budget, negative over it */
  readonly headroomBytes: number;
  /** CSS the page loads before paint — reported, never budgeted */
  readonly cssGzipBytes: number;
};

/**
 * Join the HTML's list with the reader's sizes and judge it.
 *
 * ⚠ REFUSES a first-paint file the reader did not emit. `index.html` and the
 * assets come from one build; a script the HTML names that is not on disk
 * means the two are from different builds, and a sum over the files that
 * happen to exist would be a clean-looking lie (the `bundleFold` staleness
 * guard, pointed the other way).
 */
export function judgeFirstPaint(
  firstPaintFiles: readonly string[],
  assets: readonly EmittedAsset[],
  budgetBytes: number = FIRST_PAINT_JS_BUDGET_BYTES,
): BudgetVerdict {
  const byFile = new Map(assets.map((a) => [a.file, a]));
  const js: Array<{ file: string; gzipBytes: number }> = [];
  let cssGzipBytes = 0;
  for (const file of firstPaintFiles) {
    const asset = byFile.get(file);
    if (!asset) {
      throw new Error(
        `bundle-budget: index.html loads "${file}" but the build emitted no such asset — ` +
          "the HTML and the assets are from different builds; rebuild rather than reading this",
      );
    }
    if (asset.kind === "css") {
      cssGzipBytes += asset.gzipBytes;
      continue;
    }
    js.push({ file, gzipBytes: asset.gzipBytes });
  }
  if (js.length === 0) {
    throw new Error("bundle-budget: index.html names no JS before first paint — refusing to judge nothing");
  }
  const totalGzipBytes = js.reduce((n, f) => n + f.gzipBytes, 0);
  return {
    ok: totalGzipBytes <= budgetBytes,
    files: js,
    totalGzipBytes,
    budgetBytes,
    headroomBytes: budgetBytes - totalGzipBytes,
    cssGzipBytes,
  };
}

function kb(bytes: number): string {
  return `${(bytes / KB).toFixed(1)} kB`;
}

/** The lines a shift reads on the gate and in preflight. */
export function renderVerdict(v: BudgetVerdict): string[] {
  const lines: string[] = [];
  lines.push(
    `bundle-budget: first-paint JS ${kb(v.totalGzipBytes)} gzip (level 9) against a budget of ${kb(v.budgetBytes)}` +
      ` — ${v.ok ? "OK" : "OVER"}, ${v.ok ? "headroom" : "over by"} ${kb(Math.abs(v.headroomBytes))}`,
  );
  for (const f of v.files) lines.push(`  ${f.file}  ${kb(f.gzipBytes)}`);
  lines.push(`  (CSS before paint: ${kb(v.cssGzipBytes)} — reported, not budgeted)`);
  if (!v.ok) {
    lines.push(
      "  Something a customer does not need on first paint is in the entry chunk — most often a staff page " +
        "imported eagerly (an eager AdminOverview added 116.0 kB when this was driven, 26 Sep 2026). `pnpm machinist:bundle` names the owners; " +
        "`client/src/staffPagesLazy.test.ts` is the guard for the staff routes. Move the budget only with " +
        "a new reading beside it in scripts/lib/bundleBudget.mts.",
    );
  }
  return lines;
}

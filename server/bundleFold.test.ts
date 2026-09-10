import { gzipSync } from "node:zlib";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildBundleSummary,
  foldAttribution,
  ownerOfModule,
  readEmittedAssets,
  renderLedgerRows,
  type RawVisualizerData,
} from "../scripts/lib/bundleFold.mts";

/**
 * THE BUNDLE READER IS AN INSTRUMENT, so it gets what every instrument here
 * gets before its verdicts count for anything (working law 2): a positive
 * control and a negative one on each reading.
 *
 * The arm that matters most is §3's. The reader's whole reason to exist is
 * that `rollup-plugin-visualizer`'s per-module byte counts sum to **2.27×**
 * the bundle actually emitted — measured on this repo, recorded in
 * `scripts/lib/bundleFold.mts`'s header. A reader that quietly used those sums
 * as "the bundle size" would put a number in the Machinist ledger that is
 * wrong by more than double and looks entirely reasonable. So there is an arm
 * whose fixture makes the two sources DISAGREE on purpose, and it fails if the
 * headline ever comes from anywhere but the bytes on disk.
 */

/* ────────────────────────────────────────────────────────────────────────────
   Fixtures — small, and deliberately not self-consistent
   ──────────────────────────────────────────────────────────────────────── */

const CHUNK = "assets/index-abc123.js";

function rawData(
  modules: readonly { id: string; bytes: number }[],
  chunkName = CHUNK,
): RawVisualizerData {
  const nodeParts: Record<string, { renderedLength: number; metaUid: string }> = {};
  const nodeMetas: Record<string, { id: string }> = {};
  const children = modules.map((m, i) => {
    const uid = `u-${i}`;
    const metaUid = `m-${i}`;
    nodeParts[uid] = { renderedLength: m.bytes, metaUid };
    nodeMetas[metaUid] = { id: m.id };
    return { name: m.id, uid };
  });
  return { tree: { name: "root", children: [{ name: chunkName, children }] }, nodeParts, nodeMetas };
}

/** A real directory with real bytes — `readEmittedAssets` gzips what it finds. */
function emittedDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "drape-bundle-"));
  const assets = path.join(dir, "assets");
  mkdirSync(assets);
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(assets, name), body, "utf8");
  }
  return assets;
}

/* ────────────────────────────────────────────────────────────────────────────
   1. ownerOfModule — the naming, including the shapes that produce phantoms
   ──────────────────────────────────────────────────────────────────────── */

describe("ownerOfModule", () => {
  it("names a plain dependency by its package", () => {
    expect(ownerOfModule("/repo/node_modules/recharts/es6/chart/LineChart.js")).toBe("recharts");
  });

  it("keeps the scope on a scoped dependency", () => {
    expect(ownerOfModule("/repo/node_modules/@xyflow/react/dist/index.js")).toBe("@xyflow/react");
  });

  it("takes the LAST node_modules, so a nested dependency is named as itself", () => {
    expect(ownerOfModule("/repo/node_modules/recharts/node_modules/d3-shape/src/arc.js")).toBe(
      "d3-shape",
    );
  });

  it("groups our own source by feature area", () => {
    expect(ownerOfModule("/repo/client/src/features/casting/hooks/useRoll.ts")).toBe(
      "app: features/casting",
    );
    expect(ownerOfModule("/repo/client/src/foundation/Rail.tsx")).toBe("app: foundation");
  });

  it("does not turn a bare file under client/src into an area", () => {
    // `client/src/main.tsx` would otherwise be reported as an area called
    // `app: main.tsx`, which reads like a feature and is not one.
    expect(ownerOfModule("/repo/client/src/main.tsx")).toBe("app: other");
  });

  it("normalises Windows separators — the ids arrive with backslashes here", () => {
    expect(ownerOfModule(String.raw`C:\repo\node_modules\lodash\merge.js`)).toBe("lodash");
  });

  it("strips rollup's virtual-module NUL rather than naming it", () => {
    expect(ownerOfModule("\u0000vite/modulepreload-polyfill.js")).toBe("vite (runtime)");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2. foldAttribution — the shares, and the four ways it must refuse
   ──────────────────────────────────────────────────────────────────────── */

describe("foldAttribution", () => {
  it("sums per owner and sorts heaviest first", () => {
    const owners = foldAttribution(
      rawData([
        { id: "/repo/node_modules/recharts/a.js", bytes: 300 },
        { id: "/repo/node_modules/recharts/b.js", bytes: 300 },
        { id: "/repo/client/src/features/casting/x.ts", bytes: 400 },
      ]),
    );
    expect(owners.map((o) => o.owner)).toEqual(["recharts", "app: features/casting"]);
    expect(owners[0]).toMatchObject({ attributionBytes: 600, share: 0.6, moduleCount: 2 });
    expect(owners[1]).toMatchObject({ attributionBytes: 400, share: 0.4, moduleCount: 1 });
  });

  it("shares sum to 1 — a fold that drops a module would not", () => {
    const owners = foldAttribution(
      rawData([
        { id: "/repo/node_modules/a/i.js", bytes: 7 },
        { id: "/repo/node_modules/b/i.js", bytes: 11 },
        { id: "/repo/client/src/pages/Home.tsx", bytes: 13 },
      ]),
    );
    expect(owners.reduce((n, o) => n + o.share, 0)).toBeCloseTo(1, 10);
  });

  /* The refusals. Each of these is a shape that would otherwise return a
     clean, small, entirely wrong answer — invariant 7's sibling: an
     instrument that cannot come up empty must not be able to report empty. */

  it("REFUSES a tree with no chunks rather than reporting no owners", () => {
    expect(() => foldAttribution({ tree: { name: "root", children: [] }, nodeParts: {}, nodeMetas: {} })).toThrow(
      /no chunks/,
    );
  });

  it("REFUSES when the plugin recorded no module parts", () => {
    expect(() =>
      foldAttribution({
        tree: { name: "root", children: [{ name: CHUNK, children: [] }] },
        nodeParts: {},
        nodeMetas: {},
      }),
    ).toThrow(/no module parts/);
  });

  it("REFUSES when every module measured zero — a hollow reading, not a small one", () => {
    expect(() => foldAttribution(rawData([{ id: "/repo/node_modules/a/i.js", bytes: 0 }]))).toThrow(
      /hollow/,
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3. THE ARM THIS FILE EXISTS FOR — the headline never comes from the plugin
   ──────────────────────────────────────────────────────────────────────── */

describe("buildBundleSummary — bytes shipped come from disk, never from the fold", () => {
  it("reports the emitted file's size even when the fold claims far more", () => {
    const body = "console.log('drape');".repeat(200);
    const dir = emittedDir({ "index-abc123.js": body });
    const onDisk = Buffer.byteLength(body, "utf8");

    // The fixture disagrees with disk by ~10×, which is the real defect's
    // direction and four times its real size.
    const data = rawData([{ id: "/repo/node_modules/recharts/a.js", bytes: onDisk * 10 }]);
    const summary = buildBundleSummary({ assets: readEmittedAssets(dir), data, takenAt: "T" });

    expect(summary.totals.jsRawBytes).toBe(onDisk);
    expect(summary.totals.jsGzipBytes).toBe(gzipSync(Buffer.from(body), { level: 9 }).length);
    // …and the discrepancy is RECORDED rather than hidden.
    expect(summary.attributionInflation).toBeCloseTo(10, 5);
  });

  it("prints the inflation figure beside the shares, so nobody quotes them as sizes", () => {
    const dir = emittedDir({ "index-abc123.js": "x".repeat(1000) });
    const data = rawData([{ id: "/repo/node_modules/recharts/a.js", bytes: 2000 }]);
    const rows = renderLedgerRows(
      buildBundleSummary({ assets: readEmittedAssets(dir), data, takenAt: "T" }),
    ).join("\n");
    expect(rows).toMatch(/SHARE of pre-minification rendered bytes, not bytes shipped/);
    expect(rows).toMatch(/2\.00×/);
  });

  it("separates css from js — one number for both would hide either", () => {
    const dir = emittedDir({ "index-a.js": "j".repeat(500), "index-a.css": "c".repeat(300) });
    const summary = buildBundleSummary({
      assets: readEmittedAssets(dir),
      data: rawData([{ id: "/repo/node_modules/a/i.js", bytes: 500 }], "assets/index-a.js"),
      takenAt: "T",
    });
    expect(summary.totals.jsRawBytes).toBe(500);
    expect(summary.totals.cssRawBytes).toBe(300);
    expect(summary.totals.chunkCount).toBe(1);
  });

  /* ⚠ THE STALENESS ARM. `--reuse` reads a report written by an earlier build
     against assets read now. If the two are from different builds every number
     is a blend, and nothing about the output would look wrong. */
  it("REFUSES a report naming a chunk that is not on disk", () => {
    const dir = emittedDir({ "index-NEW.js": "x".repeat(100) });
    const stale = rawData([{ id: "/repo/node_modules/a/i.js", bytes: 100 }], "assets/index-OLD.js");
    expect(() => buildBundleSummary({ assets: readEmittedAssets(dir), data: stale, takenAt: "T" })).toThrow(
      /is not on disk/,
    );
  });

  it("accepts a chunk name written without the assets/ prefix", () => {
    const dir = emittedDir({ "index-abc123.js": "x".repeat(100) });
    const data = rawData([{ id: "/repo/node_modules/a/i.js", bytes: 100 }], "index-abc123.js");
    expect(() =>
      buildBundleSummary({ assets: readEmittedAssets(dir), data, takenAt: "T" }),
    ).not.toThrow();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   4. readEmittedAssets — it refuses an empty build
   ──────────────────────────────────────────────────────────────────────── */

describe("readEmittedAssets", () => {
  it("REFUSES a directory that does not exist", () => {
    expect(() => readEmittedAssets(path.join(tmpdir(), "drape-no-such-dir-4f2a"))).toThrow(
      /no emitted assets/,
    );
  });

  it("REFUSES a directory holding no js or css — a zero would read as a tiny bundle", () => {
    expect(() => readEmittedAssets(emittedDir({ "logo.svg": "<svg/>" }))).toThrow(/nothing was emitted/);
  });

  it("ignores fonts and images, which are not what a JS budget is about", () => {
    const assets = readEmittedAssets(
      emittedDir({ "index-a.js": "j", "font.woff2": "f", "pic.png": "p" }),
    );
    expect(assets.map((a) => a.file)).toEqual(["assets/index-a.js"]);
  });
});

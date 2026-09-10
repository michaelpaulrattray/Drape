/**
 * THE BUNDLE FOLD — what the client actually ships, and who is responsible
 * for it (#35, the toolbelt remainder; founder-ordered, *"do it"*).
 *
 * `docs/MACHINIST_LEDGER.md` states its own blind spot in as many words:
 * *"**anything about the client** — page load, interaction latency, the
 * canvas … No instrument records the client today. Until one does, that half
 * of the charter is UNREAD, not fine."* This is the first reader that answers
 * any part of it.
 *
 * # ⚠ THE ONE THING THIS FILE EXISTS TO GET RIGHT
 *
 * `rollup-plugin-visualizer` gives a per-module `renderedLength` and a
 * per-module `gzipLength`. **Neither one sums to the size of the bundle**, and
 * the gap is not a rounding error. Measured on this repo the day the reader
 * was written (`vite build`, 2026-09-10):
 *
 * | reading | value |
 * |---|---|
 * | sum of every module's `renderedLength` | **5,081,213 B** |
 * | the emitted `index-*.js` on disk | **2,242,619 B** |
 * | sum of every module's `gzipLength` | **1,404,364 B** |
 * | that same file, actually gzipped | **652,314 B** |
 *
 * The sums are **2.27×** and **2.15×** the truth. `renderedLength` is measured
 * before the chunk is minified as a whole, and a per-module `gzipLength`
 * compresses each module against nothing but itself, so every byte of
 * cross-module redundancy — which is most of what gzip finds — is counted
 * again for each module. A reader that added those up and called the answer
 * "the bundle" would put a number in the ledger that is wrong by more than
 * double, and it would look completely plausible.
 *
 * **So the two questions are answered by two different sources, on purpose:**
 *
 *  - **HOW BIG IS IT** is read from the emitted files themselves and gzipped
 *    here (working law 1 — the artifact, not the report). Those are the only
 *    numbers this module will call bytes-shipped.
 *  - **WHO IS IT** is read from the plugin's per-module data, and is only ever
 *    reported as a **share**. `attributionBytes` carries the word attribution
 *    in its name for the same reason.
 *
 * # It refuses rather than returning a small truth
 *
 * Every way this reading can be hollow throws: no emitted assets, an empty
 * tree, no module parts, and — the one that actually bites — a `raw-data.json`
 * describing a chunk that is not on disk, which is what a stale report from a
 * previous build looks like. `server/bundleFold.test.ts` drives all of them.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/* ────────────────────────────────────────────────────────────────────────────
   1. WHAT IS ON DISK — the only source of a bytes-shipped number
   ──────────────────────────────────────────────────────────────────────── */

export type EmittedAsset = {
  /** file name as vite emitted it, e.g. `assets/index-D3HvEZZl.js` */
  readonly file: string;
  readonly kind: "js" | "css";
  readonly rawBytes: number;
  readonly gzipBytes: number;
};

/**
 * Read every emitted js/css asset and gzip it for real.
 *
 * Level 9 is deliberate and is stated wherever the number is: a CDN's default
 * is usually 6, so this is a FLOOR on what a visitor downloads rather than a
 * promise about it. What matters for a ledger is that the same level is used
 * every run, so two readings can be compared.
 */
export function readEmittedAssets(assetsDir: string): EmittedAsset[] {
  let entries: string[];
  try {
    entries = readdirSync(assetsDir);
  } catch {
    throw new Error(
      `bundle-fold: no emitted assets at ${assetsDir} — run the build before reading it`,
    );
  }

  const assets: EmittedAsset[] = [];
  for (const entry of entries.sort()) {
    const kind = entry.endsWith(".js")
      ? ("js" as const)
      : entry.endsWith(".css")
        ? ("css" as const)
        : null;
    if (!kind) continue;
    const full = path.join(assetsDir, entry);
    if (!statSync(full).isFile()) continue;
    const bytes = readFileSync(full);
    assets.push({
      file: `assets/${entry}`,
      kind,
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 9 }).length,
    });
  }

  if (assets.length === 0) {
    throw new Error(
      `bundle-fold: ${assetsDir} holds no .js or .css — nothing was emitted, and a zero here would read as a small bundle`,
    );
  }
  return assets;
}

/* ────────────────────────────────────────────────────────────────────────────
   2. WHO IS IN IT — attribution only, never bytes-shipped
   ──────────────────────────────────────────────────────────────────────── */

/** The subset of `rollup-plugin-visualizer`'s `raw-data` output we read. */
export type RawVisualizerData = {
  readonly tree: RawTreeNode;
  readonly nodeParts: Record<string, { readonly renderedLength: number; readonly metaUid: string }>;
  readonly nodeMetas: Record<string, { readonly id: string }>;
};

type RawTreeNode = {
  readonly name: string;
  readonly uid?: string;
  readonly children?: readonly RawTreeNode[];
};

export type OwnerShare = {
  /** an npm package name, or `app: <area>` for our own source */
  readonly owner: string;
  /**
   * Pre-minification rendered bytes attributed to this owner. ⚠ NOT bytes
   * shipped — see this file's header. Use `share` to talk about size.
   */
  readonly attributionBytes: number;
  /** fraction of all attributed bytes, 0–1 */
  readonly share: number;
  readonly moduleCount: number;
};

const NODE_MODULES = "node_modules/";

/**
 * Name the owner of a module id.
 *
 * A dependency is named by its package (scope included). Our own source is
 * named by its top area — `app: features/casting`, `app: foundation` — because
 * "which part of the product is heavy" is the question a Machinist brief would
 * actually be cut from, and a per-file list is 1,400 rows nobody reads.
 */
export function ownerOfModule(rawId: string): string {
  // Windows ids arrive with backslashes, and rollup's virtual modules carry a
  // leading NUL. Both would otherwise produce their own phantom "owners".
  const id = rawId.replace(/\\/g, "/").replace(/\0/g, "");

  const nm = id.lastIndexOf(NODE_MODULES);
  if (nm !== -1) {
    const after = id.slice(nm + NODE_MODULES.length);
    const parts = after.split("/");
    const pkg = parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1] ?? ""}` : (parts[0] ?? "");
    return pkg === "" ? "unattributed" : pkg;
  }

  if (id.startsWith("vite/") || id.includes("/vite/")) return "vite (runtime)";

  const src = id.indexOf("client/src/");
  if (src !== -1) {
    const after = id.slice(src + "client/src/".length);
    const parts = after.split("/");
    // features/<domain> is two segments deep and is the useful grouping;
    // everything else is named by its first segment.
    const area =
      parts[0] === "features" && parts[1] ? `features/${parts[1]}` : (parts[0] ?? "other");
    // A bare file directly under client/src (e.g. `main.tsx`) is not an area.
    return area.includes(".") ? "app: other" : `app: ${area}`;
  }

  if (id.includes("shared/")) return "app: shared";
  return "unattributed";
}

/**
 * Fold the plugin's per-module data into per-owner shares.
 *
 * Throws when there is nothing to fold — an empty tree and an empty
 * `nodeParts` are both the shape of a report that ran against nothing, and
 * returning `[]` from either would be a clean-looking lie.
 */
export function foldAttribution(data: RawVisualizerData): OwnerShare[] {
  const chunkNodes = data.tree.children ?? [];
  if (chunkNodes.length === 0) {
    throw new Error("bundle-fold: the visualizer tree has no chunks — nothing was measured");
  }
  if (Object.keys(data.nodeParts).length === 0) {
    throw new Error("bundle-fold: the visualizer recorded no module parts — nothing was measured");
  }

  const byOwner = new Map<string, { bytes: number; modules: number }>();
  let total = 0;

  const walk = (node: RawTreeNode): void => {
    if (node.children) {
      for (const child of node.children) walk(child);
      return;
    }
    if (!node.uid) return;
    const part = data.nodeParts[node.uid];
    if (!part) return;
    const meta = data.nodeMetas[part.metaUid];
    const owner = ownerOfModule(meta?.id ?? node.name);
    const seen = byOwner.get(owner) ?? { bytes: 0, modules: 0 };
    seen.bytes += part.renderedLength;
    seen.modules += 1;
    byOwner.set(owner, seen);
    total += part.renderedLength;
  };
  for (const chunk of chunkNodes) walk(chunk);

  if (total === 0) {
    throw new Error("bundle-fold: every module measured zero bytes — the reading is hollow");
  }

  return [...byOwner.entries()]
    .map(([owner, v]) => ({
      owner,
      attributionBytes: v.bytes,
      share: v.bytes / total,
      moduleCount: v.modules,
    }))
    .sort((a, b) => b.attributionBytes - a.attributionBytes);
}

/* ────────────────────────────────────────────────────────────────────────────
   3. THE SUMMARY — the two sources joined, and cross-checked
   ──────────────────────────────────────────────────────────────────────── */

export type BundleSummary = {
  readonly takenAt: string;
  readonly assets: readonly EmittedAsset[];
  readonly totals: {
    readonly jsRawBytes: number;
    readonly jsGzipBytes: number;
    readonly cssRawBytes: number;
    readonly cssGzipBytes: number;
    readonly chunkCount: number;
    /** the biggest single js chunk, gzipped — the number that governs first paint */
    readonly largestJsGzipBytes: number;
  };
  readonly owners: readonly OwnerShare[];
  /**
   * How far the plugin's per-module sum sits from the bytes actually emitted.
   * Recorded rather than hidden, because a reader who ever quotes the
   * attribution numbers as sizes should meet this figure first.
   */
  readonly attributionInflation: number;
};

export function buildBundleSummary(input: {
  assets: readonly EmittedAsset[];
  data: RawVisualizerData;
  takenAt: string;
}): BundleSummary {
  const { assets, data, takenAt } = input;
  if (assets.length === 0) {
    throw new Error("bundle-fold: no emitted assets — refusing to summarise nothing");
  }

  // ⚠ THE STALENESS GUARD. `raw-data.json` is written by a build; the assets
  // are read from disk. If the report names a chunk that is not there, the two
  // came from different builds and every number below would be a blend of two
  // trees. This is the failure a `--reuse` run makes easy, so it is checked
  // rather than trusted.
  const emitted = new Set(assets.map((a) => a.file));
  for (const chunk of data.tree.children ?? []) {
    const name = chunk.name.startsWith("assets/") ? chunk.name : `assets/${chunk.name}`;
    if (!emitted.has(name)) {
      throw new Error(
        `bundle-fold: the report names chunk "${chunk.name}" but it is not on disk — ` +
          `the report is from an earlier build. Re-run the build rather than reading this.`,
      );
    }
  }

  const owners = foldAttribution(data);
  const js = assets.filter((a) => a.kind === "js");
  const css = assets.filter((a) => a.kind === "css");
  const sum = (xs: readonly EmittedAsset[], k: "rawBytes" | "gzipBytes") =>
    xs.reduce((n, a) => n + a[k], 0);

  const jsRawBytes = sum(js, "rawBytes");
  const attributed = owners.reduce((n, o) => n + o.attributionBytes, 0);

  return {
    takenAt,
    assets,
    totals: {
      jsRawBytes,
      jsGzipBytes: sum(js, "gzipBytes"),
      cssRawBytes: sum(css, "rawBytes"),
      cssGzipBytes: sum(css, "gzipBytes"),
      chunkCount: js.length,
      largestJsGzipBytes: js.reduce((n, a) => Math.max(n, a.gzipBytes), 0),
    },
    owners,
    attributionInflation: jsRawBytes === 0 ? 0 : attributed / jsRawBytes,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   4. THE PRINT — what a shift pastes into the ledger
   ──────────────────────────────────────────────────────────────────────── */

export function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

export function renderLedgerRows(summary: BundleSummary, topOwners = 12): string[] {
  const t = summary.totals;
  const lines: string[] = [];
  lines.push(`### Client bundle — read at ${summary.takenAt}`);
  lines.push("");
  lines.push("| reading | value |");
  lines.push("|---|---|");
  lines.push(`| JS shipped (gzip, level 9) | **${kb(t.jsGzipBytes)}** |`);
  lines.push(`| JS shipped (raw) | ${kb(t.jsRawBytes)} |`);
  lines.push(`| CSS shipped (gzip, level 9) | ${kb(t.cssGzipBytes)} |`);
  lines.push(`| CSS shipped (raw) | ${kb(t.cssRawBytes)} |`);
  lines.push(`| JS chunks | ${t.chunkCount} |`);
  lines.push(`| largest single JS chunk (gzip) | ${kb(t.largestJsGzipBytes)} |`);
  lines.push("");
  lines.push(
    `Attribution below is a SHARE of pre-minification rendered bytes, not bytes shipped ` +
      `(those sum to ${summary.attributionInflation.toFixed(2)}× the emitted JS — see ` +
      `\`scripts/lib/bundleFold.mts\`).`,
  );
  lines.push("");
  lines.push("| owner | share | modules |");
  lines.push("|---|---|---|");
  for (const o of summary.owners.slice(0, topOwners)) {
    lines.push(`| ${o.owner} | ${(o.share * 100).toFixed(1)}% | ${o.moduleCount} |`);
  }
  return lines;
}

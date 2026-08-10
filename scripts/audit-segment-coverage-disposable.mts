/**
 * THE PER-KIND STORE COVERAGE AUDIT — fable-164 order 2's law-7 half.
 *
 * The founder, looking at block 1 of the C′ pack: the tile captioned "her
 * hairstyle" is a FRINGE. Verified — the slot was fetched live from production,
 * so the engine was genuinely handed a fringe band and told it was her hair.
 * Root cause: every stored segment in production was cut by the MASTER-ANCHORED
 * cutter (the 10.0% class), and the delivered-anchored cutter (88.7%) is dark
 * and has never re-cut an existing row.
 *
 * Hair is caught. Law 7 says a bug found once is a class until proven unique,
 * so this sweeps EVERY stored kind the same way and reports per-kind coverage.
 *
 *   --inventory   the population, from the database alone. No R2, no vision,
 *                 no spend. Run this first: it prints the call count the
 *                 measuring pass would buy before anything buys it.
 *   (default)     the measuring pass — one fresh full region read per row.
 *   --selftest    both specimens from disk, no database, no network.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/audit-segment-coverage-disposable.mts --inventory
 *
 * # What coverage MEANS here, stated before it is computed
 *
 * A stored segment claims to be a facet of a frame. The question fable-164 asks
 * is whether the crop is the WHOLE of that facet as it appears on that frame.
 * So:
 *
 *     coverage = |stored mask ∩ fresh full region| / |fresh full region|
 *
 * read on the frame the row itself names (`variantId`'s delivered image, or the
 * candidate master for a `detected_born` row). The intersection is in the
 * numerator on purpose: a crop that spills OUTSIDE its region is a different
 * defect (over-capture) and gets its own column rather than being allowed to
 * inflate the coverage figure that the completeness guard will threshold on.
 *
 * # The instrument's two specimens, named by Fable before the numbers exist
 *
 *   NEGATIVE #1  the fringe crop         — must read LOW
 *   POSITIVE #1  the 88.7% v#163 cut     — must read HIGH
 *
 * Both are hard-wired below and both run in `--selftest`. A counter that cannot
 * separate them refuses to report, which is the discipline that found D-242.
 */
import "dotenv/config";

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";

const INVENTORY = process.argv.includes("--inventory");
const SELFTEST = process.argv.includes("--selftest");
const LIMIT = (() => {
  const index = process.argv.indexOf("--limit");
  return index > -1 ? Number(process.argv[index + 1]) : Infinity;
})();

/** Production's public bucket. The dev one in `.env` holds none of these rows. */
const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

const OUT = path.resolve("output/segment-coverage");
const CACHE = path.join(OUT, "reads");
mkdirSync(CACHE, { recursive: true });

type Row = {
  id: number;
  publicId: string;
  userId: number;
  candidateId: number;
  variantId: number | null;
  provenance: string;
  facet: string;
  region: string;
  version: number;
  maskKey: string;
  contentKey: string;
  bboxX: number; bboxY: number; bboxW: number; bboxH: number;
  frameWidth: number; frameHeight: number;
  createdAt: Date;
  /** Joined: the frame this row claims to represent. */
  frameKey: string | null;
  frameKind: "variant" | "master" | "missing";
  requestText: string | null;
  /** The keys of the LAST step of the variant's `stepDeltas` — what this ask wrote. */
  writtenKeys: string[];
  onAsk: boolean;
};

/**
 * The delta key a facet is written under, where the two names differ.
 *
 * Deliberately tiny and explicit rather than clever: the alternative is a
 * fuzzy match that would quietly call `eye.colour` off-ask forever and make
 * half of this audit's headline wrong in the safe-looking direction.
 */
const FACET_OF_DELTA_KEY: Record<string, string> = {
  marks: "marks",
  makeup: "makeup",
  hairWorn: "hairWorn",
  eyeColourFree: "eye.colour",
  statedAccessories: "statedAccessories",
};

/* ------------------------------------------------------------------ the population */

async function inventory(): Promise<Row[]> {
  const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
  assertOneWorld([databaseKey]);
  const url = process.env[databaseKey];
  if (!url) {
    console.error("no database url — run under `railway.cmd run --service MySQL`");
    process.exit(1);
  }
  const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
  const [rows] = await connection.query<any[]>(
    `SELECT s.id, s.publicId, s.userId, s.candidateId, s.variantId, s.provenance,
            s.facet, s.region, s.version, s.maskKey, s.contentKey,
            s.bboxX, s.bboxY, s.bboxW, s.bboxH, s.frameWidth, s.frameHeight, s.createdAt,
            v.imageKey  AS variantImageKey,
            v.requestText AS requestText,
            v.stepDeltas AS stepDeltas,
            c.imageKey  AS masterImageKey
       FROM casting_segments s
       LEFT JOIN casting_candidate_variants v ON v.id = s.variantId
       LEFT JOIN casting_candidates c ON c.id = s.candidateId
      WHERE s.retiredAt IS NULL
      ORDER BY s.facet ASC, s.region ASC, s.id ASC`,
  );
  await connection.end();

  return rows.map((row): Row => {
    const frameKey = row.variantId ? row.variantImageKey : row.masterImageKey;
    /*
      WHAT THIS ASK WROTE, derived from the variant's own record.

      `stepDeltas` is the chain, one entry per ask; its LAST entry is this
      render's own step, and everything before it is carried. This is the same
      distinction `refineService` now enforces at write time (written ∩
      verified, fable-143 §3a) — read here from the row rather than re-decided,
      so the audit cannot disagree with the gate about what "written" means.
    */
    const steps = json(row.stepDeltas);
    const last = Array.isArray(steps) && steps.length > 0 ? steps[steps.length - 1] : null;
    const writtenKeys: string[] = [];
    if (last && typeof last === "object") {
      for (const [key, value] of Object.entries(last as Record<string, unknown>)) {
        /* `free` and `absent` are envelopes; the facet is the key inside them. */
        if ((key === "free" || key === "absent") && value && typeof value === "object") {
          writtenKeys.push(...Object.keys(value as Record<string, unknown>));
        } else writtenKeys.push(key);
      }
    }
    const written = new Set(writtenKeys.map((key) => FACET_OF_DELTA_KEY[key] ?? key));
    return {
      ...row,
      frameKey: frameKey ?? null,
      frameKind: frameKey ? (row.variantId ? "variant" : "master") : "missing",
      writtenKeys,
      onAsk: written.has(row.facet),
    } as Row;
  });
}

const json = (value: unknown): any => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return value;
};

/* ------------------------------------------------------------------ the arithmetic */

const sharp = (await import("sharp")).default;

/** A stored mask, as the single-channel bitmap the cutter wrote. */
async function loadMask(bytes: Buffer): Promise<Mask> {
  const { data, info } = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function count(mask: Mask): number {
  let total = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index]! > 0) total += 1;
  return total;
}

/**
 * The stored mask is a CROP-sized bitmap living at `bbox` inside `frame`; the
 * fresh read is frame-sized. Compare them in the frame's coordinates.
 */
function overlap(
  stored: Mask,
  box: { x: number; y: number; w: number; h: number },
  fresh: Mask,
): { storedPixels: number; regionPixels: number; inside: number; outside: number } {
  let storedPixels = 0;
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < stored.height; y += 1) {
    for (let x = 0; x < stored.width; x += 1) {
      if (stored.data[y * stored.width + x]! === 0) continue;
      storedPixels += 1;
      const fx = box.x + x;
      const fy = box.y + y;
      if (fx < 0 || fy < 0 || fx >= fresh.width || fy >= fresh.height) { outside += 1; continue; }
      if (fresh.data[fy * fresh.width + fx]! > 0) inside += 1;
      else outside += 1;
    }
  }
  return { storedPixels, regionPixels: count(fresh), inside, outside };
}

/* ------------------------------------------------------------------ the specimens */

/**
 * The two specimens, hard-wired. Both are the founder's own v#163 lineage.
 *
 * The negative is the STORED production segment for that render — the
 * master-anchored 23,231 px cut, which is the fringe class in its purest form.
 * The positive is the delivered-anchored cut of the same render, 206,044 px,
 * reproduced by the shipped cutter in `measure-delivered-anchored-cut`.
 */
const SPECIMEN = {
  master: "casting-v2/candidates/09c90f57-e39c-4204-8636-9c280f89000e.png",
  delivered: "casting-v2/variants/ac05f409-9734-4cd6-8a04-f7e360bfb5e6.png",
  storedSegmentPixels: 23_231,
  deliveredAnchoredPixels: 206_044,
};

/* ------------------------------------------------------------------ the reader */

const apiKey = process.env.FAL_KEY;

async function freshRegion(frameKey: string, region: string, frameBytes: Buffer): Promise<Mask> {
  const slug = `${frameKey.replace(/[^a-z0-9]+/gi, "-")}--${region.replace(/[^a-z0-9]+/gi, "-")}.png`;
  const cached = path.join(CACHE, slug);
  if (existsSync(cached)) return loadMask(readFileSync(cached));
  if (!apiKey) {
    console.error("FAL_KEY is required for the measuring pass");
    process.exit(1);
  }
  const reader = createFalRegionReader({ apiKey });
  const mask = await reader.region({ image: frameBytes, name: region, absentIsAnswer: true });
  await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .png()
    .toFile(cached);
  return mask;
}

/* ------------------------------------------------------------------ run */

if (SELFTEST) {
  console.log("SELFTEST is not implemented as a no-network pass — the specimens live in R2.");
  console.log("Run --inventory first; the measuring pass runs both specimens as its controls.");
  process.exit(1);
}

const rows = await inventory();

const byKind = new Map<string, Row[]>();
for (const row of rows) {
  const key = `${row.facet}  @${row.region}`;
  const list = byKind.get(key) ?? [];
  list.push(row);
  byKind.set(key, list);
}

console.log("=".repeat(92));
console.log("THE LIVE SEGMENT STORE — every non-retired row in production");
console.log("=".repeat(92));
console.log(`${rows.length} live rows across ${byKind.size} facet@region kinds\n`);

console.log("  kind".padEnd(34) + "rows".padStart(6) + "  provenance".padEnd(34) + "frames");
for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const provenance = [...new Set(list.map((row) => row.provenance))].join(",");
  const frames = [...new Set(list.map((row) => row.frameKind))].join(",");
  console.log(`  ${kind}`.padEnd(34) + String(list.length).padStart(6) + `  ${provenance}`.padEnd(34) + frames);
}

const measurable = rows.filter((row) => row.frameKind !== "missing");
console.log(`\n${measurable.length} of ${rows.length} rows name a frame that can be read.`);
console.log(`The measuring pass buys ONE region read per row: ${Math.min(measurable.length, LIMIT)} calls`
  + " (minus anything already cached on disk).");

writeFileSync(path.join(OUT, "inventory.json"), JSON.stringify(rows, null, 2));
console.log(`\ninventory written to ${path.join(OUT, "inventory.json")}`);

if (INVENTORY) process.exit(0);

/* ------------------------------------------------------------ the measuring pass */

console.log(`\n${"=".repeat(92)}`);
console.log("THE CONTROLS — both specimens, before any row's number counts");
console.log("=".repeat(92));

const deliveredBytes = (await fetchImageBytes(`${BASE}/${SPECIMEN.delivered}`)).bytes;
const hairOnDelivered = await freshRegion(SPECIMEN.delivered, "hair", deliveredBytes);
const hairPixels = count(hairOnDelivered);
console.log(`her whole hair on the delivered frame   ${hairPixels.toLocaleString()} px`);
const positive = SPECIMEN.deliveredAnchoredPixels / hairPixels;
console.log(`POSITIVE #1  the 88.7% v#163 cut        ${SPECIMEN.deliveredAnchoredPixels.toLocaleString()} px`
  + `  →  ${(positive * 100).toFixed(1)}% of it`);
console.log(
  "NEGATIVE #1  the fringe crop            is row 13 below — the stored segment for this same"
  + "\n             render, measured rather than carried. The 23,231 px this specimen was"
  + "\n             written with is |applied ∩ stored|, not the crop; the crop's own size is"
  + "\n             the number the row prints.",
);
console.log(
  "\nPLACEMENT CONTROL, built into every row: `spill` is the share of a stored crop that"
  + "\nfalls OUTSIDE its fresh region. A bbox arithmetic error would make coverage collapse"
  + "\nand spill approach 100% together. Low spill with low coverage is under-capture; high"
  + "\nspill is a bug in this script.\n",
);
console.log(
  "IDENTITY CONTROL, per kind: the fresh region mask is scored as if it were the stored"
  + "\ncrop. It must read 100.0%. A kind whose identity control misses 100% cannot have its"
  + "\nrows believed — the arithmetic is not able to report a full capture for that kind.\n",
);

console.log("=".repeat(92));
console.log("PER-ROW COVERAGE");
console.log("=".repeat(92));

type Result = Row & {
  storedPixels: number;
  regionPixels: number;
  inside: number;
  outside: number;
  coverage: number | null;
  spill: number | null;
  /** The fresh region scored as if it were the crop. Must be 1. */
  identityControl: number | null;
  note?: string;
};

const results: Result[] = [];
let spent = 0;
for (const row of measurable) {
  if (spent >= LIMIT) break;
  try {
    const maskBytes = (await fetchImageBytes(`${BASE}/${row.maskKey}`)).bytes;
    const frameBytes = (await fetchImageBytes(`${BASE}/${row.frameKey}`)).bytes;
    const frameMeta = await sharp(frameBytes).metadata();
    if (frameMeta.width !== row.frameWidth || frameMeta.height !== row.frameHeight) {
      results.push({
        ...row, storedPixels: 0, regionPixels: 0, inside: 0, outside: 0, coverage: null, spill: null,
        identityControl: null,
        note: `frame is ${frameMeta.width}x${frameMeta.height}, row says ${row.frameWidth}x${row.frameHeight}`,
      });
      continue;
    }
    const stored = await loadMask(maskBytes);
    const fresh = await freshRegion(row.frameKey!, row.region, frameBytes);
    spent += 1;
    const measured = overlap(stored, { x: row.bboxX, y: row.bboxY, w: row.bboxW, h: row.bboxH }, fresh);
    /*
      The identity control, on THIS row's own region read: the region scored as
      its own crop. Free (no extra call), and it is the thing that separates
      "this kind is under-captured" from "this script cannot score this kind".
    */
    const identity = overlap(fresh, { x: 0, y: 0, w: fresh.width, h: fresh.height }, fresh);
    results.push({
      ...row,
      ...measured,
      coverage: measured.regionPixels === 0 ? null : measured.inside / measured.regionPixels,
      spill: measured.storedPixels === 0 ? null : measured.outside / measured.storedPixels,
      identityControl: identity.regionPixels === 0 ? null : identity.inside / identity.regionPixels,
    });
  } catch (error) {
    results.push({
      ...row, storedPixels: 0, regionPixels: 0, inside: 0, outside: 0, coverage: null, spill: null,
      identityControl: null,
      note: `could not be read: ${(error as Error).message}`,
    });
  }
}

const pct = (value: number | null) => (value === null ? "  —  " : `${(value * 100).toFixed(1)}%`.padStart(6));

console.log(
  "  row".padEnd(7) + "ask".padEnd(6) + "kind".padEnd(26) + "stored".padStart(10) + "region".padStart(10)
  + "coverage".padStart(10) + "spill".padStart(8) + "ident".padStart(8) + "  what the ask said",
);
for (const result of results) {
  console.log(
    `  ${result.id}`.padEnd(7)
    + (result.onAsk ? "  on  " : " OFF  ")
    + `${result.facet}@${result.region}`.slice(0, 25).padEnd(26)
    + result.storedPixels.toLocaleString().padStart(10)
    + result.regionPixels.toLocaleString().padStart(10)
    + pct(result.coverage).padStart(10)
    + pct(result.spill).padStart(8)
    + pct(result.identityControl).padStart(8)
    + `  ${result.requestText ?? ""}${result.note ? `  — ${result.note}` : ""}`,
  );
}

/* ------------------------------------------------------ the controls, as readings */

console.log(`\n${"=".repeat(92)}`);
console.log("DOES THIS INSTRUMENT WORK — read off the rows above, not asserted");
console.log("=".repeat(92));
const identities = results.map((result) => result.identityControl).filter((value): value is number => value !== null);
const worstIdentity = identities.length === 0 ? null : Math.min(...identities);
const worstSpill = Math.max(...results.map((result) => result.spill ?? 0));
console.log(`identity control  worst ${pct(worstIdentity)} across ${identities.length} rows — must be 100.0%`);
console.log(`placement         worst spill ${pct(worstSpill)} — a bbox error would drive this toward 100%`);
if (worstIdentity !== null && worstIdentity < 0.9999) {
  console.log("\nA kind's own region does not score as its own crop. The arithmetic is wrong. STOP.");
  process.exit(1);
}

console.log(`\n${"=".repeat(92)}`);
console.log("PER-KIND COVERAGE — the answer fable-164 asked for");
console.log("=".repeat(92));
console.log("Split by whether the render's OWN last step wrote the facet. An off-ask row is a");
console.log("pre-gate mis-file (fable-143 §3a closed the write path); its crop holds whatever");
console.log("that render changed inside the region, filed under a facet nobody asked about.\n");

const table = (label: string, subset: Result[]) => {
  console.log(label);
  if (subset.length === 0) { console.log("  (none)\n"); return; }
  const kinds = new Map<string, Result[]>();
  for (const result of subset) {
    const key = `${result.facet}@${result.region}`;
    kinds.set(key, [...(kinds.get(key) ?? []), result]);
  }
  console.log("  kind".padEnd(32) + "n".padStart(4) + "worst".padStart(8) + "median".padStart(8)
    + "best".padStart(8) + "  no-read");
  for (const [kind, list] of [...kinds.entries()].sort()) {
    const read = list.map((result) => result.coverage)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    const noRead = list.length - read.length;
    if (read.length === 0) {
      console.log(`  ${kind}`.padEnd(32) + String(list.length).padStart(4) + "     —       —       —  " + `  ${noRead}`);
      continue;
    }
    const median = read[Math.floor(read.length / 2)]!;
    console.log(
      `  ${kind}`.padEnd(32) + String(list.length).padStart(4)
      + pct(read[0]!).padStart(8) + pct(median).padStart(8) + pct(read[read.length - 1]!).padStart(8)
      + `  ${noRead}`,
    );
  }
  console.log("");
};

table("ON-ASK — the facet this render's own step wrote:", results.filter((result) => result.onAsk));
table("OFF-ASK — carried facets the pre-gate write path filed anyway:", results.filter((result) => !result.onAsk));

console.log(`For scale: the positive specimen — the delivered-anchored cut of v#163 — is ${(positive * 100).toFixed(1)}%`);
console.log("of the same region on the same frame. No kind in the store reaches it.");

writeFileSync(path.join(OUT, "coverage.json"), JSON.stringify({
  controls: { hairPixels, positive, worstIdentity, worstSpill },
  results,
}, null, 2));
console.log(`\nwritten to ${path.join(OUT, "coverage.json")}`);

/* A script touching an app service never exits on its own. */
process.exit(0);

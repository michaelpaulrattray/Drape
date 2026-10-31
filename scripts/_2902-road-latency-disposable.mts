/**
 * THE READING ROAD AGAINST THE GRID ROAD — #2902's own required measurement.
 *
 * His card asks for it by name: *"The latency of the new road against tonight's
 * grid road. Reading plus boxing plus cuts must be stated with its price."*
 *
 * Both roads, back to back, on the same three real reference photographs the
 * #14 court used, at NATIVE size — which is what a customer attaches, and what
 * `_14-real-split-disposable.mts` measured the grid at.
 *
 * ⚠ **THE BOXER IS TURNED ON FOR THIS PROCESS**, because his account is inside
 * `CASTING_POINTER_ENGINE_SCOPE` and a reading taken on the fallback detector
 * would be a measurement of a road he is not on. It is set above the imports:
 * the flag is captured at import time, so setting it below would be too late.
 *
 * Spend: per fixture, the grid road buys one split + one detect; the reading
 * road buys one or two text calls, one gathered boxer request, up to twelve
 * `regionInBox` cuts, one detect and one more cut per detected face. House
 * money, well under the threshold, and a court besides — so it runs and
 * reports.
 *
 *   npx tsx scripts/_2902-road-latency-disposable.mts
 */

process.env.CASTING_POINTER_ENGINE_SCOPE = "all";

import "dotenv/config";
import { readFileSync } from "node:fs";
import sharp from "sharp";

import { splitAtPoints } from "../server/castingV2/falRegionReader";
import type { RegionReader } from "../server/castingV2/maskedRefine";
import { cutNameEngine, openSpotlight, spotlightRegionReader } from "../server/castingV2/referenceSpotlight";
import { encodeSpotlightMap, spotlightMapOf } from "../server/castingV2/referenceSpotlightMap";
import { cleanSplit } from "../server/castingV2/referenceSplitCleanup";
import { TAKE_FACE_NOUN } from "../server/castingV2/referenceTake";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";

const FIXTURES = [
  { id: "worn", path: `${DIR}/fixtures/ref-worn.jpg` },
  { id: "hanger", path: `${DIR}/fixtures/ref-hanger.png` },
  { id: "product", path: `${DIR}/fixtures/ref-product.png` },
];

/** Every fal and OpenRouter request this process makes, counted at the wire. */
let calls: { host: string; endpoint: string; ms: number }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  const at = Date.now();
  const answer = await realFetch(url, init);
  const text = String(url);
  const host = text.includes("fal.run") || text.includes("fal.ai") ? "fal" : "openrouter";
  calls.push({ host, endpoint: text.replace(/^https:\/\/[^/]+\//, ""), ms: Date.now() - at });
  return answer;
}) as typeof fetch;

/** The grid road exactly as `openSpotlight` ran it before this card. */
async function openTheGrid(input: { apiKey: string; frame: Buffer; reader: RegionReader }) {
  const started = Date.now();
  const pointer = input.reader.pointer;
  if (pointer === undefined) return { ok: false as const, why: "no-pointer" };
  const [pieces, faces] = await Promise.all([
    splitAtPoints({ apiKey: input.apiKey, image: input.frame }),
    pointer.call(input.reader, { image: input.frame, name: TAKE_FACE_NOUN }).catch(() => null),
  ]);
  if (faces === null) return { ok: false as const, why: "no-faces-read" };
  if (pieces.length === 0) return { ok: false as const, why: "empty-split" };
  const cleaned = cleanSplit(pieces, faces);
  if (cleaned.pieces.length === 0) return { ok: false as const, why: "nothing-left-to-light" };
  const map = await encodeSpotlightMap(spotlightMapOf(cleaned.pieces));
  return {
    ok: true as const,
    totalMs: Date.now() - started,
    raw: pieces.length,
    pieces: cleaned.pieces.length,
    faces: faces.length,
    mapKb: map.bytes.byteLength / 1024,
  };
}

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY — this measurement needs the real provider");
const reader = spotlightRegionReader();
if (reader === null) throw new Error("no region reader");
const engine = cutNameEngine();
if (engine === null) throw new Error("no text engine — this measurement needs OPENROUTER_API_KEY");

console.log("=== #2902 · THE READING ROAD AGAINST THE GRID, ON HIS THREE FIXTURES ===");
console.log("native size, the real providers, the boxer on (his account's road).\n");

for (const fixture of FIXTURES) {
  const frame = readFileSync(fixture.path);
  const meta = await sharp(frame).metadata();
  const size = { width: meta.width ?? 0, height: meta.height ?? 0 };
  console.log(`--- ${fixture.id} · ${size.width}x${size.height}`);

  calls = [];
  const grid = await openTheGrid({ apiKey, frame, reader });
  const gridCalls = calls.length;
  const gridFal = calls.filter((one) => one.host === "fal").length;
  if (!grid.ok) {
    console.log(`    GRID: did not light (${grid.why}) · ${gridCalls} calls\n`);
  } else {
    console.log(
      `    GRID   ${(grid.totalMs / 1000).toFixed(1)}s · raw ${grid.raw} -> ${grid.pieces} pieces · `
        + `faces ${grid.faces} · map ${grid.mapKb.toFixed(1)} KB · ${gridFal} fal calls`,
    );
  }

  calls = [];
  const reading = await openSpotlight({
    apiKey,
    frame,
    size,
    reader,
    engine,
    about: { userId: 1, attachmentPublicId: `m2902-${fixture.id}` },
  });
  const readFal = calls.filter((one) => one.host === "fal").length;
  const readText = calls.filter((one) => one.host === "openrouter").length;
  if (!reading.ok) {
    console.log(`    READING: did not light (${reading.why}) · ${readFal} fal + ${readText} text\n`);
    continue;
  }
  const { tally } = reading;
  console.log(
    `    READING ${(tally.totalMs / 1000).toFixed(1)}s · named ${tally.reading.named} -> marked `
      + `${tally.reading.marked} -> cut ${tally.reading.cutsAnswered} -> ${tally.pieces} pieces · `
      + `map ${(reading.map.bytes.byteLength / 1024).toFixed(1)} KB`,
  );
  console.log(
    `            stages: read ${(tally.reading.readMs / 1000).toFixed(1)}s · box `
      + `${(tally.reading.markMs / 1000).toFixed(1)}s · cuts ${(tally.reading.cutMs / 1000).toFixed(1)}s · `
      + `faces ${(tally.facesMs / 1000).toFixed(1)}s · face mask ${tally.faceMaskRead ? "read" : "NOT read"}`,
  );
  console.log(`            ${readFal} fal calls + ${readText} text calls`);
  console.log(`            names: ${reading.names.join(", ")}`);
  console.log(`            person ${tally.reading.personPresent} · crops ${tally.reading.crops.join("+")}`);
  if (tally.reading.unmarked.length > 0) {
    console.log(`            named but not marked: ${tally.reading.unmarked.join(", ")}`);
  }
  console.log(
    `            dropped by the clean-up: ${tally.dropped.length}`
      + (tally.dropped.length > 0 ? ` (${tally.dropped.map((one) => one.reason).join(", ")})` : ""),
  );
  console.log("");
}

console.log("Unit prices already measured in the tree, for the price line:");
console.log("  a SAM 3 unit (a split, a cut) = $0.005 — the provider's own price rows");
console.log("  the boxer = 0.51c a request against 0.16c for the fallback detector (#2863)");
console.log("The ACTUAL is read from the provider's books afterwards, never summed from here.");

process.exit(0);

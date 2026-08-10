/**
 * THE NUMBER THE NEW RULE KEYS ON, measured rather than inferred.
 *
 * `notScorableByArea` fires on `shellFraction(region) >= adjudicatedGapFor(kind)`,
 * and the region is the DENOMINATOR of coverage — so it is the region's shell,
 * not the crop's, that decides. Shift 31 measured the CROPS (66.7% / 67.5%) and
 * reasoned the regions would be similar. Reasoning is a claim; this is the fact.
 *
 * Four SAM3 reads on one stored dev frame. No credits, nothing written.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { adjudicatedGapFor, shellFraction } from "../server/castingV2/referenceCompleteness";

const uri = process.env.DATABASE_URL!;
if (new URL(uri).port !== "52008") throw new Error("not the dev database");
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
const apiKey = process.env.FAL_KEY!;
const c = await mysql.createConnection({ uri, timezone: "Z" });
const [rows] = await c.query<any[]>(
  "SELECT l.slot, l.refusedKind k, l.refusedCoverage cov, v.imageKey f FROM casting_reference_library l"
  + " LEFT JOIN casting_candidate_variants v ON v.id = l.variantId"
  + " WHERE l.refusedContentKey IS NOT NULL ORDER BY l.id");
await c.end();

const reader = createFalRegionReader({ apiKey });
for (const r of rows) {
  const [question, side] = r.slot.split("@");
  const image = (await fetchImageBytes(`${bucket}/${r.f}`)).bytes;
  const mask = side
    ? (await reader.regionSides?.({ image, name: question, absentIsAnswer: true }))?.[side as "left" | "right"] ?? null
    : await reader.region({ image, name: question, absentIsAnswer: true });
  if (!mask) { console.log(`${r.slot}: no read`); continue; }
  const resolution = shellFraction(mask);
  const coverage = r.cov / 10_000;
  const gap = adjudicatedGapFor(r.k, coverage);
  console.log(`${r.slot.padEnd(14)} kind ${String(r.k).padEnd(8)}`
    + ` coverage ${(coverage * 100).toFixed(1)}%   region resolution ${(resolution * 100).toFixed(1)}%`
    + `   gap a bar here must divide ${(gap * 100).toFixed(1)}%`
    + `   → ${coverage < 1 && resolution >= gap ? "notScorableByArea" : "scorable"}`);
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

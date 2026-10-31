/**
 * THE SAME REAL SPLIT, AT THE RESOLUTION THE COURT ACTUALLY MEASURED — #14
 * slice 3a-2's second reading.
 *
 * The first reading (`_14-real-split-disposable.mts`) sent the fixtures at
 * NATIVE size and came back 40–58 s a split with 26–29 pieces surviving. Both
 * numbers disagree with §8's table (4.3–6.6 s, and a hover set the design
 * reasoned about as 13 pieces), so before either is reported as a property of
 * the road, the one variable I changed by accident has to be put back.
 *
 * ⚠ **READ AT THE COURT'S OWN RESULT FILES: IT SPLIT AT ~1024 ON THE LONG
 * EDGE, NOT AT NATIVE.** `result-worn.json` records `W:768 H:1024` beside
 * `native:[900,1200]`; the hanger 683x1024 against native 1024x1536; the
 * product 1024x683 against 1536x1024. **`splitAtPoints` has no resize of its
 * own**, so the shipped road sends whatever the customer attached — and a
 * customer's photograph is routinely larger than the court's frames. So §8's
 * numbers do not describe the shipped road, and this reading says by how much.
 *
 * Two causes are being separated and they want different repairs:
 *   · if the LATENCY comes back to the court's band at 1024, the road owes a
 *     bound before the split and the court's numbers stand;
 *   · if the PIECE COUNT stays near 26, that is a property of a raw 32-point
 *     grid rather than of the resolution, and it is a surface problem for 3b
 *     rather than something a builder tunes away.
 *
 * Spend: one split + one detect per fixture, three fixtures, house money.
 *
 *   npx tsx scripts/_14-real-split-1024-disposable.mts
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import sharp from "sharp";

import { splitAtPoints } from "../server/castingV2/falRegionReader";
import type { RegionReader } from "../server/castingV2/maskedRefine";
import { spotlightRegionReader } from "../server/castingV2/referenceSpotlight";
import { encodeSpotlightMap, spotlightMapOf } from "../server/castingV2/referenceSpotlightMap";
import { cleanSplit } from "../server/castingV2/referenceSplitCleanup";
import { TAKE_FACE_NOUN } from "../server/castingV2/referenceTake";
/*
  ⚠ THIS CELL MEASURES THE GRID ROAD, AND THE PRODUCT NO LONGER TAKES IT —
  #2902, 2026-10-31.

  It used to reach the grid through `openSpotlight`, which now builds its pieces
  from the picture's own READING instead (`referenceSpotlightPieces.ts`, his eye
  on the live picker). **Its subject has not changed and must not**: every
  number this cell is cited for — §8's latency band, the 26–29 surviving pieces,
  `cleanSplit`'s own measured table — is a reading about a RAW 32-POINT GRID.
  So it is pointed at `splitAtPoints` directly rather than at the entrance,
  which keeps the instrument measuring the thing its own header describes.
  Repointing it at the entrance would have made a cited cell quietly report
  about a different road, which is the defect this note exists to prevent.
*/

/**
 * THE GRID ROAD AS `openSpotlight` RAN IT BEFORE #2902 — split, detect, clean.
 *
 * Byte for byte the old entrance's own ordering: the split and the face detect
 * in flight together, then the clean-up with the faces as a parameter. Nothing
 * here is new behaviour; it is the road this cell was always measuring, now
 * named explicitly because the entrance moved on.
 */
async function openTheGrid(input: { apiKey: string; frame: Buffer; reader: RegionReader }) {
  const started = Date.now();
  const pointer = input.reader.pointer;
  if (pointer === undefined) return { ok: false as const, why: "no-pointer" };
  let splitMs = 0;
  let facesMs = 0;
  const splitAt = Date.now();
  const facesAt = Date.now();
  const [pieces, faces] = await Promise.all([
    splitAtPoints({ apiKey: input.apiKey, image: input.frame }).then((answer) => {
      splitMs = Date.now() - splitAt;
      return answer;
    }),
    pointer
      .call(input.reader, { image: input.frame, name: TAKE_FACE_NOUN })
      .then((answer) => {
        facesMs = Date.now() - facesAt;
        return answer;
      })
      .catch(() => {
        facesMs = Date.now() - facesAt;
        return null;
      }),
  ]);
  if (faces === null) return { ok: false as const, why: "no-faces-read" };
  if (pieces.length === 0) return { ok: false as const, why: "empty-split" };
  const cleaned = cleanSplit(pieces, faces);
  if (cleaned.pieces.length === 0) return { ok: false as const, why: "nothing-left-to-light" };
  const map = await encodeSpotlightMap(spotlightMapOf(cleaned.pieces));
  const { pieces: survivors, ...rest } = cleaned;
  return {
    ok: true as const,
    map,
    tally: {
      ...rest,
      rawPieces: pieces.length,
      pieces: survivors.length,
      faces: faces.length,
      splitMs,
      facesMs,
      totalMs: Date.now() - started,
    },
  };
}


const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";
const COURT_LONG_EDGE = 1024;

const FIXTURES = [
  { id: "worn", path: `${DIR}/fixtures/ref-worn.jpg`, courtKept: 18 },
  { id: "hanger", path: `${DIR}/fixtures/ref-hanger.png`, courtKept: 8 },
  { id: "product", path: `${DIR}/fixtures/ref-product.png`, courtKept: 10 },
];

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY — this measurement needs the real provider");
const reader = spotlightRegionReader();
if (reader === null) throw new Error("no region reader");

console.log("=== THE SAME SPLIT AT THE COURT'S OWN RESOLUTION (long edge 1024) ===\n");

for (const fixture of FIXTURES) {
  const native = readFileSync(fixture.path);
  const meta = await sharp(native).metadata();
  const frame = await sharp(native)
    .resize({
      width: (meta.width ?? 0) >= (meta.height ?? 0) ? COURT_LONG_EDGE : undefined,
      height: (meta.height ?? 0) > (meta.width ?? 0) ? COURT_LONG_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const sized = await sharp(frame).metadata();

  const opened = await openTheGrid({ apiKey, frame, reader });

  if (!opened.ok) {
    console.log(`--- ${fixture.id}: DID NOT LIGHT (${opened.why})\n`);
    continue;
  }
  const { tally, map } = opened;
  console.log(`--- ${fixture.id} · ${meta.width}x${meta.height} native -> ${sized.width}x${sized.height} sent`);
  console.log(`    raw masks ${tally.rawPieces}  ->  survived ${tally.pieces}   (court's saved set ${fixture.courtKept})`);
  console.log(`    faces ${tally.faces} · person pieces dropped ${tally.personPiecesDropped} · fragments ${tally.fragmentsDropped}`);
  console.log(`    split ${tally.splitMs} ms · detect ${tally.facesMs} ms · total ${tally.totalMs} ms`);
  console.log(`    map ${(map.bytes.byteLength / 1024).toFixed(1)} KB naming ${map.pieces} pieces\n`);
}

process.exit(0);

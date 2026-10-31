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

import { openSpotlight, spotlightRegionReader } from "../server/castingV2/referenceSpotlight";

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

  const opened = await openSpotlight({
    apiKey,
    frame,
    reader,
    about: { userId: 1, attachmentPublicId: `measure1024-${fixture.id}` },
  });

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

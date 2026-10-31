/**
 * THE ONE REAL SPLIT — #14 slice 3a-2's first act, the design's own words.
 *
 * §9 declares exactly one thing unmeasured and hands it to this slice:
 *
 * > *"the clean-up was measured on the court's DEDUPLICATED pieces, because
 * > that is what the court saved. A live 32-point grid returns the same garment
 * > from many points, and the arbitration's tie rule collapses duplicates by
 * > itself (18 → 13, 8 → 5 measured) — but on a raw grid that is reasoning, not
 * > a reading. 3a-2's first act is one real split on his own account, and the
 * > figure to watch is the piece count."*
 *
 * ⚠ **READ AT THE COURT'S OWN RESULT FILE, THE GAP IS EXACTLY AS DECLARED:**
 * `sam3grid` recorded `raw 32 -> pieces 18` on the worn fixture, so the court's
 * saved `-B.bin` masks are POST-dedup and the raw 32 was never written to disk.
 * `splitAtPoints` as shipped does no dedup of its own — it returns every mask
 * the provider answers with — so **production hands `cleanSplit` the raw 32,
 * and the only measurement anybody has is on 18 pre-collapsed ones.** That is
 * the hole this buys.
 *
 * ## What this drives, and what it deliberately does not
 *
 * It drives the REAL `openSpotlight` with the REAL fal key: the real 32-point
 * split, the real face detect, the real `cleanSplit`, the real encoder. It does
 * NOT go through the tRPC procedure, and that is the right instrument rather
 * than a shortcut — the plumbing above the service (the flag chain, the
 * owner-scoped row, the digest refusal, both schemas, the projections) is
 * driven by 14 arms in `referenceSpotlightEntrance.test.ts`, and none of it can
 * change what the provider answers for 32 points. **The question here is a
 * provider question.**
 *
 * Spend: one split (≈0.5¢) + one detect (≈0.5¢) per fixture, three fixtures,
 * house money. Under the threshold and a court besides, so it runs and reports.
 *
 *   npx tsx scripts/_14-real-split-disposable.mts
 */

import "dotenv/config";
import { readFileSync } from "node:fs";

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

const FIXTURES = [
  { id: "worn", path: `${DIR}/fixtures/ref-worn.jpg`, courtRaw: 32, courtKept: 18 },
  { id: "hanger", path: `${DIR}/fixtures/ref-hanger.png`, courtRaw: 32, courtKept: 8 },
  { id: "product", path: `${DIR}/fixtures/ref-product.png`, courtRaw: 32, courtKept: 10 },
];

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY — this measurement needs the real provider");
const reader = spotlightRegionReader();
if (reader === null) throw new Error("no region reader");

console.log("=== ONE REAL SPLIT THROUGH THE REAL SERVICE — #14 slice 3a-2 ===");
console.log("the declared unknown: does cleanSplit collapse a RAW 32-point grid the way it");
console.log("collapsed the court's pre-deduplicated 18?\n");

for (const fixture of FIXTURES) {
  const frame = readFileSync(fixture.path);
  const started = Date.now();
  const opened = await openTheGrid({ apiKey, frame, reader });
  const wall = Date.now() - started;

  if (!opened.ok) {
    console.log(`--- ${fixture.id}: DID NOT LIGHT (${opened.why}) after ${wall} ms\n`);
    continue;
  }

  const { tally, map } = opened;
  console.log(`--- ${fixture.id}`);
  console.log(`    RAW masks the provider answered with : ${tally.rawPieces}   (court recorded raw ${fixture.courtRaw})`);
  console.log(`    pieces that survived the clean-up    : ${tally.pieces}   (court's saved set was ${fixture.courtKept} pre-collapsed)`);
  console.log(`    faces found: ${tally.faces}  ·  person pieces dropped: ${tally.personPiecesDropped}`);
  console.log(`    dropped: ${JSON.stringify(tally.dropped)}`);
  console.log(`    fragments ${tally.fragmentsDropped} (${tally.fragmentPixels} px) · holes ${tally.holesFilled} (${tally.holePixels} px)`);
  console.log(`    contested ${tally.contestedPixels} px · reassigned ${tally.reassignedPixels} px · face px removed ${tally.facePixelsRemoved}`);
  console.log(`    split ${tally.splitMs} ms · detect ${tally.facesMs} ms · total ${tally.totalMs} ms (concurrency saved ≈${Math.max(0, tally.splitMs + tally.facesMs - tally.totalMs)} ms)`);
  console.log(`    hit-test map: ${(map.bytes.byteLength / 1024).toFixed(1)} KB for ${map.width}x${map.height}, naming ${map.pieces} pieces\n`);
}

process.exit(0);

/**
 * DOES THE RULE HOLD AT THE SIZE PRODUCTION ACTUALLY SPLITS AT? — #2873's step 4.
 *
 * Everything else about this card is measured on the court's **1024-max** frames,
 * because that is where the court's true cuts live and scoring against them with
 * no resampling anywhere was worth more than scoring at native size. But
 * `referenceSpotlight.ts` hands `splitAtPoints` the customer's picture at its own
 * size — 900x1200, 1024x1536, 1536x1024 for these three — so **a threshold read
 * at one resolution and shipped at another is exactly the gap #2873 is about**,
 * one axis along. That is why this is bought rather than reasoned.
 *
 * It cannot score against the truth cuts (they are 1024-max, and resampling them
 * up would be measuring the resampler), so what it reads is the PIECE COUNT and
 * the duplicate count — which is the figure #2873 named as the one to watch.
 *
 * The face boxes are the cached 1024-max ones scaled, which is exact: the
 * detector answers in fractions of the frame and the cache was written from
 * those fractions.
 *
 * Three more `fal-ai/sam-3/image` calls, ~1.5¢ house money.
 *
 *     npx tsx scripts/_2873-native-size-disposable.mts
 */
import { readFileSync } from "node:fs";

import { splitAtPoints } from "../server/castingV2/falRegionReader";
import type { PointerBox } from "../server/castingV2/maskedRefine";
import { SPLIT_SAME_THING_IOU, cleanSplit } from "../server/castingV2/referenceSplitCleanup";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";

/** What the court-resolution run of the shipped road gave, for comparison. */
const AT_1024: Record<string, { pieces: number; duplicates: number }> = {
  worn: { pieces: 11, duplicates: 18 },
  hanger: { pieces: 6, duplicates: 22 },
  product: { pieces: 8, duplicates: 23 },
};

function envValue(name: string): string {
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue;
    const at = line.indexOf("=");
    if (line.slice(0, at) !== name) continue;
    return line.slice(at + 1).replace(/^["']|["']$/g, "");
  }
  throw new Error(`no ${name} in the tree's .env`);
}

const apiKey = envValue("FAL_KEY");

console.log(`the bar under test: SPLIT_SAME_THING_IOU = ${SPLIT_SAME_THING_IOU}\n`);

for (const id of ["worn", "hanger", "product"]) {
  const r = JSON.parse(readFileSync(`${DIR}/out/result-${id}.json`, "utf8")) as {
    W: number;
    H: number;
    native: [number, number];
  };
  const photo = id === "worn" ? `${DIR}/fixtures/ref-worn.jpg` : `${DIR}/fixtures/ref-${id}.png`;
  const sharp = (await import("sharp")).default;
  const image = await sharp(photo).png().toBuffer();
  const meta = await sharp(image).metadata();

  const scaleX = (meta.width ?? 0) / r.W;
  const scaleY = (meta.height ?? 0) / r.H;
  const faces = (JSON.parse(readFileSync(`${DIR}/out/${id}-faces.json`, "utf8")) as PointerBox[]).map((box) => ({
    x: Math.round(box.x * scaleX),
    y: Math.round(box.y * scaleY),
    width: Math.round(box.width * scaleX),
    height: Math.round(box.height * scaleY),
  }));

  const started = Date.now();
  const raw = await splitAtPoints({ apiKey, image });
  const split = Date.now() - started;
  if (raw.length === 0) throw new Error(`${id}: the split came back empty`);

  const cleanStarted = Date.now();
  const cleaned = cleanSplit(raw, faces);
  const clean = Date.now() - cleanStarted;

  const want = AT_1024[id]!;
  console.log(
    `${id} at ${meta.width}x${meta.height} (native; the court read it at ${r.W}x${r.H})\n` +
      `    ${raw.length} raw -> ${cleaned.pieces.length} pieces` +
      `   (at 1024-max the shipped road gave ${want.pieces})\n` +
      `    duplicates dropped ${cleaned.duplicatesDropped} (1024-max: ${want.duplicates}) · ` +
      `person ${cleaned.personPiecesDropped} · fragments ${cleaned.fragmentsDropped} · holes ${cleaned.holesFilled}\n` +
      `    split ${split} ms, clean-up ${clean} ms`,
  );
}

console.log("\nSpend: three fal-ai/sam-3/image calls, house money.");

process.exit(0);

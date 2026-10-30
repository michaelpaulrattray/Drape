/**
 * BUY THE RAW SPLIT ONCE AND PUT IT ON DISK — #2873, the near-duplicate sweep's
 * only provider cost.
 *
 * ⚠ **#2873's own body says the sweep "costs nothing at the provider because
 * the court's masks are on disk", AND THAT IS WRONG — read at the harness
 * rather than taken from the card.** `relay-14spot/court.mjs:67` is
 * `B = dedupe(ms)` and line 78 is `dump(fx.id, "B", B)`: the court saved the
 * set AFTER its own near-duplicate drop. So `worn-B.bin` holds 18 masks where
 * the provider returned 32 (confirmed at the bytes: 14,155,776 / 768·1024 = 18,
 * and `result-worn.json` records `raw: 32, pieces: 18`). **The raw grid was
 * never written to disk by anybody** — the court threw it away, and so did
 * slice 3a-2's live split, which bought it twice and printed counts.
 *
 * **Sweeping a threshold over an already-deduplicated set is the exact mistake
 * #2873 is about**, one layer along: it would report that every threshold in
 * the band leaves 18 pieces and that the rule does nothing.
 *
 * So this cell buys the raw grid ONE more time and SAVES it, which makes the
 * sweep free from here on and makes it re-runnable by anybody.
 *
 * # WHAT IT ASKS, AND WHY THROUGH THE PRODUCT'S OWN FUNCTION
 *
 * `splitAtPoints` itself (`server/castingV2/falRegionReader.ts`), never a copy
 * of its body — the grid shape, the empty prompt, `max_masks` and the
 * `object_id` scheme are the product's and a second copy of them here would be
 * a mirror that drifts (working law 4). What this cell chooses is only the
 * PICTURE it is asked of.
 *
 * ⚠ **The picture is the court's own `frames/<id>/photo.png`, which is the
 * fixture already resized to the court's W x H.** That is deliberate: the
 * court's truth cuts and poles are saved at W x H, so a split bought at that
 * size is directly comparable to them with no resampling anywhere in the
 * reading. Slice 3a-2 measured native size and court size separately and got
 * the same piece counts (26/27/28 either way), so resolution is already ruled
 * out as a cause and nothing is lost by pinning it here.
 *
 * # WHAT IT COSTS
 *
 * Three `fal-ai/sam-3/image` calls, ~0.5 cents each — about 1.5 cents of HOUSE
 * money, no customer credit, far under the $50 spend threshold. The actual is
 * reported on the card.
 *
 *     npx tsx scripts/_2873-raw-split-buy-disposable.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { splitAtPoints } from "../server/castingV2/falRegionReader";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";

/** The repo root's `.env`, which the worktree carries a copy of. */
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

for (const id of ["worn", "hanger", "product"]) {
  const result = JSON.parse(readFileSync(`${DIR}/out/result-${id}.json`, "utf8")) as { W: number; H: number };
  const photo = readFileSync(`${DIR}/frames/${id}/photo.png`);
  const started = Date.now();
  const pieces = await splitAtPoints({ apiKey, image: photo });
  const ms = Date.now() - started;

  if (pieces.length === 0) throw new Error(`${id}: the split came back empty — nothing to save`);
  for (const piece of pieces) {
    if (piece.width !== result.W || piece.height !== result.H) {
      throw new Error(
        `${id}: a piece is ${piece.width}x${piece.height} where the court's frame is ${result.W}x${result.H}` +
          ` — the truth cuts would not line up, so nothing is saved`,
      );
    }
  }

  /* THE COURT'S OWN ON-DISK FORMAT, one byte per pixel holding 0 or 1, so the
     sweep's loader is the one slice 3a already wrote and proved. The product
     thresholds at `> 127`; the conversion back is the loader's job and it
     asserts a non-empty result, which is what stops a silent all-zero read. */
  const size = result.W * result.H;
  const out = Buffer.alloc(size * pieces.length);
  let live = 0;
  pieces.forEach((piece, index) => {
    for (let at = 0; at < size; at += 1) {
      const on = piece.data[at]! > 127 ? 1 : 0;
      out[index * size + at] = on;
      live += on;
    }
  });
  if (live === 0) throw new Error(`${id}: every piece read as empty`);

  const path = `${DIR}/out/${id}-RAW.bin`;
  writeFileSync(path, out);
  const perPiece = pieces.map((piece) => {
    let n = 0;
    for (const byte of piece.data) if (byte > 127) n += 1;
    return n;
  });
  console.log(
    `${id} (${result.W}x${result.H}): ${pieces.length} raw masks in ${ms} ms -> ${path}` +
      `\n    pixels per piece: ${perPiece.join(", ")}`,
  );
}

console.log("\nSpend: three fal-ai/sam-3/image calls, house money. Read the actual off the provider's books.");

process.exit(0);

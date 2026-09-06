/**
 * DISPOSABLE — #535: compose the two strip pairs from HIS OWN court rolls
 * (the card's order: "the shift's design report starts from these four
 * sheets"). Downloads the first 4 delivered candidates of each roll from the
 * public R2 URLs and lays each pair as one labelled strip: pieces-kept arm on
 * top, qualities arm below. Free — reads public URLs, writes local PNGs.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/_535-strips-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";

const OUT = "output/535-frames";
mkdirSync(OUT, { recursive: true });

const db = await openDatabase(resolveDatabaseUrl());
const urlsFor = async (rollId: number): Promise<string[]> => {
  const [cands] = await db.query(
    `SELECT imageKey FROM casting_candidates WHERE rollId = ? AND imageKey IS NOT NULL ORDER BY position LIMIT 4`,
    [rollId],
  );
  /* Production's own public bucket, read from the service the rows belong to —
     the local .env's R2_PUBLIC_URL is the DEV bucket and 404s on these keys. */
  const publicBase = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
  return (cands as { imageKey: string }[]).map((c) => `${publicBase}/${c.imageKey}`);
};

const PAIRS: Array<{ name: string; top: { roll: number; label: string }; bottom: { roll: number; label: string } }> = [
  {
    name: "court1-worked-case",
    top: { roll: 244, label: "roll 244 — every piece kept, story added (the current author's road)" },
    bottom: { roll: 245, label: "roll 245 — who kept, pieces reinvented as qualities (his 10x verdict)" },
  },
  {
    name: "court2-sphinx",
    top: { roll: 243, label: "roll 243 — materials and colours kept as pieces" },
    bottom: { roll: 246, label: "roll 246 — colours and materials carried as register (his 'much better')" },
  },
];

const TILE_W = 340;
const LABEL_H = 34;
for (const pair of PAIRS) {
  const rows: Buffer[] = [];
  for (const arm of [pair.top, pair.bottom]) {
    const urls = await urlsFor(arm.roll);
    if (urls.length === 0) throw new Error(`roll ${arm.roll} has no delivered candidates`);
    const tiles: Buffer[] = [];
    for (const url of urls) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
      tiles.push(await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: TILE_W }).toBuffer());
    }
    const h = (await sharp(tiles[0]!).metadata()).height!;
    const row = await sharp({
      create: { width: TILE_W * tiles.length, height: h + LABEL_H, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .composite([
        ...tiles.map((t, i) => ({ input: t, left: i * TILE_W, top: LABEL_H })),
        {
          input: Buffer.from(
            `<svg width="${TILE_W * tiles.length}" height="${LABEL_H}"><text x="10" y="23" font-family="Arial" font-size="17" fill="#EBEBEB">${arm.label}</text></svg>`,
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    rows.push(row);
  }
  const heights = await Promise.all(rows.map(async (r) => (await sharp(r).metadata()).height!));
  const width = (await sharp(rows[0]!).metadata()).width!;
  const strip = await sharp({
    create: { width, height: heights[0]! + heights[1]!, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .composite([
      { input: rows[0]!, left: 0, top: 0 },
      { input: rows[1]!, left: 0, top: heights[0]! },
    ])
    .png()
    .toBuffer();
  writeFileSync(`${OUT}/${pair.name}.png`, strip);
  console.log(`wrote ${OUT}/${pair.name}.png`);
}
await db.end();
process.exit(0);

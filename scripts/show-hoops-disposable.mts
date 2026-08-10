/** The two hoops as they actually are — bright, magnified, no overlay.
 *  Free: two R2 reads and sharp. The adoption sitting has been looking at
 *  dimmed frames with masks painted on them, and a mask is not the metal. */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { fetchImageBytes } from "./lib/imageBytes.mts";

const OUT = path.resolve("output/earring-cut-diagnosis");
const uri = process.env.DATABASE_URL!;
if (new URL(uri).port !== "52008") throw new Error("not the dev database");
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
const c = await mysql.createConnection({ uri, timezone: "Z" });
const [rows] = await c.query<any[]>(`
  SELECT l.slot, l.refusedBboxX x, l.refusedBboxY y, l.refusedBboxW w, l.refusedBboxH h,
         v.imageKey AS variantKey, cd.imageKey AS masterKey
    FROM casting_reference_library l
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
    LEFT JOIN casting_candidates cd ON cd.id = l.candidateId
   WHERE l.refusedContentKey IS NOT NULL ORDER BY l.id`);
await c.end();
await mkdir(OUT, { recursive: true });
const PAD = 18, ZOOM = 16;
for (const r of rows) {
  for (const [what, key] of [["delivered", r.variantKey], ["master", r.masterKey]] as const) {
    const image = await fetchImageBytes(`${bucket}/${key}`);
    const meta = await sharp(image.bytes).metadata();
    const left = Math.max(0, r.x - PAD), top = Math.max(0, r.y - PAD);
    const width = Math.min(meta.width! - left, r.w + PAD * 2);
    const height = Math.min(meta.height! - top, r.h + PAD * 2);
    const out = await sharp(image.bytes)
      .extract({ left, top, width, height })
      /* Lifted, because the ear sits in shadow and a hoop nobody can see is a
         hoop nobody can judge. Stated so the brightening is not mistaken for
         the frame. */
      .modulate({ brightness: 2.2 })
      .resize({ width: width * ZOOM, height: height * ZOOM, kernel: "nearest" })
      .png().toBuffer();
    const name = `hoop-${r.slot.replace(/[^a-z0-9]+/gi, "-")}-${what}-x${ZOOM}.png`;
    await writeFile(path.join(OUT, name), out);
    console.log(name);
  }
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

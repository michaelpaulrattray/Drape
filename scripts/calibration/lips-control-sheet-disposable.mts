import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { loadMaskFile, boxOf } from "../lib/shapeOnFace.mts";

const rows: Buffer[] = [];
const specs = [
  { label: "master", frame: "output/edit-law/master.png", mask: "output/edit-law/reads/master--lips.png" },
  { label: "cell2g-1", frame: "output/cprime/cell2g-1.png", mask: "output/cprime/reads/cell2g-1--lips.png" },
  { label: "cell2g-2", frame: "output/cprime/cell2g-2.png", mask: "output/cprime/reads/cell2g-2--lips.png" },
  { label: "gpt2-crop-1", frame: "output/accessory-cell/gpt2-crop-1.png", mask: "output/accessory-cell/reads/gpt2-crop-1--lips.png" },
];
for (const spec of specs) {
  const mask = await loadMaskFile(spec.mask);
  if (!mask) { console.log(`${spec.label}: no mask`); continue; }
  const box = boxOf(mask, 60);
  const crop = await sharp(await readFile(spec.frame))
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .resize({ height: 220 }).png().toBuffer();
  rows.push(crop);
  console.log(`${spec.label}: box ${box.w}x${box.h}`);
}
const metas = await Promise.all(rows.map((r) => sharp(r).metadata()));
const totalW = metas.reduce((t, m) => t + m.width!, 0);
await writeFile("output/edit-law/SHEET-lips-control.png", await sharp({
  create: { width: totalW, height: 220, channels: 3, background: "#111" },
}).composite(rows.map((input, i) => ({ input, left: metas.slice(0, i).reduce((t, m) => t + m.width!, 0), top: 0 })))
  .png().toBuffer());
console.log("wrote output/edit-law/SHEET-lips-control.png");

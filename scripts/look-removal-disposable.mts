/** DISPOSABLE — the eye check: her frames' band, master vs the two composites. */
import sharp from "sharp";
import { readFileSync } from "node:fs";

const OUT = "output/masked/glasses-fixture";
const MASTER = "output/masked/specimens/fresh-02.png";
const meta = await sharp(readFileSync(MASTER)).metadata();
const window = { left: 240, top: 300, width: 540, height: 320 };

for (const [name, file] of [
  ["master", MASTER],
  ["nbp", `${OUT}/c-remove-glasses-nbp-harvested.png`],
  ["gpt2", `${OUT}/c-remove-glasses-gpt2-harvested.png`],
] as const) {
  const sized = await sharp(readFileSync(file))
    .resize(meta.width!, meta.height!, { fit: "fill" }).png().toBuffer();
  await sharp(sized).extract(window).png().toFile(`${OUT}/LOOK-${name}.png`);
  console.log(`written ${OUT}/LOOK-${name}.png`);
}

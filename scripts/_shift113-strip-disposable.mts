/**
 * DISPOSABLE — foreman-113, 2026-08-30. LOOK at the brow masks.
 *
 * Law 9: the reader's number is a pointer to look, never the finding. This
 * crops each WHERE overlay to the head band at native resolution and stacks
 * them with the arm's own verdict written beside it, so the disputed cells and
 * the positive controls are judged side by side by eye rather than by pixel
 * count. The captions carry the verdict the SCRIPT produced, not one typed
 * here, so a caption cannot drift from its arm.
 *
 *   npx tsx scripts/_shift113-strip-disposable.mts
 *
 * No network, no database, no money.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";

import sharp from "sharp";

const OUT = "output/_shift113";
mkdirSync(OUT, { recursive: true });

/* The verdicts are READ BACK out of the run's own report rather than retyped,
   so a caption that disagrees with the arm is impossible. */
const report = readFileSync(`${OUT}/report.md`, "utf8");
function verdictOf(id: string): string {
  const block = report.split(`## ${id} `)[1];
  if (block === undefined) throw new Error(`${id} is not in the report - the strip would caption an arm that never ran`);
  const line = block.split("\n").find((l) => l.includes("gate verdict:"));
  if (line === undefined) throw new Error(`${id} has no verdict line`);
  const px = block.split("\n").find((l) => l.trim().startsWith("mask:")) ?? "";
  /* The report's own arrow is `<--`, which is not SVG text; escaping rather
     than stripping keeps the caption the report's words. */
  return `${line.replace(/\s*gate verdict:\s*/, "").trim()}   |   ${px.trim()}`
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ARMS = [
  { id: "BR-ANG-C-0", eye: "MY EYE: no brow hair (ABSENT)" },
  { id: "BR-ANG-C-2", eye: "MY EYE: no brow hair (ABSENT)" },
  { id: "BR-LAM-K-2", eye: "MY EYE: dark brows (PRESENT - positive control)" },
  { id: "BR-53", eye: "MY EYE: blond brows (PRESENT - positive control)" },
];

const WIDE = 1000;
const CAPTION = 46;
const tiles: sharp.OverlayOptions[] = [];
let top = 0;
for (const arm of ARMS) {
  const file = `${OUT}/${arm.id}-WHERE.png`;
  if (!existsSync(file)) throw new Error(`${file} is missing - an arm that produced no overlay cannot be looked at`);
  const meta = await sharp(file).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1536;
  const crop = await sharp(file)
    .extract({ left: 0, top: Math.round(height * 0.10), width, height: Math.round(height * 0.26) })
    .resize({ width: WIDE })
    .png()
    .toBuffer();
  const cropMeta = await sharp(crop).metadata();
  tiles.push({ input: crop, left: 0, top });
  const caption = `${arm.id}  -  ${arm.eye}`;
  tiles.push({
    input: Buffer.from(
      `<svg width="${WIDE}" height="${CAPTION}"><rect width="${WIDE}" height="${CAPTION}" fill="#000"/>`
      + `<text x="6" y="18" font-family="monospace" font-size="15" fill="#fff">${caption}</text>`
      /* Grey, not the tint this line first carried: fable-230's monochrome
         ruling covers everything drawn onto an image, and the gate caught it. */
      + `<text x="6" y="38" font-family="monospace" font-size="14" fill="#bbbbbb">READER: ${verdictOf(arm.id)}</text></svg>`,
    ),
    left: 0,
    top: top + (cropMeta.height ?? 0),
  });
  top += (cropMeta.height ?? 0) + CAPTION;
}

await sharp({ create: { width: WIDE, height: top, channels: 3, background: "#111" } })
  .composite(tiles)
  .jpeg({ quality: 92 })
  .toFile(`${OUT}/STRIP-brows.jpg`);
console.log(`${ARMS.length} arms -> ${OUT}/STRIP-brows.jpg`);
process.exit(0);

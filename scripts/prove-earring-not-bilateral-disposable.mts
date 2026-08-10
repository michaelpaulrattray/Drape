/**
 * SHE IS WEARING TWO HOOPS AND THE PRODUCT READS ONE.
 *
 * The C′ pair cell's counter refused to run: on a GPT Image 2 frame where both
 * hoops are plainly visible, the reader returned ONE component. That is the
 * D-238 class again — a bilateral region answered as a single instance — and
 * D-238's own class sweep did not reach this sibling.
 *
 * The suspicion, before the evidence: `falRegionReader`'s `BILATERAL` set is a
 * HAND-AUTHORED list — `{ear, eyes, eyebrows}` — while `accessoryKinds`'s
 * table already records `pair: true` for the earring entry. Two lists, one
 * fact, and they have drifted (working law 4: derive, never mirror).
 *
 * This drives the PRODUCT'S OWN reader — not a reimplementation — and asks it
 * three questions about the same frame:
 *
 *   "earring"  the name the product actually sends for accessories
 *   "ear"      a name that IS in the bilateral set, as the positive control
 *              that the bilateral branch itself works on this face
 *
 * If "ear" comes back with two components and "earring" with one, the branch is
 * fine and the NAME LIST is the defect.
 *
 *   FAL_KEY=… npx tsx scripts/prove-earring-not-bilateral-disposable.mts
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { accessoryEntry, pairClauseFor } from "../server/castingV2/accessoryKinds";
import type { Mask } from "../server/castingV2/maskedComposite";

const FRAME = "output/cprime/cell2g-1.png";
const MIN_COMPONENT = 150;

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }
const reader = createFalRegionReader({ apiKey });

const bytes = await readFile(FRAME).catch(() => null);
if (!bytes) { console.error(`${FRAME} is not on disk — this proof needs the frame it was found on.`); process.exit(1); }

/** Components above the speck floor, largest first, with their centres. */
function components(mask: Mask): { size: number; cx: number }[] {
  const seen = new Uint8Array(mask.data.length);
  const found: { size: number; cx: number }[] = [];
  for (let start = 0; start < mask.data.length; start += 1) {
    if (mask.data[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    seen[start] = 1;
    let size = 0; let sumX = 0;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % mask.width;
      const y = Math.floor(at / mask.width);
      size += 1; sumX += x;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mask.width || ny >= mask.height) continue;
        const next = ny * mask.width + nx;
        if (mask.data[next] === 0 || seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (size >= MIN_COMPONENT) found.push({ size, cx: sumX / size });
  }
  return found.sort((a, b) => b.size - a.size);
}

console.log("WHAT THE TWO TABLES EACH BELIEVE ABOUT A HOOP");
console.log(`  accessoryKinds  entry   ${JSON.stringify(accessoryEntry("gold hoop earring"))}`);
console.log(`  accessoryKinds  clause  ${JSON.stringify(pairClauseFor("gold hoop earring"))}   ← it KNOWS this is a pair`);
console.log(`  falRegionReader BILATERAL contains "earring"?  ${/* read from the module's own behaviour below */ "answered by the wire, not by grep"}`);

console.log(`\nDRIVING THE PRODUCT'S OWN READER over ${FRAME}`);
console.log("  (both hoops are visible in this frame — established by cropping both ears and looking)\n");

for (const name of ["earring", "ear"]) {
  const mask = await reader.region({ image: bytes, name, absentIsAnswer: true }).catch(() => null);
  if (!mask) { console.log(`  ${name.padEnd(9)} NO-READ`); continue; }
  const found = components(mask);
  const sides = found.length >= 2 && Math.sign(found[0]!.cx - mask.width / 2) !== Math.sign(found[1]!.cx - mask.width / 2)
    ? "on BOTH sides of her"
    : "all on ONE side of her";
  console.log(
    `  ${name.padEnd(9)} ${found.length} component${found.length === 1 ? "" : "s"} above ${MIN_COMPONENT} px`
    + `   ${found.map((one) => `${one.size}px@x${Math.round(one.cx)}`).join("  ")}   ${found.length >= 2 ? sides : ""}`,
  );
  await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .png()
    .toFile(`output/cprime/PROOF-${name}.png`);
}

console.log("\nIf `ear` reads two and `earring` reads one, the bilateral BRANCH is sound");
console.log("and the hand-authored NAME LIST is the defect — which is working law 4's shape,");
console.log("a second list shadowing a table that already holds the fact.");

process.exit(0);

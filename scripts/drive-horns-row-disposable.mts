/**
 * THE HORNS ROW, DRIVEN ON THE PANEL PATH — both arms (fable-527 §3).
 *
 * The ruling: horns gets a DISPLAY row per the teeth precedent, armed by the
 * detection court's own readings, with the region as its own discriminator —
 * **a worn face shows the row with its box, a bare face shows nothing.** That
 * is a claim about the shipped panel, so it is driven through the shipped panel
 * service rather than argued from the catalogue.
 *
 * The two frames are the court's own artifacts: `words-2.png` (horns delivered,
 * judged by two readers) and `control-1.png` (the same face, an unrelated edit,
 * no horns). Nothing is re-rendered; only read.
 *
 * Cost: two real scans, about $0.15 of house money. No user credits, no rows
 * written anywhere — a scan writes nothing by construction.
 *
 *   npx tsx scripts/drive-horns-row-disposable.mts
 */
import "dotenv/config";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { scanFace } from "../server/castingV2/faceScan";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { catalogueSlots } from "../server/castingV2/referenceSlotCatalogue";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required");

const OUT = "output/horns-row";
mkdirSync(OUT, { recursive: true });

const HORNS_SLOT = catalogueSlots().find((slot) => slot.feature === "horns");
if (!HORNS_SLOT) throw new Error("the catalogue has no horns slot — nothing to drive");
console.log(`catalogue: horns · panel row "${HORNS_SLOT.panel.row}" · display "${HORNS_SLOT.display}" · question ${HORNS_SLOT.question}`);

const arms = [
  { name: "WORN", file: "output/horns-court/words-2.png", expectRow: true },
  { name: "BARE", file: "output/horns-court/control-1.png", expectRow: false },
];

const results: any[] = [];
for (const arm of arms) {
  const bytes = readFileSync(arm.file);
  const meta = await sharp(bytes).metadata();
  /* One reader per frame, exactly as the service builds it: the reader verifies
     the frame it is given once, and sharing one across frames would carry one
     frame's proof into another's calls. */
  const reader = createFalRegionReader({ apiKey });
  const scan = await scanFace({
    frame: { bytes, width: meta.width!, height: meta.height! },
    reader,
    /* No words reader: this is about the BOX, and a description call would buy
       a sentence nobody is asserting. */
    describe: null,
    contentType: "image/png",
  });

  const box = scan.boxes.get("horns" as never) ?? null;
  const ok = arm.expectRow === (box !== null);
  console.log(
    `${arm.name.padEnd(5)} ${ok ? "ok  " : "FAIL"} row ${box ? "SHOWN" : "absent"}`
    + (box ? ` · box ${box.width}×${box.height} at ${box.x},${box.y}` : "")
    + ` · asked ${scan.asked}, found ${scan.found}`,
  );
  results.push({ arm: arm.name, file: arm.file, expectRow: arm.expectRow, box, asked: scan.asked, found: scan.found });
}

const passed = results.every((row, at) => arms[at]!.expectRow === (row.box !== null));
writeFileSync(`${OUT}/readings.json`, `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(passed
  ? "\nBOTH ARMS HELD — the region is its own discriminator on the panel path."
  : "\nAN ARM FAILED — the row does not behave as the court measured.");
process.exit(passed ? 0 : 1);

/**
 * THE FLOOR'S SUBJECT — the surface cut the road WOULD make if the floor let it
 * (fable-1183 §3's frames, the realism pass's own input).
 *
 *   npx tsx scripts/court-region-floor-native-disposable.mts
 *
 * # Why this file exists at all, when a court for this road already does
 *
 * `court-region-crop-real-disposable.mts` drives the shipped `cutInkDesign` and
 * writes what it RETURNS. On S1's upper arm the road refuses `cutTooSmall` at
 * 183x353 against a floor of 256, so the shipped court writes nothing — and the
 * picture the realism pass has to put in front of eyes is precisely the one the
 * floor is refusing. **The subject of a trial cannot be withheld by the thing on
 * trial.**
 *
 * # ⚠ IT BYPASSES THE FLOOR, DELIBERATELY AND ONLY HERE
 *
 * This is the one legitimate reason to walk around a shipped guard: the guard's
 * own constant is the question. Nothing here can reach a customer — it writes
 * files into `output/` and touches no database, no storage and no flag. The
 * shipped path is untouched and `cropClearsMinimumEdge` still refuses this
 * picture in production, which is the state the flag's docblock declares.
 *
 * # It replicates the road rather than re-inventing it
 *
 * Same reader, same words, same pure functions in the same order as
 * `inkReferenceCutter`'s region path: the region mask, the face taken out of it
 * with `subtractMask`, the extent, the masked cutout with `cutOutPixels`. If
 * that path ever changes, this script is a copy that will drift — which is why
 * it is disposable and why every number it prints is printed beside the
 * shipped court's, never instead of it.
 *
 * # What it spends
 *
 * Four reader calls per specimen — `tattooed skin`, the placement's own
 * `readerWord`, the in-surface licence, and `face` — riding the shared
 * `FAL_CONCURRENCY` courtesy pool. Two specimens, eight calls, about $0.04. No
 * credits, no render, no engine.
 *
 * # AND IT GRADES NOTHING
 *
 * Law 9. Whether 183x353 of a real arm is enough for an engine to draw from is a
 * question for eyes and, after them, for frames. This prints geometry and writes
 * pictures.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import {
  FACE_REGION,
  INK_REGION,
  cutOutPixels,
  extentOf,
  sourceRegionWord,
  subtractMask,
} from "../server/castingV2/inkReferenceCrop";
import { INK_DESIGN_MIN_EDGE } from "../server/castingV2/inkUploadDoor";
import { inkPlacementEntry } from "../shared/inkPlacementVocabulary";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/court-region-floor");

/**
 * The two REAL photographs, with the placement each is asked about.
 *
 * S1's arm is the SUBJECT — the placement his own ontology example names
 * (*"copy his right arm sleeve"*) and the one the floor blocks. S2's chest is
 * the CONTROL: it clears the floor, it is the road's first real crop, and it is
 * re-cut here through this script's own code so that the two pictures the pass
 * compares were made the same way. A control made by a different route would
 * confound the floor with the harness.
 */
const SPECIMENS = [
  {
    id: "S1-upperArm",
    file: "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png",
    placement: "upperArm" as const,
    seen: "shirtless man on a black seat, torso and both arms in fine-line patchwork",
  },
  {
    id: "S2-upperChest",
    file: "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-torso-neck-continuation.png",
    placement: "upperChest" as const,
    seen: "shirtless tanned man against a rough white wall, cropped at the mouth",
  },
];

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — this court asks the REAL reader and will not pretend to.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const lines: string[] = [];
const say = (line: string) => {
  console.log(line);
  lines.push(line);
};

for (const specimen of SPECIMENS) {
  const bytes = await readFile(resolve(REPO, specimen.file));
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = decoded.info.width;
  const height = decoded.info.height;
  const word = sourceRegionWord({
    readerWord: inkPlacementEntry(specimen.placement).readerWord,
    phrase: null,
  });
  say(`\n${specimen.id}  ${width}x${height}  placement ${specimen.placement} -> "${word}"`);
  say(`  seen: ${specimen.seen}`);
  if (word === null) {
    say("  REFUSED: the placement has no reader word");
    continue;
  }

  const reader = createFalRegionReader({ apiKey });
  const ink = await reader.region({ image: bytes, name: INK_REGION, absentIsAnswer: true });
  const region = await reader.region({ image: bytes, name: word, absentIsAnswer: true });
  if (region === null) {
    say(`  REFUSED: "${word}" went unanswered`);
    continue;
  }
  if (region.width !== width || region.height !== height) {
    say(`  REFUSED: the region mask is ${region.width}x${region.height}, not her picture's space`);
    continue;
  }
  const regionExtent = extentOf(region);
  if (regionExtent.box === null) {
    say(`  REFUSED: "${word}" answered nothing`);
    continue;
  }

  /* THE LICENCE, ASKED INSIDE THE SURFACE — the shipped road's own gate
     (fable-1205 §1). It decides nothing here; it is printed so the log records
     whether the road would have been TAKEN on this picture at all. */
  const surfaceCrop = await sharp(bytes)
    .extract({
      left: regionExtent.box.left,
      top: regionExtent.box.top,
      width: regionExtent.box.width,
      height: regionExtent.box.height,
    })
    .png()
    .toBuffer();
  const inside = await reader.region({ image: surfaceCrop, name: INK_REGION, absentIsAnswer: true });
  const insidePixels = inside === null ? null : extentOf(inside).pixels;

  const face = await reader.region({ image: bytes, name: FACE_REGION, absentIsAnswer: true });
  const facePixels = face === null ? null : extentOf(face).pixels;
  const kept = face === null || face.width !== width || face.height !== height
    ? region
    : subtractMask(region, face);
  const keptExtent = extentOf(kept);
  if (keptExtent.box === null) {
    say("  REFUSED: the named surface is entirely face");
    continue;
  }

  const box = keptExtent.box;
  const shortest = Math.min(box.width, box.height);
  const inkPixels = ink === null ? null : extentOf(ink).pixels;
  say(
    `  ink(whole frame) ${inkPixels === null ? "UNANSWERED" : `${inkPixels} px`}`
    + `   surface ${regionExtent.pixels} px ${regionExtent.box.width}x${regionExtent.box.height}`,
  );
  say(`  in-surface licence ${insidePixels === null ? "UNANSWERED" : `${insidePixels} px`}   face ${facePixels === null ? "UNANSWERED" : `${facePixels} px`}`);
  say(
    `  after the face comes out: ${keptExtent.pixels} px  ${box.width}x${box.height}`
    + `   shortest ${shortest} vs floor ${INK_DESIGN_MIN_EDGE}`
    + `   -> ${shortest >= INK_DESIGN_MIN_EDGE ? "CLEARS (production carries this)" : "UNDER (production refuses cutTooSmall)"}`,
  );

  const cut = cutOutPixels({ rgba: decoded.data, width, height, mask: kept });
  const png = await sharp(cut, { raw: { width, height, channels: 4 } })
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .png()
    .toBuffer();
  const file = resolve(OUT, `${specimen.id}-native-${box.width}x${box.height}.png`);
  await writeFile(file, png);
  say(`  WROTE ${file}`);
}

say("\nEVERY FILE ABOVE IS FOR EYES. The floor is not decided here — this is its subject.");
await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
process.exit(0);

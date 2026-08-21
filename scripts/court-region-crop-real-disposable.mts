/**
 * THE REGION ROAD MEETS A REAL PHOTOGRAPH — the first time, and the artifact
 * the realism pass needs as its own input (fable-1183 §3's frames).
 *
 *   npx tsx scripts/court-region-crop-real-disposable.mts
 *
 * # What it is for, and it is TWO things
 *
 * 1. **The road, driven on the founder's own specimens rather than on
 *    fixtures.** Every arm behind this road answers a scripted reader; a
 *    scripted reader agrees with whatever the code does. This asks the real one.
 * 2. **It PRODUCES the small cut** that the realism pass has to put beside an
 *    upscaled copy of itself, in front of his eyes, before any floor constant
 *    moves. Nothing about the floor is decided here and nothing is upscaled —
 *    that is the pass, and this is its subject.
 *
 * # It spends house money and says how much
 *
 * Four segmenter calls per specimen — `tattooed skin`, `human skin` on the
 * padded copy, the placement's `readerWord`, and `face` — riding the shared
 * `FAL_CONCURRENCY` courtesy pool. No credits, no render, no engine. Two
 * specimens, so eight calls, about $0.04.
 *
 * # AND IT IS RUN BOTH WAYS ROUND ON THE SAME PIXELS
 *
 * With the road on and with it off, so the pair can be looked at side by side —
 * `crop-holds-the-region-it-depicts` is a claim about what a picture SHOWS, and
 * the only way to weigh it is to open both. Every file written is named for the
 * specimen and the road that made it, because a frame labelled as something it
 * is not has cost this program a whole sitting before (the parent's frame filed
 * as the child's, opus-889 §3).
 *
 * # ⚠ IT ASSERTS NOTHING ABOUT WHAT THE CROP LOOKS LIKE
 *
 * Law 9. The reader answers where the surface is; whether the resulting picture
 * is a usable reference for a render is a question for eyes, and this script's
 * whole job is to put something in front of them. It prints geometry and writes
 * files. It does not grade them.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { cutInkDesign } from "../server/castingV2/inkReferenceCutter";
import { sourceRegionWord } from "../server/castingV2/inkReferenceCrop";
import { inkPlacementEntry } from "../shared/inkPlacementVocabulary";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/court-region-crop");

/**
 * The two REAL photographs, and the placement each one is being asked about.
 *
 * The descriptions are the corpus's own, written from opening the files — they
 * are quoted rather than re-derived so this script cannot come to describe a
 * different picture from the one every other court measured.
 */
const SPECIMENS = [
  {
    id: "S1-patchwork-man",
    file: "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png",
    placement: "upperArm" as const,
    /* Which half of the PICTURE — his own arm, as the picture shows it. Named
       rather than derived because this is a specimen, not a customer ask, and
       `imageHalfOf` belongs to the road that reads her sentence. */
    half: "left" as const,
    seen: "shirtless man on a black seat, torso and both arms in fine-line patchwork; "
      + "large BARE un-inked areas at the sternum, the belly and both shoulders",
  },
  {
    id: "S2-torso-neck",
    file: "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-torso-neck-continuation.png",
    /* THE TORSO CASE — filed as *"the one whose surface box climbs to y=80 and
       takes the face with it"* until 2026-08-21. Measured twice at the real
       reader it does NOT: `upper chest` here starts at y=210 and holds 0 face
       pixels, as does S1's. The cell the face exclusion was written from has
       never been found in a real photograph (`V3B_FRAMES_GATE_WALK.md` §5(b)). */
    placement: "upperChest" as const,
    half: null,
    seen: "shirtless tanned man against a rough white wall, cropped at the mouth; "
      + "barbed wire round the neck, chest and stomach pieces, both sleeves worked",
  },
  {
    /*
      ⚠ THE NEGATIVE CELL (fable-1205 §2b), and it is what makes the two above
      mean anything: a photographed person with NO TATTOO ANYWHERE. The licence
      must be silent here and the free door must open — a road that licensed
      this picture would carry a stranger's bare chest as "the design".

      Its own note, from the corpus: this file carries a Doubao AI-generation
      watermark. It is photorealistic and it is the population (what a customer
      uploads is whatever they have), and it is not a camera photograph, which
      is said rather than filed away.
    */
    id: "S3-glasses-model",
    file: "docs/specs/references/build-two-founder-specimens/glasses-cateye-blond-model.png",
    placement: "upperChest" as const,
    half: null,
    seen: "photorealistic head-and-shoulders of a blond man in cat-eye glasses, whole face, "
      + "bare facial skin and neck, black leather jacket, NO TATTOO ANYWHERE",
  },
];

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — this court asks the REAL reader and will not pretend to.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

let failed = false;
for (const specimen of SPECIMENS) {
  const bytes = await readFile(resolve(REPO, specimen.file));
  const meta = await sharp(bytes).metadata();
  const word = sourceRegionWord({
    readerWord: inkPlacementEntry(specimen.placement).readerWord,
    phrase: null,
  });
  console.log(`\n${specimen.id}  ${meta.width}x${meta.height}  placement ${specimen.placement} -> "${word}"`);
  console.log(`  seen: ${specimen.seen}`);

  for (const road of ["off", "on"] as const) {
    /* A READER PER RUN, like the production path: `createFalRegionReader` proves
       a frame's URL against the bytes in hand once per reader. */
    const reader = createFalRegionReader({ apiKey });
    const result = await cutInkDesign({
      bytes,
      reader,
      scope: { region: word, half: specimen.half },
      regionCrop: road === "on",
      about: { candidatePublicId: specimen.id },
    });

    if (!result.ok) {
      console.log(`  road ${road.padEnd(3)}  REFUSED  ${result.refusal.code}`);
      /* A refusal is a reading and not a script failure — both specimens are
         expected to refuse on today's floor, which is the road's declared inert
         state. It is printed and the court goes on. */
      continue;
    }
    const box = result.cut.box;
    const name = `${specimen.id}-road-${road}.png`;
    await writeFile(resolve(OUT, name), result.cut.bytes);
    console.log(
      `  road ${road.padEnd(3)}  ${result.cut.route}  ink ${result.cut.inkPixels}  person ${result.cut.personPixels}`
      + `  box ${box ? `${box.width}x${box.height} at ${box.left},${box.top}` : "whole frame"}`
      + `  -> output/court-region-crop/${name}`,
    );
  }
}

console.log(
  "\nEVERY FILE ABOVE IS FOR EYES. Nothing here grades a picture — the reader says"
  + "\nwhere a surface is, and whether the crop is a usable reference is his call.",
);
process.exit(failed ? 1 : 0);

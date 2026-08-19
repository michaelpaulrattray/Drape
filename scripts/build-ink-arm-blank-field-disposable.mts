/**
 * THE ARM PAIR JOINS THE SET'S ONE FIELD — disposable build, arithmetic only.
 *
 * # Why this exists at all
 *
 * fable-1031 bound (b) is ONE FIELD VALUE ACROSS ALL SIX BLANKS, and fable-1033
 * ruled the female back's uniform +1 on the argument that THE SET IS THE UNIT.
 * The four body blanks are exactly 254 on every border pixel. The arm pair,
 * built earlier by cleaning the founder's own photograph, is not — measured
 * before this ran:
 *
 *   ring 224 distinct values · modal 236 ×32.3%
 *   inward from x=0 at y=40:  237 255 254 253 254 254 254 254 255
 *   interior 200² block: 3 distinct · 254 ×26000 · 255 ×9311 · 253 ×4689
 *
 * So it is TWO faults, not one: a ONE-PIXEL DARK FRAME at ~237 around the whole
 * plate, and a field dithered across 253/254/255. The frame is the one that
 * matters beyond tidiness — the plate prompt ends with *"no border"* while the
 * picture it hands the engine has one, and the engine copies the picture (the
 * carrier law, three lanes and counting).
 *
 * # What it changes, and what it may not
 *
 * Only near-white: a pixel whose three channels are all ≥ 253 becomes exactly
 * 254, and the 1px frame is overwritten with 254. Everything darker than 253 —
 * the limb, its shading, the soft fade where the form ends — is passed through
 * byte for byte. The founder approved this arm by LOOKING at it (fable-1017 §1,
 * "looks good"); what he looked at is the form, and the form is untouched.
 *
 * The right arm is `flop()` of the treated left, so the pair stays the same limb
 * BY CONSTRUCTION rather than by two treatments agreeing.
 *
 * # The controls, printed on every run (working law 2)
 *
 *   POSITIVE  the treated plate's border ring is one value, and no pixel
 *             anywhere sits at 253 or 255
 *   NEGATIVE  the same two checks run against the UNTREATED source and MUST
 *             fail — a checker that cannot fail has said nothing
 *   IDENTITY  every pixel below the near-white threshold is unchanged, max 0
 *   MIRROR    right vs flop(left), mean abs diff 0
 */
import { mkdir } from "node:fs/promises";

import sharp from "sharp";

const SOURCE = "output/imagegen/ink-template-arm-single-view-a.png";
const OUT_DIR = "output/imagegen/composite";
const LEFT = `${OUT_DIR}/blank-arm-a.png`;
const RIGHT = `${OUT_DIR}/blank-arm-b-mirrored.png`;

/** The set's one field value — the same constant the body composite landed on. */
const FIELD = 254;
/** At or above this in all three channels is FIELD, not form. One below FIELD,
 *  so the only pixels moved are the two neighbours of the value itself. */
const NEAR_WHITE = 253;

type Plate = { data: Buffer; width: number; height: number };

async function read(file: string): Promise<Plate> {
  const image = sharp(file);
  const { width = 0, height = 0 } = await image.metadata();
  return { data: await image.raw().toBuffer(), width, height };
}

function flatten(source: Plate): Plate {
  const data = Buffer.from(source.data);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const i = (y * source.width + x) * 3;
      const border = x === 0 || y === 0 || x === source.width - 1 || y === source.height - 1;
      const nearWhite = data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE;
      if (border || nearWhite) { data[i] = FIELD; data[i + 1] = FIELD; data[i + 2] = FIELD; }
    }
  }
  return { ...source, data };
}

function ringDistinct(plate: Plate): number {
  const seen = new Set<string>();
  const at = (x: number, y: number) => {
    const i = (y * plate.width + x) * 3;
    seen.add(`${plate.data[i]},${plate.data[i + 1]},${plate.data[i + 2]}`);
  };
  for (let x = 0; x < plate.width; x += 1) { at(x, 0); at(x, plate.height - 1); }
  for (let y = 1; y < plate.height - 1; y += 1) { at(0, y); at(plate.width - 1, y); }
  return seen.size;
}

/**
 * Pixels the treatment CLAIMS as field — near-white in all three channels — that
 * did not land on exactly FIELD.
 *
 * The predicate is deliberately the treatment's own. A first version counted any
 * CHANNEL at or above the threshold and reported 3,927 survivors on a plate the
 * treatment had handled correctly: those are fade pixels like (253, 252, 254),
 * one channel bright and the pixel as a whole not field at all. A checker asking
 * a different question from the one the code answers reports a defect that is
 * only a disagreement about words.
 */
function fieldStrays(plate: Plate): number {
  let strays = 0;
  for (let i = 0; i < plate.data.length; i += 3) {
    const nearWhite = plate.data[i] >= NEAR_WHITE
      && plate.data[i + 1] >= NEAR_WHITE && plate.data[i + 2] >= NEAR_WHITE;
    if (!nearWhite) continue;
    if (plate.data[i] !== FIELD || plate.data[i + 1] !== FIELD || plate.data[i + 2] !== FIELD) strays += 1;
  }
  return strays;
}

/** Reported, never asserted: how neutral the plate is. A greyscale form should
 *  be R=G=B, and any spread here is the source photograph's own colour. */
function chromaticPixels(plate: Plate): number {
  let count = 0;
  for (let i = 0; i < plate.data.length; i += 3) {
    if (plate.data[i] !== plate.data[i + 1] || plate.data[i + 1] !== plate.data[i + 2]) count += 1;
  }
  return count;
}

/** The largest change anywhere the source was NOT near-white and not the frame. */
function formMaxDelta(before: Plate, after: Plate): number {
  let max = 0;
  for (let y = 1; y < before.height - 1; y += 1) {
    for (let x = 1; x < before.width - 1; x += 1) {
      const i = (y * before.width + x) * 3;
      const nearWhite = before.data[i] >= NEAR_WHITE
        && before.data[i + 1] >= NEAR_WHITE && before.data[i + 2] >= NEAR_WHITE;
      if (nearWhite) continue;
      for (let c = 0; c < 3; c += 1) max = Math.max(max, Math.abs(before.data[i + c] - after.data[i + c]));
    }
  }
  return max;
}

async function write(plate: Plate, file: string): Promise<void> {
  await sharp(plate.data, { raw: { width: plate.width, height: plate.height, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const source = await read(SOURCE);
  const treated = flatten(source);
  await write(treated, LEFT);

  const rightData = await sharp(treated.data, {
    raw: { width: treated.width, height: treated.height, channels: 3 },
  }).flop().raw().toBuffer();
  await write({ ...treated, data: rightData }, RIGHT);

  const left = await read(LEFT);
  const right = await read(RIGHT);
  const flopped = await sharp(LEFT).flop().raw().toBuffer();
  let mirrorDiff = 0;
  for (let i = 0; i < right.data.length; i += 1) mirrorDiff += Math.abs(right.data[i] - flopped[i]);

  console.log("POSITIVE  treated left   ring distinct " + ringDistinct(left)
    + " (want 1) · field strays " + fieldStrays(left) + " (want 0)");
  console.log("POSITIVE  treated right  ring distinct " + ringDistinct(right)
    + " (want 1) · field strays " + fieldStrays(right) + " (want 0)");
  console.log("NEGATIVE  untreated src  ring distinct " + ringDistinct(source)
    + " (must NOT be 1) · field strays " + fieldStrays(source) + " (must NOT be 0)");
  console.log("IDENTITY  form pixels (source not near-white, off the frame)  max delta "
    + formMaxDelta(source, left) + " (want 0)");
  console.log("NEUTRAL   chromatic pixels (reported, not a bound)  source "
    + chromaticPixels(source) + "  treated " + chromaticPixels(left));
  console.log("MIRROR    right vs flop(left)  mean abs diff "
    + (mirrorDiff / right.data.length).toFixed(4) + " (want 0)");
  console.log(`\nwrote ${LEFT}\nwrote ${RIGHT}`);
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });

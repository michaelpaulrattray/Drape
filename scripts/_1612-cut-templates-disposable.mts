/**
 * DISPOSABLE — cut #1612 part 3's framing templates from their generated source,
 * using the SAME segmenter the checker uses, and verify each one with the SAME
 * measurer.
 *
 * # Why the crops are cut rather than asked for
 *
 * The first attempt asked the image generator for the close-up crop directly.
 * It came back failing the band in BOTH directions at once — the crown clear of
 * the top edge where the band wants it cut, and the chin running off the bottom
 * where the band wants a margin below it. Which is the lottery you would expect:
 * a crop is a continuous quantity and a prompt is not a ruler.
 *
 * So the generator makes ONE roomy, whole-form source per pose — which is what
 * it is genuinely good at — and the crop is arithmetic from there. And the
 * arithmetic is not eyeballed either: the face and subject boxes come from
 * `fal-ai/sam-3` through `createFalRegionReader`, the same reader
 * `measureViewFraming` asks, so the template's crop is derived from the reading
 * the checker will actually make rather than from a person looking at a picture
 * and deciding where a chin is.
 *
 * **Then every cut template is MEASURED by `measureViewFraming` against its own
 * view's band before it is written.** A template that cannot pass the band it
 * exists to teach is not a template, and this script refuses rather than
 * writing one.
 *
 * Spends HOUSE money only: a handful of fal segmenter reads at ~1¢ each. No
 * renders, no customer credits, no database, no storage writes.
 *
 *   npx tsx scripts/_1612-cut-templates-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { castPackageView } from "../server/castingV2/castViewPackage";
import { measureViewFraming } from "../server/castingV2/viewFramingGeometry";
import type { CastViewAngle } from "../shared/boardTypes";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY in .env");

const OUT = "assets/views";
mkdirSync(OUT, { recursive: true });
mkdirSync("output/1612-part3", { recursive: true });

const reader = createFalRegionReader({ apiKey });

/** The generated sources, one per pose. */
const SOURCES: Record<string, string> = {
  bust: "output/imagegen/head2/neutral-grey-featureless-head-roomy-framing-template.png",
  frontFull: "output/imagegen/frontFull/front-full-anonymous-neutral-grey-mannequin-1024x1536.png",
  backFull: "output/imagegen/backFull/back-full-neutral-grey-androgynous-mannequin-1024x1536.png",
};

type Box = { left: number; top: number; width: number; height: number };

/** The bounding box of a mask's lit pixels, in the image's own pixels. */
function boxOf(mask: { data: Buffer; width: number; height: number }): Box | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/*
  ⚠ **IT ASKS FOR THE LANDMARKS THE BAND NEEDS AND NOT A FIXED PAIR.** The first
  shape of this helper read `face` AND `subject` for every source and died on
  `backFull` with *"the segmenter found no face to edit"* — correctly, because a
  picture of somebody's back has no face in it. `backFull`'s band asks only about
  the subject. The guard was right and the question was wrong, which is the same
  shape as #1582 one level up: a reader asked for a feature the subject does not
  have answers honestly and the caller reads it as a failure.
*/
async function readSubject(bytes: Buffer): Promise<Box | null> {
  return boxOf(await reader.subject({ image: bytes }));
}

async function readFace(bytes: Buffer): Promise<Box | null> {
  return boxOf(await reader.region({ image: bytes, name: "face", absentIsAnswer: false }));
}

/**
 * Cut a window out of the source and resize it to the delivered shape.
 *
 * ⚠ **1024x1536 is not a taste decision.** The anchor every view render already
 * carries is exactly that, and the engine reads its output shape off its
 * references — so a template in any other shape would drag the delivered
 * picture toward itself. `_1612-template-shape-disposable.mts` is where that is
 * driven rather than assumed.
 */
async function windowTo(
  source: Buffer,
  window: { left: number; top: number; width: number; height: number },
): Promise<Buffer> {
  const meta = await sharp(source).metadata();
  const left = Math.max(0, Math.round(window.left));
  const top = Math.max(0, Math.round(window.top));
  const width = Math.min(Math.round(window.width), (meta.width ?? 0) - left);
  const height = Math.min(Math.round(window.height), (meta.height ?? 0) - top);
  return sharp(source)
    .extract({ left, top, width, height })
    .resize(1024, 1536, { fit: "fill" })
    .png()
    .toBuffer();
}

const results: Array<Record<string, unknown>> = [];

async function verifyAndWrite(angle: CastViewAngle, bytes: Buffer): Promise<void> {
  const view = castPackageView(angle);
  const measurement = await measureViewFraming({ band: view.band, image: bytes, reader });
  const meta = await sharp(bytes).metadata();
  const row = {
    angle,
    size: `${meta.width}x${meta.height}`,
    verdict: measurement.verdict,
    readings: measurement.readings.map((reading) => ({
      rule: reading.rule,
      held: reading.held,
      note: reading.note ?? null,
      value: (reading as { value?: number }).value ?? null,
    })),
  };
  results.push(row);
  console.log(`${angle}: ${measurement.verdict}`);
  for (const reading of measurement.readings) {
    console.log(`   ${JSON.stringify(reading.rule)} -> held=${reading.held} ${reading.note ?? ""}`);
  }
  if (measurement.verdict !== "inBand") {
    writeFileSync(`output/1612-part3/REJECTED-${angle}.png`, bytes);
    throw new Error(
      `${angle}: the cut template reads ${measurement.verdict} against its own band — `
      + "refusing to write a template that fails the band it exists to teach. "
      + `The rejected cut is at output/1612-part3/REJECTED-${angle}.png`,
    );
  }
  writeFileSync(`${OUT}/${angle}-framing-template.png`, bytes);
  console.log(`   written ${OUT}/${angle}-framing-template.png`);
}

/* ---- closeUp, cut from the bust ---- */
{
  const source = readFileSync(SOURCES.bust!);
  const face = await readFace(source);
  const subject = await readSubject(source);
  if (!face || !subject) throw new Error("the segmenter found no face or no subject on the bust source");
  console.log(`bust: face ${JSON.stringify(face)}  subject ${JSON.stringify(subject)}`);

  /*
    THE CLOSE-UP'S BAND, SOLVED FOR A WINDOW rather than approached by eye:

      cutBy subject top .............. the window's top edge is BELOW the top of
                                       the subject, so the crown runs off it
      clearOf face bottom ............ the window's bottom edge is BELOW the
                                       bottom of the face
      roomBelowAtMost face 0.3 ....... and by no more than 0.3 of a face height

    0.15 is chosen inside that band rather than at its edge, for the reason the
    band's own docblock gives about 0.3 sitting in an empty gap: a template at
    the boundary teaches the boundary, and a render that lands a little loose of
    a boundary template is out of band. His two in-band production frames read
    0.07 and 0.18, so 0.15 is inside the population he has already passed.

    The window's top is set so the crown is cut by a tenth of a face height —
    enough that the segmenter reads it as reaching the edge, not so much that the
    template is a different crop from the one the band describes.
  */
  const roomBelow = 0.15 * face.height;
  const cutAbove = 0.10 * face.height;
  const top = face.top + cutAbove;
  const bottom = face.top + face.height + roomBelow;
  const height = bottom - top;
  const width = height * (1024 / 1536);
  const left = face.left + face.width / 2 - width / 2;
  await verifyAndWrite("closeUp", await windowTo(source, { left, top, width, height }));
}

/* ---- the two full lengths, cut from their own sources ---- */
for (const angle of ["frontFull", "backFull"] as const) {
  const path = SOURCES[angle]!;
  let source: Buffer;
  try {
    source = readFileSync(path);
  } catch {
    console.log(`${angle}: no source at ${path} yet — skipped`);
    continue;
  }
  const subject = await readSubject(source);
  if (!subject) throw new Error(`the segmenter found no subject on the ${angle} source`);
  console.log(`${angle}: subject ${JSON.stringify(subject)}`);

  /*
    BOTH FULL LENGTHS WANT THE SAME TWO THINGS — `clearOf subject top` and
    `clearOf subject bottom` — so the window is the subject's own box with a
    margin on every side, widened to the delivered 2:3 about the subject's
    centre. 12% of the subject's height above and below is comfortably clear of
    `EDGE_BAND_FRACTION` (1% of the frame) without making the figure small in
    its own template.
  */
  const margin = 0.12 * subject.height;
  const top = subject.top - margin;
  const height = subject.height + margin * 2;
  const width = height * (1024 / 1536);
  const left = subject.left + subject.width / 2 - width / 2;
  await verifyAndWrite(angle, await windowTo(source, { left, top, width, height }));
}

writeFileSync("output/1612-part3/template-cut.json", JSON.stringify(results, null, 1), "utf8");
console.log("");
console.log("every template written has been measured in band by the checker it exists to teach.");

process.exit(0);

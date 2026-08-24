/**
 * SHOPPING LANDMARK ALIGNMENT — the capability the max-delta fixture needs and
 * nothing shopped so far provides.
 *
 * Everything in rounds one and two was SEGMENTATION: where is a thing in THIS
 * picture. Mapping a reference's hair zone onto a different person's head is a
 * correspondence problem — eye centres, head axis, scale — between two faces
 * that share no pixels. Padding covers alignment slop; it does not substitute
 * for alignment.
 *
 * `fal-ai/moondream3-preview/point` takes `image_url` + `prompt` ("object to be
 * located") and returns `points`. Schema read from fal's OpenAPI, not recalled.
 *
 * # Both controls, before any verdict (D-203, working law 2)
 *
 * POSITIVE: ask for eyes on a face that has them. The points must land ON the
 *           eyes, which is checkable against SAM 3's eye mask — an independent
 *           instrument that already earned its place. Two models agreeing is
 *           worth more than one model being confident.
 * NEGATIVE: ask for something no face has. A pointer that returns confident
 *           coordinates for an absent thing is D-213's failure in a new costume,
 *           and it would silently misalign every transfer built on it.
 *
 * Run across several faces, because a landmark model that works on one head is
 * not a routing row. Three specimens spanning the transfer case: the crew-cut
 * master, the big-afro reference, and one ordinary face.
 *
 *   npx tsx scripts/calibration/landmark-shop.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { type Mask } from "../../server/castingV2/maskedComposite";

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error("FAL_KEY required");

const OUT = "output/masked/landmark-shop";
mkdirSync(OUT, { recursive: true });

const SPECIMENS: Record<string, string> = {
  crewcut: "output/masked/specimens/wire-08.png",
  afro: "output/masked/specimens/fresh-06.png",
  ordinary: "output/masked/specimens/fresh-02.png",
};

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) throw new Error("mask not single-channel");
  return { data, width: info.width, height: info.height };
}

async function fal(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${KEY}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${endpoint}: ${(await response.text()).slice(0, 180)}`);
  return response.json() as any;
}

async function segmentEyes(dataUri: string): Promise<Mask | null> {
  const json = await fal("fal-ai/sam-3/image", {
    image_url: dataUri, prompt: "eyes", include_scores: true, output_format: "png",
  });
  if (!Array.isArray(json.masks) || json.masks.length === 0) return null;
  const url = json.masks[0]?.url ?? json.masks[0];
  const bytes = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(bytes);
}

/** Does a normalised point land inside a mask? The cross-check. */
function pointInMask(mask: Mask, x: number, y: number, tolerancePx: number): boolean {
  const px = Math.round(x * mask.width);
  const py = Math.round(y * mask.height);
  for (let dy = -tolerancePx; dy <= tolerancePx; dy += 1) {
    for (let dx = -tolerancePx; dx <= tolerancePx; dx += 1) {
      const sx = px + dx;
      const sy = py + dy;
      if (sx < 0 || sy < 0 || sx >= mask.width || sy >= mask.height) continue;
      if (mask.data[sy * mask.width + sx] > 0) return true;
    }
  }
  return false;
}

const rows: any[] = [];
for (const [tag, file] of Object.entries(SPECIMENS)) {
  const bytes = readFileSync(file);
  const dataUri = `data:image/png;base64,${bytes.toString("base64")}`;
  console.log(`\n### ${tag} — ${file}`);

  const eyeMask = await segmentEyes(dataUri);

  /* POSITIVE — a thing every one of these faces has. */
  const positive = await fal("fal-ai/moondream3-preview/point", { image_url: dataUri, prompt: "eye" });
  const points: { x: number; y: number }[] = positive.points ?? [];
  console.log(`  "eye" -> ${points.length} point(s): ${points.map((p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`).join(" ")}`);

  let onEyes: number | null = null;
  if (eyeMask && points.length > 0) {
    /* 12px tolerance: the eye mask is the eye APERTURE, and a landmark model
       reasonably points at the eye's centre, which can sit on the iris edge. */
    onEyes = points.filter((p) => pointInMask(eyeMask, p.x, p.y, 12)).length;
    console.log(`  cross-check against SAM 3's eye mask: ${onEyes}/${points.length} land on an eye`);
  } else if (!eyeMask) {
    console.log("  no SAM 3 eye mask — cross-check unavailable, points unverified");
  }

  /* NEGATIVE — nothing in this fixture wears one. */
  const negative = await fal("fal-ai/moondream3-preview/point", { image_url: dataUri, prompt: "wristwatch" });
  const phantom: { x: number; y: number }[] = negative.points ?? [];
  console.log(
    `  NEGATIVE CONTROL "wristwatch" -> ${phantom.length} point(s)`
    + `  ${phantom.length === 0 ? "— returned nothing, correct" : "— INVENTED A LOCATION"}`,
  );

  /*
    Draw them, because coordinates are not a picture (D-202).

    ⚠ WHITE, NOT RED — corrected 2026-08-24. The founder ruled on 2026-08-11
    that on-image geometry is monochrome EVERYWHERE, and these dots were
    `{ r: 255, g: 40, b: 40 }` on a photograph from before that ruling until
    now. `onImageGeometryMonochrome` exists to catch exactly this and could not
    see it: it hunts an SVG hex and an `[r, g, b]` ARRAY, and sharp's own
    colour shape is an OBJECT. Found by sweeping the idiom after the guard
    caught the same mistake of mine in the SVG form — the instance it could see
    led to the one it could not.
  */
  const dots = points.map((p) => ({
    input: {
      create: {
        width: 18, height: 18, channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    },
    left: Math.max(0, Math.round(p.x * 1024) - 9),
    top: Math.max(0, Math.round(p.y * 1536) - 9),
  }));
  if (dots.length > 0) {
    writeFileSync(
      `${OUT}/${tag}-points.jpg`,
      await sharp(bytes).composite(dots as any).resize(400).jpeg({ quality: 92 }).toBuffer(),
    );
  }

  rows.push({
    tag, file,
    points, pointCount: points.length,
    onEyes,
    negativePointCount: phantom.length,
    negativeClean: phantom.length === 0,
    finishReason: positive.finish_reason ?? null,
  });
}

console.log("\n=== verdict ===");
const allClean = rows.every((row) => row.negativeClean);
const allOn = rows.every((row) => row.onEyes !== null && row.onEyes === row.pointCount && row.pointCount >= 2);
console.log(`  negative control clean on every specimen: ${allClean ? "YES" : "NO"}`);
console.log(`  every returned point lands on an eye:     ${allOn ? "YES" : "NO"}`);
console.log(`  → ${allClean && allOn ? "usable as the alignment row's source" : "NOT yet a routing row"}`);

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimens: SPECIMENS, rows }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

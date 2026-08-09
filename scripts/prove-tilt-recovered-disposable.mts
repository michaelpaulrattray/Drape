/**
 * WHAT THE ONE-EYED MASK COST THE TILT INSTRUMENT, and what the fix gives back.
 *
 * `readCanthalTilt` is the measurement behind the eye-shape work — the
 * already-true gate, the fox-eyes matrix, every tilt number in the pack. It has
 * two rungs and BOTH of them go through the bilateral `eyes` region:
 *
 *   rung 1  asks `region({ name: "right eye" })` and `"left eye"` directly.
 *           Those names are not in the reader's bilateral set, so they are asked
 *           of SAM 3 verbatim — and `"right eye"` returned ZERO masks on both of
 *           the founder's frames, so this rung throws and is skipped.
 *   rung 2  asks `region({ name: "eyes" })`, then crops to that mask's bounding
 *           box and asks again inside the crop. `cornersFromMask` needs TWO
 *           connected components — *"a tilt reading needs two eyes"* — so a
 *           one-eyed union cannot produce a reading, and the crop drawn from it
 *           is a box around one eye, which cannot either.
 *
 * So a frame with two plainly visible eyes read as NO-READ, and a no-read is not
 * a wrong number — it is a missing one, which is why this was invisible.
 *
 * # The before is REPRODUCED, not remembered
 *
 * `oldBilateralReader` below is the deleted code, re-expressed: ask
 * `"left eye"`/`"right eye"`, take `masks[0]`, union what came back. Both readers
 * are driven against the same two frames in the same run, so the delta is
 * measured rather than inferred from a commit. That is the shift's own law — a
 * null result is evidence only against a fixture that could have produced a
 * non-null one.
 *
 * Reads only: SAM 3 on the provider balance, no account credit, no walk.
 *
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/prove-tilt-recovered-disposable.mts \
 *       --bucket https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 */
import mysql from "mysql2/promise";
import sharp from "sharp";

import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";
import { createChecks } from "./lib/drivePage.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { readCanthalTilt } from "../server/castingV2/eyeShapeRouting";
import { MaskError } from "../server/castingV2/maskGeometry";
import type { Mask } from "../server/castingV2/maskedComposite";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const base = arg("bucket").replace(/\/$/, "");
if (!base) throw new Error("--bucket <public url> is required — these are production frames");
if (base === (readLocalEnvFile().get("R2_PUBLIC_URL") ?? "").replace(/\/$/, "")) {
  throw new Error("--bucket is the local .env's bucket — the dev world, and these rows are production's");
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — this is a real segmentation read");

const SPECIMENS = [
  { label: "v#147", publicId: "8ac53e6e-ac36-4a83-83be-a17e04593450" },
  { label: "v#156", publicId: "ffe31dae-afac-4fd7-af15-46fb65ee273a" },
] as const;

/* ------------------------------------------------------- the deleted code */

/**
 * THE OLD BILATERAL BRANCH, exactly as it was, as this run's negative control.
 *
 * Copied rather than imported because it no longer exists — and kept to the
 * letter, `masks[0]` and all, so the control is the failure and not an
 * approximation of it.
 */
function oldBilateralReader(): { region(input: { image: Buffer; name: string }): Promise<Mask> } {
  const BILATERAL = new Set(["ear", "eyes", "eyebrows"]);

  const toMask = async (bytes: Buffer): Promise<Mask> => {
    const meta = await sharp(bytes).metadata();
    const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    return { data: Buffer.from(data), width: info.width, height: info.height };
  };

  const askRegion = async (image: Buffer, prompt: string): Promise<Mask | null> => {
    const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: `data:image/png;base64,${image.toString("base64")}`,
        prompt,
        include_scores: true,
        output_format: "png",
      }),
    });
    if (!response.ok) throw new MaskError(`sam-3 ${prompt}: ${response.status}`);
    const json: any = await response.json();
    const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
    if (masks.length === 0) return null;
    const entry = masks[0];
    const url = typeof entry === "string" ? entry : entry.url;
    return toMask(Buffer.from(await (await fetch(url)).arrayBuffer()));
  };

  return {
    async region({ image, name }) {
      if (BILATERAL.has(name)) {
        const singular = name === "eyes" ? "eye" : name.replace(/s$/, "");
        const sides = await Promise.all([
          askRegion(image, `left ${singular}`),
          askRegion(image, `right ${singular}`),
        ]);
        const found = sides.filter((mask): mask is Mask => mask !== null);
        if (found.length === 0) throw new MaskError(`the segmenter found no ${name} to edit`);
        if (found.length === 1) return found[0];
        const { unionMasks } = await import("../server/castingV2/maskGeometry");
        return unionMasks(...found);
      }
      const mask = await askRegion(image, name);
      if (!mask) throw new MaskError(`the segmenter found no ${name} to edit`);
      return mask;
    },
  };
}

/* ----------------------------------------------------------------- the run */

const connection = await mysql.createConnection({
  uri: process.env[databaseKey]!, timezone: "Z",
} as mysql.ConnectionOptions);
const { check, records, failures, print } = createChecks();

for (const specimen of SPECIMENS) {
  const [row] = await connection.query<any[]>(
    "SELECT id, imageKey FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
    [specimen.publicId],
  ).then(([rows]) => rows as any[]);
  if (!row?.imageKey) {
    check(false, `${specimen.label}: the frame is readable`, `no row for ${specimen.publicId}`);
    continue;
  }
  const response = await fetch(`${base}/${row.imageKey}`);
  if (!response.ok) {
    check(false, `${specimen.label}: the frame is readable`, `frame HTTP ${response.status}`);
    continue;
  }
  const image = Buffer.from(await response.arrayBuffer());
  console.log(`\n=== ${specimen.label} (v#${row.id})`);

  const before = await readCanthalTilt({ image, reader: oldBilateralReader() });
  console.log(`    BEFORE (the deleted bilateral branch): ${before ? `${before.meanDeg.toFixed(2)}°` : "NO-READ"}`);
  check(
    before === null,
    `${specimen.label}: the OLD branch could not read a tilt at all`,
    before === null
      ? "NO-READ — the reproduced failure, and the reason this was invisible"
      : `it read ${before.meanDeg.toFixed(2)}° — the control did NOT fail, so the delta below proves nothing`,
  );

  const after = await readCanthalTilt({ image, reader: createFalRegionReader({ apiKey }) });
  console.log(
    `    AFTER  (one side to a picture):            `
    + `${after ? `${after.meanDeg.toFixed(2)}° mean, ${after.asymmetryDeg.toFixed(2)}° asymmetry` : "NO-READ"}`,
  );
  check(
    after !== null,
    `${specimen.label}: the FIXED reader gives the tilt instrument its reading back`,
    after ? `${after.meanDeg.toFixed(2)}° mean, ${after.asymmetryDeg.toFixed(2)}° asymmetry` : "still a NO-READ",
  );
}

await connection.end();
print();
console.log(
  failures().length === 0
    ? "\nThe no-read was the one-eyed mask, and the reading came back with the second eye."
    : "\nRead the rows above before believing either direction.",
);
console.log(`${records.length} checks recorded.`);
process.exit(0);

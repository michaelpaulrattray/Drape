/**
 * WHOSE LEFT? — the read-back's mirrored court (fable-611 §2).
 *
 * Asked about HER right eye on a frame where her right eye HAD been correctly
 * painted, the realization captioner answered *"Left eye (viewer's left) is
 * pale icy blue; right eye remains warm brown"* and refused to corroborate. It
 * had seen the right thing and named it from the camera's side of the mirror.
 * That is wrong in both directions: it refuses correct renders, and on a frame
 * where the WRONG eye was painted the same confusion passes the miss.
 *
 * The prompt now pins the frame — her right is the picture's left, say "her
 * right", never "the viewer's left" — and this is the court of that fix.
 *
 * # It costs no renders, because the frames already exist
 *
 * Two courts of per-side eye edits are on disk with geometry verdicts beside
 * them (`output/side-inference-court`, `output/side-phrasing-court`), so every
 * frame here has a KNOWN painted side measured by the segmenter rather than by
 * a reader:
 *
 * ```
 * THE POSITIVE ARM   frames where the NAMED eye was painted (ratio >= 2)
 *                    → the reader must corroborate
 * THE NEGATIVE ARM   frames where the OTHER eye was painted (ratio < 1)
 *                    → the reader must refuse
 * ```
 *
 * Both arms are required and the negative one is the whole point: a reader that
 * corroborates everything passes the positive arm perfectly.
 *
 * And it is MIRRORED by construction — the positive arm holds asks about her
 * left and about her right, because a per-side claim tested on one side
 * measures the image's half rather than hers.
 *
 *   npx tsx scripts/court-reader-sides-disposable.mts
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";

const COURTS = [
  { dir: "output/side-inference-court", label: "unphrased" },
  { dir: "output/side-phrasing-court", label: "phrased" },
];

type Row = { arm: string; ask: string; leftChange: number; rightChange: number };

/** Which eye the pixels say was painted, and how decisively. */
function paintedSide(row: Row): { named: "left" | "right"; ratio: number } | null {
  const named = row.ask.includes("her left eye") ? "left" as const
    : row.ask.includes("her right eye") ? "right" as const : null;
  if (named === null) return null;
  const namedChange = named === "left" ? row.leftChange : row.rightChange;
  const other = named === "left" ? row.rightChange : row.leftChange;
  if (!Number.isFinite(namedChange) || !Number.isFinite(other) || other === 0) return null;
  return { named, ratio: namedChange / other };
}

const specimens: Array<{ file: string; ask: string; named: "left" | "right"; ratio: number; arm: "positive" | "negative" }> = [];
for (const court of COURTS) {
  const path = `${court.dir}/results.json`;
  if (!existsSync(path)) continue;
  for (const row of JSON.parse(readFileSync(path, "utf8")) as Row[]) {
    const verdict = paintedSide(row);
    if (verdict === null) continue;
    const file = `${court.dir}/${row.arm}-${row.ask.split(" eye ")[1]?.replace(/ /g, "-")}.png`;
    if (!existsSync(file)) continue;
    if (verdict.ratio >= 2) specimens.push({ file, ask: row.ask, ...verdict, arm: "positive" });
    else if (verdict.ratio < 1) specimens.push({ file, ask: row.ask, ...verdict, arm: "negative" });
  }
}

const positives = specimens.filter((one) => one.arm === "positive");
const negatives = specimens.filter((one) => one.arm === "negative");
console.log(`${positives.length} frames where the named eye was painted`
  + ` (${positives.filter((one) => one.named === "left").length} her left,`
  + ` ${positives.filter((one) => one.named === "right").length} her right)`);
console.log(`${negatives.length} frames where the OTHER eye was painted — the arm that must refuse`);
if (negatives.length === 0) throw new Error("no negative specimens: this court cannot fail, so it proves nothing");

const { captionRealization } = await import("../server/castingV2/realizationCaption.js");

let failed = 0;
const rows: Array<Record<string, unknown>> = [];
for (const specimen of specimens) {
  /* The ask exactly as the service words it — the value, not the sentence. */
  const asked = specimen.ask.replace("her ", "");
  const caption = await captionRealization({
    facet: "eye.colour" as never,
    bytes: readFileSync(specimen.file),
    contentType: "image/png",
    asked,
  });
  const corroborated = caption !== null;
  const wanted = specimen.arm === "positive";
  const ok = corroborated === wanted;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${specimen.arm.padEnd(8)} "${asked}"`
    + ` · painted ${specimen.named} (${specimen.ratio.toFixed(2)}x)`
    + ` · reader ${corroborated ? "corroborated" : "refused"}`
    + `${caption ? ` — "${caption.slice(0, 90)}"` : ""}`);
  rows.push({ ...specimen, corroborated, caption });
}

/*
  AND THE ARM THAT CANNOT BE ANSWERED WRONG.

  A reader asked to name a side gets it wrong in both directions, pinned prompt
  or not. So this arm never asks it to: the named eye is CUT out of the frame
  and the question is about that picture alone — no side word in the ask, no
  side word possible in the answer, and the only thing left to be right or wrong
  about is the colour.

  The cut comes from the PARENT's own per-side eye masks. Her eyes do not move
  between a master and its renders (her midline moves 0.3px across a chain,
  measured), so a box read once on the parent is the same box on every frame in
  this court.
*/
console.log("");
console.log("THE SAME SPECIMENS, ASKED ABOUT THE CUT INSTEAD OF THE FRAME");
const sharp = (await import("sharp")).default;
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
type Mask = { data: Buffer; width: number; height: number };
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! }) as unknown as {
  regionSides(input: { image: Buffer; name: string; absentIsAnswer?: boolean }):
  Promise<{ left: Mask; right: Mask } | null>;
};
const parentFile = "output/side-inference-court/parent.png";
const sides = await reader.regionSides({
  image: readFileSync(parentFile), name: "eyes", absentIsAnswer: true,
});
if (sides === null) throw new Error("the parent's eyes do not read — no boxes to cut with");
const boxOf = async (mask: Mask, frame: Buffer) => {
  let minX = mask.width, maxX = -1, minY = mask.height, maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! <= 127) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const meta = await sharp(frame).metadata();
  const scaleX = (meta.width ?? mask.width) / mask.width;
  const scaleY = (meta.height ?? mask.height) / mask.height;
  const pad = 12;
  return {
    left: Math.max(0, Math.round(minX * scaleX) - pad),
    top: Math.max(0, Math.round(minY * scaleY) - pad),
    width: Math.round((maxX - minX + 1) * scaleX) + pad * 2,
    height: Math.round((maxY - minY + 1) * scaleY) + pad * 2,
  };
};

let cutFailed = 0;
for (const specimen of specimens) {
  const frame = readFileSync(specimen.file);
  const box = await boxOf(specimen.named === "left" ? sides.left : sides.right, frame);
  const cut = await sharp(frame).extract(box).png().toBuffer();
  /* The ask WITHOUT its side word: the picture is the side. */
  const asked = specimen.ask.replace(/her (left|right) eye /, "");
  const caption = await captionRealization({
    facet: "eye.colour" as never, bytes: cut, contentType: "image/png", asked,
  });
  const corroborated = caption !== null;
  const wanted = specimen.arm === "positive";
  const ok = corroborated === wanted;
  if (!ok) cutFailed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${specimen.arm.padEnd(8)} "${asked}" on the ${specimen.named} eye's own cut`
    + ` · reader ${corroborated ? "corroborated" : "refused"}`
    + `${caption ? ` — "${caption.slice(0, 70)}"` : ""}`);
}
console.log(cutFailed === 0
  ? "the cut arm passed every specimen"
  : `${cutFailed} specimen(s) failed on the cut arm`);

console.log("");
const positivePassed = rows.filter((row) => row.arm === "positive" && row.corroborated === true).length;
const negativePassed = rows.filter((row) => row.arm === "negative" && row.corroborated === false).length;
console.log(`POSITIVE ${positivePassed}/${positives.length} corroborated a render that WAS what was asked`);
console.log(`NEGATIVE ${negativePassed}/${negatives.length} refused a render that painted the other eye`);
console.log(failed === 0 ? "all arms passed" : `${failed} arm(s) failed`);
process.exit(0);

/**
 * DOES A SHAPE-CLASS ASK GET CLIPPED AT HER CURRENT OUTLINE? (adapter finding A)
 *
 * D-218's silhouette law says a tight segmentation of an object as it IS is the
 * wrong destination for an edit that changes that object's OUTLINE: the engine
 * paints the larger shape, the mask clips it at the old boundary, and the new
 * rim sits inside the old rim's edges. `MatteRequest.changesSilhouette` encodes
 * the rule — and `requestMatte`, the function that enforces it, **has no
 * production call site anywhere.** The adapter reads regions straight off the
 * reader, so a non-distributed facet gets the raw current outline.
 *
 * Before adding a shape dimension to the zone-scope table, measure whether the
 * boundary-contact auto-expand ALREADY covers it — it is the ratified instrument
 * for exactly "destination allowance toward the described extent" (D-231), and a
 * second mechanism doing its job would be a mirror (law #4).
 *
 * Reads the answer three ways, because a coverage number alone cannot tell a
 * zone that grew enough from one that grew at all:
 *
 *   passes / zone growth   did the expansion fire, and how far
 *   the composite          are the fuller lips there, or clipped
 *   the difference view    where exactly does the change stop
 *
 *   npx tsx scripts/calibration/fuller-lips.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { coverage } from "../../server/castingV2/maskGeometry";
import { parseStrictArgsOrRefuse } from "../lib/strictArgs.mts";

const OUT = "output/masked/fuller-lips";
mkdirSync(OUT, { recursive: true });
const MASTER = "output/masked/specimens/chunky-02.png";
const master = readFileSync(MASTER);
const meta = await sharp(master).metadata();
const W = meta.width!, H = meta.height!;
console.log(`master ${W}x${H} — ${MASTER}\n`);

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

/* A shape change, deliberately large — the silhouette law is about outlines
   moving, and a subtle ask would not tell us whether the zone can hold one. */
const PROMPT = "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + "Give her noticeably fuller, plumper lips — both the upper and lower lip markedly "
  + "larger and more voluminous than they are now, extending beyond her current lip line. "
  + "Change nothing else about her face.";

/* The painted frame is kept, so a compositing change can be re-measured without
   varying the painter (the shrink fixture's lesson). */
let painted: { bytes: Buffer; contentType: string };
/**
 * THIS SCRIPT'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * A bare `includes("--repaint")` is the same class as the `indexOf` reader and
 * was invisible to the grep that defined #345's population: a mistyped
 * `--repaints` was discarded in silence and this arm re-bought its paint.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: [],
  boolean: ["repaint"],
});
if (ARGS.flag("repaint") || !existsSync(`${OUT}/painted.png`)) {
  const began = Date.now();
  const fresh = await engine.edit({
    prompt: PROMPT,
    references: [{ bytes: master, contentType: "image/png" }],
    width: W, height: H,
  });
  writeFileSync(`${OUT}/painted.png`, fresh.bytes);
  painted = { bytes: fresh.bytes, contentType: fresh.contentType };
  console.log(`painted in ${((Date.now() - began) / 1000).toFixed(1)}s`);
} else {
  painted = { bytes: readFileSync(`${OUT}/painted.png`), contentType: "image/png" };
  console.log("re-composited the STORED paint (--repaint for a fresh one)");
}

const composed = await harvestRefinement({
  master: { bytes: master, contentType: "image/png" },
  painted,
  facets: ["lips"],
  reader,
  userId: 1,
  explain: true,
});
writeFileSync(`${OUT}/composed.png`, composed.bytes);

const e = composed.explain!;
console.log(`\nzone as scoped    ${(coverage(e.zoneAsScoped) * 100).toFixed(3)}% of frame`);
console.log(`zone after expand ${(coverage(e.zone) * 100).toFixed(3)}% of frame`);
console.log(`growth            ${(coverage(e.zone) / Math.max(coverage(e.zoneAsScoped), 1e-9)).toFixed(2)}x`);
console.log(`delivered         ${(coverage(e.delivered) * 100).toFixed(3)}%`);

/* DOES THE PAINTER'S NEW LIP REACH PAST THE SCOPED ZONE? That is the question
   the silhouette law is about — not whether the zone grew, but whether the
   thing being asked for lay outside where we were willing to put it. */
const raw = async (b: Buffer) => sharp(b).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
const A = await raw(master), P = await raw(painted.bytes), C = await raw(composed.bytes);
let paintedOutside = 0, deliveredOutside = 0, clipped = 0;
for (let i = 0; i < W * H; i += 1) {
  const at = i * 3;
  const movedByPainter = (Math.abs(A[at] - P[at]) + Math.abs(A[at + 1] - P[at + 1]) + Math.abs(A[at + 2] - P[at + 2])) / 3 > 25;
  const movedByUs = (Math.abs(A[at] - C[at]) + Math.abs(A[at + 1] - C[at + 1]) + Math.abs(A[at + 2] - C[at + 2])) / 3 > 25;
  if (!e.zoneAsScoped.data[i] && movedByPainter) paintedOutside += 1;
  if (!e.zoneAsScoped.data[i] && movedByUs) deliveredOutside += 1;
  if (e.zone.data[i] && movedByPainter && !movedByUs) clipped += 1;
}
console.log(`\npainter moved OUTSIDE the scoped zone : ${paintedOutside} px`);
console.log(`we delivered OUTSIDE the scoped zone  : ${deliveredOutside} px`);
console.log(`inside the grown zone, painter moved and we did not: ${clipped} px`);

/* Look at it — the lip region at 100%, master | painted | composed | diff. */
const CROP = { left: Math.round(W * 0.30), top: Math.round(H * 0.30), width: Math.round(W * 0.40), height: Math.round(H * 0.22) };
const diff = Buffer.allocUnsafe(W * H * 3);
for (let i = 0; i < W * H; i += 1) {
  const at = i * 3;
  const d = (Math.abs(A[at] - C[at]) + Math.abs(A[at + 1] - C[at + 1]) + Math.abs(A[at + 2] - C[at + 2])) / 3;
  const v = Math.min(255, Math.round(d * 5));
  diff[at] = v; diff[at + 1] = v; diff[at + 2] = v;
}
const diffPng = await sharp(diff, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
const cells = await Promise.all([master, painted.bytes, composed.bytes, diffPng].map((b) =>
  sharp(b).resize(W, H, { fit: "fill" }).extract(CROP).png().toBuffer()));
await sharp({ create: { width: CROP.width * 4 + 36, height: CROP.height, channels: 3, background: "#0A0A0A" } })
  .composite(cells.map((input, i) => ({ input, left: i * (CROP.width + 12), top: 0 })))
  .png().toFile(`${OUT}/LIPS-100.png`);
console.log(`\nLIPS-100.png — master | painted | composed | difference x5, native resolution`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

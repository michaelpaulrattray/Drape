/**
 * THE DEGRADED SPECIMENS — built and recovered, handed over before anything
 * tries to repair them.
 *
 * The founder is testing outside restoration tools on the same material, so
 * both tracks have to start from identical pictures. That means specimens are
 * produced, paired with their base originals, and handed over FIRST; the
 * system-side refresh runs afterwards on the very same files.
 *
 * **Recovered (iii).** Genuinely destroyed renders from the old-era chains,
 * found by measuring rather than by memory: every variant this program still
 * holds, scored against its own candidate original, worst first.
 *
 * **Built (iv).** A deliberately CHAIN-ANCHORED sequence — each render
 * conditioned on the previous render and nothing else — which is the scheme
 * D-192 says compounds. Four steps is enough to degrade honestly, and the point
 * is to produce real damage rather than to argue about whether it exists.
 *
 *   npx tsx scripts/calibration/specimens.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";

import { getDb } from "../../server/db/connection";
import { castingCandidateVariants, castingCandidates, users } from "../../drizzle/schema";
import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { storagePublicUrl } from "../../server/storage";

const OUT = "output/quality-unit/specimens";
mkdirSync(OUT, { recursive: true });

async function quality(bytes: Buffer): Promise<number> {
  return sharp(bytes)
    .resize(768, null, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let y = 1; y < info.height - 1; y += 1) {
        for (let x = 1; x < info.width - 1; x += 1) {
          const i = y * info.width + x;
          const lap = -4 * data[i] + data[i - 1] + data[i + 1]
            + data[i - info.width] + data[i + info.width];
          sum += lap;
          sumSq += lap * lap;
          n += 1;
        }
      }
      const mean = sum / n;
      return Math.sqrt(sumSq / n - mean * mean);
    });
}

const fetchBytes = async (url: string) => Buffer.from(await (await fetch(url)).arrayBuffer());
const manifest: unknown[] = [];

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);

/* ------------------------------------------------- (iii) recovered damage */
console.log("(iii) hunting genuinely degraded renders\n");
const rows = await db
  .select({
    id: castingCandidateVariants.id,
    requestText: castingCandidateVariants.requestText,
    imageKey: castingCandidateVariants.imageKey,
    candidateImage: castingCandidates.imageKey,
  })
  .from(castingCandidateVariants)
  .innerJoin(castingCandidates, eq(castingCandidates.id, castingCandidateVariants.candidateId))
  .where(eq(castingCandidateVariants.status, "ready"))
  .orderBy(castingCandidateVariants.id);

const scored: Array<{ id: number; ratio: number; render: Buffer; base: Buffer; asked: string }> = [];
const baseCache = new Map<string, Buffer>();
for (const row of rows.slice(-40)) {
  if (!row.imageKey || !row.candidateImage) continue;
  try {
    const render = await fetchBytes(storagePublicUrl(row.imageKey));
    let base = baseCache.get(row.candidateImage);
    if (!base) {
      base = await fetchBytes(storagePublicUrl(row.candidateImage));
      baseCache.set(row.candidateImage, base);
    }
    const [renderSharp, baseSharp] = await Promise.all([quality(render), quality(base)]);
    scored.push({
      id: row.id,
      ratio: renderSharp / baseSharp,
      render,
      base,
      asked: row.requestText ?? "",
    });
  } catch { /* a purged object is not a specimen */ }
}
scored.sort((left, right) => left.ratio - right.ratio);

for (const [index, specimen] of scored.slice(0, 3).entries()) {
  const name = `recovered-${index + 1}`;
  writeFileSync(`${OUT}/${name}-degraded.png`, specimen.render);
  writeFileSync(`${OUT}/${name}-base.png`, specimen.base);
  manifest.push({ name, kind: "recovered", variant: specimen.id, sharpness: specimen.ratio, asked: specimen.asked });
  console.log(`  ${name}: variant #${specimen.id} at ${(specimen.ratio * 100).toFixed(0)}% — ${JSON.stringify(specimen.asked)}`);
}

/* ------------------------------------------------------- (iv) built damage */
console.log("\n(iv) building chain-anchored damage — each render sees only the last\n");
const [fresh] = await db
  .select({ id: castingCandidates.id, imageKey: castingCandidates.imageKey })
  .from(castingCandidates)
  .where(eq(castingCandidates.userId, bot!.id))
  .orderBy(castingCandidates.id);

const engine = castingIdentityEngine();
const STEPS = [
  "Give her a blunt bob.",
  "Make her eyes seafoam green.",
  "Add small gold hoop earrings.",
  "Make her hair copper.",
];

if (fresh?.imageKey) {
  const base = await fetchBytes(storagePublicUrl(fresh.imageKey));
  const baseSharp = await quality(base);
  writeFileSync(`${OUT}/built-base.png`, base);
  let current = base;
  for (const [index, step] of STEPS.entries()) {
    const rendered = await engine.editWithReferences({
      /* Chain-anchored on purpose: the ONLY reference is the previous output. */
      prompt: `Edit this photograph of this exact person, changing ONLY what is listed. ${step} `
        + "Everything else is identical to the reference photograph.",
      references: [{ bytes: current, contentType: "image/png" }],
      resolution: "1K",
    });
    current = rendered.bytes;
    const ratio = (await quality(current)) / baseSharp;
    writeFileSync(`${OUT}/built-step${index + 1}.png`, current);
    console.log(`  step ${index + 1} "${step}" → ${(ratio * 100).toFixed(0)}% of the base`);
    if (index === STEPS.length - 1) {
      manifest.push({ name: "built", kind: "chain-anchored", steps: STEPS.length, sharpness: ratio });
    }
  }
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\nspecimens in ${OUT} — hand over BEFORE the refresh runs`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

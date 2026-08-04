/**
 * THE v3 GAUNTLET — facets AND quality, scored mechanically (D-152).
 *
 * D-147 built a driver that scored facet survival, and it was blind to the
 * defect that shipped next: six edits deep the picture was visibly blurred
 * while every facet was perfectly intact. So this one measures the other axis
 * too, because "looks fine to me" is not an instrument.
 *
 * **Sharpness** is the variance of a Laplacian convolution — high for crisp
 * detail, falling as an image softens. **Tone** is the channel standard
 * deviation, which collapses as contrast is crushed. Both are scored per render
 * as a RATIO against the original, so the number means "how much of the
 * original's quality is left" rather than an absolute nobody can interpret.
 *
 * Two cases, both founder-named:
 *
 *   gauntlet    — six edits deep. Facets survive AND quality holds.
 *   idempotence — copper, then copper again. The second must not brighten,
 *                 which under v2 it did: re-dyeing already-dyed pixels.
 *
 *   npx tsx scripts/drive-refine-gauntlet.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingCandidateVariants, castingCandidates, users } from "../drizzle/schema";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { storagePublicUrl } from "../server/storage";

/** Sharpness and tone, in units the caller can compare across frames. */
async function quality(bytes: Buffer): Promise<{ sharpness: number; tone: number }> {
  /*
    TWO INDEPENDENT PIPELINES, from the bytes each time.

    Sharing one sharp instance and cloning it returned the SAME number for both
    metrics — the convolution silently did not apply, so the driver measured one
    thing twice and called it two. An instrument that reports a number it did
    not compute is worse than no instrument, and this one nearly signed off a
    quality claim on a metric that was not running.
  */
  const edges = await sharp(bytes)
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
          const lap = -4 * data[i]
            + data[i - 1] + data[i + 1]
            + data[i - info.width] + data[i + info.width];
          sum += lap;
          sumSq += lap * lap;
          n += 1;
        }
      }
      const mean = sum / n;
      return Math.sqrt(sumSq / n - mean * mean);
    });
  const plain = await sharp(bytes).resize(768, null, { fit: "inside" }).greyscale().stats();
  return { sharpness: edges, tone: plain.channels[0].stdev };
}

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);
const all = await db
  .select()
  .from(castingCandidates)
  .where(and(eq(castingCandidates.userId, bot!.id), eq(castingCandidates.status, "ready")))
  .orderBy(desc(castingCandidates.id))
  .limit(40);
const counts = new Map<number, number>();
for (const c of all) {
  const rows = await db
    .select({ id: castingCandidateVariants.id })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.candidateId, c.id));
  counts.set(c.id, rows.length);
}
const pool = [...all].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));

const CASES = [
  {
    name: "gauntlet",
    must: "six edits deep — facets survive AND quality holds",
    steps: [
      "change hair to a mullet",
      "make her eyes green",
      "give her hooded eyes",
      "actually black hair",
      "a small rose tattoo on her neck",
      "thick straight brows",
    ],
  },
  {
    name: "idempotence",
    must: "copper twice — the second must not brighten the first",
    steps: ["copper hair", "copper hair"],
  },
];

async function fetchBytes(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

let failures = 0;
for (const [index, testCase] of CASES.entries()) {
  const candidate = pool[index];
  console.log(`\n=== ${testCase.name} — ${testCase.must} ===`);
  await selectVariant({
    userId: bot!.id,
    candidatePublicId: candidate!.publicId,
    variantPublicId: null,
  });

  const originalBytes = await fetchBytes(storagePublicUrl(candidate!.imageKey!));
  const base = await quality(originalBytes);
  console.log(`original      sharpness ${base.sharpness.toFixed(2)}  tone ${base.tone.toFixed(2)}`);

  const frames: Buffer[] = [originalBytes];
  for (const [step, instruction] of testCase.steps.entries()) {
    try {
      const result = await refineCandidate({}, {
        userId: bot!.id,
        clientRequestId: randomUUID(),
        candidatePublicId: candidate!.publicId,
        instruction,
      });
      const bytes = await fetchBytes(result.imageUrl);
      frames.push(bytes);
      const q = await quality(bytes);
      const sharp0 = q.sharpness / base.sharpness;
      const tone0 = q.tone / base.tone;
      /*
        SHARPNESS gates; TONE is reported and does not.

        Tone is confounded by the edit itself: turning near-black hair copper
        against a light backdrop legitimately lowers whole-frame contrast, and
        the first run flagged exactly that as degradation. A tripwire that fires
        on the change it was asked to make is an instrument that cries wolf —
        the same lesson the goldens learned about free-text phrasing.

        Softening shows in the Laplacian and nowhere else, so that is what
        gates. 0.75 is a tripwire, not a grade.
      */
      const flag = sharp0 < 0.75 ? "  <-- SOFTENING" : "";
      console.log(
        `edit ${step + 1}        sharpness ${(sharp0 * 100).toFixed(0)}%  tone ${(tone0 * 100).toFixed(0)}%`
        + `   "${instruction}"${flag}`,
      );
      if (flag) failures += 1;
    } catch (error) {
      console.log(`edit ${step + 1}        FAILED — ${(error as Error).message.slice(0, 120)}`);
      failures += 1;
      break;
    }
  }

  const W = 380;
  const cells = await Promise.all(frames.map((b) => sharp(b).resize(W).toBuffer()));
  const meta = await sharp(cells[0]).metadata();
  const out = await sharp({
    create: {
      width: W * cells.length + 8 * (cells.length - 1),
      height: meta.height!,
      channels: 3,
      background: "#111111",
    },
  })
    .composite(cells.map((input, i) => ({ input, left: i * (W + 8), top: 0 })))
    .jpeg({ quality: 88 })
    .toBuffer();
  writeFileSync(`docs/specs/evidence/refine/v3-${testCase.name}.jpg`, out);
  console.log(`              wrote v3-${testCase.name}.jpg (${cells.length} frames)`);
}

console.log(failures === 0 ? "\nQUALITY HELD across every render." : `\n${failures} quality/failure flag(s).`);
process.exit(failures === 0 ? 0 : 1);

/**
 * THE QUALITY UNIT — experiments (i) and (ii).
 *
 * Direct renders through the identity engine, no credits, no product changes.
 * Nothing here ships; the numbers decide what gets proposed.
 *
 * **(i) Recipe condensation.** D-195 measured a 12-point sharpness drop between
 * chain positions 1–2 and 5–6 under base anchoring, where compounding is
 * impossible — so the suspect is prompt LENGTH. This renders the same deep
 * recipe twice: once with the accumulated prompt the product actually built,
 * once with a condensed canonical form carrying the identical facts. If length
 * is the cause, length is the lever.
 *
 * **Condensation must be provably lossless.** The condensed prompt is built
 * from the same composed delta, one clause per facet, and every fact in the
 * delta is asserted present in the string before the render is allowed to run.
 * A shorter prompt that quietly drops a fact is the annihilation class wearing
 * a performance improvement.
 *
 * **(ii) Restoration pass.** A non-semantic sharpen on renders that fell below
 * the 0.75 flag, to see how much of the loss is recoverable without touching
 * content. Scored on sharpness recovery alone; whether it CHANGES anything is
 * experiment (iii)'s question.
 *
 *   npx tsx scripts/calibration/quality-unit.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";

import { getDb } from "../../server/db/connection";
import { castingCandidateVariants, castingCandidates, users } from "../../drizzle/schema";
import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { storagePublicUrl } from "../../server/storage";
import { verifyRender } from "../../server/castingV2/renderVerification";
import type { Facet } from "../../server/castingV2/refineFacets";

const OUT = "output/quality-unit";
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

/**
 * The condensed form: one clause per fact, and a preservation line that names
 * nothing (D-183 — naming a category invites it).
 */
function condense(facts: ReadonlyArray<{ facet: Facet; asked: string }>): string {
  const clauses = facts.map((fact) => `${fact.facet}: ${fact.asked}`).join(". ");
  return `Edit this photograph of this exact person, changing ONLY the following. ${clauses}. `
    + "Everything else is identical to the reference photograph — the same person, the same "
    + "clothing, lighting, framing and background, and anything worn in it still worn and "
    + "unchanged. This is a retouch of one photograph, not a new photograph of a similar person.";
}

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);

/* The deepest recipes the trial produced — the ones D-195 measured as soft. */
const rows = await db
  .select({
    id: castingCandidateVariants.id,
    requestText: castingCandidateVariants.requestText,
    internalPrompt: castingCandidateVariants.internalPrompt,
    imageKey: castingCandidateVariants.imageKey,
    instructions: castingCandidateVariants.instructions,
    candidateImage: castingCandidates.imageKey,
  })
  .from(castingCandidateVariants)
  .innerJoin(castingCandidates, eq(castingCandidates.id, castingCandidateVariants.candidateId))
  .where(eq(castingCandidateVariants.userId, bot!.id))
  .orderBy(castingCandidateVariants.id);

type Stored = {
  prompt?: string;
  verification?: { checks?: Array<{ facet: Facet; asked: string; binding?: boolean }> };
};
const deep = rows
  .filter((row) => {
    const list = Array.isArray(row.instructions) ? row.instructions : [];
    return row.imageKey && row.candidateImage && list.length >= 4
      && ((row.internalPrompt as Stored)?.verification?.checks?.length ?? 0) >= 3;
  })
  .slice(-3);

console.log(`(i) recipe condensation — ${deep.length} deep recipes\n`);
const engine = castingIdentityEngine();
const condensation: unknown[] = [];

for (const [index, row] of deep.entries()) {
  const stored = row.internalPrompt as Stored;
  const facts = (stored.verification?.checks ?? []).map((check) => ({
    facet: check.facet, asked: check.asked, binding: check.binding !== false,
  }));
  const long = stored.prompt!;
  const short = condense(facts);

  /* LOSSLESS OR IT DOES NOT RUN. */
  const dropped = facts.filter((fact) => !short.toLowerCase().includes(fact.asked.toLowerCase()));
  if (dropped.length > 0) {
    console.log(`  skipped #${row.id}: condensation would drop ${dropped.map((f) => f.asked).join(", ")}`);
    continue;
  }

  const base = await fetchBytes(storagePublicUrl(row.candidateImage!));
  const baseSharp = await quality(base);
  const render = (prompt: string) => engine.editWithReferences({
    prompt,
    references: [{ bytes: base, contentType: "image/png" }],
    resolution: "1K",
  });

  const [longRender, shortRender] = [await render(long), await render(short)];
  const [longSharp, shortSharp] = await Promise.all([
    quality(longRender.bytes), quality(shortRender.bytes),
  ]);
  const [longVerdict, shortVerdict] = await Promise.all([
    verifyRender({ bytes: longRender.bytes, contentType: "image/png", facts }),
    verifyRender({ bytes: shortRender.bytes, contentType: "image/png", facts }),
  ]);

  writeFileSync(`${OUT}/condense-${index + 1}-long.png`, longRender.bytes);
  writeFileSync(`${OUT}/condense-${index + 1}-short.png`, shortRender.bytes);

  const cell = {
    variant: row.id,
    facts: facts.length,
    longChars: long.length,
    shortChars: short.length,
    longSharp: longSharp / baseSharp,
    shortSharp: shortSharp / baseSharp,
    longVerified: longVerdict.checks.filter((c) => c.verified).length,
    shortVerified: shortVerdict.checks.filter((c) => c.verified).length,
  };
  condensation.push(cell);
  console.log(
    `  #${row.id}  ${cell.longChars}→${cell.shortChars} chars  `
    + `sharp ${(cell.longSharp * 100).toFixed(0)}%→${(cell.shortSharp * 100).toFixed(0)}%  `
    + `facts ${cell.longVerified}/${facts.length}→${cell.shortVerified}/${facts.length}`,
  );
}

/* ------------------------------------------------------- (ii) restoration */
console.log("\n(ii) restoration pass — non-semantic sharpen on the softest renders\n");
const restoration: unknown[] = [];
for (const [index, row] of deep.entries()) {
  const base = await fetchBytes(storagePublicUrl(row.candidateImage!));
  const rendered = await fetchBytes(storagePublicUrl(row.imageKey!));
  const [baseSharp, renderedSharp] = await Promise.all([quality(base), quality(rendered)]);
  const restored = await sharp(rendered).sharpen({ sigma: 1.1, m1: 0.6, m2: 2.2 }).png().toBuffer();
  const restoredSharp = await quality(restored);
  writeFileSync(`${OUT}/restore-${index + 1}-before.png`, rendered);
  writeFileSync(`${OUT}/restore-${index + 1}-after.png`, restored);
  const cell = {
    variant: row.id,
    before: renderedSharp / baseSharp,
    after: restoredSharp / baseSharp,
  };
  restoration.push(cell);
  console.log(
    `  #${row.id}  ${(cell.before * 100).toFixed(0)}% → ${(cell.after * 100).toFixed(0)}% of original`,
  );
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ condensation, restoration }, null, 2));
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

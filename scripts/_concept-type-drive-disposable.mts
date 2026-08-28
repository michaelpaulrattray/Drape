/**
 * #185 — THE ACCEPTANCE DRIVE for his ruling: A TYPE, NOT AN INVENTORY.
 *
 * His success test, verbatim: *"two different uploads of two different men
 * should come back as two different types."* A unit suite dictates every reply
 * and therefore cannot answer it — this drives the SHIPPED reader on real
 * delivered frames and prints what came back, with the frames written out so
 * they can be put beside the words by an eye (law 9: the reader is a pointer,
 * never the verdict).
 *
 * It reports three things and judges none of them by itself:
 *   1. LENGTH — his ~150–250 against what actually lands.
 *   2. THE WORDS — printed whole, for reading.
 *   3. A DISTINCTNESS POINTER — the content words two reads share. It is a
 *      pointer and not a verdict: two men of the same type SHOULD share words
 *      ("man", "forties", "athletic"), so a high overlap is a prompt to look
 *      rather than a failure.
 *
 * NEGATIVE CONTROL: a blank field. A reader that describes a person in
 * everything has not read anything, and its positive answers mean less.
 *
 * House money — one text call per frame, cents. No credits, no renders, no
 * rows, no writes to anything but `output/`.
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import sharp from "sharp";

import { getDb } from "../server/db/connection";
import { castingCandidates } from "../drizzle/schema";
import { storageReadBytes } from "../server/storage";
import {
  CONCEPT_DESCRIPTION_TARGET,
  CONCEPT_DESCRIPTION_MAX,
  describeConcept,
} from "../server/castingV2/conceptDescribe";

const OUT = "output/_shift185-type/concept-drive";
mkdirSync(OUT, { recursive: true });

const db = await getDb();
if (!db) throw new Error("no DATABASE_URL");

const frames = await db
  .select({ publicId: castingCandidates.publicId, imageKey: castingCandidates.imageKey, rollId: castingCandidates.rollId })
  .from(castingCandidates)
  .where(and(eq(castingCandidates.status, "ready"), isNotNull(castingCandidates.imageKey)))
  .orderBy(desc(castingCandidates.id))
  .limit(200);

/*
  ONE FRAME PER ROLL. Eight tiles of one sheet are one brief wearing eight
  hats — they would share a type by construction, and a distinctness reading
  taken over them would be measuring the sheet rather than the reader.
*/
const seen = new Set<number>();
const picked = frames.filter((f) => {
  if (seen.has(f.rollId)) return false;
  seen.add(f.rollId);
  return true;
}).slice(0, 4);

const STOP = new Set([
  "a", "an", "and", "the", "with", "in", "of", "his", "her", "their", "he", "she",
  "is", "to", "or", "at", "on", "type", "build", "hair", "heritage",
]);
const words = (text: string) =>
  new Set(text.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

const reads: { id: string; description: string }[] = [];

for (const [n, frame] of picked.entries()) {
  const source = await storageReadBytes(frame.imageKey!);
  const meta = await sharp(source.bytes).metadata();
  const file = `${OUT}/subject-${n + 1}.png`;
  writeFileSync(file, source.bytes);
  const started = Date.now();
  const outcome = await describeConcept({ bytes: source.bytes, contentType: `image/${meta.format}` });
  console.log(`\n=== SUBJECT ${n + 1} — ${frame.publicId} (roll ${frame.rollId}, ${meta.width}x${meta.height})`);
  console.log(`    frame: ${file}   [${Date.now() - started} ms]`);
  if (!outcome.ok) {
    console.log(`    REFUSED: ${outcome.reason} after ${outcome.attempts} attempt(s)`);
    continue;
  }
  const length = outcome.description.length;
  const verdict = length > CONCEPT_DESCRIPTION_MAX
    ? "OVER THE CEILING"
    : length < CONCEPT_DESCRIPTION_TARGET.low
      ? "under his target"
      : length > CONCEPT_DESCRIPTION_TARGET.high
        ? "over his target, inside the ceiling"
        : "inside his target";
  console.log(`    ${length} chars (${verdict}) · attempts ${outcome.attempts}`);
  console.log(`    "${outcome.description}"`);
  reads.push({ id: frame.publicId, description: outcome.description });
}

console.log("\n=== DISTINCTNESS — the content words each PAIR shares (a pointer, not a verdict)");
for (let i = 0; i < reads.length; i += 1) {
  for (let j = i + 1; j < reads.length; j += 1) {
    const a = words(reads[i]!.description);
    const b = words(reads[j]!.description);
    const shared = [...a].filter((w) => b.has(w));
    const jaccard = shared.length / new Set([...a, ...b]).size;
    console.log(`  ${i + 1} vs ${j + 1}: ${(jaccard * 100).toFixed(0)}% shared — ${shared.join(", ") || "(nothing)"}`);
  }
}

const blank = await sharp({
  create: { width: 768, height: 1024, channels: 3, background: { r: 210, g: 205, b: 198 } },
}).png().toBuffer();
writeFileSync(`${OUT}/negative-control.png`, blank);
const control = await describeConcept({ bytes: blank, contentType: "image/png" });
console.log("\n=== NEGATIVE CONTROL — a blank field, nobody in it");
console.log(JSON.stringify(control));
console.log(
  control.ok
    ? "  ⚠ THE READER DESCRIBED A PERSON WHO IS NOT THERE — its positive answers mean less"
    : "  CONTROL OK — the reader can say there is nobody here",
);

/* A script ends by ending the process — the pool and the S3 client hold the loop open. */
process.exit(0);

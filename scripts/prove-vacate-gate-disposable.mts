/**
 * CAN THE REMOVAL GATE EVER PASS? — the instrument behind three paid refusals,
 * driven directly on frames whose answers are already known (working law 2).
 *
 * `refineService` adjudicates a removal before the picture lands:
 *
 *   const still = await reader.region({ image, name, absentIsAnswer: true });
 *   if (still !== null) → "the removal did not land" → refuse and refund
 *
 * and the comment above it says *"Nothing found means the thing is not there …
 * a refusal to answer would arrive as null"*. `RegionReader.region` is declared
 * `Promise<Mask>` and `falRegionReader` answers "nothing found" with
 * `emptyLike()` — a frame-sized mask of zeros. **Never null.** If that reading
 * of the code is right, the gate refuses every removal that ever reaches it, no
 * matter what the painter delivered, and the paid path's 0-of-3 against a bench
 * of 24-of-24 is not a coincidence at all.
 *
 * A claim about a function is not a fact until the function says it, so:
 *
 *   NEGATIVE  a frame the bench certified as having NO glasses
 *             → the mask must come back non-null and EMPTY (the gate refuses)
 *   POSITIVE  her master, plainly wearing them
 *             → the mask must come back non-null and covered (the gate refuses)
 *
 * Both arms make the gate refuse; only the second one should. Coverage is
 * printed as a fraction of the frame beside `GLASSES_COVERAGE_FLOOR`, the floor
 * measured on 23 bare and 8 bespectacled faces — the number a repaired gate
 * would compare against.
 *
 * No credits: two segmentation calls over frames already on disk and in R2.
 *
 *   npx tsx scripts/prove-vacate-gate-disposable.mts
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { GLASSES_COVERAGE_FLOOR } from "../server/castingV2/canthalTilt";
import { binaryCoverage } from "../server/castingV2/maskGeometry";
import { slotDefinition } from "../server/castingV2/referenceSlotCatalogue";
import { storageReadBytes } from "../server/storage";

const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
/** Certified "bare eyes, no glasses or frames visible" by the product's own
 *  reader on shift 63, and looked at on the contact sheet the same night. */
const REMOVED = process.env.REMOVED ?? "output/shift63-removal-class/43ac4560-01-removed.png";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const where = new URL((process.env[key] ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: ${key} → ${where.hostname}:${where.port}`);
const connection = await openDatabase(process.env[key]!);
const [faces] = await connection.query<any[]>(
  "SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
);
const face = faces[0];
await connection.end();

/** The gate asks the slot's own question, so this asks exactly that. */
const question = slotDefinition("glasses" as any)?.question;
console.log(`the gate's question for the glasses slot: "${question}"`);

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY ?? "" });

const arms = [
  { label: "NEGATIVE — the bench's removed frame, no glasses on her", bytes: await readFile(REMOVED), wants: "the gate should PASS this one" },
  { label: "POSITIVE — her master, wearing them", bytes: (await storageReadBytes(face.imageKey)).bytes, wants: "the gate should refuse this one" },
];

let bothRefused = true;
for (const arm of arms) {
  let mask: any = null;
  let threw: string | null = null;
  try {
    mask = await reader.region({ image: arm.bytes, name: question!, absentIsAnswer: true });
  } catch (error) {
    threw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  const coverage = mask ? binaryCoverage(mask) : null;
  /* THE GATE'S OWN COMPARISON, run here rather than described. */
  const gateRefuses = threw === null && mask !== null;
  if (!gateRefuses) bothRefused = false;
  console.log(`\n${arm.label}`);
  console.log(`  ${arm.wants}`);
  console.log(`  returned: ${threw ?? (mask === null ? "null" : `a ${mask.width}×${mask.height} mask`)}`);
  console.log(`  coverage: ${coverage === null ? "—" : `${(coverage * 100).toFixed(4)}% of the frame`}`
    + `   (floor ${(GLASSES_COVERAGE_FLOOR * 100).toFixed(1)}% → a repaired gate would say ${coverage === null ? "—" : coverage > GLASSES_COVERAGE_FLOOR ? "STILL THERE" : "GONE"})`);
  console.log(`  today's gate (\`still !== null\`): ${gateRefuses ? "REFUSES — 'the removal did not land'" : "passes"}`);
}

console.log(`\n${"=".repeat(96)}`);
console.log(bothRefused
  ? "THE GATE CANNOT PASS. Both arms refuse — the frame with her glasses on and the frame without them —\n"
    + "because `region` never returns null. Every removal that reaches this gate is refused and refunded,\n"
    + "and the coverage numbers above are the reading the gate never takes."
  : "Not the predicted shape — read the numbers above before concluding anything.");
console.log("=".repeat(96));
process.exit(0);

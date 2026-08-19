/**
 * THE SINGLE-VIEW ARM COURT, ARMS A AND C TAKEN TO n=5 — and the extension is
 * declared here rather than implied by the numbers.
 *
 * The first sitting bought A (the armLeft blank, words "her left") 3/3 correct
 * and C (the armRight blank, words "her right") 0/2 — wrong arm both times,
 * with the artwork mirrored on the plate itself. TWO REASONS TO BUY MORE, and
 * both are about not letting a small n decide something expensive:
 *
 *  - A's reading is the RISKY direction. "The left road works" is the sentence
 *    that would release a tuple to customers, and three renders is a thin
 *    thing to release on.
 *  - C's reading contradicts the simple rule the earlier sitting suggested
 *    (that the plate's picture decides): B and C carry the SAME limb anatomy
 *    and landed on opposite arms. More n cannot name the mechanism, but it can
 *    tell an 0/2 that is a defect from an 0/2 that is a coin.
 *
 * The extension can only give the adverse finding more chances to be
 * OVERTURNED — every added render is another opportunity for the right road to
 * land correctly — and the full sequence is reported either way.
 *
 * INTERLEAVED a,c,a,c,c in ONE process, because the two arms are being compared
 * and a drifting engine must redden both rather than one (the same reason the
 * first sitting interleaved).
 *
 *   npx tsx scripts/court-single-view-arm-extend-disposable.mts
 */
process.env.CASTING_INK_STUDIO_SCOPE = "users:1";

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { carriedInkPlates } from "../server/castingV2/signService";
import { inkViewReferenceClause } from "../server/castingV2/inkViewReferences";
import { composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { castingIdentityEngine } from "../server/castingV2/signEngine";
import { storageReadBytes } from "../server/storage";
import { getDb } from "../server/db/connection";
import { castingCandidates } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const OUT = path.resolve("output/single-view-arm-court");
await mkdir(OUT, { recursive: true });
const USER_ID = 1;
const CANDIDATE_PUBLIC_ID = "7cb9c7a4-7954-4106-8b20-61f7ca4de292";
const LEFT_DESIGN = "a21f6298-2e9a-437c-91f2-0752767937c1";
const RIGHT_DESIGN = "25d39a91-3b3a-43a7-a269-e026f02f22af";

const db = await getDb();
if (!db) throw new Error("no database");
const [candidate] = await db.select({ id: castingCandidates.id, imageKey: castingCandidates.imageKey })
  .from(castingCandidates).where(eq(castingCandidates.publicId, CANDIDATE_PUBLIC_ID));
if (!candidate?.imageKey) throw new Error("the court's candidate has no master image");

const { plates } = await carriedInkPlates({} as never, {
  userId: USER_ID, candidateId: candidate.id, operationId: "court-single-view-arm-extend",
});
const pick = (designPublicId: string, side: "left" | "right") => {
  const plate = plates.find((one) => one.designPublicId === designPublicId);
  if (!plate) throw new Error(`the loader did not carry ${designPublicId}`);
  /* Assert at the wire: the plate this render actually carries is the side the
     arm claims, read off the loaded row and never off the variable name. */
  if (plate.placement !== "upperArm" || plate.side !== side) {
    throw new Error(`${designPublicId} is ${plate.placement}/${plate.side}, not upperArm/${side}`);
  }
  return plate;
};
const left = pick(LEFT_DESIGN, "left");
const right = pick(RIGHT_DESIGN, "right");

const anchor = await storageReadBytes(candidate.imageKey);
const engine = castingIdentityEngine();

const RUNS = [
  { label: "a4", plate: left, arm: "A-left" },
  { label: "c3", plate: right, arm: "C-right" },
  { label: "a5", plate: left, arm: "A-left" },
  { label: "c4", plate: right, arm: "C-right" },
  { label: "c5", plate: right, arm: "C-right" },
] as const;

for (const run of RUNS) {
  const clause = inkViewReferenceClause({ plates: [run.plate], firstOrdinal: 2 });
  const image = await engine.generateView({
    prompt: `${composePackageViewPrompt("frontFull")}\n${clause}`,
    references: [
      { bytes: anchor.bytes, contentType: anchor.contentType },
      { bytes: run.plate.bytes, contentType: run.plate.contentType },
    ],
    resolution: "2K",
    viewAngle: "frontFull",
  });
  const file = path.join(OUT, `ext-${run.label}-${run.arm}.png`);
  await writeFile(file, image.bytes);
  await sharp(image.bytes).resize({ width: 1000 }).jpeg({ quality: 86 })
    .toFile(path.join(OUT, `ext-${run.label}-${run.arm}-small.jpg`));
  console.log(`${run.label} (${run.arm}, declared ${run.plate.side}) → ${file}`);
}
process.exit(0);

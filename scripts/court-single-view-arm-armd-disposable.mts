/**
 * ARM D — THE RIGHT ROAD ON A CLEAN PLATE, and it exists because arm C had a
 * confound I could not see until a second plate was minted.
 *
 * Arm C's five renders all carried ONE plate, and that plate came back from the
 * mint with the customer's artwork MIRRORED (crescent opening the wrong way
 * against the specimen). A second right-side mint of the same design came back
 * correct — so the mirroring is a flake in the mint rather than a property of
 * the right blank, and arm C's 0/5 was bought entirely on the defective one.
 *
 * "The right-arm road puts the tattoo on the wrong arm" and "the right-arm road
 * sometimes mirrors the artwork" are two different findings, and arm C cannot
 * tell them apart: a plate whose artwork is backwards is exactly the kind of
 * picture that might confuse the placement too.
 *
 * So: the same clause, the same anchor, the same everything, on the CLEAN right
 * plate. n=3. If the ink still lands on her left arm, the placement finding
 * survives the confound. If it lands correctly, arm C measured the flake.
 *
 *   npx tsx scripts/court-single-view-arm-armd-disposable.mts
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
const CLEAN_RIGHT_DESIGN = "9749175a-74c0-47b2-a91f-2a60dd7ae626";

const db = await getDb();
if (!db) throw new Error("no database");
const [candidate] = await db.select({ id: castingCandidates.id, imageKey: castingCandidates.imageKey })
  .from(castingCandidates).where(eq(castingCandidates.publicId, CANDIDATE_PUBLIC_ID));
if (!candidate?.imageKey) throw new Error("the court's candidate has no master image");

const { plates } = await carriedInkPlates({} as never, {
  userId: USER_ID, candidateId: candidate.id, operationId: "court-single-view-arm-d",
});
const plate = plates.find((one) => one.designPublicId === CLEAN_RIGHT_DESIGN);
if (!plate) throw new Error("the loader did not carry the clean right plate");
if (plate.placement !== "upperArm" || plate.side !== "right") {
  throw new Error(`the clean plate is ${plate.placement}/${plate.side}, not upperArm/right`);
}

const anchor = await storageReadBytes(candidate.imageKey);
const engine = castingIdentityEngine();
const clause = inkViewReferenceClause({ plates: [plate], firstOrdinal: 2 });
console.log("the sentence:", clause.split("\n")[1]?.slice(0, 140));

for (const label of ["d1", "d2", "d3"]) {
  const image = await engine.generateView({
    prompt: `${composePackageViewPrompt("frontFull")}\n${clause}`,
    references: [
      { bytes: anchor.bytes, contentType: anchor.contentType },
      { bytes: plate.bytes, contentType: plate.contentType },
    ],
    resolution: "2K",
    viewAngle: "frontFull",
  });
  const file = path.join(OUT, `ext-${label}-D-right-clean.png`);
  await writeFile(file, image.bytes);
  await sharp(image.bytes).resize({ width: 1000 }).jpeg({ quality: 86 })
    .toFile(path.join(OUT, `ext-${label}-D-right-clean-small.jpg`));
  console.log(`${label} → ${file}`);
}
process.exit(0);

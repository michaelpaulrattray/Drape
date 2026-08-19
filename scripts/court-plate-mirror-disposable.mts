/**
 * CANDIDATE (a) — DOES THE PICTURE DECIDE THE SIDE? (ordered fable-1007 §2)
 *
 * The sentence does not decide: five renders, three different claims — two of
 * them with the positional clause pointing the opposite way — put the tattoo on
 * the image's LEFT arm every time (opus-742 §2). So the remaining hypothesis is
 * that the engine is following the PICTURE: the plate's own tattooed limb sits
 * on the left of the plate, and the ink lands on the left of the photograph.
 *
 * The test is free of any wording change and cannot be answered wrong: the SAME
 * claim, the SAME everything, and the plate bytes MIRRORED. If the ink moves to
 * the image's right, the carrier law arrives on one more lane and the durable
 * fix is already drawn (the mint selects the blank by the design's declared
 * side, fable-1007 §2).
 *
 * TWO ARMS IN ONE SITTING, interleaved, because the baseline was bought two
 * hours ago on a different sitting: a control that is not re-read beside the
 * treatment cannot tell a moved engine from a moved picture.
 */
process.env.CASTING_INK_STUDIO_SCOPE = "users:1";

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { inkViewReferenceClause } from "../server/castingV2/inkViewReferences";
import { composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { castingIdentityEngine } from "../server/castingV2/signEngine";
import { carriedInkPlates } from "../server/castingV2/signService";
import { storageReadBytes } from "../server/storage";
import { getDb } from "../server/db/connection";
import { castingCandidates } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { assertOneWorld } from "./lib/worldGuard.mts";

/*
  THE WORLD, DECLARED — added when this file was promoted into the repository
  (2026-08-19) because standing design notes cite it by name as the evidence
  behind the arm-side routing, and a cited instrument that is not in the tree is
  a dangling citation. The promotion is what put it in `scriptWorldGuard`'s
  scope, and the suite said so before the commit landed.

  Inert locally, and it refuses a half-production process under `railway run`:
  this court reads a real candidate's master and spends real provider calls, so
  running it against the wrong world would buy renders from the wrong faces.
*/
assertOneWorld(["DATABASE_URL"]);

const OUT = path.resolve("output/view-reference-court");
await mkdir(OUT, { recursive: true });
const db = await getDb();
if (!db) throw new Error("no database");
const [candidate] = await db.select({ id: castingCandidates.id, imageKey: castingCandidates.imageKey })
  .from(castingCandidates).where(eq(castingCandidates.publicId, "7cb9c7a4-7954-4106-8b20-61f7ca4de292"));
if (!candidate?.imageKey) throw new Error("no master");

const { plates } = await carriedInkPlates({} as never, {
  userId: 1, candidateId: candidate.id, operationId: "court-plate-mirror",
});
const arm = plates.find((plate) => plate.placement === "upperArm");
if (!arm) throw new Error("no upper-arm plate");

/* The design's OWN declared side, unmodified, on BOTH arms — the claim is the
   thing held still here, so it is never overridden. */
console.log(`the design declares side=${arm.side}, placement=${arm.placement}`);
const clause = inkViewReferenceClause({ plates: [arm], firstOrdinal: 2 });
console.log("the sentence:", clause.split("\n")[1]?.slice(0, 150));

const mirrored = await sharp(arm.bytes).flop().png().toBuffer();
await writeFile(path.join(OUT, "plate-upper-arm-mirrored.png"), mirrored);
console.log(`plate as-is ${arm.bytes.length} B · mirrored ${mirrored.length} B`);

const anchor = await storageReadBytes(candidate.imageKey);
const engine = castingIdentityEngine();
const prompt = `${composePackageViewPrompt("frontFull")}\n${clause}`;

/* Interleaved so a drifting engine reddens both arms rather than one. */
const RUNS = [
  { label: "m1", plate: mirrored, kind: "MIRRORED" },
  { label: "c1", plate: arm.bytes, kind: "as-is" },
  { label: "m2", plate: mirrored, kind: "MIRRORED" },
  { label: "c2", plate: arm.bytes, kind: "as-is" },
  { label: "m3", plate: mirrored, kind: "MIRRORED" },
] as const;

for (const run of RUNS) {
  const image = await engine.generateView({
    prompt,
    references: [
      { bytes: anchor.bytes, contentType: anchor.contentType },
      { bytes: run.plate as Buffer, contentType: run.plate === mirrored ? "image/png" : arm.contentType },
    ],
    resolution: "2K",
    viewAngle: "frontFull",
  });
  const file = path.join(OUT, `r5-${run.label}-${run.kind === "MIRRORED" ? "mirrored" : "asis"}.png`);
  await writeFile(file, image.bytes);
  console.log(`${run.label} (${run.kind}) → ${file}`);
}
process.exit(0);

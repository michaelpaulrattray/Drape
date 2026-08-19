/**
 * THE VIEW-REFERENCE CONFORMANCE COURT — three arms, and one of them must SHOW
 * (ordered fable-871 §3, shaped fable-1004 §2, scheduled fable-1005 §3).
 *
 * # What is on trial
 *
 * Not whether the plate rides — that is asserted at the wire in the suite. What
 * no test can answer is what the ENGINE does with it: handed a picture of a
 * tattoo on a grey mannequin form beside her anchor, does it put the artwork on
 * her skin where the clause says, and does it keep it OFF the frames that cannot
 * show that surface?
 *
 * # The arms, and why a bleed-only court would have been worthless
 *
 *   frontFull   upper-chest design   MUST SHOW      the positive arm
 *   backFull    upper-chest design   MUST NOT       bleed onto her back
 *   closeUp     upper-chest design   MUST NOT       bleed onto a face crop
 *
 * The positive arm is fable-1004 §2's amendment and it is the whole reason this
 * court can fail honestly: a build that never painted the tattoo ANYWHERE would
 * pass a bleed-only court clean, and the banked rule says a negative arm cannot
 * find YES-defects.
 *
 * # THE POSITIVE ARM'S BAR MOVED, AND ITS SPECIMEN HAS TO MOVE WITH IT
 *
 * **Ruled by the founder 2026-08-19 (fable-1081 §2, §4).** The crew neck stays
 * a crew neck, the wardrobe is never altered for a tattoo, and a covered design
 * shows *"poking out the top of the shirt … but thats the extent for now"*.
 *
 * So *"MUST SHOW the tattoo on her upper chest"* is **no longer the promise**,
 * and a court still holding that bar would fail a build that was obeying its
 * own ruling — or, worse, pass one that opened her collar to satisfy it. The
 * honest bar is **the visible extent**: whatever the collar leaves bare, and
 * nothing more.
 *
 * **Which convicts this court's own specimen.** `DESIGN_FILE` is a chest piece
 * with no neck continuation, so under the ruling its correct rendering in
 * `frontFull` is NOTHING VISIBLE — and a court whose three arms are all
 * MUST-NOT cannot find a YES-defect, which is the exact hole fable-1004 §2 was
 * amended to close. **This court therefore does not run again until its
 * positive arm carries a design that reaches bare skin**: a chest piece that
 * runs up onto the neck (the poke is the bar, and it is his own example), or
 * the upper-arm design, which is already the road's measured visible case.
 *
 * The arms below say so where they are read rather than only here, and the
 * script REFUSES to spend rather than rendering against a bar that no longer
 * matches the promise.
 *
 * # House money, declared
 *
 * One design upload (which mints its own plate, ~$0.15) and three 2K identity
 * renders. Ceiling $2. No customer credits, no ledger row, dev database only.
 *
 * # The scope flip is dev-only and in-process
 *
 * `CASTING_INK_STUDIO_SCOPE` is set on this process before the modules that read
 * it are imported. Nothing is written to a deployment, and production has no
 * plates at all — which is what makes running this AFTER the ship honest rather
 * than reckless.
 *
 *   npx tsx scripts/court-view-reference-disposable.mts
 */
process.env.CASTING_INK_STUDIO_SCOPE = "users:1";

import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { uploadInkDesign } from "../server/castingV2/inkUploadService";
import { inkViewReferenceClause, type CarriedInkPlate } from "../server/castingV2/inkViewReferences";
import { composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { castingIdentityEngine } from "../server/castingV2/signEngine";
import { carriedInkPlates } from "../server/castingV2/signService";
import { storageReadBytes } from "../server/storage";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { castingCandidates } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/* This court is TRACKED now, so it is permanent and declares its world: inert
   locally, and it refuses a half-production process under `railway run`. */
assertOneWorld(["DATABASE_URL"]);

const OUT = path.resolve("output/view-reference-court");
await mkdir(OUT, { recursive: true });

const USER_ID = 1;
const CANDIDATE_PUBLIC_ID = "7cb9c7a4-7954-4106-8b20-61f7ca4de292";
const DESIGN_FILE = "output/imagegen/synthetic-tattoo-sempre-olive-sprig-specimen-02.png";

/*
  THE STOP — FIRST, ahead of the database, the upload and the plate mint,
  because a refusal that has already spent $0.15 saying "REFUSING TO SPEND"
  is a lie about itself. A warning nobody is stopped by is a warning — and
  invariant 7's rule is that a control which is not invoked does not exist.

  Under his ruling a design wholly under the collar renders to nothing in
  `frontFull`, so this court's positive arm would be a negative one wearing a
  positive label — three MUST-NOTs and no way to catch a build that paints
  nothing. Rather than quietly measure the wrong thing on house money, it
  refuses until the specimen is one that reaches bare skin.
*/
const NEWLINE = String.fromCharCode(10);
const REACHES_BARE_SKIN = process.argv.includes("--specimen-reaches-bare-skin");
if (!REACHES_BARE_SKIN) {
  console.log([
    "REFUSING TO SPEND — the positive arm's bar moved (founder ruling 2026-08-19, fable-1081 §2).",
    "",
    `  specimen : ${DESIGN_FILE}`,
    "  a chest design with no neck continuation is CORRECTLY invisible under a crew neck,",
    "  so this run would be three MUST-NOT arms and could not find a YES-defect.",
    "",
    "  Give it a design that reaches bare skin — a chest piece running onto the neck, whose",
    "  poke above the collar is the bar — then re-run with --specimen-reaches-bare-skin.",
    "",
    "  HIS OWN SPECIMEN FOR THIS IS NOW IN THE REPO (fable-1083), supplied for exactly",
    "  this measurement — \"one more reference photo to test if the tattoos will pop out",
    "  the top of the shirt\":",
    "",
    "    docs/specs/references/build-two-founder-specimens/tattoo-patchwork-torso-neck-continuation.png",
    "",
    "  Read at the frame: a barbed-wire band at the base of the neck and throat work above",
    "  it (MUST SHOW above a crew collar); chest and stomach pieces (MUST NOT); both sleeves",
    "  (show what a short sleeve allows). One specimen carrying the must-show and the",
    "  must-not halves of the visible-extent promise at once.",
    "",
    "  IT IS NOT A DESIGN FILE, AND THAT IS AN UNANSWERED QUESTION RATHER THAN AN OVERSIGHT.",
    "  It is a reference PHOTOGRAPH of a person wearing many separate tattoos, and his ask",
    "  is to use ALL of them. Which road it runs on has not been decided (fable-1083 §2):",
    "  as reference-plus-words it rides whole, and as a plate the crop road must first rule",
    "  whether patchwork is one region or many designs. Do not answer that by running this.",
  ].join(NEWLINE));
  process.exit(1);
}

const db = await getDb();
if (!db) throw new Error("no database");
console.log("[db]", process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@"));

const [candidate] = await db
  .select({ id: castingCandidates.id, imageKey: castingCandidates.imageKey })
  .from(castingCandidates)
  .where(eq(castingCandidates.publicId, CANDIDATE_PUBLIC_ID));
if (!candidate?.imageKey) throw new Error("the court's candidate has no master image");

/* ---------------------------------------------------------------- the plate */

console.log("uploading an upper-chest design (the upload road mints its own plate)…");
const upload = await uploadInkDesign({
  userId: USER_ID,
  candidatePublicId: CANDIDATE_PUBLIC_ID,
  placement: "upperChest",
  side: "centre",
  provenance: "synthetic",
  intents: ["tattoo"],
  bytes: await readFile(DESIGN_FILE),
});
console.log("upload:", JSON.stringify(upload).slice(0, 400));
if (!upload.ok) {
  console.log("REFUSED — the court cannot run without a plate");
  process.exit(1);
}

/* Read the plates back through the PRODUCT'S OWN loader, so what the court
   renders with is what a Sign would carry rather than something assembled
   here. */
const { plates, dispositions } = await carriedInkPlates({} as never, {
  userId: USER_ID,
  candidateId: candidate.id,
  operationId: "court-view-reference",
});
console.log("dispositions:", JSON.stringify(dispositions));

const chest = plates.filter((plate) => plate.placement === "upperChest");
if (chest.length !== 1) {
  console.log(`the court needs exactly one upper-chest plate; the loader carried ${chest.length}`);
  process.exit(1);
}
await writeFile(path.join(OUT, "plate-upper-chest.png"), chest[0]!.bytes);

/* --------------------------------------------------------------- the renders */

const anchorBytes = await storageReadBytes(candidate.imageKey);
await writeFile(path.join(OUT, "anchor.png"), anchorBytes.bytes);

const engine = castingIdentityEngine();
const carried: CarriedInkPlate[] = [chest[0]!];
const clause = inkViewReferenceClause({ plates: carried, firstOrdinal: 2 });
await writeFile(path.join(OUT, "clause.txt"), clause);

const ARMS = [
  {
    angle: "frontFull" as const,
    expect: "MUST SHOW the part of the tattoo the collar leaves bare — and NOTHING on the shirt",
  },
  { angle: "backFull" as const, expect: "MUST NOT show it anywhere" },
  { angle: "closeUp" as const, expect: "MUST NOT show it anywhere" },
];

for (const arm of ARMS) {
  console.log(`rendering ${arm.angle} — ${arm.expect}`);
  const started = Date.now();
  const image = await engine.generateView({
    prompt: `${composePackageViewPrompt(arm.angle)}\n${clause}`,
    references: [
      { bytes: anchorBytes.bytes, contentType: anchorBytes.contentType },
      { bytes: chest[0]!.bytes, contentType: chest[0]!.contentType },
    ],
    resolution: "2K",
    viewAngle: arm.angle,
  });
  const file = path.join(OUT, `${arm.angle}.png`);
  await writeFile(file, image.bytes);
  console.log(`  ${file}  ${(Date.now() - started) / 1000}s  ${image.bytes.byteLength} bytes`);
}

console.log();
console.log("THE FRAMES ARE THE VERDICT — look at them:");
console.log(`  ${OUT}`);
process.exit(0);

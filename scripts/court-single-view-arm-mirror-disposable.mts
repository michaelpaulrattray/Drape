/**
 * THE SINGLE-VIEW ARM COURT — does a LEFT design land on her LEFT arm now that
 * the blank is one limb? (Ordered fable-1034 §4(b), GO'd for five house
 * renders; the assumption it measures is `ARM_FOR_SIDE` in `inkTemplates.ts`.)
 *
 * WHAT IS ALREADY MEASURED, and why this court is not the one that ran before:
 * on the RETIRED three-view sheet the words did not decide the side (five
 * renders, three different claims, ink on the image's LEFT every time —
 * opus-742 §2) and the PICTURE did (mirror the sheet, the ink crosses to the
 * image's right — `court-plate-mirror-disposable.mts`, r5). The sheet carried
 * the side in the FRAME HALF the tattooed limb occupied. A single-limb blank
 * has no frame half, so what it carries — anatomy, nothing, or the old
 * image-left default — is unmeasured, and `ARM_FOR_SIDE` is currently the eye's
 * reading of two contours.
 *
 * THE ARMS, DECLARED BEFORE THE FIRST RENDER (fable-1010 §3 — a card from a
 * partial court is a card that needs correcting):
 *
 *   A · as minted (n=3) — the design declares side=left, so the mint stands it
 *       on `armLeft`. The clause says her left upper arm, on the right of the
 *       picture. CORRECT = ink on the image's RIGHT.
 *   B · mirrored (n=2) — the SAME plate bytes flopped. The two arm blanks are
 *       `flop()` of one another BY CONSTRUCTION (inkTemplates.ts header), so
 *       this is byte-equivalent to the mint having chosen `armRight`, with the
 *       words held at left. It isolates the picture from the sentence.
 *
 * Interleaved c,m,c,m,c so a drifting engine reddens both arms rather than one.
 * Everything else is held: one candidate, one master, one prompt, one clause,
 * one resolution.
 *
 * HOW IT IS READ: by eye, on the frames (working law 9). The reading is which
 * SIDE OF THE IMAGE carries the ink; in a front-facing frame her left arm is on
 * the image's right.
 *
 *   npx tsx scripts/court-single-view-arm-mirror-disposable.mts --mint
 *   npx tsx scripts/court-single-view-arm-mirror-disposable.mts --render
 */
process.env.CASTING_INK_STUDIO_SCOPE = "users:1";

import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uploadInkDesign } from "../server/castingV2/inkUploadService";
import { carriedInkPlates } from "../server/castingV2/signService";
import { inkViewReferenceClause } from "../server/castingV2/inkViewReferences";
import { composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { castingIdentityEngine } from "../server/castingV2/signEngine";
import { INK_TEMPLATES, loadInkTemplate } from "../server/castingV2/inkTemplates";
import { storageReadBytes } from "../server/storage";
import { getDb } from "../server/db/connection";
import { castingCandidates } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { assertOneWorld } from "./lib/worldGuard.mts";

/* Reads a real candidate's master and spends real provider calls — running it
   against the wrong world would buy renders from the wrong faces. */
assertOneWorld(["DATABASE_URL"]);

const MODE = process.argv.includes("--render") ? "render" : "mint";
/**
 * ARM C — THE REAL RIGHT-SIDE ROAD, added after arms A and B were read and
 * BEFORE the card was written (fable-1010 §3 forbids the other order).
 *
 * Arm B flopped a FINISHED plate, so it mirrored the artwork along with the
 * limb — the crescent opens the other way in `sv-m1`/`sv-m2`. That is fine for
 * the question it was asked (does the picture carry the side) and useless for
 * the question it looks like it answered: on the real right-side road the mint
 * stands the design on `armRight` and the ENGINE draws the artwork onto it, so
 * the artwork should come out the right way round. `ARM_FOR_SIDE.right` is
 * therefore still an inference from `armRight = flop(armLeft)`, and this arm
 * turns it into a reading.
 *
 *   COURT_SIDE=right  — upload declares side=right, clause says her right arm
 *                       (on the LEFT of the picture), n=2, no mirroring at all.
 *   CORRECT = ink on the image's LEFT, artwork oriented as the specimen.
 */
const SIDE: "left" | "right" = process.env.COURT_SIDE === "right" ? "right" : "left";
const OUT = path.resolve("output/single-view-arm-court");
await mkdir(OUT, { recursive: true });
const USER_ID = 1;
const CANDIDATE_PUBLIC_ID = "7cb9c7a4-7954-4106-8b20-61f7ca4de292";
const DESIGN_FILE = "output/imagegen/synthetic-woman-left-upper-arm-crescent-moon-three-stars-tattoo-specimen.png";
const SMALL = async (bytes: Buffer, file: string) =>
  sharp(bytes).resize({ width: 1000 }).jpeg({ quality: 86 }).toFile(path.join(OUT, file));

const db = await getDb();
if (!db) throw new Error("no database");
const [candidate] = await db.select({ id: castingCandidates.id, imageKey: castingCandidates.imageKey })
  .from(castingCandidates).where(eq(castingCandidates.publicId, CANDIDATE_PUBLIC_ID));
if (!candidate?.imageKey) throw new Error("the court's candidate has no master image");

if (MODE === "mint") {
  /* The blank itself, on disk, so the anatomy `ARM_FOR_SIDE` names can be
     looked at beside the plate that stands on it. */
  const pinned = SIDE === "right" ? INK_TEMPLATES.armRight : INK_TEMPLATES.armLeft;
  const blank = await loadInkTemplate(pinned);
  if (blank.digest !== pinned.digest) {
    throw new Error(`the ${pinned.name} blank on disk hashes ${blank.digest}, not its pin`);
  }
  await writeFile(path.join(OUT, `blank-arm-${SIDE}.png`), blank.bytes);
  await SMALL(blank.bytes, `blank-arm-${SIDE}-small.jpg`);
  console.log(`blank ${pinned.name} ${blank.bytes.length} B · digest matches its pin`);

  console.log(`uploading an upperArm/${SIDE} design (the upload road mints its own plate)…`);
  const upload = await uploadInkDesign({
    userId: USER_ID,
    candidatePublicId: CANDIDATE_PUBLIC_ID,
    placement: "upperArm",
    side: SIDE,
    provenance: "synthetic",
    intents: ["tattoo"],
    bytes: await readFile(DESIGN_FILE),
  });
  console.log("upload:", JSON.stringify(upload).slice(0, 500));
  if (!upload.ok) { console.log("REFUSED — no plate, no court"); process.exit(1); }
  console.log("design:", (upload as { design?: { publicId?: string } }).design?.publicId ?? "(unnamed)");
  process.exit(0);
}

/* ---- render ---- */
const { plates, dispositions } = await carriedInkPlates({} as never, {
  userId: USER_ID, candidateId: candidate.id, operationId: "court-single-view-arm-mirror",
});
console.log("dispositions:", JSON.stringify(dispositions));
const DESIGN = process.env.COURT_DESIGN_PUBLIC_ID;
if (!DESIGN) throw new Error("set COURT_DESIGN_PUBLIC_ID to the design minted in --mint");
const arm = plates.find((plate) => plate.designPublicId === DESIGN);
if (!arm) throw new Error(`the loader did not carry design ${DESIGN}`);
if (arm.placement !== "upperArm" || arm.side !== SIDE) {
  throw new Error(`the court's plate is ${arm.placement}/${arm.side}, not upperArm/${SIDE}`);
}

await writeFile(path.join(OUT, `plate-${SIDE}-as-minted.png`), arm.bytes);
await SMALL(arm.bytes, `plate-${SIDE}-as-minted-small.jpg`);
const mirrored = await sharp(arm.bytes).flop().png().toBuffer();
if (SIDE === "left") {
  await writeFile(path.join(OUT, "plate-mirrored.png"), mirrored);
  await SMALL(mirrored, "plate-mirrored-small.jpg");
}
console.log(`plate as-minted ${arm.bytes.length} B · mirrored ${mirrored.length} B`);

const clause = inkViewReferenceClause({ plates: [arm], firstOrdinal: 2 });
await writeFile(path.join(OUT, `clause-${SIDE}.txt`), clause);
console.log("the sentence:", clause.split("\n")[1]?.slice(0, 160));

const anchor = await storageReadBytes(candidate.imageKey);
await writeFile(path.join(OUT, "anchor.png"), anchor.bytes);
const engine = castingIdentityEngine();
const prompt = `${composePackageViewPrompt("frontFull")}\n${clause}`;

/* Arm C is two renders of the real right-side road and mirrors nothing —
   there is no treatment to interleave against, because the blank IS the
   treatment. */
const RUNS = SIDE === "right"
  ? ([
      { label: "r1", plate: arm.bytes, kind: "asis" },
      { label: "r2", plate: arm.bytes, kind: "asis" },
    ] as const)
  : ([
      { label: "c1", plate: arm.bytes, kind: "asis" },
      { label: "m1", plate: mirrored, kind: "mirrored" },
      { label: "c2", plate: arm.bytes, kind: "asis" },
      { label: "m2", plate: mirrored, kind: "mirrored" },
      { label: "c3", plate: arm.bytes, kind: "asis" },
    ] as const);

for (const run of RUNS) {
  const image = await engine.generateView({
    prompt,
    references: [
      { bytes: anchor.bytes, contentType: anchor.contentType },
      { bytes: run.plate as Buffer, contentType: run.kind === "mirrored" ? "image/png" : arm.contentType },
    ],
    resolution: "2K",
    viewAngle: "frontFull",
  });
  const file = path.join(OUT, `sv-${SIDE}-${run.label}-${run.kind}.png`);
  await writeFile(file, image.bytes);
  await SMALL(image.bytes, `sv-${SIDE}-${run.label}-${run.kind}-small.jpg`);
  console.log(`${run.label} (${run.kind}) → ${file}`);
}
process.exit(0);

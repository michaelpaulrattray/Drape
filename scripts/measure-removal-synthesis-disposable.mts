/**
 * THE OTHER TWO KINDS — earrings and nose jewellery, on a specimen this bench
 * has to make, and every step of the making is proven.
 *
 * The base-worn departure class is three kinds wide (`LANDMARK_OF_ACCESSORY`:
 * glasses, earrings, nose jewellery — the kinds with a `vacantPhrase` to say).
 * Dev's roll wears glasses and nothing else, and a removal cannot be measured on
 * a face that is not wearing the thing. Reporting the glasses arm as "the
 * removal class" would be the silent cap the fidelity law is about, so the other
 * two are measured on a SYNTHETIC specimen: the object is painted on, proven
 * present, and then asked to leave.
 *
 * # The confound, stated rather than buried
 *
 * An object this engine painted a minute ago may be easier for it to take off
 * than one born in the roll. So this arm is reported BESIDE the born-worn arm
 * and never averaged into it, and this sentence travels with any quote of these
 * numbers (fable-322).
 *
 * # A specimen is a proven DELTA, both directions (fable-322)
 *
 *   BEFORE  the master must read NOT-WEARING — otherwise a face who already had
 *           the thing wanders into the synthesis arm and its "add" changed
 *           nothing.
 *   AFTER   the painted frame must read WEARING, by the reader and by eyes —
 *           otherwise the vacate has nothing to remove and a "successful"
 *           removal is a photograph of an absence that was always there.
 *
 * Only a face that passes both is a specimen. Everything else is excluded by
 * name.
 *
 * Nothing is written to storage: the painted frame rides as bytes through the
 * repaint's own injected loader, under a synthetic key, so the specimen exists
 * on disk and in memory and nowhere else.
 *
 *   npx tsx scripts/measure-removal-synthesis-disposable.mts        # 3 removes/kind
 *   PAINTS=2 npx tsx scripts/measure-removal-synthesis-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint, type ReferenceBytes } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { aboutFacet, verifyRender, isRefusableMiss } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { accessoryKindOf } from "../server/castingV2/accessoryKinds";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift63-removal-synthesis";
const PAINTS = Number(process.env.PAINTS ?? 3);
/** One face, chosen once and named, so the arm is about the kind and not the face. */
const FACE = process.env.FACE ?? "2f43a3fc-ed05-4a73-9862-597a4d43359e";

/** Each kind: what to put on her, and the absence question the product asks. */
const KINDS = [
  {
    id: "earring",
    wear: "small gold hoop earrings",
    absent: "earrings",
    asked: "no earrings — both earlobes bare, nothing hanging from either ear",
  },
  {
    id: "nose stud",
    wear: "a small gold nose stud",
    absent: "nose stud",
    asked: "no nose jewellery — her nose and septum bare, with no piercing visible",
  },
];

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
await mkdir(OUT, { recursive: true });

const [faces] = await connection.query<any[]>(
  "SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
);
const face = faces[0];
if (!face) throw new Error(`no candidate ${FACE}`);
const short = face.publicId.slice(0, 8);

const masterBytes = await storageReadBytes(face.imageKey);
const sharpModule = (await import("sharp")).default;
const meta = await sharpModule(masterBytes.bytes).metadata();
const width = meta.width ?? 1024;
const height = meta.height ?? 1536;
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });

/**
 * The absence question, asked the way the departure path asks it — and the WHOLE
 * check kept, because `verified === false` is a miss, an occlusion and an unread
 * frame wearing one coat (`isOccluded` is neither pass nor miss and does not
 * spend her refusal). This arm's first specimen came back "both earlobes are
 * covered by hair", which is a NO-READ and not a fact about earrings.
 */
const judge = async (bytes: Buffer, asked: string): Promise<any> => {
  const verdict = await verifyRender({
    bytes, contentType: "image/png",
    facts: [{ subject: aboutFacet(facetOfSubject("statedAccessories")), asked, binding: true, absenceIsTheAsk: true }],
  });
  const check = verdict.checks[0];
  return {
    absent: check?.verified === true,
    saw: check?.saw ?? "(nothing named)",
    read: check?.read === true,
    occluded: check?.occluded === true,
    refusable: check ? isRefusableMiss(check) : null,
  };
};

const report: any[] = [];

for (const kind of KINDS) {
  if (process.env.KIND && kind.id !== process.env.KIND) continue;
  const record: any = { kind: kind.id, face: face.publicId, paints: [], landed: 0 };
  report.push(record);

  /* ── BEFORE: she must not already be wearing it ──────────────────────────── */
  const before = await judge(masterBytes.bytes, kind.asked);
  record.before = before;
  if (!before.absent) {
    /*
      NOT "she is already wearing it" — the reader was asked to CONFIRM an
      absence and declined, and the two reasons it can decline are worlds apart:
      the thing is there, or the site cannot be seen at all. 2f43a3fc's first
      run said "both earlobes are covered by hair, no earrings visible on either
      ear" — a NO-READ, which is evidence rather than absence, and calling it
      "already wearing" would have put a false fact in the report.
    */
    record.excluded = `the reader would not confirm the site is bare — "${before.saw}" (she is wearing one, or the site is occluded); not a specimen either way`;
    console.log(`${kind.id}: EXCLUDED — ${record.excluded}`);
    continue;
  }
  console.log(`${kind.id}: BEFORE — bare, as required: "${before.saw}"`);

  /* ── the add, one paint, words only ──────────────────────────────────────── */
  const addAsks = repaintAsksFor({
    delta: { free: { statedAccessories: [kind.wear] } } as any,
    prose: EDIT_PROSE,
    accessoryKind: accessoryKindOf(kind.wear),
  });
  if (!addAsks.ok) {
    record.excluded = `the add refused: ${addAsks.reason} — ${addAsks.detail}`;
    console.log(`${kind.id}: EXCLUDED — ${record.excluded}`);
    continue;
  }
  const addRecipe = assembleRecipe({
    master: { key: face.imageKey },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: [],
    asks: addAsks.asks,
  });
  if (!addRecipe.ok) {
    record.excluded = `the add recipe refused: ${addRecipe.reason}`;
    console.log(`${kind.id}: EXCLUDED — ${record.excluded}`);
    continue;
  }
  const added = await repaint({
    recipe: addRecipe, engine, width, height,
    load: async (image) => await storageReadBytes(image.key),
  });
  if (!added.ok) {
    record.excluded = `the add refused at the door: ${added.reason}`;
    console.log(`${kind.id}: EXCLUDED — ${record.excluded}`);
    continue;
  }
  const specimenFile = path.join(OUT, `${short}-${kind.id.replace(/\s+/g, "-")}-00-specimen.png`);
  await writeFile(specimenFile, added.frame.bytes);

  /* ── AFTER: the thing must be visibly on her, or there is nothing to remove ─ */
  const after = await judge(added.frame.bytes, kind.asked);
  record.after = { ...after, file: specimenFile };
  if (after.absent) {
    record.excluded = `the add did not land — the painted frame still reads bare ("${after.saw}"), so a removal on it would prove nothing`;
    console.log(`${kind.id}: EXCLUDED — the add did not land: "${after.saw}" → ${specimenFile}`);
    continue;
  }
  console.log(`${kind.id}: AFTER  — she is wearing it: "${after.saw}" → ${specimenFile}`);

  /* ── the removals, from the specimen as master ───────────────────────────── */
  const SYNTHETIC = `synthetic:${short}:${kind.id}`;
  const specimenBytes: ReferenceBytes = { bytes: added.frame.bytes, contentType: "image/png" };
  const removeAsks = repaintAsksFor({
    delta: { absent: { statedAccessories: [kind.absent] }, free: { statedAccessories: [] } } as any,
    prose: EDIT_PROSE,
  });
  if (!removeAsks.ok) {
    record.excluded = `the vacate refused: ${removeAsks.reason} — ${removeAsks.detail}`;
    console.log(`${kind.id}: EXCLUDED — ${record.excluded}`);
    continue;
  }
  const removeRecipe = assembleRecipe({
    master: { key: SYNTHETIC },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: [],
    asks: removeAsks.asks,
  });
  if (!removeRecipe.ok) {
    record.excluded = `the vacate recipe refused: ${removeRecipe.reason}`;
    console.log(`${kind.id}: EXCLUDED — ${record.excluded}`);
    continue;
  }
  record.references = removeRecipe.references.length;
  record.prompt = removeRecipe.prompt;

  for (let at = 1; at <= PAINTS; at += 1) {
    const painted = await repaint({
      recipe: removeRecipe, engine, width, height,
      /* The specimen never went to storage; it rides as bytes under a key
         nothing else can name. */
      load: async (image) => image.key === SYNTHETIC ? specimenBytes : await storageReadBytes(image.key),
    });
    if (!painted.ok) {
      record.paints.push({ at, refusedAtDoor: painted.reason, detail: painted.detail });
      console.log(`${kind.id}: paint ${at} REFUSED at the door — ${painted.reason}`);
      continue;
    }
    const verdict = await judge(painted.frame.bytes, kind.asked);
    if (verdict.absent) record.landed += 1;
    const file = path.join(OUT, `${short}-${kind.id.replace(/\s+/g, "-")}-${String(at).padStart(2, "0")}-${verdict.absent ? "removed" : "still-there"}.png`);
    await writeFile(file, painted.frame.bytes);
    record.paints.push({ at, landed: verdict.absent, saw: verdict.saw, file });
    console.log(`${kind.id}: paint ${at} ${verdict.absent ? "REMOVED " : "still on"} — "${verdict.saw}" → ${file}`);
  }
}

console.log(`\n${"=".repeat(96)}`);
console.log(`SYNTHESIS ARM · face ${short} · the object was painted on by the same engine that then took it off`);
for (const row of report) {
  const attempts = row.paints.filter((p: any) => p.landed !== undefined).length;
  console.log(`  ${row.kind.padEnd(11)} ${row.excluded ? `EXCLUDED — ${row.excluded}` : `${row.landed}/${attempts} removed · refs ${row.references}`}`);
}
console.log(`NOT averaged with the born-worn glasses arm — different specimen provenance.`);
console.log("=".repeat(96));

/* Named for its own run. A single `tally.json` let the earring run overwrite the
   nose run's record — the frames and the log survived, but a tally that can be
   silently replaced by the next invocation is not a record. */
await writeFile(
  path.join(OUT, `tally-${short}-${report.map((row) => row.kind.replace(/\s+/g, "-")).join("-")}.json`),
  JSON.stringify(report, null, 2),
);
await connection.end();
process.exit(0);

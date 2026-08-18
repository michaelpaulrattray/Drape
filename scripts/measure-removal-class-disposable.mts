/**
 * THE REMOVAL CLASS, NOT ONE FACE — D-236's bar wants a class rate, and shift 62
 * measured 8 of 8 on one face, one object, one prompt.
 *
 * What that number could not tell apart: a painter that takes glasses off
 * reliably, and a painter that takes THESE glasses off this face reliably. A
 * rate whose n is one face is a rate about a face. So the same instrument runs
 * across every face in the dev roll — eight women, eight different pairs of
 * chunky glasses, the same declarative vacate sentence the product composes.
 *
 * # What is measured, and what is not
 *
 * The base-worn departure class is exactly three kinds wide today
 * (`LANDMARK_OF_ACCESSORY`: glasses, earrings, nose jewellery — the kinds with a
 * `vacantPhrase` to say). Only the glasses arm can be measured on BORN-WORN
 * specimens, because that is what the dev roll is wearing: nobody in it has
 * earrings or a nose stud, and a removal cannot be measured on a face that is
 * not wearing the thing. The other two kinds are named, not counted, and the
 * report says so rather than quietly reporting "the removal class" from one
 * third of it.
 *
 * # Two controls, in opposite directions, before any tally counts
 *
 * A tally of "landed" is worth nothing from a reader that says yes to
 * everything, and equally nothing from one that says no to everything — the
 * second is the trap, because it would report 0% and look like a painter bug
 * (`positive-control-needs-a-verified-outcome`).
 *
 *   NEGATIVE  each face's own master, glasses plainly on, must read as STILL
 *             WEARING THEM. A face whose master reads as already-removed is not
 *             a specimen for this measurement and is excluded by name.
 *   POSITIVE  a frame from shift 62 whose glasses are verifiably gone must read
 *             as REMOVED. Without it, a run of zeroes is unattributable.
 *
 * Every frame is kept on disk under its verdict, so a human can disagree with
 * the reader — the false-pass half of D-236 is settled by eyes on pictures, not
 * by this script agreeing with itself.
 *
 * Off the ledger and off the product path: no refine, no credits, no rows, no
 * storage writes.
 *
 *   npx tsx scripts/measure-removal-class-disposable.mts          # 2 paints/face
 *   PAINTS=3 FACES=4 npx tsx scripts/measure-removal-class-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import {
  deriveLibrary, libraryWithoutEditedCrops, supersededCarrySlots,
  type StoredReference,
} from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { aboutFacet, verifyRender, isRefusableMiss } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift63-removal-class";
const PAINTS = Number(process.env.PAINTS ?? 2);
const FACE_LIMIT = Number(process.env.FACES ?? 99);
/** Shift 62's own delivered frame — glasses gone, looked at by a human. */
const POSITIVE_CONTROL = "output/shift62-removal-rate/01-removed.png";
const EDIT_DELTA = { absent: { statedAccessories: ["glasses"] } } as any;
/** The product's own removal question, verbatim from the departure path. */
const ASKED = "no glasses — they have been taken off and are not in the picture";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

await mkdir(OUT, { recursive: true });

/*
  THE WHOLE CHECK, NOT JUST ITS BOOLEAN.

  `verified === false` is three different outcomes wearing one coat, and D-236's
  table needs them apart: a MISS (the thing is still there — charged for
  nothing), an OCCLUSION (the site cannot be seen, `isOccluded` — neither pass
  nor miss, and it does not spend her refusal), and an unread frame. The first
  version of this returned `landed` alone, and the earring arm's very first
  specimen came back "both earlobes are covered by hair" — a NO-READ that would
  have been tallied as a painter miss.
*/
const judge = async (bytes: Buffer): Promise<any> => {
  const verdict = await verifyRender({
    bytes,
    contentType: "image/png",
    facts: [{ subject: aboutFacet(facetOfSubject("statedAccessories")), asked: ASKED, binding: true, absenceIsTheAsk: true }],
  });
  const check = verdict.checks[0];
  return {
    landed: check?.verified === true,
    saw: check?.saw ?? "(nothing named)",
    read: check?.read === true,
    occluded: check?.occluded === true,
    refusable: check ? isRefusableMiss(check) : null,
  };
};

/* ── the reader must be able to say REMOVED at all ──────────────────────────── */
const positive = await judge(await readFile(POSITIVE_CONTROL));
console.log(`CONTROL +  a frame whose glasses are gone: ${positive.landed ? "read as REMOVED" : "READ AS STILL WEARING — the reader is stuck shut, nothing below counts"} — "${positive.saw}"`);
if (!positive.landed) { await connection.end(); process.exit(1); }

const faces = (await query(
  `SELECT c.id, c.publicId, c.imageKey
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
     JOIN casting_sessions s ON s.id = r.sessionId
    WHERE s.userId = 1 AND c.status = 'ready' AND r.briefText LIKE '%chunky glasses%'
    ORDER BY c.id`,
)).slice(0, FACE_LIMIT);
console.log(`\n${faces.length} faces from the glasses roll.\n`);

const sharpModule = (await import("sharp")).default;
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });
const tally: any[] = [];

for (const face of faces) {
  const short = face.publicId.slice(0, 8);
  const rows = (await query(
    `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
            storageKey, maskKey, digest, refusedReason, version, retiredAt, createdAt
       FROM casting_reference_library WHERE candidateId = ? ORDER BY id`,
    [face.id],
  )).map((entry): StoredReference => ({
    id: entry.id, publicId: entry.publicId, candidateId: entry.candidateId,
    variantId: entry.variantId, role: entry.role, slot: entry.slot, tier: entry.tier,
    noun: entry.noun,
    words: typeof entry.words === "string" ? JSON.parse(entry.words) : (entry.words ?? []),
    storageKey: entry.storageKey, maskKey: entry.maskKey, digest: entry.digest,
    geometry: null, guard: null,
    refusal: entry.refusedReason
      ? { reason: entry.refusedReason, kind: "", coverage: null, contentKey: null, maskKey: null, geometry: null }
      : null,
    version: entry.version, retiredAt: entry.retiredAt, createdAt: new Date(entry.createdAt),
  }));

  const record: any = { face: face.publicId, libraryRows: rows.length, paints: [], landed: 0 };
  tally.push(record);

  let masterBytes;
  try {
    masterBytes = await storageReadBytes(face.imageKey);
  } catch (cause) {
    record.excluded = `master unreadable: ${(cause as Error).message}`;
    console.log(`${short}  EXCLUDED — ${record.excluded}`);
    continue;
  }

  /* ── this face's own master, glasses on, is the negative control ─────────── */
  const control = await judge(masterBytes.bytes);
  record.control = control;
  if (control.landed) {
    record.excluded = "her master reads as already-removed — not a specimen for this measurement";
    console.log(`${short}  EXCLUDED — master read as REMOVED: "${control.saw}"`);
    await writeFile(path.join(OUT, `${short}-00-master-excluded.png`), masterBytes.bytes);
    continue;
  }
  console.log(`${short}  control: still wearing them — "${control.saw}"  · library ${rows.length}`);

  const asks = repaintAsksFor({
    delta: EDIT_DELTA,
    prose: EDIT_PROSE,
    restore: { state: EDIT_DELTA, slots: supersededCarrySlots(rows) },
  });
  if (!asks.ok) {
    record.excluded = `the asks refused: ${asks.reason}`;
    console.log(`${short}  EXCLUDED — ${record.excluded}`);
    continue;
  }
  const recipe = assembleRecipe({
    master: { key: face.imageKey },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((a) => a.slot))),
    asks: asks.asks,
  });
  if (!recipe.ok) {
    record.excluded = `the recipe refused: ${recipe.reason}`;
    console.log(`${short}  EXCLUDED — ${record.excluded}`);
    continue;
  }
  record.references = recipe.references.length;
  record.prompt = recipe.prompt;

  const meta = await sharpModule(masterBytes.bytes).metadata();
  for (let at = 1; at <= PAINTS; at += 1) {
    const painted = await repaint({
      recipe, engine,
      load: async (image) => await storageReadBytes(image.key),
      width: meta.width ?? 1024, height: meta.height ?? 1536,
    });
    if (!painted.ok) {
      record.paints.push({ at, refusedAtDoor: painted.reason, detail: painted.detail });
      console.log(`${short}  paint ${at}: REFUSED at the reference door — ${painted.reason}`);
      continue;
    }
    const verdict = await judge(painted.frame.bytes);
    if (verdict.landed) record.landed += 1;
    const file = path.join(OUT, `${short}-${String(at).padStart(2, "0")}-${verdict.landed ? "removed" : "still-there"}.png`);
    await writeFile(file, painted.frame.bytes);
    record.paints.push({ at, landed: verdict.landed, saw: verdict.saw, file });
    console.log(`${short}  paint ${at}: ${verdict.landed ? "REMOVED " : "still on"} — "${verdict.saw}" → ${file}`);
  }
}

const measured = tally.filter((row) => !row.excluded);
const delivered = measured.reduce((sum, row) => sum + row.landed, 0);
const attempts = measured.reduce((sum, row) => sum + row.paints.filter((p: any) => p.landed !== undefined).length, 0);
const doors = measured.reduce((sum, row) => sum + row.paints.filter((p: any) => p.refusedAtDoor).length, 0);

console.log(`\n${"=".repeat(96)}`);
console.log(`GLASSES ARM · ${measured.length} faces measured, ${tally.length - measured.length} excluded`);
console.log(`  delivered ${delivered} of ${attempts} paints  =  ${attempts ? ((delivered / attempts) * 100).toFixed(1) : "—"}%   (D-236 bar: 95%)`);
console.log(`  refused at the reference door: ${doors} (not a delivery, not a miss)`);
for (const row of tally) {
  console.log(`  ${row.face.slice(0, 8)}  ${row.excluded ? `EXCLUDED — ${row.excluded}` : `${row.landed}/${row.paints.filter((p: any) => p.landed !== undefined).length}  refs ${row.references}`}`);
}
console.log(`\nEARRINGS and NOSE JEWELLERY: not measured — no born-worn specimen in dev.`);
console.log("=".repeat(96));

await writeFile(path.join(OUT, "tally.json"), JSON.stringify({ positive, tally }, null, 2));
await connection.end();
process.exit(0);

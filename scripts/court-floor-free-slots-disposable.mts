/**
 * SIX IDENTICAL COPIES OF ONE REPO FILE, AND THEY ARE HOLDING THE COURT'S CAP.
 *
 *   COURT_APPLY=no  npx tsx scripts/court-floor-free-slots-disposable.mts   (default: lists)
 *   COURT_APPLY=yes npx tsx scripts/court-floor-free-slots-disposable.mts   (deletes)
 *
 * # What this is for
 *
 * `REFERENCE_PICTURES_PER_CANDIDATE` is 8 and it counts **ink designs AND
 * attachments together** (`countHeldPicturesIn`, one counter for a bound with
 * two writers). The dev bot's only refinable Cast holds 6 attachments + 2
 * designs = exactly 8, so the ratified floor court's first upload was refused
 * before a credit moved: *"This Cast is holding all 8 pictures it can hold."*
 *
 * All six attachments are **662,106 bytes each — byte-identical copies of
 * `tattoo-sleeve-trex-geometric-design.png`, which is in the repository**, left
 * by earlier courts on a test account in the dev world. Nothing is lost by
 * removing them and the original is one `git show` away.
 *
 * # It deletes the OBJECT before the ROW, and that order is the whole care
 *
 * A row is what makes an object purgeable at all — `candidateRetention` builds
 * its purge list by enumerating rows and collecting their storage keys. Delete
 * the row first and the object becomes litter nothing will ever sweep: a
 * picture at a permanently public URL with no record pointing at it. So the
 * bytes go first, and a row whose object refused to delete is KEPT rather than
 * orphaned.
 *
 * # What it will not touch
 *
 * The two INK DESIGNS stay. They are the realism court's own record (`#13`,
 * `#14`, both `rideWhole`), they are cited in reports, and two slots is not
 * what this court is short of.
 *
 * Dev only, and it says which database it is on before it does anything —
 * `assertOneWorld` refuses a production URL outright.
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { storageDelete } from "../server/storage";

const APPLY = process.env.COURT_APPLY === "yes";
const CANDIDATE = 232;

assertOneWorld(["DATABASE_URL"]);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("REFUSING: no DATABASE_URL");
  process.exit(1);
}

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  `SELECT id, publicId, storageKey, byteSize, createdAt
     FROM casting_reference_attachments WHERE candidateId = ? ORDER BY id`,
  [CANDIDATE],
);
console.log(`candidate ${CANDIDATE} holds ${rows.length} attachments${APPLY ? "" : "  (LISTING ONLY — set COURT_APPLY=yes)"}`);
for (const row of rows) console.log(`  #${row.id} ${row.publicId} ${row.byteSize} B  ${row.storageKey}`);

if (!APPLY) {
  await connection.end();
  process.exit(0);
}

let removed = 0;
for (const row of rows) {
  try {
    await storageDelete(row.storageKey);
  } catch (error) {
    /* KEPT, NOT ORPHANED — see the header. A row whose bytes would not delete is
       the only thing standing between those bytes and nobody ever sweeping them. */
    console.log(`  #${row.id} KEPT — its object would not delete: ${(error as Error)?.message ?? "unknown"}`);
    continue;
  }
  await connection.query(`DELETE FROM casting_reference_attachments WHERE id = ?`, [row.id]);
  removed += 1;
  console.log(`  #${row.id} object deleted, row deleted`);
}

const [after] = await connection.query<any[]>(
  `SELECT COUNT(*) AS n FROM casting_reference_attachments WHERE candidateId = ?`, [CANDIDATE],
);
const [designs] = await connection.query<any[]>(
  `SELECT COUNT(*) AS n FROM casting_ink_designs WHERE candidateId = ?`, [CANDIDATE],
);
console.log(`removed ${removed}; attachments now ${after[0].n}, designs ${designs[0].n} — ${Number(after[0].n) + Number(designs[0].n)} of 8 held`);
await connection.end();
process.exit(0);

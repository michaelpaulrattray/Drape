/**
 * HOW FAR DOES THE UPLOADED-ANCHOR QUESTION REACH? (ordered fable-1016 §4)
 *
 * `casting_reference_library.variantId` NULL means "belongs to every branch".
 * An uploaded anchor (fable-195's carve-out) gets NULL too — so a branch forked
 * BEFORE the upload existed still inherits it. That is a real question about a
 * live carve-out, and it belongs to the library/branching road rather than to
 * the reference-crop build that noticed it.
 *
 * Before it is shelved, its REACH is measured: a filed question with a
 * population is a different object from a filed question without one.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-uploaded-anchor-reach-disposable.mts
 *
 * Read-only. One SELECT, no writes, no spend.
 *
 * # THE CONTROL, because a zero must be distinguishable from a broken query
 *
 * A query naming a column that does not exist, or a table that is empty for the
 * wrong reason, returns zero exactly the way "no such rows" does. So the total
 * row count and the anchor-role count are printed BESIDE the answer: a zero
 * against a populated table is a finding, and a zero against an empty table is
 * the instrument saying it had nothing to look at.
 */
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";

/* Through the ONE DOOR — it names the world it opened on stderr, refuses to
   open one world from inside the other, and sets `timezone: "Z"` so a DATETIME
   is not read ten hours out. A script that opens its own connection is the
   class `scriptConnectionDiscipline.test.ts` exists to catch, and it caught
   this one. */
const connection = await openDatabase(resolveDatabaseUrl());
let exitCode = 1;
try {
  const [rows] = await connection.query<any[]>(`
    SELECT
      COUNT(*)                                                            AS total,
      SUM(role = 'anchor')                                                AS anchors,
      SUM(role = 'anchor' AND maskKey IS NULL AND storageKey IS NOT NULL)  AS uploadedAnchors,
      SUM(role = 'anchor' AND maskKey IS NULL AND storageKey IS NOT NULL
          AND variantId IS NULL)                                          AS uploadedAnchorsClaimingEveryBranch
    FROM casting_reference_library
  `);
  const row = rows[0];
  console.log(`library rows total                      ${row.total}`);
  console.log(`  of which role='anchor'                ${row.anchors ?? 0}`);
  console.log(`  of which UPLOADED (anchor, no mask)   ${row.uploadedAnchors ?? 0}`);
  console.log(`  of those with variantId NULL          ${row.uploadedAnchorsClaimingEveryBranch ?? 0}`);
  console.log("");
  const reach = Number(row.uploadedAnchorsClaimingEveryBranch ?? 0);
  if (Number(row.total) === 0) {
    console.log("VERDICT  the table is EMPTY — this instrument had nothing to look at, and the zero above says nothing about the question");
  } else if (reach === 0) {
    console.log(`VERDICT  DORMANT — ${row.total} library rows exist and none is an uploaded anchor, so no branch can inherit one today`);
  } else {
    console.log(`VERDICT  LIVE — ${reach} uploaded anchor(s) claim every branch, including any forked before the upload existed`);
  }
  exitCode = 0;
} finally {
  await connection.end();
}

/* A script ends by ending the process — `scriptExitDiscipline.test.ts`. */
process.exit(exitCode);

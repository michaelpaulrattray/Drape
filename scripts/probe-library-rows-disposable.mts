/**
 * READ-ONLY: what the seven live library rows actually are.
 *
 * The refusal viewer needs one real specimen to be rehearsed against — a crop, a
 * mask, a box and the frame they were cut from, all at keys that exist. This
 * prints the candidates for that, and nothing else.
 */
import "dotenv/config";
import { openDatabase, utc } from "./lib/dbConnection.mjs";

const connection = await openDatabase();
try {
  const [rows] = await connection.query<any[]>(`
    SELECT l.id, l.userId, l.candidateId, l.variantId, l.role, l.slot, l.tier,
           l.storageKey, l.maskKey, l.bboxX, l.bboxY, l.bboxW, l.bboxH,
           l.frameWidth, l.frameHeight, l.guardKind, l.guardCoverage, l.createdAt,
           v.imageKey AS variantImageKey, c.imageKey AS masterImageKey
      FROM casting_reference_library l
      LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
      LEFT JOIN casting_candidates c ON c.id = l.candidateId
     ORDER BY l.id
  `);
  for (const row of rows) {
    console.log(
      `#${row.id} user ${row.userId} cand ${row.candidateId} var ${row.variantId ?? "master"} `
      + `${row.role}/${row.slot} (${row.tier}) ${utc(row.createdAt)}`,
    );
    console.log(`   crop ${row.storageKey ?? "—"}`);
    console.log(`   mask ${row.maskKey ?? "—"}`);
    console.log(
      `   box  ${row.bboxX ?? "—"},${row.bboxY ?? "—"} ${row.bboxW ?? "—"}×${row.bboxH ?? "—"} `
      + `in ${row.frameWidth ?? "—"}×${row.frameHeight ?? "—"}  guard ${row.guardKind ?? "—"} ${row.guardCoverage ?? "—"}`,
    );
    console.log(`   frame ${row.variantImageKey ?? row.masterImageKey ?? "—"}`);
  }
} finally {
  await connection.end();
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

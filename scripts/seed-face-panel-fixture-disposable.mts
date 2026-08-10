/**
 * The panel-v2 fixture, CORRECTED AGAINST THE FRAME ITSELF — dev database only.
 *
 * opus-147 built the fixture (candidate `d508cd29`, variant 138, four library
 * rows on the founder's own v#156 frame). Shift 27 drew its four boxes onto the
 * frame and looked at the result (`output/shift27-fixture-boxes.png`), which is
 * the reading nobody had taken:
 *
 *   lips          the box is ON her lips                        KEPT, verified by eye
 *   hair          the box is on her FRINGE AND FOREHEAD, and    GEOMETRY REMOVED
 *                 the words said "a blunt shoulder-length bob"  WORDS CORRECTED
 *                 over a woman wearing it up in a loose bun
 *   earring@l/r   invented fractions of the face box; the left  GEOMETRY REMOVED
 *                 one sits on bare cheek and the right one      WORDS CORRECTED
 *                 above the hoop she is actually wearing
 *   glasses       she is wearing them and the library said      ROW ADDED
 *                 nothing at all
 *
 * Two rules are doing the work here. **No row gets a box nobody measured** — a
 * box on a fringe wearing the name "her hair" is the wrong-boundary class, and
 * an invented box over bare skin labelled "Her earrings" is a promise that
 * clicking there edits an earring. And **the words are read off the artifact**:
 * a panel that describes a face it is sitting next to has to be true of it.
 *
 * What stays declared rather than fixed: these words are HAND-WRITTEN fixture
 * values standing in for the harvest's own, and the identity block below is
 * hand-written where production reads the render's. Both are named on the face
 * of the evidence pack. The real geometry for hair and earrings arrives with the
 * mint caller and its first verified specimen per kind — not by drawing.
 *
 *   npx tsx scripts/seed-face-panel-fixture-disposable.mts
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

const CANDIDATE = "d508cd29-9ba7-455f-89a3-40d77ec1ab97";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const conn = await mysql.createConnection(url);

const [candidates] = await conn.query(
  "SELECT id, userId FROM casting_candidates WHERE publicId = ?",
  [CANDIDATE],
) as any[];
if (candidates.length !== 1) throw new Error(`expected one fixture candidate, found ${candidates.length}`);
const { id: candidateId, userId } = candidates[0];
if (userId !== 1) throw new Error("the fixture belongs to someone else — refusing");

const [variants] = await conn.query(
  "SELECT id FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id",
  [candidateId],
) as any[];
if (variants.length !== 1) throw new Error(`expected one fixture variant, found ${variants.length}`);
const variantId = variants[0].id;

/*
  THE IDENTITY. `readResolvedIdentity` requires sex, ageBand, energy and a
  heritage array; the panel reads only `sex`, to choose his/her/their. The rest
  is filled with the honest word for a fixture that does not know.
*/
await conn.query(
  "UPDATE casting_candidate_variants SET internalPrompt = ? WHERE id = ?",
  [JSON.stringify({ resolved: { sex: "female", ageBand: "unstated", energy: "unstated", heritage: [] } }), variantId],
);

/* Words true of the photograph, and geometry only where it was measured. */
const corrections: Array<{ slot: string; words: string[]; keepBox: boolean }> = [
  { slot: "lips", words: ["full", "a soft nude"], keepBox: true },
  { slot: "hair", words: ["auburn", "worn up in a loose bun", "a soft fringe"], keepBox: false },
  { slot: "earring@left", words: ["a slim gold hoop"], keepBox: false },
  { slot: "earring@right", words: ["a slim gold hoop"], keepBox: false },
];

for (const correction of corrections) {
  const [result] = await conn.query(
    correction.keepBox
      ? "UPDATE casting_reference_library SET words = ? WHERE candidateId = ? AND userId = ? AND slot = ?"
      : `UPDATE casting_reference_library
            SET words = ?, bboxX = NULL, bboxY = NULL, bboxW = NULL, bboxH = NULL,
                frameWidth = NULL, frameHeight = NULL
          WHERE candidateId = ? AND userId = ? AND slot = ?`,
    [JSON.stringify(correction.words), candidateId, userId, correction.slot],
  ) as any[];
  console.log(`${correction.slot}: ${result.affectedRows} row(s), box ${correction.keepBox ? "kept" : "removed"}`);
}

/* She is wearing glasses and the library never said so. Words, no crop, no box —
   which is the shape of most of a real face today. */
const [existing] = await conn.query(
  "SELECT id FROM casting_reference_library WHERE candidateId = ? AND userId = ? AND slot = 'glasses'",
  [candidateId, userId],
) as any[];
if (existing.length === 0) {
  await conn.query(
    `INSERT INTO casting_reference_library
       (publicId, userId, candidateId, variantId, role, slot, tier, noun, words, version, createdAt)
     VALUES (?, ?, ?, ?, 'carry', 'glasses', 'item', 'glasses', ?, 1, NOW())`,
    [randomUUID(), userId, candidateId, variantId, JSON.stringify(["round tortoiseshell frames"])],
  );
  console.log("glasses: row added");
} else {
  await conn.query(
    "UPDATE casting_reference_library SET words = ? WHERE id = ?",
    [JSON.stringify(["round tortoiseshell frames"]), existing[0].id],
  );
  console.log("glasses: row updated");
}

const [after] = await conn.query(
  `SELECT slot, words, bboxX, bboxW, storageKey IS NOT NULL AS hasCrop
     FROM casting_reference_library WHERE candidateId = ? ORDER BY slot`,
  [candidateId],
) as any[];
console.log("\nthe fixture now:");
for (const row of after) console.log(" ", JSON.stringify(row));
await conn.end();

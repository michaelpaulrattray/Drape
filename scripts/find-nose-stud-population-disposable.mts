/**
 * IS THERE A NOSE-STUD POPULATION ALREADY PAID FOR? — asked before the court
 * buys a single render (V4, fable-645 §3).
 *
 * The nose stud is the one kind in the accessory table whose floor reads
 * "NOT MEASURED", and its court needs a worn population and a visibly-bare one.
 * Renders cost house money; rows do not. So the first question is whether the
 * founder — or any brief, or any refine instruction ever typed — has already
 * produced a face wearing one.
 *
 * SELECTION IS BY WORDS, NEVER BY THE INSTRUMENT ON TRIAL (the born-worn
 * court's own rule): a face is a candidate for the worn arm because somebody
 * ASKED for a nose stud, not because a segmenter thinks it sees one. Picking
 * specimens through the reader under test is the instrument grading its own
 * homework.
 *
 *   npx tsx scripts/find-nose-stud-population-disposable.mts            (dev)
 *   railway.cmd run --service MySQL -- npx tsx scripts/find-nose-stud-population-disposable.mts
 *                                                                      (production)
 *
 * Read-only: selects and a count. Writes nothing, charges nothing.
 */
import { openDatabase } from "./lib/dbConnection.mts";

const production = process.env.MYSQL_PUBLIC_URL !== undefined;
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) {
  console.error("REFUSING: no database URL. For production run under `railway.cmd run --service MySQL`.");
  process.exit(1);
}
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port || "3306"}`);

const connection = await openDatabase(url);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

/* The kind's own word list, from the table that owns it — never a second copy
   typed here (working law 4). */
const { LANDMARK_OF_ACCESSORY } = await import("../server/castingV2/accessoryKinds");
const words = LANDMARK_OF_ACCESSORY.find((entry) => entry.region === "nose stud")?.words ?? [];
if (words.length === 0) throw new Error("the accessory table has no nose stud entry — nothing to search for");
console.log(`searching for: ${words.join(", ")}`);
console.log("");

const like = (column: string) => words.map(() => `${column} LIKE ?`).join(" OR ");
const args = words.map((word) => `%${word}%`);

const briefs = await query(
  `SELECT r.publicId AS roll, r.briefText, r.createdAt, s.userId,
          (SELECT COUNT(*) FROM casting_candidates c
            WHERE c.rollId = r.id AND c.status = 'ready' AND c.imageKey IS NOT NULL) AS ready
     FROM casting_rolls r
     JOIN casting_sessions s ON s.id = r.sessionId
    WHERE ${like("r.briefText")}
    ORDER BY r.createdAt DESC
    LIMIT 25`,
  args,
);
console.log(`BRIEFS asking for one: ${briefs.length}`);
for (const row of briefs) {
  console.log(`  ${row.createdAt?.toISOString?.() ?? row.createdAt} user ${row.userId} roll ${row.roll} `
    + `· ${row.ready} ready · "${String(row.briefText).slice(0, 110)}"`);
}

console.log("");
/* The refine text lives in a JSON column (`instructions`), not a varchar — so
   the search is over the stored JSON, which is what a LIKE on that column
   reads. Named rather than assumed: the first cut of this script asked for
   `v.instruction` and MySQL refused it outright, which is the good failure. */
const edits = await query(
  `SELECT v.publicId AS variant, v.instructions, v.createdAt, v.candidateId
     FROM casting_candidate_variants v
    WHERE ${like("v.instructions")}
    ORDER BY v.createdAt DESC
    LIMIT 25`,
  args,
);
console.log(`REFINE INSTRUCTIONS asking for one: ${edits.length}`);
for (const row of edits) {
  console.log(`  ${row.createdAt?.toISOString?.() ?? row.createdAt} variant ${row.variant} `
    + `· ${JSON.stringify(row.instructions).slice(0, 150)}`);
}

console.log("");
/* THE NEGATIVE CONTROL ON THE SEARCH ITSELF. A query that finds nothing is a
   claim about the key before it is a claim about the world (the shift-46
   lesson), so the same statement is driven on a word that certainly IS in the
   corpus. Zero here means the search is broken, not that nobody wears one. */
const control = await query(
  `SELECT COUNT(*) AS hits FROM casting_rolls r WHERE r.briefText LIKE ?`,
  ["%hair%"],
);
console.log(`control: the same query shape on "hair" finds ${control[0]?.hits ?? 0} briefs `
  + `— ${Number(control[0]?.hits ?? 0) > 0 ? "the search works" : "THE SEARCH IS BROKEN, ignore the zeros above"}`);

await connection.end();
process.exit(0);

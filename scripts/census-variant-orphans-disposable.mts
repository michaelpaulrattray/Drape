/**
 * WHAT WOULD `listOrphanedVariants` ACTUALLY RETURN — and can half of it ever
 * return anything at all?
 *
 * `server/db/castingV2Variants.ts:943` is a purge sweep with **no consumer
 * anywhere, not even a test** (CLEANUP_MILESTONE_TRIAGE §13c/§13d, FILED). The
 * filed question is: should the purge path run it, or is it debris the purge
 * outgrew? Neither answer is available without knowing what it would return.
 *
 * Read-only: SELECTs against `casting_candidate_variants` and
 * `casting_candidates`. No writes, no credits, no vision, no R2.
 *
 * # The finding that made this worth counting, read at the code first
 *
 * Its predicate is a disjunction:
 *
 *     expiresAt < now   OR   NOT EXISTS (the candidate row)
 *
 * and **`castingCandidateVariants.expiresAt` is written by nothing.** The
 * column exists and is indexed (`idx_casting_variants_expires`), and the only
 * reference to it in the entire server is this helper's own predicate —
 * `expiresAt` is stamped on the CANDIDATE (`db/castingV2.ts`, on discard), not
 * on the variant. So the first arm is dead by construction and only the second
 * can ever match.
 *
 * That is the whole reason for the `expiresAt NOT NULL` count below: it is the
 * arithmetic that turns "I read the writers and found none" into a fact about
 * the data. If it is 0, nothing has ever written the column; if it is not, the
 * code read was wrong and this script says so rather than the reader.
 *
 * # Controls (working law 2)
 *
 *   POSITIVE  visibility — unfiltered COUNT(*) per table.
 *   POSITIVE  the DETECTOR — the same NOT EXISTS with the parent set emptied
 *             (`1=0`), which must return the FULL variant count.
 *   ARITHMETIC closure — orphaned + parented must equal the total.
 *
 * A failing control refuses the verdict rather than annotating it.
 *
 *   npx tsx scripts/census-variant-orphans-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/census-variant-orphans-disposable.mts
 */

import "dotenv/config";

import { openDatabase, worldOf } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const KEY = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([KEY]);

const url = process.env[KEY]!;
const connection = await openDatabase(url);

const count = async (sql: string): Promise<number> => {
  const [rows] = await connection.query<Array<{ n: number }>>(sql);
  return Number(rows[0]?.n ?? -1);
};

const say = (line = "") => console.log(line);

say("=".repeat(84));
say(`VARIANT ORPHAN CENSUS — ${worldOf(url)}  (via ${KEY})`);
say("=".repeat(84));

const totalVariants = await count("SELECT COUNT(*) AS n FROM casting_candidate_variants");
const totalCandidates = await count("SELECT COUNT(*) AS n FROM casting_candidates");

say("");
say("CONTROL 1 — visibility. A blind reader prints zero orphans too.");
say(`  casting_candidate_variants  ${totalVariants}`);
say(`  casting_candidates          ${totalCandidates}`);

const detector = await count(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants v"
  + " WHERE NOT EXISTS (SELECT 1 FROM casting_candidates c WHERE c.id = v.candidateId AND 1=0)",
);
const detectorOk = detector === totalVariants;

say("");
say("CONTROL 2 — the DETECTOR, parent set emptied. Every row must come back an");
say("orphan, or a zero below is a fact about the query and not about the data.");
say(`  ${detector} of ${totalVariants}   ${detectorOk ? "pass" : "FAIL"}`);

const orphaned = await count(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants v"
  + " WHERE NOT EXISTS (SELECT 1 FROM casting_candidates c WHERE c.id = v.candidateId)",
);
const parented = await count(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants v"
  + " WHERE EXISTS (SELECT 1 FROM casting_candidates c WHERE c.id = v.candidateId)",
);
const closureOk = orphaned + parented === totalVariants;

say("");
say("CONTROL 3 — arithmetic closure.");
say(`  ${orphaned} + ${parented} = ${orphaned + parented} vs ${totalVariants}   ${closureOk ? "pass" : "FAIL"}`);

if (!detectorOk || !closureOk) {
  say("");
  say("CONTROLS FAILED — no verdict printed.");
  process.exit(1);
}

/* The arm that decides whether HALF this sweep can ever fire. */
const withExpiry = await count(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants WHERE expiresAt IS NOT NULL",
);
const expired = await count(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants WHERE expiresAt < NOW()",
);
/* And the same column on the table that DOES have a writer, as the positive
   control for the claim above: if candidates carry expiries and variants carry
   none, the asymmetry is the finding rather than an empty database. */
const candidatesWithExpiry = await count(
  "SELECT COUNT(*) AS n FROM casting_candidates WHERE expiresAt IS NOT NULL",
);

say("");
say("=".repeat(84));
say("THE READING");
say("=".repeat(84));
say("");
say(`  ARM 2 — candidate row gone        ${orphaned} of ${totalVariants}`);
say("      the only arm that can fire. These are variants whose candidate has");
say("      been purged; their imageKey/thumbKey are what the sweep would return.");
say("");
say(`  ARM 1 — expiresAt < now           ${expired}`);
say(`  variants carrying ANY expiresAt   ${withExpiry}`);
say(`  candidates carrying ANY expiresAt ${candidatesWithExpiry}   ← the control`);
say("      Nothing in the server writes the VARIANT column; the only reference");
say("      to it is the sweep's own predicate. If the two lines above read 0");
say("      against a non-zero candidate count, the code read is confirmed at");
say("      the data: half this sweep is dead by construction.");
say("");
say("=".repeat(84));

process.exit(0);

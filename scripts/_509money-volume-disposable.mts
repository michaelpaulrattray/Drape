/**
 * DISPOSABLE (#509 part 2, the money edges) — what money events production has
 * actually received, and how many accounts pay at all.
 *
 * Read at the rows rather than assumed. The decision it answers: should the
 * product event stream name every Stripe type this repository handles, or only
 * the four the card lists by name? Part 2 settled the same question the same way
 * (`_509p2-volume-read-disposable.mts`) and found that a map covering only the V2
 * operation kinds would have gone blind on 129 of 712 rows.
 *
 * ⚠ It opens the database through `openDatabase` rather than `mysql` directly —
 * which `server/scriptConnectionDiscipline.test.ts` caught the first shape of
 * this file for, correctly: that door forces `timezone: "Z"`, and this script
 * PRINTS TIMESTAMPS. A connection guessing a local zone would have put a
 * ten-hour shift on the first/last columns below, on this machine silently.
 */
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";

async function main(): Promise<number> {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error("no database url — pass one for a production read");
    return 1;
  }

  const conn = await openDatabase(url);
  try {
    const [byType] = await conn.query(
      `SELECT eventType, COUNT(*) AS n, MIN(processedAt) AS first, MAX(processedAt) AS last
         FROM stripe_webhook_events GROUP BY eventType ORDER BY n DESC`,
    );
    console.log("=== stripe_webhook_events by type (all time) ===");
    console.table(byType);

    const [total] = await conn.query(`SELECT COUNT(*) AS n FROM stripe_webhook_events`);
    console.log("total rows:", JSON.stringify(total));

    /* `points` is the credits table — the name is historical (`drizzle/schema.ts`
       declares `credits = mysqlTable("points", …)`), and reading it as
       `user_credits` is how the first run of this script died. */
    const [tiers] = await conn.query(
      `SELECT planTier, COUNT(*) AS n FROM points GROUP BY planTier ORDER BY n DESC`,
    );
    console.log("=== accounts by plan tier ===");
    console.table(tiers);

    const [bugs] = await conn.query(`SELECT COUNT(*) AS n FROM bug_reports`);
    console.log("bug_reports rows all time:", JSON.stringify(bugs));

    return 0;
  } finally {
    await conn.end();
  }
}

process.exit(await main());

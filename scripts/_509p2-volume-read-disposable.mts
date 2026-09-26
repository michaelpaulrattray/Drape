/**
 * #509 part 2 — HOW MANY EVENTS WOULD THIS STREAM ACTUALLY SEND?
 *
 * The transport's header states a price, and the disappearing-technology law's
 * clause 3 says a price beside a capability must be decision-grade rather than
 * decorative. The first draft of that paragraph cited *"295 rolls all time"*
 * out of `PROGRAM.md` — a document, read four days earlier. Law 7c: the code
 * and the rows are the artifact, a document is a report about them.
 *
 * So this counts generation operations at the real rows. Each one sends at most
 * three events (started, then delivered or failed), which is the multiplier the
 * header uses.
 *
 * READ ONLY. One SELECT, no writes, no credits, no provider call.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/_509p2-volume-read-disposable.mts
 */
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";

interface CountRow {
  window: string;
  operations: number;
}

async function main(): Promise<void> {
  /* `railway run --service MySQL` injects the DB vars under their own names,
     not as DATABASE_URL — the resolver is the one door that knows all three. */
  const db = await openDatabase(resolveDatabaseUrl());

  const [rows] = await db.query<CountRow[] & { constructor: unknown }>(
    `SELECT 'all time' AS \`window\`, COUNT(*) AS operations FROM generation_operations
     UNION ALL
     SELECT 'last 30 days', COUNT(*) FROM generation_operations WHERE createdAt >= NOW() - INTERVAL 30 DAY
     UNION ALL
     SELECT 'last 7 days', COUNT(*) FROM generation_operations WHERE createdAt >= NOW() - INTERVAL 7 DAY`,
  );

  console.log("generation operations — the population this stream would report on");
  for (const row of rows as unknown as CountRow[]) {
    const operations = Number(row.operations);
    console.log(
      `  ${row.window.padEnd(13)} ${String(operations).padStart(6)} operations · up to ${operations * 3} events`,
    );
  }

  const [kinds] = await db.query(
    `SELECT kind, COUNT(*) AS operations FROM generation_operations
     GROUP BY kind ORDER BY operations DESC LIMIT 12`,
  );
  console.log("\nby kind, all time:");
  for (const row of kinds as unknown as { kind: string; operations: number }[]) {
    console.log(`  ${row.kind.padEnd(32)} ${String(Number(row.operations)).padStart(6)}`);
  }

  await db.end();
}

await main();
process.exit(0);

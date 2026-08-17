/**
 * WHAT THE DEMAND TABLE HOLDS — and what it may NOT be read as.
 *
 * The day-one semantics, ordered onto this reader's header by fable-875 §5:
 * `delivered` and `refunded` are RENDER outcomes and were unreachable until 5b
 * wired the render's result back, so the first weeks of this table are a record
 * of asks and refusals rather than of deliveries. **Nobody may read a delivery
 * ratio out of this era.** A kind with ten `words_only` rows and no
 * `delivered` row has not failed ten times; it has been accepted ten times by a
 * lane that could not yet record what happened next.
 *
 * # 5b WIRED THE RENDER BACK, AND THE ERAS ARE TOLD APART BY THE ROW ITSELF
 *
 * From 2026-08-17 an accepted ask writes ONE row when the ask ENDS: `delivered`
 * when a crop was filed, `words_only` when it was served without one, `refunded`
 * when the money went back. `refused` still writes at the door. So a delivery
 * ratio becomes readable — for rows created after that date, and only those.
 * Before it, every accepted ask wrote `words_only` at the acceptance door before
 * any render had happened, so the two eras' `words_only` rows mean different
 * things and the timestamp is the only thing that separates them.
 *
 * **AND THIS TALLY UNDERCOUNTS, by design and in one direction.** A row is
 * written after the render settles, so a process death in between — a deploy
 * landing mid-render, a refund settled later by the recovery sweep — loses the
 * row entirely. The writer fails soft on purpose: a promotion signal may never
 * cost somebody the picture they paid for. The loss is unbiased (it does not
 * prefer one outcome) and it is small, but it is real, and a reader that knows
 * its own hole beats one that discovers it inside a ratio.
 *
 * And `unreadable` is not a failure of the customer's ask — it is the
 * scales-and-gills class, where the thing was delivered and the READER could
 * not see it (fable-872 §3). Counting it against a kind's viability inverts
 * what it means.
 *
 * # THE DEV TABLE IS CONTAMINATED BY ITS OWN INSTRUMENTS, and this is the
 * # warning that matters most
 *
 * The routing bench drives the REAL `interpretRefinement` against the dev
 * database, so **every open ask it fired wrote a real demand row**. Fourteen of
 * dev's first fifteen rows are mine: `scales` ×4, `fangs` ×3, `pupil` ×4,
 * `tail` ×2, `wings` ×2 — a corpus I chose, not a demand anybody expressed. The
 * shape of that list is the shape of my bench.
 *
 * A promotion decision read off dev would therefore promote whatever the last
 * bench happened to test — the specimen-joins-the-vocabulary class pointed at
 * the instrument that is supposed to decide promotions. **Read PRODUCTION for
 * demand.** Dev is for proving the writer works, and nothing else.
 *
 * # HOW TO RUN IT, and the two worlds are not interchangeable
 *
 *   npx tsx scripts/read-open-lane-demand.mts
 *     DEV, from `.env`. Proves the WRITER works. Not a demand record — see the
 *     contamination warning above.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-open-lane-demand.mts
 *     PRODUCTION, from `MYSQL_PUBLIC_URL`. **This is the demand record**, and
 *     the only table a promotion decision may be read off.
 *
 * # KEPT rather than disposable, and why
 *
 * This began as a one-off (`read-open-demand-disposable.mts`). It is tracked
 * now because the question it answers — *which uncatalogued kinds do people
 * keep asking for* — is not asked once: it is the input to every vocabulary
 * promotion, indefinitely. And the header above is the only place two facts are
 * written down that would cost real money to rediscover: that the pre-5b era
 * cannot be read as a delivery rate, and that dev's table is the bench's own
 * corpus wearing the shape of demand.
 *
 * # THE FIRST READING, so a later one has something to be a delta against
 *
 * 2026-08-17, the day the lane went live for user 1:
 *
 *   PRODUCTION  0 rows          nobody had made an open ask yet
 *   DEV        15 rows          14 of them the routing bench's, 1 the first walk
 *
 * Production's zero is a reading rather than a broken query: the same script,
 * the same statement, returned 15 rows from dev in the same sitting. A null
 * result is evidence only when the instrument could have produced a non-null.
 *
 * Read-only. Selects only. No transport, no credits.
 */
import "dotenv/config";
import { openDatabase } from "./lib/dbConnection.mts";

const production = process.env.MYSQL_PUBLIC_URL !== undefined;
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) {
  console.error("REFUSING: no database URL.");
  process.exit(1);
}
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port || "3306"}`);

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  "SELECT kind, outcome, COUNT(*) AS n, MIN(createdAt) AS first, MAX(createdAt) AS last "
  + "FROM casting_open_lane_demand GROUP BY kind, outcome ORDER BY n DESC, kind",
);
const [total] = await connection.query<any[]>(
  "SELECT COUNT(*) AS n, MIN(createdAt) AS first, MAX(createdAt) AS last FROM casting_open_lane_demand",
);
await connection.end();

console.log(`\n${total[0]?.n ?? 0} rows · ${total[0]?.first ?? "—"} → ${total[0]?.last ?? "—"}`);
console.log(`\nkind                 outcome        n   first seen`);
for (const row of rows) {
  console.log(`${String(row.kind).padEnd(20)} ${String(row.outcome).padEnd(12)} ${String(row.n).padStart(3)}   ${row.first}`);
}
console.log(`
READ THIS TABLE AS: how often somebody asked for a thing the catalogue does not
name, and how the DOOR answered. Not as a delivery rate. \`delivered\` and
\`refunded\` were unreachable before 5b, so their absence is the era's, not the
kind's; and \`unreadable\` means the reader could not see it, which is a fact
about our instrument rather than about the ask.`);
process.exit(0);

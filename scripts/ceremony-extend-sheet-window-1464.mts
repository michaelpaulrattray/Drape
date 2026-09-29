/**
 * ONE-OFF CEREMONY: PUT THE LIVE SHEETS ON THE THIRTY-DAY WINDOW (#1464).
 *
 * **His word, 2026-09-27 (terminal), verbatim and entire:**
 *
 * > *"id like to keep casting sheets for 30 days also not 7 days"*
 *
 * # Why the code change alone is not the whole ruling
 *
 * The window is stamped ONTO THE ROW, not read at the sweep: every touch of a
 * session writes `expiresAt = now + CASTING_SESSION_IDLE_MS`, and the sweep
 * compares that stored stamp against the clock. So the constant moving to
 * thirty days reaches a sheet only on its NEXT activity — a sheet he worked on
 * yesterday and then leaves alone would still be swept on the old seven-day
 * stamp, six days from now, by a product that has already promised thirty.
 *
 * That is the gap this closes, and it is exactly one UPDATE.
 *
 * # What it does
 *
 *     expiresAt := lastActivityAt + 30 days
 *
 * for every session that is still `open`, still carries a stamp, and has not
 * already expired. Written from `lastActivityAt` rather than as
 * `expiresAt + 23 days` for two reasons: it is the rule stated literally
 * (*thirty quiet days from the last activity*), and it is IDEMPOTENT — a second
 * run changes nothing, where `+ 23 days` would silently become forty-six.
 *
 * ⚠ **AN EXPIRED SHEET STAYS EXPIRED.** `expiresAt >= NOW()` is in the WHERE.
 * His earlier ruling is that a cleared sheet is GONE rather than reachable, and
 * a ceremony that resurrected one would be answering a question nobody asked;
 * the candidates and objects behind it may already have been purged, so the row
 * would come back as an empty page.
 *
 * ⚠ **AND `lastActivityAt` IS PINNED TO ITSELF IN THE SAME SET.** That column
 * is `ON UPDATE CURRENT_TIMESTAMP` (`drizzle/schema.ts`), so any write to the
 * row re-stamps it unless the statement names it. Without that clause this
 * ceremony would mark every unsigned sheet in the product as worked-on today —
 * every card reading *"Rolled today"*, and every sheet's clock restarted from
 * the ceremony rather than from the customer's own last visit. It writes the
 * column back to the value it already holds, which is what stops the trigger.
 *
 * # ⚠ IT IS A DRY RUN UNLESS YOU SAY `--apply`
 *
 *     railway.cmd run --service MySQL -- npx tsx scripts/ceremony-extend-sheet-window-1464.mts
 *     railway.cmd run --service MySQL -- npx tsx scripts/ceremony-extend-sheet-window-1464.mts --apply
 *
 * The dry run prints the population and the oldest and newest expiry it would
 * write, so the number on the card is read before anything moves.
 *
 * # Which wrapper, and why the script refuses without it
 *
 * `--service MySQL` is the only wrapper that injects a PUBLIC database address;
 * `--service Drape`'s `DATABASE_URL` is the private `mysql.railway.internal`
 * host, unreachable from a laptop. No dotenv import, deliberately: this script
 * exists to write PRODUCTION rows and the dev database differs from it only by
 * a port number (memory: two databases, compare the port).
 *
 * **It is run by the relay, once, after the code change deploys.** Running it
 * before the deploy is harmless but pointless — the next touch of any sheet
 * would re-stamp it on the old constant.
 */
import { openDatabase } from "./lib/dbConnection.mts";
import { CASTING_SESSION_IDLE_DAYS } from "../shared/castingRetention.js";

const apply = process.argv.includes("--apply");

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error(
    "REFUSING: MYSQL_PUBLIC_URL is not set. Run via " +
      "`railway.cmd run --service MySQL -- npx tsx scripts/ceremony-extend-sheet-window-1464.mts`",
  );
  process.exit(1);
}
if (!/railway|rlwy\.net|proxy/i.test(url)) {
  console.error("REFUSING: MYSQL_PUBLIC_URL does not look like the Railway database.");
  process.exit(1);
}

/* The live sheets, and only those: open, stamped, not already swept. */
const LIVE = "`status` = 'open' AND `expiresAt` IS NOT NULL AND `expiresAt` >= NOW()";

const conn = await openDatabase(url);
try {
  const [before] = await conn.query(
    "SELECT COUNT(*) AS live," +
      " SUM(`expiresAt` <> DATE_ADD(`lastActivityAt`, INTERVAL ? DAY)) AS toMove," +
      " MIN(DATE_ADD(`lastActivityAt`, INTERVAL ? DAY)) AS earliest," +
      " MAX(DATE_ADD(`lastActivityAt`, INTERVAL ? DAY)) AS latest" +
      ` FROM \`casting_sessions\` WHERE ${LIVE}`,
    [CASTING_SESSION_IDLE_DAYS, CASTING_SESSION_IDLE_DAYS, CASTING_SESSION_IDLE_DAYS],
  );
  const row = (before as Array<Record<string, unknown>>)[0]!;
  const toMove = Number(row.toMove ?? 0);

  console.log(`window     : ${CASTING_SESSION_IDLE_DAYS} quiet days (shared/castingRetention.ts)`);
  console.log(`live sheets: ${Number(row.live ?? 0)}`);
  console.log(`to move    : ${toMove}`);
  console.log(`new expiry : ${String(row.earliest ?? "—")} … ${String(row.latest ?? "—")}`);

  if (toMove === 0) {
    console.log("NOTHING TO DO — every live sheet already carries the window.");
  } else if (!apply) {
    console.log("DRY RUN — re-run with --apply to write.");
  } else {
    const [result] = await conn.query(
      "UPDATE `casting_sessions`" +
        " SET `expiresAt` = DATE_ADD(`lastActivityAt`, INTERVAL ? DAY)," +
        /* Pinned to itself, or ON UPDATE CURRENT_TIMESTAMP restarts every
           customer's clock and every card reads "Rolled today". */
        "     `lastActivityAt` = `lastActivityAt`" +
        ` WHERE ${LIVE}`,
      [CASTING_SESSION_IDLE_DAYS],
    );
    console.log(`updated    : ${Number((result as { affectedRows?: number }).affectedRows ?? 0)}`);

    /* THE READBACK DECIDES, not the UPDATE's silence. */
    const [after] = await conn.query(
      "SELECT COUNT(*) AS wrong FROM `casting_sessions`" +
        ` WHERE ${LIVE} AND \`expiresAt\` <> DATE_ADD(\`lastActivityAt\`, INTERVAL ? DAY)`,
      [CASTING_SESSION_IDLE_DAYS],
    );
    const wrong = Number((after as Array<{ wrong: unknown }>)[0]?.wrong ?? 0);
    if (wrong > 0) {
      throw new Error(`UPDATE ran but ${wrong} live sheet(s) still carry the old window — investigate.`);
    }
    console.log("APPLIED OK.");
  }
} finally {
  await conn.end();
}

/* A script exits when its work is done — an app service leaves the loop alive. */
process.exit(0);

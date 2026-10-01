/**
 * ONE-OFF CEREMONY: BRING EVERY EXISTING FREE ACCOUNT UP TO THE NEW SIGNUP
 * GRANT, AND PUT THE TABLE'S OWN DEFAULT ON IT (#1602, P1-3 under #1598).
 *
 * **His word, 2026-09-30 (terminal), on whether an account already holding the
 * old 1,000 displayed credits should be left beside a new signup's 2,700:**
 *
 * > *"yes"*
 *
 * So an existing free account is RAISED to the same grant, not left behind it.
 *
 * # Why this is a script and not a migration
 *
 * Two separate reasons, and they are different reasons:
 *
 * **1 · The rows are a ROW REWRITE, which the rite refuses by his own rule**
 * (#322): a `CREATE TABLE`, `ADD COLUMN` or `ADD INDEX` the code declares is
 * applied unattended, and a `DROP`, `RENAME`, type narrowing or row rewrite is
 * his ceremony alone. Raising a balance is money arriving in somebody's
 * account; it is not something a deploy should do on its own.
 *
 * **2 · The column DEFAULT could not be a migration file even if we wanted it
 * to be, and #1602's body said it could.** The card read *"the `points.balance`
 * schema default (a migration; additive, so it applies itself in the rite)"*.
 * Read at `scripts/lib/ceremonyAutoApply.mts`:
 *
 *   - `:208-216` — every clause of an `ALTER TABLE` must begin `ADD`. A
 *     `MODIFY COLUMN` or `ALTER COLUMN … SET DEFAULT` clause is classified
 *     **destructive** by its verb, so it never runs unattended.
 *   - `:289-294` with `MissingObjects` at `:108-112` — and this is the half
 *     that matters: the apply plan is driven entirely by **missing** tables,
 *     columns and indexes. A default on a column that already exists names no
 *     missing object, so the statement is never *wanted* by the plan — it would
 *     be neither applied NOR refused. A numbered migration carrying it would
 *     sit in `drizzle/` forever, reading as shipped, having never run.
 *
 * ⚠ So the honest shape is this one file: the rows and the default together,
 * by hand, once, because they are the same number.
 *
 * # Until it runs, the stored default being stale is HARMLESS, and that is
 * # checkable rather than hopeful
 *
 * Drizzle does not apply `.default()` client-side for MySQL — it omits the
 * column and lets the stored default answer. So a stale default would matter if
 * any INSERT omitted `balance`. None does: `initializeUserCredits` is the only
 * road that creates a row in this table, and it names the column.
 * `server/freeGrantOneTime.test.ts` holds both halves.
 *
 * # IDEMPOTENT BY THE LEDGER, NOT BY THE BALANCE
 *
 * ⚠ The tempting test is *"balance < grant"* alone, and it is wrong in a way
 * that only shows up later. A raised customer who then SPENDS down to 1,000
 * satisfies that predicate again, so a second run months from now would raise
 * them a second time — a free account topped up for ever.
 *
 * So the population is keyed on the LEDGER: an account is raised only if it
 * carries no `point_transactions` row with this ceremony's `referenceId`. That
 * column is half of a unique index (`uq_point_txn_user_ref` on
 * `(userId, referenceId)`, `drizzle/schema.ts:280`), so the claim is enforced
 * by the database and not by this script remembering. One row per account,
 * ever, whatever the balance has done in between.
 *
 * # The two writes are ONE transaction
 *
 * Either order torn in half is a defect, and they are different defects: ledger
 * first then a failed update is a receipt for money that never arrived; balance
 * first then a failed insert is money arriving with no receipt AND no claim, so
 * the next run raises them again. Both statements go inside one transaction,
 * and the balance UPDATE is a compare-and-set on the balance this script read —
 * so a concurrent spend makes the write MISS rather than overwrite it, and the
 * account is reported as skipped instead of silently clobbered.
 *
 * # ⚠ IT IS A DRY RUN UNLESS YOU SAY `--apply`
 *
 *     railway.cmd run --service MySQL -- npx tsx scripts/raise-free-grant-1602.mts
 *     railway.cmd run --service MySQL -- npx tsx scripts/raise-free-grant-1602.mts --apply
 *
 * The dry run prints the population, the total credits it would grant, and the
 * table's current stored default, so the numbers on #1609 are READ before
 * anything moves.
 *
 * # IT HAS BEEN DRIVEN, APPLY ARM AND ALL
 *
 * `scripts/_1602-ceremony-drive-disposable.mts` creates a THROWAWAY database on
 * the dev server, copies this table pair's real DDL out of dev with
 * `SHOW CREATE TABLE` — so the ceremony meets the live column types and the
 * unique index its idempotency rests on, rather than hand-written DDL that
 * could drift — seeds four accounts, one per property, and drops the database
 * after. **No shared row is touched.** 23 arms pass: the dry run writes
 * nothing; `--apply` raises, receipts and moves the default; a second
 * `--apply` is a no-op; an account above the grant is never lowered; a paid
 * account is never touched; and a raised account that SPENDS BACK DOWN is not
 * raised again. Three sabotages were run against this file and each reddened
 * exactly the property it broke — dropping the ledger claim, widening
 * `balance < grant`, and dropping the `planTier` filter.
 *
 * # Which wrapper, and why it refuses without one
 *
 * `--service MySQL` is the only wrapper that injects a PUBLIC database address;
 * `--service Drape`'s `DATABASE_URL` is the private `mysql.railway.internal`
 * host, unreachable from a laptop. No `dotenv` import, deliberately: this
 * script writes PRODUCTION rows and the dev database differs from production
 * only by a port number (memory: *two databases, compare the port*).
 *
 * **It is the relay's or his hand at go-live (#1609, P1-10), after the code
 * change deploys** — and #1609's own first step is to count live subscribers
 * before any grant changes. Running it before the deploy is not harmful but it
 * is pointless: a new signup would still be granted the old amount.
 */
import { openDatabase } from "./lib/dbConnection.mts";
import { FREE_SIGNUP_GRANT_CREDITS } from "../drizzle/schema.js";

/**
 * The ledger claim. ⚠ **Never change this string.** It is what makes a second
 * run a no-op; a new value would raise every account again.
 */
const REFERENCE_ID = "p1-3-free-grant-raise";

const apply = process.argv.includes("--apply");

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error(
    "REFUSING: MYSQL_PUBLIC_URL is not set. Run via "
    + "`railway.cmd run --service MySQL -- npx tsx scripts/raise-free-grant-1602.mts`",
  );
  process.exit(1);
}

type Candidate = { userId: number; balance: number };

const conn = await openDatabase();
try {
  /* THE STORED DEFAULT, read rather than assumed — this is the fact that the
     schema declaration cannot tell you. */
  const [defaultRows] = await conn.query<Array<{ COLUMN_DEFAULT: string | null }>>(
    "SELECT `COLUMN_DEFAULT` FROM `information_schema`.`COLUMNS`"
    + " WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'points' AND `COLUMN_NAME` = 'balance'",
  );
  const storedDefault = defaultRows[0]?.COLUMN_DEFAULT ?? null;
  if (storedDefault === null) {
    throw new Error("could not read points.balance's stored default — refusing rather than guessing");
  }

  /*
    THE POPULATION, keyed on the ledger claim and not on the balance. The LEFT
    JOIN is the "has not been raised" test; `balance < grant` is the "needs
    raising" test. An account above the grant is never lowered.
  */
  const [candidates] = await conn.query<Array<Candidate>>(
    "SELECT p.`userId` AS userId, p.`balance` AS balance"
    + " FROM `points` p"
    + " LEFT JOIN `point_transactions` t"
    + "   ON t.`userId` = p.`userId` AND t.`referenceId` = ?"
    + " WHERE p.`planTier` = 'free' AND p.`balance` < ? AND t.`id` IS NULL"
    + " ORDER BY p.`userId`",
    [REFERENCE_ID, FREE_SIGNUP_GRANT_CREDITS],
  );

  const [freeRows] = await conn.query<Array<{ n: number }>>(
    "SELECT COUNT(*) AS n FROM `points` WHERE `planTier` = 'free'",
  );
  const [claimed] = await conn.query<Array<{ n: number }>>(
    "SELECT COUNT(*) AS n FROM `point_transactions` WHERE `referenceId` = ?",
    [REFERENCE_ID],
  );

  const toGrant = candidates.reduce(
    (sum, row) => sum + (FREE_SIGNUP_GRANT_CREDITS - Number(row.balance)),
    0,
  );

  console.log(`world         : ${url.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log(`grant         : ${FREE_SIGNUP_GRANT_CREDITS.toLocaleString()} ledger units (drizzle/schema.ts)`);
  console.log(`stored default: ${storedDefault}${String(storedDefault) === String(FREE_SIGNUP_GRANT_CREDITS) ? " — already correct" : " — WILL BE MOVED"}`);
  console.log(`free accounts : ${Number(freeRows[0]?.n ?? 0)}`);
  console.log(`already raised: ${Number(claimed[0]?.n ?? 0)} (ledger rows carrying ${REFERENCE_ID})`);
  console.log(`to raise      : ${candidates.length}`);
  console.log(`credits to add: ${toGrant.toLocaleString()}`);
  for (const row of candidates) {
    console.log(`  user ${row.userId}: ${Number(row.balance).toLocaleString()} -> ${FREE_SIGNUP_GRANT_CREDITS.toLocaleString()}`);
  }

  const defaultNeedsMoving = String(storedDefault) !== String(FREE_SIGNUP_GRANT_CREDITS);

  if (candidates.length === 0 && !defaultNeedsMoving) {
    console.log("NOTHING TO DO — every free account is on the grant and the default agrees.");
  } else if (!apply) {
    console.log("DRY RUN — re-run with --apply to write.");
  } else {
    let raised = 0;
    const skipped: number[] = [];

    for (const row of candidates) {
      const was = Number(row.balance);
      await conn.beginTransaction();
      try {
        /*
          COMPARE-AND-SET on the balance this script read. A spend landing
          between the SELECT above and here makes this miss, and the account is
          REPORTED rather than overwritten — invariant 1's check-then-write race
          pointed at a ceremony.
        */
        const [result] = await conn.query<{ affectedRows?: number }>(
          "UPDATE `points` SET `balance` = ? WHERE `userId` = ? AND `balance` = ?",
          [FREE_SIGNUP_GRANT_CREDITS, row.userId, was],
        );
        if (Number(result?.affectedRows ?? 0) === 0) {
          await conn.rollback();
          skipped.push(row.userId);
          continue;
        }
        /* The receipt, and the claim that makes a re-run a no-op. */
        await conn.query(
          "INSERT INTO `point_transactions`"
          + " (`userId`, `amount`, `type`, `description`, `referenceId`, `balanceAfter`)"
          + " VALUES (?, ?, 'bonus', ?, ?, ?)",
          [
            row.userId,
            FREE_SIGNUP_GRANT_CREDITS - was,
            "Free plan credits raised to the current signup grant",
            REFERENCE_ID,
            FREE_SIGNUP_GRANT_CREDITS,
          ],
        );
        await conn.commit();
        raised += 1;
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }

    console.log(`raised        : ${raised}`);
    if (skipped.length > 0) {
      console.log(`skipped       : ${skipped.join(", ")} — balance moved mid-run; re-run to pick them up`);
    }

    if (defaultNeedsMoving) {
      await conn.query(
        `ALTER TABLE \`points\` ALTER COLUMN \`balance\` SET DEFAULT ${FREE_SIGNUP_GRANT_CREDITS}`,
      );
      console.log(`default       : moved ${storedDefault} -> ${FREE_SIGNUP_GRANT_CREDITS}`);
    }

    /*
      THE READBACK DECIDES, not the writes' silence. Two questions: does any
      unclaimed free account still sit below the grant, and does the stored
      default now agree with the code.
    */
    const [after] = await conn.query<Array<{ wrong: number }>>(
      "SELECT COUNT(*) AS wrong FROM `points` p"
      + " LEFT JOIN `point_transactions` t"
      + "   ON t.`userId` = p.`userId` AND t.`referenceId` = ?"
      + " WHERE p.`planTier` = 'free' AND p.`balance` < ? AND t.`id` IS NULL",
      [REFERENCE_ID, FREE_SIGNUP_GRANT_CREDITS],
    );
    const [afterDefault] = await conn.query<Array<{ COLUMN_DEFAULT: string | null }>>(
      "SELECT `COLUMN_DEFAULT` FROM `information_schema`.`COLUMNS`"
      + " WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'points' AND `COLUMN_NAME` = 'balance'",
    );
    const wrong = Number(after[0]?.wrong ?? 0);
    const nowDefault = afterDefault[0]?.COLUMN_DEFAULT ?? null;

    if (skipped.length === 0 && wrong > 0) {
      throw new Error(`ran clean but ${wrong} free account(s) are still below the grant — investigate.`);
    }
    if (String(nowDefault) !== String(FREE_SIGNUP_GRANT_CREDITS)) {
      throw new Error(`the stored default is still ${nowDefault} — the ALTER did not take.`);
    }
    console.log(`readback      : ${wrong} below grant · default ${nowDefault}`);
    console.log("APPLIED OK.");
  }
} finally {
  await conn.end();
}

/* A script exits when its work is done — an app service leaves the loop alive. */
process.exit(0);

/**
 * DRIVER for `scripts/raise-free-grant-1602.mts` (#1602, P1-3).
 *
 * A money ceremony whose APPLY arm has never run is the "accept arm inert by
 * construction" risk: the dry run exercises the SELECTs and nothing else, so
 * the UPDATE, the ledger INSERT, the transaction, the ALTER and the readback
 * are all unproven. This drives every one of them.
 *
 * ⚠ **It does NOT touch a shared row.** The builder-seat rule is that a fact a
 * proof needs is injected rather than written to the shared dev database, so
 * this creates a THROWAWAY database on the same server, copies the two tables'
 * REAL DDL out of dev with `SHOW CREATE TABLE` — not hand-written DDL, so the
 * ceremony meets the live column types and the `uq_point_txn_user_ref` unique
 * index that its idempotency rests on — seeds its own accounts, runs the
 * committed ceremony against it, and drops the database.
 *
 * The journal replay the other disposable drivers use was deliberately NOT
 * reused: `drizzle/meta/_journal.json` stops at idx 26 while the tree holds 70
 * migrations, so a replayed `points` would be missing columns the live one has.
 * Copying the live DDL cannot go stale.
 *
 *     npx tsx scripts/_1602-ceremony-drive-disposable.mts
 */
import { spawn } from "node:child_process";
import "dotenv/config";
import { openDatabase } from "./lib/dbConnection.mts";
import { FREE_SIGNUP_GRANT_CREDITS } from "../drizzle/schema.js";

const GRANT = FREE_SIGNUP_GRANT_CREDITS;
const CEREMONY = "scripts/raise-free-grant-1602.mts";
const REFERENCE_ID = "p1-3-free-grant-raise";

/* The DEV world by name — this driver creates and drops a database, which is
   never something to do by accident inside a production wrapper. */
const devUrl = process.env.DATABASE_URL;
if (!devUrl) throw new Error("no DATABASE_URL in .env — this driver runs against the dev server only");
if (process.env.MYSQL_PUBLIC_URL && process.env.MYSQL_PUBLIC_URL !== devUrl) {
  throw new Error("REFUSING: this driver creates and drops databases and is inside a production wrapper");
}

const databaseName = `drape_1602_${Date.now()}`;
const scratchUrl = new URL(devUrl);
scratchUrl.pathname = `/${databaseName}`;

const failures: string[] = [];
const check = (label: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures.push(label);
};

function runCeremony(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    let out = "";
    const child = spawn("npx", ["tsx", CEREMONY, ...args], {
      shell: process.platform === "win32",
      env: {
        ...process.env,
        /* The ceremony's only door, pointed at the throwaway database. */
        MYSQL_PUBLIC_URL: scratchUrl.toString(),
        DATABASE_URL: scratchUrl.toString(),
      },
    });
    child.stdout?.on("data", (d) => { out += String(d); });
    child.stderr?.on("data", (d) => { out += String(d); });
    child.on("exit", (code) => resolve({ code: code ?? 1, out }));
  });
}

const server = await openDatabase(devUrl);
try {
  /* THE REAL SHAPE, copied rather than retyped. */
  const [pointsDdl] = await server.query<Array<Record<string, string>>>("SHOW CREATE TABLE `points`");
  const [txnDdl] = await server.query<Array<Record<string, string>>>("SHOW CREATE TABLE `point_transactions`");
  const ddlOf = (row: Record<string, string>) => row["Create Table"];

  await server.query(`CREATE DATABASE \`${databaseName}\``);
  console.log(`created disposable database ${databaseName}`);
  try {
    await server.changeUser({ database: databaseName });
    await server.query(ddlOf(pointsDdl[0]));
    await server.query(ddlOf(txnDdl[0]));

    /* The unique index the idempotency claim rests on arrived with the DDL —
       asserted, because a copy that silently lost it would make every arm
       below pass for the wrong reason. */
    const [idx] = await server.query<Array<{ Non_unique: number }>>(
      "SHOW INDEX FROM `point_transactions` WHERE Key_name = 'uq_point_txn_user_ref'",
    );
    check("the copied DDL carries uq_point_txn_user_ref as UNIQUE",
      idx.length > 0 && Number(idx[0].Non_unique) === 0);

    /* The stored default came with the DDL too: dev's is 5000, which is the
       state production will be in when the ceremony runs. */
    const storedDefault = async () => {
      const [rows] = await server.query<Array<{ COLUMN_DEFAULT: string | null }>>(
        "SELECT `COLUMN_DEFAULT` FROM `information_schema`.`COLUMNS`"
        + " WHERE `TABLE_SCHEMA` = ? AND `TABLE_NAME` = 'points' AND `COLUMN_NAME` = 'balance'",
        [databaseName],
      );
      return rows[0]?.COLUMN_DEFAULT ?? null;
    };
    check("the scratch table starts on the OLD default", String(await storedDefault()) === "5000",
      `default ${await storedDefault()}`);

    /*
      FOUR SEEDED ACCOUNTS, one per property:
        1 — a plain free account at the old grant         → raised
        2 — a free account that has SPENT most of it      → raised to the grant, not topped by a delta
        3 — a free account ABOVE the grant                → never lowered
        4 — a PAID account below the grant                → never touched
    */
    await server.query(
      "INSERT INTO `points` (`userId`, `balance`, `planTier`) VALUES"
      + " (1, 5000, 'free'), (2, 365, 'free'), (3, 99000, 'free'), (4, 100, 'starter')",
    );

    console.log("\n--- arm 1: the dry run reports and writes nothing ---");
    const dry = await runCeremony([]);
    check("dry run exits 0", dry.code === 0, `exit ${dry.code}`);
    check("dry run says DRY RUN", dry.out.includes("DRY RUN"));
    check("dry run counts 2 to raise", /to raise      : 2\b/.test(dry.out));
    const [afterDry] = await server.query<Array<{ n: number }>>("SELECT COUNT(*) AS n FROM `point_transactions`");
    check("dry run wrote NO ledger row", Number(afterDry[0]?.n ?? -1) === 0);
    const [dryBalances] = await server.query<Array<{ userId: number; balance: number }>>(
      "SELECT `userId`, `balance` FROM `points` ORDER BY `userId`",
    );
    check("dry run moved NO balance",
      JSON.stringify(dryBalances.map((r) => Number(r.balance))) === JSON.stringify([5000, 365, 99000, 100]));
    check("dry run left the default alone", String(await storedDefault()) === "5000");

    console.log("\n--- arm 2: --apply raises, receipts, and moves the default ---");
    const applied = await runCeremony(["--apply"]);
    check("apply exits 0", applied.code === 0, `exit ${applied.code}`);
    check("apply says APPLIED OK", applied.out.includes("APPLIED OK"));

    const [balances] = await server.query<Array<{ userId: number; balance: number }>>(
      "SELECT `userId`, `balance` FROM `points` ORDER BY `userId`",
    );
    const got = Object.fromEntries(balances.map((r) => [Number(r.userId), Number(r.balance)]));
    check("user 1 raised to the grant", got[1] === GRANT, `balance ${got[1]}`);
    check("user 2 raised TO the grant (not by a delta)", got[2] === GRANT, `balance ${got[2]}`);
    check("⚠ user 3 above the grant was NOT lowered", got[3] === 99000, `balance ${got[3]}`);
    check("⚠ user 4 on a PAID plan was NOT touched", got[4] === 100, `balance ${got[4]}`);

    const [rows] = await server.query<Array<{
      userId: number; amount: number; type: string; referenceId: string; balanceAfter: number;
    }>>("SELECT `userId`, `amount`, `type`, `referenceId`, `balanceAfter` FROM `point_transactions` ORDER BY `userId`");
    check("one ledger row per raised account, and only those", rows.length === 2, `${rows.length} row(s)`);
    check("each row carries the ceremony's reference",
      rows.every((r) => r.referenceId === REFERENCE_ID));
    check("each row's amount is what actually arrived",
      Number(rows[0]?.amount) === GRANT - 5000 && Number(rows[1]?.amount) === GRANT - 365,
      `${rows.map((r) => Number(r.amount)).join(", ")}`);
    check("each row's balanceAfter is the new balance",
      rows.every((r) => Number(r.balanceAfter) === GRANT));
    check("the rows are a grant, typed bonus", rows.every((r) => r.type === "bonus"));
    check("the stored default moved to the grant", String(await storedDefault()) === String(GRANT),
      `default ${await storedDefault()}`);

    console.log("\n--- arm 3: ⚠ IDEMPOTENT — a second apply is a no-op ---");
    const again = await runCeremony(["--apply"]);
    check("second apply exits 0", again.code === 0, `exit ${again.code}`);
    check("second apply says NOTHING TO DO", again.out.includes("NOTHING TO DO"));
    const [rowsAgain] = await server.query<Array<{ n: number }>>("SELECT COUNT(*) AS n FROM `point_transactions`");
    check("still exactly 2 ledger rows", Number(rowsAgain[0]?.n ?? -1) === 2);

    console.log("\n--- arm 4: ⚠ A RAISED ACCOUNT THAT SPENDS DOWN IS NOT RAISED AGAIN ---");
    /*
      THE ARM THE OBVIOUS IMPLEMENTATION FAILS. Keyed on `balance < grant`
      alone, this account satisfies the predicate again and would be topped up
      for ever. The ledger claim is what refuses it.
    */
    await server.query("UPDATE `points` SET `balance` = 200 WHERE `userId` = 1");
    const third = await runCeremony(["--apply"]);
    check("third apply exits 0", third.code === 0, `exit ${third.code}`);
    check("the spent-down account is NOT in the population", /to raise      : 0\b/.test(third.out));
    const [spent] = await server.query<Array<{ balance: number }>>(
      "SELECT `balance` FROM `points` WHERE `userId` = 1",
    );
    check("its balance was left where the customer spent it", Number(spent[0]?.balance) === 200,
      `balance ${spent[0]?.balance}`);
    const [rowsThird] = await server.query<Array<{ n: number }>>("SELECT COUNT(*) AS n FROM `point_transactions`");
    check("and no second receipt was written", Number(rowsThird[0]?.n ?? -1) === 2);

    console.log(`\n${failures.length === 0 ? "ALL ARMS PASS" : `${failures.length} ARM(S) FAILED`}`);
    for (const f of failures) console.log(`  failed: ${f}`);
  } finally {
    await server.changeUser({ database: undefined as never }).catch(() => undefined);
    await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    console.log(`dropped disposable database ${databaseName}`);
  }
} finally {
  await server.end();
}

process.exit(failures.length === 0 ? 0 : 1);

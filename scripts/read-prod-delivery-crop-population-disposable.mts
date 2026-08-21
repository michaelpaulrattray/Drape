/**
 * DISPOSABLE, READ-ONLY — WHOSE Casts hold a delivered ink crop in PRODUCTION?
 *
 * The sign-view wire (a6550e6a) carries a branch's delivered tattoos into the
 * six package views, and it shipped WITHOUT a flag on one stated condition
 * (fable-1303 §1): *the wire's population IS the ink doors' population*, which
 * are all `users:1`.
 *
 * That premise is doubted at the code: `WORDS_ROAD_PLACEMENTS` serves `neck`
 * with `CASTING_INK_WORDS_SCOPE` OFF, and the words ink road's parent is
 * `CASTING_V2_SCOPE` — which is `all`. So a words-born neck tattoo may be
 * reachable by any account, and every delivering render mints a crop.
 *
 * This asks the rows rather than the premise. It reads production, writes
 * nothing, migrates nothing, and never prints a credential.
 */
import { spawnSync } from "node:child_process";
import { openDatabase } from "./lib/dbConnection.mts";

const railway = (...args: string[]): string => {
  const result = spawnSync("railway.cmd", args, { encoding: "utf8", shell: true });
  if (result.status !== 0) throw new Error(`railway ${args[0]} failed: ${(result.stderr ?? "").slice(0, 200)}`);
  return result.stdout ?? "";
};

const url = railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
  ?.slice("MYSQL_PUBLIC_URL=".length);

if (!url) {
  console.log("UNREAD — MYSQL_PUBLIC_URL not readable from this shell");
  process.exit(1);
}

const parsed = new URL(url);
console.log(`[db] ${parsed.hostname}:${parsed.port}${parsed.pathname}`);

const connection = await openDatabase(url);
try {
  const [present] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'casting_ink_delivery_crops'",
  );
  if ((present as unknown[]).length === 0) {
    console.log("casting_ink_delivery_crops — ABSENT in production (migration 0049 not run)");
    console.log("So the wire's population in production is EMPTY, whatever the flags say.");
    process.exit(0);
  }

  /* WHOSE crops — through the candidate, which is what carries the owner. */
  const [byUser] = await connection.query(
    `SELECT crop.userId AS userId,
            COUNT(*) AS crops,
            COUNT(DISTINCT crop.candidateId) AS casts,
            SUM(crop.designId IS NULL) AS wordsBorn,
            GROUP_CONCAT(DISTINCT crop.slot ORDER BY crop.slot) AS slots,
            MIN(crop.createdAt) AS firstAt,
            MAX(crop.createdAt) AS lastAt
       FROM casting_ink_delivery_crops crop
      GROUP BY crop.userId
      ORDER BY crops DESC`,
  );
  console.log("\nDELIVERY CROPS BY OWNER (the wire's whole population):");
  console.table(byUser);

  /* And of those, whose Cast is SIGNED — the ones the wire actually reaches. */
  const [signed] = await connection.query(
    `SELECT crop.userId AS userId, COUNT(DISTINCT m.id) AS signedCastsWithCrops
       FROM casting_ink_delivery_crops crop
       JOIN models m ON m.sourceCandidateId = crop.candidateId
      GROUP BY crop.userId`,
  );
  console.log("\nOF THOSE, ALREADY SIGNED (a Sign re-run would carry them):");
  console.table(signed);
} finally {
  await connection.end();
}

/* A SCRIPT ENDS BY ENDING THE PROCESS — the mysql pool holds the event loop
   open with all its work done, and eighteen such processes were once found
   alive from the previous day. */
process.exit(0);

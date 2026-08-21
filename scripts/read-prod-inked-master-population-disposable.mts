/**
 * DISPOSABLE, READ-ONLY — is there a POPULATION of masters carrying rolled-in
 * ink, and can it be split into a likely-inked arm and a plain arm?
 *
 * §10 item 2 asks two things of the readers (opus-956 §7): does a describer
 * NAME tattoos on a master, and does the segmenter FIND them. Neither question
 * is answerable without a sample that could produce a non-null — a clean null
 * over plain masters would be evidence of nothing (`null-result-needs-a-fixture`).
 *
 * So this finds the arms before any money is spent: masters whose ROLL BRIEF
 * asked for ink (the likely-inked arm, and the positive control) against
 * masters whose brief never mentions it (the plain arm, and the negative
 * control that stops a reader which says yes to everything from scoring).
 *
 * Reads production. Writes nothing, migrates nothing, prints no credential and
 * prints no brief text — a brief is the customer's creative content.
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

/* The words a customer uses for ink. Deliberately broad — this is a SAMPLING
   filter, never a gate, so a false positive costs one read and a false negative
   costs nothing at all. */
const INK_WORDS = ["tattoo", "tatto", "tatoo", "ink", "sleeve", "inked"];
const like = INK_WORDS.map(() => "LOWER(r.briefText) LIKE ?").join(" OR ");
const params = INK_WORDS.map((word) => `%${word}%`);

const connection = await openDatabase(url);
try {
  const [totals] = await connection.query(
    `SELECT COUNT(*) AS masters,
            SUM(${like}) AS briefMentionsInk
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
      WHERE c.imageKey IS NOT NULL`,
    params,
  );
  console.log("\nMASTERS IN PRODUCTION (a master = candidate.imageKey, the pristine roll frame):");
  console.table(totals);

  const [inked] = await connection.query(
    `SELECT c.id, c.publicId, c.userId, c.imageKey, c.createdAt
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
      WHERE c.imageKey IS NOT NULL AND (${like})
      ORDER BY c.createdAt DESC
      LIMIT 12`,
    params,
  );
  console.log(`\nARM A — brief ASKED for ink (${(inked as unknown[]).length} shown):`);
  console.table(inked);

  const [plain] = await connection.query(
    `SELECT c.id, c.publicId, c.userId, c.imageKey, c.createdAt
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
      WHERE c.imageKey IS NOT NULL AND NOT (${like})
      ORDER BY c.createdAt DESC
      LIMIT 6`,
    params,
  );
  console.log(`\nARM B — brief never mentions ink (${(plain as unknown[]).length} shown):`);
  console.table(plain);
} finally {
  await connection.end();
}

/* A SCRIPT ENDS BY ENDING THE PROCESS. */
process.exit(0);

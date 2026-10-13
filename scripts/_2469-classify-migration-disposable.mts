/**
 * #2469 — prove the deploy rite's own classifier reads every statement of
 * `drizzle/0083_cast_voices.sql` as ADDITIVE, so production applies it
 * unattended and no ceremony reaches the founder. Reads files only; no
 * database, no network.
 *
 * The control is the second half: a DESTRUCTIVE statement in the same shape
 * must be refused, or a green reading here says nothing.
 *
 *   npx tsx scripts/_2469-classify-migration-disposable.mts
 */
import { readFileSync } from "node:fs";

import { classifyStatement, statementsFrom } from "./lib/ceremonyAutoApply.mts";

const file = "drizzle/0083_cast_voices.sql";
const statements = statementsFrom([{ name: file, sql: readFileSync(file, "utf8") }]);

console.log(`${file} — ${statements.length} statement(s)`);
let allAdditive = true;
for (const statement of statements) {
  const additive = statement.kind === "additive";
  if (!additive) allAdditive = false;
  console.log(
    `  ${additive ? "ADDITIVE " : "REFUSED  "} ${statement.kind.padEnd(12)} ` +
      `${statement.createsTables.join(",") || statement.sql.slice(0, 60).replace(/\s+/g, " ")}` +
      `${statement.reason ? ` — ${statement.reason}` : ""}`,
  );
}

console.log(`\nverdict: ${allAdditive ? "every statement additive — applies unattended" : "NOT all additive"}`);

/* CONTROL — the classifier must still refuse a destructive statement. */
const destructive = classifyStatement("DROP TABLE `cast_voices`;", file);
const narrowing = classifyStatement(
  "ALTER TABLE `cast_voices` MODIFY COLUMN `clipSha256` varchar(8);",
  file,
);
console.log(
  `control: DROP reads "${destructive.kind}", MODIFY reads "${narrowing.kind}" ` +
    `— ${destructive.kind !== "additive" && narrowing.kind !== "additive" ? "both refused, so the reading above means something" : "⚠ CONTROL FAILED"}`,
);

process.exit(0);

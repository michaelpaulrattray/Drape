/**
 * WHICH VARIANT OF THIS FACE IS WEARING THE HOOPS — read the chain, pick the
 * branch a removal can actually be asked on.
 *
 * The earring acceptance refused for free on the master: *"Her brief didn't ask
 * for earrings, and nothing since has added any."* Correct — the master's
 * record has no earrings in it, and the library rows belong to a BRANCH. A
 * removal is asked of a branch state, so the walk has to stand on the variant
 * where the hoops were added.
 *
 * Read-only, dev.
 *
 *   npx tsx scripts/read-candidate-chain-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const FACE = process.env.FACE ?? "4c98c7fc-453c-4666-9a2c-86a393ade900";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const where = new URL((process.env[key] ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: ${key} → ${where.hostname}:${where.port}`);
const connection = await openDatabase(process.env[key]!);

const [candidates] = await connection.query<any[]>(
  "SELECT id, publicId, selectedVariantId FROM casting_candidates WHERE publicId = ?", [FACE],
);
const candidate = candidates[0];
console.log(`candidate #${candidate.id} · selected variant ${candidate.selectedVariantId ?? "(the master)"}`);

const [rows] = await connection.query<any[]>(
  `SELECT id, publicId, status, parentVariantId, requestText, instructions, imageKey, createdAt
     FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id`, [candidate.id],
);
console.log(`\n${rows.length} variant(s)`);
for (const row of rows) {
  const instructions = typeof row.instructions === "string"
    ? (() => { try { return JSON.parse(row.instructions); } catch { return null; } })()
    : row.instructions;
  const said = Array.isArray(instructions) ? instructions.join(" → ") : JSON.stringify(instructions ?? "");
  console.log(`  #${row.id} ${row.publicId} ${String(row.status).padEnd(7)} parent ${String(row.parentVariantId ?? "—").padEnd(5)}`
    + ` "${row.requestText}"  ${utc(row.createdAt)}`);
  console.log(`      record: ${said.slice(0, 150)}`);
}

const [refs] = await connection.query<any[]>(
  `SELECT id, variantId, role, slot, retiredAt FROM casting_reference_library
    WHERE candidateId = ? ORDER BY id`, [candidate.id],
);
console.log(`\nlibrary rows and the variant each was written against`);
for (const row of refs) {
  console.log(`  #${row.id} ${String(row.role).padEnd(7)} ${String(row.slot).padEnd(14)} variant ${row.variantId}${row.retiredAt ? " RETIRED" : ""}`);
}

await connection.end();
process.exit(0);

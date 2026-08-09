/**
 * THE SPECIMENS B, C AND D NEED, FOUND IN ROWS RATHER THAN CHOSEN BY HOPE.
 *
 * `drive-finding-replay.mts --controls` has three controls that have never been
 * armed, each waiting on a pair of frames that already exist or do not:
 *
 *   B  a DELIBERATE accessory replacement between two frames of one branch
 *      (hoops → crosses). The comparison must come back DIFFERENT, or the
 *      arithmetic is measuring the wrong region.
 *   D  a frame whose hair is DOWN and its parent whose hair is UP — so "still
 *      down" is a reading that has been able to say otherwise.
 *
 * This finds them: every variant on his account with its parent pointer, its
 * own sentence, and whether the recipe names `hairWorn` or `statedAccessories`.
 * Read-only — no row written, no model asked, nothing charged.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/find-replay-controls-disposable.mts
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const url = process.env[databaseKey];
if (!url) throw new Error("no database url — run under `railway run --service MySQL`");

const OPEN_ID = "google_109438922864282769159";
const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const [owner] = await query("SELECT id FROM users WHERE openId = ? LIMIT 1", [OPEN_ID]);
if (!owner) throw new Error(`no account for ${OPEN_ID} — wrong world`);

const rows = await query(
  `SELECT id, publicId, candidateId, parentVariantId, status, requestText, imageKey,
          instructions, deltas, createdAt
     FROM casting_candidate_variants
    WHERE userId = ? AND createdAt > DATE_SUB(NOW(), INTERVAL 45 DAY)
    ORDER BY candidateId ASC, id ASC`,
  [owner.id],
);

const parse = (value: unknown): any => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return value;
};

const byId = new Map<number, any>(rows.map((row) => [row.id, row]));
console.log(`${rows.length} variants on account ${owner.id}\n`);

/** What the composed recipe says about the two facets these controls turn on. */
function facets(row: any): { hairWorn: string | null; accessories: string | null } {
  const deltas = parse(row.deltas) ?? {};
  const worn = deltas.hairWorn ?? deltas["hair.worn"] ?? null;
  const accessories = deltas.statedAccessories ?? null;
  return {
    hairWorn: worn === null || worn === undefined ? null : String(worn),
    accessories: accessories === null || accessories === undefined
      ? null
      : (Array.isArray(accessories) ? accessories.join(" + ") : String(accessories)),
  };
}

let currentCandidate: number | null = null;
for (const row of rows) {
  if (row.candidateId !== currentCandidate) {
    currentCandidate = row.candidateId;
    console.log(`\n--- candidate ${row.candidateId}`);
  }
  const own = facets(row);
  const parent = row.parentVariantId ? byId.get(row.parentVariantId) : null;
  const parentFacets = parent ? facets(parent) : null;
  console.log(
    `v#${row.id}  ${row.status.padEnd(8)}  parent=${row.parentVariantId ?? "candidate"}`
    + `  "${String(row.requestText ?? "").slice(0, 46)}"`,
  );
  console.log(
    `        hairWorn=${own.hairWorn ?? "-"}`
    + (parentFacets ? ` (parent: ${parentFacets.hairWorn ?? "-"})` : "")
    + `  accessories=${own.accessories ?? "-"}`
    + (parentFacets ? ` (parent: ${parentFacets.accessories ?? "-"})` : "")
    + `  frame=${row.imageKey ? "yes" : "NO"}`,
  );
}

/* ------------------------------------------------ what each control can have */

console.log("\n\n=== B: a DELIBERATE accessory replacement, parent → child, both with frames");
const replacements = rows.filter((row) => {
  if (!row.imageKey || !row.parentVariantId) return false;
  const parent = byId.get(row.parentVariantId);
  if (!parent?.imageKey) return false;
  const mine = facets(row).accessories;
  const theirs = facets(parent).accessories;
  return !!mine && !!theirs && mine !== theirs;
});
if (replacements.length === 0) console.log("  none — B's control cannot be armed from stored rows");
for (const row of replacements) {
  const parent = byId.get(row.parentVariantId);
  console.log(
    `  v#${parent.id} "${facets(parent).accessories}"  →  v#${row.id} "${facets(row).accessories}"`
    + `   (${parent.publicId} → ${row.publicId})`,
  );
}

console.log("\n=== D: hair DOWN with a parent that is not, both with frames");
const hairPairs = rows.filter((row) => {
  if (!row.imageKey || !row.parentVariantId) return false;
  const parent = byId.get(row.parentVariantId);
  if (!parent?.imageKey) return false;
  const mine = facets(row).hairWorn;
  return !!mine && /down|loose/i.test(mine) && facets(parent).hairWorn !== mine;
});
if (hairPairs.length === 0) console.log("  none — D's control cannot be armed from stored rows");
for (const row of hairPairs) {
  const parent = byId.get(row.parentVariantId);
  console.log(
    `  v#${parent.id} hairWorn=${facets(parent).hairWorn ?? "-"}  →  v#${row.id} hairWorn=${facets(row).hairWorn}`
    + `   (${parent.publicId} → ${row.publicId})`,
  );
}

await connection.end();
process.exit(0);

/**
 * WHICH FACE IS "Sharp-eyed"? — and what its panel would actually show.
 *
 * fable-141 names the face from a screenshot. A name in a screenshot is a
 * claim; the row that carries it is the fact. `casts` has no such name, so the
 * next candidate is the candidate's own `personaLine`.
 *
 * Also prints, for the chain found, the exact inputs the kept panel projects
 * from — the segments on the selected variant's lineage and the delivered
 * value each row would be named by — so "the panel shows only Her freckles"
 * can be explained from data rather than from reading the component.
 *
 * Reads only. Writes nothing, spends nothing.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-sharpeyed-disposable.mts
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const url = process.env[databaseKey];
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const named = await query(
  `SELECT id, publicId, userId, personaLine, selectedVariantId, createdAt
     FROM casting_candidates
    WHERE personaLine LIKE '%harp%' ORDER BY id DESC LIMIT 10`,
);
console.log(`--- candidates whose personaLine contains "harp" (${named.length}) ---`);
for (const row of named) {
  console.log(`  cand ${row.id}  ${String(row.publicId).slice(0, 8)}  user ${row.userId}  selected=${row.selectedVariantId ?? "-"}  "${row.personaLine}"`);
}

console.log(`\n--- personaLine of every candidate carrying a 2026-08-09 chain ---`);
const chains = await query(
  `SELECT id, publicId, personaLine, selectedVariantId FROM casting_candidates
    WHERE id BETWEEN 1593 AND 1600 ORDER BY id ASC`,
);
for (const row of chains) {
  console.log(`  cand ${row.id}  ${String(row.publicId).slice(0, 8)}  selected=${row.selectedVariantId ?? "-"}  "${row.personaLine ?? "(none)"}"`);
}

/* What the panel projects from, for the chain fable-141 describes. */
for (const candidateId of [1596, 1597]) {
  const [candidate] = await query("SELECT id, publicId, selectedVariantId FROM casting_candidates WHERE id = ?", [candidateId]);
  if (!candidate) continue;
  console.log(`\n=== cand ${candidateId} (${String(candidate.publicId).slice(0, 8)}) — selected variant ${candidate.selectedVariantId} ===`);

  const segments = await query(
    `SELECT s.id, s.facet, s.region, s.variantId, s.version, s.verdict, v.requestText
       FROM casting_segments s LEFT JOIN casting_candidate_variants v ON v.id = s.variantId
      WHERE s.candidateId = ? ORDER BY s.id ASC`,
    [candidateId],
  );
  console.log(`segments on this face (${segments.length}):`);
  for (const row of segments) {
    console.log(`  #${row.id} ${String(row.facet).padEnd(16)} region=${String(row.region).padEnd(12)} `
      + `from variant ${row.variantId} ("${row.requestText}")  v${row.version} verdict=${row.verdict ?? "-"}`);
  }

  /* The delivered value the projection names each row by — it lives in the
     variant's own internalPrompt.resolved, which is what `deliveredValue`
     reads through. A row whose value is missing is DROPPED, not shown as an id. */
  const variants = await query(
    `SELECT id, requestText, internalPrompt FROM casting_candidate_variants
      WHERE candidateId = ? ORDER BY id ASC`,
    [candidateId],
  );
  console.log(`delivered values per variant (what a row would be NAMED):`);
  for (const row of variants) {
    let internal: any = row.internalPrompt;
    if (typeof internal === "string") { try { internal = JSON.parse(internal); } catch { internal = {}; } }
    const resolved = internal?.resolved ?? {};
    const interesting = ["marks", "makeup", "hairWorn", "statedAccessories", "eye.colour"]
      .map((facet) => `${facet}=${JSON.stringify(resolved?.[facet] ?? null)}`.slice(0, 90))
      .join("  ");
    console.log(`  variant ${row.id} ("${row.requestText}")\n      ${interesting}`);
  }
}

await connection.end();
process.exit(0);

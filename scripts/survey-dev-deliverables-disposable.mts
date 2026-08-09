/**
 * WHICH DEV FACE CAN ACTUALLY SAY SOMETHING — asked through the product's own
 * projection rather than by reading JSON with my eye.
 *
 * The panel drops a row whose delivered value cannot be found, so the seed has
 * to be built on a chain whose variants really do resolve values for the facets
 * it files. This runs `currentValueOfFacet` + `nameForFacet` — the exact two
 * functions the route calls — over every ready dev variant and prints the rows
 * that face would produce.
 *
 *   npx tsx scripts/survey-dev-deliverables-disposable.mts
 */
import "dotenv/config";
import mysql from "mysql2/promise";

import { currentValueOfFacet } from "../server/castingV2/refineDelta";
import { readResolvedIdentity } from "../server/castingV2/rollService";
import { nameForFacet, facetsNeedingNames } from "../server/castingV2/segmentsOnFace";
import type { Facet } from "../server/castingV2/refineFacets";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (process.env.MYSQL_PUBLIC_URL) throw new Error("refusing to run beside a production URL");

const connection = await mysql.createConnection(url);
const [rows] = await connection.query(
  `SELECT id, candidateId, userId, requestText, internalPrompt
     FROM casting_candidate_variants
    WHERE status = 'ready' AND internalPrompt IS NOT NULL
    ORDER BY candidateId ASC, id ASC`,
);
await connection.end();

const facets = facetsNeedingNames() as Facet[];

for (const row of rows as Record<string, any>[]) {
  const prompt = typeof row.internalPrompt === "string"
    ? JSON.parse(row.internalPrompt)
    : row.internalPrompt;
  const identity = readResolvedIdentity(prompt);
  const named: string[] = [];
  for (const facet of facets) {
    const name = nameForFacet(facet, currentValueOfFacet(identity, facet));
    if (name) named.push(`${facet}="${name}"`);
  }
  console.log(
    `candidate ${String(row.candidateId).padStart(3)} · variant ${String(row.id).padStart(3)} `
    + `· ${identity ? "identity OK" : "IDENTITY UNREADABLE"} · ${String(row.requestText ?? "—")}`,
  );
  console.log(`    ${named.length ? named.join("  ") : "(nothing nameable)"}`);
}

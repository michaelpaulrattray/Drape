/**
 * WHAT THE PANEL NAMES A ROW BY — the delivered value, read at the source.
 *
 * `segmentsOnFace` drops any row whose delivered value it cannot find, so
 * "the panel shows only Her freckles" is either two segments and one name, or
 * a read that is looking in the wrong place. This prints the actual shape of
 * `internalPrompt` on the variants that filed the segments, rather than
 * assuming a key. Reads only.
 */
import mysql from "mysql2/promise";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const url = process.env[key];
if (!url) { console.error("no database url"); process.exit(1); }
const connection = await openDatabase({ uri: url, timezone: "Z" } as any);
const [rows] = await connection.query<any[]>(
  `SELECT id, publicId, requestText, internalPrompt FROM casting_candidate_variants WHERE id IN (153,155,158,161,163,165)`,
);
for (const row of rows) {
  let internal: any = row.internalPrompt;
  if (typeof internal === "string") { try { internal = JSON.parse(internal); } catch { internal = null; } }
  console.log(`\n=== variant ${row.id} "${row.requestText}" ===`);
  console.log(`internalPrompt top-level keys: ${internal ? Object.keys(internal).join(", ") : "(unparseable/null)"}`);
  if (internal?.resolved) {
    console.log(`resolved keys: ${Object.keys(internal.resolved).join(", ")}`);
    for (const facet of ["marks", "makeup", "hairWorn", "statedAccessories", "eye.colour", "hair"]) {
      if (internal.resolved[facet] !== undefined) {
        console.log(`  resolved.${facet} = ${JSON.stringify(internal.resolved[facet]).slice(0, 200)}`);
      }
    }
  } else {
    console.log(`resolved: ABSENT — every row naming through it is dropped`);
  }
}
await connection.end();
process.exit(0);

/** `realized.statedDetails` + the fields `currentValueOfFacet` falls back to —
 *  the exact inputs that decide which kept-panel rows survive. Reads only. */
import mysql from "mysql2/promise";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";
const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const url = process.env[key];
if (!url) { console.error("no database url"); process.exit(1); }
const connection = await openDatabase({ uri: url, timezone: "Z" } as any);
const [rows] = await connection.query<any[]>(
  `SELECT id, requestText, internalPrompt FROM casting_candidate_variants WHERE id IN (153,155,158,161,163,165)`,
);
for (const row of rows) {
  let internal: any = row.internalPrompt;
  if (typeof internal === "string") { try { internal = JSON.parse(internal); } catch { internal = null; } }
  const realized = internal?.resolved?.realized ?? {};
  console.log(`\n=== variant ${row.id} "${row.requestText}" ===`);
  console.log(`realized keys: ${Object.keys(realized).join(", ")}`);
  console.log(`statedDetails: ${JSON.stringify(realized.statedDetails ?? null)}`);
  console.log(`skinCharacter=${JSON.stringify(realized.skinCharacter ?? null)}  makeup=${JSON.stringify(realized.makeup ?? null)}  eyeColour=${JSON.stringify(realized.eyeColour ?? null)}`);
}
await connection.end();
process.exit(0);

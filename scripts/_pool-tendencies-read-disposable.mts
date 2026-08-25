/** DISPOSABLE — what did the interpreter file about the POOL for his rolls? Read-only, free. */
import { openDatabase } from "./lib/dbConnection.mts";
const production = process.argv.includes("--production");
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) throw new Error("no url");
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port}`);
const conn = await openDatabase(url);
const [rolls] = await conn.query<any[]>(
  "SELECT id, compiledBrief FROM casting_rolls WHERE userId = 1 AND id >= 206 ORDER BY id",
);
for (const r of rolls) {
  const b = typeof r.compiledBrief === "string" ? JSON.parse(r.compiledBrief) : r.compiledBrief;
  const i = b?.intent ?? {};
  console.log(`\n#${r.id}  role=${JSON.stringify(i.role ?? null)}`);
  console.log(`   poolTendencies: ${JSON.stringify(i.poolTendencies ?? null)}`);
  console.log(`   sex=${JSON.stringify(i.sex ?? null)} ageBand=${JSON.stringify(i.ageBand ?? null)} build=${JSON.stringify(i.build ?? null)} energy=${JSON.stringify(i.energy ?? null)} look=${JSON.stringify(i.look ?? null)}`);
  console.log(`   heritage=${JSON.stringify(i.heritage ?? null)} hair=${JSON.stringify(i.hair ?? null)}`);
}
await conn.end();
process.exit(0);

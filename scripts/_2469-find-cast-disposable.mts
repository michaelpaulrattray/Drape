/**
 * #2469 — find a DEV signed cast with a voice line to drive the voice road on,
 * and confirm whether `cast_voices` exists yet. Read only.
 *
 *   npx tsx scripts/_2469-find-cast-disposable.mts
 */
import "dotenv/config";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const db = await getDb();
if (!db) throw new Error("no database");

const client = (db as unknown as {
  session: { client: { query: (sql: string) => Promise<[unknown[], unknown]> } };
}).session.client;

const [tables] = await client.query(
  "select table_name from information_schema.tables where table_schema = database() and table_name = 'cast_voices'",
);
console.log("cast_voices exists:", (tables as unknown[]).length > 0);

const [casts] = await client.query(`
  select m.id, m.userId, u.email, m.name, m.agencyId,
         char_length(coalesce(m.voice, '')) as voiceChars,
         left(coalesce(m.voice, ''), 120) as voiceHead,
         m.deletedAt, m.mintedAt
  from models m join users u on u.id = m.userId
  where m.deletedAt is null and m.mintedAt is not null
  order by char_length(coalesce(m.voice, '')) desc, m.id desc
  limit 12
`);

console.log("\nlive signed casts in DEV, longest voice line first:");
for (const row of casts as Array<Record<string, unknown>>) {
  console.log(
    `  model ${row.id} user ${row.userId} (${row.email}) "${row.name}" ${row.agencyId} · voice ${row.voiceChars} chars`,
  );
  if (Number(row.voiceChars) > 0) console.log(`      ${row.voiceHead}`);
}

process.exit(0);

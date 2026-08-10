/** Disposable: read the dev database's own account of the segment store. */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("no DATABASE_URL");
const conn = await mysql.createConnection(url);
const [cols] = await conn.query("SHOW COLUMNS FROM `casting_segments`");
for (const col of cols as Array<{ Field: string; Type: string; Null: string; Default: unknown }>) {
  console.log(`  ${col.Field.padEnd(14)} ${col.Type.padEnd(42)} ${col.Null === "YES" ? "NULL" : "NOT NULL"}`);
}
const [idx] = await conn.query("SHOW INDEX FROM `casting_segments`");
const byName = new Map<string, string[]>();
for (const row of idx as Array<{ Key_name: string; Column_name: string; Non_unique: number }>) {
  const key = `${row.Key_name}${row.Non_unique === 0 ? " (unique)" : ""}`;
  byName.set(key, [...(byName.get(key) ?? []), row.Column_name]);
}
for (const [name, columns] of byName) console.log(`  ${name}: ${columns.join(", ")}`);
const [kind] = await conn.query("SHOW COLUMNS FROM `storage_cleanup_batches` LIKE 'kind'");
console.log("  cleanup kinds:", (kind as Array<{ Type: string }>)[0]?.Type);
await conn.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);

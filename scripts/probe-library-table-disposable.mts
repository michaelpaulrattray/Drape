/**
 * READ-ONLY probe of the database `.env` names: does `casting_reference_library`
 * exist there, and with which columns?
 *
 * Nothing here writes. It exists because "production does not have the table
 * yet" was a claim inherited from a report, and migration 0029's whole safety
 * argument rests on it being a fact.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const connection = await mysql.createConnection(url);
try {
  const [where] = await connection.query<any[]>("SELECT DATABASE() AS d, VERSION() AS v");
  console.log(`database ${where[0].d}  mysql ${where[0].v}`);
  for (const table of ["casting_reference_library", "casting_segments", "casting_cast_segments"]) {
    const [rows] = await connection.query<any[]>("SHOW TABLES LIKE ?", [table]);
    if (rows.length === 0) {
      console.log(`${table.padEnd(28)} ABSENT`);
      continue;
    }
    const [columns] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${table}\``);
    const [count] = await connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${table}\``);
    console.log(`${table.padEnd(28)} PRESENT — ${count[0].n} row(s), ${columns.length} columns`);
    console.log(`  ${columns.map((column: any) => column.Field).join(", ")}`);
  }
} finally {
  await connection.end();
}

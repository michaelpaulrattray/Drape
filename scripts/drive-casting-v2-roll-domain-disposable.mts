/**
 * Runs the Casting V2 roll-domain database tests on a disposable database
 * (plan §M, M4).
 *
 * Same discipline as `drive-casting-v2-schema-disposable.mts`: create a
 * throwaway database on the same server as `DATABASE_URL`, replay the whole
 * migration journal into it, run the suite against it, drop it. It never
 * touches the database named in DATABASE_URL, and refuses to run if that URL
 * did not come from `.env` or looks like production.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { openDatabase } from "./lib/dbConnection.mts";
import { openServer } from "./lib/serverConnection.mts";

const PREFIX = "drape_castingv2_roll_";
const SAFE_NAME = new RegExp(`^${PREFIX}[a-z0-9]+$`);

function assertNotProduction(url: URL, fromDotEnv: boolean): void {
  const database = url.pathname.slice(1).toLowerCase();
  if (["prod", "production"].some((marker) => database.includes(marker))) {
    throw new Error(`Refusing to run: database "${database}" looks like production`);
  }
  if (!fromDotEnv) {
    throw new Error(
      "Refusing to run: DATABASE_URL was overridden rather than read from .env. " +
        "This script creates and drops a database on the target server and is dev-only.",
    );
  }
}

function databaseUrlFromDotEnv(): string | null {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

async function applyJournal(connection: mysql.Connection): Promise<number> {
  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await connection.query(trimmed);
    }
  }
  return files.length;
}

const active = process.env.DATABASE_URL!;
const url = new URL(active);
assertNotProduction(url, databaseUrlFromDotEnv() === active);

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!SAFE_NAME.test(databaseName)) throw new Error("generated an unsafe database name");

/* The SERVER, not a database on it — shared, because six scripts wrote this
   as a parts object and every one of them was dead: `openDatabase` reads
   `options.uri`, and parts have none. See `lib/serverConnection.mts`. */
const server = await openServer(url, { multipleStatements: false });

const testUrl = new URL(active);
testUrl.pathname = `/${databaseName}`;

let exitCode = 1;
try {
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  console.log(`[roll-domain] created disposable database ${databaseName}`);
  await server.changeUser({ database: databaseName });
  const applied = await applyJournal(server);
  console.log(`[roll-domain] applied ${applied} migration file(s)\n`);

  exitCode = await new Promise<number>((resolve) => {
    // `shell: true` on Windows: Node 20+ refuses to spawn a .cmd shim
    // directly (EINVAL), and npx is a shim here.
    const child = spawn("npx", ["vitest", "run", "server/castingV2-roll-domain-db.test.ts"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, TEST_DATABASE_URL: testUrl.toString() },
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`\n[roll-domain] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);

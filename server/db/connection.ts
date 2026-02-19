/**
 * Database Connection — shared drizzle instance with pool configuration.
 * All domain modules import getDb() from here.
 */

import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({
        connection: {
          uri: process.env.DATABASE_URL,
          connectionLimit: 20,    // Max concurrent connections
          queueLimit: 50,         // Max queued connection requests before rejection
          waitForConnections: true,
          enableKeepAlive: true,
          keepAliveInitialDelay: 30000, // 30s keep-alive ping
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * A connection to the SERVER rather than to a database on it.
 *
 * Six disposable-database drives and ceremony rehearsals each need this: open
 * the MySQL server itself so a throwaway database can be created, then talk to
 * that. Each of them wrote it as a `{ host, port, user, password }` object —
 * and every one of them has been DEAD since `openDatabase` grew its guard,
 * because that guard reads `options.uri` and an options object built from URL
 * parts has none. It threw *"no DATABASE_URL — pass one explicitly for a
 * production ceremony"* on a script that had been handed a perfectly good URL.
 *
 * That is a whole class of unrunnable control: the segment-store drive, the
 * schema drive, the roll-domain drive and three ceremony REHEARSALS — the
 * scripts whose job is to practise a production migration before it is
 * performed on the founder's own data.
 *
 * So the shape lives here once. A URI with the database stripped is the same
 * connection the parts described, and it goes through the guard rather than
 * around it.
 */
import type mysql from "mysql2/promise";

import { openDatabase } from "./dbConnection.mts";

export function openServer(
  url: URL,
  options: mysql.ConnectionOptions = {},
): Promise<mysql.Connection> {
  const server = new URL(url.toString());
  /* No database — this connection exists to CREATE one. A path left in place
     would make the drive refuse to start whenever the developer's own database
     happened to be missing, which is the opposite of what a throwaway wants. */
  server.pathname = "/";
  return openDatabase({ uri: server.toString(), ...options });
}

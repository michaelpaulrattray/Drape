import mysql from "mysql2/promise";

/**
 * The connection every investigation script should open.
 *
 * # The ten hours
 *
 * `mysql.createConnection(url)` with no `timezone` parses a DATETIME as LOCAL
 * time. Every timestamp in this database is UTC, so on a machine at UTC+10 a
 * raw read is **ten hours early** — silently, with no error and no clue,
 * producing a Date that looks entirely reasonable.
 *
 * That has twice nearly produced a false conclusion about when something
 * happened, during incident work, which is the worst possible moment to be
 * quietly wrong about a clock.
 *
 * # Why this is a connection and not a read helper
 *
 * D-112 rejected a shared read-path helper — "the opted-out law waiting to
 * happen", because every future reader has to remember to call it and the one
 * who forgets is silently wrong in a way that looks right. The fix belongs at
 * the connection, where it applies once and cannot be forgotten per-query.
 *
 * A script that opens its own `mysql.createConnection` is opting out of this
 * the same way, so the point of this module is that there is **one obvious
 * thing to import** and it is shorter than the thing it replaces.
 *
 * # What was NOT wrong, recorded so it is not re-fixed
 *
 * The application was always correct. Drizzle's typed column mapper writes and
 * reads UTC, so a JS `Date` and a `defaultNow()` on the same row have always
 * landed in the same frame. The belief that the app's two writers diverged came
 * from probing `db.execute()` with a raw parameter — a path the product does
 * not use for typed columns — and it was wrong. Measured, both before and after
 * setting this: the typed round-trip is correct either way, and nothing on disk
 * is re-interpreted, because nothing was ever written in local time.
 */
export function openDatabase(url = process.env.DATABASE_URL): Promise<mysql.Connection> {
  if (!url) throw new Error("no DATABASE_URL — pass one explicitly for a production ceremony");
  return mysql.createConnection({
    uri: url,
    /*
      The whole reason this module exists. Everything in the database is UTC;
      this stops the driver guessing otherwise.
    */
    timezone: "Z",
  } as mysql.ConnectionOptions);
}

/**
 * A timestamp as the database actually holds it, for printing.
 *
 * Investigation output is read by people comparing it against logs and against
 * each other's screenshots, so it says UTC explicitly rather than rendering in
 * whatever timezone the reader's machine happens to be in.
 */
export function utc(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = value instanceof Date ? value : new Date(`${value.replace(" ", "T")}Z`);
  return `${date.toISOString().slice(0, 19).replace("T", " ")}Z`;
}

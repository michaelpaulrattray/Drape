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
 *
 * # Why it takes an options object as well as a URL (shift 36)
 *
 * The sweep that put every script behind this door found call sites of two
 * shapes: `createConnection(url)` and `createConnection({ uri, connectTimeout })`.
 * A helper that accepted only a URL would have forced the second shape to drop
 * its options to come inside — a behaviour change smuggled in by a hygiene
 * sweep — so it accepts either, and the swap at each site is the callee alone.
 *
 * `timezone` is applied AFTER the caller's options rather than before, because
 * this module exists to be the one place that decides it. A caller passing
 * `timezone: "local"` is asking for the bug by name; it does not get it.
 */
/**
 * WHICH WORLD THIS URL LEADS TO — host, port and database, never a credential.
 *
 * Dev and production are the same hostname and the same database NAME on this
 * project (`hayabusa.proxy.rlwy.net/railway`); only the PORT differs — 52008 is
 * dev, 23768 is production. A report that names neither is a report whose world
 * has to be inferred, and it has been inferred wrongly here before.
 */
export function worldOf(url: string | undefined): string {
  if (!url) return "(no url)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "3306"}${parsed.pathname}`;
  } catch {
    return "(unparseable url)";
  }
}

/**
 * THE URL A SCRIPT SHOULD READ, and why the order is this way round.
 *
 * `railway run --service MySQL` injects that service's own variables and **no
 * `DATABASE_URL`** — the production URL arrives as `MYSQL_PUBLIC_URL`. So a
 * script that loads `.env` (for `FAL_KEY`, or anything else it needs) and then
 * reaches for `DATABASE_URL` gets the DEV database back, under a command whose
 * whole purpose was to read production, with no error and nothing in the output
 * to say so. That is precisely how tonight's first "production is empty" read
 * was taken from dev.
 *
 * `MYSQL_PUBLIC_URL` therefore wins when it is present, because it is only ever
 * present when somebody has deliberately wrapped the command in the production
 * service. A plain local run has no such variable and stays on `.env`.
 */
export function resolveDatabaseUrl(): string | undefined {
  return process.env.MYSQL_PUBLIC_URL ?? process.env.PUBLIC_DATABASE_URL ?? process.env.DATABASE_URL;
}

/**
 * THE CONNECTION AS A SCRIPT USES IT — the same object, with `query` typed for
 * the one thing every probe here does.
 *
 * mysql2 constrains its generic to `QueryResult`, a union built for the
 * difference between rows and an `OkPacket`, so a probe that says what shape it
 * expects back —
 *
 *   `const [rows] = await connection.query<Array<{ openId: string }>>(sql)`
 *
 * — is a type error, and it was **42 of the 128** errors standing between this
 * tree and `pnpm check`. Forty-two sites, one shape, no bug among them: every
 * one is a correct read whose declared row type mysql2 will not accept without
 * `& RowDataPacket` welded onto it.
 *
 * So it is answered ONCE, here, where the timezone is answered — rather than by
 * an intersection typed into forty-two probes and remembered in every future
 * one. What a caller declares is what it gets back; nothing is widened to
 * `any`, and a script that asks for `<any>` (to read an `insertId`) still gets
 * exactly that.
 *
 * **What this trades away, said out loud:** mysql2's constraint would stop a
 * script typing an INSERT's result as rows. That distinction is worth having in
 * application code and is not what these files are — they are read probes, and
 * `server/db` reaches this database through Drizzle, never through this door.
 */
export type ScriptConnection = mysql.Connection & {
  query<T = mysql.RowDataPacket[]>(sql: string, values?: unknown): Promise<[T, mysql.FieldPacket[]]>;
};

export function openDatabase(
  input: string | mysql.ConnectionOptions | undefined = process.env.DATABASE_URL,
): Promise<ScriptConnection> {
  const options = typeof input === "string" || input === undefined
    ? { uri: input }
    : { ...input };
  if (!options.uri) throw new Error("no DATABASE_URL — pass one explicitly for a production ceremony");
  /* Every opened connection says which world it opened, on STDERR so a script
     whose stdout is a report or a JSON payload is not disturbed by it. The
     silent version of this line cost a wrong reading tonight. */
  process.stderr.write(`[db] ${worldOf(options.uri)}\n`);
  return mysql.createConnection({
    ...options,
    /*
      The whole reason this module exists. Everything in the database is UTC;
      this stops the driver guessing otherwise. LAST, so it cannot be overridden
      by a caller's own object.
    */
    timezone: "Z",
  } as mysql.ConnectionOptions);
}

/**
 * THE SAME DOOR, FOR A POOL.
 *
 * Four migration appliers open a pool rather than a connection, and a pool with
 * no `timezone` misreads a DATETIME exactly as a connection does. Sweeping only
 * the connections would have left half of the class behind — and half a class is
 * how this one survived a documented helper for as long as it did.
 */
export function openPool(
  input: string | mysql.PoolOptions | undefined = process.env.DATABASE_URL,
): mysql.Pool {
  const options = typeof input === "string" || input === undefined
    ? { uri: input }
    : { ...input };
  if (!options.uri) throw new Error("no DATABASE_URL — pass one explicitly for a production ceremony");
  return mysql.createPool({ ...options, timezone: "Z" } as mysql.PoolOptions);
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

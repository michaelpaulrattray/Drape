/**
 * THE CREW TAB'S REPLY STORE — the founder's half, at the database (migration
 * 0054; design `docs/specs/CREW_TAB_DESIGN.md` §3).
 *
 * Two statements, and both of them are an EXPLICIT PROJECTION (invariant 8).
 * That is the load-bearing property of this file rather than a style note: the
 * read joins `users` to resolve a display name, and a bare `select()` or a
 * spread row across that join is exactly how `passwordHash` once reached
 * `auth.me`. Every column is named, so a sensitive column added to `users`
 * tomorrow cannot leak through this surface by construction, without anyone
 * having remembered to omit it.
 *
 * TWO user columns are taken and both are names — `displayName` first because
 * it is the one a person chose for themselves, `name` behind it. Nothing else
 * from that table is read anywhere in this file, and the `author` the page
 * receives is a resolved STRING rather than either column, so a consumer cannot
 * key on which one answered.
 *
 * # `authorUserId` IS AN ARGUMENT AND NEVER AN INPUT FIELD
 *
 * Invariant 3. The router passes `ctx.user.id`; the procedure's schema does not
 * declare the field at all, and is `.strict()`, so a forged one is a refusal at
 * the door rather than a value this function could ever see.
 *
 * # NO OWNERSHIP CLAUSE, AND THAT IS DELIBERATE
 *
 * Every other store in this directory scopes its reads to an owner in the
 * statement itself (invariant 1). This one does not, because the resource is
 * not owned per-user: the crew thread is ONE shared thread between the founder,
 * the co-founder and the shifts, and an admin reading it is reading the team's
 * conversation rather than a customer's work. The gate is `adminProcedure`,
 * applied before either of these functions is reached. A per-author filter here
 * would not be a tighter boundary — it would be a different product, one where
 * the co-founder cannot see what the founder ruled.
 */
import { desc, eq } from "drizzle-orm";

import { crewReplies, users } from "../../drizzle/schema";
import { getDb, type DbInstance } from "./connection";

/**
 * The database, or a refusal.
 *
 * `getDb()` answers `null` when there is no `DATABASE_URL`, and several stores
 * here return an empty array in that case. **This one must not.** An empty
 * thread is a meaningful answer on this surface — it tells the founder the crew
 * has heard nothing from him — so a missing database returning `[]` would be a
 * configuration fault wearing the clothes of a fact. It throws, the procedure
 * fails, and the page says something is wrong.
 */
async function requireDb(): Promise<DbInstance> {
  const db = await getDb();
  if (!db) throw new Error("no database connection — the crew thread cannot be read or written");
  return db;
}

/**
 * One reply as the page sees it.
 *
 * `author` is the resolved display name, never the user row and never the id —
 * the page has no use for an id and a staff surface that prints one invites the
 * next reader to key something on it.
 */
export type CrewReplyView = {
  readonly id: number;
  readonly cardId: string | null;
  readonly body: string;
  readonly createdAt: Date;
  readonly author: string;
};

/**
 * The whole thread, newest first.
 *
 * Unpaginated on purpose: it is one person typing, and the design's own
 * argument for keeping no purge path applies here too. When it stops being
 * small enough to send whole, that is a real change and deserves a real
 * decision rather than a limit slipped in now.
 */
export async function listCrewReplies(): Promise<CrewReplyView[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      id: crewReplies.id,
      cardId: crewReplies.cardId,
      body: crewReplies.body,
      createdAt: crewReplies.createdAt,
      /* The ONLY columns taken from the join, and both are names. See header. */
      authorDisplayName: users.displayName,
      authorName: users.name,
    })
    .from(crewReplies)
    .leftJoin(users, eq(users.id, crewReplies.authorUserId))
    .orderBy(desc(crewReplies.id));

  return rows.map(toCrewReplyView);
}

/**
 * The one place a row becomes a view.
 *
 * Written once and used by both statements, so the insert's answer and the
 * list's cannot disagree about what `author` means — working law 4 at the
 * scale of two functions.
 */
function toCrewReplyView(row: {
  id: number;
  cardId: string | null;
  body: string;
  createdAt: Date;
  authorDisplayName: string | null;
  authorName: string | null;
}): CrewReplyView {
  return {
    id: row.id,
    cardId: row.cardId,
    body: row.body,
    createdAt: row.createdAt,
    /* A deleted or unnamed author still has a thread entry — his words outlive
       the row that names him, and "a member of the crew" is honest where a
       blank would read as a rendering fault. */
    author:
      row.authorDisplayName?.trim()
      || row.authorName?.trim()
      || "a member of the crew",
  };
}

/**
 * Write one reply and hand back the same projection the list uses.
 *
 * The insert reads its own row back rather than composing the view from the
 * arguments: `createdAt` is the DATABASE's `now()`, so composing it here would
 * put the app server's clock into a record the database owns, and the two
 * disagree by whatever the drift is. Working law 1, at the smallest scale it
 * has — the row is the fact.
 */
export async function insertCrewReply(input: {
  cardId: string | null;
  body: string;
  /** From `ctx.user.id` at the call site, never from procedure input. */
  authorUserId: number;
}): Promise<CrewReplyView> {
  const db = await requireDb();
  const result = await db.insert(crewReplies).values({
    cardId: input.cardId,
    body: input.body,
    authorUserId: input.authorUserId,
  });

  /* mysql2 answers `[ResultSetHeader, FieldPacket[]]`, so the id is on the
     first member. Read defensively rather than cast: an id that is not a
     positive integer is a write that did not happen the way we think it did,
     and reading a row back on a wrong id is worse than failing here. */
  const insertId = Number(result[0]?.insertId);
  if (!Number.isSafeInteger(insertId) || insertId <= 0) {
    throw new Error("crew reply insert returned no id");
  }

  const [row] = await db
    .select({
      id: crewReplies.id,
      cardId: crewReplies.cardId,
      body: crewReplies.body,
      createdAt: crewReplies.createdAt,
      authorDisplayName: users.displayName,
      authorName: users.name,
    })
    .from(crewReplies)
    .leftJoin(users, eq(users.id, crewReplies.authorUserId))
    .where(eq(crewReplies.id, insertId))
    .limit(1);

  if (!row) throw new Error("crew reply was written and could not be read back");

  return toCrewReplyView(row);
}

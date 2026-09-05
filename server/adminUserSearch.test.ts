/**
 * THE MODERATOR / ADMIN ACCOUNT SEARCH, PROVEN AT THE STATEMENT (#420).
 *
 * Both staff account searches say *"Name, email or id"* and both reach one
 * predicate. For years the predicate matched `name`, `email` and `openId` —
 * the auth-provider handle — and never `users.id`, so typing an id returned
 * nothing at all, for any id: a control naming a capability we did not have.
 *
 * # WHY THIS IS READ AT THE RENDERED SQL AND NOT AT THE SOURCE
 *
 * Invariant 5, *assert at the wire*: a contract about what gets SENT is proven
 * on the outgoing statement, never on a constant near it. The surface guard in
 * `client/src/features/moderator/section09-guard.test.ts` reads the source for
 * the `eq(users.id, …)` clause — that arm exists to keep the COPY and the query
 * from drifting apart, and it is a substring test, which is exactly the shape
 * that has been wrong here before. This one renders the statement drizzle would
 * actually issue and reads what MySQL would be asked.
 *
 * `mysql.createPool` opens nothing until a query runs, so this needs no
 * database — the same trick `discrepancyOperationCostSql.test.ts` uses.
 *
 * # THE ARM THAT MATTERS IS THE NEGATIVE ONE
 *
 * `LIKE '%1%'` against the id would have looked like a fix and passed a naive
 * "does it mention users.id" check while returning every account whose id
 * merely CONTAINS a 1 — most of a real table, and a worse answer than none.
 * So the exactness is asserted, not just the presence.
 */
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users } from "../drizzle/schema";
import { userSearchCondition } from "./db/admin";

/** The statement the list query would send, for one search term. */
function render(term: string): { sql: string; params: unknown[] } {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  try {
    const { sql, params } = drizzle(pool)
      .select({ id: users.id })
      .from(users)
      .where(userSearchCondition(term))
      .toSQL();
    return { sql, params };
  } finally {
    void pool.end().catch(() => undefined);
  }
}

describe("userSearchCondition — the staff account search", () => {
  it("matches the numeric id EXACTLY when the term is all digits", () => {
    const { sql, params } = render("40486");

    expect(sql).toContain("`users`.`id` = ?");
    expect(params).toContain(40486);

    /* The defect a careless fix would ship: LIKE over the id. */
    expect(sql, "the id is matched by LIKE — '%1%' would return most of the table")
      .not.toMatch(/`users`\.`id` like/i);
  });

  it("still searches the three text fields on a digit term", () => {
    /*
      An email or a display name may legitimately be numeric, and a moderator
      holding "40486" off a support ticket should not have a matching email
      hidden from them because the term happened to look like an id.
    */
    const { sql, params } = render("40486");
    expect(sql).toContain("`users`.`name` like ?");
    expect(sql).toContain("`users`.`email` like ?");
    expect(sql).toContain("`users`.`openId` like ?");
    expect(params).toContain("%40486%");
  });

  it("asks nothing about the id when the term is not a number", () => {
    const { sql, params } = render("ada@example.com");
    expect(sql).not.toContain("`users`.`id` =");
    expect(sql).toContain("`users`.`email` like ?");
    expect(params).toEqual(["%ada@example.com%", "%ada@example.com%", "%ada@example.com%"]);
  });

  it("does not ask MySQL about a number the column cannot hold", () => {
    /*
      `users.id` is a signed 32-bit int. A twenty-digit term is not an id on
      this table; handing it over as one asks a question about an out-of-range
      value, and a digit string that long parses to a float that compares
      wrongly rather than failing. It falls through to the text fields.
    */
    for (const oversized of ["2147483648", "99999999999999999999"]) {
      const { sql } = render(oversized);
      expect(sql, `${oversized} was treated as an id`).not.toContain("`users`.`id` =");
      expect(sql).toContain("`users`.`name` like ?");
    }

    /* The boundary itself is included, so the bound is off-by-one proof. */
    expect(render("2147483647").sql).toContain("`users`.`id` = ?");
  });

  it("accepts the shape the product itself prints — a pasted `#40486`", () => {
    /*
      ⚠ THE ONE PASTE SHAPE THAT MATTERS, and the first version of this suite
      missed it while covering two that the product never produces.

      Both staff surfaces render the id as `#40486`. So the likeliest term
      anyone will ever paste is the one they copied off the row in front of
      them — and under `/^\d+$/` it fell through to `LIKE '%#40486%'` over the
      text fields and printed "No users match that search": the original defect
      reproduced on the product's own output. (Gate review, PR #569.)
    */
    const hashed = render("#40486");
    expect(hashed.sql).toContain("`users`.`id` = ?");
    expect(hashed.params).toContain(40486);

    /* The text clauses keep the term AS TYPED — a literal "#40486" in a name is
       a different question, and the hash is stripped for the id test alone. */
    expect(hashed.params).toContain("%#40486%");
    expect(hashed.params).not.toContain("%40486%");

    /* Exactly ONE hash is stripped; this is not a general punctuation cleaner. */
    for (const notAnId of ["##40486", "#", "# 40486", "#40486#", "#+40486"]) {
      expect(render(notAnId).sql, `${notAnId} was treated as an id`).not.toContain("`users`.`id` =");
    }
  });

  it("treats a padded or signed term as text, not as an id", () => {
    /*
      `+40486` and `40486 ` are the shapes a paste from a spreadsheet or a
      ticket produces. Trimming is done; a sign is not an id.
    */
    expect(render("  40486  ").sql, "a trimmed digit term is still an id").toContain("`users`.`id` = ?");
    expect(render("+40486").sql, "a signed term is not an id").not.toContain("`users`.`id` =");
    expect(render("0").sql, "id 0 does not exist — autoincrement starts at 1").not.toContain("`users`.`id` =");
  });
});

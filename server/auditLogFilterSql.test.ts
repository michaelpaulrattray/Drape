/**
 * THE AUDIT-LOG FILTER, PROVEN AT THE STATEMENT IT SENDS (#941).
 *
 * # What went wrong
 *
 * `getFilteredAuditLogs` fetched a page of rows and then kept the ones whose
 * action was in the chosen category — in JavaScript, after the `LIMIT`. So
 * "Security" never meant *the security rows*; it meant *whichever of the
 * newest 20 rows happened to be security rows*. Measured on the dev table:
 * 3,047 rows, 19 of them `auth.login`, and the Security filter returned **8**
 * at a page size of 20 and **11** at a page size of 100. The answer changed
 * with the page size, and no page size the panel offers ever reached the login
 * rows. `getAbuseAlertsSummary` had the same shape with **no `where` clause at
 * all**, which is the founder's own ABUSE_GLOBAL_ATTACK failure — the wire
 * exists, the row exists, staff never see it — reached by a different road.
 *
 * # WHY THIS IS READ AT THE RENDERED SQL AND NOT AT THE SOURCE
 *
 * Invariant 5, *assert at the wire*. The defect and its fix look identical in
 * the source at a glance — both mention `ACTION_CATEGORIES[actionCategory]`,
 * one before the fetch and one after — so a substring reader cannot tell them
 * apart. **`server/adminAuditLogs.test.ts` proved the DEFECT for months**: its
 * "should filter by action category" arm asserted that the returned rows were
 * all billing rows, which was true precisely because the filtering happened in
 * JS. A guard that would pass either way is not a guard.
 *
 * So this drives the real exported functions against a db whose only job is to
 * capture the statement drizzle builds and resolve it with no rows. Nothing is
 * mirrored: the expectations are derived from `ACTION_CATEGORIES` itself, and
 * the params are compared to it element for element.
 *
 * `mysql.createPool` opens nothing until a query runs, and no query is ever
 * run here — the same trick `adminUserSearch.test.ts` and
 * `discrepancyOperationCostSql.test.ts` use. This needs no database.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import {
  ACTION_CATEGORIES,
  auditLogFilterConditions,
  getFilteredAuditLogs,
  getAbuseAlertsSummary,
  getAuditStatistics,
} from "./auditLog";
import { auditLogs } from "../drizzle/schema";

type Sent = { sql: string; params: unknown[] };

/**
 * A `db` that builds REAL drizzle statements and, at the moment the caller
 * awaits one, records what it would have sent and resolves with `rows`.
 *
 * The interception is on `then` — drizzle's builders are thenable, which is
 * the single point every statement in this file passes through on its way to
 * the wire. Methods are invoked with the raw builder as `this` so drizzle's
 * own internals are untouched.
 */
function capturingDb(rows: unknown[] = []) {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  const real = drizzle(pool);
  const sent: Sent[] = [];

  /*
    ⚠ `select()` returns a BUILDER that has no `toSQL` yet — the statement only
    becomes renderable at `.from()`. Testing for `toSQL` alone therefore let the
    very first link through unwrapped, every later link came back raw, and the
    whole chain reached a real socket. That failure was loud (ECONNREFUSED);
    the quiet version of it is what this file is about.
  */
  const isBuilder = (value: unknown): value is object =>
    value !== null &&
    typeof value === "object" &&
    (typeof (value as { toSQL?: unknown }).toSQL === "function" ||
      typeof (value as { from?: unknown }).from === "function");

  const wrap = (builder: unknown): unknown => {
    if (!isBuilder(builder)) return builder;

    return new Proxy(builder as object, {
      get(target, prop, receiver) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown) => {
            sent.push((target as { toSQL: () => Sent }).toSQL());
            return Promise.resolve(rows).then(resolve);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return (...args: unknown[]) => wrap((value as (...a: unknown[]) => unknown).apply(target, args));
        }
        return value;
      },
    });
  };

  return {
    sent,
    close: () => void pool.end().catch(() => undefined),
    db: {
      select: (...args: unknown[]) =>
        wrap((real.select as (...a: unknown[]) => unknown)(...args)),
    },
  };
}

/** Every statement the call sent, in order. */
async function statementsOf(run: () => Promise<unknown>, rows: unknown[] = []): Promise<Sent[]> {
  const capture = capturingDb(rows);
  (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(capture.db);
  try {
    await run();
    return capture.sent;
  } finally {
    capture.close();
  }
}

/** The `WHERE` clause alone — no `order by`, no paging. "" when there is none. */
function whereOf(statement: Sent): string {
  const at = statement.sql.indexOf(" where ");
  if (at === -1) return "";
  let clause = statement.sql.slice(at + " where ".length);
  for (const tail of [" order by ", " limit ", " offset ", " group by "]) {
    const end = clause.indexOf(tail);
    if (end !== -1) clause = clause.slice(0, end);
  }
  return clause;
}

/*
  The values bound to the WHERE clause, without the paging ones.

  ⚠ mysql2 parameterises `LIMIT` and `OFFSET` too, so a rendered statement's
  `params` ends with the page size and the offset. Comparing a whole `params`
  array against a bucket therefore fails for a reason that has nothing to do
  with the filter — and, worse, would PASS if a bucket ever happened to be
  short by exactly the number of paging values. Counted off the `?`s in the
  clause itself instead; drizzle emits params in statement order.
*/
function whereParamsOf(statement: Sent): unknown[] {
  const placeholders = (whereOf(statement).match(/\?/g) ?? []).length;
  return statement.params.slice(0, placeholders);
}

const CATEGORIES = Object.keys(ACTION_CATEGORIES) as (keyof typeof ACTION_CATEGORIES)[];

describe("the audit Category filter, at the statement it sends (#941)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /*
    The population is read out of ACTION_CATEGORIES rather than typed here, so
    a bucket added tomorrow is covered without an edit — and a bucket list that
    empties cannot pass by having nothing to check.
  */
  it("carries EVERY action of the chosen bucket into the WHERE, for every bucket", async () => {
    expect(CATEGORIES.length, "ACTION_CATEGORIES has no buckets — the arms below would check nothing")
      .toBeGreaterThanOrEqual(4);

    for (const category of CATEGORIES) {
      const expected = ACTION_CATEGORIES[category];
      expect(expected.length, `the ${category} bucket is empty`).toBeGreaterThan(0);

      const [page] = await statementsOf(() =>
        getFilteredAuditLogs({ limit: 20, offset: 0, actionCategory: category as never }),
      );

      expect(whereOf(page), `${category} is not matched at the statement`)
        .toContain("`audit_logs`.`action` in (");
      expect(whereParamsOf(page), `${category} sends the wrong number of actions`)
        .toHaveLength(expected.length);
      expect(whereParamsOf(page), `${category} does not send its own bucket`)
        .toEqual([...expected]);
    }
  });

  /*
    THE POSITIVE CONTROL for the arm above: with no category chosen there is no
    action predicate at all, so `in (` is measuring the category and not
    something the statement always carries.
  */
  it("sends NO action predicate when no category is chosen", async () => {
    const [page] = await statementsOf(() => getFilteredAuditLogs({ limit: 20, offset: 0 }));

    expect(whereOf(page)).toBe("");
    expect(whereParamsOf(page)).toEqual([]);
  });

  /*
    THE BY-NAME ARM. The two arms above both pass if a bucket quietly loses the
    action a staff member is actually hunting for, because both derive their
    expectation from the same list. `auth.login` is the card's own specimen —
    19 rows that no page size could reach.
  */
  it("a Security filter asks for auth.login by name", async () => {
    const [page] = await statementsOf(() =>
      getFilteredAuditLogs({ limit: 20, offset: 0, actionCategory: "security" }),
    );

    expect(whereParamsOf(page)).toContain("auth.login");
    expect(whereParamsOf(page)).toContain("security.unauthorized_admin_access");
  });

  /*
    ⚠ THE ARM THE PAGER DEPENDS ON. The footer's total used to be computed from
    the page it was describing (`offset + logs.length + …`), so it could never
    disagree with the page and could never be right either. Now it is a real
    COUNT — and a COUNT is only honest if it asks the SAME question the page
    asks. Rendered and compared, not reasoned about.
  */
  it("the page and the COUNT behind the pager carry byte-identical conditions", async () => {
    const options = {
      limit: 20,
      offset: 40,
      severity: "critical" as const,
      actionCategory: "security" as const,
      userId: 123,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-31T00:00:00Z"),
    };

    const sent = await statementsOf(() => getFilteredAuditLogs(options));

    expect(sent, "the pager's total is not a second statement — it is still read off the page")
      .toHaveLength(2);
    const [page, counted] = sent;

    expect(counted.sql, "the second statement is not a COUNT").toContain("count(");
    expect(whereOf(counted)).toBe(whereOf(page));
    expect(whereParamsOf(counted)).toEqual(whereParamsOf(page));

    /* And every filter the caller asked for is actually in there. */
    expect(whereOf(page)).toContain("`audit_logs`.`severity` = ?");
    expect(whereOf(page)).toContain("`audit_logs`.`userId` = ?");
    expect(whereOf(page)).toContain("`audit_logs`.`createdAt` >= ?");
    expect(whereOf(page)).toContain("`audit_logs`.`createdAt` <= ?");
    expect(whereOf(page)).toContain("`audit_logs`.`action` in (");
  });

  /*
    The page must be drawn at the size asked for. The old shape fetched
    `limit + 1` to guess `hasMore`; the real count answers that now, so a
    `limit + 1` here would quietly return one row too many.
  */
  it("draws the page at the size asked for, at the offset asked for", async () => {
    const [page] = await statementsOf(() => getFilteredAuditLogs({ limit: 20, offset: 40 }));

    expect(page.sql).toContain("limit ? offset ?");
    expect(page.params.slice(-2), "the page is not drawn at the size and offset asked for")
      .toEqual([20, 40]);
  });
});

describe("the abuse alerts summary, at the statement it sends (#941, law-7 sibling)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /*
    This one had NO `where` at all: newest 100 rows of the whole table, then
    keep the abuse ones. A credential-stuffing alarm landing behind a hundred
    ordinary rows was unreachable — which is the exact failure the founder
    ruling on that bucket exists to prevent.
  */
  it("asks the table for abuse rows rather than for the newest hundred of everything", async () => {
    const [statement] = await statementsOf(() => getAbuseAlertsSummary(10));

    expect(whereOf(statement), "the abuse summary still has no WHERE clause")
      .toContain("`audit_logs`.`action` in (");
    expect(whereParamsOf(statement)).toEqual([...ACTION_CATEGORIES.abuse]);
    expect(whereParamsOf(statement)).toContain("abuse.global_attack_detected");

    /* The limit is the caller's, not a hidden 100 it then slices in JS. */
    expect(statement.params.at(-1), "it still over-fetches a fixed page and filters it")
      .toBe(10);
  });

  it("honours a smaller limit at the statement", async () => {
    const [statement] = await statementsOf(() => getAbuseAlertsSummary(5));
    expect(statement.params.at(-1)).toBe(5);
  });
});

describe("the audit statistics total, at the statement it sends (#941, third sibling)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /*
    "Total entries" used to be `select … limit 10000` and `.length`, so the
    tile stopped counting at exactly 10,000 however large the table grew — a
    number that looks precise and silently stops moving.
  */
  it("counts the table instead of fetching ten thousand rows to measure them", async () => {
    const sent = await statementsOf(() => getAuditStatistics());

    const total = sent[sent.length - 1];
    expect(total.sql).toContain("count(");
    expect(total.params, "the total is still taken by fetching a capped page of rows")
      .not.toContain(10000);
  });
});

describe("auditLogFilterConditions — the builder both statements share", () => {
  /*
    A bucket that is somehow missing must return NO rows, never EVERY row.
    Dropping the predicate is the failure direction that looks like the
    feature working, so it is asserted rather than assumed: drizzle renders an
    empty `inArray` as `where false`.
  */
  it("an unknown category refuses rather than matching everything", () => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    try {
      const where = auditLogFilterConditions({ actionCategory: "nonsense" as never });
      const { sql } = drizzle(pool).select().from(auditLogs).where(where).toSQL();

      expect(sql).toContain("where false");
      expect(sql).not.toMatch(/where\s*$/);
    } finally {
      void pool.end().catch(() => undefined);
    }
  });

  it("returns undefined when nothing was filtered, so the statement carries no WHERE", () => {
    expect(auditLogFilterConditions({})).toBeUndefined();
  });
});

/**
 * EVERY WORKING SEAT IS ON HIS PAGE — both halves of it (issue #1358).
 *
 * # What he saw
 *
 * Four shifts were running on the evening of 2026-09-26 — the focus shift and
 * three builder seats, each with its own open row in `crew_shift_runs` and a
 * heartbeat inside the window — and **Working now showed one**. His question,
 * verbatim: *"i still only see 1 shift running?"*, asked the first night the
 * runner launched seats (#1281), whose whole promise to him was that every one
 * of them opens its own row.
 *
 * Two independent faults produced that, one per layer, and this file guards
 * both because fixing either alone still leaves a seat invisible:
 *
 *   1. **The reader** paged the table newest-first at `LIMIT 4`. With four open
 *      runs there was no room for a finished one, and a FIFTH open run would not
 *      have reached the page at all.
 *   2. **The page** picked the newest open row with `runs.find(…)` — singular —
 *      and let every other open row fall through into "Recent shifts", listed
 *      among the shifts that had finished.
 *
 * # WHY THE READER IS PROVEN AT THE STATEMENT AND NOT AT THE SOURCE
 *
 * Invariant 5, *assert at the wire*. "The open list is not capped" is a claim
 * about SQL, and a `.limit()` re-added to the open statement would read as
 * ordinary in a diff while silently restoring the exact defect. So the arms
 * below drive the real exported reader against a db whose only job is to capture
 * what drizzle built, and read the cap off the rendered statement.
 *
 * `mysql.createPool` opens nothing until a query runs and no query is ever run
 * here — `auditLogFilterSql.test.ts`'s trick, and its docblock carries the
 * reasoning. This suite needs no database.
 *
 * # THE CONTROLS
 *
 * Every arm that asserts something is ABSENT has a twin asserting the reader
 * could have seen it. The page arms render a one-seat fixture and require the
 * other three shift ids to be missing, so a markup search that matched anything
 * would fail; the statement arms require a `limit` to be FOUND on the past
 * statement, so "no limit on the open one" cannot pass by a reader that cannot
 * see limits at all. Working law 2.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./db/connection", () => ({ getDb: vi.fn() }));

import { getDb } from "./db/connection";
import { listCrewShiftRuns } from "./db/crewShiftRuns";
import { CrewWorkingNow } from "../client/src/features/admin/components/crew/CrewWorkingNow";
import { CREW_SHIFT_STALL_MS } from "../shared/crewShiftState";

type Sent = { sql: string; params: unknown[] };

/** A run row as the table holds it, with only what an arm cares about varied. */
function runRow(over: Partial<Record<string, unknown>> = {}) {
  const started = new Date("2026-09-26T09:00:00Z");
  return {
    id: 1,
    shift: "seat1-20260926",
    seat: "foreman",
    workKind: "background",
    cardRef: "#1196",
    cardTitle: "A card",
    intent: "an intent",
    branch: null,
    startedAt: started,
    heartbeatAt: started,
    endedAt: null,
    outcome: null,
    outcomeNote: null,
    prNumber: null,
    ...over,
  };
}

/**
 * A `db` that builds REAL drizzle statements and, when the caller awaits one,
 * records what it would have sent and resolves with the rows that statement
 * should return.
 *
 * `rowsFor` is handed the rendered SQL so one capture can answer both statements
 * differently — the open read and the past read are the two halves this file is
 * about, and a single row-set for both could not tell them apart.
 */
function capturingDb(rowsFor: (sql: string) => unknown[]) {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  const real = drizzle(pool);
  const sent: Sent[] = [];

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
            const statement = (target as { toSQL: () => Sent }).toSQL();
            sent.push(statement);
            return Promise.resolve(rowsFor(statement.sql)).then(resolve);
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
    db: { select: (...args: unknown[]) => wrap((real.select as (...a: unknown[]) => unknown)(...args)) },
  };
}

/** Which half a statement is, read off its own WHERE rather than its order. */
const isPastStatement = (sql: string) => sql.includes("is not null");
const isOpenStatement = (sql: string) => !isPastStatement(sql) && sql.includes("is null");

async function readWith(rowsFor: (sql: string) => unknown[]) {
  const capture = capturingDb(rowsFor);
  (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(capture.db);
  try {
    const result = await listCrewShiftRuns();
    return { result, sent: capture.sent };
  } finally {
    capture.close();
  }
}

/** The select list alone — everything between `select` and ` from `. */
function selectListOf(statement: Sent): string {
  const from = statement.sql.indexOf(" from ");
  return statement.sql.slice("select ".length, from === -1 ? undefined : from);
}

beforeEach(() => {
  (getDb as ReturnType<typeof vi.fn>).mockReset();
});

describe("the reader hands the page every open run (#1358)", () => {
  it("sends two statements: the open rows unlimited, then the last three finished", async () => {
    const { sent } = await readWith(() => []);

    expect(sent).toHaveLength(2);
    const [open, past] = sent;

    /* The open half, and the ONE thing that must never come back: a cap. */
    expect(isOpenStatement(open.sql), `first statement was not the open read: ${open.sql}`).toBe(true);
    expect(open.sql, "the open read must not be capped — a cap can only hide a working seat").not.toContain("limit");

    /* The control for that absence: this reader CAN see a limit, because the
       past statement has one. Without this arm, "no limit" would also pass on a
       reader looking at the wrong string. */
    expect(isPastStatement(past.sql), `second statement was not the past read: ${past.sql}`).toBe(true);
    expect(past.sql).toContain("limit");
    expect(past.params).toContain(3);
  });

  it("reads the open rows FIRST, so a run that closes mid-read cannot vanish", async () => {
    const { sent } = await readWith(() => []);
    /* Order is load-bearing rather than incidental: past-then-open would drop a
       run that closed between the two out of both lists, and a shift that
       disappears from his page is the failure this surface exists to prevent. */
    expect(isOpenStatement(sent[0].sql)).toBe(true);
    expect(isPastStatement(sent[1].sql)).toBe(true);
  });

  it("selects the same columns in both statements, so neither can drift", async () => {
    const { sent } = await readWith(() => []);
    expect(selectListOf(sent[0])).toBe(selectListOf(sent[1]));
    /* Positive control: the reader is looking at a real projection, not at "". */
    expect(selectListOf(sent[0])).toContain("heartbeat");
  });

  it("returns FIVE open runs — one more than the old page could hold", async () => {
    const openRows = [5, 4, 3, 2, 1].map((id) => runRow({ id, shift: `seat${id}-20260926` }));
    const { result } = await readWith((sql) => (isPastStatement(sql) ? [] : openRows));

    expect(result.available).toBe(true);
    expect(result.open.map((run) => run.id)).toEqual([5, 4, 3, 2, 1]);
    expect(result.past).toEqual([]);
  });

  it("keeps a run that closed between the two statements in `open`, once", async () => {
    const shared = runRow({ id: 9, shift: "seat-closing" });
    const { result } = await readWith((sql) =>
      isPastStatement(sql)
        ? [{ ...shared, endedAt: new Date("2026-09-26T09:30:00Z"), outcome: "shipped" }, runRow({ id: 7, endedAt: new Date("2026-09-26T08:00:00Z"), outcome: "shipped" })]
        : [shared],
    );

    expect(result.open.map((run) => run.id)).toEqual([9]);
    /* Once, and in `open` — not twice, and not only in the past list. */
    expect(result.past.map((run) => run.id)).toEqual([7]);
  });

  it("an absent table is `available: false` with both lists empty, and nothing else is rescued", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue({
      select: () => { throw Object.assign(new Error("Table doesn't exist"), { code: "ER_NO_SUCH_TABLE" }); },
    });
    await expect(listCrewShiftRuns()).resolves.toEqual({ available: false, open: [], past: [] });

    /* The control: a connection fault must NOT wear the absent table's clothes. */
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue({
      select: () => { throw Object.assign(new Error("connection lost"), { code: "PROTOCOL_CONNECTION_LOST" }); },
    });
    await expect(listCrewShiftRuns()).rejects.toThrow("connection lost");
  });

  it("no database at all is the dark answer, not an empty team", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(listCrewShiftRuns()).resolves.toEqual({ available: false, open: [], past: [] });
  });
});

describe("Working now draws every open run (#1358)", () => {
  const NOW = new Date("2026-09-26T09:30:00Z").getTime();
  const fresh = new Date(NOW - 60_000);
  const stale = new Date(NOW - CREW_SHIFT_STALL_MS - 60_000);

  const SEATS = ["seat1-20260926", "seat2-20260926", "seat3-20260926", "seat4-20260926"];

  function markup(open: unknown[], past: unknown[] = []) {
    return renderToStaticMarkup(
      createElement(CrewWorkingNow, {
        shiftRuns: { available: true, open, past } as never,
        now: NOW,
      }),
    );
  }

  const fourOpen = SEATS.map((shift, index) =>
    runRow({
      id: 40 - index,
      shift,
      cardRef: `#${1000 + index}`,
      /* The last of the four has stopped checking in — one stalled row among
         three live ones, which is the case a single-run surface could not draw. */
      heartbeatAt: index === 3 ? stale : fresh,
      startedAt: new Date(NOW - 20 * 60_000),
    }),
  );

  it("names all four seats, not just the newest", () => {
    const html = markup(fourOpen);
    for (const shift of SEATS) expect(html, `${shift} is missing from Working now`).toContain(shift);
    expect(html).not.toContain("Nothing running");
  });

  it("the same assertion goes red when a seat is absent — the control", () => {
    /* One open run in, and the other three ids must be missing. Without this the
       arm above would pass against markup that happened to contain anything. */
    const html = markup([fourOpen[0]]);
    expect(html).toContain(SEATS[0]);
    for (const shift of SEATS.slice(1)) expect(html).not.toContain(shift);
  });

  it("counts the live seats in the eyebrow, and counts only the live ones", () => {
    expect(markup(fourOpen)).toContain("3 live");
    /* One live run says "live" without a number — a count of one is noise. */
    const one = markup([fourOpen[0]]);
    expect(one).toContain("live");
    expect(one).not.toContain("1 live");
  });

  it("carries the no-check-in reading on the stalled row only", () => {
    const html = markup(fourOpen);
    expect(html.match(/No check-in since/g) ?? []).toHaveLength(1);
    /* The control: with every row fresh there is no reading at all. */
    expect(markup(fourOpen.map((run) => ({ ...run, heartbeatAt: fresh })))).not.toContain("No check-in since");
  });

  it("never lists an open run under Recent shifts", () => {
    const html = markup(fourOpen, [
      runRow({ id: 30, shift: "seat-finished", endedAt: new Date(NOW - 90 * 60_000), outcome: "shipped", outcomeNote: "a finished thing" }),
    ]);
    const recent = html.slice(html.indexOf("Recent shifts"));
    expect(recent).toContain("seat-finished");
    for (const shift of SEATS) expect(recent, `${shift} is drawn as a finished shift`).not.toContain(shift);
  });

  it("says Nothing running when no row is open, and still shows the past", () => {
    const html = markup([], [runRow({ id: 30, shift: "seat-finished", endedAt: new Date(NOW - 90 * 60_000), outcome: "shipped" })]);
    expect(html).toContain("Nothing running");
    expect(html).toContain("seat-finished");
    expect(html).not.toContain("live");
  });
});

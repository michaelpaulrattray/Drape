/**
 * THE COUNT AT THE CLOSE, AND THE PROPERTY THAT IT CANNOT COST A SHIFT ITS
 * CLOSE (#618).
 *
 * **His question, 2026-09-07 morning (terminal), verbatim:** *"how many bugs
 * has it done and worked on its still reading as 18 but its been working all
 * night"*. He was right, and the cause was not the counting — it was WHEN it
 * ran. `scripts/crew-count-queue.mts` was an 833-line top-level-await script
 * that exported nothing, and the standing orders call it at shift START and
 * nowhere else. So the number under each switch on his panel was always what a
 * shift FOUND, never what it CLOSED.
 *
 * The card named two roads and refused one of them by name: spawning the
 * counter as a child process from the close is smaller to type and puts a child
 * process on **the one path that must never fail** — a close that dies leaves a
 * run row open, which his page renders as a shift still running (#288's
 * incident). So the reading was extracted into `scripts/lib/crewQueueCount.mts`
 * and both callers call a function.
 *
 * # WHY THE SAFETY ARM IS THE POINT OF THIS FILE
 *
 * Adding work to the close means adding a way for the close to fail. The whole
 * defence is that `refreshQueueCountsQuietly` resolves on **every** road, and
 * that defence is worth exactly as much as it is drivable. A `try` written
 * inline in the close would be a claim in a comment — the class
 * `guard-docblock-is-an-unchecked-claim` — so it lives in a named function
 * these arms can hand a connection that throws.
 *
 * # WHAT EACH ARM WOULD CATCH
 *
 *   1. the refusal road — a world without the table comes back as a VALUE;
 *   2. the throw road — a connection that rejects is caught, and the caller
 *      still gets a resolved promise;
 *   3. ⚠ the POSITIVE CONTROLS — a healthy connection comes back `ok` and says
 *      nothing, so arms 1 and 2 cannot pass on a function that refuses
 *      unconditionally or narrates every run;
 *   4. every failing road REPORTS — a swallowed failure is the same stale panel
 *      with nobody told why;
 *   5. the connection is NEVER ended by the reading — the caller owns it, and a
 *      reading that closed it would break the shift close's own later
 *      statements;
 *   6. the close calls it AFTER the terminal UPDATE — the ordering IS the
 *      safety argument, read at the source with a negative control.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  QUEUE_GH_TIMEOUT_MS,
  refreshQueueCounts,
  refreshQueueCountsQuietly,
  type QueueGhReader,
} from "../scripts/lib/crewQueueCount.mts";

/*
   ⚠ DECLARED EVEN THOUGH NO ARM HERE SPAWNS ANYTHING (#548's population).

   Every arm below injects a `gh` double, so nothing in this file reaches a
   child process today. The deriver still puts it in the population, and it is
   RIGHT to: this file imports the reading, and the reading's `gh` parameter
   DEFAULTS to the real command. An arm added later that forgets the double
   would spawn `gh` inside vitest's 5s default and go red under load on
   somebody's machine rather than in CI - which is exactly the failure #548 is
   about. Declaring it costs nothing and removes that trap.
*/
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const CLOSE = join(__dirname, "..", "scripts", "crew-shift-close.mts");

/**
 * The reading narrates the whole panel as it goes, which is what a shift wants
 * at 3am and not what a gate log wants sixteen times over.
 */
const QUIET = { log: () => {}, warn: () => {} };

/**
 * A connection double that answers the existence probes and records writes.
 *
 * It keys on the STATEMENT rather than on a call counter, because what is
 * under test is which statement was asked for — a double answering "the third
 * call returns a row" would keep passing through a reordering that changed
 * which probe got which answer.
 */
function connectionThat(options: {
  readonly hasUsers?: boolean;
  readonly hasTable?: boolean;
  readonly throwsWith?: unknown;
}) {
  const { hasUsers = true, hasTable = true, throwsWith } = options;
  const statements: string[] = [];
  const writes: Array<{ sql: string; values: readonly unknown[] }> = [];
  let ended = false;
  const conn = {
    async query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<[T, unknown]> {
      statements.push(sql);
      if (throwsWith !== undefined) throw throwsWith;
      if (/SHOW TABLES LIKE 'users'/.test(sql)) return [(hasUsers ? [{}] : []) as T, null];
      if (/SHOW TABLES LIKE/.test(sql)) return [(hasTable ? [{}] : []) as T, null];
      /* No optional column exists in this world — the count-only road, which
         is the one that has worked since before any of the three migrations. */
      if (/SHOW COLUMNS/.test(sql)) return [[] as unknown as T, null];
      if (/INSERT INTO/i.test(sql)) writes.push({ sql, values: values ?? [] });
      return [[] as unknown as T, null];
    },
    end() {
      ended = true;
    },
  };
  return { conn, statements, writes, wasEnded: () => ended };
}

/**
 * A `gh` double that answers each of the reading's four calls from fixtures.
 *
 * ⚠ **Nothing here reaches GitHub, and that is what makes the counting arms
 * mean anything.** Before the seam existed, driving this reading needed an
 * authenticated `gh` and a real queue behind it — a test that measures GitHub
 * rather than this code, and one that times out when either is slow.
 *
 * A label with no fixture answers zero cards, which is a real answer: most
 * categories are empty in a fixture built to watch one of them.
 */
function ghThatReports(openByLabel: Readonly<Record<string, number>>): QueueGhReader {
  const cardsFor = (label: string) =>
    Array.from({ length: openByLabel[label] ?? 0 }, (_unused, index) => ({
      number: 1000 + index,
      title: `a ${label} card`,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      labels: [{ name: label }],
    }));
  return (args) => {
    const at = args.indexOf("--label");
    if (at !== -1) return JSON.stringify(cardsFor(args[at + 1]!));
    if (args.includes("sort:created-asc")) {
      return JSON.stringify([{ number: 1000, createdAt: "2026-09-01T00:00:00Z" }]);
    }
    if (args.includes("pr")) return JSON.stringify([]);
    /* The whole open queue, for the pipeline groups. */
    return JSON.stringify(Object.keys(openByLabel).flatMap(cardsFor));
  };
}

/** What the reading wrote for one category, read back out of the statements. */
function storedCountFor(
  writes: ReadonlyArray<{ sql: string; values: readonly unknown[] }>,
  key: string,
): number | null {
  for (const write of writes) {
    if (write.values[0] === key) return Number(write.values[1]);
  }
  return null;
}

describe("the reading the shift close takes when it is finished", () => {
  it("comes back as a REFUSAL, never a throw, in a world without the table", async () => {
    const { conn } = connectionThat({ hasTable: false });
    const outcome = await refreshQueueCounts(conn, ghThatReports({}), QUIET);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false ? outcome.reason : "").toMatch(/does not exist in this world/);
  });

  it("refuses rather than counting when the existence reader cannot say yes", async () => {
    const { conn } = connectionThat({ hasUsers: false });
    const outcome = await refreshQueueCounts(conn, ghThatReports({}), QUIET);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false ? outcome.reason : "").toMatch(/cannot see `users`/);
  });

  it("⚠ POSITIVE CONTROL — a healthy world comes back `ok`", async () => {
    const { conn, statements } = connectionThat({});
    const outcome = await refreshQueueCounts(conn, ghThatReports({ bug: 3 }), QUIET);
    expect(outcome.ok).toBe(true);
    /* It really looked: the two existence probes and the three column probes at
       minimum, so arm 1 cannot be passing on a reader that never queried. */
    expect(statements.length).toBeGreaterThan(4);
  });

  it("never ends the connection it was handed — the caller owns it", async () => {
    const { conn, wasEnded } = connectionThat({});
    await refreshQueueCounts(conn, ghThatReports({ bug: 3 }), QUIET);
    expect(wasEnded()).toBe(false);
  });

  it("does not end it on the refusal road either", async () => {
    const { conn, wasEnded } = connectionThat({ hasTable: false });
    await refreshQueueCounts(conn, ghThatReports({}), QUIET);
    expect(wasEnded()).toBe(false);
  });
});

/**
 * ⚠ THE CARD'S OWN BAR (#618), DRIVEN.
 *
 * *"after any shift closes, the Bugs figure on his page equals `gh issue list
 * --label bug --state open | length` within one edition; a fixture with three
 * closes during a shift shows the count fall by three at that shift's close."*
 *
 * Two readings a shift apart, against a queue that lost three bug cards in
 * between. Before this change only the FIRST of them was ever taken, so his
 * panel kept the opening number all night — which is the whole defect he
 * reported.
 */
describe("⚠ the number on his panel follows what the shift closed", () => {
  it("falls by three when three bug cards close during the shift", async () => {
    const atStart = connectionThat({});
    await refreshQueueCounts(atStart.conn, ghThatReports({ bug: 11 }), QUIET);
    expect(storedCountFor(atStart.writes, "bugs")).toBe(11);

    const atClose = connectionThat({});
    await refreshQueueCounts(atClose.conn, ghThatReports({ bug: 8 }), QUIET);
    expect(storedCountFor(atClose.writes, "bugs")).toBe(8);
  });

  it("⚠ POSITIVE CONTROL — a queue that did not move writes the same number twice", async () => {
    const first = connectionThat({});
    const second = connectionThat({});
    await refreshQueueCounts(first.conn, ghThatReports({ bug: 11 }), QUIET);
    await refreshQueueCounts(second.conn, ghThatReports({ bug: 11 }), QUIET);
    expect(storedCountFor(first.writes, "bugs")).toBe(11);
    expect(storedCountFor(second.writes, "bugs")).toBe(11);
  });

  it("writes the count for every category, not only the one that moved", async () => {
    const { conn, writes } = connectionThat({});
    await refreshQueueCounts(conn, ghThatReports({ bug: 8 }), QUIET);
    /* Zero is a real answer and must still be written — the panel's own rule
       since #277 is that a row never vanishes, or he cannot tell "nothing
       there" from "not offered". */
    expect(storedCountFor(writes, "security")).toBe(0);
  });
});

describe("⚠ the quiet wrapper — the property that it cannot cost a shift its close", () => {
  it("RESOLVES when the connection throws, and reports why", async () => {
    const boom = new Error("ECONNRESET: the database went away mid-close");
    const { conn } = connectionThat({ throwsWith: boom });
    const said: string[] = [];
    const outcome = await refreshQueueCountsQuietly(conn, (line) => said.push(line), ghThatReports({ bug: 3 }), QUIET);
    expect(outcome.ok).toBe(false);
    expect(said.join("\n")).toContain("ECONNRESET");
    expect(said.join("\n")).toMatch(/close is unaffected/);
  });

  it("RESOLVES on a thrown non-Error too — every road, not a chosen family", async () => {
    const { conn } = connectionThat({ throwsWith: "a bare string nobody expected" });
    const said: string[] = [];
    const outcome = await refreshQueueCountsQuietly(conn, (line) => said.push(line), ghThatReports({ bug: 3 }), QUIET);
    expect(outcome.ok).toBe(false);
    expect(said.join("\n")).toContain("a bare string nobody expected");
  });

  it("reports a REFUSAL as well as a throw — a stale panel with nobody told why is the failure", async () => {
    const { conn } = connectionThat({ hasTable: false });
    const said: string[] = [];
    const outcome = await refreshQueueCountsQuietly(conn, (line) => said.push(line), ghThatReports({ bug: 3 }), QUIET);
    expect(outcome.ok).toBe(false);
    expect(said.join("\n")).toMatch(/the count REFUSED/);
  });

  it("⚠ POSITIVE CONTROL — says nothing at all when the count works", async () => {
    const { conn } = connectionThat({});
    const said: string[] = [];
    const outcome = await refreshQueueCountsQuietly(conn, (line) => said.push(line), ghThatReports({ bug: 3 }), QUIET);
    expect(outcome.ok).toBe(true);
    expect(said).toEqual([]);
  });
});

/**
 * ⚠ THE TWO ROADS PR #669's REVIEW FOUND, BOTH DRIVEN.
 *
 * Finding 1 — **a hang is not a throw.** The wrapper resolves on every road it
 * can see; a `gh` that blocks forever is none of them, so no arm above could
 * ever have caught it. Now it sits on the shift close, a timeout turns the
 * invisible road into `ETIMEDOUT`, which the catch already handles.
 *
 * Finding 2 — **the `warn` sink was advertised and never invoked.** Eight
 * warning sites inside the three readers wrote straight to `console.error`, so
 * a caller passing `warn` captured nothing while believing it had — the
 * `guard-docblock-is-an-unchecked-claim` class expressed in a type instead of
 * a comment, in the very file whose docblock names that class.
 */
describe("⚠ the roads the review found", () => {
  it("the real `gh` reader carries a timeout — a hang is the road the catch cannot rescue", () => {
    const source = readFileSync(
      join(__dirname, "..", "scripts", "lib", "crewQueueCount.mts"),
      "utf8",
    );
    expect(source).toMatch(/const REAL_GH[\s\S]{0,400}?timeout: QUEUE_GH_TIMEOUT_MS/);
    /* Generous on purpose: the whole reading is a handful of `gh` calls, so
       this may only ever fire on a genuine hang, never on a slow day. */
    expect(QUEUE_GH_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("⚠ NEGATIVE CONTROL — the same reading fails on a reader with no timeout", () => {
    const doctored = 'const REAL_GH: QueueGhReader = (args) => execFileSync("gh", [...args], { encoding: "utf8" });';
    expect(doctored).not.toMatch(/const REAL_GH[\s\S]{0,400}?timeout: QUEUE_GH_TIMEOUT_MS/);
  });

  it("a failing `gh` routes its warning through the sink, not past it", async () => {
    const { conn } = connectionThat({});
    const said: string[] = [];
    const ghThatDies: QueueGhReader = () => {
      throw new Error("gh: not logged in");
    };
    const outcome = await refreshQueueCounts(conn, ghThatDies, { log: () => {}, warn: (line) => said.push(line) });
    /* The reading still succeeds — every `gh` road degrades to a SKIPPED
       category rather than a wrong number, which is the property that lets his
       panel keep an old figure instead of learning a false one. */
    expect(outcome.ok).toBe(true);
    expect(said.join("\n")).toMatch(/could not/);
  });

  it("⚠ and a caller asking for silence GETS it — the sink's whole claim", async () => {
    const { conn } = connectionThat({});
    const ghThatDies: QueueGhReader = () => {
      throw new Error("gh: not logged in");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await refreshQueueCounts(conn, ghThatDies, QUIET);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * THE ORDERING, READ AT THE SOURCE.
 *
 * ⚠ **This is the one property no unit arm above can reach**, because it is
 * about the shift close's own shape: the count must run only once the run row
 * is terminal. A count that ran first would put a `gh` read and a table write
 * in front of the UPDATE his page depends on.
 *
 * The negative control is what makes it worth having — the same reading is run
 * against a DOCTORED source with the two swapped, and must fail there.
 */
function orderingHolds(source: string): boolean {
  const update = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
  const refresh = source.indexOf("refreshQueueCountsQuietly(conn");
  return update > 0 && refresh > 0 && update < refresh;
}

describe("the close refreshes his numbers only once the row is terminal", () => {
  it("calls the quiet wrapper, and calls it AFTER the terminal UPDATE", () => {
    const source = readFileSync(CLOSE, "utf8");
    expect(source).toContain("refreshQueueCountsQuietly");
    expect(orderingHolds(source)).toBe(true);
  });

  it("⚠ NEGATIVE CONTROL — the same reading fails on a source with the two swapped", () => {
    const doctored = [
      "await refreshQueueCountsQuietly(conn, (line) => console.error(line));",
      "await conn.query(`UPDATE x SET endedAt = UTC_TIMESTAMP() WHERE id = ?`);",
    ].join("\n");
    expect(orderingHolds(doctored)).toBe(false);
  });

  it("⚠ NEGATIVE CONTROL — and on a source that never calls it at all", () => {
    expect(orderingHolds("await conn.query(`UPDATE x SET endedAt = UTC_TIMESTAMP()`);")).toBe(false);
  });

  it("⚠ the close spawns nothing to do it — the road #618 refused by name", () => {
    const source = readFileSync(CLOSE, "utf8");
    expect(source).not.toMatch(/execFileSync|spawnSync|child_process/);
  });
});

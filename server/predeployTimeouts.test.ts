/**
 * #2501 step 2 — the judging half of `scripts/predeploy-timeouts.mts`.
 *
 * The positive control is the real event list Railway returned for
 * `9b3ef98d` (the deployment #2501 was filed on), read 2026-10-14 and copied
 * here step for step with only the error-free payload fields dropped.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";

import { readListedSource } from "./testing/listedSource";
import {
  eventsFromConnection,
  isReadOnlyDocument,
  judgeDeployLog,
  judgeDeployment,
  logLinesFromResponse,
  LOG_LINES_SHOWN,
  makeQuery,
  pickTarget,
  projectsFromMe,
  reachedPredeploy,
  renderDeployLog,
  renderReading,
  summarize,
  type FetchLike,
  type Judged,
} from "../scripts/lib/predeployTimeouts.mts";

const node = (step: string, createdAt: string, completedAt: string, error: string | null = null) => ({
  node: { step, createdAt, completedAt, payload: { attempt: null, detail: null, durationMs: null, error, maxAttempts: null, reason: null, skipped: null } },
});

/** `deploymentEvents(id: "9b3ef98d-…")`, as Railway answered it. */
const TIMED_OUT = {
  edges: [
    node("SNAPSHOT_CODE", "2026-10-14T15:04:49.906Z", "2026-10-14T15:08:39.413Z"),
    node("BUILD_IMAGE", "2026-10-14T15:04:57.759Z", "2026-10-14T15:08:39.416Z"),
    node("PUBLISH_IMAGE", "2026-10-14T15:08:39.423Z", "2026-10-14T15:08:39.351Z"),
    node("PRE_DEPLOY_COMMAND", "2026-10-14T15:08:41.421Z", "2026-10-14T15:18:52.320Z", "Pre-deploy command timed out after 600 seconds"),
  ],
};

const SUCCEEDED = {
  edges: [
    node("BUILD_IMAGE", "2026-10-14T16:00:00.000Z", "2026-10-14T16:03:00.000Z"),
    node("PRE_DEPLOY_COMMAND", "2026-10-14T16:03:02.000Z", "2026-10-14T16:03:04.000Z"),
    node("HEALTHCHECK", "2026-10-14T16:03:05.000Z", "2026-10-14T16:03:20.000Z"),
  ],
};

const SUPERSEDED = { edges: [node("SNAPSHOT_CODE", "2026-10-14T16:00:00.000Z", "2026-10-14T16:00:10.000Z")] };

describe("judgeDeployment — the verdict off one deployment's events", () => {
  it("POSITIVE: the real 9b3ef98d events read as a pre-deploy timeout held 611 s", () => {
    const verdict = judgeDeployment(eventsFromConnection(TIMED_OUT));
    expect(verdict).toEqual({
      kind: "predeploy-timeout",
      error: "Pre-deploy command timed out after 600 seconds",
      heldSeconds: 611,
    });
  });

  it("NEGATIVE: a pre-deploy that FAILED (not timed out) is not counted as a timeout", () => {
    const failed = { edges: [node("PRE_DEPLOY_COMMAND", "2026-09-30T07:40:00Z", "2026-09-30T07:40:05Z", "Pre-deploy command failed")] };
    expect(judgeDeployment(eventsFromConnection(failed))).toEqual({ kind: "predeploy-failed", error: "Pre-deploy command failed" });
  });

  it("NEGATIVE: a clean deployment is no-error, and an error at another step is named by its step", () => {
    expect(judgeDeployment(eventsFromConnection(SUCCEEDED))).toEqual({ kind: "no-error" });
    const build = { edges: [node("BUILD_IMAGE", "2026-09-30T07:40:00Z", "2026-09-30T07:41:00Z", "Build failed")] };
    expect(judgeDeployment(eventsFromConnection(build))).toEqual({ kind: "failed-elsewhere", step: "BUILD_IMAGE", error: "Build failed" });
  });

  it("an unreadable or empty event list is UNREAD — never folded into no-error", () => {
    expect(judgeDeployment(eventsFromConnection(undefined))).toEqual({ kind: "unread" });
    expect(judgeDeployment(eventsFromConnection({ nope: 1 }))).toEqual({ kind: "unread" });
    expect(judgeDeployment(eventsFromConnection({ edges: [] }))).toEqual({ kind: "unread" });
  });

  it("reachedPredeploy is the denominator: a superseded build never reached the step", () => {
    expect(reachedPredeploy(eventsFromConnection(TIMED_OUT))).toBe(true);
    expect(reachedPredeploy(eventsFromConnection(SUCCEEDED))).toBe(true);
    expect(reachedPredeploy(eventsFromConnection(SUPERSEDED))).toBe(false);
    expect(reachedPredeploy(null)).toBe(false);
  });
});

describe("summarize / renderReading", () => {
  const row = (id: string, status: string, createdAt: string, events: unknown): Judged => {
    const parsed = eventsFromConnection(events);
    return { id, status, createdAt, commitHash: "74dfca76587dc857f12ccc9c3c1c47fe0920600e", verdict: judgeDeployment(parsed), reachedPredeploy: reachedPredeploy(parsed) };
  };

  it("counts timeouts against the total and the pre-deploy denominator, with dates", () => {
    const reading = summarize([
      row("9b3ef98d-1ba5", "FAILED", "2026-10-14T15:04:42.499Z", TIMED_OUT),
      row("3c34fa8a-0000", "SUCCESS", "2026-10-14T15:30:00.000Z", SUCCEEDED),
      row("aaaaaaaa-0000", "REMOVED", "2026-10-13T10:00:00.000Z", SUPERSEDED),
    ]);
    expect(reading.total).toBe(3);
    expect(reading.reachedPredeploy).toBe(2);
    expect(reading.timeouts.map((d) => d.id)).toEqual(["9b3ef98d-1ba5"]);
    expect(reading.windowFrom).toBe("2026-10-13T10:00:00.000Z");
    expect(reading.windowTo).toBe("2026-10-14T15:30:00.000Z");
    const text = renderReading(reading, "Drape");
    expect(text).toContain("pre-deploy TIMED OUT: 1");
    expect(text).toContain("2026-10-14 15:04Z  9b3ef98d  74dfca765  held 611s");
    expect(text).not.toContain("FLOOR");
  });

  it("an unread FAILED deployment turns the count into a stated floor", () => {
    const text = renderReading(summarize([row("bbbbbbbb-0000", "FAILED", "2026-10-01T00:00:00Z", null)]), "Drape");
    expect(text).toContain("pre-deploy TIMED OUT: 0");
    expect(text).toContain("FLOOR, not a total");
  });

  it("a reading cut short by --limit says so", () => {
    expect(renderReading(summarize([]), "Drape", true)).toContain("the --limit was reached");
    expect(renderReading(summarize([]), "Drape", false)).not.toContain("the --limit was reached");
  });
});

/* ───────── #2501 step 3 · the log beside the count, and the control on it ───────── */

/**
 * `deploymentLogs(deploymentId: "9b3ef98d-…")` as Railway answered it on
 * 2026-10-14, copied line for line. This is the incident: three pre-deploy
 * lines ending on the verdict, and then nothing for ten minutes.
 */
const TIMEOUT_LOG = [
  { timestamp: "2026-10-14T15:08:50.407383993Z", message: "Starting Container" },
  { timestamp: "2026-10-14T15:08:50.963398745Z", message: "predeploy: mysql.railway.internal:3306/railway" },
  { timestamp: "2026-10-14T15:08:50.963401858Z", message: "[db] mysql.railway.internal:3306/railway" },
  { timestamp: "2026-10-14T15:08:50.963404721Z", message: "  nothing pending — the service holds everything the code declares" },
];

describe("#2501 step 3 · judgeDeployLog — zero lines is three different facts", () => {
  it("POSITIVE: the real 9b3ef98d log reads as READ, with its four lines", () => {
    const verdict = judgeDeployLog(logLinesFromResponse(TIMEOUT_LOG), []);
    expect(verdict.kind).toBe("read");
    expect(verdict.kind === "read" && verdict.lines).toHaveLength(4);
  });

  it("⚠ THE CORRECTION: empty with an empty same-day control is PAST RETENTION, not silence", () => {
    /* The 2026-09-09 timeout returned zero lines and a hand reading took that
       for a container that printed nothing. Twelve same-day deployments were
       empty too — the day is gone. This is the arm that keeps the wrong
       reading from coming back. */
    expect(judgeDeployLog([], [{ id: "213eee0b-aaaa", lines: [] }])).toEqual({
      kind: "past-retention",
      controlId: "213eee0b-aaaa",
    });
  });

  it("⚠ AND THE OTHER WAY: empty while the day is readable IS a silent container", () => {
    expect(judgeDeployLog([], [{ id: "74fb050f-bbbb", lines: TIMEOUT_LOG }])).toEqual({
      kind: "silent",
      controlId: "74fb050f-bbbb",
    });
  });

  it("ONE readable control settles it — a silent control cannot turn a live day into a dead one", () => {
    /* The order is deliberately worst-case: the empty control comes first. */
    expect(judgeDeployLog([], [
      { id: "empty000-0000", lines: [] },
      { id: "haslines-0000", lines: TIMEOUT_LOG },
    ]).kind).toBe("silent");
  });

  it("FAIL-CLOSED: empty with no readable control is UNDECIDED, never one of the two", () => {
    expect(judgeDeployLog([], []).kind).toBe("undecided");
    expect(judgeDeployLog([], [{ id: "x", lines: null }]).kind).toBe("undecided");
    expect(judgeDeployLog([], []).kind).not.toBe("past-retention");
    expect(judgeDeployLog([], []).kind).not.toBe("silent");
  });

  it("a failed log query is UNREAD and carries the API's own message", () => {
    expect(judgeDeployLog(null, [], "Not Authorized")).toEqual({ kind: "unread", why: "Not Authorized" });
  });

  it("logLinesFromResponse: a non-array answer is null, and a malformed row is dropped not guessed", () => {
    expect(logLinesFromResponse(undefined)).toBeNull();
    expect(logLinesFromResponse({ nope: 1 })).toBeNull();
    expect(logLinesFromResponse([])).toEqual([]);
    expect(logLinesFromResponse([{ message: "a" }, { timestamp: "t" }, null])).toEqual([{ timestamp: null, message: "a" }]);
  });
});

describe("#2501 step 3 · the reading prints the words under the row", () => {
  const timeout = (log?: ReturnType<typeof judgeDeployLog>): Judged => {
    const parsed = eventsFromConnection(TIMED_OUT);
    return {
      id: "9b3ef98d-1ba5",
      status: "FAILED",
      createdAt: "2026-10-14T15:04:42.499Z",
      commitHash: "74dfca76587dc857f12ccc9c3c1c47fe0920600e",
      verdict: judgeDeployment(parsed),
      reachedPredeploy: reachedPredeploy(parsed),
      ...(log ? { log } : {}),
    };
  };

  it("the verdict line the card is waiting on reaches the reading", () => {
    const text = renderReading(summarize([timeout(judgeDeployLog(logLinesFromResponse(TIMEOUT_LOG), []))]), "Drape");
    expect(text).toContain("held 611s");
    expect(text).toContain("log (4 line(s))");
    expect(text).toContain("nothing pending — the service holds everything the code declares");
  });

  it("an aged-out log says GONE and says it cannot be diagnosed — not an empty space", () => {
    const text = renderReading(summarize([timeout(judgeDeployLog([], [{ id: "213eee0b-aaaa", lines: [] }]))]), "Drape");
    expect(text).toContain("GONE — past Railway's log retention");
    expect(text).toContain("213eee0b");
    expect(text).not.toContain("printed nothing");
  });

  it("a timeout nobody fetched a log for prints no log line at all, and the count still stands", () => {
    const text = renderReading(summarize([timeout()]), "Drape");
    expect(text).toContain("pre-deploy TIMED OUT: 1");
    expect(text).not.toContain("log");
  });

  it("⚠ the dump is CAPPED and the cap is visible, so it can never read as the whole log", () => {
    const many = Array.from({ length: LOG_LINES_SHOWN + 5 }, (_, i) => ({ timestamp: null, message: `line ${i}` }));
    const lines = renderDeployLog(judgeDeployLog(many, []));
    expect(lines[0]).toContain(`log (${LOG_LINES_SHOWN + 5} line(s), first ${LOG_LINES_SHOWN} shown)`);
    expect(lines).toHaveLength(LOG_LINES_SHOWN + 1);
    expect(lines.join("\n")).toContain(`line ${LOG_LINES_SHOWN - 1}`);
    expect(lines.join("\n")).not.toContain(`line ${LOG_LINES_SHOWN}`);
  });
});

describe("read-only at the wire", () => {
  it("isReadOnlyDocument admits queries and refuses mutations and subscriptions", () => {
    expect(isReadOnlyDocument("{ me { id } }")).toBe(true);
    expect(isReadOnlyDocument("query ($a: String) { deployment(id: $a) { id } }")).toBe(true);
    expect(isReadOnlyDocument("mutation { deploymentRedeploy(id: \"x\") { id } }")).toBe(false);
    expect(isReadOnlyDocument("query { me { id } } mutation { variableUpsert(input: {}) }")).toBe(false);
    expect(isReadOnlyDocument("subscription { deploymentLogs(deploymentId: \"x\") { message } }")).toBe(false);
    expect(isReadOnlyDocument("")).toBe(false);
  });

  it("makeQuery never calls fetch for a mutation, and sends a query once", async () => {
    const sent: string[] = [];
    const fakeFetch: FetchLike = async (_url, init) => {
      sent.push(init.body);
      return { ok: true, status: 200, json: async () => ({ data: { me: { id: "u" } } }) };
    };
    const query = makeQuery(fakeFetch, "https://example.invalid/graphql", () => "SECRET-TOKEN");
    await expect(query("mutation { serviceInstanceRedeploy(serviceId: \"s\", environmentId: \"e\") }")).rejects.toThrow(/not a plain query/);
    expect(sent).toHaveLength(0);
    await expect(query("{ me { id } }")).resolves.toEqual({ me: { id: "u" } });
    expect(sent).toHaveLength(1);
  });

  it("an API error surfaces the API's message and never the token", async () => {
    const fakeFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ errors: [{ message: "Not Authorized" }] }) });
    const query = makeQuery(fakeFetch, "https://example.invalid/graphql", () => "SECRET-TOKEN");
    const err = await query("{ me { id } }").catch((e: Error) => e);
    expect((err as Error).message).toContain("Not Authorized");
    expect((err as Error).message).not.toContain("SECRET-TOKEN");
  });
});

describe("pickTarget — by name, exactly one, or refuse", () => {
  const me = {
    me: {
      workspaces: [
        {
          projects: {
            edges: [
              { node: { id: "p1", name: "drape-production", services: { edges: [{ node: { id: "s1", name: "Drape" } }, { node: { id: "s2", name: "MySQL" } }] }, environments: { edges: [{ node: { id: "e1", name: "production" } }] } } },
              { node: { id: "p2", name: "drape-dev", services: { edges: [{ node: { id: "s3", name: "MySQL" } }] }, environments: { edges: [{ node: { id: "e2", name: "production" } }] } } },
            ],
          },
        },
      ],
    },
  };

  it("resolves the production Drape service", () => {
    expect(pickTarget(projectsFromMe(me), { project: "drape-production", environment: "production", service: "Drape" })).toEqual({
      projectId: "p1",
      environmentId: "e1",
      serviceId: "s1",
    });
  });

  it("refuses a missing service and names what is there", () => {
    expect(() => pickTarget(projectsFromMe(me), { project: "drape-dev", environment: "production", service: "Drape" })).toThrow(
      /exactly one service named "Drape", found 0 \(have: MySQL\)/,
    );
  });

  it("refuses an empty listing rather than guessing", () => {
    expect(() => pickTarget(projectsFromMe({}), { project: "drape-production", environment: "production", service: "Drape" })).toThrow(/found 0/);
  });
});

/**
 * ⚠ **THE COUNTER'S CALLER — invariant 7, on the one instrument whose output
 * window is thirty days wide (#2501).**
 *
 * Steps 1 to 3 of #2501 all shipped, and then nothing ran the result. Measured
 * at the bytes 2026-10-15, `git grep predeploy-timeouts` over the tracked tree
 * answered with **its own module, its own header and this suite and nothing
 * else** — no patrol clock, no document, no shift-close step, no mention in the
 * standing orders. So the reading existed and was never taken.
 *
 * That is not a tidiness point here, because **this instrument's subject
 * expires.** `armExitWatchdog`'s line is the only thing that will ever name what
 * held a timed-out pre-deploy, it is printed into that deployment's log and
 * nowhere else, Railway keeps a log about thirty days, and a timeout arrives
 * about once every two to three weeks. An uncalled counter therefore does not
 * merely go unread — **it guarantees the card's own last question can never be
 * answered**, which is exactly what already happened to the 2026-09-09 instance.
 *
 * So the wiring is a FACT this suite holds, not prose in a docblock: the Machinist
 * ledger names the command, and its clock is short enough to read a log four
 * times before the wall. #286's lesson, on the card that needs it most.
 *
 * ⚠ **This reads ONE value out of ONE named file and derives no population.**
 * `scripts/patrol-clocks.mts` owns the canonical `**Clock:**` reader and
 * `server/patrolClocks.test.ts` already holds every `docs/` log's line to it, so
 * the line's existence and spelling are guarded there; this arm only asks what
 * the number is.
 */
describe("the counter is on a clock, and the clock beats the retention wall", () => {
  /** Railway's measured log retention, from the lib header's own reading. */
  const RETENTION_DAYS = 30;
  const LEDGER = "docs/MACHINIST_LEDGER.md";

  const ledger = () => {
    const absolute = path.resolve(
      new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      LEDGER,
    );
    const source = readListedSource(absolute);
    expect(source, `${LEDGER} could not be read — this arm would be reading nothing`).not.toBeNull();
    return source ?? "";
  };

  it("⚠ a patrol log names the counter, or nobody ever runs it", () => {
    expect(
      ledger(),
      `${LEDGER} no longer names scripts/predeploy-timeouts.mts — the counter has lost its only caller,`
        + " and the watchdog line it exists to carry will age out of Railway's log retention unread",
    ).toContain("scripts/predeploy-timeouts.mts");
  });

  it("⚠ it names a --limit, because the default covers less than the clock", () => {
    /* Measured 2026-10-15 on this service: the default 200 reached back 4 days
       and 500 reached back 12.5. At ~50 deploys a day a seven-day clock run
       without a limit silently skips the days between. */
    expect(
      ledger(),
      `${LEDGER} cites the counter without a --limit, so a run on its clock would read back about four`
        + " days and miss the rest of the window",
    ).toMatch(/scripts\/predeploy-timeouts\.mts\s+--limit\s+(\d+)/);
    const limit = Number(/scripts\/predeploy-timeouts\.mts\s+--limit\s+(\d+)/.exec(ledger())?.[1]);
    expect(limit, "the cited --limit is below the 500 measured to cover 12.5 days").toBeGreaterThanOrEqual(500);
  });

  it("⚠ the clock it sits on reads a log at least twice before retention takes it", () => {
    const clock = /^\*\*Clock:\*\*\s+every\s+(\d+)\s+days?\b/m.exec(ledger());
    expect(clock, `${LEDGER} declares no clock, so citing the counter there schedules nothing`).not.toBeNull();
    const days = Number(clock?.[1]);
    expect(days, "the clock is not a positive number of days").toBeGreaterThan(0);
    expect(
      days * 2,
      `${LEDGER}'s clock is every ${days} days against a ${RETENTION_DAYS}-day log retention — a diagnosis`
        + " printed into a deploy log would age out before a second reading could catch it",
    ).toBeLessThanOrEqual(RETENTION_DAYS);
  });
});

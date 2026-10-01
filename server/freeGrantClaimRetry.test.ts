/**
 * THE FREE-GRANT CLAIM IS RETRIED BEFORE IT IS GIVEN UP ON — #1715.
 *
 * Named by the relay in its hand verdict on PR #1712 (#1603, P1-4): *"`recordFreeGrantClaim`
 * swallows its insert error, so a database blip at that instant grants without a
 * claim row — one free retry of the cap, worth a sentence or a retry."*
 *
 * # What is being protected, in one sentence
 *
 * The claim row is how the product knows a device and a network have already had
 * a free grant. It is the **one write in the two quiet limits that fails OPEN by
 * necessity** — both cap READS fail closed by design — so it is the whole of the
 * soft edge, and a row lost to a blip is one signup that is never counted.
 *
 * # Why the swallow stays, which is the half this card does NOT change
 *
 * By the time this runs the account exists and the credits are granted. Throwing
 * would hand a customer an error over a bookkeeping row and leave her unable to
 * sign in to an account she now owns. **So a give-up is still silent to her**,
 * and an arm below holds exactly that.
 *
 * # What this suite drives that the function's own reasoning cannot
 *
 * Three claims, and each needs a driven insert rather than a read of the code:
 *
 *   1. **a failure that passes is recovered** — the row is written, and the
 *      caller never learns anything happened;
 *   2. **a failure that persists is bounded** — three attempts, not a loop that
 *      holds a signup open, and the give-up does not throw;
 *   3. **an ABSENT database is not retried at all** — a different case from a
 *      blip, and the one a well-meaning retry would have made worse by adding
 *      125 ms to every signup through an outage.
 *
 * # The sleep is injected, and that is the only reason this runs in milliseconds
 *
 * `dependencies.sleep` is a seam for the driver, never for the product — nothing
 * in the tree passes it. The arms assert the DELAYS ASKED FOR rather than the
 * time elapsed: a test that measured wall-clock would be a clock in disguise
 * (`selector-both-states-satisfy`'s class), and one that let the real `setTimeout`
 * run would add 125 ms per arm to the suite for nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const getDb = vi.fn();

vi.mock("./db/connection", async () => {
  const real = await vi.importActual<typeof import("./db/connection")>("./db/connection");
  return { ...real, getDb: (...args: unknown[]) => getDb(...args) };
});

const logged: { level: string; message: string; meta: Record<string, unknown> }[] = [];
vi.mock("./logging/logger", () => ({
  createModuleLogger: () => {
    const record = (level: string) => (meta: Record<string, unknown>, message?: string) => {
      logged.push({ level, message: message ?? "", meta });
    };
    return { info: record("info"), warn: record("warn"), error: record("error"), debug: record("debug") };
  },
}));

const { recordFreeGrantClaim } = await import("./db/quietLimits");

const CLAIM = { deviceKey: "cookie:4f1c2e3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b", ipAddress: "203.0.113.7", userId: 4242 };

/** A blip as mysql2 actually reports one, rather than a generic `Error`. */
const BLIP = () => new Error("Got timeout reading communication packets");

/** The delays the function asked for, in order — never the time that passed. */
let slept: number[] = [];
const sleep = async (ms: number): Promise<void> => { slept.push(ms); };

beforeEach(() => {
  vi.clearAllMocks();
  logged.length = 0;
  slept = [];
  /* `db.insert(table).values(row)` — the two-step shape the real call uses, so a
     refactor to a single call would redden here rather than silently stop being
     driven. */
  getDb.mockResolvedValue({ insert: (...args: unknown[]) => ({ values: (row: unknown) => insert(args[0], row) }) });
});

describe("a claim insert that fails once", () => {
  it("⚠ is retried and the row IS written — the defect this card is about", async () => {
    insert.mockRejectedValueOnce(BLIP()).mockResolvedValueOnce(undefined);

    await recordFreeGrantClaim(CLAIM, { sleep });

    expect(insert, "the insert was not retried").toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenLastCalledWith(expect.anything(), {
      deviceKey: CLAIM.deviceKey,
      ipAddress: CLAIM.ipAddress,
      userId: CLAIM.userId,
    });
    /* It waited before the second attempt. An immediate retry on a connection
       that has just dropped is a retry that looks present and behaves like none. */
    expect(slept).toEqual([25]);
    /* And it SAYS a retry happened: without the line, a recovered blip is
       indistinguishable from a quiet night. */
    expect(logged.filter((line) => line.level === "error")).toEqual([]);
    expect(logged.some((line) => line.level === "info" && /recorded on a retry/.test(line.message)))
      .toBe(true);
  });

  it("recovers on the LAST attempt too, which is the boundary of the bound", async () => {
    insert.mockRejectedValueOnce(BLIP()).mockRejectedValueOnce(BLIP()).mockResolvedValueOnce(undefined);

    await recordFreeGrantClaim(CLAIM, { sleep });

    expect(insert).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([25, 100]);
    expect(logged.filter((line) => line.level === "error")).toEqual([]);
  });
});

describe("a claim insert that always fails", () => {
  it("⚠ is bounded, is logged, and does NOT throw — the swallow is unchanged", async () => {
    insert.mockRejectedValue(BLIP());

    /*
      THE CLAIM THE CARD WAS EXPLICIT ABOUT KEEPING. A throw here would hand a
      customer an error over a bookkeeping row, on an account she already owns.
      `.resolves` rather than a try/catch, so a rejection fails the arm instead
      of being caught by it.
    */
    await expect(recordFreeGrantClaim(CLAIM, { sleep })).resolves.toBeUndefined();

    expect(insert, "the retry is not bounded at three attempts").toHaveBeenCalledTimes(3);
    /* Two waits for three attempts: nothing is slept after the last one, which is
       a signup held open for no possible benefit. */
    expect(slept).toEqual([25, 100]);

    const errors = logged.filter((line) => line.level === "error");
    expect(errors).toHaveLength(1);
    /* The give-up names its own cost rather than only its failure — a staff member
       reading this needs to know a signup went uncounted, not just that an insert
       failed. */
    expect(errors[0]!.message).toMatch(/giving up/i);
    expect(errors[0]!.message).toMatch(/not counted/i);
    expect(errors[0]!.meta).toMatchObject({ userId: CLAIM.userId, attempts: 3 });
  });
});

describe("the happy path is untouched", () => {
  it("⚠ THE POSITIVE CONTROL — one attempt, no wait, no log", async () => {
    /*
      Without this arm, every arm above passes against a function that retried
      three times on EVERY signup — which would be a correct-looking suite over a
      product paying 125 ms and three inserts for every account created.
    */
    insert.mockResolvedValue(undefined);

    await recordFreeGrantClaim(CLAIM, { sleep });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(slept, "the happy path paid a delay").toEqual([]);
    expect(logged, "the happy path logged something").toEqual([]);
  });

  it("the product's own call passes no sleep, so the seam is the test's alone", async () => {
    /*
      A default parameter nothing exercises is an untested default. This calls the
      function the way `noteFreeGrantMade` does — one argument — and proves the
      real waiter is never reached on a path that does not fail.
    */
    insert.mockResolvedValue(undefined);
    await recordFreeGrantClaim(CLAIM);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe("an absent database", () => {
  it("⚠ is NOT retried — a configuration state is not a blip", async () => {
    /*
      The case a well-meaning retry makes worse. `getDb()` answering nothing does
      not become something 125 ms later, so retrying it would add that wait to
      every signup through an outage and change no answer. It keeps its own
      warning, which is what distinguishes it in the log from a failed insert.
    */
    getDb.mockResolvedValue(null);

    await expect(recordFreeGrantClaim(CLAIM, { sleep })).resolves.toBeUndefined();

    expect(getDb, "an absent database was asked for again").toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
    expect(slept).toEqual([]);
    const warnings = logged.filter((line) => line.level === "warn");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toMatch(/no database/i);
    expect(logged.filter((line) => line.level === "error")).toEqual([]);
  });

  it("a database that THROWS on the way to being got is retried, unlike one that is absent", async () => {
    /*
      The two are one line apart in the function and mean different things: a
      `getDb()` that throws is the pool failing, which is the blip; a `getDb()`
      that resolves to nothing is the process having no database configured. An
      implementation that treated them alike would pass every other arm here.
    */
    getDb.mockRejectedValueOnce(BLIP());
    getDb.mockResolvedValue({ insert: () => ({ values: (row: unknown) => insert(null, row) }) });
    insert.mockResolvedValue(undefined);

    await recordFreeGrantClaim(CLAIM, { sleep });

    expect(getDb).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([25]);
  });
});

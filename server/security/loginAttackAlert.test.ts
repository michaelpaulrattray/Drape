import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * THE LOGIN-ATTACK ALARM — driven directly, because that is the only way it is
 * really tested (working law 3).
 *
 * The helpers this wires have existed for months with no call site, and the
 * suite that "covered" the neighbouring velocity alert asserted only that the
 * alert *is a function* — it proved the control existed and never that it
 * fires. That is the shape being avoided here: every test below makes the
 * alarm actually go off, or actually not.
 *
 * `vi.resetModules()` per test because the attack window is module-level state
 * in `rateLimit.ts` — without it, test two would inherit test one's fifty
 * failures and the thresholds would be untested.
 */
async function freshAlarm() {
  vi.resetModules();
  return import("./loginAttackAlert");
}

const THRESHOLD = 50;

describe("the site-wide login alarm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays silent below the threshold, however many people mistype", async () => {
    const { noteFailedLogin } = await freshAlarm();
    const send = vi.fn().mockResolvedValue(undefined);

    for (let attempt = 0; attempt < THRESHOLD - 1; attempt += 1) {
      await noteFailedLogin(send);
    }

    expect(send).not.toHaveBeenCalled();
  });

  it("goes off on the failure that crosses it, and says how many", async () => {
    const { noteFailedLogin } = await freshAlarm();
    const send = vi.fn().mockResolvedValue(undefined);

    let last: Awaited<ReturnType<typeof noteFailedLogin>> | undefined;
    for (let attempt = 0; attempt < THRESHOLD; attempt += 1) {
      last = await noteFailedLogin(send);
    }

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ failedCount: THRESHOLD, severity: "warning" });
    expect(last).toEqual({ failedCount: THRESHOLD, alerted: true });
  });

  it("rings ONCE per window, not once per failure after it", async () => {
    /*
      The property that decides whether anybody still reads the channel in a
      month. An attack does not stop at the threshold — it keeps going, and an
      alarm that fires on every subsequent failure sends hundreds of messages
      and gets muted by the person it is alarming.
    */
    const { noteFailedLogin } = await freshAlarm();
    const send = vi.fn().mockResolvedValue(undefined);

    for (let attempt = 0; attempt < THRESHOLD + 25; attempt += 1) {
      await noteFailedLogin(send);
    }

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rings once even when two failures cross the line AT THE SAME TIME", async () => {
    /*
      THE TEST THAT WAS MISSING, and the module's comment was claiming its
      property without it. `markGlobalAttackAlertSent()` is called BEFORE the
      send rather than after; I sabotaged that ordering and every test here
      stayed green, because they all await one call before making the next and
      a sequential loop can never see the race.

      Real traffic is not sequential. Two failures arriving while a slow Slack
      send is in flight would BOTH find an unmarked window and both alert —
      and under a real attack that is not two messages, it is a flood, which is
      how an alarm gets muted by the person it is alarming.

      A lost message costs one alert; marking after would cost the channel.
    */
    const { noteFailedLogin } = await freshAlarm();
    let release: () => void = () => {};
    const inFlight = new Promise<void>((resolve) => { release = resolve; });
    const send = vi.fn().mockReturnValue(inFlight);

    for (let attempt = 0; attempt < THRESHOLD - 1; attempt += 1) {
      await noteFailedLogin(send);
    }

    /* Both cross the line with the first send still unresolved. */
    const both = Promise.all([noteFailedLogin(send), noteFailedLogin(send)]);
    release();
    await both;

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("NEVER lets a broken alarm break a login", async () => {
    /*
      The alarm sits on the auth path. A Slack outage, a bad webhook or a
      network stall must not turn "your password was wrong" into a 500 — so the
      failure is swallowed here and the caller is told nothing happened.
    */
    const { noteFailedLogin } = await freshAlarm();
    const send = vi.fn().mockRejectedValue(new Error("slack is down"));

    for (let attempt = 0; attempt < THRESHOLD - 1; attempt += 1) {
      await noteFailedLogin(send);
    }
    const tripping = await noteFailedLogin(send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(tripping).toEqual({ failedCount: 0, alerted: false });
  });

  it("calls it CRITICAL once the count doubles", async () => {
    /* A fresh window whose first alert lands past the critical line: the
       severity is read off the recorder rather than re-derived here, so this
       proves the two thresholds are not one. */
    const { noteFailedLogin } = await freshAlarm();
    const send = vi.fn().mockResolvedValue(undefined);
    const { markGlobalAttackAlertSent, recordGlobalFailedLogin } = await import("./rateLimit");

    /* Drive the count past 100 with the alarm already marked, then unmark it by
       letting the module's own state stand — the point is the severity the
       recorder reports at that count. */
    for (let attempt = 0; attempt < 100; attempt += 1) recordGlobalFailedLogin();
    markGlobalAttackAlertSent();
    const status = recordGlobalFailedLogin();

    expect(status.severity).toBe("critical");
    /* And the alarm stays quiet, because this window has already spoken. */
    const result = await noteFailedLogin(send);
    expect(result.alerted).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the alarm is actually INVOKED — a control that is not called does not exist", () => {
  /*
    Invariant 7, asserted at the source rather than through the route. The whole
    reason these helpers needed wiring is that they looked finished and nothing
    called them; a test of the alarm's behaviour would have passed just as well
    on the day it was dead.

    Read from the file so this cannot be satisfied by a mock: both failed-login
    exits must name it, and the count is the assertion.
  */
  const LOGIN_ROUTE = readFileSync(
    path.resolve(__dirname, "../routes/emailAuth.ts"),
    "utf8",
  );

  it("is called from BOTH failed-login exits in the login route", () => {
    const calls = LOGIN_ROUTE.match(/noteFailedLogin\(\)/g) ?? [];
    expect(calls).toHaveLength(2);
    expect(LOGIN_ROUTE).toMatch(/import \{ noteFailedLogin \}/);
  });

  it("counts the UNKNOWN-EMAIL exit, which is the one an attack mostly hits", () => {
    /*
      Credential stuffing works from a leaked list, so most attempts name
      addresses we have never seen. An alarm wired only to the wrong-password
      branch would sleep through the commonest attack there is — and that is
      the easy half to leave out, because it is the branch with no user row.
    */
    const unknownEmailBranch = LOGIN_ROUTE.slice(
      LOGIN_ROUTE.indexOf("const user = await getUserByEmail(email);"),
      LOGIN_ROUTE.indexOf("// Check if account is locked/suspended"),
    );
    expect(unknownEmailBranch).toContain("noteFailedLogin()");
  });
});

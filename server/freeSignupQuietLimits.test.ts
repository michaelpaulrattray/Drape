/**
 * THE TWO QUIET LIMITS BEHIND A CARDLESS FREE SIGNUP, DRIVEN (#1603, P1-4).
 *
 * # What this file is for, and what it deliberately is not
 *
 * The card's done-when is a drive, not an inspection: *"the Nth grant from one
 * device/network within the window is refused with the plain sentence; the daily
 * scan cap refuses the N+1th scan; an honest single signup sees neither."* So
 * every arm here runs the real policy function and reads its real answer. The
 * STORAGE is staged — these are unit suites and `vitest.setup.ts` strips
 * `DATABASE_URL` precisely so they cannot reach a database — but nothing about
 * the DECISION is staged: the comparison, the window arithmetic, the device key,
 * the sentence and the audit row are all the product's own.
 *
 * ⚠ **THE WIRE IS DRIVEN SOMEWHERE ELSE, AND A SABOTAGE IS WHY THERE IS ANYTHING
 * THERE AT ALL.** `server/routes/emailAuth.test.ts` and
 * `server/routes/googleAuth.test.ts` drive the two signup roads as a browser
 * does, and since this card landed their new-account arms run the REAL cap with
 * its count staged at zero — so an honest signup passing the gate is proven.
 *
 * **That is not the same as proving the gate is REACHED, and the first draft of
 * this file claimed it was.** Measured: with the count staged clean, DELETING
 * `mayGrantFreeCredits` from the register handler left **83 arms across both
 * suites green**. Every arm only ever asked for an allowed signup, so none of
 * them could tell a gate that admits from a gate that is not there — invariant
 * 7's exact shape, and "surviving sabotage may be inert" pointed at my own
 * claim. The repair is the over-cap arms now in both route suites: they stage the
 * count PAST the cap and assert `upsertUser` was never called, so they can only
 * pass if a real request met the gate. Re-driven: the same sabotage now reddens
 * 2 arms in each suite.
 *
 * ⚠ **AND THE FACE-SCAN WIRE IS A FLOOR, NOT A DRIVE — said plainly because it
 * is the weaker half of this card.** No suite in the tree drives the
 * `castingV2.faceScan` resolver (it is named in `castingRateLimitIntent.test.ts`
 * only as a bucket mapping), so there is nothing to stage a count against. Its
 * arm below reads the route's source and holds the control-flow property the
 * spend depends on. A source read is a floor; it would not catch a resolver that
 * kept the call and stopped meaning it.
 *
 * # Law 2 — the controls, named
 *
 * Every refusal arm has its allow twin on the same shape, so no arm can be
 * passing because everything refuses:
 *
 *   · one under the device cap ALLOWS   · at the device cap REFUSES
 *   · one under the network cap ALLOWS  · at the network cap REFUSES
 *   · at the scan cap ALLOWS            · one past it REFUSES
 *   · a clean browser ALLOWS and writes NO audit row
 *
 * The "no audit row" arm matters more than it looks: a control that logged on
 * every call would make its own feed useless, and that is invisible to an arm
 * that only ever checks the refusals.
 */
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* The face-scan floor arms at the foot of this file read the casting router off
   the real tree, which puts this suite in #741's derived population: green alone,
   red under load on somebody else's machine. Declared at file level because that
   is where the guard reads it, and the rest of the file is cheap either way. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/* The storage is the far end, never the subject. */
vi.mock("./db/quietLimits", () => ({
  countFreeGrantClaims: vi.fn(),
  recordFreeGrantClaim: vi.fn(),
  countFaceScanAgainstDay: vi.fn(),
}));

/* `AUDIT_ACTIONS` stays REAL through `importOriginal` — an arm asserting the row
   carries `abuse.free_grant_capped` must assert the product's own constant, not
   a string this file invented. Only the writer is a spy. */
vi.mock("./auditLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auditLog")>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { AUDIT_ACTIONS, logAuditEvent } from "./auditLog";
import { ACTION_CATEGORIES } from "../shared/auditActionCategories";
import { FREE_GRANT_REFUSAL_SENTENCE } from "../shared/freeGrantRefusal";
import {
  countFaceScanAgainstDay,
  countFreeGrantClaims,
  recordFreeGrantClaim,
} from "./db/quietLimits";
import { NUMERIC_ENV_VARS } from "./_core/env";
import { mayGrantFreeCredits, noteFreeGrantMade } from "./security/freeGrantLimit";
import { DEVICE_COOKIE_NAME, identifyDevice } from "./security/deviceKey";
import { mayBuyFaceScan, utcDayOf } from "./castingV2/faceScanDailyCap";
import { readListedSource } from "./testing/listedSource";

const REPO_ROOT = join(__dirname, "..");

const PER_DEVICE = NUMERIC_ENV_VARS.FREE_GRANT_MAX_PER_DEVICE;
const PER_NETWORK = NUMERIC_ENV_VARS.FREE_GRANT_MAX_PER_NETWORK;
const SCAN_CAP = NUMERIC_ENV_VARS.FREE_SCAN_DAILY_CAP;
const PAID_SCAN_CAP = NUMERIC_ENV_VARS.PAID_SCAN_DAILY_CAP;

/**
 * A request and a response with exactly the surface these modules touch.
 *
 * Hand-built rather than reached for from a helper because the thing under test
 * IS the reading of a cookie header and the writing of a `Set-Cookie`, and a
 * fixture that pre-resolved either would be testing the fixture.
 */
function fakeExchange(options: { cookieHeader?: string; userAgent?: string | null } = {}) {
  const cookiesSet: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const headers: Record<string, string> = {};
  if (options.cookieHeader !== undefined) headers.cookie = options.cookieHeader;
  if (options.userAgent !== undefined && options.userAgent !== null) {
    headers["user-agent"] = options.userAgent;
  }
  const req = { headers, protocol: "https", hostname: "klieglabs.com" } as unknown as Request;
  const res = {
    cookie(name: string, value: string, opts: Record<string, unknown>) {
      cookiesSet.push({ name, value, options: opts });
      return this;
    },
  } as unknown as Response;
  return { req, res, cookiesSet };
}

const auditRows = () =>
  vi.mocked(logAuditEvent).mock.calls.map(([options]) => options);

beforeEach(() => {
  vi.mocked(countFreeGrantClaims).mockReset();
  vi.mocked(recordFreeGrantClaim).mockReset().mockResolvedValue(undefined);
  vi.mocked(countFaceScanAgainstDay).mockReset();
  vi.mocked(logAuditEvent).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the free grant's cap — the honest signup, which is the case that must not break", () => {
  it("allows a clean browser with no history, and writes NO audit row", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: 0, network: 0 });
    const { req, res } = fakeExchange({ userAgent: "Mozilla/5.0 (Macintosh)" });

    const decision = await mayGrantFreeCredits(req, res, "203.0.113.7");

    expect(decision.allowed).toBe(true);
    /* The row is the staff's only window onto this firing, so a control that
       logged on every call would bury the refusals in noise. */
    expect(auditRows()).toHaveLength(0);
  });

  it("allows the LAST grant under each cap — the boundary, from the allowed side", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({
      device: PER_DEVICE - 1,
      network: PER_NETWORK - 1,
    });
    const { req, res } = fakeExchange();

    expect((await mayGrantFreeCredits(req, res, "203.0.113.7")).allowed).toBe(true);
    expect(auditRows()).toHaveLength(0);
  });
});

describe("the free grant's cap — the refusals", () => {
  it("refuses the Nth grant from one device, with the plain sentence", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: PER_DEVICE, network: 0 });
    const { req, res } = fakeExchange();

    const decision = await mayGrantFreeCredits(req, res, "203.0.113.7");

    expect(decision.allowed).toBe(false);
    expect(decision).toMatchObject({ sentence: FREE_GRANT_REFUSAL_SENTENCE });
  });

  it("refuses on the NETWORK half independently of the device half", async () => {
    /* The device is clean; only the address is over. A cap that ANDed its two
       halves would allow this, and a shared-address farm would walk through. */
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: 0, network: PER_NETWORK });
    const { req, res } = fakeExchange();

    const decision = await mayGrantFreeCredits(req, res, "203.0.113.7");

    expect(decision.allowed).toBe(false);
    expect(auditRows()[0]).toMatchObject({ metadata: expect.objectContaining({ reason: "network" }) });
  });

  it("writes ONE abuse row naming which half fired, at warning severity", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: PER_DEVICE, network: 0 });
    const { req, res } = fakeExchange({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" });

    await mayGrantFreeCredits(req, res, "198.51.100.4");

    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      action: AUDIT_ACTIONS.ABUSE_FREE_GRANT_CAPPED,
      severity: "warning",
      ipAddress: "198.51.100.4",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      metadata: expect.objectContaining({ reason: "device", deviceClaims: PER_DEVICE }),
    });
  });

  it("keeps the account out of the row — nothing was created, so there is no person to name", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: PER_DEVICE, network: 0 });
    const { req, res } = fakeExchange();

    await mayGrantFreeCredits(req, res, "198.51.100.4");

    const row = auditRows()[0];
    expect(row?.userId).toBeUndefined();
    expect(JSON.stringify(row?.metadata)).not.toMatch(/@/);
  });

  it("REFUSES when the count cannot be read — a control must not switch itself off", async () => {
    /* Invariant 7: a protection refuses, never allows, when a dependency is
       missing. The opposite reading would delete this control precisely when the
       product is least healthy. */
    vi.mocked(countFreeGrantClaims).mockRejectedValue(new Error("database unavailable"));
    const { req, res } = fakeExchange();

    const decision = await mayGrantFreeCredits(req, res, "203.0.113.7");

    expect(decision.allowed).toBe(false);
    expect(decision).toMatchObject({ sentence: FREE_GRANT_REFUSAL_SENTENCE });
  });

  it("asks for the window the variable declares, not a literal of its own", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: 0, network: 0 });
    const { req, res } = fakeExchange();
    const before = Date.now();

    await mayGrantFreeCredits(req, res, "203.0.113.7");

    const asked = vi.mocked(countFreeGrantClaims).mock.calls[0][0];
    const hours = (before - asked.since.getTime()) / (60 * 60 * 1000);
    /* Invariant 5 — assert at the wire. The window is read off the outgoing
       query rather than off a constant beside it. */
    expect(hours).toBeCloseTo(NUMERIC_ENV_VARS.FREE_GRANT_WINDOW_HOURS, 1);
  });
});

describe("the device key — what it can tell apart, and what it cannot", () => {
  it("mints a cookie for a browser that has none, and reports the key as derived", () => {
    const { req, res, cookiesSet } = fakeExchange({ userAgent: "Mozilla/5.0" });

    const identity = identifyDevice(req, res, "203.0.113.7");

    expect(identity.fromCookie).toBe(false);
    expect(identity.deviceKey).toMatch(/^derived:[0-9a-f]{40}$/);
    expect(cookiesSet).toHaveLength(1);
    expect(cookiesSet[0]).toMatchObject({ name: DEVICE_COOKIE_NAME });
    /* httpOnly because nothing in the browser ever reads it, and `lax` for the
       reason #1653 gives: `none` would attach it to other sites' requests. */
    expect(cookiesSet[0].options).toMatchObject({ httpOnly: true, sameSite: "lax" });
  });

  it("mints the cookie on a REFUSED attempt too, so the next try is not a fresh browser", async () => {
    /* Without this a farmer simply retries: every attempt would look like a new
       device and the device half of the cap would never bite. */
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: PER_DEVICE, network: 0 });
    const { req, res, cookiesSet } = fakeExchange();

    await mayGrantFreeCredits(req, res, "203.0.113.7");

    expect(cookiesSet).toHaveLength(1);
  });

  it("reads an existing cookie back off the raw header and mints nothing", () => {
    const uuid = "4f1c2e3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
    const { req, res, cookiesSet } = fakeExchange({
      cookieHeader: `other=1; ${DEVICE_COOKIE_NAME}=${uuid}; another=2`,
    });

    const identity = identifyDevice(req, res, "203.0.113.7");

    /* The header, not `req.cookies` — a router mounted without `cookie-parser`
       hands you `undefined`, which reads exactly like a browser that carried no
       cookie, and the cookie half would be silently dead. */
    expect(identity).toEqual({ deviceKey: `cookie:${uuid}`, fromCookie: true });
    expect(cookiesSet).toHaveLength(0);
  });

  it("refuses a malformed cookie value rather than counting against it", () => {
    const { req, res } = fakeExchange({ cookieHeader: `${DEVICE_COOKIE_NAME}=not-a-uuid` });

    const identity = identifyDevice(req, res, "203.0.113.7");

    expect(identity.fromCookie).toBe(false);
  });

  /*
    ⚠ THESE THREE DRIVE `identifyDevice`, NOT THE PRIVATE HELPER BEHIND IT.

    The first draft exported a `__test` handle onto `derivedKey` and
    `readDeviceCookie`, and `check-cleanup-dispositions` refused it — correctly:
    a module's export surface is a product fact, and widening it so a suite can
    reach inside is the shape that sweep exists to catch. Driving the real
    entrance is also the better test, because what matters is the key a SIGNUP
    is counted against, not the hash of a string.
  */
  const keyFor = (ipAddress: string, userAgent: string | null): string => {
    const { req, res } = fakeExchange(userAgent === null ? {} : { userAgent });
    return identifyDevice(req, res, ipAddress).deviceKey;
  };

  it("keeps the two confidences apart — a cookie key can never collide with a derived one", () => {
    const derived = keyFor("203.0.113.7", "Mozilla/5.0");
    expect(derived.startsWith("derived:")).toBe(true);
    expect(derived.startsWith("cookie:")).toBe(false);
    /* Both fit the column (`varchar(64)`), prefix included. */
    expect(derived.length).toBeLessThanOrEqual(64);
    expect("cookie:4f1c2e3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b".length).toBeLessThanOrEqual(64);
  });

  it("the derived key is stable for one browser on one network, and moves with either", () => {
    const base = keyFor("203.0.113.7", "Mozilla/5.0 (Macintosh)");
    expect(keyFor("203.0.113.7", "Mozilla/5.0 (Macintosh)")).toBe(base);
    /* The two things it cannot see through, asserted rather than only described:
       a network hop and a different browser each read as a new device. This is
       the stated limit of the derived half, not a defect. */
    expect(keyFor("198.51.100.4", "Mozilla/5.0 (Macintosh)")).not.toBe(base);
    expect(keyFor("203.0.113.7", "Mozilla/5.0 (Windows NT 10.0)")).not.toBe(base);
  });

  it("gives a caller with no user-agent its own bucket rather than folding it in", () => {
    expect(keyFor("203.0.113.7", null)).not.toBe(keyFor("203.0.113.7", "Mozilla/5.0"));
  });
});

describe("the claim recorded after a grant", () => {
  it("records the key the DECISION was made against, never a re-read", async () => {
    vi.mocked(countFreeGrantClaims).mockResolvedValue({ device: 0, network: 0 });
    const { req, res } = fakeExchange({
      cookieHeader: `${DEVICE_COOKIE_NAME}=4f1c2e3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b`,
    });

    const decision = await mayGrantFreeCredits(req, res, "203.0.113.7");
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return;
    await noteFreeGrantMade(decision, 4242);

    /* A cap that counts a different key from the one it checks never fires, so
       the row is built from the decision rather than from the request. */
    expect(recordFreeGrantClaim).toHaveBeenCalledWith({
      deviceKey: "cookie:4f1c2e3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
      ipAddress: "203.0.113.7",
      userId: 4242,
    });
  });
});

describe("the daily face-scan cap", () => {
  /*
    ⚠ EVERY ARM IN THIS BLOCK RUNS ON THE **FREE** CEILING, AND NOT BY ACCIDENT
    (#2170). `getSubscriptionByUserId` is unmocked here and the suite has no
    database (`vitest.setup.ts` strips `DATABASE_URL`), so it answers `null` and
    the cap reads the account as free — which is both the fail-closed direction
    the module argues for and the state of every account that has no plan. The
    PAID ceiling has its own arms below, with the plan read faked.
  */
  it("allows the scan that lands ON the cap", async () => {
    vi.mocked(countFaceScanAgainstDay).mockResolvedValue(SCAN_CAP);
    expect(await mayBuyFaceScan(7)).toBe("allowed");
    expect(auditRows()).toHaveLength(0);
  });

  it("refuses the one past it, and writes an abuse row naming the day and the cap", async () => {
    vi.mocked(countFaceScanAgainstDay).mockResolvedValue(SCAN_CAP + 1);

    expect(await mayBuyFaceScan(7)).toBe("capped");
    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0]).toMatchObject({
      userId: 7,
      action: AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED,
      severity: "warning",
      /* `onFreeCeiling` is the row's answer to WHICH of the two numbers
         decided, which is the only thing `cap` alone cannot say (#2170). */
      metadata: expect.objectContaining({
        cap: SCAN_CAP,
        scansToday: SCAN_CAP + 1,
        onFreeCeiling: true,
      }),
    });
  });

  it("counts BEFORE it decides, so an attempt past the cap keeps the day shut", async () => {
    vi.mocked(countFaceScanAgainstDay).mockResolvedValue(SCAN_CAP + 5);
    await mayBuyFaceScan(7);
    /* The increment is the same call that answers, so a refused attempt cannot
       be a free probe — one statement, no read-then-write race. */
    expect(countFaceScanAgainstDay).toHaveBeenCalledTimes(1);
  });

  it("REFUSES when the day cannot be counted — house money, so it fails closed", async () => {
    vi.mocked(countFaceScanAgainstDay).mockRejectedValue(new Error("database unavailable"));
    /*
      ⚠ AND IT SAYS `unavailable`, NOT `capped` — the distinction his quiet
      line depends on (#2170). Both refuse the scan; only one of them is a
      sentence to put in front of a customer, and a boolean here would have
      told a customer they had looked at a lot of faces today because OUR
      database was down.
    */
    expect(await mayBuyFaceScan(7)).toBe("unavailable");
    expect(auditRows(), "an outage wrote an abuse row against the customer").toHaveLength(0);
  });

  it("asks the day in UTC, so the boundary does not depend on where the process runs", async () => {
    vi.mocked(countFaceScanAgainstDay).mockResolvedValue(1);
    await mayBuyFaceScan(7);
    const asked = vi.mocked(countFaceScanAgainstDay).mock.calls[0][0];
    expect(asked).toMatchObject({ userId: 7, day: utcDayOf(new Date()) });
    expect(asked.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("utcDayOf reads the UTC calendar day, not the local one", () => {
    /* 10:30 UTC on the 2nd is already the 3rd in UTC+14 and still the 1st in
       UTC-11; the string must be the 2nd either way. */
    expect(utcDayOf(new Date("2026-10-02T10:30:00.000Z"))).toBe("2026-10-02");
    expect(utcDayOf(new Date("2026-10-02T23:59:59.000Z"))).toBe("2026-10-02");
    expect(utcDayOf(new Date("2026-10-03T00:00:00.000Z"))).toBe("2026-10-03");
  });
});

describe("the rows can actually be SEEN — the half that has been forgotten before", () => {
  it("buckets both new actions as abuse, which is what makes the panel show them", () => {
    /*
      ⚠ THIS IS THE ARM THAT MATTERS MOST AND IT LOOKS LIKE THE LEAST. The
      site-wide login alarm's own comment in `shared/auditActionCategories.ts`
      records what happens without it: the wire exists, the row exists, and the
      panel's abuse filter drops it, so nothing anybody can reach ever shows the
      control firing. #939 found thirteen actions in exactly that state.

      Derived from the real bucket list rather than a copy of it.
    */
    expect(ACTION_CATEGORIES.abuse).toContain(AUDIT_ACTIONS.ABUSE_FREE_GRANT_CAPPED);
    expect(ACTION_CATEGORIES.abuse).toContain(AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED);
  });

  it("both actions fit the audit column, so a row cannot be truncated away", () => {
    /* `audit_logs.action` is `varchar(64)`. */
    expect(AUDIT_ACTIONS.ABUSE_FREE_GRANT_CAPPED.length).toBeLessThanOrEqual(64);
    expect(AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED.length).toBeLessThanOrEqual(64);
  });
});

describe("the five caps are boot-validated, so a blank variable cannot delete a control", () => {
  it("each one is in the table the boot check reads", () => {
    /*
      A blank Railway variable is `""`, which `??` passes straight to `parseInt`,
      and `claims < NaN` is false — so a careless blank on any of these five would
      read as "under the cap" and admit everybody. `NUMERIC_ENV_VARS` is the
      table `assertNumericEnv` walks at boot, so the failure lands on the deploy
      rather than on the control.
    */
    expect(NUMERIC_ENV_VARS).toMatchObject({
      FREE_GRANT_MAX_PER_DEVICE: expect.any(Number),
      FREE_GRANT_MAX_PER_NETWORK: expect.any(Number),
      FREE_GRANT_WINDOW_HOURS: expect.any(Number),
      FREE_SCAN_DAILY_CAP: expect.any(Number),
      /* The fifth, added by #2170 with the paid ceiling. A blank on THIS one is
         the nastier half: the cap would read the paid number as `NaN` and
         `scans <= NaN` is false, so a paying account would be refused every
         scan past the free ceiling with nothing in the logs saying why. */
      PAID_SCAN_DAILY_CAP: expect.any(Number),
    });
  });

  it("⚠ the shipped pair is HIS pair, and the paid ceiling is the looser one", () => {
    /*
      His ruling, 2026-10-10 (#2170), verbatim: *"Free accounts: keep the cap at
      40 a day. Paid accounts: raise it to 100 a day, not 250."* Both numbers
      are pinned because a shift that read only the first sentence would leave
      one cap for everybody, and a shift that read only the second would raise
      the free one too.

      ⚠ AND THE ORDER IS PINNED SEPARATELY FROM THE VALUES. The cap
      short-circuits on `Math.min` of the two precisely so a paid ceiling set
      BELOW the free one cannot admit a paid account past its own number — but
      that is a safety net for a misconfigured deployment, not an invitation to
      ship the pair inverted.
    */
    expect(SCAN_CAP).toBe(40);
    expect(PAID_SCAN_CAP).toBe(100);
    expect(PAID_SCAN_CAP).toBeGreaterThan(SCAN_CAP);
  });

  it("the network cap is looser than the device cap — a shared office is one address", () => {
    /* Not decoration: a network cap at or below the device cap would refuse the
       second person in a household, which is the honest-user failure this card
       exists to avoid. */
    expect(PER_NETWORK).toBeGreaterThan(PER_DEVICE);
  });
});

describe("the face-scan cap is on the request path — a FLOOR, read at the source", () => {
  /*
    ⚠ WHY THIS IS A SOURCE READ AND NOT A DRIVE, STATED RATHER THAN HIDDEN.

    Nothing in the tree drives the `castingV2.faceScan` resolver. It is named in
    `castingRateLimitIntent.test.ts` once, as a rate-limit bucket mapping, and
    that is the whole of its coverage — so there is no harness to stage a daily
    count against, and building one means standing up ownership reads, a frame
    key and the scan service for a one-line gate.

    What this arm holds is the control-flow property the spend actually depends
    on: the call that buys a reading sits BEHIND the cap. It reddens if the gate
    is deleted, and it reddens if the gate is moved after the spend. It would NOT
    catch a resolver that kept the call and ignored its answer, and it is called
    a floor here for that reason (the standing orders' rule: say floor unless a
    grep, a guard or a derived list is quoted — this quotes a guard).

    ✅ **THE DRIVER NOW EXISTS AND THAT NAMED HOLE IS CLOSED — `server/faceScanCapDriven.test.ts`
    (#1714, 2026-10-02).** It drives the real `faceScan` resolver through the
    real `mayBuyFaceScan`, faking only `countFaceScanAgainstDay` — the last hop
    before SQL — and asserts that past the cap `scannedFace` is never called
    while the panel still answers `done: true`.

    ⚠ **THESE TWO ARMS STAY, AND THE REASON IS MEASURED RATHER THAN SENTIMENTAL.**
    Sabotaged on 2026-10-02 with the resolver rewritten to
    `((await mayBuyFaceScan(ctx.user.id)), true)` — the gate called, its answer
    discarded — **this suite passed 28 of 28 and the driver reddened three arms.**
    So the driver is what proves the ANSWER is honoured. These arms prove two
    things it cannot: that the gate is in the SOURCE at all (the driver's mocks
    could drift into proving a fake), and that the FAST panel does not ask it,
    which has no driver and no spend to observe. Neither suite subsumes the
    other; a floor beside a driver is not redundancy.
  */
  const resolverBody = (): string => {
    const source = readListedSource(join(REPO_ROOT, "server", "routes", "castingV2.ts"));
    expect(source, "the casting router must be readable for this arm to mean anything").not.toBeNull();
    const start = source!.indexOf("  faceScan: protectedProcedure");
    expect(start, "the `faceScan` procedure declaration moved or was renamed").toBeGreaterThan(-1);
    /* Bounded by the NEXT procedure's declaration, so this reads one resolver
       and not the whole router. Named rather than matched on a closing brace:
       a brace-counting reader would quietly widen to the rest of the file the
       first time the formatting changed. */
    const end = source!.indexOf("  retry: protectedProcedure", start);
    expect(end, "the procedure after `faceScan` moved — this arm reads the wrong slice").toBeGreaterThan(start);
    return source!.slice(start, end);
  };

  it("asks the cap, and asks it BEFORE the call that spends", () => {
    const body = resolverBody();
    const gate = body.indexOf("mayBuyFaceScan(ctx.user.id)");
    const spend = body.indexOf("scannedFace({");
    expect(gate, "`faceScan` no longer asks the daily cap — the scan is uncapped").toBeGreaterThan(-1);
    expect(spend, "the call that buys a reading moved or was renamed").toBeGreaterThan(-1);
    expect(gate).toBeLessThan(spend);
  });

  it("the fast panel does NOT ask it — that road buys nothing and must not spend a count", () => {
    /* `facePanel` serves what is already read, memory then table, and never
       rings a segmenter. Counting a free read against the day would shut an
       honest account's day by browsing. */
    const source = readListedSource(join(REPO_ROOT, "server", "routes", "castingV2.ts"));
    const start = source!.indexOf("  facePanel: protectedProcedure");
    const end = source!.indexOf("  faceScan: protectedProcedure");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(source!.slice(start, end)).not.toContain("mayBuyFaceScan");
  });
});

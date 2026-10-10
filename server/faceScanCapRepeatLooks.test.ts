/**
 * THE DAILY FACE-SCAN CAP COUNTS FACES, NOT REQUESTS — #2170.
 *
 * Measured on production by the Warden (patrol #7, finding W7-B): on the first
 * real day anyone used the cap, one account spent **55** counts to look at **20**
 * faces and was then refused **15** times in a row. The cap's own docblock says
 * forty means *"forty distinct faces or versions looked at for the first time"*,
 * but the count was spent on every REQUEST — and the panel asks `faceScan` again
 * every second while a reading fills (`CastingSheet.tsx`'s `refetchInterval`).
 *
 * # What is real and what is faked
 *
 * `server/faceScanCapDriven.test.ts` fakes the scan service whole, which is
 * right for its question (is the spend REACHED) and blind to this one: whether a
 * look is already paid for is decided by the service's own memory, so a fake
 * service cannot show it. Here everything on the road is real —
 *
 *   the `faceScan` resolver → `scanIsInHand` → the real `mayBuyFaceScan` (its
 *   `envInt` default, its `<=`, its audit row) → the real `scannedFace` with its
 *   real cache and its real in-flight entry
 *
 * — and only the edges are faked: ownership reads, the frame's bytes, the last
 * hop before SQL (`countFaceScanAgainstDay`, kept as a per-day tally with the
 * real statement's count-first-then-return semantics) and `scanFace`, the call
 * that would ring the segmenter. `createFalRegionReader` is faked too, so no key
 * in the environment can make an arm here spend.
 *
 * # The two directions
 *
 *   NEGATIVE CONTROL  a reading still filling, asked again and again the way the
 *                     panel asks it, spends ONE count — and at a cap the old
 *                     counting would have tripped, it is never refused.
 *   POSITIVE CONTROL  the 41st distinct face of a day is still refused at the
 *                     shipped free default of 40, with no scan bought and its
 *                     audit row written.
 *
 * Without the positive arm the negative one passes against a resolver that
 * never asks the cap at all.
 *
 * # AND SINCE HIS RULING OF 2026-10-10 THERE ARE TWO CEILINGS, SO THERE ARE TWO
 * BOUNDARIES
 *
 * Verbatim: *"Free accounts: keep the cap at 40 a day. Paid accounts: raise it
 * to 100 a day, not 250."* The block at the foot of this file drives **both** —
 * the 41st face of a free account and the 101st of a paid one — plus the two
 * things a single-number suite could never see: that a paid account is NOT
 * refused at 41, and that a plan bought or cancelled mid-day takes effect on
 * the next look against the scans already counted. The plan read is faked at
 * `getSubscriptionByUserId`, the same reader `billing.getStatus` uses, so what
 * runs for real is the cap's own choice between the two numbers.
 */
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "../shared/auditActions";
import { NUMERIC_ENV_VARS } from "./_core/env";
import { utcDayOf } from "./castingV2/faceScanDailyCap";

/** The shipped pair, read from its declaration — never typed twice (law 4). */
const FREE_CAP = NUMERIC_ENV_VARS.FREE_SCAN_DAILY_CAP;
const PAID_CAP = NUMERIC_ENV_VARS.PAID_SCAN_DAILY_CAP;

/* ---- ownership: one owned candidate per public id ---- */
const candidateIdByPublicId = new Map<string, number>();
const resolveOwnedCandidateId = vi.fn(async (input: { userId: number; candidatePublicId: string }) =>
  candidateIdByPublicId.get(input.candidatePublicId) ?? null,
);
const getOwnedCandidateWithSelectedFace = vi.fn(async (_userId: number, candidateId: number) => ({
  candidate: { id: candidateId, publicId: publicIdOf(candidateId), imageKey: `castingV2/candidates/${candidateId}/master.png` },
}));

vi.mock("./db/castingV2", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2")>("./db/castingV2");
  return {
    ...real,
    resolveOwnedCandidateId: (input: { userId: number; candidatePublicId: string }) => resolveOwnedCandidateId(input),
    getOwnedCandidateWithSelectedFace: (...args: [number, number]) => getOwnedCandidateWithSelectedFace(...args),
  };
});
vi.mock("./db/castingV2Variants", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2Variants")>("./db/castingV2Variants");
  return { ...real, listCandidateVariants: async () => [] };
});
vi.mock("./db/castingV2ReferenceLibrary", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2ReferenceLibrary")>(
    "./db/castingV2ReferenceLibrary",
  );
  return { ...real, listLineageReferences: async () => [] };
});

/**
 * THE LAST HOP BEFORE SQL. A tally per (account, day) with the real statement's
 * contract: increment first, then hand back the new total. Everything above it
 * — the cap's number, its comparison, its audit row — is real.
 */
const tally = new Map<string, number>();
const countFaceScanAgainstDay = vi.fn(async (input: { userId: number; day: string }) => {
  const k = `${input.userId}:${input.day}`;
  const next = (tally.get(k) ?? 0) + 1;
  tally.set(k, next);
  return next;
});
vi.mock("./db/quietLimits", async () => {
  const real = await vi.importActual<typeof import("./db/quietLimits")>("./db/quietLimits");
  return {
    ...real,
    countFaceScanAgainstDay: (input: { userId: number; day: string }) => countFaceScanAgainstDay(input),
  };
});

/* ---- the frame's bytes, so the real `scannedFace` can measure a picture ---- */
let frameBytes: Buffer;
vi.mock("./storage", async () => {
  const real = await vi.importActual<typeof import("./storage")>("./storage");
  return {
    ...real,
    storageReadBytes: async () => ({ bytes: frameBytes, contentType: "image/png" }),
    storagePublicUrl: (key: string) => `https://frames.invalid/${key}`,
  };
});

/* ---- the segmenter: faked at the transport AND at the read, so nothing can spend ---- */
vi.mock("./castingV2/falRegionReader", async () => {
  const real = await vi.importActual<typeof import("./castingV2/falRegionReader")>(
    "./castingV2/falRegionReader",
  );
  return { ...real, createFalRegionReader: () => ({}) };
});
const scanFace = vi.fn();
vi.mock("./castingV2/faceScan", async () => {
  const real = await vi.importActual<typeof import("./castingV2/faceScan")>("./castingV2/faceScan");
  return { ...real, scanFace: (...args: unknown[]) => scanFace(...args) };
});

/**
 * THE ACCOUNT'S RUNG — faked at the reader the cap actually calls, which is the
 * one `billing.getStatus` calls too (#2170).
 *
 * ⚠ **IT IS FAKED AT THE READER AND NOT AT THE CAP.** Mocking
 * `scanCapForPlanTier` or `mayBuyFaceScan` would prove only that a number
 * somebody handed the resolver is honoured; what needs driving is the cap's own
 * choice between two numbers given a rung, and its own decision about when to
 * ask for that rung at all. So `PLAN_TIERS`, the `price > 0` test and the
 * `Math.min` short-circuit all run for real.
 *
 * `undefined` is the default on purpose: an account nobody set a plan for reads
 * as `null` from this reader, which is exactly what production answers for an
 * account with no credits row, and the cap must take it as free.
 */
const planTierByUser = new Map<number, string>();
const getSubscriptionByUserId = vi.fn(async (userId: number) => {
  const planTier = planTierByUser.get(userId);
  return planTier === undefined ? null : { planTier, balance: 0 };
});
vi.mock("./db/billing", async () => {
  const real = await vi.importActual<typeof import("./db/billing")>("./db/billing");
  return { ...real, getSubscriptionByUserId: (userId: number) => getSubscriptionByUserId(userId) };
});

const logAuditEvent = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("./auditLog", async () => {
  const real = await vi.importActual<typeof import("./auditLog")>("./auditLog");
  return { ...real, logAuditEvent: (...args: unknown[]) => logAuditEvent(...args) };
});

const { castingV2Router } = await import("./routes/castingV2");
const { resetFaceScanCache } = await import("./castingV2/faceScanService");

function publicIdOf(candidateId: number): string {
  const tail = String(candidateId).padStart(12, "0");
  return `21700000-0000-4000-8000-${tail}`;
}
function own(candidateId: number): string {
  const publicId = publicIdOf(candidateId);
  candidateIdByPublicId.set(publicId, candidateId);
  return publicId;
}

/** A clean, empty reading — what `scanFace` hands back for a face with nothing found. */
const CLEAN_SCAN = {
  boxes: new Map(),
  masks: new Map(),
  asked: 14,
  found: 0,
  descriptions: new Map(),
  empty: [],
  failed: [],
};

let nextUser = 2_170_000;
function openTo(userId: number): void {
  process.env.CASTING_V2_SCOPE = `users:${userId}`;
  process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${userId}`;
  process.env.CASTING_FACE_SCAN_SCOPE = `users:${userId}`;
}
function caller(userId: number) {
  return castingV2Router.createCaller({ user: { id: userId, approved: true, role: "user" } } as never);
}
const cappedRows = () =>
  logAuditEvent.mock.calls.filter(
    ([event]) => (event as { action?: string }).action === AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED,
  );

beforeAll(async () => {
  frameBytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 128, g: 128, b: 128 } },
  }).png().toBuffer();
});

beforeEach(() => {
  vi.clearAllMocks();
  resetFaceScanCache();
  tally.clear();
  candidateIdByPublicId.clear();
  planTierByUser.clear();
  delete process.env.FREE_SCAN_DAILY_CAP;
  delete process.env.PAID_SCAN_DAILY_CAP;
  /* The kept table stays dark, so nothing here reads or writes a database. */
  delete process.env.CASTING_SCAN_TABLE_SCOPE;
  /* A placeholder so the real `defaultRegionReader` builds a reader at all — the
     factory it calls is faked above, so this value never reaches a network. */
  process.env.FAL_KEY = "test-not-a-key";
});

describe("the daily face-scan cap counts distinct faces, not requests (#2170)", () => {
  it("⚠ NEGATIVE CONTROL — a reading still filling, asked again every poll, spends ONE count", async () => {
    const userId = (nextUser += 1);
    openTo(userId);
    /* Two, so the old counting — one count per request — would refuse the third
       poll. The arm then proves the polls are not refused, not merely uncounted. */
    process.env.FREE_SCAN_DAILY_CAP = "2";

    let settle!: (value: unknown) => void;
    scanFace.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const face = own(501);

    /* The panel's own rhythm: the first look starts the read, then it asks
       again while the reading is still in flight. */
    const looks = [];
    for (let poll = 0; poll < 4; poll += 1) {
      looks.push(await caller(userId).faceScan({ candidateId: face, variantId: null }));
    }

    expect(countFaceScanAgainstDay, "a poll of a face already being read spent a count").toHaveBeenCalledTimes(1);
    expect(scanFace, "the face was read more than once").toHaveBeenCalledTimes(1);
    expect(cappedRows(), "a poll of a paid-for face was refused").toHaveLength(0);
    /* Still filling on every poll — the reading was never cut off by a refusal,
       which would have answered `done: true` with nothing. */
    for (const look of looks) expect(look).toMatchObject({ enabled: true, done: false });

    /* And once it lands, a further look is free too. */
    settle(CLEAN_SCAN);
    const after = await caller(userId).faceScan({ candidateId: face, variantId: null });
    expect(after).toMatchObject({ enabled: true, done: true });
    expect(countFaceScanAgainstDay).toHaveBeenCalledTimes(1);
    expect(scanFace).toHaveBeenCalledTimes(1);
  }, 20_000);

  /*
    ⚠ THIS ARM DRIVES THE BOUNDARY, NOT THE ARITHMETIC — and it changed shape in
    #2170 for a reason worth keeping.

    It used to loop to the cap (`for n = 1..40`) and then ask once more. At the
    new default that is 251 requests, and it is structurally impossible: this
    procedure also sits behind `RATE_LIMITS.castingRead`, which is **120
    requests a minute**, so the loop trips a DIFFERENT limit and the arm fails
    with `TOO_MANY_REQUESTS` having never reached the cap. (Driven: it did.)

    So the day's tally is seeded to one short of the cap and the boundary is
    crossed in two requests. The cap's own number, comparison and audit row are
    still the real ones; what is faked is only how the day got full, which is
    the same edge this file already fakes everywhere else.
  */
  it("⚠ POSITIVE CONTROL — at the shipped FREE default, the 41st face of a day is refused", async () => {
    const userId = (nextUser += 1);
    openTo(userId);
    /* No FREE_SCAN_DAILY_CAP and no plan: the number under test is the shipped
       free default, DERIVED from its declaration rather than typed (law 4). */
    scanFace.mockResolvedValue(CLEAN_SCAN);
    tally.set(`${userId}:${utcDayOf(new Date())}`, FREE_CAP - 1);

    /* The cap-th face of the day: counted to exactly the cap, and allowed. */
    const allowed = await caller(userId).faceScan({ candidateId: own(1_001), variantId: null });
    expect(scanFace, "the cap-th distinct face was refused").toHaveBeenCalledTimes(1);
    expect(allowed).toMatchObject({ enabled: true, capped: false });
    expect(cappedRows(), "the cap-th face wrote a refusal row").toHaveLength(0);

    /* One past it. */
    const refused = await caller(userId).faceScan({ candidateId: own(1_002), variantId: null });

    expect(scanFace, "one face past the cap bought a scan").toHaveBeenCalledTimes(1);
    /* Today's panel and no error — and now it SAYS so, which is his ruling of
       2026-10-10: *"show the quiet line when someone hits the cap, instead of
       failing silently."* */
    expect(refused).toMatchObject({ enabled: true, done: true, capped: true });
    expect(cappedRows(), "the refusal wrote no audit row").toHaveLength(1);
    expect(cappedRows()[0]![0]).toMatchObject({
      userId,
      metadata: expect.objectContaining({
        cap: FREE_CAP,
        scansToday: FREE_CAP + 1,
        onFreeCeiling: true,
      }),
    });
  }, 30_000);

  /*
    ⚠ THE ARM THAT HOLDS THE SHIPPED NUMBERS TO **HIS** NUMBERS (#2170), AND IT
    REPLACES ONE THAT ASSERTED THE OPPOSITE — which is worth keeping, because
    the one it replaces was not a bad arm, it was a shift's judgement standing
    in for his.

    It read `expect(SHIPPED_CAP).toBeGreaterThan(189)` — the measured busiest
    real day — on the reasoning that every behavioural arm in this file passes
    at ANY cap, so none of them could see the shipped number being too low. The
    reasoning is right and the conclusion was not his: shown the same
    measurement he answered *"Paid accounts: raise it to 100 a day, not 250.
    That still covers almost all of your real busy days."*

    ⚠ **SO 100 DELIBERATELY DOES NOT COVER THE 189 OF 22 SEPTEMBER, AND THIS ARM
    SAYS SO RATHER THAN HIDING IT.** The days, read at every row of
    `casting_face_scans` on 2026-10-10 (371 rows, one account, ten days):
    189 · 56 · 43 · 39 · 20 · 13 · 8 · 1 · 1 · 1 — so the paid ceiling clears
    nine of the ten and the free one clears seven. (The 20 is 8 October and is
    CENSORED: the cap refused that day 15 times, so its true demand was higher.)
    A session past 100 distinct faces in a UTC day meets the quiet line, by his
    decision.

    What the arm protects is therefore the opposite of what its predecessor
    protected: not a floor a shift may raise, but the exact pair he chose, so a
    later shift cannot quietly move either number to make a measured day fit.
  */
  it("⚠ the shipped pair is HIS pair, and the trade against the busiest day is stated", () => {
    expect(FREE_CAP).toBe(40);
    expect(PAID_CAP).toBe(100);

    /* The ten real days, so the arm carries the measurement it is a decision
       about rather than a number with no provenance. */
    const REAL_DAYS = [189, 56, 43, 39, 20, 13, 8, 1, 1, 1];
    const BUSIEST_REAL_DAY = Math.max(...REAL_DAYS);
    expect(BUSIEST_REAL_DAY).toBe(189);

    /* His own words about his own number: *"almost all"*, not *"all"*. */
    expect(PAID_CAP, "the paid ceiling was raised past the busiest measured day").toBeLessThan(
      BUSIEST_REAL_DAY,
    );
    expect(REAL_DAYS.filter((day) => day <= PAID_CAP)).toHaveLength(9);
    expect(REAL_DAYS.filter((day) => day <= FREE_CAP)).toHaveLength(7);
  });

  /*
    ⚠ THE PAID CEILING, DRIVEN (#2170, his ruling) — four arms, because a single
    "101st face refused" arm cannot tell a working raise from a cap that reads
    the plan and then ignores it.
  */
  describe("the paid ceiling is a second number, chosen off the plan table", () => {
    it("⚠ the 101st face of a PAID account's day is refused, and the panel says so", async () => {
      const userId = (nextUser += 1);
      openTo(userId);
      /* A plan that costs money. The rung's name is incidental — what decides
         is `PLAN_TIERS[rung].price > 0`, which runs for real here. */
      planTierByUser.set(userId, "pro");
      scanFace.mockResolvedValue(CLEAN_SCAN);
      tally.set(`${userId}:${utcDayOf(new Date())}`, PAID_CAP - 1);

      const allowed = await caller(userId).faceScan({ candidateId: own(2_001), variantId: null });
      expect(allowed).toMatchObject({ enabled: true, capped: false });
      expect(scanFace, "the cap-th face of a paid day was refused").toHaveBeenCalledTimes(1);

      const refused = await caller(userId).faceScan({ candidateId: own(2_002), variantId: null });

      expect(scanFace, "one face past the paid cap bought a scan").toHaveBeenCalledTimes(1);
      expect(refused).toMatchObject({ enabled: true, done: true, capped: true });
      expect(cappedRows()).toHaveLength(1);
      expect(cappedRows()[0]![0]).toMatchObject({
        userId,
        /* The row names which of the two numbers decided — `cap` alone cannot,
           because a deployment may set either variable. */
        metadata: expect.objectContaining({
          cap: PAID_CAP,
          scansToday: PAID_CAP + 1,
          onFreeCeiling: false,
        }),
      });
    }, 30_000);

    it("⚠ THE RAISE ACTUALLY RAISES — a paid account's 41st face is NOT refused", async () => {
      /*
        The arm that makes the one above mean something. Without it, a cap that
        read the plan and then used the free number everywhere would pass the
        101st-face arm too (101 is past 40 as well), and the whole of his ruling
        would be inert with a green suite — which is the exact shape #2170 was
        filed about one number ago.
      */
      const userId = (nextUser += 1);
      openTo(userId);
      planTierByUser.set(userId, "starter");
      scanFace.mockResolvedValue(CLEAN_SCAN);
      tally.set(`${userId}:${utcDayOf(new Date())}`, FREE_CAP);

      const look = await caller(userId).faceScan({ candidateId: own(2_101), variantId: null });

      expect(look, "a paid account was capped at the FREE ceiling").toMatchObject({
        enabled: true,
        capped: false,
      });
      expect(scanFace, "the paid account's 41st face bought no scan").toHaveBeenCalledTimes(1);
      expect(cappedRows()).toHaveLength(0);
    }, 30_000);

    it("⚠ a plan bought or cancelled takes effect the SAME day, against the scans already counted", async () => {
      /*
        One counter per account, never one per tier (the module header's own
        reasoning): two tallies would let an account buy a plan, spend the paid
        allowance, and get the free one back by cancelling.

        Both directions, in one day, on one account:
          · free at 41 → refused
          · a plan arrives → the next look is allowed, with 41 already spent
          · the plan is cancelled → the next look is refused again
      */
      const userId = (nextUser += 1);
      openTo(userId);
      scanFace.mockResolvedValue(CLEAN_SCAN);
      tally.set(`${userId}:${utcDayOf(new Date())}`, FREE_CAP);

      const onFree = await caller(userId).faceScan({ candidateId: own(2_201), variantId: null });
      expect(onFree, "a free account past 40 was not capped").toMatchObject({ capped: true });

      /* The plan lands mid-day. Nothing resets, nothing is re-counted. */
      planTierByUser.set(userId, "pro");
      const onPaid = await caller(userId).faceScan({ candidateId: own(2_202), variantId: null });
      expect(onPaid, "the new plan did not open the day").toMatchObject({ capped: false });
      expect(scanFace, "the paid look bought no scan").toHaveBeenCalledTimes(1);

      /* And back: `handleSubscriptionDeleted` writes `planTier: "free"`, so a
         cancellation IS this change and not a separate field. */
      planTierByUser.set(userId, "free");
      const afterCancel = await caller(userId).faceScan({ candidateId: own(2_203), variantId: null });
      expect(afterCancel, "a cancelled plan kept the paid ceiling").toMatchObject({ capped: true });
      expect(scanFace, "a cancelled account bought another scan").toHaveBeenCalledTimes(1);
    }, 30_000);

    it("⚠ a plan that cannot be READ holds the account to the free ceiling (fails closed)", async () => {
      /*
        invariant 7's direction, pointed at the half of this control that is new.
        A thrown plan read must not hand out the looser number: the cost of
        being wrong this way is a busy paying account held at 40 while the
        database is unreachable, and the cost of the other way is the paid
        ceiling handed to whoever asks during an outage.
      */
      const userId = (nextUser += 1);
      openTo(userId);
      planTierByUser.set(userId, "pro");
      getSubscriptionByUserId.mockRejectedValueOnce(new Error("Got timeout reading communication packets"));
      scanFace.mockResolvedValue(CLEAN_SCAN);
      tally.set(`${userId}:${utcDayOf(new Date())}`, FREE_CAP);

      const look = await caller(userId).faceScan({ candidateId: own(2_301), variantId: null });

      expect(look, "an unreadable plan bought the paid ceiling").toMatchObject({ capped: true });
      expect(scanFace).not.toHaveBeenCalled();
      expect(cappedRows()[0]![0]).toMatchObject({
        metadata: expect.objectContaining({ cap: FREE_CAP, onFreeCeiling: true }),
      });
    }, 30_000);

    it("⚠ an honest session never touches the money table at all", async () => {
      /*
        The module's own claim, driven: the plan is read only once the day's
        count has passed the LOWER of the two caps. A cap that asked the plan on
        every look would put a billing read on the panel's hot path, which is
        the dependency the single-cap docblock was right to worry about.
      */
      const userId = (nextUser += 1);
      openTo(userId);
      planTierByUser.set(userId, "pro");
      scanFace.mockResolvedValue(CLEAN_SCAN);

      await caller(userId).faceScan({ candidateId: own(2_401), variantId: null });
      await caller(userId).faceScan({ candidateId: own(2_402), variantId: null });

      expect(scanFace, "the two looks under the free ceiling bought no scans").toHaveBeenCalledTimes(2);
      expect(
        getSubscriptionByUserId,
        "a look under the free ceiling read the plan table",
      ).not.toHaveBeenCalled();
    }, 30_000);
  });

  it("a face already bought today is still served after the day is shut", async () => {
    /*
      The other half of "a count buys a face": once bought, looking at it again
      must not be refused just because OTHER faces filled the day. Under the old
      counting every re-look was a fresh count, so this answered with today's
      empty panel.
    */
    const userId = (nextUser += 1);
    openTo(userId);
    process.env.FREE_SCAN_DAILY_CAP = "2";
    scanFace.mockResolvedValue(CLEAN_SCAN);

    const first = own(2_001);
    await caller(userId).faceScan({ candidateId: first, variantId: null });
    await caller(userId).faceScan({ candidateId: own(2_002), variantId: null });
    await caller(userId).faceScan({ candidateId: own(2_003), variantId: null }); // refused: the day is shut
    expect(cappedRows()).toHaveLength(1);
    const countsBefore = countFaceScanAgainstDay.mock.calls.length;

    const again = await caller(userId).faceScan({ candidateId: first, variantId: null });

    expect(countFaceScanAgainstDay.mock.calls.length, "a re-look at a bought face spent a count").toBe(countsBefore);
    expect(cappedRows(), "a re-look at a bought face was refused").toHaveLength(1);
    expect(again).toMatchObject({ enabled: true, done: true });
  }, 20_000);
});

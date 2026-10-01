/**
 * THE DAILY FACE-SCAN CAP, DRIVEN THROUGH THE RESOLVER — #1714.
 *
 * Named by the relay in its hand verdict on PR #1712 (#1603, P1-4): *"the
 * face-scan gate has no driver (stated as a floor, its own card)"*.
 *
 * # What stood in for this, and exactly what it could not catch
 *
 * `server/freeSignupQuietLimits.test.ts` declares its coverage of this as a
 * FLOOR, read at the source: it asserts `mayBuyFaceScan(ctx.user.id)` appears
 * before `scannedFace({` inside the resolver body, and that the free fast panel
 * does not ask it. Both arms redden under sabotage, and both are claims about
 * TEXT.
 *
 * ⚠ **A RESOLVER THAT KEEPS THE CALL AND IGNORES ITS ANSWER PASSES EVERY ONE OF
 * THEM.** `if (imageKey !== null && await mayBuyFaceScan(ctx.user.id))` becomes
 * `if (imageKey !== null && (await mayBuyFaceScan(ctx.user.id), true))` and the
 * source read is still perfectly satisfied — the gate is called, in the right
 * place, in the right order, and its verdict is thrown away. That is the hole
 * this file closes, and the sabotage arm for it is driven below rather than
 * described.
 *
 * # Why this is not the cap's own suite over again
 *
 * `mayBuyFaceScan` is well covered already. What was never driven is the
 * SENTENCE THE PRODUCT MAKES OUT OF IT: *past the cap, no scan is bought, and
 * the customer still gets today's panel with no error.* That is three claims and
 * each needs the resolver:
 *
 *   1. `scannedFace` is never called — the money claim. House money is what the
 *      cap protects, and a `scannedFace` call IS the spend.
 *   2. `done: true` with `enabled: true` — the experience claim. #1603 chose
 *      this deliberately: *"A CAPPED SCAN TAKES THE EXACT ROAD A FAILED SCAN
 *      TAKES"*, so the panel is today's panel and never an error. An arm that
 *      only checked `scannedFace` would pass on a resolver that threw.
 *   3. The panel still ANSWERS — the shape claim. A capped look must return the
 *      library rows it already had, not an empty payload.
 *
 * # The real cap runs, and only the database under it is faked
 *
 * `mayBuyFaceScan` is NOT mocked. `countFaceScanAgainstDay` is, which is the
 * last hop before SQL — so every arm here drives the resolver, the cap's own
 * `envInt` read, its comparison and its audit row for real. Mocking
 * `mayBuyFaceScan` itself would have been smaller and would have proved only
 * that the resolver honours a boolean somebody handed it; this proves it honours
 * THE CAP.
 *
 * # The positive control is the arm that makes the rest mean anything
 *
 * Under the cap, a scan IS bought and `scannedFace` IS called with the owner's
 * frame key. Without it every assertion here would pass just as happily against
 * a resolver that never scans at all — which is the card's own stated
 * requirement, and the failure shape `freeSignupQuietLimits.test.ts` names.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "../shared/auditActions";
import { getActionCategory } from "../shared/auditActionCategories";

const CANDIDATE = "33333333-3333-4333-8333-333333333333";
const FRAME_KEY = "castingV2/candidates/33333333/master.png";

const resolveOwnedCandidateId = vi.fn();
const getOwnedCandidateWithSelectedFace = vi.fn();
const listCandidateVariants = vi.fn();
const listLineageReferences = vi.fn();
const countFaceScanAgainstDay = vi.fn();
const scannedFace = vi.fn();
const scanProgressOf = vi.fn();

vi.mock("./db/castingV2", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2")>("./db/castingV2");
  return {
    ...real,
    resolveOwnedCandidateId: (...args: unknown[]) => resolveOwnedCandidateId(...args),
    getOwnedCandidateWithSelectedFace: (...args: unknown[]) =>
      getOwnedCandidateWithSelectedFace(...args),
  };
});

vi.mock("./db/castingV2Variants", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2Variants")>(
    "./db/castingV2Variants",
  );
  return { ...real, listCandidateVariants: (...args: unknown[]) => listCandidateVariants(...args) };
});

vi.mock("./db/castingV2ReferenceLibrary", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2ReferenceLibrary")>(
    "./db/castingV2ReferenceLibrary",
  );
  return { ...real, listLineageReferences: (...args: unknown[]) => listLineageReferences(...args) };
});

/**
 * THE LAST HOP BEFORE SQL, AND THE ONLY THING FAKED ON THE CAP'S OWN ROAD.
 * `mayBuyFaceScan` above this is the real function, running its real `envInt`
 * read, its real comparison and its real audit row.
 */
vi.mock("./db/quietLimits", async () => {
  const real = await vi.importActual<typeof import("./db/quietLimits")>("./db/quietLimits");
  return {
    ...real,
    countFaceScanAgainstDay: (...args: unknown[]) => countFaceScanAgainstDay(...args),
  };
});

/**
 * The scan service, faked whole — this file is about whether it is REACHED, and
 * a real fourteen-question read would spend house money on the gate (CLAUDE.md:
 * spend nothing that is not yours).
 */
vi.mock("./castingV2/faceScanService", async () => {
  const real = await vi.importActual<typeof import("./castingV2/faceScanService")>(
    "./castingV2/faceScanService",
  );
  return {
    ...real,
    scannedFace: (...args: unknown[]) => scannedFace(...args),
    scanProgressOf: (...args: unknown[]) => scanProgressOf(...args),
  };
});

/** The audit writer: a refused scan writes a row, and nothing here needs a database. */
const logAuditEvent = vi.fn(async () => undefined);
vi.mock("./auditLog", async () => {
  const real = await vi.importActual<typeof import("./auditLog")>("./auditLog");
  return { ...real, logAuditEvent: (...args: unknown[]) => logAuditEvent(...args) };
});

const { castingV2Router } = await import("./routes/castingV2");

/*
  A fresh account per arm: the rate limiter's store is module-level and real, and
  a shared id would let one arm's reads refuse the next arm's for a reason that
  has nothing to do with this card (`castingV2SheetGone.test.ts`'s own note).
*/
let nextUser = 1_714_000;

function openTo(userId: number): void {
  process.env.CASTING_V2_SCOPE = `users:${userId}`;
  process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${userId}`;
  process.env.CASTING_FACE_SCAN_SCOPE = `users:${userId}`;
}

function caller(userId: number) {
  return castingV2Router.createCaller({
    user: { id: userId, approved: true, role: "user" },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  /* An owned candidate with a master frame and no selected version — the
     shortest road to a non-null `imageKey`, which is what the cap is asked
     after. */
  resolveOwnedCandidateId.mockResolvedValue(42);
  listCandidateVariants.mockResolvedValue([]);
  listLineageReferences.mockResolvedValue([]);
  getOwnedCandidateWithSelectedFace.mockResolvedValue({
    candidate: { id: 42, publicId: CANDIDATE, imageKey: FRAME_KEY },
  });
  scannedFace.mockResolvedValue(null);
  scanProgressOf.mockReturnValue(null);
  delete process.env.FREE_SCAN_DAILY_CAP;
});

describe("the daily face-scan cap, through castingV2.faceScan", () => {
  it("⚠ PAST THE CAP: no scan is bought, and the panel still answers", async () => {
    const userId = (nextUser += 1);
    openTo(userId);
    process.env.FREE_SCAN_DAILY_CAP = "3";
    /* The cap counts first and decides second, so the count it reads is this
       attempt's own — one past three is the first refusal. */
    countFaceScanAgainstDay.mockResolvedValue(4);

    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });

    /* 1 · THE MONEY CLAIM. A `scannedFace` call IS the house spend. */
    expect(scannedFace, "a capped account bought a scan").not.toHaveBeenCalled();

    /* 2 · THE EXPERIENCE CLAIM — #1603's deliberate choice, not an error. */
    expect(panel).toMatchObject({ enabled: true, done: true });

    /* 3 · THE SHAPE CLAIM: today's panel, which means the panel's own fields are
       present rather than a stub. `groups` is what the client draws rows from. */
    expect(panel).toHaveProperty("groups");

    /* And the cap was asked about THIS account, on a day it computed itself. */
    expect(countFaceScanAgainstDay).toHaveBeenCalledWith(
      expect.objectContaining({ userId, day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  it("⚠ THE POSITIVE CONTROL — under the cap a scan IS bought, with the owner's frame", async () => {
    /*
      Without this arm every assertion above passes against a resolver that never
      scans at all, which is the exact failure `freeSignupQuietLimits.test.ts`
      names and the card asks for by name.
    */
    const userId = (nextUser += 1);
    openTo(userId);
    process.env.FREE_SCAN_DAILY_CAP = "3";
    countFaceScanAgainstDay.mockResolvedValue(3);

    await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });

    expect(scannedFace, "under the cap, nothing bought the scan").toHaveBeenCalledTimes(1);
    expect(scannedFace).toHaveBeenCalledWith(
      expect.objectContaining({ userId, candidateId: 42, variantId: null, imageKey: FRAME_KEY }),
    );
  });

  it("the boundary is <= cap, read at the two attempts either side of it", async () => {
    /*
      THE OFF-BY-ONE, driven rather than reasoned about. The cap's own docblock
      says an attempt past the cap is counted too, so the two numbers that matter
      are `cap` (the last bought scan) and `cap + 1` (the first refused one). A
      guard that only tested a number far past the cap would pass on `<` as
      happily as on `<=`.
    */
    for (const [count, bought] of [[3, true], [4, false]] as const) {
      vi.clearAllMocks();
      resolveOwnedCandidateId.mockResolvedValue(42);
      listCandidateVariants.mockResolvedValue([]);
      listLineageReferences.mockResolvedValue([]);
      getOwnedCandidateWithSelectedFace.mockResolvedValue({
        candidate: { id: 42, publicId: CANDIDATE, imageKey: FRAME_KEY },
      });
      scannedFace.mockResolvedValue(null);
      scanProgressOf.mockReturnValue(null);

      const userId = (nextUser += 1);
      openTo(userId);
      process.env.FREE_SCAN_DAILY_CAP = "3";
      countFaceScanAgainstDay.mockResolvedValue(count);

      await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });
      expect(
        scannedFace.mock.calls.length > 0,
        `at a day count of ${count} with a cap of 3, a scan should ${bought ? "" : "NOT "}be bought`,
      ).toBe(bought);
    }
  });

  it("a refused scan writes its audit row, so the product can see this firing", async () => {
    /*
      The cap's own comment calls this the remedy for the silence it chose: *"an
      account at its cap cannot tell a quiet day from a refusal … every refusal
      writes an audit row a staff member can see — so the product knows even when
      the customer does not."* A refusal with no row is that promise inert, and
      nothing on either surface would look wrong.
    */
    const userId = (nextUser += 1);
    openTo(userId);
    process.env.FREE_SCAN_DAILY_CAP = "3";
    countFaceScanAgainstDay.mockResolvedValue(9);

    await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });

    expect(logAuditEvent, "a refused scan wrote no audit row").toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        /* The action read off the shared constant, never retyped: a row whose
           action string drifts from `auditActionCategories.ts` is dropped by the
           panel's abuse filter, which is the inert-row defect the cap's own
           comment records. */
        action: AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED,
        userId,
        /* The two numbers that make the row worth reading: a staff member needs
           to know how hard the account pushed, not only that it was capped. */
        metadata: expect.objectContaining({ cap: 3, scansToday: 9 }),
      }),
    );
    /* And the row lands in the ABUSE bucket, asked through the reader the panel
       itself uses — otherwise the overview's abuse feed filters away every row
       this control will ever write, which is the inert-control shape
       `auditActionCategories.ts` records of the login alarm. */
    expect(
      getActionCategory(AUDIT_ACTIONS.ABUSE_FREE_SCAN_CAPPED),
      "the capped-scan action is outside the abuse bucket, so the panel drops it",
    ).toBe("abuse");
  });

  it("⚠ a database that cannot count refuses the scan, at the wire (invariant 7)", async () => {
    /*
      The cap fails CLOSED by design and argues why: the cost of failing closed
      is a panel that is not as full as it could be, and the cost of failing open
      is an uncapped spend at the moment the product is least healthy. That is
      asserted here through the RESOLVER, because a cap that refuses in its own
      unit test and a resolver that treats a thrown read as "go ahead" would both
      be green.
    */
    const userId = (nextUser += 1);
    openTo(userId);
    countFaceScanAgainstDay.mockRejectedValue(new Error("Got timeout reading communication packets"));

    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });

    expect(scannedFace, "a scan was bought while the cap could not be counted").not.toHaveBeenCalled();
    /* Still today's panel, not an error — the customer is not shown our outage. */
    expect(panel).toMatchObject({ enabled: true, done: true });
  });

  it("a face with no picture to read spends no count, so looking at it is free", async () => {
    /*
      `imageKey !== null` is evaluated BEFORE the cap on purpose — the resolver's
      own comment: *"It is asked AFTER `imageKey` is resolved so that a face with
      no picture to read — which buys no scan at all — does not spend a count."*
      Moving the cap ahead of that check would quietly charge a day's allowance
      for opening a face that can never be scanned, and no arm but this one would
      notice.
    */
    const userId = (nextUser += 1);
    openTo(userId);
    getOwnedCandidateWithSelectedFace.mockResolvedValue({
      candidate: { id: 42, publicId: CANDIDATE, imageKey: null },
    });

    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });

    expect(countFaceScanAgainstDay, "a frameless face spent a day's count").not.toHaveBeenCalled();
    expect(scannedFace).not.toHaveBeenCalled();
    expect(panel).toMatchObject({ enabled: true, done: true });
  });
});

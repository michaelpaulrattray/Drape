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
 *                     shipped default of 40, with no scan bought and its audit
 *                     row written.
 *
 * Without the positive arm the negative one passes against a resolver that
 * never asks the cap at all.
 */
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "../shared/auditActions";
import { NUMERIC_ENV_VARS } from "./_core/env";
import { utcDayOf } from "./castingV2/faceScanDailyCap";

/** The shipped number, read from its declaration — never typed twice (law 4). */
const SHIPPED_CAP = NUMERIC_ENV_VARS.FREE_SCAN_DAILY_CAP;

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
  delete process.env.FREE_SCAN_DAILY_CAP;
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
  it("⚠ POSITIVE CONTROL — at the shipped default, one face past the cap is refused", async () => {
    const userId = (nextUser += 1);
    openTo(userId);
    /* No FREE_SCAN_DAILY_CAP: the number under test is the shipped default,
       DERIVED from its declaration rather than typed here (law 4). */
    scanFace.mockResolvedValue(CLEAN_SCAN);
    tally.set(`${userId}:${utcDayOf(new Date())}`, SHIPPED_CAP - 1);

    /* The cap-th face of the day: counted to exactly the cap, and allowed. */
    const allowed = await caller(userId).faceScan({ candidateId: own(1_001), variantId: null });
    expect(scanFace, "the cap-th distinct face was refused").toHaveBeenCalledTimes(1);
    expect(allowed).toMatchObject({ enabled: true });
    expect(cappedRows(), "the cap-th face wrote a refusal row").toHaveLength(0);

    /* One past it. */
    const refused = await caller(userId).faceScan({ candidateId: own(1_002), variantId: null });

    expect(scanFace, "one face past the cap bought a scan").toHaveBeenCalledTimes(1);
    /* Today's panel, exactly as before #2170 — no copy, no error. */
    expect(refused).toMatchObject({ enabled: true, done: true });
    expect(cappedRows(), "the refusal wrote no audit row").toHaveLength(1);
    expect(cappedRows()[0]![0]).toMatchObject({
      userId,
      metadata: expect.objectContaining({ cap: SHIPPED_CAP, scansToday: SHIPPED_CAP + 1 }),
    });
  }, 30_000);

  /*
    ⚠ THE ARM THAT STOPS THE NUMBER DRIFTING BACK UNDER REAL USE (#2170).

    Every behavioural arm in this file passes at ANY cap — they set a small one
    and count to it — so none of them could see the shipped number being too
    low. That is exactly what happened: 40 shipped, three of the only ten days
    of real scanning exceeded it, and the first real day of use was refused 15
    times with this suite green.

    The floor is the measured busiest day, read at every row of
    `casting_face_scans` on 2026-10-10 (371 rows, one account, ten days):
    189 · 56 · 43 · 39 · 20 · 13 · 8 · 1 · 1 · 1. A cap at or below 189 would
    have refused a real session. (The 20 is 8 October and is CENSORED — the cap
    refused that day 15 times, so its true demand was higher.)
  */
  it("⚠ the shipped cap sits above the busiest day any account has ever had", () => {
    const BUSIEST_REAL_DAY = 189;
    expect(SHIPPED_CAP).toBeGreaterThan(BUSIEST_REAL_DAY);
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

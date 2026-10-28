/**
 * THE LOADER NAMES NOTHING ON THE DISCOVERY ROAD — #2566 slice 3, driven
 * through the resolvers.
 *
 * His word on the first look at the discovery panel, verbatim: *"loader is
 * still showing the default list"*. The projection's own arms
 * (`castingV2/facePanel.test.ts`, "the loader names nothing nobody has seen")
 * prove what `facePanel` does with `discovering`. They cannot prove the ROUTE
 * hands it the flag, and that is the half this file exists for: a resolver that
 * forgot the argument would leave every projection arm green and his panel
 * exactly as he reported it (working law 5 — assert at the wire).
 *
 * Both procedures paint the panel, so both are driven: `facePanel` is the first
 * paint and keeps places for a scan not yet answered, and `faceScan` answers a
 * part-filled reading while it runs. Each arm is paired with the same request
 * off the discovery road, which must still draw named placeholders — without
 * that positive control, a resolver that drew no placeholder on any road would
 * pass every arm here.
 *
 * Nothing is spent: the scan service is faked whole, and the cap's last hop
 * before SQL is faked so a request never reaches a database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const CANDIDATE = "44444444-4444-4444-8444-444444444444";
const FRAME_KEY = "castingV2/candidates/44444444/master.png";

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

vi.mock("./db/quietLimits", async () => {
  const real = await vi.importActual<typeof import("./db/quietLimits")>("./db/quietLimits");
  return {
    ...real,
    countFaceScanAgainstDay: (...args: unknown[]) => countFaceScanAgainstDay(...args),
  };
});

/** Faked whole: this file is about what the panel NAMES, and a real read would
 *  spend house money to find out. */
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

const logAuditEvent = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("./auditLog", async () => {
  const real = await vi.importActual<typeof import("./auditLog")>("./auditLog");
  return { ...real, logAuditEvent: (...args: unknown[]) => logAuditEvent(...args) };
});

const { castingV2Router } = await import("./routes/castingV2");

/* A fresh account per arm, for the rate limiter's module-level store. */
let nextUser = 2_566_300;

function openTo(userId: number, discovery: boolean): void {
  process.env.CASTING_V2_SCOPE = `users:${userId}`;
  process.env.CASTING_FACE_SCAN_SCOPE = `users:${userId}`;
  if (discovery) process.env.CASTING_FACE_DISCOVERY_SCOPE = `users:${userId}`;
  else delete process.env.CASTING_FACE_DISCOVERY_SCOPE;
}

function caller(userId: number) {
  return castingV2Router.createCaller({
    user: { id: userId, approved: true, role: "user" },
  } as never);
}

type Panel = { groups: readonly { rows: readonly { state: string; name: string }[] }[] };
const placeholders = (panel: Panel) =>
  panel.groups.flatMap((group) => group.rows).filter((row) => row.state === "pending");

beforeEach(() => {
  vi.clearAllMocks();
  /* An owned candidate with a master frame, no selected version and an empty
     library: a fresh cast, which is the face he looked at. */
  resolveOwnedCandidateId.mockResolvedValue(42);
  listCandidateVariants.mockResolvedValue([]);
  listLineageReferences.mockResolvedValue([]);
  getOwnedCandidateWithSelectedFace.mockResolvedValue({
    candidate: { id: 42, publicId: CANDIDATE, imageKey: FRAME_KEY },
  });
  /* Under any cap, so the scan is "bought" — from the fake. */
  countFaceScanAgainstDay.mockResolvedValue(1);
  scanProgressOf.mockReturnValue(null);
  delete process.env.CASTING_SCAN_TABLE_SCOPE;
  delete process.env.FREE_SCAN_DAILY_CAP;
});

describe("the first paint, before the reading has answered", () => {
  it("⚠ POSITIVE CONTROL — off the discovery road it keeps NAMED places", async () => {
    const userId = (nextUser += 1);
    openTo(userId, false);
    const panel = await caller(userId).facePanel({ candidateId: CANDIDATE, variantId: null });
    expect(placeholders(panel).length, "the catalogue road drew no named placeholder").toBeGreaterThan(3);
    expect(panel.pendingUnnamed).toBe(false);
  });

  it("on the discovery road it names nothing, and says the places are unnamed", async () => {
    const userId = (nextUser += 1);
    openTo(userId, true);
    const panel = await caller(userId).facePanel({ candidateId: CANDIDATE, variantId: null });
    expect(placeholders(panel).map((row) => row.name), "the first paint named a feature nobody has seen").toEqual([]);
    expect(panel.pendingUnnamed).toBe(true);
  });
});

describe("a reading still running", () => {
  /* A reading that has not finished inside the resolver's patience: the answer
     is part-filled and says `done: false`. */
  const inFlight = () => scannedFace.mockReturnValue(new Promise(() => {}));

  it("⚠ POSITIVE CONTROL — off the discovery road the part-answer keeps NAMED places", async () => {
    const userId = (nextUser += 1);
    openTo(userId, false);
    inFlight();
    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });
    expect(panel.done).toBe(false);
    expect(placeholders(panel).length, "the catalogue road drew no named placeholder").toBeGreaterThan(3);
    expect(panel.pendingUnnamed).toBe(false);
  });

  it("on the discovery road the part-answer names nothing, and says the places are unnamed", async () => {
    const userId = (nextUser += 1);
    openTo(userId, true);
    inFlight();
    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });
    expect(panel.done).toBe(false);
    expect(placeholders(panel).map((row) => row.name), "a part-answer named a feature nobody has seen").toEqual([]);
    expect(panel.pendingUnnamed).toBe(true);
  });

  it("and once the reading has ended, no unnamed place is kept", async () => {
    /* A reading that settles (here, with nothing — a failed read is today's
       panel) ends the places with it: `pendingUnnamed` is the reading's state,
       never the road's. */
    const userId = (nextUser += 1);
    openTo(userId, true);
    scannedFace.mockResolvedValue(null);
    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });
    expect(panel.done).toBe(true);
    expect(panel.pendingUnnamed).toBe(false);
  });

  it("the dark answer keeps no place either, with the field present", async () => {
    /* Outside the scan's scope nothing is read; the field is on this branch
       too so the client never reads `undefined` off one shape of the reply. */
    const userId = (nextUser += 1);
    process.env.CASTING_V2_SCOPE = `users:${userId}`;
    delete process.env.CASTING_FACE_SCAN_SCOPE;
    delete process.env.CASTING_FACE_DISCOVERY_SCOPE;
    const panel = await caller(userId).faceScan({ candidateId: CANDIDATE, variantId: null });
    expect(panel.enabled).toBe(false);
    expect(panel).toHaveProperty("pendingUnnamed", false);
  });
});

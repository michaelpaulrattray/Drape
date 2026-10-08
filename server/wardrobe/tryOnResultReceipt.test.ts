/**
 * #2021 and #1980 — two wardrobe pictures that a request could leave on the
 * public bucket with nothing naming them.
 *
 * - **#2021** `garments.upload` put the customer's photograph with a bare
 *   `storagePut` one statement before the garment insert. A request that died
 *   in between left an object no row and no manifest named.
 * - **#1980** a try-on result (`vto.generate`, both exits of `vto.incremental`,
 *   `vto.refine`) was recorded on `wardrobeSessions.history` ONLY when the
 *   request carried a session — so with none, nothing ever named the key.
 *
 * Both now go through #1961's register-before-write (`putWardrobeScratchUpload`)
 * and hand the receipt to the ONE statement that files the row:
 * `createGarment` for the photograph, `appendSessionResult` for a try-on. That
 * statement discharges the manifest in its own transaction; anything that does
 * not reach it leaves the manifest standing, and the worker collects it.
 *
 * ⚠ **THE ARMS ASSERT AN ORDER AND A HAND-OFF, NOT TWO CALLS HAVING HAPPENED.**
 * "A manifest was written" and "a row was written" are both true of the bug if
 * the bytes land first. What is asserted is register → put → the row
 * statement, with the SAME batch id arriving at the row statement that the
 * registrar minted. The transaction itself — the discharge and the row
 * committing or rolling back together, scoped to the owner — cannot be proved
 * against a fake handle; it is driven against a real database by the PR's
 * disposable script, whose tally the PR body records.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { TrpcContext } from "../_core/context";

/* ── the recorder every arm reads ─────────────────────────────────────────── */
const order: string[] = [];

vi.mock("./scratchUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scratchUpload")>();
  return {
    ...actual,
    putWardrobeScratchUpload: vi.fn(async (input: { userId: number; key: string }) => {
      order.push(`register:${input.key}`);
      order.push(`put:${input.key}`);
      return {
        url: `https://pub.example.com/${input.key}`,
        key: input.key,
        cleanupBatchId: `batch-for:${input.key}`,
      };
    }),
  };
});

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    createGarment: vi.fn(),
    updateGarment: vi.fn(),
    createGeneration: vi.fn(),
    getSessionById: vi.fn(),
    updateSession: vi.fn(),
    appendSessionResult: vi.fn(),
    getGarmentById: vi.fn(),
    getOwnedGarmentsByIds: vi.fn(),
  };
});

/* The try-on door is held open here on purpose: what these arms prove is what
   the roads do when it re-opens. The door's own refusal is driven in
   `server/wardrobeTryOnDoor.test.ts`. */
vi.mock("./tryOnDoor", () => ({ assertWardrobeTryOnOpen: () => {} }));

vi.mock("../casting/atomicCredits", () => ({
  withAtomicCredits: vi.fn(async (_input: unknown, work: () => Promise<unknown>) => work()),
}));
vi.mock("../db/dailyQuota", () => ({ enforceDailyQuota: vi.fn() }));
vi.mock("../security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security/rateLimit")>();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, resetIn: 0 }),
  };
});
vi.mock("../casting/snapshotReadScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../casting/snapshotReadScope")>();
  /* r6: the requested model image is used as sent, so no session read is
     needed to reach the pipeline — the session arms below are about what
     happens AFTER the result exists. */
  return { ...actual, captureSnapshotReadMode: vi.fn(() => "r6") };
});
vi.mock("./vtoGeneration", () => ({
  generateVirtualTryOn: vi.fn(),
  incrementalComposite: vi.fn(),
}));
vi.mock("./garmentRefinement", () => ({ refineGarment: vi.fn() }));
vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();
  return { ...actual, getImageAspectBucket: vi.fn(async () => "3:4") };
});

import {
  appendSessionResult,
  createGarment,
  createGeneration,
  getGarmentById,
  getOwnedGarmentsByIds,
  updateSession,
} from "../db";
import { putWardrobeScratchUpload } from "./scratchUpload";
import { generateVirtualTryOn, incrementalComposite } from "./vtoGeneration";
import { refineGarment } from "./garmentRefinement";
import { uploadTryOnResult } from "./utils";
import { appRouter } from "../routers";

function authCtx(userId = 7): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `wardrobe-user-${userId}`,
      email: `wardrobe-${userId}@example.com`,
      name: "Wardrobe User",
      loginMethod: "email",
      approved: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    correlationId: "try-on-receipt-test",
  };
}

const GARMENT = {
  id: 3,
  userId: 7,
  slotType: "tops",
  shortName: "Black jacket",
  description: "A black jacket",
  tags: [],
  isolatedImageUrl: "https://garments.example/jacket.png",
  originalImageUrl: "https://garments.example/original.png",
  sourceImageUrl: null,
  status: "ready",
} as unknown as NonNullable<Awaited<ReturnType<typeof getGarmentById>>>;

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  vi.mocked(createGeneration).mockResolvedValue({ success: true, generationId: 501 });
  vi.mocked(getGarmentById).mockResolvedValue(GARMENT);
  vi.mocked(getOwnedGarmentsByIds).mockImplementation(async (_u, ids) =>
    new Map(ids.map((id) => [id, { ...GARMENT, id }])));
  vi.mocked(appendSessionResult).mockImplementation(async (input) => {
    order.push(`append:${input.cleanupBatchId}`);
    return true;
  });
  vi.mocked(generateVirtualTryOn).mockResolvedValue({
    resultUrl: "https://pub.example.com/wardrobe/7/vto-results/full.png",
    cleanupBatchId: "batch-full",
  });
  vi.mocked(incrementalComposite).mockResolvedValue({
    resultUrl: "https://pub.example.com/wardrobe/7/vto-results/swap.png",
    cleanupBatchId: "batch-swap",
  });
  vi.mocked(refineGarment).mockResolvedValue({
    resultUrl: "https://pub.example.com/wardrobe/7/vto-results/refined.png",
    cleanupBatchId: "batch-refined",
  });
});

/* ==========================================================================
   #2021 — garments.upload
   ========================================================================== */

const UPLOAD = { imageBase64: "data:image/png;base64,aGVsbG8=", slotType: "tops" as const };

describe("#2021 — the garment photograph is registered before it is written", () => {
  it("registers, writes, then hands the SAME receipt to the insert that discharges it", async () => {
    vi.mocked(createGarment).mockImplementation(async (_data, receipts) => {
      order.push(`createGarment:${receipts.join(",")}`);
      throw new Error("stop after the row — the pipeline is not under test");
    });

    await expect(appRouter.createCaller(authCtx()).wardrobe.garments.upload(UPLOAD)).rejects.toThrow();

    const put = vi.mocked(putWardrobeScratchUpload).mock.calls[0]![0];
    expect(put.userId).toBe(7);
    expect(put.key).toMatch(/^7-wardrobe\/original-\d+-[0-9a-f-]{36}\.png$/);
    expect(put.contentType).toBe("image/png");
    expect(put.bytes.toString()).toBe("hello");

    expect(
      order,
      "the photograph's key reached the bucket before anything named it, or the row did not adopt it",
    ).toEqual([
      `register:${put.key}`,
      `put:${put.key}`,
      `createGarment:batch-for:${put.key}`,
    ]);

    const [row] = vi.mocked(createGarment).mock.calls[0]!;
    expect(row.originalImageKey, "the row must own the key the manifest names").toBe(put.key);
  });

  it("⚠ a crash between the write and the row leaves the receipt UNSPENT — nothing else discharges it", async () => {
    /* The window #2021 is about: the bytes are on the bucket and the insert
       dies. The only statement that may discharge the manifest is the insert's
       own transaction; with it gone, nothing in the request touches the
       manifest, so the worker collects the photograph at the hold. */
    vi.mocked(createGarment).mockRejectedValue(new Error("ER_LOCK_DEADLOCK"));

    await expect(appRouter.createCaller(authCtx()).wardrobe.garments.upload(UPLOAD))
      .rejects.toThrow();

    expect(putWardrobeScratchUpload).toHaveBeenCalledTimes(1);
    expect(appendSessionResult).not.toHaveBeenCalled();
    /* No generation row and no credit hold for a garment that does not exist. */
    expect(createGeneration).not.toHaveBeenCalled();
  });
});

/* ==========================================================================
   #1980 — the try-on roads
   ========================================================================== */

const ROADS = [
  {
    name: "vto.generate",
    call: (sessionId?: number) => appRouter.createCaller(authCtx()).wardrobe.vto.generate({
      modelImageUrl: "https://model.example/m.png",
      garmentIds: [3],
      ...(sessionId ? { sessionId } : {}),
    }),
    batch: "batch-full",
  },
  {
    name: "vto.incremental",
    call: (sessionId?: number) => appRouter.createCaller(authCtx()).wardrobe.vto.incremental({
      previousResultUrl: "https://pub.example.com/wardrobe/7/vto-results/prev.png",
      modelImageUrl: "https://model.example/m.png",
      changedGarmentIds: [3],
      changedSlots: ["tops"],
      allGarmentIds: [3],
      ...(sessionId ? { sessionId } : {}),
    }),
    batch: "batch-swap",
  },
  {
    name: "vto.refine",
    call: (sessionId?: number) => appRouter.createCaller(authCtx()).wardrobe.vto.refine({
      currentResultUrl: "https://pub.example.com/wardrobe/7/vto-results/prev.png",
      modelImageUrl: "https://model.example/m.png",
      garmentId: 3,
      instruction: "roll the sleeves",
      ...(sessionId ? { sessionId } : {}),
    }),
    batch: "batch-refined",
  },
] as const;

describe("#1980 — a try-on result is adopted by its session or collected", () => {
  for (const road of ROADS) {
    it(`${road.name}: the session takes the result AND its receipt, in one call`, async () => {
      const result = await road.call(91);

      expect(appendSessionResult).toHaveBeenCalledTimes(1);
      const [append] = vi.mocked(appendSessionResult).mock.calls[0]!;
      expect(append.sessionId).toBe(91);
      expect(append.userId).toBe(7);
      expect(append.resultUrl).toBe(result.resultUrl);
      expect(
        append.cleanupBatchId,
        "the session was handed a result without the receipt its manifest needs discharging by",
      ).toBe(road.batch);

      /* The old read-push-write is gone: a second writer of the history would
         be a second place a URL could be dropped while its receipt is spent. */
      expect(updateSession).not.toHaveBeenCalled();
    });

    it(`${road.name}: with NO session, nothing discharges the receipt — the worker will collect it`, async () => {
      const result = await road.call();

      expect(appendSessionResult).not.toHaveBeenCalled();
      expect(updateSession).not.toHaveBeenCalled();
      /* And the receipt never reaches the client: it is the server's promise
         to delete, not a token a browser may spend. */
      expect(Object.keys(result)).toEqual(["resultUrl"]);
    });
  }
});

describe("#1980 — uploadTryOnResult registers under the owner, at the erasure sweep's prefix", () => {
  it("writes `wardrobe/<id>/vto-results/…` through the registrar and returns its receipt", async () => {
    const out = await uploadTryOnResult("data:image/png;base64,aGVsbG8=", "7");

    const [put] = vi.mocked(putWardrobeScratchUpload).mock.calls[0]!;
    expect(put.userId).toBe(7);
    /* `wardrobeOwnedKeyPrefixes` reads `wardrobe/<id>/` — the account sweep
       must still find a result a session adopted. */
    expect(put.key).toMatch(/^wardrobe\/7\/vto-results\/\d+-[0-9a-f-]{36}\.png$/);
    expect(put.bytes.toString()).toBe("hello");
    expect(put.contentType).toBe("image/png");
    expect(out).toEqual({ url: `https://pub.example.com/${put.key}`, cleanupBatchId: `batch-for:${put.key}` });
  });

  it("refuses an owner it cannot name as an account — before anything is registered or written", async () => {
    for (const bad of ["", "default", "7abc", "07", "-7", "1.5"]) {
      await expect(uploadTryOnResult("data:image/png;base64,aGVsbG8=", bad)).rejects.toThrow();
    }
    expect(putWardrobeScratchUpload).not.toHaveBeenCalled();
  });
});

/* ==========================================================================
   THE CLASS (working law 7): a wardrobe write whose result no row records
   ========================================================================== */

/**
 * `uploadBase64ToS3` writes to the public bucket with no manifest. That is
 * correct ONLY for a caller whose result is written onto a row before the
 * request ends. The try-on roads were not, and moved to `uploadTryOnResult`;
 * this pins who is left, derived from the tree, so a new pipeline cannot reach
 * for the unregistered writer without saying which row records its key.
 */
const UNREGISTERED_WRITER_CALLERS: Readonly<Record<string, string>> = {
  /*
    EMPTY SINCE #2095, and the writer itself is deleted. Its last caller was
    the digitize flat-lay, recorded on the garment row only if the analysis
    after it also succeeded — so when analysis threw, nothing named the key.
    It now goes through `uploadGarmentFlatLay`, which registers first. A module
    that brings the name back, as a definition or a call, reddens here.
  */
};

const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function serverSources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      out.push({ file: relative(REPO_ROOT, full).split(sep).join("/"), text: readFileSync(full, "utf8") });
    }
  };
  walk(join(REPO_ROOT, "server"));
  return out;
}

describe("#1980 — the unregistered writer has exactly the callers that may use it", () => {
  it("every caller of uploadBase64ToS3 is enumerated with the row that records its key", () => {
    const sources = serverSources();
    expect(sources.length, "the walk found nothing — it is pointed at the wrong place").toBeGreaterThan(100);
    const callers = sources
      .filter(({ text }) => /\buploadBase64ToS3\s*\(/.test(text))
      .map(({ file }) => file)
      .sort();
    expect(
      callers,
      "a module writes a wardrobe result with no manifest. If a row records its key before the"
        + " request ends, enumerate it with that row; otherwise it goes through"
        + " `uploadTryOnResult`/`putWardrobeScratchUpload` (#1980).",
    ).toEqual(Object.keys(UNREGISTERED_WRITER_CALLERS).sort());
  });

  it("CAN FAIL — the reader sees the call shape and not the import line", () => {
    const reads = (text: string) => /\buploadBase64ToS3\s*\(/.test(text);
    expect(reads("const url = await uploadBase64ToS3(\n  data,\n  prefix,\n);")).toBe(true);
    expect(reads("import {\n  uploadBase64ToS3,\n} from './utils';")).toBe(false);
  });
});

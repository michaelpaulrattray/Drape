/**
 * #2095 and #2094 — the two wardrobe pictures #2093 named and did not close.
 *
 * - **#2095** `digitizeGarment` wrote the flat-lay with a bare write, and the
 *   routes recorded it on the garment only after `analyzeGarmentMetadata` had
 *   also succeeded. When analysis threw, the catch marked the garment failed
 *   and the key was recorded nowhere. The flat-lay now goes through
 *   `uploadGarmentFlatLay` (#1961's register-before-write) and its key and
 *   receipt travel to `updateGarment`, which records the key and discharges the
 *   receipt in one transaction.
 * - **#2094** `looks.save` / `outfits.save` store a URL the browser sends. A
 *   try-on result made with no session sits in a scratch manifest since #1980,
 *   so a Look saved from it went broken after the hold. The insert now adopts
 *   it — found by its key, scoped to this account — in its own transaction.
 *
 * ⚠ **WHAT IS PROVEN HERE AND WHAT IS NOT.** These arms drive the real routes
 * and the real `digitizeGarment` (only the engine, the queue and the registrar
 * are stood in for) and assert the ORDER and the HAND-OFF: register → put →
 * the row statement, with the SAME receipt arriving that the registrar minted,
 * and no receipt arriving on the failure road. The transactions themselves —
 * discharge and row together, the owner scope, a stranger's URL never adopted —
 * cannot be proven against a fake handle; they are driven against the dev
 * database by the PR's disposable script, whose tally the PR body records.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
    saveLook: vi.fn(),
    createOutfit: vi.fn(),
    getOwnedGarmentsByIds: vi.fn(),
  };
});

/* The try-on door is held open on purpose: what these arms prove is what the
   roads do when it re-opens. Its refusal is driven in
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

/* THE ENGINE ALONE is stood in for — `digitizeGarment` itself runs, so the
   flat-lay it returns is the one `uploadGarmentFlatLay` registered. */
const engineAnswer = { value: null as unknown };
vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();
  return {
    ...actual,
    getAiClient: () => ({ models: { generateContent: vi.fn(async () => engineAnswer.value) } }),
    withImageQueue: (work: () => Promise<unknown>) => work(),
    toInlinePart: vi.fn(async () => ({ inlineData: { data: "aGk=", mimeType: "image/png" } })),
  };
});
vi.mock("./garmentAnalysis", () => ({ analyzeGarmentMetadata: vi.fn() }));
vi.mock("./garmentDetection", () => ({ detectGarmentsInImage: vi.fn(async () => [{ label: "black jacket" }]) }));
vi.mock("./qualityCheck", () => ({ checkImageQuality: vi.fn(async () => ({ issues: [] })) }));
vi.mock("./garmentAdoption", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./garmentAdoption")>();
  return {
    ...actual,
    adoptGarmentPictures: vi.fn(async () => ({
      image: { url: "https://pub.example.com/7-wardrobe/garment/crop.png", key: "7-wardrobe/garment/crop.png", cleanupBatchId: "batch-crop" },
      receipts: ["batch-crop"],
    })),
  };
});

import {
  createGarment,
  createGeneration,
  createOutfit,
  getOwnedGarmentsByIds,
  saveLook,
  updateGarment,
} from "../db";
import { putWardrobeScratchUpload } from "./scratchUpload";
import { analyzeGarmentMetadata } from "./garmentAnalysis";
import { digitizeGarment } from "./garmentDigitization";
import * as utils from "./utils";
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
    correlationId: "flat-lay-receipt-test",
  };
}

const ENGINE_IMAGE = {
  candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { data: "aGVsbG8=" } }] } }],
};
const METADATA = { shortName: "Jacket", description: "A jacket", tags: [], suggestedActions: [] };

const ROADS = [
  {
    name: "garments.upload",
    call: () => appRouter.createCaller(authCtx()).wardrobe.garments.upload({
      imageBase64: "data:image/png;base64,aGVsbG8=",
      slotType: "tops",
    }),
  },
  {
    name: "decompose.import",
    call: () => appRouter.createCaller(authCtx()).wardrobe.decompose.import({
      sourceImageUrl: "https://pub.example.com/7-wardrobe/scan.png",
      label: "black jacket",
      slotType: "tops",
    }),
  },
] as const;

/** The flat-lay's key, read off the registrar — never typed. */
function flatLayKey(): string {
  const keys = vi.mocked(putWardrobeScratchUpload).mock.calls
    .map(([input]) => input.key)
    .filter((key) => key.includes("/flat-lays/"));
  expect(keys, "the flat-lay was not written through the registrar").toHaveLength(1);
  return keys[0]!;
}

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  engineAnswer.value = ENGINE_IMAGE;
  vi.mocked(createGarment).mockResolvedValue(42);
  vi.mocked(createGeneration).mockResolvedValue({ success: true, generationId: 501 });
  vi.mocked(updateGarment).mockImplementation(async (_id, _user, data, receipts) => {
    order.push(`updateGarment:${data.status}:${receipts.join(",")}`);
  });
  vi.mocked(analyzeGarmentMetadata).mockImplementation(async () => {
    order.push("analyze");
    return METADATA as Awaited<ReturnType<typeof analyzeGarmentMetadata>>;
  });
});

/* ==========================================================================
   #2095 — the flat-lay
   ========================================================================== */

describe("#2095 — the flat-lay is registered before it is written, and the garment adopts it", () => {
  for (const road of ROADS) {
    it(`${road.name}: register → put → analyse → the row records the key AND discharges the same receipt`, async () => {
      await road.call();

      const key = flatLayKey();
      expect(key).toMatch(/^wardrobe\/7\/flat-lays\/\d+-[0-9a-f-]{36}\.png$/);
      const flatLayOrder = order.filter((step) => !step.includes("original-"));
      expect(
        flatLayOrder,
        "the flat-lay reached the bucket before anything named it, or the row did not adopt it",
      ).toEqual([
        `register:${key}`,
        `put:${key}`,
        "analyze",
        `updateGarment:ready:batch-for:${key}`,
      ]);

      const [garmentId, userId, data] = vi.mocked(updateGarment).mock.calls[0]!;
      expect(garmentId).toBe(42);
      expect(userId, "the owner goes into the WHERE beside the id").toBe(7);
      expect(data.isolatedImageKey, "the row must name the key the manifest names").toBe(key);
      expect(data.isolatedImageUrl).toBe(`https://pub.example.com/${key}`);
    });

    it(`${road.name}: ⚠ analysis throws AFTER the upload — the receipt is never spent, so the worker collects it`, async () => {
      vi.mocked(analyzeGarmentMetadata).mockRejectedValue(new Error("analysis engine down"));

      await expect(road.call()).rejects.toThrow("analysis engine down");

      const key = flatLayKey();
      expect(order).toContain(`put:${key}`);
      const updates = vi.mocked(updateGarment).mock.calls;
      expect(updates, "the failure road writes the garment exactly once").toHaveLength(1);
      const [, userId, data, receipts] = updates[0]!;
      expect(userId).toBe(7);
      expect(data).toEqual({ status: "failed" });
      expect(receipts, "a failed garment must not keep the flat-lay").toEqual([]);
      expect(JSON.stringify(updates)).not.toContain(key);
    });
  }

  it("the engine returns no image: nothing is written, and the garment's own picture carries no receipt", async () => {
    engineAnswer.value = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "no" }] } }] };

    const out = await digitizeGarment("https://pub.example.com/7-wardrobe/crop.png", "tops", "jacket", "7");

    expect(out).toEqual({ flatLayUrl: "https://pub.example.com/7-wardrobe/crop.png" });
    expect(putWardrobeScratchUpload).not.toHaveBeenCalled();
  });

  it("refuses an owner it cannot name as an account — before anything is registered or written", async () => {
    await expect(digitizeGarment("https://pub.example.com/x.png", "tops", "jacket", "u"))
      .rejects.toThrow();
    expect(putWardrobeScratchUpload).not.toHaveBeenCalled();
  });

  it("there is no unregistered wardrobe writer left to reach for", () => {
    expect("uploadBase64ToS3" in utils, "`uploadBase64ToS3` is back — it writes with no manifest").toBe(false);
  });
});

/* ==========================================================================
   #2094 — a Look or Outfit adopts what it names
   ========================================================================== */

describe("#2094 — looks.save and outfits.save hand the insert what it needs to adopt", () => {
  const PUBLIC = "https://pub.example.com";
  const previous = process.env.R2_PUBLIC_URL;
  beforeEach(() => { process.env.R2_PUBLIC_URL = PUBLIC; });
  afterAll(() => {
    if (previous === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = previous;
  });

  it("looks.save: the URL goes to the ONE statement that adopts, with the bucket it is read against", async () => {
    vi.mocked(saveLook).mockResolvedValue(9);
    const imageUrl = `${PUBLIC}/wardrobe/7/vto-results/1-x.png`;

    await appRouter.createCaller(authCtx()).wardrobe.looks.save({ modelId: 3, imageUrl, garmentIds: [1] });

    const [row, currentPublicUrl] = vi.mocked(saveLook).mock.calls[0]!;
    expect(row.userId, "the owner is the session's, never the input's").toBe(7);
    expect(row.imageUrl).toBe(imageUrl);
    expect(currentPublicUrl).toBe(PUBLIC);
  });

  it("outfits.save: the thumbnail goes to the ONE statement that adopts, with the bucket it is read against", async () => {
    vi.mocked(getOwnedGarmentsByIds).mockResolvedValue(new Map([[1, { id: 1 }]]) as never);
    vi.mocked(createOutfit).mockResolvedValue(11);
    const resultThumbUrl = `${PUBLIC}/wardrobe/7/vto-results/1-x.png`;

    await appRouter.createCaller(authCtx()).wardrobe.outfits.save({ name: "Fit", garmentIds: [1], resultThumbUrl });

    const [row, currentPublicUrl] = vi.mocked(createOutfit).mock.calls[0]!;
    expect(row.userId).toBe(7);
    expect(row.resultThumbUrl).toBe(resultThumbUrl);
    expect(currentPublicUrl).toBe(PUBLIC);
  });
});

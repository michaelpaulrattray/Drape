/**
 * #2022 and #2028 — two wardrobe roads PR #1979 named and did not close.
 *
 * - **#2022** a session's model photo. `models.upload` registers it in a
 *   scratch manifest held a day (#1961) and `sessions.create` stored its URL,
 *   so a session resumed after the day showed a picture that was gone. Now an
 *   upload-only session ADOPTS the photo in the insert's own transaction, a
 *   session's deletion hands it back to the worker once nothing else names it,
 *   and the account-erasure sweep reads a session's photo under this account's
 *   own model-photo prefix.
 * - **#2028** two refusals on `garments.import` reached the customer as a
 *   generic 500. They are spoken now, before the charge, and only there.
 *
 * ⚠ **WHAT IS PROVEN HERE AND WHAT IS NOT.** These arms drive the real router
 * (`appRouter.createCaller`) with only the database writers replaced by
 * recorders, and the REAL erasure collector over a transaction that answers
 * the session table with chosen rows. The transactions themselves — the
 * adoption and the insert together, the release and the delete together, the
 * owner scope on a real manifest — cannot be proven against a fake handle;
 * they are driven against the dev database by the PR's disposable script,
 * whose tally the PR body records.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

import type { TrpcContext } from "../_core/context";

const ME = 7;
const PUBLIC = "https://pub-test.r2.dev";

vi.mock("./scratchUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scratchUpload")>();
  return {
    ...actual,
    putWardrobeScratchUpload: vi.fn(async (input: { key: string }) => ({
      url: `${PUBLIC}/${input.key}`,
      key: input.key,
      cleanupBatchId: `batch-for:${input.key}`,
    })),
  };
});

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    createSession: vi.fn(),
    capUserSessions: vi.fn(),
    deleteSession: vi.fn(),
    getSessionById: vi.fn(),
    createGarment: vi.fn(),
    updateGarment: vi.fn(),
    createGeneration: vi.fn(),
  };
});

vi.mock("../casting/snapshotReadScope", () => ({ captureSnapshotReadMode: vi.fn(() => "snapshot") }));

/* The try-on door is held open on purpose: what these arms prove is what the
   import road does when it re-opens. Its refusal is driven in
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
vi.mock("./garmentAdoption", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./garmentAdoption")>();
  return { ...actual, adoptGarmentPictures: vi.fn() };
});
vi.mock("./garmentDigitization", () => ({
  digitizeGarment: vi.fn(async () => ({
    flatLayUrl: `${PUBLIC}/wardrobe/${ME}/flat-lays/f.png`,
    flatLay: { key: `wardrobe/${ME}/flat-lays/f.png`, cleanupBatchId: "batch-flat" },
  })),
}));
vi.mock("./garmentAnalysis", () => ({
  analyzeGarmentMetadata: vi.fn(async () => ({
    shortName: "jacket", description: "", tags: [], suggestedActions: [],
  })),
}));

import {
  capUserSessions,
  createGarment,
  createSession,
  deleteSession,
  getSessionById,
  updateGarment,
} from "../db";
import { GarmentPictureReceiptError } from "../db/wardrobe";
import { collectAccountOwnedStorageItemsIn, wardrobeModelPhotoKeyPrefix } from "../db/accountDeletion";
import { putWardrobeScratchUpload } from "./scratchUpload";
import {
  adoptGarmentPictures,
  GARMENT_PICTURE_NOT_SAVED,
  GARMENT_PICTURE_NOT_YOURS,
  GarmentPictureNotYoursError,
  spokenImportRefusal,
} from "./garmentAdoption";
import { withAtomicCredits } from "../casting/atomicCredits";
import { SpokenError } from "../_core/spokenError";
import { wardrobeSessions } from "../../drizzle/schema";
import { appRouter } from "../routers";

type TransactionHandle = import("../db/connection").TransactionHandle;

function callerFor(userId = ME) {
  const ctx: TrpcContext = {
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
    correlationId: "session-photo-test",
  };
  return appRouter.createCaller(ctx);
}

/** A transaction that answers each table's read with the rows given for it. */
function fakeTx(rowsByTable: Map<unknown, unknown[]>): TransactionHandle {
  return {
    select() {
      let table: unknown;
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "limit", "for", "innerJoin", "orderBy"]) {
        chain[method] = () => chain;
      }
      chain.from = (source: unknown) => {
        table = source;
        return chain;
      };
      chain.then = (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(rowsByTable.get(table) ?? []).then(resolve, reject);
      return chain;
    },
  } as unknown as TransactionHandle;
}

async function erasureKeysForSessions(userId: number, photos: string[]): Promise<string[]> {
  const rows = photos.map((modelImageUrl, index) => ({
    id: index + 1, userId, modelId: null, modelImageUrl, history: "[]",
  }));
  const items = await collectAccountOwnedStorageItemsIn(
    fakeTx(new Map<unknown, unknown[]>([[wardrobeSessions, rows]])),
    userId,
    PUBLIC,
  );
  return items.map((item) => item.storageKey);
}

const IMPORT_INPUT = {
  sourceImageUrl: `${PUBLIC}/${ME}-wardrobe/decompose/photo.png`,
  cropUrl: `${PUBLIC}/${ME}-wardrobe/decompose/crop.png`,
  label: "black jacket",
  slotType: "tops" as const,
};
const ADOPTED = {
  image: { url: `${PUBLIC}/${ME}-wardrobe/garment/a.png`, key: `${ME}-wardrobe/garment/a.png`, cleanupBatchId: "batch-a" },
  source: { url: `${PUBLIC}/${ME}-wardrobe/garment/b.png`, key: `${ME}-wardrobe/garment/b.png`, cleanupBatchId: "batch-b" },
  receipts: ["batch-a", "batch-b"],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.R2_PUBLIC_URL = PUBLIC;
  vi.mocked(createSession).mockResolvedValue(91);
  vi.mocked(capUserSessions).mockResolvedValue(undefined);
  vi.mocked(deleteSession).mockResolvedValue(undefined);
  vi.mocked(createGarment).mockResolvedValue(501);
  vi.mocked(updateGarment).mockResolvedValue(undefined);
  vi.mocked(adoptGarmentPictures).mockResolvedValue(ADOPTED);
});

describe("#2022 — a session's model photo lives as long as the session", () => {
  it("✅ the photograph `models.upload` mints is one `sessions.create` accepts, and the bucket travels to the adopting insert", async () => {
    const { url, fileKey } = await callerFor().wardrobe.model.upload({ imageBase64: "aGVsbG8=" });
    /* The key is minted under the erasure sweep's own prefix — the one place
       that decides a session's photo is this account's. */
    expect(fileKey.startsWith(wardrobeModelPhotoKeyPrefix(ME))).toBe(true);
    expect(vi.mocked(putWardrobeScratchUpload).mock.calls[0][0]).toMatchObject({ userId: ME, key: fileKey });

    await callerFor().wardrobe.sessions.create({ modelImageUrl: url });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ME, modelId: null, modelImageUrl: url }),
      PUBLIC,
    );
    /* And the cap, which deletes the oldest sessions, takes the bucket too —
       without it no deleted session's photo could be handed back. */
    expect(capUserSessions).toHaveBeenCalledWith(ME, PUBLIC);
  });

  it("✅ a customer's own delete hands the bucket to the releasing delete", async () => {
    vi.mocked(getSessionById).mockResolvedValue({ id: 91, userId: ME } as never);
    await callerFor().wardrobe.sessions.delete({ sessionId: 91 });
    expect(deleteSession).toHaveBeenCalledWith(91, ME, PUBLIC);
  });

  it("✅ account erasure reaches this account's own session photograph", async () => {
    const own = `${wardrobeModelPhotoKeyPrefix(ME)}1700000000000-own.png`;
    expect(await erasureKeysForSessions(ME, [`${PUBLIC}/${own}`])).toContain(own);
  });

  it("❌ account erasure does NOT reach a Cast's view, another account's upload, or another host", async () => {
    const castView = "casting-v2/candidates/6f1c2b9e-3a4d-4e5f-8a7b-0c1d2e3f4a5b.png";
    const othersUpload = `${wardrobeModelPhotoKeyPrefix(77)}1700000000000-theirs.png`;
    const keys = await erasureKeysForSessions(ME, [
      `${PUBLIC}/${castView}`,
      `${PUBLIC}/${othersUpload}`,
      `https://files.manuscdn.com/${wardrobeModelPhotoKeyPrefix(ME)}legacy.png`,
    ]);
    expect(keys).not.toContain(castView);
    expect(keys).not.toContain(othersUpload);
    expect(keys.some((key) => key.includes("legacy.png"))).toBe(false);
  });

  it("❌ account 1's prefix does not own account 12's photograph", async () => {
    const twelves = `${wardrobeModelPhotoKeyPrefix(12)}1700000000000-x.png`;
    expect(await erasureKeysForSessions(1, [`${PUBLIC}/${twelves}`])).toEqual([]);
    expect(await erasureKeysForSessions(12, [`${PUBLIC}/${twelves}`])).toEqual([twelves]);
  });
});

describe("#2028 — the import road's two refusals are spoken, before the charge and only there", () => {
  it("✅ a picture that is not hers: BAD_REQUEST with the sentence written for her, and nothing charged", async () => {
    vi.mocked(adoptGarmentPictures).mockRejectedValue(new GarmentPictureNotYoursError());
    const error = await callerFor().wardrobe.decompose.import(IMPORT_INPUT).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SpokenError);
    expect(error).toMatchObject({ code: "BAD_REQUEST", message: GARMENT_PICTURE_NOT_YOURS });
    expect(createGarment).not.toHaveBeenCalled();
    expect(withAtomicCredits).not.toHaveBeenCalled();
  });

  it("✅ a receipt the garment could not take over: BAD_REQUEST with its own plain sentence, and nothing charged", async () => {
    vi.mocked(createGarment).mockRejectedValue(new GarmentPictureReceiptError("no undischarged manifest for this garment's picture"));
    const error = await callerFor().wardrobe.decompose.import(IMPORT_INPUT).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SpokenError);
    expect(error).toMatchObject({ code: "BAD_REQUEST", message: GARMENT_PICTURE_NOT_SAVED });
    /* The internal wording never reaches her. */
    expect((error as Error).message).not.toMatch(/manifest/);
    expect(withAtomicCredits).not.toHaveBeenCalled();
  });

  it("❌ any other failure is not dressed up as a refusal — it stays a server error", async () => {
    vi.mocked(createGarment).mockRejectedValue(new Error("database went away"));
    const error = await callerFor().wardrobe.decompose.import(IMPORT_INPUT).catch((err: unknown) => err);
    expect(error).not.toBeInstanceOf(SpokenError);
    expect(error).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("❌ a receipt refusal AFTER the charge is never told \"nothing was charged\"", async () => {
    vi.mocked(updateGarment).mockImplementation(async (_id, _user, data) => {
      if ((data as { status?: string }).status === "ready") {
        throw new GarmentPictureReceiptError("no undischarged manifest for this garment's flat-lay");
      }
    });
    const error = await callerFor().wardrobe.decompose.import(IMPORT_INPUT).catch((err: unknown) => err);
    expect(withAtomicCredits).toHaveBeenCalledTimes(1);
    expect(error).not.toBeInstanceOf(SpokenError);
    expect((error as Error).message).not.toBe(GARMENT_PICTURE_NOT_SAVED);
  });

  it("CAN FAIL — the mapper driven directly: the two classes become spoken, anything else passes through untouched", () => {
    expect(spokenImportRefusal(new GarmentPictureNotYoursError())).toBeInstanceOf(SpokenError);
    expect(spokenImportRefusal(new GarmentPictureReceiptError("x"))).toBeInstanceOf(SpokenError);
    const plain = new Error("other");
    expect(spokenImportRefusal(plain)).toBe(plain);
    const trpc = new TRPCError({ code: "FORBIDDEN", message: "no" });
    expect(spokenImportRefusal(trpc)).toBe(trpc);
  });
});

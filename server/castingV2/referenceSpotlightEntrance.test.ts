/**
 * THE SPOTLIGHT'S TWO PROCEDURES, DRIVEN THROUGH THE REAL ROUTER — #14 slice
 * 3a-2.
 *
 * # Why this file is the point of the slice
 *
 * Slice 3a-1 shipped four roads and nothing called them, so
 * `CASTING_REFERENCE_SELECTOR_SCOPE` could be set to anything at all and the
 * product behaved identically — **a flag nobody reads is invariant 7's "a
 * control that is not invoked does not exist", wearing the other hat.** These
 * two procedures are the first and only place in the product that reads it on a
 * request, and this suite is what proves the reading happens.
 *
 * ⚠ **THE GATE'S POSITIVE CONTROL IS THE ARM THAT MATTERS, AND IT NEEDS NO
 * DATABASE.** A suite that only asserted `NOT_FOUND` with the flag off would
 * pass just as happily against a procedure that always answers `NOT_FOUND` —
 * including one whose flag check was deleted and whose db read then found
 * nothing. The two refusals are deliberately DIFFERENT SENTENCES — *"No such
 * thing."* outside the scope, *"That picture isn't here."* inside it — so
 * passing the gate is observable without a row existing.
 *
 * # Why the loader is doubled rather than driven
 *
 * `vitest.setup.ts` strips `DATABASE_URL`, so there is no row to reach and a
 * suite that needed one would SKIP on the gate and read green (working law 2).
 * The db read and the byte read are replaced over the REAL modules
 * (`importOriginal` and spread), so the router, both schemas, the flag chain,
 * the rate buckets and every refusal are the shipped ones — only the two calls
 * that would need a database and a bucket are doubles, and what they were
 * handed is read back (invariant 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

const FRAME = { width: 32, height: 32 };
const reads: Array<{ userId: number; attachmentPublicId: string }> = [];
const row: { answer: { storageKey: string; digest: string; mime: string; width: number; height: number } | null } = {
  answer: null,
};
const bytes: { answer: Buffer } = { answer: Buffer.alloc(0) };

vi.mock("../db/castingV2ReferenceAttachments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/castingV2ReferenceAttachments")>()),
  readOwnedReferenceAttachment: async (input: { userId: number; attachmentPublicId: string }) => {
    reads.push(input);
    return row.answer;
  },
}));

vi.mock("../storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../storage")>()),
  storageReadBytes: async () => ({ bytes: bytes.answer }),
}));

const REFERENCE_ID = "6f1d0a9e-6c4e-4a1f-9b4e-2f0d8a7c1e55";
const saved = { ...process.env };

/* A fresh user per arm: both handlers spend a rate bucket keyed on the user, so
   arms sharing an id would make the last ones fail for a reason none of them is
   about. */
let nextUserId = 8200;

function ctxFor(userId: number): TrpcContext {
  const user = {
    id: userId,
    openId: `spotlight-${userId}`,
    email: "spotlight@example.com",
    name: "Spotlight",
    approved: true,
    role: "user",
    storageUsed: 0,
    storageLimit: 104857600,
    suspendedAt: null,
    frozenAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as NonNullable<TrpcContext["user"]>;
  return {
    user,
    correlationId: `spotlight-${userId}`,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function caller() {
  nextUserId += 1;
  return { userId: nextUserId, caller: appRouter.createCaller(ctxFor(nextUserId)) };
}

function openTheScope(): void {
  process.env.CASTING_V2_SCOPE = "all";
  process.env.CASTING_REFERENCE_ATTACH_SCOPE = "all";
  process.env.CASTING_REFERENCE_SELECTOR_SCOPE = "all";
}

beforeEach(async () => {
  reads.length = 0;
  row.answer = null;
  bytes.answer = await sharp({
    create: { ...FRAME, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .png()
    .toBuffer();
  openTheScope();
});

afterEach(() => {
  for (const key of [
    "CASTING_V2_SCOPE",
    "CASTING_REFERENCE_ATTACH_SCOPE",
    "CASTING_REFERENCE_SELECTOR_SCOPE",
    "FAL_KEY",
  ]) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("the flag is read on a request", () => {
  it("answers 'no such thing' outside the scope, and never touches the row", async () => {
    process.env.CASTING_REFERENCE_SELECTOR_SCOPE = "off";
    const { caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID }))
      .rejects.toThrow("No such thing.");
    /* Outside the scope there is no capability, so nothing is looked up — a
       refusal that read the row first would tell a prober the id exists. */
    expect(reads).toHaveLength(0);
  });

  it("answers 'no such thing' for a tap outside the scope too", async () => {
    process.env.CASTING_REFERENCE_SELECTOR_SCOPE = "off";
    const { caller: call } = caller();

    await expect(call.castingV2.reference.tapSpotlight({ referenceId: REFERENCE_ID, x: 1, y: 1 }))
      .rejects.toThrow("No such thing.");
    expect(reads).toHaveLength(0);
  });

  /* ---- THE POSITIVE CONTROL ---- */
  it("gets PAST the gate inside the scope, which is a different refusal", async () => {
    const { caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID }))
      .rejects.toThrow("That picture isn't here.");
    /* And it got as far as reading the row, which the off arm never does. */
    expect(reads).toHaveLength(1);
  });

  it("is refused when the chain's PARENT is shut, however the child is set", async () => {
    process.env.CASTING_REFERENCE_ATTACH_SCOPE = "off";
    const { caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID }))
      .rejects.toThrow("No such thing.");
  });
});

describe("whose picture it is", () => {
  it("takes the owner from the session and never from the input", async () => {
    const { userId, caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID }))
      .rejects.toThrow();

    /* Invariant 3, asserted on the ARGUMENT the reader was handed — the only
       place that fact is visible. */
    expect(reads[0]).toEqual({ userId, attachmentPublicId: REFERENCE_ID });
  });

  it("answers somebody else's attachment the way it answers a missing one", async () => {
    /* The doubled reader returns `null` for a row that is not this user's,
       exactly as the real owner-scoped statement does. */
    row.answer = null;
    const { caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID }))
      .rejects.toThrow("That picture isn't here.");
  });

  it("refuses bytes that are not the bytes the row describes", async () => {
    row.answer = {
      storageKey: "casting-v2/reference/whatever.png",
      /* A digest that cannot be of anything this suite stores. */
      digest: "0".repeat(64),
      mime: "image/png",
      ...FRAME,
    };
    const { caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID }))
      .rejects.toThrow("This picture could not be read.");
  });
});

describe("what the schemas accept", () => {
  it("rejects an undeclared field rather than dropping it (invariant 4)", async () => {
    const { caller: call } = caller();

    await expect(
      (call.castingV2.reference.openSpotlight as unknown as (input: unknown) => Promise<unknown>)({
        referenceId: REFERENCE_ID,
        scope: "all",
      }),
    ).rejects.toThrow();
  });

  it("rejects an undeclared field on the tap too", async () => {
    const { caller: call } = caller();

    await expect(
      (call.castingV2.reference.tapSpotlight as unknown as (input: unknown) => Promise<unknown>)({
        referenceId: REFERENCE_ID,
        x: 1,
        y: 1,
        faces: [],
      }),
    ).rejects.toThrow();
  });

  it("refuses a tap at a negative coordinate", async () => {
    const { caller: call } = caller();

    await expect(call.castingV2.reference.tapSpotlight({ referenceId: REFERENCE_ID, x: -1, y: 1 }))
      .rejects.toThrow();
  });

  it("refuses a tap at a fractional coordinate", async () => {
    const { caller: call } = caller();

    await expect(
      (call.castingV2.reference.tapSpotlight as unknown as (input: unknown) => Promise<unknown>)({
        referenceId: REFERENCE_ID,
        x: 1.5,
        y: 1,
      }),
    ).rejects.toThrow();
  });

  it("refuses a referenceId that is not one of ours", async () => {
    const { caller: call } = caller();

    await expect(call.castingV2.reference.openSpotlight({ referenceId: "not-a-uuid" }))
      .rejects.toThrow();
  });
});

describe("what comes back when there is no segmenter key", () => {
  it("says the picture does not light rather than throwing", async () => {
    delete process.env.FAL_KEY;
    row.answer = {
      storageKey: "casting-v2/reference/whatever.png",
      digest: (await import("node:crypto")).createHash("sha256").update(bytes.answer).digest("hex"),
      mime: "image/png",
      ...FRAME,
    };
    const { caller: call } = caller();

    const answer = await call.castingV2.reference.openSpotlight({ referenceId: REFERENCE_ID });

    /* §4's fail-open property: the attach looks exactly as it does today and
       the words road is untouched. */
    expect(answer).toEqual({ lit: false, why: "no-reader" });
  });

  it("says the tap was not taken rather than throwing", async () => {
    delete process.env.FAL_KEY;
    row.answer = {
      storageKey: "casting-v2/reference/whatever.png",
      digest: (await import("node:crypto")).createHash("sha256").update(bytes.answer).digest("hex"),
      mime: "image/png",
      ...FRAME,
    };
    const { caller: call } = caller();

    const answer = await call.castingV2.reference.tapSpotlight({ referenceId: REFERENCE_ID, x: 1, y: 1 });

    expect(answer).toEqual({ took: false, why: "no-reader" });
  });
});

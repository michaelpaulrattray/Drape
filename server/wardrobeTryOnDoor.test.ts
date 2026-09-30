/**
 * THE WARDROBE TRY-ON DOOR, DRIVEN — his word #1537, 2026-09-30, verbatim and
 * entire: ***"SWITCH IT OFF"***.
 *
 * # What this proves, and why each arm is here rather than implied
 *
 * The card's first done-when is *"no live route reaches a model id Google lists
 * as shut down"*. That is a claim about REQUESTS, so it is driven through
 * `appRouter.createCaller` — the real routers, the real input schemas, the real
 * handlers — rather than asserted against a constant beside them (invariant 5).
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE MONEY ONE.** `wardrobe.vto.generate`
 * writes a `generations` row and holds `WARDROBE_CREDIT_COSTS.vtoGeneration`
 * through `withAtomicCredits` around a call that can no longer succeed. A door
 * placed anywhere after that hold would be a door that BILLS a customer for a
 * dead engine, and nothing about the refusal's existence would show it. So the
 * spies below assert ZERO — no credit call, no generation row, no rate-limit
 * slot, no daily-quota consumption — rather than only asserting that a throw
 * happened.
 *
 * # The population is derived, not typed twice
 *
 * The closed list is `WARDROBE_TRY_ON_CLOSED_PROCEDURES` in
 * `shared/wardrobeTryOnDoor.ts`, which the door's own docblock derives from the
 * call sites of the five pipeline functions. This suite walks THAT constant, so
 * a seventh procedure added to the list without a gate reddens here, and a gate
 * removed from one of the six reddens here — working law 4.
 *
 * # Its negative control is a real open road
 *
 * `wardrobe.garments.list` is NOT on the closed list and must still answer. A
 * guard that passes because everything throws is the shape that has bitten this
 * repository before; that arm is what tells the two apart.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WARDROBE_TRY_ON_CLOSED,
  WARDROBE_TRY_ON_CLOSED_CODE,
  WARDROBE_TRY_ON_CLOSED_PROCEDURES,
  WARDROBE_TRY_ON_OPEN,
} from "@shared/wardrobeTryOnDoor";
import type { TrpcContext } from "./_core/context";

/* ── The spies. Every one of these is a thing a customer pays for, in time or
      in credits, and the door must reach none of them. ─────────────────────── */
const spendCredits = vi.fn();
const createGeneration = vi.fn();
const rateLimit = vi.fn();
const dailyQuota = vi.fn();

vi.mock("./db/creditsAtomic", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    withAtomicCredits: (...args: unknown[]) => {
      spendCredits(...args);
      throw new Error("the door let a credit hold through — this must never run");
    },
  };
});

vi.mock("./db/generations", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createGeneration: (...args: unknown[]) => {
      createGeneration(...args);
      throw new Error("the door let a generation row through — this must never run");
    },
  };
});

/*
  ⚠ THE RATE LIMITER IS MOCKED AT `checkRateLimit`, NOT AT `throwIfRateLimited`,
  AND THAT MATTERS. `throwIfRateLimited` is a LOCAL function inside
  `server/routes/wardrobe.ts` (`:70`) — there is no module to mock it at, so a
  spy named after it would never be called and `not.toHaveBeenCalled()` would
  pass for a file that had no door at all. The first version of this suite did
  exactly that, on two of its four spies; it was caught by sabotage rather than
  by reading, which is the whole reason the sabotage runs.
*/
vi.mock("./security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkRateLimit: (...args: unknown[]) => {
      rateLimit(...args);
      return { allowed: true, resetIn: 0, remaining: 1 };
    },
  };
});

vi.mock("./db/dailyQuota", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    enforceDailyQuota: async (...args: unknown[]) => {
      dailyQuota(...args);
    },
  };
});

const { appRouter } = await import("./routers");

function context(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "door-test",
      email: "door@example.com",
      name: "Door Test",
      displayName: null,
      avatarUrl: null,
      avatarKey: null,
      bannerUrl: null,
      bannerKey: null,
      bio: null,
      loginMethod: "email",
      role: "user",
      approved: true,
      storageUsed: 0,
      storageLimit: 104857600,
      suspendedAt: null,
      suspendedReason: null,
      suspendedBy: null,
      frozenAt: null,
      frozenReason: null,
      frozenBy: null,
      referralCode: null,
      referredByUserId: null,
      accessCode: null,
      approvedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    correlationId: "door-test",
  };
}

/**
 * One VALID input per closed procedure — valid, because zod parses before the
 * handler runs and a malformed input would answer BAD_REQUEST, which is a pass
 * for the wrong reason and the easiest way to write a guard that proves nothing.
 */
const ASKS: Record<string, () => Promise<unknown>> = {
  "wardrobe.garments.upload": () =>
    appRouter.createCaller(context()).wardrobe.garments.upload({
      imageBase64: "data:image/png;base64,iVBORw0KGgo=",
      slotType: "tops",
    }),
  "wardrobe.vto.generate": () =>
    appRouter.createCaller(context()).wardrobe.vto.generate({
      modelImageUrl: "https://example.test/model.png",
      garmentIds: [1],
    }),
  "wardrobe.vto.incremental": () =>
    appRouter.createCaller(context()).wardrobe.vto.incremental({
      previousResultUrl: "https://example.test/prev.png",
      modelImageUrl: "https://example.test/model.png",
      changedGarmentIds: [1],
      changedSlots: ["tops"],
      allGarmentIds: [1],
    }),
  "wardrobe.vto.refine": () =>
    appRouter.createCaller(context()).wardrobe.vto.refine({
      currentResultUrl: "https://example.test/result.png",
      modelImageUrl: "https://example.test/model.png",
      garmentId: 1,
      instruction: "shorter sleeves",
    }),
  "wardrobe.decompose.import": () =>
    appRouter.createCaller(context()).wardrobe.decompose.import({
      sourceImageUrl: "https://example.test/outfit.png",
      label: "a jacket",
      slotType: "tops",
    }),
  "wardrobe.sessions.seedChat": () =>
    appRouter.createCaller(context()).wardrobe.sessions.seedChat({
      sessionId: "1",
      modelImageUrl: "https://example.test/model.png",
      resultUrl: "https://example.test/result.png",
    }),
};

describe("the wardrobe try-on door is shut (#1537, his word: SWITCH IT OFF)", () => {
  beforeEach(() => {
    spendCredits.mockClear();
    createGeneration.mockClear();
    rateLimit.mockClear();
    dailyQuota.mockClear();
  });

  it("the door is shut — the one fact both surfaces read", () => {
    /*
      A positive control on the constant itself. If somebody re-opens the road
      on N8 by flipping this, every arm below becomes a statement about an open
      door and would otherwise start passing for the opposite reason.
    */
    expect(WARDROBE_TRY_ON_OPEN).toBe(false);
  });

  it("every ask that would reach a shut-down engine has a driver here", () => {
    /*
      The population guard. `WARDROBE_TRY_ON_CLOSED_PROCEDURES` is the list the
      router is written against; this holds the DRIVEN set equal to it, in both
      directions, so a seventh closed procedure cannot arrive untested and a
      driver cannot outlive the procedure it drives.
    */
    expect(Object.keys(ASKS).sort()).toEqual([...WARDROBE_TRY_ON_CLOSED_PROCEDURES].sort());
  });

  for (const procedure of WARDROBE_TRY_ON_CLOSED_PROCEDURES) {
    it(`${procedure} refuses with the door's own sentence`, async () => {
      await expect(ASKS[procedure]!()).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: WARDROBE_TRY_ON_CLOSED,
      });
    });

    it(`${procedure} refuses BEFORE anything a customer pays for`, async () => {
      /*
        ⚠ THE MONEY ARM. Not "it threw" — "it threw before the credit hold, the
        generation row, the rate-limit slot and the daily quota." Each spy
        throws its own sentence if reached, so a regression names which control
        the door got behind rather than failing on a count.
      */
      await expect(ASKS[procedure]!()).rejects.toThrow();
      expect(spendCredits).not.toHaveBeenCalled();
      expect(createGeneration).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(dailyQuota).not.toHaveBeenCalled();
    });
  }

  it("carries a machine-readable code, so a client need not match on prose", async () => {
    /*
      The client's copy branch reads either the code or the sentence. The code
      is what survives a copy rewrite, and a refusal that carried only prose
      would make the customer's sentence load-bearing for a branch.
    */
    await expect(ASKS["wardrobe.vto.generate"]!()).rejects.toMatchObject({
      cause: { message: WARDROBE_TRY_ON_CLOSED_CODE },
    });
  });

  it("names no vendor, no model and no engine — the law's one narrow prohibition", () => {
    /*
      A closed door is a path a customer must walk, so the
      disappearing-technology law applies to its words exactly as it does to a
      loader or a refusal. What is shut is ours to know; what they are told is
      that the feature is unavailable and their work is safe.
    */
    const words = WARDROBE_TRY_ON_CLOSED.toLowerCase();
    for (const forbidden of ["gemini", "google", "model", "engine", "api", "deprecat", "shut down"]) {
      expect(words).not.toContain(forbidden);
    }
  });

  it("says UNAVAILABLE rather than failed — his instruction, in the sentence", () => {
    expect(WARDROBE_TRY_ON_CLOSED).toMatch(/unavailable/i);
    expect(WARDROBE_TRY_ON_CLOSED).not.toMatch(/fail|error|wrong|sorry/i);
  });

  it("⚠ THE STRUCTURAL BACKSTOP, DRIVEN DIRECTLY — the mouth gate cannot rescue it", async () => {
    /*
      Working law 3, pointed at the door's second layer: every arm above goes
      through the router, where the MOUTH gate refuses first — so every one of
      them would still pass with all five pipeline gates deleted. The backstop
      exists for a FUTURE caller that is not one of today's six procedures, and
      the only test that can see it is one that calls the pipeline functions
      themselves.

      Imported here rather than at the top of the file so the router arms above
      exercise the real modules through the real handlers, unmocked.
    */
    const [vto, digitization, refinement, session] = await Promise.all([
      import("./wardrobe/vtoGeneration"),
      import("./wardrobe/garmentDigitization"),
      import("./wardrobe/garmentRefinement"),
      import("./wardrobe/vtoSession"),
    ]);

    const entries: Array<readonly [string, () => Promise<unknown>]> = [
      ["generateVirtualTryOn", () => vto.generateVirtualTryOn({} as never)],
      ["incrementalComposite", () => vto.incrementalComposite({} as never)],
      ["digitizeGarment", () => digitization.digitizeGarment("u", "tops", "l", "99")],
      ["refineGarment", () => refinement.refineGarment({} as never)],
      ["seedSession", () => session.seedSession(99, "1", "m", "r")],
    ];

    for (const [name, call] of entries) {
      await expect(call(), `${name} must refuse at the engine's own door`)
        .rejects.toMatchObject({ message: WARDROBE_TRY_ON_CLOSED });
    }

    /*
      And nothing reached an engine on the way: these are called with junk
      arguments on purpose, so a gate placed after the first real work would
      fail on a TypeError instead — a different message, which the assertion
      above tells apart.
    */
    expect(entries).toHaveLength(5);
  });

  it("⚠ NEGATIVE CONTROL — an open wardrobe road is NOT refused", async () => {
    /*
      The door closes what reaches a dead engine and nothing a customer owns.
      Without this arm, a guard that shut the whole router would pass every
      test above; with it, "everything throws" is a red.
    */
    let refusal: unknown = null;
    try {
      await appRouter.createCaller(context()).wardrobe.garments.list();
    } catch (error) {
      refusal = error;
    }
    /*
      It may still throw — there is no database here — but it must never throw
      THE DOOR's refusal. That distinction is the whole arm: the assertion is
      about which failure, not about whether one happened.
    */
    expect((refusal as { message?: string } | null)?.message ?? "").not.toBe(WARDROBE_TRY_ON_CLOSED);
  });
});

/**
 * "SAY IT YOUR WAY" AT THE ENTRANCE — `castingV2.translatePersonaLine` and
 * Keep this (`editCastPersonaField` carrying `ownWords`), driven through the
 * REAL router (#2197 / #2205).
 *
 * The shape is `castPersonaEditEntrance.test.ts`'s: `vitest.setup.ts` strips
 * `DATABASE_URL`, so the two database calls the handlers lean on are doubled
 * over the real module, and so is the translator's ENGINE (a recording text
 * engine, never a provider). The router, the schemas, the rate bucket, the
 * door and the refusals are all the shipped ones.
 *
 * What only the entrance can show:
 *
 *   1. **the translation writes nothing** — no call to the writer, ever;
 *   2. **another account's Cast spends nothing** — `NOT_FOUND` before the
 *      engine is asked, and the owner it is resolved under is the session's;
 *   3. **`.strict()`, the sentence cap, an empty sentence** — refused before a
 *      call is paid for;
 *   4. **the reword bound** — sixty presses an hour, the sixty-first refused
 *      with a real `TOO_MANY_REQUESTS`, and the first sixty all reach the
 *      engine (the positive control that makes the refusal mean something);
 *   5. **Keep this carries the sentence to the writer, and a plain edit does
 *      not** — the key is absent, not `undefined`, so the stored sentence is
 *      left alone by an in-place edit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";

const resolved: { model: Record<string, unknown> | null } = { model: null };
const writes: Array<Record<string, unknown>> = [];
const resolves: Array<{ userId: number; castId: string }> = [];
const requests: TextRequest[] = [];
const reply = { text: JSON.stringify({ line: "Stands square in a doorway, weight back on the heels. Answers late." }) };
const translator: { engine: TextEngine | null } = { engine: null };

const recordingEngine = {
  id: "recording",
  async complete(request: TextRequest) {
    requests.push(request);
    return { text: reply.text, truncated: false, latencyMs: 1 };
  },
} as unknown as TextEngine;

vi.mock("../db/castingV2Sign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/castingV2Sign")>()),
  getOwnedCastByPublicId: async (userId: number, castId: string) => {
    resolves.push({ userId, castId });
    return resolved.model;
  },
  editCastPersonaField: async (input: Record<string, unknown>) => {
    writes.push(input);
    return true;
  },
}));

vi.mock("./signEngine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./signEngine")>()),
  castingCastPersonaTranslator: () => translator.engine,
}));

const { appRouter } = await import("../routers");
const { RATE_LIMITS } = await import("../security/rateLimit");
const { CAST_PERSONA_OWN_WORDS_MAX_LENGTH } = await import("../../shared/inputLimits");
import type { TrpcContext } from "../_core/context";

const CAST_ID = "KI-WHGH-MQQ8-D7MV-8V8G";
const BOUNCER = "Basically a tired old bouncer who's seen everything and stopped being surprised.";
const saved = { ...process.env };
let nextUserId = 7400;

function ctxFor(userId: number): TrpcContext {
  const user = {
    id: userId,
    openId: `translate-${userId}`,
    email: "translate@example.com",
    name: "Translate",
    displayName: null,
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "email",
    approved: true,
    role: "user",
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
  } as unknown as NonNullable<TrpcContext["user"]>;
  return {
    user,
    correlationId: `translate-${userId}`,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function caller() {
  nextUserId += 1;
  return { userId: nextUserId, trpc: appRouter.createCaller(ctxFor(nextUserId)) };
}

beforeEach(() => {
  process.env.CASTING_V2_SCOPE = "all";
  resolved.model = { id: 907, technicalSchema: { subject: { sex: "male" } } };
  translator.engine = recordingEngine;
  reply.text = JSON.stringify({ line: "Stands square in a doorway, weight back on the heels. Answers late." });
  writes.length = 0;
  resolves.length = 0;
  requests.length = 0;
});

afterEach(() => {
  if (saved.CASTING_V2_SCOPE === undefined) delete process.env.CASTING_V2_SCOPE;
  else process.env.CASTING_V2_SCOPE = saved.CASTING_V2_SCOPE;
});

/* ------------------------------------------------- 1 · a press, end to end */

describe("a customer says it their way", () => {
  it("gets one line back, from one call, and nothing is written", async () => {
    const { userId, trpc } = caller();
    await expect(trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "personality", ownWords: `  ${BOUNCER}\n`,
    })).resolves.toEqual({
      kind: "line",
      line: "personality",
      text: "Stands square in a doorway, weight back on the heels. Answers late.",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.about).toBe("persona.translate");
    /* Trimmed by the schema before it is paid for. */
    expect(requests[0]!.user).toContain(`\n${BOUNCER}`);
    /* The cast's OWN pronouns, read off its record — a male cast is "him". */
    expect(requests[0]!.system).toContain("Write about him in the third person");
    /* Invariant 3: the owner it was resolved under is the session's. */
    expect(resolves).toEqual([{ userId, castId: CAST_ID }]);
    /* It writes NOTHING. Keep this is a separate act. */
    expect(writes).toHaveLength(0);
  });

  it("says nothing — never an error — when the call comes back with no usable line", async () => {
    reply.text = "not json at all";
    const { trpc } = caller();
    await expect(trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "voice", ownWords: "Sounds like a tired blues singer.",
    })).resolves.toEqual({ kind: "nothing", line: "voice" });
  });

  it("says nothing, and asks nothing, on a deployment with no text credential", async () => {
    translator.engine = null;
    const { trpc } = caller();
    await expect(trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "voice", ownWords: "Sounds like a tired blues singer.",
    })).resolves.toEqual({ kind: "nothing", line: "voice" });
    expect(requests).toHaveLength(0);
  });
});

/* -------------------------------------------- 2 · another account's Cast */

describe("a Cast that is not theirs spends nothing", () => {
  it("answers NOT_FOUND before the engine is asked", async () => {
    resolved.model = null;
    const { trpc } = caller();
    await expect(trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "personality", ownWords: BOUNCER,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requests).toHaveLength(0);
  });
});

/* ---------------------------------------- 3 · refused before it is paid for */

describe("the input is refused before a call is paid for", () => {
  it.each([
    ["an undeclared key", { castId: CAST_ID, line: "voice", ownWords: "Low.", userId: 1 }],
    ["a blank sentence", { castId: CAST_ID, line: "voice", ownWords: "   " }],
    ["a sentence over the cap", { castId: CAST_ID, line: "voice", ownWords: "x".repeat(CAST_PERSONA_OWN_WORDS_MAX_LENGTH + 1) }],
    ["a line that is not one of the two", { castId: CAST_ID, line: "mood", ownWords: "Low." }],
  ])("%s", async (_label, input) => {
    const { trpc } = caller();
    await expect(trpc.castingV2.translatePersonaLine(input as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  it(`accepts a sentence of exactly ${CAST_PERSONA_OWN_WORDS_MAX_LENGTH}, so the cap is the cap`, async () => {
    const { trpc } = caller();
    await expect(trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "voice", ownWords: "x".repeat(CAST_PERSONA_OWN_WORDS_MAX_LENGTH),
    })).resolves.toMatchObject({ kind: "line" });
  });
});

/* -------------------------------------------------- 4 · the reword bound */

describe("rewording is free, and the house's spend is bounded per account", () => {
  it(`the first ${RATE_LIMITS.castPersonaTranslate.maxRequests} presses in an hour reach the engine and the next is refused`, async () => {
    const { trpc } = caller();
    const allowed = RATE_LIMITS.castPersonaTranslate.maxRequests;
    expect(RATE_LIMITS.castPersonaTranslate.windowMs).toBe(60 * 60 * 1000);
    for (let press = 0; press < allowed; press += 1) {
      await trpc.castingV2.translatePersonaLine({
        castId: CAST_ID, line: press % 2 ? "voice" : "personality", ownWords: `Reword number ${press}.`,
      });
    }
    /* POSITIVE CONTROL: every one of them was really paid for. */
    expect(requests).toHaveLength(allowed);
    await expect(trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "voice", ownWords: "One more.",
    })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(requests).toHaveLength(allowed);
  });

  it("another account's presses do not spend this one's allowance", async () => {
    const first = caller();
    for (let press = 0; press < RATE_LIMITS.castPersonaTranslate.maxRequests; press += 1) {
      await first.trpc.castingV2.translatePersonaLine({ castId: CAST_ID, line: "voice", ownWords: "Low." });
    }
    const second = caller();
    await expect(second.trpc.castingV2.translatePersonaLine({
      castId: CAST_ID, line: "voice", ownWords: "Low.",
    })).resolves.toMatchObject({ kind: "line" });
  });
});

/* ------------------------------------------- 5 · Keep this stores the words */

describe("Keep this stores the line and the customer's own sentence together", () => {
  it("hands the writer the sentence beside the line, trimmed, under the session's owner", async () => {
    const { userId, trpc } = caller();
    await trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "personality", text: "Stands square in a doorway.", ownWords: ` ${BOUNCER} `,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      userId, modelId: 907, line: "personality", text: "Stands square in a doorway.", ownWords: BOUNCER,
    });
  });

  it("a plain in-place edit carries NO sentence key, so the stored one is left alone", async () => {
    const { trpc } = caller();
    await trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "Low and dry.",
    });
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0]!)).not.toContain("ownWords");
  });

  it.each([
    ["blank", "  "],
    ["over the cap", "x".repeat(CAST_PERSONA_OWN_WORDS_MAX_LENGTH + 1)],
  ])("refuses a sentence that is %s and never reaches the row", async (_label, ownWords) => {
    const { trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "Low and dry.", ownWords,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });
});

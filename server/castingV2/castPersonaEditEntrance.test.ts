/**
 * THE ENTRANCE SHE REWRITES A LINE THROUGH — `castingV2.editCastPersonaField`,
 * driven through the REAL router (the relay's finding 6 on PR #2114, #1242).
 *
 * # Why this file exists
 *
 * `castPersonaWrite.test.ts` proves what the two STATEMENTS can reach.
 * Everything the entrance decides before them had no driving arm at all, and
 * the review found it the way such things are always found — by reading rather
 * than by a red: *"deleting the route's voice-cap check stays green."*
 *
 * Four of those decisions are the entrance's alone and cannot be seen from the
 * statement:
 *
 *   1. **the per-line cap**, which the schema CANNOT carry — one `max` for a
 *      field whose ceiling depends on a sibling field, so the schema takes the
 *      looser of the two and the voice's own 200 is checked in the handler. A
 *      deleted check leaves a 400-character voice line that renders over its
 *      card, and nothing downstream refuses it;
 *   2. **`.strict()`**, so an undeclared key is rejected and not dropped
 *      (invariant 4);
 *   3. **the owner comes from `ctx.user.id` and never from the input**
 *      (invariant 3) — asserted on the ARGUMENT the writer is handed, which is
 *      the only place that fact is visible;
 *   4. **a refusal that cannot be told from "no such Cast"** — another
 *      account's Cast and an unmoved row both answer `NOT_FOUND`, because a
 *      different code on the first would confirm that somebody else's cast
 *      exists.
 *
 * # Why the writer is doubled rather than driven
 *
 * `vitest.setup.ts` strips `DATABASE_URL`, so there is no row to reach and a
 * suite that needed one would SKIP on the gate and read green (working law 2).
 * The two functions the handler leans on are replaced over the REAL module
 * (`importOriginal` and spread), so the router, the schema, the rate bucket and
 * the refusals are all the shipped ones — only the two calls that would need a
 * database are doubles, and what they were handed is then read back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import {
  CAST_PERSONALITY_MAX_LENGTH,
  CAST_VOICE_MAX_LENGTH,
} from "../../shared/inputLimits";

const resolved: { model: { id: number } | null } = { model: { id: 907 } };
const written: { answer: boolean } = { answer: true };
const writes: Array<Record<string, unknown>> = [];
const resolves: Array<{ userId: number; castId: string }> = [];

vi.mock("../db/castingV2Sign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/castingV2Sign")>()),
  getOwnedCastByPublicId: async (userId: number, castId: string) => {
    resolves.push({ userId, castId });
    return resolved.model;
  },
  editCastPersonaField: async (input: Record<string, unknown>) => {
    writes.push(input);
    return written.answer;
  },
}));

const CAST_ID = "KI-WHGH-MQQ8-D7MV-8V8G";
const saved = { ...process.env };

/* A fresh owner per arm: the handler spends a rate bucket keyed on the user, so
   arms sharing an id would make the LAST ones fail for a reason none of them is
   about. */
let nextUserId = 7100;

function ctxFor(userId: number): TrpcContext {
  const user = {
    id: userId,
    openId: `persona-${userId}`,
    email: "persona@example.com",
    name: "Persona",
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
    correlationId: `persona-${userId}`,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function caller() {
  nextUserId += 1;
  return { userId: nextUserId, caller: appRouter.createCaller(ctxFor(nextUserId)) };
}

beforeEach(() => {
  process.env.CASTING_V2_SCOPE = "all";
  resolved.model = { id: 907 };
  written.answer = true;
  writes.length = 0;
  resolves.length = 0;
});

afterEach(() => {
  if (saved.CASTING_V2_SCOPE === undefined) delete process.env.CASTING_V2_SCOPE;
  else process.env.CASTING_V2_SCOPE = saved.CASTING_V2_SCOPE;
});

/* ------------------------------------------------------ 1 · it works at all */

describe("she rewrites a line", () => {
  it("writes her text and hands the card back with the badge already gone", async () => {
    const { userId, caller: trpc } = caller();

    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "Low, unhurried; the vowels sit back.",
    })).resolves.toEqual({
      castId: CAST_ID,
      line: "voice",
      text: "Low, unhurried; the vowels sit back.",
      drafted: false,
    });

    /*
      ⚠ INVARIANT 3, READ AT THE ARGUMENT. The owner the writer is handed is the
      SESSION's, and the entrance is the only place that can be seen: the
      statement's own suite binds whatever it is given.
    */
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      userId, modelId: 907, line: "voice", text: "Low, unhurried; the vowels sit back.",
    });
    expect(resolves[0]).toEqual({ userId, castId: CAST_ID });
  });

  it("trims her text before storing it, so a trailing newline is not her line", async () => {
    const { caller: trpc } = caller();
    await trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "  Low and dry.\n",
    });
    expect(writes[0]).toMatchObject({ text: "Low and dry." });
  });
});

/* ---------------------------------------------- 2 · the caps, per line */

describe("the per-line cap the schema cannot carry", () => {
  it(`refuses a voice line over ${CAST_VOICE_MAX_LENGTH} and never reaches the row`, async () => {
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "x".repeat(CAST_VOICE_MAX_LENGTH + 1),
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: `Keep the voice to ${CAST_VOICE_MAX_LENGTH} characters or fewer.`,
    });
    expect(writes).toHaveLength(0);
  });

  /*
    ⚠ THE ARM THAT MAKES THE ONE ABOVE MEAN SOMETHING. A single shared cap would
    pass the voice arm by refusing BOTH lines at 200 — so the personality is
    driven at a length the voice refuses, and it must go through. Without this,
    "the cap is enforced" and "the cap is wrong" look identical.
  */
  it(`accepts a personality of ${CAST_VOICE_MAX_LENGTH + 1}, because the two caps are not one`, async () => {
    const { caller: trpc } = caller();
    const text = `${"x".repeat(CAST_VOICE_MAX_LENGTH)}.`;
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "personality", text,
    })).resolves.toMatchObject({ line: "personality" });
    expect(writes[0]).toMatchObject({ text });
  });

  it(`refuses a personality over ${CAST_PERSONALITY_MAX_LENGTH} at the schema`, async () => {
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "personality", text: "x".repeat(CAST_PERSONALITY_MAX_LENGTH + 1),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });

  it("refuses a line she has emptied rather than storing a blank card", async () => {
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "   ",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });
});

/* ------------------------------------------------- 3 · the closed input shape */

describe("the input is closed", () => {
  it("rejects an undeclared key rather than dropping it (invariant 4)", async () => {
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID,
      line: "voice",
      text: "Low and dry.",
      /* The shape this guards: a client that thinks it can name the owner. */
      userId: 1,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });

  it("rejects a line that is not one of the two cards", async () => {
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "mood", text: "Low and dry.",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });
});

/* --------------------------------------------------- 4 · the two refusals */

describe("a Cast that is not hers", () => {
  it("answers NOT_FOUND when the public id resolves to nothing of hers", async () => {
    resolved.model = null;
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "Low and dry.",
    })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Cast not found" });
    expect(writes).toHaveLength(0);
  });

  /*
    ⚠ THE SAME ANSWER FROM THE OTHER SIDE, and the sameness is the point. The
    resolve is a free refusal and the STATEMENT is the authority (invariant 1),
    so a row that did not move — deleted between the two, or never hers — must
    read exactly as "no such Cast". A distinct code here would tell a stranger
    that the cast exists.
  */
  it("answers the same NOT_FOUND when the statement moved no row", async () => {
    written.answer = false;
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "Low and dry.",
    })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Cast not found" });
    expect(writes).toHaveLength(1);
  });
});

/* ------------------------------------------------------------- 5 · the door */

describe("the casting door", () => {
  /*
    ⚠ THE ANSWER ASSERTED HERE IS THE SHARED DOOR'S, READ AT THE CODE AND NOT
    CHOSEN BY THIS ARM. `requireCastingV2` answers `PRECONDITION_FAILED` with
    *"Casting is not available for this account yet."* — the same answer it gives
    every `castingV2.*` procedure. This arm was first written asserting
    `NOT_FOUND`, copied from `reimagine.test.ts`, whose own door is a different
    one (#1443 chose a does-not-exist answer there on purpose); it was wrong and
    the arm is corrected to the product rather than the product to the arm.

    It is deliberately NOT changed to match the other door. That choice belongs
    to the whole namespace, not to the one procedure a repair happens to be
    touching, and nothing in the review asks for it.
  */
  it("refuses with the shared door's answer while casting is off for the account", async () => {
    process.env.CASTING_V2_SCOPE = "off";
    const { caller: trpc } = caller();
    await expect(trpc.castingV2.editCastPersonaField({
      castId: CAST_ID, line: "voice", text: "Low and dry.",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Casting is not available for this account yet.",
    });
    expect(writes).toHaveLength(0);
    /* And it refuses BEFORE resolving her cast, so a closed door reveals
       nothing about what the account has. */
    expect(resolves).toHaveLength(0);
  });
});

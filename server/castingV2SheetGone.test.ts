/**
 * AN EXPIRED SHEET IS GONE, AT THE WIRE (#890 — his word, 13 Sep).
 *
 * Verbatim: *"I would rather if the sheet is expired its not reachable its
 * gone."*
 *
 * The rule itself is one `if` and needs no test. **What needs a driver is the
 * PLACE and the MARKER**, because both are load-bearing and neither is visible
 * in the sentence:
 *
 *   - **the place.** The door is beside the owner-scoped read, before a single
 *     field of the sheet is projected. The road it closes is a week-old tab and
 *     a bookmark — a client-side check is exactly what a week-old bundle skips
 *     — so "refuses" is not enough on its own: nothing may be READ for a gone
 *     sheet either. These arms assert the two readers were never called, which
 *     is a claim about ORDER that no assertion on the error can make.
 *   - **the marker.** The client's redirect keys on `spoken` (the server's flag
 *     for *a person wrote this sentence*), because `NOT_FOUND` alone is shared
 *     with the ownership refusal one line above on purpose. That flag is put on
 *     the payload by the error formatter, not by the throw, so it is asserted
 *     ON THE OUTGOING SHAPE (invariant 5) rather than near the throw — a door
 *     that is spoken only in the server's memory leaves the client redirecting
 *     on nothing.
 *
 * The positive control is the arm that makes the rest mean anything: an OPEN
 * sheet still reads, still projects, still returns. Without it every assertion
 * here would pass just as happily against a `getSession` that refused
 * everything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { withSpokenFlag } from "./_core/spokenError";

const getOwnedCastingSession = vi.fn();
const listSessionRolls = vi.fn();
const listKeptCandidates = vi.fn();

vi.mock("./db/castingV2", async () => {
  const real = await vi.importActual<typeof import("./db/castingV2")>("./db/castingV2");
  return {
    ...real,
    getOwnedCastingSession: (...args: unknown[]) => getOwnedCastingSession(...args),
    listSessionRolls: (...args: unknown[]) => listSessionRolls(...args),
    listKeptCandidates: (...args: unknown[]) => listKeptCandidates(...args),
  };
});

const { castingV2Router } = await import("./routes/castingV2");

const SHEET = "22222222-2222-4222-8222-222222222222";

/*
  A fresh account per test: the rate limiter's store is module-level and real,
  and a shared id would let one arm's polls refuse the next arm's read for a
  reason that has nothing to do with this card.
*/
let nextUser = 880_000;

function caller(userId: number) {
  return castingV2Router.createCaller({
    user: { id: userId, approved: true, role: "user" },
  } as never);
}

/** A session row as the reader hands it back — only the fields the door reads. */
function sheet(status: string) {
  return {
    id: 10,
    publicId: SHEET,
    status,
    activeRollId: null,
    originType: "roster",
    signedCastCount: 0,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    lastActivityAt: new Date("2026-09-01T00:00:00Z"),
    expiresAt: new Date("2026-09-08T00:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listSessionRolls.mockResolvedValue([]);
  listKeptCandidates.mockResolvedValue([]);
});

describe("the sheet page's reader refuses a sheet that is gone", () => {
  for (const [status, expected] of [
    ["expired", /expired and was cleared/i],
    ["abandoned", /closed and cleared/i],
  ] as const) {
    it(`an ${status.toUpperCase()} sheet: refused before anything is read, in his words`, async () => {
      const userId = (nextUser += 1);
      process.env.CASTING_V2_SCOPE = `users:${userId}`;
      getOwnedCastingSession.mockResolvedValue(sheet(status));

      const refusal = await caller(userId).getSession({ sessionId: SHEET }).then(
        () => { throw new Error(`the page loaded a ${status} sheet`); },
        (error: { code: string; message: string }) => error,
      );

      expect(refusal).toMatchObject({ code: "NOT_FOUND" });
      expect(refusal.message).toMatch(expected);
      /*
        HIS SENTENCE AND NOT THE OLD ONE. "Session not found" is the ownership
        refusal's sentence — technology, and a lie about what happened to a
        sheet the customer had.
      */
      expect(refusal.message).not.toMatch(/session not found/i);
      /* And nothing offers their words back: the dock is what this overturns. */
      expect(refusal.message).not.toMatch(/these words/i);

      /*
        THE PLACE, which is the half an assertion on the error cannot reach.
        The owner-scoped read happened; nothing after it did.
      */
      expect(getOwnedCastingSession).toHaveBeenCalledWith(userId, SHEET);
      expect(listSessionRolls).not.toHaveBeenCalled();
      expect(listKeptCandidates).not.toHaveBeenCalled();
    });
  }

  it("the refusal leaves the server MARKED as ours — the client's whole discriminator", async () => {
    const userId = (nextUser += 1);
    process.env.CASTING_V2_SCOPE = `users:${userId}`;
    getOwnedCastingSession.mockResolvedValue(sheet("expired"));

    const refusal = await caller(userId).getSession({ sessionId: SHEET }).catch((error: unknown) => error);

    /*
      Driven through the function `initTRPC` actually calls, on the error that
      was actually thrown — not a re-implementation of the formatter beside it.
      Its negative control is the arm below: the same read, an unknown id, no
      marker. If both carried it the flag would be no discriminator at all and
      a rate limit would redirect a customer off their own sheet.
    */
    const shape = withSpokenFlag({ data: { code: "NOT_FOUND" } }, refusal);
    expect(shape.data.spoken).toBe(true);
  });

  it("an unknown or foreign id keeps the ownership refusal, unmarked — the negative control", async () => {
    const userId = (nextUser += 1);
    process.env.CASTING_V2_SCOPE = `users:${userId}`;
    getOwnedCastingSession.mockResolvedValue(null);

    const refusal = await caller(userId).getSession({ sessionId: SHEET }).catch((error: unknown) => error);

    expect(refusal).toMatchObject({ code: "NOT_FOUND", message: "Session not found" });
    /* Unmarked, so the redirect cannot fire on it and nothing about a foreign
       id's refusal changed (invariant 1's second half). */
    expect(withSpokenFlag({ data: { code: "NOT_FOUND" } }, refusal).data.spoken).toBeUndefined();
  });

  it("an OPEN sheet still loads — the positive control the rest of the file rests on", async () => {
    const userId = (nextUser += 1);
    process.env.CASTING_V2_SCOPE = `users:${userId}`;
    getOwnedCastingSession.mockResolvedValue(sheet("open"));

    const loaded = await caller(userId).getSession({ sessionId: SHEET });

    expect(loaded).toMatchObject({ sessionId: SHEET, rolls: [] });
    expect(listSessionRolls).toHaveBeenCalledWith(userId, 10);
    expect(listKeptCandidates).toHaveBeenCalledWith(userId, 10);
  });
});

/**
 * THE LOBBY'S OPEN-SHEET CARDS, BUILT IN CHUNKS — the driven arms for #2000's
 * fifth site.
 *
 * The defect class is the one `server/perRowFanOutBounded.test.ts` carries:
 * a `Promise.all` over rows, each row doing its own database reads, all at
 * once onto the one shared pool (`server/db/connection.ts`: 20 connections +
 * 50 queued; the 71st concurrent query is refused with `Queue limit
 * reached.`). `castingV2.openSessions` built one card per open sheet that
 * way, and a card is FOUR reads — so with the ceiling of 40 open sheets
 * (`OPEN_SESSION_CEILING`) the lobby held up to forty slots at one moment.
 *
 * ⚠ **WHY THIS INSTRUMENT COUNTS CALLS RATHER THAN FAKING A POOL, and it is
 * the honest difference from its sibling suite.** Forty is UNDER seventy, so
 * a pool fake would pass this road both before and after the fix and prove
 * nothing — the claim is not *"it stops failing"*, it is *"it stops holding
 * more than a handful of the pool at one moment"*. So the db readers are
 * doubled with probes that record how many cards are in flight, the REAL
 * procedure is driven through `createCaller`, and the real
 * `OPEN_SESSION_CARD_CHUNK` is the bound asserted against.
 *
 * The first arm proves the probe can SEE an unbounded fan-out before any
 * verdict of it is believed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** How many cards are being built right now, and the high-water mark. */
const probe = vi.hoisted(() => ({ inFlight: 0, maxInFlight: 0, sessions: [] as number[] }));

/** One reader's body: enter, wait a tick, leave — so overlap is observable. */
const read = vi.hoisted(() => async <T>(value: T): Promise<T> => {
  await new Promise((resolve) => setTimeout(resolve, 2));
  return value;
});

vi.mock("./db/castingV2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/castingV2")>();
  return {
    ...actual,
    listOpenCastingSessions: async () =>
      probe.sessions.map((id) => ({
        id,
        publicId: `sheet-${id}`,
        lastActivityAt: new Date(1_760_000_000_000 + id * 1_000),
        expiresAt: null,
      })),
    listSessionRolls: async (_userId: number, sessionId: number) => {
      probe.inFlight += 1;
      probe.maxInFlight = Math.max(probe.maxInFlight, probe.inFlight);
      return read([{ id: sessionId * 10, briefText: `brief ${sessionId}` }]);
    },
    listKeptCandidates: async () => read([]),
    listRollCandidates: async () => read([]),
  };
});

vi.mock("./db/castingV2Sign", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/castingV2Sign")>();
  return {
    ...actual,
    listSessionSignedCastNames: async () => {
      const names = await read<string[]>([]);
      /* The LAST of a card's four reads — the card is finished here. */
      probe.inFlight -= 1;
      return names;
    },
  };
});

process.env.CASTING_V2_SCOPE = "all";

const { castingV2Router } = await import("./routes/castingV2");
const { OPEN_SESSION_CARD_CHUNK } = await import("./db/castingV2");

const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });

function openSheets(count: number): void {
  probe.sessions = Array.from({ length: count }, (_, i) => i + 1);
}

beforeEach(() => {
  probe.inFlight = 0;
  probe.maxInFlight = 0;
  probe.sessions = [];
});

describe("#2000 — the probe can see an unbounded fan-out", () => {
  it("POSITIVE CONTROL — forty cards built the OLD way read as forty in flight", async () => {
    openSheets(40);
    const db = await import("./db/castingV2");
    const sign = await import("./db/castingV2Sign");
    const sessions = await db.listOpenCastingSessions(1);
    await Promise.all(
      sessions.map(async (session) => {
        await db.listSessionRolls(1, session.id);
        await sign.listSessionSignedCastNames(1, session.id);
      }),
    );
    expect(probe.maxInFlight).toBe(40);
  });
});

describe("#2000 — castingV2.openSessions", () => {
  it("⚠ forty open sheets hold no more than one chunk of the pool at any moment", async () => {
    openSheets(40);
    const cards = await castingV2Router.createCaller({ user: customer(9_001) } as never).openSessions({});

    expect(cards).toHaveLength(40);
    expect(
      probe.maxInFlight,
      "the lobby held more than one chunk of cards at once — the fan-out is back",
    ).toBeLessThanOrEqual(OPEN_SESSION_CARD_CHUNK);
    /* And it really did overlap inside a chunk — this is not a serial loop
       dressed up, which would be slower for no reason. */
    expect(probe.maxInFlight).toBeGreaterThan(1);
  });

  it("the cards keep the order the reader gave them, which is what the lobby draws", async () => {
    openSheets(23);
    const cards = await castingV2Router.createCaller({ user: customer(9_002) } as never).openSessions({});
    expect(cards.map((card) => card.sessionId)).toEqual(
      Array.from({ length: 23 }, (_, i) => `sheet-${i + 1}`),
    );
    expect(cards[0].briefText).toBe("brief 1");
    expect(cards[22].briefText).toBe("brief 23");
  });

  it("a partial last chunk is not dropped", async () => {
    openSheets(OPEN_SESSION_CARD_CHUNK * 2 + 1);
    const cards = await castingV2Router.createCaller({ user: customer(9_003) } as never).openSessions({});
    expect(cards).toHaveLength(OPEN_SESSION_CARD_CHUNK * 2 + 1);
  });

  it("NEGATIVE CONTROL — no open sheets reads as no cards and no reads", async () => {
    openSheets(0);
    const cards = await castingV2Router.createCaller({ user: customer(9_004) } as never).openSessions({});
    expect(cards).toEqual([]);
    expect(probe.maxInFlight).toBe(0);
  });

  it("CONTROL — the chunk is a real bound, not a number nobody reads", () => {
    expect(OPEN_SESSION_CARD_CHUNK).toBeGreaterThan(0);
    expect(OPEN_SESSION_CARD_CHUNK).toBeLessThan(40);
  });
});

/**
 * THE SIX CAMPAIGN DOORS, DRIVEN THROUGH THE REAL ROUTER (card #2249).
 *
 * The store is doubled here so these arms run on every `pnpm test`, without a
 * database; what the STATEMENTS do with ownership is proven against a real one
 * in `server/castCampaigns-db.test.ts`. What only this file can show:
 *
 *  - the owner handed to the store is the SESSION's, never anything in the
 *    input (invariant 3) — an input naming a `userId` is refused outright;
 *  - every one of the six inputs is `.strict()` (invariant 4), proven by
 *    PARSING an undeclared key through the router, with a positive control
 *    beside each so a rejection cannot be a broken caller;
 *  - each store outcome becomes the refusal it should (`NOT_FOUND`,
 *    `CONFLICT`), and a store that says "not found" never leaks a result;
 *  - the doors are shut outside casting, before the store is asked anything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const calls = vi.hoisted(() => [] as Array<{ fn: string; args: unknown[] }>);
const outcome = vi.hoisted(() => ({ next: null as unknown }));

vi.mock("./db/castCampaigns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/castCampaigns")>();
  const record = (fn: string, fallback: unknown) => async (...args: unknown[]) => {
    calls.push({ fn, args });
    const value = outcome.next ?? fallback;
    outcome.next = null;
    return value;
  };
  return {
    ...actual,
    listCampaigns: record("listCampaigns", [{ campaignId: "c".repeat(32), name: "Summer", castCount: 2 }]),
    createCampaign: record("createCampaign", { kind: "created", campaign: { campaignId: "c".repeat(32), name: "Summer", castCount: 0 } }),
    renameCampaign: record("renameCampaign", { kind: "renamed" }),
    deleteCampaign: record("deleteCampaign", { kind: "deleted", membersRemoved: 3 }),
    addCastsToCampaign: record("addCastsToCampaign", { kind: "added", added: 2 }),
    removeCastsFromCampaign: record("removeCastsFromCampaign", { kind: "removed", removed: 1 }),
  };
});

process.env.CASTING_V2_SCOPE = "all";

const { castingV2Router } = await import("./routes/castingV2");
const { CAMPAIGN_CASTS_PER_CALL_MAX, CAMPAIGN_NAME_MAX_LENGTH } = await import("./db/castCampaigns");

let nextUser = 7_310_000;
const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });
/* A fresh account per caller, because the rate limiter's store is real and module-level. */
function caller() {
  const id = (nextUser += 1);
  return { id, call: castingV2Router.createCaller({ user: customer(id) } as never) };
}

const CAMPAIGN = "a".repeat(32);
const CAST = "KI-AAAA-BBBB-CCCC-DDDD";

/** One valid input per door — the positive control every refusal arm is read against. */
const VALID = {
  listCampaigns: {},
  createCampaign: { name: "Summer" },
  renameCampaign: { campaignId: CAMPAIGN, name: "Autumn" },
  deleteCampaign: { campaignId: CAMPAIGN },
  addCastsToCampaign: { campaignId: CAMPAIGN, castIds: [CAST] },
  removeCastsFromCampaign: { campaignId: CAMPAIGN, castIds: [CAST] },
};
type Door = keyof typeof VALID;
const DOORS = Object.keys(VALID) as Door[];

function drive(call: ReturnType<typeof caller>["call"], door: Door, input: unknown) {
  return (call[door] as (input: unknown) => Promise<unknown>)(input);
}

beforeEach(() => {
  calls.length = 0;
  outcome.next = null;
});

describe("the owner is the session's, never the input's (invariant 3)", () => {
  for (const door of DOORS) {
    it(`${door} hands the store the caller's own id`, async () => {
      const { id, call } = caller();
      await drive(call, door, VALID[door]);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0]).toBe(id);
    });
  }
});

describe("every input is .strict() (invariant 4)", () => {
  for (const door of DOORS) {
    it(`${door}: the valid input passes, and the same input carrying a userId is refused before the store`, async () => {
      const { call } = caller();
      await expect(drive(call, door, VALID[door])).resolves.toBeDefined();
      calls.length = 0;
      await expect(drive(call, door, { ...VALID[door], userId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(calls).toHaveLength(0);
    });
  }
});

describe("the name, the ids and the batch are bounded", () => {
  it("a name is trimmed, and blank or over-long is refused", async () => {
    const { call } = caller();
    await call.createCampaign({ name: "   Summer   " });
    expect(calls[0].args[1]).toBe("Summer");
    await expect(call.createCampaign({ name: "    " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.createCampaign({ name: "x".repeat(CAMPAIGN_NAME_MAX_LENGTH) })).resolves.toBeDefined();
    await expect(call.createCampaign({ name: "x".repeat(CAMPAIGN_NAME_MAX_LENGTH + 1) }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("an add names at least one cast and at most a page of them", async () => {
    const { call } = caller();
    const many = (n: number) => Array.from({ length: n }, (_, i) => `KI-${i}`);
    await expect(call.addCastsToCampaign({ campaignId: CAMPAIGN, castIds: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.addCastsToCampaign({ campaignId: CAMPAIGN, castIds: many(CAMPAIGN_CASTS_PER_CALL_MAX) })).resolves.toBeDefined();
    await expect(call.addCastsToCampaign({ campaignId: CAMPAIGN, castIds: many(CAMPAIGN_CASTS_PER_CALL_MAX + 1) }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.deleteCampaign({ campaignId: "x".repeat(33) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("each store outcome becomes its refusal", () => {
  it("a campaign that is not the caller's is NOT_FOUND on every door that names one", async () => {
    const notFound = {
      renameCampaign: { kind: "not_found" },
      deleteCampaign: { kind: "not_found" },
      addCastsToCampaign: { kind: "campaign_not_found" },
      removeCastsFromCampaign: { kind: "campaign_not_found" },
    } as const;
    for (const door of Object.keys(notFound) as Array<keyof typeof notFound>) {
      const { call } = caller();
      outcome.next = notFound[door];
      await expect(drive(call, door, VALID[door])).rejects.toMatchObject({ code: "NOT_FOUND", message: "Campaign not found" });
    }
  });

  it("a cast that is not the caller's signed cast is NOT_FOUND and files nothing", async () => {
    const { call } = caller();
    outcome.next = { kind: "cast_not_found" };
    await expect(call.addCastsToCampaign(VALID.addCastsToCampaign)).rejects.toMatchObject({ code: "NOT_FOUND", message: "Cast not found" });
  });

  it("a name the customer already uses is CONFLICT, on create and on rename", async () => {
    const { call } = caller();
    outcome.next = { kind: "name_taken" };
    await expect(call.createCampaign({ name: "Summer" })).rejects.toMatchObject({ code: "CONFLICT" });
    outcome.next = { kind: "name_taken" };
    await expect(call.renameCampaign(VALID.renameCampaign)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("the answers carry public ids and counts only", async () => {
    const { call } = caller();
    expect(await call.listCampaigns({})).toEqual([{ campaignId: "c".repeat(32), name: "Summer", castCount: 2 }]);
    expect(await call.createCampaign({ name: "Summer" })).toEqual({ campaignId: "c".repeat(32), name: "Summer", castCount: 0 });
    expect(await call.renameCampaign(VALID.renameCampaign)).toEqual({ campaignId: CAMPAIGN, name: "Autumn" });
    expect(await call.deleteCampaign(VALID.deleteCampaign)).toEqual({ campaignId: CAMPAIGN });
    expect(await call.addCastsToCampaign(VALID.addCastsToCampaign)).toEqual({ campaignId: CAMPAIGN, added: 2 });
    expect(await call.removeCastsFromCampaign(VALID.removeCastsFromCampaign)).toEqual({ campaignId: CAMPAIGN, removed: 1 });
  });
});

describe("outside casting the doors are shut", () => {
  it("every door refuses before the store is asked, and opens again with the scope", async () => {
    const previous = process.env.CASTING_V2_SCOPE;
    try {
      process.env.CASTING_V2_SCOPE = "off";
      for (const door of DOORS) {
        const { call } = caller();
        await expect(drive(call, door, VALID[door])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      }
      expect(calls).toHaveLength(0);
    } finally {
      process.env.CASTING_V2_SCOPE = previous;
    }
    const { call } = caller();
    await expect(call.listCampaigns({})).resolves.toBeDefined();
  });
});

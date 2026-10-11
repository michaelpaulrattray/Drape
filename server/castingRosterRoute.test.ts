/**
 * THE ROSTER'S SCOPE, SEARCH AND PAGES, DRIVEN THROUGH THE REAL ROUTER (card
 * #2250, rung N2c).
 *
 * The store is doubled here so these arms run on every `pnpm test` without a
 * database; what the STATEMENTS return — owner isolation, Unfiled's
 * `NOT EXISTS`, a cast in two campaigns, the sixty-first cast — is proven on a
 * real one in `server/castingRoster-db.test.ts`. What only this file can show:
 *
 *  - the owner handed to the store is the SESSION's (invariant 3), and an
 *    input naming a `userId` is refused before the store is asked;
 *  - both inputs are `.strict()` (invariant 4), each refusal read beside a
 *    valid input that passes, so a rejection cannot be a broken caller;
 *  - ⚠ `{}` — what every bundle before this deploy sends — still gets a BARE
 *    ARRAY of casts, so an open tab keeps working through the deploy;
 *  - the infinite query's own `direction` key is accepted rather than refused;
 *  - each store refusal becomes `NOT_FOUND`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const calls = vi.hoisted(() => [] as Array<{ fn: string; args: unknown[] }>);
const outcome = vi.hoisted(() => ({ page: null as unknown, counts: null as unknown }));

const MODEL = vi.hoisted(() => ({
  id: 41,
  agencyId: "KI-AAAA-BBBB-CCCC-DDDD",
  name: "Ines",
  status: "active",
  technicalSchema: {},
  mintedAt: new Date("2026-10-01T00:00:00Z"),
}));

vi.mock("./db/castingV2Sign", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/castingV2Sign")>();
  return {
    ...actual,
    listRosterPage: async (...args: unknown[]) => {
      calls.push({ fn: "listRosterPage", args });
      const value = outcome.page ?? {
        kind: "page",
        casts: [{ model: MODEL, anchorUrl: null, frameCount: 5, brief: "a brief" }],
      };
      outcome.page = null;
      return value;
    },
    countRoster: async (...args: unknown[]) => {
      calls.push({ fn: "countRoster", args });
      const value = outcome.counts ?? { kind: "counted", counts: { all: 3, unfiled: 2, matching: 1 } };
      outcome.counts = null;
      return value;
    },
  };
});

process.env.CASTING_V2_SCOPE = "all";

const { castingV2Router } = await import("./routes/castingV2");
const { ROSTER_PAGE_MAX, ROSTER_SEARCH_MAX_LENGTH } = await import("./db/castingV2Sign");
const { CAMPAIGN_NAME_MAX_LENGTH } = await import("./db/castCampaigns");
const clientChips = await import("../client/src/features/castingV2/rosterChips");

let nextUser = 7_320_000;
const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });
/* A fresh account per caller, because the rate limiter's store is real and module-level. */
function caller() {
  const id = (nextUser += 1);
  return { id, call: castingV2Router.createCaller({ user: customer(id) } as never) };
}

const CAMPAIGN = "a".repeat(32);

beforeEach(() => {
  calls.length = 0;
  outcome.page = null;
  outcome.counts = null;
});

describe("roster — what an older bundle sends still works", () => {
  it("⚠ `{}` returns a BARE ARRAY of casts, scoped to all, from the session's owner", async () => {
    const { id, call } = caller();
    const result = await call.roster({});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      expect.objectContaining({ castId: MODEL.agencyId, name: "Ines", frameCount: 5, brief: "a brief", status: "ready" }),
    ]);
    expect(calls).toEqual([{
      fn: "listRosterPage",
      args: [id, { scope: { kind: "all" }, search: undefined, afterCastId: null, limit: undefined }],
    }]);
  });
});

describe("roster — scope, search and pages reach the store as asked", () => {
  it("unfiled, a campaign, a trimmed search, a cursor and a limit", async () => {
    const { id, call } = caller();
    await call.roster({ scope: "unfiled" });
    await call.roster({
      scope: "campaign",
      campaignId: CAMPAIGN,
      search: "  ines  ",
      cursor: MODEL.agencyId,
      limit: 30,
      direction: "forward",
    });
    expect(calls.map((entry) => entry.args)).toEqual([
      [id, { scope: { kind: "unfiled" }, search: undefined, afterCastId: null, limit: undefined }],
      [id, { scope: { kind: "campaign", campaignId: CAMPAIGN }, search: "ines", afterCastId: MODEL.agencyId, limit: 30 }],
    ]);
  });

  it("refuses a campaign scope that names no campaign, rather than reading it as all", async () => {
    const { call } = caller();
    await expect(call.roster({ scope: "campaign" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.rosterCounts({ scope: "campaign" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toEqual([]);
  });

  it("bounds: search up to its width, limit 1..page max", async () => {
    const { call } = caller();
    await expect(call.roster({ search: "x".repeat(ROSTER_SEARCH_MAX_LENGTH) })).resolves.toBeTruthy();
    await expect(call.roster({ search: "x".repeat(ROSTER_SEARCH_MAX_LENGTH + 1) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.roster({ limit: ROSTER_PAGE_MAX })).resolves.toBeTruthy();
    await expect(call.roster({ limit: ROSTER_PAGE_MAX + 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.roster({ limit: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("a campaign that is not the customer's, and a cursor that is not, are NOT_FOUND", async () => {
    const { call } = caller();
    outcome.page = { kind: "campaign_not_found" };
    await expect(call.roster({ scope: "campaign", campaignId: CAMPAIGN }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Campaign not found" });
    outcome.page = { kind: "cursor_not_found" };
    await expect(call.roster({ cursor: "KI-NOT-THEIRS" }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Cast not found" });
    outcome.counts = { kind: "campaign_not_found" };
    await expect(call.rosterCounts({ scope: "campaign", campaignId: CAMPAIGN }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Campaign not found" });
  });
});

describe("⚠ invariants 3 and 4 — the owner is the session's, and both inputs are strict", () => {
  for (const door of ["roster", "rosterCounts"] as const) {
    it(`${door}: refuses an undeclared key (a userId) before the store is asked; the same input without it passes`, async () => {
      const { call } = caller();
      const drive = (input: unknown) => (call[door] as (input: unknown) => Promise<unknown>)(input);
      await expect(drive({ scope: "all", userId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(calls).toEqual([]);
      await expect(drive({ scope: "all" })).resolves.toBeTruthy();
      expect(calls).toHaveLength(1);
    });
  }

  it("rosterCounts hands the store the session's id and returns the three numbers", async () => {
    const { id, call } = caller();
    await expect(call.rosterCounts({ scope: "unfiled", search: " a " })).resolves.toEqual({ all: 3, unfiled: 2, matching: 1 });
    expect(calls).toEqual([{ fn: "countRoster", args: [id, { scope: { kind: "unfiled" }, search: "a" }] }]);
  });
});

describe("the doors are shut outside casting", () => {
  it("PRECONDITION_FAILED for an account the scope does not name, before the store is asked", async () => {
    const before = process.env.CASTING_V2_SCOPE;
    process.env.CASTING_V2_SCOPE = "off";
    try {
      const { call } = caller();
      await expect(call.roster({})).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(call.rosterCounts({})).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(calls).toEqual([]);
    } finally {
      process.env.CASTING_V2_SCOPE = before;
    }
    /* And open again: the refusal was the scope, not the caller. */
    await expect(caller().call.roster({})).resolves.toBeTruthy();
  });
});

describe("the client's copies of the server's numbers agree with the server", () => {
  it("page size", () => {
    expect(clientChips.ROSTER_PAGE_SIZE).toBeLessThanOrEqual(ROSTER_PAGE_MAX);
  });

  it("the campaign-name cap is written down ONCE, so there is nothing to compare", async () => {
    /*
      ⚠ **THIS ARM USED TO COMPARE TWO NUMBERS AND NOW PROVES THERE IS ONE
      (#2277).** `rosterChips.ts` hand-typed `64` beside a docblock saying the
      server had its own, and this arm asserted the two were equal — working
      law 4 with an alarm bolted on, which tells you WHEN they disagree where
      one declaration tells you they cannot. The client now RE-EXPORTS
      `shared/inputLimits.ts`, which `server/db/castCampaigns.ts` re-exports
      too, so the old equality arm had become the shared constant compared to
      itself down two paths: green whatever happens, which is worse than absent.

      What is asserted instead is the single declaration, read at the bytes:
      the literal lives in `shared/inputLimits.ts` and nowhere else that this
      cap is spoken of. `server/clientInputCaps.test.ts` already holds the
      other half — that every export there keeps an importer on both sides.
    */
    const { readFile } = await import("node:fs/promises");
    const [shared, chips, store] = await Promise.all([
      readFile(new URL("../shared/inputLimits.ts", import.meta.url), "utf8"),
      readFile(new URL("../client/src/features/castingV2/rosterChips.ts", import.meta.url), "utf8"),
      readFile(new URL("./db/castCampaigns.ts", import.meta.url), "utf8"),
    ]);
    const declaresLiteral = (source: string) =>
      /export const CAMPAIGN_NAME_MAX_LENGTH\s*=\s*\d+/.test(source);
    /* The positive control: the one place it IS declared. */
    expect(declaresLiteral(shared), "the cap left shared/inputLimits.ts — point this arm at its new home").toBe(true);
    expect(declaresLiteral(chips), "rosterChips.ts has typed the cap again — re-export it instead").toBe(false);
    expect(declaresLiteral(store), "castCampaigns.ts has typed the cap again — re-export it instead").toBe(false);
    /*
      And `rosterChips.ts` does not mention the cap in CODE at all any more:
      both fields import the shared constant, so even a re-export here would be
      an export nothing in the product reads.

      ⚠ Prose is stripped, and that is not a convenience: this file's docblock
      names the constant on purpose, as the record of what went wrong. An
      unstripped read reddens on its own repair — the same trap
      `server/clientInputCaps.test.ts` was already written around.
    */
    const code = chips.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(chips, "the record of the repair left rosterChips.ts").toContain("CAMPAIGN_NAME_MAX_LENGTH");
    expect(code).not.toContain("CAMPAIGN_NAME_MAX_LENGTH");
    expect(CAMPAIGN_NAME_MAX_LENGTH).toBe(64);
  });

  it("the client's filter for each chip is an input the roster accepts", async () => {
    const { call } = caller();
    for (const chip of [{ kind: "all" }, { kind: "unfiled" }, { kind: "campaign", campaignId: CAMPAIGN }] as const) {
      await expect(call.roster({ ...clientChips.rosterFilterInput(chip, " ines "), limit: clientChips.ROSTER_PAGE_SIZE })).resolves.toBeTruthy();
      await expect(call.rosterCounts(clientChips.rosterFilterInput(chip, ""))).resolves.toBeTruthy();
    }
  });
});

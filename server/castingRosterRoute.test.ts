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
import { clientSources as clientTreeSources } from "./testing/sourceTree";
import { withoutComments } from "./testing/withoutComments";

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
const sharedLimits = await import("../shared/inputLimits");

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

/*
  ONE NAME CAP, NOT TWO (card #2277). The library kept its own
  `CAMPAIGN_NAME_MAX_LENGTH = 64` in `rosterChips.ts` while `shared/inputLimits.ts`
  held the shared one, and this file's arm compared the two — a mirror kept
  honest by a test, which is still a mirror (working law 4).
  `clientInputCaps.test.ts` could not see it: it sweeps `maxLength={64}`, and the
  copy wore a constant's name. The class is a client module DECLARING a number
  `shared/inputLimits.ts` owns, so the names are read off that module's exports
  and every client source is swept for a declaration of any of them.
*/
/*
  ⚠ **THE WALK IS `testing/sourceTree.ts`'S NOW (#2289)** — it was one of
  twenty private copies, each with its own path derivation. `tests: "exclude"`
  is this suite's own population: a suite DECLARING one of the shared names is
  a fixture, not a second copy of a cap.
*/
function clientSources(): Array<{ file: string; source: string }> {
  return clientTreeSources({ tests: "exclude" })
    .map((file) => ({ file: file.relative, source: file.source }));
}

/** The shared names this source declares its own binding for. Prose does not count. */
function ownCopiesOf(names: readonly string[], source: string): string[] {
  const code = withoutComments(source);
  return names.filter((name) => new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(code));
}

/** The shared names this source uses without importing them from `shared/inputLimits`. */
function usedWithoutTheSharedImport(names: readonly string[], source: string): string[] {
  const code = withoutComments(source);
  const imported = new Set<string>();
  for (const hit of code.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'][^"']*shared\/inputLimits["']/g)) {
    for (const part of hit[1].split(",")) imported.add(part.trim().split(/\s+as\s+/)[0]);
  }
  return names.filter((name) => new RegExp(`\\b${name}\\b`).test(code) && !imported.has(name));
}

describe("one campaign-name cap, imported everywhere from shared/inputLimits (card #2277)", () => {
  it("the shared cap is the server's, and it is still 64", () => {
    expect(sharedLimits.CAMPAIGN_NAME_MAX_LENGTH).toBe(CAMPAIGN_NAME_MAX_LENGTH);
    expect(CAMPAIGN_NAME_MAX_LENGTH).toBe(64);
    expect("CAMPAIGN_NAME_MAX_LENGTH" in clientChips).toBe(false);
  });

  it("the reader can fail: a declared copy is caught, an import or a comment is not", () => {
    const names = ["CAMPAIGN_NAME_MAX_LENGTH"];
    expect(ownCopiesOf(names, "export const CAMPAIGN_NAME_MAX_LENGTH = 64;")).toEqual(names);
    expect(ownCopiesOf(names, "const CAMPAIGN_NAME_MAX_LENGTH=64")).toEqual(names);
    expect(ownCopiesOf(names, 'import { CAMPAIGN_NAME_MAX_LENGTH } from "@shared/inputLimits";')).toEqual([]);
    expect(ownCopiesOf(names, "/* was: export const CAMPAIGN_NAME_MAX_LENGTH = 64; */")).toEqual([]);
    expect(usedWithoutTheSharedImport(names, 'import { CAMPAIGN_NAME_MAX_LENGTH } from "@/features/castingV2/rosterChips";\nx(CAMPAIGN_NAME_MAX_LENGTH);'))
      .toEqual(names);
    expect(usedWithoutTheSharedImport(names, 'import { A, CAMPAIGN_NAME_MAX_LENGTH } from "@shared/inputLimits";\nx(CAMPAIGN_NAME_MAX_LENGTH);'))
      .toEqual([]);
  });

  it("no client source declares its own copy of a number shared/inputLimits owns, and every user imports it from there", () => {
    const names = Object.keys(sharedLimits);
    expect(names).toContain("CAMPAIGN_NAME_MAX_LENGTH");
    const sources = clientSources();
    /* The population is real: both campaign-name fields are in it. */
    const users = sources.filter(({ source }) => /\bCAMPAIGN_NAME_MAX_LENGTH\b/.test(withoutComments(source))).map(({ file }) => file);
    expect(users).toEqual(expect.arrayContaining([
      "features/castingV2/components/NewCampaignDialog.tsx",
      "features/castingV2/components/CastCampaignsCard.tsx",
    ]));
    const copies = sources.flatMap(({ file, source }) => ownCopiesOf(names, source).map((name) => `${file} declares ${name}`));
    const strays = sources.flatMap(({ file, source }) => usedWithoutTheSharedImport(names, source).map((name) => `${file} uses ${name}`));
    expect(copies).toEqual([]);
    expect(strays).toEqual([]);
  });
});

describe("the client's copies of the server's numbers agree with the server", () => {
  it("page size", () => {
    expect(clientChips.ROSTER_PAGE_SIZE).toBeLessThanOrEqual(ROSTER_PAGE_MAX);
  });

  it("the client's filter for each chip is an input the roster accepts", async () => {
    const { call } = caller();
    for (const chip of [{ kind: "all" }, { kind: "unfiled" }, { kind: "campaign", campaignId: CAMPAIGN }] as const) {
      await expect(call.roster({ ...clientChips.rosterFilterInput(chip, " ines "), limit: clientChips.ROSTER_PAGE_SIZE })).resolves.toBeTruthy();
      await expect(call.rosterCounts(clientChips.rosterFilterInput(chip, ""))).resolves.toBeTruthy();
    }
  });
});

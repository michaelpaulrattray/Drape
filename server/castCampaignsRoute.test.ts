/**
 * THE SEVEN CAMPAIGN DOORS, DRIVEN THROUGH THE REAL ROUTER (card #2249).
 *
 * The store is doubled here so these arms run on every `pnpm test`, without a
 * database; what the STATEMENTS do with ownership is proven against a real one
 * in `server/castCampaigns-db.test.ts`. What only this file can show:
 *
 *  - the owner handed to the store is the SESSION's, never anything in the
 *    input (invariant 3) — an input naming a `userId` is refused outright;
 *  - every one of the seven inputs is `.strict()` (invariant 4), proven by
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
    listCastCampaigns: record("listCastCampaigns", [{ campaignId: "c".repeat(32), name: "Summer" }]),
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
  listCastCampaigns: { castId: CAST },
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
    expect(await call.listCastCampaigns(VALID.listCastCampaigns)).toEqual([{ campaignId: "c".repeat(32), name: "Summer" }]);
  });

  it("the cast page's read hands the store the cast it named, and refuses a missing or over-long id", async () => {
    const { call } = caller();
    await call.listCastCampaigns({ castId: CAST });
    expect(calls[0].args[1]).toBe(CAST);
    await expect(call.listCastCampaigns({ castId: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.listCastCampaigns({ castId: "K".repeat(33) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call.listCastCampaigns({} as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

/* ------------------------- #2277 · the doors are LIVE, and the comment says so */

describe("every campaign door is on a customer path, and the router's own comment agrees", () => {
  /*
    ⚠ **WHY THIS EXISTS: THE COMMENT ABOVE THESE DOORS SAID THEY HAD NO CLIENT
    CALLER FOR TWELVE DAYS AFTER THEY GOT ONE** (#2277, found by the relay's
    milestone-close review of N2c). It was written the morning #2249 merged,
    when it was true, and the rung's other four cards shipped the same
    afternoon. Two more documents said the same thing. A sentence about whether
    a surface is dark governs how carefully the next change to it is reviewed,
    so it rotting is not cosmetic.

    So the fact is DERIVED at both ends rather than written down twice:

      the doors    the real router's own procedure ids, filtered on the name —
                   a door added or renamed joins this population by itself.
      the callers  a prose-stripped read of every `.ts`/`.tsx` under
                   `client/src`, test files excluded.

    ⚠ **THE STRIPPER IS LOAD-BEARING AND NOT A TIDINESS.** `rosterChips.ts`'s
    own docblock names `castingV2.renameCampaign` in prose, so an unstripped
    read would have called that door live on the strength of a comment ABOUT
    it — which is precisely the mistake this arm is about, one layer down.

    It runs on this suite's existing 30 s clock rather than asking for the tree
    sweep's 60 s: it reads each file once (`clientInputCaps.test.ts`, the
    measured casualty, reads them several times over), and that whole sweep ran
    785 ms quiet and 5,016 ms at its worst under load.
  */
  const CLIENT_SRC = new URL("../client/src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

  /** A comment about a call is not a call. */
  const withoutProse = (source: string): string => source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  async function everyClientSource(dir: string): Promise<string[]> {
    const { readdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const entries = await readdir(dir, { withFileTypes: true });
    const found: string[] = [];
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...(await everyClientSource(path)));
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
    }
    return found;
  }

  let code = "";
  let fileCount = 0;
  let rosterChips = "";

  beforeEach(async () => {
    if (code) return;
    const { readFile } = await import("node:fs/promises");
    const files = await everyClientSource(CLIENT_SRC);
    fileCount = files.length;
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    code = sources.map(withoutProse).join("\n");
    rosterChips = sources[files.findIndex((file) => file.endsWith("rosterChips.ts"))] ?? "";
  });

  /** The doors, read off the real router rather than listed here. */
  function campaignDoors(): string[] {
    const procedures = (castingV2Router as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures;
    return Object.keys(procedures).filter((id) => /[Cc]ampaign/.test(id));
  }

  it("the instrument before its finding: the sweep reads the client, and the router has doors", async () => {
    /* A sweep that reads nothing passes every assertion below it. */
    expect(fileCount, "the sweep found almost nothing — check the path").toBeGreaterThan(300);
    expect(code).toContain("trpc.castingV2.");
    /* And the door population is not empty either, which is the other way this
       could pass while proving nothing. */
    expect(campaignDoors()).toHaveLength(DOORS.length);
    expect(campaignDoors().sort()).toEqual([...DOORS].sort());
  });

  it("NOT ONE of them is dark", async () => {
    const dark = campaignDoors().filter((door) => !code.includes(`trpc.castingV2.${door}`));
    expect(
      dark,
      "a campaign door has no client caller. If that is deliberate, say so in the "
        + "router's comment and here — do NOT leave the comment claiming the opposite:\n  "
        + dark.join("\n  "),
    ).toEqual([]);
  });

  it("a door that does not exist has no caller — the negative control", async () => {
    expect(code).not.toContain("trpc.castingV2.archiveCampaign");
  });

  it("a door named only in PROSE is not a caller — the control the stripper needs", async () => {
    /*
      The real specimen, not a fixture: `rosterChips.ts` names
      `castingV2.renameCampaign` in a docblock. Unstripped it reads as a call;
      stripped it does not. If this ever stops holding because that docblock
      was reworded, point it at whichever file then carries the shape — the
      stripper is what must stay proven, never this sentence.
    */
    expect(rosterChips, "rosterChips.ts was not read — the fixture moved").toContain("renameCampaign");
    expect(rosterChips).toContain("`castingV2.renameCampaign`");
    expect(withoutProse(rosterChips)).not.toContain("castingV2.renameCampaign");
    /*
      ⚠ AND THE READER ABOVE ACTUALLY APPLIES IT, which the two lines before
      this do NOT show: they drive `withoutProse` directly, so dropping it from
      the sweep left every arm here green — measured by sabotage, not supposed.
      The backticked form only ever occurs in prose, so its absence from the
      swept text is the proof that the sweep was stripped.
    */
    expect(code).not.toContain("`castingV2.renameCampaign`");
  });

  it("the router's comment names exactly the doors that exist", async () => {
    /*
      The comment carries a table of door → surface. A door missing from it, or
      a name in it that is no longer a door, is the rot this card repaired —
      caught here instead of by the next reader.
    */
    const { readFile } = await import("node:fs/promises");
    const router = await readFile(new URL("./routes/castingV2.ts", import.meta.url), "utf8");
    const start = router.indexOf("CAMPAIGNS — rung N2c");
    expect(start, "the campaigns comment moved or was reworded").toBeGreaterThan(-1);
    const table = router.slice(start, router.indexOf("His word, 2026-09-29", start));
    for (const door of campaignDoors()) expect(table).toContain(door);
    /* And it no longer claims the opposite of what the arms above measured. */
    expect(table).toContain("ALL SEVEN DOORS ARE ON A CUSTOMER PATH");
  });
});

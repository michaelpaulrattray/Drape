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
 *  - and, since #2285, that the COMMENT above them in the router still says
 *    what the tree says: who calls each door, derived at every end.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { sourceBand } from "./testing/sourceBand";
import { withoutComments } from "./testing/withoutComments";

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

/* ---- #2285 — the comment above these doors is held equal to the tree ---- */

describe("the campaigns comment cannot outlive the tree (#2285)", () => {
  /*
    ⚠ **WHY THIS EXISTS: THE COMMENT ABOVE THESE DOORS CALLED THEM DARK FOR
    TWELVE DAYS AFTER THEY WENT LIVE.** It read *"Built dark: nothing in the
    client calls these yet"* — written the morning #2249 merged, true for that
    one morning, and still there when the relay's milestone-close review of N2c
    found it by hand (#2277). Two other documents said the same thing. #2277
    repaired all three sentences; this is the half that stops a fourth —
    working law 7, fix the class and not the instance.

    Every end is DERIVED, so no side of it is a list anyone maintains:

      the doors    this router's own procedure ids, filtered on the name, so a
                   door added or renamed joins the population by itself. The
                   suite's own `DOORS` is held equal to that, so the hand list
                   every other arm in this file drives cannot drift either.
      the callers  a prose-stripped read of every `.ts`/`.tsx` under
                   `client/src`, test files excluded — 437 of them, measured.
      the claim    the comment's own one-line-per-door list, read between two
                   anchors by `sourceBand`, which THROWS when an anchor moves
                   rather than answering with an empty band that would turn
                   every arm below it green.

    ⚠ **THE STRIPPER IS LOAD-BEARING AND NOT TIDINESS.** `rosterChips.ts`'s own
    docblock names `castingV2.renameCampaign` in prose, so an unstripped read
    calls that door live on the strength of a comment ABOUT it — this card's
    own mistake, one layer down. It is the house `withoutComments` rather than
    a private regex: #1623 found four copies of that idea which disagreed about
    string literals, and the real population was 35.

    ⚠ **AND THE CONTROL OVER IT WATCHES THE SWEEP'S USE OF IT, NOT THE
    FUNCTION.** Two arms driving `withoutComments` directly stay green when the
    sweep stops calling it — measured on PR #2284, where exactly that happened.
    What catches it is the backticked form, which only ever occurs in prose,
    being absent from the swept text.

    The directory walk is local rather than promoted, and that costs something
    this says out loud: four private copies of it already exist, in
    `server/clientInputCaps.test.ts`, `server/queryStringReads.test.ts`,
    `server/castingRosterRoute.test.ts` and
    `server/castingV2/authorRoadFlagRetired.test.ts`, and this is a fifth.
    `server/testing/sourceSweepSuites.ts` derives which suites must declare the
    30 s clock from a test file's OWN import and call of `readListedSource`, so
    a walk moved behind a helper would leave this suite invisible to that guard
    — promoting it needs that population widened in the same act (memory
    `directory-population-loses-promoted-subject`), which is a pass of its own
    and is filed as #2286 rather than smuggled in here.
  */
  const CLIENT_SRC = fileURLToPath(new URL("../client/src/", import.meta.url));
  const ROUTER = fileURLToPath(new URL("./routes/castingV2.ts", import.meta.url));
  const posix = (path: string) => path.split(String.fromCharCode(92)).join("/");

  type ClientSource = { file: string; source: string; code: string };
  let swept: ClientSource[] | null = null;

  /** Every client source, read once a run: the bytes as written, and the code. */
  function clientSources(): ClientSource[] {
    if (swept) return swept;
    const found: ClientSource[] = [];
    for (const entry of readdirSync(CLIENT_SRC, { recursive: true, encoding: "utf8" })) {
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
      const source = readListedSource(join(CLIENT_SRC, entry));
      if (source === null) continue;
      found.push({ file: posix(entry), source, code: withoutComments(source) });
    }
    swept = found;
    return found;
  }

  const sweptCode = () => clientSources().map(({ code }) => code).join("\n");

  /** The doors, read off the real router rather than listed here. */
  function campaignDoors(): string[] {
    const procedures = (castingV2Router as unknown as {
      _def: { procedures: Record<string, unknown> };
    })._def.procedures;
    return Object.keys(procedures).filter((id) => /[Cc]ampaign/.test(id)).sort();
  }

  /** The files whose CODE calls a door, by basename. */
  function callersOf(door: string): string[] {
    return clientSources()
      .filter(({ code }) => code.includes(`trpc.castingV2.${door}`))
      .map(({ file }) => file.split("/").pop() as string)
      .sort();
  }

  /** The comment's list: each door to the text of its own line. */
  function commentLines(): Map<string, string> {
    const band = sourceBand(
      readFileSync(ROUTER, "utf8"),
      "EVERY DOOR AND WHAT CALLS IT",
      "His word, 2026-09-29",
      "the campaigns door list",
    );
    const lines = new Map<string, string>();
    for (const line of band.split("\n")) {
      const row = /^ {6}(\w+) {2,}(\S.*)$/.exec(line);
      if (row) lines.set(row[1]!, row[2]!);
    }
    return lines;
  }

  it("the instrument before its finding: the sweep read the client, and both other ends are populated", () => {
    expect(clientSources().length, "the sweep found almost nothing — check the path").toBeGreaterThan(300);
    expect(sweptCode()).toContain("trpc.castingV2.");
    expect(campaignDoors().length).toBeGreaterThan(0);
    expect(commentLines().size).toBeGreaterThan(0);
  });

  it("the suite's own door list is the router's", () => {
    expect(campaignDoors()).toEqual([...DOORS].sort());
  });

  it("a door that does not exist has no caller — the negative control", () => {
    expect(callersOf("archiveCampaign")).toEqual([]);
  });

  it("a door named only in PROSE is not a caller — the control the stripper needs", () => {
    const specimen = clientSources().find(({ file }) => file.endsWith("features/castingV2/rosterChips.ts"));
    expect(specimen, "rosterChips.ts was not read — the specimen moved").toBeDefined();
    expect(specimen!.source).toContain("`castingV2.renameCampaign`");
    expect(specimen!.code).not.toContain("castingV2.renameCampaign");
    /*
      AND THE SWEEP ITSELF APPLIED IT, which the two lines above do NOT show:
      they read one file's stripped text, so dropping the stripper from the
      sweep would leave them green. The backticked form only ever occurs in
      prose, so its absence from the swept code is the proof.
    */
    expect(sweptCode()).not.toContain("`castingV2.renameCampaign`");
    expect(callersOf("renameCampaign")).not.toContain("rosterChips.ts");
  });

  it("the comment names exactly the doors the router declares", () => {
    expect([...commentLines().keys()].sort()).toEqual(campaignDoors());
  });

  it("every line names the files that call its door, and says dark only where nothing does", () => {
    /*
      Basenames, so the comment stays readable — and they are proven unique
      across the callers first, because an ambiguous comparison is a green one.
    */
    const paths = clientSources()
      .filter(({ code }) => campaignDoors().some((door) => code.includes(`trpc.castingV2.${door}`)))
      .map(({ file }) => file);
    const names = paths.map((file) => file.split("/").pop() as string);
    expect(new Set(names).size, `two campaign callers share a basename: ${paths.join(", ")}`).toBe(names.length);

    for (const [door, line] of commentLines()) {
      const named = [...line.matchAll(/\b[A-Za-z0-9]+\.tsx?\b/g)].map((hit) => hit[0]).sort();
      const measured = callersOf(door);
      expect(
        named,
        `${door}: the comment names ${named.join(", ") || "no file"} and the client calls it from `
          + `${measured.join(", ") || "nowhere"}. Name the file, or write the word dark when there is none.`,
      ).toEqual(measured);
      expect(
        /\bdark\b/i.test(line),
        `${door}: the comment calls it dark while something calls it, or names a caller while nothing does`,
      ).toBe(measured.length === 0);
    }
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

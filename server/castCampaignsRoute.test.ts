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
 *  - and, since #2285, that the COMMENT above them in the router still agrees
 *    with the tree about who reaches each door — ⚠ which since #2286 it does by
 *    CITING the Atlas's `clientCallers` rather than by naming callers itself,
 *    so what is held here is the pointer and not a mirror. The comparison
 *    itself, and the sweep of `client/src` it needs, moved to
 *    `server/architectureClientCallers.test.ts`, which is the artifact's
 *    second reader.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { sourceBand } from "./testing/sourceBand";

/* ⚠ NO `CONTENDED_TEST_TIMEOUT_MS` HERE ANY MORE, AND THAT IS DERIVED RATHER
   THAN A CHOICE: `sourceSweepSuites` puts a suite in the 30 s-clock population
   from its OWN import and call of `readListedSource`, and #2286 took the
   directory sweep out of this file. The clock came out in the same act. Make
   this suite read the tree again and that guard will ask for it back. */

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
    await expect(call.addCastsToCampaign(VALID.addCastsToCampaign)).rejects.toMatchObject({ code: "NOT_FOUND", message: "That character isn't here." });
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

/* ---- #2285/#2286 — the comment above these doors cites a derived fact ---- */

describe("the campaigns comment cannot outlive the tree (#2285, derived by #2286)", () => {
  /*
    ⚠ **WHY THIS EXISTS: THE COMMENT ABOVE THESE DOORS CALLED THEM DARK FOR
    TWELVE DAYS AFTER THEY WENT LIVE.** It read *"Built dark: nothing in the
    client calls these yet"* — written the morning #2249 merged, true for that
    one morning, and still there when the relay's milestone-close review of N2c
    found it by hand (#2277). Two other documents said the same thing.

    #2285 repaired it by holding a hand-written line-per-door list equal to the
    tree at both ends — the doors off this router's own procedures, the callers
    off a prose-stripped sweep of `client/src`. ⚠ **THAT IS THE SHAPE #2286
    REPLACED, AND ITS OWN BODY SAID WHY: A GUARDED MIRROR IS STILL A MIRROR.**
    Five block comments on this tree were restating whether a surface is
    reachable; guarding each sentence is working law 7's INSTANCE, and five
    bespoke guards is five private sweeps of `client/src`. The class fix is that
    the fact is DERIVED once — `clientCallers`, per procedure, in
    `docs/architecture/drape-architecture.json`, extracted by
    `collectClientCallers` and held fresh by `pnpm architecture:check`.

    **SO WHAT IS LEFT HERE IS THE CITATION, WHICH IS ALL THIS SUITE CAN HONESTLY
    OWN.** The comment no longer names a caller, so there is no list to compare;
    what can still rot is the POINTER — a comment citing a field the artifact
    does not carry, or citing it for doors that are not these doors. Both ends
    are still derived, and nothing here is a list anyone maintains:

      the doors    this router's own procedure ids, filtered on the name, so a
                   door added or renamed joins the population by itself. The
                   suite's own `DOORS` is held equal to that, so the hand list
                   every other arm in this file drives cannot drift either.
      the fact     the Atlas's own rows for those doors.
      the claim    the comment's own text, read between two anchors by
                   `sourceBand`, which THROWS when an anchor moves rather than
                   answering with an empty band that would turn every arm below
                   it green.

    ⚠ **WHAT MOVED OUT OF HERE AND WHERE IT WENT.** The prose-stripper control
    (`rosterChips.ts`'s docblock names `castingV2.renameCampaign` without
    calling it) and the directory sweep are now
    `server/architectureClientCallers.test.ts`'s, which is the artifact's second
    reader and needs them for its own comparison. They are not duplicated here:
    this suite no longer reads `client/src` at all, which also takes it back out
    of `sourceSweepSuites`'s derived population — so if a later change makes it
    sweep the tree again, that guard will ask it for the 30 s clock.
  */
  const ROUTER = fileURLToPath(new URL("./routes/castingV2.ts", import.meta.url));
  const ATLAS = fileURLToPath(
    new URL("../docs/architecture/drape-architecture.json", import.meta.url),
  );

  type Route = { namespace: string; name: string; clientCallers: string[] };

  /** The committed Atlas — the artifact the comment now points at. */
  function routes(): Route[] {
    return (JSON.parse(readFileSync(ATLAS, "utf8")) as { routes: Route[] }).routes;
  }

  /** The doors, read off the real router rather than listed here. */
  function campaignDoors(): string[] {
    const procedures = (castingV2Router as unknown as {
      _def: { procedures: Record<string, unknown> };
    })._def.procedures;
    return Object.keys(procedures).filter((id) => /[Cc]ampaign/.test(id)).sort();
  }

  /** The paragraph that makes the claim, read between two anchors. */
  function claim(): string {
    return sourceBand(
      readFileSync(ROUTER, "utf8"),
      "WHO CALLS THESE DOORS",
      "His word, 2026-09-29",
      "the campaigns citation",
    );
  }

  it("the instrument before its finding: all three ends are populated", () => {
    expect(campaignDoors().length).toBeGreaterThan(0);
    expect(routes().length).toBeGreaterThan(200);
    expect(claim().length).toBeGreaterThan(50);
  });

  it("the suite's own door list is the router's", () => {
    expect(campaignDoors()).toEqual([...DOORS].sort());
  });

  it("the comment cites the field, and the Atlas carries it for every door here", () => {
    /*
      A citation of a field nothing emits is worse than the stale sentence it
      replaced: the stale one was at least an answer. So the pointer is read at
      the comment, and the field is read at the artifact, for THESE doors.
    */
    expect(claim(), "the comment no longer names the Atlas field it points at")
      .toContain("clientCallers");
    expect(claim(), "the comment no longer names the artifact that carries it")
      .toContain("docs/architecture/drape-architecture.json");

    const atlas = routes();
    for (const door of campaignDoors()) {
      const route = atlas.find((row) => row.namespace === "castingV2" && row.name === door);
      expect(route, `the Atlas has no row for castingV2.${door} — regenerate it`).toBeDefined();
      expect(
        Array.isArray(route!.clientCallers),
        `castingV2.${door} carries no clientCallers, so the citation above these doors `
        + "points at nothing. Run `pnpm architecture:generate`.",
      ).toBe(true);
    }
  });

  it("and it names no caller itself, which is the whole point of #2286", () => {
    /*
      The failure this replaces is a CALLER NAMED IN THIS COMMENT: the moment one
      appears it is a measurement again, and nothing re-takes it.

      ⚠ **THE POPULATION IS THE ATLAS'S OWN CALLER BASENAMES, NOT A REGEX FOR
      "A FILENAME".** The first shape of this arm matched `\b\w+\.tsx?\b` and
      reddened on `castCampaignsRoute.test.ts` and
      `architectureClientCallers.test.ts` — the two suite pointers this comment
      legitimately carries — because the word boundary lands inside a dotted
      name and both matched as `test.ts`. An exception list keyed on those two
      names would then have been a list to maintain, and would have let the real
      offender through under any third name. Derived instead: if a caller the
      Atlas records for these doors is written back into the comment, THAT is
      the finding, and the population moves with the product.
    */
    const atlas = routes();
    const basenames = new Set(
      campaignDoors()
        .flatMap((door) =>
          atlas.find((row) => row.namespace === "castingV2" && row.name === door)?.clientCallers
            ?? []
        )
        .map((file) => file.split("/").pop() as string),
    );
    expect(basenames.size, "no campaign door has a caller — this arm is inert").toBeGreaterThan(0);
    const named = [...basenames].filter((name) => claim().includes(name)).sort();
    expect(
      named,
      `the comment names ${named.join(", ")}. A caller named here is a fact nothing re-takes `
      + "— that is what went stale five times. Point at the Atlas instead.",
    ).toEqual([]);
    /* A `.tsx` is never a legitimate citation in this band: no suite, module or
       artifact this comment points at is a component. */
    expect([...claim().matchAll(/[A-Za-z0-9]+\.tsx\b/g)].map((hit) => hit[0])).toEqual([]);
    expect(
      /\bdark\b/i.test(claim()),
      "the comment calls a door dark. Whether a door is reached is the Atlas's answer now.",
    ).toBe(false);
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

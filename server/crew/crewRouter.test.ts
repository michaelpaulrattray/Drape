/**
 * THE CREW ROUTER'S DOORS, DRIVEN THROUGH THE REAL ROUTER (issue #41, design
 * `docs/specs/CREW_TAB_DESIGN.md` §9 arms 2–5).
 *
 * Every arm here goes through `crewRouter.createCaller` with the real
 * `adminProcedure` chain in front — the approvalGate method, because a door
 * proven on a rebuilt copy of itself proves the copy. The database layer alone
 * is doubled (unit tests have no `DATABASE_URL` by design — `vitest.setup.ts`
 * strips it so a unit suite can never touch the live database), and the double
 * answers in the exact projection shape the real store returns, with the
 * insert capturing its arguments so invariant 3 is asserted at the call.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "../_core/context";

const insertCalls: Array<{ cardId: string | null; body: string; authorUserId: number }> = [];

vi.mock("../db/crewReplies", () => ({
  listCrewReplies: vi.fn(async () => [
    {
      id: 7,
      cardId: "rebaseline-countersign",
      body: "countersigned",
      createdAt: new Date("2026-08-25T12:00:00Z"),
      author: "Michael",
    },
  ]),
  insertCrewReply: vi.fn(async (input: { cardId: string | null; body: string; authorUserId: number }) => {
    insertCalls.push(input);
    return {
      id: 8,
      cardId: input.cardId,
      body: input.body,
      createdAt: new Date("2026-08-25T12:01:00Z"),
      author: "Michael",
    };
  }),
}));

import { crewRouter } from "../routes/crew";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function contextFor(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user = {
    id: 1,
    openId: "admin-open-id",
    email: "admin@drape.ai",
    name: "Admin User",
    displayName: null,
    role: "admin",
    approved: true,
    suspendedAt: null,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AuthenticatedUser;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const previousScope = process.env.CREW_TAB_SCOPE;

beforeEach(() => {
  insertCalls.length = 0;
  delete process.env.CREW_TAB_SCOPE;
});

afterEach(() => {
  if (previousScope === undefined) delete process.env.CREW_TAB_SCOPE;
  else process.env.CREW_TAB_SCOPE = previousScope;
});

describe("access — the flag is consulted per call, behind adminProcedure (§9 arm 2)", () => {
  it("flag off → NOT_FOUND for an admin, on both procedures — a dark door does not explain itself", async () => {
    const caller = crewRouter.createCaller(contextFor());
    await expect(caller.getState()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.reply({ cardId: null, body: "hello" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(insertCalls, "a refused reply must never reach the store").toEqual([]);
  });

  it("flag on + non-admin → FORBIDDEN from the admin gate, before the scope is ever consulted", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor({ role: "user", id: 99 }));
    await expect(caller.getState()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.reply({ cardId: null, body: "hello" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("flag on + anonymous → UNAUTHORIZED", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} },
      res: {},
    } as unknown as TrpcContext);
    await expect(caller.getState()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("flag on + admin → the state comes back: briefing plus replies", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    const state = await caller.getState();
    expect(state.briefing.edition).toBeGreaterThanOrEqual(1);
    expect(state.replies).toHaveLength(1);
    expect(state.replies[0]).toMatchObject({ id: 7, author: "Michael" });
  });

  it("users:<ids> admits exactly the named admins — an admin outside the scope gets the dark answer", async () => {
    process.env.CREW_TAB_SCOPE = "users:1";
    await expect(crewRouter.createCaller(contextFor({ id: 1 })).getState()).resolves.toBeTruthy();
    await expect(
      crewRouter.createCaller(contextFor({ id: 2 })).getState(),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("strictness — invariant 4 at the wire (§9 arm 3)", () => {
  /** The zod parser tRPC holds for a procedure, reached without running a handler. */
  function parserOf(name: "reply" | "getState"): { parse: (input: unknown) => unknown } {
    const procedure = (crewRouter as unknown as Record<string, any>)._def.procedures[name];
    if (!procedure) throw new Error(`no procedure named ${name}`);
    const inputs = procedure._def.inputs as Array<{ parse: (input: unknown) => unknown }>;
    if (inputs?.length !== 1) throw new Error(`${name} declares ${inputs?.length ?? 0} input parsers`);
    return inputs[0]!;
  }

  it("⚠ CONTROL — reply still accepts its own declared shapes", () => {
    expect(() => parserOf("reply").parse({ cardId: null, body: "a ruling" })).not.toThrow();
    expect(() => parserOf("reply").parse({ cardId: "some-card", body: "yes" })).not.toThrow();
  });

  it("rejects an undeclared field on reply, parsed through the real router", () => {
    expect(() =>
      parserOf("reply").parse({ cardId: null, body: "x", somethingNobodyDeclared: 1 }),
    ).toThrow();
  });

  it("rejects an empty or whitespace body, and a body past the wire bound", () => {
    expect(() => parserOf("reply").parse({ cardId: null, body: "" })).toThrow();
    expect(() => parserOf("reply").parse({ cardId: null, body: "   " })).toThrow();
    expect(() => parserOf("reply").parse({ cardId: null, body: "x".repeat(4001) })).toThrow();
    expect(() => parserOf("reply").parse({ cardId: "x".repeat(65), body: "y" })).toThrow();
    /* The empty string is neither a card id nor a journal note — null is the
       journal note. A shape no client sends refuses. */
    expect(() => parserOf("reply").parse({ cardId: "", body: "y" })).toThrow();
  });
});

describe("invariant 3 — the author is the session, structurally (§9 arm 4)", () => {
  it("a forged authorUserId is refused at the parser, and the write takes ctx's id", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor({ id: 42 }));

    /* The forge: the strict schema does not declare the field, so this is a
       BAD_REQUEST before any handler runs. */
    await expect(
      caller.reply({ cardId: null, body: "as someone else", authorUserId: 1 } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(insertCalls, "the forged call must never reach the store").toEqual([]);

    /* The honest call: the id the store receives is the SESSION's. */
    const written = await caller.reply({ cardId: "some-card", body: "his words" });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]!.authorUserId).toBe(42);
    expect(written).toMatchObject({ id: 8, cardId: "some-card", body: "his words" });
  });

  it("a reply pointing at a rotated card is NOT refused — his words are never walled", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    await expect(
      caller.reply({ cardId: "a-card-no-briefing-holds", body: "still a ruling" }),
    ).resolves.toMatchObject({ body: "still a ruling" });
  });
});

describe("projection — explicit columns only, by construction (§9 arm 5)", () => {
  /* A source guard, the staffImageBoundary method: the leak this arm is about
     is a COLUMN reaching the wire, and no behavioural test can see a column
     that should not exist. The double above returns the view shape, so the
     real store's SELECT is the thing to read. */
  const source = readFileSync(path.join(__dirname, "..", "db", "crewReplies.ts"), "utf8");
  /* Comments stripped: the store's own header NAMES `passwordHash` as the
     incident it exists to prevent, and a guard that reads the warning as the
     leak cannot tell the two apart. The code half is what selects columns. */
  const store = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("⚠ CONTROL — this really is the reply store, and it resolves the author from names", () => {
    expect(store).toContain("users.displayName");
    expect(store).toContain("users.name");
    /* And the stripper left real code behind — a stripper that ate the file
       would make every absence below pass over nothing. */
    expect(store).toContain("export async function listCrewReplies");
    expect(source).toContain("passwordHash");
  });

  it("every select names its columns — no bare select() across the users join", () => {
    /* A bare `.select()` returns every column of every joined table; with the
       users join in this file that is how `passwordHash` once reached a wire.
       Every select here must open an explicit projection object. */
    for (const hit of store.matchAll(/\.select\((.)/g)) {
      expect(hit[1], "a bare .select() in crewReplies.ts — invariant 8").toBe("{");
    }
    expect([...store.matchAll(/\.select\(/g)].length).toBeGreaterThanOrEqual(2);
  });

  it("no row is spread across the boundary, and no sensitive user column is named", () => {
    expect(store).not.toMatch(/\.\.\.row/);
    for (const forbidden of ["passwordHash", "email", "openId", "accessCode"]) {
      expect(store, `${forbidden} must never appear in the reply store`).not.toContain(forbidden);
    }
  });

  it("the view carries exactly the five declared fields", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    const state = await caller.getState();
    /* Driven at the wire the page reads. The double models the real store's
       view type — `CrewReplyView` — and if the real projection ever widened,
       the typecheck on the double's return value is what reddens; this arm
       pins the runtime shape the client is promised. */
    expect(Object.keys(state.replies[0]!).sort()).toEqual([
      "author",
      "body",
      "cardId",
      "createdAt",
      "id",
    ]);
  });
});

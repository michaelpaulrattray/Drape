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

/* THE LIVE QUEUE IS FAKED HERE (#1193): a unit suite never reaches GitHub.
   One open ordered card and one merged PR are enough for the derived arm
   below; the reader's own behaviour is driven in `liveQueue.test.ts`. */
vi.mock("../crew/liveQueue", () => ({
  readLiveQueue: vi.fn(async () => ({
    available: true,
    stale: false,
    readAt: "2026-09-25T00:00:00Z",
    truncated: false,
    open: [{
      number: 1193, title: "Live Desk", kind: "issue", status: "open", draft: false,
      labels: ["founder-ordered", "urgent"], author: "michaelpaulrattray", assignees: [],
      createdAt: "2026-09-25T00:00:00Z", updatedAt: "2026-09-25T00:00:00Z", closedAt: null, mergedAt: null,
      holdReason: null, url: "https://github.com/michaelpaulrattray/Drape/issues/1193",
    }],
    recent: [{
      number: 1185, title: "slice 3 (#1160)", kind: "pr", status: "merged", draft: false,
      labels: ["needs-fable"], author: "michaelpaulrattray", assignees: [],
      createdAt: "2026-09-24T19:42:18Z", updatedAt: "2026-09-24T23:34:59Z",
      closedAt: "2026-09-24T23:34:59Z", mergedAt: "2026-09-24T23:34:59Z",
      holdReason: null, url: "https://github.com/michaelpaulrattray/Drape/pull/1185",
    }],
  })),
}));

import { crewRouter } from "../routes/crew";
import { eyeFrameKeys, readCrewBriefing } from "./crewBriefing";
import { crewCardNeedsHim } from "../../shared/crewCardState";
import { crewProblemIsOpen } from "../../shared/crewProblemState";
import {
  pipelineNotDone,
  replyFallsToGeneral,
} from "../../client/src/features/admin/components/crew/crewTypes";

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
    /* The empty string is neither a card id nor a general note — null is the
       general note. A shape no client sends refuses. */
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

describe("the wire carries only the rows the page can draw (#1137, #1138)", () => {
  /* The file as it sits on disk, read rather than imported through the parser,
     so "the record is kept" is asserted against the artifact itself. */
  const file = JSON.parse(
    readFileSync(path.join(__dirname, "crew-briefing.json"), "utf8"),
  ) as {
    pipeline: Array<{ id: string; status: string; note: string | null }>;
    needsYou: Array<{ id: string; state: string; title: string; productImpact: string }>;
    eyeItems: Array<{ id: string; state: string; title: string; frames: Array<{ key: string }> }>;
    problems: Array<{ id: string; state: string; detail: string }>;
  };

  it("⚠ CONTROL — the deployed file still HOLDS finished rows, so there is something to drop", () => {
    const merged = file.pipeline.filter((row) => row.status === "merged");
    expect(
      merged.length,
      "no merged rows in the file means this whole suite is asserting nothing",
    ).toBeGreaterThan(0);
    /* The record is the point: neither card is a deletion, and an arm that
       cannot tell a projection from a purge would pass on either. */
    expect(merged.some((row) => (row.note ?? "").length > 0)).toBe(true);

    /* #1138's three, each with the heavy field that makes dropping it worth
       doing — a file holding only stubs would pass every arm below while
       proving nothing about bytes. */
    const finishedCards = file.needsYou.filter((card) => !crewCardNeedsHim(card.state));
    expect(finishedCards.length).toBeGreaterThan(0);
    expect(finishedCards.some((card) => card.productImpact.length > 0)).toBe(true);

    const finishedEye = file.eyeItems.filter((item) => !crewCardNeedsHim(item.state));
    expect(finishedEye.length).toBeGreaterThan(0);
    expect(finishedEye.some((item) => item.frames.length > 0)).toBe(true);

    const resolved = file.problems.filter((problem) => !crewProblemIsOpen(problem.state));
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.some((problem) => problem.detail.length > 0)).toBe(true);
  });

  it("getState sends no finished row, and every unfinished one survives byte for byte", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const state = await crewRouter.createCaller(contextFor()).getState();

    expect(state.briefing.pipeline.filter((row) => row.status === "merged")).toEqual([]);
    expect(state.briefing.pipeline).toEqual(
      file.pipeline.filter((row) => row.status !== "merged"),
    );

    expect(state.briefing.needsYou).toEqual(
      file.needsYou.filter((card) => crewCardNeedsHim(card.state)),
    );
    expect(state.briefing.eyeItems).toEqual(
      file.eyeItems.filter((item) => crewCardNeedsHim(item.state)),
    );
    expect(state.briefing.problems).toEqual(
      file.problems.filter((problem) => crewProblemIsOpen(problem.state)),
    );
  });

  it("⚠ THE GENERAL BOX KEEPS ITS TITLES — every dropped host is still named on the wire (#1138)", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const state = await crewRouter.createCaller(contextFor()).getState();

    /* The one thing a finished card is still DRAWN for: a reply he left on it
       renders in the General box labelled *on "<title>"*. Lose the host and
       that line degrades to the slug — the single user-visible way this trim
       could go wrong, so it is asserted over the whole population rather than
       sampled. */
    const hosts = new Map(state.briefing.threadHosts.map((host) => [host.id, host]));
    for (const host of [...file.needsYou, ...file.eyeItems]) {
      expect(hosts.get(host.id)).toEqual({
        id: host.id,
        state: host.state,
        title: host.title,
      });
    }
    /* POSITIVE CONTROL — the list is the whole host population, the open ones
       included, so an arm that "found every finished host" cannot be passing
       over a list that is short for some other reason. */
    expect(state.briefing.threadHosts).toHaveLength(file.needsYou.length + file.eyeItems.length);

    /* Driven through the page's own rule rather than asserted about it: a
       reply on a card the wire no longer carries in `needsYou` must fall to
       the General box AND find its title there. */
    const dropped = file.needsYou.find((card) => !crewCardNeedsHim(card.state));
    expect(dropped, "the control above proves there is one").toBeDefined();
    expect(replyFallsToGeneral(dropped!.id, state.briefing.threadHosts)).toBe(true);
    expect(hosts.get(dropped!.id)?.title).toBe(dropped!.title);
  });

  it("⚠ THE EYE-FRAME ALLOWLIST IS NOT PROJECTED — a judged frame still serves (#1138)", () => {
    /* `/api/crew/eye-frame` serves exactly the keys the DEPLOYED BRIEFING
       names, and `crewEyeFrames.ts` builds that set from `readCrewBriefing()`
       — the whole file. Every eye item in the file is `done`, so feeding it
       the page projection instead would 404 every frame the route has, which
       is the one way a payload trim on this page could reach his eyes. */
    const keys = eyeFrameKeys(readCrewBriefing());
    const framesInFile = file.eyeItems.flatMap((item) => item.frames.map((frame) => frame.key));
    expect(framesInFile.length).toBeGreaterThan(0);
    for (const key of framesInFile) expect(keys.has(key)).toBe(true);

    /* AND THE ROUTE'S OWN CALL SITE, read at the source — `productionDependencies`
       is not exported, so no behavioural arm here can see which briefing it
       hands over, and the arm above would stay green through exactly the
       mistake it is about. Comments stripped: this file's header discusses
       the allowlist in prose. */
    const route = readFileSync(path.join(__dirname, "..", "routes", "crewEyeFrames.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(route).toContain("eyeFrameKeys(readCrewBriefing())");
    expect(route).not.toContain("crewBriefingForPage");
  });

  it("⚠ every other section is untouched — a projection, never an edit", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const state = await crewRouter.createCaller(contextFor()).getState();
    /* Everything the projection does not name must arrive byte for byte. The
       four trimmed lists are blanked on both sides and `threadHosts` is taken
       off, so what this arm compares is the REST of the briefing — the
       program, NEXT UP, the ladder, the acknowledgement list, the edition. */
    const blanked = { needsYou: [], eyeItems: [], problems: [], pipeline: [] };
    const { threadHosts, ...wire } = state.briefing;
    expect(threadHosts.length).toBeGreaterThan(0);
    expect({ ...wire, ...blanked }).toEqual({ ...readCrewBriefing(), ...blanked });
  });

  it("the page's filters and the wire projection ask ONE question (working law 4)", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const state = await crewRouter.createCaller(contextFor()).getState();
    /* The client's own derivations over what it is now sent: each must find
       nothing left to drop. The day two definitions disagree, the page draws a
       shorter list than the server meant and nothing else can see it. */
    expect(pipelineNotDone(state.briefing.pipeline)).toEqual(state.briefing.pipeline);
    expect(state.briefing.needsYou.every((card) => crewCardNeedsHim(card.state))).toBe(true);
    expect(state.briefing.eyeItems.every((item) => crewCardNeedsHim(item.state))).toBe(true);
    expect(state.briefing.problems.every((problem) => crewProblemIsOpen(problem.state))).toBe(true);
  });

  it("the saving is measured at the serialized payload, not asserted", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const state = await crewRouter.createCaller(contextFor()).getState();
    const wire = Buffer.byteLength(JSON.stringify(state.briefing), "utf8");
    const whole = Buffer.byteLength(JSON.stringify(readCrewBriefing()), "utf8");
    /* At edition 493: 943,955 bytes whole, 592,105 under #1137's projection
       alone, 69,106 under this one. The arm holds the DIRECTION rather than
       the number, because the number moves every edition — but it holds a
       FACTOR rather than a bare inequality, so a projection that quietly
       stopped trimming three of its four sections could not pass it. */
    expect(wire).toBeLessThan(whole / 2);
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

/**
 * HIS "NOT RELEVANT" TAP, at the wire (#325's second half).
 *
 * Three properties, and the middle one is the whole feature: the tap records an
 * intent, and **nothing on this surface can answer it**. The `resolution`
 * columns belong to `scripts/crew-card-intents.mts`, so if the page could set
 * them the second pair of eyes his card asks for would be the same pair.
 */
describe("the card-intent tap — his half, and only his half", () => {
  it("is dark outside the scope like everything else on this router", async () => {
    delete process.env.CREW_TAB_SCOPE;
    const caller = crewRouter.createCaller(contextFor());
    await expect(caller.setCardIntent({ issueNumber: 312, intent: "close" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  /*
    ⚠ THE ARM THAT MATTERS. `.strict()` means an undeclared field is REJECTED
    rather than silently dropped — and `resolution` is undeclared on purpose.
    This is driven by PARSING through the real router rather than by grepping
    for `.strict()`, because a substring test for that token is exactly the
    instrument this repository has been burned by twice.
  */
  it("refuses a resolution sent from the page — that column is the shift's", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    await expect(
      caller.setCardIntent({ issueNumber: 312, intent: "close", resolution: "closed" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  /* And a forged author is refused by the parser before any handler runs
     (invariant 3), the same way the reply and switch schemas are shaped. */
  it("refuses a forged marker id", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    await expect(
      caller.setCardIntent({ issueNumber: 312, intent: "close", markedByUserId: 999 } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses an intent the vocabulary does not name, and a card number that is not one", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    await expect(caller.setCardIntent({ issueNumber: 312, intent: "delete" as never }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.setCardIntent({ issueNumber: 0, intent: "close" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  /*
    ⚠ CONTROL — the arms above are green on a caller that rejects EVERYTHING, so
    the shape the page really sends must be seen to get past the parser. With no
    database in this suite it fails INSIDE the handler, which is the proof it
    reached one: a parse rejection is BAD_REQUEST, and this is not.
  */
  it("⚠ CONTROL — the shape the page sends gets past the parser", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    await expect(caller.setCardIntent({ issueNumber: 312, intent: "close" }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    /* And `null` — taking the tap back — is a value on the same road rather
       than a second procedure. */
    await expect(caller.setCardIntent({ issueNumber: 312, intent: null }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("the state carries the intents, and says so when the table is not there yet", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    const state = await caller.getState();
    /* `available: false` is the ceremony window, and it is a different fact
       from an empty list — the panel withholds the buttons on the first and
       draws them on the second. */
    expect(state.cardIntents).toEqual({ available: false, intents: [] });
  });
});

describe("the live half rides getState (#1193)", () => {
  it("returns the derived desk from the reader's reading, stamped with its instant", async () => {
    process.env.CREW_TAB_SCOPE = "all";
    const caller = crewRouter.createCaller(contextFor());
    const state = await caller.getState();
    expect(state.live.available).toBe(true);
    if (!state.live.available) throw new Error("unreachable");
    expect(state.live.stale).toBe(false);
    expect(state.live.desk.readAt).toBe("2026-09-25T00:00:00Z");
    expect(state.live.desk.nextUp.items).toEqual([{ issueNumber: 1193, title: "Live Desk", urgent: true }]);
    expect(state.live.desk.recent.map((row) => [row.number, row.outcome])).toEqual([[1185, "merged"]]);
    expect(state.live.desk.counts).toEqual({ openCards: 1, openPullRequests: 0, truncated: false });
    /* The rung keys handed to the derivation are the deployed ladder's own. */
    expect(state.live.desk.ladderCards.items).toEqual([]);
  });
});

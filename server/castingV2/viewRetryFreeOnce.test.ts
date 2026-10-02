import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { generationOperations } from "../../drizzle/schema";
import type { Model, ModelAsset } from "../../drizzle/schema";
import { CASTING_V2_VIEW_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { spentFreeViewRetryFilter } from "../db/castingV2ViewRetry";
import { castSlotRetryOffer, projectSignedCast } from "./castProjection";

/*
  `storagePublicUrl` reads the R2 config from an import-time ENV snapshot and
  throws when it is absent — primed hoisted, exactly as `viewRetryOffer.test.ts`
  does, and for the same reason.
*/
vi.hoisted(() => {
  process.env.R2_ENDPOINT ||= "https://r2-unit-test.invalid";
  process.env.R2_BUCKET ||= "unit-test-bucket";
  process.env.R2_PUBLIC_URL ||= "https://pub-test.r2.dev";
  process.env.R2_ACCESS_KEY_ID ||= "unit-test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ||= "unit-test-secret";
});

/**
 * ONE FREE TRY AGAIN PER VIEW — #1601 item 4, his rule from the card: *"The
 * first Try again on an unchecked view is free, **once**; the second is paid."*
 *
 * # What was wrong, and why no arm in the tree could see it
 *
 * The free branch was a pure function of the slot's state, and **a free retry
 * does not move that state**: a view delivered unchecked whose retry also
 * arrives unchecked is still unchecked, so `castSlotRetryOffer` kept answering
 * 0. Every arm in `viewRetryOffer.test.ts` was right about the rule it tested;
 * the rule itself had no ceiling, so the house would render 2K views for nothing
 * for as long as the conformance judge stayed unavailable. The missing fact is
 * not about the slot at all — it is *"has this view already had its free ask"* —
 * and the slot cannot carry it, which is why this suite drives the OPERATION-ROW
 * reading beside the offer.
 *
 * # Why these arms
 *
 * Four things fail independently here and three of the four are invisible at the
 * offer:
 *
 *   1. the RULE — a spent free ask prices at the Try again price, and the row's
 *      word must NOT move with it, because the view really is still unchecked;
 *   2. the WIRE — the predicate that decides *spent*, read off the SQL it builds
 *      (invariant 5) rather than off a constant beside it;
 *   3. the CALLERS — the room and the till must BOTH pass the fact, or the button
 *      and the charge part company by omission rather than by logic, and the
 *      population of callers is WALKED rather than listed;
 *   4. the REFUSAL — an unavailable database throws here rather than answering
 *      *nothing spent*, which is the direction that hands out free renders.
 */

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: 7,
    userId: 1,
    agencyId: "KI-AAAA-BBBB-CCCC-DDDD",
    name: "Nine",
    masterPrompt: "SECRET",
    technicalSchema: { subject: { sex: "female" } },
    preferences: {},
    status: "active",
    cohortKey: "photoreal-human",
    styleKey: null,
    sourceCandidateId: 55,
    sourceRollId: 22,
    identityRevisionId: "rev-1",
    currentPackageSnapshotId: "pkg-1",
    stateVersion: 1,
    sealedIdentitySnapshotId: "id-1",
    sealedPackageSnapshotId: "pkg-1",
    mintedAt: new Date("2026-09-01T10:00:00Z"),
    deletedAt: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  } as Model;
}

let nextAssetId = 1000;
function asset(overrides: Partial<ModelAsset> = {}): ModelAsset {
  nextAssetId -= 1;
  return {
    id: nextAssetId,
    modelId: 7,
    viewType: "frontFull",
    resolution: "2K",
    storageUrl: "https://cdn.example/view.png",
    storageKey: "casting-v2/casts/op/views/key.png",
    pointsCost: 1000,
    pinned: false,
    status: null,
    provenance: {
      provider: "fal",
      engine: "fal-ai/nano-banana-pro",
      conformanceMethod: "model",
    },
    createdAt: new Date(),
    ...overrides,
  } as ModelAsset;
}

const lineage = {
  rollPublicId: "roll-public",
  rollIndex: 2,
  sessionPublicId: "session-public",
  candidatePublicId: "candidate-public",
  castFromAt: new Date("2026-09-01T10:00:00Z"),
};

/** The 1K signed face, which every Cast has. */
const anchor = () =>
  asset({
    id: 900,
    viewType: "frontClose",
    resolution: "1K",
    pointsCost: 0,
    provenance: { identityRole: "anchor", identityRevisionId: "rev-1", identityText: "t" },
  });

/** A view that arrived with nobody able to check it (D-246) — the FREE road. */
const unjudged = (viewType: string) =>
  asset({
    viewType: viewType as ModelAsset["viewType"],
    provenance: {
      provider: "fal",
      engine: "fal-ai/nano-banana-pro",
      conformanceMethod: "unavailable",
    },
  });

/** A written-off view: the marker the room confesses from — the PAID road. */
const failed = (viewType: string) =>
  asset({
    id: 500 + viewType.length,
    viewType: viewType as ModelAsset["viewType"],
    storageUrl: "",
    status: { state: "failed", reason: "didn't arrive", refunded: 1000 },
  });

const PROMISED = ["frontFull", "threeQuarter", "sideFull", "backFull", "closeUp"] as const;

function slotsOf(
  assets: ModelAsset[],
  freeRetrySpentAngles: Parameters<typeof projectSignedCast>[0]["freeRetrySpentAngles"] = [],
) {
  const projection = projectSignedCast({
    model: model(),
    assets: [...assets].sort((a, b) => b.id - a.id),
    lineage,
    promisedAngles: [...PROMISED],
    freeRetrySpentAngles,
  });
  return new Map(projection.slots.map((slot) => [slot.angle, slot]));
}

const SERVER_ROOT = resolve(import.meta.dirname, "..");

const readSource = (relativeToServer: string) =>
  readFileSync(resolve(SERVER_ROOT, relativeToServer), "utf8");

/**
 * ONE FUNCTION'S BODY, sliced out so a whole-file `toContain` cannot be
 * satisfied by an identical line in a neighbour (#1636's class).
 *
 * ⚠ **THE OBVIOUS SLICE IS WRONG AND THIS SUITE SHIPPED IT ONCE.** Ending at the
 * first newline-brace lands on the closing brace of a multi-line PARAMETER
 * object — `}): Promise<…> {` — so the "body" was the signature, and two arms
 * failed against a function whose body was correct. The end is therefore the
 * first line that is a LONE brace, which a signature's never is.
 *
 * It throws rather than returning a short slice, and it throws on a declaration
 * that appears twice: a slice that silently ends early, or that reads the wrong
 * one of two, is an arm that has quietly stopped reading the thing it names.
 */
function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error(`declaration not found: ${declaration}`);
  if (source.indexOf(declaration, start + 1) >= 0) {
    throw new Error(`declaration is not unique, so the slice proves nothing: ${declaration}`);
  }
  const end = source.indexOf("\n}\n", start);
  if (end < 0) throw new Error(`no closing brace found for: ${declaration}`);
  return source.slice(start, end);
}

describe("the free Try again is once per view (#1601 item 4)", () => {
  it("an unchecked view's FIRST ask is free and its SECOND is the Try again price", () => {
    const assets = [anchor(), unjudged("closeUp")];

    const first = slotsOf(assets).get("closeUp");
    expect(first?.retry).toEqual({ priceCredits: 0, reason: "unchecked" });

    const second = slotsOf(assets, ["closeUp"]).get("closeUp");
    expect(second?.retry).toEqual({
      priceCredits: CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
      reason: "unchecked",
    });
  });

  it("the ROW'S WORD does not change, because the view really is still unchecked", () => {
    /*
      The reason word is what his muted line is drawn from ("Unchecked · Try
      again"), and the temptation when the price moves is to move the word with
      it. That would be a lie about the picture: nothing was refunded and nothing
      was checked — she is holding the same unvouched-for view, and all that has
      changed is that she has already had her free look at it.

      Its own arm rather than folded into the one above, because the two facts
      fail independently: a branch returning `reason: "refunded"` at the right
      price passes a price-only assertion and puts the word "Refunded" under a
      picture that is on the screen.
    */
    const slot = slotsOf([anchor(), unjudged("sideFull")], ["sideFull"]).get("sideFull");
    expect(slot?.retry?.reason).toBe("unchecked");
    expect(slot?.state).toBe("ready");
    expect(slot?.url).toBeTruthy();
  });

  it("a spent free ask on ONE view leaves her other views' free asks alone", () => {
    /*
      The read is per SLOT, and a cast-level off-by-one is exactly the mistake
      #1235 is the record of on this same surface. No price arm above would see
      it: all five of her views would simply read "paid".
    */
    const slots = slotsOf(
      [anchor(), unjudged("closeUp"), unjudged("sideFull"), unjudged("backFull")],
      ["sideFull"],
    );
    expect(slots.get("sideFull")?.retry?.priceCredits).toBe(CASTING_V2_VIEW_RETRY_PRICE_CREDITS);
    expect(slots.get("closeUp")?.retry?.priceCredits).toBe(0);
    expect(slots.get("backFull")?.retry?.priceCredits).toBe(0);
  });

  it("a REFUNDED view is untouched by the spent set — it never had a free ask", () => {
    /*
      A view that failed was refunded, so it has cost nothing and asking again is
      an ordinary purchase (#1208). It has no free ask to spend, so the spent set
      must not move it in EITHER direction — including the direction that would
      read "already spent" as "already had its go" and offer nothing at all.
    */
    const withSet = slotsOf([anchor(), failed("backFull")], ["backFull"]).get("backFull");
    const without = slotsOf([anchor(), failed("backFull")]).get("backFull");
    expect(withSet?.retry).toEqual({
      priceCredits: CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
      reason: "refunded",
    });
    expect(withSet?.retry).toEqual(without?.retry);
  });

  it("the offer defaults to NOT spent, which is the generous direction for a default", () => {
    /*
      The third argument is optional on purpose — every read-only caller and every
      arm written before this item passes two — so the default decides what a
      caller that forgets gets. Generous is right for a default on a money
      surface: forgetting cannot charge somebody. The arms below prove the two
      callers that DO spend do not forget.
    */
    expect(castSlotRetryOffer(
      { state: "ready", unjudged: true, refundedCredits: null },
      777,
    )).toEqual({ priceCredits: 0, reason: "unchecked" });
    expect(castSlotRetryOffer(
      { state: "ready", unjudged: true, refundedCredits: null },
      777,
      true,
    )).toEqual({ priceCredits: 777, reason: "unchecked" });
  });
});

/**
 * THE PREDICATE, READ AT THE WIRE (invariant 5).
 *
 * Every arm above drives the offer against an injected set, so none of them can
 * see which rows the database would have put in it. The predicate is the half
 * that decides whether a paid retry eats a free ask, and the only place it is
 * visible is the generated SQL. Same shape as `viewRetryBusy.test.ts`'s, against
 * a pool that never connects.
 */
describe("the spent-free-retry predicate", () => {
  const rendered = () => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    const db = drizzle(pool);
    const { sql, params } = db
      .select({ payloadHash: generationOperations.payloadHash })
      .from(generationOperations)
      .where(spentFreeViewRetryFilter({ userId: 1, modelId: 7 }))
      .toSQL();
    void pool.end().catch(() => undefined);
    return { sql, params };
  };

  it("scopes the owner, the Cast and the kind, and excludes a deleted subject", () => {
    const { sql, params } = rendered();
    expect(sql).toContain("`generation_operations`.`userId` = ?");
    expect(sql).toContain("`generation_operations`.`modelId` = ?");
    expect(sql).toContain("`generation_operations`.`kind` = ?");
    expect(sql).toContain("`generation_operations`.`subjectDeletedAt` is null");
    /* The kind as a VALUE: a predicate comparing to the wrong string excludes
       nothing, and every arm in this file stays green about it. */
    expect(params).toContain("castingV2.viewRetry");
  });

  it("the free/paid discriminator is plannedCredits = 0", () => {
    const { sql, params } = rendered();
    expect(sql).toContain("`generation_operations`.`plannedCredits` = ?");
    expect(params).toContain(0);
  });

  it("excludes a row still at the claim, where plannedCredits is 0 by DEFAULT", () => {
    /*
      THE ARM THAT EARNS THIS SUITE ITS KEEP.

      `plannedCredits` is written by `markGenerationOperationRunning`, one
      statement AFTER the claim, and its column default is 0. So a row still at
      `claimed` reads 0 whatever it was about to cost — and without this arm of
      the predicate, every PAID Try again would consume the free ask for its
      angle during the milliseconds in between. Nothing downstream would
      disagree: the customer would simply find their free ask gone.

      It is also the right product answer on its own terms. A claim that never
      reached `running` dispatched no render, so the customer has had nothing and
      keeps the free ask they were offered.
    */
    const { sql, params } = rendered();
    expect(sql).toMatch(/`generation_operations`\.`status` (<>|!=) \?/);
    expect(params).toContain("claimed");
  });

  it("the claimed status it excludes is the schema's own default for that column", () => {
    /*
      WORKING LAW 4, PAID FOR RATHER THAN PROMISED. The module spells `"claimed"`
      because drizzle exposes no column default as a value, so it is a second
      spelling of one fact. This holds it to the first: rename the status in the
      schema and the module would quietly start admitting every claimed row,
      which is the direction that hands out free renders.
    */
    const column = generationOperations.status as unknown as { default?: unknown };
    expect(column.default).toBe("claimed");
    expect(readSource("db/castingV2ViewRetry.ts"))
      .toContain('const CLAIMED_OPERATION_STATUS = "claimed";');
  });

  it("an unavailable database THROWS rather than answering nothing-spent", () => {
    /*
      The sibling busy read answers [] with no database and says in its own
      docblock why that is safe: its empty direction costs a tile its skeleton.
      THIS read's empty direction gives away a 2K render, so it takes
      `listCastPromisedAngles`'s refusal instead.

      Read at the source rather than by faking a connection: the module resolves
      its database inside the function, so a bench with no `TEST_DATABASE_URL`
      would SKIP the one arm that matters here — and a skipped money arm is
      indistinguishable from a passing one in a tally.
    */
    const body = functionBody(
      readSource("db/castingV2ViewRetry.ts"),
      "export async function listSpentFreeViewRetryAngles",
    );
    expect(body).toContain('throw new Error("Database not available")');
    expect(body).not.toMatch(/if\s*\(!db\)\s*return\s*\[\]/);
  });

  it("recomputes the angle from the subject hash rather than reading a column", () => {
    /*
      #1235's reading reused, not re-invented: `generation_operations` carries no
      angle, so the five-angle vocabulary is hashed and matched against the row's
      `payloadHash`. An arm because the tempting shape is a `like` on something,
      and a `like` here would match another slot's claim.
    */
    const body = functionBody(
      readSource("db/castingV2ViewRetry.ts"),
      "export async function listSpentFreeViewRetryAngles",
    );
    expect(body).toContain("castViewRetrySubjectHash({");
    expect(body).toContain("CAST_VIEW_ANGLES.filter");
  });
});

describe("both roads pass the fact (the button and the till are one reading)", () => {
  it("the ROOM's read hands the spent angles to the projection", () => {
    const source = readSource("routes/castingV2.ts");
    const getCast = source.slice(source.indexOf("  getCast: protectedProcedure"));
    const procedure = getCast.slice(0, getCast.indexOf("\n    }),"));
    expect(procedure).toContain("listSpentFreeViewRetryAngles({");
    expect(procedure).toContain("freeRetrySpentAngles,");
  });

  it("the TILL re-reads the offer WITH the fact, from the same read the slot came from", () => {
    /*
      The entrance deliberately re-asks `castSlotRetryOffer` rather than trusting
      the client's price. That re-ask is where a free render would be handed out
      if the third argument were forgotten, and NOTHING else in the product would
      disagree — the room would show the right price and the till would charge
      nothing. So this reads the CALL, sliced out of `retryCastView` rather than
      searched for anywhere in the file (#1636's class: a whole-file `toContain`
      is satisfied by an identical line in a neighbouring function).
    */
    const source = readSource("castingV2/viewRetryService.ts");
    const entrance = source.slice(source.indexOf("export async function retryCastView"));
    const call = entrance.slice(entrance.indexOf("const offer = castSlotRetryOffer("));
    const args = call.slice(0, call.indexOf("\n  );"));
    expect(args).toContain("read.freeRetrySpentAngles.includes(input.angle)");
    /* From the READ, never a second query at the till — a query here would be a
       reading the room never had, which is the drift this item closes. */
    expect(args).not.toContain("listSpentFreeViewRetryAngles");
  });

  it("the till's read takes the spent angles in the SAME statement as the slots", () => {
    const body = functionBody(
      readSource("castingV2/viewRetryService.ts"),
      "async function readCastSlots",
    );
    /*
      ⚠ **THE OBVIOUS THREE ASSERTIONS ARE ALL TRUE OF THE SABOTAGE, AND THIS ARM
      SHIPPED THEM FIRST.** *"one `await Promise.all`"*, *"the body calls the
      reader"* and *"the body returns the field"* are each satisfied by moving the
      read to its own `await` on the next line — which is exactly the mistake the
      arm is for. Sabotage case 9 survived green until it read the argument LIST
      instead of the body (memory: a guard arm satisfied by a sibling).

      So: the call must sit INSIDE the array `Promise.all` is given, and must not
      appear anywhere else in the function. One statement, so the slots and the
      price fact cannot be read a moment apart and disagree about a retry that
      landed in between.
    */
    const open = body.indexOf("await Promise.all([");
    expect(open).toBeGreaterThan(-1);
    const close = body.indexOf("\n  ]);", open);
    expect(close).toBeGreaterThan(open);
    const concurrent = body.slice(open, close);
    expect(concurrent).toContain("listSpentFreeViewRetryAngles({");
    /* Its neighbour, as the positive control: if this slice ever stopped being
       the concurrent read, both would vanish and the arm would be vacuous. */
    expect(concurrent).toContain("listRunningViewRetryAngles({");
    const elsewhere = body.slice(0, open) + body.slice(close);
    expect(elsewhere).not.toContain("listSpentFreeViewRetryAngles(");
    expect(body).toContain("freeRetrySpentAngles,");
  });

  it("EVERY production caller of projectSignedCast passes the spent angles — walked, not listed", () => {
    /*
      THE POPULATION IS DERIVED (working law 4). A list of the two callers here
      would be a third copy of a fact the tree already states, and the failure it
      would hide is the only one that matters: a THIRD caller added later, passing
      nothing, reading as correct because this arm never heard of it.

      Tests are excluded on purpose — a suite may project without pricing
      anything, and holding a fixture to a money argument teaches nothing.
    */
    const callers = callersOfProjection();
    expect(callers.length).toBeGreaterThanOrEqual(2);
    for (const caller of callers) {
      const source = readFileSync(resolve(SERVER_ROOT, caller), "utf8");
      const call = source.slice(source.indexOf("projectSignedCast({"));
      const args = call.slice(0, call.indexOf("})") + 2);
      expect(
        args,
        `${caller} calls projectSignedCast without freeRetrySpentAngles — the room and the till must be one reading`,
      ).toContain("freeRetrySpentAngles");
    }
  });
});

/**
 * Every production module under `server/` that CALLS `projectSignedCast`,
 * walked rather than listed.
 *
 * The DECLARATION is not a call and neither is the import that carries it, so
 * the walk looks for the invocation's own shape (`projectSignedCast({`) and
 * `castProjection.ts` — which declares it with a newline after the brace — is
 * not a hit.
 */
function callersOfProjection(): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.includes(".test.")) continue;
      if (!readFileSync(full, "utf8").includes("projectSignedCast({")) continue;
      hits.push(full.slice(SERVER_ROOT.length + 1).replace(/\\/g, "/"));
    }
  };
  walk(SERVER_ROOT);
  return hits;
}

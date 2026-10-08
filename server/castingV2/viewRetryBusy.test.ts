import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

/**
 * WHICH VIEWS ARE BEING ASKED FOR — the busy read, driven (#1235).
 *
 * This is the instrument the money fix rests on, so it is driven rather than
 * described. His third report was a DOUBLE CHARGE: press Try again, leave the
 * room, come back, press again — two renders, two 50s, one slot. Nothing
 * refused it because nothing asked whether an operation for that view was
 * already running.
 *
 * ⚠ **THE CARD SAID "READ AT THE ROWS" AND THE ROW DOES NOT CARRY THE ANGLE.**
 * `generation_operations` stores `payloadHash` and no payload (read at
 * `drizzle/schema.ts`), and the Sign's own building state is the MODEL's
 * `provisioning` status, which is cast-level and cannot name one of five slots.
 * What the row does carry is the hash of the claim's SUBJECT — this Cast, this
 * view — so the reader recomputes that hash per angle from the same payload
 * builder the entrance claims with.
 *
 * Which makes the drift risk the whole subject of this file: if the entrance's
 * payload shape and the reader's expectation ever separate, every arm about the
 * refusal stays green and the double charge comes back in silence. So:
 *
 * - the SUBJECT HASH is proven to discriminate the angle, the Cast and the
 *   model, each with a negative control;
 * - the FILTER is read at the outgoing SQL (invariant 5), with the statuses a
 *   finished retry carries asserted ABSENT;
 * - and the entrance's own claim is hashed against the reader's expectation in
 *   `viewRetryService.test.ts`, where the claim can be captured at the wire.
 */

const rows: Array<{ payloadHash: string }> = [];
let databaseAvailable = true;

vi.mock("../db/connection", () => ({
  getDb: async () => (databaseAvailable
    ? {
      select: () => ({
        from: () => ({ where: async () => rows }),
      }),
    }
    : null),
  withTransaction: async (run: (tx: unknown) => Promise<unknown>) => run({}),
}));

import { generationOperations } from "../../drizzle/schema";
import {
  castViewRetrySubjectHash,
  VIEW_REPLACING_OPERATION_KINDS,
} from "../casting/operationContract";
import {
  listRunningViewRetryAngles,
  runningViewRetryFilter,
  RUNNING_VIEW_RETRY_STATUSES,
} from "../db/castingV2ViewRetry";

const MODEL_ID = 7;
const CAST_ID = "KI-AAAA-BBBB-CCCC-DDDD";

const hashFor = (angle: string, overrides: { modelId?: number; castId?: string } = {}) =>
  castViewRetrySubjectHash({
    modelId: overrides.modelId ?? MODEL_ID,
    castId: overrides.castId ?? CAST_ID,
    angle,
  });

const read = () => listRunningViewRetryAngles({ userId: 1, modelId: MODEL_ID, castId: CAST_ID });

describe("the subject hash names one Cast and one view", () => {
  it("differs per angle, per Cast and per model", () => {
    /*
      Three negative controls in one arm, and each is a way the reader could
      have matched the wrong thing: a retry on the back read as one on the
      close-up (his second report's independence gone), one Cast's retry read as
      another's, or a hash so loose that any model matched.
    */
    expect(hashFor("backFull")).not.toBe(hashFor("closeUp"));
    expect(hashFor("backFull")).not.toBe(hashFor("backFull", { castId: "KI-ZZZZ" }));
    expect(hashFor("backFull")).not.toBe(hashFor("backFull", { modelId: 8 }));
  });

  it("is stable — the same subject always hashes the same", () => {
    // The positive control for the arm above: it must not be discriminating by
    // being random, which would make every reading of a running retry silent.
    expect(hashFor("backFull")).toBe(hashFor("backFull"));
    expect(hashFor("backFull")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the busy read returns exactly the angles being asked for", () => {
  it("names two in flight at once, and nothing else", async () => {
    rows.length = 0;
    rows.push({ payloadHash: hashFor("backFull") }, { payloadHash: hashFor("closeUp") });

    const busy = await read();

    /*
      HIS SECOND REPORT, at the source of truth: two retries run at once. Each
      Try again is its own operation, fences on its own, and renders through the
      Sign's own view queue — which already runs views in parallel.
    */
    expect([...busy].sort()).toEqual(["backFull", "closeUp"]);
  });

  it("ignores a retry that belongs to another Cast", async () => {
    rows.length = 0;
    rows.push({ payloadHash: hashFor("backFull", { castId: "KI-SOMEBODY-ELSE" }) });

    // Not a filter this reader could get away with skipping: a match here would
    // put a skeleton on a tile nobody is touching and withhold a real offer.
    expect(await read()).toEqual([]);
  });

  it("answers nothing when no retry is running", async () => {
    rows.length = 0;
    expect(await read()).toEqual([]);
  });

  it("answers nothing when the database cannot be reached", async () => {
    rows.length = 0;
    rows.push({ payloadHash: hashFor("backFull") });
    databaseAvailable = false;
    try {
      /*
        The direction is stated in the reader and asserted here: an unreachable
        database costs a tile its skeleton, never a second charge. The ENTRANCE
        makes this same read before it claims, and its first statement is the
        frozen-account read, which refuses outright when the database is down.
      */
      expect(await read()).toEqual([]);
    } finally {
      databaseAvailable = true;
    }
  });

  it("refuses a nonsense model id rather than reading every Cast", async () => {
    await expect(
      listRunningViewRetryAngles({ userId: 1, modelId: 0, castId: CAST_ID }),
    ).rejects.toThrow(/modelId/);
    await expect(
      listRunningViewRetryAngles({ userId: 0, modelId: MODEL_ID, castId: CAST_ID }),
    ).rejects.toThrow(/userId/);
  });
});

/**
 * THE FILTER, READ AT THE WIRE (invariant 5).
 *
 * Every arm above runs against injected rows, so none of them can see WHICH
 * rows the database would have returned. The predicate is the half that decides
 * whether a finished retry keeps a slot busy forever, and the only place it is
 * visible is the generated SQL.
 */
describe("the running-retry filter", () => {
  const rendered = () => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    const db = drizzle(pool);
    const { sql, params } = db
      .select({ payloadHash: generationOperations.payloadHash })
      .from(generationOperations)
      .where(runningViewRetryFilter({ userId: 1, modelId: MODEL_ID }))
      .toSQL();
    void pool.end().catch(() => undefined);
    return { sql, params };
  };

  it("scopes the owner, the Cast and BOTH view-replacing kinds, and excludes a deleted subject", () => {
    const { sql, params } = rendered();
    expect(sql).toContain("`generation_operations`.`userId` = ?");
    expect(sql).toContain("`generation_operations`.`modelId` = ?");
    expect(sql).toContain("`generation_operations`.`subjectDeletedAt` is null");
    /*
      ⚠ **THE KIND PREDICATE WIDENED FROM ONE VALUE TO A SET AND THIS ARM IS
      WHAT SAID SO (#1903 slice 2).** It read `kind` = ? and the whole paid redo
      road would have been invisible to this reader: five views rendering, every
      slot reading ready, a Try again button over each, and a press charging
      against a slot already being replaced — #1235's double charge arriving by
      a new door. The arm went red on the widening, which is the arm working.

      DERIVED from the declared set, never two literals: a third road added to
      `VIEW_REPLACING_OPERATION_KINDS` is asserted here with no edit, which is
      the only way this arm can stay ahead of the filter it guards.
    */
    expect(sql).toContain("`generation_operations`.`kind` in (?, ?)");
    // The kinds are asserted as VALUES: a predicate comparing to the wrong
    // string excludes nothing and every arm above stays green about it.
    for (const kind of VIEW_REPLACING_OPERATION_KINDS) expect(params).toContain(kind);
    expect([...VIEW_REPLACING_OPERATION_KINDS])
      .toEqual(["castingV2.viewRetry", "castingV2.packageRedo"]);
    expect(params).toContain(MODEL_ID);
  });

  /**
   * ⚠ **THE PRESS IS NOT IN THIS PREDICATE, AND THE PRICE OF ADDING IT IS A
   * CUSTOMER NEVER GETTING HER CREDITS BACK** (the relay's note on PR #1924).
   *
   * Since #1903's sweep-side repair, `viewReplacementInFlight` asks this very
   * filter whether a picture can still arrive on the Cast, and the flat-priced
   * press defers its whole settlement while the answer is yes. The press's own
   * row sits on the same `modelId`. **So a press kind inside this set would
   * match the press itself, every swept press would defer for ever, and the one
   * road that can hand back 3,250 credits would never run** — a customer who
   * received nothing, charged, with no refund and no error anywhere.
   *
   * ⚠ **THE ARM ABOVE ALREADY PINS THE SET AND IS NOT ENOUGH, which is the
   * whole reason this one exists.** `toEqual([...])` goes red on the widening,
   * but it reads as a list that needs updating — the obvious repair is to add
   * the third string to the expectation and move on. Nothing there says what
   * breaks. This arm reads the PREDICATE THE READER ACTUALLY SENDS and names
   * the consequence, so the red arrives with its reason attached.
   *
   * Read at the wire rather than at the constant (invariant 5): the set and the
   * SQL are two different claims, and it is the SQL that decides.
   */
  it("never admits the press that holds the money — it would defer every refund for ever", () => {
    const { params } = rendered();
    expect(
      params,
      "the redo PRESS is in the busy predicate: viewReplacementInFlight would match the "
      + "press's own row, so every swept press defers for ever and a total loss is never refunded",
    ).not.toContain("castingV2.packageRedoPress");
    /* The positive control, so the arm cannot pass by the predicate carrying no
       kinds at all: the two roads that DO commit a picture are still in it. */
    expect(params).toContain("castingV2.viewRetry");
    expect(params).toContain("castingV2.packageRedo");
  });

  it("counts only a claimed or running retry as busy", () => {
    const { sql, params } = rendered();
    expect(sql).toContain("`generation_operations`.`status` in (?, ?)");
    expect(params).toContain("claimed");
    expect(params).toContain("running");
    /*
      THE NEGATIVE HALF, and it is the one that would hurt: a terminal retry
      counted as busy leaves the slot skeletonised with no offer for good, and a
      `recovery_required` one hides a view the customer still does not have
      behind a render that will never happen.
    */
    for (const terminal of ["succeeded", "failed", "partial", "recovery_required"]) {
      expect(params).not.toContain(terminal);
    }
    expect([...RUNNING_VIEW_RETRY_STATUSES]).toEqual(["claimed", "running"]);
  });
});

/**
 * THE COMMIT'S OWN FENCE — and this is a FLOOR, said so rather than implied.
 *
 * `commitRetriedViewAsset` admits an operation only if it is `running` AND its
 * kind may replace a view. That predicate decides whether a rendered picture
 * LANDS or is read as fenced — and a fenced redo slice is thrown away and
 * refunded while the bytes it rendered are dropped, so the customer watches
 * five renders happen and gets nothing back but their money.
 *
 * ⚠ **It cannot be driven here.** The statement lives inside `withTransaction`
 * against a real connection, and this repository's CI has no database — so an
 * arm pretending to drive it would be the hollow kind. What CAN be checked is
 * that the predicate reads the DECLARED SET rather than a literal, which is the
 * mistake that was actually made: the fence carried `castingV2.viewRetry` as a
 * string, and a second kind arriving beside it fails silently in the worst
 * available direction.
 *
 * A text read is weaker than a drive and this is the honest floor, not
 * coverage. The real driver is `castingV2ViewRetry`'s integration suite when
 * one exists.
 */
describe("the retried-view commit's fence", () => {
  it("reads the declared kind set, never a single kind as a literal", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "server/db/castingV2ViewRetry.ts"),
      "utf8",
    );
    /* SLICED to the commit, because this module's other statements legitimately
       name the Try again kind on their own (the free-ask filter keys on it, and
       must keep doing so — a redo is never free). A whole-file read would be
       satisfied, or broken, by a neighbour. */
    const start = source.indexOf("export async function commitRetriedViewAsset");
    /* To the NEXT top-level declaration, not to the first `\n}` — which was the
       first draft and it stopped at the input OBJECT's closing brace, four
       lines in, so the slice held the signature and none of the statement. A
       slice that is too short fails loudly here; one that is too long is the
       quieter half of the same mistake and is what the negative arm below is
       for. */
    const next = source.indexOf("\nexport ", start + 1);
    const commit = source.slice(start, next === -1 ? undefined : next);
    expect(start).toBeGreaterThan(-1);
    expect(commit).toContain("await tx");
    expect(commit).toContain("inArray(generationOperations.kind, [...VIEW_REPLACING_OPERATION_KINDS])");
    expect(commit).not.toContain('eq(generationOperations.kind, "castingV2.viewRetry")');
    /* And the free-ask filter's own literal is still there, one function away —
       the negative control for the slice above, and a rule in its own right:
       the redo must never be mistaken for a spent free Try again. */
    expect(source).toContain('eq(generationOperations.kind, "castingV2.viewRetry")');
  });

  /**
   * ⚠ `null` MEANS THE FENCE AND NOTHING ELSE — #1903's review finding 1, at
   * the root rather than at either caller.
   *
   * `renderViewAttempts` maps a `null` from this commit to
   * `status: "fenced"`, and BOTH services read that as *another process owns
   * this operation's money, so do not refund it*. That is right about a real
   * fence and catastrophic about anything else — and this function used to
   * answer `null` four different ways: the fence, a model that is gone, an
   * insert with no id, and **any error thrown inside the transaction**, the
   * last three of them while the operation was still `running` and therefore
   * owned by nobody. The redo sealed those as `succeeded` with nothing
   * refunded; the Try again sealed them as `failed` with nothing refunded.
   * Either way the row went terminal, the sweep never looked again, and the
   * customer had paid for a picture that does not exist.
   *
   * ⚠ **It is a TEXT READ and that is the honest floor, for the same reason
   * the arm above is one**: the statement lives inside `withTransaction`
   * against a real connection and this repository's CI has no database. What
   * it pins is the shape of the mistake that was actually made — a blanket
   * `catch` and a BARE `return null` — never the behaviour. The behaviour is
   * driven one layer up, in `packageRedoService.test.ts`, where the commit
   * seam is injected.
   *
   * ⚠ **THERE ARE TWO FENCES NOW, and this arm reddened on the second one
   * before it was told about it** (#1903 review finding 1, 2026-10-09). It
   * pinned *exactly one* `return null`; the press fence made two, and the
   * guard refused the change by name rather than going quiet. It was
   * RE-DERIVED and not loosened: the count now comes from an enumerated list
   * of the fences, so the arm still fails on a bare `return null` that is not
   * one of them.
   */
  it("reserves null for the fence alone, and throws on every other road", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "server/db/castingV2ViewRetry.ts"),
      "utf8",
    );
    const anchor = "export async function commitRetriedViewAsset";
    /* The anchor must be unique, or the slice below is of whichever came
       first — the sibling-satisfaction trap this repository has paid for. */
    expect(source.split(anchor)).toHaveLength(2);
    /* SLICED TO THE FUNCTION'S OWN BRACES, not to the next `export` — the arm
       above slices to the next export and so carries the NEXT function's
       docblock. Harmless for its `toContain`s; fatal for the COUNTS below,
       where prose two functions away could satisfy or break them. */
    const lines = source.split(/\r?\n/);
    const start = lines.findIndex((line) => line.startsWith(anchor));
    expect(start).toBeGreaterThan(-1);
    const end = lines.findIndex((line, index) => index > start && line === "}");
    expect(end).toBeGreaterThan(start);
    const body = lines.slice(start, end + 1).join("\n");

    /*
      EVERY `return null` IS A NAMED FENCE — and there are TWO of them since
      #1903's review finding 1, not one.

      ⚠ **The rule this arm carries never changed; the population did.** The
      money for a redo sits on the PRESS row and is spent on five slots, so
      "this process still owns the money" needs both proofs: this slot
      `running`, and the press `running`. Both are fences in the precise sense
      the docblock above defines — *another process owns this operation's
      money, so do not refund it* — which is why both may answer `null`.

      ⚠ **ENUMERATED, NOT COUNTED UP TO TWO.** The length is derived from this
      list, so a THIRD `return null` that is not written here reddens rather
      than passing as "one of the fences". A bare count of 2 would have let the
      next bare `return null` in — which is exactly the regression this arm
      exists to catch, one fence later.
    */
    const FENCES = [
      "if (!operation) return null;",
      "if (!press) return null;",
    ] as const;
    for (const fence of FENCES) expect(body).toContain(fence);
    expect(body.match(/return null/g) ?? []).toHaveLength(FENCES.length);

    /* NO blanket catch. This is the road that lost the money: a thrown
       transaction — a lock wait or a deadlock on the `models` row, and a redo
       makes FIVE of those at once — was swallowed into the fence's answer. */
    expect(body).not.toMatch(/\} catch/);

    /* The other two roads throw, by the name that says they are not fences. */
    expect(body.match(/throw new RetriedViewCommitError/g) ?? []).toHaveLength(2);

    /*
      ⚠ **AND THE PRESS FENCE IS PROVEN IN THE STATEMENT THAT WRITES — #1903
      review finding 1, invariant 1's shape.**

      The defect was that a slot's commit fenced on its OWN row and never asked
      whether the row the MONEY sits on was still alive. The sweep refunds a
      press whose lease lapsed before anything committed, the slots then commit
      anyway, and she keeps the new views as well as the 3,250 — nothing claws
      a recorded refund back.

      Three things make the repair the repair rather than a lookalike, so three
      things are pinned:

      1. the press row is read **inside the same transaction**, under
         `.for("update")` — a `SELECT` before this one is the same
         check-then-write race, one lease-expiry wide;
      2. it requires `running` — the whole question;
      3. it is scoped to the same `userId`, so the fence cannot be satisfied by
         somebody else's press (invariant 3's shape on a fence).
    */
    /*
      ⚠ **SLICED TO THE PRESS FENCE'S OWN BRACES, and the first draft of this
      arm was not.** It sliced to the end of the body, so
      `toContain('.for("update")')` was satisfied by the MODEL select two
      statements later — the arm survived a sabotage that removed the press
      fence's own row lock. A whole-slice `toContain` passing on an identical
      line in a neighbouring statement is a trap this repository has paid for
      before; the subject has to be cut out before it is asked about.
    */
    const pressOpen = "    if (input.pressOperationId !== undefined) {";
    const bodyLines = body.split(/\r?\n/);
    const pressStart = bodyLines.findIndex((line) => line === pressOpen);
    expect(pressStart, "the press fence is gone from the commit").toBeGreaterThan(-1);
    const pressEnd = bodyLines.findIndex((line, index) => index > pressStart && line === "    }");
    expect(pressEnd).toBeGreaterThan(pressStart);
    const press = bodyLines.slice(pressStart, pressEnd + 1).join("\n");
    /* The cut must be the fence and nothing after it: the model select that
       follows carries its own `.for("update")`, which is precisely what made
       the first draft inert. */
    expect(press).not.toContain("models");
    expect(press).toContain("eq(generationOperations.id, input.pressOperationId)");
    expect(press).toContain('eq(generationOperations.status, "running")');
    expect(press).toContain("eq(generationOperations.userId, input.userId)");
    expect(press).toContain('.for("update")');
    /* It is INSIDE the transaction: the fence's slice must still be within the
       function body sliced to its own braces above, which it is by
       construction here — and the transaction opens before the first fence, so
       a press read hoisted above `withTransaction` would leave this slice
       without its `.for("update")`. */
    expect(body.indexOf("withTransaction"))
      .toBeLessThan(body.indexOf("if (input.pressOperationId !== undefined) {"));
  });
});

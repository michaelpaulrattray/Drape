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
import { castViewRetrySubjectHash } from "../casting/operationContract";
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

  it("scopes the owner, the Cast and the kind, and excludes a deleted subject", () => {
    const { sql, params } = rendered();
    expect(sql).toContain("`generation_operations`.`userId` = ?");
    expect(sql).toContain("`generation_operations`.`modelId` = ?");
    expect(sql).toContain("`generation_operations`.`kind` = ?");
    expect(sql).toContain("`generation_operations`.`subjectDeletedAt` is null");
    // The kind is asserted as a VALUE: a predicate comparing to the wrong
    // string excludes nothing and every arm above stays green about it.
    expect(params).toContain("castingV2.viewRetry");
    expect(params).toContain(MODEL_ID);
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

/**
 * WHICH ROWS N2b's TWO WRITES CAN REACH — the arms the docblock promised (#1242).
 *
 * # Why this file exists at all
 *
 * `writeCastPersonaDraft`'s docblock said *"`castPersonaWrite.test.ts` drives
 * both directions"* and the file did not exist. That is the sharpest shape of a
 * false claim in otherwise careful prose: the next reader trusts the sentence
 * and never looks, and `suitePointerDiscipline` is the only thing in the tree
 * that would ever have said so. It is written here rather than the sentence
 * being deleted, because the claim is one worth keeping true — these are
 * owner-scoped writes on a customer's own words.
 *
 * # Why the wire and not rows
 *
 * The contract is *which rows can this statement reach*, which is invariant 5's
 * own subject, and `vitest.setup.ts` strips `DATABASE_URL` so a row-level suite
 * SKIPS on the gate and reads green while proving nothing (working law 2). So
 * the predicates are rendered against a pool that never connects and read as
 * SQL — the shape `viewRetryBusy.test.ts` and
 * `accountDeletionOrphanOwnerScope.test.ts` already use in this tree.
 *
 * # What is proven, and the third is the one that outlives the card
 *
 *   1. **the owner is in both predicates** — neither write can reach another
 *      customer's Cast, and neither can reach a deleted one;
 *   2. **the redraft refuses an edited line and her edit does not** — the two
 *      `isNull(…EditedAt)` terms are on the mint's statement and absent from
 *      hers, which is what lets her rewrite a line twice while stopping a
 *      future redraft from deleting what she wrote;
 *   3. **her edit touches ONE line and one stamp** — driven over the DERIVED
 *      set of line kinds, so a third line added to `CAST_PERSONA_FIELDS`
 *      is asserted here with no edit to this file.
 *
 * # ⚠ AND SECTION 4 IS THE ONE THE FIRST THREE COULD NOT GIVE — the relay's
 * finding 6 on PR #2114
 *
 * Sections 1–3 render the PREDICATES. Nothing in them calls the writers, so the
 * sentence they were written to prove — *neither write can reach another
 * customer's Cast* — was never actually tested: replacing
 * `.where(castPersonaEditWhere(...))` with `.where(eq(models.id, …))` inside
 * `editCastPersonaField` dropped the owner from a real money-adjacent write and
 * left every arm above GREEN. **A predicate is not a statement, and the contract
 * is about the statement** (invariant 5, which says exactly that).
 *
 * So section 4 drives `writeCastPersonaDraft` and `editCastPersonaField`
 * themselves, with `getDb` mocked to a pool that records what it is handed and
 * never connects — the shape `accountDeletionOrphanOwnerScope.test.ts` uses on
 * the account purge. What it reads is the SQL those two functions really emit,
 * which is the only reading that can see a predicate swapped out at the call
 * site rather than at its declaration.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { models } from "../../drizzle/schema";
import { CAST_PERSONA_FIELDS } from "./castPersonaField";
import {
  castPersonaEditPatch,
  castPersonaEditWhere,
  castPersonaRedraftWhere,
} from "./castPersonaScope";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

/* Creating a pool under a full-suite run is contended work, even though this
   one never connects — the floor is the tree's, not a guess. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 41;
const MODEL_ID = 907;

/* ------------------------------------- the wire the real writers are driven on */

/** Every statement the writers actually send, in order. */
const sent: Array<{ sql: string; params: unknown[] }> = [];
/** What the driver answers next, so both return values can be driven. */
const answer = { affectedRows: 1 };

/**
 * A client that records and never connects. `query` is the one method drizzle's
 * mysql2 driver reaches for, and it is called in three shapes across versions
 * (string, config object, callback), so all three are read rather than assumed.
 */
const recordingPool = {
  query(...args: unknown[]) {
    const config = args[0] as { sql?: string; values?: unknown[] } | string;
    const sql = typeof config === "string" ? config : config.sql ?? "";
    const params = (args[1] as unknown[])
      ?? (typeof config === "string" ? [] : config.values ?? []);
    sent.push({ sql, params });
    const rows = { ...answer };
    const callback = args.find((argument) => typeof argument === "function") as
      | ((error: unknown, rows: unknown, fields: unknown) => void)
      | undefined;
    if (callback) {
      callback(null, rows, []);
      return undefined;
    }
    return Promise.resolve([rows, []]);
  },
  execute(...args: unknown[]) {
    return (recordingPool as unknown as { query: (...a: unknown[]) => unknown }).query(...args);
  },
};

vi.mock("./connection", () => ({
  getDb: async () => drizzle(recordingPool as never, { mode: "default" } as never),
  /* Neither writer opens a transaction. Refusing rather than stubbing means a
     writer that starts using one arrives here as a loud failure instead of a
     silently unrecorded statement. */
  withTransaction: () => {
    throw new Error("castPersonaWrite.test.ts: no transaction is expected on these two writes");
  },
}));

const { writeCastPersonaDraft, editCastPersonaField } = await import("./castingV2Sign");

beforeEach(() => {
  sent.length = 0;
  answer.affectedRows = 1;
});

/** The one statement the writer under test sent. */
function onlyStatement(): { sql: string; params: unknown[] } {
  expect(sent).toHaveLength(1);
  return sent[0]!;
}

/** Render a predicate as the statement it becomes. Nothing connects. */
function rendered(where: ReturnType<typeof castPersonaEditWhere>) {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  const db = drizzle(pool);
  const { sql, params } = db
    .update(models)
    .set({ personality: "x" })
    .where(where)
    .toSQL();
  void pool.end().catch(() => undefined);
  return { sql, params };
}

const redraft = () => rendered(castPersonaRedraftWhere({ userId: USER_ID, modelId: MODEL_ID }));
const edit = () => rendered(castPersonaEditWhere({ userId: USER_ID, modelId: MODEL_ID }));

/* ------------------------------------------------- 1 · neither write escapes */

describe("both of N2b's writes are scoped to one owner's living Cast", () => {
  it.each([
    ["the mint's redraft", redraft],
    ["her own edit", edit],
  ])("%s names the owner, the Cast and liveness in the statement", (_label, build) => {
    const { sql, params } = build();
    expect(sql).toContain("`models`.`id` = ?");
    expect(sql).toContain("`models`.`userId` = ?");
    expect(sql).toContain("`models`.`deletedAt` is null");
    /*
      THE PARAMETERS, not only the shape. A predicate naming `userId` and
      binding the wrong value reads identically in the SQL and reaches the
      wrong customer — which is the failure these arms exist for.
    */
    expect(params).toContain(USER_ID);
    expect(params).toContain(MODEL_ID);
  });
});

/* ------------------------------- 2 · her words win, and only against the mint */

describe("a redraft never lands on a line she has rewritten", () => {
  it("the mint's statement refuses a Cast with either line edited", () => {
    const { sql } = redraft();
    expect(sql).toContain("`models`.`personalityEditedAt` is null");
    expect(sql).toContain("`models`.`voiceEditedAt` is null");
  });

  /*
    ⚠ THE OPPOSITE DIRECTION, and it is the half a one-sided arm would miss.
    Copying the mint's guard onto her edit would make a line editable exactly
    once — she could never correct her own correction — and every arm above
    would still be green.
  */
  it("HER edit carries neither term, so she may rewrite a line she already wrote", () => {
    const { sql } = edit();
    expect(sql).not.toContain("EditedAt");
  });
});

/* --------------------------------- 3 · one line at a time, over a derived set */

describe("her edit sets one line and one stamp, and leaves the other alone", () => {
  it.each(CAST_PERSONA_FIELDS.map((kind) => [kind] as const))(
    "editing %s writes its own text and its own stamp only",
    (kind) => {
      const now = new Date("2026-10-09T03:00:00.000Z");
      const patch = castPersonaEditPatch(kind, "her own words", now) as Record<string, unknown>;
      const other = kind === "personality" ? "voice" : "personality";

      expect(patch[kind]).toBe("her own words");
      expect(patch[`${kind}EditedAt`]).toBe(now);
      /* The other card keeps its badge. */
      expect(patch).not.toHaveProperty(other);
      expect(patch).not.toHaveProperty(`${other}EditedAt`);
      /*
        AND THE DRAFT STAMP IS NEVER TOUCHED BY AN EDIT. The badge is derived as
        *drafted and not since edited*; moving `personaDraftedAt` here would
        make the derivation answer about the wrong moment.
      */
      expect(patch).not.toHaveProperty("personaDraftedAt");
      expect(Object.keys(patch)).toHaveLength(2);
    },
  );

  it("the two kinds are the whole vocabulary, so a third cannot ship unasserted", () => {
    expect([...CAST_PERSONA_FIELDS]).toEqual(["personality", "voice"]);
  });
});

/* ------------------------------------ 4 · the REAL writers, at the real wire */

describe("the statement `writeCastPersonaDraft` really sends", () => {
  it("names the owner, the Cast, liveness and both unedited stamps, with the right values", async () => {
    await writeCastPersonaDraft({
      userId: USER_ID,
      modelId: MODEL_ID,
      personality: "Watchful, and slower to speak than the room expects.",
      voice: "Low, unhurried; the vowels sit back.",
      now: new Date("2026-10-09T04:00:00.000Z"),
    });

    const { sql, params } = onlyStatement();
    expect(sql).toMatch(/^update `models` set/i);
    expect(sql).toContain("`id` = ?");
    expect(sql).toContain("`userId` = ?");
    expect(sql).toContain("`deletedAt` is null");
    expect(sql).toContain("`personalityEditedAt` is null");
    expect(sql).toContain("`voiceEditedAt` is null");
    /* The owner's id is BOUND, not merely named — a statement naming `userId`
       and binding something else reads identically and reaches the wrong Cast. */
    expect(params).toContain(USER_ID);
    expect(params).toContain(MODEL_ID);
  });

  it("writes the two lines and the draft stamp, and no stamp of hers", async () => {
    await writeCastPersonaDraft({
      userId: USER_ID,
      modelId: MODEL_ID,
      personality: "Watchful.",
      voice: "Low.",
      now: new Date("2026-10-09T04:00:00.000Z"),
    });

    const { sql, params } = onlyStatement();
    const set = sql.slice(0, sql.indexOf(" where "));
    expect(set).toContain("`personality` = ?");
    expect(set).toContain("`voice` = ?");
    expect(set).toContain("`personaDraftedAt` = ?");
    /*
      AND NEITHER OF HER STAMPS IS IN THE `set`. Stamping one here would badge a
      line as HERS the moment we drafted it, and the badge is derived as
      *drafted and not since edited* — so the card would silently lose its
      Drafted mark on a line she has never seen.
    */
    expect(set).not.toContain("`personalityEditedAt` = ?");
    expect(set).not.toContain("`voiceEditedAt` = ?");
    expect(params).toContain("Watchful.");
    expect(params).toContain("Low.");
  });

  it("reports whether a row moved rather than assuming one did", async () => {
    const write = () => writeCastPersonaDraft({
      userId: USER_ID, modelId: MODEL_ID, personality: "a", voice: "b",
    });
    await expect(write()).resolves.toBe(true);
    answer.affectedRows = 0;
    await expect(write()).resolves.toBe(false);
  });
});

describe("the statement `editCastPersonaField` really sends", () => {
  it.each(CAST_PERSONA_FIELDS.map((kind) => [kind] as const))(
    "editing %s names the owner and liveness and carries NO stamp guard",
    async (kind) => {
      await editCastPersonaField({
        userId: USER_ID,
        modelId: MODEL_ID,
        line: kind,
        text: "her own words",
        now: new Date("2026-10-09T04:00:00.000Z"),
      });

      const { sql, params } = onlyStatement();
      expect(sql).toMatch(/^update `models` set/i);
      expect(sql).toContain("`id` = ?");
      expect(sql).toContain("`userId` = ?");
      expect(sql).toContain("`deletedAt` is null");
      /*
        ⚠ THE WHOLE `where` IS READ, not the statement — her text goes in the
        `set`, and a `set` containing the word would make a `not.toContain` arm
        over the whole SQL pass for the wrong reason.
      */
      const where = sql.slice(sql.indexOf(" where "));
      expect(where).not.toContain("EditedAt");
      expect(params).toContain(USER_ID);
      expect(params).toContain(MODEL_ID);
      expect(params).toContain("her own words");
    },
  );

  it.each(CAST_PERSONA_FIELDS.map((kind) => [kind] as const))(
    "editing %s sets that line and that stamp only",
    async (kind) => {
      const other = kind === "personality" ? "voice" : "personality";
      await editCastPersonaField({
        userId: USER_ID, modelId: MODEL_ID, line: kind, text: "her own words",
      });

      const { sql } = onlyStatement();
      const set = sql.slice(0, sql.indexOf(" where "));
      expect(set).toContain(`\`${kind}\` = ?`);
      expect(set).toContain(`\`${kind}EditedAt\` = ?`);
      /* The other card keeps its badge, and the draft stamp is never moved. */
      expect(set).not.toContain(`\`${other}\` = ?`);
      expect(set).not.toContain(`\`${other}EditedAt\` = ?`);
      expect(set).not.toContain("`personaDraftedAt` = ?");
    },
  );

  it("reports false when no row was hers, so the entrance owns the refusal", async () => {
    answer.affectedRows = 0;
    await expect(editCastPersonaField({
      userId: USER_ID, modelId: MODEL_ID, line: "voice", text: "hers",
    })).resolves.toBe(false);
  });

  /*
    THE IDS ARE REFUSED BEFORE THE WIRE. `assertPositiveId` runs first, so a
    zero or a float never becomes a statement at all — asserted here because a
    guard that only exists in the predicate would let a `userId` of 0 bind
    harmlessly and update somebody's row if the column ever allowed it.
  */
  it.each([[0], [-1], [1.5]])("refuses a userId of %s without sending anything", async (userId) => {
    await expect(editCastPersonaField({
      userId, modelId: MODEL_ID, line: "voice", text: "hers",
    })).rejects.toThrow(TypeError);
    expect(sent).toHaveLength(0);
  });
});

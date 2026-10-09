/**
 * WHICH ROWS N2b's TWO WRITES CAN REACH — the arms the docblock promised (#1242).
 *
 * # Why this file exists at all
 *
 * `writeCastPersonaLines`'s docblock said *"`castPersonaWrite.test.ts` drives
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
 *      hers, which is what lets her rewrite a line twice while stopping the
 *      recovery sweep from deleting what she wrote;
 *   3. **her edit touches ONE line and one stamp** — driven over the DERIVED
 *      set of line kinds, so a third line added to `CAST_PERSONA_LINE_KINDS`
 *      is asserted here with no edit to this file.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { models } from "../../drizzle/schema";
import { CAST_PERSONA_LINE_KINDS } from "./castPersonaLineKind";
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
  it.each(CAST_PERSONA_LINE_KINDS.map((kind) => [kind] as const))(
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
    expect([...CAST_PERSONA_LINE_KINDS]).toEqual(["personality", "voice"]);
  });
});

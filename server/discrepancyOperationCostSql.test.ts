/**
 * The operation-cost expression's CORRELATION must be qualified.
 *
 * Drizzle renders a single-table select's columns unqualified, so a
 * correlated subquery written from column references became
 * `WHERE operationId = id` — both names bound to the subquery's own table,
 * the fallback branch always 0, and the discrepancy scan read 5,160 on
 * production against 1,050 in raw SQL (2026-08-26, #119). ⚠ BOTH FIGURES ARE
 * FROM THE SESSION WHOSE 1,050 THE HEADER OF `db/discrepancyQueries.ts` NOW
 * DISPUTES — quote them as that session's readings, never as current. This
 * arm is untouched by the dispute: it pins the generated SQL TEXT, and the
 * qualifier bug is real whatever the absolute numbers were.
 */
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { sql as sqlHelper } from "drizzle-orm";
import mysql from "mysql2/promise";
import { generationOperations, generations } from "../drizzle/schema";
import { EVIDENCE_CANDIDATE_GENERATION_TYPE } from "./casting/evidence/evidenceCandidateContract";
import { OPERATION_COST_SQL, UNLINKED_ROW_SQL } from "./db/discrepancyQueries";

describe("OPERATION_COST_SQL", () => {
  it("correlates the linked rows to the OUTER operation, qualified on both sides", () => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    const db = drizzle(pool);
    const { sql } = db
      .select({ userId: generationOperations.userId, operationCost: OPERATION_COST_SQL.as("operationCost") })
      .from(generationOperations)
      .groupBy(generationOperations.userId)
      .toSQL();

    expect(sql).toContain("WHERE linked.operationId = `generation_operations`.id");
    expect(sql).toContain("FROM `generations` AS linked");
    // The negative shape: an unqualified correlation binds to the subquery's own table.
    expect(sql).not.toMatch(/WHERE `?operationId`? = `?id`?\)/);
    void pool.end().catch(() => undefined);
  });
});

/**
 * #638 — the unlinked side's predicate, proven on the OUTGOING SQL.
 *
 * The exclusion of the parked evidence family is a change to WHICH rows reach
 * `unlinkedCost`, so the generated text is the only place it is visible at all
 * (invariant 5: assert at the wire). The parameter is asserted too, because a
 * predicate that compares `type` to the wrong string excludes nothing and
 * every arithmetic arm in the suite stays green about it.
 */
describe("UNLINKED_ROW_SQL", () => {
  it("counts only rows with no operation, and never the parked evidence family", () => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    const db = drizzle(pool);
    const { sql, params } = db
      .select({ userId: generations.userId })
      .from(generations)
      .where(UNLINKED_ROW_SQL)
      .toSQL();

    // Qualified on both sides, so the predicate is safe wherever it is reused.
    expect(sql).toContain("`generations`.`operationId` IS NULL");
    expect(sql).toContain("`generations`.`type` <> ?");
    // The family is named by the constant its own writers use, never re-typed.
    expect(params).toContain(EVIDENCE_CANDIDATE_GENERATION_TYPE);
    void pool.end().catch(() => undefined);
  });

  it("is the SAME expression the all-users scan aggregates, so the page cannot disagree with it", () => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    const db = drizzle(pool);

    // The scan's shape: the predicate inside a CASE inside an aggregate.
    const scan = db
      .select({
        unlinkedCost: sqlHelper`COALESCE(SUM(CASE WHEN ${UNLINKED_ROW_SQL} THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("unlinkedCost"),
      })
      .from(generations)
      .groupBy(generations.userId)
      .toSQL();

    expect(scan.sql).toContain("`generations`.`operationId` IS NULL");
    expect(scan.sql).toContain("`generations`.`type` <> ?");
    expect(scan.params).toContain(EVIDENCE_CANDIDATE_GENERATION_TYPE);
    void pool.end().catch(() => undefined);
  });
});

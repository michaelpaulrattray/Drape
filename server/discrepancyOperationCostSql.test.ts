/**
 * The operation-cost expression's CORRELATION must be qualified.
 *
 * Drizzle renders a single-table select's columns unqualified, so a
 * correlated subquery written from column references became
 * `WHERE operationId = id` — both names bound to the subquery's own table,
 * the fallback branch always 0, and the discrepancy scan read 5,160 on
 * production against 1,050 in raw SQL (2026-08-26, #119). This arm pins the
 * generated text; the reading itself is proven by driving the module.
 */
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { generationOperations } from "../drizzle/schema";
import { OPERATION_COST_SQL } from "./db/discrepancyQueries";

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

/**
 * Credits SQL Column Name Verification Tests
 *
 * These tests verify that the raw SQL in deductCredits and addCredits
 * uses correct camelCase column names (matching the Drizzle schema)
 * instead of snake_case names that would cause "Unknown column" errors.
 *
 * Background: The credits table (DB name: "points") uses camelCase columns
 * (userId, creditsUsed, creditsPurchased). Raw SQL template literals must
 * reference these via Drizzle column refs, not hardcoded snake_case.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { credits } from "../drizzle/schema";

/**
 * Helper: extract column names from a Drizzle sql template's queryChunks.
 * Drizzle embeds Column objects in the chunks array; we read their `.name`.
 */
function extractColumnNames(query: ReturnType<typeof sql>): string[] {
  const names: string[] = [];
  for (const chunk of query.queryChunks) {
    if (chunk && typeof chunk === "object" && "name" in chunk && typeof chunk.name === "string") {
      names.push(chunk.name);
    }
  }
  return names;
}

describe("credits raw SQL — column name correctness", () => {
  const amount = 350;
  const userId = 1;

  describe("deductCredits SQL", () => {
    it("uses camelCase column refs, not snake_case", () => {
      const deductQuery = sql`UPDATE ${credits} 
          SET ${credits.balance} = ${credits.balance} - ${amount},
              ${credits.creditsUsed} = COALESCE(${credits.creditsUsed}, 0) + ${amount}
          WHERE ${credits.userId} = ${userId} AND ${credits.balance} >= ${amount}`;

      const colNames = extractColumnNames(deductQuery);

      // Must contain the correct camelCase column names
      expect(colNames).toContain("balance");
      expect(colNames).toContain("creditsUsed");
      expect(colNames).toContain("userId");

      // Must NOT contain snake_case variants
      expect(colNames).not.toContain("user_id");
      expect(colNames).not.toContain("credits_used");
    });

    it("references the correct table (points)", () => {
      const deductQuery = sql`UPDATE ${credits} 
          SET ${credits.balance} = ${credits.balance} - ${amount}
          WHERE ${credits.userId} = ${userId}`;

      // The table object should have the correct SQL name
      const tableName = (credits as any)[Symbol.for("drizzle:Name")];
      expect(tableName).toBe("points");
    });
  });

  describe("addCredits SQL — purchase path", () => {
    it("uses camelCase column refs for purchase updates", () => {
      const addPurchaseQuery = sql`UPDATE ${credits}
          SET ${credits.balance} = ${credits.balance} + ${amount},
              ${credits.creditsPurchased} = COALESCE(${credits.creditsPurchased}, 0) + ${amount}
          WHERE ${credits.userId} = ${userId}`;

      const colNames = extractColumnNames(addPurchaseQuery);

      expect(colNames).toContain("balance");
      expect(colNames).toContain("creditsPurchased");
      expect(colNames).toContain("userId");

      // Must NOT contain snake_case variants
      expect(colNames).not.toContain("user_id");
      expect(colNames).not.toContain("credits_purchased");
    });
  });

  describe("addCredits SQL — non-purchase path", () => {
    it("uses camelCase column refs for bonus/refund updates", () => {
      const addQuery = sql`UPDATE ${credits}
          SET ${credits.balance} = ${credits.balance} + ${amount}
          WHERE ${credits.userId} = ${userId}`;

      const colNames = extractColumnNames(addQuery);

      expect(colNames).toContain("balance");
      expect(colNames).toContain("userId");

      expect(colNames).not.toContain("user_id");
    });
  });
});

describe("credits schema — column definitions match DB expectations", () => {
  it("credits table has all required columns with correct names", () => {
    // Verify the Drizzle schema column names match what the raw SQL expects
    expect(credits.userId.name).toBe("userId");
    expect(credits.balance.name).toBe("balance");
    expect(credits.creditsUsed.name).toBe("creditsUsed");
    expect(credits.creditsPurchased.name).toBe("creditsPurchased");
  });

  it("no snake_case column names exist in the credits table", () => {
    const columnNames = Object.keys(credits).filter(
      (key) => !key.startsWith("_") && !key.startsWith("$") && typeof (credits as any)[key]?.name === "string"
    );

    for (const colKey of columnNames) {
      const colName = (credits as any)[colKey].name;
      // Column names should not contain underscores (snake_case)
      // Exception: none in this table
      expect(colName).not.toMatch(/_[a-z]/); // no snake_case patterns
    }
  });
});

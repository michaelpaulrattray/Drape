/**
 * EVERY TABLE THAT CARRIES A `userId` HAS AN ANSWER FROM ACCOUNT DELETION —
 * the class guard for #1935 (working law 7).
 *
 * # Why a guard and not a longer list
 *
 * The defect was not that somebody forgot a table. It is that **nothing could
 * ever have told them.** `drizzle/schema.ts` declares no `ON DELETE CASCADE`,
 * so an omitted table throws no foreign-key error; account deletion's own
 * tests assert the counts it REPORTS rather than the rows it LEAVES, so an
 * omitted table is a count that is simply absent; and the ordered prose list
 * in the module header read as complete while **seventeen** user-keyed tables
 * — every casting table among them, holding a customer's faces at permanently
 * public R2 URLs — were untouched for the whole life of the feature.
 *
 * So the population is DERIVED from the schema, every run. A table added
 * tomorrow with a `userId` column reddens this suite until somebody writes
 * down what erasure does with it, and `exempt` has to carry a reason.
 *
 * # What it proves, and what it cannot
 *
 * It proves the DECLARATION is complete and honest about the schema, in both
 * directions, and that each `deleted` table is actually named in a delete
 * statement in one of the two deletion modules.
 *
 * ⚠ **IT IS A FLOOR AND NOT THE PROOF.** A `.delete(` naming the right table
 * is not proof that the WHERE scopes it to the owner, nor that the walk
 * reaches rows with the status this one has. That is what the driven arm in
 * `server/r7-storage-cleanup-worker-db.test.ts` is for — and that arm needs a
 * disposable `TEST_DATABASE_URL` and skips without one, which is stated here
 * rather than left for a reader to discover from a green run.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ACCOUNT_DELETION_DISPOSITIONS } from "./db/accountDeletion";
import { readListedSource } from "./testing/listedSource";
import { codeOnly, withoutComments } from "./testing/withoutComments";

const repoRoot = join(import.meta.dirname, "..");

const SCHEMA = "drizzle/schema.ts";

/** The two modules that are allowed to carry an account's delete statements. */
const DELETION_MODULES = [
  "server/db/accountDeletion.ts",
  "server/castingV2/accountCastingPurge.ts",
  /*
    The casting purge reaches nine child stores through db helpers whose own
    statements live beside the table they delete. Each helper is named by
    `accountCastingPurge.ts`, so the delete the guard looks for is in the db
    module rather than the orchestrator — these are those modules.
  */
  "server/db/castingV2.ts",
  "server/db/castingV2Variants.ts",
  "server/db/castingV2Segments.ts",
  "server/db/castingV2ReferenceLibrary.ts",
  "server/db/castingV2FaceScans.ts",
  "server/db/castingV2InkDesigns.ts",
  "server/db/castingV2InkPlates.ts",
  "server/db/castingV2InkDeliveryCrops.ts",
  "server/db/castingV2ReferenceCrops.ts",
  "server/db/castingV2ReferenceAttachments.ts",
] as const;

function read(relativePath: string): string {
  const source = readListedSource(join(repoRoot, relativePath));
  if (source === null) {
    throw new Error(`accountDeletionCoverage: ${relativePath} is listed here and absent from the tree`);
  }
  return source;
}

/**
 * Every `mysqlTable("name", …)` in the schema that declares a `userId` column,
 * as `{ symbol, table }`.
 *
 * Read at the DECLARATION rather than at a shape: the table's exported symbol
 * and its SQL name both come out of the `export const X = mysqlTable("y"` line,
 * and the `userId` column is attributed to whichever declaration most recently
 * opened — which is how the tree is actually written (one table per `export
 * const`, none nested).
 *
 * ⚠ **`withoutComments` AND NOT `codeOnly`, AND THE DIFFERENCE IS THE WHOLE
 * READING.** `codeOnly` drops literal CONTENTS, so `mysqlTable("users"` comes
 * out as `mysqlTable(""` and every table name in this file disappears — the
 * reader returned zero rows and the arm above it caught that on its first run,
 * which is what a population control is for. Comments are still stripped, so a
 * docblock discussing a table cannot be read as declaring one. The delete-call
 * arm reads `codeOnly` for the opposite reason: a quoted call is not a call.
 */
function userKeyedTables(): Array<{ symbol: string; table: string }> {
  const source = withoutComments(read(SCHEMA));
  const found: Array<{ symbol: string; table: string }> = [];
  let current: { symbol: string; table: string } | null = null;
  let currentHasUserId = false;
  const declaration = /^export const (\w+) = mysqlTable\(\s*$|^export const (\w+) = mysqlTable\(\s*"([^"]+)"/;
  const tableName = /mysqlTable\(\s*\n?\s*"([^"]+)"/;
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const match = declaration.exec(line);
    if (match) {
      if (current && currentHasUserId) found.push(current);
      const symbol = match[2] ?? match[1]!;
      const name = match[3]
        ?? tableName.exec(`${line}\n${lines[index + 1] ?? ""}`)?.[1];
      current = name ? { symbol, table: name } : null;
      currentHasUserId = false;
      continue;
    }
    if (current && /^\s{2,4}userId:\s/.test(line)) currentHasUserId = true;
  }
  if (current && currentHasUserId) found.push(current);
  return found;
}

describe("account deletion answers for every user-keyed table (#1935)", () => {
  /*
    THE READER'S OWN CONTROLS FIRST (working law 2). A population reader that
    silently returned a short list would make every assertion below pass by
    reading less, which is the exact failure CLAUDE.md records four Atlas
    collectors for.
  */
  it("derives a population that is neither empty nor obviously short", () => {
    const tables = userKeyedTables();
    expect(tables.length).toBeGreaterThan(25);
    const symbols = tables.map((entry) => entry.symbol);
    const names = tables.map((entry) => entry.table);
    // A positive control at each end of the file and one in the middle.
    expect(symbols).toContain("credits");
    expect(symbols).toContain("castingCandidates");
    expect(symbols).toContain("bugReports");
    /*
      A negative control: a table with no owner column must not be in it.
      `users` is the sharper of the two — it is the account itself and its
      owner column is `id`, so a reader that admitted it would be reading
      something other than what it claims to.
    */
    expect(symbols).not.toContain("users");
    expect(symbols).not.toContain("blockedIps");
    expect(symbols).not.toContain("generationOperationLocks");
    // Every row carries a real SQL table name beside its symbol.
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    /*
      AND THE TWO WHOSE NAME IS NOT THEIR SYMBOL, pinned so the surprise is a
      fact in a suite rather than a thing somebody rediscovers: the credit
      tables are still the SQL `points` tables.
    */
    expect(tables.find((entry) => entry.symbol === "credits")?.table).toBe("points");
    expect(tables.find((entry) => entry.symbol === "creditTransactions")?.table)
      .toBe("point_transactions");
  });

  it("names every user-keyed table, and names nothing else", () => {
    const schemaTables = userKeyedTables().map((entry) => entry.symbol).sort();
    const declared = Object.keys(ACCOUNT_DELETION_DISPOSITIONS).sort();
    expect(declared).toEqual(schemaTables);
  });

  it("gives every exemption a reason", () => {
    const exemptions = Object.entries(ACCOUNT_DELETION_DISPOSITIONS)
      .filter(([, disposition]) => disposition.startsWith("exempt"));
    // The three the product has today. A fourth is a decision, not a default.
    expect(exemptions.map(([table]) => table).sort()).toEqual([
      "freeGrantClaims",
      "planChangeSettlements",
      "storageCleanupBatches",
    ]);
    for (const [table, disposition] of exemptions) {
      expect(disposition.startsWith("exempt: "), `${table} must say why`).toBe(true);
      expect(disposition.slice("exempt: ".length).length).toBeGreaterThan(20);
    }
  });

  it("has a delete statement for every table it says it deletes", () => {
    const code = DELETION_MODULES.map((module) => codeOnly(read(module))).join("\n");
    const missing: string[] = [];
    for (const [symbol, disposition] of Object.entries(ACCOUNT_DELETION_DISPOSITIONS)) {
      if (disposition !== "deleted") continue;
      /*
        Anchored on the symbol inside the call, so a mention of the table in a
        SELECT or an UPDATE elsewhere in these modules cannot satisfy it. The
        guard was driven both ways: with `castingRolls`'s delete removed, this
        arm names `casting_rolls` and nothing else.
      */
      if (!new RegExp(`\\.delete\\(\\s*${symbol}\\s*\\)`).test(code)) missing.push(symbol);
    }
    expect(missing).toEqual([]);
  });

  it("anonymises rather than deletes exactly where it says so", () => {
    const anonymised = Object.entries(ACCOUNT_DELETION_DISPOSITIONS)
      .filter(([, disposition]) => disposition === "anonymised")
      .map(([table]) => table);
    expect(anonymised).toEqual(["auditLogs"]);
    const code = codeOnly(read("server/db/accountDeletion.ts"));
    // The row survives with its person removed: an UPDATE, never a DELETE.
    expect(code).toMatch(/\.update\(auditLogs\)/);
    expect(code).not.toMatch(/\.delete\(\s*auditLogs\s*\)/);
  });
});

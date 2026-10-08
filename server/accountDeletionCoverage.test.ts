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
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  wardrobeGarments,
  wardrobeLooks,
  wardrobeOutfits,
  wardrobeSessions,
} from "../drizzle/schema";
import {
  ACCOUNT_DELETION_DISPOSITIONS,
  collectAccountOwnedStorageItemsIn,
  wardrobeOwnedKeyPrefixes,
} from "./db/accountDeletion";
import type { TransactionHandle } from "./db/connection";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { codeOnly, withoutComments } from "./testing/withoutComments";

/* Reads thirteen files off the real tree, so it is in #741's class. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

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
 * ⚠ **A COLUMN NAMES A USER BY ITS ROLE, NOT BY BEING SPELLED `userId`
 * (#1948 M2).**
 *
 * This reader matched `/^\s{2,4}userId:\s/` and nothing else, so a user id
 * under any other name was invisible: the table was not in the population, so
 * it was neither declared deleted nor declared exempt, **and the guard could
 * not see that it was missing.** That is #1935's own silence one level down —
 * the thing this suite exists to make impossible, reproduced by the reader
 * rather than by the map.
 *
 * Measured at the tree the day it was widened: the old rule saw **35** tables;
 * the rule below sees **49 columns**, so fourteen were unanswerable. Among
 * them `referrals.referredUserId` — a deleted customer's row surviving on
 * somebody else's referral, with her email and IP still on it.
 *
 * **The rule, and why each half of it is there:**
 *
 * - **It reads the declared TYPE, and only `int(` counts.** A Drape user id is
 *   an `int`. Two columns in the tree end in `By` and are not: `users.frozenBy`
 *   is a varchar holding `"system"` or a moderator id as text, and
 *   `emergencyTokens.usedBy` is a **Slack** user id, which is not a user of
 *   this product at all (Slack was retired in #800). Reading the type is what
 *   keeps both out without a list of exceptions.
 * - **`user` anywhere in the name, case-insensitive** — `userId`,
 *   `targetUserId`, `referredByUserId`, `authorUserId`, `markedByUserId`.
 * - **or a name ending `By` / `ById`** — the actor columns: `createdBy`,
 *   `submittedById`, `blockedBy`, `suspendedBy`, `reviewedById`,
 *   `uploadedById`. Measured across all **291** int columns in the schema,
 *   that clause has **zero** false positives: every int column ending `By` or
 *   `ById` in this tree is a user reference.
 *
 * Returned as `{ symbol, table, column }` so the map can be keyed on
 * `table.column` — a table may have several (`changeRequests` has three) and a
 * table-level answer cannot say different things about them.
 *
 * ⚠ **`withoutComments` AND NOT `codeOnly`, AND THE DIFFERENCE IS THE WHOLE
 * READING.** `codeOnly` drops literal CONTENTS, so `mysqlTable("users"` comes
 * out as `mysqlTable(""` and every table name in this file disappears — the
 * reader returned zero rows and the arm above it caught that on its first run,
 * which is what a population control is for. Comments are still stripped, so a
 * docblock discussing a table cannot be read as declaring one. The delete-call
 * arm reads `codeOnly` for the opposite reason: a quoted call is not a call.
 */
export function columnNamesAUser(column: string, declaration: string): boolean {
  if (!/^int\(/.test(declaration.trim())) return false;
  return /user/i.test(column) || /By$|ById$/.test(column);
}

function userKeyedColumns(): Array<{ symbol: string; table: string; column: string }> {
  const source = withoutComments(read(SCHEMA));
  const found: Array<{ symbol: string; table: string; column: string }> = [];
  let current: { symbol: string; table: string } | null = null;
  const declaration = /^export const (\w+) = mysqlTable\(\s*$|^export const (\w+) = mysqlTable\(\s*"([^"]+)"/;
  const tableName = /mysqlTable\(\s*\n?\s*"([^"]+)"/;
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const match = declaration.exec(line);
    if (match) {
      const symbol = match[2] ?? match[1]!;
      const name = match[3]
        ?? tableName.exec(`${line}\n${lines[index + 1] ?? ""}`)?.[1];
      current = name ? { symbol, table: name } : null;
      continue;
    }
    const column = /^\s{2,4}(\w+):\s*(.*)$/.exec(line);
    if (current && column && columnNamesAUser(column[1]!, column[2]!)) {
      found.push({ ...current, column: column[1]! });
    }
  }
  return found;
}

/** The distinct tables those columns live in — for the population controls. */
function userKeyedTables(): Array<{ symbol: string; table: string }> {
  const seen = new Map<string, { symbol: string; table: string }>();
  for (const row of userKeyedColumns()) {
    if (!seen.has(row.symbol)) seen.set(row.symbol, { symbol: row.symbol, table: row.table });
  }
  return [...seen.values()];
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
      ⚠ A NEGATIVE CONTROL THAT CHANGED SIDES, AND SAYING SO IS THE POINT
      (#1948 M2). It read `expect(symbols).not.toContain("users")` and
      `.not.toContain("blockedIps")`, on the correct ground that neither has a
      `userId` column. Both DO carry a column that names a user —
      `users.referredByUserId` and `blockedIps.blockedBy` — and the old reader
      could not see either, which is the defect. They are in the population
      now and each has a declared answer, so the control that remains is the
      one that was never about spelling: a table with no user reference at all
      must still be absent.
    */
    expect(symbols).not.toContain("generationOperationLocks");
    expect(symbols).not.toContain("emergencyTokens");
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

  it("⚠ the two varchar actor columns stay OUT, and that is the type rule earning its place", () => {
    /*
      `users.frozenBy` holds `"system"` or a moderator id as TEXT, and
      `emergencyTokens.usedBy` holds a SLACK user id — not a user of this
      product at all, and Slack was retired in #800. Both end in `By`, so only
      reading the declared type keeps them out; without it the map would owe a
      decision about two columns that hold no Drape user id.
    */
    expect(columnNamesAUser("frozenBy", 'varchar("frozenBy", { length: 64 }),')).toBe(false);
    expect(columnNamesAUser("usedBy", 'varchar("usedBy", { length: 128 }),')).toBe(false);
    // And the positive side of the same rule, so it is not passing by refusing everything.
    expect(columnNamesAUser("usedBy", 'int("usedBy"),')).toBe(true);
    expect(columnNamesAUser("userId", 'int("userId").notNull(),')).toBe(true);
    expect(columnNamesAUser("referredByUserId", 'int("referredByUserId"),')).toBe(true);
    // A column that names no user is out whatever its type.
    expect(columnNamesAUser("modelId", 'int("modelId").notNull(),')).toBe(false);
    expect(columnNamesAUser("creditsAwarded", 'int("creditsAwarded").default(0),')).toBe(false);
  });

  it("names every column that names a user, and names nothing else", () => {
    const schemaColumns = userKeyedColumns()
      .map((entry) => `${entry.symbol}.${entry.column}`)
      .sort();
    const declared = Object.keys(ACCOUNT_DELETION_DISPOSITIONS).sort();
    expect(declared).toEqual(schemaColumns);
  });

  it("gives every exemption a reason", () => {
    const exemptions = Object.entries(ACCOUNT_DELETION_DISPOSITIONS)
      .filter(([, disposition]) => disposition.startsWith("exempt"));
    /*
      ⚠ THREE BECAME ELEVEN, AND EIGHT OF THE EIGHT NEW ONES ARE A STAFF
      ACTOR'S ID ON SOMEBODY ELSE'S RECORD (#1948 M2) — not the deleting
      customer's data under another name. They are enumerated rather than
      counted, so a ninth is a decision somebody had to type here.
    */
    expect(exemptions.map(([column]) => column).sort()).toEqual([
      "announcements.createdBy",
      "blockedIps.blockedBy",
      "changeRequestAttachments.uploadedById",
      "changeRequests.reviewedById",
      "crewCardIntents.markedByUserId",
      "crewReplies.authorUserId",
      "crewWorkSwitches.changedByUserId",
      "freeGrantClaims.userId",
      "inviteCodes.createdBy",
      "planChangeSettlements.userId",
      "storageCleanupBatches.userId",
      "users.suspendedBy",
    ]);
    for (const [column, disposition] of exemptions) {
      expect(disposition.startsWith("exempt: "), `${column} must say why`).toBe(true);
      expect(disposition.slice("exempt: ".length).length).toBeGreaterThan(20);
    }
  });

  it("has a delete statement for every table it says it deletes", () => {
    const code = DELETION_MODULES.map((module) => codeOnly(read(module))).join("\n");
    const missing: string[] = [];
    for (const [key, disposition] of Object.entries(ACCOUNT_DELETION_DISPOSITIONS)) {
      if (disposition !== "deleted") continue;
      const symbol = key.slice(0, key.indexOf("."));
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

  it("⚠ every key read in the collector is a LOCKING read, or a declared exception", () => {
    /*
      #1948 L2. A plain `SELECT` inside a REPEATABLE READ transaction reads the
      snapshot taken when the transaction began; the `DELETE`s act on the
      latest rows. So a render still finishing during an erasure could commit
      its key AFTER the read — the row is deleted and **its key never enters
      the manifest**, leaving the object at a permanently public URL with the
      last pointer to it gone.

      ⚠ **THE ARM IS DERIVED FROM THE FUNCTION'S OWN BODY, NOT A COUNT.** A
      count would pass a new unlocked read being added beside a locked one,
      which is exactly the shape of the regression worth catching: the whole
      defect was a reader somebody added without thinking about the snapshot.
      Every `await tx` statement in the collector is found and each must carry
      the lock or be one of the two exceptions named here with its reason.
    */
    /* ⚠ withoutComments, NOT codeOnly: codeOnly empties string literals, so
       `.for("update")` reads back as `.for("")` and every statement below looks
       unlocked. Comments are still stripped, so prose about a lock cannot stand
       in for one — which is the property that actually matters here. */
    const source = withoutComments(read("server/db/accountDeletion.ts"));
    const open = "export async function collectAccountOwnedStorageItemsIn(";
    const start = source.indexOf(open);
    expect(start, "the collector moved — this arm is reading nothing").toBeGreaterThan(-1);
    const end = source.indexOf("\nfunction byBackendThenKey(", start);
    expect(end, "the collector's closing anchor moved").toBeGreaterThan(start);
    const body = source.slice(start, end);

    /* Each `await tx` begins a statement; it ends at the first `;`. */
    const reads = body
      .split("await tx")
      .slice(1)
      .map((chunk) => chunk.slice(0, chunk.indexOf(";")))
      .filter((chunk) => chunk.includes(".select("));
    expect(reads.length, "no reads were found in the collector — the arm is blind")
      .toBeGreaterThan(10);

    /*
      THE TWO THAT DO NOT LOCK, each for a reason this suite states rather
      than tolerates: the cleanup-manifest read touches tables this deletion
      does not delete (`storageCleanupBatches` is exempt), and locking them
      would hold rows the cleanup worker is walking.
    */
    const unlocked = reads.filter((statement) => !statement.includes('.for("update")'));
    for (const statement of unlocked) {
      expect(
        statement.includes("storageCleanupItems") && statement.includes("storageCleanupBatches"),
        "a read in the collector does not lock and is not the declared manifest exception —"
          + " a render committing a key after it would leave the object up forever:"
          + ` ${statement.replace(/\s+/g, " ").slice(0, 160)}`,
      ).toBe(true);
    }
    expect(unlocked.length, "the declared exception is the manifest read, and there is one")
      .toBe(1);

    /*
      AND THE CASTING SIDE, whose candidate reader lives in another module:
      the nine child stores are reached through this one row, and their own
      readers are shared with the retention sweep and deliberately untouched.
    */
    const casting = withoutComments(read("server/db/castingV2.ts"));
    const listAccount = casting.slice(casting.indexOf("export async function listAccountCandidatesIn"));
    expect(
      listAccount.slice(0, listAccount.indexOf("\n}")),
      "the account's candidate read stopped locking — a candidate whose imageKey commits"
        + " mid-erasure is deleted with its key uncollected",
    ).toContain('.for("update")');
  });

  it("anonymises rather than deletes exactly where it says so", () => {
    const anonymised = Object.entries(ACCOUNT_DELETION_DISPOSITIONS)
      .filter(([, disposition]) => disposition === "anonymised")
      .map(([column]) => column)
      .sort();
    expect(anonymised).toEqual([
      "auditLogs.userId",
      "referrals.referredUserId",
      "users.referredByUserId",
    ]);
    const code = codeOnly(read("server/db/accountDeletion.ts"));
    // The row survives with its person removed: an UPDATE, never a DELETE.
    expect(code).toMatch(/\.update\(auditLogs\)/);
    expect(code).not.toMatch(/\.delete\(\s*auditLogs\s*\)/);
    /*
      ⚠ THE TWO ADDED BY #1948 ARE PINNED AT THE COLUMN THEY CLEAR, not just
      at the UPDATE. `referrals` is already DELETED by this function on the
      other predicate (`referrerUserId`), so a bare "there is an update on
      referrals" would be satisfied by almost anything; what the decision
      actually says is that a row somebody else owns loses the erasing
      customer's id AND the two details of hers it carries.
    */
    expect(code).toMatch(/\.update\(referrals\)/);
    expect(code).toMatch(/referredUserId:\s*null/);
    expect(code).toMatch(/referredEmail:\s*null/);
    expect(code).toMatch(/referredIp:\s*null/);
    expect(code).toMatch(/\.where\(eq\(referrals\.referredUserId,\s*userId\)\)/);
    expect(code).toMatch(/referredByUserId:\s*null/);
    expect(code).toMatch(/\.where\(eq\(users\.referredByUserId,\s*userId\)\)/);
  });
});

/*
  #2020 — THE WARDROBE'S PICTURES, DRIVEN THROUGH THE REAL COLLECTOR.

  `collectAccountOwnedStorageItemsIn` is run as erasure runs it, over a
  transaction that answers each table's read with the rows given here (every
  other table answers empty). The arms assert on the manifest it returns — the
  deletion set itself — never on a constant near it.
*/
const PUBLIC = "https://pub-test.r2.dev";
const ME = 41;
const OTHER = 77;

function fakeTx(rowsByTable: Map<unknown, unknown[]>): TransactionHandle {
  return {
    select() {
      let table: unknown;
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "limit", "for", "innerJoin", "orderBy"]) {
        chain[method] = () => chain;
      }
      chain.from = (source: unknown) => {
        table = source;
        return chain;
      };
      chain.then = (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(rowsByTable.get(table) ?? []).then(resolve, reject);
      return chain;
    },
  } as unknown as TransactionHandle;
}

function garmentRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    userId: ME,
    originalImageUrl: `${PUBLIC}/${ME}-wardrobe/original-1-a.png`,
    originalImageKey: `${ME}-wardrobe/original-1-a.png`,
    isolatedImageUrl: null,
    isolatedImageKey: null,
    sourceImageUrl: null,
    sourceImageKey: null,
    ...overrides,
  };
}

async function publicKeysFor(tables: Map<unknown, unknown[]>): Promise<string[]> {
  const items = await collectAccountOwnedStorageItemsIn(fakeTx(tables), ME, PUBLIC);
  return items.filter((item) => item.storageBackend === "public_r2").map((item) => item.storageKey);
}

describe("an erasure removes the wardrobe's pictures, and only this account's (#2020)", () => {
  it("✅ a digitized flat-lay with a URL and no key is in the deletion set", async () => {
    const flatLay = `wardrobe/${ME}/flat-lays/1700000000000-abc.png`;
    const keys = await publicKeysFor(new Map([[wardrobeGarments, [garmentRow({
      isolatedImageUrl: `${PUBLIC}/${flatLay}`,
      isolatedImageKey: null,
    })]]]));
    expect(keys).toContain(flatLay);
    // The keyed original still arrives by its key, so the reader is not URL-only.
    expect(keys).toContain(`${ME}-wardrobe/original-1-a.png`);
  });

  it("✅ an imported garment's URL-only original and source, under her own prefix, are in it too", async () => {
    const crop = `${ME}-wardrobe/decomposed/top-1.png`;
    const source = `${ME}-wardrobe/decompose-1-b.png`;
    const keys = await publicKeysFor(new Map([[wardrobeGarments, [garmentRow({
      originalImageUrl: `${PUBLIC}/${crop}`,
      originalImageKey: null,
      sourceImageUrl: `${PUBLIC}/${source}`,
    })]]]));
    expect(keys).toEqual(expect.arrayContaining([crop, source]));
  });

  it("✅ looks, outfits and try-on history under her prefix are still swept by URL", async () => {
    const look = `wardrobe/${ME}/vto-results/look.png`;
    const thumb = `wardrobe/${ME}/vto-results/thumb.png`;
    const step = `wardrobe/${ME}/vto-results/step.png`;
    const keys = await publicKeysFor(new Map<unknown, unknown[]>([
      [wardrobeLooks, [{ imageUrl: `${PUBLIC}/${look}` }]],
      [wardrobeOutfits, [{ resultThumbKey: null, resultThumbUrl: `${PUBLIC}/${thumb}` }]],
      [wardrobeSessions, [{ history: JSON.stringify([`${PUBLIC}/${step}`]) }]],
    ]));
    expect(keys).toEqual(expect.arrayContaining([look, thumb, step]));
  });

  it("⚠ a URL the customer typed cannot make an erasure delete somebody else's picture", async () => {
    /*
      `garments.import`, `looks.save`, `outfits.save` and `sessions.update`
      each store a URL the CLIENT sends. Every one below is a URL a customer
      could have typed into one of those rows; none may become a deletion key.
    */
    const typed = [
      `${PUBLIC}/wardrobe/${OTHER}/flat-lays/theirs.png`, //  another customer's wardrobe
      `${PUBLIC}/${OTHER}-wardrobe/original-1-c.png`, //      her other prefix
      `${PUBLIC}/wardrobe/${ME}1/flat-lays/theirs.png`, //    a longer id that begins with mine
      `${PUBLIC}/${ME}1-wardrobe/original-1-d.png`, //        and the other prefix's version of it
      `${PUBLIC}/casting/v2/candidates/someone-else.png`, //  a cast's picture on the same bucket
      `${PUBLIC}/wardrobe/${ME}/../${OTHER}/flat-lays/x.png`, // a dot-segment climb
      `${PUBLIC}/wardrobe/${ME}/%2e%2e/${OTHER}/x.png`, //     the encoded climb
      `https://files.manuscdn.com/wardrobe/${ME}/flat-lays/legacy.png`, // legacy host
      `https://d1abc.cloudfront.net/wardrobe/${ME}/flat-lays/legacy.png`, // legacy host
      `https://example.com/wardrobe/${ME}/flat-lays/elsewhere.png`, //      any other origin
    ];
    const keys = await publicKeysFor(new Map<unknown, unknown[]>([
      [wardrobeGarments, typed.map((url, index) => garmentRow({
        id: index + 1,
        originalImageUrl: url,
        originalImageKey: null,
        isolatedImageUrl: url,
        sourceImageUrl: url,
      }))],
      [wardrobeLooks, typed.map((imageUrl) => ({ imageUrl }))],
      [wardrobeOutfits, typed.map((resultThumbUrl) => ({ resultThumbKey: null, resultThumbUrl }))],
      [wardrobeSessions, [{ history: JSON.stringify(typed) }]],
    ]));
    expect(keys).toEqual([]);
  });

  it("names the two prefixes the wardrobe writers actually use", () => {
    /*
      A mirror of the writers' prefixes is a mirror (working law 4), so it is
      pinned against the writers' own source: if a writer moves its pictures,
      this arm reddens rather than the erasure silently starting to leak them.
    */
    expect(wardrobeOwnedKeyPrefixes(ME)).toEqual([`wardrobe/${ME}/`, `${ME}-wardrobe/`]);
    const writers = [
      "server/wardrobe/garmentDigitization.ts",
      "server/wardrobe/garmentRefinement.ts",
      "server/wardrobe/vtoGeneration.ts",
      "server/wardrobe/outfitDecomposition.ts",
      "server/routes/wardrobe.ts",
    ].map((module) => withoutComments(read(module))).join("\n");
    const prefixes = [...writers.matchAll(/`(wardrobe\/\$\{[^}]+\}\/|\$\{[^}]+\}-wardrobe\/)/g)]
      .map((match) => match[1]!.replace(/\$\{[^}]+\}/, "<id>"));
    expect(prefixes.length, "the writers' prefixes were not found — the arm is blind").toBeGreaterThan(5);
    expect(new Set(prefixes)).toEqual(new Set(["wardrobe/<id>/", "<id>-wardrobe/"]));
  });
});

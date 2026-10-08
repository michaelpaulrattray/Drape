/**
 * EVERY TABLE ACCOUNT DELETION SAYS IT DELETES IS REACHED BY `deleteUserAccount`
 * ITSELF — #1948 M1.
 *
 * # The hole this closes, and why the guard beside it could not
 *
 * `server/accountDeletionCoverage.test.ts` proves the DECLARATION is complete
 * against the schema, and that each `deleted` table is named in a
 * `.delete(table)` **somewhere in twelve modules**. That is a source read, and
 * it was never a claim about reachability — its own header says so.
 *
 * ⚠ **THE DIFFERENCE IS NOT ACADEMIC: REMOVE THE ONE CALL THAT ERASES THE
 * CASTING STUDIO AND THAT GUARD STAYS GREEN.** Delete or early-return
 * `purgeAccountCastingIn(tx, userId)` in `server/db/accountDeletion.ts` and
 * every `.delete(` it was looking for is still in the tree:
 * `.delete(castingCandidates)` also exists in the retention sweep, and the
 * roll and sheet deletes sit in `db/castingV2.ts` with no remaining caller.
 * Twelve casting tables would quietly stop being erased — a customer's faces
 * back at permanently public URLs, which is precisely #1935 — and the only arm
 * that would notice is DB-backed and skips on the gate for want of a
 * `TEST_DATABASE_URL`.
 *
 * **That is the path-three death CLAUDE.md names: a control un-wired by a
 * change aimed at something else, leaving a green suite and a document that
 * still describes it.** This suite is the arm that cannot be fooled by it,
 * because it does not read the source at all: it RUNS `deleteUserAccount`
 * against a recording transaction and asks what the function actually touched.
 *
 * # What the double is, and what it deliberately is not
 *
 * It is not a database. It records the table of every `delete` and `update`
 * the function issues, and answers every `select` with one synthetic row so
 * that the `if (rows.length > 0)` branches are taken and the walk goes all the
 * way down. It cannot say whether a `WHERE` scopes to the owner — that is
 * invariant 1's question and `server/r7-storage-cleanup-worker-db.test.ts`'s
 * job against a real database. **It answers exactly one question, which
 * nothing else answers: did the entry point reach this table.**
 *
 * ⚠ **FIVE TABLES ANSWER EMPTY, EACH FOR A STATED REASON RATHER THAN BECAUSE
 * IT WAS EASIER.** The four evidence reads in `collectAccountOwnedStorageItemsIn`
 * run real ownership assertions over a structured storage key
 * (`assertOwnedEvidenceStorageKey`, `parseEvidenceStorageKey`), so a synthetic
 * row would have to forge a valid evidence key to get past them — a fixture
 * inventing the thing it is standing in for. Their deletes are unconditional
 * in `deleteUserAccount`, so an empty read costs this arm no coverage. The
 * fifth is the cleanup-manifest read, whose table is exempt from deletion
 * anyway.
 */
import { getTableName, type Table } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_DELETION_DISPOSITIONS } from "./db/accountDeletion";

/** Tables whose reads answer empty — see the header; each is named, not a class. */
const READS_EMPTY = new Set([
  "casting_evidence_ingestions",
  "casting_evidence_candidate_attempts",
  "model_reference_plates",
  "model_evidence_crops",
  "storage_cleanup_items",
]);

const deleted: string[] = [];
const updated: string[] = [];
const inserted: string[] = [];

/** One synthetic row shaped by whatever the caller asked for. */
function synthRow(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return { id: 1 };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (key === "id" || /Id$/.test(key)) row[key] = 1;
    else if (/Key$/.test(key) || /Keys$/.test(key)) row[key] = `synthetic/${key}`;
    else if (/Url$/.test(key)) row[key] = null;
    else row[key] = null;
  }
  if ("maskKeys" in row) row.maskKeys = [];
  return row;
}

function tableNameOf(value: unknown): string {
  try {
    return getTableName(value as Table);
  } catch {
    return "<unknown>";
  }
}

/** A thenable query builder: every stage returns itself, awaiting yields rows. */
function selectChain(fields: Record<string, unknown> | undefined) {
  let rows: unknown[] = [synthRow(fields)];
  const chain: Record<string, unknown> = {};
  const passthrough = (...args: unknown[]) => {
    const first = args[0];
    if (first !== undefined && READS_EMPTY.has(tableNameOf(first))) rows = [];
    return chain;
  };
  for (const stage of ["from", "where", "limit", "orderBy", "for", "innerJoin", "leftJoin", "groupBy"]) {
    chain[stage] = passthrough;
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return chain;
}

const txDouble = {
  select: (fields?: Record<string, unknown>) => selectChain(fields),
  selectDistinct: (fields?: Record<string, unknown>) => selectChain(fields),
  delete: (table: unknown) => {
    deleted.push(tableNameOf(table));
    return { where: async () => [{ affectedRows: 1 }] };
  },
  update: (table: unknown) => {
    updated.push(tableNameOf(table));
    return { set: () => ({ where: async () => [{ affectedRows: 1 }] }) };
  },
  insert: (table: unknown) => {
    inserted.push(tableNameOf(table));
    return { values: async () => undefined };
  },
};

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  withTransaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

const { deleteUserAccount } = await import("./db/accountDeletion");

beforeEach(() => {
  deleted.length = 0;
  updated.length = 0;
  inserted.length = 0;
  process.env.R2_PUBLIC_URL ??= "https://pub-test.r2.dev";
});

describe("deleteUserAccount reaches every table it declares deleted (#1948 M1)", () => {
  /*
    THE DRIVER'S OWN CONTROL FIRST (working law 2). A double that silently
    recorded nothing would make the assertion below pass by measuring less,
    which is the failure this whole repair is about.
  */
  it("the double records a real run rather than nothing", async () => {
    const result = await deleteUserAccount(4242);
    expect(result.error, "the run threw — every reading below would be of a half-run").toBeUndefined();
    expect(deleted.length, "no deletes were recorded at all").toBeGreaterThan(20);
    expect(inserted, "the cleanup manifest was never written").toContain("storage_cleanup_batches");
    // The account itself goes last, and it is the success condition.
    expect(deleted.at(-1)).toBe("users");
    expect(result.success).toBe(true);
  });

  it("⚠ every table declared `deleted` receives a delete FROM THIS ENTRY POINT", async () => {
    await deleteUserAccount(4242);
    const touched = new Set(deleted);
    const unreached: string[] = [];
    for (const [key, disposition] of Object.entries(ACCOUNT_DELETION_DISPOSITIONS)) {
      if (disposition !== "deleted") continue;
      const symbol = key.slice(0, key.indexOf("."));
      const schema = await import("../drizzle/schema");
      const table = (schema as Record<string, unknown>)[symbol];
      const name = tableNameOf(table);
      if (!touched.has(name)) unreached.push(`${symbol} (${name})`);
    }
    expect(
      unreached,
      "a table the map says is erased was never reached by deleteUserAccount — the"
        + " coverage guard cannot see this, because the delete statement still exists",
    ).toEqual([]);
  });

  it("every table declared `anonymised` receives an update and never a delete", async () => {
    await deleteUserAccount(4242);
    const schema = await import("../drizzle/schema");
    for (const [key, disposition] of Object.entries(ACCOUNT_DELETION_DISPOSITIONS)) {
      if (disposition !== "anonymised") continue;
      const symbol = key.slice(0, key.indexOf("."));
      const name = tableNameOf((schema as Record<string, unknown>)[symbol]);
      expect(updated, `${key} declares anonymised and no update reached it`).toContain(name);
    }
    /*
      ⚠ `referrals` is BOTH — deleted on `referrerUserId`, anonymised on
      `referredUserId` — so "never a delete" is asserted only of the table
      that has no other answer. Asserting it of all three would be asserting
      something the map does not say.
    */
    expect(deleted, "the audit trail was deleted rather than anonymised").not.toContain("audit_logs");
  });
});

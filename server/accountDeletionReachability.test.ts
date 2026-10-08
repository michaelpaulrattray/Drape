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

import {
  ACCOUNT_DELETION_DISPOSITIONS,
  ACCOUNT_DELETION_RENDER_IN_FLIGHT,
} from "./db/accountDeletion";

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
/** Every `select`ed table, in the order the function asked for it (#1954). */
const selected: string[] = [];

/**
 * WHAT THE IN-FLIGHT RENDER READ FINDS — the one answer an arm sets (#1954).
 *
 * `[]` is "nothing of this account's is rendering", which is every pre-existing
 * arm's world and is why they are unchanged. An arm that puts a row here is
 * driving the refusal.
 */
let inFlightRows: unknown[] = [];

/** One read of one table, as the double saw it being built. */
type ReadShape = { table: string; stages: string[]; where: unknown };
/** Every read this run issued, in order. */
const reads: ReadShape[] = [];

/**
 * Every COLUMN a drizzle condition names, in order — the house shape for
 * asking about an outgoing statement (invariant 5;
 * `server/purchasedCreditsGrantWire.test.ts` is the precedent). It descends
 * into arrays because `inArray` holds its values in one.
 */
function conditionColumns(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) conditionColumns(child, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const chunk = node as { queryChunks?: unknown; name?: unknown };
  if (Array.isArray(chunk.queryChunks)) return conditionColumns(chunk.queryChunks, out);
  if (typeof chunk.name === "string") out.push(chunk.name);
  return out;
}

/**
 * ⚠ **THE IN-FLIGHT READ IS RECOGNISED BY BEING FIRST, NOT BY ITS FIELDS.**
 *
 * `generation_operations` is read TWICE by this function — once by the refusal
 * at the top of the transaction, once by step 9b to find the leases to delete —
 * and the double has to answer them differently: empty for the first (so the
 * deletion proceeds) and a row for the second (so the lock delete branch is
 * taken). Telling them apart by a selected field name would be keying on a
 * spelling for a meaning, and it would stop working the first time either
 * projection was edited.
 *
 * The refusal's own comment in `accountDeletion.ts` says it is the
 * transaction's FIRST act, and that is load-bearing rather than tidiness — the
 * lock it takes has to be held for everything below it. So the double keys on
 * exactly that, and `the in-flight read is the transaction's first statement`
 * below holds the invariant the keying rests on. Move the check down and that
 * arm reddens instead of this double quietly answering the wrong read.
 */
function isFirstOperationsRead(table: unknown): boolean {
  return tableNameOf(table) === "generation_operations"
    && !selected.includes("generation_operations");
}

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
  /* What THIS read named, so an arm can ask about the statement rather than
     about a constant near it (invariant 5). Filled as the chain is walked. */
  const seen: ReadShape = { table: "<unknown>", stages: [], where: null };
  const passthrough = (stage: string) => (...args: unknown[]) => {
    seen.stages.push(stage);
    if (stage === "where" && args[0] !== undefined) seen.where = args[0];
    const first = args[0];
    if (first !== undefined) {
      /* `from(table)` is the only stage that names one, and it is where the
         answer is decided — before the table is recorded, so "first" means
         first as this run saw it. */
      if (stage === "from") {
        if (isFirstOperationsRead(first)) rows = inFlightRows;
        else if (READS_EMPTY.has(tableNameOf(first))) rows = [];
        const name = tableNameOf(first);
        if (name !== "<unknown>") {
          selected.push(name);
          seen.table = name;
          reads.push(seen);
        }
      }
    }
    return chain;
  };
  for (const stage of ["from", "where", "limit", "orderBy", "for", "innerJoin", "leftJoin", "groupBy"]) {
    chain[stage] = passthrough(stage);
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
  selected.length = 0;
  inFlightRows = [];
  reads.length = 0;
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

/**
 * AN ERASURE DOES NOT RUN OVER A RENDER THAT IS STILL BEING EXECUTED — #1954.
 *
 * Driven through the real `deleteUserAccount` rather than through a
 * re-implementation of its predicate, which is the only reading that can tell
 * a wired refusal from a written one (invariant 7). The four arms are the
 * finding, its two controls and the invariant the double's keying rests on:
 *
 * - **the refusal** — one in-flight row and NOTHING is deleted;
 * - **the negative control** — the same run with no in-flight row deletes
 *   everything, which is the `records a real run` arm above and is why it was
 *   left exactly as it was;
 * - **the discrimination control** — step 9b's own read of the same table
 *   still gets its row, so the double is answering the FIRST read and not
 *   every read (sabotage it and `generation_operation_locks` stops being
 *   deleted);
 * - **the ordering invariant** — the refusal is the transaction's first
 *   statement, because the lock it takes has to cover everything below it.
 */
describe("account erasure refuses while a render is still being executed (#1954)", () => {
  const RUNNING = { id: "op-running-1", kind: "castingV2.roll", status: "running" };

  it("⚠ refuses, and deletes NOTHING — not the manifest, not the account", async () => {
    inFlightRows = [RUNNING];
    const result = await deleteUserAccount(4242);

    expect(result.success).toBe(false);
    expect(result.refusal).toBe("render_in_flight");
    expect(result.refusedOnOperationId).toBe(RUNNING.id);
    expect(
      deleted,
      "a table was deleted under an account whose render is still finishing",
    ).toEqual([]);
    expect(updated, "a row was anonymised on a refused erasure").toEqual([]);
    expect(
      inserted,
      "a storage-cleanup manifest was written for an account that still exists",
    ).toEqual([]);
    expect(result.cleanupBatchId).toBeNull();
    expect(result.cleanupObjects).toBe(0);
    /* The reported counts are the real ones rather than a placeholder: nothing
       ran, so every one of them is zero. */
    expect(Object.values(result.deletedCounts).every((count) => count === 0)).toBe(true);
  });

  it("a `claimed` operation refuses on the same ground as a `running` one", async () => {
    inFlightRows = [{ id: "op-claimed-1", kind: "castingV2.sign", status: "claimed" }];
    const result = await deleteUserAccount(4242);
    expect(result.refusal).toBe("render_in_flight");
    expect(deleted).toEqual([]);
  });

  it("the refusal carries the customer's sentence and names no machinery", () => {
    expect(ACCOUNT_DELETION_RENDER_IN_FLIGHT).toMatch(/still finishing/);
    expect(ACCOUNT_DELETION_RENDER_IN_FLIGHT).toMatch(/nothing was deleted/i);
    /*
      THE DISAPPEARING-TECHNOLOGY LAW, DRIVEN RATHER THAN PROMISED. A refusal
      is a path the customer is standing on, so no engine, table, status or
      operation id may appear in it.
    */
    for (const leak of [
      "operation", "generation", "claimed", "running", "castingV2", "fal",
      "Sunburst", "Nano Banana", "storagePut", "R2", "lease", "transaction",
    ]) {
      expect(
        ACCOUNT_DELETION_RENDER_IN_FLIGHT.toLowerCase(),
        `the refusal says "${leak}" to a customer`,
      ).not.toContain(leak.toLowerCase());
    }
  });

  it("the in-flight read is the transaction's FIRST statement", async () => {
    await deleteUserAccount(4242);
    expect(
      selected[0],
      "the refusal no longer reads first, so its lock does not cover the"
        + " statements below it — and the double above keys on this order",
    ).toBe("generation_operations");
  });

  it("⚠ THE LOCKING READ NAMES THE OWNER AND NOTHING ELSE — read at the statement", async () => {
    /*
      ⚠ THIS ARM EXISTS BECAUSE THE SHIPPED SHAPE LOCKED EVERY CUSTOMER’S
      IN-FLIGHT RENDERS (PR #1960 review). With `status IN (…)` in the WHERE,
      EXPLAIN on the real schema took `idx_generation_ops_status_lease` — a
      STATUS-leading range — and under FOR UPDATE, InnoDB next-key-locks every
      record it scans. The deleting account usually has no in-flight render, so
      LIMIT 1 never stopped early and every other account's heartbeat, lease
      renewal and settle blocked for the whole erasure — the longest
      transaction in the product.

      The repair is to lock by OWNER alone and test the status in code, so
      this arm asks the statement what it named. A later tidy-up that puts the
      status back reddens here.
    */
    await deleteUserAccount(4242);

    const locking = reads.find((read) => read.table === "generation_operations");
    expect(locking, "the locking read never happened — the arm is inert").toBeDefined();
    expect(locking!.stages).toContain("for");
    expect(
      conditionColumns(locking!.where),
      "the locking read names a column besides the owner — a status predicate"
        + " here buys a status-leading index and locks every account",
    ).toEqual(["userId"]);
    /* ⚠ And LIMIT had to go WITH the predicate: with no status test in SQL,
       `LIMIT 1` would answer about whichever row the index reached first and
       miss an in-flight render that is not it. */
    expect(
      locking!.stages,
      "a LIMIT on an owner-only locking read answers about the wrong row",
    ).not.toContain("limit");
  });

  it("⚠ a FINISHED operation of hers does not refuse — the code-side status test", async () => {
    /*
      The control the repair above cannot do without. Moving the status out of
      the WHERE means the statement returns the account’s operations, so a
      reader that forgot to filter would refuse every erasure of an account
      that has ever rendered anything — which is every account. Two terminal
      statuses, so it is not passing on one spelling.
    */
    for (const status of ["succeeded", "failed"]) {
      deleted.length = 0;
      reads.length = 0;
      inFlightRows = [{ id: `op-${status}`, kind: "castingV2.roll", status }];

      const result = await deleteUserAccount(4242);

      expect(result.refusal, `a ${status} operation refused the erasure`).toBeUndefined();
      expect(result.success, `a ${status} operation blocked the erasure`).toBe(true);
      expect(deleted.length).toBeGreaterThan(0);
    }
  });

  it("⚠ and it still refuses on an in-flight row that is NOT the first one back", async () => {
    /* The statement no longer narrows to in-flight rows, so the one that
       matters can arrive behind any number of finished ones. */
    inFlightRows = [
      { id: "op-old-1", kind: "castingV2.roll", status: "succeeded" },
      { id: "op-old-2", kind: "castingV2.roll", status: "failed" },
      RUNNING,
    ];

    const result = await deleteUserAccount(4242);

    expect(result.refusal).toBe("render_in_flight");
    expect(result.refusedOnOperationId).toBe(RUNNING.id);
    expect(deleted).toEqual([]);
  });
  it("step 9b still reads the same table for its leases, and deletes them", async () => {
    await deleteUserAccount(4242);
    expect(
      selected.filter((name) => name === "generation_operations").length,
      "the two reads of this table collapsed into one",
    ).toBe(2);
    expect(
      deleted,
      "the operation leases stopped being deleted — the double answered both"
        + " reads from the in-flight fixture instead of only the first",
    ).toContain("generation_operation_locks");
  });
});

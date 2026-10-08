/**
 * THE CHILD ROWS WHOSE CANDIDATE IS ALREADY GONE — the driven arms for
 * #1948 L1.
 *
 * `server/accountDeletionReachability.test.ts` proves the walk reaches every
 * table. These arms prove the different thing L1 is about: that a row whose
 * PARENT row has gone is found, that its key reaches the manifest before its
 * row is deleted, and that the store list the sweep walks is the real one
 * rather than a hand-typed copy of it.
 *
 * ⚠ **THE ORDER IS THE WHOLE POINT, AND IT IS WHY THE CARD'S OWN CHEAP FIX IS
 * NOT WHAT SHIPPED.** #1948 L1 proposed *"a final `DELETE … WHERE userId = ?`
 * on each"*, and that would be strictly WORSE than leaving the row: the row is
 * the last pointer to an object sitting at a permanently public URL
 * (`server/storage.ts` — served URLs are not presigned and never expire), so
 * deleting it unread strands the object forever with nothing able to name it.
 * The repair therefore finds the orphans' parent ids FIRST and feeds them
 * through the same `listPurgeable*In` helpers the live candidates go through,
 * so the key is collected by the one reader that knows that key's column name.
 */
import { getTableName, type Table } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORPHAN_SCANNED_STORES } from "./db/castingV2Orphans";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/* ------------------------------------------------------------------ the
   population control: the sweep's store list against the schema itself. */

describe("the orphan sweep walks the real set of child stores (#1948 L1)", () => {
  /**
   * The casting child tables that declare BOTH a `userId` and a `candidateId`,
   * read out of the schema.
   *
   * ⚠ Derived rather than listed, because a hand-typed copy of a schema fact
   * is working law 4 and the drift would be made of a customer's pictures:
   * a tenth child store added with a `candidateId` and left out of
   * `ORPHAN_SCANNED_STORES` would leave its orphans unreachable with nothing
   * going red.
   */
  function castingChildTablesWithCandidateId(): string[] {
    const source = readListedSource(
      new URL("../drizzle/schema.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    );
    expect(source, "the schema could not be read — this arm would be reading nothing")
      .not.toBeNull();
    const text = withoutComments(source ?? "");
    const found: string[] = [];
    let current: string | null = null;
    let hasUser = false;
    let hasCandidate = false;
    const close = () => {
      if (current && hasUser && hasCandidate && current.startsWith("casting")) found.push(current);
    };
    for (const line of text.split("\n")) {
      const declaration = /^export const (\w+) = mysqlTable\(/.exec(line);
      if (declaration) {
        close();
        current = declaration[1]!;
        hasUser = false;
        hasCandidate = false;
        continue;
      }
      if (!current) continue;
      if (/^\s{2,4}userId:\s*int\(/.test(line)) hasUser = true;
      if (/^\s{2,4}candidateId:\s*int\(/.test(line)) hasCandidate = true;
    }
    close();
    /* The candidate table itself is the parent, never one of its own children. */
    return found.filter((symbol) => symbol !== "castingCandidates");
  }

  it("derives a population that is neither empty nor obviously short", () => {
    const derived = castingChildTablesWithCandidateId();
    expect(derived.length, "the schema reader found no casting child stores").toBeGreaterThan(5);
    expect(derived, "a positive control").toContain("castingCandidateVariants");
    expect(derived, "a positive control at the other end").toContain("castingReferenceAttachments");
    /* The negative control that matters: plates have no `candidateId`, which
       is why they need their own road and must NOT be in the generic list. */
    expect(derived, "ink plates have no candidateId and cannot be swept generically")
      .not.toContain("castingInkPlates");
  });

  it("⚠ the swept stores are exactly the child tables that declare a candidateId", () => {
    const swept = Object.values(ORPHAN_SCANNED_STORES).map((table) => {
      /* Match on the SQL name, so a symbol rename cannot make this arm pass by
         comparing two things that both moved. */
      return getTableName(table as unknown as Table);
    }).sort();
    const derivedNames = castingChildTablesWithCandidateId()
      .map((symbol) => symbol.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase())
      .sort();
    expect(
      swept,
      "a casting child store declaring a candidateId is not in ORPHAN_SCANNED_STORES —"
        + " its orphaned rows are reachable by nothing and their objects stay up forever",
    ).toEqual(derivedNames);
  });
});

/* ------------------------------------------------------------------ the
   driven arms: a purge run where the orphan rows are the only rows. */

type Recorded = { kind: "select" | "delete"; table: string };

const recorded: Recorded[] = [];
/** candidate ids the orphan reader will answer with, per store. */
let orphanAnswer: number[] = [];
/** Rows each `listPurgeable*` read answers with, keyed by SQL table name. */
let rowsByTable: Record<string, Array<Record<string, unknown>>> = {};

/**
 * The SQL name of a drizzle table, or `<unknown>` for anything else.
 *
 * ⚠ **`getTableName` RETURNS `undefined` FOR A CONDITION OBJECT RATHER THAN
 * THROWING**, which the first cut of this double did not expect: every
 * `.where(eq(…))` then overwrote the table captured by `.from(…)` with
 * `undefined`, and all four driven arms failed claiming the table was never
 * read. A `try/catch` alone is not enough — the answer has to be checked.
 */
function nameOf(value: unknown): string {
  try {
    const name = getTableName(value as Table);
    return typeof name === "string" && name.length > 0 ? name : "<unknown>";
  } catch {
    return "<unknown>";
  }
}

function chain(fields: Record<string, unknown> | undefined, distinct: boolean) {
  let table = "<unset>";
  const self: Record<string, unknown> = {};
  const stage = (...args: unknown[]) => {
    if (args[0] !== undefined && nameOf(args[0]) !== "<unknown>") table = nameOf(args[0]);
    return self;
  };
  for (const name of ["from", "where", "limit", "orderBy", "for", "innerJoin", "leftJoin"]) {
    self[name] = stage;
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    recorded.push({ kind: "select", table });
    if (distinct) {
      return Promise.resolve(orphanAnswer.map((id) => ({ candidateId: id }))).then(resolve, reject);
    }
    const rows = rowsByTable[table] ?? [];
    void fields;
    return Promise.resolve(rows).then(resolve, reject);
  };
  return self;
}

const tx = {
  select: (fields?: Record<string, unknown>) => chain(fields, false),
  selectDistinct: (fields?: Record<string, unknown>) => chain(fields, true),
  delete: (table: unknown) => {
    recorded.push({ kind: "delete", table: nameOf(table) });
    return { where: async () => [{ affectedRows: 1 }] };
  },
  update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }),
  insert: () => ({ values: async () => undefined }),
};

const { purgeAccountCastingIn } = await import("./castingV2/accountCastingPurge");

beforeEach(() => {
  recorded.length = 0;
  orphanAnswer = [];
  rowsByTable = {};
});

describe("an orphan's key reaches the manifest before its row is deleted", () => {
  it("⚠ a variant whose candidate row is gone is collected and swept", async () => {
    /*
      The account has NO candidate rows at all — `listAccountCandidatesIn`
      answers empty — and one refinement row still points at candidate 77.
      Before this card that row and its two objects were reached by nothing.
    */
    orphanAnswer = [77];
    rowsByTable["casting_candidate_variants"] = [
      { id: 9, imageKey: "casts/77/refine.png", thumbKey: "casts/77/refine-thumb.png" },
    ];

    const result = await purgeAccountCastingIn(tx as never, 4242);

    const keys = result.storageItems.map((item) => item.storageKey);
    expect(keys, "the orphan refinement's picture never entered the manifest")
      .toContain("casts/77/refine.png");
    expect(keys, "its thumbnail never entered the manifest")
      .toContain("casts/77/refine-thumb.png");
    expect(
      recorded.filter((row) => row.kind === "delete").map((row) => row.table),
      "the orphan row was collected and then left in place",
    ).toContain("casting_candidate_variants");
  });

  it("the key is READ before the row is deleted, which is the whole ordering", async () => {
    orphanAnswer = [77];
    rowsByTable["casting_candidate_variants"] = [
      { id: 9, imageKey: "casts/77/refine.png", thumbKey: null },
    ];

    await purgeAccountCastingIn(tx as never, 4242);

    const firstRead = recorded.findIndex(
      (row) => row.kind === "select" && row.table === "casting_candidate_variants",
    );
    const firstDelete = recorded.findIndex(
      (row) => row.kind === "delete" && row.table === "casting_candidate_variants",
    );
    expect(firstRead, "the variants table was never read").toBeGreaterThan(-1);
    expect(firstDelete, "the variants table was never deleted").toBeGreaterThan(-1);
    expect(
      firstRead,
      "the row was deleted before its key was read — the object is now stranded at a"
        + " permanently public URL with nothing able to name it",
    ).toBeLessThan(firstDelete);
  });

  it("⚠ an ink plate whose DESIGN is also gone is swept by its own road", async () => {
    /*
      A plate carries no `candidateId`, so no orphan candidate id can reach it:
      the generic sweep above is blind to it at every depth. Its own `userId`
      is the only column left pointing home.
    */
    rowsByTable["casting_ink_plates"] = [{ id: 5, storageKey: "casts/ink/plate-5.png" }];

    const result = await purgeAccountCastingIn(tx as never, 4242);

    expect(
      result.storageItems.map((item) => item.storageKey),
      "a plate whose design row is gone was left at a permanently public URL",
    ).toContain("casts/ink/plate-5.png");
    expect(result.counts.castingInkPlates, "the orphan plate row was not deleted").toBe(1);
  });

  it("a clean account sweeps nothing — the negative control", async () => {
    /*
      The control that keeps the three above honest: with no rows anywhere, no
      key is collected and no child store reports anything, so a green run of
      this suite is not the double saying yes to everything.

      ⚠ **THE THREE PARENT COUNTS ARE DELIBERATELY NOT ASSERTED AT ZERO, and
      the first cut of this arm got that wrong.** `deleteAccountCandidateRowsIn`,
      `…RollRowsIn` and `…SessionRowsIn` are unconditional — they issue their
      DELETE whatever was found — and this double answers every delete with
      `affectedRows: 1`. So those three read 1 here as an artefact of the
      fixture, not of the product, and asserting them at zero would be
      asserting something about the double.
    */
    const result = await purgeAccountCastingIn(tx as never, 4242);
    expect(result.storageItems, "a key was collected from an account with no rows").toEqual([]);
    const childStores = Object.entries(result.counts)
      .filter(([store]) => !["castingCandidates", "castingRolls", "castingSessions"].includes(store));
    expect(
      childStores.filter(([, count]) => count !== 0),
      "a child store reported rows for an account that has none",
    ).toEqual([]);
  });
});

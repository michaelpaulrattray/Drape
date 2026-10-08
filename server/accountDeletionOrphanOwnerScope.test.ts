/**
 * AN ORPHAN'S CANDIDATE ID PROVES NOTHING — the driven arms for #1959.
 *
 * # What these arms are about, and why the existing suite could not see it
 *
 * `server/accountDeletionOrphans.test.ts` proves #1948 L1's shape: a child row
 * whose candidate is gone is FOUND, its key reaches the manifest before its
 * row is deleted, and the swept store list is the real one. Every one of those
 * arms is right. None of them can see WHICH ROWS a statement would match,
 * because its double records the chain (`select`, `from`, `delete`) and throws
 * the predicate away — so the whole subject of this card is invisible to it.
 *
 * The defect: the orphan sweep hands `accountCastingPurge` every candidate id
 * the deleting account's child rows POINT AT. Nothing proves such an id is
 * hers — it is read off a row, and the row is itself the evidence that
 * something went wrong. A child row carrying her `userId` while pointing at
 * another customer's LIVE candidate made the purge delete every child row for
 * that candidate, and every object behind them, keyed by candidate id alone.
 *
 * # Why the wire, and not rows
 *
 * The contract is *which rows can this statement reach*, and the honest place
 * to read it is the statement — invariant 5, and the shape
 * `viewRetryFreeOnce.test.ts` and `viewRetryBusy.test.ts` already use here. A
 * row-level arm would need a disposable database, and `vitest.setup.ts` strips
 * `DATABASE_URL` on purpose: such a suite SKIPS in CI, which is an instrument
 * that proves nothing while reading green (working law 2).
 *
 * So the question *does the other customer's row survive* is answered by
 * showing that the statement sent cannot match it: the owner is in the
 * predicate and the parameter is the deleting account. Three things are
 * therefore proven here and the third is the one that outlives this card:
 *
 *   1. the RULE — `purgeScopeWhere` renders the owner for an id read off a row
 *      and NOT for an id whose ownership a scoped read already proved, so the
 *      proven half still collects a mis-owned row under a candidate that IS
 *      hers rather than stranding its object;
 *   2. the REFUSAL — an empty scope throws rather than rendering a `DELETE`
 *      with no `WHERE` at all;
 *   3. the WALK — every statement the real purge sends that carries an orphan
 *      id also carries the owner, over a population DERIVED from the
 *      statements rather than a list of the nine helpers that exist today.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { castingSegments } from "../drizzle/schema";
import { purgeScopeWhere } from "./db/castingV2PurgeScope";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** What the purge said it found, so the classified warning can be read. */
const logged: Array<{ fields: Record<string, unknown>; message: string }> = [];
vi.mock("./logging/logger", () => {
  const record = () => (fields: unknown, message: string) => {
    logged.push({ fields: (fields ?? {}) as Record<string, unknown>, message });
  };
  const shape = { error: record(), warn: record(), info: record(), debug: record() };
  return { logger: shape, createModuleLogger: () => shape };
});

/* ------------------------------------------------------------------ the rule */

describe("the purge scope predicate (#1959)", () => {
  const rendered = (selector: Parameters<typeof purgeScopeWhere>[2]) => {
    const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
    const db = drizzle(pool);
    const { sql, params } = db
      .select({ id: castingSegments.id })
      .from(castingSegments)
      .where(purgeScopeWhere(castingSegments.candidateId, castingSegments.userId, selector))
      .toSQL();
    void pool.end().catch(() => undefined);
    return { sql, params };
  };

  it("an id read off a child row carries the owner in the same statement", () => {
    const { sql, params } = rendered({ ownerScoped: { candidateIds: [77], userId: 4242 } });
    expect(sql, "the orphan half reaches rows by candidate id alone").toContain(
      "`casting_segments`.`userId` = ?",
    );
    expect(params, "the owner is not the deleting account").toContain(4242);
    expect(params, "the orphan id never reached the statement").toContain(77);
  });

  it("⚠ an id whose ownership is already proven does NOT carry the owner", () => {
    /*
      The control that keeps the arm above from being satisfied by a blanket
      `userId` on everything — which would be a different defect, not a fix.
      A child row carrying the wrong owner UNDER A CANDIDATE THAT IS HERS is
      the litter this sweep exists to collect: scope that half and the row
      survives with its object at a permanently public URL forever.
    */
    const { sql, params } = rendered([55]);
    expect(sql, "the proven half gained an owner clause and will strand mis-owned litter")
      .not.toContain("`casting_segments`.`userId`");
    expect(params).toEqual([55]);
  });

  it("the two halves travel in one statement, so there is no second walk", () => {
    const { sql, params } = rendered({
      candidateIds: [55],
      ownerScoped: { candidateIds: [77], userId: 4242 },
    });
    expect(sql, "the proven half is missing").toContain("`casting_segments`.`candidateId` in (?)");
    expect(sql, "the halves were not combined").toContain(" or ");
    expect(sql, "the orphan half lost its owner").toContain("`casting_segments`.`userId` = ?");
    expect(params, "ids and owner, in order").toEqual([55, 77, 4242]);
  });

  it("an empty orphan list leaves the proven half exactly as it was", () => {
    const empty = rendered({ candidateIds: [55], ownerScoped: { candidateIds: [], userId: 4242 } });
    expect(empty, "an account with no orphans pays for the widening").toEqual(rendered([55]));
  });

  /* ------------------------------------------------------- the refusal */

  it("⚠ an empty scope THROWS rather than rendering a DELETE with no WHERE", () => {
    /*
      The one failure mode worth designing against: a `where` that renders to
      nothing on a `DELETE` is the whole table. Every caller has its own
      emptiness check; this is the backstop under them, and it fails closed
      (invariant 7 — refuse, never allow, when the input is missing).
    */
    expect(() => rendered([])).toThrow(/refused an empty candidate scope/);
    expect(() => rendered({ candidateIds: [] })).toThrow(/refused an empty candidate scope/);
    expect(() => rendered({ candidateIds: [], ownerScoped: { candidateIds: [], userId: 1 } }))
      .toThrow(/refused an empty candidate scope/);
  });
});

/* ------------------------------------------------------------------ the walk */

/**
 * Every statement the real purge sends, read off a pool that never connects.
 *
 * ⚠ **A REAL `drizzle` INSTANCE, NOT A HAND-ROLLED CHAIN DOUBLE.** The subject
 * is the rendered predicate, so a double that invents its own `.where()` is
 * exactly the thing that cannot answer the question — which is why the suite
 * next door stayed green through this defect.
 */
const USER_ID = 4242;
/** The id her stray row points at — another customer's, as far as she knows. */
const ORPHAN_ID = 77;

type Statement = { sql: string; params: readonly unknown[] };

const sent: Statement[] = [];
/** candidate ids the per-store orphan readers answer with. */
let orphanAnswer: number[] = [];
/** The account's own candidate rows. */
let candidateRows: Array<Record<string, unknown>> = [];
/** Orphan ids that DO still have a candidate row — for any owner. */
let existingCandidateIds: number[] = [];
/**
 * Whether HER OWN orphan-plate road finds anything.
 *
 * That road (`listAccountOrphanInkPlatesIn`) asks on her `userId` for plates
 * whose DESIGN row is gone, so what it returns is hers and is rightly swept.
 * It is switched off in the arms that assert the manifest is EMPTY, so those
 * arms are about the candidate-child stores and nothing else — otherwise a
 * legitimately-collected plate key sits in the manifest and the assertion has
 * to be weakened to a prefix match that could pass for the wrong reason.
 */
let orphanPlatesPresent = true;
/** Her orphan-plate read, by the shape only it has: a LEFT JOIN tested for null. */
const ORPHAN_PLATE_READ = /from `casting_ink_plates`[\s\S]*`casting_ink_designs`[\s\S]*is null/i;

/**
 * The columns a `select` asks for, in order, read off the statement.
 *
 * ⚠ **BECAUSE `drizzle-orm/mysql2` SENDS `rowsAsArray: true` AND MAPS ROWS
 * POSITIONALLY** — measured, not assumed: the driver's query config carries
 * the flag, so a fake answering objects has every field read as `undefined`.
 * The first cut of this suite did exactly that and all three walk arms failed
 * claiming no statement carried the orphan id, which is the failure mode
 * worth naming: a double that answers in the wrong SHAPE looks like a product
 * that does nothing.
 */
function selectedColumns(sql: string): string[] {
  const list = /^select (?:distinct )?(.*?) from /.exec(sql)?.[1];
  if (!list) throw new Error(`[fixture] could not read the select list of: ${sql}`);
  return list.split(", ").map((column) => {
    /* A joined read qualifies its columns (`casting_ink_plates`.`id`); the
       table half is the join's business and not a value this row carries. */
    const parts = column.replace(/`/g, "").trim().split(".");
    return parts[parts.length - 1]!;
  });
}

/**
 * One row carrying every column the purge's collectors ask for. A key is
 * enough to put the row in the manifest, which is what makes the following
 * delete fire — and the delete is the statement these arms are about.
 *
 * ⚠ **A COLUMN THIS MAP DOES NOT KNOW IS A THROW, NOT AN `undefined`.** A new
 * key column added to a collector would otherwise read as null here, its row
 * would drop out of the manifest, and the delete these arms watch for would
 * never be sent — leaving them green over a statement they never saw.
 */
const FIXTURE_ROW: Record<string, unknown> = {
  id: 9,
  userId: USER_ID,
  candidateId: ORPHAN_ID,
  imageKey: "casts/77/a.png",
  thumbKey: "casts/77/b.png",
  sourceKey: null,
  maskKey: "casts/77/c.png",
  contentKey: "casts/77/d.png",
  storageKey: "casts/77/e.png",
  refusedContentKey: null,
  refusedMaskKey: null,
  geometry: { slots: [{ maskKey: "casts/77/f.png" }] },
};

function project(row: Record<string, unknown>, sql: string): unknown[] {
  return selectedColumns(sql).map((column) => {
    if (!(column in row)) {
      throw new Error(
        `[fixture] no value for the selected column \`${column}\` — add it to FIXTURE_ROW,`
          + ` or this row drops out of the manifest and its delete is never sent: ${sql}`,
      );
    }
    return row[column];
  });
}

function answerFor(sql: string): unknown {
  if (/^\s*(delete|update|insert)/i.test(sql)) return { affectedRows: 1 };
  if (/^select distinct `candidateId`/.test(sql)) {
    return orphanAnswer.map((id) => [id]);
  }
  if (!orphanPlatesPresent && ORPHAN_PLATE_READ.test(sql)) return [];
  if (OWNER_BLIND_BY_DESIGN.test(sql)) return existingCandidateIds.map((id) => [id]);
  if (/from `casting_candidates`/.test(sql)) {
    return candidateRows.map((row) => project(row, sql));
  }
  return [project(FIXTURE_ROW, sql)];
}

const pool = {
  query(...args: unknown[]) {
    const config = args[0] as { sql?: string; values?: unknown[] } | string;
    const sql = typeof config === "string" ? config : config.sql ?? "";
    const params = (args[1] as unknown[])
      ?? (typeof config === "string" ? [] : config.values ?? []);
    sent.push({ sql, params });
    const answer = answerFor(sql);
    const callback = args.find((argument) => typeof argument === "function") as
      | ((error: unknown, rows: unknown, fields: unknown) => void)
      | undefined;
    if (callback) {
      callback(null, answer, []);
      return undefined;
    }
    return Promise.resolve([answer, []]);
  },
  execute(...args: unknown[]) {
    return (pool as unknown as { query: (...a: unknown[]) => unknown }).query(...args);
  },
};

const { purgeAccountCastingIn } = await import("./castingV2/accountCastingPurge");


async function runPurge(): Promise<Awaited<ReturnType<typeof purgeAccountCastingIn>>> {
  const db = drizzle(pool as never, { mode: "default" } as never);
  /*
    The RESULT is returned now, not discarded — PR #1974's arms are partly
    about the storage-cleanup manifest, and a key that reaches it queues
    another customer's picture for destruction without any statement touching
    their rows. A suite reading only the statements cannot see that.
  */
  return purgeAccountCastingIn(db as never, USER_ID);
}

/**
 * The ONE statement here that is deliberately owner-blind, named so that its
 * exclusion below is checked rather than assumed.
 *
 * `listExistingCandidateIdsIn` asks *does a candidate row exist for this id,
 * for ANY owner* — the whole question — purely to tell the log's two bugs
 * apart (a candidate dropped without its children, or a child row carrying an
 * owner that is not its candidate's). It collects no storage key and writes
 * nothing. An owner clause on it would make it answer a different question
 * and always say *dropped*.
 */
const OWNER_BLIND_BY_DESIGN =
  /^select `id` from `casting_candidates` where `casting_candidates`\.`id` in \(/;

/**
 * Statements that reach a customer's ROWS OR OBJECTS by the orphan id.
 *
 * A key-collecting `select` belongs here as much as a `delete` does: a key it
 * reads goes into the cleanup manifest, so a read scoped by candidate id alone
 * queues another customer's pictures for destruction without ever touching
 * their rows.
 */
function statementsCarryingTheOrphanId(): Statement[] {
  return sent.filter((statement) =>
    statement.params.includes(ORPHAN_ID)
    && /^\s*(delete|update|select)/i.test(statement.sql)
    && !OWNER_BLIND_BY_DESIGN.test(statement.sql));
}

beforeEach(() => {
  sent.length = 0;
  logged.length = 0;
  orphanAnswer = [];
  candidateRows = [];
  existingCandidateIds = [];
  orphanPlatesPresent = true;
});

describe("the real purge never reaches an orphan id without its owner (#1959)", () => {
  it("⚠ every statement carrying the orphan id also carries the deleting account", async () => {
    /*
      The account has no candidate rows left — the case the orphan sweep exists
      for — and one stray child row per store points at candidate 77, which is
      not hers. Before this card every one of the statements below reached
      candidate 77's rows for ANY owner.
    */
    orphanAnswer = [ORPHAN_ID];

    await runPurge();

    const carrying = statementsCarryingTheOrphanId();
    /* The population control: an arm reading an empty set passes vacuously. */
    expect(
      carrying.length,
      "no statement carried the orphan id — this arm is reading nothing",
    ).toBeGreaterThan(8);

    const unscoped = carrying.filter((statement) =>
      !(/`userId` = \?/.test(statement.sql) && statement.params.includes(USER_ID)));
    expect(
      unscoped.map((statement) => statement.sql),
      "a statement reaches an orphan candidate's rows for ANY owner — another customer's"
        + " refinements, references, scans or ink work go with this account",
    ).toEqual([]);
  });

  it("the one owner-blind statement is the existence probe, and it reads nothing else", async () => {
    /*
      The exclusion above is a hole in the arm unless the thing excluded is
      pinned, so this is that pin. The probe must EXIST (it is what tells the
      log's two bugs apart), it must select nothing but `id` — a key in its
      select list would put another customer's picture in the manifest — and
      it must be the only owner-blind statement carrying the orphan id.
    */
    orphanAnswer = [ORPHAN_ID];

    await runPurge();

    const blind = sent.filter((statement) =>
      statement.params.includes(ORPHAN_ID) && OWNER_BLIND_BY_DESIGN.test(statement.sql));
    expect(blind.length, "the existence probe was never sent — the log cannot classify").toBe(1);
    expect(
      selectedColumns(blind[0]!.sql),
      "the existence probe collects a column that is not the id it asks about",
    ).toEqual(["id"]);
    expect(blind[0]!.sql, "the probe is not a read").not.toMatch(/^\s*(delete|update)/i);
  });

  it("⚠ the candidate pointer update is scoped too, and the card did not name it", async () => {
    /*
      `deleteVariantRowsIn` nulls `castingCandidates.selectedVariantId` before
      it deletes, so a candidate row cannot point at a deleted variant. It was
      keyed on candidate id alone like the rest — so an orphan id pointing at
      another customer's live Cast silently reset THEIR selected face. Found by
      sweeping the class rather than the instance (working law 7).
    */
    orphanAnswer = [ORPHAN_ID];

    await runPurge();

    const update = sent.find((statement) => /^update `casting_candidates`/.test(statement.sql));
    expect(update, "the pointer update was never sent").toBeDefined();
    expect(update?.sql, "another customer's selected face is still reachable by id alone")
      .toContain("`casting_candidates`.`userId` = ?");
    expect(update?.params, "the owner is not the deleting account").toContain(USER_ID);
  });

  it("⚠ the warning names WHICH of two bugs it found, and they are different bugs", async () => {
    /*
      One warning stood for both and said *a path dropped a candidate without
      its children*. That is true of an id with no candidate row; it is the
      opposite of true for an id that still HAS one, which means a child row
      carries this account's `userId` while pointing at a candidate it does
      not own. Both are swept safely now, and a reader of the log sent to look
      for the wrong defect is the remaining cost.
    */
    orphanAnswer = [ORPHAN_ID];
    existingCandidateIds = [ORPHAN_ID];

    await runPurge();

    const warnings = logged.filter((entry) => entry.message.includes("[accountCastingPurge]"));
    const misowned = warnings.filter((entry) => "misownedCandidates" in entry.fields);
    const dropped = warnings.filter((entry) => "orphanCandidates" in entry.fields);
    expect(misowned.length, "the mis-owned case was not reported as its own finding").toBe(1);
    expect(misowned[0]?.fields.misownedCandidates).toBe(1);
    expect(misowned[0]?.message, "the message does not say what was actually found")
      .toContain("pointing at a candidate it does not own");
    expect(
      dropped.map((entry) => entry.message),
      "an id with a live candidate row was reported as a dropped candidate",
    ).toEqual([]);
  });

  it("an id with no candidate row is still reported as a dropped candidate — the other half", async () => {
    orphanAnswer = [ORPHAN_ID];
    existingCandidateIds = [];

    await runPurge();

    const warnings = logged.filter((entry) => entry.message.includes("[accountCastingPurge]"));
    expect(
      warnings.filter((entry) => "orphanCandidates" in entry.fields).length,
      "the original finding stopped being reported",
    ).toBe(1);
    expect(
      warnings.filter((entry) => "misownedCandidates" in entry.fields),
      "a dropped candidate was reported as mis-owned",
    ).toEqual([]);
  });

  it("an account with no orphans sends no owner-scoped child statement — the control", async () => {
    /*
      Keeps the two arms above honest in the direction that matters: they must
      be reading the ORPHAN half, not a blanket owner clause the purge would
      send anyway. With her own candidate present and nothing stray, every
      child statement reaches rows by candidate id alone, exactly as before
      this card — so the widening costs the ordinary path nothing.
    */
    candidateRows = [{
      id: 55, userId: USER_ID, imageKey: null, thumbKey: null, sourceKey: null,
    }];

    await runPurge();

    const childStatements = sent.filter((statement) =>
      /^\s*(delete|update)/i.test(statement.sql)
      && statement.params.includes(55));
    expect(
      childStatements.length,
      "no child statement reached her own candidate — this control is reading nothing",
    ).toBeGreaterThan(8);
    expect(
      childStatements.filter((statement) => /`userId` = \?/.test(statement.sql)).map((s) => s.sql),
      "the proven half gained an owner clause; a mis-owned row under her own candidate"
        + " would now outlive the account with its object still up",
    ).toEqual([]);
  });
});

/* ------------------------------------------- what an erasure may not take */

/** An orphan id with NO candidate row anywhere — a genuinely dropped parent. */
const DROPPED_ID = 91;

/**
 * HIS RULING OF 2026-10-08, DRIVEN — the repair owed on PR #1974.
 *
 * The owner-scoping proven above is correct and was not enough. An orphan id
 * pointing at a candidate that STILL EXISTS and belongs to somebody else made
 * the purge delete her mis-stamped child row under THEIR cast — safely, by
 * owner, and still destroying their work. Where that row was the candidate's
 * `selectedVariantId`, their chosen face went with it and the log line said
 * nothing had been touched.
 *
 * His word on the relay's ruling, verbatim and entire: *"i agree with you"*.
 * A child row under a live candidate is work made on that customer's cast, so
 * *"a customer's cast is their work"* (founder, 2026-07-25) makes it theirs.
 */
describe("a child row under another customer's live candidate survives the erasure (#1974)", () => {
  it("⚠ no statement reaches it at all — not scoped by owner, REACHED NOT AT ALL", async () => {
    /*
      The whole account is this case: her one stray child row per store points
      at candidate 77, which still has a row and is not hers. Before this
      repair every child store's collector and delete carried 77 with her
      owner beside it, which took the row and queued its object.
    */
    orphanAnswer = [ORPHAN_ID];
    existingCandidateIds = [ORPHAN_ID];
    orphanPlatesPresent = false;

    const result = await runPurge();

    expect(
      statementsCarryingTheOrphanId().map((statement) => statement.sql),
      "a statement still reaches another customer's cast — owner-scoped is not enough here,"
        + " because the row it removes is THEIR work",
    ).toEqual([]);
    expect(
      result.storageItems.map((item) => item.storageKey),
      "another customer's picture was queued for destruction by this erasure",
    ).toEqual([]);
  });

  it("⚠ their candidate's selected face is never nulled", async () => {
    /*
      The sharpest single harm, and the reason the ruling went this way rather
      than keeping the owner-scoped delete: `deleteVariantRowsIn` nulls
      `castingCandidates.selectedVariantId` before deleting, so if the
      mis-owned row was the variant they chose as their face, their candidate
      was left pointing at a variant that no longer existed.
    */
    orphanAnswer = [ORPHAN_ID];
    existingCandidateIds = [ORPHAN_ID];

    await runPurge();

    expect(
      sent.filter((statement) =>
        /^update `casting_candidates`/.test(statement.sql)
        && statement.params.includes(ORPHAN_ID)).map((statement) => statement.sql),
      "another customer's selected face was reset by someone else's erasure",
    ).toEqual([]);
  });

  it("the warning says the rows were LEFT, and names the cost", async () => {
    /*
      The log line used to read *"only this account's rows are swept; the
      candidate and its owner's rows are untouched"* — which was false in the
      one direction that mattered: her row under their candidate WAS swept,
      and it is their work. A log that describes the opposite of what happened
      is worse than none, because it stops anybody looking.

      It is also the only road by which the mis-stamp gets fixed at its
      source, so the message has to say the rows are still there.
    */
    orphanAnswer = [ORPHAN_ID];
    existingCandidateIds = [ORPHAN_ID];

    await runPurge();

    const misowned = logged.filter((entry) => "misownedCandidates" in entry.fields);
    expect(misowned.length, "the mis-owned finding stopped being reported").toBe(1);
    expect(misowned[0]?.message, "the log still claims the rows were swept").toContain(
      "LEFT IN PLACE",
    );
    expect(
      misowned[0]?.message,
      "the log does not say the rows outlive the account, which is what it costs",
    ).toContain("outlive the deleted account");
  });

  it("⚠ her orphan-PLATE road asks that the design is GONE, not merely unhandled", async () => {
    /*
      THE SAME CLASS ONE HOP DOWN, found by sweeping it rather than by the
      finding (working law 7). A plate has no `candidateId`: its only path to a
      candidate is its design row. `listAccountOrphanInkPlatesIn` asked for
      *her plates minus the ones the candidate pass handled* — a larger set
      than its own docblock describes — so the moment the candidate pass
      stopped handling still-present orphan ids, a plate of hers hanging off a
      design under ANOTHER customer's live candidate fell out of the handled
      list and into this road, and was deleted with its object. The row his
      ruling spared at the candidate depth was taken one level lower.

      Read at the statement, because that is where the contract is
      (invariant 5): the question has to be *is the design row gone*, which is
      a LEFT JOIN tested for null — not an exclusion list.
    */
    orphanAnswer = [ORPHAN_ID];
    existingCandidateIds = [ORPHAN_ID];

    await runPurge();

    const plateReads = sent.filter((statement) =>
      /^select[\s\S]*from `casting_ink_plates`/.test(statement.sql)
      && statement.params.includes(USER_ID));
    expect(plateReads.length, "her orphan-plate road was never asked — this arm reads nothing")
      .toBe(1);
    expect(
      plateReads[0]!.sql,
      "the orphan-plate road still takes every unhandled plate of hers, including one whose"
        + " design hangs off another customer's live cast",
    ).toMatch(/left join `casting_ink_designs`/i);
    expect(
      plateReads[0]!.sql,
      "the read does not require the design row to be ABSENT, so a plate reachable through"
        + " its design is swept by the road meant for unreachable ones",
    ).toMatch(/`casting_ink_designs`\.`id` is null/i);
  });

  it("⚠ a dropped orphan BESIDE it is still swept — the control that matters", async () => {
    /*
      The three arms above all pass if the repair simply stopped sweeping
      orphans, which would re-open #1948 L1 and leave a customer's own face at
      a permanently public URL forever. So both kinds arrive together: 91 has
      no candidate row (hers to take), 77 has one that is not hers (theirs to
      keep), and exactly one of them may appear in a statement.
    */
    orphanAnswer = [DROPPED_ID, ORPHAN_ID];
    existingCandidateIds = [ORPHAN_ID];

    await runPurge();

    const carryingDropped = sent.filter((statement) =>
      statement.params.includes(DROPPED_ID)
      && /^\s*(delete|update|select)/i.test(statement.sql)
      && !OWNER_BLIND_BY_DESIGN.test(statement.sql));
    expect(
      carryingDropped.length,
      "the dropped orphan stopped being swept — #1948 L1 is re-opened and her own picture"
        + " stays at a permanently public URL forever",
    ).toBeGreaterThan(8);
    expect(
      carryingDropped.filter((statement) =>
        !(/`userId` = \?/.test(statement.sql) && statement.params.includes(USER_ID)))
        .map((statement) => statement.sql),
      "the dropped half lost its owner clause — two accounts' rows can point at the same"
        + " dead candidate, so the id still proves nothing",
    ).toEqual([]);
    expect(
      statementsCarryingTheOrphanId().map((statement) => statement.sql),
      "the still-present id travelled along with the dropped one",
    ).toEqual([]);
  });
});

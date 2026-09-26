/**
 * THE MODULE-WIDE INVARIANT-1 CLAIMS HAVE A READER (#1312).
 *
 * # The claim nothing held
 *
 * Four database modules state in their own docblock that the owner is in
 * **every** statement — `castingV2.ts`, `castingV2FaceScans.ts`,
 * `castingV2InkDeliveryCrops.ts`, `castingV2InkDesigns.ts`. They are the
 * highest-value four of #1192's 24 undriven claims for one reason: **their
 * scope grows on its own.** A function added to `castingV2.ts` tomorrow that
 * forgets `userId` makes a sentence in a docblock false, and nothing goes red.
 * The other twenty are each about one named statement, which at least cannot
 * silently acquire new instances.
 *
 * `castingV2.ts` is the roll-domain store — casts, candidates, variants,
 * sessions. A read there that forgets the owner returns **more** rows rather
 * than failing, which is #1192's own sentence: *it would go wrong silently.*
 *
 * # ⚠ THE NAIVE GUARD DOES NOT WORK, AND THE NUMBER IS 14
 *
 * *"In a module claiming every statement carries the owner, every `.where(`
 * must name `userId`"* flags **14 correct statements** of the 73 in these four
 * files (re-measured on this tree, 2026-09-26, and identical to #1312's own
 * reading). All 14 were opened. Three kinds, each a reason rather than an
 * oversight:
 *
 * 1. **Re-anchored through an owned parent — invariant 2, not 1.** The board
 *    item against the board proved owned two statements earlier; the variant
 *    against the candidate proved owned in the same function.
 * 2. **A purge helper taking a `TransactionHandle`**, whose candidate ids were
 *    proved owned by its caller, and the cleanup-manifest deletes whose batch
 *    is owner-checked in the neighbouring statement of the same transaction.
 * 3. **A system-wide sweep with no owner at all** — purgeable candidates,
 *    expired sessions, and the session CAS the sweep drives.
 *
 * So the honest rule is *"carries `userId`, **or** is scoped through a value
 * taken from a row already proved owned in the same function, **or** is a system
 * sweep"* — and the second and third halves are what a grep cannot see.
 *
 * # THE SHAPE: A DERIVED POPULATION PLUS AN EXCEPTION LIST READ BOTH WAYS
 *
 * A stale entry reddens as loudly as a new offender, which is what stops the
 * list becoming a mirror of the tree (working law 4). This repository already
 * uses the shape twice — the public-endpoint allowlist, and
 * `server/db/storageCleanupHold.test.ts`'s `DELETION_ORDERS`.
 *
 * # ⚠ HOW THE POPULATION IS DERIVED — A DECLARED DECISION, NOT AN ASSUMPTION
 *
 * The obvious reader is the docblock sentence itself, and it is the wrong one:
 * it is prose, prose gets reworded, and a module could drop out of its own
 * guard by an editing pass nobody thought was load-bearing. So each claiming
 * module carries a **tag** — `{@link OWNER_SCOPED_MODULE_TAG}`, one line, next
 * to the sentence it belongs to — and the population is every file under
 * `server/` carrying it. That makes enrolment an act in the module (add the
 * tag) rather than a list here, and the tag names this file, so the next reader
 * of that docblock can find the arms.
 *
 * The four are NOT listed below. A floor is asserted instead, because a walker
 * that quietly found nothing and a tree with nothing to find look identical.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const REPO = join(__dirname, "..");

/**
 * The tag a module writes to say *every statement here carries the owner*.
 *
 * Not a sentence: a module's prose may say it however it likes, and does. This
 * is the machine-readable half, and it is the whole population reader.
 */
const OWNER_SCOPED_MODULE_TAG = "@invariant1 module-wide";

/**
 * How many modules must carry the tag before an empty finding means anything.
 *
 * Four carry it today. The floor is the count at the time of writing rather
 * than a round number, because the failure this guards is a reader that went
 * blind — and a reader that found three of four would otherwise pass.
 */
const CLAIMING_MODULE_FLOOR = 4;

/**
 * Every statement in a claiming module that does NOT name `userId`, with the
 * reason it is allowed to.
 *
 * Keyed on the clause's own text rather than a line number: a line moves
 * whenever anything above it does, and a stale line number is a guard that
 * reddens for the wrong reason. Reformatting a listed clause reddens too, and
 * that is correct — the entry is about a statement somebody read, so a rewrite
 * is asking to be read again.
 *
 * ⚠ **EVERY ENTRY IS CHECKED IN BOTH DIRECTIONS.** An entry naming a clause
 * that no longer exists is as loud as a clause naming no entry: the first is
 * how a list rots into a mirror, and it is the failure this shape exists to
 * prevent.
 */
const OWNERLESS_STATEMENTS: ReadonlyArray<{ file: string; clause: string; reason: string }> = [
  // ── 1 · Re-anchored through a parent proved owned in the same function ──
  {
    file: "server/db/castingV2.ts",
    clause: "and(eq(boardItems.id, input.originItemId), eq(boardItems.boardId, input.originBoardId))",
    reason:
      "invariant 2, not 1: the board was proved owned two statements earlier (`eq(boards.userId, input.userId)`, `for(\"update\")`), and this re-anchors the item id sent beside it to that board.",
  },
  {
    file: "server/db/castingV2InkDeliveryCrops.ts",
    clause:
      "and( eq(castingCandidateVariants.publicId, input.variantPublicId), eq(castingCandidateVariants.candidateId, candidate.id), )",
    reason:
      "invariant 2: the candidate was proved owned earlier in the same transaction, and the frame is re-anchored to it — a crop claiming somebody else's render would be geometry about a picture this Cast has never seen.",
  },

  // ── 2 · Purge helpers whose ids the caller proved owned ──
  {
    file: "server/db/castingV2FaceScans.ts",
    clause: "inArray(castingFaceScans.candidateId, [...candidateIds])",
    reason:
      "`listPurgeableFaceScansIn(tx, candidateIds)` — a `TransactionHandle` helper inside the purge's own transaction; the ids come from the owner-scoped selection its caller made.",
  },
  {
    file: "server/db/castingV2InkDeliveryCrops.ts",
    clause: "inArray(castingInkDeliveryCrops.candidateId, [...candidateIds])",
    reason:
      "`listPurgeableInkDeliveryCropsIn` / its delete twin — the same purge shape, for the crops a candidate owns; the ids arrive already owner-scoped.",
  },
  {
    file: "server/db/castingV2InkDesigns.ts",
    clause: "inArray(castingInkDesigns.candidateId, [...candidateIds])",
    reason:
      "the same purge shape, for ink designs — a `TransactionHandle` helper called only by the retention sweep, on ids that sweep has already scoped to an owner.",
  },
  {
    file: "server/db/castingV2FaceScans.ts",
    clause: "eq(storageCleanupItems.batchId, input.cleanupBatchId)",
    reason:
      "the manifest's ITEMS, deleted in the same transaction as the BATCH — and the batch delete one statement below carries `eq(storageCleanupBatches.userId, input.userId)`, which is what proves the batch is this account's.",
  },
  {
    file: "server/db/castingV2InkDeliveryCrops.ts",
    clause: "eq(storageCleanupItems.batchId, input.cleanupBatchId)",
    reason:
      "the same manifest pair, in the crop writer: the items go by batch id and the batch itself is deleted under `userId` in the same transaction.",
  },
  {
    file: "server/db/castingV2InkDesigns.ts",
    clause: "eq(storageCleanupItems.batchId, input.cleanupBatchId)",
    reason:
      "the same manifest pair, in the design writer: the items go by batch id and the batch itself is deleted under `userId` in the same transaction.",
  },

  // ── 3 · System sweeps, which have no owner by design ──
  {
    file: "server/db/castingV2.ts",
    clause:
      "and( isNull(castingCandidates.keptAt), isNull(castingCandidates.signedCastId), sql`",
    reason:
      "`listPurgeableCandidates` — the object sweep, which runs for the whole product and is keyed on expiry rather than on an account.",
  },
  {
    file: "server/db/castingV2.ts",
    clause:
      "and( eq(castingSessions.status, \"open\"), isNotNull(castingSessions.expiresAt), lt(castingSessions.expiresAt, now), )",
    reason:
      "`listExpiredSessions` — the same product-wide sweep, selecting every session whose clock has run out; the caller expires each one under its own owner.",
  },
  {
    file: "server/db/castingV2.ts",
    clause: "and(eq(castingSessions.id, sessionId), eq(castingSessions.status, \"open\"))",
    reason:
      "`markSessionExpired` — a compare-and-set on a session id the sweep above produced; there is no user in scope, and the `status = 'open'` half is what makes it idempotent.",
  },
];

/** Whitespace collapsed, so an entry survives a re-wrap of the same clause. */
const normalise = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Every `.where(` clause in a file, extracted by walking to its closing paren.
 *
 * A line-based reader cannot do this: ten of the 73 clauses in the population
 * span several lines, and three carry a `sql` template with its own parens.
 */
function whereClauses(source: string): string[] {
  const clauses: string[] = [];
  const token = ".where(";
  let at = source.indexOf(token);
  while (at !== -1) {
    let depth = 1;
    let i = at + token.length;
    let inBacktick = false;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "`") inBacktick = !inBacktick;
      else if (!inBacktick && ch === "(") depth += 1;
      else if (!inBacktick && ch === ")") depth -= 1;
      i += 1;
    }
    clauses.push(source.slice(at + token.length, i - 1));
    at = source.indexOf(token, i);
  }
  return clauses;
}

/** Tracked files under `server/`, listed once for every arm below. */
function trackedServerSources(): string[] {
  const listed = execFileSync("git", ["ls-files", "server"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".ts") && !line.endsWith(".test.ts"));
  if (listed.length === 0) throw new Error("git ls-files returned no server sources — the reader is blind, not the tree empty.");
  return listed;
}

/** The modules that claim it, read off the tag rather than off prose. */
function claimingModules(): Array<{ file: string; source: string }> {
  const found: Array<{ file: string; source: string }> = [];
  for (const file of trackedServerSources()) {
    const source = readListedSource(join(REPO, file));
    if (source === null) continue;
    if (source.includes(OWNER_SCOPED_MODULE_TAG)) found.push({ file, source });
  }
  return found;
}

describe("the module-wide invariant-1 claim has a reader (#1312)", () => {
  it("finds the modules that claim it, and finds enough of them to mean something", () => {
    const modules = claimingModules();
    expect(
      modules.length,
      `only ${modules.length} module(s) carry ${OWNER_SCOPED_MODULE_TAG} — a reader that went blind looks exactly like this`,
    ).toBeGreaterThanOrEqual(CLAIMING_MODULE_FLOOR);
    /* And the reader is looking at real files, not at an empty string apiece. */
    for (const module of modules) expect(module.source.length).toBeGreaterThan(200);
  });

  it("every statement in a claiming module carries the owner, or is listed with its reason", () => {
    const unexplained: string[] = [];
    let statements = 0;

    for (const { file, source } of claimingModules()) {
      for (const clause of whereClauses(source)) {
        statements += 1;
        if (clause.includes("userId")) continue;
        const listed = OWNERLESS_STATEMENTS.some(
          (entry) => entry.file === file && normalise(clause).includes(normalise(entry.clause)),
        );
        if (!listed) unexplained.push(`${file} — .where(${normalise(clause).slice(0, 160)})`);
      }
    }

    /* The floor first: `toEqual([])` passes loudest when the walker found
       nothing at all, which is the shape this repository has been burned by. */
    expect(statements, "the clause reader found nothing — it is blind").toBeGreaterThanOrEqual(60);
    expect(unexplained, "a statement in a module claiming module-wide invariant 1 names no owner and is not listed").toEqual([]);
  });

  it("every listed exception still exists — a stale entry is as loud as a new offender", () => {
    const modules = claimingModules();
    const stale: string[] = [];

    for (const entry of OWNERLESS_STATEMENTS) {
      const module = modules.find((one) => one.file === entry.file);
      if (!module) {
        stale.push(`${entry.file} no longer claims module-wide invariant 1, but an exception is listed for it`);
        continue;
      }
      const matches = whereClauses(module.source).filter((clause) =>
        normalise(clause).includes(normalise(entry.clause)),
      );
      if (matches.length === 0) stale.push(`${entry.file} — no statement matches the listed clause: ${entry.clause.slice(0, 80)}`);
      /* A clause naming `userId` that is still listed is stale in the other
         direction: the statement was fixed and the exception outlived it. */
      if (matches.length > 0 && matches.every((clause) => clause.includes("userId"))) {
        stale.push(`${entry.file} — the listed clause now carries userId; delete the exception: ${entry.clause.slice(0, 80)}`);
      }
    }

    expect(stale).toEqual([]);
  });

  it("every exception says WHY, in a sentence somebody wrote", () => {
    for (const entry of OWNERLESS_STATEMENTS) {
      expect(entry.reason.length, `${entry.file}: ${entry.clause.slice(0, 60)} has no real reason`).toBeGreaterThan(40);
    }
  });

  it("the tag points at this file, so the next reader of that docblock finds the arms", () => {
    for (const { file, source } of claimingModules()) {
      expect(source, `${file}'s tag does not name its own guard`).toContain("ownerScopedModules.test.ts");
    }
  });
});

describe("the clause reader itself, driven over source it cannot have memorised", () => {
  /* Working law 2: the arms above are only worth their green if this reader can
     see an offender at all. These drive it over synthetic modules. */

  it("flags a statement that names no owner", () => {
    const source = `
      await db.select().from(t).where(eq(t.id, input.id));
    `;
    expect(whereClauses(source).filter((c) => !c.includes("userId"))).toHaveLength(1);
  });

  it("passes a statement that names the owner", () => {
    const source = `
      await db.select().from(t).where(and(eq(t.id, input.id), eq(t.userId, input.userId)));
    `;
    expect(whereClauses(source).filter((c) => !c.includes("userId"))).toHaveLength(0);
  });

  it("reads a clause that spans lines and a clause carrying a sql template", () => {
    const source = [
      "await db.select().from(t).where(and(",
      "  eq(t.a, 1),",
      "  eq(t.b, 2),",
      "));",
      "await db.select().from(t).where(sql`(${t.c} = 'x' AND (${t.d} IS NULL))`);",
    ].join("\n");
    const clauses = whereClauses(source);
    expect(clauses).toHaveLength(2);
    expect(normalise(clauses[0])).toBe("and( eq(t.a, 1), eq(t.b, 2), )");
    expect(clauses[1]).toContain("IS NULL");
  });

  it("finds nothing in a module with no statements, rather than throwing", () => {
    expect(whereClauses("export const x = 1;\n")).toEqual([]);
  });
});

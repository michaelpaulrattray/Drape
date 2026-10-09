/**
 * THE LIVE ROADS' TERMINAL EVENTS (#1429, #509 part 2's live half).
 *
 * #1425 gave the recovery SWEEP its terminal events. Its own class sweep found
 * the same hole on the live road and filed it: an operation whose claim emits
 * `generation started` and whose SUCCESS settles somewhere other than a
 * capturing completer recorded no terminal at all. **Six such roads were
 * reachable on production**, the headline being a successful Sign — 450 credits,
 * the most expensive thing in the product, recorded as a generation that started
 * and never ended, while both of its failure roads recorded correctly.
 *
 * # WHAT EACH PART OF THIS FILE PROVES, AND WHAT IT CANNOT
 *
 * 1. **The recorders, driven.** The payload, the noun, the money, and the two
 *    things a hand-written capture gets wrong: the per-process action memory
 *    must be CONSUMED (so a road that never took its entry cannot make a later
 *    operation report the wrong noun when the map evicts), and the payload must
 *    survive the real catalogue rather than only a mocked transport.
 * 2. **The population, DERIVED.** Every site that claims an operation is read
 *    out of the tree, and each one's module must reach a capturing completer or
 *    a recorder. A road added tomorrow that forgets its terminal reddens here,
 *    which a list of six file names could never do (working law 4).
 *    ⚠ **The reader that answers "does it reach one" now has controls, and it
 *    needed them (#1432).** It matched a settler's name with a trailing `(`,
 *    which is blind to the dependency-injection idiom every evidence module
 *    uses — so a module that records everything was written onto the debt list
 *    below, and from there into a card as work that did not exist. See
 *    `callsASettler`.
 * 3. **The call ORDER at each site, from the source.** A recorder placed before
 *    its settlement would send an event for a settlement that never happened,
 *    and no unit arm over these six functions could see that without faking
 *    each one's whole world. Read at the bytes instead, and said plainly: this
 *    is a source-shape assertion, not a driven one. Sign's own driven arms live
 *    in `server/castingV2/signService.test.ts`, which already has the harness.
 *
 * ⚠ The `sign` road is DRIVEN there and deliberately not duplicated here.
 *
 * # THE DEBT LIST IS EMPTY AS OF #1432, AND THE MECHANISM STAYS
 *
 * Four modules shipped dark behind `R7_EVIDENCE_COMPOSER_SCOPE` on the reading
 * that a closed door emits no `generation started` either. The list's job was to
 * make that decision survive the door OPENING, and it did: the work landed
 * before the scope moved. Three of the four were genuinely dark and record now;
 * the fourth was a reader defect, described above.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readListedSource } from "../testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

/* This file walks `server/` and loads a real module graph, which is exactly
   #741's derived population. Declared once per FILE, never per arm — a number
   typed onto an `it(…)` is not inherited by the arm written beside it tomorrow. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/* ── the claim, so a real `beginDirectOperation` can reach the recorder ─────── */
let claimVerdict: { type: string; operationId: string } = { type: "claimed", operationId: "" };
vi.mock("../db", () => ({
  claimGenerationOperation: async () => claimVerdict,
  acquireGenerationOperationLock: async () => ({ type: "acquired" }),
  acquireCastingCandidateOperationLock: async () => ({ type: "acquired" }),
  finalizeClaimedGenerationOperationSuccess: async () => undefined,
  finalizeClaimedGenerationOperationFailure: async () => undefined,
  finalizeGenerationOperationFailure: async () => undefined,
  finalizeGenerationOperationSuccess: async () => undefined,
  getGenerationOperationOutcome: async () => null,
  markClaimedGenerationOperationRecoveryRequired: async () => undefined,
  markGenerationOperationRecoveryRequired: async () => undefined,
}));

/* ── the transport, recorded rather than sent ──────────────────────────────── */
const captured: Array<{ name: string; userId: number; properties: Record<string, unknown> }> = [];
vi.mock("../monitoring/productEvents", () => ({
  captureProductEvent: (name: string, userId: number, properties: Record<string, unknown>) => {
    captured.push({ name, userId, properties });
  },
}));

import { projectProductEvent } from "../../shared/productEventCatalogue";
import {
  beginDirectOperation,
  recordDirectOperationDelivered,
  recordDirectOperationFailed,
  resetDirectOperationActionsForTests,
} from "./directOperation";

const ROOT = process.cwd();
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  captured.length = 0;
  resetDirectOperationActionsForTests();
});

/* ══════════════════════════════════════════════════════════════════════════ */

describe("the recorders send what the settlement did", () => {
  it("names the action from the claim, and calls a whole delivery `complete`", () => {
    recordDirectOperationDelivered({
      userId: 1,
      operationId: OPERATION_ID,
      chargedCredits: 450,
      refundedCredits: 0,
    });

    expect(captured).toEqual([{
      name: "generation delivered",
      userId: 1,
      properties: {
        action: "unnamed action",
        outcome: "complete",
        creditsCharged: 450,
        creditsRefunded: 0,
      },
    }]);
  });

  it("carries the NOUN from the real claim to the recorder, end to end", async () => {
    /*
      ⚠ THE ARM THIS FILE WOULD BE WORTH LEAST WITHOUT, AND ITS FIRST DRAFT WAS
      INERT. It called `beginDirectOperation` with no database, let the throw go
      to a `.catch`, and then EXCUSED ITSELF when no `generation started` had been
      recorded — so it proved the noun on exactly zero roads while reading green.

      What it has to prove is the hand-off: the completers and the recorders take
      no `kind`, so the noun is remembered at the claim and taken at the terminal.
      A recorder that read the noun from somewhere else would pass every arm above
      and put the wrong word on his strip. So the claim is REAL here, with only
      the database behind it faked.
    */
    claimVerdict = { type: "claimed", operationId: OPERATION_ID };
    const gate = await beginDirectOperation({
      userId: 1,
      clientRequestId: "33333333-3333-4333-8333-333333333333",
      kind: "castingV2.sign",
      payload: {},
    });
    expect(gate).toEqual({ type: "execute", operationId: OPERATION_ID });

    recordDirectOperationDelivered({
      userId: 1,
      operationId: OPERATION_ID,
      chargedCredits: 450,
      refundedCredits: 0,
    });

    expect(captured.map((event) => [event.name, event.properties.action])).toEqual([
      ["generation started", "sign"],
      ["generation delivered", "sign"],
    ]);
  });

  it("calls a settlement that lost part of what was asked for `partial`", () => {
    recordDirectOperationDelivered({
      userId: 1,
      operationId: OPERATION_ID,
      chargedCredits: 450,
      refundedCredits: 90,
      terminalStatus: "partial",
    });

    expect(captured[0].properties).toMatchObject({ outcome: "partial", creditsRefunded: 90 });
  });

  it("maps a failure's code through the catalogue's vocabulary, and names an unknown", () => {
    recordDirectOperationFailed({
      userId: 1,
      operationId: OPERATION_ID,
      errorCode: "PRECONDITION_FAILED",
      chargedCredits: 0,
      refundedCredits: 0,
    });
    recordDirectOperationFailed({
      userId: 1,
      operationId: OPERATION_ID,
      errorCode: "FORK_COPY_FAILED",
      chargedCredits: 0,
      refundedCredits: 0,
    });

    expect(captured.map((event) => event.properties.errorCode))
      .toEqual(["PRECONDITION_FAILED", "UNRECOGNISED"]);
  });

  it("CONSUMES the remembered action, so a recorded road cannot leak an entry", async () => {
    /*
      Before this card the four completers took their entry and Sign's success
      never did, so every successful Sign left one behind. The map is capped at
      512 and evicts the OLDEST, so a leak is not merely untidy: enough of them
      and a LIVE operation's entry is evicted and its terminal reports `unnamed
      action`. Taking the entry is the fix, and this is the arm that keeps it.

      ⚠ IT HAS TO CLAIM FIRST, AND THE FIRST DRAFT DID NOT — it recorded twice
      over an operation the map had never heard of, so both calls said `unnamed
      action` whether the entry was consumed or not. Sabotage proved it: deleting
      the `.delete` from `takeAction` left all 56 arms green. An arm whose
      fixture cannot ask the question reads exactly like a passing one.
    */
    claimVerdict = { type: "claimed", operationId: OPERATION_ID };
    await beginDirectOperation({
      userId: 1,
      clientRequestId: "44444444-4444-4444-8444-444444444444",
      kind: "castingV2.refine",
      payload: {},
    });

    for (let call = 0; call < 2; call += 1) {
      recordDirectOperationDelivered({
        userId: 1,
        operationId: OPERATION_ID,
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }

    expect(captured.map((event) => event.properties.action))
      .toEqual(["refine", "refine", "unnamed action"]);
  });
});

describe("the payloads pass the real catalogue, not only the mock", () => {
  it("every event these recorders produce projects to `send` with nothing dropped", () => {
    /* ⚠ THE ARM THAT MAKES THE REST WORTH ANYTHING (#1425's own last arm, same
       reasoning). With the transport mocked the projection never runs, so a
       payload the catalogue would REFUSE reads exactly like one it would send —
       and every arm above would stay green over an event nobody can receive. */
    recordDirectOperationDelivered({
      userId: 1, operationId: OPERATION_ID, chargedCredits: 450, refundedCredits: 0,
    });
    recordDirectOperationDelivered({
      userId: 1, operationId: OPERATION_ID, chargedCredits: 450, refundedCredits: 90,
      terminalStatus: "partial",
    });
    recordDirectOperationDelivered({
      userId: 1, operationId: OPERATION_ID, chargedCredits: 0, refundedCredits: 0,
    });
    recordDirectOperationFailed({
      userId: 1, operationId: OPERATION_ID, errorCode: "PRECONDITION_FAILED",
      chargedCredits: 0, refundedCredits: 0,
    });
    recordDirectOperationFailed({
      userId: 1, operationId: OPERATION_ID, errorCode: "FORK_COPY_FAILED",
      chargedCredits: 0, refundedCredits: 0,
    });

    expect(captured, "no payload was recorded — this arm is reading nothing").toHaveLength(5);
    for (const event of captured) {
      const verdict = projectProductEvent(event.name as never, {
        ...event.properties,
        /* The two the transport attaches itself, so the projection sees a whole
           event rather than one missing its required pair. */
        world: "local",
        release: "abcdef1",
      });
      expect(verdict.verdict, `${event.name} would be refused: ${JSON.stringify(verdict)}`)
        .toBe("send");
      expect(
        verdict.verdict === "send" ? verdict.dropped : [],
        `${event.name} sends a property the catalogue does not declare`,
      ).toEqual([]);
    }
  });

  it("POSITIVE CONTROL — the projection this arm relies on can refuse", () => {
    const refused = projectProductEvent("generation delivered" as never, {
      action: "not a noun we declare",
      outcome: "complete",
      creditsCharged: 450,
      creditsRefunded: 0,
      world: "local",
      release: "abcdef1",
    });
    expect(refused.verdict).toBe("refuse");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   THE POPULATION, DERIVED FROM THE TREE
   ══════════════════════════════════════════════════════════════════════════ */

/** Modules that route a terminal through a completer which already captures. */
const CAPTURING_COMPLETERS = [
  "completeDirectOperationSuccess",
  "completeClaimedDirectOperationSuccess",
];
/** The recorders this card added, for a settlement made some other way. */
const RECORDERS = ["recordDirectOperationDelivered", "recordDirectOperationFailed"];

/**
 * Does this module CALL one of the settlers above?
 *
 * ⚠ THIS WAS `source.includes("completeDirectOperationSuccess(")` UNTIL #1432,
 * AND THE TRAILING `(` MADE IT BLIND TO THE HOUSE STYLE OF THE VERY FAMILY IT
 * WAS READING. Every evidence module injects its settler for its tests:
 *
 *     await (dependencies.completeSuccess ?? completeDirectOperationSuccess)({
 *
 * — the name, a `)`, then the `(`. So `inkCandidateGeneration.ts` read as
 * recording NOTHING while it routes both of its claim sites' success through
 * `completeDirectOperationSuccess` and both failures through
 * `completeDirectOperationFailure` (lines 839/860 and 1126/1150), money and all.
 * It was written onto the debt list, and from there into #1432's own table as
 * *"PAID — its money has to be read before an event can quote it"*, which was
 * work that did not exist.
 *
 * **A reader may be wrong toward noise as well as toward silence, and only one
 * of those two errors gets written into a document as a fact.** This one did,
 * within a day. Both controls are driven below.
 *
 * Its stated limit, unchanged by the widening: this reads SOURCE, so a docblock
 * that quotes a settler's name with a paren counts as a call. The per-site order
 * arms are what read what actually happens where.
 */
function callsASettler(source: string): boolean {
  return [...CAPTURING_COMPLETERS, ...RECORDERS].some(
    (name) => new RegExp(`\\b${name}\\s*\\)?\\s*\\(`).test(source),
  );
}

/**
 * ⚠ THE ENUMERATED REMAINDER, AND IT IS EMPTY — CLOSED BY #1432.
 *
 * It held four modules behind `R7_EVIDENCE_COMPOSER_SCOPE` (`off` on
 * production), on the reading that a closed door emits no `generation started`
 * either, so there was no gap on his strip and no wrong number he could read.
 * **The list's own job was to make that decision survive the door opening**, and
 * it did exactly that: the card it named was worked before the scope moved.
 *
 * What #1432 found on the way is the part worth keeping. **One of the four was
 * never dark at all** — `inkCandidateGeneration.ts`, the PAID pair, routes both
 * its successes and both its failures through the capturing completers. It was
 * on this list because the reader could not see a settler called through a
 * dependency default; see `callsASettler` above, whose controls now pin both
 * directions. The other three were real and are recorded now.
 *
 * **The mechanism stays with nothing in it.** An empty debt list is the state a
 * debt list is supposed to reach, and keeping it means the next road that must
 * ship dark has somewhere to be declared rather than a reason to be argued for.
 * A line added here is a founder-visible act and says which door it is behind.
 */
const DARK_BEHIND_A_CLOSED_DOOR: Record<string, string> = {};

/** Every module under `server/` that claims a generation operation. */
function modulesThatClaimAnOperation(): string[] {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      /* A listed entry can be gone before it is even classified (#223) — the
         stat, not only the read, and this tree carries hundreds of untracked
         disposables that come and go. */
      const stats = statSync(full, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".ts") || full.endsWith(".test.ts")) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      if (!/\bbegin(DirectOperation)?\s*\)?\s*\(\s*\{/.test(source)) continue;
      if (!source.includes("beginDirectOperation")) continue;
      found.add(full.split("\\").join("/").slice(ROOT.split("\\").join("/").length + 1));
    }
  };
  walk(resolve(ROOT, "server"));
  return [...found].sort();
}

describe("the settler reader, controlled in both directions (#1432)", () => {
  /* Law 2: a reader whose verdict goes into a debt list — and from there into a
     card — gets a negative and a positive control before its findings count.
     This one had neither, and it put a module on that list that never belonged
     there. */

  it("sees a settler called through a dependency default — the house style", () => {
    expect(callsASettler(
      "await (dependencies.completeSuccess ?? completeDirectOperationSuccess)({",
    )).toBe(true);
    expect(callsASettler("  recordDirectOperationDelivered({")).toBe(true);
  });

  it("does NOT see an import, a type reference or an unrelated module as a call", () => {
    expect(callsASettler("import { completeDirectOperationSuccess } from \"../directOperation\";"))
      .toBe(false);
    expect(callsASettler("  completeSuccess?: typeof completeDirectOperationSuccess;"))
      .toBe(false);
    expect(callsASettler("  begin?: BeginOperation; markRunning?: typeof markRunning;"))
      .toBe(false);
    /* The near-miss that matters: a longer name that merely ENDS with a settler's
       is not that settler. */
    expect(callsASettler("await notCompleteDirectOperationSuccess({")).toBe(false);
  });

  it("reads the real paid ink road as settling, which the old reader could not", () => {
    const source = readListedSource(
      resolve(ROOT, "server/casting/evidence/inkCandidateGeneration.ts"),
    );
    expect(source, "the paid ink road is gone — this control cannot be taken").not.toBeNull();
    expect(callsASettler(source!)).toBe(true);
    /*
      AND THE OLD READER'S VERDICT, PINNED SO THE FINDING CANNOT QUIETLY REVERT.

      `source.includes("completeDirectOperationSuccess(")` — the reader as it
      stood — is FALSE of this file, because every call goes through the
      dependency default. That single character is what put a module that
      records everything onto a list of modules that record nothing.
    */
    expect(source!.includes("completeDirectOperationSuccess(")).toBe(false);
    expect(source!.includes("(dependencies.completeSuccess ?? completeDirectOperationSuccess)({"))
      .toBe(true);
  });
});

describe("every road that starts a generation records its terminal", () => {
  it("the population is read from the tree and is not empty", () => {
    const modules = modulesThatClaimAnOperation();
    /* A walk that silently read nothing is indistinguishable from a tree with
       no claims in it, and it would make every arm below pass. The floor is the
       roads known at the time of writing; a bigger number is fine. */
    expect(modules.length, "the walk found no claiming module — the reader is broken")
      .toBeGreaterThanOrEqual(14);
    expect(modules).toContain("server/castingV2/signService.ts");
    expect(modules).toContain("server/casting/finalCastDeletionCeremony.ts");
  });

  it("each one reaches a capturing completer or a recorder, or is an enumerated debt", () => {
    const missing: string[] = [];
    for (const module of modulesThatClaimAnOperation()) {
      const source = readListedSource(resolve(ROOT, module));
      if (source === null) continue;
      const settles = callsASettler(source);
      /*
        `castingExport.ts` and `boardOps.ts` each hold several claims and settle
        some of them in ANOTHER module — `wholeCastRestore.ts`, `evidenceFork.ts`
        — so a module-level read is the honest granularity here and it is a
        FLOOR, not coverage: a module with one recorded road and one forgotten
        one passes this arm. The per-site order arms below are what read those.
      */
      if (!settles && !(module in DARK_BEHIND_A_CLOSED_DOOR)) missing.push(module);
    }
    expect(missing, "a road claims an operation and records no terminal anywhere")
      .toEqual([]);
  });

  it("the enumerated debt is exactly the roads that are still dark — it may only shrink", () => {
    /* A debt line for a module that now records is a lie that hides the next
       real one, which is why `capability:check`'s KNOWN_DEBTS works this way. */
    const stillClaiming = new Set(modulesThatClaimAnOperation());
    for (const [module, reason] of Object.entries(DARK_BEHIND_A_CLOSED_DOOR)) {
      expect(stillClaiming, `${module} no longer claims an operation — delete its debt line`)
        .toContain(module);
      const source = readListedSource(resolve(ROOT, module));
      expect(source, `${module} is gone — delete its debt line`).not.toBeNull();
      expect(
        callsASettler(source!),
        `${module} now records its terminal — delete its debt line`,
      ).toBe(false);
      expect(reason, `${module}'s debt line must say why it is still dark`).toMatch(/scope off|#\d+/);
    }
  });
});

describe("each live road records AFTER its settlement, read at the bytes", () => {
  const read = (path: string): string => {
    const source = readListedSource(resolve(ROOT, path));
    if (source === null) throw new Error(`${path} is not there — this arm cannot read it`);
    return source;
  };

  /**
   * Where a CODE LINE sits in a block, and it REFUSES rather than returning -1.
   *
   * ⚠ Two reasons, both paid for on this arm:
   *
   *   1. **`indexOf` finds prose.** A docblock quoting the line it describes —
   *      ``…the tail is `if (deliveredEvent) recordDirectOperationDelivered(…)`
   *      and N2b inserted…`` — is an earlier match than the statement, so a
   *      comment ABOUT the order could fail an arm about the order. That is
   *      what happened when finding 4 on PR #2114 was repaired. Anchoring to the
   *      start of a line with only indentation in front means a backticked
   *      quotation inside prose can never be mistaken for the statement.
   *   2. **-1 orders before everything.** `indexOf` returning -1 made every
   *      `toBeLessThan` below pass vacuously, so this arm would have gone quiet
   *      the day a name it reads was renamed — rather than saying so.
   */
  const at = (block: string, line: RegExp): number => {
    const found = block.search(line);
    if (found < 0) {
      throw new Error(`this arm cannot find ${line} — the shape it asserts has moved, so it must be re-read`);
    }
    return found;
  };

  it("sign records after the finalizer settled it, and keeps its backstop below the catch", () => {
    const source = read("server/castingV2/signService.ts");
    const fn = source.slice(source.indexOf("async function completeSignPackage"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));

    const settles = at(body, /^\s+await finalizeGenerationOperationSuccess\(/m);
    const composed = at(body, /^\s+deliveredEvent = \{$/m);
    const records = at(body, /^\s+recordDirectOperationDelivered\(deliveredEvent\);$/m);
    const catches = at(body, /^\s+\} catch \(error\) \{$/m);
    const backstop = at(body, /^\s+if \(deliveredEvent\) recordDirectOperationDelivered\(deliveredEvent\);$/m);

    /* THE RULE, which is this describe's own title: the recorder comes after the
       settlement. A recorder before it would send an event for a settlement that
       never happened. */
    expect(settles).toBeLessThan(composed);
    expect(composed).toBeLessThan(records);

    /*
      ⚠ **AND THE HAPPY PATH RECORDS INSIDE THE TRY, WHICH THIS ARM USED TO
      FORBID — read it before moving it back.** The old shape asserted the
      recording was below the catch, with the reason *"sending inside the try
      records a park"*. That reason does not hold at THIS point in this function:
      `finalizeGenerationOperationSuccess` has already returned, so the operation
      is terminal (its `WHERE status = 'running'` matched, and it throws
      otherwise) and no later throw can hand it to the sweep to settle again.
      What the old placement did instead was make the receipt wait on N2b's
      persona read — a 75 s deadline behind a queue of concurrency 1 — which
      delayed every delivered event under load and lost it to a deploy inside
      that window (the relay's finding 4 on PR #2114).

      The rule is unchanged and still proven above. What moved is only WHERE
      after the settlement, and the two orderings below keep the backstop honest.
    */
    expect(records).toBeLessThan(catches);
    expect(catches).toBeLessThan(backstop);
  });

  it("the whole-Cast restore records after the transaction committed", () => {
    const source = read("server/routes/generation/castingExport.ts");
    const door = source.slice(source.indexOf('kind: "casting.restore_state"'));
    const block = door.slice(0, door.indexOf("restoreSlotVersion:"));
    expect(block.indexOf("await commitWholeCastRestore("))
      .toBeLessThan(block.indexOf("recordDirectOperationDelivered("));
    /* Below the catch, so a rolled-back restore records nothing. */
    expect(block.indexOf("return completeDirectOperationFailure("))
      .toBeLessThan(block.indexOf("recordDirectOperationDelivered("));
  });

  it("the Cast deletion ceremony records after the authority sealed its receipt", () => {
    const source = read("server/casting/finalCastDeletionCeremony.ts");
    /* From the EXECUTION block only. `summarizeFinalCastDeletion` also appears
       in the replay branch above, where it reads the receipt an earlier attempt
       sealed — a whole-file `indexOf` finds that one and the arm then compares
       two unrelated positions. */
    const block = source.slice(source.indexOf("await markGenerationOperationRunning("));
    expect(block.indexOf("await executeFinalCastDeletion("))
      .toBeLessThan(block.indexOf("recordDirectOperationDelivered("));
    expect(block.indexOf("recordDirectOperationDelivered("))
      .toBeLessThan(block.indexOf("const counts = summarizeFinalCastDeletion("));
  });

  it("both reference-plate roads record after their own settling statement", () => {
    const source = read("server/casting/evidence/evidenceOperations.ts");
    const ingest = source.slice(source.indexOf('kind: "evidence_plate_ingest"'));
    const ingestBlock = ingest.slice(0, ingest.indexOf("function discardReplay"));
    expect(ingestBlock.indexOf("await attachAndCompleteReferencePlateOperation("))
      .toBeLessThan(ingestBlock.indexOf("recordDirectOperationDelivered("));

    const discard = source.slice(source.indexOf('kind: "evidence_plate_discard"'));
    expect(discard.indexOf("await discardReferencePlateOperation("))
      .toBeLessThan(discard.indexOf("recordDirectOperationDelivered("));
  });

  it("the evidence fork records BOTH ways, each after its own settlement", () => {
    /* The only road in the population whose failure also recorded nothing: its
       catch calls `finalizeClaimedGenerationOperationFailure` directly rather
       than going through a capturing completer. */
    const source = read("server/casting/evidence/evidenceFork.ts");
    expect(source.indexOf("commitEvidenceForkIn(tx"))
      .toBeLessThan(source.indexOf("recordDirectOperationDelivered("));
    expect(source.indexOf("await finalizeClaimedGenerationOperationFailure("))
      .toBeLessThan(source.indexOf("recordDirectOperationFailed("));
    /* And the failure recorder sits inside the inner `try`, which is what makes
       "the finalizer returned" its condition — the `replay_failure`
       fall-through below must stay silent because the sweep owns that row. */
    const failureBlock = source.slice(
      source.indexOf("await finalizeClaimedGenerationOperationFailure("),
      source.indexOf("} catch (receiptError) {"),
    );
    expect(failureBlock).toContain("recordDirectOperationFailed(");
  });

  /* ── the four ink-composer roads #1432 recorded ────────────────────────────
     Every one settles inside a `commit…` whose transaction holds a
     `finalize…SuccessIn`, so "after the settlement" means after that commit
     RETURNED — a rolled-back transaction settled nothing. Each arm reads the
     await of the commit below the claim and the recorder below the await, which
     is the one ordering a unit arm over these functions could not see without
     faking each one's whole world. */

  it("the ink intent records after its commit returned, above the shape check", () => {
    const source = read("server/casting/evidence/inkAddIntent.ts");
    const block = source.slice(source.indexOf('kind: "evidence_intent_begin"'));
    expect(block.indexOf("dependencies.commit ?? commitBeginInkAnywhereIntent"))
      .toBeLessThan(block.indexOf("recordDirectOperationDelivered("));
    /* Above `closedAnywhereIntentResult`, which can throw: the settlement
       happened, and a result this process cannot read back does not un-happen
       it. That ordering is deliberate and is the one a later edit would flip. */
    expect(block.indexOf("recordDirectOperationDelivered("))
      .toBeLessThan(block.lastIndexOf("return closedAnywhereIntentResult("));
  });

  it("the candidate acceptance records once, below both commit branches", () => {
    const source = read("server/casting/evidence/inkCandidateAcceptance.ts");
    const block = source.slice(source.indexOf("const accepted = prepared.kind ==="));
    expect(block.indexOf("commitInkProjectionCandidateAcceptance"))
      .toBeLessThan(block.indexOf("recordDirectOperationDelivered("));
    expect(block.indexOf("dependencies.commit ?? commitInkCandidateAcceptance"))
      .toBeLessThan(block.indexOf("recordDirectOperationDelivered("));
    /* ONE recorder for two settlements. Two copies is the shape that lets a
       third branch arrive tomorrow with no record at all. */
    expect(source.match(/recordDirectOperationDelivered\(/g)).toHaveLength(1);
  });

  it("both cancellation roads record after their own commit returned", () => {
    const source = read("server/casting/evidence/inkIntentCancellation.ts");
    const intent = source.slice(source.indexOf('kind: "evidence_candidate_cancel" as const'));
    const intentBlock = intent.slice(0, intent.indexOf("export async function cancelInkProjectionCandidate"));
    expect(intentBlock.indexOf("dependencies.commit ?? commitCancelInkAddIntent"))
      .toBeLessThan(intentBlock.indexOf("recordDirectOperationDelivered("));

    const projection = source.slice(source.indexOf("export async function cancelInkProjectionCandidate"));
    expect(projection.indexOf("dependencies.commit ?? commitCancelInkProjectionCandidate"))
      .toBeLessThan(projection.indexOf("recordDirectOperationDelivered("));

    /* A cancellation is a DELIVERY, not a failure: the customer asked for it and
       got it, and recording it as a failure would put her own decision into the
       refusal rate. So neither road may reach for the failure recorder. */
    expect(source).not.toContain("recordDirectOperationFailed(");
  });
});

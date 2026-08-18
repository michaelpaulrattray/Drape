/**
 * THE DOUBLE-BUY PROOF — Landing C's named first blocker, driven.
 *
 * `CASTING_V2_REFINE_DISPATCH_DESIGN.md` §4 says the double-buy risk "must be
 * closed before Landing C, not after", and names one thing to prove:
 *
 *   > a repeat of the SAME `clientRequestId` returns the first receipt rather
 *   > than claiming a second operation — driven directly, not inferred from
 *   > the field's presence.
 *
 * opus-629 §4 found that proof necessary and insufficient, and fable-841 §2
 * ratified the finding: **the client mints a fresh uuid on every submit**
 * (`CastingSheet.tsx:1422`), so a second TAP — the thing a fast receipt
 * actually invites — is not a repeat of the same id at all. No castingV2
 * caller passes a `lockKey`, so nothing at the claim seam refuses a second
 * refine of the same face under a different id. Today's cover is the long
 * hold, which is exactly what Landing C removes.
 *
 * So three arms, ordered by what they cost the customer:
 *
 *   ARM 1  same id, SEQUENTIAL      the design's own question: does a replay
 *                                   return the first receipt?
 *   ARM 2  same id, CONCURRENT      the network-retry case: the second arrives
 *                                   while the first is still inside the render
 *   ARM 3  different ids, same face, CONCURRENT
 *                                   **the double tap.** It DID claim twice
 *                                   (2026-08-17), which was the finding; the
 *                                   candidate lock has since been built
 *                                   (ruled fable-974) and this arm is now its
 *                                   REGRESSION — the second tap must be
 *                                   refused and the money must move once.
 *
 * # What arm 3 measures now, and why it is not the operation-row count
 *
 * The lock is taken AFTER the claim, so the refused tap still leaves an
 * operation row — terminal, `CONFLICT`, never charged. Counting rows would read
 * that as "claimed twice" and be wrong about the only thing that matters. So
 * the arm counts CHARGES and VARIANTS, and prints the row statuses beside them
 * so the shape is visible rather than asserted away.
 *
 * # How this is free, and where the real seam is
 *
 * The CLAIM is real: `refineCandidate` → `beginDirectOperation` →
 * `claimGenerationOperation`, against the dev database, with nothing restated
 * (fable-841 §3a — a proof that re-implements the predicate proves the
 * re-implementation). Everything DOWNSTREAM of the claim is stubbed:
 *
 *   interpret   a fixed parse, so no text call and no provider money
 *   deduct      a COUNTER that returns success and moves no credits
 *   refund      a counter
 *   readBytes   the first thing the paid path does after the deduct — it
 *               throws (or, in the concurrent arms, WAITS on a latch), so the
 *               attempt ends there having claimed, charged (in the counter)
 *               and never painted
 *
 * The money question is therefore counted rather than spent: **how many times
 * would this customer have been charged**, which is the question the design
 * asks. Zero credits move; the ledger is read at both ends and the run refuses
 * if it moved.
 *
 * # Controls (working law 2), run before any arm, and the run exits nonzero
 * # if either fails
 *
 *   POSITIVE  two DIFFERENT ids, sequential, must produce TWO operation rows.
 *             Without it, every "1 operation" below could be an instrument
 *             that cannot count to two, and all three arms would "pass" on a
 *             blind counter.
 *   NEGATIVE  a fresh id against a candidate that does not exist must claim
 *             NOTHING — otherwise the counter is counting rows this run did
 *             not cause.
 *
 * Arms are independent by construction (fable-841 §3b): each uses its own
 * client request ids and its own counters, and every operation row this script
 * creates is deleted at the end with a leftover count printed.
 *
 *   npx tsx scripts/prove-refine-idempotency-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { beginDirectOperation } from "../server/casting/directOperation";
import type { interpretRefinement } from "../server/castingV2/refineInterpreter";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this WRITES operation rows");
assertOneWorld(["DATABASE_URL"]);

/**
 * THE SABOTAGE SWITCH — bound (b) of fable-841 §3: an arm whose verdict cannot
 * be flipped alone is an arm that may be reading something other than what it
 * claims, and three arms sharing one connection and one fixture face is exactly
 * the shape that has produced a shared-state pass here before.
 *
 * Each sabotage perturbs the ONE variable its arm's verdict turns on:
 *   --sabotage=1   arm 1's second call gets a FRESH id  → must become 2 ops
 *   --sabotage=2   arm 2's second call gets a FRESH id  → must become 2 ops
 *   --sabotage=3   arm 3's claim is made WITHOUT the candidate lock → the
 *                  double tap must buy twice again
 * and in every case the other two arms must be unchanged.
 */
const SABOTAGE = Number((process.argv.find((a) => a.startsWith("--sabotage=")) ?? "").split("=")[1] ?? 0);

const USER = Number(process.env.USER_ID ?? 1);
const FACE = process.env.FACE ?? "";
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));

const db = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await db.query<any[]>(sql, params);
  return rows;
};

const say = (line = "") => console.log(line);

/* ── the fixture: a real, ready, owned face in this world ─────────────────── */
const [face] = FACE
  ? await query("SELECT id, publicId, userId FROM casting_candidates WHERE publicId = ?", [FACE])
  : await query(
    `SELECT id, publicId, userId FROM casting_candidates
      WHERE userId = ? AND status = 'ready' AND imageKey IS NOT NULL
      ORDER BY id DESC LIMIT 1`, [USER]);
if (!face) throw new Error("no ready fixture face in this world");
if (face.userId !== USER) throw new Error("that face belongs to someone else — refusing");

say(`WORLD    DATABASE_URL → ${where.hostname}:${where.port}`);
if (SABOTAGE) say(`SABOTAGE arm ${SABOTAGE} — its own verdict must FLIP and the other two must not`);
say(`FIXTURE  candidate ${face.publicId} (row ${face.id}), user ${USER}`);
say();

/* ── the stubs: everything downstream of the claim ────────────────────────── */

/** Every id this run creates, so cleanup deletes what it caused and nothing else. */
const mintedIds = new Set<string>();

type Counters = { deducts: number; refunds: number; reachedReadBytes: number };

/** A parse the doors accept without a text call: one plain hair-colour edit. */
const fixedParse = { ok: true as const, intent: "edit" as const, delta: { hairColour: "copper" } };

/**
 * WHERE THE LATCH SITS, AND WHY IT MOVED — the first version of this harness
 * held the call inside `readBytes`, and that was the wrong seam.
 *
 * `readBytes` is called twice on this path, and **the first call is BEFORE the
 * claim** (`refineService.ts:2498`, pinning the base's presentation; a throw
 * there is soft and only logs *"could not pin the base's presentation"*). So a
 * latch there held the first caller before it had claimed anything, the second
 * caller claimed first, and the arms measured a sequence rather than an
 * overlap. The counts were right and the story was wrong, which is the worse
 * of the two failures.
 *
 * The latch is now the **pinned deduct** — after `claimGenerationOperation`,
 * after `claimVariant`, after `markRunning`. A call held here has genuinely
 * claimed the operation and taken the charge, so a second call arriving now is
 * the real in-flight case the design is asking about.
 *
 * `readBytes` still throws, which ends every attempt before a pixel is asked
 * for.
 */
type Stop = { kind: "throw" } | { kind: "wait"; release: Promise<void> };

function harness(counters: Counters, stop: Stop) {
  return {
    admit: () => true,
    /*
      SABOTAGE 3 TAKES THE LOCK AWAY, which is the only perturbation that can
      flip this arm now that the guard exists.
    
      Sharing one client request id — the old sabotage — no longer
      discriminates: the replay path would produce one charge and one variant
      too, so the arm would "pass" through a mechanism it is not testing. This
      strips the candidate from the claim instead, leaving everything else
      identical, and the double tap must go back to buying twice.
    */
    ...(SABOTAGE === 3
      ? {
        begin: ((claim: Parameters<typeof beginDirectOperation>[0]) => {
          const { candidateLockPublicId: _dropped, ...unguarded } = claim;
          return beginDirectOperation(unguarded);
        }) as never,
      }
      : {}),
    interpret: (async () => fixedParse) as unknown as typeof interpretRefinement,
    deduct: (async (_userId: number, _amount: number, _kind: string, _note: string, reference: string) => {
      counters.deducts += 1;
      /* THE IN-FLIGHT MOMENT: claimed, charged, not yet painted. */
      if (stop.kind === "wait") await stop.release;
      return { success: true as const, newBalance: 0, reference };
    }) as never,
    /* The real `recordRefund` returns a RefundOutcome, not a CreditWriteResult.
       The first version returned the wrong shape and every arm's sentence read
       "the refund could not be recorded" — harmless to the counts, and exactly
       the kind of harness artifact that gets quoted later as a product fact. */
    refund: (async (_userId: number, amount: number, _description: string, chargeReferenceId: string) => {
      counters.refunds += 1;
      return { recorded: true, amount, reference: `refund:${chargeReferenceId}`, duplicate: false };
    }) as never,
    readBytes: (async () => {
      counters.reachedReadBytes += 1;
      throw new Error("proof-harness: stopped before the paint");
    }) as never,
  };
}

async function call(clientRequestId: string, counters: Counters, stop: Stop): Promise<string> {
  mintedIds.add(clientRequestId);
  try {
    await refineCandidate(harness(counters, stop) as never, {
      userId: USER,
      clientRequestId,
      candidatePublicId: face.publicId,
      instruction: "colour her hair copper",
    });
    return "(resolved)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** How many operation rows exist for a set of client request ids. */
async function operationsFor(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM generation_operations
      WHERE userId = ? AND clientRequestId IN (${ids.map(() => "?").join(",")})`,
    [USER, ...ids],
  );
  return Number(row.n);
}

/** And how many variant rows those operations created — the second money artifact. */
async function variantsFor(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await query(
    `SELECT COUNT(*) AS n FROM casting_candidate_variants v
       INNER JOIN generation_operations o ON o.id = v.operationId
      WHERE o.userId = ? AND o.clientRequestId IN (${ids.map(() => "?").join(",")})`,
    [USER, ...ids],
  );
  return Number(row.n);
}

const ledgerBefore = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];

/* ── CONTROLS ─────────────────────────────────────────────────────────────── */

say("CONTROLS");

const controlIds = [randomUUID(), randomUUID()];
const controlCounters: Counters = { deducts: 0, refunds: 0, reachedReadBytes: 0 };
for (const id of controlIds) await call(id, controlCounters, { kind: "throw" });
const controlOps = await operationsFor(controlIds);
const positivePass = controlOps === 2;
say(`  POSITIVE  two different ids, sequential → 2 operation rows   saw ${controlOps}   ${positivePass ? "pass" : "FAIL"}`);

const ghostId = randomUUID();
const ghostCounters: Counters = { deducts: 0, refunds: 0, reachedReadBytes: 0 };
mintedIds.add(ghostId);
let ghostThrew = "";
try {
  await refineCandidate(harness(ghostCounters, { kind: "throw" }) as never, {
    userId: USER,
    clientRequestId: ghostId,
    candidatePublicId: randomUUID(),
    instruction: "colour her hair copper",
  });
} catch (error) {
  ghostThrew = error instanceof Error ? error.message : String(error);
}
const ghostOps = await operationsFor([ghostId]);
const negativePass = ghostOps === 0 && ghostCounters.deducts === 0;
say(`  NEGATIVE  a face that does not exist → 0 operations, 0 charges   saw ${ghostOps} / ${ghostCounters.deducts}   ${negativePass ? "pass" : "FAIL"}`);
say(`            (it refused with: ${JSON.stringify(ghostThrew.slice(0, 70))})`);

if (!positivePass || !negativePass) {
  say("\nCONTROL FAILED — no verdict is reported from a blind instrument.");
  await cleanup();
  await db.end();
  process.exit(1);
}

say();

/* ── ARM 1 — same id, sequential ──────────────────────────────────────────── */

say("=".repeat(78));
say("ARM 1  the SAME clientRequestId, sent again after the first settled");
say("-".repeat(78));
const arm1Id = randomUUID();
const arm1: Counters = { deducts: 0, refunds: 0, reachedReadBytes: 0 };
const arm1First = await call(arm1Id, arm1, { kind: "throw" });
const arm1SecondId = SABOTAGE === 1 ? randomUUID() : arm1Id;
const arm1Second = await call(arm1SecondId, arm1, { kind: "throw" });
const arm1Ids = [arm1Id, arm1SecondId];
const arm1Ops = await operationsFor(arm1Ids);
const arm1Variants = await variantsFor(arm1Ids);
say(`  first   ${JSON.stringify(arm1First.slice(0, 72))}`);
say(`  second  ${JSON.stringify(arm1Second.slice(0, 72))}`);
say(`  operations ${arm1Ops} · variants ${arm1Variants} · charges ${arm1.deducts} · reached the paint ${arm1.reachedReadBytes}`);
say(`  VERDICT ${arm1Ops === 1 && arm1.deducts === 1 ? "IDEMPOTENT — one operation, one charge" : "NOT IDEMPOTENT"}`);
say();

/* ── ARM 2 — same id, concurrent ──────────────────────────────────────────── */

say("=".repeat(78));
say("ARM 2  the SAME clientRequestId, sent again WHILE the first is in flight");
say("-".repeat(78));
const arm2Id = randomUUID();
const arm2: Counters = { deducts: 0, refunds: 0, reachedReadBytes: 0 };
let releaseArm2: () => void = () => {};
const arm2Gate = new Promise<void>((resolve) => { releaseArm2 = resolve; });
const arm2FirstPromise = call(arm2Id, arm2, { kind: "wait", release: arm2Gate });
await waitFor(() => arm2.deducts >= 1, "the first call to claim and charge");
const arm2SecondId = SABOTAGE === 2 ? randomUUID() : arm2Id;
const arm2Second = await call(arm2SecondId, arm2, { kind: "throw" });
const arm2Ids = [arm2Id, arm2SecondId];
releaseArm2();
const arm2First = await arm2FirstPromise;
const arm2Ops = await operationsFor(arm2Ids);
const arm2Variants = await variantsFor(arm2Ids);
say(`  first   ${JSON.stringify(arm2First.slice(0, 72))}`);
say(`  second  ${JSON.stringify(arm2Second.slice(0, 72))}`);
say(`  operations ${arm2Ops} · variants ${arm2Variants} · charges ${arm2.deducts} · reached the paint ${arm2.reachedReadBytes}`);
say(`  VERDICT ${arm2Ops === 1 && arm2.deducts === 1 ? "REFUSED THE DUPLICATE — one operation, one charge" : "CLAIMED TWICE"}`);
say();

/* ── ARM 3 — different ids, same face, concurrent: THE DOUBLE TAP ─────────── */

say("=".repeat(78));
say("ARM 3  TWO TAPS — different clientRequestIds, same face, concurrent");
say("       (the case a fast receipt invites; idempotency cannot see it)");
say("-".repeat(78));
const arm3First = randomUUID();
const arm3Ids = [arm3First, randomUUID()];
const arm3: Counters = { deducts: 0, refunds: 0, reachedReadBytes: 0 };
let releaseArm3: () => void = () => {};
const arm3Gate = new Promise<void>((resolve) => { releaseArm3 = resolve; });
const arm3FirstPromise = call(arm3Ids[0]!, arm3, { kind: "wait", release: arm3Gate });
await waitFor(() => arm3.deducts >= 1, "the first tap to claim and charge");
const arm3Second = await call(arm3Ids[1]!, arm3, { kind: "throw" });
releaseArm3();
const arm3FirstResult = await arm3FirstPromise;
const arm3Ops = await operationsFor(arm3Ids);
const arm3Variants = await variantsFor(arm3Ids);
const arm3Statuses = await statusesFor(arm3Ids);
say(`  first tap   ${JSON.stringify(arm3FirstResult.slice(0, 72))}`);
say(`  second tap  ${JSON.stringify(arm3Second.slice(0, 72))}`);
say(`  operations ${arm3Ops} (${arm3Statuses}) · variants ${arm3Variants} · charges ${arm3.deducts} · reached the paint ${arm3.reachedReadBytes}`);
const heldOnce = arm3.deducts === 1 && arm3Variants === 1;
say(`  VERDICT ${heldOnce
  ? "ONE CHARGE, ONE VARIANT — the second tap was refused before it could buy"
  : `THE DOUBLE TAP BOUGHT TWICE — ${arm3.deducts} charges, ${arm3Variants} variants`}`);
say();

/* ── the ledger, both ends ────────────────────────────────────────────────── */

const ledgerAfter = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];
const moved = Number(ledgerAfter.rowCount) !== Number(ledgerBefore.rowCount)
  || Number(ledgerAfter.net) !== Number(ledgerBefore.net);
say(`LEDGER  rows ${ledgerBefore.rowCount} → ${ledgerAfter.rowCount} · net ${ledgerBefore.net} → ${ledgerAfter.net}` +
  `  ${moved ? "*** MONEY MOVED — this run was supposed to be free ***" : "unmoved (the charge was counted, never spent)"}`);

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** The row statuses behind a set of request ids — printed, never asserted away. */
async function statusesFor(ids: readonly string[]): Promise<string> {
  const marks = ids.map(() => "?").join(",");
  const rows = await query(
    `SELECT status, errorCode FROM generation_operations
      WHERE userId = ? AND clientRequestId IN (${marks}) ORDER BY createdAt`,
    [USER, ...ids],
  );
  return rows.map((row) => `${row.status}${row.errorCode ? `/${row.errorCode}` : ""}`).join(" + ") || "none";
}

async function waitFor(predicate: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Delete every row this run created, and PROVE none is left. */
async function cleanup(): Promise<void> {
  const ids = [...mintedIds];
  if (ids.length === 0) return;
  const marks = ids.map(() => "?").join(",");
  await query(
    `DELETE v FROM casting_candidate_variants v
       INNER JOIN generation_operations o ON o.id = v.operationId
      WHERE o.userId = ? AND o.clientRequestId IN (${marks})`, [USER, ...ids]);
  await query(
    `DELETE FROM generation_operations WHERE userId = ? AND clientRequestId IN (${marks})`,
    [USER, ...ids]);
  const leftOperations = await operationsFor(ids);
  const leftVariants = await variantsFor(ids);
  say(`CLEANUP ${ids.length} request ids swept · operations left ${leftOperations} · variants left ${leftVariants}` +
    `  ${leftOperations === 0 && leftVariants === 0 ? "verified clean" : "*** LEFTOVERS ***"}`);
}

/* The ending, last so the process really is the last thing this file does
   (`scriptExitDiscipline`): the helpers above are declarations and hoist. */
await cleanup();
await db.end();
process.exit(moved ? 1 : 0);

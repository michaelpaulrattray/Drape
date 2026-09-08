/**
 * Credit Discrepancy Flagging Queries — scans all users for
 * credit/record mismatches above a configurable threshold.
 *
 * ⚠ THE ARITHMETIC WAS RE-READ AT THE PRODUCTION ROWS ON 2026-08-26 (#119)
 * AFTER IT FROZE THE FOUNDER'S OWN ACCOUNT FOR 22 HOURS. The old formula was
 *
 *     (gross generation deductions − refunds) − completed − pending
 *
 * over the LEGACY `generations` table alone, and it rested on two premises
 * the product had since overturned on purpose:
 *
 *   1. "Every failed generation is refunded." Not since the founder's
 *      catastrophic-only refund ruling (`5c5a1f3f`): a failed row's cost is
 *      the RULED outcome, not a discrepancy. On production that was 10,730
 *      credits of failed rows against 9,750 refunded overall.
 *   2. "Every charge has a `generations` row." Not since Casting V2: a
 *      refine charges through `generation_operations` and writes no
 *      `generations` row at all (221 refines, 5,525 credits, on one account).
 *
 * Together they read 7,505 on a ledger whose 754 transactions net EXACTLY to
 * the balance — the number the freeze quoted, to the credit.
 *
 * THE RULE NOW: a charge is explained by the record that recorded it.
 *
 *   expected = Σ pointsCost of `generations` rows with NO operation
 *            + Σ over `generation_operations` of
 *                 chargedCredits            when the operation recorded a charge
 *                 Σ its linked rows' cost   when it recorded none
 *   discrepancy = gross generation deductions − expected
 *
 * Why the operation's own charge is authoritative where it exists: a Sign
 * charges 450 through its operation and writes five audit rows at 50 each,
 * so a rows-only formula climbs 200 per Sign for ever — #119's own defect
 * class, a premise that drifts with ordinary use (measured before this was
 * chosen: rows-only read 150 on the founder's account, operation-authoritative
 * 5,160, this hybrid 1,050 — ⚠ ALL THREE ARE READINGS FROM THE 2026-08-26
 * SESSION WHOSE 1,050 IS DISPUTED BELOW, and none of them has been re-taken;
 * the CHOICE between the three formulas does not rest on their absolute
 * values and is untouched, but do not quote the figures as current). Why rows
 * still count where the operation recorded nothing: the parked July evidence
 * family (#6) charged under legacy references and left its operations at
 * `chargedCredits: 0`.
 *
 * ⚠ AND THAT LAST SENTENCE IS FALSE AT THE ROWS — the fourth reading from
 * that session, found by the law-7 sweep of the correction below (#462) after
 * the reviewer of #636 named the first three. The evidence family's operations
 * did NOT leave `chargedCredits` at zero: on production 2026-09-07 they carry
 * 9,300 between them (46 `evidence_candidate_generate` at 7,500, 6
 * `evidence_package_sync` at 1,800). So the clause justifying the fallback
 * describes a shape the family does not have — and it is the same family whose
 * unlinked rows are the whole residual below. The fallback branch itself is
 * unchanged and still correct for an operation that genuinely recorded no
 * charge; what is wrong is the example given for why it exists.
 *
 * ⚠ THAT PARAGRAPH SAID "+1,050" UNTIL 2026-09-07 AND IT WAS WRONG ABOUT
 * BOTH THE NUMBER AND THE MECHANISM (#462). The reading it recorded — five
 * `evidence_package_sync` operations charging 300 each and writing two 300
 * audit rows apiece — is not what the rows say today and does not reproduce.
 * The formula has not changed since it was written (one commit, `127de613`,
 * carried the arithmetic and that sentence together), so ONE OF TWO THINGS IS
 * TRUE and this docblock does not pretend to know which: either the rows moved
 * between 2026-08-26 and now, or every reading taken that session shared an
 * error.
 *
 * ⚠ THE FIRST DRAFT OF THIS PARAGRAPH SAID "MISMEASURED, NOT DRIFTED" AND
 * THAT WAS OVER-CLAIMED — caught in review of #636, and the correction is
 * worth more than the original. The 1,050 was NOT a lone sentence: it was read
 * twice that day, by the scan and by raw SQL independently (line ~341), which
 * is exactly the second reader a measurement is supposed to have. Two readings
 * agreeing is real evidence, and calling it a mismeasurement anyway would have
 * been the same confidence that produced the error being corrected.
 *
 * What CAN be said is the useful half: the 1,050 recorded a conclusion and
 * none of its inputs, so it cannot be re-derived at all, in either direction.
 * That is the failure — working law 2, a measurement with nothing re-taking it
 * and nothing to re-take it FROM, standing for twelve days. The decomposition
 * below exists so its successor cannot fail the same way.
 *
 * WHAT THE RESIDUAL ACTUALLY IS, driven at the production rows 2026-09-07 and
 * decomposed so every term can be argued at:
 *
 *   gross 117,890  −  (unlinked 70,750 + operation 58,740)  =  − 11,600
 *
 * Split by era, the live road is exactly clean and the whole residual is
 * historical:
 *
 *   v2 (an `op:<uuid>:charge` reference)   gross 58,740  vs  operations 58,740
 *   legacy (every other reference)         gross 59,150  vs  unlinked   70,750
 *
 * ⚠ AND THE LEGACY GAP IS ONE THING: 45 `evidenceCandidate` rows, 11,450
 * credits, EVERY ONE OF THEM `operationId IS NULL`. Take them out and the
 * account reads −150. The evidence operations that did the work charged
 * 9,300 (46 `evidence_candidate_generate` at 7,500 + 6 `evidence_package_sync`
 * at 1,800, the latter refunded in full) and own ZERO rows between them — so
 * the same work is counted TWICE: once through the operation that charged for
 * it, and again through the rows it left unlinked.
 *
 * ⚠ **THAT GAP IS CLOSED AS OF 2026-09-09 — `UNLINKED_ROW_SQL` BELOW EXCLUDES
 * THE FAMILY, AND THE ROAD IT DID *NOT* TAKE IS THE FINDING WORTH KEEPING**
 * (#638, driven at the production rows before anything was built). The card
 * recommended LINKING the rows instead — a ceremony writing `operationId` onto
 * the 45 — and preferred it as the structurally right answer, on the belief
 * that linking and excluding both land on −150. **Both halves were measured
 * and the second one is false:**
 *
 *   today          unlinked 70,750 + operation 58,900 = 129,650  →  −11,600
 *   LINK the rows  unlinked 59,300 + operation 62,850 = 122,150  →   −4,100
 *   EXCLUDE them   unlinked 59,300 + operation 58,900 = 118,200  →     −150
 *
 * (Gross was 118,050 this reading against 117,890 on 2026-09-07; the operation
 * side moved by the same 160, which is ordinary v2 activity between the two.)
 *
 * **Linking IS possible** — all 45 rows match one `evidence_candidate_generate`
 * operation each by time, 0 orphans and 0 ambiguous, and every charged
 * operation's linked-row sum equals its own charge exactly, which is a second
 * reader agreeing with a match made on timestamps alone. **It just does not
 * work**, because 12 of those 46 operations recorded `chargedCredits = 0` while
 * owning a cost-bearing row, and the rule's fallback branch — "its rows where
 * it recorded none" — picks 3,950 of the 11,450 straight back up. The badge is
 * drawn at `DEFAULT_DISCREPANCY_THRESHOLD` (500), so linking leaves him flagged
 * at −4,100 and only the exclusion clears him.
 *
 * ⚠ **AND THE DECIDING FACT IS THE ONE NOBODY WOULD HAVE THOUGHT TO ASK FOR:
 * ACROSS THE WHOLE DATABASE, ALL USERS AND ALL TIME, THERE ARE *ZERO*
 * OPERATIONS THAT RECORD NO CHARGE AND OWN A COST-BEARING ROW.** The ceremony
 * would have MANUFACTURED twelve instances of a shape production has never
 * held, inside the fallback branch whose stated justification the paragraph
 * above already records as false at the rows. That is why the structurally
 * tidier road was declined, and it was declined on a measurement rather than
 * on taste.
 *
 * The four arms in `server/discrepancyFlagging.test.ts` were CHANGED rather
 * than deleted, per the card's bar — including the one that modelled linking
 * by holding `operationCost` fixed, which is exactly the premise that made
 * −150 look like linking's number when it is the exclusion's.
 *
 * ⚠ THAT IS #119'S OWN DEFECT CLASS, ONE DOOR OVER, AND IT IS WHY THIS IS
 * WORTH THE WORDS. The rule above makes an operation's own charge authoritative
 * precisely so a Sign's five audit rows cannot be added to the 450 it charged.
 * That guard keys on the row NAMING its operation. A row that never recorded
 * its `operationId` walks straight past it and is added anyway — the rule
 * defeated by a shape it did not anticipate rather than by a wrong premise.
 *
 * The lead this was filed on — that FAILED generations are counted into
 * `expected` and never charged — is REFUTED at the rows, and the negative
 * result is kept because it is the cheaper mistake to make twice: failed
 * legacy rows outside the evidence family are 2,500, and the one failed row
 * whose deduction can be matched at all (`referenceId` = `gen-<id>`) was
 * charged 350 against a recorded 350. Failed rows are not the mechanism; 11
 * of the 45 evidence rows are `completed`.
 *
 * ⚠ NO ROW-LEVEL RECONCILIATION IS POSSIBLE ON THE LEGACY ERA, which is
 * what makes that an investigation dead end rather than an unfinished one.
 * `referenceId` on a legacy deduction holds `casting-image-<modelId>-<uuid>`,
 * `mint-<id>-<uuid>`, `upscale-<uuid>`, `pending-<epoch>` and a handful of
 * `gen-<id>`; only the last names a `generations` row, and there are 33 of
 * them. A join on the rest cannot distinguish "never charged" from "charged
 * under a reference that does not name me" — it reports every unlinked row as
 * uncharged, completed ones included, which is a reader that always agrees
 * with whoever runs it.
 *
 * The repair was NOT made when the cause was measured: this is a
 * money-adjacent instrument and the choice between excluding the parked
 * family, linking its rows, and narrowing `unlinkedCost` was filed rather than
 * taken on a shift's judgement. It was card 0638, which carried the three
 * roads and made the choice conditional on ONE measurement — whether linking
 * was possible — and that measurement, taken, chose the other road for the
 * reason set out above. #462 measured the cause and closed.
 * `server/discrepancyFlagging.test.ts` pinned the double-count as CURRENT
 * behaviour with the production shape, so the repair had to change an arm that
 * states what it is changing; it does.
 *
 * Refunds are no longer part of the discrepancy. They are written only by
 * the product or by staff (a failure refund, a per-slice refund, an admin
 * correction) and a correction of DELIVERED work is legitimately unbounded by
 * anything a record holds — so a refund-side term was a false-positive
 * generator. ⚠ IT WAS ALSO THE ONLY THING WATCHING MONEY LEAVE BY THE REFUND
 * LANE (review of PR #123): a refund path that double-fires would have moved
 * the old `netCost` and is invisible to the charge-side rule. What stands in
 * for it is one cheap bound that needs no formula — an account whose refunds
 * EXCEED its gross generation charges has been credited more than it was ever
 * charged, and is flagged as `refundAnomaly` whatever its discrepancy reads.
 * A double refund smaller than that bound is NOT caught; the coverage loss is
 * named here rather than papered over. Refunds are still reported, and the
 * unrefunded failure cost is shown for what it is.
 *
 * ⚠ AND THE SCAN NO LONGER FREEZES ANYONE. Founder ruling 2026-08-26 (Crew
 * reply #5, verbatim): "List-only. A control that can freeze a paying
 * customer should have a person's name on it." `getFlaggedUsers` is a READ.
 * A freeze happens through `freezeAccount` with the moderator's id on it.
 */

import { and, gte, lte, sql } from "drizzle-orm";
import {
  creditTransactions,
  generationOperations,
  generations,
  users,
} from "../../drizzle/schema";
import { EVIDENCE_CANDIDATE_GENERATION_TYPE } from "../casting/evidence/evidenceCandidateContract";
import { getDb } from "./connection";

export interface FlaggedUserDiscrepancy {
  userId: number;
  userName: string | null;
  email: string | null;
  grossDeductions: number;
  totalRefunds: number;
  netCost: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  /**
   * Cost recorded by `generations` rows that belong to no operation — EXCEPT
   * the parked evidence family, whose operations already recorded the charge
   * (#638). `UNLINKED_ROW_SQL` is the predicate; this sentence used to be the
   * whole rule and is now half of it.
   */
  unlinkedCost: number;
  /** Cost recorded by operations (their own charge, or their rows where they recorded none). */
  operationCost: number;
  /** `unlinkedCost + operationCost` — what the records say was charged. */
  expectedCost: number;
  discrepancy: number;
  /** Refunds exceed gross generation charges — credited more than ever charged. Flagged regardless of threshold. */
  refundAnomaly: boolean;
  totalGenerations: number;
  failedGenerations: number;
}

/** What the per-user aggregation of credit transactions yields. */
export interface DiscrepancyCreditAgg {
  userId: number;
  grossDeductions: number;
  totalRefunds: number;
}

/** What the per-user aggregation of `generations` rows yields. */
export interface DiscrepancyGenAgg {
  userId: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  unlinkedCost: number;
  totalGenerations: number;
  failedGenerations: number;
}

/** What the per-user aggregation of `generation_operations` yields. */
export interface DiscrepancyOperationAgg {
  userId: number;
  operationCost: number;
}

export type FlaggedDiscrepancyData = Omit<
  FlaggedUserDiscrepancy,
  "userId" | "userName" | "email"
>;

/** The inputs of the rule, for one user (or one user inside a date range). */
export interface DiscrepancyInputs {
  grossDeductions: number;
  totalRefunds: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  unlinkedCost: number;
  operationCost: number;
}

export interface DiscrepancyReading {
  grossDeductions: number;
  totalRefunds: number;
  netCost: number;
  completedCost: number;
  pendingCost: number;
  failedCost: number;
  unlinkedCost: number;
  operationCost: number;
  expectedCost: number;
  discrepancy: number;
  /** Failed-row cost not covered by refunds — the ruled outcome, shown, never flagged. */
  unrefundedFailureCost: number;
  /** `totalRefunds > grossDeductions` — the refund-lane bound (header). */
  refundAnomaly: boolean;
}

/**
 * THE RULE. One function, two readers: the all-users scan and the per-user
 * reconciliation page both derive from it (working law 4 — the route used
 * to re-type the arithmetic, and so did its test).
 */
export function computeDiscrepancy(input: DiscrepancyInputs): DiscrepancyReading {
  const grossDeductions = Number(input.grossDeductions ?? 0);
  const totalRefunds = Math.max(0, Number(input.totalRefunds ?? 0));
  const completedCost = Number(input.completedCost ?? 0);
  const pendingCost = Number(input.pendingCost ?? 0);
  const failedCost = Number(input.failedCost ?? 0);
  const unlinkedCost = Number(input.unlinkedCost ?? 0);
  const operationCost = Number(input.operationCost ?? 0);
  const expectedCost = unlinkedCost + operationCost;
  return {
    grossDeductions,
    totalRefunds,
    netCost: grossDeductions - totalRefunds,
    completedCost,
    pendingCost,
    failedCost,
    unlinkedCost,
    operationCost,
    expectedCost,
    discrepancy: grossDeductions - expectedCost,
    unrefundedFailureCost: Math.max(0, failedCost - totalRefunds),
    refundAnomaly: totalRefunds > grossDeductions,
  };
}

/**
 * Every user with |discrepancy| at or above the threshold, and how many were
 * scanned. Pure: the three aggregations come in, the flagged rows go out, so
 * the money arithmetic is driven without a database.
 */
export function computeFlaggedDiscrepancies(
  creditAgg: DiscrepancyCreditAgg[],
  genAgg: DiscrepancyGenAgg[],
  operationAgg: DiscrepancyOperationAgg[],
  threshold: number,
): { flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }>; scannedCount: number } {
  const creditMap = new Map(creditAgg.map((r) => [r.userId, r]));
  const genMap = new Map(genAgg.map((r) => [r.userId, r]));
  const opMap = new Map(operationAgg.map((r) => [r.userId, r]));

  const allUserIds = Array.from(
    new Set([
      ...Array.from(creditMap.keys()),
      ...Array.from(genMap.keys()),
      ...Array.from(opMap.keys()),
    ]),
  );

  const flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }> = [];

  for (const uid of allUserIds) {
    const credit = creditMap.get(uid);
    const gen = genMap.get(uid);
    const op = opMap.get(uid);

    const reading = computeDiscrepancy({
      grossDeductions: credit?.grossDeductions ?? 0,
      totalRefunds: credit?.totalRefunds ?? 0,
      completedCost: gen?.completedCost ?? 0,
      pendingCost: gen?.pendingCost ?? 0,
      failedCost: gen?.failedCost ?? 0,
      unlinkedCost: gen?.unlinkedCost ?? 0,
      operationCost: op?.operationCost ?? 0,
    });

    if (Math.abs(reading.discrepancy) >= threshold || reading.refundAnomaly) {
      flagged.push({
        userId: uid,
        data: {
          grossDeductions: reading.grossDeductions,
          totalRefunds: reading.totalRefunds,
          netCost: reading.netCost,
          completedCost: reading.completedCost,
          pendingCost: reading.pendingCost,
          failedCost: reading.failedCost,
          unlinkedCost: reading.unlinkedCost,
          operationCost: reading.operationCost,
          expectedCost: reading.expectedCost,
          discrepancy: reading.discrepancy,
          refundAnomaly: reading.refundAnomaly,
          totalGenerations: Number(gen?.totalGenerations ?? 0),
          failedGenerations: Number(gen?.failedGenerations ?? 0),
        },
      });
    }
  }

  return { flagged, scannedCount: allUserIds.length };
}

/**
 * Attach the user's name and email to each flagged row and order the report
 * by the size of the discrepancy, largest first.
 */
export function attachUserInfoToFlagged(
  flagged: Array<{ userId: number; data: FlaggedDiscrepancyData }>,
  userRows: Array<{ id: number; name: string | null; email: string | null }>,
): FlaggedUserDiscrepancy[] {
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return flagged
    .map((f) => {
      const u = userMap.get(f.userId);
      return {
        userId: f.userId,
        userName: u?.name ?? null,
        email: u?.email ?? null,
        ...f.data,
      };
    })
    .sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
}

/**
 * The operation-side cost expression: the operation's own charge where it
 * recorded one, the summed cost of its linked `generations` rows where it
 * recorded none (a correlated aggregate over the rows that name this
 * operation).
 *
 * ⚠ THE CORRELATION IS WRITTEN WITH EXPLICIT QUALIFIERS ON PURPOSE. Drizzle
 * renders a column of a single-table select UNQUALIFIED, so the first
 * version — `${generations.operationId} = ${generationOperations.id}` —
 * became `WHERE operationId = id`, and inside the subquery BOTH names bound
 * to `generations` (which has its own `id`): never true, fallback always 0,
 * and the scan read 5,160 on production where the raw SQL read 1,050 (⚠ both
 * figures are from the 2026-08-26 session the header disputes, and the QUALIFIER
 * bug this guard pins is proven by the generated TEXT, not by either number).
 * Caught
 * by driving the module against the real database before it was believed
 * (working law 2); `server/discrepancyOperationCostSql.test.ts` pins the
 * generated text so the qualifier cannot quietly drop out again.
 */
export const OPERATION_COST_SQL = sql<number>`COALESCE(SUM(CASE WHEN ${generationOperations.chargedCredits} > 0 THEN ${generationOperations.chargedCredits} ELSE COALESCE((SELECT SUM(linked.pointsCost) FROM ${generations} AS linked WHERE linked.operationId = ${generationOperations}.id), 0) END), 0)`;

/**
 * WHICH `generations` ROWS THE UNLINKED SIDE COUNTS — declared once because
 * it has two readers, and they were two copies of it (#638).
 *
 * The scan writes it as a CASE inside an aggregate and the per-user page
 * writes it as a WHERE, and the module's own header promises both derive from
 * one rule. They did not: they were the same predicate typed twice, which is
 * working law 4, and this change would have had to edit it in both places and
 * hope. It is one expression now, and the page and the scan cannot answer
 * different questions about the same account.
 *
 * ⚠ **THE EXCLUSION, AND WHY IT IS THIS ONE.** The parked July evidence
 * family (#6) left 45 `evidenceCandidate` rows with no `operationId`, worth
 * 11,450 credits, for work its operations had already charged 9,300 for — so
 * the same work entered `expected` twice and the founder's own account read
 * −11,600 and sat on his Moderation badge as the instrument's only flag.
 *
 * ⚠ **ITS POPULATION CANNOT GROW, WHICH IS WHAT MAKES THIS NARROW RATHER THAN
 * AN OPEN-ENDED EXEMPTION.** The exclusion only ever bites on a row that has
 * NO operation, and both live writers of this type set `operationId` in the
 * same INSERT (`server/db/inkAddCandidates.ts`, `evidenceFork.ts`) — so a row
 * this predicate can drop cannot be created by any road the product still
 * runs. That is structural, not a promise, and
 * `server/discrepancyFlagging.test.ts` holds both writers to it.
 */
export const UNLINKED_ROW_SQL = sql`(${generations.operationId} IS NULL AND ${generations.type} <> ${EVIDENCE_CANDIDATE_GENERATION_TYPE})`;

/**
 * Scan all users for credit discrepancies above a threshold.
 * Uses SQL aggregation for performance — no N+1 queries. A READ: it writes
 * nothing and freezes nobody (see the header).
 */
export async function getUsersWithDiscrepancies(
  threshold: number = 50
): Promise<{ users: FlaggedUserDiscrepancy[]; scannedCount: number }> {
  const db = await getDb();
  if (!db) return { users: [], scannedCount: 0 };

  // Step 1: Aggregate credit transactions per user (generation deductions + refunds)
  const creditAgg = await db
    .select({
      userId: creditTransactions.userId,
      grossDeductions: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'generation' THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`.as("grossDeductions"),
      totalRefunds: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'refund' THEN ${creditTransactions.amount} ELSE 0 END), 0)`.as("totalRefunds"),
    })
    .from(creditTransactions)
    .groupBy(creditTransactions.userId);

  // Step 2: Aggregate `generations` rows per user by status, and the cost of
  // the rows no operation owns — see `UNLINKED_ROW_SQL` for what that excludes.
  const genAgg = await db
    .select({
      userId: generations.userId,
      completedCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'completed' THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("completedCost"),
      pendingCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} IN ('pending', 'processing') THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("pendingCost"),
      failedCost: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'failed' THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("failedCost"),
      unlinkedCost: sql<number>`COALESCE(SUM(CASE WHEN ${UNLINKED_ROW_SQL} THEN ${generations.pointsCost} ELSE 0 END), 0)`.as("unlinkedCost"),
      totalGenerations: sql<number>`COUNT(*)`.as("totalGenerations"),
      failedGenerations: sql<number>`COALESCE(SUM(CASE WHEN ${generations.status} = 'failed' THEN 1 ELSE 0 END), 0)`.as("failedGenerations"),
    })
    .from(generations)
    .groupBy(generations.userId);

  // Step 3: Aggregate operation-recorded cost per user
  const operationAgg = await db
    .select({
      userId: generationOperations.userId,
      operationCost: OPERATION_COST_SQL.as("operationCost"),
    })
    .from(generationOperations)
    .groupBy(generationOperations.userId);

  // Steps 4-6: lookup maps, the union of user ids, and the threshold filter.
  const { flagged, scannedCount } = computeFlaggedDiscrepancies(creditAgg, genAgg, operationAgg, threshold);

  // Step 7: Fetch user info for flagged users
  if (flagged.length === 0) {
    return { users: [], scannedCount };
  }

  const flaggedIds = flagged.map((f) => f.userId);
  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(flaggedIds.map((id) => sql`${id}`), sql`, `)})`);

  return { users: attachUserInfoToFlagged(flagged, userRows), scannedCount };
}

/**
 * The record side of the rule for ONE user, optionally inside a date range —
 * the same two expressions the scan aggregates, scoped by `userId` in the
 * WHERE. The per-user reconciliation page reads this so its number is the
 * scan's number for the same user.
 *
 * ⚠ A DATE RANGE IS APPROXIMATE HERE, AND THAT IS A PROPERTY OF THE PAGE, NOT
 * A FORMULA BUG (review of PR #123, finding 3). The range keys an operation by
 * ITS OWN `createdAt`, and its fallback rows are summed whole — an operation
 * inside the window carries all of its rows, one outside carries none — while
 * the page's charge side comes from `getDetailedCreditHistory` (row-filtered,
 * capped at 10,000 rows). A window that cuts through an operation, or an
 * account past 10k transactions, can therefore show a small discrepancy the
 * ALL-TIME scan does not. The all-time number is the one that means something;
 * a windowed one is a lens.
 */
export async function getUserRecordCosts(
  userId: number,
  range: { startDate?: Date; endDate?: Date } = {},
): Promise<{ unlinkedCost: number; operationCost: number }> {
  const db = await getDb();
  if (!db) return { unlinkedCost: 0, operationCost: 0 };

  const genConditions = [sql`${generations.userId} = ${userId}`, UNLINKED_ROW_SQL];
  if (range.startDate) genConditions.push(gte(generations.createdAt, range.startDate));
  if (range.endDate) genConditions.push(lte(generations.createdAt, range.endDate));

  const [genRow] = await db
    .select({
      unlinkedCost: sql<number>`COALESCE(SUM(${generations.pointsCost}), 0)`.as("unlinkedCost"),
    })
    .from(generations)
    .where(and(...genConditions));

  const opConditions = [sql`${generationOperations.userId} = ${userId}`];
  if (range.startDate) opConditions.push(gte(generationOperations.createdAt, range.startDate));
  if (range.endDate) opConditions.push(lte(generationOperations.createdAt, range.endDate));

  const [opRow] = await db
    .select({ operationCost: OPERATION_COST_SQL.as("operationCost") })
    .from(generationOperations)
    .where(and(...opConditions));

  return {
    unlinkedCost: Number(genRow?.unlinkedCost ?? 0),
    operationCost: Number(opRow?.operationCost ?? 0),
  };
}

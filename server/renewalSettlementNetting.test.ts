/**
 * A PLAN-CHANGE MOVE SETTLED INSIDE THE PERIOD BEING GRANTED CROSSES THE
 * BOUNDARY WHOLE (#1937) — the real `refreshMonthlyCredits`, the real reader,
 * and the real compare-and-set loop, through `creditRefreshRace`'s double.
 *
 * # THE DEFECT
 *
 * A renewal SETs the balance absolutely:
 *
 *     balance = grant + rollover(planAllowance) + purchasedRemaining
 *
 * A plan-change settlement is not a purchase, so `applyPlanChangeSettlement`'s
 * move lands in `planAllowance` and the rollover percentage is applied to it.
 * Inside the period being CLOSED that is right — the proration bought days of
 * that period and unspent allowance rolls at the plan's rate. Inside the
 * period being GRANTED it is wrong, and that is the late-webhook window:
 * Stripe has already advanced the subscription, so the change's proration
 * bought days the customer has not had yet, and a quarter of it (Pro) or half
 * (Starter) is taken back before they start.
 *
 * # THE NUMBERS THESE ARMS ASSERT ARE THE PRODUCT'S, NOT THIS FILE'S
 *
 * `PLAN_TIERS` is imported and the percentages are read off it, so a repriced
 * ladder moves these arms with it rather than leaving them asserting history.
 * ⚠ **Pro rolls 75% and Pro Plus rolls 100%** — read at `drizzle/schema.ts`,
 * and the second figure is why one of the card's two bullets is NOT closed
 * here and is measured as unchanged in section 5 instead of being claimed.
 *
 * # SECTIONS
 *
 *  1 · **the reader**, before its verdicts count (law 2): the signs, the
 *      status filter, the window edge, and the refusal on an unreadable
 *      database — which matters more than usual here, because `0` is the
 *      ordinary answer and a swallowed error would be invisible.
 *  2 · **`periodBought.startSec`**, the discriminator's source, in both its
 *      branches.
 *  3 · **the UPGRADE direction** — the headline, with the credits counted.
 *  4 · **the DOWNGRADE direction**, including the floor that keeps an unwind
 *      out of credits the customer bought.
 *  5 · **the controls that must NOT move**: `null` is the old road verbatim,
 *      a 100%-rollover plan is arithmetically identical either way, and a row
 *      with no settlement in the window reads exactly as it did.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import { creditTransactions, planChangeSettlements, PLAN_TIERS } from "../drizzle/schema";

type Row = { balance: number; purchasedBalance?: number | null };

const rows: Row[] = [];
let rowReads = 0;

vi.mock("./db/credits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserCredits: vi.fn().mockImplementation(async () => rows[Math.min(rowReads++, rows.length - 1)]),
}));

/**
 * One staged settlement: what the row QUOTED when the change was accepted,
 * and what the ledger says actually MOVED.
 *
 * ⚠ **THE TWO ARE DIFFERENT FACTS AND THE HARNESS HAS TO BE ABLE TO SAY SO**
 * (PR #1946 review, repair 2). `applyPlanChangeSettlement` floors an unwind
 * at the plan's part of the live balance and resolves the row `applied` even
 * when nothing moved, so a database holding *quoted 40,000, moved 10,000* is
 * an ordinary state and not a contrived one. `moved` defaults to the quoted
 * amount with its direction's sign, which is every grant and every unfloored
 * unwind — so the arms written before this distinction existed stage exactly
 * as they did.
 */
type SettlementRow = {
  direction: "grant" | "unwind";
  credits: number;
  /** Signed, as the ledger stores it. Omitted means "the whole quoted amount". */
  moved?: number;
  /** Omitted gets a generated one; named only where an arm asserts the key. */
  invoiceId?: string;
};
let settlementRows: SettlementRow[] = [];
let settlementQueries = 0;
let ledgerQueries = 0;
/** Every WHERE each read was built with, in order (invariant 5). */
const ledgerWheres: unknown[] = [];
const settlementWheres: unknown[] = [];
/** `null` makes `getDb()` answer null — the unreadable-database arm. */
let databaseReadable = true;

const stagedInvoiceId = (row: SettlementRow, index: number) =>
  row.invoiceId ?? `in_staged_${index}`;
const stagedMove = (row: SettlementRow) =>
  row.moved ?? (row.direction === "unwind" ? -row.credits : row.credits);

/**
 * Every PARAMETER a drizzle condition carries, in order — the house shape for
 * asserting on the outgoing statement rather than on a constant near it
 * (invariant 5; `server/purchasedCreditsGrantWire.test.ts` is the precedent).
 * It descends into arrays because `inArray` holds its values in one.
 */
function conditionParams(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const child of node) conditionParams(child, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const chunk = node as { queryChunks?: unknown; value?: unknown; constructor?: { name?: string } };
  if (Array.isArray(chunk.queryChunks)) return conditionParams(chunk.queryChunks, out);
  if (chunk.constructor?.name === "Param") out.push(chunk.value);
  return out;
}

/** Every COLUMN a drizzle condition names, in order. */
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

/** Each entry answers one attempt's UPDATE with its affectedRows. */
let updateAnswers: number[] = [];
const updateSets: Array<Record<string, unknown>> = [];
const insertedRows: Array<Record<string, unknown>> = [];

const txDouble = {
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        updateSets.push(values);
        return [{ affectedRows: updateAnswers.shift() ?? 1 }];
      },
    }),
  }),
  insert: () => ({
    values: async (row: Record<string, unknown>) => {
      insertedRows.push(row);
    },
  }),
};

/* One double serves both readers on purpose: the settlement read happens
   INSIDE the refresh's retry loop, and a harness that stubbed the reader out
   could not show that.

   ⚠ IT DISCRIMINATES ON THE TABLE OBJECT, NOT ON CALL ORDER. The reader asks
   two questions now — which settlements fall in the window, and what their
   ledger lines moved — and a double keyed on "first call, second call" would
   pass just as happily if the reader asked the wrong table twice. An
   unstaged table THROWS rather than answering an empty list, because an empty
   list is this reader's ordinary answer and would read as success. */
const dbDouble = {
  select: () => ({
    from: (table: unknown) => ({
      where: async (condition: unknown) => {
        if (table === planChangeSettlements) {
          settlementQueries++;
          settlementWheres.push(condition);
          return settlementRows.map((row, index) => ({
            stripeInvoiceId: stagedInvoiceId(row, index),
          }));
        }
        if (table === creditTransactions) {
          ledgerQueries++;
          ledgerWheres.push(condition);
          /* Only the lines the reader actually asked for, keyed the way the
             product keys them — so a ref the window does not name cannot be
             counted by a harness being generous. */
          const asked = new Set(
            conditionParams(condition).filter((value): value is string => typeof value === "string"),
          );
          return settlementRows
            .map((row, index) => ({
              ref: settlementLedgerRef(stagedInvoiceId(row, index)),
              amount: stagedMove(row),
            }))
            .filter((line) => asked.has(line.ref))
            .map((line) => ({ amount: line.amount }));
        }
        throw new Error("the reader asked a table this harness does not stage");
      },
    }),
  }),
};

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => (databaseReadable ? dbDouble : null)),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

import { refreshMonthlyCredits } from "./db/billing";
import {
  netAppliedPlanChangeSettlementsSince,
  settlementLedgerRef,
} from "./db/planChangeSettlements";
import { periodBought } from "./stripe/invoiceLines";

/** The rules `webhooks.ts` passes, quoted from the product's own table. */
const rollsAt = (percent: number) => (balance: number) => Math.floor(balance * (percent / 100));
const proRule = rollsAt(PLAN_TIERS.pro.rolloverPercent);
const starterRule = rollsAt(PLAN_TIERS.starter.rolloverPercent);
const proPlusRule = rollsAt(PLAN_TIERS.studio.rolloverPercent);

const PERIOD_START = new Date("2026-10-01T00:00:00Z");

/** The balance that reached the UPDATE on the attempt that stuck. */
function writtenBalance(): number {
  const last = updateSets[updateSets.length - 1];
  return last?.balance as number;
}

beforeEach(() => {
  rows.length = 0;
  rowReads = 0;
  settlementRows = [];
  settlementQueries = 0;
  ledgerQueries = 0;
  ledgerWheres.length = 0;
  settlementWheres.length = 0;
  databaseReadable = true;
  updateAnswers = [];
  updateSets.length = 0;
  insertedRows.length = 0;
});

describe("1 · the reader — before any verdict of its counts", () => {
  it("⚠ CONTROL — a grant is positive, an unwind is negative, and several net", async () => {
    settlementRows = [{ direction: "grant", credits: 125_000 }];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(125_000);

    settlementRows = [{ direction: "unwind", credits: 40_000 }];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(-40_000);

    /* Two changes in one window is the coarse-netting case #711's header
       names as a stated limit; the sum is what the balance actually carries. */
    settlementRows = [
      { direction: "grant", credits: 125_000 },
      { direction: "unwind", credits: 40_000 },
    ];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(85_000);
  });

  it("an empty window is zero, which is the ordinary answer", async () => {
    settlementRows = [];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(0);
  });

  it("⚠ REFUSES on an unreadable database rather than answering the ordinary answer", async () => {
    /* Zero means "no plan change in the window" and is what almost every call
       returns, so a reader that answered zero on a failed read would quietly
       restore the arithmetic this card replaces, on a money path, invisibly. */
    databaseReadable = false;
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).rejects.toThrow(
      /Database not available/,
    );
  });

  it("a non-finite ledger amount cannot poison the net", async () => {
    settlementRows = [
      { direction: "grant", credits: 5_000, moved: Number.NaN },
      { direction: "grant", credits: 1_000 },
    ];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(1_000);
  });

  it("⚠ THE NET IS WHAT MOVED, NOT WHAT THE ROW QUOTED — the second repair, at the reader", async () => {
    /* applyPlanChangeSettlement floors an unwind at the plan’s part of the
       live balance (#1661) and resolves the row `applied` regardless, so a
       row quoting 40,000 of which 10,000 was takeable is an ordinary state.
       Reading the quoted column subtracted 40,000 the customer never lost. */
    settlementRows = [{ direction: "unwind", credits: 40_000, moved: -10_000 }];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(-10_000);
  });

  it("⚠ a take-back where NOTHING moved nets to zero, not to the quoted amount", async () => {
    /* `returnable <= 0`: the allowance was spent, or every credit left is
       one the customer BOUGHT. The row still resolves `applied` — the floor
       working is not a failure — and the quoted read docked the next grant
       for a take-back that never happened. */
    settlementRows = [{ direction: "unwind", credits: 40_000, moved: 0 }];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(0);
  });

  it("⚠ the ledger read is keyed on the product’s OWN ref, user-scoped — read at the wire", async () => {
    settlementRows = [
      { direction: "grant", credits: 125_000, invoiceId: "in_up" },
      { direction: "unwind", credits: 40_000, invoiceId: "in_down" },
    ];
    await netAppliedPlanChangeSettlementsSince(7, PERIOD_START);

    expect(ledgerQueries).toBe(1);
    const where = ledgerWheres[0];
    expect(conditionColumns(where)).toEqual(["userId", "referenceId"]);
    expect(conditionParams(where)).toEqual([
      7,
      "plan-change-settle:in_up",
      "plan-change-settle:in_down",
    ]);
    /* The key is spelled by the product, not by this file. */
    expect(conditionParams(where).slice(1)).toEqual(
      ["in_up", "in_down"].map(settlementLedgerRef),
    );
  });

  it("⚠ a ledger line outside the window is NOT counted, even when the database holds it", async () => {
    /* The negative control for the arm above. The double answers only the
       refs the statement names, so a reader that dropped the inArray and
       swept the user’s whole ledger would read 1,000,999 here. */
    settlementRows = [{ direction: "grant", credits: 1_000, invoiceId: "in_window" }];
    const outsideRef = settlementLedgerRef("in_last_period");

    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(1_000);

    expect(conditionParams(ledgerWheres[0])).not.toContain(outsideRef);
  });

  it("⚠ THE WINDOW IS IN THE STATEMENT — owner, applied-only, and the period start", async () => {
    /* ⚠ THIS ARM WAS ADDED BECAUSE A SABOTAGE ROUND SURVIVED (PR #1946, repair
       round 8): deleting the resolvedAt comparison left this suite GREEN,
       because the harness answered whatever it was staged with whatever the
       WHERE said. The window is the whole discriminator of this card — a
       reader that swept every settlement the account ever made would carry
       last period’s prorations whole into this one — so it is read at the
       outgoing statement and not at a constant near it. */
    settlementRows = [{ direction: "grant", credits: 1_000 }];
    await netAppliedPlanChangeSettlementsSince(7, PERIOD_START);

    const where = settlementWheres[0];
    expect(conditionColumns(where)).toEqual(["userId", "status", "resolvedAt"]);
    expect(conditionParams(where)).toEqual([7, "applied", PERIOD_START]);
  });
  it("an empty window never asks the ledger at all", async () => {
    settlementRows = [];
    await expect(netAppliedPlanChangeSettlementsSince(7, PERIOD_START)).resolves.toBe(0);
    expect(settlementQueries).toBe(1);
    expect(ledgerQueries, "no refs, no second statement").toBe(0);
  });
});

describe("2 · periodBought.startSec — where the discriminator comes from", () => {
  const line = (startSec: number, endSec: number) => ({
    lines: { data: [{ price: { recurring: { interval: "month" } }, period: { start: startSec, end: endSec } }] },
  });

  it("⚠ CONTROL — a readable period states its start, beside the months it already stated", () => {
    const start = Math.floor(Date.UTC(2026, 9, 1) / 1000);
    const end = Math.floor(Date.UTC(2026, 10, 1) / 1000);
    const bought = periodBought(line(start, end));
    expect(bought?.monthsBought).toBe(1);
    expect(bought?.startSec).toBe(start);
  });

  it("⚠ an UNREADABLE period says so with null, and never with an epoch", () => {
    /* `0` would be 1970, and every settlement the product has ever applied
       would fall inside the window. The months still fall back to the classic
       interval field, which is the shape this branch exists for. */
    const bought = periodBought({
      lines: { data: [{ price: { recurring: { interval: "year" } }, period: { start: null, end: null } }] },
    });
    expect(bought?.monthsBought).toBe(12);
    expect(bought?.startSec).toBeNull();
  });
});

describe("3 · the UPGRADE direction — the credits the customer paid for arrive whole", () => {
  /* Pro, renewing. The invoice was billed for Pro and is late; meanwhile the
     customer upgrades to Pro Plus and `applyPlanChangeSettlement` grants the
     proration for the days of the period this invoice is opening. */
  const PRO_GRANT = PLAN_TIERS.pro.monthlyCredits;
  const LEFTOVER = 20_000;
  const PRORATION = 125_000;

  it("⚠ the proration is netted out of the rollover base and added back whole", async () => {
    rows.push({ balance: LEFTOVER + PRORATION, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: PRORATION }];

    const result = await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_1", undefined, PERIOD_START);

    expect(result.success).toBe(true);
    expect(writtenBalance()).toBe(PRO_GRANT + proRule(LEFTOVER) + PRORATION);
    /* 180,000 + 15,000 + 125,000 = 320,000 — the figures spelled out, so a
       repriced ladder changes the expression above and this comment both. */
    expect(writtenBalance()).toBe(320_000);
  });

  it("⚠ and what that is worth: the old arithmetic kept only the plan's percentage of it", async () => {
    /* The BEFORE arm, computed rather than re-run: with the proration left in
       the rollover base the balance is `grant + 75% × (leftover + proration)`.
       The gap is exactly the cut the plan's rule should never have taken. */
    const beforeRepair = PRO_GRANT + proRule(LEFTOVER + PRORATION);
    rows.push({ balance: LEFTOVER + PRORATION, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: PRORATION }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_1", undefined, PERIOD_START);

    expect(beforeRepair).toBe(288_750);
    expect(writtenBalance() - beforeRepair).toBe(31_250);
    /* 31,250 ledger is 6,250 display credits, and it is 25% of the proration —
       the share Pro's 75% rule forfeits — not a rounding difference. */
    expect(writtenBalance() - beforeRepair).toBe(
      PRORATION - proRule(PRORATION),
    );
  });

  it("Starter's cut is half, which is the same defect twice as large", async () => {
    const STARTER_GRANT = PLAN_TIERS.starter.monthlyCredits;
    rows.push({ balance: LEFTOVER + PRORATION, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: PRORATION }];

    await refreshMonthlyCredits(1, STARTER_GRANT, starterRule, "stripe-invoice:in_2", undefined, PERIOD_START);

    const beforeRepair = STARTER_GRANT + starterRule(LEFTOVER + PRORATION);
    expect(writtenBalance() - beforeRepair).toBe(PRORATION - starterRule(PRORATION));
    expect(writtenBalance() - beforeRepair).toBe(62_500);
  });

  it("⚠ a customer who SPENT the proration down does not get it back — only what survives crosses", async () => {
    /* ⚠ THIS ARM PINNED THE DEFECT UNTIL PR #1946’s REVIEW. It expected
       `PRO_GRANT + 0 + PRORATION` — the whole 125,000 handed back out of a
       balance holding 30,000 — and the BALANCE is the artifact, not the
       settlement row. The on-time timeline (renew, upgrade, spend) gives
       205,000; the old expression gave 305,000. */
    rows.push({ balance: 30_000, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: PRORATION }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_3", undefined, PERIOD_START);

    expect(writtenBalance()).toBe(PRO_GRANT + 30_000);
    expect(writtenBalance()).toBe(210_000);
    /* What the clamp is worth, said as a number rather than as an intention. */
    const beforeRepair = PRO_GRANT + 0 + PRORATION;
    expect(beforeRepair).toBe(305_000);
    expect(beforeRepair - writtenBalance()).toBe(95_000);
  });

  it("⚠ and it clamps CONTINUOUSLY — not a special case at the floor", async () => {
    /* Four points across the band, so the arm cannot pass on one hard-coded
       answer: whatever is still on the plan’s part crosses, and the
       rollover takes the remainder at Pro’s rate. */
    for (const remaining of [145_000, 125_000, 60_000, 0]) {
      updateSets.length = 0;
      rows.length = 0;
      rowReads = 0;
      rows.push({ balance: remaining, purchasedBalance: 0 });
      settlementRows = [{ direction: "grant", credits: PRORATION }];

      await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_band", undefined, PERIOD_START);

      const kept = Math.min(PRORATION, remaining);
      expect(writtenBalance(), `remaining ${remaining}`).toBe(
        PRO_GRANT + proRule(remaining - kept) + kept,
      );
      /* It can never exceed what is actually there plus the new grant. */
      expect(writtenBalance()).toBeLessThanOrEqual(PRO_GRANT + remaining);
    }
  });

  it("⚠ the headline case is UNTOUCHED by the clamp — an unspent proration still crosses whole", async () => {
    /* The control for the repair above: with the proration still on the
       balance, min(carried, planPart) IS carried, and this section’s first
       arm’s number is reproduced exactly. A clamp that also moved this
       would have undone the card. */
    rows.push({ balance: LEFTOVER + PRORATION, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: PRORATION }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_11", undefined, PERIOD_START);

    expect(writtenBalance()).toBe(320_000);
  });
});

describe("4 · the DOWNGRADE direction — the take-back bites in full", () => {
  const PRO_GRANT = PLAN_TIERS.pro.monthlyCredits;

  it("⚠ an unwind is subtracted whole instead of being partly undone by the rollover", async () => {
    const LEFTOVER = 100_000;
    const UNWIND = 40_000;
    rows.push({ balance: LEFTOVER - UNWIND, purchasedBalance: 0 });
    settlementRows = [{ direction: "unwind", credits: UNWIND }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_4", undefined, PERIOD_START);

    expect(writtenBalance()).toBe(PRO_GRANT + proRule(LEFTOVER) - UNWIND);
    /* Before the repair the balance was `grant + 75% × (leftover − unwind)`,
       which keeps 25% of a take-back that mirrors money already refunded. */
    const beforeRepair = PRO_GRANT + proRule(LEFTOVER - UNWIND);
    expect(beforeRepair - writtenBalance()).toBe(UNWIND - proRule(UNWIND));
    expect(beforeRepair - writtenBalance()).toBe(10_000);
  });

  it("⚠ an unwind larger than the new grant stops at the plan's part and NEVER reaches purchased credits", async () => {
    /* #1604's law, held by construction: the clamp is on the plan's side of
       the sum and `purchased` is added outside it. */
    rows.push({ balance: 25_000, purchasedBalance: 25_000 });
    settlementRows = [{ direction: "unwind", credits: 5_000_000 }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_5", undefined, PERIOD_START);

    expect(writtenBalance()).toBe(25_000);
    expect(updateSets[updateSets.length - 1]!.purchasedBalance).toBe(25_000);
  });
});

describe("5 · the controls that must NOT move", () => {
  const PRO_GRANT = PLAN_TIERS.pro.monthlyCredits;

  it("⚠ `null` is the OLD ROAD, arithmetically — every call this product made before #1937", async () => {
    rows.push({ balance: 145_000, purchasedBalance: 0 });
    /* Staged, and must be ignored: a null window means the invoice could not
       say when its period began, so nothing is netted however many rows exist. */
    settlementRows = [{ direction: "grant", credits: 125_000 }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_6", undefined, null);

    expect(writtenBalance()).toBe(PRO_GRANT + proRule(145_000));
    expect(settlementQueries, "a null window asks the database nothing at all").toBe(0);
  });

  it("the default argument is that same old road — an existing caller is untouched", async () => {
    rows.push({ balance: 145_000, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: 125_000 }];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_7");

    expect(writtenBalance()).toBe(PRO_GRANT + proRule(145_000));
    expect(settlementQueries).toBe(0);
  });

  it("an empty window reads exactly as it did, with the reader consulted", async () => {
    rows.push({ balance: 145_000, purchasedBalance: 0 });
    settlementRows = [];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_8", undefined, PERIOD_START);

    expect(writtenBalance()).toBe(PRO_GRANT + proRule(145_000));
    expect(settlementQueries, "the reader WAS asked — this arm is not passing by not running").toBe(1);
  });

  it("⚠ A 100%-ROLLOVER PLAN IS IDENTICAL EITHER WAY, which is why one of #1937's two bullets is NOT closed here", async () => {
    /* Pro Plus rolls 100%. Netting a settlement out of a base that is
       multiplied by 1 and adding it back changes nothing, so the card's own
       downgrade example — Pro Plus → Pro, where the renewal invoice was
       billed for Pro Plus — comes out of this repair at the same number.
       Its over-grant is the BASE grant following a refunded invoice (#1930's
       deliberate rule), not the rollover, and that is carded rather than
       reversed here hours after #1930 landed. */
    const PRO_PLUS_GRANT = PLAN_TIERS.studio.monthlyCredits;
    expect(PLAN_TIERS.studio.rolloverPercent).toBe(100);

    rows.push({ balance: 60_000, purchasedBalance: 0 });
    settlementRows = [{ direction: "unwind", credits: 40_000 }];
    await refreshMonthlyCredits(1, PRO_PLUS_GRANT, proPlusRule, "stripe-invoice:in_9", undefined, PERIOD_START);
    const withNetting = writtenBalance();

    updateSets.length = 0;
    rowReads = 0;
    rows.length = 0;
    rows.push({ balance: 60_000, purchasedBalance: 0 });
    await refreshMonthlyCredits(1, PRO_PLUS_GRANT, proPlusRule, "stripe-invoice:in_9", undefined, null);

    expect(withNetting).toBe(writtenBalance());
  });

  it("⚠ the settlement read happens on EVERY attempt of the compare-and-set loop", async () => {
    /* The reason the date goes down rather than the net: a settlement landing
       between a caller's read and a retry's re-read would otherwise be
       subtracted from a balance that already carries it. The first attempt's
       UPDATE matches zero rows, the loop re-reads — and must re-read BOTH. */
    rows.push({ balance: 145_000, purchasedBalance: 0 });
    rows.push({ balance: 150_000, purchasedBalance: 0 });
    settlementRows = [{ direction: "grant", credits: 125_000 }];
    updateAnswers = [0, 1];

    await refreshMonthlyCredits(1, PRO_GRANT, proRule, "stripe-invoice:in_10", undefined, PERIOD_START);

    expect(settlementQueries, "one settlement read per attempt, not one per call").toBe(2);
    expect(writtenBalance()).toBe(PRO_GRANT + proRule(150_000 - 125_000) + 125_000);
  });
});

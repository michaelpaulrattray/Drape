/**
 * Every word and figure the reconciliation pane shows (#2027).
 *
 * Lifted out of `ReconciliationSubTab.tsx` for the reason `creditRowText.ts`
 * was: the question is about strings, rendering is outside `pnpm test`, and a
 * pure function can be driven with sentinel figures and read by the census's
 * rendered-text reader (`server/moderatorRoadLedger.test.ts`).
 *
 * # Why the pane says "ledger" instead of converting
 *
 * The pane is the books. It sets charges against the records that recorded
 * them, and both sides are stored in ledger; a moderator using it is matching
 * it to the audit log and to the CSV, which carry ledger too. Converting every
 * figure would make the workings stop adding up on screen (each figure would
 * round on its own). So each section says which scale its figures are on, and
 * the one sentence a moderator acts on — the verdict — states the customer's
 * figure first, the way every other staff figure is stated (`staffCreditFact`).
 *
 * What it prevents: the request form takes the customer's figure since #2010,
 * so a bare "350" copied from here would have granted 1,750 ledger.
 */
import { displayBalance, staffCreditFact } from "@shared/creditDisplay";

import { grouped, negated, signed } from "./figures";
import type { ReconciliationData } from "./reconciliation-csv";

export type ReconciliationViewRow = {
  readonly label: string;
  readonly value: string;
  readonly subtotal?: boolean;
  readonly attention?: boolean;
};

export type ReconciliationViewCard = {
  readonly eyebrow: string;
  readonly rows: readonly ReconciliationViewRow[];
  /** The "By type" sub-block; absent on the workings card. */
  readonly byType?: readonly ReconciliationViewRow[];
};

export type ReconciliationView = {
  readonly fault: boolean;
  readonly hasFailures: boolean;
  readonly headline: string;
  readonly summary: string;
  readonly discrepancyEyebrow: string;
  readonly discrepancyValue: string;
  readonly credits: ReconciliationViewCard;
  readonly generations: ReconciliationViewCard;
  readonly workings: ReconciliationViewCard;
};

/** Sentence case for a machine label — `admin_add` and `castingRoll` both. */
export function machineLabel(raw: string): string {
  const spaced = raw.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function reconciliationView(data: ReconciliationData): ReconciliationView {
  const { credits, generations, reconciliation } = data;
  const hasFailures = generations.failed > 0;
  const failureRateHigh = generations.failureRate > 20;
  const fault = reconciliation.hasDiscrepancy;
  const unaccounted = Math.abs(reconciliation.discrepancy);

  /*
    THE THREE-WAY HEADLINE, kept from the original and re-voiced. His §4b:
    `All Clear` becomes `The ledgers agree.` — a sentence rather than a status
    word, because the pane answers a question.
  */
  const headline = fault
    ? `${staffCreditFact(displayBalance(unaccounted), unaccounted)} unaccounted for.`
    : hasFailures
      ? "Failures were refunded."
      : "The ledgers agree.";

  return {
    fault,
    hasFailures,
    headline,
    /* Server-written, and labelled at its source (`buildSummary`, #2027). */
    summary: reconciliation.summary,
    discrepancyEyebrow: "Discrepancy · ledger",
    discrepancyValue: signed(reconciliation.discrepancy),
    credits: {
      eyebrow: "Credit transactions · ledger",
      rows: [
        { label: "Total earned", value: signed(credits.totalEarned) },
        { label: "Total spent", value: negated(credits.totalSpent) },
        { label: "Gross generation deductions", value: grouped(credits.grossGenerationDeductions), subtotal: true },
        ...(credits.totalRefunds > 0 ? [{ label: "Refunds", value: signed(credits.totalRefunds) }] : []),
        { label: "Net generation cost", value: grouped(credits.netGenerationCost), subtotal: true },
      ],
      byType: Object.entries(credits.byType).map(([type, info]) => ({
        label: machineLabel(type),
        value: `${signed(info.totalAmount)} (${info.count})`,
      })),
    },
    generations: {
      eyebrow: "Generation records · costs in ledger",
      rows: [
        { label: "Total generations", value: grouped(generations.total) },
        { label: "Completed", value: grouped(generations.completed) },
        {
          label: "Failed",
          attention: hasFailures,
          value: failureRateHigh
            ? `${grouped(generations.failed)} (${generations.failureRate}%)`
            : grouped(generations.failed),
        },
        { label: "Pending", value: grouped(generations.pending) },
        { label: "Completed cost", value: grouped(generations.creditsOnCompleted), subtotal: true },
        ...(generations.creditsOnPending > 0
          ? [{ label: "Pending cost", value: grouped(generations.creditsOnPending) }]
          : []),
      ],
      byType: generations.byType.map((entry) => ({
        label: machineLabel(entry.type),
        value: `${grouped(entry.totalCost)} (${entry.totalCount})`,
      })),
    },
    workings: {
      eyebrow: "Reconciliation · ledger",
      rows: [
        { label: "Gross generation deductions", value: grouped(reconciliation.grossGenerationDeductions) },
        ...(reconciliation.totalRefunds > 0
          ? [{ label: "Refunds (failures, cancellations, corrections)", value: negated(reconciliation.totalRefunds) }]
          : []),
        { label: "Net generation cost", value: grouped(reconciliation.netGenerationCost), subtotal: true },
        { label: "Completed generation recorded cost", value: grouped(reconciliation.completedGenerationCost) },
        ...(reconciliation.pendingGenerationCost > 0
          ? [{ label: "Pending generation cost", value: grouped(reconciliation.pendingGenerationCost) }]
          : []),
        /*
          ⚠ THE DISCREPANCY ROW IS DELETED FROM HERE ON PURPOSE (§4d).
          It is the verdict, it is at the top at 30px, and *"repeating it at
          the bottom in 12px is the same double-count the Crew work removed."*
          The workings end at Recorded charges.
        */
        { label: "Recorded charges (all records)", value: grouped(reconciliation.expectedCost), subtotal: true },
      ],
    },
  };
}

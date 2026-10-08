/**
 * Every word and figure one row of the moderator's Credits tab shows (#2027).
 *
 * Lifted out of `CreditsSubTab.tsx` so the figures can be DRIVEN: component
 * rendering is outside `pnpm test` (a node environment), and the question this
 * card asks — does any ledger figure on this row reach a moderator unlabelled?
 * — is a question about these strings, not about the markup around them.
 * `server/moderatorRoadLedger.test.ts` feeds it sentinel ledger figures and reads every
 * string it returns with the census's rendered-text reader.
 *
 * #2010 put the cells and facts on the customer's scale. What it left was the
 * DESCRIPTION — the stored sentence a writer composed with ledger figures in it
 * (*"Credit top-up: 50000 credits"*), shown both as the row's "What" and as its
 * evidence. A moderator copying 50,000 from it into a request form that takes
 * the customer's figure would grant 250,000 ledger. It now reads through
 * `staffLedgerProse`, which restates each composed figure the way every other
 * staff figure is stated and leaves the stored row untouched.
 */
import {
  displayBalance,
  displayMovement,
  formatCredits,
  staffCreditFact,
  staffLedgerProse,
} from "@shared/creditDisplay";

import { signed } from "./figures";

/** The fields of a credit-history row this tab reads — `getDetailedCreditHistory`. */
export type StaffCreditTransaction = {
  readonly id: number;
  readonly type: string;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly description?: string | null;
  readonly referenceId?: string | null;
};

/** Sentence case for a machine label — `admin_add` becomes `Admin add`. */
export function sentenceCase(raw: string): string {
  const spaced = raw.replace(/_/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export type CreditRowText = {
  readonly amount: string;
  readonly kind: string;
  readonly what: string;
  readonly balance: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly evidence: string | undefined;
};

/** `when` is the row's formatted time, supplied by the component's staff clock. */
export function creditRowText(tx: StaffCreditTransaction, when: string): CreditRowText {
  const description = tx.description ? staffLedgerProse(tx.description) : "";
  return {
    /* The sign carries the direction — his §3. No red on a spend. */
    amount: signed(displayMovement(tx.amount)),
    kind: sentenceCase(tx.type),
    what: description || "—",
    balance: formatCredits(displayBalance(tx.balanceAfter)),
    facts: [
      { label: "TRANSACTION", value: `#${tx.id}` },
      { label: "KIND", value: sentenceCase(tx.type) },
      { label: "AMOUNT", value: `${signed(displayMovement(tx.amount))} credits · ${signed(tx.amount)} ledger` },
      { label: "BALANCE AFTER", value: staffCreditFact(displayBalance(tx.balanceAfter), tx.balanceAfter) },
      { label: "WHEN", value: when },
      ...(tx.referenceId ? [{ label: "REFERENCE", value: String(tx.referenceId) }] : []),
    ],
    evidence: description || undefined,
  };
}

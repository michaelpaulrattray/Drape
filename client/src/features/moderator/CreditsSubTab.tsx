/**
 * Moderation → User investigation → Credits, on the one staff table pattern.
 *
 * ## ⚠ It is here because his §1 test said so, not because it was convenient
 *
 * Brief 09 opens with an instruction to run before designing anything: *"check
 * whether `CreditsSubTab` is really a plain filtered list. If it turns out to
 * be, it belongs in brief 06's pattern instead … do not build a bespoke ledger
 * for something the table already handles."*
 *
 * Read at the file, it was: a type filter, two date inputs, a paged list of
 * transactions with its own prev/next, a CSV export, and one row action. That
 * is `TableFilter` + `DataTable` + `RowAction`, exactly — so **284 lines of
 * bespoke ledger became a column spec and a row map**, and moving it here is
 * the right outcome rather than a shortfall.
 *
 * ## Three coloured tiles became one line
 *
 * `Added` in emerald, `Used` in red, `Balance` in blue — and the red is the one
 * his §3 argues about: *"Spending credits is what the product is FOR. Colouring
 * it red says a normal, healthy, revenue-generating action is a problem."* They
 * are a sentence in the head now, on `GenerationsSubTab`'s established shape
 * one file over.
 *
 * The per-transaction badge — six tints keyed on `tx.type` — is a `StatePill`
 * with no accent: a transaction's kind is not a state anyone must act on.
 *
 * ## What did not change (§7)
 *
 * Every query, the CSV export, both date filters and the page size are the
 * ones that were here. The refund payload is not: the `amountCents`
 * derivation this paragraph used to defend (a bare `* 0.00072`) was filed as
 * **#418** rather than edited inside a surface PR, and #418's fix later
 * removed it — the row action now names only which charge, and the server
 * reads the money figures from Stripe and the ledger.
 */
import { useState } from "react";

import { toast } from "sonner";

import { RowId, StatePill, pageRange } from "@/features/staff";
import { Button, DataTable, TableFilter, TableHead } from "@/foundation";
import type { DataRow } from "@/foundation";
import { staffDateTime } from "@/foundation/staffDate";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { trpc } from "@/lib/trpc";

import { displayBalance, displayPrice, formatCredits } from "@shared/creditDisplay";

import { creditRowText } from "./creditRowText";
import { runStaffCsvExport, saveCsvFile, staffCsvFileName } from "./staffCsvExport";
import { type OpenChangeRequestOptions } from "./moderatorConstants";

const PAGE_SIZE = 20;

interface CreditsSubTabProps {
  creditHistoryQuery: any;
  userDetailsQuery: any;
  creditTypeFilter: string;
  setCreditTypeFilter: (v: string) => void;
  creditPage: number;
  setCreditPage: (fn: (p: number) => number) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  selectedUserId: number;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
}

export function CreditsSubTab({
  creditHistoryQuery,
  userDetailsQuery,
  creditTypeFilter,
  setCreditTypeFilter,
  creditPage,
  setCreditPage,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedUserId,
  onOpenChangeRequest,
}: CreditsSubTabProps) {
  /* Through the vanilla client and the shared routine — see `staffCsvExport.ts` (#1991). */
  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    const input = {
      userId: selectedUserId,
      type: creditTypeFilter as any,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    try {
      await runStaffCsvExport({
        context: "moderatorExports.exportUserCreditHistoryCsv",
        fetchExport: () => utils.client.moderatorExports.exportUserCreditHistoryCsv.query(input),
        fileName: staffCsvFileName(`credit-history-user-${selectedUserId}`),
        successMessage: (answer) => `Exported ${answer.total} credit transactions`,
        fallbackFailure: "The credit history could not be exported.",
        download: ({ name, csv }) => saveCsvFile(name, csv),
        onSuccess: (message) => toast.success(message),
        onFailure: (message) => toast.error(message),
        logFailure: logRawFailure,
        readFailure: readableFailure,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const transactions: any[] = creditHistoryQuery.data?.transactions ?? [];
  const total: number = creditHistoryQuery.data?.total ?? 0;
  const summary = creditHistoryQuery.data?.summary;
  /*
    #2010: every figure on this tab is on the CUSTOMER's scale — the one the
    admin's Users panel and the investigation head beside it read — because a
    moderator here is answering a customer about numbers that customer saw.
    The ledger each was computed from stays in the row's facts, since the CSV
    export, the audit log and the reconciliation pane all carry ledger and a
    moderator must be able to match a row to them. Grants round down, charges
    round up (`displayMovement`), so no row reads as taking less than it took.
  */
  const balanceLedger: number | undefined =
    userDetailsQuery.data?.credits?.balance ?? summary?.netChange;
  const balance = balanceLedger == null ? undefined : formatCredits(displayBalance(balanceLedger));

  const rows: DataRow[] = transactions.map((tx) => {
    /* Every string this row shows — `creditRowText.ts`, where the figures are driven (#2027). */
    const text = creditRowText(tx, staffDateTime(new Date(tx.createdAt)));
    return {
      id: String(tx.id),
      cells: [
        /*
          The sign carries the direction — his §3. No red on a spend.

          ⚠ **THROUGH `signed()`, like the two surfaces either side of it.** This
          cell rendered `String(tx.amount)` — an ASCII hyphen for a negative and
          no thousands grouping — while the reconciliation pane two tabs away
          insisted on `−1,240`. It is the third consumer of that rule, which is
          what moved the rule out of both files and into `figures.ts` rather than
          being copied a third time (#412 re-review, findings 1 and 3).
        */
        <span key="amount">{text.amount}</span>,
        <StatePill key="type" label={text.kind} />,
        <span key="what" className="dp-table__pair">
          <span className="dp-table__pairmain">{text.what}</span>
        </span>,
        <RowId key="balance">{text.balance}</RowId>,
        <span key="when">{staffDateTime(new Date(tx.createdAt))}</span>,
      ],
      facts: [...text.facts],
      evidence: text.evidence,
      /*
        The refund action. It opens the change-request form; it does not itself
        move money, which is why it is not `destructive` — a consequence note on
        a button that opens a form would be describing the wrong step.

        It names WHICH charge (the session id) and nothing about money: the
        amount comes from the Stripe charge itself and the credits from this
        ledger, both read by the server (#418 — this line used to compute the
        amount with a bare magic float, `tx.amount * 0.00072`, which turned a
        10,000-credit top-up into a 7-cent refund).
      */
      actions:
        tx.type === "topup" && tx.referenceId
          ? [
              {
                key: "refund",
                label: "Request refund",
                onClick: () => {
                  onOpenChangeRequest({
                    type: "stripe_refund",
                    targetUserId: String(selectedUserId),
                    targetUserName: userDetailsQuery.data?.user?.name || "",
                    stripeSessionId: tx.referenceId!,
                  });
                },
              },
            ]
          : undefined,
    };
  });

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <TableHead eyebrow="Credits">
        {summary ? (
          <span className="dp-small">
            {formatCredits(displayBalance(summary.totalCreditsEarned))} added,{" "}
            {formatCredits(displayPrice(summary.totalCreditsSpent))} used, {balance ?? "—"} now
          </span>
        ) : null}
        <TableFilter
          label="Kind"
          value={creditTypeFilter}
          onChange={(value) => {
            setCreditTypeFilter(value);
            setCreditPage(() => 0);
          }}
          options={[
            { value: "all", label: "All kinds" },
            { value: "generation", label: "Generations" },
            { value: "purchase", label: "Purchases" },
            { value: "topup", label: "Top-ups" },
            { value: "subscription", label: "Subscription" },
            { value: "signup", label: "Signup" },
            { value: "refund", label: "Refunds" },
            { value: "bonus", label: "Bonuses" },
            { value: "admin_add", label: "Admin add" },
            { value: "admin_deduct", label: "Admin deduct" },
          ]}
        />
        <input
          type="date"
          className="dp-tableselect"
          aria-label="From date"
          value={startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
            setCreditPage(() => 0);
          }}
        />
        <input
          type="date"
          className="dp-tableselect"
          aria-label="To date"
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value);
            setCreditPage(() => 0);
          }}
        />
        {startDate || endDate ? (
          <Button
            variant="quiet"
            size="small"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setCreditPage(() => 0);
            }}
          >
            Clear dates
          </Button>
        ) : null}
        <Button
          variant="quiet"
          size="small"
          onClick={handleExport}
          disabled={isExporting || creditHistoryQuery.isLoading}
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </TableHead>

      <DataTable
        columns={[
          { label: "Amount", width: "0 0 96px" },
          { label: "Kind", width: "0 0 124px" },
          { label: "What", width: "1 1 0" },
          { label: "Balance", width: "0 0 96px", align: "end" },
          { label: "When", width: "0 0 148px" },
        ]}
        rows={rows}
        loading={creditHistoryQuery.isLoading}
        empty={{
          title: "No credit transactions match those filters.",
          body: "Widen the kind, or clear the dates.",
        }}
        footer={{
          meta: pageRange({
            offset: creditPage * PAGE_SIZE,
            count: transactions.length,
            total,
          }),
          onBack: () => setCreditPage((p) => Math.max(0, p - 1)),
          onNext: () => setCreditPage((p) => p + 1),
          backDisabled: creditPage === 0,
          nextDisabled: (creditPage + 1) * PAGE_SIZE >= total,
        }}
      />
    </div>
  );
}

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
 * Every query, the CSV export, both date filters, the page size and the refund
 * change-request payload are the ones that were here. ⚠ **Including the
 * `amountCents` derivation, which is a money path and is left alone
 * deliberately** — it is questionable and it is filed as **#418** rather
 * than edited inside a surface PR.
 */
import { toast } from "sonner";

import { RowId, StatePill, pageRange } from "@/features/staff";
import { Button, DataTable, TableFilter, TableHead } from "@/foundation";
import type { DataRow } from "@/foundation";
import { trpc } from "@/lib/trpc";

import { grouped, signed } from "./figures";
import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";

const PAGE_SIZE = 20;

/** Sentence case for a machine label — `admin_add` becomes `Admin add`. */
function sentenceCase(raw: string): string {
  const spaced = raw.replace(/_/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

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
  const exportQuery = trpc.moderatorExports.exportUserCreditHistoryCsv.useQuery(
    {
      userId: selectedUserId,
      type: creditTypeFilter as any,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `credit-history-user-${selectedUserId}-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${result.data.total} credit transactions`);
      }
    } catch {
      toast.error("Failed to export credit history");
    }
  };

  const transactions: any[] = creditHistoryQuery.data?.transactions ?? [];
  const total: number = creditHistoryQuery.data?.total ?? 0;
  const summary = creditHistoryQuery.data?.summary;
  const balance =
    userDetailsQuery.data?.credits?.balance?.toLocaleString() ?? summary?.netChange;

  const rows: DataRow[] = transactions.map((tx) => ({
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
      <span key="amount">{signed(tx.amount)}</span>,
      <StatePill key="type" label={sentenceCase(tx.type)} />,
      <span key="what" className="dp-table__pair">
        <span className="dp-table__pairmain">{tx.description || "—"}</span>
      </span>,
      <RowId key="balance">{grouped(tx.balanceAfter)}</RowId>,
      <span key="when">{formatDate(new Date(tx.createdAt))}</span>,
    ],
    facts: [
      { label: "TRANSACTION", value: `#${tx.id}` },
      { label: "KIND", value: sentenceCase(tx.type) },
      { label: "AMOUNT", value: `${signed(tx.amount)} credits` },
      { label: "BALANCE AFTER", value: grouped(tx.balanceAfter) },
      { label: "WHEN", value: formatDate(new Date(tx.createdAt)) },
      ...(tx.referenceId ? [{ label: "REFERENCE", value: String(tx.referenceId) }] : []),
    ],
    evidence: tx.description || undefined,
    /*
      The refund action, unchanged in what it sends. It opens the change-request
      form; it does not itself move money, which is why it is not `destructive`
      — a consequence note on a button that opens a form would be describing the
      wrong step.
    */
    actions:
      tx.type === "topup" && tx.referenceId
        ? [
            {
              key: "refund",
              label: "Request refund",
              onClick: () => {
                const amountCents = Math.round(tx.amount * 0.00072);
                onOpenChangeRequest({
                  type: "stripe_refund",
                  targetUserId: String(selectedUserId),
                  targetUserName: userDetailsQuery.data?.user?.name || "",
                  stripeSessionId: tx.referenceId!,
                  originalAmountCents: amountCents,
                  originalCredits: tx.amount,
                });
              },
            },
          ]
        : undefined,
  }));

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <TableHead eyebrow="Credits">
        {summary ? (
          <span className="dp-small">
            {summary.totalCreditsEarned} added, {summary.totalCreditsSpent} used, {balance} now
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
          disabled={exportQuery.isFetching || creditHistoryQuery.isLoading}
        >
          {exportQuery.isFetching ? "Exporting…" : "Export CSV"}
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

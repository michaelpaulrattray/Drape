import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button, ConfirmDialog, EmptyState, LeaderRow, Skeleton, TableHead } from "@/foundation";
import { trpc } from "@/lib/trpc";
import { UNFREEZE_NOTES_MAX_LENGTH } from "@shared/inputLimits";

import { negated, signed } from "./figures";
import { downloadReconciliationCsv } from "./reconciliation-csv";
import "./investigations.css";

/**
 * RECONCILIATION — *"Do this account's credits and generations agree?"*
 *
 * Rebuilt to brief 09 (`09-moderator-investigations.md`). The old surface ran
 * backwards: a banner, two dense columns, then a six-row table whose LAST line
 * was the discrepancy — his words, *"the answer to the entire view, in 12px, at
 * the bottom."*
 *
 * The order is now **subject → verdict → evidence → action**, and the
 * discrepancy is a 30px mono figure directly under the subject, appearing
 * **once**: the row that used to repeat it at the bottom is deleted, and the
 * workings end at *Recorded charges*.
 *
 * ## What did NOT change, deliberately
 *
 * His §5 and §7: every query, mutation, CSV export and date filter is the one
 * that was here. `getUserReconciliation`, `getUserDetails`, `unfreezeAccount`
 * and `downloadReconciliationCsv` are untouched, and the three-way headline
 * logic is kept because — his §4b — *"it is well judged. Only the tone
 * changes."*
 *
 * ## ⚠ Five colours became one
 *
 * Emerald, red, amber, blue and purple are gone. Earned, spent, refunds,
 * completed, gross and net are all `--ink` mono and **the sign carries the
 * direction**; the blue and purple column dots are gone because *"two columns
 * headed Credit transactions and Generation records do not need colour-coding
 * — the headings identify them."*
 *
 * What is left: `--accentInk` on a frozen account and on a failure count, and
 * `--errorInk` on exactly one number — the discrepancy, when it is non-zero.
 * That is the whole argument: *"when everything is coloured, the discrepancy is
 * not."*
 *
 * ## ⚠ The `(info as any)` casts are gone
 *
 * His §4c asked for it in passing and the types were already there:
 * `credits.byType` is a record of `{ totalAmount, count }`, so the cast was
 * hiding a shape the router already declares.
 */

interface ReconciliationSubTabProps {
  userId: number;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}

const formatNumber = (n: number): string => n.toLocaleString();

/** Sentence case for a machine label — `admin_add` and `castingRoll` both. */
function sentenceCase(raw: string): string {
  const spaced = raw.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ReconciliationSubTab({
  userId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: ReconciliationSubTabProps) {
  const [confirmingUnfreeze, setConfirmingUnfreeze] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.moderatorReconciliation.getUserReconciliation.useQuery(
    { userId, startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: !!userId }
  );

  const userQuery = trpc.moderator.getUserDetails.useQuery({ userId }, { enabled: !!userId });
  const isFrozen = !!userQuery.data?.user?.frozenAt;
  const frozenAt = userQuery.data?.user?.frozenAt;
  const frozenReason = userQuery.data?.user?.frozenReason;

  const unfreezeMutation = trpc.moderatorReconciliation.unfreezeAccount.useMutation({
    onSuccess: () => {
      toast.success("Account unfrozen");
      setConfirmingUnfreeze(false);
      utils.moderator.getUserDetails.invalidate({ userId });
      utils.moderatorReconciliation.getFlaggedUsers.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to unfreeze account");
    },
  });

  if (isLoading) {
    return (
      <div className="dp-inv__stack">
        <Skeleton style={{ height: 78 }} />
        <Skeleton style={{ height: 150 }} />
        <Skeleton style={{ height: 150 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No reconciliation for this account"
        body="Nothing has been charged or generated in the selected range."
      />
    );
  }

  const { credits, generations, reconciliation } = data;
  const hasFailures = generations.failed > 0;
  const failureRateHigh = generations.failureRate > 20;
  const fault = reconciliation.hasDiscrepancy;

  /*
    THE THREE-WAY HEADLINE, kept from the original and re-voiced. His §4b:
    `All Clear` becomes `The ledgers agree.` — a sentence rather than a status
    word, because the pane answers a question.
  */
  const headline = fault
    ? `${formatNumber(Math.abs(reconciliation.discrepancy))} credits unaccounted for.`
    : hasFailures
      ? "Failures were refunded."
      : "The ledgers agree.";

  const verdictClass = fault
    ? "dp-inv__verdict dp-inv__verdict--fault"
    : hasFailures
      ? "dp-inv__verdict dp-inv__verdict--refunded"
      : "dp-inv__verdict";

  return (
    <div className="dp-inv__stack">
      {/* ── 1 · SUBJECT — only when there is something to say (§4a) ── */}
      {isFrozen && (
        <div className="dp-inv__subject">
          <div className="dp-inv__subjectbody">
            <p className="dp-inv__subjecttitle">Account frozen</p>
            <p className="dp-inv__subjectreason">
              {frozenAt && (
                <>
                  Frozen{" "}
                  <span className="dp-inv__subjectstamp">
                    {new Date(frozenAt).toLocaleDateString()}
                  </span>
                </>
              )}
              {frozenReason ? ` — ${frozenReason}` : ""}
            </p>
            <div className="dp-inv__subjectaction">
              <Button variant="secondary" size="small" onClick={() => setConfirmingUnfreeze(true)}>
                Unfreeze account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2 · VERDICT — the answer, and the largest figure in the pane (§4b) ── */}
      <div className={verdictClass}>
        <div className="dp-inv__verdictmain">
          <p className="dp-inv__eyebrow">Reconciliation</p>
          <p className="dp-inv__verdictline">{headline}</p>
          <p className="dp-inv__verdictsummary">{reconciliation.summary}</p>
        </div>
        <div className="dp-inv__verdictfigure">
          <p className="dp-inv__eyebrow">Discrepancy</p>
          <p
            className={`dp-inv__verdictvalue${fault ? " dp-inv__verdictvalue--fault" : ""}`}
          >
            {signed(reconciliation.discrepancy)}
          </p>
        </div>
      </div>

      {/* ── 3 · EVIDENCE — the two columns (§4c) ── */}
      <div className="dp-inv__columns">
        <div className="dp-inv__card">
          <TableHead eyebrow="Credit transactions" />
          <div className="dp-inv__cardbody">
            <LeaderRow label="Total earned" value={signed(credits.totalEarned)} />
            <LeaderRow label="Total spent" value={negated(credits.totalSpent)} />
            <LeaderRow
              label="Gross generation deductions"
              value={formatNumber(credits.grossGenerationDeductions)}
              subtotal
            />
            {credits.totalRefunds > 0 && (
              <LeaderRow label="Refunds" value={signed(credits.totalRefunds)} />
            )}
            <LeaderRow
              label="Net generation cost"
              value={formatNumber(credits.netGenerationCost)}
              subtotal
            />
            <div className="dp-inv__subblock">
              <p className="dp-inv__eyebrow">By type</p>
              {Object.entries(credits.byType).map(([type, info]) => (
                <LeaderRow
                  key={type}
                  small
                  label={sentenceCase(type)}
                  value={`${signed(info.totalAmount)} (${info.count})`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="dp-inv__card">
          <TableHead eyebrow="Generation records" />
          <div className="dp-inv__cardbody">
            <LeaderRow label="Total generations" value={formatNumber(generations.total)} />
            <LeaderRow label="Completed" value={formatNumber(generations.completed)} />
            <LeaderRow
              label="Failed"
              attention={hasFailures}
              value={
                failureRateHigh
                  ? `${formatNumber(generations.failed)} (${generations.failureRate}%)`
                  : formatNumber(generations.failed)
              }
            />
            <LeaderRow label="Pending" value={formatNumber(generations.pending)} />
            <LeaderRow
              label="Completed cost"
              value={formatNumber(generations.creditsOnCompleted)}
              subtotal
            />
            {generations.creditsOnPending > 0 && (
              <LeaderRow label="Pending cost" value={formatNumber(generations.creditsOnPending)} />
            )}
            <div className="dp-inv__subblock">
              <p className="dp-inv__eyebrow">By type</p>
              {generations.byType.map((entry) => (
                <LeaderRow
                  key={entry.type}
                  small
                  label={sentenceCase(entry.type)}
                  value={`${formatNumber(entry.totalCost)} (${entry.totalCount})`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 · EVIDENCE — the workings (§4d) ── */}
      <div className="dp-inv__card">
        <TableHead eyebrow="Reconciliation" />
        <div className="dp-inv__cardbody">
          <LeaderRow
            label="Gross generation deductions"
            value={formatNumber(reconciliation.grossGenerationDeductions)}
          />
          {reconciliation.totalRefunds > 0 && (
            <LeaderRow
              label="Refunds (failures, cancellations, corrections)"
              value={negated(reconciliation.totalRefunds)}
            />
          )}
          <LeaderRow
            label="Net generation cost (credits)"
            value={formatNumber(reconciliation.netGenerationCost)}
            subtotal
          />
          <LeaderRow
            label="Completed generation recorded cost"
            value={formatNumber(reconciliation.completedGenerationCost)}
          />
          {reconciliation.pendingGenerationCost > 0 && (
            <LeaderRow
              label="Pending generation cost"
              value={formatNumber(reconciliation.pendingGenerationCost)}
            />
          )}
          <LeaderRow
            label="Recorded charges (all records)"
            value={formatNumber(reconciliation.expectedCost)}
            subtotal
          />
          {/*
            ⚠ THE DISCREPANCY ROW IS DELETED FROM HERE ON PURPOSE (§4d).
            It is the verdict, it is at the top at 30px, and *"repeating it at
            the bottom in 12px is the same double-count the Crew work removed."*
            The workings end at Recorded charges.
          */}
        </div>
      </div>

      {/* ── 5 · ACTION — filters and export, one wrapping row (§4e) ── */}
      <div className="dp-inv__filters">
        <span className="dp-inv__eyebrow">Date range</span>
        <span className="dp-inv__datefield">
          <input
            type="date"
            className="dp-inv__date"
            aria-label="Reconciliation start date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {startDate && (
            <button
              type="button"
              className="dp-inv__dateclear"
              aria-label="Clear start date"
              onClick={() => setStartDate("")}
            >
              <X size={12} />
            </button>
          )}
        </span>
        <span className="dp-inv__dash">—</span>
        <span className="dp-inv__datefield">
          <input
            type="date"
            className="dp-inv__date"
            aria-label="Reconciliation end date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {endDate && (
            <button
              type="button"
              className="dp-inv__dateclear"
              aria-label="Clear end date"
              onClick={() => setEndDate("")}
            >
              <X size={12} />
            </button>
          )}
        </span>
        {/* A spacer, never `ml-auto` — his §4e and §7 both name it. */}
        <span className="dp-inv__filterspacer" />
        <Button
          variant="secondary"
          size="small"
          onClick={() =>
            downloadReconciliationCsv(data, userId, startDate || undefined, endDate || undefined)
          }
        >
          Export CSV
        </Button>
      </div>

      {/*
        UNFREEZE — through the promoted dialog, with the review notes inside it
        (§4a). It was an inline form with a `bg-emerald-600` confirm: *"a green
        primary on a security action, and the only place in the product that
        would be green."*
      */}
      {confirmingUnfreeze && (
        <ConfirmDialog
          title="Unfreeze this account?"
          body="They will be able to generate and spend credits again immediately."
          notes={{
            label: "Review notes (required)",
            placeholder: "Explain why the account is being unfrozen…",
            maxLength: UNFREEZE_NOTES_MAX_LENGTH,
          }}
          cancelLabel="Cancel"
          confirmLabel="Unfreeze account"
          busyLabel="Unfreezing…"
          busy={unfreezeMutation.isPending}
          onCancel={() => setConfirmingUnfreeze(false)}
          onConfirm={(notes) => unfreezeMutation.mutate({ userId, notes })}
        />
      )}
    </div>
  );
}

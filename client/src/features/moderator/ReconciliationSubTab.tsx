import { X } from "lucide-react";

import { Button, EmptyState, LeaderRow, Skeleton, TableHead } from "@/foundation";
import { trpc } from "@/lib/trpc";

import { downloadReconciliationCsv } from "./reconciliation-csv";
import { reconciliationView, type ReconciliationViewRow } from "./reconciliationView";
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
 * that was here. `getUserReconciliation` and `downloadReconciliationCsv` are
 * untouched, and the three-way headline logic is kept because — his §4b —
 * *"it is well judged. Only the tone changes."*
 *
 * ⚠ **THAT SENTENCE ALSO NAMED `getUserDetails` AND `unfreezeAccount` UNTIL
 * #908, AND BOTH ARE GONE FROM THIS FILE NOW.** It was true of the restructure
 * it describes; it stopped being true the day the duplicate subject band was
 * deleted, and it is corrected here rather than left to contradict the file it
 * sits in (law 7c — when a document and the tree disagree, the tree wins and
 * the document is the bug). **Neither capability was lost:** the investigation
 * shell reads the same `getUserDetails` for the same user and draws the one
 * surviving band, and its `FreezeAction` owns the one remaining unfreeze.
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

/** One leader row of a card — the strings come from `reconciliationView`. */
function ViewRows({ rows, small }: { rows: readonly ReconciliationViewRow[]; small?: boolean }) {
  return (
    <>
      {rows.map((row) => (
        <LeaderRow
          key={row.label}
          small={small}
          label={row.label}
          value={row.value}
          subtotal={row.subtotal}
          attention={row.attention}
        />
      ))}
    </>
  );
}

export function ReconciliationSubTab({
  userId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: ReconciliationSubTabProps) {
  const { data, isLoading } = trpc.moderatorReconciliation.getUserReconciliation.useQuery(
    { userId, startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: !!userId }
  );

  /*
    ⚠ **THE `getUserDetails` QUERY WENT WITH THE BAND (#908), AND NO FACT WENT
    WITH IT.** It was read here for one thing only — the frozen title, date and
    reason of the duplicate band above. The investigation shell that draws the
    surviving band runs the same query for the same user, so the account's
    frozen state is still read, still fresh, and now read once. This subtab's
    docblock lists `getUserDetails` under *what did NOT change*; that sentence
    was true of the restructure it describes and is corrected by this commit
    rather than left to contradict the file it sits in.
  */

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

  /*
    Every word and figure below comes from `reconciliationView.ts`, where they
    are driven (#2027): the headline names the customer's figure first, and
    every section says its figures are ledger. The three-way headline logic,
    kept from the original (his §4b), lives there now too.
  */
  const view = reconciliationView(data);
  const { fault, hasFailures } = view;
  const verdictClass = fault
    ? "dp-inv__verdict dp-inv__verdict--fault"
    : hasFailures
      ? "dp-inv__verdict dp-inv__verdict--refunded"
      : "dp-inv__verdict";

  return (
    <div className="dp-inv__stack">
      {/*
        ── 1 · SUBJECT — DELETED, and the band it drew lives in the shell (#908).

        ⚠ **This subtab used to draw its own "Account frozen" band**, and
        because the investigation shell draws one too, Reconciliation — and
        only Reconciliation — stacked TWO of them: same title, same reason, two
        different Unfreeze buttons, and only this one carrying the date. A
        moderator deciding whether to unfreeze a paying customer read one fact
        twice, with different completeness, and no way to tell which button was
        the real one.

        **The shell's survived because §5 says so** — *"One band, NOT REPEATED
        IN THREE WIDGETS"* — and because it is drawn for every subtab, where
        this one appeared on a quarter of them. The date came across with the
        deletion rather than being lost with it, and the Unfreeze button is the
        shell's `FreezeAction`, which was corrected in the same commit so a
        frozen ADMIN keeps an unfreeze control here. Nothing was dropped.

        §4a still holds and is now held in one place: no band when there is no
        state to report.
      */}

      {/* ── 2 · VERDICT — the answer, and the largest figure in the pane (§4b) ── */}
      <div className={verdictClass}>
        <div className="dp-inv__verdictmain">
          <p className="dp-inv__eyebrow">Reconciliation</p>
          <p className="dp-inv__verdictline">{view.headline}</p>
          <p className="dp-inv__verdictsummary">{view.summary}</p>
        </div>
        <div className="dp-inv__verdictfigure">
          <p className="dp-inv__eyebrow">{view.discrepancyEyebrow}</p>
          <p
            className={`dp-inv__verdictvalue${fault ? " dp-inv__verdictvalue--fault" : ""}`}
          >
            {view.discrepancyValue}
          </p>
        </div>
      </div>

      {/* ── 3 · EVIDENCE — the two columns (§4c) ── */}
      <div className="dp-inv__columns">
        {[view.credits, view.generations].map((card) => (
          <div className="dp-inv__card" key={card.eyebrow}>
            <TableHead eyebrow={card.eyebrow} />
            <div className="dp-inv__cardbody">
              <ViewRows rows={card.rows} />
              <div className="dp-inv__subblock">
                <p className="dp-inv__eyebrow">By type</p>
                <ViewRows rows={card.byType ?? []} small />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4 · EVIDENCE — the workings (§4d); no discrepancy row, on purpose — see `reconciliationView.ts` ── */}
      <div className="dp-inv__card">
        <TableHead eyebrow={view.workings.eyebrow} />
        <div className="dp-inv__cardbody">
          <ViewRows rows={view.workings.rows} />
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
        UNFREEZE — the dialog that stood here went with the duplicate band
        above (#908). It was the SECOND unfreeze confirm in this console; the
        shell's `FreezeAction` owns the one that remains, with the same promoted
        `ConfirmDialog`, the same required review notes and the same
        `UNFREEZE_NOTES_MAX_LENGTH`. Deleting a dialog is not the same as
        deleting a capability, and the difference is that sentence.
      */}
    </div>
  );
}

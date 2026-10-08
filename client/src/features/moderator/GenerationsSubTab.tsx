/**
 * Moderation → User investigation → Generations, on the one staff table
 * pattern. Brief 09 §1 assigns it here: *"table-shaped and covered by brief
 * 06."*
 *
 * # Three summary tiles became one honest line
 *
 * The head drew emerald "Completed", red "Failed" and blue "Credits Used" —
 * and the colour was the problem his brief 09 §3 names one surface over:
 * **spending credits is what the product is for, and colouring it red says a
 * normal, revenue-generating action is a problem.** They are one sentence in
 * the head now, and the only figure that keeps any accent is a failure, on the
 * rows where there is one.
 *
 * # Everything a moderator actually needed was below the fold
 *
 * A generation's error message was a truncated red line inside a card; it is
 * the evidence block now, wrapped, where a stack trace can be read. The
 * duration, the model and the cost were three greys of the same size; they are
 * facts with labels.
 *
 * Every query, the CSV export and both date filters are unchanged (§7).
 */
import { useState } from "react";

import { toast } from "sonner";

import { RowId, StatePill, pageRange } from "@/features/staff";
import { Button, DataTable, TableFilter, TableHead } from "@/foundation";
import type { DataRow } from "@/foundation";
import { staffDateTime } from "@/foundation/staffDate";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { trpc } from "@/lib/trpc";

import { csvDateStamp, runStaffCsvExport, saveCsvFile } from "./staffCsvExport";

const PAGE_SIZE = 20;

interface GenerationsSubTabProps {
  generationHistoryQuery: any;
  genStatusFilter: string;
  setGenStatusFilter: (v: string) => void;
  genTypeFilter: string;
  setGenTypeFilter: (v: string) => void;
  genPage: number;
  setGenPage: (fn: (p: number) => number) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  userId: number;
}

export function GenerationsSubTab({
  generationHistoryQuery,
  genStatusFilter,
  setGenStatusFilter,
  genTypeFilter,
  setGenTypeFilter,
  genPage,
  setGenPage,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  userId,
}: GenerationsSubTabProps) {
  /*
    Through the vanilla client and the shared routine — see `staffCsvExport.ts`
    (#1991). This one had no `try` at all, so a refusal was also an unhandled
    rejection.
  */
  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    const input = {
      userId,
      status: genStatusFilter as any,
      type: genTypeFilter as any,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    try {
      await runStaffCsvExport({
        context: "moderatorExports.exportUserGenerationHistoryCsv",
        fetchExport: () => utils.client.moderatorExports.exportUserGenerationHistoryCsv.query(input),
        fileName: `generation-history-user-${userId}-${csvDateStamp()}.csv`,
        successMessage: (answer) =>
          `Exported ${answer.total} generation records (${answer.summary.failedCount} failed, ${answer.summary.totalCreditsUsed} credits used)`,
        fallbackFailure: "The generation history could not be exported.",
        download: saveCsvFile,
        onSuccess: (message) => toast.success(message),
        onFailure: (message) => toast.error(message),
        logFailure: logRawFailure,
        readFailure: readableFailure,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const generations: any[] = generationHistoryQuery.data?.generations ?? [];
  const total: number = generationHistoryQuery.data?.total ?? 0;
  const summary = generationHistoryQuery.data?.summary;

  const rows: DataRow[] = generations.map((gen) => ({
    id: String(gen.id),
    cells: [
      <StatePill key="status" label={gen.status} attention={gen.status === "failed"} />,
      <span key="type" className="dp-table__pair">
        <span className="dp-table__pairmain">{(gen.type || "unknown").replace("_", " ")}</span>
        {gen.modelName ? <span className="dp-table__id">{gen.modelName}</span> : null}
      </span>,
      <RowId key="id">#{gen.id}</RowId>,
      <span key="cost">{gen.pointsCost > 0 ? `${gen.pointsCost} cr` : "—"}</span>,
      <span key="when">{staffDateTime(new Date(gen.createdAt))}</span>,
    ],
    facts: [
      { label: "GENERATION", value: `#${gen.id}` },
      { label: "KIND", value: gen.type || "unknown" },
      { label: "CAST", value: gen.modelName || "—" },
      { label: "COST", value: gen.pointsCost > 0 ? `${gen.pointsCost} credits` : "free" },
      { label: "STARTED", value: staffDateTime(new Date(gen.createdAt)) },
      {
        label: "TOOK",
        value:
          gen.completedAt && gen.createdAt
            ? `${((new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime()) / 1000).toFixed(1)}s`
            : "—",
      },
    ],
    evidence: gen.errorMessage || undefined,
  }));

  return (
    <div className="dp-stack" style={{ gap: 16 }}>
      <TableHead eyebrow="Generations">
        {summary ? (
          <span className="dp-small">
            {summary.completedCount} finished, {summary.failedCount} failed,{" "}
            {summary.totalCreditsUsed} credits
          </span>
        ) : null}
        <TableFilter
          label="Status"
          value={genStatusFilter}
          onChange={(value) => {
            setGenStatusFilter(value);
            setGenPage(() => 0);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "completed", label: "Finished" },
            { value: "failed", label: "Failed" },
            { value: "processing", label: "Running" },
            { value: "pending", label: "Queued" },
          ]}
        />
        <TableFilter
          label="Kind"
          value={genTypeFilter}
          onChange={(value) => {
            setGenTypeFilter(value);
            setGenPage(() => 0);
          }}
          options={[
            { value: "all", label: "All kinds" },
            { value: "masterPrompt", label: "Master prompt" },
            { value: "castingImage", label: "Casting image" },
            { value: "fullBody", label: "Full body" },
            { value: "multiView", label: "Multi view" },
            { value: "iteration", label: "Iteration" },
            { value: "upscale", label: "Upscale" },
          ]}
        />
        <input
          type="date"
          className="dp-tableselect"
          aria-label="From date"
          value={startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
            setGenPage(() => 0);
          }}
        />
        <input
          type="date"
          className="dp-tableselect"
          aria-label="To date"
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value);
            setGenPage(() => 0);
          }}
        />
        {startDate || endDate ? (
          <Button
            variant="quiet"
            size="small"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setGenPage(() => 0);
            }}
          >
            Clear dates
          </Button>
        ) : null}
        <Button
          variant="quiet"
          size="small"
          onClick={handleExportCsv}
          disabled={isExporting}
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </TableHead>

      <DataTable
        columns={[
          { label: "Status", width: "0 0 104px" },
          { label: "What", width: "1 1 0" },
          { label: "Id", width: "0 0 88px" },
          { label: "Cost", width: "0 0 88px" },
          { label: "Started", width: "0 0 148px" },
        ]}
        rows={rows}
        loading={generationHistoryQuery.isLoading}
        empty={{
          title: "No generations match those filters.",
          body: "Widen the kind or status, or clear the dates.",
        }}
        footer={{
          meta: pageRange({ offset: genPage * PAGE_SIZE, count: generations.length, total }),
          onBack: () => setGenPage((p) => Math.max(0, p - 1)),
          onNext: () => setGenPage((p) => p + 1),
          backDisabled: genPage === 0,
          nextDisabled: (genPage + 1) * PAGE_SIZE >= total,
        }}
      />
    </div>
  );
}

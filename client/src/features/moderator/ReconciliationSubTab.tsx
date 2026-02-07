import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  X,
  ArrowRightLeft,
} from "lucide-react";

interface ReconciliationSubTabProps {
  userId: number;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function StatusIcon({ hasIssue }: { hasIssue: boolean }) {
  return hasIssue ? (
    <AlertTriangle className="w-4 h-4 text-amber-400" />
  ) : (
    <CheckCircle className="w-4 h-4 text-emerald-400" />
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
    {
      userId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: !!userId }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full bg-white/10" />
        <Skeleton className="h-40 w-full bg-white/10" />
        <Skeleton className="h-40 w-full bg-white/10" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-8 text-center text-white/40">
          No data available
        </CardContent>
      </Card>
    );
  }

  const { credits, generations, reconciliation } = data;
  const hasFailures = generations.failed > 0;
  const failureRateHigh = generations.failureRate > 20;

  return (
    <div className="space-y-3">
      {/* Date Range Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-3.5 h-3.5 text-white/40" />
        <span className="text-xs text-white/40">Date Range:</span>
        <div className="relative">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 [color-scheme:dark]"
          />
          {startDate && (
            <button onClick={() => setStartDate("")} className="absolute right-1 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-white/40 hover:text-white" />
            </button>
          )}
        </div>
        <span className="text-xs text-white/40">—</span>
        <div className="relative">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 [color-scheme:dark]"
          />
          {endDate && (
            <button onClick={() => setEndDate("")} className="absolute right-1 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-white/40 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Reconciliation Summary Banner */}
      <Card className={`border ${
        reconciliation.hasDiscrepancy
          ? "bg-red-500/10 border-red-500/30"
          : hasFailures
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-emerald-500/10 border-emerald-500/30"
      }`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            {reconciliation.hasDiscrepancy ? (
              <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            ) : hasFailures ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-white">
                {reconciliation.hasDiscrepancy ? "Discrepancy Detected" : hasFailures ? "Failed Generations Found" : "All Clear"}
              </p>
              <p className="text-xs text-white/60 mt-0.5">{reconciliation.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Credits Side */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-white/80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Credit Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Total Earned</span>
              <span className="text-emerald-400 font-mono">+{formatNumber(credits.totalEarned)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Total Spent</span>
              <span className="text-red-400 font-mono">-{formatNumber(credits.totalSpent)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-xs">
              <span className="text-white/50">Generation Deductions</span>
              <span className="text-white font-mono font-medium">{formatNumber(credits.generationDeductions)}</span>
            </div>
            {/* Credit type breakdown */}
            <div className="border-t border-white/10 pt-2 space-y-1">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">By Type</p>
              {Object.entries(credits.byType).map(([type, info]) => (
                <div key={type} className="flex justify-between text-[11px]">
                  <span className="text-white/50 capitalize">{type.replace(/_/g, " ")}</span>
                  <span className="text-white/70 font-mono">
                    {(info as any).totalAmount > 0 ? "+" : ""}{formatNumber((info as any).totalAmount)} ({(info as any).count})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Generations Side */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-white/80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Generation Records
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Total Generations</span>
              <span className="text-white font-mono">{formatNumber(generations.total)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Completed</span>
              <span className="text-emerald-400 font-mono">{formatNumber(generations.completed)}</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span className="text-white/50">Failed</span>
              <span className="flex items-center gap-1">
                <StatusIcon hasIssue={hasFailures} />
                <span className={`font-mono ${hasFailures ? "text-amber-400" : "text-white/70"}`}>
                  {formatNumber(generations.failed)}
                </span>
                {failureRateHigh && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                    {generations.failureRate}%
                  </Badge>
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Pending</span>
              <span className="text-white/70 font-mono">{formatNumber(generations.pending)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-xs">
              <span className="text-white/50">Total Credits Used</span>
              <span className="text-white font-mono font-medium">{formatNumber(generations.totalCreditsUsed)}</span>
            </div>
            {/* Generation type breakdown */}
            <div className="border-t border-white/10 pt-2 space-y-1">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">By Type</p>
              {generations.byType.map((entry) => (
                <div key={entry.type} className="flex justify-between text-[11px]">
                  <span className="text-white/50 capitalize">{entry.type.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="text-white/70 font-mono">
                    {formatNumber(entry.totalCost)} ({entry.totalCount})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Details */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-medium text-white/80 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Reconciliation Details
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-1.5 text-white/50">Credits deducted for generations</td>
                <td className="py-1.5 text-right font-mono text-white">{formatNumber(reconciliation.creditDeductedForGenerations)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-white/50">Generation records total cost</td>
                <td className="py-1.5 text-right font-mono text-white">{formatNumber(reconciliation.generationRecordedCost)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-white/50 font-medium">Discrepancy</td>
                <td className={`py-1.5 text-right font-mono font-medium ${
                  reconciliation.hasDiscrepancy ? "text-red-400" : "text-emerald-400"
                }`}>
                  {reconciliation.discrepancy > 0 ? "+" : ""}{formatNumber(reconciliation.discrepancy)}
                </td>
              </tr>
              {generations.creditsOnFailed > 0 && (
                <tr>
                  <td className="py-1.5 text-amber-400/80">Credits lost to failed generations</td>
                  <td className="py-1.5 text-right font-mono text-amber-400">{formatNumber(generations.creditsOnFailed)}</td>
                </tr>
              )}
              {generations.creditsOnCompleted > 0 && (
                <tr>
                  <td className="py-1.5 text-white/50">Credits on successful generations</td>
                  <td className="py-1.5 text-right font-mono text-emerald-400">{formatNumber(generations.creditsOnCompleted)}</td>
                </tr>
              )}
              {generations.creditsOnPending > 0 && (
                <tr>
                  <td className="py-1.5 text-white/50">Credits on pending generations</td>
                  <td className="py-1.5 text-right font-mono text-yellow-400">{formatNumber(generations.creditsOnPending)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

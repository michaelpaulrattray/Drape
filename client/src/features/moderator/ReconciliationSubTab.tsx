import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  X,
  ArrowRightLeft,
  Download,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReconciliationCsv } from "./reconciliation-csv";
import { useState } from "react";
import { toast } from "sonner";

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

export function ReconciliationSubTab({
  userId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: ReconciliationSubTabProps) {
  const [unfreezeNotes, setUnfreezeNotes] = useState("");
  const [showUnfreezeForm, setShowUnfreezeForm] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.moderatorReconciliation.getUserReconciliation.useQuery(
    { userId, startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: !!userId }
  );

  // Check if user is frozen
  const userQuery = trpc.moderator.getUserDetails.useQuery(
    { userId },
    { enabled: !!userId }
  );
  const isFrozen = !!userQuery.data?.user?.frozenAt;
  const frozenAt = userQuery.data?.user?.frozenAt;
  const frozenReason = userQuery.data?.user?.frozenReason;

  const unfreezeMutation = trpc.moderatorReconciliation.unfreezeAccount.useMutation({
    onSuccess: () => {
      toast.success("Account unfrozen successfully");
      setShowUnfreezeForm(false);
      setUnfreezeNotes("");
      utils.moderator.getUserDetails.invalidate({ userId });
      utils.moderatorReconciliation.getFlaggedUsers.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to unfreeze account");
    },
  });

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
      {/* Frozen Account Banner (moderator view) */}
      {isFrozen && (
        <Card className="border border-amber-500/40 bg-amber-950/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-300">Account Frozen</p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  Frozen {frozenAt ? new Date(frozenAt).toLocaleDateString() : ""}
                  {frozenReason ? ` — ${frozenReason}` : ""}
                </p>
                {!showUnfreezeForm ? (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
                      onClick={() => setShowUnfreezeForm(true)}
                    >
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Unfreeze Account
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={unfreezeNotes}
                      onChange={(e) => setUnfreezeNotes(e.target.value)}
                      placeholder="Review notes (required) — explain why the account is being unfrozen..."
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder:text-white/30 resize-none"
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={!unfreezeNotes.trim() || unfreezeMutation.isPending}
                        onClick={() => unfreezeMutation.mutate({ userId, notes: unfreezeNotes.trim() })}
                      >
                        {unfreezeMutation.isPending ? "Unfreezing..." : "Confirm Unfreeze"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-white/50 hover:text-white"
                        onClick={() => { setShowUnfreezeForm(false); setUnfreezeNotes(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Range Filter + Export */}
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
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => downloadReconciliationCsv(data, userId, startDate || undefined, endDate || undefined)}
          >
            <Download className="w-3 h-3" />
            Export CSV
          </Button>
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
                {reconciliation.hasDiscrepancy ? "Discrepancy Detected" : hasFailures ? "Failed Generations (Refunded)" : "All Clear"}
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
              <span className="text-white/50">Gross Generation Deductions</span>
              <span className="text-white font-mono">{formatNumber(credits.grossGenerationDeductions)}</span>
            </div>
            {credits.totalRefunds > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400/80">Refunds (failed gens)</span>
                <span className="text-emerald-400 font-mono">+{formatNumber(credits.totalRefunds)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-medium">
              <span className="text-white/70">Net Generation Cost</span>
              <span className="text-white font-mono">{formatNumber(credits.netGenerationCost)}</span>
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
              <span className="text-white/50">Failed (refunded)</span>
              <span className="flex items-center gap-1">
                {hasFailures ? (
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                )}
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
            <div className="border-t border-white/10 pt-2 flex justify-between text-xs font-medium">
              <span className="text-white/70">Completed Cost</span>
              <span className="text-white font-mono">{formatNumber(generations.creditsOnCompleted)}</span>
            </div>
            {generations.creditsOnPending > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Pending Cost</span>
                <span className="text-yellow-400 font-mono">{formatNumber(generations.creditsOnPending)}</span>
              </div>
            )}
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
                <td className="py-1.5 text-white/50">Gross generation deductions</td>
                <td className="py-1.5 text-right font-mono text-white">{formatNumber(reconciliation.grossGenerationDeductions)}</td>
              </tr>
              {reconciliation.totalRefunds > 0 && (
                <tr>
                  <td className="py-1.5 text-emerald-400/80">Refunds for failed generations</td>
                  <td className="py-1.5 text-right font-mono text-emerald-400">-{formatNumber(reconciliation.totalRefunds)}</td>
                </tr>
              )}
              <tr>
                <td className="py-1.5 text-white/70 font-medium">Net generation cost (credits)</td>
                <td className="py-1.5 text-right font-mono text-white font-medium">{formatNumber(reconciliation.netGenerationCost)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-white/50">Completed generation recorded cost</td>
                <td className="py-1.5 text-right font-mono text-white">{formatNumber(reconciliation.completedGenerationCost)}</td>
              </tr>
              {reconciliation.pendingGenerationCost > 0 && (
                <tr>
                  <td className="py-1.5 text-white/50">Pending generation cost</td>
                  <td className="py-1.5 text-right font-mono text-yellow-400">{formatNumber(reconciliation.pendingGenerationCost)}</td>
                </tr>
              )}
              <tr>
                <td className="py-1.5 text-white/50 font-medium">Discrepancy</td>
                <td className={`py-1.5 text-right font-mono font-medium ${
                  reconciliation.hasDiscrepancy ? "text-red-400" : "text-emerald-400"
                }`}>
                  {reconciliation.discrepancy > 0 ? "+" : ""}{formatNumber(reconciliation.discrepancy)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

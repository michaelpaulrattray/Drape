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
        <Skeleton className="h-8 w-full bg-[#E5E5E5]" />
        <Skeleton className="h-40 w-full bg-[#E5E5E5]" />
        <Skeleton className="h-40 w-full bg-[#E5E5E5]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E5E5] py-8 text-center text-[#999]">
        No data available
      </div>
    );
  }

  const { credits, generations, reconciliation } = data;
  const hasFailures = generations.failed > 0;
  const failureRateHigh = generations.failureRate > 20;

  return (
    <div className="space-y-3">
      {/* Frozen Account Banner */}
      {isFrozen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Account Frozen</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Frozen {frozenAt ? new Date(frozenAt).toLocaleDateString() : ""}
                {frozenReason ? ` — ${frozenReason}` : ""}
              </p>
              {!showUnfreezeForm ? (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
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
                    className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs text-[#0A0A0A] placeholder:text-[#CCC] resize-none"
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
                      className="h-7 text-xs text-[#999] hover:text-[#0A0A0A]"
                      onClick={() => { setShowUnfreezeForm(false); setUnfreezeNotes(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date Range Filter + Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-3.5 h-3.5 text-[#999]" />
        <span className="text-xs text-[#999]">Date Range:</span>
        <div className="relative">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-2 py-1 text-xs text-[#0A0A0A]"
          />
          {startDate && (
            <button onClick={() => setStartDate("")} className="absolute right-1 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-[#999] hover:text-[#0A0A0A]" />
            </button>
          )}
        </div>
        <span className="text-xs text-[#CCC]">—</span>
        <div className="relative">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-2 py-1 text-xs text-[#0A0A0A]"
          />
          {endDate && (
            <button onClick={() => setEndDate("")} className="absolute right-1 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-[#999] hover:text-[#0A0A0A]" />
            </button>
          )}
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-[#E5E5E5] text-[#666] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"
            onClick={() => downloadReconciliationCsv(data, userId, startDate || undefined, endDate || undefined)}
          >
            <Download className="w-3 h-3" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Reconciliation Summary Banner */}
      <div className={`rounded-xl border p-4 ${
        reconciliation.hasDiscrepancy
          ? "bg-red-50 border-red-200"
          : hasFailures
            ? "bg-amber-50 border-amber-200"
            : "bg-emerald-50 border-emerald-200"
      }`}>
        <div className="flex items-start gap-3">
          {reconciliation.hasDiscrepancy ? (
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          ) : hasFailures ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              reconciliation.hasDiscrepancy ? "text-red-800" : hasFailures ? "text-amber-800" : "text-emerald-800"
            }`}>
              {reconciliation.hasDiscrepancy ? "Discrepancy Detected" : hasFailures ? "Failed Generations (Refunded)" : "All Clear"}
            </p>
            <p className={`text-xs mt-0.5 ${
              reconciliation.hasDiscrepancy ? "text-red-700" : hasFailures ? "text-amber-700" : "text-emerald-700"
            }`}>{reconciliation.summary}</p>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Credits Side */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <h4 className="text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Credit Transactions
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#999]">Total Earned</span>
              <span className="text-emerald-700 font-mono">+{formatNumber(credits.totalEarned)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#999]">Total Spent</span>
              <span className="text-red-700 font-mono">-{formatNumber(credits.totalSpent)}</span>
            </div>
            <div className="border-t border-[#E5E5E5] pt-2 flex justify-between text-xs">
              <span className="text-[#999]">Gross Generation Deductions</span>
              <span className="text-[#0A0A0A] font-mono">{formatNumber(credits.grossGenerationDeductions)}</span>
            </div>
            {credits.totalRefunds > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600">Refunds (failed gens)</span>
                <span className="text-emerald-700 font-mono">+{formatNumber(credits.totalRefunds)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-medium">
              <span className="text-[#666]">Net Generation Cost</span>
              <span className="text-[#0A0A0A] font-mono">{formatNumber(credits.netGenerationCost)}</span>
            </div>
            {/* Credit type breakdown */}
            <div className="border-t border-[#E5E5E5] pt-2 space-y-1">
              <p className="text-[10px] text-[#999] uppercase tracking-wider">By Type</p>
              {Object.entries(credits.byType).map(([type, info]) => (
                <div key={type} className="flex justify-between text-[11px]">
                  <span className="text-[#999] capitalize">{type.replace(/_/g, " ")}</span>
                  <span className="text-[#666] font-mono">
                    {(info as any).totalAmount > 0 ? "+" : ""}{formatNumber((info as any).totalAmount)} ({(info as any).count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Generations Side */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <h4 className="text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Generation Records
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#999]">Total Generations</span>
              <span className="text-[#0A0A0A] font-mono">{formatNumber(generations.total)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#999]">Completed</span>
              <span className="text-emerald-700 font-mono">{formatNumber(generations.completed)}</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span className="text-[#999]">Failed (refunded)</span>
              <span className="flex items-center gap-1">
                {hasFailures ? (
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                )}
                <span className={`font-mono ${hasFailures ? "text-amber-700" : "text-[#666]"}`}>
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
              <span className="text-[#999]">Pending</span>
              <span className="text-[#666] font-mono">{formatNumber(generations.pending)}</span>
            </div>
            <div className="border-t border-[#E5E5E5] pt-2 flex justify-between text-xs font-medium">
              <span className="text-[#666]">Completed Cost</span>
              <span className="text-[#0A0A0A] font-mono">{formatNumber(generations.creditsOnCompleted)}</span>
            </div>
            {generations.creditsOnPending > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#999]">Pending Cost</span>
                <span className="text-amber-700 font-mono">{formatNumber(generations.creditsOnPending)}</span>
              </div>
            )}
            {/* Generation type breakdown */}
            <div className="border-t border-[#E5E5E5] pt-2 space-y-1">
              <p className="text-[10px] text-[#999] uppercase tracking-wider">By Type</p>
              {generations.byType.map((entry) => (
                <div key={entry.type} className="flex justify-between text-[11px]">
                  <span className="text-[#999] capitalize">{entry.type.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="text-[#666] font-mono">
                    {formatNumber(entry.totalCost)} ({entry.totalCount})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Details */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
        <h4 className="text-xs font-medium text-[#0A0A0A] flex items-center gap-1.5 mb-3">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Reconciliation Details
        </h4>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-[#F0F0F0]">
            <tr>
              <td className="py-1.5 text-[#999]">Gross generation deductions</td>
              <td className="py-1.5 text-right font-mono text-[#0A0A0A]">{formatNumber(reconciliation.grossGenerationDeductions)}</td>
            </tr>
            {reconciliation.totalRefunds > 0 && (
              <tr>
                <td className="py-1.5 text-emerald-600">Refunds for failed generations</td>
                <td className="py-1.5 text-right font-mono text-emerald-700">-{formatNumber(reconciliation.totalRefunds)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1.5 text-[#666] font-medium">Net generation cost (credits)</td>
              <td className="py-1.5 text-right font-mono text-[#0A0A0A] font-medium">{formatNumber(reconciliation.netGenerationCost)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-[#999]">Completed generation recorded cost</td>
              <td className="py-1.5 text-right font-mono text-[#0A0A0A]">{formatNumber(reconciliation.completedGenerationCost)}</td>
            </tr>
            {reconciliation.pendingGenerationCost > 0 && (
              <tr>
                <td className="py-1.5 text-[#999]">Pending generation cost</td>
                <td className="py-1.5 text-right font-mono text-amber-700">{formatNumber(reconciliation.pendingGenerationCost)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1.5 text-[#666] font-medium">Discrepancy</td>
              <td className={`py-1.5 text-right font-mono font-medium ${
                reconciliation.hasDiscrepancy ? "text-red-700" : "text-emerald-700"
              }`}>
                {reconciliation.discrepancy > 0 ? "+" : ""}{formatNumber(reconciliation.discrepancy)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

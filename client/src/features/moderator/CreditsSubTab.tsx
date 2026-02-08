/**
 * Credits sub-tab within User Investigation — shows credit history, summary, and refund actions.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Coins,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Calendar,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";

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

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-600" />
          <h4 className="text-sm font-semibold text-[#0A0A0A]">Credit History</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportQuery.isFetching || creditHistoryQuery.isLoading}
          className="border-[#E5E5E5] text-[#666] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] h-7 text-xs"
        >
          {exportQuery.isFetching ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          CSV
        </Button>
      </div>

      {/* Credit Summary */}
      {creditHistoryQuery.data?.summary && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-[10px] text-emerald-600">Added</p>
            <p className="text-sm font-bold text-emerald-700">+{creditHistoryQuery.data.summary.totalCreditsEarned}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-center">
            <p className="text-[10px] text-red-600">Used</p>
            <p className="text-sm font-bold text-red-700">-{creditHistoryQuery.data.summary.totalCreditsSpent}</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-center">
            <p className="text-[10px] text-blue-600">Balance</p>
            <p className="text-sm font-bold text-blue-700">{userDetailsQuery.data?.credits?.balance?.toLocaleString() ?? creditHistoryQuery.data.summary.netChange}</p>
          </div>
        </div>
      )}

      {/* Credit Type Filter */}
      <Select value={creditTypeFilter} onValueChange={(v) => { setCreditTypeFilter(v); setCreditPage(() => 0); }}>
        <SelectTrigger className="w-full bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] text-xs h-8">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="generation">Generations</SelectItem>
          <SelectItem value="purchase">Purchases</SelectItem>
          <SelectItem value="topup">Top-ups</SelectItem>
          <SelectItem value="subscription">Subscription</SelectItem>
          <SelectItem value="signup">Signup</SelectItem>
          <SelectItem value="refund">Refunds</SelectItem>
          <SelectItem value="bonus">Bonuses</SelectItem>
          <SelectItem value="admin_add">Admin Add</SelectItem>
          <SelectItem value="admin_deduct">Admin Deduct</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range Filter */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999] pointer-events-none" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCreditPage(() => 0); }}
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5] text-[#0A0A0A] text-xs"
            placeholder="From"
          />
        </div>
        <span className="text-[#CCC] text-xs">–</span>
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999] pointer-events-none" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCreditPage(() => 0); }}
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5] text-[#0A0A0A] text-xs"
            placeholder="To"
          />
        </div>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStartDate(""); setEndDate(""); setCreditPage(() => 0); }}
            className="h-8 w-8 p-0 text-[#999] hover:text-[#0A0A0A]"
            title="Clear dates"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Credit Transaction List */}
      {creditHistoryQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-[#E5E5E5]" />
          ))}
        </div>
      ) : creditHistoryQuery.data?.transactions.length === 0 ? (
        <p className="text-[#999] text-sm text-center py-4">No credit transactions found</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {creditHistoryQuery.data?.transactions.map((tx: any) => (
            <div key={tx.id} className="p-2.5 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tx.amount > 0 ? (
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${tx.amount > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
                <Badge className={
                  tx.type === "purchase" ? "bg-blue-50 text-blue-700" :
                  tx.type === "usage" ? "bg-orange-50 text-orange-700" :
                  tx.type === "admin_adjustment" ? "bg-purple-50 text-purple-700" :
                  tx.type === "refund" ? "bg-emerald-50 text-emerald-700" :
                  tx.type === "bonus" ? "bg-yellow-50 text-yellow-700" :
                  "bg-gray-100 text-gray-600"
                }>
                  {tx.type.replace("_", " ")}
                </Badge>
              </div>
              {tx.description && (
                <p className="text-xs text-[#999] mt-1 truncate">{tx.description}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-[#CCC]">{formatDate(new Date(tx.createdAt))}</span>
                <div className="flex items-center gap-2">
                  {tx.type === "topup" && tx.referenceId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                      onClick={() => {
                        const amountCents = Math.round(tx.amount * 0.00072);
                        onOpenChangeRequest({
                          type: "stripe_refund",
                          targetUserId: String(selectedUserId),
                          targetUserName: userDetailsQuery.data?.user?.name || "",
                          stripeSessionId: tx.referenceId!,
                          originalAmountCents: amountCents,
                          originalCredits: tx.amount,
                        });
                      }}
                    >
                      <CreditCard className="w-3 h-3 mr-0.5" />
                      Refund
                    </Button>
                  )}
                  <span className="text-[10px] text-[#CCC]">Balance: {tx.balanceAfter}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credit Pagination */}
      {(creditHistoryQuery.data?.total || 0) > 20 && (
        <div className="flex items-center justify-between pt-3 border-t border-[#E5E5E5]">
          <span className="text-xs text-[#999]">
            Page {creditPage + 1} of {Math.ceil((creditHistoryQuery.data?.total || 0) / 20)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreditPage(p => Math.max(0, p - 1))}
              disabled={creditPage === 0}
              className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreditPage(p => p + 1)}
              disabled={(creditPage + 1) * 20 >= (creditHistoryQuery.data?.total || 0)}
              className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

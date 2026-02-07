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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [isExporting, setIsExporting] = useState(false);

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
    setIsExporting(true);
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
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
          <Coins className="w-4 h-4 text-emerald-400" />
          Credit History
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || creditHistoryQuery.isLoading}
            className="ml-auto border-white/20 text-white/60 hover:text-white hover:bg-white/10 h-7 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            {isExporting ? "Exporting..." : "CSV"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Credit Summary */}
        {creditHistoryQuery.data?.summary && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-xs text-emerald-400/60">Added</p>
              <p className="text-sm font-bold text-emerald-400">+{creditHistoryQuery.data.summary.totalCreditsEarned}</p>
            </div>
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-xs text-red-400/60">Used</p>
              <p className="text-sm font-bold text-red-400">-{creditHistoryQuery.data.summary.totalCreditsSpent}</p>
            </div>
            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-xs text-blue-400/60">Balance</p>
              <p className="text-sm font-bold text-blue-400">{userDetailsQuery.data?.credits?.balance?.toLocaleString() ?? creditHistoryQuery.data.summary.netChange}</p>
            </div>
          </div>
        )}

        {/* Credit Type Filter */}
        <div className="flex gap-2 mb-2">
          <Select value={creditTypeFilter} onValueChange={(v) => { setCreditTypeFilter(v); setCreditPage(() => 0); }}>
            <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs h-8">
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
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-2 mb-3 items-center">
          <div className="relative flex-1">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCreditPage(() => 0); }}
              className="w-full h-8 pl-7 pr-2 rounded-md bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
              placeholder="From"
            />
          </div>
          <span className="text-white/30 text-xs">–</span>
          <div className="relative flex-1">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCreditPage(() => 0); }}
              className="w-full h-8 pl-7 pr-2 rounded-md bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
              placeholder="To"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStartDate(""); setEndDate(""); setCreditPage(() => 0); }}
              className="h-8 w-8 p-0 text-white/40 hover:text-white"
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
              <Skeleton key={i} className="h-12 w-full bg-white/10" />
            ))}
          </div>
        ) : creditHistoryQuery.data?.transactions.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-4">No credit transactions found</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {creditHistoryQuery.data?.transactions.map((tx: any) => (
              <div key={tx.id} className="p-2.5 rounded bg-white/5 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tx.amount > 0 ? (
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                  <Badge className={
                    tx.type === "purchase" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    tx.type === "usage" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                    tx.type === "admin_adjustment" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                    tx.type === "refund" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    tx.type === "bonus" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                    "bg-gray-500/10 text-gray-400 border-gray-500/20"
                  }>
                    {tx.type.replace("_", " ")}
                  </Badge>
                </div>
                {tx.description && (
                  <p className="text-xs text-white/50 mt-1 truncate">{tx.description}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-white/30">{formatDate(new Date(tx.createdAt))}</span>
                  <div className="flex items-center gap-2">
                    {tx.type === "topup" && tx.referenceId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        onClick={() => {
                          // Estimate refund amount based on subscription credit value
                          const amountCents = Math.round(tx.amount * 0.00072); // ~$0.0000072/credit at starter rate (50x multiplier)
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
                    <span className="text-xs text-white/30">Balance: {tx.balanceAfter}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Credit Pagination */}
        {(creditHistoryQuery.data?.total || 0) > 20 && (
          <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
            <span className="text-xs text-white/40">
              Page {creditPage + 1} of {Math.ceil((creditHistoryQuery.data?.total || 0) / 20)}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreditPage(p => Math.max(0, p - 1))}
                disabled={creditPage === 0}
                className="border-white/20 text-white h-7 w-7 p-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreditPage(p => p + 1)}
                disabled={(creditPage + 1) * 20 >= (creditHistoryQuery.data?.total || 0)}
                className="border-white/20 text-white h-7 w-7 p-0"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

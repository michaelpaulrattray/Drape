import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  Activity,
} from "lucide-react";

export function UsageTab() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [historyPage, setHistoryPage] = useState(0);
  const pageSize = 10;

  // Fetch usage stats
  const { data: stats, isLoading: isLoadingStats } = trpc.usage.getStats.useQuery({ days: period });

  // Fetch daily usage for chart
  const { data: dailyUsage, isLoading: isLoadingDaily } = trpc.usage.getDailyUsage.useQuery({ days: period });

  // Fetch transaction history
  const { data: historyData, isLoading: isLoadingHistory } = trpc.usage.getHistory.useQuery({
    limit: pageSize,
    offset: historyPage * pageSize,
  });

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFullDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "generation": return "Generation";
      case "purchase": return "Purchase";
      case "bonus": return "Bonus";
      case "refund": return "Refund";
      case "signup": return "Welcome Bonus";
      case "topup": return "Credit Top-up";
      case "subscription": return "Subscription";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "generation": return "text-gray-700";
      case "purchase": return "text-green-600";
      case "bonus": return "text-blue-600";
      case "refund": return "text-amber-600";
      case "signup": return "text-purple-600";
      case "topup": return "text-green-600";
      case "subscription": return "text-cyan-600";
      default: return "text-gray-500";
    }
  };

  // Calculate max for chart scaling
  const maxCredits = dailyUsage ? Math.max(...dailyUsage.map(d => d.creditsUsed), 1) : 1;

  const totalPages = historyData ? Math.ceil(historyData.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#0A0A0A] tracking-tight">Usage Analytics</h3>
        <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-full">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                period === days
                  ? "bg-[#0A0A0A] text-white shadow-sm"
                  : "text-[#757575] hover:text-[#0A0A0A]"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards — horizontal row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Activity, label: "Credits Used", value: stats?.totalCreditsUsed, color: "text-[#0A0A0A]" },
          { icon: Sparkles, label: "Generations", value: stats?.totalGenerations, color: "text-[#0A0A0A]" },
          { icon: TrendingUp, label: "Daily Avg", value: stats?.averagePerDay, color: "text-[#0A0A0A]" },
        ].map((card, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-3">
              <card.icon className="w-3.5 h-3.5 text-[#757575]" />
              <span className="text-[11px] font-medium text-[#757575] uppercase tracking-wider">{card.label}</span>
            </div>
            {isLoadingStats ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            ) : (
              <p className={`text-2xl font-semibold ${card.color} tracking-tight`}>
                {(card.value ?? 0).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Usage Chart */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-2">Daily Usage</label>
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
          {isLoadingDaily ? (
            <div className="flex items-center justify-center h-36">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : dailyUsage && dailyUsage.length > 0 ? (
            <div>
              {/* Bar chart */}
              <div className="flex items-end gap-[2px] h-36">
                {dailyUsage.map((day, idx) => {
                  const height = maxCredits > 0 ? (day.creditsUsed / maxCredits) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className="w-full bg-[#0A0A0A]/20 rounded-sm transition-all duration-200 hover:bg-[#0A0A0A]/50"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-[#0A0A0A] text-white rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                          <p className="font-medium">{day.creditsUsed} credits</p>
                          <p className="text-white/60 text-[10px] mt-0.5">{formatDate(day.date)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between mt-3 text-[11px] text-[#757575]">
                <span>{formatDate(dailyUsage[0]?.date || new Date())}</span>
                <span>{formatDate(dailyUsage[dailyUsage.length - 1]?.date || new Date())}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-36 text-[#757575] text-sm">
              No usage data yet
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-2">Transaction History</label>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : historyData && historyData.transactions.length > 0 ? (
          <>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {historyData.transactions.map((tx, idx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors ${
                    idx < historyData.transactions.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      tx.amount > 0 ? "bg-green-50" : "bg-gray-100"
                    }`}>
                      {tx.amount > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-[#757575]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#0A0A0A]">{getTypeLabel(tx.type)}</span>
                      </div>
                      <p className="text-xs text-[#757575] truncate max-w-[200px]" title={tx.description || undefined}>
                        {tx.description || formatFullDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-sm font-semibold ${
                      tx.amount > 0 ? "text-green-600" : "text-[#0A0A0A]"
                    }`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </p>
                    <p className="text-[11px] text-[#757575]">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-[#757575]">
                  {historyPage * pageSize + 1}–{Math.min((historyPage + 1) * pageSize, historyData.total)} of {historyData.total}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    disabled={historyPage === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-[#4D4D4D] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={historyPage >= totalPages - 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-[#4D4D4D] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-[#757575] text-sm">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}

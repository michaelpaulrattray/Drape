/**
 * CreditEconomyCard — credit economy stats + daily credit flow area chart.
 */
import { Coins, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface CreditEconomyData {
  creditsConsumed24h: number;
  creditsPurchased7d: number;
  creditsRefunded7d: number;
  totalCreditsInCirculation: number;
  generationsByType24h: Array<{ type: string; count: number; totalCost: number }>;
}

export interface DailyCreditFlow {
  date: string;
  consumed: number;
  purchased: number;
  refunded: number;
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const TT_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #E5E5E5",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const TYPE_LABELS: Record<string, string> = {
  masterPrompt: "Master Prompt",
  castingImage: "Casting",
  fullBody: "Full Body",
  multiView: "Multi-View",
  iteration: "Iteration",
  upscale: "Upscale",
};

export function CreditEconomyCard({
  data,
  chartData,
}: {
  data: CreditEconomyData;
  chartData?: DailyCreditFlow[];
}) {
  const sortedTypes = [...data.generationsByType24h].sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">Credit Economy</h3>
        <Coins className="w-4 h-4 text-[#bbb]" />
      </div>

      {/* Circulation badge */}
      <div className="bg-[#FAFAFA] rounded-lg p-3">
        <p className="text-[11px] text-[#999] uppercase tracking-wider">In Circulation</p>
        <p className="text-2xl font-bold tabular-nums text-[#0A0A0A] mt-0.5">
          {formatNumber(data.totalCreditsInCirculation)}
        </p>
      </div>

      {/* Flow stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <ArrowDownCircle className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums text-[#0A0A0A]">
            {formatNumber(data.creditsConsumed24h)}
          </p>
          <p className="text-[10px] text-[#999]">Consumed 24h</p>
        </div>
        <div className="text-center">
          <ArrowUpCircle className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums text-[#0A0A0A]">
            {formatNumber(data.creditsPurchased7d)}
          </p>
          <p className="text-[10px] text-[#999]">Purchased 7d</p>
        </div>
        <div className="text-center">
          <RotateCcw className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums text-[#0A0A0A]">
            {formatNumber(data.creditsRefunded7d)}
          </p>
          <p className="text-[10px] text-[#999]">Refunded 7d</p>
        </div>
      </div>

      {/* Credit flow area chart */}
      {chartData && chartData.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-[#999] uppercase tracking-wider">
              Daily Credit Flow — 14 days
            </p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Purchased
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Consumed
              </span>
            </div>
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPurchased" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConsumed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 9, fill: "#999" }}
                  axisLine={{ stroke: "#e5e5e5" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#999" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatNumber(v)}
                />
                <Tooltip
                  contentStyle={TT_STYLE}
                  labelFormatter={formatDateLabel}
                  formatter={(value: number) => [value.toLocaleString(), undefined]}
                />
                <Area
                  type="monotone"
                  dataKey="purchased"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradPurchased)"
                  name="Purchased"
                />
                <Area
                  type="monotone"
                  dataKey="consumed"
                  stroke="#f87171"
                  strokeWidth={2}
                  fill="url(#gradConsumed)"
                  name="Consumed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Generation type breakdown */}
      {sortedTypes.length > 0 && (
        <div>
          <p className="text-[11px] text-[#999] uppercase tracking-wider mb-2">
            Cost by Type (24h)
          </p>
          <div className="space-y-1.5">
            {sortedTypes.map((t) => {
              const maxCost = sortedTypes[0]?.totalCost || 1;
              return (
                <div key={t.type} className="flex items-center gap-2">
                  <span className="text-[11px] text-[#666] w-24 truncate">
                    {TYPE_LABELS[t.type] || t.type}
                  </span>
                  <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0A0A0A]/30 rounded-full transition-all duration-500"
                      style={{ width: `${(t.totalCost / maxCost) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-[#999] w-16 text-right">
                    {t.totalCost} cr · {t.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {sortedTypes.length === 0 && (
        <p className="text-[11px] text-[#999] italic">No generations in the last 24h</p>
      )}
    </div>
  );
}

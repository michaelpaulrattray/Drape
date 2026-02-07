/**
 * UserGrowthCard — user growth stats + daily signup bar chart.
 */
import { Users, UserPlus, ShieldOff, Ban } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface UserGrowthData {
  totalUsers: number;
  newSignups7d: number;
  newSignups24h: number;
  frozenAccounts: number;
  suspendedAccounts: number;
  planDistribution: Array<{ plan: string; count: number }>;
}

export interface DailySignupStats {
  date: string;
  signups: number;
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TT_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #E5E5E5",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const PLAN_COLORS: Record<string, string> = {
  free: "#999",
  starter: "#3b82f6",
  pro: "#8b5cf6",
  enterprise: "#0A0A0A",
};

export function UserGrowthCard({
  data,
  chartData,
}: {
  data: UserGrowthData;
  chartData?: DailySignupStats[];
}) {
  const totalPlanUsers = data.planDistribution.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">User Growth</h3>
        <Users className="w-4 h-4 text-[#bbb]" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#FAFAFA] rounded-lg p-3">
          <p className="text-[11px] text-[#999] uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold tabular-nums text-[#0A0A0A] mt-0.5">
            {data.totalUsers.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#FAFAFA] rounded-lg p-3">
          <p className="text-[11px] text-[#999] uppercase tracking-wider flex items-center gap-1">
            <UserPlus className="w-3 h-3" /> New (7d)
          </p>
          <p className="text-2xl font-bold tabular-nums text-[#0A0A0A] mt-0.5">
            {data.newSignups7d}
          </p>
          <p className="text-[10px] text-[#999]">{data.newSignups24h} today</p>
        </div>
      </div>

      {/* Account status */}
      <div className="flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5 text-blue-600">
          <ShieldOff className="w-3.5 h-3.5" />
          {data.frozenAccounts} frozen
        </span>
        <span className="flex items-center gap-1.5 text-red-600">
          <Ban className="w-3.5 h-3.5" />
          {data.suspendedAccounts} suspended
        </span>
      </div>

      {/* Plan distribution bar */}
      {totalPlanUsers > 0 && (
        <div>
          <p className="text-[11px] text-[#999] uppercase tracking-wider mb-2">
            Plan Distribution
          </p>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-[#f0f0f0]">
            {data.planDistribution.map((p) => (
              <div
                key={p.plan}
                className="h-full transition-all duration-500"
                style={{
                  width: `${(p.count / totalPlanUsers) * 100}%`,
                  backgroundColor: PLAN_COLORS[p.plan] || "#ccc",
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {data.planDistribution.map((p) => (
              <span key={p.plan} className="flex items-center gap-1.5 text-[11px] text-[#666]">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PLAN_COLORS[p.plan] || "#ccc" }}
                />
                {p.plan} ({p.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Daily signups bar chart */}
      {chartData && chartData.length > 0 && (
        <div>
          <p className="text-[11px] text-[#999] uppercase tracking-wider mb-2">
            Daily Signups — 14 days
          </p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
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
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TT_STYLE} labelFormatter={formatDateLabel} />
                <Bar
                  dataKey="signups"
                  fill="#0A0A0A"
                  radius={[3, 3, 0, 0]}
                  name="Signups"
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

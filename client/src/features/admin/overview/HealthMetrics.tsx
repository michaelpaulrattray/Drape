/**
 * HealthMetrics — real-time platform health KPIs + generation trend chart.
 */
import {
  Activity,
  Users,
  AlertTriangle,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface HealthData {
  total24h: number;
  completed24h: number;
  failed24h: number;
  pending: number;
  processing: number;
  successRate: number;
  activeUsers24h: number;
}

export interface DailyGenerationStats {
  date: string;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
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

export function HealthMetrics({
  data,
  chartData,
}: {
  data: HealthData;
  chartData?: DailyGenerationStats[];
}) {
  const isHealthy = data.successRate >= 95;
  const isWarning = data.successRate >= 80 && data.successRate < 95;
  const isCritical = data.successRate < 80;

  const statusColor = isHealthy
    ? "text-emerald-600"
    : isWarning
    ? "text-amber-600"
    : "text-red-600";
  const statusDot = isHealthy
    ? "bg-emerald-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Rate */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wider">
              Success Rate
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${statusDot} animate-pulse`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums ${statusColor}`}>
              {data.successRate}%
            </span>
            <span className="text-xs text-[#999]">24h</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#999]">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {data.completed24h}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" />
              {data.failed24h}
            </span>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wider">
              Active Users
            </span>
            <Users className="w-4 h-4 text-[#bbb]" />
          </div>
          <span className="text-3xl font-bold tabular-nums text-[#0A0A0A]">
            {data.activeUsers24h}
          </span>
          <p className="text-[11px] text-[#999] mt-2">Signed in within 24h</p>
        </div>

        {/* Generations */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wider">
              Generations
            </span>
            <Activity className="w-4 h-4 text-[#bbb]" />
          </div>
          <span className="text-3xl font-bold tabular-nums text-[#0A0A0A]">
            {data.total24h}
          </span>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#999]">
            {data.processing > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                {data.processing} processing
              </span>
            )}
            {data.pending > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                {data.pending} queued
              </span>
            )}
            {data.processing === 0 && data.pending === 0 && <span>All clear</span>}
          </div>
        </div>

        {/* Failures */}
        <div className={`rounded-xl border p-5 ${
          isCritical
            ? "bg-red-50 border-red-200"
            : data.failed24h > 0
            ? "bg-amber-50/50 border-amber-200"
            : "bg-white border-[#E5E5E5]"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#999] uppercase tracking-wider">
              Failures
            </span>
            <AlertTriangle className={`w-4 h-4 ${
              isCritical ? "text-red-500" : data.failed24h > 0 ? "text-amber-500" : "text-[#bbb]"
            }`} />
          </div>
          <span className={`text-3xl font-bold tabular-nums ${
            isCritical ? "text-red-600" : data.failed24h > 0 ? "text-amber-600" : "text-[#0A0A0A]"
          }`}>
            {data.failed24h}
          </span>
          <p className="text-[11px] text-[#999] mt-2">
            {isCritical
              ? "Investigate immediately"
              : data.failed24h > 0
              ? "Some failures detected"
              : "No failures in 24h"}
          </p>
        </div>
      </div>

      {/* Generation trend area chart */}
      {chartData && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A]">
                Generation Activity
              </h3>
              <p className="text-[11px] text-[#999] mt-0.5">
                Completed vs failed — last 14 days
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Completed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                Failed
              </span>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 10, fill: "#999" }}
                  axisLine={{ stroke: "#e5e5e5" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#999" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={TT_STYLE} labelFormatter={formatDateLabel} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradCompleted)"
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="#f87171"
                  strokeWidth={2}
                  fill="url(#gradFailed)"
                  name="Failed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

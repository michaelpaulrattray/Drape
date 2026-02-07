/**
 * GovernanceCard — change request metrics + status donut chart.
 */
import { ClipboardList, AlertCircle, Link2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export interface GovernanceData {
  pendingChangeRequests: number;
  urgentChangeRequests: number;
  changeRequestsThisWeek: number;
  activeReferrals: number;
}

export interface ChangeRequestDistribution {
  status: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
  completed: "#3b82f6",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

const TT_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #E5E5E5",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export function GovernanceCard({
  data,
  chartData,
}: {
  data: GovernanceData;
  chartData?: ChangeRequestDistribution[];
}) {
  const hasChartData = chartData && chartData.length > 0;
  const totalRequests = chartData?.reduce((sum, d) => sum + d.count, 0) || 0;

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">Governance</h3>
        <ClipboardList className="w-4 h-4 text-[#bbb]" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#FAFAFA] rounded-lg p-3">
          <p className="text-[11px] text-[#999] uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold tabular-nums text-[#0A0A0A] mt-0.5">
            {data.pendingChangeRequests}
          </p>
          {data.urgentChangeRequests > 0 && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {data.urgentChangeRequests} urgent
            </p>
          )}
        </div>
        <div className="bg-[#FAFAFA] rounded-lg p-3">
          <p className="text-[11px] text-[#999] uppercase tracking-wider">This Week</p>
          <p className="text-2xl font-bold tabular-nums text-[#0A0A0A] mt-0.5">
            {data.changeRequestsThisWeek}
          </p>
          <p className="text-[10px] text-[#999] flex items-center gap-1 mt-1">
            <Link2 className="w-3 h-3" />
            {data.activeReferrals} active referrals
          </p>
        </div>
      </div>

      {/* Donut chart */}
      {hasChartData && totalRequests > 0 && (
        <div>
          <p className="text-[11px] text-[#999] uppercase tracking-wider mb-2">
            Request Status
          </p>
          <div className="flex items-center gap-4">
            <div className="w-[120px] h-[120px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    strokeWidth={0}
                  >
                    {chartData!.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || "#ccc"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold tabular-nums text-[#0A0A0A]">
                  {totalRequests}
                </span>
                <span className="text-[9px] text-[#999]">total</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {chartData!.map((entry) => (
                <div key={entry.status} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[entry.status] || "#ccc" }}
                  />
                  <span className="text-[11px] text-[#666] flex-1">
                    {STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <span className="text-[11px] tabular-nums font-medium text-[#0A0A0A]">
                    {entry.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(!hasChartData || totalRequests === 0) && (
        <p className="text-[11px] text-[#999] italic">No change requests yet</p>
      )}
    </div>
  );
}

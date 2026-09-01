import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "@/foundation";
import { tooltipStyle, useChartTokens } from "./chartTokens";

/**
 * Governance — change requests (brief 07 §7's "same treatment" clause).
 *
 * ## `STATUS_COLORS` was four hues for four statuses
 *
 * pending amber, approved emerald, rejected red, completed blue. §3 kills the
 * hue-per-category and it also says what survives: *"Severity — critical vs
 * warning — is the only thing that may carry colour."*
 *
 * **Pending is the one segment that is a state somebody must act on**, so it —
 * and only it — takes the accent. The other three are outcomes: things that
 * already happened and need nobody. They walk a greyscale value ramp.
 *
 * That is the whole rule in one chart: the eye lands on the slice that wants a
 * person, and a donut of finished work is quiet.
 */

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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

/** The greyscale ramp the non-pending statuses walk, in a fixed order so the
 *  donut does not repaint itself when a count changes rank. */
const RESOLVED_ORDER = ["approved", "completed", "rejected"];

export function GovernanceCard({
  data,
  chartData,
}: {
  data: GovernanceData;
  chartData?: ChangeRequestDistribution[];
}) {
  const t = useChartTokens();
  const hasChartData = chartData && chartData.length > 0;
  const totalRequests = chartData?.reduce((sum, d) => sum + d.count, 0) || 0;
  const ramp = [t.metaStrong, t.faint, t.dots];

  /** Pending is accent; everything else is a fixed step on the grey ramp. */
  const fillFor = (status: string): string => {
    if (status === "pending") return t.accent;
    const i = RESOLVED_ORDER.indexOf(status);
    return ramp[i === -1 ? ramp.length - 1 : i];
  };

  return (
    <div className="dp-ov__card">
      <div className="dp-ov__cardhead">
        <div>
          <h3 className="dp-ov__cardtitle">Governance</h3>
        </div>
      </div>

      <div className="dp-countrow">
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">PENDING</span>
          <span
            className={`dp-counttile__value${
              data.pendingChangeRequests > 0 ? " dp-counttile__value--alert" : ""
            }`}
          >
            {data.pendingChangeRequests}
          </span>
          {data.urgentChangeRequests > 0 && (
            <span className="dp-ov__tilefoot">
              {data.urgentChangeRequests} urgent
            </span>
          )}
        </div>
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">THIS WEEK</span>
          <span className="dp-counttile__value">{data.changeRequestsThisWeek}</span>
          <span className="dp-ov__tilefoot">
            {data.activeReferrals} active referrals
          </span>
        </div>
      </div>

      {hasChartData && totalRequests > 0 ? (
        <div className="dp-ov__block">
          <span className="dp-ov__blocklabel">REQUEST STATUS</span>
          <div className="dp-ov__donutrow">
            <div className="dp-ov__donut">
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
                      <Cell key={entry.status} fill={fillFor(entry.status)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle(t)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="dp-ov__donutcentre">
                <span className="dp-ov__donuttotal">{totalRequests}</span>
                <span className="dp-ov__donutcaption">total</span>
              </div>
            </div>
            <div className="dp-ov__keycol">
              {chartData!.map((entry) => (
                <div key={entry.status} className="dp-ov__leader">
                  <span
                    className="dp-ov__swatch"
                    style={{ background: fillFor(entry.status) }}
                  />
                  <span className="dp-ov__leaderlabel">
                    {STATUS_LABELS[entry.status] || entry.status}
                  </span>
                  <span className="dp-ov__spacer" />
                  <span className="dp-ov__leadervalue">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No change requests"
          body="Requests raised by staff appear here with their status."
        />
      )}
    </div>
  );
}

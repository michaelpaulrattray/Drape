import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { axisTick, tooltipStyle, useChartTokens } from "./chartTokens";

/**
 * User growth (brief 07 §7's "same treatment" clause).
 *
 * ## `PLAN_COLORS` was a category ramp and it is gone
 *
 * Free / starter / pro / enterprise were grey / blue / purple / black — four
 * hues encoding a category, which §3 forbids for the reason it gives: it
 * leaves nothing to say *urgent*. A plan is not a severity and never becomes
 * one, so the distribution bar is a **value ramp** now — four steps of the same
 * greyscale, darkest first, with the legend naming each. Value distinguishes;
 * hue means state. Nothing else on this page can then be mistaken for it.
 *
 * ## Frozen and suspended are counts, not alarms
 *
 * They were `text-blue-600` and `text-red-600`. A suspended account is a state
 * an admin *put* an account in deliberately — it is the system working, not a
 * fault — so both read greyscale. The alerts feed is where a *new* freeze
 * announces itself, and `NEEDS A HUMAN` is where a critical one does.
 */

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

/**
 * The plans, in the order their greyscale steps are assigned.
 *
 * ⚠ **KEYED BY PLAN NAME, NEVER BY ARRAY POSITION**, and the first shape of
 * this file got it wrong. `planDistribution` is built from
 * `.groupBy(credits.planTier)` with **no ORDER BY**
 * (`server/db/adminOverviewQueries.ts:148`), so its row order is whatever MySQL
 * returns — indexing the ramp by position meant the darkest step landed on an
 * arbitrary plan and could silently swap between refetches. The legend swapped
 * with it, so nothing on screen was ever *wrong*; the ramp's own claim to run
 * "darkest first" was simply not enforced by anything.
 *
 * This is the class `GovernanceCard`'s `RESOLVED_ORDER` fixes one file over,
 * for the identical reason, and law 7 says that fix's sweep should have reached
 * here in the same commit. It did not; the gate's reviewer found the sibling.
 */
const PLAN_ORDER = ["free", "starter", "pro", "enterprise"];

/**
 * The greyscale steps a stacked distribution walks, darkest first.
 *
 * Four tokens rather than four opacities of one: an opacity ramp over a
 * translucent surface changes with whatever sits behind it, and these bars sit
 * on `--fill`. Read from `:root` so both themes get their own ramp.
 */
function planRamp(t: ReturnType<typeof useChartTokens>): string[] {
  return [t.ink, t.metaStrong, t.faint, t.dots];
}

/** A plan the list does not know keeps the quietest step rather than the first. */
function planFill(plan: string, ramp: string[]): string {
  const index = PLAN_ORDER.indexOf(plan);
  return ramp[index === -1 ? ramp.length - 1 : Math.min(index, ramp.length - 1)];
}

export function UserGrowthCard({
  data,
  chartData,
}: {
  data: UserGrowthData;
  chartData?: DailySignupStats[];
}) {
  const t = useChartTokens();
  const totalPlanUsers = data.planDistribution.reduce((sum, p) => sum + p.count, 0);
  const ramp = planRamp(t);

  return (
    <div className="dp-ov__card">
      <div className="dp-ov__cardhead">
        <div>
          <h3 className="dp-ov__cardtitle">User growth</h3>
        </div>
      </div>

      <div className="dp-countrow">
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">TOTAL</span>
          <span className="dp-counttile__value">{data.totalUsers.toLocaleString()}</span>
        </div>
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">NEW · 7 DAYS</span>
          <span className="dp-counttile__value">{data.newSignups7d.toLocaleString()}</span>
          <span className="dp-ov__tilefoot">{data.newSignups24h} today</span>
        </div>
      </div>

      <div className="dp-ov__leaders">
        <div className="dp-ov__leader">
          <span className="dp-ov__leaderlabel">Frozen</span>
          <span className="dp-ov__spacer" />
          <span className="dp-ov__leadervalue">{data.frozenAccounts}</span>
        </div>
        <div className="dp-ov__leader">
          <span className="dp-ov__leaderlabel">Suspended</span>
          <span className="dp-ov__spacer" />
          <span className="dp-ov__leadervalue">{data.suspendedAccounts}</span>
        </div>
      </div>

      {totalPlanUsers > 0 && (
        <div className="dp-ov__block">
          <span className="dp-ov__blocklabel">PLAN DISTRIBUTION</span>
          <div className="dp-ov__stack">
            {data.planDistribution.map((p) => (
              <span
                key={p.plan}
                className="dp-ov__stackpart"
                style={{
                  width: `${(p.count / totalPlanUsers) * 100}%`,
                  background: planFill(p.plan, ramp),
                }}
              />
            ))}
          </div>
          <div className="dp-ov__keys">
            {data.planDistribution.map((p) => (
              <span key={p.plan} className="dp-ov__key">
                <span
                  className="dp-ov__swatch"
                  style={{ background: planFill(p.plan, ramp) }}
                />
                {p.plan} ({p.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {chartData && chartData.length > 0 && (
        <div className="dp-ov__block">
          <span className="dp-ov__blocklabel">DAILY SIGNUPS — 14 DAYS</span>
          <div className="dp-ov__chart dp-ov__chart--short">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.rule} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={axisTick(t)}
                  axisLine={{ stroke: t.border }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={axisTick(t)}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle(t)} labelFormatter={formatDateLabel} />
                <Bar
                  dataKey="signups"
                  fill={t.ink}
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

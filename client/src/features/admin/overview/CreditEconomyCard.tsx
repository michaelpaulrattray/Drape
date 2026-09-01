import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { EmptyState } from "@/foundation";
import { axisTick, tooltipStyle, useChartTokens } from "./chartTokens";

/**
 * Credit economy (brief 07 §7's "same treatment" clause).
 *
 * ## ⚠ Neither series takes the accent here, and that is the rule applied
 * rather than an exception to it
 *
 * §7 earns a second colour on the generation chart with a stated reason:
 * *"Failure is an attention state, so accent is legitimate here."* Purchased
 * and consumed are **both the product working** — credits bought and credits
 * spent is the business happening, not a fault — so neither is an attention
 * state and neither may claim the one colour that means *look here*.
 *
 * They are told apart by **value**: purchased `--ink`, consumed `--metaStrong`,
 * with a legend. Spending the accent on a healthy chart is precisely what §3
 * says leaves nothing left to say urgent.
 *
 * ## The three flow figures lose their arrows
 *
 * Down-red, up-emerald and a rotating amber — three glyphs tinted three ways
 * for three numbers that are all normal. The labels say which.
 */

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
  const t = useChartTokens();
  const sortedTypes = [...data.generationsByType24h].sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="dp-ov__card">
      <div className="dp-ov__cardhead">
        <div>
          <h3 className="dp-ov__cardtitle">Credit economy</h3>
        </div>
      </div>

      <div className="dp-countrow">
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">IN CIRCULATION</span>
          <span className="dp-counttile__value">
            {formatNumber(data.totalCreditsInCirculation)}
          </span>
        </div>
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">CONSUMED · 24H</span>
          <span className="dp-counttile__value">
            {formatNumber(data.creditsConsumed24h)}
          </span>
        </div>
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">PURCHASED · 7D</span>
          <span className="dp-counttile__value">
            {formatNumber(data.creditsPurchased7d)}
          </span>
        </div>
        <div className="dp-counttile">
          <span className="dp-ov__tilelabel">REFUNDED · 7D</span>
          <span className="dp-counttile__value">
            {formatNumber(data.creditsRefunded7d)}
          </span>
        </div>
      </div>

      {chartData && chartData.length > 0 && (
        <div className="dp-ov__block">
          <div className="dp-ov__blockhead">
            <span className="dp-ov__blocklabel">DAILY CREDIT FLOW — 14 DAYS</span>
            <span className="dp-ov__spacer" />
            <span className="dp-ov__legend">
              <span className="dp-ov__legenditem">
                <span className="dp-ov__swatch" style={{ background: t.ink }} />
                Purchased
              </span>
              <span className="dp-ov__legenditem">
                <span className="dp-ov__swatch" style={{ background: t.metaStrong }} />
                Consumed
              </span>
            </span>
          </div>
          <div className="dp-ov__chart dp-ov__chart--short">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.rule} />
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
                  tickFormatter={(v) => formatNumber(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle(t)}
                  labelFormatter={formatDateLabel}
                  formatter={(value: number) => [value.toLocaleString(), undefined]}
                />
                <Line
                  type="monotone"
                  dataKey="purchased"
                  stroke={t.ink}
                  strokeWidth={1.7}
                  dot={false}
                  name="Purchased"
                />
                <Line
                  type="monotone"
                  dataKey="consumed"
                  stroke={t.metaStrong}
                  strokeWidth={1.7}
                  dot={false}
                  name="Consumed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sortedTypes.length > 0 ? (
        <div className="dp-ov__block">
          <span className="dp-ov__blocklabel">COST BY TYPE — 24H</span>
          <div className="dp-ov__bars">
            {sortedTypes.map((type) => {
              const maxCost = sortedTypes[0]?.totalCost || 1;
              return (
                <div key={type.type} className="dp-ov__barrow">
                  <span className="dp-ov__barlabel">
                    {TYPE_LABELS[type.type] || type.type}
                  </span>
                  <span className="dp-ov__bartrack">
                    <span
                      className="dp-ov__barfill"
                      style={{ width: `${(type.totalCost / maxCost) * 100}%` }}
                    />
                  </span>
                  <span className="dp-ov__barvalue">
                    {type.totalCost} cr · {type.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No generations in the last 24h"
          body="Credit spend by operation type appears here once casting runs."
        />
      )}
    </div>
  );
}

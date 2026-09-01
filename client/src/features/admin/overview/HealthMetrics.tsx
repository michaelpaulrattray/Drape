import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TableHead } from "@/foundation";
import { axisTick, tooltipStyle, useChartTokens } from "./chartTokens";

/**
 * LAST 24 HOURS — the four KPIs (brief 07 §6) — and the generation chart (§7).
 *
 * Two exports because the brief's section order splits them: *"Needs a human ·
 * Last 24 hours · Charts · System and banners · Recent alerts."* They were one
 * component because they were one block on the old page.
 *
 * ## What changed, and what deliberately did not
 *
 * Restyle only: **every number and every series is the one that was there
 * before** (§11's last bar). What goes: `text-3xl font-bold`, the four
 * decorative corner icons, the emerald/amber/red status ramp, the
 * `animate-pulse` on a healthy dot, and the two `linearGradient` defs.
 *
 * ## ⚠ Three sparklines, not four — and no delta at all
 *
 * §6 draws a 14-bar sparkline and a delta on every card. Read at the queries:
 *
 * - **Three have a real series.** `ts.dailyGenerations` carries 14 days of
 *   `successRate`, `total` and `failed`.
 * - **`ACTIVE USERS` has none.** The only 14-day user series is
 *   `dailySignups`, and at `adminTimeSeriesQueries.ts:107` that is
 *   `COUNT(*) FROM users WHERE createdAt >= …` — **accounts created, not users
 *   active**. A different number with a similar shape. His own ruling on the
 *   00b frames governs: *"a number in a screenshot that no server produces is
 *   a lie that survives into the build."* So that card ships without one.
 * - **No card gets a delta.** The value is a *rolling 24-hour* figure
 *   (`health.total24h`); the only comparable series is *calendar-day*, whose
 *   last bucket is today-so-far. "Today vs yesterday" would compare a partial
 *   day against a complete one and report a collapse every morning — the
 *   wrong-boundary class CLAUDE.md law 7 names. A missing delta is a gap; a
 *   delta that cries wolf at 09:00 every day on the surface whose whole job is
 *   "does anything need me" is worse than a gap.
 *
 * Both are on #397 with the reasoning, so the next reader does not re-derive it.
 */

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

/**
 * The sparkline: 14 bars, the last one `--ink` because it is today (§6).
 *
 * A div-per-bar rather than a chart. Fourteen numbers with no axis, no tooltip
 * and no interaction is not a chart, and mounting a `ResponsiveContainer` in
 * each of three KPI cards to draw it would cost four ResizeObservers for
 * something CSS does exactly.
 */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <span className="dp-kpi__spark" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`dp-kpi__bar${i === values.length - 1 ? " dp-kpi__bar--today" : ""}`}
          /* A percentage of the tallest bar, floored so a zero day is still a
             visible mark rather than a gap that reads as missing data. */
          style={{ height: `${Math.max((v / max) * 100, 6)}%` }}
        />
      ))}
    </span>
  );
}

function Kpi({
  label,
  value,
  foot,
  spark,
  tone,
}: {
  label: string;
  value: string;
  foot: string;
  spark?: number[];
  /** `attention` and `critical` are the only two that may carry colour (§3). */
  tone?: "attention" | "critical";
}) {
  return (
    <div
      className={`dp-kpi${tone ? ` dp-kpi--${tone}` : ""}`}
    >
      <span className="dp-kpi__label">{label}</span>
      <span className="dp-kpi__value">{value}</span>
      {spark ? <Sparkline values={spark} /> : null}
      <span className="dp-kpi__foot">{foot}</span>
    </div>
  );
}

export function HealthMetrics({
  data,
  chartData,
}: {
  data: HealthData;
  chartData?: DailyGenerationStats[];
}) {
  const series = chartData ?? [];
  const isCritical = data.successRate < 80;

  /* The queue line under GENERATIONS — unchanged words, unchanged thresholds. */
  const queueFoot =
    data.processing === 0 && data.pending === 0
      ? "Nothing in the queue"
      : [
          data.processing > 0 ? `${data.processing} processing` : null,
          data.pending > 0 ? `${data.pending} queued` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <section className="dp-ov__section">
      <TableHead eyebrow="Last 24 hours" />
      <div className="dp-ov__kpigrid">
        <Kpi
          label="SUCCESS RATE"
          value={`${data.successRate}%`}
          foot={`${data.completed24h} completed · ${data.failed24h} failed`}
          spark={series.map((d) => d.successRate)}
          tone={isCritical ? "critical" : undefined}
        />
        <Kpi
          label="ACTIVE USERS"
          value={data.activeUsers24h.toLocaleString()}
          foot="Signed in within 24h"
          /* No sparkline: see the header note. `dailySignups` is a different
             number and drawing it here would be a lie. */
        />
        <Kpi
          label="GENERATIONS"
          value={data.total24h.toLocaleString()}
          foot={queueFoot}
          spark={series.map((d) => d.total)}
        />
        <Kpi
          label="FAILURES"
          value={data.failed24h.toLocaleString()}
          /* His words, kept — §6 calls this foot well judged. */
          foot={
            isCritical
              ? "Investigate immediately"
              : data.failed24h > 0
              ? "Some failures detected"
              : "No failures in 24h"
          }
          spark={series.map((d) => d.failed)}
          tone={isCritical ? "critical" : data.failed24h > 0 ? "attention" : undefined}
        />
      </div>
    </section>
  );
}

/**
 * The generation trend (§7) — a `LineChart`, two series, no gradients.
 *
 * *"Two series, distinguished by role not category: completed is `--ink`,
 * failed is `--accentSolid`. Failure is an attention state, so accent is
 * legitimate here — this is the one chart where a second colour is earned."*
 */
export function GenerationChart({ chartData }: { chartData?: DailyGenerationStats[] }) {
  const t = useChartTokens();
  if (!chartData || chartData.length === 0) return null;

  return (
    <div className="dp-ov__card">
      <div className="dp-ov__cardhead">
        <div>
          <h3 className="dp-ov__cardtitle">Generation activity</h3>
          <p className="dp-ov__cardsub">Completed vs failed — last 14 days</p>
        </div>
        <div className="dp-ov__legend">
          <span className="dp-ov__legenditem">
            <span className="dp-ov__swatch" style={{ background: t.ink }} />
            Completed
          </span>
          <span className="dp-ov__legenditem">
            <span className="dp-ov__swatch" style={{ background: t.accent }} />
            Failed
          </span>
        </div>
      </div>
      <div className="dp-ov__chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.rule} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={axisTick(t)}
              axisLine={{ stroke: t.border }}
              tickLine={false}
            />
            <YAxis tick={axisTick(t)} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle(t)} labelFormatter={formatDateLabel} />
            <Line
              type="monotone"
              dataKey="completed"
              stroke={t.ink}
              strokeWidth={1.7}
              dot={false}
              name="Completed"
            />
            <Line
              type="monotone"
              dataKey="failed"
              stroke={t.accent}
              strokeWidth={1.7}
              dot={false}
              name="Failed"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

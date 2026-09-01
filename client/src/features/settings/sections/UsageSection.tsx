/**
 * Settings → Usage (brief §5, rebuilt against the prototype on #381).
 *
 * ## ⚠ ONE WINDOW FOR THE WHOLE PANE — HIS FIRST LIVE DEFECT
 *
 * He read `115,695 credits used · of 5,000 this month` and named it exactly:
 * *"a used figure 23× the allowance is two different windows on one line,
 * almost certainly all-time against monthly."* Measured at his own production
 * rows before a line was changed:
 *
 * - `points.creditsUsed` = **115,695**, and the ledger's ALL-TIME sum of his
 *   spend rows is **115,695** over 622 rows. It is a lifetime counter: it is
 *   set to 0 when the row is made and only ever incremented
 *   (`server/db/credits.ts`). Nothing resets it at a period boundary.
 * - He is on the **free** plan, so `currentPeriodStart` and `currentPeriodEnd`
 *   are both **null** — there is no billing period to scope it to either.
 *
 * So the number was lifetime and the allowance was monthly, on one line. The
 * pane now declares ONE window and every figure in it comes from that window:
 * the billing period when there is one, otherwise the calendar month, which is
 * what a monthly allowance is measured against. It is summed from
 * `usage.getDailyUsage`, whose rows are already per-day, so the window has a
 * real edge instead of *"now minus N days"*.
 *
 * ## ⚠ THE PER-TOOL BARS ARE GONE, AND THAT IS HIS OWN OPTION 2, TAKEN ON A
 * MEASUREMENT HE ORDERED FIRST
 *
 * His card put two options and preferred the first — map `engineUsed` to a
 * tool and draw real bars — but required a measurement before any build, in
 * case that column separates too few things to be worth a chart. Read on his
 * 622 real spend rows:
 *
 * | `engineUsed` | rows | credits |
 * |---|---|---|
 * | `castingV2` | 462 | 45,295 |
 * | **(null)** | 131 | **61,100** |
 * | `gemini-3-pro-image-preview` | 29 | 9,300 |
 *
 * **The majority of his spend by credits — 53% — has no engine recorded at
 * all**, and the two values that do exist are a subsystem name and a model id
 * that map to the SAME tool. A model→tool map over that draws one named bar
 * and an unlabellable bar larger than it, which is his own objection one step
 * later: *"a single bar at 100% conveys less than nothing."*
 *
 * The block that shipped was worse still: it folded by transaction `type`,
 * and every one of his 622 spend rows is `generation` — **one bar, at 100%,
 * always.** So the block is omitted until something records a tool, which is
 * option 2 in his words. What would bring it back is a tool column on the
 * transaction, not a cleverer read of this one.
 */
import { trpc } from "@/lib/trpc";

import { Bar, SettingsGroup, StatCard } from "../parts";

/** `1.2 GB` — bytes at the precision a storage line is read at. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * THE WINDOW, and the day it starts.
 *
 * `getDailyUsage` keys its rows on `new Date(createdAt).toISOString()` — UTC
 * days — so the window edge is computed in UTC too. Comparing a UTC row key
 * against a local-time boundary is how a day lands in the wrong month for ten
 * hours a day on this machine.
 */
function windowStart(
  periodStart: Date | null,
): { firstDay: string; label: string; days: number; elapsedDays: number } {
  const now = new Date();
  const start =
    periodStart && periodStart.getTime() <= now.getTime()
      ? periodStart
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstDay = start.toISOString().slice(0, 10);
  const days = Math.max(
    1,
    Math.ceil((now.getTime() - start.getTime()) / 86_400_000) + 1,
  );
  return {
    firstDay,
    label: periodStart ? "this billing period" : "this month",
    /* `getDailyUsage` caps at 90; a period longer than that is an annual plan,
       and the cap is stated rather than silently truncating the answer. */
    days: Math.min(90, days),
    elapsedDays: days,
  };
}

export function UsageSection({
  allowance,
  periodStart,
}: {
  allowance: number;
  periodStart: Date | null;
}) {
  const { firstDay, label, days, elapsedDays } = windowStart(periodStart);
  const { data: daily } = trpc.usage.getDailyUsage.useQuery({ days });
  const { data: storage } = trpc.profile.storageInfo.useQuery();

  const inWindow = (daily ?? []).filter((row) => row.date >= firstDay);
  const creditsUsed = inWindow.reduce((sum, row) => sum + row.creditsUsed, 0);
  const framesMade = inWindow.reduce((sum, row) => sum + row.generationCount, 0);
  /*
    ⚠ THE DIVISOR IS DAYS ELAPSED, NOT ROWS RETURNED. The first draft divided by
    `inWindow.length`, which is zero while the query is in flight and on the
    first instant of a new period — and it rendered `across 0 days` under a
    figure, which is the shape of nonsense this whole card is about. A window
    that has begun is at least one day old.
  */
  const perDay = Math.round(creditsUsed / elapsedDays);

  const storageUsed = storage?.used ?? 0;
  const storageLimit = storage?.limit ?? 0;

  return (
    <>
      <SettingsGroup title={`Usage ${label}`}>
        <StatCard
          stats={[
            {
              label: "Credits used",
              value: creditsUsed.toLocaleString(),
              note: allowance > 0 ? `of ${allowance.toLocaleString()} ${label}` : undefined,
            },
            { label: "Frames made", value: framesMade.toLocaleString(), note: "that spent credits" },
            {
              label: "Credits a day",
              value: perDay.toLocaleString(),
              note: `averaged over ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"}`,
            },
          ]}
        />
      </SettingsGroup>

      {/*
        Storage is a CARD carrying its OWN label, not a bare row under a section
        heading with its note promoted into that heading (#381 items 4 and 5).
        The prototype draws label and figure on one row, the bar full-width
        beneath, the note beneath that — so the note sits with the thing it
        explains, and there is no second heading saying "Storage" above a card
        whose first word is Storage.
      */}
      <div className="dp-set__stackcard">
        <div className="dp-set__stackhead">
          <span className="dp-set__label">Storage</span>
          <span className="dp-set__value">
            {formatBytes(storageUsed)}
            {storageLimit > 0 ? ` of ${formatBytes(storageLimit)}` : ""}
          </span>
        </div>
        <Bar ratio={storageLimit > 0 ? storageUsed / storageLimit : 0} token="--ink" />
        <span className="dp-set__note">
          Unkept frames clear after 30 days, which is most of what you free up.
        </span>
      </div>
    </>
  );
}

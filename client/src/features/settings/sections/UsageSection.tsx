/**
 * Settings → Usage (brief §5, rebuilt against the prototype on #381).
 *
 * ## ⚠ THE WINDOW IS THE DEFECT, NOT THE SUM — #387 item 2, measured at his
 * own production rows before a line was changed
 *
 * He read `Credits used 0` and said *"its also showing that i've used no
 * credits"*. It was the SECOND wrong reading of this figure in two days: it
 * first showed `115,695 used · of 5,000 this month`, a lifetime sum against a
 * monthly allowance, and the repair scoped it to a calendar month and swung to
 * zero.
 *
 * **Reproduced against the ledger, and the arithmetic was already correct.**
 * His last spend row is **2026-08-30**; the month rolled over on 2026-09-01, so
 * a calendar-month window genuinely held nothing. Summing harder would not have
 * moved it. Two things were actually wrong, and both are about the WINDOW:
 *
 * 1. **A free account has no billing period.** `currentPeriodStart` and
 *    `currentPeriodEnd` are both null on his row, so the pane invented a
 *    calendar month — a window the product does not meter anything against.
 *    On the 1st of a month an invented month is empty by construction.
 * 2. ⚠ **AND THE ALLOWANCE IT WAS MEASURED AGAINST DOES NOT RENEW.**
 *    `refreshMonthlyCredits` (`server/db/billing.ts`) is reached from exactly
 *    one place — the Stripe `invoice.payment_succeeded` webhook — and its
 *    third statement is `if (planTier === "free") return`. **Nothing refreshes
 *    a free account's credits, ever.** The `5,000` in `of 5,000 this month`
 *    comes from the plan table's `free.monthlyCredits`, and for a free account
 *    it is a one-time signup grant wearing a monthly label. That line promised
 *    a refill that never arrives.
 *
 * So the window now FOLLOWS THE ACCOUNT instead of being assumed:
 *
 * | account | window | the note under Credits used |
 * |---|---|---|
 * | has a billing period | that period | `of {allowance} this billing period` — true; the invoice really does refill it |
 * | no billing period (free) | **the last 30 days** | `{balance} credits left` — the only true statement about a pool that never refills |
 *
 * **Why 30 days and not all-time:** all-time is what he objected to the first
 * time, and it makes `Credits a day` an average over the age of the account.
 * Thirty days is a window that actually exists, says its own name, and contains
 * recent work — so the figure moves when he casts, which is the thing he was
 * telling us it did not do.
 *
 * ## ⚠ "FRAMES MADE" IS GONE — #387 item 3, and it was not frames
 *
 * > *"frames made not sure what that should be or even means to be honest"*
 *
 * It was `generationCount`, which counts SPEND ROWS. Read on his 622 rows,
 * those are **19 different operations**: `Casting roll` (237), `Refine a face`
 * (221), `Model iteration` (33), `Mint package` (20), `Upscale to 2K` (17),
 * `Refresh views` (21), `Evidence package synchronization` (6)… Several make no
 * frame at all, and `Refresh views` makes more than one for a single charge.
 *
 * So the label was not merely unclear, it was **false**, and his own rule on the
 * card settles it: *"do not keep a number nobody can interpret."* A true frame
 * count needs the same per-operation record that item 1's tool column is about,
 * and it can come back when that exists.
 *
 * ## ⚠ THE PER-TOOL BARS ARE STILL GONE, AND THAT IS STILL HIS OPTION 2
 *
 * Read on his 622 real spend rows: `castingV2` 462 rows / 45,295 credits,
 * **(null) 131 rows / 61,100 credits**, `gemini-3-pro-image-preview` 29 rows /
 * 9,300 credits. **53% of his spend by credits has no engine recorded at all**,
 * and the two values that exist map to the same tool. A model→tool map over
 * that draws one named bar and a larger unlabellable one — his own objection:
 * *"a single bar at 100% conveys less than nothing."*
 *
 * What brings it back is a `toolKind` column written at spend time (#387 item
 * 1), not a cleverer read of `engineUsed`. That is a money-path change and is
 * left on the card rather than smuggled in beside a read-side repair.
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
 *
 * ⚠ **`firstDay` IS THE FIRST DAY THE SERVER SEEDS, NEVER MERELY THE WINDOW'S
 * NOMINAL START.** `getDailyUsage(days)` selects from `now - days` but seeds its
 * map with the `days` days ENDING TODAY — so a transaction in the few hours
 * between those two edges arrives as an extra, earlier key that the seeding
 * never made room for. Measured on his rows at `days = 2`: the array came back
 * `[08-31, 09-01, 08-30]`, out of order, with a partial 3rd day on the end. A
 * filter keyed on the nominal start would have counted part of a day outside
 * the window it names; keyed on the first SEEDED day it drops cleanly.
 */
export function windowStart(
  periodStart: Date | null,
  balance: number,
  allowance: number,
): { firstDay: string; label: string; days: number; elapsedDays: number; note?: string } {
  const now = new Date();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  if (periodStart && periodStart.getTime() <= now.getTime()) {
    const elapsedDays = Math.max(
      1,
      Math.ceil((now.getTime() - periodStart.getTime()) / 86_400_000) + 1,
    );
    /* `getDailyUsage` caps at 90; a period longer than that is an annual plan,
       and the cap is stated rather than silently truncating the answer. */
    const days = Math.min(90, elapsedDays);
    const seededFirst = new Date(now.getTime() - (days - 1) * 86_400_000);
    return {
      /* The later of the two edges: the period's own start when the whole
         period is seeded, the seeded edge when the 90-day cap has bitten. */
      firstDay: dayKey(periodStart) > dayKey(seededFirst) ? dayKey(periodStart) : dayKey(seededFirst),
      label: "this billing period",
      days,
      elapsedDays,
      note: allowance > 0 ? `of ${allowance.toLocaleString()} this billing period` : undefined,
    };
  }

  /*
    NO BILLING PERIOD — so no period to report on, and no allowance that
    renews. A fixed 30-day window is a real window that names itself, and the
    only true thing to say beside it is what is actually left.
  */
  const days = 30;
  return {
    firstDay: dayKey(new Date(now.getTime() - (days - 1) * 86_400_000)),
    label: "in the last 30 days",
    days,
    elapsedDays: days,
    note: `${balance.toLocaleString()} credits left`,
  };
}

export function UsageSection({
  allowance,
  balance,
  periodStart,
}: {
  allowance: number;
  balance: number;
  periodStart: Date | null;
}) {
  const { firstDay, label, days, elapsedDays, note } = windowStart(periodStart, balance, allowance);
  const { data: daily } = trpc.usage.getDailyUsage.useQuery({ days });
  const { data: storage } = trpc.profile.storageInfo.useQuery();

  const inWindow = (daily ?? []).filter((row) => row.date >= firstDay);
  const creditsUsed = inWindow.reduce((sum, row) => sum + row.creditsUsed, 0);
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
              note,
            },
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

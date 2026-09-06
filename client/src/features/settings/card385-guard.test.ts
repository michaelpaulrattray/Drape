import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readBurn, readCycle } from "./planMath";
import { recommendPlan, type LadderPlan } from "./planLadder";
import { sumWindow, windowStart } from "./usageWindow";

/**
 * #385 — the burn rate on Change plan and Add credits divided a LIFETIME spend
 * by ONE cycle's days.
 *
 * ## Why the arms below are DRIVEN and not read off the source
 *
 * The defect was never visible as a wrong line. `readCycle` said
 * `spent: status.creditsUsed`, which is exactly what a reader would write if
 * the field meant what its name says. What was wrong was the WINDOW — the
 * identical failure #381 fixed on the Usage pane one surface over, and the
 * founder's own name for the class: *"two different windows on one line."*
 *
 * So the arms below put two readings side by side on ONE fixture — the wrong
 * one and the right one — and assert they disagree. An arm that only checked
 * the new number would have passed on the old code the day the fixture's
 * lifetime figure happened to be small.
 *
 * ## What was measured before any of this was built
 *
 * Read on production 2026-09-01: **4 points rows, 0 of them with both period
 * ends set.** `readCycle` returns `null` without both, so no customer had ever
 * been shown a number derived from this — it would have gone live silently on
 * the first real subscription. That is why the fixture here is invented rather
 * than copied from a row: there is no row to copy.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const BILLING = join(HERE, "..", "billing");
const read = (path: string) => readFileSync(path, "utf8");
/** Strip comments — a rule quoted in prose is not a rule shipped. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DAY = 86_400_000;

/*
  THE FIXTURE — a customer six months in, ten days into a 30-day cycle.

  `LIFETIME` is what `points.creditsUsed` holds for such an account: every
  credit they have ever spent. `THIS_CYCLE` is what they have actually spent
  since the period began. The gap between the two is the entire defect, and it
  is the ordinary shape of a real account rather than a contrived one.
*/
const NOW = new Date("2026-09-07T00:00:00Z");
const LIFETIME = 120_000;
const THIS_CYCLE = 4_000;
const SUBSCRIBED = {
  balance: 20_000,
  currentPeriodStart: new Date(NOW.getTime() - 10 * DAY),
  currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY),
};

describe("card 385 — the cycle's spend is the cycle's, not the account's whole life", () => {
  it("⚠ the two readings disagree, and by enough to change what the customer is told", () => {
    const wrong = readCycle(SUBSCRIBED, LIFETIME, NOW)!;
    const right = readCycle(SUBSCRIBED, THIS_CYCLE, NOW)!;
    expect(wrong, "readCycle refused a complete cycle").not.toBeNull();

    const wrongBurn = readBurn(wrong, NOW);
    const rightBurn = readBurn(right, NOW);

    /*
      The numbers, so the failure is legible rather than a bare inequality:
      11 days elapsed of the 30. 120,000 / 11 = 10,909 a day against
      4,000 / 11 = 364 — a factor of thirty. The balance of 20,000 then empties
      in under two days on the wrong reading and in 55 days on the right one,
      which is after the renewal, so the band should not fire at all.
    */
    expect(wrongBurn.perDay).toBeGreaterThan(rightBurn.perDay * 25);
    expect(wrongBurn.daysToEmpty!, "the wrong reading did not empty inside the cycle")
      .toBeLessThan(right.daysLeft);
    expect(rightBurn.daysToEmpty!, "the right reading empties inside the cycle too — the fixture proves nothing")
      .toBeGreaterThan(right.daysLeft);

    /*
      ⚠ THE HALF THAT IS NOT COPY. `dryDays` is what the band dramatises —
      "leaves you N days short of the 27th". The wrong reading invents a
      shortfall on an account that has none.
    */
    expect(wrongBurn.dryDays, "the wrong reading claimed no shortfall").toBeGreaterThan(0);
    expect(rightBurn.dryDays, "the right reading still claims a shortfall").toBe(0);
  });

  it("⚠ and it chose which rung carried the one ink button, which is not copy at all", () => {
    /*
      `ChangePlanModal` computes `projected = burn.perDay * cycle.cycleLength`
      and hands it to `recommendPlan`, whose answer is the single ink button
      §6c allows. So the lifetime figure was not merely printing a wrong
      sentence — it was selling a plan.
    */
    const LADDER: LadderPlan[] = [
      { id: "starter", name: "Starter", credits: 75_000, priceInCents: 2_700 },
      { id: "pro", name: "Pro", credits: 200_000, priceInCents: 5_900 },
      { id: "studio", name: "Studio", credits: 600_000, priceInCents: 15_900 },
    ] as unknown as LadderPlan[];

    const projectedFrom = (spend: number) => {
      const cycle = readCycle(SUBSCRIBED, spend, NOW)!;
      return Math.round(readBurn(cycle, NOW).perDay * cycle.cycleLength);
    };

    const wrongPick = recommendPlan(LADDER, "starter" as never, projectedFrom(LIFETIME));
    const rightPick = recommendPlan(LADDER, "starter" as never, projectedFrom(THIS_CYCLE));

    expect(wrongPick, "the lifetime reading recommended nothing — the fixture cannot show the harm")
      .not.toBeNull();
    expect(rightPick, "the true reading still pushes an upgrade this account does not need")
      .toBeNull();
  });

  it("⚠ an unknown spend is NOT a spend of zero — the loading state prints no rate", () => {
    /*
      `useCycleSpend` answers `null` while the per-day rows are in flight, and
      that lands here as a spend of 0. A zero spend has no rate at all
      (`readBurn`'s own guard), so `burn.emptyOn` is null and every surface
      gates its band on it. The wrong repair — defaulting to the status field
      while loading — would print the lifetime number for a beat.
    */
    const cycle = readCycle(SUBSCRIBED, null, NOW)!;
    expect(cycle, "a null spend destroyed the cycle — the proration copy needs it").not.toBeNull();
    expect(cycle.spent).toBe(0);
    const burn = readBurn(cycle, NOW);
    expect(burn.emptyOn, "an empty date was invented from a spend nobody has").toBeNull();
    expect(burn.daysToEmpty, "a days-to-empty was invented from a spend nobody has").toBeNull();
    expect(burn.dryDays).toBe(0);

    /* And the renewal facts SURVIVE, which is why `readCycle` still answers a
       cycle rather than null: the proration charge and the date it names do not
       depend on a spend. */
    expect(cycle.cycleLength).toBe(30);
    expect(cycle.renewsAt.getTime()).toBe(SUBSCRIBED.currentPeriodEnd.getTime());
  });

  it("⚠ THE WIRE: `readCycle` cannot see a spend field on the status projection at all", () => {
    /*
      The arm that survives a rewrite. `creditsUsed` is still on
      `billing.getStatus` — it has other readers — so the protection cannot be
      "the field is gone". It is that this function has no way to reach it: the
      spend arrives as its own argument, and an extra key on the object is
      ignored.

      Driven rather than grepped: a status carrying the lifetime counter under
      its real name, and a cycle spend of 4,000 beside it. If somebody ever
      restores `status.creditsUsed ?? cycleSpent`, this goes red.
    */
    const withLifetimeField = { ...SUBSCRIBED, creditsUsed: LIFETIME } as never;
    const cycle = readCycle(withLifetimeField, THIS_CYCLE, NOW)!;
    expect(cycle.spent, "a spend field on the status object reached the cycle again")
      .toBe(THIS_CYCLE);

    const source = code(read(join(HERE, "planMath.ts")));
    expect(source, "planMath reads a spend field off the server projection again")
      .not.toContain("creditsUsed");
  });

  it("⚠ THE WIRE, second half: both modals sum the ledger and neither reads the counter", () => {
    for (const file of ["ChangePlanModal.tsx", "AddCreditsModal.tsx"]) {
      const source = code(read(join(BILLING, file)));
      expect(source, `${file} no longer sums a real per-day window`).toContain("useCycleSpend");
      expect(source, `${file} reads the lifetime counter again`).not.toContain("creditsUsed");
    }
  });
});

describe("card 385 — the window and the sum, which both surfaces now share", () => {
  it("⚠ a row before the window's first day does not count, and one on it does", () => {
    /*
      THE NEGATIVE CONTROL, and it is the arm that matters. A sum that counted
      everything would pass every "the total is right" assertion on a fixture
      whose rows all sit inside the window — which is how a lifetime figure
      passes for a cycle figure in the first place.
    */
    const rows = [
      { date: "2026-08-27", creditsUsed: 99_999 },
      { date: "2026-08-28", creditsUsed: 1_000 },
      { date: "2026-09-02", creditsUsed: 500 },
    ];
    expect(sumWindow(rows, "2026-08-28"), "a row outside the window was counted").toBe(1_500);
    expect(sumWindow(rows, "2026-09-02"), "the boundary day itself was dropped").toBe(500);
    expect(sumWindow(rows, "2026-12-01"), "rows after the window's end leaked in").toBe(0);
  });

  it("⚠ an absent row set sums to zero, and the hook is what must not render it", () => {
    /* Stated as an arm because the two callers differ: the Usage pane renders
       the zero (it is a total, and zero is a true total of nothing yet), and
       `useCycleSpend` refuses to, because a RATE off an unknown spend is a
       confident wrong number. */
    expect(sumWindow(undefined, "2026-09-01")).toBe(0);
    expect(sumWindow(null, "2026-09-01")).toBe(0);

    const hook = code(read(join(BILLING, "useCycleSpend.ts")));
    expect(hook, "the hook stopped distinguishing 'not loaded' from 'spent nothing'")
      .toContain("if (!daily) return null;");
  });

  it("⚠ the modals' window is the SAME reading the Usage pane uses", () => {
    /*
      Working law 4 — derive, never mirror. Two windows over one ledger would
      drift, and the drift would show as two surfaces quoting different spends
      for the same cycle with nothing looking wrong on either.
    */
    const periodStart = new Date(NOW.getTime() - 10 * DAY);
    const w = windowStart(periodStart, 0, 0);
    expect(w.label).toBe("this billing period");
    expect(w.days).toBeGreaterThan(0);

    const pane = code(read(join(HERE, "sections", "UsageSection.tsx")));
    const hook = code(read(join(BILLING, "useCycleSpend.ts")));
    for (const [name, source] of [["the Usage pane", pane], ["the modals' hook", hook]] as const) {
      expect(source, `${name} no longer reads the shared window`).toContain("windowStart");
    }
    expect(pane, "the Usage pane grew its own copy of the sum again").toContain("sumWindow");
    expect(hook, "the hook grew its own copy of the sum again").toContain("sumWindow");
  });
});

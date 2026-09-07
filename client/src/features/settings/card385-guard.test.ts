import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readBurn, readCycle } from "./planMath";
import { recommendPlan, type LadderPlan } from "./planLadder";
import { spendWindowCopy } from "./usageWindow";

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
const LIFETIME = { spent: 120_000, days: 11 };
const THIS_CYCLE = { spent: 4_000, days: 11 };
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
      the window spans 11 days of the 30-day cycle. 120,000 / 11 = 10,909 a day
      against 4,000 / 11 = 364 — a factor of thirty. The balance of 20,000 then
      empties in under two days on the wrong reading and in 55 days on the right
      one, which is after the renewal, so the band should not fire at all.

      ⚠ THE DIVISOR IS THE WINDOW SPAN, NOT `cycleLength - daysLeft`, and this
      comment named 11 while the code divided by 10 until PR #622 review
      (finding 2). Two divisors for one window put the Usage pane and the
      modals ~10%% apart on the same account. There is one now, and the
      arithmetic above is the arithmetic that runs.
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

    const projectedFrom = (spend: { spent: number; days: number }) => {
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
    const withLifetimeField = { ...SUBSCRIBED, creditsUsed: LIFETIME.spent } as never;
    const cycle = readCycle(withLifetimeField, THIS_CYCLE, NOW)!;
    expect(cycle.spent, "a spend field on the status object reached the cycle again")
      .toBe(THIS_CYCLE.spent);

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

describe("⚠ card 385 — the ANNUAL period, where the sum's window and the cycle's length part company", () => {
  /*
    PR #622's REVIEW, FINDING 1 — the fix's own defect, one window further out,
    and the reason this describe block exists at all.

    `usage.getDailyUsage` caps at 90 days (`server/routes/usage.ts:34`), so the
    sum can only ever cover 90 of an annual period's 365. The first version of
    this repair divided that 90-day total by `cycleLength - daysLeft`, which on
    an annual plan is the days since the period began. That is #385 exactly —
    a figure and a window that disagree — with the sign flipped: it now
    UNDERSELLS.

    The fixture is the reviewer's own: 200 days into a 365-day period, a steady
    1,000 a day, 50,000 left.
  */
  const ANNUAL_NOW = new Date("2026-09-07T00:00:00Z");
  const ANNUAL = {
    balance: 50_000,
    currentPeriodStart: new Date(ANNUAL_NOW.getTime() - 200 * DAY),
    currentPeriodEnd: new Date(ANNUAL_NOW.getTime() + 165 * DAY),
  };
  /* What the hook can actually sum: 90 days at 1,000 a day. */
  const NINETY_DAYS = { spent: 90_000, days: 90 };

  it("divides the 90-day sum by 90 days, not by the 200 the period has run", () => {
    const cycle = readCycle(ANNUAL, NINETY_DAYS, ANNUAL_NOW)!;
    expect(cycle.cycleLength, "the fixture is not an annual period").toBe(365);
    expect(cycle.spentOverDays, "the span the sum covers did not travel with it").toBe(90);

    const burn = readBurn(cycle, ANNUAL_NOW);
    /* The truth. Dividing by 200 instead gives 450, which is the defect. */
    expect(burn.perDay).toBeCloseTo(1_000, 6);
    expect(burn.perDay, "the 200-day divisor is back").not.toBeCloseTo(450, 0);
    /* 50,000 left at 1,000 a day is 50 days, against ~111 on the wrong read. */
    expect(Math.round(burn.daysToEmpty!)).toBe(50);
  });

  it("⚠ and the rung it recommends is the one the customer actually needs", () => {
    /*
      THE ARM THAT MAKES FINDING 1 A PRODUCT DEFECT RATHER THAN AN ARITHMETIC
      ONE. `projected = perDay × cycleLength`: 365,000 on the true reading,
      164,250 on the wrong one — which lands on a rung BELOW their real usage,
      the mirror of #385's own upsell.
    */
    const LADDER: LadderPlan[] = [
      { id: "starter", name: "Starter", credits: 75_000, priceInCents: 2_700 },
      { id: "pro", name: "Pro", credits: 200_000, priceInCents: 5_900 },
      { id: "studio", name: "Studio", credits: 600_000, priceInCents: 15_900 },
    ] as unknown as LadderPlan[];

    const cycle = readCycle(ANNUAL, NINETY_DAYS, ANNUAL_NOW)!;
    const projected = Math.round(readBurn(cycle, ANNUAL_NOW).perDay * cycle.cycleLength);
    expect(projected).toBe(365_000);
    expect(recommendPlan(LADDER, "starter" as never, projected)!.id).toBe("studio");

    /* The wrong reading's projection, computed here rather than asserted about,
       so the arm shows WHY the rungs differ instead of claiming they do. */
    const understated = Math.round((90_000 / 200) * 365);
    expect(understated).toBe(164_250);
    expect(recommendPlan(LADDER, "starter" as never, understated)!.id).toBe("pro");
  });

  it("⚠ there is still exactly ONE span beside the sum, and no second one to reach for", () => {
    /*
      The wire for this finding, re-aimed at the property in #624 rather than
      at the old shape. `windowStart` used to return BOTH a capped `days` and an
      uncapped `elapsedDays`, and every caller that reached for the second one
      was wrong; the span now travels from the server beside the sum it belongs
      to. What must never come back is a SECOND number a caller can divide by.

      ⚠ Read at the hook rather than at a fixture, because the defect was never
      a wrong value — it was a second field existing at all.
    */
    const hook = code(read(join(BILLING, "useCycleSpend.ts")));
    expect(hook, "the hook stopped carrying the span beside the sum").toContain("days: spend.days");
    expect(hook, "a second, separately-derived span came back").not.toContain("elapsedDays");

    /* And the pane divides by the span it was given, not by one of its own. */
    const pane = code(read(join(HERE, "sections", "UsageSection.tsx")));
    expect(pane, "the pane derives its own divisor again").toContain("spend.days");
  });

  it("⚠ a cycle that has NOT begun still prints no rate — the two numbers do different jobs", () => {
    /*
      The guard and the divisor were one number before this finding, so
      replacing the divisor could silently have removed the guard. `readBurn`
      keeps asking `cycleLength - daysLeft <= 0` — *has this cycle begun?* —
      and separately divides by the span the sum covers.
    */
    const notStarted = {
      balance: 50_000,
      currentPeriodStart: ANNUAL_NOW,
      currentPeriodEnd: new Date(ANNUAL_NOW.getTime() + 30 * DAY),
    };
    const cycle = readCycle(notStarted, { spent: 5_000, days: 30 }, ANNUAL_NOW)!;
    expect(cycle.spentOverDays, "the span is present, so only the guard can be refusing").toBe(30);
    expect(readBurn(cycle, ANNUAL_NOW).emptyOn, "a rate was printed for a cycle that has not run a day")
      .toBeNull();
  });
});

describe("card 385 — the window and the sum, which both surfaces now share", () => {
  /*
    ⚠ THIS BLOCK'S SUBJECT MOVED TO THE SERVER IN #624 AND THE ARMS MOVED WITH
    IT, WHICH IS WHY THREE OF THEM READ DIFFERENTLY NOW.

    They used to drive `sumWindow` — a client-side fold over
    `usage.getDailyUsage`'s whole-UTC-day buckets — and its negative control
    (a row before the window's first day must not count) was the arm that
    mattered most here. That fold cannot answer the question at all: a real
    billing period begins at a mid-day INSTANT and a day bucket has no edge
    inside it. The boundary is now a `>=` in a WHERE clause, and a predicate is
    proved by running it: `server/cycleSpend-db.test.ts` puts 9,000 credits an
    hour before a 14:00 renewal and 1,000 an hour after it into a real
    `point_transactions` table and asserts the answer is 1,000 — with the OLD
    day-keyed window run against the same rows in the same arm, answering
    10,000, so the two are shown to disagree rather than claimed to.

    What stays here is what is still the client's: that the two money modals
    and the Usage pane quote ONE reading, and that a reading nobody has yet is
    not a spend of zero.
  */

  it("⚠ the boundary's negative control is DRIVEN, and this says where", () => {
    /*
      An arm that vanishes reads exactly like an arm nobody replaced, so the
      pointer is an assertion rather than a comment: if the driven suite is
      deleted or renamed, this goes red and somebody reads this paragraph.
    */
    const driven = code(read(join(HERE, "..", "..", "..", "..", "server", "cycleSpend-db.test.ts")));
    expect(driven, "the mid-day boundary is no longer driven against real rows").toContain(
      "the pre-renewal spend is dropped and the post-renewal spend is kept",
    );
    expect(driven, "the old road is no longer run beside the new one").toContain(
      "THE OLD ROAD WOULD HAVE ANSWERED 10,000",
    );
  });

  it("⚠ an unknown reading is NOT a spend of zero, and the hook is what must not render it", () => {
    /*
      Unchanged in substance and re-aimed at the shipped line. The Usage pane
      renders `—` for a reading it does not have (it used to render `0`, which
      is a confident wrong number), and `useCycleSpend` answers `null`, which
      `readBurn` turns into no rate at all rather than a zero rate.
    */
    const hook = code(read(join(BILLING, "useCycleSpend.ts")));
    expect(hook, "the hook stopped distinguishing 'not loaded' from 'spent nothing'")
      .toContain("if (!spend) return null;");

    const pane = code(read(join(HERE, "sections", "UsageSection.tsx")));
    expect(pane, "the pane prints a zero for a figure it does not have again").toContain(
      'spend ? spend.spent.toLocaleString() : "—"',
    );
  });

  it("⚠ the modals' reading is the SAME reading the Usage pane uses", () => {
    /*
      Working law 4 — derive, never mirror. Two windows over one ledger would
      drift, and the drift would show as two surfaces quoting different spends
      for the same cycle with nothing looking wrong on either. There is one
      procedure and one module that calls it; the pane's own label is derived
      from the window the SERVER says it summed, so the words cannot describe a
      different span from the number.
    */
    const copy = spendWindowCopy("period", 0, 0);
    expect(copy.heading).toBe("Usage this billing period");
    expect(spendWindowCopy("rolling30", 0, 0).heading).toBe("Usage in the last 30 days");

    const pane = code(read(join(HERE, "sections", "UsageSection.tsx")));
    const hook = code(read(join(BILLING, "useCycleSpend.ts")));
    expect(pane, "the Usage pane grew its own reading again").toContain("useSpendWindow");
    expect(pane, "the pane names a window the server did not sum").toContain("spend?.basis ?? null");
    expect(hook, "the shared hook stopped calling the one procedure").toContain(
      "trpc.usage.getCycleSpend",
    );

    /*
      ONE call site, and the population is DERIVED rather than listed — a list
      of four files cannot see a fifth, which is the whole failure mode this
      arm is about. Every `.ts`/`.tsx` under `client/src` is read.
    */
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [join(dir, entry.name)]
            : [],
      );
    const clientRoot = join(HERE, "..", "..");
    const callers = walk(clientRoot).filter(
      (file) => !file.endsWith(".test.ts") && code(read(file)).includes("usage.getCycleSpend"),
    );
    expect(
      callers.map((file) => file.slice(clientRoot.length)),
      "the procedure is called from more than one place — a second reading will drift",
    ).toHaveLength(1);
  });
});

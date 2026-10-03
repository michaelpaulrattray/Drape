/**
 * #1739 — THE BURN SENTENCE DESCRIBES THE CYCLE THE CUSTOMER IS ON, NEVER THE
 * ONE THEY ARE LOOKING AT.
 *
 * `AddCreditsModal` says two things about time. One is about the charge it is
 * about to make, and `alignToPreview` exists so that sentence quotes the
 * server's own proration pair (#664, and the prototype's date-vs-charge defect
 * before it). The other — the burn band — is about the balance the customer
 * already holds and the day it resets. **The second one read the first one's
 * cycle.**
 *
 * Driven on the dev subscriber fixture before anything changed: an account
 * billed monthly, renewing in 8 days, with the Annual toggle on.
 *
 *     before the yearly quote arrives
 *       320 of 4,008 spent with 8 days left in this cycle
 *       — at this rate the balance runs out on 22 Jun.
 *
 *     after it arrives
 *       320 of 4,008 spent with 343 days left in this cycle
 *       — at this rate the balance runs out on 22 Jun, 80 days before it resets.
 *
 * Nothing was charged wrongly and no figure moved. The sentence adopted the
 * YEARLY plan's 343 days, and the `80 days before it resets` clause exists only
 * as arithmetic on that wrong number — for an account whose balance resets in 8.
 *
 * ## What these arms hold, and why the first one is not an inequality
 *
 * It would be cheap to assert that the two readings differ. That passes for a
 * dozen reasons, most of them not this defect. So the mechanism arm pins what
 * actually moved: `alignToPreview` leaves `spentOverDays` alone, so the burn
 * RATE and the empty DATE are identical either way — the only things the wrong
 * basis moves are the cycle claim and a clause that is pure arithmetic on it. A
 * fix that changed the date would be a different bug, and that arm would say so.
 *
 * ⚠ **AND THE ALIGNMENT ARM GUARDS THE OVER-CORRECTION, which is the likelier
 * regression.** Deleting `alignToPreview` from this surface would close #1739
 * and re-open the defect it was built for. The renewal line must still align;
 * only the burn band must not.
 *
 * Comments are stripped before any source match, so a docblock telling this
 * story cannot satisfy an arm about the code.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { readListedSource } from "../../../../server/testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../../../../server/testing/contendedTestTimeout";
import { sourceBand } from "../../../../server/testing/sourceBand";
import { alignToPreview, readBurn, readCycle } from "../settings/planMath";

/* The one-caller arm walks `client/src`, `server` and `shared` off the real
   tree, which is the contended-read population: fast here, red under load on
   somebody else's machine rather than in CI. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const HERE = join(process.cwd(), "client", "src", "features", "billing");
const code = (name: string) => withoutComments(readFileSync(join(HERE, name), "utf8"));

describe("#1739 · the mechanism, driven over the real readings", () => {
  /* The fixture is the card's own measured account, in LEDGER units: display is
     the ledger ÷ 5, so 320 of 4,008 display is 1,600 of 20,040. */
  const NOW = new Date("2026-10-02T00:00:00.000Z");
  const MONTHLY = {
    balance: 18_440,
    currentPeriodStart: new Date("2026-09-10T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-10-10T00:00:00.000Z"),
  };
  const SPEND = { spent: 1_600, days: 22 };
  /* What `previewPlanChange` returns for the ANNUAL option — a plan this
     account has not bought. */
  const ANNUAL_QUOTE = { daysRemaining: 343, totalDays: 365 };

  it("the account's own cycle says 8 days and claims nothing about running dry", () => {
    const own = readCycle(MONTHLY, SPEND, NOW);
    expect(own, "readCycle refused a complete monthly cycle").not.toBeNull();
    expect(own!.daysLeft).toBe(8);
    expect(own!.cycleLength).toBe(30);

    const burn = readBurn(own!, NOW);
    expect(burn.emptyOn, "no empty date on a cycle that has spent credits").not.toBeNull();
    /* The balance outlives this cycle by a wide margin, so there is no dry
       period to name and the clause does not render. */
    expect(burn.daysToEmpty!).toBeGreaterThan(own!.daysLeft);
    expect(burn.dryDays).toBe(0);
  });

  it("⚠ aligning it to the yearly quote invents the dry clause out of 343 days", () => {
    const own = readCycle(MONTHLY, SPEND, NOW)!;
    const aligned = alignToPreview(own, ANNUAL_QUOTE);

    /* This is the defect, in one line: a sentence about today's balance,
       keyed on a plan the customer is only looking at. */
    expect(aligned.daysLeft).toBe(343);
    expect(aligned.cycleLength).toBe(365);

    expect(readBurn(aligned, NOW).dryDays).toBeGreaterThan(0);
  });

  it("⚠ THE MECHANISM: the rate and the empty date are IDENTICAL, so only the cycle claim moved", () => {
    const own = readCycle(MONTHLY, SPEND, NOW)!;
    const aligned = alignToPreview(own, ANNUAL_QUOTE);

    /* `alignToPreview` overrides `daysLeft` and `cycleLength` and nothing else,
       so the divisor — and therefore every figure the customer could check — is
       untouched. The wrong basis did not mis-measure the burn; it attached a
       true burn to the wrong month and then did arithmetic across the two. */
    expect(aligned.spentOverDays).toBe(own.spentOverDays);
    expect(aligned.spent).toBe(own.spent);
    expect(aligned.remaining).toBe(own.remaining);

    const ownBurn = readBurn(own, NOW);
    const alignedBurn = readBurn(aligned, NOW);
    expect(alignedBurn.perDay).toBe(ownBurn.perDay);
    expect(alignedBurn.emptyOn!.getTime()).toBe(ownBurn.emptyOn!.getTime());

    /* And the clause the customer read is exactly this subtraction. */
    expect(alignedBurn.dryDays).toBe(Math.round(aligned.daysLeft - alignedBurn.daysToEmpty!));
    expect(ownBurn.dryDays).toBe(0);
  });

  it("a same-interval quote agrees with the account's own cycle — which is why a wrong basis ships", () => {
    const own = readCycle(MONTHLY, SPEND, NOW)!;
    const monthlyQuote = alignToPreview(own, { daysRemaining: 8, totalDays: 30 });
    expect(monthlyQuote.daysLeft).toBe(own.daysLeft);
    expect(monthlyQuote.cycleLength).toBe(own.cycleLength);
    expect(readBurn(monthlyQuote, NOW).dryDays).toBe(readBurn(own, NOW).dryDays);
  });
});

describe("#1739 · Add credits reads each cycle under the name that says which it is", () => {
  const source = code("AddCreditsModal.tsx");

  it("the burn band is keyed on the account's own cycle", () => {
    const reason = sourceBand(
      source,
      "burn?.emptyOn ?",
      "dp-topup__adjust",
      "the burn band",
    );
    expect(reason).toContain("ownCycle.daysLeft");
    expect(reason).toContain("ownCycle.spent");
    expect(reason).toContain("ownCycle.remaining");
    /* The quote's period must not reach this sentence by any name. */
    expect(reason).not.toContain("chargeCycle");
    expect(reason).not.toContain("preview");
  });

  it("the burn reading itself is computed from the account's own cycle", () => {
    expect(source).toContain("readBurn(ownCycle)");
    expect(source).not.toMatch(/readBurn\(\s*chargeCycle/);
  });

  it("the renewal line still quotes the charge's own period", () => {
    const renewal = sourceBand(
      source,
      "dp-topup__renewal",
      "</p>",
      "the renewal line",
    );
    expect(renewal).toContain("chargeCycle.daysLeft");
    expect(renewal).toContain("chargeCycle.renewsAt");
    expect(renewal).not.toContain("ownCycle");
  });

  it("⚠ the alignment is still DONE, so #1739's fix cannot re-open #664's defect", () => {
    expect(source).toContain("alignToPreview(ownCycle, preview)");
  });

  it("⚠ neither local carries a generic name a sentence could reach for by accident", () => {
    /* `rawCycle`/`cycle` is the shape the defect had: one of the two read like
       *the* cycle, so the wrong one was invisible at the call site. */
    expect(source).not.toContain("rawCycle");
    expect(source).not.toMatch(/\bconst cycle\b/);
    expect(source).not.toMatch(/[^a-zA-Z]cycle\.(daysLeft|cycleLength|renewsAt|spent|remaining)/);
  });
});

describe("#1739 · the sibling surface, read rather than assumed (law 7)", () => {
  it("ChangePlanModal passes its own cycle straight to readBurn and never aligns", () => {
    const sibling = code("ChangePlanModal.tsx");
    expect(sibling).toContain("readCycle(status, cycleSpend)");
    expect(sibling).toContain("readBurn(cycle)");
    /* It has never called `alignToPreview`; this arm is what stops it acquiring
       the defect later, which prose in a docblock cannot. */
    expect(sibling).not.toContain("alignToPreview");
  });
});

describe("#1739 · the one-caller claim is DERIVED, never typed", () => {
  /* Both docblocks that explain this defect assert `alignToPreview` has exactly
     one caller in the product. That is a claim about the tree, so it is read off
     the tree — a second caller is answering "what are we charging for?" and must
     say so deliberately rather than inheriting a sentence written for one. */
  function productionFilesCalling(symbol: string): string[] {
    const roots = ["client/src", "server", "shared"].map((relative) =>
      join(process.cwd(), relative),
    );
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          const stat = statSync(full, { throwIfNoEntry: false });
          if (!stat?.isDirectory()) continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        /* Tests and the declaring module itself are not callers. */
        if (/\.test\.(ts|tsx)$/.test(entry.name) || entry.name === "planMath.ts") continue;
        const body = readListedSource(full);
        if (body === null) continue;
        if (new RegExp("\\b" + symbol + "\\s*\\(").test(withoutComments(body))) {
          hits.push(full.slice(process.cwd().length + 1).replace(/\\/g, "/"));
        }
      }
    };
    for (const root of roots) {
      const stat = statSync(root, { throwIfNoEntry: false });
      if (stat?.isDirectory()) walk(root);
    }
    return hits.sort();
  }

  it("exactly one production caller, and it is the Add credits renewal line", () => {
    expect(productionFilesCalling("alignToPreview")).toEqual([
      "client/src/features/billing/AddCreditsModal.tsx",
    ]);
  });

  it("the walker can find a symbol at all — the positive control for the arm above", () => {
    /* A walker that reads nothing reports one caller as readily as none. */
    const readCycleCallers = productionFilesCalling("readCycle");
    expect(readCycleCallers).toContain("client/src/features/billing/AddCreditsModal.tsx");
    expect(readCycleCallers).toContain("client/src/features/billing/ChangePlanModal.tsx");
    expect(readCycleCallers.length).toBeGreaterThan(1);
  });
});

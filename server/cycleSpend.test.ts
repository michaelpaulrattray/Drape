import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { spendWindow } from "./db/billing";

/**
 * #624 — a cycle's spend counted the whole UTC DAY its period started on.
 *
 * ## What the defect was, in one sentence
 *
 * Every real Stripe period begins at a mid-day INSTANT, because it begins when
 * the customer pays. The three surfaces that quote a cycle's spend asked
 * `usage.getDailyUsage` for whole UTC days and filtered on the DAY of that
 * instant — so a period rolling over at 14:00 counted the fourteen hours of the
 * PREVIOUS cycle that shared its date. On day two of a cycle the divisor is
 * small, so the whole error rides the burn rate, and the burn rate picks the
 * rung the ink button offers.
 *
 * ## Why these arms are here and not in the client suites
 *
 * The window moved to the server, and it moved because it CANNOT be got right
 * on the client: day-keyed buckets have no sub-day edge to cut on. So the
 * decisions are proved here, against the function the query actually calls, and
 * the SQL that uses them is proved against real rows in
 * `server/cycleSpend-db.test.ts` — a boundary is a predicate, and a predicate
 * asserted about is not a predicate driven.
 *
 * The founder's word on the repair, verbatim (Crew reply #154, 2026-09-07):
 * *"(a), fix it, not urgent."*
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (path: string) => readFileSync(path, "utf8");
/** Strip comments — a rule quoted in prose is not a rule shipped. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DAY = 86_400_000;

describe("#624 — the window opens at the period's own instant, not at midnight", () => {
  it("⚠ THE DEFECT ITSELF: a period that began mid-day does not reach back to that morning", () => {
    /*
      THE ARM THE CARD WAS FILED FOR. The old road's edge was
      `periodStart.toISOString().slice(0, 10)` — the string "2026-09-05" — which
      as an instant is 14 hours EARLIER than a period that began at 14:00.
      Everything the customer spent in those hours belonged to the cycle before.
    */
    const periodStart = new Date("2026-09-05T14:00:00Z");
    const now = new Date("2026-09-06T06:00:00Z");
    const window = spendWindow(periodStart, now);

    expect(window.basis).toBe("period");
    expect(window.from.toISOString()).toBe("2026-09-05T14:00:00.000Z");

    /* The old edge, computed here rather than asserted about, so the arm shows
       the gap instead of claiming one. */
    const oldEdge = new Date(`${periodStart.toISOString().slice(0, 10)}T00:00:00Z`);
    expect(
      window.from.getTime() - oldEdge.getTime(),
      "the window still opens at midnight — this is the defect",
    ).toBe(14 * 3_600_000);
  });

  it("⚠ THE NEGATIVE CONTROL: a period that began at exactly midnight is unmoved", () => {
    /*
      The card's own bar, and the arm that says the repair did not move
      something it should not have. A period starting 00:00 UTC is the one case
      where the old day-key edge was already right; if this changed, the fix
      would be a different window rather than a more precise one.
    */
    const periodStart = new Date("2026-09-05T00:00:00Z");
    const now = new Date("2026-09-20T09:00:00Z");
    const window = spendWindow(periodStart, now);

    const oldEdge = new Date(`${periodStart.toISOString().slice(0, 10)}T00:00:00Z`);
    expect(window.from.getTime(), "the midnight case moved").toBe(oldEdge.getTime());
  });

  it("⚠ an ANNUAL period is summed from its own start — there is no 90-day edge left", () => {
    /*
      `usage.getDailyUsage` caps at 90 days, so the old road could only ever
      sum 90 of an annual period's 365 — the reviewer's finding on PR #622, and
      the reason `windowStart` had to return a SEEDED edge rather than the
      period's. The cap belongs to that endpoint, not to the question, and the
      question is no longer asked of it.
    */
    const now = new Date("2026-09-07T00:00:00Z");
    const periodStart = new Date(now.getTime() - 200 * DAY);
    const window = spendWindow(periodStart, now);

    expect(window.from.getTime()).toBe(periodStart.getTime());
    const spanDays = (now.getTime() - window.from.getTime()) / DAY;
    expect(spanDays, "the window is still being clipped to 90 days").toBe(200);
  });

  it("a period start in the FUTURE falls back rather than reporting a negative window", () => {
    /*
      ⚠ ASSERTED AS AN EQUIVALENCE, NOT BY THE FALLBACK'S NAME. The claim is
      *branch selection* — a period that has not begun is no period — so it is
      proved by the two calls agreeing, which stays true however the fallback is
      later worded. Stripe can hand us a scheduled period; a window with a
      negative span would divide a spend by a negative number of days.
    */
    const now = new Date("2026-09-01T10:32:00Z");
    expect(spendWindow(new Date("2026-10-01T00:00:00Z"), now)).toEqual(spendWindow(null, now));
  });

  it("an INVALID date is no period either, and does not become an invalid window", () => {
    const now = new Date("2026-09-01T10:32:00Z");
    const window = spendWindow(new Date("not a date"), now);
    expect(Number.isNaN(window.from.getTime()), "an invalid period start became the window").toBe(
      false,
    );
    expect(window).toEqual(spendWindow(null, now));
  });

  it("no billing period is a real 30-day window that reaches back past his last spend", () => {
    /*
      #387's own complaint, kept: *"its also showing that i've used no
      credits"*. His last spend was 2026-08-30 and the month rolled over on
      09-01, so an invented calendar month held nothing. A rolling 30 days
      reaches it, and it is measured in real time rather than in day keys.
    */
    const now = new Date("2026-09-01T10:32:00Z");
    const window = spendWindow(null, now);
    expect(window.basis).toBe("rolling30");
    expect(
      window.from.getTime() <= new Date("2026-08-30T23:59:59Z").getTime(),
      `the window opens at ${window.from.toISOString()}, after his last spend on 2026-08-30`,
    ).toBe(true);
    expect((now.getTime() - window.from.getTime()) / DAY).toBe(30);
  });
});

describe("#624 — the wire", () => {
  it("⚠ the procedure takes NO input, so the window is not the browser's to choose", () => {
    /*
      Enforcement invariant 3. A cycle spend feeds `recommendPlan`, which
      chooses the one ink button on Change plan; a client-supplied boundary
      would let the page decide which rung it is sold. There is nothing to send,
      which is a stronger control than validating what is sent.
    */
    const usage = code(read(join(HERE, "routes", "usage.ts")));
    const declaration = usage.slice(usage.indexOf("getCycleSpend: protectedProcedure"));
    const body = declaration.slice(0, declaration.indexOf("}),") + 3);

    expect(body, "the cycle-spend procedure grew an input schema").not.toContain(".input(");
    expect(body, "the user is no longer taken from the session").toContain("ctx.user.id");
  });

  it("⚠ the owner is in the WHERE of both statements, not checked and then dropped", () => {
    /* Enforcement invariant 1. Read at the reader itself: two statements, and
       each one carries `credits.userId` / `creditTransactions.userId`. */
    const billing = code(read(join(HERE, "db", "billing.ts")));
    const reader = billing.slice(billing.indexOf("export async function getCycleSpend"));

    expect(reader).toContain("eq(credits.userId, userId)");
    expect(reader).toContain("eq(creditTransactions.userId, userId)");
  });

  it("⚠ it REFUSES a missing database rather than answering a spend of zero", () => {
    /*
      Every other reader in `billing.ts` swallows and returns an empty shape,
      which is right for a chart and wrong here: zero is a REAL answer on this
      surface — somebody who has not cast this cycle — and it is the answer that
      makes the burn band hide itself. Returning it for a database that did not
      respond is a confident wrong number on the screen where people pay.
    */
    const billing = code(read(join(HERE, "db", "billing.ts")));
    const reader = billing.slice(billing.indexOf("export async function getCycleSpend"));

    expect(reader, "the cycle-spend reader started swallowing its own failure").not.toContain(
      "catch",
    );
    expect(reader).toContain("throw new Error");
  });

  it("⚠ no client file reassembles a cycle out of day buckets any more", () => {
    /*
      THE ARM THAT SURVIVES A REWRITE. `usage.getDailyUsage` was deleted with
      #635 (no caller after #624, no design asking for its chart); what must not
      come back — under that name or a new one — is a surface adding day buckets
      up to answer "what has this account spent this cycle", which is the shape
      both #385's repair and #624's defect had.
    */
    const client = join(HERE, "..", "client", "src", "features");
    for (const file of [
      join(client, "settings", "sections", "UsageSection.tsx"),
      join(client, "billing", "useCycleSpend.ts"),
      join(client, "settings", "usageWindow.ts"),
    ]) {
      expect(code(read(file)), `${file} sums day buckets again`).not.toContain("getDailyUsage");
    }
  });

  it("⚠ the two callerless usage procedures stay deleted (#635)", () => {
    /*
      `usage.getDailyUsage` and `usage.getStats` had no caller anywhere in the
      product after #624 and were removed with a manifest. An endpoint nobody
      calls and nobody has explained is the shape that gets re-wired wrongly —
      `getDailyUsage`'s whole-UTC-day buckets were the root of #385, #622 and
      #624. Putting either back is a deliberate act with a card, and a
      surface that wants day buckets writes a new procedure under its own name.
      The positive half keeps the matcher honest: the router must still carry
      `getCycleSpend` (three money surfaces call it) and `getHistory` — which
      has NO caller either, orphaned by the same Section 03 commit, and is
      filed as #833 rather than widened into #635's declared manifest. When
      #833 resolves, that line moves with it.
    */
    const usage = code(read(join(HERE, "routes", "usage.ts")));
    const billing = code(read(join(HERE, "db", "billing.ts")));
    expect(usage).not.toMatch(/getDailyUsage\s*:/);
    expect(usage).not.toMatch(/getStats\s*:/);
    expect(billing).not.toContain("export async function getDailyUsage");
    expect(billing).not.toContain("export async function getUsageStats");
    expect(usage).toMatch(/getCycleSpend\s*:/);
    expect(usage).toMatch(/getHistory\s*:/);
  });
});

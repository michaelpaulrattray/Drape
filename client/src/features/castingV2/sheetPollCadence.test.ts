/**
 * A QUIET SHEET POLLS SLOWLY.
 *
 * # The refusal
 *
 * The session query polled every 2.5 seconds for as long as the page was open,
 * whatever was or was not happening — 24 requests a minute per tab, forever.
 * On 2026-08-10 that spent the shared casting budget and production refused the
 * founder's own click: five `getSession` polls and one `selectVariant` came
 * back "Too many requests. Please try again in 14 seconds", while he was
 * reading a sheet from the previous day with nothing rendering at all.
 *
 * The server side of the fix is the bucket split (`castingRateLimitIntent`).
 * This is the other half, and it is the half that matters more: the split stops
 * a poller refusing a click, but only the gate stops the poller being wasteful
 * in the first place.
 *
 * # Why this reads the source
 *
 * `refetchInterval` is a TanStack option, so an assertion about it is an
 * assertion about what we HAND the library rather than about what our own code
 * computes — mounting the page to observe a cadence would test TanStack's
 * timer, not our rule. This is the same instrument `refineWait.test.ts` uses on
 * the sibling query, and the sibling is why this file exists: `getRoll` was
 * given an arrival gate, its comment predicted this exact failure in writing,
 * and `getSession` — the other half of the same sentence — was never swept.
 * Law 7, with the receipt.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SHEET = join(process.cwd(), "client", "src", "pages", "CastingSheet.tsx");

/** The options block of one named query, source-sliced. */
async function optionsOf(query: string): Promise<string> {
  const sheet = await readFile(SHEET, "utf8");
  const start = sheet.indexOf(`trpc.castingV2.${query}.useQuery`);
  expect(start, `${query} is not on the sheet at all`).toBeGreaterThan(-1);
  const body = sheet.slice(start);
  const interval = body.indexOf("refetchInterval:");
  expect(interval, `${query} has no refetchInterval`).toBeGreaterThan(-1);
  /* To the end of the callback — far enough to hold the whole gate and not so
     far that it picks up the next query's. */
  return body.slice(interval, interval + 900);
}

describe("the sheet's session poll is gated on something arriving", () => {
  it("is not a bare constant interval — the shape that caused the refusal", async () => {
    const options = await optionsOf("getSession");
    /*
      `refetchInterval: POLL_MS` is precisely what was there. A callback is the
      only shape that can slow down, so requiring one is requiring the fix
      rather than describing it.
    */
    expect(options).toMatch(/refetchInterval:\s*\(/);
    expect(options).not.toMatch(/refetchInterval:\s*POLL_MS\s*,/);
  });

  it("goes slow when every roll is terminal, and stays fast while one is not", async () => {
    const options = await optionsOf("getSession");
    expect(options).toContain("TERMINAL_ROLL_STATUSES");
    expect(options).toContain("IDLE_POLL_MS");
    expect(options).toContain("POLL_MS");
  });

  it("does not deadlock on a roll it has not been told about yet", async () => {
    /*
      The variants poll already paid for this lesson: gated on server data
      alone, a sheet that has just dispatched sees no non-terminal roll YET and
      would drop to the idle cadence in the one moment the user is waiting.
    */
    const options = await optionsOf("getSession");
    expect(options).toContain("startingRoll");
  });

  it("the idle cadence is genuinely slower, and the sheet never stops asking", async () => {
    const sheet = await readFile(SHEET, "utf8");
    const poll = /const POLL_MS = ([\d_]+);/.exec(sheet);
    const idle = /const IDLE_POLL_MS = ([\d_]+);/.exec(sheet);
    expect(poll, "POLL_MS is gone").toBeTruthy();
    expect(idle, "IDLE_POLL_MS is gone").toBeTruthy();
    const fast = Number(poll![1].replace(/_/g, ""));
    const slow = Number(idle![1].replace(/_/g, ""));
    expect(slow).toBeGreaterThan(fast);
    /*
      Slow, never OFF. A session changes from another tab and from the recovery
      sweep, and a sheet that stopped asking would sit stale until a remount —
      trading a rate limit for a lie about what the user is looking at.
    */
    const options = await optionsOf("getSession");
    expect(options).not.toContain("false");
    /* And slow enough to matter: an idle tab must cost under a third of what
       it used to, or this is a comment rather than a fix. */
    expect(slow).toBeGreaterThanOrEqual(fast * 3);
  });

  it("the viewed-roll poll keeps its own gate — the sibling that was already right", async () => {
    const options = await optionsOf("getRoll");
    expect(options).toContain("TERMINAL_ROLL_STATUSES");
    expect(options).toContain("stillArriving");
  });
});

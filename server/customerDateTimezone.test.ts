/**
 * #2363 — ONE INSTANT, ONE DAY, WHATEVER CLOCK RENDERS IT.
 *
 * `formatCustomerShortDate` runs on the server (the "starts on" toast, the
 * cancel receipt) AND in the browser (the Billing tab, the cancel dialog, the
 * change-plan step). It used to read the day off whatever clock rendered it, so
 * the same Stripe instant could be "8 Sept" on the customer's screen and
 * "9 Sept" in the sentence the server answered with. The rule is now UTC
 * everywhere; these arms move the HOST clock under the formatter and require
 * the day not to move with it.
 *
 * ⚠ The arms change `process.env.TZ` mid-process. Node honours that, but only
 * an instrument with a control is believed (working law 2): the first arm
 * proves the switch really moves an UNPINNED format, so a run where the TZ
 * change silently did nothing cannot pass the later arms for the wrong reason.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCustomerShortDate } from "@shared/customerDate";
import { cancelPlanBody, cancelledPlanSegment, planCancelledReceipt } from "@shared/planCancelCopy";
import { formatShortDate } from "../client/src/features/settings/planMath";

/** The dev billing fixture's real test-mode period end, read from Stripe 2026-10-12. */
const FIXTURE_PERIOD_END = new Date("2027-09-09T03:06:18Z");
/** The card's own example: 8 Nov in Brisbane, 7 Nov in UTC. */
const NEAR_MIDNIGHT = new Date("2026-11-07T20:00:00Z");

const EAST = "Australia/Brisbane"; // UTC+10, no daylight saving — the founder's clock
const WEST = "America/Los_Angeles";

let savedTz: string | undefined;
beforeEach(() => {
  savedTz = process.env.TZ;
});
afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
  vi.useRealTimers();
});

function unpinned(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

describe("#2363 — the customer's short date does not move with the host clock", () => {
  it("CONTROL: the TZ switch is live — an unpinned format DOES move", () => {
    process.env.TZ = "UTC";
    expect(unpinned(NEAR_MIDNIGHT)).toBe("7 Nov");
    expect(unpinned(FIXTURE_PERIOD_END)).toBe("9 Sept");
    process.env.TZ = EAST;
    expect(unpinned(NEAR_MIDNIGHT)).toBe("8 Nov");
    process.env.TZ = WEST;
    expect(unpinned(FIXTURE_PERIOD_END)).toBe("8 Sept");
  });

  it("the formatter names the UTC day on every clock", () => {
    for (const tz of ["UTC", EAST, WEST]) {
      process.env.TZ = tz;
      expect(formatCustomerShortDate(NEAR_MIDNIGHT), tz).toBe("7 Nov");
      expect(formatCustomerShortDate(FIXTURE_PERIOD_END), tz).toBe("9 Sept");
    }
  });

  it("POSITIVE CONTROL: an instant whose day agrees everywhere still reads its day", () => {
    const midday = new Date("2026-08-12T12:00:00Z");
    for (const tz of ["UTC", EAST, WEST]) {
      process.env.TZ = tz;
      expect(formatCustomerShortDate(midday), tz).toBe("12 Aug");
    }
  });

  it("the cancel dialog (browser) and the cancel receipt (server) name the same day", () => {
    for (const [browser, instant, day] of [
      [WEST, FIXTURE_PERIOD_END, "9 Sept"],
      [EAST, NEAR_MIDNIGHT, "7 Nov"],
    ] as const) {
      process.env.TZ = browser; // the customer's browser
      const dialog = cancelPlanBody(instant);
      const segment = cancelledPlanSegment(instant);
      const tab = formatShortDate(instant);
      process.env.TZ = "UTC"; // the server
      const receipt = planCancelledReceipt(instant);
      expect(dialog, browser).toContain(`until ${day}.`);
      expect(receipt, browser).toContain(`until ${day},`);
      expect(segment, browser).toContain(day);
      expect(tab, browser).toBe(day);
    }
  });

  it("a formatter LOADED under a non-UTC clock still names the UTC day (no zone frozen at import)", async () => {
    process.env.TZ = EAST;
    vi.resetModules();
    const fresh = await import("@shared/customerDate");
    process.env.TZ = "UTC";
    expect(fresh.formatCustomerShortDate(NEAR_MIDNIGHT)).toBe("7 Nov");
    process.env.TZ = WEST;
    expect(fresh.formatCustomerShortDate(FIXTURE_PERIOD_END)).toBe("9 Sept");
  });

  /* An arm stood here proving the frozen-account email's `frozen_date` was the
     UTC day. #2481 moved that email off Klaviyo onto Resend and its words into
     `server/mail.ts`, and the new notice prints no date at all — so its
     subject is gone rather than untested. */
});

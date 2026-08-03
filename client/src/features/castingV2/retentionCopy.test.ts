import { describe, expect, it } from "vitest";

import {
  RETENTION_EMPTY_STATE,
  isExpiryWarning,
  sheetAgeLine,
  sheetExpiryNotice,
} from "./retentionCopy";

/**
 * The retention confession.
 *
 * Seven quiet days has been enforced since M5 and said almost nowhere, so a
 * user could lose a sheet they were still thinking about without having been
 * told it was possible. These are the three surfaces that fix that, and the
 * assertions are mostly about the two ways this kind of copy lies: appearing
 * when it is not true yet, and claiming an event nobody can observe.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-08-01T12:00:00Z");
const inFuture = (ms: number) => new Date(NOW + ms).toISOString();
const inPast = (ms: number) => new Date(NOW - ms).toISOString();

describe("the card line", () => {
  it("says how long it has been idle, well before expiry is relevant", () => {
    const line = (ms: number) =>
      sheetAgeLine({ lastActivityAt: inPast(ms), expiresAt: inFuture(7 * DAY - ms) }, NOW);
    expect(line(2 * HOUR)).toBe("Rolled today");
    expect(line(26 * HOUR)).toBe("Rolled yesterday");
    expect(line(3 * DAY)).toBe("Rolled 3 days ago");
  });

  it("switches to expiry only inside the final two days", () => {
    const at = (left: number) =>
      sheetAgeLine({ lastActivityAt: inPast(7 * DAY - left), expiresAt: inFuture(left) }, NOW);
    // Outside the window it is still an age line — no early nagging.
    expect(at(3 * DAY)).toMatch(/^Rolled/);
    expect(at(2 * DAY + HOUR)).toMatch(/^Rolled/);
    // Inside it, it names the day.
    expect(at(2 * DAY - HOUR)).toBe("Expires tomorrow");
    expect(at(20 * HOUR)).toBe("Expires today");
  });

  it("never says 'in 1 days', which is where this copy usually goes wrong", () => {
    for (let hours = 1; hours < 48; hours += 1) {
      const line = sheetAgeLine(
        { lastActivityAt: inPast(7 * DAY - hours * HOUR), expiresAt: inFuture(hours * HOUR) },
        NOW,
      );
      expect(line).not.toMatch(/\b1 days\b/);
      expect(line).toMatch(/^Expires (today|tomorrow)$/);
    }
  });

  it("says nothing rather than something empty when it knows nothing", () => {
    expect(sheetAgeLine({ lastActivityAt: null, expiresAt: null }, NOW)).toBeNull();
    expect(sheetAgeLine({ lastActivityAt: "not a date", expiresAt: null }, NOW)).toBeNull();
  });

  it("marks only the expiry lines as warnings, so styling cannot drift from meaning", () => {
    expect(isExpiryWarning("Expires today")).toBe(true);
    expect(isExpiryWarning("Expires tomorrow")).toBe(true);
    expect(isExpiryWarning("Rolled 3 days ago")).toBe(false);
    expect(isExpiryWarning(null)).toBe(false);
  });
});

describe("the sheet's own line", () => {
  it("stays silent until expiry is close enough to act on", () => {
    expect(sheetExpiryNotice(inFuture(6 * DAY), NOW)).toBeNull();
    expect(sheetExpiryNotice(inFuture(2 * DAY + HOUR), NOW)).toBeNull();
  });

  it("names the day and the action, and nothing else", () => {
    expect(sheetExpiryNotice(inFuture(30 * HOUR), NOW)).toBe(
      "This sheet expires tomorrow — keep or sign what's worth holding.",
    );
    expect(sheetExpiryNotice(inFuture(3 * HOUR), NOW)).toBe(
      "This sheet expires today — keep or sign what's worth holding.",
    );
  });

  it("DOES offer to sign, now that the button exists", () => {
    /*
      The inverse of the assertion that stood here, and the inversion is the
      point rather than a rewrite.

      This test used to pin the opposite: the founder's draft read "keep or sign"
      while Sign was still M7 work, and offering a capability the product did not
      have is the one thing the honest-capability law forbids outright. So the
      words were removed and this stood as the reminder to add them the day the
      button shipped.

      Sign shipped in M7. The sentence went on saying "keep what's worth
      holding" for a while afterwards — honest, and describing a narrower
      product than the one in front of the user, which is the same staleness
      pointing the other way.
    */
    for (const hours of [1, 6, 20, 30, 46]) {
      expect(sheetExpiryNotice(inFuture(hours * HOUR), NOW)).toMatch(/sign/i);
    }
  });

  it("says nothing on a sheet that has already gone, or an unknown one", () => {
    expect(sheetExpiryNotice(inPast(HOUR), NOW)).toBeNull();
    expect(sheetExpiryNotice(null, NOW)).toBeNull();
    expect(sheetExpiryNotice("not a date", NOW)).toBeNull();
  });
});

describe("the empty state", () => {
  it("states the rule and never claims an event", () => {
    /*
      A sheet that expired and a sheet that was never cast leave exactly the
      same empty page — expired sessions are gone from the projection, so the
      client cannot tell them apart. Saying "your sheet expired" to someone who
      never made one would be inventing a history to fill a silence.
    */
    expect(RETENTION_EMPTY_STATE).toContain("7 quiet days");
    expect(RETENTION_EMPTY_STATE).not.toMatch(/your|expired sheet was|we deleted/i);
  });

  it("describes idle time, not age — the rule it is actually stating", () => {
    // `expiresAt` is reset on every touch, so a weekly visitor never expires.
    // "quiet" is load-bearing and must not become "old".
    expect(RETENTION_EMPTY_STATE).toMatch(/quiet/);
    expect(RETENTION_EMPTY_STATE).not.toMatch(/\bold\b|\bage\b/i);
  });
});

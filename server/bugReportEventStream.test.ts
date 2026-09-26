/**
 * A BUG REPORT REACHES THE EVENT STREAM — AND HER WORDS DO NOT (#509 part 2).
 *
 * The catalogue suite proves there is no property shape that would ACCEPT a
 * description. This proves the call site actually fires, and that what it hands
 * over is the category alone — invariant 7's *"a control that is not invoked does
 * not exist"*, read the other way round: a capture nothing drives is a capture
 * nobody knows is there.
 *
 * ⚠ **THE ORDER IS PART OF THE CLAIM.** The event fires AFTER `createBugReport`
 * returns an id. A report that failed to store must not be counted, so the arm
 * that matters most here is the one where the writer throws.
 *
 * The harness is `freeTextWhitespace.test.ts`'s, which already drives this
 * procedure: a plain ctx object satisfies the protected chain, and each arm gets
 * its own IP because the rate limiter is in-memory and would otherwise answer
 * for the arm above it.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockCreateBugReport = vi.fn();

vi.mock("./db", () => ({
  createBugReport: (...args: unknown[]) => mockCreateBugReport(...args),
}));

import { bugReportsRouter } from "./routes/bugReports";
import {
  resetProductEventsForTests,
  setProductEventClientForTests,
  type ProductEventClient,
} from "./monitoring/productEvents";

type Captured = { distinctId: string; event: string; properties: Record<string, unknown> };
let captured: Captured[] = [];

function recordingClient(): ProductEventClient {
  return {
    capture(payload) {
      captured.push(payload as Captured);
    },
    flush: async () => {},
    shutdown: async () => {},
  };
}

function ctx(id: number) {
  return {
    user: {
      id,
      role: "user",
      email: `user${id}@example.com`,
      name: "Someone",
      openId: null,
      suspendedAt: null,
      lockedUntil: null,
      approved: true,
      emailVerified: true,
    },
    req: { protocol: "https", ip: `198.51.100.${id}`, headers: {}, socket: {} },
    res: { clearCookie: vi.fn() },
  } as never;
}

const THE_WORDS = "Billing charged me twice and my cast came back wearing the wrong dress";

beforeEach(() => {
  vi.clearAllMocks();
  captured = [];
  mockCreateBugReport.mockResolvedValue(91);
  setProductEventClientForTests(recordingClient());
});

afterEach(() => {
  resetProductEventsForTests();
});

describe("a bug report is counted, and only counted", () => {
  it("records the event with the category she chose", async () => {
    const caller = bugReportsRouter.createCaller(ctx(21));

    await expect(caller.submit({ description: THE_WORDS, category: "billing" })).resolves.toMatchObject({
      success: true,
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("bug report sent");
    expect(captured[0].distinctId).toBe("21");
    expect(captured[0].properties.category).toBe("billing");
  });

  it("⚠ carries NONE of her words — not the description, not the page, not the browser", async () => {
    const caller = bugReportsRouter.createCaller(ctx(22));

    await caller.submit({
      description: THE_WORDS,
      category: "casting",
      page: "/studio/casting/sifr",
      viewport: "1920x1080",
    });

    expect(captured).toHaveLength(1);
    const wire = JSON.stringify(captured[0]);
    expect(wire, "a customer's own prose reached the event").not.toContain("charged me twice");
    expect(wire).not.toContain("wrong dress");
    expect(wire, "the route she was on is a place, and places identify people").not.toContain("sifr");
    expect(wire).not.toContain("1920x1080");
    /* Positively: the category and the two always-properties, nothing else. */
    expect(Object.keys(captured[0].properties).filter((k) => k !== "world" && k !== "release")).toEqual([
      "category",
    ]);
  });

  it("⚠ records NOTHING when the report did not store — a count of nothing is worse than no count", async () => {
    mockCreateBugReport.mockRejectedValue(new Error("the bug_reports table is unreachable"));
    const caller = bugReportsRouter.createCaller(ctx(23));

    await expect(caller.submit({ description: THE_WORDS, category: "ui" })).rejects.toThrow();

    expect(captured, "a failed report was counted as a report").toHaveLength(0);
  });

  it("the default category travels when she chooses none", async () => {
    const caller = bugReportsRouter.createCaller(ctx(24));

    await caller.submit({ description: THE_WORDS });

    expect(captured).toHaveLength(1);
    expect(captured[0].properties.category).toBe("other");
  });

  it("the stream being switched OFF changes nothing a customer sees (the no-key world)", async () => {
    setProductEventClientForTests(null);
    const caller = bugReportsRouter.createCaller(ctx(25));

    await expect(caller.submit({ description: THE_WORDS, category: "other" })).resolves.toMatchObject({
      success: true,
      id: 91,
    });

    expect(captured).toHaveLength(0);
  });

  it("POSITIVE CONTROL — the recorder does record, so the empty assertions above mean something", async () => {
    const caller = bugReportsRouter.createCaller(ctx(26));
    await caller.submit({ description: THE_WORDS, category: "export" });
    expect(captured).toHaveLength(1);
  });
});

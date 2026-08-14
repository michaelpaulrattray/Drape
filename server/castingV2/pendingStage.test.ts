import { describe, expect, it } from "vitest";

import { pendingStage } from "./pendingStage";

/**
 * The lease is the only thing that knows whether anyone is still rendering.
 *
 * A live refine renews it every 30 seconds, so "in the future" means a worker
 * was alive within the last half-minute; "in the past" means the worker is
 * gone and the recovery sweep owns the row. The founder's stuck render had a
 * last heartbeat at +60s and a lease that expired four minutes later, and for
 * that whole window the row still said `dispatched` — which is what the client
 * faithfully mirrored back at him as a locked sheet (fable-467).
 */

const NOW = new Date("2026-08-14T00:53:00.000Z");
const seconds = (n: number) => new Date(NOW.getTime() + n * 1000);

describe("a row with a living worker keeps its own state", () => {
  it("stays queued while the lease is ahead", () => {
    expect(pendingStage({
      status: "queued",
      leaseExpiresAt: seconds(240),
      now: NOW,
    })).toBe("queued");
  });

  it("stays dispatched while the lease is ahead", () => {
    /* The positive control for the whole rule: a render that IS happening must
       never read as settling, or the ask box re-arms beside a picture about to
       land and the same edit gets bought twice. */
    expect(pendingStage({
      status: "dispatched",
      leaseExpiresAt: seconds(1),
      now: NOW,
    })).toBe("dispatched");
  });
});

describe("a row past its lease is the sweep's, not the customer's", () => {
  it("reads settling once the lease has passed", () => {
    expect(pendingStage({
      status: "dispatched",
      leaseExpiresAt: seconds(-1),
      now: NOW,
    })).toBe("settling");
  });

  it("reads settling for a queued row too", () => {
    /* A worker that died before dispatching is just as dead. */
    expect(pendingStage({
      status: "queued",
      leaseExpiresAt: seconds(-90),
      now: NOW,
    })).toBe("settling");
  });

  it("takes the boundary itself as expired", () => {
    /* Equality goes to settling: the lease names the last instant it is valid,
       and the sweep's own eligibility test is `<= now`. Two rules disagreeing
       by one millisecond is the class this pins. */
    expect(pendingStage({
      status: "dispatched",
      leaseExpiresAt: NOW,
      now: NOW,
    })).toBe("settling");
  });
});

describe("cannot-tell claims less", () => {
  it("leaves a row with no readable lease exactly as it was", () => {
    /* `operationId` is NOT NULL with a unique index, so this is unreachable
       through the schema — which is precisely why the branch needs a test
       rather than an assumption. It must fail towards still-running. */
    expect(pendingStage({
      status: "dispatched",
      leaseExpiresAt: null,
      now: NOW,
    })).toBe("dispatched");
  });
});

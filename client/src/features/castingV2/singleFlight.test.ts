import { describe, expect, it } from "vitest";

import { createDispatchLatch } from "./singleFlight";

/**
 * The regression the founder asked for, at the level this repo can test in
 * `pnpm test` (node environment, no DOM): the guard that makes a triple-click
 * on Follow create exactly one roll.
 *
 * The browser drive proves the same thing through the real component; this
 * pins the semantics so they cannot be quietly refactored away.
 */
describe("single-flight latch", () => {
  it("lets exactly one of three same-frame clicks through", () => {
    const latch = createDispatchLatch();

    // Three clicks before any render, any poll, any await — the exact shape of
    // an impatient user on an affordance that has not answered yet.
    const results = [
      latch.tryAcquire("roll-1"),
      latch.tryAcquire("roll-1"),
      latch.tryAcquire("roll-1"),
    ];

    expect(results).toEqual([true, false, false]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("stays shut while the roll it paid for has not appeared", () => {
    const latch = createDispatchLatch();
    latch.tryAcquire("roll-1");

    // Poll after poll returns the same active roll: nothing has arrived, so
    // the latch must not reopen. This is the 2.5s window the founder clicked
    // through four times.
    expect(latch.settleIfArrived("roll-1")).toBe(false);
    expect(latch.settleIfArrived("roll-1")).toBe(false);
    expect(latch.tryAcquire("roll-1")).toBe(false);
    expect(latch.held).toBe(true);
  });

  it("opens as soon as the new roll exists, not when it finishes", () => {
    const latch = createDispatchLatch();
    latch.tryAcquire("roll-1");

    expect(latch.settleIfArrived("roll-2")).toBe(true);
    expect(latch.held).toBe(false);
    // And the next deliberate roll is allowed immediately.
    expect(latch.tryAcquire("roll-2")).toBe(true);
  });

  it("reopens on a failed dispatch so a refusal is not a dead end", () => {
    const latch = createDispatchLatch();
    latch.tryAcquire("roll-1");
    latch.release();
    expect(latch.held).toBe(false);
    expect(latch.tryAcquire("roll-1")).toBe(true);
  });

  it("treats a null current id as 'still nothing', never as arrival", () => {
    // A session that has not loaded yet reports null. Reading that as arrival
    // would reopen the latch during the very window it exists to cover.
    const latch = createDispatchLatch();
    latch.tryAcquire(null);
    expect(latch.settleIfArrived(null)).toBe(false);
    expect(latch.held).toBe(true);
    expect(latch.settleIfArrived("roll-1")).toBe(true);
  });
});

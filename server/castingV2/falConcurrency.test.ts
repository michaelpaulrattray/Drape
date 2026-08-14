/**
 * THE GATE, DRIVEN — including the two ways it could be worse than nothing.
 *
 * The defect it exists for is measured and quoted in `falConcurrency.ts`: the
 * account allows twenty concurrent requests, one panel scan asks eleven
 * questions at once with every bilateral one becoming two more, and the
 * founder's fresh casts came back with five rows of eight because the rest
 * 429'd and were swallowed as courtesy failures.
 *
 * A gate is a risk of its own — it can hold a slot while it sleeps and starve
 * the queue it is waiting for, and it can retry something that will never
 * improve. Both are driven here.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  CONCURRENCY_LIMIT_MARKER,
  falConcurrencyLimit,
  falGateStats,
  isConcurrencyLimit,
  throughFalGate,
} from "./falConcurrency";

const noSleep = async () => {};

afterEach(() => { delete process.env.FAL_CONCURRENCY; });

describe("how many at once", () => {
  it("never exceeds the limit, and lets the rest through afterwards", async () => {
    process.env.FAL_CONCURRENCY = "3";
    let running = 0;
    let peak = 0;
    const release: Array<() => void> = [];

    const calls = Array.from({ length: 9 }, () => throughFalGate(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise<void>((resolve) => release.push(() => { running -= 1; resolve(); }));
      return "done";
    }));

    /* Let the first wave reach the body, then let them go one at a time — the
       queue must refill to the ceiling and never past it. */
    for (let step = 0; step < 9; step += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      release.shift()?.();
    }
    await new Promise((resolve) => setImmediate(resolve));
    while (release.length) { release.shift()?.(); await new Promise((resolve) => setImmediate(resolve)); }

    expect(await Promise.all(calls)).toHaveLength(9);
    expect(peak).toBe(3);
    /* And it does not leak slots: everything is finished and nothing is held. */
    expect(falGateStats().inFlight).toBe(0);
    expect(falGateStats().waiting).toBe(0);
  });

  it("reads its limit from the environment, and falls back to a sane one", () => {
    process.env.FAL_CONCURRENCY = "11";
    expect(falConcurrencyLimit()).toBe(11);
    process.env.FAL_CONCURRENCY = "nonsense";
    expect(falConcurrencyLimit()).toBe(6);
    delete process.env.FAL_CONCURRENCY;
    /* Below the account's twenty on purpose: the roll engine's own dispatch
       spends from the same allowance. */
    expect(falConcurrencyLimit()).toBeLessThan(20);
  });
});

describe("what it waits out, and what it does not", () => {
  it("recognises the provider's own words for the ceiling", () => {
    expect(isConcurrencyLimit(new Error(`fal-ai/sam-3/image: 429 {"detail":"Reached concurrent requests `
      + `limit of 20","type":"${CONCURRENCY_LIMIT_MARKER}"}`))).toBe(true);
    expect(isConcurrencyLimit(new Error("fal-ai/sam-3/image: 400 bad request"))).toBe(false);
  });

  it("retries a ceiling 429 and returns the answer the second call gives", async () => {
    let attempts = 0;
    const answer = await throughFalGate(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error(`429 {"type":"${CONCURRENCY_LIMIT_MARKER}"}`);
      return "a mask";
    }, { sleep: noSleep });
    expect(answer).toBe("a mask");
    expect(attempts).toBe(2);
  });

  it("does NOT retry anything else — a 400 does not improve on the second ask", async () => {
    let attempts = 0;
    await expect(throughFalGate(async () => {
      attempts += 1;
      throw new Error("fal-ai/sam-3/image: 400 the prompt is empty");
    }, { sleep: noSleep })).rejects.toThrow(/400/);
    expect(attempts).toBe(1);
  });

  it("gives up eventually, and the last failure is the one the caller sees", async () => {
    let attempts = 0;
    await expect(throughFalGate(async () => {
      attempts += 1;
      throw new Error(`429 {"type":"${CONCURRENCY_LIMIT_MARKER}"} attempt ${attempts}`);
    }, { sleep: noSleep })).rejects.toThrow(/attempt 5/);
    /* Four retries after the first call, and then the truth. */
    expect(attempts).toBe(5);
  });

  it("RELEASES ITS SLOT WHILE IT WAITS — the way a gate makes things worse", async () => {
    /*
      A retry that slept inside its slot would hold the ceiling closed against
      the very calls it is waiting for, turning a burst into a deadlock that
      looks like slowness. Driven: while one call is between attempts, another
      must be able to run.
    */
    process.env.FAL_CONCURRENCY = "1";
    let ran = false;
    let attempts = 0;
    const waiting = throughFalGate(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error(`429 {"type":"${CONCURRENCY_LIMIT_MARKER}"}`);
      return "first";
    }, {
      sleep: async () => {
        /* Mid-wait: the other call must get the slot. */
        expect(await throughFalGate(async () => { ran = true; return "second"; })).toBe("second");
      },
    });
    expect(await waiting).toBe("first");
    expect(ran).toBe(true);
  });
});

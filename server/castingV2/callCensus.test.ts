/**
 * THE STOPWATCH, WITH ITS OWN CONTROLS ON IT.
 *
 * This is an instrument, and an instrument gets a negative control and a
 * positive control before its verdicts count for anything (working law 2). The
 * numbers it produces are about to steer a latency-and-cost program: a census
 * that silently missed a transport would send that program looking for minutes
 * in the wrong stage, and it would look exactly like a clean reading.
 *
 * So the last test here drives a REAL transport with a stubbed network and
 * asserts the call appears — the census counting itself proves nothing about
 * the four modules that are supposed to call it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  censusIsOpen,
  censusOfAttempt,
  censusSoFar,
  recordProviderCall,
  throughCensus,
  withCallCensus,
} from "./callCensus";
import { createOpenRouterTextEngine } from "../providers/openrouterText";

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

describe("what one request spent", () => {
  it("counts each call once, by stage and by model", async () => {
    const { census } = await withCallCensus(async () => {
      await throughCensus({ stage: "segment", provider: "fal", model: "sam3" }, () => sleep(5));
      await throughCensus({ stage: "segment", provider: "fal", model: "sam3" }, () => sleep(5));
      await throughCensus({ stage: "render", provider: "fal", model: "gpt-image-2" }, () => sleep(5));
    });

    expect(census.total.calls).toBe(3);
    expect(census.total.failed).toBe(0);
    expect(census.byStage.segment?.calls).toBe(2);
    expect(census.byStage.render?.calls).toBe(1);
    expect(census.byModel["fal:sam3"]?.calls).toBe(2);
    expect(census.total.ms).toBeGreaterThan(0);
  });

  it("counts a call that FAILED, and lets the failure through", async () => {
    /* A render that spent four calls and threw is the case the cost program
       most wants to see: it is money out with nothing delivered. A census that
       only counted successes would price the good days. */
    const { error, census } = await censusOfAttempt(async () => {
      await throughCensus({ stage: "read", provider: "openrouter", model: "x" }, () => sleep(1));
      await throughCensus({ stage: "render", provider: "fal", model: "y" }, async () => {
        throw new Error("the engine is down");
      });
    });

    expect((error as Error).message).toBe("the engine is down");
    expect(census.total.calls).toBe(2);
    expect(census.total.failed).toBe(1);
    expect(census.calls.find((call) => call.model === "y")?.ok).toBe(false);
  });

  it("says whether the seconds were spent side by side or one after another", async () => {
    /*
      THE PAIR THAT DECIDES WHERE OPTIMISING STARTS. Sum far above wall clock
      means the calls ran together and only the slowest matters; sum equal to
      wall clock means a queue of round trips, which is an architecture problem
      rather than a provider one. Driven both ways here so the reading is a
      measurement rather than a hope.
    */
    const { census: parallel } = await withCallCensus(async () => {
      await Promise.all([
        throughCensus({ stage: "segment", provider: "fal", model: "a" }, () => sleep(60)),
        throughCensus({ stage: "segment", provider: "fal", model: "b" }, () => sleep(60)),
        throughCensus({ stage: "segment", provider: "fal", model: "c" }, () => sleep(60)),
      ]);
    });
    expect(parallel.total.ms).toBeGreaterThan(parallel.wallMs * 1.5);

    const { census: serial } = await withCallCensus(async () => {
      await throughCensus({ stage: "segment", provider: "fal", model: "a" }, () => sleep(40));
      await throughCensus({ stage: "segment", provider: "fal", model: "b" }, () => sleep(40));
    });
    expect(serial.wallMs).toBeGreaterThanOrEqual(serial.total.ms * 0.8);
  });

  it("keeps two requests' spending apart, which is the whole reason it is a STORE", async () => {
    /*
      The property that makes this safe on a server serving more than one
      person: two refines in flight at once must not pool their calls, or the
      first cost table produced would be nonsense in a way nobody could see
      from the number itself.
    */
    const [one, two] = await Promise.all([
      withCallCensus(async () => {
        await throughCensus({ stage: "render", provider: "fal", model: "one" }, () => sleep(30));
      }),
      withCallCensus(async () => {
        await throughCensus({ stage: "render", provider: "fal", model: "two-a" }, () => sleep(5));
        await throughCensus({ stage: "render", provider: "fal", model: "two-b" }, () => sleep(5));
      }),
    ]);

    expect(one.census.calls.map((call) => call.model)).toEqual(["one"]);
    expect(two.census.calls.map((call) => call.model)).toEqual(["two-a", "two-b"]);
  });

  it("NEGATIVE CONTROL — outside a census it records nothing and breaks nothing", () => {
    /* A roll, a sign, a panel scan and every test in this repo call transports
       without opening a census. They must be untouched, and "untouched" has to
       be asserted rather than assumed: a store that threw or leaked here would
       take down paths that never asked for a stopwatch. */
    expect(censusIsOpen()).toBe(false);
    expect(censusSoFar()).toBeNull();
    expect(() => recordProviderCall({
      stage: "render", provider: "fal", model: "nobody-is-counting", ms: 5, ok: true,
    })).not.toThrow();
  });

  it("half-reads honestly, for a row written before the request ends", async () => {
    await withCallCensus(async () => {
      await throughCensus({ stage: "read", provider: "openrouter", model: "a" }, () => sleep(1));
      const midway = censusSoFar();
      expect(midway?.total.calls).toBe(1);
      await throughCensus({ stage: "read", provider: "openrouter", model: "b" }, () => sleep(1));
      expect(censusSoFar()?.total.calls).toBe(2);
    });
  });
});

describe("the transports actually call it", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("counts a real text engine's call, through its own code", async () => {
    /*
      ASSERT AT THE WIRE. Every test above proves the census can count; none of
      them proves the product calls it. This drives the shipped OpenRouter text
      engine with the network stubbed, so what is being checked is the wiring in
      `openrouterText.ts` rather than a fixture that agrees with itself.
    */
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }], model: "served/x" }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

    const engine = createOpenRouterTextEngine({ apiKey: "k", model: "test/model" });
    const { census } = await withCallCensus(async () => {
      await engine.complete({ system: "s", user: "u" });
    });

    expect(census.total.calls).toBe(1);
    expect(census.calls[0]!.stage).toBe("read");
    expect(census.calls[0]!.model).toBe("test/model");
    expect(census.calls[0]!.ok).toBe(true);
  });
});

/**
 * THE FIELD THAT WAS COLLECTED AND NEVER READ.
 *
 * `about` has been on every region call since `aboutOf` existed, and its own
 * comment names the prize — *"the difference between eleven segment calls and
 * eleven segment calls, six of them about eyes"*. Nothing summed it, so the
 * number that names the latency lever was invisible on every render the
 * founder has ever paid for.
 */
describe("what the questions cost", () => {
  it("sums the region calls by the thing they asked about", async () => {
    const { census } = await withCallCensus(async () => {
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 10, ok: true, about: "earring" });
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 30, ok: true, about: "earring" });
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 7, ok: true, about: "face" });
    });

    expect(census.byAbout).toEqual({
      earring: { calls: 2, ms: 40 },
      face: { calls: 1, ms: 7 },
    });
  });

  it("leaves out the calls that carry no question, rather than filing them under a blank", async () => {
    /* The interpreter and the treatment are asked in the customer's own prose,
       which is deliberately never recorded. A row of blanks would read as a
       question the product asks. */
    const { census } = await withCallCensus(async () => {
      recordProviderCall({ stage: "interpret", provider: "openrouter", model: "sonnet", ms: 5, ok: true });
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 9, ok: true, about: "lips" });
    });

    expect(census.byAbout).toEqual({ lips: { calls: 1, ms: 9 } });
  });
});

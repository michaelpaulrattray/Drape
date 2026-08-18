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

  /**
   * THE TOKENS, AT THE WIRE (fable-658 §4).
   *
   * Calls and milliseconds price a paint — a flat rate per picture. They cannot
   * price a READING, and readings are a fifth of every paid render, so the
   * money question stopped at the read stage even once its purposes were named.
   *
   * Driven through the shipped engine with the network stubbed, because the
   * thing under test is the parsing of a provider's reply and not a fixture's
   * agreement with itself.
   */
  const replyWith = (extra: Record<string, unknown>) => (async () => new Response(
    JSON.stringify({
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      model: "served/x",
      ...extra,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

  const spend = async (extra: Record<string, unknown>) => {
    globalThis.fetch = replyWith(extra);
    const engine = createOpenRouterTextEngine({ apiKey: "k", model: "test/model" });
    const { census } = await withCallCensus(async () => {
      await engine.complete({ system: "s", user: "u", about: "verify" });
    });
    return census;
  };

  it("records what a reading cost in tokens, from the provider's own usage", async () => {
    const census = await spend({ usage: { prompt_tokens: 1200, completion_tokens: 45 } });

    expect(census.calls[0]!.tokens).toEqual({ in: 1200, out: 45 });
    expect(census.total.tokensIn).toBe(1200);
    expect(census.total.tokensOut).toBe(45);
    expect(census.total.tokenCalls).toBe(1);
  });

  /*
    THE NEGATIVE CONTROL, and it is the one that matters for money.

    A provider that reports no usage must leave the call UNMEASURED, not free.
    Without `tokenCalls` beside the totals the two are the same number, and a
    cost report would quietly divide a real invoice by a token count that half
    the calls never contributed to.
  */
  it("leaves a reading UNMEASURED when the provider reports no usage — never zero", async () => {
    const census = await spend({});

    expect(census.calls[0]!.tokens).toBeUndefined();
    expect(census.total.tokenCalls).toBe(0);
    expect(census.total.tokensIn).toBe(0);
    /* One call was made and none of it was priced — the pair that says so. */
    expect(census.total.calls).toBe(1);
  });

  it("treats a usage shape it does not recognise as absent rather than as data", async () => {
    const census = await spend({ usage: { prompt_tokens: "1200", completion_tokens: -3 } });

    expect(census.calls[0]!.tokens).toBeUndefined();
    expect(census.total.tokenCalls).toBe(0);
  });

  it("records no tokens for a call that failed — there was no reply to read", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    const engine = createOpenRouterTextEngine({ apiKey: "k", model: "test/model" });
    const { census } = await withCallCensus(async () => {
      await engine.complete({ system: "s", user: "u", about: "verify" }).catch(() => undefined);
    });

    expect(census.total.failed).toBeGreaterThanOrEqual(1);
    expect(census.total.tokenCalls).toBe(0);
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

/**
 * AND THE DENOMINATOR THAT KEEPS THAT OMISSION HONEST.
 *
 * `byAbout` drops unlabelled calls; `byStage` and `byModel` beside it drop
 * nothing. Printed as siblings, they look like three views of one population
 * and are not — so the census carries the count of labelled calls, and the
 * report and the closing log line both state it above the table.
 *
 * The trap this closes is not today's window but the NEXT one. Today no read
 * call is labelled, so a question table full of region words is visibly odd.
 * Once the purposes start landing the table becomes MIXED, and a handful of
 * labelled reads among hundreds of unlabelled ones reads exactly like a working
 * attribution of the read stage while speaking for a sliver of it.
 */
describe("the question table carries its own denominator", () => {
  it("counts the labelled calls beside the total, so the subset is nameable", async () => {
    const { census } = await withCallCensus(async () => {
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 10, ok: true, about: "eye" });
      recordProviderCall({ stage: "read", provider: "openrouter", model: "sonnet", ms: 5, ok: true, about: "verify" });
      recordProviderCall({ stage: "read", provider: "openrouter", model: "sonnet", ms: 6, ok: true });
      recordProviderCall({ stage: "render", provider: "fal", model: "gpt-image-2", ms: 90, ok: true });
    });

    expect(census.total.calls).toBe(4);
    expect(census.total.labelledCalls).toBe(2);
  });

  /*
    THE NEGATIVE CONTROL. A counter that returned `total.calls` would pass the
    assertion above on any census whose calls all happen to be labelled, so the
    case that discriminates is the one where NONE is — and it must report zero
    rather than quietly agreeing with the total (working law 2).
  */
  it("CONTROL — reports ZERO on a window where nothing is labelled, not the total", async () => {
    const { census } = await withCallCensus(async () => {
      recordProviderCall({ stage: "interpret", provider: "openrouter", model: "sonnet", ms: 5, ok: true });
      recordProviderCall({ stage: "render", provider: "fal", model: "gpt-image-2", ms: 90, ok: true });
    });

    expect(census.total.calls).toBe(2);
    expect(census.total.labelledCalls).toBe(0);
    expect(census.byAbout).toEqual({});
  });

  /*
    AND THE ONE THE TWO READERS DISAGREED ON. `summarize` accepted any label
    that was merely PRESENT while `call-census-report.mts` required a non-empty
    string, so an empty label would have opened a blank-keyed row here and been
    invisible there — one field, two populations.
  */
  it("CONTROL — an empty label is not a label, and opens no blank row", async () => {
    const { census } = await withCallCensus(async () => {
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 8, ok: true, about: "" });
      recordProviderCall({ stage: "segment", provider: "fal", model: "sam-3", ms: 8, ok: true, about: "ear" });
    });

    expect(census.total.labelledCalls).toBe(1);
    expect(census.byAbout).toEqual({ ear: { calls: 1, ms: 8 } });
    expect(Object.keys(census.byAbout)).not.toContain("");
  });
});

/*
  THE SHADOWING IS PINNED, because it is documented behaviour that a driver will
  meet as a silent zero (opus-654, and the block above `withCallCensus`).

  Not a wish that nesting worked — an assertion of what it actually does, so
  that the day somebody makes an inner census merge upward, this reddens and the
  docblock gets corrected with it rather than quietly becoming a lie.
*/
describe("a census nested inside another", () => {
  it("SHADOWS it — the outer one reads zero for work the inner one counted", async () => {
    const { census: outer, value: inner } = await withCallCensus(async () => {
      /* Exactly the shape of a service that opens its own: `refineCandidate`
         at refineService.ts:630, `dispatchCandidate` at rollService.ts:485. */
      const { census } = await withCallCensus(async () => {
        recordProviderCall({ stage: "render", provider: "fal", model: "gpt-image-2/edit", ms: 117942, ok: true });
      });
      return census;
    });

    expect(inner.total.calls).toBe(1);
    /* The whole point: a real render, and the wrapper says nothing happened. */
    expect(outer.total.calls).toBe(0);
    expect(outer.total.failed).toBe(0);
    expect(outer.byModel).toEqual({});
  });

  it("POSITIVE CONTROL — the same call with no inner census DOES reach the outer one", async () => {
    const { census: outer } = await withCallCensus(async () => {
      recordProviderCall({ stage: "render", provider: "fal", model: "gpt-image-2/edit", ms: 117942, ok: true });
    });

    expect(outer.total.calls).toBe(1);
  });
});

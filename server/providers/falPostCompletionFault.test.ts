/**
 * A FRAME THE PROVIDER ALREADY FINISHED SAYS SO — at the transport, where the
 * fact lives (the relay's second finding on PR #1982, #1966).
 *
 * # What this is about
 *
 * `ProviderError.failureClass` answers *what went wrong*. It cannot answer
 * *whose frame it was*, and on a paid road that second question is the money
 * one: a job fal reports `COMPLETED` has been rendered and billed, so a loop
 * that re-asks buys ANOTHER frame rather than re-fetching the one we paid for.
 * Four of this transport's faults are raised after that point and every one of
 * them carries a retryable class — correctly, for a job that never ran.
 *
 * `ProviderError.completed` is that fact, and `providerAlreadyBilled` is how
 * the two arrival loops ask it. **This suite proves the TRANSPORT sets it.**
 *
 * ⚠ **IT EXISTS BECAUSE A SABOTAGE SURVIVED.** The orchestrator's arms build
 * their own `ProviderError`s, so they prove the loops honour the flag and
 * nothing about who raises it: with `completed: true` deleted from the
 * download-failure site, all ninety of them stayed green. A flag nothing is
 * driven against is a flag that can be dropped one site at a time.
 *
 * Nothing leaves the machine — `global.fetch` is stubbed — and no money moves.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFalSunburstSheetEngine } from "./falImages";
import { createFalIdentityEngine } from "./falQueue";
import { SIGN_SHEET_SIZES } from "../castingV2/signSheet";
import { ProviderError, providerAlreadyBilled } from "./types";

/** A 1x1 PNG, as bytes — enough for a data-URI round trip. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const REQUEST = {
  prompt: "A CHARACTER SHEET: one landscape photograph divided into 5 vertical panels",
  references: [{ bytes: PIXEL, contentType: "image/jpeg" }],
  resolution: "2K" as const,
};

/**
 * Drive the real transport with a scripted conversation.
 *
 * `submit`, `status` and `result` are each a `Response` the stub hands back, so
 * an arm scripts exactly the road it wants: a refused submit, a status that
 * never completes, or — the subject here — a COMPLETED job whose result goes
 * wrong afterwards.
 */
function run(script: {
  submit?: () => Response;
  status?: () => Response;
  result?: () => Response;
  /** For the CDN road: what the download of the image URL answers. */
  download?: () => Response;
}): Promise<unknown> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const address = String(url);
      if (init?.method === "POST" && !address.includes("/requests/")) {
        /* ⚠ A FRESH `Response` PER CALL, never one object reused. A body can
           be read once, and the engine's own `withRetry` calls this road again
           — the first draft handed back the same instance and the second
           attempt threw `Body is unusable` instead of the fault under test. */
        return script.submit?.() ?? new Response(JSON.stringify({ request_id: "post-completion-test" }), { status: 200 });
      }
      if (address.includes("/status")) {
        return script.status?.() ?? new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      if (address.startsWith("https://cdn.example.test/")) {
        return script.download?.() ?? new Response(PIXEL, { status: 200 });
      }
      return script.result?.() ?? new Response(JSON.stringify({ images: [] }), { status: 200 });
    }),
  );
  return createFalSunburstSheetEngine({
    apiKey: "test-key",
    size: SIGN_SHEET_SIZES.head,
    pollIntervalMs: 1,
  }).editWithReferences(REQUEST);
}

/** The error the transport actually threw, so the arms read a real object. */
async function faultFrom(script: Parameters<typeof run>[0]): Promise<ProviderError> {
  try {
    await run(script);
  } catch (error) {
    expect(error, "the transport threw something that is not a ProviderError").toBeInstanceOf(ProviderError);
    return error as ProviderError;
  }
  throw new Error("the transport returned a picture — this arm asserts a fault and there was none");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#1966 — a fault AFTER the job completed is marked as already bought", () => {
  it("a result fetch the provider refuses, once the status said COMPLETED", async () => {
    const fault = await faultFrom({
      result: () => new Response("slow down", { status: 429 }),
    });
    expect(fault.message).toContain("result fetch failed (429)");
    /* The CLASS is retryable and stays retryable — that is the honest answer
       about what went wrong, and it is why the flag had to be a second fact. */
    expect(fault.failureClass).toBe("rate_limit");
    expect(providerAlreadyBilled(fault), "a completed job's result fetch read as unbought").toBe(true);
  });

  it("a completed job with no image in the payload", async () => {
    const fault = await faultFrom({
      result: () => new Response(JSON.stringify({ images: [] }), { status: 200 }),
    });
    expect(fault.message).toBe("fal.ai completed without an image");
    expect(fault.failureClass).toBe("unknown");
    expect(providerAlreadyBilled(fault)).toBe(true);
  });

  it("a data URI with no comma in it", async () => {
    const fault = await faultFrom({
      result: () => new Response(
        JSON.stringify({ images: [{ url: "data:image/png;base64", content_type: "image/png" }] }),
        { status: 200 },
      ),
    });
    expect(fault.message).toBe("fal.ai returned a malformed data URI");
    expect(fault.failureClass).toBe("unknown");
    expect(providerAlreadyBilled(fault)).toBe(true);
  });

  it("a CDN object that will not download", async () => {
    const fault = await faultFrom({
      result: () => new Response(
        JSON.stringify({ images: [{ url: "https://cdn.example.test/frame.png", content_type: "image/png" }] }),
        { status: 200 },
      ),
      download: () => new Response("gone", { status: 503 }),
    });
    expect(fault.message).toBe("could not download fal.ai result");
    /* `transport` is the honest class for a CDN fetch that failed, and it is in
       nobody's terminal set — which is exactly the shape that was re-bought. */
    expect(fault.failureClass).toBe("transport");
    expect(providerAlreadyBilled(fault)).toBe(true);
  });
});

describe("#1966 — THE CONTROL: a job that never ran is not marked as bought", () => {
  /*
    Law 2. Every arm above asserts `true`, and a flag hard-coded to `true`, or a
    predicate that ignores its argument, would satisfy all four. These are the
    same transport, failing BEFORE the job completes, and they must read false —
    otherwise a real outage would stop being retried for every road at once.
  */
  it("a submit the provider refuses", async () => {
    const fault = await faultFrom({
      submit: () => new Response("slow down", { status: 429 }),
    });
    expect(fault.message).toContain("refused the request (429)");
    expect(fault.failureClass).toBe("rate_limit");
    expect(providerAlreadyBilled(fault), "an unrun job read as already bought").toBe(false);
  });

  it("a submit that answers with no request id", async () => {
    const fault = await faultFrom({
      submit: () => new Response(JSON.stringify({}), { status: 200 }),
    });
    expect(fault.message).toBe("fal.ai returned no request id");
    expect(providerAlreadyBilled(fault)).toBe(false);
  });

  it("a status check the provider refuses", async () => {
    const fault = await faultFrom({
      status: () => new Response("boom", { status: 503 }),
    });
    expect(fault.message).toBe("fal.ai status check failed");
    expect(fault.failureClass).toBe("transport");
    expect(providerAlreadyBilled(fault)).toBe(false);
  });
});

describe("#1966 — the predicate reads the error, not the class", () => {
  it("says no to anything that is not a ProviderError, and to an unflagged one", () => {
    expect(providerAlreadyBilled(new Error("a bare error"))).toBe(false);
    expect(providerAlreadyBilled(null)).toBe(false);
    expect(providerAlreadyBilled(new ProviderError("transport", "never ran"))).toBe(false);
    expect(providerAlreadyBilled(
      new ProviderError("transport", "bought", { completed: true }),
    )).toBe(true);
  });
});

/*
  #2032 — THE LAYER UNDERNEATH. Everything above proves the transport SETS the
  flag. These arms prove the engine's own `withRetry` READS it: a real fal
  engine, the real queue, the real retry loop, and a stubbed `fetch` that counts
  how many times a job was SUBMITTED — the one request fal bills for. A
  post-completion fault must submit exactly once; the pre-completion control
  must still be retried to the budget (1 + 2 retries = 3), or the guard has
  silently stopped retrying real outages.
*/
function countingFetch(script: {
  submit?: () => Response;
  result?: () => Response;
  download?: () => Response;
}): { submits: () => number } {
  let submits = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const address = String(url);
      if (init?.method === "POST" && !address.includes("/requests/")) {
        submits += 1;
        return script.submit?.() ?? new Response(JSON.stringify({ request_id: `submit-${submits}` }), { status: 200 });
      }
      if (address.includes("/status")) {
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      if (address.startsWith("https://cdn.example.test/")) {
        return script.download?.() ?? new Response(PIXEL, { status: 200 });
      }
      return script.result?.() ?? new Response(JSON.stringify({ images: [] }), { status: 200 });
    }),
  );
  return { submits: () => submits };
}

const ENGINES = {
  "the Sign sheet engine (Sunburst edit)": () =>
    createFalSunburstSheetEngine({ apiKey: "test-key", size: SIGN_SHEET_SIZES.head, pollIntervalMs: 1 })
      .editWithReferences(REQUEST),
  "the identity engine (Nano Banana Pro edit — delivered views, refine)": () =>
    createFalIdentityEngine({ apiKey: "test-key", pollIntervalMs: 1 }).editWithReferences(REQUEST),
};

describe("#2032 — the engine's own retry never re-buys a frame fal already finished", () => {
  for (const [name, call] of Object.entries(ENGINES)) {
    /*
      ⚠ Only the RETRYABLE post-completion faults are subjects here. The card
      listed `unknown` among them, and read at the code it is not: `unknown` is
      outside `RETRYABLE_FAILURES` (`types.ts`), so an empty payload or a
      malformed data URI was never re-submitted by this loop. The two that WERE
      re-bought are the result fetch refused (its HTTP class — `rate_limit`
      here) and the CDN download that fails (`transport`).
    */
    it(`${name}: a completed job whose image will not download is submitted exactly ONCE`, async () => {
      const wire = countingFetch({
        result: () => new Response(
          JSON.stringify({ images: [{ url: "https://cdn.example.test/frame.png", content_type: "image/png" }] }),
          { status: 200 },
        ),
        download: () => new Response("gone", { status: 503 }),
      });
      const fault = await call().then(
        () => { throw new Error("the engine returned a picture — this arm asserts a fault"); },
        (error: unknown) => error,
      );
      expect((fault as ProviderError).failureClass).toBe("transport");
      expect(providerAlreadyBilled(fault)).toBe(true);
      expect(wire.submits(), "a post-completion fault bought another frame").toBe(1);
    });

    it(`${name}: a completed job whose result fetch is refused is submitted exactly ONCE`, async () => {
      const wire = countingFetch({
        result: () => new Response("slow down", { status: 429 }),
      });
      await expect(call()).rejects.toBeInstanceOf(ProviderError);
      expect(wire.submits(), "a post-completion fault bought another frame").toBe(1);
    });

    it(`${name}: THE CONTROL — a submit refused before any job ran is still retried to the budget`, async () => {
      const wire = countingFetch({
        submit: () => new Response("slow down", { status: 429 }),
      });
      const fault = await call().then(
        () => { throw new Error("the engine returned a picture — this arm asserts a fault"); },
        (error: unknown) => error,
      );
      expect(providerAlreadyBilled(fault)).toBe(false);
      expect(wire.submits(), "a job that never ran stopped being retried").toBe(3);
    });
  }
});

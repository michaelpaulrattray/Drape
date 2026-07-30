import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenRouterCreativeEngine, estimateCandidateCostUsd } from "./openrouterImages";
import { createFalIdentityEngine } from "./falQueue";
import { classifyFalHttp, isContentRefusal } from "./falTransport";
import { ProviderQueue, withRetry } from "./providerQueue";
import { ProviderError, isRetryable, RETRYABLE_FAILURES, type ProviderFailureClass } from "./types";

/**
 * Provider contract tests (plan §M "Provider-adapter contract tests").
 *
 * Zero live provider calls: `fetch` is stubbed with recorded response shapes.
 * What these pin is the part that has to be right before money is spent —
 * that every provider error lands in the correct failure class, that
 * non-retryable classes are not retried, that admission refusal happens
 * *before* dispatch, and that a provider URL never escapes.
 *
 * The M3 calibration run replaces these hand-written shapes with scrubbed real
 * responses: one spend, two artifacts.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((input: unknown, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))) as typeof fetch;
}

const PNG_BYTES = Buffer.from("fake-png-bytes");

describe("failure taxonomy", () => {
  it("retries only transport, rate limit and timeout", () => {
    expect([...RETRYABLE_FAILURES].sort()).toEqual(["rate_limit", "timeout", "transport"]);
  });

  it("treats unknown as terminal so unmapped failures fail closed", () => {
    // The alternative — retrying what we do not understand — burns budget to
    // reach the same answer, and hides the mapping gap.
    expect(isRetryable("unknown")).toBe(false);
    expect(isRetryable("content_policy")).toBe(false);
    expect(isRetryable("capability")).toBe(false);
  });
});

describe("OpenRouter creative engine", () => {
  const engine = () =>
    createOpenRouterCreativeEngine({
      apiKey: "test-key",
      queue: new ProviderQueue({ name: "test", concurrency: 4, maxQueueDepth: 8 }),
    });

  const request = { prompt: "a dad in his 30s", size: "1024x1536" as const, quality: "medium" as const };

  it("returns bytes and pinned provenance, never a provider URL", async () => {
    stubFetch(() =>
      new Response(
        JSON.stringify({
          data: [{ b64_json: PNG_BYTES.toString("base64"), url: "https://provider.example/leak.png" }],
          model: "gpt-image-2-2026-04-21",
        }),
        { status: 200, headers: { "x-request-id": "req-1" } },
      ),
    );

    const result = await engine().generateCandidate(request);

    expect(result.bytes.toString()).toBe("fake-png-bytes");
    expect(result.provenance.servedModel).toBe("gpt-image-2-2026-04-21");
    expect(result.provenance.provider).toBe("openrouter");
    // Nothing in the result may carry the provider's own URL.
    expect(JSON.stringify(result)).not.toContain("provider.example");
  });

  it("maps a moderation refusal to content_policy and does not retry it", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return new Response("request rejected by safety system", { status: 400 });
    });

    await expect(engine().generateCandidate(request)).rejects.toMatchObject({
      failureClass: "content_policy" satisfies ProviderFailureClass,
    });
    expect(calls, "a policy refusal must not be retried").toBe(1);
  });

  it("maps 429 to rate_limit and retries it", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      if (calls < 3) return new Response("slow down", { status: 429 });
      return new Response(JSON.stringify({ data: [{ b64_json: PNG_BYTES.toString("base64") }] }), {
        status: 200,
      });
    });

    const result = await engine().generateCandidate(request);
    expect(result.bytes.length).toBeGreaterThan(0);
    expect(calls).toBe(3);
  });

  it("treats a 200 with no image as a failure rather than an empty candidate", async () => {
    stubFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(engine().generateCandidate(request)).rejects.toMatchObject({
      failureClass: "unknown",
    });
  });

  it("prices portrait candidates above the square list price", () => {
    const square = estimateCandidateCostUsd({ ...request, size: "1024x1024" });
    const portrait = estimateCandidateCostUsd(request);
    expect(portrait).toBeGreaterThan(square);
    // 1024×1536 is 1.5× the pixels; the estimate must reflect that, or the
    // harness ceiling under-counts what a run actually costs.
    expect(portrait / square).toBeCloseTo(1.5, 5);
  });
});

describe("Fal identity engine", () => {
  const engine = () =>
    createFalIdentityEngine({
      apiKey: "test-key",
      pollIntervalMs: 1,
      queue: new ProviderQueue({ name: "test-fal", concurrency: 2, maxQueueDepth: 8 }),
    });

  const reference = { bytes: PNG_BYTES, contentType: "image/png" };
  const request = {
    prompt: "hold this face",
    references: [reference],
    resolution: "2K" as const,
  };

  it("refuses more than the documented 14 references before dispatching", async () => {
    let called = false;
    stubFetch(() => {
      called = true;
      return new Response("{}", { status: 200 });
    });

    await expect(
      engine().editWithReferences({ ...request, references: Array(15).fill(reference) }),
    ).rejects.toMatchObject({ failureClass: "capability" });
    expect(called, "the ceiling must be enforced before paying to discover it").toBe(false);
  });

  it("walks submit → status → result and downloads the bytes itself", async () => {
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      if (url.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      if (url.includes("/requests/") && !url.endsWith("/cancel")) {
        return new Response(
          JSON.stringify({ images: [{ url: "https://fal.example/out.png", content_type: "image/png" }] }),
          { status: 200 },
        );
      }
      if (url.startsWith("https://fal.example")) return new Response(PNG_BYTES, { status: 200 });
      return new Response(JSON.stringify({ request_id: "req-9" }), { status: 200 });
    });

    const result = await engine().editWithReferences(request);

    expect(result.bytes.toString()).toBe("fake-png-bytes");
    expect(result.provenance.providerRef).toBe("req-9");
    expect(seen.some((url) => url.startsWith("https://fal.example"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("fal.example");
  });

  it("polls the URLs fal returns rather than constructing them", async () => {
    /*
      Regression. For sub-path endpoints the queue URLs drop the trailing
      segment — an `/edit` submit is polled at the base path. Constructing the
      poll URL from the submit endpoint returns 405 forever, which is how the
      first real calibration run lost its entire identity phase and reported a
      capability failure that was actually our bug.
    */
    const polled: string[] = [];
    stubFetch((url) => {
      if (url.endsWith("/status")) {
        polled.push(url);
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      if (url === "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-7") {
        return new Response(
          JSON.stringify({ images: [{ url: "https://fal.example/o.png", content_type: "image/png" }] }),
          { status: 200 },
        );
      }
      if (url.startsWith("https://fal.example")) return new Response(PNG_BYTES, { status: 200 });
      // The submit response is the contract: it names where to poll.
      return new Response(
        JSON.stringify({
          request_id: "req-7",
          status_url: "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-7/status",
          response_url: "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-7",
          cancel_url: "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-7/cancel",
        }),
        { status: 200 },
      );
    });

    const result = await engine().editWithReferences(request);

    expect(result.bytes.toString()).toBe("fake-png-bytes");
    expect(polled).toEqual(["https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-7/status"]);
    expect(
      polled.some((url) => url.includes("/edit/requests")),
      "must not rebuild the poll URL from the submit endpoint",
    ).toBe(false);
  });

  it("cancels the request when its deadline expires, so a timeout is not silent spend", async () => {
    const cancelled: string[] = [];
    stubFetch((url) => {
      if (url.endsWith("/cancel")) {
        cancelled.push(url);
        return new Response("", { status: 202 });
      }
      if (url.endsWith("/status")) return new Response(JSON.stringify({ status: "IN_QUEUE" }), { status: 200 });
      return new Response(JSON.stringify({ request_id: "req-slow" }), { status: 200 });
    });

    const slow = createFalIdentityEngine({
      apiKey: "test-key",
      pollIntervalMs: 1,
      timeoutMs: 30,
      queue: new ProviderQueue({ name: "test-slow", concurrency: 2, maxQueueDepth: 8 }),
    });

    await expect(slow.editWithReferences(request)).rejects.toMatchObject({
      failureClass: "timeout",
    });

    // Three, not one: a timeout is retryable (§H.5), so there are three
    // attempts and each cleans up after itself. What matters is that no
    // attempt is left in flight — an orphaned request is spend we abandoned
    // without a result. Worth noting for the calibration report: a slow
    // provider costs up to 3× in COGS even though the *user* is charged once.
    expect(cancelled.length, "every attempt must cancel its own request").toBe(3);
  });
});

describe("content-refusal classification", () => {
  /*
    Regression from the M3 calibration run. The original matcher included the
    bare token "content", so any 400 whose body mentioned `content_type` was
    classified `content_policy` — non-retryable — and five candidates were
    permanently failed. Re-running one of the same prompts succeeded straight
    away, proving they were transient.

    The asymmetry matters: a real refusal retried wastes pennies; a transient
    error marked terminal loses a candidate the user paid for.
  */
  it("does not treat an incidental mention of content as a refusal", () => {
    expect(isContentRefusal('{"detail":"bad content_type header"}')).toBe(false);
    expect(isContentRefusal('{"error":"upstream returned no content"}')).toBe(false);
    expect(isContentRefusal('{"detail":"request rejected"}')).toBe(false);
  });

  it("still recognises a real refusal", () => {
    expect(isContentRefusal("blocked by safety system")).toBe(true);
    expect(isContentRefusal("This request violates our usage policies")).toBe(true);
    expect(isContentRefusal('{"detail":"content_policy_violation"}')).toBe(true);
    expect(isContentRefusal("NSFW content detected")).toBe(true);
    expect(isContentRefusal("prohibited content")).toBe(true);
  });

  it("classifies an ambiguous 400 as capability, which is at least not silent", () => {
    expect(classifyFalHttp(400, '{"detail":"bad content_type"}')).toBe("capability");
    expect(classifyFalHttp(400, "blocked by safety system")).toBe("content_policy");
    expect(classifyFalHttp(500, "boom")).toBe("transport");
    expect(classifyFalHttp(429, "slow down")).toBe("rate_limit");
  });
});

describe("provider queue admission", () => {
  it("refuses before dispatch once the breaker opens", async () => {
    const queue = new ProviderQueue({
      name: "flaky",
      concurrency: 2,
      maxQueueDepth: 8,
      failureThreshold: 2,
      cooldownMs: 10_000,
    });

    const boom = () => Promise.reject(new ProviderError("transport", "down"));
    await expect(queue.run("a", boom)).rejects.toThrow();
    await expect(queue.run("b", boom)).rejects.toThrow();

    let dispatched = false;
    await expect(
      queue.run("c", async () => {
        dispatched = true;
        return "never";
      }),
    ).rejects.toMatchObject({ failureClass: "capability" });

    expect(dispatched, "a refused call must provably cost nothing").toBe(false);
    expect(queue.stats().breaker).toBe("open");
  });

  it("does not let content refusals trip the breaker", async () => {
    const queue = new ProviderQueue({
      name: "policy",
      concurrency: 2,
      maxQueueDepth: 8,
      failureThreshold: 2,
    });

    const refuse = () => Promise.reject(new ProviderError("content_policy", "no"));
    await expect(queue.run("a", refuse)).rejects.toThrow();
    await expect(queue.run("b", refuse)).rejects.toThrow();
    await expect(queue.run("c", refuse)).rejects.toThrow();

    // A run of policy refusals says nothing about provider health; tripping
    // the breaker would take the provider away from everyone else.
    expect(queue.stats().breaker).toBe("closed");
  });

  it("refuses when the queue is full rather than queueing unbounded spend", async () => {
    const queue = new ProviderQueue({ name: "full", concurrency: 1, maxQueueDepth: 2 });
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = queue.run("1", () => blocked.then(() => "done"));
    const second = queue.run("2", () => blocked.then(() => "done"));
    await expect(queue.run("3", async () => "nope")).rejects.toMatchObject({
      failureClass: "capability",
    });

    release?.();
    await Promise.all([first, second]);
  });
});

describe("retry policy", () => {
  it("stops at the configured ceiling", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        "x",
        async () => {
          attempts += 1;
          throw new ProviderError("transport", "nope");
        },
        { retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow();
    expect(attempts).toBe(3);
  });

  it("refuses to dispatch at all once the caller has aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let attempts = 0;
    await expect(
      withRetry(
        "x",
        async () => {
          attempts += 1;
          return "ran";
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ failureClass: "capability" });
    expect(attempts).toBe(0);
  });
});

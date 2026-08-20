import { afterEach, describe, expect, it, vi } from "vitest";

import { BANNED_ENGINES, BANNED_MODEL_SLUGS, isBannedEngine } from "./bannedEngines";
import { runFalImageJob } from "./falTransport";
import { createOpenRouterCreativeEngine } from "./openrouterImages";
import { ProviderQueue } from "./providerQueue";

/**
 * THE FLUX BAN, AS A CONTROL RATHER THAN A NOTE.
 *
 * The founder banned FLUX.2 PRO 0-for-4 on 2026-08-07 and the ruling lived for
 * ten days as a constant nothing read. What has to be true for it to be a
 * control is that a dispatch which SELECTS a banned engine cannot reach the
 * wire — so every refusal arm below is paired with a POSITIVE CONTROL on the
 * same harness: the identical call with an allowed engine must reach `fetch`
 * and come back with bytes. Without that pair, a harness that simply never
 * dispatched would score as a passing ban.
 *
 * Zero live provider calls; `fetch` is stubbed and counted.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const PNG_BYTES = Buffer.from("fake-png-bytes");

/** Counts every outgoing request, so "never dispatched" is a measurement. */
function countingFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  globalThis.fetch = ((input: unknown) => {
    calls.push(String(input));
    return Promise.resolve(handler(String(input)));
  }) as typeof fetch;
  return calls;
}

/** A fal queue walk that completes: submit → status COMPLETED → inline result. */
function falHappyPath(url: string): Response {
  if (url.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }));
  if (url.includes("/requests/")) {
    return new Response(
      JSON.stringify({
        images: [
          {
            url: `data:image/png;base64,${PNG_BYTES.toString("base64")}`,
            content_type: "image/png",
          },
        ],
      }),
    );
  }
  return new Response(
    JSON.stringify({
      request_id: "req-1",
      status_url: "https://queue.fal.run/x/requests/req-1/status",
      response_url: "https://queue.fal.run/x/requests/req-1",
      cancel_url: "https://queue.fal.run/x/requests/req-1/cancel",
    }),
  );
}

const falJob = (endpoint: string) =>
  runFalImageJob({
    apiKey: "test-key",
    endpoint,
    body: { prompt: "a face" },
    timeoutMs: 5_000,
    pollIntervalMs: 1,
  });

describe("the ban list itself", () => {
  it("carries the founder's two fal ids", () => {
    expect(BANNED_ENGINES).toContain("fal-ai/flux-2-pro");
    expect(BANNED_ENGINES).toContain("fal-ai/flux-2-pro/edit");
  });

  it("derives its model slugs from that list rather than mirroring it", () => {
    // Law 4: one source. Both ids are the same model, so there is one slug.
    expect([...BANNED_MODEL_SLUGS]).toEqual(["flux-2-pro"]);
  });

  it("bans the model however a vendor spells it", () => {
    for (const engine of BANNED_ENGINES) expect(isBannedEngine(engine)).toBe(true);
    // The same model on the other transport, which an exact-match guard misses.
    expect(isBannedEngine("black-forest-labs/flux-2-pro")).toBe(true);
    expect(isBannedEngine("FAL-AI/FLUX-2-PRO/EDIT")).toBe(true);
  });

  it("does not ban the engines this program actually runs", () => {
    // The negative control. A guard that refuses everything would pass every
    // test above and take the product down.
    expect(isBannedEngine("openai/gpt-image-2")).toBe(false);
    expect(isBannedEngine("openai/gpt-image-2/edit")).toBe(false);
    expect(isBannedEngine("fal-ai/nano-banana-pro/edit")).toBe(false);
    expect(isBannedEngine("google/gemini-2.5-flash-image")).toBe(false);
  });
});

/**
 * THE UPSCALER'S SHAPE, AND IT COST TWO PAID CALLS TO FIND (opus-903 §6b, ruled
 * fable-1210 §1c).
 *
 * Every GENERATOR answers `images: [...]`. An UPSCALER answers `image: { url }`,
 * SINGULAR — and this parser read only the plural, so a job that RAN and cost
 * money came back as *"fal.ai completed without an image"*: a shape mismatch
 * reported as a provider failure. Both shapes are arms, and the plural still
 * wins where both are present, so no generator's behaviour moved.
 */
describe("the result shape", () => {
  const singular = (url: string) => (target: string): Response => {
    if (target.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }));
    if (target.includes("/requests/")) {
      return new Response(JSON.stringify({ image: { url, content_type: "image/png" } }));
    }
    return new Response(JSON.stringify({
      request_id: "req-1",
      status_url: "https://queue.fal.run/x/requests/req-1/status",
      response_url: "https://queue.fal.run/x/requests/req-1",
    }));
  };

  it("reads an upscaler's SINGULAR `image` answer", async () => {
    countingFetch(singular(`data:image/png;base64,${PNG_BYTES.toString("base64")}`));
    const job = await falJob("fal-ai/aura-sr");
    expect(job.bytes.toString()).toBe(PNG_BYTES.toString());
  });

  it("still reads a generator's PLURAL answer — the negative control", async () => {
    countingFetch(falHappyPath);
    const job = await falJob("openai/gpt-image-2/edit");
    expect(job.bytes.toString()).toBe(PNG_BYTES.toString());
  });

  it("prefers the plural when a payload somehow carries both", async () => {
    countingFetch((target: string): Response => {
      if (target.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }));
      if (target.includes("/requests/")) {
        return new Response(JSON.stringify({
          images: [{ url: `data:image/png;base64,${Buffer.from("plural").toString("base64")}` }],
          image: { url: `data:image/png;base64,${Buffer.from("singular").toString("base64")}` },
        }));
      }
      return new Response(JSON.stringify({
        request_id: "req-1",
        status_url: "https://queue.fal.run/x/requests/req-1/status",
        response_url: "https://queue.fal.run/x/requests/req-1",
      }));
    });
    const job = await falJob("openai/gpt-image-2/edit");
    expect(job.bytes.toString()).toBe("plural");
  });

  it("STILL FAILS when neither shape is present — the guard can fail", async () => {
    countingFetch((target: string): Response => {
      if (target.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }));
      if (target.includes("/requests/")) return new Response(JSON.stringify({ nothing: true }));
      return new Response(JSON.stringify({
        request_id: "req-1",
        status_url: "https://queue.fal.run/x/requests/req-1/status",
        response_url: "https://queue.fal.run/x/requests/req-1",
      }));
    });
    await expect(falJob("openai/gpt-image-2/edit")).rejects.toThrow(/without an image/);
  });
});

describe("fal image dispatch", () => {
  it("refuses a banned engine BEFORE anything leaves the process", async () => {
    const calls = countingFetch(falHappyPath);

    await expect(falJob("fal-ai/flux-2-pro/edit")).rejects.toMatchObject({
      failureClass: "capability",
    });

    expect(calls, "a banned engine must cost nothing — not even a submit").toEqual([]);
  });

  it("POSITIVE CONTROL — the same harness reaches the wire for an allowed engine", async () => {
    const calls = countingFetch(falHappyPath);

    const result = await falJob("openai/gpt-image-2");

    expect(result.bytes.toString()).toBe("fake-png-bytes");
    expect(calls.length, "the refusal above means nothing if nothing ever dispatches")
      .toBeGreaterThan(0);
  });
});

describe("openrouter image dispatch", () => {
  const engine = (model: string) =>
    createOpenRouterCreativeEngine({
      apiKey: "test-key",
      model,
      queue: new ProviderQueue({ name: "test-banned", concurrency: 2, maxQueueDepth: 8 }),
    });

  const request = {
    prompt: "a face",
    size: "1024x1536" as const,
    quality: "medium" as const,
  };

  const okImage = () =>
    new Response(JSON.stringify({ data: [{ b64_json: PNG_BYTES.toString("base64") }] }), {
      status: 200,
    });

  it("refuses the banned model on the other transport too", async () => {
    const calls = countingFetch(okImage);

    await expect(engine("black-forest-labs/flux-2-pro").generateCandidate(request)).rejects
      .toMatchObject({ failureClass: "capability" });

    expect(calls).toEqual([]);
  });

  it("POSITIVE CONTROL — the same harness dispatches an allowed model", async () => {
    const calls = countingFetch(okImage);

    const result = await engine("openai/gpt-image-2").generateCandidate(request);

    expect(result.bytes.toString()).toBe("fake-png-bytes");
    expect(calls.length).toBeGreaterThan(0);
  });
});

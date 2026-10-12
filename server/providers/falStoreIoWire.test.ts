import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelFalRequest, runFalImageJob } from "./falTransport";
import { createFalRegionReader } from "../castingV2/falRegionReader";

/**
 * fal KEEPS NO COPY OF OUR REQUESTS — PROVEN ON THE OUTGOING CALL (#2334).
 *
 * The setting is a request header, so the only place it is true is the request
 * (working law 5: assert at the wire, never at a constant near it). Both roads
 * the product takes to fal are driven through their real functions with
 * `fetch` stubbed, and every call they make is recorded with its headers:
 *
 *   - the queue walk (`runFalImageJob`): submit, status poll, result fetch, and
 *     the cancel — every one carries the header, because a request fal stores on
 *     one leg is a request fal stores;
 *   - the segmentation reader on `fal.run`, which built its own headers until
 *     this card and so could have been the road that kept a copy.
 *
 * The negative control is the download of a generated file from fal's CDN: it
 * is a plain GET of a public URL and must carry none of our headers (no key, no
 * store setting). It proves the recorder tells a call that sends the header
 * from one that does not, so a green arm cannot be the recorder seeing
 * everything.
 *
 * The live measurement that let this ship — the queue result still arrives with
 * the header on — is recorded on `falHeaders` in `falTransport.ts`.
 */

type Sent = { url: string; method: string; headers: Record<string, string> };

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
});

function record(handler: (url: string) => Response): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    sent.push({
      url,
      method: init?.method ?? "GET",
      headers: { ...((init?.headers ?? {}) as Record<string, string>) },
    });
    return Promise.resolve(handler(url));
  }) as typeof fetch;
  return sent;
}

/** A real 1×1 PNG — the reader sizes masks with sharp, so a stub would not do. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const STATUS_URL = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-store/status";
const RESULT_URL = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-store";
const CDN_URL = "https://v3b.fal.media/files/out.png";

function queueHandler(url: string): Response {
  if (url === STATUS_URL) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
  if (url === RESULT_URL) {
    return new Response(
      JSON.stringify({ images: [{ url: CDN_URL, content_type: "image/png" }] }),
      { status: 200 },
    );
  }
  if (url === CDN_URL) return new Response(PNG, { status: 200 });
  return new Response(
    JSON.stringify({
      request_id: "req-store",
      status_url: STATUS_URL,
      response_url: RESULT_URL,
      cancel_url: `${RESULT_URL}/cancel`,
    }),
    { status: 200 },
  );
}

describe("the queue walk asks fal to keep no copy of the request (#2334)", () => {
  it("sends X-Fal-Store-IO: 0 on submit, status and result — and none of our headers to the CDN", async () => {
    const sent = record(queueHandler);

    const job = await runFalImageJob({
      apiKey: "test-key",
      endpoint: "fal-ai/nano-banana-pro/edit",
      body: { prompt: "a portrait" },
      timeoutMs: 5_000,
      pollIntervalMs: 1,
      inlineResult: false,
    });
    expect(job.bytes.equals(PNG)).toBe(true);

    const submit = sent.find((call) => call.method === "POST");
    const status = sent.find((call) => call.url === STATUS_URL);
    const result = sent.find((call) => call.url === RESULT_URL);
    const download = sent.find((call) => call.url === CDN_URL);
    expect(submit?.url).toBe("https://queue.fal.run/fal-ai/nano-banana-pro/edit");
    for (const call of [submit, status, result]) {
      expect(call, "every leg of the queue walk was made").toBeDefined();
      expect(call!.headers["X-Fal-Store-IO"], `${call!.method} ${call!.url}`).toBe("0");
    }

    /* NEGATIVE CONTROL: the public CDN fetch carries no header of ours. */
    expect(download, "the CDN download was made").toBeDefined();
    expect(download!.headers["X-Fal-Store-IO"]).toBeUndefined();
    expect(download!.headers.Authorization).toBeUndefined();
  });

  it("sends it on the cancel too", async () => {
    const sent = record(() => new Response(null, { status: 202 }));

    await cancelFalRequest("test-key", "fal-ai/nano-banana-pro/edit", "req-store");

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("PUT");
    expect(sent[0].headers["X-Fal-Store-IO"]).toBe("0");
  });
});

describe("the segmentation reader on fal.run asks the same (#2334)", () => {
  it("sends X-Fal-Store-IO: 0 and the one-hour lifetime on the fal.run call — and none of our headers to the mask CDN", async () => {
    const MASK_URL = "https://v3b.fal.media/files/mask.png";
    const sent = record((url) => {
      if (url === MASK_URL) return new Response(PNG, { status: 200 });
      return new Response(JSON.stringify({ masks: [{ url: MASK_URL }] }), { status: 200 });
    });
    const reader = createFalRegionReader({ apiKey: "test-key" });

    await reader.region({ image: PNG, name: "glasses", absentIsAnswer: true }).catch(() => null);

    const direct = sent.filter((call) => call.url.startsWith("https://fal.run/"));
    expect(direct.length, "the reader reached fal.run").toBeGreaterThan(0);
    for (const call of direct) {
      expect(call.method).toBe("POST");
      expect(call.headers["X-Fal-Store-IO"], call.url).toBe("0");
      expect(JSON.parse(call.headers["X-Fal-Object-Lifecycle-Preference"]).expiration_duration_seconds)
        .toBe(3600);
    }

    /* NEGATIVE CONTROL: the mask is fetched from the CDN bare. */
    const maskFetch = sent.find((call) => call.url === MASK_URL);
    expect(maskFetch, "the mask was fetched").toBeDefined();
    expect(maskFetch!.headers["X-Fal-Store-IO"]).toBeUndefined();
  });
});

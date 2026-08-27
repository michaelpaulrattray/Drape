/**
 * THE ANCHORED RENDER, AT THE WIRE (#177 Row A; working law 5: contracts about
 * what gets sent are proven on the outgoing request).
 *
 * A follow's render carries the followed face as an image reference. The
 * contract has three clauses, each proven here on the bytes fetch() receives:
 *
 *   1. references present → the EDIT endpoint, with `image_urls` holding the
 *      anchor as a data URI — the exact wire the #177 court measured;
 *   2. no references → the base endpoint, and the body has NO `image_urls`
 *      key at all (an unflagged roll's wire is byte-identical to before);
 *   3. an engine whose model has no edit sibling REFUSES an anchored request
 *      rather than rendering without the attachment — the prompt says "the
 *      attached look", and dropping it silently would paint strangers.
 *
 * The transport is stubbed at global.fetch (submit → status → result with an
 * inline data-URI image), so no request leaves the machine and no money moves.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFalCreativeEngine, FAL_GPT_IMAGE_2, FAL_GPT_IMAGE_2_EDIT } from "./falImages";
import { createOpenRouterCreativeEngine } from "./openrouterImages";
import { QUEUE_BASE } from "./falTransport";
import { ProviderError } from "./types";

/** A 1x1 PNG, as bytes — enough for a data-URI round trip. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Captured = { url: string; body: Record<string, unknown> };

/** Stubs fetch for one whole fal job and returns what the SUBMIT carried. */
function stubFalTransport(): { captured: Captured[] } {
  const captured: Captured[] = [];
  const resultImage = {
    images: [{ url: `data:image/png;base64,${PIXEL.toString("base64")}`, content_type: "image/png", width: 16, height: 16 }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const address = String(url);
      if (init?.method === "POST") {
        captured.push({ url: address, body: JSON.parse(String(init.body)) as Record<string, unknown> });
        return new Response(JSON.stringify({ request_id: "wire-test" }), { status: 200 });
      }
      if (address.includes("/status")) {
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      return new Response(JSON.stringify(resultImage), { status: 200 });
    }),
  );
  return { captured };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the anchored render at the wire", () => {
  it("references present: the EDIT endpoint, image_urls carrying the anchor as a data URI, provenance naming the endpoint actually called", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalCreativeEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    const anchor = { bytes: PIXEL, contentType: "image/png" };
    const result = await engine.generateCandidate({
      prompt: "brief\n\nSame casting brief as the attached look, new person.",
      size: "1024x1536",
      quality: "medium",
      references: [anchor],
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_2_EDIT}`);
    expect(captured[0]?.body.image_urls).toEqual([`data:image/png;base64,${PIXEL.toString("base64")}`]);
    expect(captured[0]?.body.image_size).toEqual({ width: 1024, height: 1536 });
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_2_EDIT);
  });

  it("no references: the base endpoint and NO image_urls key — the unanchored wire is byte-identical to before", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalCreativeEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    const result = await engine.generateCandidate({ prompt: "a plain roll", size: "1024x1536", quality: "medium" });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_2}`);
    expect(Object.keys(captured[0]?.body ?? {})).not.toContain("image_urls");
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_2);
  });

  it("an engine with no edit sibling REFUSES an anchored request before any bytes leave", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalCreativeEngine({ apiKey: "test-key", model: "some/other-model", pollIntervalMs: 1 });
    await expect(
      engine.generateCandidate({ prompt: "p", size: "1024x1536", quality: "medium", references: [{ bytes: PIXEL, contentType: "image/png" }] }),
    ).rejects.toThrow(ProviderError);
    expect(captured).toHaveLength(0);
  });

  it("the openrouter fallback refuses an anchored request too — it has no reference input", async () => {
    stubFalTransport();
    const engine = createOpenRouterCreativeEngine({ apiKey: "test-key" });
    await expect(
      engine.generateCandidate({ prompt: "p", size: "1024x1536", quality: "medium", references: [{ bytes: PIXEL, contentType: "image/png" }] }),
    ).rejects.toThrow(/cannot attach an image reference/);
  });

  it("positive control: the base-endpoint reader can fail — a body WITH image_urls is visibly different from one without", async () => {
    const withAnchor = { prompt: "p", image_urls: ["data:x"], image_size: { width: 16, height: 16 } };
    expect(Object.keys(withAnchor)).toContain("image_urls");
  });
});

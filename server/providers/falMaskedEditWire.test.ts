/**
 * THE MASKED EDIT'S ENGINE, AT THE WIRE (#1340; working law 5 — a contract
 * about what gets sent is proven on the outgoing request, not on a constant
 * near it).
 *
 * # Why this suite exists at all
 *
 * `createFalMaskedEditEngine`'s DEFAULT is what the paid refine road and the
 * repaint both render with — `refineService.ts`'s `defaultMaskedEditEngine()`
 * passes no model, and its own docblocks say so at `:719` and `:743`. #1340's
 * card guessed that road was on Nano Banana Pro; the code said GPT Image 2, and
 * the difference is the whole blast radius of changing this default.
 *
 * Until this suite, **nothing anywhere asserted which endpoint that road
 * dispatches to.** `refineService.test.ts` stubs the factory out entirely, so
 * the engine it would really have built was never exercised — a default could
 * have been changed to anything at all and 13,000 tests would have passed. That
 * is invariant 7's shape (a control that is not invoked does not exist) applied
 * to a road that takes a customer's credits.
 *
 * # What the arms are about
 *
 * The transport is stubbed at `global.fetch`, so nothing leaves the machine and
 * no money moves. The exact-pixel clause is the one the compositor depends on:
 * the frame that comes back is composited against the master, and *"a patch of
 * a different shape has nothing to composite against"*. That the PROVIDER
 * honours it was measured rather than assumed before the default moved — the
 * #1340 probe sent a real 1024×1536 to both doors with GPT Image 2's as the
 * control, and both returned exactly 1024×1536 (Sunburst in 41.5s against the
 * control's 89.1s). This suite proves the other half: that we still ASK for it,
 * and that we ask the endpoint we think we do.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFalMaskedEditEngine,
  FAL_GPT_IMAGE_25_SUNBURST_EDIT,
  FAL_GPT_IMAGE_2_EDIT,
  FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE,
} from "./falImages";
import { QUEUE_BASE } from "./falTransport";

/** A 1x1 PNG, as bytes — enough for a data-URI round trip. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Captured = { url: string; body: Record<string, unknown> };

function stubFalTransport(): { captured: Captured[] } {
  const captured: Captured[] = [];
  const resultImage = {
    images: [{
      url: `data:image/png;base64,${PIXEL.toString("base64")}`,
      content_type: "image/png",
      width: 1024,
      height: 1536,
    }],
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

const REQUEST = {
  prompt: "repaint the named region and nothing else",
  references: [{ bytes: PIXEL, contentType: "image/png" }],
  width: 1024,
  height: 1536,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the masked edit's endpoint, on the bytes fetch() receives", () => {
  it("THE DEFAULT IS SUNBURST'S EDIT DOOR — the road the paid refine takes (#1340)", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalMaskedEditEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    const result = await engine.edit(REQUEST);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
    /* Named, so the failure is not "a wrong URL" but THIS regression: the
       default falling back to the engine his ruling retired. */
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_2_EDIT}`);
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_25_SUNBURST_EDIT);
  });

  it("asks for the master's EXACT pixels, because the frame is composited against it", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalMaskedEditEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    await engine.edit(REQUEST);
    expect(captured[0]?.body.image_size).toEqual({ width: 1024, height: 1536 });
    expect(captured[0]?.body.num_images).toBe(1);
    expect(captured[0]?.body.image_urls)
      .toEqual([`data:image/png;base64,${PIXEL.toString("base64")}`]);
  });

  it("AN EXPLICIT MODEL STILL WINS — a court can still pin the old engine", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalMaskedEditEngine({
      apiKey: "test-key",
      model: FAL_GPT_IMAGE_2_EDIT,
      pollIntervalMs: 1,
    });
    const result = await engine.edit(REQUEST);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_2_EDIT}`);
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_2_EDIT);
    /* The positive control for the arm above: the default is a DEFAULT, not a
       hardcoded endpoint that would pass that assertion by ignoring config. */
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
  });

  it("a Sunburst edit comes back UNPRICED, and GPT Image 2's edit still carries its measured figure", async () => {
    stubFalTransport();
    const sunburst = await createFalMaskedEditEngine({ apiKey: "test-key", pollIntervalMs: 1 })
      .edit(REQUEST);
    /* Nothing has measured this door. Undefined is the honest answer; $0.099
       would be GPT Image 2's price on a Sunburst render, which is exactly what
       the #1340 probe observed before this changed. */
    expect(sunburst.estimatedCostUsd).toBeUndefined();

    vi.unstubAllGlobals();
    stubFalTransport();
    const legacy = await createFalMaskedEditEngine({
      apiKey: "test-key",
      model: FAL_GPT_IMAGE_2_EDIT,
      pollIntervalMs: 1,
    }).edit(REQUEST);
    expect(legacy.estimatedCostUsd).toBe(FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE);
  });

  it("refuses at construction without a key, before any request is built", () => {
    const { captured } = stubFalTransport();
    expect(() => createFalMaskedEditEngine({ apiKey: "" })).toThrow(/FAL_KEY/);
    expect(captured).toHaveLength(0);
  });
});

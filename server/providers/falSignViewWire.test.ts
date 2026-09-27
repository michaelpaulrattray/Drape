/**
 * THE SIGNED VIEW'S ENGINE, AT THE WIRE (#1459; working law 5 — a contract
 * about what gets sent is proven on the outgoing request, not on a constant
 * near it).
 *
 * # Why this suite exists at all
 *
 * His word on the outfit court moved the five signed views from Nano Banana
 * Pro's `2K` to GPT Image 2.5 Sunburst at `high`. The two suites that drive the
 * Sign (`packageOrchestrator.test.ts`, `viewRetryService.test.ts`) both inject
 * an `identityEngine` DOUBLE — all eight injection sites in the tree do — so
 * the engine the road really builds was never exercised by anything. **The
 * default could have been swapped back, or swapped to any endpoint at all, and
 * 14,500 tests would have passed.** That is invariant 7's shape on a road that
 * spends 450 of a customer's credits.
 *
 * `falMaskedEditWire.test.ts` is this suite's sibling and its origin — same
 * argument, one road over, for the paid refine's own default.
 *
 * # Nothing leaves the machine
 *
 * `global.fetch` is stubbed, so no request is made and no money moves. The
 * arms assert the endpoint, the tier, the size and the body fal is handed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFalSunburstViewEngine,
  FAL_GPT_IMAGE_25_SUNBURST_EDIT,
  FAL_GPT_IMAGE_2_EDIT,
  SIGNED_VIEW_SIZE,
} from "./falImages";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "./falQueue";
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
      width: SIGNED_VIEW_SIZE.width,
      height: SIGNED_VIEW_SIZE.height,
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
  prompt: "a full-length view of the signed cast",
  references: [{ bytes: PIXEL, contentType: "image/png" }],
  resolution: "2K" as const,
};

function engine() {
  return createFalSunburstViewEngine({ apiKey: "test-key", pollIntervalMs: 1 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the signed view's endpoint, on the bytes fetch() receives", () => {
  it("THE DEFAULT IS SUNBURST'S EDIT DOOR AT high — his word on the outfit court (#1459)", async () => {
    const { captured } = stubFalTransport();
    const result = await engine().editWithReferences(REQUEST);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
    /* Named, so the failure reads as THIS regression rather than "a wrong
       URL": the views falling back to the engine his eye moved off. */
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${DEFAULT_IDENTITY_EDIT_MODEL}`);
    expect(captured[0]?.body.quality).toBe("high");
    /* `max` cost 3.5x high for the same pixels (#1394) and he did not choose
       it; a silent promotion would be an unasked-for bill. */
    expect(captured[0]?.body.quality).not.toBe("max");
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_25_SUNBURST_EDIT);
  });

  it("asks for the size the door actually gives, so no row is a silently clamped ask", async () => {
    const { captured } = stubFalTransport();
    await engine().editWithReferences(REQUEST);
    expect(captured[0]?.body.image_size).toEqual({ width: 2352, height: 3504 });
    expect(captured[0]?.body.num_images).toBe(1);
    expect(captured[0]?.body.output_format).toBe("png");
    expect(captured[0]?.body.image_urls)
      .toEqual([`data:image/png;base64,${PIXEL.toString("base64")}`]);
    /* Both sides multiples of 16 — the door's own requirement, asserted on the
       constant rather than trusted, because it is edited by hand. */
    expect(SIGNED_VIEW_SIZE.width % 16).toBe(0);
    expect(SIGNED_VIEW_SIZE.height % 16).toBe(0);
  });

  it("generateView folds the angle in EXACTLY as the courts composed it", async () => {
    const { captured } = stubFalTransport();
    await engine().generateView({ ...REQUEST, viewAngle: "backFull" });
    /* #1394 and #1451 both measured `composePackageViewPrompt(...)` plus this
       line, because `falQueue`'s own `generateView` appends it. The words are
       the one thing an engine swap must not change, so they are asserted here
       rather than assumed to have survived the move. */
    expect(captured[0]?.body.prompt).toBe(`${REQUEST.prompt}\n\nView: backFull.`);
  });

  it("REFUSES a tier that is not the signed view's, before dispatch", async () => {
    const { captured } = stubFalTransport();
    await expect(engine().editWithReferences({ ...REQUEST, resolution: "4K" }))
      .rejects.toThrow(/2K signed-view tier only/);
    await expect(engine().editWithReferences({ ...REQUEST, resolution: "1K" }))
      .rejects.toThrow(/2K signed-view tier only/);
    /* The point of refusing rather than ignoring: this door has ONE size, so a
       `4K` ask answered 2352x3504 would be an unowned axis — a caller told
       nothing while getting something else. Nothing was sent. */
    expect(captured).toHaveLength(0);
  });

  it("refuses more references than the inherited ceiling, before dispatch", async () => {
    const { captured } = stubFalTransport();
    const many = Array.from({ length: 15 }, () => ({ bytes: PIXEL, contentType: "image/png" }));
    await expect(engine().editWithReferences({ ...REQUEST, references: many }))
      .rejects.toThrow(/too many reference images/);
    expect(captured).toHaveLength(0);
    /* The positive control: fourteen is inside it and really goes. The guard
       is Nano Banana Pro's documented number carried forward and UNVERIFIED
       for this door — see the constant's docblock — so what this arm pins is
       that the incumbent guard did not quietly disappear in the swap. */
    await engine().editWithReferences({ ...REQUEST, references: many.slice(0, 14) });
    expect(captured).toHaveLength(1);
  });

  it("an explicit model still wins, so a court can pin another door", async () => {
    const { captured } = stubFalTransport();
    const pinned = createFalSunburstViewEngine({
      apiKey: "test-key",
      model: FAL_GPT_IMAGE_2_EDIT,
      pollIntervalMs: 1,
    });
    const result = await pinned.editWithReferences(REQUEST);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_2_EDIT}`);
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_2_EDIT);
    /* The positive control for the first arm: the default is a DEFAULT, not a
       hardcoded endpoint that would pass that assertion by ignoring config. */
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
  });

  it("comes back UNPRICED rather than carrying another engine's figure", async () => {
    stubFalTransport();
    const result = await engine().editWithReferences(REQUEST);
    /* Two courts have measured this door at ~$0.14 and the figure is still not
       in `FAL_MEASURED_USD_PER_IMAGE`, because that table is keyed on MODEL
       and this endpoint's price moves with the SIZE — the paid repaint sends
       here at about a fifth of the pixels. `undefined` is the honest answer
       for both roads; see the table's own docblock. */
    expect(result.estimatedCostUsd).toBeUndefined();
  });

  it("refuses at construction without a key, before any request is built", () => {
    const { captured } = stubFalTransport();
    expect(() => createFalSunburstViewEngine({ apiKey: "" })).toThrow(/FAL_KEY/);
    expect(captured).toHaveLength(0);
  });
});

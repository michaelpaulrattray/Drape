/**
 * THE SIGN SHEET'S ENGINE, AT THE WIRE (#1904; working law 5 — a contract about
 * what gets sent is proven on the outgoing request, not on a constant near it).
 *
 * # What this suite is for
 *
 * Three numbers decide whether a Sign delivers a package or a mess, and all
 * three live in the request BODY rather than in anything a reader can see from
 * the orchestrator: the endpoint (`openai/gpt-image-2.5/sunburst/edit`), the
 * size (3840x1648 — the one ask this door is measured to honour unscaled at
 * 21:9), and the quality (`high` — his word, *"sunburst 2.5 max quality for the
 * sign sheet"*). A constant asserted against itself proves none of them.
 *
 * ⚠ **The size is the one with teeth, because the door is MEASURED TO CLAMP.**
 * `OUTFIT_PLATE_SIZE`'s docblock records 4688x1760 asked and 3840x1440 answered,
 * every time, aspect preserved and the long side capped. An ask whose long side
 * is anything but 3840 therefore comes back a different shape than the cut was
 * built for — and the cut reads the returned bytes, so it would cut a SCALED
 * sheet correctly and silently deliver five views at the wrong size. The arm
 * that the ask is exactly 3840 is what keeps that out.
 *
 * The transport is stubbed at `global.fetch`, so nothing leaves the machine and
 * no money moves.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFalSunburstPlateEngine,
  createFalSunburstSheetEngine,
  FAL_GPT_IMAGE_25_SUNBURST_EDIT,
  FAL_GPT_IMAGE_2_EDIT,
  OUTFIT_PLATE_SIZE,
  SIGN_SHEET_SIZE,
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
      width: SIGN_SHEET_SIZE.width,
      height: SIGN_SHEET_SIZE.height,
    }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const address = String(url);
      if (init?.method === "POST") {
        captured.push({ url: address, body: JSON.parse(String(init.body)) as Record<string, unknown> });
        return new Response(JSON.stringify({ request_id: "sheet-wire-test" }), { status: 200 });
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
  prompt: "A CHARACTER SHEET: one landscape photograph divided into 5 vertical panels",
  references: [{ bytes: PIXEL, contentType: "image/jpeg" }],
  resolution: "2K" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Sign sheet's endpoint, on the bytes fetch() receives", () => {
  it("goes to Sunburst's EDIT door — the engine his eye picked on #1690", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    const result = await engine.editWithReferences(REQUEST);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
    /* Named rather than left as "some wrong URL": the engine this road would
       fall back to if the default ever slipped. */
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_2_EDIT}`);
    expect(result.provenance.model).toBe(FAL_GPT_IMAGE_25_SUNBURST_EDIT);
  });

  it("asks for 3840x1648 — the long side ON the door's measured cap, so nothing is clamped", async () => {
    const { captured } = stubFalTransport();
    await createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 })
      .editWithReferences(REQUEST);
    expect(captured[0]?.body.image_size).toEqual({ width: 3840, height: 1648 });
    expect(SIGN_SHEET_SIZE).toEqual({ width: 3840, height: 1648 });
    /* The two facts the number rests on, asserted so a future edit has to meet
       them: 3840 is the measured cap, and both sides must be multiples of 16. */
    expect(SIGN_SHEET_SIZE.width).toBe(3840);
    expect(SIGN_SHEET_SIZE.width % 16).toBe(0);
    expect(SIGN_SHEET_SIZE.height % 16).toBe(0);
    expect(captured[0]?.body.num_images).toBe(1);
  });

  it("is NOT the plate's ask — the two roads share a door and must not share a size", async () => {
    const { captured } = stubFalTransport();
    await createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 })
      .editWithReferences(REQUEST);
    const plate = stubFalTransport();
    /*
      ⚠ The positive control for the arm above. Both factories build the same
      endpoint, so an assertion that the sheet asks for "a size" would pass if
      the sheet were quietly rendering at the PLATE's 3504x2336 — a 3:2 frame
      whose fifths are 700 px of a different aspect, cut by a function built for
      21:9. The two sizes are asserted apart, at the wire, on the same door.
    */
    await createFalSunburstPlateEngine({ apiKey: "test-key", pollIntervalMs: 1 })
      .editWithReferences(REQUEST);
    expect(captured[0]?.body.image_size).not.toEqual(OUTFIT_PLATE_SIZE);
    expect(plate.captured[0]?.body.image_size).toEqual(OUTFIT_PLATE_SIZE);
    expect(plate.captured[0]?.url).toBe(captured[0]?.url);
  });

  it("renders at HIGH quality — his word, *max quality for the sign sheet*", async () => {
    const { captured } = stubFalTransport();
    await createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 })
      .editWithReferences(REQUEST);
    expect(captured[0]?.body.quality).toBe("high");
    /* `medium` is the repaint's tier since his 2026-10-01 word, on the same
       door — the value this road would inherit if the two were ever merged. */
    expect(captured[0]?.body.quality).not.toBe("medium");
    expect(captured[0]?.body.output_format).toBe("png");
  });

  it("comes back UNPRICED, because the measured ~$0.07 is size-keyed and the table is model-keyed", async () => {
    stubFalTransport();
    const result = await createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 })
      .editWithReferences(REQUEST);
    /* $0.015 would be the text-to-image sheet's 1024x1536 price on a 6.33 MP
       render — the misprice `FAL_MEASURED_USD_PER_IMAGE`'s own docblock warns
       about twice. Undefined reads as unpriced rather than as another price. */
    expect(result.estimatedCostUsd).toBeUndefined();
  });

  it("refuses at construction without a key, before any request is built", () => {
    const { captured } = stubFalTransport();
    expect(() => createFalSunburstSheetEngine({ apiKey: "" })).toThrow(/FAL_KEY/);
    expect(captured).toHaveLength(0);
  });

  it("refuses an edit with nothing to edit — the door's own 422, turned into a sentence", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    await expect(engine.editWithReferences({ ...REQUEST, references: [] }))
      .rejects.toThrow(/needs at least one reference image/);
    expect(captured).toHaveLength(0);
  });

  it("refuses a tier it does not render, rather than sending a sheet somebody asked 1K for", async () => {
    const { captured } = stubFalTransport();
    const engine = createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    await expect(engine.editWithReferences({ ...REQUEST, resolution: "1K" }))
      .rejects.toThrow(/one sheet size only/);
    expect(captured).toHaveLength(0);
  });

  it("REFUSES generateView — a sheet has no angle, and the habit road would fight its own prompt", async () => {
    /*
      ⚠ This is the arm worth keeping. The plate's sibling implements
      `generateView` by appending `View: <angle>.` to the prompt, which is
      harmless for a reference nobody judges. On a sheet it is an instruction to
      make the WHOLE FRAME a close-up, contradicting the four panel lines above
      it — and it would come back as a plausible picture, so nothing downstream
      would ever disagree.
    */
    const { captured } = stubFalTransport();
    const engine = createFalSunburstSheetEngine({ apiKey: "test-key", pollIntervalMs: 1 });
    await expect(engine.generateView({ ...REQUEST, viewAngle: "closeUp" }))
      .rejects.toThrow(/one frame holding every view/);
    expect(captured).toHaveLength(0);
  });
});

/**
 * WHAT A SIGNED VIEW IS REALLY RENDERED BY — the whole chain, at the wire
 * (#1459).
 *
 * `falSignViewWire.test.ts` proves the ENGINE dispatches to Sunburst's edit
 * door. This proves the ROAD reaches that engine: `renderViewAttempts` built
 * with no `identityEngine` override, so the default the Sign and a Try again
 * actually take is the thing under test.
 *
 * ⚠ **THAT SEAM WAS OPEN AND NOTHING WAS IN IT.** Every one of the eight
 * `identityEngine:` injections in this tree hands the loop a double, so before
 * this file the default could have been pointed at any endpoint at all and the
 * suite would have been green — the same shape the #1443 shift found on the
 * Re-imagine door, and invariant 7 on a road that spends 450 credits.
 *
 * Nothing leaves the machine: `global.fetch` is stubbed and the database
 * module is replaced, so no request is made, no row is read and no money
 * moves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAL_GPT_IMAGE_25_SUNBURST_EDIT, SIGNED_VIEW_SIZE } from "../providers/falImages";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "../providers/falQueue";
import { QUEUE_BASE } from "../providers/falTransport";
import type { CastViewAngle } from "../../shared/boardTypes";

vi.mock("../logging/logger", () => {
  const shape = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

const castAssets: Array<Record<string, unknown>> = [];
vi.mock("../db/castingV2Sign", () => ({
  commitPackageSlotAsset: vi.fn(),
  recordPackageSlotFailure: vi.fn(),
  activateSignedCast: vi.fn(),
  listCastAssets: vi.fn(async () => castAssets),
  listOperationViewSteps: vi.fn(async () => []),
}));
vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async () => ({ success: true, generationId: 1 })),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

const { committedPackageAngles, renderViewAttempts } = await import("./packageOrchestrator");

/** A 1x1 PNG, as bytes. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Captured = { url: string; body: Record<string, unknown> };

function stubFalTransport(): Captured[] {
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
        return new Response(JSON.stringify({ request_id: "chain-test" }), { status: 200 });
      }
      if (address.includes("/status")) {
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      return new Response(JSON.stringify(resultImage), { status: 200 });
    }),
  );
  return captured;
}

const input = {
  userId: 1,
  operationId: "77777777-7777-4777-8777-777777777777",
  modelId: 9,
  identityRevisionId: "rev-chain",
  identityText: "the signed face",
  anchor: { bytes: PIXEL, contentType: "image/png" },
};

/** Everything but the engine — the one dependency this file refuses to fake. */
function dependencies() {
  return {
    judge: (() => async () => ({
      pass: true,
      method: "judge:test",
      axes: {
        identity: { pass: true, note: "" },
        angle: { pass: true, note: "" },
        wardrobe: { pass: true, note: "" },
      },
    })) as never,
    storeImage: async () => ({ key: "views/chain.png", url: "https://public/views/chain.png" }),
    deleteObject: async () => ({ success: true as const }),
    wait: async () => undefined,
  };
}

beforeEach(() => {
  castAssets.length = 0;
  process.env.FAL_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the engine a signed view is actually rendered by", () => {
  it("THE SIGN'S OWN ATTEMPT LOOP REACHES SUNBURST'S EDIT DOOR — no override (#1459)", async () => {
    const captured = stubFalTransport();
    const landed: Array<{ engine: string; provider: string }> = [];

    const result = await renderViewAttempts(
      dependencies(),
      input,
      "backFull" as CastViewAngle,
      async (land) => {
        landed.push({ engine: land.provenance.engine, provider: land.provenance.provider });
        return "landed" as const;
      },
    );

    expect(result.status).toBe("landed");
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
    /* Named, because the regression this guards is the specific one: the views
       falling back to the engine his eye moved off on the outfit court. */
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${DEFAULT_IDENTITY_EDIT_MODEL}`);
    expect(captured[0]?.body.quality).toBe("high");
    expect(captured[0]?.body.image_size).toEqual({ width: 2352, height: 3504 });

    /* And the row will SAY so: the provenance handed to the landing is what
       `model_assets.provenance.engine` records, which is how a Sunburst view
       and a Nano Banana Pro view are told apart in the record rather than from
       memory. */
    expect(landed).toEqual([{ engine: FAL_GPT_IMAGE_25_SUNBURST_EDIT, provider: "fal" }]);
  }, 20_000);

  it("the view's words still travel — the angle line the two courts measured", async () => {
    const captured = stubFalTransport();
    await renderViewAttempts(
      dependencies(),
      input,
      "frontFull" as CastViewAngle,
      async () => "landed" as const,
    );
    /* #1394 and #1451 composed `composePackageViewPrompt(...)` plus this line
       and measured THAT. An engine swap that dropped or reworded it would be
       shipping something no court has seen, and the frames would not be the
       frames he judged. */
    expect(String(captured[0]?.body.prompt).endsWith("\n\nView: frontFull.")).toBe(true);
    /* The anchor rides as the one reference, as it always has. */
    expect((captured[0]?.body.image_urls as string[]).length).toBe(1);
  }, 20_000);
});

describe("the 2K tier is a ROLE, and a Sunburst row still answers it", () => {
  /*
    The decision this pins, made in #1459 and argued at the render call site:
    `model_assets.resolution` keeps saying `2K` under the new engine. It never
    was a pixel count — Nano Banana Pro answered `2K` with 1696x2528 and
    Sunburst answers 2352x3504 — it is the SIGNED-VIEW tier, the one the 1K
    anchor is not, and that is the question these readers ask.

    A second label for the new size would have put two strings on one role
    across a live table, and a reader still testing the old one would count a
    paid, landed view as never arrived.
  */
  it("counts a landed view rendered by Sunburst, and still excludes the 1K anchor", async () => {
    castAssets.push(
      {
        viewType: "frontClose",
        resolution: "1K",
        storageUrl: "https://public/anchor.png",
        status: null,
        provenance: { engine: DEFAULT_IDENTITY_EDIT_MODEL, provider: "fal", identityRole: "anchor" },
      },
      {
        viewType: "backFull",
        resolution: "2K",
        storageUrl: "https://public/back.png",
        status: null,
        provenance: { engine: FAL_GPT_IMAGE_25_SUNBURST_EDIT, provider: "fal" },
      },
    );

    const landed = await committedPackageAngles({ userId: 1, modelId: 9 });
    expect(landed).toContain("backFull");
    /* The anchor is the face she already had, not a view the package
       delivered — and the engine on the row changes nothing about that. */
    expect(landed).not.toContain("frontClose");
  });

  it("a view whose tier is written as anything else is INVISIBLE to the reader — the hazard, driven", async () => {
    castAssets.push({
      viewType: "backFull",
      /* The tempting "honest size" a future change might write. */
      resolution: "8MP",
      storageUrl: "https://public/back.png",
      status: null,
      provenance: { engine: FAL_GPT_IMAGE_25_SUNBURST_EDIT, provider: "fal" },
    });

    const landed = await committedPackageAngles({ userId: 1, modelId: 9 });
    /* This is not a wish — it is what the reader does, and it is why the tier
       did not move. A paid view with a pristine picture on disk reads as never
       arrived, and recovery refunds a view the customer already has. */
    expect(landed).toEqual([]);
  });
});

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

import {
  FAL_GPT_IMAGE_25_SUNBURST,
  FAL_GPT_IMAGE_25_SUNBURST_EDIT,
  OUTFIT_PLATE_SIZE,
  SIGNED_VIEW_SIZE,
} from "../providers/falImages";
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
const { castingOutfitPlateEngine, resetSignEnginesForTests } = await import("./signEngine");

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
  /* The memoized engines are dropped between arms, because the plate arms and
     the view arms build different ones off the same variable. `viewEngine` and
     `plateEngine` were both missing from this reset until path E — a reset
     that silently resets less than it names is how one arm inherits another's
     engine and both pass for the wrong reason. */
  resetSignEnginesForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the engine a signed view is actually rendered by", () => {
  it("THE SIGN'S OWN ATTEMPT LOOP REACHES NANO BANANA PRO'S EDIT DOOR — no override (#1278 path E)", async () => {
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
    /*
      ⚠ **THIS ARM READ SUNBURST'S EDIT DOOR UNTIL 2026-09-29 AND THE CHANGE IS
      HIS, NOT A REGRESSION.** #1459 moved the delivered views onto Sunburst on
      his word closing the outfit court; path E moves them back, on his later
      word once he had both answers in front of him: *"Sunburst was only chosen
      because it was more creative in outfit design. NBP2k was a better quality
      rersult though."* So the OUTFIT comes from Sunburst — as a plate, one
      render, never delivered — and the PICTURE comes from Nano Banana Pro. The
      regression this now guards is the same shape pointed the other way: a
      delivered view quietly rendering on the plate's engine.
    */
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${DEFAULT_IDENTITY_EDIT_MODEL}`);
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
    expect(captured[0]?.body.resolution).toBe("2K");

    /* And the row will SAY so: the provenance handed to the landing is what
       `model_assets.provenance.engine` records, which is how a Sunburst view
       and a Nano Banana Pro view are told apart in the record rather than from
       memory. */
    expect(landed).toEqual([{ engine: DEFAULT_IDENTITY_EDIT_MODEL, provider: "fal" }]);
  }, 20_000);

  it("⚠ THE PLATE REACHES SUNBURST'S EDIT DOOR, CARRYING THE MASTER — his ruling on #1471", async () => {
    /*
      ⚠ **THIS ARM ASSERTED THE TEXT-TO-IMAGE DOOR AND `not.toHaveProperty
      ("image_urls")` FOR ONE DAY**, and it was a faithful reading of path E as
      merged: a plate was one GENERATION from words, so it could not go through
      a door that answers `422: "Number of image URLs must be at least 1"` to an
      empty list. **His ruling reversed the premise, verbatim and entire:**

      > *"no the plate must reference the master image otherwise it wouldnt be
      > able to invent the outfit correctly"*

      So the plate is an EDIT of her master now, and this arm is written to
      redden if the words-only road returns: the endpoint must be the edit door,
      and the reference must be IN the body — both read off the outgoing
      request rather than off a constant beside it (invariant 5), because a
      caller that built the right list and an engine that dropped it look
      identical everywhere else.
    */
    const captured = stubFalTransport();
    const plateEngine = castingOutfitPlateEngine();

    await plateEngine.editWithReferences({
      prompt: "a wardrobe plate",
      references: [{ bytes: PIXEL, contentType: "image/png" }],
      resolution: "2K",
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST_EDIT}`);
    expect(captured[0]?.url).not.toBe(`${QUEUE_BASE}/${FAL_GPT_IMAGE_25_SUNBURST}`);
    expect(captured[0]?.body.quality).toBe("high");
    /* The plate's own landscape ask, NOT the signed view's portrait one: same
       door, two shapes, and that is the only field the two factories differ in. */
    expect(captured[0]?.body.image_size).toEqual(OUTFIT_PLATE_SIZE);
    expect(captured[0]?.body.image_size).not.toEqual(SIGNED_VIEW_SIZE);
    /* The master actually went out — one reference, as a data URL, at the wire. */
    const urls = captured[0]?.body.image_urls as string[];
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(`data:image/png;base64,${PIXEL.toString("base64")}`);
  }, 20_000);

  it("the plate REFUSES an EMPTY reference list rather than sending one the door 422s", async () => {
    /*
      ⚠ **The exact inverse of the refusal that stood here yesterday** (*"takes
      no reference images"*). An edit with nothing to edit is the one request
      this door cannot serve, measured on the real door during #1278's build.
      Refused before dispatch, it becomes a sentence `renderOutfitPlate` turns
      into "no plate"; sent, it becomes a 422 after the Sign's 450 credits have
      already moved.
    */
    stubFalTransport();
    await expect(castingOutfitPlateEngine().editWithReferences({
      prompt: "a wardrobe plate",
      references: [],
      resolution: "2K",
    })).rejects.toThrow(/needs at least one reference image/);
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

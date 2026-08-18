import { describe, expect, it, vi } from "vitest";

import { INK_TEMPLATES } from "./inkTemplates";
import {
  legalPlateCanvas,
  platesByIdentityEngine,
  platesByMaskedEdit,
} from "./inkPlateEngines";
import type { ImageResult } from "../providers/types";

const DRAWN: ImageResult = {
  bytes: Buffer.from("plate"),
  contentType: "image/png",
  width: 1248,
  height: 1248,
  latencyMs: 1,
  provenance: { provider: "fal", model: "test", providerRef: "r" },
};

const TEMPLATE = { bytes: Buffer.from("form"), contentType: "image/png" };
const DESIGN = { bytes: Buffer.from("tattoo"), contentType: "image/jpeg" };

describe("the canvas a plate is asked for", () => {
  it("turns the body form's real size into one the edit endpoint will accept", () => {
    /*
      THE CATCH THIS FUNCTION EXISTS FOR, and it was read off the committed
      bytes rather than learned from a paid refusal.

      `assets/ink/body-template.png` is 1254 square; 1254 % 16 = 6; and
      `createFalMaskedEditEngine` fails BEFORE dispatch on a canvas that is not a
      multiple of 16. Asking for the template's own size would have refused every
      neck and upper-chest plate — two placements of three.
    */
    expect(INK_TEMPLATES.body.width % 16).not.toBe(0);
    expect(legalPlateCanvas({
      width: INK_TEMPLATES.body.width,
      height: INK_TEMPLATES.body.height,
    })).toEqual({ width: 1248, height: 1248 });
  });

  it("leaves the arm form alone, because it is already legal", () => {
    /* The negative arm: a function that rounded everything would pass the test
       above while quietly resizing a form that never needed it. */
    expect(legalPlateCanvas({
      width: INK_TEMPLATES.arm.width,
      height: INK_TEMPLATES.arm.height,
    })).toEqual({ width: 1536, height: 1024 });
  });

  it("never returns a zero-pixel canvas", () => {
    /* A dimension below one multiple rounds to zero under plain arithmetic, and
       a zero-pixel canvas is a refusal with a worse sentence than the door's. */
    expect(legalPlateCanvas({ width: 3, height: 1 })).toEqual({ width: 16, height: 16 });
  });

  it("gives every committed template a legal canvas", () => {
    for (const template of Object.values(INK_TEMPLATES)) {
      const canvas = legalPlateCanvas({ width: template.width, height: template.height });
      expect(canvas.width % 16).toBe(0);
      expect(canvas.height % 16).toBe(0);
      /* Nearest, not arbitrary: the plate stays the artwork he approved. */
      expect(Math.abs(canvas.width - template.width)).toBeLessThanOrEqual(8);
      expect(Math.abs(canvas.height - template.height)).toBeLessThanOrEqual(8);
    }
  });
});

describe("the edit-endpoint engine", () => {
  it("posts the TEMPLATE first and the design second, at a legal canvas", async () => {
    /*
      The order is not cosmetic: the prompt says "PICTURE 1 is a blank template"
      and "PICTURE 2 is a photograph containing a tattoo design". Swap them and
      every rule in that prompt points at the wrong picture — the engine would be
      asked to draw the mannequin onto the customer's photograph.
    */
    const edit = vi.fn().mockResolvedValue(DRAWN);
    const engine = platesByMaskedEdit({ id: "fal:openai/gpt-image-2/edit", edit });

    await engine.mint({
      prompt: "draw it",
      template: TEMPLATE,
      design: DESIGN,
      templateWidth: 1254,
      templateHeight: 1254,
    });

    expect(edit).toHaveBeenCalledTimes(1);
    const sent = edit.mock.calls[0]![0];
    expect(sent.references.map((reference: { contentType: string }) => reference.contentType))
      .toEqual(["image/png", "image/jpeg"]);
    expect(sent.references[0].bytes).toBe(TEMPLATE.bytes);
    expect(sent.width).toBe(1248);
    expect(sent.height).toBe(1248);
  });

  it("is named by the provider adapter, so the row's engine matches an invoice line", () => {
    expect(platesByMaskedEdit({ id: "fal:openai/gpt-image-2/edit", edit: vi.fn() }).id)
      .toBe("fal:openai/gpt-image-2/edit");
  });
});

describe("the identity engine", () => {
  it("asks for 2K, which costs what 1K costs", async () => {
    /*
      `NANO_BANANA_PRO_USD_PER_IMAGE` is $0.15 at both tiers. A plate is minted
      ONCE and shown to an engine on every later render, so the cheaper-looking
      tier buys nothing and spends detail the carry never gets back.
    */
    const editWithReferences = vi.fn().mockResolvedValue(DRAWN);
    const engine = platesByIdentityEngine({
      id: "fal:fal-ai/nano-banana-pro",
      editWithReferences,
    });

    await engine.mint({
      prompt: "draw it",
      template: TEMPLATE,
      design: DESIGN,
      templateWidth: 1536,
      templateHeight: 1024,
    });

    const sent = editWithReferences.mock.calls[0]![0];
    expect(sent.resolution).toBe("2K");
    expect(sent.references[0].bytes).toBe(TEMPLATE.bytes);
    expect(sent.references[1].bytes).toBe(DESIGN.bytes);
    /* None by default — the absence the court measured, and the reason the
       plate's real dimensions are read off the bytes rather than assumed. */
    expect(sent.aspectRatio).toBeUndefined();
  });

  it("sends an aspect ratio ONLY when a caller names one", async () => {
    /*
      Measured at the court: with no ratio, NBP returned 1696x2528 for a
      1536x1024 template — it took its shape from the DESIGN photograph rather
      than from the blank form. GPT Image 2, told an exact canvas, returned the
      template's own size both times. So the ratio is a parameter, and its
      default is the absence that measurement was taken under.
    */
    const editWithReferences = vi.fn().mockResolvedValue(DRAWN);
    await platesByIdentityEngine(
      { id: "fal:fal-ai/nano-banana-pro", editWithReferences },
      { aspectRatio: "3:2" },
    ).mint({
      prompt: "draw it",
      template: TEMPLATE,
      design: DESIGN,
      templateWidth: 1536,
      templateHeight: 1024,
    });
    expect(editWithReferences.mock.calls[0]![0].aspectRatio).toBe("3:2");
  });

  it("takes 1K when the court asks it to", async () => {
    /* The tier is a parameter because the court's other axis is wall-clock. */
    const editWithReferences = vi.fn().mockResolvedValue(DRAWN);
    await platesByIdentityEngine(
      { id: "fal:fal-ai/nano-banana-pro", editWithReferences },
      { resolution: "1K" },
    ).mint({
      prompt: "draw it",
      template: TEMPLATE,
      design: DESIGN,
      templateWidth: 1536,
      templateHeight: 1024,
    });
    expect(editWithReferences.mock.calls[0]![0].resolution).toBe("1K");
  });
});

import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import type { ComposerImage } from "./inkComposer";
import {
  buildInkAnywhereComposerRequest,
  buildInkComposerRequest,
} from "./inkComposer";

let image: ComposerImage;

beforeAll(async () => {
  image = {
    bytes: await sharp({
      create: {
        width: 300,
        height: 400,
        channels: 3,
        background: "white",
      },
    }).webp().toBuffer(),
    mime: "image/webp",
  };
});

describe("R7-7D exact ink composer request", () => {
  it("pins Pro, recipe, role order, and the exact three-image ceiling", () => {
    const request = buildInkComposerRequest({
      identityText: "Immutable identity text",
      normalizedDescriptor: "fine-line rose",
      side: "right",
      attemptNumber: 1,
      identityAnchor: image,
      guidedTarget: image,
      evidenceReference: image,
    });
    expect(request.model).toBe("gemini-3-pro-image-preview");
    expect(request.recipeVersion)
      .toBe("ink.add.front_upper_torso.composer.v1");
    expect(request.responseModalities).toEqual(["IMAGE"]);
    expect(request.images.map((item) => item.role)).toEqual([
      "identity_anchor",
      "guided_target",
      "evidence_reference",
    ]);
    expect(request.prompt).toContain('"fine-line rose"');
    expect(request.prompt).toContain("right chest");
    expect(JSON.stringify(request)).not.toMatch(/https?:\/\//);
  });

  it("allows only closed retry directives on attempt two", () => {
    const retry = buildInkComposerRequest({
      identityText: "Immutable identity text",
      normalizedDescriptor: "small geometric moth",
      side: "centre",
      attemptNumber: 2,
      identityAnchor: image,
      guidedTarget: image,
      retryDirectives: ["identity", "placement", "identity"],
    });
    expect(retry.images).toHaveLength(2);
    expect(retry.prompt.match(/Correct identity drift/g)).toHaveLength(1);
    expect(retry.prompt).toContain("Correct placement");
    expect(() => buildInkComposerRequest({
      identityText: "Immutable identity text",
      normalizedDescriptor: "small geometric moth",
      side: "centre",
      attemptNumber: 1,
      identityAnchor: image,
      guidedTarget: image,
      retryDirectives: ["identity"],
    })).toThrow("attempt one");
  });

  it("runtime-checks image bytes instead of trusting MIME types", () => {
    expect(() => buildInkComposerRequest({
      identityText: "Immutable identity text",
      normalizedDescriptor: "rose",
      side: "left",
      attemptNumber: 1,
      identityAnchor: { bytes: Buffer.from("not an image"), mime: "image/webp" },
      guidedTarget: image,
    })).toThrow("Invalid composer image");
    expect(() => buildInkComposerRequest({
      identityText: "Immutable identity text",
      normalizedDescriptor: "rose\u0000tattoo",
      side: "left",
      attemptNumber: 1,
      identityAnchor: image,
      guidedTarget: image,
    })).toThrow("Invalid ink description");
  });

  it("authors a closed all-body tuple and makes prior ink immutable", () => {
    const request = buildInkAnywhereComposerRequest({
      identityText: "Immutable identity text",
      normalizedDescriptor: "Japanese blackwork full sleeve",
      anatomy: {
        zone: "full_arm",
        surface: "circumferential",
        side: "right",
      },
      sourceAngle: "frontFull",
      attemptNumber: 2,
      identityAnchor: image,
      guidedTarget: image,
      retryDirectives: ["prior_ink", "placement"],
    });
    expect(request.recipeVersion).toBe("ink.add.anywhere.composer.v2");
    expect(request.prompt).toContain("Right arm");
    expect(request.prompt).toContain("FRAME LEFT");
    expect(request.prompt).toContain("zone=full_arm");
    expect(request.prompt).toContain("surface=circumferential");
    expect(request.prompt).toContain("preserve every existing tattoo");
    expect(request.prompt).toContain("Restore every tattoo");
  });
});

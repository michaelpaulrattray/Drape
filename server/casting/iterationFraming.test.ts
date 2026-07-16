/**
 * V1+V14 (R6 Batch A-coupled, Codex-review corrected) — per-view
 * typed-iteration framing AND orientation preservation.
 *
 * The Codex finding: collapsing the close trio to the shared HEADSHOT
 * directive told sideClose/threeQuarter to become "STRAIGHT-ON". These
 * tests assert exact SIX-ANGLE coverage over the REAL prompt construction —
 * never a shared close/full token — in three linked layers:
 *  1. The exhaustive maps: crop class AND per-angle directive cover exactly
 *     the canonical six (a seventh angle fails compilation via the Record
 *     types; these tests pin the runtime values and exclusions).
 *  2. Fail-safe: a non-canonical view type throws a typed refusal — it
 *     never silently inherits a default frame.
 *  3. Prompt integration: aiService.iterateModel → geminiGeneration.
 *     generateCastingImage builds the actual text prompt sent to the image
 *     model; a mocked Gemini client captures it, and each canonical angle's
 *     own orientation-preservation directive — with the required
 *     exclusions — is asserted per angle.
 *
 * Product truth (execution plan): typed iteration remains an individual
 * selected-image generation; nothing here claims composer/canon or sibling
 * propagation exists.
 */
import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { CANONICAL_VIEW_ANGLES, type CanonicalViewAngle } from "../../shared/boardTypes";
import {
  ITERATION_CROP_BY_VIEW,
  ITERATION_FRAME_DIRECTIVES,
  iterationFramingForView,
  type IterationCrop,
} from "./iterationFraming";

// ── Mocked Gemini client: capture what generateContent actually receives ──
const generateContentCalls: Array<{ parts: Array<{ text?: string }> }> = [];

vi.mock("./geminiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geminiClient")>();
  // ≥5KB of noise so placeholderDetection's variance check passes
  const noise = randomBytes(16384).toString("base64");
  return {
    ...actual,
    getAiClient: () => ({
      chats: {
        create: () => {
          throw new Error("chat unavailable in test — force stateless path");
        },
      },
      models: {
        generateContent: async (req: { contents: { parts: Array<{ text?: string }> } }) => {
          generateContentCalls.push({ parts: req.contents.parts });
          return {
            candidates: [
              { content: { parts: [{ inlineData: { data: noise } }] } },
            ],
          };
        },
      },
    }),
  };
});

vi.mock("../storage", () => ({
  storagePut: vi
    .fn()
    .mockResolvedValue({ key: "iterate/test.png", url: "https://pub-test.r2.dev/iterate/test.png" }),
}));

import { iterateModel } from "./aiService";

// A tiny data-URL source image — fetchAsBase64 passes non-http URLs through
const SOURCE_IMAGE = `data:image/png;base64,${randomBytes(64).toString("base64")}`;

/**
 * The six-angle contract, spelled out once and consumed by the map tests
 * AND the prompt-integration tests. `mustContain` are the angle's own
 * crop + orientation tokens; `mustNotContain` are the orientation
 * instructions this angle must never receive (the Codex exclusions).
 */
const ANGLE_CONTRACT: Record<
  CanonicalViewAngle,
  { crop: IterationCrop; mustContain: string[]; mustNotContain: string[] }
> = {
  frontClose: {
    crop: "HEADSHOT",
    mustContain: ["CLOSE UP FACIAL PORTRAIT", "STRAIGHT-ON", "FRONT-FACING", "MAINTAIN EXACT CAMERA DISTANCE"],
    mustNotContain: ["FULL BODY", "THREE-QUARTER", "SIDE-PROFILE", "BACK-FACING"],
  },
  sideClose: {
    crop: "HEADSHOT",
    mustContain: ["CLOSE UP FACIAL PORTRAIT", "SIDE-PROFILE", "MAINTAIN EXACT CAMERA DISTANCE"],
    // Never straight-on (the defect), never front-facing or three-quarter
    mustNotContain: ["STRAIGHT-ON", "FRONT", "THREE-QUARTER", "FULL BODY"],
  },
  threeQuarter: {
    crop: "HEADSHOT",
    mustContain: ["CLOSE UP FACIAL PORTRAIT", "THREE-QUARTER", "MAINTAIN EXACT CAMERA DISTANCE"],
    // Never straight-on, never a full/side profile
    mustNotContain: ["STRAIGHT-ON", "PROFILE", "FULL BODY"],
  },
  frontFull: {
    crop: "FULL_BODY",
    mustContain: ["FULL BODY FASHION SHOT", "HEAD TO TOE VISIBLE", "FRONT-FACING"],
    mustNotContain: ["CLOSE UP FACIAL PORTRAIT", "STRAIGHT-ON HEADSHOT", "BACK-FACING"],
  },
  sideFull: {
    crop: "FULL_BODY",
    mustContain: ["FULL BODY FASHION SHOT", "HEAD TO TOE VISIBLE", "SIDE-ON WALKING ORIENTATION"],
    // Never front-facing, never rear-facing
    mustNotContain: ["CLOSE UP FACIAL PORTRAIT", "FRONT", "REAR", "BACK-FACING"],
  },
  backFull: {
    crop: "FULL_BODY",
    mustContain: ["FULL BODY FASHION SHOT", "HEAD TO TOE VISIBLE", "BACK-FACING"],
    // Never front-facing
    mustNotContain: ["CLOSE UP FACIAL PORTRAIT", "FRONT"],
  },
};

describe("the exhaustive canonical maps (crop + per-angle directive)", () => {
  it("both maps cover exactly the canonical six, no more, no fewer", () => {
    expect(Object.keys(ITERATION_CROP_BY_VIEW).sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
    expect(Object.keys(ITERATION_FRAME_DIRECTIVES).sort()).toEqual(
      [...CANONICAL_VIEW_ANGLES].sort(),
    );
    expect(Object.keys(ANGLE_CONTRACT).sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
  });

  it("every directive is unique — no two angles share an orientation instruction", () => {
    const directives = Object.values(ITERATION_FRAME_DIRECTIVES);
    expect(new Set(directives).size).toBe(directives.length);
  });

  it.each([...CANONICAL_VIEW_ANGLES])(
    "%s: correct crop class and its own orientation directive with the required exclusions",
    (angle) => {
      const contract = ANGLE_CONTRACT[angle];
      expect(ITERATION_CROP_BY_VIEW[angle]).toBe(contract.crop);
      const framing = iterationFramingForView(angle);
      expect(framing).toEqual({ viewAngle: angle, crop: contract.crop });

      const directive = ITERATION_FRAME_DIRECTIVES[angle];
      for (const token of contract.mustContain) {
        expect(directive, `${angle} directive must contain "${token}"`).toContain(token);
      }
      for (const token of contract.mustNotContain) {
        expect(directive, `${angle} directive must NOT contain "${token}"`).not.toContain(token);
      }
      // Preservation, not pose generation: every directive preserves the source
      expect(directive).toContain("PRESERVE");
    },
  );
});

describe("iterationFramingForView — fail-safe on non-canonical input", () => {
  it.each(["side", "walk", "body", "fullBody", "head", "", "FRONTCLOSE", "front_close"])(
    "refuses %j with a typed error instead of defaulting a frame",
    (bad) => {
      expect(() => iterationFramingForView(bad)).toThrowError(
        expect.objectContaining({ code: "PRECONDITION_FAILED" }),
      );
    },
  );
});

describe("each angle's directive reaches the real image-generation prompt (iterateModel → generateCastingImage)", () => {
  const lastPromptText = () => {
    const call = generateContentCalls[generateContentCalls.length - 1];
    const text = call.parts.map((p) => p.text ?? "").join("\n");
    expect(text.length).toBeGreaterThan(0);
    return text;
  };

  it.each([...CANONICAL_VIEW_ANGLES])(
    "%s: the actual prompt carries this angle's own directive and none of its excluded orientations",
    async (angle) => {
      const framing = iterationFramingForView(angle);
      await iterateModel("master casting spec", SOURCE_IMAGE, "warmer expression", {
        frame: framing.crop,
        viewAngle: framing.viewAngle,
        userId: `framing-test-${angle}`,
      });
      const text = lastPromptText();
      // The complete per-angle directive lands verbatim in the prompt
      expect(text).toContain(ITERATION_FRAME_DIRECTIVES[angle]);
      // …and the excluded orientation instructions are absent from the WHOLE prompt
      for (const token of ANGLE_CONTRACT[angle].mustNotContain) {
        expect(text, `${angle} prompt must NOT instruct "${token}"`).not.toContain(token);
      }
    },
  );

  it("sideClose and threeQuarter never receive the STRAIGHT-ON HEADSHOT instruction (the Codex defect)", async () => {
    for (const angle of ["sideClose", "threeQuarter"] as const) {
      await iterateModel("master casting spec", SOURCE_IMAGE, "brighten the lighting", {
        frame: "HEADSHOT",
        viewAngle: angle,
        userId: `framing-defect-${angle}`,
      });
      const text = lastPromptText();
      expect(text).not.toContain("STRAIGHT-ON HEADSHOT");
      expect(text).not.toContain("STRAIGHT-ON");
    }
  });

  it("close trio keeps the close-portrait geometry lock; body trio does not", async () => {
    for (const angle of CANONICAL_VIEW_ANGLES) {
      const framing = iterationFramingForView(angle);
      await iterateModel("master casting spec", SOURCE_IMAGE, "soften the lighting", {
        frame: framing.crop,
        viewAngle: framing.viewAngle,
        userId: `framing-lock-${angle}`,
      });
      const text = lastPromptText();
      if (framing.crop === "HEADSHOT") {
        expect(text, angle).toContain("DO NOT ZOOM OUT");
      } else {
        expect(text, angle).not.toContain("DO NOT ZOOM OUT");
      }
    }
  });

  it("legacy non-view callers (no viewAngle) keep the binary directive unchanged", async () => {
    await iterateModel("master casting spec", SOURCE_IMAGE, "brighten the lighting", {
      frame: "HEADSHOT",
      userId: "framing-legacy-headshot",
    });
    expect(lastPromptText()).toContain(
      "STRAIGHT-ON HEADSHOT. CLOSE UP FACIAL PORTRAIT. MAINTAIN EXACT CAMERA DISTANCE.",
    );
    await iterateModel("master casting spec", SOURCE_IMAGE, "brighten the lighting", {
      frame: "FULL_BODY",
      userId: "framing-legacy-fullbody",
    });
    expect(lastPromptText()).toContain("FULL BODY FASHION SHOT. HEAD TO TOE VISIBLE.");
  });
});

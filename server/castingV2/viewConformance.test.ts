import { describe, expect, it, vi } from "vitest";

import { ProviderError, type TextEngine, type TextRequest } from "../providers/types";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  CONFORMANCE_AXES,
  createViewConformanceJudge,
  forcedFailAnglesFromEnv,
} from "./viewConformance";

/**
 * "View conformance is theatre unless it can fail" (D-92).
 *
 * So this file is mostly negative fixtures. Every axis is proved to reject on
 * its own, and every way the judge can fail to answer is proved to fail the
 * slot rather than wave it through — because a validator written green has
 * never demonstrated it can go red, and a validator that defaults to pass is
 * worse than no validator: it reports success loudest exactly when it
 * understood nothing.
 */

const anchor = { bytes: Buffer.from("anchor"), contentType: "image/png" };
const candidate = { bytes: Buffer.from("candidate"), contentType: "image/png" };

function engineReturning(text: string, extra: Partial<{ truncated: boolean }> = {}): TextEngine {
  return {
    id: "test-judge",
    complete: vi.fn(async () => ({
      text,
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "test" },
      ...extra,
    })),
  };
}

function engineThrowing(error: unknown): TextEngine {
  return {
    id: "test-judge",
    complete: vi.fn(async () => {
      throw error;
    }),
  };
}

const allPass = JSON.stringify({
  identity: { pass: true, note: "same person" },
  angle: { pass: true, note: "as specified" },
  wardrobe: { pass: true, note: "grey tee" },
});

describe("view conformance", () => {
  it("lands a view only when all three axes pass", async () => {
    const judge = createViewConformanceJudge({ engine: engineReturning(allPass) });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    expect(verdict.pass).toBe(true);
    expect(CONFORMANCE_AXES.every((axis) => verdict.axes[axis].pass)).toBe(true);
  });

  /**
   * Each axis alone. The M3 calibration is the reason: identity held across a
   * whole package while the wardrobe quietly did not, and a single blended
   * "looks right" score cannot say which of those went wrong.
   */
  for (const axis of CONFORMANCE_AXES) {
    it(`fails the view when ${axis} alone fails`, async () => {
      const reply = {
        identity: { pass: true, note: "" },
        angle: { pass: true, note: "" },
        wardrobe: { pass: true, note: "" },
      } as Record<string, { pass: boolean; note: string }>;
      reply[axis] = { pass: false, note: "no" };
      const judge = createViewConformanceJudge({ engine: engineReturning(JSON.stringify(reply)) });

      const verdict = await judge({ angle: "sideClose", anchor, candidate });
      expect(verdict.pass).toBe(false);
      expect(verdict.axes[axis].pass).toBe(false);
      // The other two are untouched — the axes are independent, not a blend.
      for (const other of CONFORMANCE_AXES.filter((entry) => entry !== axis)) {
        expect(verdict.axes[other].pass).toBe(true);
      }
    });
  }

  it("fails closed when the reply cannot be read", async () => {
    const judge = createViewConformanceJudge({ engine: engineReturning("I had a look and it seems fine!") });
    const verdict = await judge({ angle: "backFull", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.unjudged).toBe(true);
    expect(verdict.method).toBe("unparsed");
  });

  it("fails closed when an axis is missing rather than filling it in", async () => {
    // A judge that has to be corrected into agreeing is not a second opinion.
    const judge = createViewConformanceJudge({
      engine: engineReturning(JSON.stringify({ identity: { pass: true }, angle: { pass: true } })),
    });
    const verdict = await judge({ angle: "threeQuarter", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.unjudged).toBe(true);
  });

  it("treats a refusal as a failure, never as a default pass", async () => {
    const judge = createViewConformanceJudge({
      engine: engineThrowing(new ProviderError("content_policy", "refused")),
    });
    const verdict = await judge({ angle: "frontClose", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.method).toBe("refused");
    expect(verdict.unjudged).toBe(true);
  });

  it("fails closed when the judge cannot be reached", async () => {
    const judge = createViewConformanceJudge({
      engine: engineThrowing(new ProviderError("capability", "bad request")),
    });
    const verdict = await judge({ angle: "frontClose", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.method).toBe("unavailable");
  });

  it("rethrows a retryable transport failure instead of condemning the view", async () => {
    // The retry law owns this case (§H.5). Converting it to a verdict would
    // refund a customer for a view that was fine, because our network blinked.
    const judge = createViewConformanceJudge({
      engine: engineThrowing(new ProviderError("transport", "socket hang up")),
    });
    await expect(judge({ angle: "frontFull", anchor, candidate })).rejects.toBeInstanceOf(ProviderError);
  });

  it("treats a reply cut off at the ceiling as transport, not as a verdict", async () => {
    // D-83 in the judge's clothing: a fragment of JSON fails the whole parse,
    // and the model did not fail — our ceiling did.
    const judge = createViewConformanceJudge({
      engine: engineReturning('{"identity":{"pass":tru', { truncated: true }),
    });
    await expect(judge({ angle: "frontFull", anchor, candidate })).rejects.toBeInstanceOf(ProviderError);
  });

  it("reads a verdict that arrived wrapped in a fence", async () => {
    const judge = createViewConformanceJudge({
      engine: engineReturning("Here you go:\n```json\n" + allPass + "\n```"),
    });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    expect(verdict.pass).toBe(true);
  });

  describe("the forced-fail switch", () => {
    it("fails the named angle without spending a judge call", async () => {
      const engine = engineReturning(allPass);
      const judge = createViewConformanceJudge({ engine, forceFail: ["sideClose"] });

      const forced = await judge({ angle: "sideClose", anchor, candidate });
      expect(forced.pass).toBe(false);
      expect(forced.method).toBe("forced");
      expect(engine.complete).not.toHaveBeenCalled();

      // And it is surgical: every other angle judges normally.
      const other = await judge({ angle: "frontFull", anchor, candidate });
      expect(other.pass).toBe(true);
      expect(engine.complete).toHaveBeenCalledTimes(1);
    });

    it("parses the server-only switch, ignoring anything that is not an angle", () => {
      expect(forcedFailAnglesFromEnv(undefined, CAST_PACKAGE_VIEWS)).toBeUndefined();
      expect(forcedFailAnglesFromEnv("", CAST_PACKAGE_VIEWS)).toBeUndefined();
      expect(forcedFailAnglesFromEnv("all", CAST_PACKAGE_VIEWS)).toBe("all");
      expect(forcedFailAnglesFromEnv("sideClose, backFull", CAST_PACKAGE_VIEWS)).toEqual([
        "sideClose",
        "backFull",
      ]);
      // A typo must not silently fail every view, and must not silently fail none
      // while looking like it is on.
      expect(forcedFailAnglesFromEnv("sideclose", CAST_PACKAGE_VIEWS)).toBeUndefined();
    });
  });

  it("shows the judge both pictures and the spec, and never the prompt", async () => {
    let seen: TextRequest | null = null;
    const engine: TextEngine = {
      id: "test-judge",
      complete: vi.fn(async (request: TextRequest) => {
        seen = request;
        return { text: allPass, latencyMs: 1, provenance: { provider: "openrouter" as const, model: "t" } };
      }),
    };
    const judge = createViewConformanceJudge({ engine });
    await judge({ angle: "backFull", anchor, candidate });

    expect(seen).not.toBeNull();
    const request = seen as unknown as TextRequest;
    // Two images, anchor first: the system prompt names them in that order.
    expect(request.images).toHaveLength(2);
    expect(request.images?.[0]?.bytes.toString()).toBe("anchor");
    expect(request.user).toContain("SPECIFICATION");
    expect(request.user).not.toContain("OUTPUT FRAME");
    expect(request.user).not.toContain("AUTHORITY:");
  });
});

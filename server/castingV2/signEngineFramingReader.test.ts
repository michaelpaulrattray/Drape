/**
 * THE PRODUCTION JUDGE MEASURES — asserted at the wire, not at the config
 * (#1612's hand-over).
 *
 * # Why this file has to exist at all
 *
 * `framingReader` is OPTIONAL on `ViewConformanceJudgeConfig`, for one honest
 * reason: a test that does not care about framing should not have to build a
 * segmenter. **That optionality is also a silent road back to the coin his
 * ruling took away** — a production judge constructed without a reader keeps
 * working, keeps charging, and goes back to asking a vision model *"is the whole
 * body head-to-feet in frame"*, with no error anywhere and every suite green.
 *
 * Invariant 7 is the rule and it is unusually literal here: *a control that is
 * not invoked does not exist*, and *it must refuse — not allow — when a
 * dependency is missing*. So the factory refuses without the credential, and
 * this file proves the refusal AND the invocation. The second half is the one
 * that could not be read off the config: the reader is a closure inside the
 * judge, so the only honest question is whether a segmenter request leaves the
 * building.
 *
 * Nothing leaves the machine: `global.fetch` is stubbed and records what was
 * asked for. No row is read, no money moves, no credential is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logging/logger", () => {
  const shape = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

const { castingViewConformanceJudge, resetSignEnginesForTests } = await import("./signEngine");

/** A 1×1 PNG, so `sharp` can read it and `boundForJudge` behaves as it does live. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const frame = { bytes: PIXEL, contentType: "image/png" };

/**
 * A network that ANSWERS the judge and refuses everything else, recording every
 * address it was asked for.
 *
 * ⚠ **The judge has to succeed for these arms to be about the segmenter.** A
 * retryable transport failure is deliberately thrown rather than turned into a
 * verdict (`viewConformance`'s header says so), so a stub that refused the
 * reader's call too would reject out of the judge and the arm would be testing
 * the error path instead of the wire. The first shape of this file did exactly
 * that and failed for the wrong reason.
 */
function network(): { asked: string[] } {
  const asked: string[] = [];
  globalThis.fetch = vi.fn(async (url: unknown) => {
    const address = String(url);
    asked.push(address);
    if (address.includes("openrouter.ai")) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  identity: { verdict: "matches", note: "same person" },
                  angle: { verdict: "matches", note: "as asked" },
                  wardrobe: { verdict: "matches", note: "as the reference shows" },
                }),
              },
              finish_reason: "stop",
            },
          ],
          model: "served/x",
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    /* The segmenter says no. These arms are about the REQUEST — a judge whose
       reads all fail still returns a verdict (`unsure`), which is what part 2
       of this card wants and what `viewFramingHandover` drives. */
    return new Response("{}", { status: 500, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { asked };
}

const segmenterCalls = (asked: readonly string[]): string[] =>
  asked.filter((url) => url.includes("birefnet") || url.includes("sam-3"));

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  resetSignEnginesForTests();
  process.env.OPENROUTER_API_KEY = "or-not-a-real-key";
  process.env.FAL_KEY = "fal-not-a-real-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
  resetSignEnginesForTests();
  vi.restoreAllMocks();
});

describe("the production judge refuses to exist without what it needs", () => {
  it("refuses with no judging credential — unchanged by this card, and the control for the next arm", () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => castingViewConformanceJudge()).toThrow(/OPENROUTER_API_KEY/);
  });

  it("⚠ refuses with no SEGMENTER credential, rather than quietly going back to a reading", () => {
    /*
      The alternative shape — build the judge without a reader and let the
      framing axis fall back to the prose question — is a Sign that charges for
      five checked views and checked none of their crops, with nothing in a log
      to say so. It costs nothing in practice, which is checked rather than
      hoped: `castingViewEngine` refuses on this same variable before any money
      moves, so a deployment that can RENDER a view can always MEASURE one.
    */
    delete process.env.FAL_KEY;
    expect(() => castingViewConformanceJudge()).toThrow(/FAL_KEY/);
    expect(() => castingViewConformanceJudge()).toThrow(/framing band/);
  });
});

describe("the production judge asks the segmenter — at the wire", () => {
  it("sends a fal segmentation request for a view whose band has rules", async () => {
    const { asked } = network();

    const verdict = await castingViewConformanceJudge()(
      { angle: "frontFull", anchor: frame, candidate: frame },
    );

    expect(
      segmenterCalls(asked).length,
      "the production judge posted no segmentation request — the framing axis is a reading again",
    ).toBeGreaterThan(0);
    /*
      AND THE MEASUREMENT REACHED THE VERDICT, which is the half a request count
      cannot answer: a judge could post the call and then ignore the answer.
      Every read was refused above, so the axis is `unsure` — and `unsure` on
      framing DELIVERS (part 2), while the reader's own `matches` sits on the
      other two axes untouched.
    */
    expect(verdict.axes.angle.verdict).toBe("unsure");
    expect(verdict.axes.identity.verdict).toBe("matches");
    expect(verdict.method).toContain("geometry:");
  });

  it("⚠ CONTROL — a view whose band measures nothing asks the segmenter nothing", async () => {
    /*
      Without this the arm above could pass on a judge that segments every view
      unconditionally, which is a cent a view for an answer no rule uses — and
      it would read as the feature working. `threeQuarter` is entirely the
      reader's: a direction and a feature count, neither of which a silhouette
      answers.
    */
    const { asked } = network();

    const verdict = await castingViewConformanceJudge()(
      { angle: "threeQuarter", anchor: frame, candidate: frame },
    );

    expect(segmenterCalls(asked)).toEqual([]);
    /* And the arm is only meaningful if the judge was reached at all. An empty
       band folds to `inBand`, so the reader's answer is the whole of this
       view's framing standard — which is what its `readerRemainder` says. */
    expect(asked.length).toBeGreaterThan(0);
    expect(verdict.axes.angle.verdict).toBe("matches");
  });
});

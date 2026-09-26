import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import type { TextEngine, TextRequest } from "../providers/types";
import {
  boundForJudge,
  JUDGE_FRAME_JPEG_QUALITY,
  JUDGE_FRAME_LONG_EDGE,
} from "./judgeFrame";
import { conformanceProvenance, createViewConformanceJudge } from "./viewConformance";

/*
   Real sharp encodes and decodes of multi-megapixel frames inside the vitest
   worker. That is exactly #741's population — heavy work in-process, not a
   child process — so the class's timeout is declared rather than inherited
   from the 5 s default. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * THE FRAMES THE JUDGE IS HANDED, DRIVEN ON REAL PIXELS (#1408).
 *
 * Every arm here runs real `sharp` over real image bytes. Nothing is stubbed,
 * because the whole subject is what a real encoder does to real bytes — a
 * fixture that only records a call would have told us nothing about the finding
 * that PNG re-encoding makes the payload *bigger*.
 *
 * ⚠ **The wire arms are the ones that matter** (invariant 5: assert at the
 * wire). A constant near the resizer proves nothing about what left the
 * machine; these read `engine.complete`'s own argument, which is the object the
 * transport base64s into the request body.
 */

/**
 * A frame that behaves like a RENDER rather than like a test fixture.
 *
 * The fixture shape is load-bearing and the first draft of this file got it
 * wrong, which is worth recording. A cheap arithmetic "noise" pattern is highly
 * REGULAR, so PNG compresses it to 0.10 MB at 1696x2528 and JPEG q95 blows it
 * up to 7.82 MB — the opposite of reality, and three arms failed on it.
 *
 * A render is mostly low-frequency light with a little fine grain, and that is
 * what this builds: at the real production geometry it gives 2.37 MB of PNG
 * against 1.34 MB of bounded JPEG (1.8x). Production's own frames measured
 * 4.74–9.74 MB against 1.28–2.48 MB (3.7–3.9x), so this fixture is the same
 * direction and a HARDER case than the thing it stands in for. Deterministic —
 * no seed, no run-to-run drift.
 */
async function renderLike(width: number, height: number): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.allocUnsafe(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      const light = 128 + 90 * Math.sin(x / 190) * Math.cos(y / 260);
      const grain = ((x * 7 + y * 11) % 17) - 8;
      const clamp = (value: number): number => Math.max(0, Math.min(255, value));
      raw[index] = clamp(light + grain);
      raw[index + 1] = clamp(light * 0.86 + grain);
      raw[index + 2] = clamp(light * 0.72 + grain);
    }
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * The opposite fixture, for the one arm that needs it: a hard-edged synthetic
 * pattern PNG stores in almost nothing and JPEG cannot. This is what a chart, a
 * flat plate or a screenshot looks like to a compressor, and it is the case
 * where re-encoding would make the payload HEAVIER.
 */
async function patternLike(width: number, height: number): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.allocUnsafe(width * height * channels);
  for (let index = 0; index < raw.length; index += 1) {
    raw[index] = (index * 37 + ((index / channels) | 0) * 101) % 251;
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

function png(bytes: Buffer): { bytes: Buffer; contentType: string } {
  return { bytes, contentType: "image/png" };
}

const allPass = JSON.stringify({
  identity: { verdict: "matches", note: "same person" },
  angle: { verdict: "matches", note: "as specified" },
  wardrobe: { verdict: "matches", note: "grey tee" },
});

/** Keeps the request the judge actually posted, so the wire can be read. */
function recordingEngine(text = allPass): {
  engine: TextEngine;
  sent: () => TextRequest;
} {
  const requests: TextRequest[] = [];
  return {
    engine: {
      id: "recording-judge",
      complete: vi.fn(async (request: TextRequest) => {
        requests.push(request);
        return {
          text,
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "test" },
        };
      }),
    },
    sent: () => {
      if (requests.length !== 1) throw new Error(`expected one call, saw ${requests.length}`);
      return requests[0]!;
    },
  };
}

describe("the frame a vision judge is handed is bounded (#1408)", () => {
  /**
   * THE POSITIVE CONTROL, AND IT IS THE FINDING.
   *
   * A 2K view is the real production shape (1696x2528 PNG, measured at 4.7–9.7
   * MB). Its pixels are already inside the bound, so the ONLY thing that can
   * move the payload is the encoding — and this is the arm that proves it does.
   */
  it("shrinks a production-shaped 2K frame without touching one pixel", async () => {
    const source = await renderLike(1696, 2528);
    const bound = await boundForJudge(png(source));

    expect(bound.record.bounded).toBe(true);
    expect(bound.record.size).toBe("1696x2528");
    expect(bound.image.contentType).toBe("image/jpeg");

    const after = await sharp(bound.image.bytes).metadata();
    expect(after.width).toBe(1696);
    expect(after.height).toBe(2528);
    /* The number the deadline cares about. Real production frames fell 4.7–9.7
       MB to ~1.3–2.5 MB; noise is the hardest case for a compressor, so the
       bar here is deliberately modest — what must hold is the DIRECTION. */
    expect(bound.image.bytes.length).toBeLessThan(source.length);
  });

  /**
   * THE NEGATIVE CONTROL FOR THE PIXEL HALF: over the edge, it comes down.
   *
   * This is the arm that makes the card's own reason true — a 4K view or a
   * Sunburst frame is what broke the judge in #1394, and nothing in the 2K arm
   * above would notice if the resize were deleted.
   */
  it("brings a frame over the edge down to the edge, long side first", async () => {
    const source = await renderLike(3392, 2000);
    const bound = await boundForJudge(png(source));

    const after = await sharp(bound.image.bytes).metadata();
    expect(Math.max(after.width ?? 0, after.height ?? 0)).toBe(JUDGE_FRAME_LONG_EDGE);
    /* Aspect kept: a stretched frame would fail the angle axis for the render's
       framing rather than for its own. */
    expect(after.width).toBe(JUDGE_FRAME_LONG_EDGE);
    expect(after.height).toBe(Math.round((2000 * JUDGE_FRAME_LONG_EDGE) / 3392));
    expect(bound.record.size).toBe(`${after.width}x${after.height}`);
    expect(bound.record.bounded).toBe(true);
  });

  it("bounds the long edge whichever side it is on", async () => {
    const bound = await boundForJudge(png(await renderLike(2000, 3392)));
    const after = await sharp(bound.image.bytes).metadata();
    expect(after.height).toBe(JUDGE_FRAME_LONG_EDGE);
    expect(after.width).toBe(Math.round((2000 * JUDGE_FRAME_LONG_EDGE) / 3392));
  });

  /**
   * NEVER ENLARGES — the arm that keeps the identity axis honest.
   *
   * `realizationCaption` enlarges a tiny crop on purpose, for a reader that
   * cannot see 27 px. This is the opposite job, and stretching a small frame
   * here would add bytes and no detail while making the row claim a size the
   * render never had.
   */
  it("never enlarges a frame under the edge", async () => {
    const bound = await boundForJudge(png(await renderLike(600, 400)));
    expect(bound.record.size).toBe("600x400");
    const after = await sharp(bound.image.bytes).metadata();
    expect(after.width).toBe(600);
    expect(after.height).toBe(400);
  });

  /**
   * THE ARM FOR THE FRAME WE DO NOT HAVE YET.
   *
   * A small JPEG re-encodes LARGER. Production is all PNG today, so nothing in
   * the population exercises this — and a bound that could make a payload
   * heavier is the same defect wearing a fix's clothes (measured: PNG
   * re-encoding a production view took 9.74 MB to 13.34 MB).
   */
  it("returns the original when re-encoding would make it heavier", async () => {
    const flat = await patternLike(400, 600);
    const bound = await boundForJudge(png(flat));

    /* Measured on this fixture: 0.01 MB of PNG against 0.44 MB of JPEG q95. */
    expect(bound.image.bytes).toBe(flat);
    expect(bound.image.contentType).toBe("image/png");
    expect(bound.record).toEqual({ size: "400x600", bounded: false });
  });

  /**
   * AND THE PIXEL BOUND STILL WINS OVER THE BYTE COMPARISON.
   *
   * A frame OVER the edge comes down whatever the byte count does, because the
   * pixels past the edge are the thing the reader cannot use — and it is the
   * frame over the edge (4K, Sunburst) that broke the deadline in the first
   * place. Without this arm the cheap byte check could quietly re-open #1394's
   * finding for any frame that happens to compress badly.
   */
  it("bounds a frame over the edge even when the bytes come out heavier", async () => {
    const wide = await patternLike(3392, 1200);
    const bound = await boundForJudge(png(wide));

    expect(bound.image.bytes.length).toBeGreaterThan(wide.length);
    expect(bound.image.contentType).toBe("image/jpeg");
    expect(bound.record.bounded).toBe(true);
    const after = await sharp(bound.image.bytes).metadata();
    expect(after.width).toBe(JUDGE_FRAME_LONG_EDGE);
  });

  /**
   * FAILS OPEN — and this is a money arm, not a robustness nicety.
   *
   * A throwing resizer would turn a readable frame into an `unavailable`
   * verdict, which D-246 DELIVERS and CHARGES for with nobody having looked.
   * That is the precise defect #1408 exists to remove.
   */
  it("posts unreadable bytes as they arrived rather than refusing", async () => {
    const bound = await boundForJudge(png(Buffer.from("not an image at all")));
    expect(bound.image.bytes.toString()).toBe("not an image at all");
    expect(bound.image.contentType).toBe("image/png");
    expect(bound.record).toEqual({ size: "unreadable", bounded: false });
  });

  /**
   * THE CHROMA ARM, AND THE SABOTAGE PASS IS WHY IT EXISTS.
   *
   * Case 5 — deleting `chromaSubsampling: "4:4:4"` — SURVIVED the first run of
   * this suite green. It is the half of the encoding this module argues is
   * load-bearing: the identity axis reads *tattoos and ink, piercings, scars,
   * birthmarks and freckling, and the makeup she is wearing* (#1221), and all of
   * that is fine CHROMA detail, which is exactly what 4:2:0 throws away. A
   * quality argument nothing checks is a quality argument that will be deleted
   * by someone tidying up.
   */
  it("keeps full chroma — read back out of the bytes, not off the call", async () => {
    const bound = await boundForJudge(png(await renderLike(1696, 2528)));
    const meta = await sharp(bound.image.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.chromaSubsampling).toBe("4:4:4");
  });

  it("keeps the chosen quality and edge as one declaration", () => {
    /* Not a tautology: both are exported because the court driver and the
       record cite them, and a silent change to either is a silent change to
       what the checker sees. */
    expect(JUDGE_FRAME_LONG_EDGE).toBe(2576);
    expect(JUDGE_FRAME_JPEG_QUALITY).toBe(95);
  });
});

describe("what the judge actually posts — read at the wire (#1408)", () => {
  it("sends the bounded pair, not the frames it was handed", async () => {
    const anchorBytes = await renderLike(1024, 1536);
    const candidateBytes = await renderLike(3392, 5056);
    const { engine, sent } = recordingEngine();
    const judge = createViewConformanceJudge({ engine });

    const verdict = await judge({
      angle: "frontFull",
      anchor: png(anchorBytes),
      candidate: png(candidateBytes),
    });

    const images = sent().images ?? [];
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image.contentType).toBe("image/jpeg");
      const meta = await sharp(image.bytes).metadata();
      expect(Math.max(meta.width ?? 0, meta.height ?? 0))
        .toBeLessThanOrEqual(JUDGE_FRAME_LONG_EDGE);
    }
    /* The 4K candidate is the one that used to break the deadline, so the pair
       that left must be smaller than the pair that arrived. */
    const posted = images.reduce((total, image) => total + image.bytes.length, 0);
    expect(posted).toBeLessThan(anchorBytes.length + candidateBytes.length);

    /* Order is load-bearing: the system prompt names IMAGE 1 as the anchor. */
    const anchorMeta = await sharp(images[0]!.bytes).metadata();
    expect(anchorMeta.width).toBe(1024);
    expect(anchorMeta.height).toBe(1536);

    expect(verdict.frames).toEqual([
      { size: "1024x1536", bounded: true },
      { size: "1728x2576", bounded: true },
    ]);
  });

  it("records the frames on a verdict that failed an axis", async () => {
    const { engine } = recordingEngine(JSON.stringify({
      identity: { verdict: "differs", note: "a different person" },
      angle: { verdict: "matches", note: "as specified" },
      wardrobe: { verdict: "matches", note: "grey tee" },
    }));
    const verdict = await createViewConformanceJudge({ engine })({
      angle: "frontFull",
      anchor: png(await renderLike(400, 600)),
      candidate: png(await renderLike(400, 600)),
    });

    expect(verdict.pass).toBe(false);
    expect(verdict.unjudged).toBeUndefined();
    expect(verdict.frames).toEqual([
      { size: "400x600", bounded: true },
      { size: "400x600", bounded: true },
    ]);
  });

  /**
   * AND ON THE ROW THAT NEEDS IT MOST.
   *
   * An `unavailable` verdict is a view delivered unchecked and charged. Support
   * reading that row must be able to see what was posted — "it timed out" and
   * "it timed out on 13 MB" send an investigation to different places.
   */
  it("records the frames on the unjudged verdict too", async () => {
    const engine: TextEngine = {
      id: "dead-judge",
      complete: vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    };
    const verdict = await createViewConformanceJudge({ engine })({
      angle: "sideClose",
      anchor: png(await renderLike(400, 600)),
      candidate: png(await renderLike(400, 600)),
    });

    expect(verdict.unjudged).toBe(true);
    /* The value `castProjection.wasDeliveredUnjudged` matches for equality.
       The new field sits beside it and must not disturb it. */
    expect(verdict.method).toBe("unavailable");
    expect(verdict.frames).toHaveLength(2);
  });

  /**
   * THE ONE VERDICT WITH NO FRAMES, and it is a real distinction.
   *
   * The forced-fail switch returns before anything is read or posted, so a
   * `frames` entry there would be a record of a read that never happened.
   */
  /**
   * ⚠ THE MONEY CONTRACT, AND THE SABOTAGE PASS IS WHY THIS EXISTS TOO.
   *
   * Case 13 — letting `conformanceMethod` carry the frame size as well —
   * SURVIVED green. `castProjection.wasDeliveredUnjudged` matches that value for
   * EQUALITY against `"unavailable"`, and that reading is what makes a Try again
   * on an unchecked view free (#1220) and what keeps its price at zero (D-246).
   * A size appended to it would silently start charging for views nobody looked
   * at, with no test and no error anywhere.
   */
  it("keeps conformanceMethod exactly the verdict's method, with the frames beside it", async () => {
    const engine: TextEngine = {
      id: "dead-judge",
      complete: vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    };
    const verdict = await createViewConformanceJudge({ engine })({
      angle: "sideClose",
      anchor: png(await renderLike(400, 600)),
      candidate: png(await renderLike(400, 600)),
    });
    const provenance = conformanceProvenance(verdict);

    expect(provenance.conformanceMethod).toBe("unavailable");
    expect(provenance.conformanceFrames).toHaveLength(2);
    expect(provenance.conformance).toBe(verdict.axes);
  });

  it("omits the frames key entirely when a verdict never read one", async () => {
    const { engine } = recordingEngine();
    const verdict = await createViewConformanceJudge({ engine, forceFail: "all" })({
      angle: "frontFull",
      anchor: png(await renderLike(400, 600)),
      candidate: png(await renderLike(400, 600)),
    });
    /* Not `undefined` — ABSENT, so a provenance blob never claims a read that
       did not happen. */
    expect("conformanceFrames" in conformanceProvenance(verdict)).toBe(false);
  });

  it("carries no frames when the forced switch answers before any post", async () => {
    const { engine } = recordingEngine();
    const verdict = await createViewConformanceJudge({ engine, forceFail: "all" })({
      angle: "frontFull",
      anchor: png(await renderLike(400, 600)),
      candidate: png(await renderLike(400, 600)),
    });

    expect(verdict.method).toBe("forced");
    expect(verdict.frames).toBeUndefined();
    expect(engine.complete).not.toHaveBeenCalled();
  });
});

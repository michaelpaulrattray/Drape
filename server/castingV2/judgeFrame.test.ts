import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import type { TextEngine, TextRequest } from "../providers/types";
import { renderLikeFrame } from "../testing/renderLikeFrame";
import {
  BLANK_FRAME_MIN_STDEV,
  boundForJudge,
  JUDGE_FRAME_JPEG_QUALITY,
  JUDGE_FRAME_LONG_EDGE,
  readFrameIntegrity,
} from "./judgeFrame";
import {
  conformanceProvenance,
  createViewConformanceJudge,
  viewConformanceRefuses,
} from "./viewConformance";

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
 * what this builds. Production's own frames measured 4.74–9.74 MB of PNG
 * against 1.28–2.48 MB of bounded JPEG (3.7–3.9x), so this fixture is the same
 * direction and a HARDER case than the thing it stands in for. Deterministic —
 * no seed, no run-to-run drift.
 *
 * ⚠ **IT IS THE SHARED FIXTURE NOW AND NO LONGER ITS OWN COPY OF THE SAME
 * ARITHMETIC — #1903's repair, working law 4.** `renderLikeFrame` was written
 * for five conformance suites that needed a frame which is a PICTURE, and it is
 * this function with its light periods SCALED to the frame rather than fixed at
 * 190/260 — which matters, because fixed periods turn a 64x96 frame into almost
 * flat grey. **Both generators were measured side by side before this delegated
 * to one of them**, at every size this file asks for: at 1696x2528 the shared
 * one gives 2.73 MB of PNG against the same 1.41 MB of bounded JPEG where the
 * local one gave 2.48 / 1.41, and at 1024x1536 and 3392x5056 it is the same
 * story — the same direction, marginally harder. The old numbers in this
 * paragraph were *"2.37 MB against 1.34 MB (1.8x)"*; today's pair is 1.9x.
 */
async function renderLike(width: number, height: number): Promise<Buffer> {
  return renderLikeFrame(width, height);
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
  intact: { verdict: "matches", note: "a clean render" },
  people: { verdict: "matches", note: "one person" },
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
      intact: { verdict: "matches", note: "a clean render" },
      people: { verdict: "matches", note: "one person" },
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

/**
 * ⚠ **EVERY ARM BELOW DRIVES REAL ENCODED BYTES, AND THAT IS THE REQUIREMENT
 * RATHER THAN A STYLE CHOICE** — the repair owed on PR #1915 asked for exactly
 * this. A fixture that hands `readFrameIntegrity` a fake answer would prove what
 * the code does with a verdict, which is the gap this whole gate exists to
 * close: `intact` used to be answered only by a model, so every arm about it was
 * silent on whether the detection worked.
 *
 * **The production positive control is not in this file and cannot be** — it is
 * the 93 real delivered frames read in `judgeFrame.ts`'s own docblock (floor
 * 24.57, strict decode refusing 0 of 93, re-runnable against the live rows). The
 * arms here are the shapes that reading cannot produce: nobody has ever
 * delivered a truncated frame, which is the point.
 */
describe("a frame that is not a picture is refused without asking a model (#1903 repair)", () => {
  it("POSITIVE CONTROL — a render-like frame at the production geometry is intact", async () => {
    const frame = await renderLike(1696, 2528);
    expect(await readFrameIntegrity(png(frame))).toEqual({ intact: true });
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("a truncated frame is DAMAGED — and a variance test could never say so", async () => {
    const whole = await renderLike(1696, 2528);
    const cut = png(whole.subarray(0, Math.floor(whole.length / 2)));

    const verdict = await readFrameIntegrity(cut);
    expect(verdict.intact).toBe(false);
    expect(verdict).toMatchObject({ fault: "damaged" });

    /*
      ⚠ **THE ARM THAT JUSTIFIES THE SECOND DECODE.** Measured on a real
      production view cut in half: the picture paints down to the cut and is
      solid black below, and that black against the picture scores 96.50 — the
      HIGHEST variance of anything measured, real frames included. So a blank
      test does not merely miss truncation, it reads it as the most picture-like
      thing in the set. This holds that fact at the bytes rather than in prose.
    */
    const lenient = await sharp(cut.bytes, { failOn: "none" }).stats();
    const lowest = Math.min(...lenient.channels.slice(0, 3).map((channel) => channel.stdev));
    expect(lowest).toBeGreaterThan(BLANK_FRAME_MIN_STDEV);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("a buffer that is not an image at all is DAMAGED", async () => {
    const verdict = await readFrameIntegrity(png(Buffer.from("this is not a picture", "utf8")));
    expect(verdict).toMatchObject({ intact: false, fault: "damaged" });
  });

  it("a solid-colour frame is BLANK — and it is a perfectly valid PNG, which is why it needs its own arm", async () => {
    const flat = await sharp({
      create: { width: 1696, height: 2528, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    /* It decodes cleanly under the strictest setting — the damaged arm cannot see it. */
    await expect(sharp(flat, { failOn: "warning" }).stats()).resolves.toBeTruthy();

    expect(await readFrameIntegrity(png(flat))).toMatchObject({ intact: false, fault: "blank" });
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("a near-solid frame is BLANK too — a soft gradient is still a picture of nothing", async () => {
    const width = 400;
    const height = 600;
    const raw = Buffer.allocUnsafe(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 3;
        /* 110-130 top to bottom: the most picture-like blank measured, at 5.79. */
        const value = 110 + Math.round((y / height) * 20);
        raw[index] = value;
        raw[index + 1] = value;
        raw[index + 2] = value;
      }
    }
    const gradient = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    expect(await readFrameIntegrity(png(gradient))).toMatchObject({ intact: false, fault: "blank" });
  });

  it("⚠ NEGATIVE CONTROL — an OPAQUE RGBA frame is intact, because alpha is excluded", async () => {
    /*
      The arm that stops this gate refusing the entire product. A fully opaque
      alpha channel has stdev 0.00, so a reader taking the minimum over ALL
      channels would score every opaque picture at zero and refund every view.
      It reddens under a one-character change to the slice.
    */
    const frame = await sharp(await renderLike(400, 600)).ensureAlpha().png().toBuffer();
    const { channels } = await sharp(frame).stats();
    expect(channels).toHaveLength(4);
    expect(channels[3]!.stdev).toBe(0);

    expect(await readFrameIntegrity(png(frame))).toEqual({ intact: true });
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("the threshold keeps a real margin on both sides of the measured gap", () => {
    /*
      Derived from the constant rather than restating it, so moving the constant
      moves the arm — and the two numbers it is held between are the measured
      ones: the delivered population's floor (24.57) and the most picture-like
      blank (5.79). A threshold that drifts into either is the defect.
    */
    expect(BLANK_FRAME_MIN_STDEV).toBeGreaterThan(5.79 * 1.5);
    expect(BLANK_FRAME_MIN_STDEV).toBeLessThan(24.57 / 1.5);
  });
});

/**
 * ⚠ **THE GATE IS IN FRONT OF THE MODEL, AND "IN FRONT OF" IS WHAT THESE ARMS
 * MEASURE.** A reader that ran AFTER the call would be a second opinion rather
 * than a backstop: the measured failure is a provider REJECTING a broken frame
 * as non-retryable, which folds to `unjudged` — and D-246 delivers an `unjudged`
 * view and charges for it. So the engine never being called is the finding, not
 * an optimisation, and it is asserted at the call count rather than inferred.
 */
describe("a broken frame is refused before the judge is asked (#1903 repair)", () => {
  it("refuses a damaged frame WITHOUT calling the engine at all", async () => {
    const whole = await renderLike(1696, 2528);
    const { engine } = recordingEngine();

    const verdict = await createViewConformanceJudge({ engine })({
      angle: "frontFull",
      anchor: png(await renderLike(1024, 1536)),
      candidate: png(whole.subarray(0, Math.floor(whole.length / 2))),
    });

    expect(engine.complete).not.toHaveBeenCalled();
    expect(verdict.pass).toBe(false);
    expect(verdict.method).toBe("intact:damaged");
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("refuses a blank frame, and the money road reads it as a REFUSAL rather than as unjudged", async () => {
    const flat = await sharp({
      create: { width: 1696, height: 2528, channels: 3, background: { r: 200, g: 200, b: 200 } },
    }).png().toBuffer();
    const { engine } = recordingEngine();

    const verdict = await createViewConformanceJudge({ engine })({
      angle: "frontFull",
      anchor: png(await renderLike(1024, 1536)),
      candidate: png(flat),
    });

    expect(engine.complete).not.toHaveBeenCalled();
    expect(verdict.method).toBe("intact:blank");

    /*
      ⚠ **THE ARM THE WHOLE REPAIR TURNS ON.** `unjudged` DELIVERS (D-246), so a
      deterministic refusal that set that flag would refund nothing and hand the
      customer the blank picture — the defect wearing the repair's clothes.
    */
    expect(verdict.unjudged).toBeUndefined();
    expect(viewConformanceRefuses(verdict)).toBe(true);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("names ONLY intact — identity and people neither fail nor claim a verdict nobody gave", async () => {
    const flat = await sharp({
      create: { width: 400, height: 600, channels: 3, background: { r: 10, g: 10, b: 10 } },
    }).png().toBuffer();
    const { engine } = recordingEngine();

    const verdict = await createViewConformanceJudge({ engine })({
      angle: "frontFull",
      anchor: png(await renderLike(400, 600)),
      candidate: png(flat),
    });

    /* The refusal sentence and the diagnostic capture's key are both built from
       the failing axes, so three false axes would confess three faults for one. */
    expect(verdict.axes.intact.pass).toBe(false);
    expect(verdict.axes.identity.pass).toBe(true);
    expect(verdict.axes.people.pass).toBe(true);

    /* `verdict` absent is this type's own spelling for "no judge answered", and
       none did — asserting it stops a later edit inventing a model's word. */
    expect(verdict.axes.intact.verdict).toBeUndefined();
    expect(verdict.axes.identity.verdict).toBeUndefined();
    expect(verdict.axes.people.verdict).toBeUndefined();

    expect(verdict.axes.intact.note).toContain("near-uniform");
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("CONTROL — a good frame still reaches the judge, so the gate is not simply off", async () => {
    const { engine } = recordingEngine();

    const verdict = await createViewConformanceJudge({ engine })({
      angle: "frontFull",
      anchor: png(await renderLike(1024, 1536)),
      candidate: png(await renderLike(1696, 2528)),
    });

    expect(engine.complete).toHaveBeenCalledTimes(1);
    expect(verdict.pass).toBe(true);
    expect(verdict.method).toContain("judge:");
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("⚠ CONTROL — the ANCHOR is never gated, which is a scope line and not an oversight", async () => {
    /*
      A damaged anchor is a different failure with a different owner, and it is
      already fail-closed by another road (the judge answers `unsure` on identity
      and identity refuses on `unsure`). Gating it here would refund a customer
      for a view that is fine. If this arm ever reddens, that decision changed.
    */
    const anchorWhole = await renderLike(1024, 1536);
    const { engine } = recordingEngine();

    await createViewConformanceJudge({ engine })({
      angle: "frontFull",
      anchor: png(anchorWhole.subarray(0, Math.floor(anchorWhole.length / 2))),
      candidate: png(await renderLike(1696, 2528)),
    });

    expect(engine.complete).toHaveBeenCalledTimes(1);
  }, CONTENDED_TEST_TIMEOUT_MS);
});

/**
 * ⚠ **THE SHARED FIXTURE IS ITSELF ON A MONEY PATH NOW, so it gets an arm.**
 * `server/testing/renderLikeFrame.ts` is what five conformance suites hand the
 * judge since this card. If its variance ever drifted under the blank line,
 * those suites would not fail with a clear message — every view in them would
 * quietly start refusing, and the reading would be "the gate is broken" rather
 * than "the fixture went flat".
 */
describe("the shared conformance fixture is a picture, with room to spare", () => {
  it("clears the blank line at every size the suites ask for", async () => {
    for (const [width, height] of [[64, 96], [96, 64], [400, 600]] as const) {
      const { channels } = await sharp(await renderLikeFrame(width, height)).stats();
      const lowest = Math.min(...channels.slice(0, 3).map((channel) => channel.stdev));
      /* Measured ~60 against a line of 12 and a real production floor of 24.57.
         Held at 2x the line rather than at the line, so a drift is caught before
         it is a refusal. */
      expect(lowest).toBeGreaterThan(BLANK_FRAME_MIN_STDEV * 2);
      expect(await readFrameIntegrity(png(await renderLikeFrame(width, height))))
        .toEqual({ intact: true });
    }
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("is the same bytes every call — a fixture that wandered could flip a suite overnight", async () => {
    expect(await renderLikeFrame(64, 96)).toEqual(await renderLikeFrame(64, 96));
    expect(await renderLikeFrame(64, 96)).not.toEqual(await renderLikeFrame(96, 64));
  });
});

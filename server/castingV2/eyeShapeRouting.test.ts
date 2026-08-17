import { describe, expect, it } from "vitest";

import sharp from "sharp";

import {
  ANATOMICAL_UPSWEPT_EDIT,
  isUpsweptAsk,
  mentionsUpsweptAsk,
  readCanthalTilt,
} from "./eyeShapeRouting";
import type { Mask } from "./maskedComposite";
import { UPSWEPT_ALREADY, alreadyUpswept } from "./canthalTilt";
import { alreadyUpsweptReask } from "./refineReask";
import { BANNED_ENGINES } from "../providers/bannedEngines";

describe("the prose never says the trend word", () => {
  it("describes geometry, not a look", () => {
    /*
      "Fox eyes" in a training set is a MAKEUP TREND — liner and lift on an
      unchanged eye — which is the behaviour that was photographed and misread
      as non-compliance for months. The words are the suspected lever, so the
      words are pinned.
    */
    const said = ANATOMICAL_UPSWEPT_EDIT.toLowerCase();
    for (const trend of ["fox", "cat eye", "cat-eye", "siren", "almond"]) {
      expect(said, `"${trend}" invites the makeup reading`).not.toContain(trend);
    }
  });

  it("forbids the makeup reading out loud, rather than hoping", () => {
    const said = ANATOMICAL_UPSWEPT_EDIT.toLowerCase();
    expect(said).toContain("eyeliner");
    expect(said).toMatch(/do not add or change any makeup/);
  });

  it("names the corners RELATIVE to each other, which is what tilt is", () => {
    expect(ANATOMICAL_UPSWEPT_EDIT).toMatch(/outer corner.*higher than the inner corner/is);
  });

  it("names the lower lash line, so a corner lift is a shape and not a pull", () => {
    expect(ANATOMICAL_UPSWEPT_EDIT.toLowerCase()).toContain("lower lash line");
  });
});

describe("the routing row is RETIRED, and its absence is the assertion", () => {
  /*
    These three tests used to assert `EYE_SHAPE_ENGINE === "nbp"` — a constant
    against its own literal, under a describe block titled "the routing row, and
    its honesty about being unfinished". They were green for ten days about a row
    that did not exist at runtime: nothing imported the constant, so every
    eye.shape refine went to GPT Image 2 regardless.

    The founder retired it on 2026-08-17 (fable-848): "our entire processs runs
    on gpt image 2 so yes retire it". The module's own header carries his words
    and his re-open condition.

    So what replaces them is an ABSENCE test. A test that asserts a deleted
    export is gone is worth more than the one it replaces, because this family
    has restored a dead constant before — and unlike its predecessor it can fail:
    re-add either export and this reddens.
  */
  it("does not export an engine row for eye.shape any more", async () => {
    const module = await import("./eyeShapeRouting") as Record<string, unknown>;
    expect(Object.keys(module)).not.toContain("EYE_SHAPE_ENGINE");
    expect(Object.keys(module)).not.toContain("EYE_SHAPE_ROUTING_IS_PROVISIONAL");
  });

  it("still bans FLUX, which never depended on that row", () => {
    /* The ban was once asserted only here, which made it a note rather than a
       control. Since 2026-08-17 both image transports call
       `assertEngineNotBanned` before dispatch and `bannedEngines.test.ts` drives
       those seams with positive controls. This row survives the retirement
       because it was never about the routing constant. */
    expect(BANNED_ENGINES).toContain("fal-ai/flux-2-pro/edit");
  });
});

describe("the already-true gate applies to this class from birth", () => {
  it("asks rather than spends when her eyes already sweep", () => {
    /*
      THE WALK CANDIDATE HERSELF measures 7.2deg. "Fox eyes" on her is a request
      for something she has, and the correct product behaviour is a free
      question. That is not the walk failing — it is the walk meeting the right
      answer.
    */
    expect(alreadyUpswept({ meanDeg: 7.2 })).toBe(true);
  });

  it("stays out of the way of the ask it exists for", () => {
    /* A flat face asking to be upswept is the real edit, and a gate that fires
       there would be the false refusal this program has shipped once. */
    expect(alreadyUpswept({ meanDeg: -0.8 })).toBe(false);
    expect(alreadyUpswept({ meanDeg: 0 })).toBe(false);
    expect(alreadyUpswept({ meanDeg: UPSWEPT_ALREADY - 0.1 })).toBe(false);
  });

  it("speaks like a person, not like a measurement", () => {
    /* The user is never shown degrees. The number decides; the sentence is what
       a stylist would actually say. */
    expect(alreadyUpsweptReask("fox eyes").question).not.toMatch(/deg|°|canthal|[0-9]/);
  });

  it("re-derives the question from RAW TEXT, because the answer path has no parse", () => {
    /*
      The client sends back which sentence is outstanding, never the question.
      Rebuilding it cannot go through `isUpsweptAsk`, which needs a parsed shape
      — so the text door exists, and it is derived from the same vocabulary as
      the parsed one rather than being a second list of words (law 4).
    */
    expect(mentionsUpsweptAsk("give her fox eyes")).toBe(true);
    expect(mentionsUpsweptAsk("upturned eyes please")).toBe(true);
    expect(mentionsUpsweptAsk("downturned eyes")).toBe(false);
    expect(mentionsUpsweptAsk("make her hair copper")).toBe(false);
  });
});


describe("the gate fires on an upswept ask and on nothing else", () => {
  it("recognises the two asks that are about an upward tilt", () => {
    expect(isUpsweptAsk("fox eyes")).toBe(true);
    expect(isUpsweptAsk("upturned")).toBe(true);
  });

  it("NEVER fires on the ask that wants the opposite", () => {
    /* A gate firing on "downturned" would refuse the one edit a high-baseline
       face most needs — the exact inversion of what it is for. */
    expect(isUpsweptAsk("downturned")).toBe(false);
  });

  it("does not fire on shapes that are about the LID rather than the corners", () => {
    for (const shape of ["hooded", "monolid", "round", "almond", "deep-set", "wide-set", "close-set"] as const) {
      expect(isUpsweptAsk(shape), `${shape} is not a tilt ask`).toBe(false);
    }
  });

  it("does not fire when no eye shape was asked for at all", () => {
    expect(isUpsweptAsk(null)).toBe(false);
    expect(isUpsweptAsk(undefined)).toBe(false);
  });
});

describe("reading her tilt — both rungs, and silence spends", () => {
  const W = 400;
  const H = 300;

  const png = () => sharp({
    create: { width: W, height: H, channels: 3, background: "#808080" },
  }).png().toBuffer();

  /** Two eye boxes whose outer corners sit HIGHER than their inner ones. */
  const upsweptEyes = (): Mask => {
    const data = Buffer.alloc(W * H, 0);
    const put = (x0: number, x1: number, yAt: (x: number) => number) => {
      for (let x = x0; x < x1; x += 1) {
        const y = Math.round(yAt(x));
        for (let dy = -4; dy <= 4; dy += 1) data[(y + dy) * W + x] = 255;
      }
    };
    /* Her right eye: outer at x=80 (high), inner at x=160 (lower). */
    put(80, 160, (x) => 120 + (x - 80) * 0.25);
    /* Her left eye: inner at x=240 (lower), outer at x=320 (high). */
    put(240, 320, (x) => 140 - (x - 240) * 0.25);
    return { data, width: W, height: H };
  };

  it("measures an upswept face as upswept", async () => {
    const reading = await readCanthalTilt({
      image: await png(),
      reader: { region: async () => upsweptEyes() },
    });
    expect(reading).not.toBeNull();
    expect(reading!.meanDeg, "outer corners above inner reads positive").toBeGreaterThan(5);
  });

  it("RETURNS NULL WHEN NOTHING READS — and null must never refuse anybody", async () => {
    /*
      THE ASYMMETRY, and it is the same one D-235 drew. This gate REFUSES a
      render. A false "she already has it" costs a customer the picture they
      asked for, which is the failure this program has shipped once and does not
      get to ship again. So an instrument that cannot answer must be unable to
      refuse, and the caller treats null as "spend".
    */
    const reading = await readCanthalTilt({
      image: await png(),
      reader: { region: async () => { throw new Error("the segmenter found no eye"); } },
    });
    expect(reading).toBeNull();
    expect(alreadyUpswept({ meanDeg: 0 })).toBe(false);
  });

  it("falls to the ZONE rung when the whole frame will not read", async () => {
    /*
      A single rung is biased rather than merely incomplete: full-frame
      segmentation goes blind exactly on narrowed eyes, so it under-reports the
      faces this gate is about. Measured, blind renders carried +5.11deg against
      +1.40 for readable ones. Here the whole frame yields no reading and the crop
      does, and the reading must survive that.

      # The fake was rescheduled when the side-naming rung was deleted (D-238)

      It used to answer by CALL COUNT — refuse twice, answer on the third — which
      only lined up with the old ladder's two wasted `"right eye"`/`"left eye"`
      calls. With those gone the count no longer landed, and looking at why showed
      the schedule had been passing this test through the FULL-FRAME rung all
      along: its third call returned a readable full-size mask, so the zone crop
      the test is named for was never reached.

      So the fake now answers by what it is HANDED, which is the only thing the
      real segmenter answers by. At full size it returns ONE eye — a mask that is
      genuinely present, so the caller can take a bounding box from it, and from
      which `cornersFromMask` correctly refuses to read a pair. Inside a crop it
      returns both. That is the zone rung's actual job, and (not incidentally) the
      exact shape of the defect D-238 fixed one layer down.
    */
    const oneEye = (): Mask => {
      const whole = upsweptEyes();
      const data = Buffer.alloc(W * H, 0);
      /* Her right eye only — x in [80,160] per the pair painted above. */
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x <= 160; x += 1) data[y * W + x] = whole.data[y * W + x];
      }
      return { data, width: W, height: H };
    };

    let fullFrameReads = 0;
    const reading = await readCanthalTilt({
      image: await png(),
      reader: {
        region: async ({ image }) => {
          const meta = await sharp(image).metadata();
          const w = meta.width!;
          const h = meta.height!;
          if (w === W && h === H) {
            fullFrameReads += 1;
            return oneEye();
          }
          const scaled = Buffer.alloc(w * h, 0);
          const source = upsweptEyes();
          for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
              const sx = Math.min(W - 1, Math.round((x / w) * W));
              const sy = Math.min(H - 1, Math.round((y / h) * H));
              scaled[y * w + x] = source.data[sy * W + sx];
            }
          }
          return { data: scaled, width: w, height: h };
        },
      },
    });

    expect(reading, "the zone rung answered where the full frame would not").not.toBeNull();
    /* And the reading came from the CROP, not from a full-frame answer — the
       thing the old call-count schedule quietly stopped proving. */
    expect(fullFrameReads).toBeGreaterThan(0);
  });
});

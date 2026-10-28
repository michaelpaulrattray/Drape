/**
 * THE TWO LOG LINES THAT MUST BE ABLE TO SAY WHICH ROAD LOST A THING (#2752).
 *
 * His fifth finding, verbatim: *"it also didnt pickup her neck tattoo"*. The
 * first question about a missing row is which of four roads lost it — the
 * reading called it scattered, the detector found nothing, a call failed, or the
 * reading never named it usably — and until this card all four were a COUNT on
 * the log. A count cannot answer "was it the tattoo?", so these arms drive the
 * two lines and read the nouns back.
 *
 * ⚠ **And the boundary they must keep**: nouns only. `about` is the reading's
 * prose about the cast and has stayed out of every log since slice 2; the
 * negative control below plants a sentence and asserts it never appears.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const logged: Array<{ fields: Record<string, unknown>; msg: string }> = [];
vi.mock("../logging/logger", () => {
  const record = (fields: unknown, msg?: unknown) => {
    logged.push({ fields: (fields ?? {}) as Record<string, unknown>, msg: String(msg ?? "") });
  };
  const logger = { info: record, warn: record, error: record, debug: record, trace: record, fatal: record };
  return { createModuleLogger: () => logger, logger };
});

const { cutDiscovered } = await import("./pointerCut");
const { discoverFeatures } = await import("./faceDiscovery");

import type { DiscoveredFeature } from "./faceDiscovery";
import type { Mask } from "./maskedComposite";
import type { PointerBox, RegionReader } from "./maskedRefine";
import type { TextEngine, TextRequest, TextResult } from "../providers/types";

const FRAME = { bytes: Buffer.from("a frame"), width: 400, height: 300 };
const PROSE = "an intricate lace of black branches down the right side of the neck";

function maskAt(box: PointerBox): Mask {
  const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) data[y * FRAME.width + x] = 255;
  }
  return { data, width: FRAME.width, height: FRAME.height };
}

const feature = (name: string, extra: Partial<DiscoveredFeature> = {}): DiscoveredFeature => (
  { name, count: 1, about: PROSE, kind: "marking", on: "neck", coverage: "single", ...extra }
);

function line(msg: string): Record<string, unknown> {
  const found = logged.filter((one) => one.msg === msg);
  expect(found, `no "${msg}" line was logged`).toHaveLength(1);
  return found[0]!.fields;
}

beforeEach(() => { logged.length = 0; });

describe("the pointer road's line names what it could not draw, and why", () => {
  const reader: RegionReader = {
    async region() { throw new Error("not this road"); },
    async subject() { throw new Error("not this road"); },
    async landmark() { throw new Error("not this road"); },
    async pointer({ name }) {
      if (name === "lace tattoo") throw new Error("429 concurrent_requests_limit");
      if (name === "neck tattoo") return [];
      return [{ x: 10, y: 10, width: 40, height: 40 }];
    },
    async regionInBox({ box }) { return maskAt(box); },
  };

  it("carries every lost noun under its road — scattered, declined, failed", async () => {
    await cutDiscovered({
      frame: FRAME,
      features: [
        feature("neck tattoo"),
        feature("lace tattoo"),
        feature("freckles", { coverage: "scattered", on: "skin" }),
        feature("cross mark"),
      ],
      reader,
    });
    const fields = line("pointer road");
    expect(fields.wordsOnly).toEqual({ scattered: ["freckles"], uncut: ["neck tattoo", "lace tattoo"] });
    expect(fields.declinedNouns).toEqual(["neck tattoo"]);
    expect(fields.failedNouns).toEqual(["lace tattoo"]);
  });

  it("and what the place rules decided, so a merged row never reads as a lost one", async () => {
    await cutDiscovered({
      frame: FRAME,
      features: [feature("cross mark"), feature("scar")],
      reader,
    });
    const fields = line("pointer road");
    expect(fields.samePlace).toEqual([{ noun: "scar", into: "cross mark" }]);
    expect(fields.onGarment).toEqual([]);
  });

  it("⚠ NEGATIVE CONTROL — the reading's prose about the cast is in no field of the line", async () => {
    await cutDiscovered({ frame: FRAME, features: [feature("neck tattoo"), feature("cross mark")], reader });
    expect(JSON.stringify(line("pointer road"))).not.toContain("intricate lace");
  });
});

describe("the discovery's line names what the reading could not name usably", () => {
  function engineSaying(...answers: string[]): TextEngine {
    let at = 0;
    return {
      id: "test:engine",
      async complete(_request: TextRequest): Promise<TextResult> {
        const text = answers[Math.min(at, answers.length - 1)]!;
        at += 1;
        return {
          text,
          provenance: { provider: "test", model: "test", requestedAt: new Date().toISOString() } as never,
          latencyMs: 1,
        };
      },
    };
  }
  const crops = [
    { kind: "head" as const, bytes: Buffer.from("a"), contentType: "image/png" },
    { kind: "full" as const, bytes: Buffer.from("b"), contentType: "image/png" },
  ];

  it("carries the refused captions and the unseen names, never the prose", async () => {
    await discoverFeatures({
      crops,
      engine: engineSaying(
        JSON.stringify({
          features: [
            { name: "hair", count: 1, about: PROSE, kind: "anatomy", on: "", coverage: "single" },
            { name: "tattoo on the neck", count: 1, about: PROSE, kind: "marking", on: "", coverage: "single" },
          ],
          cannotSee: [{ name: "chest tattoo", why: "cut off by the frame" }],
        }),
        JSON.stringify({ features: [{ name: "hair", count: 1, about: "", kind: "anatomy", on: "", coverage: "single" }], cannotSee: [] }),
      ),
    });
    const fields = line("discovery read");
    expect(fields.unusableNames).toEqual(["tattoo on the neck"]);
    expect(fields.cannotSeeNames).toEqual(["chest tattoo"]);
    expect(JSON.stringify(fields)).not.toContain("intricate lace");
    expect(JSON.stringify(fields)).not.toContain("cut off by the frame");
  });
});

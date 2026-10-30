/**
 * THE BOXER, DRIVEN AT THE WIRE (#2863).
 *
 * Every arm stubs `fetch` and reads what LEFT — the endpoint, the model, the
 * names, the layout — rather than a constant near the request (law 5). The
 * reader is the real `createFalRegionReader`, the gate is the real
 * `pointerBoxerFor` reading the real environment, and one arm goes through a
 * real caller (`markReferenceThings`) so the one-request-per-picture claim is
 * proven on the road that asks name by name, not only on a hand-built batch.
 */
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withCallCensus } from "./callCensus";
import { createFalRegionReader } from "./falRegionReader";
import {
  BOXER_STEPS,
  POINTER_BOXER_ABOUT,
  createOpenRouterBoxer,
  pointerBoxerFor,
  readBoxerAnswer,
  toPixelBox,
} from "./pointerBoxer";
import { markReferenceThings } from "./referenceDiscovery";
import type { DiscoveredFeature } from "./faceDiscovery";

const WIDTH = 200;
const HEIGHT = 100;
const DETECT = "fal-ai/moondream3-preview/detect";
const ARGON = BOXER_STEPS[0];
const QWEN = BOXER_STEPS[1];

async function frame(): Promise<Buffer> {
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#808080" } }).png().toBuffer();
}

type Sent = { url: string; body: any };
type OrAnswer = { status?: number; content?: string; finish?: string; cost?: number } | "hang";

/** The wire: what left, and a scripted answer per OpenRouter model and per fal call. */
function wire(input: {
  openrouter?: Record<string, OrAnswer>;
  detect?: (prompt: string) => { status?: number; objects?: unknown[] };
}): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    sent.push({ url: String(url), body });
    if (String(url).startsWith("https://openrouter.ai/")) {
      const answer = input.openrouter?.[body.model] ?? { status: 500 };
      if (answer === "hang") {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("t"), { name: "TimeoutError" })));
        });
      }
      if (answer.status && answer.status !== 200) return new Response("no", { status: answer.status });
      return new Response(JSON.stringify({
        choices: [{ message: { content: answer.content ?? "[]" }, finish_reason: answer.finish ?? "stop" }],
        usage: { prompt_tokens: 1200, completion_tokens: 80, cost: answer.cost ?? 0.0039 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const answer = input.detect?.(body.prompt) ?? { objects: [] };
    if (answer.status && answer.status !== 200) return new Response("fal down", { status: answer.status });
    return new Response(JSON.stringify({ objects: answer.objects ?? [] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }));
  return sent;
}

const toOpenRouter = (sent: Sent[]) => sent.filter((one) => one.url.startsWith("https://openrouter.ai/"));
const toDetector = (sent: Sent[]) => sent.filter((one) => one.url === `https://fal.run/${DETECT}`);
const sentenceOf = (one: Sent): string => one.body.messages[0].content[1].text;

const ENV_KEYS = ["CASTING_V2_SCOPE", "CASTING_POINTER_ENGINE_SCOPE", "OPENROUTER_API_KEY"] as const;
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.CASTING_V2_SCOPE = "all";
  process.env.OPENROUTER_API_KEY = "or-test-key";
  delete process.env.CASTING_POINTER_ENGINE_SCOPE;
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

/** The reader every road builds, gated the way every road gates it. */
function readerFor(userId: number) {
  const boxer = pointerBoxerFor(userId);
  return createFalRegionReader({ apiKey: "fal-test-key", ...(boxer === undefined ? {} : { boxer }) });
}

describe("the box guard: a known box lands on known pixels in both layouts", () => {
  it("maps Argon's [ymin,xmin,ymax,xmax] and Qwen's [x1,y1,x2,y2] for one rectangle onto the same pixels", () => {
    /* The rectangle x 50..150, y 25..75 on a 200x100 frame: 250..750 across, 250..750 down. */
    const want = { x: 50, y: 25, width: 100, height: 50 };
    expect(toPixelBox([250, 250, 750, 750], ARGON.layout, WIDTH, HEIGHT)).toEqual(want);
    expect(toPixelBox([250, 250, 750, 750], QWEN.layout, WIDTH, HEIGHT)).toEqual(want);
    /* A box that is NOT square in 0–1000 tells the two layouts apart — the arm the swap reddens. */
    expect(toPixelBox([100, 200, 300, 600], ARGON.layout, WIDTH, HEIGHT)).toEqual({ x: 40, y: 10, width: 80, height: 20 });
    expect(toPixelBox([100, 200, 300, 600], QWEN.layout, WIDTH, HEIGHT)).toEqual({ x: 20, y: 20, width: 40, height: 40 });
  });

  it("orders, clamps, and drops a box with no area rather than passing it on", () => {
    expect(toPixelBox([1200, 900, -50, 400], ARGON.layout, WIDTH, HEIGHT)).toEqual({ x: 80, y: 0, width: 100, height: 100 });
    expect(toPixelBox([500, 500, 500, 900], ARGON.layout, WIDTH, HEIGHT)).toBeNull();
  });
});

describe("reading an answer — #2846's three readers, and an empty list is an answer", () => {
  it("reads a list, an object of detections, and both lenient orders", () => {
    expect(readBoxerAnswer('[{"label":"belt","box_2d":[1,2,3,4]}]', ARGON)).toEqual([{ label: "belt", raw: [1, 2, 3, 4] }]);
    expect(readBoxerAnswer('{"detections":[{"label":"belt","bbox_2d":[1,2,3,4]}]}', QWEN)).toEqual([{ label: "belt", raw: [1, 2, 3, 4] }]);
    expect(readBoxerAnswer('noise {"label": "belt", "box_2d": [1, 2, 3, 4]} ,, {"label": "hat"', ARGON))
      .toEqual([{ label: "belt", raw: [1, 2, 3, 4] }]);
    expect(readBoxerAnswer('x {"box_2d": [1,2,3,4], "label": "belt"} y {', ARGON)).toEqual([{ label: "belt", raw: [1, 2, 3, 4] }]);
  });

  it("answers [] for an empty list and null for prose nothing can read", () => {
    expect(readBoxerAnswer("```json\n[]\n```", ARGON)).toEqual([]);
    expect(readBoxerAnswer("I cannot see that.", ARGON)).toBeNull();
  });
});

describe("the flag at the wire", () => {
  const NAMES = ["jacket", "scarf", "belt"];

  it("OFF (negative control): every name goes to today's detector, one request each, bytes as today, nothing to OpenRouter", async () => {
    const sent = wire({ detect: () => ({ objects: [{ x_min: 0.25, y_min: 0.5, x_max: 0.5, y_max: 1 }] }) });
    expect(pointerBoxerFor(1)).toBeUndefined();
    const reader = readerFor(1);
    const image = await frame();

    const answers = await Promise.all(NAMES.map((name) => reader.pointer!({ image, name })));

    expect(toOpenRouter(sent)).toHaveLength(0);
    expect(toDetector(sent).map((one) => one.body.prompt).sort()).toEqual([...NAMES].sort());
    for (const one of toDetector(sent)) {
      /* Today's body, key for key — nothing added beside it. */
      expect(Object.keys(one.body).sort()).toEqual(["image_url", "prompt"]);
      expect(one.body.image_url).toBe(`data:image/png;base64,${image.toString("base64")}`);
    }
    expect(answers).toEqual(NAMES.map(() => [{ x: 50, y: 50, width: 50, height: 50 }]));
  });

  it("ON for his account (positive control): ONE request to Argon carrying every name, at low effort, picture first", async () => {
    process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1";
    const sent = wire({
      openrouter: {
        [ARGON.model]: { content: JSON.stringify([
          { label: "jacket", box_2d: [250, 250, 750, 750] },
          { label: "belt", box_2d: [0, 0, 500, 500] },
        ]) },
      },
    });
    const reader = readerFor(1);
    const image = await frame();

    const answers = await Promise.all(NAMES.map((name) => reader.pointer!({ image, name })));

    expect(toDetector(sent)).toHaveLength(0);
    const out = toOpenRouter(sent);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(out[0].body.model).toBe("google/gemini-4-argon");
    expect(out[0].body.reasoning).toEqual({ effort: "low" });
    expect(out[0].body.temperature).toBe(0);
    expect(out[0].body.messages).toHaveLength(1);
    expect(out[0].body.messages[0].content[0].type).toBe("image_url");
    const sentence = sentenceOf(out[0]);
    for (const name of NAMES) expect(sentence).toContain(`"${name}"`);
    expect(sentence).toContain('"box_2d": [ymin, xmin, ymax, xmax]');
    expect(sentence).toContain("normalized to 0-1000");
    expect(answers).toEqual([
      [{ x: 50, y: 25, width: 100, height: 50 }],
      [],
      [{ x: 0, y: 0, width: 100, height: 50 }],
    ]);
  });

  it("ON, someone else's account: still today's detector — the flag is per account", async () => {
    process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1";
    const sent = wire({});
    await readerFor(2).pointer!({ image: await frame(), name: "belt" });
    expect(toOpenRouter(sent)).toHaveLength(0);
    expect(toDetector(sent)).toHaveLength(1);
  });

  it("through a real caller that asked name by name: the reference reading's names share one request", async () => {
    process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1";
    const sent = wire({
      openrouter: { [ARGON.model]: { content: '[{"label":"sweater","box_2d":[100,100,900,500]}]' } },
    });
    const features = ["sweater", "sneaker", "belt"].map((name) => ({
      name, kind: "clothing", on: "", count: 1, coverage: "single",
    })) as unknown as DiscoveredFeature[];

    const marked = await markReferenceThings({ picture: await frame(), features, reader: readerFor(1) });

    expect(toOpenRouter(sent)).toHaveLength(1);
    expect(toDetector(sent)).toHaveLength(0);
    expect(marked.markers.map((one) => one.name)).toEqual(["sweater"]);
    expect(marked.unmarked).toEqual(["sneaker", "belt"]);
  });
});

describe("the fallback, in his order", () => {
  beforeEach(() => { process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1"; });

  it("Argon fails, so Qwen3-VL answers — in structured mode, in its own layout", async () => {
    const sent = wire({
      openrouter: {
        [ARGON.model]: { status: 503 },
        [QWEN.model]: { content: '{"detections":[{"label":"belt","bbox_2d":[100,200,300,600]}]}', cost: 0.0006 },
      },
    });
    const boxes = await readerFor(1).pointer!({ image: await frame(), name: "belt" });

    expect(toOpenRouter(sent).map((one) => one.body.model)).toEqual([ARGON.model, QWEN.model]);
    expect(toOpenRouter(sent)[1].body.response_format.json_schema.name).toBe("detections");
    expect(toOpenRouter(sent)[1].body.reasoning).toBeUndefined();
    expect(sentenceOf(toOpenRouter(sent)[1])).toContain('"bbox_2d": [x1, y1, x2, y2]');
    expect(boxes).toEqual([{ x: 20, y: 20, width: 40, height: 40 }]);
    expect(toDetector(sent)).toHaveLength(0);
  });

  it("an unreadable or cut-off answer is a failure too, and the next engine is asked", async () => {
    const sent = wire({
      openrouter: {
        [ARGON.model]: { content: '[{"label":"belt","box_2d":[1,2,3,4]}', finish: "length" },
        [QWEN.model]: { content: "I am not sure what you mean." },
      },
      detect: () => ({ objects: [] }),
    });
    expect(await readerFor(1).pointer!({ image: await frame(), name: "belt" })).toEqual([]);
    expect(toOpenRouter(sent)).toHaveLength(2);
    expect(toDetector(sent)).toHaveLength(1);
  });

  it("both fail, so today's detector answers each name with today's request", async () => {
    const sent = wire({
      openrouter: { [ARGON.model]: { status: 500 }, [QWEN.model]: { status: 429 } },
      detect: () => ({ objects: [{ x_min: 0.25, y_min: 0.5, x_max: 0.5, y_max: 1 }] }),
    });
    const reader = readerFor(1);
    const image = await frame();
    const answers = await Promise.all(["belt", "scarf"].map((name) => reader.pointer!({ image, name })));

    expect(toOpenRouter(sent)).toHaveLength(2);
    expect(toDetector(sent).map((one) => one.body.prompt).sort()).toEqual(["belt", "scarf"]);
    for (const one of toDetector(sent)) expect(Object.keys(one.body).sort()).toEqual(["image_url", "prompt"]);
    expect(answers).toEqual([[{ x: 50, y: 50, width: 50, height: 50 }], [{ x: 50, y: 50, width: 50, height: 50 }]]);
  });

  it("all three fail: the ask THROWS as today's does, and the reference reading fails open to words", async () => {
    const sent = wire({
      openrouter: { [ARGON.model]: { status: 500 }, [QWEN.model]: { status: 500 } },
      detect: () => ({ status: 500 }),
    });
    await expect(readerFor(1).pointer!({ image: await frame(), name: "belt" })).rejects.toThrow();
    const marked = await markReferenceThings({
      picture: await frame(),
      features: [{ name: "belt", kind: "clothing", on: "", count: 1, coverage: "single" }] as unknown as DiscoveredFeature[],
      reader: readerFor(1),
    });
    expect(marked).toEqual({ markers: [], unmarked: ["belt"] });
    expect(toDetector(sent).length).toBeGreaterThan(0);
  });

  it("a hung engine is passed over at its own deadline", async () => {
    const sent = wire({
      openrouter: { hung: "hang", [QWEN.model]: { content: "[]" } },
    });
    const boxer = createOpenRouterBoxer({
      apiKey: "k",
      steps: [{ ...ARGON, model: "hung", timeoutMs: 30 }, QWEN],
    });
    const answer = await boxer.boxAll({ image: await frame(), width: WIDTH, height: HEIGHT, names: ["belt"] });
    expect(answer?.get("belt")).toEqual([]);
    expect(toOpenRouter(sent).map((one) => one.body.model)).toEqual(["hung", QWEN.model]);
  });

  /**
   * THE DEADLINE IS THE STEP'S OWN NUMBER, AND THE SHIPPED NUMBER IS 12 s
   * (#2863's review: the two deadlines stacked to 40 s before a fallback
   * answered, on a road a customer has paid for).
   *
   * ⚠ These are TWO arms on purpose, because neither alone proves the claim.
   * A hung engine waiting out the real 12 s would put twelve seconds of sleep
   * into a suite every preflight runs, and a fake clock cannot stand in for it
   * — measured on this machine rather than assumed: `vi.useFakeTimers()` does
   * NOT drive `AbortSignal.timeout` (Node's own timer is not intercepted), so
   * an arm built on advancing a fake clock passes while proving nothing. So
   * the mechanism is driven at two DIFFERENT injected deadlines, which is what
   * shows the handover tracks the step's own field rather than any fixed
   * number, and the shipped field is pinned beside it.
   */
  it("the handover time tracks the step's OWN deadline, not a number fixed in the runner", async () => {
    const handoverAfter = async (timeoutMs: number): Promise<number> => {
      const sent = wire({ openrouter: { hung: "hang", [QWEN.model]: { content: "[]" } } });
      const boxer = createOpenRouterBoxer({ apiKey: "k", steps: [{ ...ARGON, model: "hung", timeoutMs }, QWEN] });
      const startedAt = Date.now();
      await boxer.boxAll({ image: await frame(), width: WIDTH, height: HEIGHT, names: ["belt"] });
      const elapsed = Date.now() - startedAt;
      expect(toOpenRouter(sent).map((one) => one.body.model)).toEqual(["hung", QWEN.model]);
      return elapsed;
    };
    /* A timer fires late or on time, never early, so the FLOOR is the safe
       assertion and the ceiling is generous. The two readings must separate:
       a runner ignoring the field would hand over at the same moment twice. */
    const quick = await handoverAfter(60);
    const slow = await handoverAfter(600);
    expect(quick).toBeLessThan(400);
    expect(slow).toBeGreaterThanOrEqual(550);
    expect(slow - quick).toBeGreaterThan(300);
  });

  it("the SHIPPED ladder hands over at 12 s and answers inside ~22 s — never the 40 s it was", () => {
    expect(BOXER_STEPS.map((step) => [step.engine, step.timeoutMs])).toEqual([
      ["argon", 12_000],
      ["qwen", 10_000],
    ]);
    /* The number the finding was about: the worst wait to an answer before
       today's detector is asked. 40_000 is what it must never be again. */
    const worstToAnAnswer = BOXER_STEPS.reduce((total, step) => total + step.timeoutMs, 0);
    expect(worstToAnAnswer).toBeLessThanOrEqual(22_000);
  });
});

describe("the census: one priced row per call, labelled by the road and never by a noun", () => {
  it("records the boxer's price and tokens, and the fixed label", async () => {
    process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1";
    wire({ openrouter: { [ARGON.model]: { content: "[]", cost: 0.0051 } } });
    const reader = readerFor(1);
    const image = await frame();
    const { census } = await withCallCensus(async () => {
      await Promise.all(["a secret word", "another"].map((name) => reader.pointer!({ image, name })));
    });
    expect(census.calls).toHaveLength(1);
    expect(census.calls[0]).toMatchObject({
      stage: "segment", provider: "openrouter", model: ARGON.model, about: POINTER_BOXER_ABOUT, ok: true,
      costUsd: 0.0051, tokens: { in: 1200, out: 80 },
    });
    expect(census.total.costUsd).toBeCloseTo(0.0051);
    expect(census.total.pricedCalls).toBe(1);
    expect(JSON.stringify(census)).not.toContain("secret");
  });
});

describe("the flag's own boot fence — a child of the chain root", () => {
  it("accepts off and his account under an open root, and refuses a scope past its parent", async () => {
    const { validateCastingPointerEngineEnvironment, captureCastingPointerEngineEnabled } = await import("./castingV2Scope");
    expect(validateCastingPointerEngineEnvironment({ scope: undefined, castingScope: "off" })).toEqual({ kind: "off" });
    expect(validateCastingPointerEngineEnvironment({ scope: "users:1", castingScope: "all" })).toEqual({ kind: "users", userIds: [1] });
    expect(() => validateCastingPointerEngineEnvironment({ scope: "users:1", castingScope: "off" })).toThrow(/CASTING_V2_SCOPE is off/);
    expect(() => validateCastingPointerEngineEnvironment({ scope: "all", castingScope: "users:1" })).toThrow(/cannot be "all"/);
    expect(() => validateCastingPointerEngineEnvironment({ scope: "users:2", castingScope: "users:1" })).toThrow(/outside/);
    expect(() => validateCastingPointerEngineEnvironment({ scope: "everyone", castingScope: "all" })).toThrow(/must be "off"/);
    /* And the gate is an AND of the chain at the point of use. */
    process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1";
    process.env.CASTING_V2_SCOPE = "off";
    expect(captureCastingPointerEngineEnabled(1)).toBe(false);
    process.env.CASTING_V2_SCOPE = "all";
    expect(captureCastingPointerEngineEnabled(1)).toBe(true);
  });

  it("is switched on with no OpenRouter key: no boxer, today's detector", () => {
    process.env.CASTING_POINTER_ENGINE_SCOPE = "users:1";
    delete process.env.OPENROUTER_API_KEY;
    expect(pointerBoxerFor(1)).toBeUndefined();
  });
});

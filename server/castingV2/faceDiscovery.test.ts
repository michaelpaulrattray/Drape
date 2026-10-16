/**
 * THE DISCOVERY READ, DRIVEN DIRECTLY — never through a scan (#2566).
 *
 * Working law 3: *"a backstop needs a test the model cannot rescue."* Every
 * property that matters here is a REFUSAL — a caption dropped, a failure
 * falling open, a question kept because the phrasebook has never heard of it —
 * and all of them are invisible from a scan that happens to go well. So the
 * engine is a double that answers exactly what each arm needs it to, including
 * the answers a real provider gives on a bad minute.
 *
 * The arm that matters most is the one that looks like it is testing nothing:
 * **a failed discovery must leave the plan whole.** That is the difference
 * between this road saving half a cent and this road taking a feature off a
 * customer's panel because a provider timed out.
 */
import { describe, expect, it } from "vitest";

import {
  DISCOVERY_PHRASEBOOK,
  discoverFeatures,
  discoveryCropsOf,
  gateScanPlan,
  isBareNoun,
  mergeDiscoveries,
  parseDiscovery,
  type FaceDiscovery,
} from "./faceDiscovery";
import { scanPlan } from "./faceScan";
import type { TextEngine, TextRequest, TextResult } from "../providers/types";

/** An engine that says exactly what it is told to, once per call. */
function engineSaying(...answers: Array<string | Error>): TextEngine & { calls: TextRequest[] } {
  return engineSayingTruncated(false, ...answers);
}

/** The same, with the provider's own cut-off-at-the-ceiling signal set. */
function engineSayingTruncated(
  truncated: boolean,
  ...answers: Array<string | Error>
): TextEngine & { calls: TextRequest[] } {
  const calls: TextRequest[] = [];
  let at = 0;
  return {
    id: "test:engine",
    calls,
    async complete(request: TextRequest): Promise<TextResult> {
      calls.push(request);
      const answer = answers[Math.min(at, answers.length - 1)];
      at += 1;
      if (answer instanceof Error) throw answer;
      return {
        text: answer,
        provenance: { provider: "test", model: "test", requestedAt: new Date().toISOString() } as never,
        latencyMs: 1,
        ...(truncated ? { truncated: true } : {}),
      };
    },
  };
}

const ONE_FEATURE = JSON.stringify({
  features: [{ name: "hair", count: 1, about: "dark" }],
  cannotSee: [],
});

describe("isBareNoun — the contract a cutter downstream depends on", () => {
  it("accepts the shapes the measured prompt returns", () => {
    for (const name of ["hair", "eyes", "jaw hardware", "third eye", "shoulder plates"]) {
      expect(isBareNoun(name), name).toBe(true);
    }
  });

  it("rejects the three shapes measured to make a cutter return nothing", () => {
    /* A parenthetical, a positional clause, and a caption — the real bench
       output from #2532 arm 2, quoted rather than invented. */
    expect(isBareNoun("normal eyes (pale blue-gray, deep-set)")).toBe(false);
    expect(isBareNoun("small mole on left cheek near nose")).toBe(false);
    expect(isBareNoun("dark hair styled in a high bun with loose face-framing strands")).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(isBareNoun("")).toBe(false);
    expect(isBareNoun("   ")).toBe(false);
  });
});

describe("parseDiscovery", () => {
  it("drops a name that is not bare rather than repairing it", () => {
    const parsed = parseDiscovery(JSON.stringify({
      features: [
        { name: "hair", count: 1, about: "" },
        /*
          ⚠ BOTH of these are SHORT — under the 40-character cap — on purpose,
          and the first draft of this arm was not. It used the real 49-character
          bench caption, which `cleanName`'s length cap rejects on its own, so
          the arm passed with the bareness check DELETED (driven: sabotage 3 of
          this suite, 30/30 green). An arm rescued by a neighbouring guard tests
          the neighbour.
        */
        { name: "mole on left cheek", count: 1, about: "" },
        { name: "eyes (deep-set)", count: 2, about: "" },
      ],
      cannotSee: [],
    }));
    /* Repairing a caption into a noun would be a guess that reaches a cutter;
       dropping it costs one row the pointer road can still find later. */
    expect(parsed?.features.map((f) => f.name)).toEqual(["hair"]);
  });

  it("drops a name too long to be a noun at all", () => {
    /* The length cap, driven on its own now that the arm above no longer
       leans on it. */
    const parsed = parseDiscovery(JSON.stringify({
      features: [
        { name: "hair", count: 1, about: "" },
        { name: "mechanical jaw brackets with tube-like extensions", count: 2, about: "" },
      ],
      cannotSee: [],
    }));
    expect(parsed?.features.map((f) => f.name)).toEqual(["hair"]);
  });

  it("reads an answer the provider fenced", () => {
    const parsed = parseDiscovery("```json\n" + ONE_FEATURE + "\n```");
    expect(parsed?.features[0]?.name).toBe("hair");
  });

  it("refuses an answer that named nothing at all", () => {
    /* A reader that said nothing is not a face with nothing on it, and
       treating the two the same would gate a whole scan to silence. */
    expect(parseDiscovery(JSON.stringify({ features: [], cannotSee: [] }))).toBeNull();
  });

  it("refuses prose", () => {
    expect(parseDiscovery("I can see hair, eyes and a nose.")).toBeNull();
  });

  it("keeps what cannot be seen, with its reason", () => {
    const parsed = parseDiscovery(JSON.stringify({
      features: [{ name: "eyes", count: 2, about: "" }],
      cannotSee: [{ name: "ears", why: "covered by the hood" }],
    }));
    expect(parsed?.cannotSee).toEqual([{ name: "ears", why: "covered by the hood" }]);
  });

  it("floors a nonsense count at one and caps a silly one", () => {
    const parsed = parseDiscovery(JSON.stringify({
      features: [
        { name: "eyes", count: 0, about: "" },
        { name: "scales", count: 9999, about: "" },
      ],
      cannotSee: [],
    }));
    expect(parsed?.features.find((f) => f.name === "eyes")?.count).toBe(1);
    expect(parsed?.features.find((f) => f.name === "scales")?.count).toBe(20);
  });
});

describe("mergeDiscoveries — the two crops", () => {
  it("keeps the larger count when both crops see the same thing", () => {
    /* The crop that can see only one of a pair is the one that is wrong about
       how many there are. */
    const merged = mergeDiscoveries([
      { features: [{ name: "earring", count: 1, about: "" }], cannotSee: [] },
      { features: [{ name: "earring", count: 2, about: "" }], cannotSee: [] },
    ]);
    expect(merged.features).toEqual([{ name: "earring", count: 2, about: "" }]);
  });

  it("is the union, so a feature only one crop can see survives", () => {
    /* Measured: the head crop names the nose the full frame misses, and the
       full frame names the sash the head crop cannot see. */
    const merged = mergeDiscoveries([
      { features: [{ name: "nose", count: 1, about: "" }], cannotSee: [] },
      { features: [{ name: "sash", count: 1, about: "" }], cannotSee: [] },
    ]);
    expect(merged.features.map((f) => f.name).sort()).toEqual(["nose", "sash"]);
  });

  it("does not call something unseen when the other crop named it", () => {
    const merged = mergeDiscoveries([
      { features: [], cannotSee: [{ name: "ears", why: "under the hood" }] },
      { features: [{ name: "ears", count: 2, about: "" }], cannotSee: [] },
    ]);
    expect(merged.cannotSee).toEqual([]);
    expect(merged.features.map((f) => f.name)).toEqual(["ears"]);
  });
});

describe("gateScanPlan — what the discovery is allowed to cancel", () => {
  const plan = [
    { feature: "hair" },
    { feature: "facial-hair" },
    { feature: "eye" },
    { feature: "horns" },
  ];
  const found = (...names: string[]): FaceDiscovery => ({
    ok: true,
    features: names.map((name) => ({ name, count: 1, about: "" })),
    cannotSee: [],
    crops: ["head", "full"],
  });

  it("drops the questions nothing on this character answers", () => {
    const gated = gateScanPlan(plan, found("hair", "eyes"));
    expect(gated.plan.map((r) => r.feature)).toEqual(["hair", "eye"]);
    expect(gated.dropped.sort()).toEqual(["facial-hair", "horns"]);
  });

  it("does NOT let 'hair' keep the beard question alive — the whole saving", () => {
    /* A loose substring match would keep `facial-hair` on every clean-shaven
       face, which is exactly the read this step exists to stop buying. */
    const gated = gateScanPlan(plan, found("hair"));
    expect(gated.dropped).toContain("facial-hair");
  });

  it("keeps the beard question when a beard is actually named", () => {
    expect(gateScanPlan(plan, found("beard")).plan.map((r) => r.feature)).toContain("facial-hair");
  });

  it("matches on whole words, so 'third eye' keeps the eye question", () => {
    expect(gateScanPlan(plan, found("third eye")).plan.map((r) => r.feature)).toContain("eye");
  });

  it("asks a question the phrasebook has never heard of", () => {
    /* Fail open: the direction that costs money rather than features. */
    const gated = gateScanPlan([{ feature: "something-new" }], found("hair"));
    expect(gated.plan.map((r) => r.feature)).toEqual(["something-new"]);
    expect(gated.dropped).toEqual([]);
  });

  it("leaves the plan WHOLE when the discovery failed", () => {
    const gated = gateScanPlan(plan, { ok: false, why: "the provider timed out" });
    expect(gated.plan).toHaveLength(plan.length);
    expect(gated.dropped).toEqual([]);
  });

  it("leaves the plan WHOLE when there was no discovery at all", () => {
    expect(gateScanPlan(plan, null).plan).toHaveLength(plan.length);
    expect(gateScanPlan(plan, undefined).plan).toHaveLength(plan.length);
  });

  it("covers every question the real catalogue asks", () => {
    /* DERIVED from `scanPlan()` rather than from a list typed here, so a new
       catalogue question cannot arrive without a phrasebook entry and quietly
       become un-droppable. A missing entry is safe (it is always asked) and it
       is also a silent loss of the saving, which is why this is an arm and not
       a comment. */
    const missing = scanPlan()
      .map((region) => region.feature)
      .filter((feature) => DISCOVERY_PHRASEBOOK[feature] === undefined);
    expect(missing).toEqual([]);
  });
});

describe("discoverFeatures — every road out of a bad provider minute", () => {
  const crops = [
    { kind: "head" as const, bytes: Buffer.from("a"), contentType: "image/png" },
    { kind: "full" as const, bytes: Buffer.from("b"), contentType: "image/png" },
  ];

  it("asks both crops and merges them", async () => {
    const engine = engineSaying(
      JSON.stringify({ features: [{ name: "nose", count: 1, about: "" }], cannotSee: [] }),
      JSON.stringify({ features: [{ name: "sash", count: 1, about: "" }], cannotSee: [] }),
    );
    const answer = await discoverFeatures({ crops, engine });
    expect(engine.calls).toHaveLength(2);
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.features.map((f) => f.name).sort()).toEqual(["nose", "sash"]);
    expect([...answer.crops].sort()).toEqual(["full", "head"]);
  });

  it("sends the images, the schema and its own read purpose", async () => {
    /* Invariant 5 in miniature: the contract is proven on the outgoing
       request, not on a constant near it. */
    const engine = engineSaying(ONE_FEATURE);
    await discoverFeatures({ crops: [crops[0]!], engine });
    const sent = engine.calls[0]!;
    expect(sent.images).toHaveLength(1);
    expect(sent.about).toBe("discover");
    expect(sent.jsonSchema?.name).toBe("discovery");
    /* A hint is not a schema — #2196 measured the difference. */
    expect(sent.jsonSchema?.schema).toBeDefined();
  });

  it("survives one crop failing and answers from the other", async () => {
    const engine = engineSaying(new Error("502 from the provider"), ONE_FEATURE);
    const answer = await discoverFeatures({ crops, engine });
    expect(answer.ok).toBe(true);
    if (answer.ok) expect(answer.crops).toEqual(["full"]);
  });

  it("fails OPEN when both crops throw", async () => {
    const engine = engineSaying(new Error("timed out"), new Error("timed out"));
    const answer = await discoverFeatures({ crops, engine });
    expect(answer.ok).toBe(false);
  });

  it("fails OPEN when the answers cannot be parsed", async () => {
    const engine = engineSaying("I see a person.", "{ not json");
    expect((await discoverFeatures({ crops, engine })).ok).toBe(false);
  });

  /*
    A REPLY CUT OFF AT THE CEILING (#1272's class).

    The arm that proves this drives a reply that is truncated AND STILL PARSES
    — the case every one of these readers genuinely got wrong, because an
    unparseable fragment already fails open through the catch and an arm using
    one would measure the catch instead of the guard.

    Here the stakes are higher than anywhere else that guard reaches: a short
    feature list is not a silence, it is an instruction to CANCEL every
    question it does not mention. A cut-off reply would take real features off
    a customer's panel.
  */
  const CUT_OFF_BUT_VALID = JSON.stringify({
    features: [{ name: "hair", count: 1, about: "" }],
    cannotSee: [],
  });

  it("discards a reply the provider cut off, even though it parses", async () => {
    const engine = engineSayingTruncated(true, CUT_OFF_BUT_VALID);
    const answer = await discoverFeatures({ crops, engine });
    expect(answer.ok).toBe(false);
  });

  it("CONTROL — the same reply without the flag is read exactly as before", async () => {
    /* A guard keying on the reply's SHAPE rather than on `truncated` would
       fail this control by refusing an honestly short answer. */
    const engine = engineSaying(CUT_OFF_BUT_VALID);
    const answer = await discoverFeatures({ crops, engine });
    expect(answer.ok).toBe(true);
    if (answer.ok) expect(answer.features.map((f) => f.name)).toEqual(["hair"]);
  });

  it("a cut-off reply gates NOTHING — the consequence that matters", async () => {
    const engine = engineSayingTruncated(true, CUT_OFF_BUT_VALID);
    const gated = gateScanPlan(scanPlan(), await discoverFeatures({ crops, engine }));
    expect(gated.plan).toHaveLength(scanPlan().length);
  });

  it("fails OPEN when there are no crops to read", async () => {
    const engine = engineSaying(ONE_FEATURE);
    expect((await discoverFeatures({ crops: [], engine })).ok).toBe(false);
    expect(engine.calls).toHaveLength(0);
  });

  it("a failed discovery gates nothing — the property the whole road rests on", async () => {
    const engine = engineSaying(new Error("down"), new Error("down"));
    const answer = await discoverFeatures({ crops, engine });
    const gated = gateScanPlan(scanPlan(), answer);
    expect(gated.plan).toHaveLength(scanPlan().length);
  });
});

describe("discoveryCropsOf", () => {
  /** A real PNG, because the crop is real `sharp` work and a fake buffer would
   *  prove only that the catch block runs. */
  async function squareOf(width: number, height: number): Promise<Buffer> {
    const sharp = (await import("sharp")).default;
    return sharp({
      create: { width, height, channels: 3, background: { r: 10, g: 10, b: 10 } },
    }).png().toBuffer();
  }

  it("cuts the head and the full frame", async () => {
    const bytes = await squareOf(1024, 1536);
    const crops = await discoveryCropsOf({ bytes, width: 1024, height: 1536 });
    expect(crops.map((c) => c.kind)).toEqual(["head", "full"]);
    const sharp = (await import("sharp")).default;
    const head = await sharp(crops[0]!.bytes).metadata();
    const full = await sharp(crops[1]!.bytes).metadata();
    /* Same width on purpose: the only thing that differs between the two reads
       is what is IN the picture, not how many pixels the model was handed. */
    expect(head.width).toBe(768);
    expect(full.width).toBe(768);
    expect(head.height!).toBeLessThan(full.height!);
  });

  it("asks a tiny frame whole, once", async () => {
    const bytes = await squareOf(80, 80);
    const crops = await discoveryCropsOf({ bytes, width: 80, height: 80 });
    /* A 40px head crop is not a cheaper reading, it is a wasted call. */
    expect(crops.map((c) => c.kind)).toEqual(["full"]);
  });

  it("returns nothing rather than throwing on bytes sharp cannot read", async () => {
    const crops = await discoveryCropsOf({ bytes: Buffer.from("not an image"), width: 100, height: 100 });
    expect(crops).toEqual([]);
  });
});

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
import { catalogueSlots } from "./referenceSlotCatalogue";
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
    /*
      AND THE WORDS ARE KEPT WHERE NO CUTTER LOOKS — the relay's third finding
      on PR #2570. Until this, a rejected name vanished entirely, so the FACT
      that the reader saw something went with the unusable words and cancelled
      the question: a parse rule became a deletion. `unusable` is read by the
      gate alone, as a reason to ask.
    */
    expect(parsed?.unusable).toEqual(["mole on left cheek", "eyes (deep-set)"]);
  });

  it("drops a name too long to be a noun at all, and keeps NOTHING of it", () => {
    /*
      The length cap, driven on its own now that the arm above no longer leans
      on it — and the line between the two rejections is deliberate: a caption
      is a real feature named badly, so its words earn a place in `unusable`,
      while prose past the cap is not an answer at all and earns none. A
      40-character floor on what may keep a question alive is also what stops
      `unusable` becoming a second, looser phrasebook.
    */
    const parsed = parseDiscovery(JSON.stringify({
      features: [
        { name: "hair", count: 1, about: "" },
        { name: "mechanical jaw brackets with tube-like extensions", count: 2, about: "" },
      ],
      cannotSee: [],
    }));
    expect(parsed?.features.map((f) => f.name)).toEqual(["hair"]);
    expect(parsed?.unusable).toEqual([]);
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

  it("unions the rejected names and does NOT net them off against the features", () => {
    /*
      They only ever make the gate ASK, so a name that is also a clean feature
      on the other crop costs nothing, and de-duplicating one against
      `features` could only ever make the gate cancel MORE — which is the
      direction the relay's finding was about. Driven because the obvious tidy
      shape (mirror the `cannotSee` rule above) is the wrong one here.
    */
    const merged = mergeDiscoveries([
      { features: [], cannotSee: [], unusable: ["dangling gold earrings"] },
      { features: [{ name: "earring", count: 2, about: "" }], cannotSee: [], unusable: ["long black hair"] },
    ]);
    expect([...merged.unusable].sort()).toEqual(["dangling gold earrings", "long black hair"]);
  });

  it("takes a crop that carries no rejected names at all", () => {
    /* `unusable` is optional on the INPUT on purpose: every caller inside this
       module passes it, and the field is young enough that a crop shape from
       elsewhere should degrade to "nothing was rejected" rather than throw. */
    expect(mergeDiscoveries([{ features: [{ name: "hair", count: 1, about: "" }], cannotSee: [] }]).unusable)
      .toEqual([]);
  });
});

describe("gateScanPlan — what the discovery is allowed to cancel", () => {
  const plan = [
    { feature: "hair" },
    { feature: "facial-hair" },
    { feature: "eye" },
    { feature: "teeth" },
    { feature: "ear" },
    { feature: "skin" },
    { feature: "horns" },
    { feature: "earring" },
    { feature: "glasses" },
  ];
  const found = (...names: string[]): FaceDiscovery => ({
    ok: true,
    features: names.map((name) => ({ name, count: 1, about: "" })),
    cannotSee: [],
    unusable: [],
    crops: ["head", "full"],
  });

  it("drops only the optional features nothing on this character answers", () => {
    const gated = gateScanPlan(plan, found("hair", "eyes", "horns"));
    /* Horns were named; earrings and glasses were not, and nothing else here
       is cancellable at all. */
    expect(gated.dropped.sort()).toEqual(["earring", "glasses"]);
    expect(gated.plan.map((r) => r.feature))
      .toEqual(["hair", "facial-hair", "eye", "teeth", "ear", "skin", "horns"]);
  });

  it("CANNOT drop a feature every character has, whatever the reading says", () => {
    /*
      THE RELAY'S FIRST FINDING ON PR #2570, as an arm — driven on dev, read at
      the frames: cast 812 lost TEETH in 3 of 3 readings with the teeth plainly
      visible, and cast 772 lost BOTH EARS. A reading that did not mention the
      teeth has missed them, never found them absent.
    */
    const gated = gateScanPlan(plan, found("hair"));
    for (const feature of ["hair", "facial-hair", "eye", "teeth", "ear", "skin"]) {
      expect(gated.plan.map((r) => r.feature)).toContain(feature);
      expect(gated.dropped).not.toContain(feature);
    }
  });

  it("CANNOT drop the two features the panel can state an absence for", () => {
    /*
      DERIVED FROM THE CATALOGUE, not from the pair of names above — `hair` and
      `facial-hair` are the only slots carrying `whenAbsent` ("bald",
      "clean-shaven"), and an absence is built from a question that was ASKED
      and came back empty. Cancelling the question deletes the row, so the
      saving's whole product would be the row it deleted (the relay's fifth
      finding). A third `whenAbsent` member arriving cancellable reddens here.
    */
    const speaks = catalogueSlots()
      .filter((definition) => definition.whenAbsent !== undefined)
      .map((definition) => definition.feature);
    expect(speaks.length).toBeGreaterThan(0);
    for (const feature of speaks) expect(DISCOVERY_PHRASEBOOK[feature]).toBeUndefined();
  });

  it("keeps an optional question when the feature is actually named", () => {
    expect(gateScanPlan(plan, found("earring")).plan.map((r) => r.feature)).toContain("earring");
    expect(gateScanPlan(plan, found("goggles")).plan.map((r) => r.feature)).toContain("glasses");
    expect(gateScanPlan(plan, found("antlers")).plan.map((r) => r.feature)).toContain("horns");
  });

  it("matches on whole words, so 'ears' does NOT keep the earring question alive", () => {
    /* The saving's whole size, one entry over from where this argument started:
       a loose substring match would have every character on the platform paying
       for an earring read, because every character has ears. */
    expect(gateScanPlan(plan, found("ears")).dropped).toContain("earring");
    expect(gateScanPlan(plan, found("ear studs")).dropped).not.toContain("earring");
  });

  it("reads 'I cannot see it' as a reason to ASK, never as an absence", () => {
    /*
      THE RELAY'S FINDING AT ITS SHARPEST: cast 772's reading listed "ears"
      under `cannotSee` and the ears were visible behind the strands, with
      today's segmenter finding them. The same shape on an optional feature is
      what this arm drives, because that is the only set the gate can still
      touch.
    */
    const hidden: FaceDiscovery = {
      ok: true,
      features: [{ name: "hair", count: 1, about: "" }],
      cannotSee: [{ name: "earrings", why: "behind the strands" }],
      unusable: [],
      crops: ["head", "full"],
    };
    expect(gateScanPlan(plan, hidden).dropped).not.toContain("earring");
    expect(gateScanPlan(plan, hidden).dropped).toContain("glasses");
  });

  it("reads a REJECTED name as a reason to ask — a parse rule is not a deletion", () => {
    /*
      The relay's third finding. `cleanName` drops "dangling gold earrings"
      because a cutter handed those words returns nothing — and until this the
      rejection ALSO cancelled the earring question, so a caption became a
      deletion. The words still never reach a cutter: they are in `unusable`,
      which only ever makes the gate ask.
    */
    const captioned: FaceDiscovery = {
      ok: true,
      features: [{ name: "hair", count: 1, about: "" }],
      cannotSee: [],
      unusable: ["dangling gold earrings"],
      crops: ["head", "full"],
    };
    expect(gateScanPlan(plan, captioned).dropped).not.toContain("earring");
    /* And the negative control beside it: the rejection keeps its OWN question
       alive and nothing else's. */
    expect(gateScanPlan(plan, captioned).dropped).toContain("glasses");
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

  it("can cancel three of the real catalogue's twelve questions, and names them", () => {
    /*
      DERIVED from `scanPlan()` rather than typed here, and it pins BOTH sides
      of the split so a new catalogue question has to be classified on purpose:
      an entry arriving in the phrasebook makes a question cancellable, and the
      arm above proves an absence-speaking one may never be.

      The enumeration is the point, the way the catalogue's own `whenAbsent`
      case is: this is the honest size of the saving — three of twelve — and a
      fourth member arriving without an argument is what this makes visible.
    */
    const features = scanPlan().map((region) => region.feature);
    const cancellable = features.filter((feature) => DISCOVERY_PHRASEBOOK[feature] !== undefined);
    expect(cancellable).toEqual(["horns", "earring", "glasses"]);
    expect(features.filter((feature) => DISCOVERY_PHRASEBOOK[feature] === undefined))
      .toEqual(["hair", "facial-hair", "eye", "brow", "nose", "lips", "teeth", "ear", "skin"]);
    /* And nothing in the phrasebook that the catalogue does not ask: a noun
       list for a question nobody sends is dead data wearing a gate's clothes. */
    expect(Object.keys(DISCOVERY_PHRASEBOOK).filter((key) => !features.includes(key))).toEqual([]);
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

  it("fails OPEN when one crop fails and the other answers", async () => {
    /*
      THE RELAY'S SECOND FINDING ON PR #2570, and it is the one arm here whose
      expectation REVERSED. It read *"survives one crop failing and answers from
      the other"*, which sounds like resilience and is a narrowing: the two
      crops ask different questions (the head crop reads the face, the full
      frame reads what they are wearing), and this module's own measurement
      caught the full frame missing the NOSE on the human fixture. So a surviving
      crop is not a cheaper version of both — it is one question wearing the
      other one's authority, and it was allowed to cancel questions.

      Both directions are driven, because the risk is not symmetric by chance:
      whichever crop dies, the catalogue is asked whole.
    */
    const headDied = await discoverFeatures({
      crops,
      engine: engineSaying(new Error("502 from the provider"), ONE_FEATURE),
    });
    expect(headDied.ok).toBe(false);
    const fullDied = await discoverFeatures({
      crops,
      engine: engineSaying(ONE_FEATURE, new Error("502 from the provider")),
    });
    expect(fullDied.ok).toBe(false);
  });

  it("a part-answer gates NOTHING — the consequence that matters", async () => {
    const answer = await discoverFeatures({
      crops,
      engine: engineSaying(new Error("502 from the provider"), ONE_FEATURE),
    });
    const gated = gateScanPlan([{ feature: "earring" }, { feature: "glasses" }], answer);
    expect(gated.plan).toHaveLength(2);
    expect(gated.dropped).toEqual([]);
  });

  it("CONTROL — both crops answering still gates, so the arm above is not vacuous", async () => {
    /* Working law 2: the arm above would pass on a gate that never cancels
       anything at all. This is the positive control that says it can. */
    const answer = await discoverFeatures({ crops, engine: engineSaying(ONE_FEATURE, ONE_FEATURE) });
    expect(answer.ok).toBe(true);
    expect(gateScanPlan([{ feature: "earring" }], answer).dropped).toEqual(["earring"]);
  });

  it("asks with a deadline of its own and no retries", async () => {
    /*
      THE RELAY'S FOURTH FINDING, proven at the WIRE rather than at a constant
      near it (invariant 5). It matters because of where this call sits: ahead
      of every segmenter call in the scan and on the interpreter's shared text
      queue, so the transport's defaults (45 s × 3) would hold a customer's
      whole panel — and a paid roll's interpreter behind it — for over two
      minutes on one hung provider.
    */
    const engine = engineSaying(ONE_FEATURE, ONE_FEATURE);
    await discoverFeatures({ crops, engine });
    expect(engine.calls).toHaveLength(2);
    for (const sent of engine.calls) {
      expect(sent.timeoutMs).toBe(15_000);
      expect(sent.retries).toBe(0);
    }
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

  it("asks a frame too small to head-crop NOTHING, rather than the full frame alone", async () => {
    /*
      This arm read *"asks a tiny frame whole, once"* and expected `["full"]`.
      The reasoning behind it still holds — a 40px head crop is not a cheaper
      reading, it is a wasted call — but the conclusion does not: since the
      relay's second finding, `discoverFeatures` refuses to gate anything on a
      part-answer, so that one call would have been paid for and then
      discarded. Both or neither, which saves the call and closes the hole in
      the same line.
    */
    const bytes = await squareOf(80, 80);
    expect(await discoveryCropsOf({ bytes, width: 80, height: 80 })).toEqual([]);
    /* And the positive control one pixel the other side of the line, so this
       is not passing because `sharp` refused the frame. */
    const big = await squareOf(1024, 1536);
    expect((await discoveryCropsOf({ bytes: big, width: 1024, height: 1536 })).map((c) => c.kind))
      .toEqual(["head", "full"]);
  });

  it("returns nothing rather than throwing on bytes sharp cannot read", async () => {
    /*
      ⚠ THE SIZE IS LOAD-BEARING AND IT WAS 100×100, WHICH IS UNDER THE
      HEAD-CROP FLOOR — so once the both-or-neither rule landed this arm
      returned `[]` before `sharp` was ever handed the bytes, and passed while
      measuring the wrong branch entirely. A frame big enough to crop is the
      only one that can reach the catch.
    */
    const crops = await discoveryCropsOf({
      bytes: Buffer.from("not an image"),
      width: 1024,
      height: 1536,
    });
    expect(crops).toEqual([]);
  });
});

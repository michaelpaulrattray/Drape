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
  discoverFeatures,
  discoveryCropsOf,
  isBareNoun,
  mergeDiscoveries,
  parseDiscovery,
  DISCOVERY_NAME_MAX_WORDS,
  DISCOVERY_SCHEMA,
  DISCOVERY_SYSTEM_PROMPT,
  type DiscoveredFeature,
  type FaceDiscovery,
} from "./faceDiscovery";
/* #2877: the cut-naming road's own bound, read from the module that declares it
   beside its prompt rather than copied as a number into this file. */
import { CUT_NAME_MAX_WORDS, CUT_NAME_PROMPT } from "./referenceCutName";
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
      expect(isBareNoun(name, DISCOVERY_NAME_MAX_WORDS), name).toBe(true);
    }
  });

  it("rejects the three shapes measured to make a cutter return nothing", () => {
    /* A parenthetical, a positional clause, and a caption — the real bench
       output from #2532 arm 2, quoted rather than invented. */
    expect(isBareNoun("normal eyes (pale blue-gray, deep-set)", DISCOVERY_NAME_MAX_WORDS)).toBe(false);
    expect(isBareNoun("small mole on left cheek near nose", DISCOVERY_NAME_MAX_WORDS)).toBe(false);
    expect(isBareNoun("dark hair styled in a high bun with loose face-framing strands", DISCOVERY_NAME_MAX_WORDS)).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(isBareNoun("", DISCOVERY_NAME_MAX_WORDS)).toBe(false);
    expect(isBareNoun("   ", DISCOVERY_NAME_MAX_WORDS)).toBe(false);
  });

  /*
    #2877 — THE WORD CAP IS THE CALLER'S, AND THESE ARE THE ARMS THAT SAY SO.

    There was no arm driving the word bound at all before this card, which is
    why 300 paid readings found the defect and the suite did not. The three
    SHAPE rules are bound-independent and are asserted at both bounds, so a
    future caller passing a third number inherits proven behaviour rather than
    a guess.
  */
  it("holds a three-word name to the bound its CALLER passes, not to one of its own", () => {
    /* The exact answers #2875 measured being thrown away — quoted, not invented. */
    for (const name of ["gold hoop earring", "leather belt strap"]) {
      expect(isBareNoun(name, DISCOVERY_NAME_MAX_WORDS), name).toBe(false);
      expect(isBareNoun(name, CUT_NAME_MAX_WORDS), name).toBe(true);
    }
  });

  it("keeps refusing the shape rules at the WIDER bound, so three words is not a way round them", () => {
    /* The negative control for the arm above: if widening the cap also let a
       caption or a positional clause through, the repair would have traded one
       defect for a worse one. Each of these is <= 3 words on purpose. */
    expect(isBareNoun("eyes (deep-set)", CUT_NAME_MAX_WORDS)).toBe(false);
    expect(isBareNoun("mole on cheek", CUT_NAME_MAX_WORDS)).toBe(false);
    expect(isBareNoun("hair, loose", CUT_NAME_MAX_WORDS)).toBe(false);
    expect(isBareNoun("", CUT_NAME_MAX_WORDS)).toBe(false);
  });

  it("refuses a FOURTH word even at the cut-naming bound", () => {
    expect(isBareNoun("gold hoop drop earring", CUT_NAME_MAX_WORDS)).toBe(false);
  });

  /*
    DERIVED FROM THE PROMPT'S OWN WORDS RATHER THAN MIRRORING ITS NUMBER
    (working law 4). Each bound is stated in prose inside the prompt that asks
    for it, and a constant beside a sentence is exactly the pair that drifts —
    it is what #2877 WAS. So the number is read back out of the prompt text.
  */
  it("each bound equals the number its own prompt asks for, in words", () => {
    const WORD_FOR = new Map([[1, "one"], [2, "two"], [3, "three"], [4, "four"]]);

    const discoveryWord = WORD_FOR.get(DISCOVERY_NAME_MAX_WORDS);
    expect(discoveryWord, "no spelling for the discovery bound").toBeDefined();
    expect(
      DISCOVERY_SYSTEM_PROMPT,
      "the discovery prompt no longer asks for " + discoveryWord + " words",
    ).toContain("one or " + discoveryWord + " plain words");

    const cutWord = WORD_FOR.get(CUT_NAME_MAX_WORDS);
    expect(cutWord, "no spelling for the cut-naming bound").toBeDefined();
    expect(
      CUT_NAME_PROMPT,
      "the cut-naming prompt no longer asks for " + cutWord + " words",
    ).toContain("one to " + cutWord + " words");
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

/* One place a discovered feature is built in this suite (#2566). The three
   grouping facts take the parse's own fallbacks, so an arm about counts or
   unions reads exactly as it did before they existed — and the arms that ARE
   about the facts say so by passing them. */
const found = (name: string, count = 1, extra: Partial<DiscoveredFeature> = {}): DiscoveredFeature => (
  { name, count, about: "", kind: "anatomy", on: "", coverage: "single", ...extra }
);

describe("mergeDiscoveries — the two crops", () => {
  it("keeps the larger count when both crops see the same thing", () => {
    /* The crop that can see only one of a pair is the one that is wrong about
       how many there are. */
    const merged = mergeDiscoveries([
      { features: [found("earring")], cannotSee: [] },
      { features: [found("earring", 2)], cannotSee: [] },
    ]);
    expect(merged.features).toEqual([found("earring", 2)]);
  });

  it("is the union, so a feature only one crop can see survives", () => {
    /* Measured: the head crop names the nose the full frame misses, and the
       full frame names the sash the head crop cannot see. */
    const merged = mergeDiscoveries([
      { features: [found("nose")], cannotSee: [] },
      { features: [found("sash")], cannotSee: [] },
    ]);
    expect(merged.features.map((f) => f.name).sort()).toEqual(["nose", "sash"]);
  });

  it("does not call something unseen when the other crop named it", () => {
    const merged = mergeDiscoveries([
      { features: [], cannotSee: [{ name: "ears", why: "under the hood" }] },
      { features: [found("ears", 2)], cannotSee: [] },
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
      { features: [found("earring", 2)], cannotSee: [], unusable: ["long black hair"] },
    ]);
    expect([...merged.unusable].sort()).toEqual(["dangling gold earrings", "long black hair"]);
  });

  it("takes a crop that carries no rejected names at all", () => {
    /* `unusable` is optional on the INPUT on purpose: every caller inside this
       module passes it, and the field is young enough that a crop shape from
       elsewhere should degrade to "nothing was rejected" rather than throw. */
    expect(mergeDiscoveries([{ features: [found("hair")], cannotSee: [] }]).unusable)
      .toEqual([]);
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
    /*
      AND THE CEILING, ON THE WIRE (#2566). This call passed nothing, so it took
      the transport's default of 900 and the bench's dense-cast answer was cut
      off mid-JSON — which on this road discards the crop and loses the whole
      discovery, silently, because it fails open. Asserted here rather than on
      the constant: a default this road never set is exactly the kind of fact a
      constant near the call site cannot prove.
    */
    expect(sent.maxOutputTokens, "a dense cast's answer must not be cut off at the default 900")
      .toBe(2_000);
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

  it("asks with a deadline above the measured tail, and no retries", async () => {
    /*
      THE RELAY'S FOURTH FINDING ON PR #2570, proven at the WIRE rather than at
      a constant near it (invariant 5) — and the value is the relay's FIRST
      finding on PR #2744, which is why this arm's name and reason both moved.

      WHY A DEADLINE AT ALL: this call holds one of the four slots on the
      `openrouter-text` queue, which a paid roll's interpreter draws from too,
      so the transport's defaults (45 s × 3) would hold a slot for over two
      minutes on one hung provider. ⚠ It does NOT hold the panel, and the
      sentence here claimed it did — `faceScanService` starts it beside
      `scanFace` and awaits it at settle, since #2570's second finding.

      WHY 30 s AND NOT 15: the six reads in `output/2566/grouping-discovery.txt`
      top out at **18,821 ms** (the cyberpunk cast's head crop), so at 15 s that
      crop times out, returns null, and `discoverFeatures` refuses to gate on a
      part-answer — the densest cast loses its WHOLE discovery, silently,
      because this road fails open. 30 s is 1.6× the measured tail.

      ⚠ **This number is load-bearing on a measurement, so it is pinned rather
      than left to read as a round guess**: a later shift tightening it back
      toward the tail must meet a red here and go and read the receipt.
    */
    const engine = engineSaying(ONE_FEATURE, ONE_FEATURE);
    await discoverFeatures({ crops, engine });
    expect(engine.calls).toHaveLength(2);
    for (const sent of engine.calls) {
      expect(sent.timeoutMs, "18,821 ms was measured on a real read — 15 s loses that cast's whole discovery")
        .toBe(30_000);
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

  it("fails OPEN when there are no crops to read", async () => {
    const engine = engineSaying(ONE_FEATURE);
    expect((await discoverFeatures({ crops: [], engine })).ok).toBe(false);
    expect(engine.calls).toHaveLength(0);
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

describe("the three grouping facts — what each named thing IS (#2566)", () => {
  /*
    His binding sentence is why these are ASKED rather than looked up: *"nothing
    should be confined to a set list thats the old way of doing things the new
    way is the image is analyzed and features are determined that way."* So
    nothing here asserts a vocabulary — these arms hold the CONTRACT (the facts
    arrive, a bad one can never cost a feature, and two crops reconcile the way
    the design says), never a list of which feature is which kind.
  */

  describe("the prompt and the schema carry the MEASURED ask", () => {
    /*
      ⚠ THESE ARMS GUARD A MEASURED ARTIFACT, WHICH IS AN UNUSUAL THING FOR A
      TEST TO DO AND IS THE POINT. The grouping paragraph is byte-identical to
      the bench's (`scripts/_2566-grouping-discovery-disposable.mts`), and the
      bench is what makes the design decision-grade: run 1 said "spread across
      an area" and the model called a CONNECTED chest tattoo spread, which would
      have demoted the tattoo row he liked to words. A later shift re-wording
      either clause would silently invalidate the only evidence this road has,
      and would watch nothing go red.
    */
    it("asks for the hardware call his warning turns on, in the words that measured 4 of 4", () => {
      expect(DISCOVERY_SYSTEM_PROMPT).toContain(
        "'anatomy' for a part of the body — INCLUDING anything fixed to or embedded in the",
      );
      expect(DISCOVERY_SYSTEM_PROMPT).toContain("body hardware or a prosthetic, whatever word names it");
    });

    it("distinguishes one CONNECTED piece from many scattered bits, which run 1 did not", () => {
      expect(DISCOVERY_SYSTEM_PROMPT).toContain("one thing or one connected piece you could draw one tight");
      /* TWO failed wordings must stay gone now, not one: run 1's, and the
         sleeve-blind one this clause replaced (#2848 — "many separate small
         bits spread over an area" read a tattoo sleeve as many bits). */
      expect(DISCOVERY_SYSTEM_PROMPT).not.toContain("spread across an area");
      expect(DISCOVERY_SYSTEM_PROMPT).not.toContain("many separate");
    });

    /*
      ⚠ THIS ARM GUARDS THE #2848 MEASUREMENT, and it replaced an arm that held
      the wording it corrects. The clause before it sent a tattoo sleeve to
      WORDS: a sleeve made of many motifs answered `scattered`, and
      `pointerCut.ts`'s `foundRoadOf` gives a scattered marking no detector
      call and no cut, so his round-9 and round-10 casts got no Tattoo row at
      all — his own "her tattoos were not picked up".

      Measured through the product's own `discoverFeatures` on his two
      tattooed casts, 6 readings each per arm, today's engine, nothing else
      varied: a Tattoo row in **4 of 12 before, 12 of 12 after**; both sleeves
      cut (single AND count >= 2) 1 of 12 -> 3 of 12.

      The controls are why the clause reads as it does, and the scattered side
      keeps REPETITION as its test for exactly this reason: **freckles stayed
      6/6 scattered and wrinkles 6/6 scattered across both arms**, so the
      freckles-cut-like-an-object defect does not widen; the only non-ink
      marking called `single` was a mole, 6 times in BOTH arms. Bareness held
      at 494/494 then 460/460.
    */
    it("says a marking covering an area is ONE piece — the words that took a sleeve from 4 of 12 to 12 of 12", () => {
      expect(DISCOVERY_SYSTEM_PROMPT).toContain("ONE design is still single, however many motifs are in it");
      expect(DISCOVERY_SYSTEM_PROMPT).toContain("a tattoo sleeve down an arm");
      /* The scattered side must keep REPETITION as its test — that is what
         holds freckles, scales and stubble out of the cutter. */
      expect(DISCOVERY_SYSTEM_PROMPT).toContain("'scattered' is for one small thing");
      expect(DISCOVERY_SYSTEM_PROMPT).toContain("repeated over an area, like freckles, scales or stubble");
    });

    it("makes the provider enforce the two closed facts, and leaves `on` open on purpose", () => {
      const feature = DISCOVERY_SCHEMA.schema.properties.features.items;
      expect([...feature.required]).toEqual(["name", "count", "about", "kind", "on", "coverage"]);
      expect([...feature.properties.kind.enum])
        .toEqual(["anatomy", "clothing", "accessory", "marking", "makeup"]);
      expect([...feature.properties.coverage.enum]).toEqual(["single", "scattered"]);
      /* `on` is a NOUN the reading chose. A closed list of hosts would be the
         fixed list this whole repair exists to remove, wearing a new name. */
      expect(feature.properties.on).not.toHaveProperty("enum");
    });
  });

  describe("the parse reads them, and an unreadable one never costs a feature", () => {
    const parse = (feature: Record<string, unknown>) =>
      parseDiscovery(JSON.stringify({
        features: [{ name: "x", count: 1, about: "", ...feature }],
        cannotSee: [],
      }))?.features[0];

    it("carries the three facts off a good answer", () => {
      expect(parse({ name: "lip ring", kind: "accessory", on: "lips", coverage: "single" })).toEqual({
        name: "lip ring", count: 1, about: "",
        kind: "accessory", on: "lips", coverage: "single",
      });
    });

    it("reads freckles as scattered, which is what stops them being cut", () => {
      expect(parse({ name: "freckles", kind: "marking", on: "skin", coverage: "scattered" })?.coverage)
        .toBe("scattered");
    });

    it.each([
      ["missing", {}],
      ["an invented word", { kind: "cybernetic" }],
      ["the wrong type", { kind: 7 }],
    ])("falls back to anatomy on %s kind, never to clothing", (_why, feature) => {
      /*
        THE ONE RULE: an unreadable grouping fact leaves the feature exactly
        where today's panel puts it. `clothing` and `makeup` are the only two
        values that take a row away — one folds it into the Outfit row, the
        other draws nothing — so they are the two an unreadable answer must
        never become. `clothing` is his own warning: his cast's body implants
        were labelled "Collar".
      */
      expect(parse(feature)?.kind).toBe("anatomy");
    });

    it("falls back to single coverage, because scattered is the value that means never cut", () => {
      expect(parse({ coverage: "sprinkled" })?.coverage).toBe("single");
      expect(parse({})?.coverage).toBe("single");
    });

    it("drops a host that is not a bare noun, because `on` becomes a lookup key", () => {
      /* A caption could never match a row noun, so accepting one would only
         make a wrong fold look like a considered one. */
      expect(parse({ on: "the lips of the character" })?.on).toBe("");
      expect(parse({ on: "lips, upper" })?.on).toBe("");
      expect(parse({ on: "lips" })?.on).toBe("lips");
    });

    it("refuses a thing that sits on ITSELF, so the fold cannot meet a one-link cycle", () => {
      expect(parse({ name: "hair", on: "hair" })?.on).toBe("");
    });

    it("KEEPS the feature when every grouping fact is rubbish", () => {
      /*
        The relay's finding on PR #2570, one field over: a parse rule that
        deletes a feature is how a reading comes to take features away.
      */
      expect(parse({ kind: "nonsense", on: 42, coverage: null })).toEqual({
        name: "x", count: 1, about: "", kind: "anatomy", on: "", coverage: "single",
      });
    });
  });

  describe("the merge reconciles two crops that saw different things", () => {
    it("folds a singular and a plural into ONE row, which the raw noun did not", () => {
      /*
        The two crops are two readings. On the raw noun `earring` and `earrings`
        were two merged rows each holding half the facts, and slice 2's fold
        would have treated them as two different features.
      */
      const merged = mergeDiscoveries([
        { features: [found("earring", 1, { on: "ear" })], cannotSee: [] },
        { features: [found("earrings", 2)], cannotSee: [] },
      ]);
      expect(merged.features).toHaveLength(1);
      /* The HELD noun — the head crop is asked first. */
      expect(merged.features[0]!.name).toBe("earring");
      expect(merged.features[0]!.count).toBe(2);
      expect(merged.features[0]!.on).toBe("ear");
    });

    it("lets a named host beat silence, because a crop that cannot see the host says nothing", () => {
      const merged = mergeDiscoveries([
        { features: [found("lip ring")], cannotSee: [] },
        { features: [found("lip ring", 1, { on: "lips" })], cannotSee: [] },
      ]);
      expect(merged.features[0]!.on).toBe("lips");
    });

    it("refuses to guess between TWO different hosts", () => {
      /* No fold is honest; a guessed fold puts a lip ring under a nose. */
      const merged = mergeDiscoveries([
        { features: [found("ring", 1, { on: "lips" })], cannotSee: [] },
        { features: [found("ring", 1, { on: "nose" })], cannotSee: [] },
      ]);
      expect(merged.features[0]!.on).toBe("");
    });

    it("never lets clothing or makeup win a disagreement about kind", () => {
      /*
        The bench measured one real disagreement — the alien's neck hardware
        read `anatomy` on the full frame and `accessory` on the head crop — and
        both of those keep their own row, so that one is cosmetic. The
        disagreement that is NOT cosmetic is a body feature read as a garment,
        which is the failure he named; it resolves away from `clothing`
        whichever crop said it.
      */
      const garmentSecond = mergeDiscoveries([
        { features: [found("collar", 1, { kind: "anatomy" })], cannotSee: [] },
        { features: [found("collar", 1, { kind: "clothing" })], cannotSee: [] },
      ]);
      expect(garmentSecond.features[0]!.kind).toBe("anatomy");
      const garmentFirst = mergeDiscoveries([
        { features: [found("collar", 1, { kind: "clothing" })], cannotSee: [] },
        { features: [found("collar", 1, { kind: "anatomy" })], cannotSee: [] },
      ]);
      expect(garmentFirst.features[0]!.kind, "and it is not an order effect").toBe("anatomy");
      const asMakeup = mergeDiscoveries([
        { features: [found("scar", 1, { kind: "makeup" })], cannotSee: [] },
        { features: [found("scar", 1, { kind: "marking" })], cannotSee: [] },
      ]);
      expect(asMakeup.features[0]!.kind, "makeup draws no row at all").toBe("marking");
    });

    it("keeps the HELD kind when both are own-row kinds, so the answer is deterministic", () => {
      const merged = mergeDiscoveries([
        { features: [found("neck hardware", 1, { kind: "anatomy" })], cannotSee: [] },
        { features: [found("neck hardware", 1, { kind: "accessory" })], cannotSee: [] },
      ]);
      expect(merged.features[0]!.kind).toBe("anatomy");
    });

    it("calls a thing scattered only when BOTH crops say so", () => {
      const disagreed = mergeDiscoveries([
        { features: [found("stubble", 1, { coverage: "scattered" })], cannotSee: [] },
        { features: [found("stubble", 1, { coverage: "single" })], cannotSee: [] },
      ]);
      expect(disagreed.features[0]!.coverage, "scattered is the value that means never cut")
        .toBe("single");
      const agreed = mergeDiscoveries([
        { features: [found("stubble", 1, { coverage: "scattered" })], cannotSee: [] },
        { features: [found("stubble", 1, { coverage: "scattered" })], cannotSee: [] },
      ]);
      expect(agreed.features[0]!.coverage).toBe("scattered");
    });

    it("matches an unseen name against the features on the SAME folded key", () => {
      /* On the raw noun a `cannotSee` row saying `earrings` sat beside a named
         `earring`, and the panel was told both at once. */
      const merged = mergeDiscoveries([
        { features: [], cannotSee: [{ name: "earrings", why: "behind the hair" }] },
        { features: [found("earring", 2)], cannotSee: [] },
      ]);
      expect(merged.cannotSee).toEqual([]);
      expect(merged.features.map((f) => f.name)).toEqual(["earring"]);
    });
  });
});

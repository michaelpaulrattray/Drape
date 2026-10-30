/**
 * THE REFERENCE READING, DRIVEN — #14 slice 2.
 *
 * Three things here are controls rather than tests, and they are the reason the
 * suite is worth its length:
 *
 *   **the shared-clause guard** — the measured clauses are COPIED from the cast
 *   prompt (that prompt is frozen by #2566's bench ruling, which forbids
 *   re-wording it). A copy with nothing holding it equal is the drift working
 *   law 4 is about, so every clause is asserted present in BOTH prompts, with a
 *   fabricated clause as the negative control;
 *
 *   **the unbought second call** — the whole point of asking the full frame
 *   first is that a hanger shot does not pay for a head crop. That is a
 *   NEGATIVE assertion about a call that must not happen, so it is asserted on
 *   the engine's own call count;
 *
 *   **the cap bounding the SPEND, not just the list** — a twenty-name
 *   photograph must buy twelve detects, not twenty. Asserted on the detector's
 *   call count, which is the only place that fact lives.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { DISCOVERY_SYSTEM_PROMPT } from "./faceDiscovery";
import {
  REFERENCE_DISCOVERY_SHARED_CLAUSES,
  REFERENCE_DISCOVERY_SYSTEM_PROMPT,
  REFERENCE_MARKER_CAP,
  markReferenceThings,
  parsePersonPresent,
  readAndMarkReference,
  readReferencePicture,
} from "./referenceDiscovery";
import type { DiscoveredFeature } from "./faceDiscovery";
import type { PointerBox, RegionReader } from "./maskedRefine";
import type { TextEngine, TextRequest, TextResult } from "../providers/types";

/** An engine that says exactly what it is told to, once per call. */
function engineSaying(...answers: Array<string | Error>): TextEngine & { calls: TextRequest[] } {
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
      };
    },
  };
}

/** The same, with the provider's cut-off-at-the-ceiling signal set. */
function engineTruncating(): TextEngine & { calls: TextRequest[] } {
  const calls: TextRequest[] = [];
  return {
    id: "test:engine",
    calls,
    async complete(request: TextRequest): Promise<TextResult> {
      calls.push(request);
      return {
        text: "{\"personPresent\":false,\"features\":[{\"name\":\"hair\"",
        provenance: { provider: "test", model: "test", requestedAt: new Date().toISOString() } as never,
        latencyMs: 1,
        truncated: true,
      };
    },
  };
}

function reading(personPresent: boolean, ...names: string[]): string {
  return JSON.stringify({
    personPresent,
    features: names.map((name) => ({
      name,
      count: 1,
      about: "",
      kind: "clothing",
      on: "",
      coverage: "single",
    })),
    cannotSee: [],
  });
}

function featureNamed(name: string): DiscoveredFeature {
  return { name, count: 1, about: "", kind: "clothing", on: "", coverage: "single" };
}

/** A detector that answers per noun, counting what it was asked. */
function detectorAnswering(
  answers: Record<string, readonly PointerBox[] | Error>,
): RegionReader & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async region() { return null; },
    async pointer({ name }: { name: string }) {
      asked.push(name);
      const answer = answers[name];
      if (answer instanceof Error) throw answer;
      return answer ?? [];
    },
  } as unknown as RegionReader & { asked: string[] };
}

const BOX = (x: number, y: number, width: number, height: number): PointerBox => ({ x, y, width, height });

async function frameOf(width: number, height: number): Promise<{ bytes: Buffer; width: number; height: number }> {
  const bytes = await sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 120, b: 120 } },
  }).png().toBuffer();
  return { bytes, width, height };
}

describe("⚠ the measured clauses are copied, and a guard holds them equal", () => {
  it("every shared clause is byte-identical in both prompts", () => {
    expect(REFERENCE_DISCOVERY_SHARED_CLAUSES.length).toBeGreaterThan(0);
    for (const clause of REFERENCE_DISCOVERY_SHARED_CLAUSES) {
      expect(DISCOVERY_SYSTEM_PROMPT, `the cast prompt lost: ${clause}`).toContain(clause);
      expect(REFERENCE_DISCOVERY_SYSTEM_PROMPT, `the reference prompt lost: ${clause}`).toContain(clause);
    }
  });

  it("⚠ NEGATIVE CONTROL — a clause neither prompt carries is not found in either", () => {
    const invented = "THE NAME MUST BE A LONG FLOWERY CAPTION, as many words as you like";
    expect(DISCOVERY_SYSTEM_PROMPT).not.toContain(invented);
    expect(REFERENCE_DISCOVERY_SYSTEM_PROMPT).not.toContain(invented);
  });

  it("does not assume a person, and asks for the answer that decides the second call", () => {
    expect(REFERENCE_DISCOVERY_SYSTEM_PROMPT).toContain("do not assume a person");
    expect(REFERENCE_DISCOVERY_SYSTEM_PROMPT).toContain("personPresent");
    /* The subject really did change — this is the cast prompt's opening and it
       must NOT be here, or the variant is the same ask under a new name. */
    expect(REFERENCE_DISCOVERY_SYSTEM_PROMPT)
      .not.toContain("You are looking at one frame of a character");
  });

  it("carries no vocabulary of takeable things — his no-list word", () => {
    expect(REFERENCE_DISCOVERY_SYSTEM_PROMPT).toContain("Do not work from a fixed list");
  });
});

describe("parsePersonPresent", () => {
  it("reads the answer both ways", () => {
    expect(parsePersonPresent(JSON.stringify({ personPresent: true }))).toBe(true);
    expect(parsePersonPresent(JSON.stringify({ personPresent: false }))).toBe(false);
  });

  it("reads it through a fence and through surrounding prose", () => {
    expect(parsePersonPresent("```json\n{\"personPresent\":true}\n```")).toBe(true);
    expect(parsePersonPresent("here you go: {\"personPresent\":true} — done")).toBe(true);
  });

  it("⚠ a missing or wrong-typed answer reads FALSE, which is the cheap direction", () => {
    expect(parsePersonPresent(JSON.stringify({ features: [] }))).toBe(false);
    expect(parsePersonPresent(JSON.stringify({ personPresent: "yes" }))).toBe(false);
    expect(parsePersonPresent("not json at all")).toBe(false);
  });
});

describe("the reading asks the full frame first", () => {
  it("⚠ buys ONE call on a picture with no person in it", async () => {
    const frame = await frameOf(600, 800);
    const engine = engineSaying(reading(false, "jacket", "zip"));
    const answer = await readReferencePicture({ frame, engine });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    /* The whole reason the full frame goes first: a hanger shot does not pay
       for a head crop. This is the assertion that fact lives in. */
    expect(engine.calls).toHaveLength(1);
    expect(answer.crops).toEqual(["full"]);
    expect(answer.personPresent).toBe(false);
    expect(answer.features.map((feature) => feature.name).sort()).toEqual(["jacket", "zip"]);
  });

  it("⚠ POSITIVE CONTROL — buys the head crop when a person IS present, and merges", async () => {
    const frame = await frameOf(600, 800);
    const engine = engineSaying(reading(true, "jacket"), reading(true, "earring"));
    const answer = await readReferencePicture({ frame, engine });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(engine.calls).toHaveLength(2);
    expect(answer.crops).toEqual(["full", "head"]);
    expect(answer.features.map((feature) => feature.name).sort()).toEqual(["earring", "jacket"]);
  });

  it("sends the schema, the images and its own read purpose — invariant 5, on the wire", async () => {
    const frame = await frameOf(600, 800);
    const engine = engineSaying(reading(false, "jacket"));
    await readReferencePicture({ frame, engine });
    const sent = engine.calls[0]!;
    expect(sent.images).toHaveLength(1);
    expect(sent.about).toBe("discover");
    expect(sent.jsonSchema?.name).toBe("reference_discovery");
    expect(sent.jsonSchema?.schema).toBeDefined();
    /* The cast road's measured numbers, asserted where they are actually sent:
       a default this road never set is exactly what a constant near the call
       site cannot prove (#2566's ceiling defect). */
    expect(sent.maxOutputTokens).toBe(2_000);
    expect(sent.timeoutMs).toBe(30_000);
    expect(sent.retries).toBe(0);
  });
});

describe("it fails open to words, and never looks broken", () => {
  it("a provider that throws gives no markers and no error", async () => {
    const frame = await frameOf(600, 800);
    const answer = await readReferencePicture({
      frame,
      engine: engineSaying(new Error("502 from the provider")),
    });
    expect(answer.ok).toBe(false);
  });

  it("an unparseable answer fails open", async () => {
    const frame = await frameOf(600, 800);
    const answer = await readReferencePicture({ frame, engine: engineSaying("not json") });
    expect(answer.ok).toBe(false);
  });

  it("⚠ a reply cut off at the ceiling is DISCARDED, never read short", async () => {
    /* #1272's class: truncated JSON that still parses reads as a shorter list,
       which on this road would silently drop takeable things. */
    const frame = await frameOf(600, 800);
    const answer = await readReferencePicture({ frame, engine: engineTruncating() });
    expect(answer.ok).toBe(false);
  });

  it("a picture too small to read is refused before any call is spent", async () => {
    const engine = engineSaying(reading(false, "jacket"));
    const answer = await readReferencePicture({
      frame: { bytes: Buffer.alloc(0), width: 10, height: 10 },
      engine,
    });
    expect(answer.ok).toBe(false);
    expect(engine.calls).toHaveLength(0);
  });

  it("⚠ a failed HEAD crop keeps the full frame's answer rather than losing both", async () => {
    const frame = await frameOf(600, 800);
    const engine = engineSaying(reading(true, "jacket"), new Error("502 on the second call"));
    const answer = await readReferencePicture({ frame, engine });
    /* The cast road discards a part-answer because its two crops are peers.
       Here the full frame IS the reading, so losing the enrichment costs
       detail and not correctness. */
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.crops).toEqual(["full"]);
    expect(answer.features.map((feature) => feature.name)).toEqual(["jacket"]);
  });
});

describe("boxing what the reading named", () => {
  it("puts a marker on each named thing the detector finds", async () => {
    const reader = detectorAnswering({
      jacket: [BOX(10, 10, 200, 300)],
      earring: [BOX(50, 20, 20, 20)],
    });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("jacket"), featureNamed("earring")],
      reader,
    });
    expect(marked.markers).toHaveLength(2);
    expect(marked.unmarked).toEqual([]);
  });

  it("orders them largest-first, which is the design's ordering", async () => {
    const reader = detectorAnswering({
      earring: [BOX(50, 20, 20, 20)],
      jacket: [BOX(10, 10, 200, 300)],
      hair: [BOX(0, 0, 100, 100)],
    });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("earring"), featureNamed("jacket"), featureNamed("hair")],
      reader,
    });
    expect(marked.markers.map((marker) => marker.name)).toEqual(["jacket", "hair", "earring"]);
    expect(marked.markers[0]!.area).toBe(60_000);
  });

  it("takes the biggest box when the detector draws several — one box per call", async () => {
    const reader = detectorAnswering({
      jacket: [BOX(0, 0, 10, 10), BOX(5, 5, 100, 100), BOX(1, 1, 20, 20)],
    });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("jacket")],
      reader,
    });
    expect(marked.markers[0]!.box).toEqual(BOX(5, 5, 100, 100));
  });

  /**
   * ⚠ THE CAP'S VALUE IS PINNED AS A LITERAL, AND THE FIRST VERSION OF THIS
   * ARM WAS A TAUTOLOGY THAT SURVIVED SABOTAGE.
   *
   * It read `expect(reader.asked).toHaveLength(REFERENCE_MARKER_CAP)` over a
   * twenty-name population, with the tail asserted as `20 - CAP`. Driven
   * against the cap moved 12 -> 20, **all three assertions passed**: 20 asked,
   * 20 marked, 0 unmarked. A guard expressed entirely in terms of the constant
   * it guards cannot see that constant move — so the number is a literal here,
   * and a later shift raising the cap meets a red and goes and reads the
   * design's *"a cap near 12"* rather than discovering it in production spend.
   */
  it("⚠ the cap is twelve — pinned as a literal, not read off the subject", () => {
    expect(REFERENCE_MARKER_CAP).toBe(12);
  });

  it("⚠ the cap bounds the SPEND, not only the list", async () => {
    /* Twenty names must buy TWELVE detects. Asserted on the detector's own
       call count, because that is the only place the spend fact lives, and with
       literals so the arm can fail. */
    const names = Array.from({ length: 20 }, (_, at) => `thing${at}`);
    const reader = detectorAnswering(
      Object.fromEntries(names.map((name) => [name, [BOX(0, 0, 10, 10)]])),
    );
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: names.map(featureNamed),
      reader,
    });
    expect(reader.asked).toHaveLength(12);
    expect(marked.markers).toHaveLength(12);
    /* And the tail is REPORTED rather than dropped — it stays takeable by
       words, which is why the cap costs a customer nothing. */
    expect(marked.unmarked).toHaveLength(8);
  });

  it("never sends a name no detector could use, and keeps its words", async () => {
    const reader = detectorAnswering({ jacket: [BOX(0, 0, 10, 10)] });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("dark hair in a high bun"), featureNamed("jacket")],
      reader,
    });
    expect(reader.asked).toEqual(["jacket"]);
    expect(marked.unmarked).toEqual(["dark hair in a high bun"]);
  });

  it("an empty list is the ABSENCE answer — no marker, words still open", async () => {
    const reader = detectorAnswering({ jacket: [BOX(0, 0, 10, 10)], horns: [] });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("jacket"), featureNamed("horns")],
      reader,
    });
    expect(marked.markers.map((marker) => marker.name)).toEqual(["jacket"]);
    expect(marked.unmarked).toEqual(["horns"]);
  });

  it("⚠ a detector that throws drops THAT name and leaves every other one", async () => {
    const reader = detectorAnswering({
      jacket: [BOX(0, 0, 100, 100)],
      earring: new Error("the detector fell over"),
      hair: [BOX(0, 0, 50, 50)],
    });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("jacket"), featureNamed("earring"), featureNamed("hair")],
      reader,
    });
    expect(marked.markers.map((marker) => marker.name)).toEqual(["jacket", "hair"]);
    expect(marked.unmarked).toEqual(["earring"]);
  });

  it("a reader with no pointer capability produces no markers at all — today's attach", async () => {
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("jacket")],
      reader: { async region() { return null; } } as unknown as RegionReader,
    });
    expect(marked.markers).toEqual([]);
    expect(marked.unmarked).toEqual(["jacket"]);
  });

  it("⚠ two names with ONE rectangle keep both markers — #2787 is not resolved here", async () => {
    /* The slice-1 court measured this on a real photograph: `nose ring` and
       `earring` came back identical and the box was the earring. Which noun is
       wrong is exactly what this module does not know, so dropping either
       would be a guess. */
    const same = BOX(305, 462, 44, 56);
    const reader = detectorAnswering({ "nose ring": [same], earring: [same] });
    const marked = await markReferenceThings({
      picture: Buffer.from("picture"),
      features: [featureNamed("nose ring"), featureNamed("earring")],
      reader,
    });
    expect(marked.markers).toHaveLength(2);
    expect(marked.markers.map((marker) => marker.name).sort()).toEqual(["earring", "nose ring"]);
  });
});

describe("the whole road", () => {
  it("reads, boxes, and reports what it did", async () => {
    const frame = await frameOf(600, 800);
    const reader = detectorAnswering({
      jacket: [BOX(10, 10, 200, 300)],
      zip: [BOX(100, 50, 10, 200)],
    });
    const answer = await readAndMarkReference({
      frame,
      engine: engineSaying(reading(false, "jacket", "zip")),
      reader,
      about: { userId: 1, candidatePublicId: "cand-test" },
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.markers.map((marker) => marker.name)).toEqual(["jacket", "zip"]);
    expect(answer.personPresent).toBe(false);
    expect(answer.crops).toEqual(["full"]);
  });

  it("⚠ fails open when the reading fails, and buys no detect", async () => {
    const frame = await frameOf(600, 800);
    const reader = detectorAnswering({ jacket: [BOX(0, 0, 10, 10)] });
    const answer = await readAndMarkReference({
      frame,
      engine: engineSaying(new Error("502 from the provider")),
      reader,
      about: { userId: 1, candidatePublicId: "cand-test" },
    });
    expect(answer.ok).toBe(false);
    /* Nothing was named, so nothing was boxed — the detect half must not fire
       on a failed reading. */
    expect(reader.asked).toEqual([]);
  });
});

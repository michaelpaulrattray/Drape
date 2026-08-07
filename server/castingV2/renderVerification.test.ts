/**
 * THE FALSE-PASS GUARD (D-235).
 *
 * This module decides whether somebody gets charged for a render that does not
 * contain what they asked for, and until 2026-08-07 it had no tests at all.
 * That is how the empty yes survived: the prompt asked for `saw` only on a
 * disagreement, so every affirmative was evidence-free by construction, and a
 * missing row counted as a pass.
 *
 * Every test here drives the verifier through a scripted engine — no live
 * model, no network. A guard whose only test runs through an LLM that usually
 * behaves is a guard that has never been tested (working law 3).
 */
import { describe, expect, it } from "vitest";
import type { TextEngine, TextResult } from "../providers/types";
import { facetOfSubject } from "./refineFacets";
import {
  advisoryMisses,
  confirmVerdict,
  facetsWithUnreliabilityPrior,
  missingFacts,
  unreadFacts,
  verifyRender,
  type RenderVerdict,
} from "./renderVerification";

const HAIR_WORN = facetOfSubject("hairWorn");
const EYE_COLOUR = facetOfSubject("eyeColourFree");

/** A reader that says exactly what the test tells it to, once per call. */
function scriptedEngine(replies: string[]): TextEngine & { calls: number } {
  const engine = {
    id: "scripted",
    calls: 0,
    async complete(): Promise<TextResult> {
      const text = replies[Math.min(engine.calls, replies.length - 1)];
      engine.calls += 1;
      return {
        text,
        provenance: { provider: "test", model: "scripted" } as unknown as TextResult["provenance"],
        latencyMs: 1,
      };
    },
  };
  return engine;
}

const bytes = Buffer.from("not really a photograph");

async function read(replies: string[], facts: Parameters<typeof verifyRender>[0]["facts"]) {
  const engine = scriptedEngine(replies);
  const verdict = await verifyRender({ bytes, contentType: "image/png", facts, engine });
  return { verdict, engine };
}

const HAIR_UP = [{ facet: HAIR_WORN, asked: "tied up", binding: false }] as const;

describe("an affirmative without evidence is not a reading", () => {
  it("does not count the empty yes as a pass — the hair-up row, exactly as stored", async () => {
    /* The verbatim shape of the false pass: present true, no `saw`. */
    const { verdict } = await read(['{"results":[{"id":1,"present":true}]}'], HAIR_UP);

    expect(verdict.checks[0].read).toBe(false);
    expect(verdict.checks[0].verified).toBe(false);
    expect(unreadFacts(verdict).map((c) => c.facet)).toEqual([HAIR_WORN]);
    /* And it is NOT reported as a miss either. Silence is silence. */
    expect(advisoryMisses(verdict)).toEqual([]);
  });

  it("counts an affirmative that names what it saw", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":true,"saw":"hair gathered in a low bun"}]}'],
      HAIR_UP,
    );
    expect(verdict.checks[0].read).toBe(true);
    expect(verdict.checks[0].verified).toBe(true);
    expect(verdict.checks[0].saw).toBe("hair gathered in a low bun");
  });

  it("keeps `saw` on a pass, so the record can be audited later", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":true,"saw":"hair loose past the shoulders"}]}'],
      HAIR_UP,
    );
    /* The whole point: a stored pass now carries the evidence that produced it. */
    expect(verdict.checks[0].saw).toBe("hair loose past the shoulders");
  });

  it("does not count a row the reader omitted entirely", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":2,"present":true,"saw":"pale blue irises"}]}'],
      [
        { facet: HAIR_WORN, asked: "tied up", binding: false },
        { facet: EYE_COLOUR, asked: "pale blue", binding: true },
      ],
    );
    expect(verdict.checks[0].read).toBe(false);
    expect(verdict.checks[1].read).toBe(true);
    /* An unread BINDING fact still never refuses — the guard is costless. */
    expect(verdict.ok).toBe(true);
  });

  it("reports a reader that answers everything with no evidence as unavailable", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":true},{"id":2,"present":true}]}'],
      [
        { facet: HAIR_WORN, asked: "tied up", binding: false },
        { facet: EYE_COLOUR, asked: "pale blue", binding: true },
      ],
    );
    /* One instrument failure, not two silences — otherwise a reader that
       stopped emitting `saw` would read as a clean sheet forever. */
    expect(verdict.unavailable).toBe(true);
  });

  it("STILL refuses on a binding miss that named nothing — silence never charges", async () => {
    /*
      The asymmetry, and the reason for it. Requiring evidence on a negative too
      looked tidier and would have DELIVERED AND CHARGED for a render the reader
      believed was non-compliant — manufacturing the exact false pass this guard
      exists to prevent. This test is the one that caught it.
    */
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false}]}'],
      [{ facet: EYE_COLOUR, asked: "pale blue", binding: true }],
    );
    expect(verdict.checks[0].read).toBe(true);
    expect(verdict.checks[0].verified).toBe(false);
    expect(verdict.ok).toBe(false);
  });

  it("still refuses on a binding miss that names what it saw", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false,"saw":"irises are hazel"}]}'],
      [{ facet: EYE_COLOUR, asked: "pale blue", binding: true }],
    );
    expect(verdict.ok).toBe(false);
    expect(missingFacts(verdict)).toEqual(["pale blue"]);
  });
});

describe("facets with a measured unreliability prior get a second reading", () => {
  it("names hairWorn, and names it for a reason", () => {
    expect(facetsWithUnreliabilityPrior()).toContain(HAIR_WORN);
  });

  const verdictOf = (checks: RenderVerdict["checks"]): RenderVerdict => ({
    ok: true,
    checks,
    readings: 1,
  });

  it("withdraws an affirmation the second reading disagrees with", async () => {
    const first = verdictOf([
      { facet: HAIR_WORN, asked: "tied up", verified: true, read: true, binding: false, saw: "hair up" },
    ]);
    const second = verdictOf([
      {
        facet: HAIR_WORN,
        asked: "tied up",
        verified: false,
        read: true,
        binding: false,
        saw: "hair loose past the shoulders",
      },
    ]);

    const confirmed = await confirmVerdict(first, async () => second);

    expect(confirmed.checks[0].verified).toBe(false);
    expect(confirmed.checks[0].saw).toBe("hair loose past the shoulders");
    expect(confirmed.readings).toBe(2);
    /* Advisory, so it never refuses — but the RECORD now tells the truth,
       which is what the caption and the reliability report read from. */
    expect(confirmed.ok).toBe(true);
    expect(advisoryMisses(confirmed).map((c) => c.asked)).toEqual(["tied up"]);
  });

  it("leaves an affirmation the second reading confirms", async () => {
    const check = {
      facet: HAIR_WORN, asked: "tied up", verified: true, read: true, binding: false, saw: "low bun",
    };
    const confirmed = await confirmVerdict(verdictOf([check]), async () => verdictOf([check]));
    expect(confirmed.checks[0].verified).toBe(true);
    expect(confirmed.readings).toBe(2);
  });

  it("does NOT re-read an affirmation on a facet with no prior — the cost is targeted", async () => {
    const clean = verdictOf([
      { facet: EYE_COLOUR, asked: "pale blue", verified: true, read: true, binding: true, saw: "pale blue irises" },
    ]);
    let rereads = 0;
    const confirmed = await confirmVerdict(clean, async () => {
      rereads += 1;
      return clean;
    });
    expect(rereads).toBe(0);
    expect(confirmed.readings).toBe(1);
  });

  it("does not re-read an affirmation that was never read in the first place", async () => {
    const empty = verdictOf([
      { facet: HAIR_WORN, asked: "tied up", verified: false, read: false, binding: false },
    ]);
    let rereads = 0;
    await confirmVerdict(empty, async () => {
      rereads += 1;
      return empty;
    });
    expect(rereads).toBe(0);
  });

  it("makes a demoted BINDING affirmation survive the majority of three", async () => {
    const asked = "tied up";
    const make = (verified: boolean) =>
      verdictOf([{ facet: HAIR_WORN, asked, verified, read: true, binding: true, saw: "x" }]);

    /* first says yes, second says no → a split, so a third breaks the tie.
       Third says yes: one doubter out of three is not a refusal. */
    let call = 0;
    const confirmed = await confirmVerdict(make(true), async () => {
      call += 1;
      return make(call === 1 ? false : true);
    });
    expect(confirmed.readings).toBe(3);
    expect(confirmed.checks[0].verified).toBe(true);
    expect(confirmed.ok).toBe(true);
  });

  it("refuses when two of three readings agree the demoted fact is missing", async () => {
    const asked = "tied up";
    const make = (verified: boolean) =>
      verdictOf([{ facet: HAIR_WORN, asked, verified, read: true, binding: true, saw: "x" }]);

    const confirmed = await confirmVerdict(make(true), async () => make(false));
    expect(confirmed.readings).toBe(3);
    expect(confirmed.checks[0].verified).toBe(false);
    expect(confirmed.ok).toBe(false);
  });

  it("delivers rather than refusing when the second opinion is unavailable", async () => {
    const first = verdictOf([
      { facet: EYE_COLOUR, asked: "pale blue", verified: false, read: true, binding: true, saw: "hazel" },
    ]);
    const confirmed = await confirmVerdict(first, async () => ({
      ok: true, checks: [], unavailable: true,
    }));
    expect(confirmed.ok).toBe(true);
    expect(confirmed.readings).toBe(1);
  });
});

describe("the prompt asks for the evidence it now requires", () => {
  it("requires `saw` on every line, in the words the reader is given", async () => {
    let system = "";
    const engine: TextEngine = {
      id: "capture",
      async complete(request) {
        system = request.system ?? "";
        return {
          text: '{"results":[{"id":1,"present":true,"saw":"low bun"}]}',
          provenance: { provider: "test", model: "capture" } as unknown as TextResult["provenance"],
          latencyMs: 1,
        };
      },
    };
    await verifyRender({ bytes, contentType: "image/png", facts: HAIR_UP, engine });

    /* Assert at the wire (working law 5): the contract is what the reader is
       actually told, not a constant sitting near it. */
    expect(system).toMatch(/REQUIRED on EVERY line/);
    expect(system).toMatch(/discarded as unanswered/);
    expect(system).not.toMatch(/only where present is false/);
  });
});

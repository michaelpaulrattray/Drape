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
  aboutFacet,
  advisoryMisses,
  facetIn,
  confirmVerdict,
  facetsWithUnreliabilityPrior,
  joinClauses,
  missingFacts,
  scopedToInstance,
  settleCarriedChecks,
  shortfalls,
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

const HAIR_UP = [{ subject: aboutFacet(HAIR_WORN), asked: "tied up", binding: false }] as const;

describe("an affirmative without evidence is not a reading", () => {
  it("does not count the empty yes as a pass — the hair-up row, exactly as stored", async () => {
    /* The verbatim shape of the false pass: present true, no `saw`. */
    const { verdict } = await read(['{"results":[{"id":1,"present":true}]}'], HAIR_UP);

    expect(verdict.checks[0].read).toBe(false);
    expect(verdict.checks[0].verified).toBe(false);
    expect(unreadFacts(verdict).map((c) => facetIn(c.subject))).toEqual([HAIR_WORN]);
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
        { subject: aboutFacet(HAIR_WORN), asked: "tied up", binding: false },
        { subject: aboutFacet(EYE_COLOUR), asked: "pale blue", binding: true },
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
        { subject: aboutFacet(HAIR_WORN), asked: "tied up", binding: false },
        { subject: aboutFacet(EYE_COLOUR), asked: "pale blue", binding: true },
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
      [{ subject: aboutFacet(EYE_COLOUR), asked: "pale blue", binding: true }],
    );
    expect(verdict.checks[0].read).toBe(true);
    expect(verdict.checks[0].verified).toBe(false);
    expect(verdict.ok).toBe(false);
  });

  it("still refuses on a binding miss that names what it saw", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false,"saw":"irises are hazel"}]}'],
      [{ subject: aboutFacet(EYE_COLOUR), asked: "pale blue", binding: true }],
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
      { subject: aboutFacet(HAIR_WORN), asked: "tied up", verified: true, read: true, binding: false, saw: "hair up" },
    ]);
    const second = verdictOf([
      {
        subject: aboutFacet(HAIR_WORN),
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
      subject: aboutFacet(HAIR_WORN), asked: "tied up", verified: true, read: true, binding: false, saw: "low bun",
    };
    const confirmed = await confirmVerdict(verdictOf([check]), async () => verdictOf([check]));
    expect(confirmed.checks[0].verified).toBe(true);
    expect(confirmed.readings).toBe(2);
  });

  it("does NOT re-read an affirmation on a facet with no prior — the cost is targeted", async () => {
    const clean = verdictOf([
      { subject: aboutFacet(EYE_COLOUR), asked: "pale blue", verified: true, read: true, binding: true, saw: "pale blue irises" },
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
      { subject: aboutFacet(HAIR_WORN), asked: "tied up", verified: false, read: false, binding: false },
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
      verdictOf([{ subject: aboutFacet(HAIR_WORN), asked, verified, read: true, binding: true, saw: "x" }]);

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
      verdictOf([{ subject: aboutFacet(HAIR_WORN), asked, verified, read: true, binding: true, saw: "x" }]);

    const confirmed = await confirmVerdict(make(true), async () => make(false));
    expect(confirmed.readings).toBe(3);
    expect(confirmed.checks[0].verified).toBe(false);
    expect(confirmed.ok).toBe(false);
  });

  it("delivers rather than refusing when the second opinion is unavailable", async () => {
    const first = verdictOf([
      { subject: aboutFacet(EYE_COLOUR), asked: "pale blue", verified: false, read: true, binding: true, saw: "hazel" },
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

  /*
    KIND IS NOT DEGREE — the three clauses that only work TOGETHER (fable-314).

    This is a PIN, not a proof: what the reader does with these sentences was
    measured on the frame that was charged for, five readings a question, and
    lives in `prove-per-item-question-disposable.mts` (kind flips to absent 5/5;
    both degree asks stay present 5/5). A unit test cannot re-derive that.

    What it CAN do is stop the three from drifting apart, because each one alone
    is a defect: the kind rule without the run-10 carve-out refunds a customer
    for hoops thinner than she pictured, the carve-out without the kind rule is
    the false pass this came from, and either without the occlusion sentence
    turns a hidden ear into an absence.
  */
  it("tells the reader that a different OBJECT is absent and a lesser one is not", async () => {
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

    /* The kind rule, and the noun as its test. */
    expect(system).toMatch(/DIFFERENT KIND OF THING IN THE SAME PLACE/);
    expect(system).toMatch(/change the name of the object/);
    /* Run-10's carve-out, still narrow and still there. */
    expect(system).toMatch(/SAME KIND that is plainer, smaller or thinner/);
    expect(system).toMatch(/hoops are thinner than described/);
    /* And the third verdict, which this must never swallow. */
    expect(system).toMatch(/"occluded":true/);
    expect(system).toMatch(/hidden behind hair or\s+turned away from the camera is still the occluded answer/);
  });
});

/**
 * THE READER'S SENTENCE AND THE CUSTOMER'S SENTENCE ARE NOT THE SAME STRING.
 *
 * Production receipt, run-6, "remove her glasses":
 *
 *   "That one came back twice WITHOUT NO GLASSES — THEY HAVE BEEN TAKEN OFF AND
 *    ARE NOT IN THE PICTURE, so it wasn't delivered and your credits have been
 *    returned."
 *
 * `asked` is an instruction to a vision model and is phrased as an assertion.
 * It was also spliced verbatim into that sentence and into the ledger line, so
 * one string was doing three jobs with three grammars. The absence row is the
 * one where the grammars disagree, and it went out on a real receipt.
 */
describe("a refusal reads as a sentence", () => {
  it("gives a removal its own shortfall clause instead of negating an assertion", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false,"saw":"she is still wearing her glasses"}]}'],
      [{
        subject: aboutFacet(facetOfSubject("statedAccessories")),
        asked: "no glasses — they have been taken off and are not in the picture",
        shortfall: "with glasses still in the picture",
        binding: true,
      }],
    );

    /* The log still wants the reader's own phrasing — that is what an engineer
       comparing against the prompt needs to see. */
    expect(missingFacts(verdict)).toEqual([
      "no glasses — they have been taken off and are not in the picture",
    ]);
    /* The customer gets a clause that completes "the render came back ___". */
    expect(joinClauses(shortfalls(verdict))).toBe("with glasses still in the picture");
    expect(`That one came back twice ${joinClauses(shortfalls(verdict))}`)
      .toBe("That one came back twice with glasses still in the picture");
  });

  it("leaves an ordinary fact reading exactly as it always did", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false,"saw":"smooth skin, no freckles"}]}'],
      [{ subject: aboutFacet(facetOfSubject("marks")), asked: "freckles", binding: true }],
    );
    expect(joinClauses(shortfalls(verdict))).toBe("without freckles");
  });

  it("joins several shortfalls as a person would say them", async () => {
    const { verdict } = await read(
      ['{"results":['
        + '{"id":1,"present":false,"saw":"smooth skin"},'
        + '{"id":2,"present":false,"saw":"still wearing glasses"}]}'],
      [
        { subject: aboutFacet(facetOfSubject("marks")), asked: "freckles", binding: true },
        {
          subject: aboutFacet(facetOfSubject("statedAccessories")),
          asked: "no glasses — they have been taken off and are not in the picture",
          shortfall: "with glasses still in the picture",
          binding: true,
        },
      ],
    );
    expect(joinClauses(shortfalls(verdict)))
      .toBe("without freckles and with glasses still in the picture");
  });

  it("counts only the failures the product may refuse over", async () => {
    const { verdict } = await read(
      ['{"results":['
        + '{"id":1,"present":false,"saw":"hair is down"},'
        + '{"id":2,"present":false,"saw":"smooth skin"}]}'],
      [
        { subject: aboutFacet(HAIR_WORN), asked: "tied up", binding: false },
        { subject: aboutFacet(facetOfSubject("marks")), asked: "freckles", binding: true },
      ],
    );
    /* An advisory miss never reaches a refusal sentence, because it never
       reaches a refusal. */
    expect(shortfalls(verdict)).toEqual(["without freckles"]);
  });
});

/*
  THE PAIR LAW, AND ITS THIRD ANSWER (fable-118 ruling (b)).

  The founder asked for "gold hoop earrings" and was delivered ONE, twice, on
  two consecutive renders of the same face — v#156 with the hoop on her left ear
  and her right ear bare, v#157 with the hoop on her right and her left bare. I
  cropped both ears in both frames at 3× and looked: in each frame the empty ear
  is fully visible, unoccluded, and plainly bare. Both were stored `verified:
  true`, off a `saw` reading "gold hoop earring visible on visible ear".

  So the question had never been asked properly. These tests drive the reader's
  three possible answers directly — one live model would have proved nothing
  about any of them.
*/
describe("a pair means both ears", () => {
  const EARRINGS = [{
    subject: aboutFacet(facetOfSubject("statedAccessories")),
    asked: "gold hoop earrings, one on each ear, a matching pair",
    binding: true,
  }] as const;

  it("tells the reader that one earring with a bare visible ear is not present", async () => {
    let system = "";
    const engine = {
      id: "watcher",
      async complete(request: { system: string }): Promise<TextResult> {
        system = request.system;
        return {
          text: '{"results":[{"id":1,"present":true,"saw":"a hoop on the left ear"}]}',
          provenance: { provider: "test", model: "watcher" } as unknown as TextResult["provenance"],
          latencyMs: 1,
        };
      },
    } as TextEngine;
    await verifyRender({ bytes, contentType: "image/png", facts: [...EARRINGS], engine });
    /* The instruction the founder's two renders never carried. Asserted on the
       string that actually goes out, not on a constant near it. */
    expect(system).toContain("A PAIR MEANS BOTH SIDES");
    /* Whitespace-tolerant: the prompt is a joined array, so the clause wraps. */
    expect(system).toMatch(/single earring\s+with the other ear BARE and VISIBLE is NOT present/);
    /* And the third answer is offered, with its condition attached. */
    expect(system).toContain('"occluded":true');
    expect(system).toMatch(/Use it only when the side is genuinely not visible/);
  });

  it("v#156 and v#157 re-read as MISSES, not passes", async () => {
    /* The reader's own words from the two production rows, now answered under
       the pair law: one hoop, the other ear visible and bare. */
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false,"saw":"gold hoop on her left ear, right ear bare and visible"}]}',
        '{"results":[{"id":1,"present":false,"saw":"one hoop only, other ear empty"}]}',
        '{"results":[{"id":1,"present":false,"saw":"one hoop only, other ear empty"}]}'],
      [...EARRINGS],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.checks[0]?.verified).toBe(false);
    expect(verdict.checks[0]?.occluded).toBeUndefined();
    /* And it is a real miss, so it reaches a refusal sentence. */
    expect(shortfalls(verdict)).toEqual(["without gold hoop earrings, one on each ear, a matching pair"]);
  });

  /*
    AND THE RISK PRESENCE-BINDING CREATES, CLOSED BEFORE IT SHIPS.

    Production v#123, "gold hoop earrings": the reader answered `verified:
    false` with *"small gold hoop earrings, thin and understated, not bold
    hoops"* — it invented a strength the ask never named and failed a picture
    that HAD the earrings. Advisory, so it cost nothing. Under ruling (c) that
    same answer refunds a real delivery, which is D-187's own defect wearing
    accessories. So the instruction that already covered it gets teeth and a
    test rather than a hope.
  */
  it("tells the reader that a smaller hoop is still a hoop", async () => {
    let system = "";
    const engine = {
      id: "watcher",
      async complete(request: { system: string }): Promise<TextResult> {
        system = request.system;
        return {
          text: '{"results":[{"id":1,"present":true,"saw":"small gold hoops on both ears"}]}',
          provenance: { provider: "test", model: "watcher" } as unknown as TextResult["provenance"],
          latencyMs: 1,
        };
      },
    } as TextEngine;
    await verifyRender({ bytes, contentType: "image/png", facts: [...EARRINGS], engine });
    expect(system).toContain("SIZE AND PROMINENCE ARE DEGREE, NEVER PRESENCE");
    expect(system).toMatch(/Only answer that a thing is\s+not present when you cannot find it at all/);
  });

  it("records an ear behind her hair as OCCLUDED — neither a pass nor a miss", async () => {
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":true,"occluded":true,'
        + '"saw":"a hoop on the visible ear; the other ear is behind her hair"}]}'],
      [...EARRINGS],
    );
    /* It does not refuse — we cannot hold a picture to an ear it does not
       show — and it does not pass either. */
    expect(verdict.ok).toBe(true);
    expect(verdict.checks[0]?.occluded).toBe(true);
    expect(verdict.checks[0]?.verified).toBe(false);
    /* Neither column: no refusal sentence, and not an advisory miss to chase. */
    expect(shortfalls(verdict)).toEqual([]);
    expect(advisoryMisses(verdict)).toEqual([]);
  });

  it("will not let `occluded` become a way to answer nothing", async () => {
    /* Without a `saw` the row is unread, and an unread row is silence — the
       evidence rule is asymmetric and this must not become its back door. */
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":true,"occluded":true}]}'],
      [...EARRINGS],
    );
    expect(verdict.checks[0]?.read).toBe(false);
    expect(verdict.checks[0]?.occluded).toBeUndefined();
    expect(unreadFacts(verdict)).toHaveLength(1);
  });

  it("cannot dodge a plain miss by claiming occlusion", async () => {
    /* `present: false` is a miss whatever else the reader says about it. */
    const { verdict } = await read(
      ['{"results":[{"id":1,"present":false,"occluded":true,"saw":"no earrings at all"}]}',
        '{"results":[{"id":1,"present":false,"occluded":true,"saw":"no earrings at all"}]}',
        '{"results":[{"id":1,"present":false,"occluded":true,"saw":"no earrings at all"}]}'],
      [...EARRINGS],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.checks[0]?.occluded).toBeUndefined();
  });
});

/**
 * A KEPT HOOP BEHIND NEW HAIR IS OCCLUDED, NOT ABSENT — the pair law meeting
 * the store (fable-120's third condition).
 *
 * Two correct decisions meet badly here and this is the seam between them.
 * Ruling (c) made an accessory's PRESENCE binding, because "are there dangly
 * cross earrings on her" has an answer and a shade name does not. The segment
 * store, separately, now pastes a delivered earring onto every later render. So
 * the first time she asks for her hair down over a face wearing kept hoops, the
 * new hair covers the ear, the reader honestly answers "no earrings", and the
 * founder is refunded and re-rendered for a picture that is exactly right.
 *
 * fable-109 already settled which instrument judges a carried fact: **the bytes,
 * never the reader.** That law had no consumer on the refusal path until now.
 */
describe("a carried fact is recorded by the reader and never refused by it", () => {
  const CARRIED = facetOfSubject("statedAccessories");
  const missOf = (facet: string): RenderVerdict => ({
    ok: false,
    checks: [{
      subject: aboutFacet(facet as never),
      asked: "gold hoop earrings, one on each ear, a matching pair",
      read: true,
      verified: false,
      binding: true,
      saw: "hair falling over both ears, no jewellery visible",
    }],
  });

  it("calls it OCCLUDED when this render's own paint covered the ground it owns", async () => {
    /* Not a reader's opinion and not a new measurement: `superseded` is the
       assembly's own arithmetic, computed at paste time as the share of a
       carried segment's pixels the fresh paint then claimed, and already on the
       row. A second answer to "was it covered" is how two would disagree. */
    const settled = settleCarriedChecks(missOf(CARRIED), {
      facets: [CARRIED],
      superseded: [{ facet: CARRIED }],
    });

    expect(settled.checks[0]?.occluded, "hidden, not missing").toBe(true);
    expect(settled.checks[0]?.binding).toBe(false);
    expect(settled.ok, "and nothing is refused over it").toBe(true);
  });

  it("records a carried miss that nothing covered — never binding, never hidden", async () => {
    /*
      The honest middle. The reader could not find a fact we PASTED and no paint
      of ours explains it, so the record must keep saying so: this is precisely
      the false-pass evidence the two-column report exists to collect, and
      promoting it to `occluded` would be the flattering direction.

      It still spends no refusal, because the reader is the wrong instrument for
      a carried fact — the byte adjudicator is the right one, and it runs against
      the artifacts rather than in the request.
    */
    const settled = settleCarriedChecks(missOf(CARRIED), { facets: [CARRIED] });

    expect(settled.checks[0]?.occluded, "no evidence of covering, so no claim of it").toBeUndefined();
    expect(settled.checks[0]?.verified, "the miss is still on the record").toBe(false);
    expect(settled.checks[0]?.read).toBe(true);
    expect(settled.checks[0]?.binding).toBe(false);
    expect(settled.ok).toBe(true);
  });

  it("CONTROL — leaves a PAINTED facet's miss exactly as it found it", async () => {
    /* The whole protection ruling (c) bought. A fact this render painted is the
       reader's to refuse, and if this control ever goes green the founder is
       being charged for missing earrings again. */
    const painted = missOf(CARRIED);
    const settled = settleCarriedChecks(painted, { facets: [], superseded: [{ facet: CARRIED }] });

    expect(settled).toBe(painted);
    expect(settled.checks[0]?.binding).toBe(true);
    expect(settled.ok).toBe(false);
  });

  it("CONTROL — a carried facet that PASSED is untouched, occlusion or not", async () => {
    const passed: RenderVerdict = {
      ok: true,
      checks: [{
        subject: aboutFacet(CARRIED as never),
        asked: "gold hoop earrings",
        read: true,
        verified: true,
        binding: true,
        saw: "a gold hoop on each ear",
      }],
    };
    const settled = settleCarriedChecks(passed, { facets: [CARRIED], superseded: [{ facet: CARRIED }] });

    expect(settled.checks[0]?.verified).toBe(true);
    expect(settled.checks[0]?.occluded, "a delivered thing is not hidden").toBeUndefined();
    expect(settled.checks[0]?.binding).toBe(true);
  });

  it("CONTROL — silence stays silence, and never becomes an occlusion", async () => {
    /*
      D-235's asymmetry, at this door. `occluded` is an answer ABOUT a
      photograph; a check with no reading has none, and letting a covered
      segment manufacture one would give the store a way to convert every
      unanswered question into a tidy third verdict.
    */
    const silent: RenderVerdict = {
      ok: true,
      checks: [{
        subject: aboutFacet(CARRIED as never),
        asked: "gold hoop earrings",
        read: false,
        verified: false,
        binding: true,
      }],
    };
    const settled = settleCarriedChecks(silent, { facets: [CARRIED], superseded: [{ facet: CARRIED }] });

    expect(settled.checks[0]?.occluded).toBeUndefined();
    expect(settled.checks[0]?.read).toBe(false);
    expect(settled.checks[0]?.binding, "an unread check was never a refusal anyway").toBe(true);
  });

  it("CONTROL — a render that carried nothing is returned untouched", async () => {
    const ordinary = missOf(CARRIED);
    expect(settleCarriedChecks(ordinary, { facets: [] })).toBe(ordinary);
  });
});

/**
 * NO SECOND OPINION, AND THE ONE READING SAYS THE THING IS ABSENT (fable-318 R1).
 *
 * The fixture is not invented: it is dev variant #166's stored verification,
 * copied out of `internalPrompt.verification` on the row the walk paid 25
 * credits for. The render was DELIVERED with `readings: 1` because the
 * confirming re-read did not come back, and the reading it did have named the
 * defect out loud. Every arm below is that row with one thing changed, so the
 * suite can say which clause each outcome turns on.
 */
describe("a confirming re-read that never lands cannot deliver an evidenced absence", () => {
  const ACCESSORIES = facetOfSubject("statedAccessories");

  /** v#166, verbatim — the paid specimen. */
  const specimen = (): RenderVerdict => ({
    ok: false,
    checks: [
      {
        subject: aboutFacet(ACCESSORIES),
        asked: "dangly cross earrings, one on each ear, a matching pair",
        saw: "left ear has a dangly gold cross; right ear has a plain hoop, not a cross",
        read: true,
        verified: false,
        binding: true,
        absent: true,
      },
      {
        subject: aboutFacet(HAIR_WORN),
        asked: "worn down — hanging, not gathered, tied or pinned up",
        saw: "hair falls loose to shoulder length, no ties or pins visible",
        read: true,
        verified: true,
        binding: false,
      },
    ],
  });
  const unavailable = async (): Promise<RenderVerdict> => ({ ok: true, checks: [], unavailable: true });

  it("THE SPECIMEN — v#166's own shape does not deliver", async () => {
    let rereads = 0;
    const confirmed = await confirmVerdict(specimen(), async () => {
      rereads += 1;
      return unavailable();
    });

    expect(confirmed.ok, "delivered and charged is what this row actually did").toBe(false);
    expect(confirmed.readings).toBe(1);
    expect(rereads, "the confirmation is retried once before the question is settled").toBe(2);
  });

  it("and the retry is a real second chance — a confirmation that lands on the second try is used", async () => {
    let rereads = 0;
    const confirmed = await confirmVerdict(specimen(), async () => {
      rereads += 1;
      /* The second attempt at the confirmation comes back, and it AGREES the
         earrings are wrong: two readings that agree are what a refusal is made
         of, so this settles at two rather than falling through to the absence
         rule above. */
      return rereads === 1 ? await unavailable() : specimen();
    });

    expect(rereads).toBe(2);
    expect(confirmed.readings).toBe(2);
    expect(confirmed.ok).toBe(false);
  });

  it("CONTROL — a QUIBBLE with no second opinion still delivers (D-187 untouched)", async () => {
    const quibble = specimen();
    /* run-10's shape: the hoops are ON her, the reader objects to an adjective
       she never used. `absent: false` is the reader saying so. */
    quibble.checks[0] = {
      ...quibble.checks[0]!,
      absent: false,
      saw: "gold hoops on both ears, thin and understated rather than bold",
    };

    const confirmed = await confirmVerdict(quibble, unavailable);

    expect(confirmed.ok, "a quibble may not spend her refund or her wait").toBe(true);
    expect(confirmed.readings).toBe(1);
  });

  it("CONTROL — SILENCE with no second opinion still delivers (D-235 asymmetry untouched)", async () => {
    const silent = specimen();
    const { absent: _dropped, ...withoutAbsence } = silent.checks[0]!;
    silent.checks[0] = withoutAbsence;

    const confirmed = await confirmVerdict(silent, unavailable);

    expect(confirmed.ok, "an unanswered absence question is not an absence").toBe(true);
    expect(confirmed.readings).toBe(1);
  });

  it("CONTROL — an unavailable FIRST reading still delivers, and never re-reads", async () => {
    let rereads = 0;
    const confirmed = await confirmVerdict(
      { ok: true, checks: [], unavailable: true },
      async () => { rereads += 1; return unavailable(); },
    );

    expect(confirmed.ok).toBe(true);
    expect(rereads, "there is nothing to confirm").toBe(0);
  });

  it("a scoped fact asks about ONE eye and puts THAT eye on the receipt", () => {
    /*
      fable-444 condition 2, in its three places at once. The reader's line has
      to name the side; the CUSTOMER's sentence has to say which eye fell short,
      because "the render came back without green" is a different receipt from
      "without her left eye green" and only one of them is what happened; and
      both readings of D-194 have to match on the same string, or a majority of
      three quietly degrades to a single sample.
    */
    const scoped = scopedToInstance(
      { subject: aboutFacet(EYE_COLOUR), asked: "green", binding: true },
      { noun: "left eye", other: "right eye" },
    );

    expect(scoped.asked).toContain("HER LEFT EYE ONLY");
    expect(scoped.asked).toContain("her right eye was deliberately left as it was");
    expect(scoped.shortfall).toBe("without her left eye green");
    /* Untouched: a scoped fact is exactly as refusable as the whole-face one it
       replaces. The question became answerable; the answer still counts. */
    expect(scoped.binding).toBe(true);
  });

  it("keeps a shortfall the caller already wrote — a removal says its own sentence", () => {
    /* The one fact class that authors its own customer sentence (`departedShortfall`)
       must not have it overwritten by a template about the side. */
    const scoped = scopedToInstance(
      { subject: aboutFacet(EYE_COLOUR), asked: "no hoop", shortfall: "with the hoop still in the picture", binding: true },
      { noun: "left ear", other: "right ear" },
    );

    expect(scoped.shortfall).toBe("with the hoop still in the picture");
  });

  it("puts the scoped shortfall on the sentence the customer actually reads", () => {
    /* Driven through `shortfalls`, not read off the object — the receipt is the
       thing that matters and it is one function further on. */
    const verdict: RenderVerdict = {
      ok: false,
      checks: [{
        ...scopedToInstance(
          { subject: aboutFacet(EYE_COLOUR), asked: "green", binding: true },
          { noun: "left eye", other: "right eye" },
        ),
        read: true,
        verified: false,
        binding: true,
        absent: true,
        saw: "both irises still brown",
      } as never],
    };

    expect(shortfalls(verdict)).toEqual(["without her left eye green"]);
  });

  it("a removal that did not happen is the same catastrophe from the other side", async () => {
    /*
      `absenceIsTheAsk`: the reader answers `present: false` about a line that IS
      an absence — "no glasses" — which means the glasses are STILL THERE. The
      reader is never asked `absent` about it (the question has two defensible
      opposite answers), so this arm proves the rule does not depend on a field
      that shape can never carry.
    */
    const removal: RenderVerdict = {
      ok: false,
      checks: [{
        subject: aboutFacet(ACCESSORIES),
        asked: "no glasses — they have been taken off and are not in the picture",
        saw: "black rectangular glasses still on her face",
        read: true,
        verified: false,
        binding: true,
        absenceIsTheAsk: true,
      }],
    };

    const confirmed = await confirmVerdict(removal, unavailable);

    expect(confirmed.ok).toBe(false);
    expect(confirmed.readings).toBe(1);
  });
});

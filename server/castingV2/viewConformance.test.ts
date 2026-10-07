import { describe, expect, it, vi } from "vitest";

import { ProviderError, type TextEngine, type TextRequest } from "../providers/types";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  CONFORMANCE_AXES,
  conformanceProvenance,
  createViewConformanceJudge,
  forcedFailAnglesFromEnv,
  unjudgedVerdict,
  viewConformanceRefuses,
  viewDeliveredUnchecked,
  type ViewConformanceVerdict,
} from "./viewConformance";

/**
 * "View conformance is theatre unless it can fail" (D-92).
 *
 * So this file is mostly negative fixtures. Every axis is proved to reject on
 * its own, and every way the judge can fail to answer is proved to fail the
 * slot rather than wave it through — because a validator written green has
 * never demonstrated it can go red, and a validator that defaults to pass is
 * worse than no validator: it reports success loudest exactly when it
 * understood nothing.
 */

const anchor = { bytes: Buffer.from("anchor"), contentType: "image/png" };
const candidate = { bytes: Buffer.from("candidate"), contentType: "image/png" };

function engineReturning(text: string, extra: Partial<{ truncated: boolean }> = {}): TextEngine {
  return {
    id: "test-judge",
    complete: vi.fn(async () => ({
      text,
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "test" },
      ...extra,
    })),
  };
}

function engineThrowing(error: unknown): TextEngine {
  return {
    id: "test-judge",
    complete: vi.fn(async () => {
      throw error;
    }),
  };
}

const allPass = JSON.stringify({
  identity: { verdict: "matches", note: "same person" },
  intact: { verdict: "matches", note: "a clean render" },
  people: { verdict: "matches", note: "one person" },
});

describe("view conformance", () => {
  it("lands a view only when all three axes pass", async () => {
    const judge = createViewConformanceJudge({ engine: engineReturning(allPass) });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    expect(verdict.pass).toBe(true);
    expect(CONFORMANCE_AXES.every((axis) => verdict.axes[axis].pass)).toBe(true);
  });

  /**
   * Each axis alone. The M3 calibration is the reason: identity held across a
   * whole package while the wardrobe quietly did not, and a single blended
   * "looks right" score cannot say which of those went wrong.
   */
  for (const axis of CONFORMANCE_AXES) {
    it(`fails the view when ${axis} alone fails`, async () => {
      /* DERIVED from the axis set rather than spelled out, so a fourth axis
         cannot be added without this arm exercising it. */
      const reply = Object.fromEntries(
        CONFORMANCE_AXES.map((name) => [name, { verdict: "matches", note: "" }]),
      ) as Record<string, { verdict: string; note: string }>;
      reply[axis] = { verdict: "differs", note: "no" };
      const judge = createViewConformanceJudge({ engine: engineReturning(JSON.stringify(reply)) });

      const verdict = await judge({ angle: "sideClose", anchor, candidate });
      expect(verdict.pass).toBe(false);
      expect(verdict.axes[axis].pass).toBe(false);
      // The other two are untouched — the axes are independent, not a blend.
      for (const other of CONFORMANCE_AXES.filter((entry) => entry !== axis)) {
        expect(verdict.axes[other].pass).toBe(true);
      }
    });
  }

  it("fails closed when the reply cannot be read", async () => {
    const judge = createViewConformanceJudge({ engine: engineReturning("I had a look and it seems fine!") });
    const verdict = await judge({ angle: "backFull", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.unjudged).toBe(true);
    expect(verdict.method).toBe("unparsed");
  });

  it("fails closed when an axis is missing rather than filling it in", async () => {
    // A judge that has to be corrected into agreeing is not a second opinion.
    const judge = createViewConformanceJudge({
      engine: engineReturning(JSON.stringify({
        identity: { verdict: "matches" },
        intact: { verdict: "matches" },
      })),
    });
    const verdict = await judge({ angle: "threeQuarter", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.unjudged).toBe(true);
  });

  it("treats a refusal as a failure, never as a default pass", async () => {
    const judge = createViewConformanceJudge({
      engine: engineThrowing(new ProviderError("content_policy", "refused")),
    });
    const verdict = await judge({ angle: "frontClose", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.method).toBe("refused");
    expect(verdict.unjudged).toBe(true);
  });

  it("fails closed when the judge cannot be reached", async () => {
    const judge = createViewConformanceJudge({
      engine: engineThrowing(new ProviderError("capability", "bad request")),
    });
    const verdict = await judge({ angle: "frontClose", anchor, candidate });
    expect(verdict.pass).toBe(false);
    expect(verdict.method).toBe("unavailable");
  });

  it("rethrows a retryable transport failure instead of condemning the view", async () => {
    // The retry law owns this case (§H.5). Converting it to a verdict would
    // refund a customer for a view that was fine, because our network blinked.
    const judge = createViewConformanceJudge({
      engine: engineThrowing(new ProviderError("transport", "socket hang up")),
    });
    await expect(judge({ angle: "frontFull", anchor, candidate })).rejects.toBeInstanceOf(ProviderError);
  });

  it("treats a reply cut off at the ceiling as transport, not as a verdict", async () => {
    // D-83 in the judge's clothing: a fragment of JSON fails the whole parse,
    // and the model did not fail — our ceiling did.
    const judge = createViewConformanceJudge({
      engine: engineReturning('{"identity":{"pass":tru', { truncated: true }),
    });
    await expect(judge({ angle: "frontFull", anchor, candidate })).rejects.toBeInstanceOf(ProviderError);
  });

  it("reads a verdict that arrived wrapped in a fence", async () => {
    const judge = createViewConformanceJudge({
      engine: engineReturning("Here you go:\n```json\n" + allPass + "\n```"),
    });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    expect(verdict.pass).toBe(true);
  });

  describe("the forced-fail switch", () => {
    it("fails the named angle without spending a judge call", async () => {
      const engine = engineReturning(allPass);
      const judge = createViewConformanceJudge({ engine, forceFail: ["sideClose"] });

      const forced = await judge({ angle: "sideClose", anchor, candidate });
      expect(forced.pass).toBe(false);
      expect(forced.method).toBe("forced");
      expect(engine.complete).not.toHaveBeenCalled();

      // And it is surgical: every other angle judges normally.
      const other = await judge({ angle: "frontFull", anchor, candidate });
      expect(other.pass).toBe(true);
      expect(engine.complete).toHaveBeenCalledTimes(1);
    });

    it("parses the server-only switch, ignoring anything that is not an angle", () => {
      expect(forcedFailAnglesFromEnv(undefined, CAST_PACKAGE_VIEWS)).toBeUndefined();
      expect(forcedFailAnglesFromEnv("", CAST_PACKAGE_VIEWS)).toBeUndefined();
      expect(forcedFailAnglesFromEnv("all", CAST_PACKAGE_VIEWS)).toBe("all");
      expect(forcedFailAnglesFromEnv("sideClose, backFull", CAST_PACKAGE_VIEWS)).toEqual([
        "sideClose",
        "backFull",
      ]);
      // A typo must not silently fail every view, and must not silently fail none
      // while looking like it is on.
      expect(forcedFailAnglesFromEnv("sideclose", CAST_PACKAGE_VIEWS)).toBeUndefined();
    });
  });

  it("shows the judge both pictures and NO specification at all (#1903), and never the prompt", async () => {
    let seen: TextRequest | null = null;
    const engine: TextEngine = {
      id: "test-judge",
      complete: vi.fn(async (request: TextRequest) => {
        seen = request;
        return { text: allPass, latencyMs: 1, provenance: { provider: "openrouter" as const, model: "t" } };
      }),
    };
    const judge = createViewConformanceJudge({ engine });
    await judge({ angle: "backFull", anchor, candidate });

    expect(seen).not.toBeNull();
    const request = seen as unknown as TextRequest;
    // Two images, anchor first: the system prompt names them in that order.
    expect(request.images).toHaveLength(2);
    expect(request.images?.[0]?.bytes.toString()).toBe("anchor");
    /*
      ⚠ THE ABSENCE IS THE ASSERTION — #1903. This arm used to require
      "SPECIFICATION" in the user turn; a judge handed a framing sentence and a
      wardrobe sentence will answer them, in the note if not in the verdict, and
      the note is what support and every future court read. Driven at the wire
      rather than at a constant (invariant 5).
    */
    expect(request.user).not.toContain("SPECIFICATION");
    expect(request.user).not.toContain("Framing:");
    expect(request.user).not.toContain("Wardrobe:");
    expect(request.user).not.toContain("OUTPUT FRAME");
    expect(request.user).not.toContain("AUTHORITY:");
  });

  /**
   * ⚠ **THE TWO QUESTIONS THAT LEFT — driven at the wire, both turns.**
   *
   * The whole of #1903 for a customer is that nobody asks about the crop or the
   * clothes any more. A reader could satisfy every arm above while still
   * posting *"does IMAGE 2 show the framing the specification asks for"* in the
   * SYSTEM prompt, which is where those questions actually lived.
   */
  it("⚠ never asks the reader about the crop, the pose or the clothing", async () => {
    let seen: TextRequest | null = null;
    const engine: TextEngine = {
      id: "test-judge",
      complete: vi.fn(async (request: TextRequest) => {
        seen = request;
        return { text: allPass, latencyMs: 1, provenance: { provider: "openrouter" as const, model: "t" } };
      }),
    };
    await createViewConformanceJudge({ engine })({ angle: "closeUp", anchor, candidate });

    const posted = `${(seen as unknown as TextRequest).system ?? ""} ${(seen as unknown as TextRequest).user ?? ""}`;
    for (const retired of ["2. angle", "3. wardrobe", "the framing the specification"]) {
      expect(posted).not.toContain(retired);
    }
    // And the three it DOES ask are all there, by name.
    for (const axis of CONFORMANCE_AXES) expect(posted).toContain(axis);
  });
});

describe("one field for one fact — the judge cannot contradict itself", () => {
  /*
    THE SPECIMEN, from the package-v3.1 verification Sign. The judge returned

      angle: { pass: false, note: "This is a true side profile with only one eye
               visible… overall it satisfies the 90-degree side profile
               requirement." }

    A passing sentence beside a failing boolean. The customer was refunded 50
    credits for a correct view and the record contained its own contradiction —
    two fields for one fact, which is the drift class every record-truth fix
    this month has killed.

    The fix removes the second field rather than arbitrating between them.
  */
  const engineReturning = (text: string) => ({
    id: "test",
    complete: async () => ({
      text,
      truncated: false,
      latencyMs: 1,
      provenance: { provider: "test", model: "test" },
    }),
  });

  const images = {
    anchor: { bytes: Buffer.from("a"), contentType: "image/png" },
    candidate: { bytes: Buffer.from("b"), contentType: "image/png" },
  };

  it("takes the verdict as the answer, whatever the note argues", async () => {
    const judge = createViewConformanceJudge({
      engine: engineReturning(JSON.stringify({
        identity: {
          verdict: "matches",
          note: "This is the same person, though the second eye's brow is faintly "
            + "suggested rather than drawn; overall the bone structure and the ink "
            + "both hold.",
        },
        intact: { verdict: "matches", note: "a clean render" },
        people: { verdict: "matches", note: "one person" },
      })) as never,
    });

    const verdict = await judge({ angle: "sideClose", ...images });

    // The specimen now lands the way its own sentence reads.
    expect(verdict.pass).toBe(true);
    expect(verdict.axes.identity.pass).toBe(true);
    expect(verdict.axes.identity.verdict).toBe("matches");
  });

  it("cannot express the old contradiction at all", async () => {
    /*
      The structural half. A reply in the OLD shape — a bare boolean — no longer
      parses, so a model that emits one fails closed rather than being read as
      an authority. There is nowhere left for a second opinion to live.
    */
    const judge = createViewConformanceJudge({
      engine: engineReturning(JSON.stringify({
        identity: { pass: true, note: "same person" },
        intact: { pass: false, note: "overall it satisfies the requirement" },
        people: { pass: true, note: "one person" },
      })) as never,
    });

    const verdict = await judge({ angle: "sideClose", ...images });

    expect(verdict.pass).toBe(false);
    expect(verdict.unjudged).toBe(true);
    expect(verdict.method).toBe("unparsed");
  });

  it("fails IDENTITY when the judge says it cannot tell — §I, still in full", async () => {
    // An axis nobody could judge is not an axis that passed, on the one axis
    // whose failure breaks what a signed Cast promises.
    const judge = createViewConformanceJudge({
      engine: engineReturning(JSON.stringify({
        identity: { verdict: "unsure", note: "the face is half in shadow" },
        intact: { verdict: "matches", note: "a clean render" },
        people: { verdict: "matches", note: "one person" },
      })) as never,
    });

    const verdict = await judge({ angle: "closeUp", ...images });

    expect(verdict.pass).toBe(false);
    expect(verdict.axes.identity.pass).toBe(false);
    expect(verdict.axes.identity.verdict).toBe("unsure");
    // Not a fail-closed DEFAULT — the judge answered, and said it could not tell.
    expect(verdict.unjudged).toBeUndefined();
  });

  /**
   * ⚠ **AND THE OTHER TWO DO NOT — #1903's one declared asymmetry, driven both
   * ways so neither arm can be inert.**
   *
   * *"I cannot tell whether this picture is broken"* is not a detection of a
   * broken picture. Refusing on it would take a deliverable frame away for an
   * absence of evidence, which is the over-refusal his ruling removed. The
   * `differs` control beside each arm is what proves the axis can still bite.
   */
  for (const axis of ["intact", "people"] as const) {
    const replyWith = (verdict: string, note: string) => {
      const reply: Record<string, { verdict: string; note: string }> = {
        identity: { verdict: "matches", note: "same person" },
        intact: { verdict: "matches", note: "" },
        people: { verdict: "matches", note: "" },
      };
      reply[axis] = { verdict, note };
      return JSON.stringify(reply);
    };

    it(`⚠ DELIVERS when ${axis} is UNSURE — an unanswered question is not a catastrophe`, async () => {
      const verdict = await createViewConformanceJudge({
        engine: engineReturning(replyWith("unsure", "I cannot tell from this crop")) as never,
      })({ angle: "closeUp", ...images });

      expect(verdict.axes[axis].verdict).toBe("unsure");
      expect(verdict.axes[axis].pass).toBe(true);
      expect(verdict.pass).toBe(true);
      expect(viewConformanceRefuses(verdict)).toBe(false);
    });

    it(`CONTROL — ${axis} saying DIFFERS still refuses, so the arm above is not inert`, async () => {
      const verdict = await createViewConformanceJudge({
        engine: engineReturning(replyWith("differs", "it really is broken")) as never,
      })({ angle: "closeUp", ...images });

      expect(verdict.axes[axis].pass).toBe(false);
      expect(viewConformanceRefuses(verdict)).toBe(true);
    });
  }
});

/**
 * ⚠ **THE IDENTITY AXIS NAMES MARKINGS AND MAKEUP — #1221.**
 *
 * The axis read *"bone structure, facial proportions, skin, hair and build"*,
 * and a delivery with the right bones and none of her neck ink satisfied every
 * word of it. His Sifr2 close-up was exactly that, and **this judge would have
 * passed it** had it run at all.
 *
 * Read AT THE WIRE rather than off the constant, which is not exported: these
 * drive the real judge and assert on the system prompt the engine was actually
 * handed. A claim about what gets sent is proven on the outgoing request
 * (working law 5) — and the previous instance of this class (#1207's light) was
 * missed precisely because a grep was run over the file instead.
 */
describe("the judge's identity axis reads her markings", () => {
  /** The real judge, run once, returning the system prompt the engine got. */
  async function systemPromptSent(): Promise<string> {
    const engine = engineReturning(allPass);
    const judge = createViewConformanceJudge({ engine });
    await judge({ angle: "closeUp", anchor, candidate });
    const call = (engine.complete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    return String(call?.system ?? "");
  }

  it("tells the judge that tattoos, piercings and makeup are part of the person", async () => {
    const system = await systemPromptSent();
    for (const word of ["tattoos and ink", "piercings", "scars", "makeup"]) {
      expect(system, `the identity axis no longer names ${word}`).toContain(word);
    }
    expect(system).toContain("a bare, unmade version of the same face is a FAIL");
  });

  it("⚠ bounds it to what IMAGE 2's frame reaches — an axis that fails when unsure must not fail on a crop", () => {
    /*
      The judge is told elsewhere to FAIL an axis it is unsure about, so an
      unbounded marking clause would refund a close-up for not showing an ankle
      tattoo. Both halves are asserted: the bound, and the sentence that makes
      the bound explicit rather than implied.
    */
    return systemPromptSent().then((system) => {
      expect(system).toContain("wherever IMAGE 2's frame reaches it");
      expect(system).toContain("a marking outside IMAGE 2's crop is not missing");
    });
  });

  it("CONTROL — the reader sees the real prompt, and the axis kept what it already judged", async () => {
    /*
      Three arms above are `toContain` over a string this helper produced. If
      `systemPromptSent` ever returned "" — a renamed field, a judge that stops
      calling the engine — they would all still pass. This proves it returns the
      real thing, and that the widening did not drop the axis's original job.
    */
    const system = await systemPromptSent();
    expect(system.length).toBeGreaterThan(500);
    expect(system).toContain("IMAGE 1 is the signed reference photograph");
    expect(system).toContain("bone structure, facial proportions, skin, hair and build");
    expect(system).toContain("A similar-looking person of the same type is a FAIL");
    /* And it is the IDENTITY axis that gained them, not some other line. */
    const identityLine = system.split(" 2. angle")[0];
    expect(identityLine).toContain("tattoos and ink");
  });
});

/**
 * ⚠ **THE RULE ITSELF — #1612 part 2, his ruling 2026-09-30.**
 *
 * `viewConformanceRefuses` is one line of code and it decides whether a paying
 * customer keeps a picture, so it is driven here as a pure function as well as
 * through the loop: the orchestrator's arms prove the money, these prove the
 * rule, and an arm at each altitude is what stops a refactor moving one without
 * the other noticing.
 */
describe("which verdict takes a picture away", () => {
  /*
    ⚠ **AND #1903 MADE IT EVERY AXIS — WHICH IS THE RULING ABOVE CARRIED
    THROUGH, NOT A REVERSAL OF IT.**

    #1612 kept three axes and let ONE refuse, because the other two were
    opinions about a crop and an outfit and they were taking pictures away
    wrongly. #1903 deleted those opinions: every axis left is a catastrophe he
    named, so every one of them refuses. The arms below are the same arms at the
    same altitude, asking the question the new axis set makes askable.
  */
  const axisEntry = (pass: boolean, verdict: "matches" | "differs" | "unsure") =>
    ({ pass, verdict, note: "" });
  const verdict = (
    axes: Partial<Record<"identity" | "intact" | "people", "matches" | "differs" | "unsure">>,
    extra: Partial<ViewConformanceVerdict> = {},
  ): ViewConformanceVerdict => {
    const word = (name: "identity" | "intact" | "people") => axes[name] ?? "matches";
    /*
      ⚠ THE FIXTURE OBEYS THE PRODUCT'S OWN ASYMMETRY RATHER THAN RESTATING IT
      — `unsure` passes on the two catastrophe axes and fails on identity,
      which is {@link AXIS_REFUSES_ON_UNSURE}'s rule. A fixture that spelled its
      own rule here would let the two drift apart and every arm below would keep
      passing while the product changed underneath them.
    */
    const built = {
      identity: axisEntry(word("identity") === "matches", word("identity")),
      intact: axisEntry(word("intact") !== "differs", word("intact")),
      people: axisEntry(word("people") !== "differs", word("people")),
    };
    return {
      pass: CONFORMANCE_AXES.every((name) => built[name].pass),
      method: "judge:test",
      axes: built,
      ...extra,
    };
  };

  it("refuses when identity DIFFERS", () => {
    expect(viewConformanceRefuses(verdict({ identity: "differs" }))).toBe(true);
  });

  it("refuses when identity is UNSURE — fail-closed, on this axis only", () => {
    expect(viewConformanceRefuses(verdict({ identity: "unsure" }))).toBe(true);
  });

  it("refuses a BROKEN picture — his catastrophe 2", () => {
    expect(viewConformanceRefuses(verdict({ intact: "differs" }))).toBe(true);
  });

  it("refuses the WRONG NUMBER OF PEOPLE — his catastrophe 3", () => {
    expect(viewConformanceRefuses(verdict({ people: "differs" }))).toBe(true);
  });

  it("⚠ does NOT refuse when the two catastrophe axes are merely UNSURE", () => {
    expect(viewConformanceRefuses(verdict({ intact: "unsure", people: "unsure" }))).toBe(false);
  });

  it("refuses when several fail together — no axis rescues another", () => {
    expect(
      viewConformanceRefuses(verdict({ identity: "unsure", intact: "differs", people: "differs" })),
    ).toBe(true);
  });

  it("does not refuse a verdict where everything matched", () => {
    expect(viewConformanceRefuses(verdict({}))).toBe(false);
  });

  /*
    ⚠ **THE ARM THE WHOLE RULE TURNS ON.** `unjudged`'s fail-closed default
    writes `pass: false` on EVERY axis, identity included — so a rule that read
    the axes without answering `unjudged` first would refuse every view a flaky
    judge could not reach, silently reversing D-246. It would look like a
    tightening and be a regression, and the only thing that catches it is an arm
    that says so by name.

    ⚠ It is worth MORE after #1903, not less: the clause it protects is now
    `CONFORMANCE_AXES.some(...)`, which fails on all three of those axes at once.
  */
  it("⚠ never refuses an UNJUDGED verdict, whatever its axes say (D-246)", () => {
    expect(viewConformanceRefuses(unjudgedVerdict("unavailable", "the view could not be checked")))
      .toBe(false);
  });

  it("⚠ CONTROL — the forced-fail switch is NOT unjudged, so it still refuses", () => {
    const forced = { pass: false, note: "forced failure switch" };
    expect(
      viewConformanceRefuses({
        pass: false,
        method: "forced",
        axes: Object.fromEntries(
          CONFORMANCE_AXES.map((name) => [name, { ...forced }]),
        ) as ViewConformanceVerdict["axes"],
      }),
    ).toBe(true);
  });

  /**
   * ⚠ **THE OBLIGATION ON WHOEVER ADDS A FOURTH AXIS, written as an arm.**
   *
   * The refusal rule is structural now: a failing axis refuses because every
   * axis is a catastrophe. So the thing to hold is the SET — an axis added here
   * starts taking pictures away from customers on the day it merges, and a
   * reader who has not read {@link viewConformanceRefuses}'s docblock will not
   * know that. This arm is where they find out.
   */
  it("⚠ holds the catastrophic axis set — adding one takes pictures away", () => {
    expect([...CONFORMANCE_AXES]).toEqual(["identity", "intact", "people"]);
    for (const axis of CONFORMANCE_AXES) {
      expect(viewConformanceRefuses(verdict({ [axis]: "differs" }))).toBe(true);
    }
  });
});

/**
 * ⚠ **WAS IT DELIVERED WITHOUT A COMPLETE CHECK — read at the row.**
 *
 * This is what turns a slot into `Unchecked · Try again` at a price of zero, so
 * every arm below is a money arm. Its population was measured on production
 * before it was written: 46 landed views with a full judged record, 3 with
 * `unavailable`, **20 with no conformance key at all**, and **0 carrying a
 * failing axis** — the last number is why the second road below moved no
 * history, and the third is why absence is not read as failure.
 *
 * ⚠ **THAT LAST NUMBER IS 3 NOW, AND RE-READING IT RATHER THAN CARRYING IT IS
 * WHAT MADE #1903 SAFE.** #1612 part 2 merged on 2026-10-07 and began writing
 * exactly the rows that sentence said could not exist. Read at production the
 * same day: assets **383, 389 and 391** each carry a failing `angle` axis under
 * a real judge method, plus three older rows under `unavailable`.
 *
 * So the axis rename in #1903 would have stopped this reader seeing three live
 * rows — **three customers quietly losing a free Try again they are owed** —
 * and the arms below are what hold the retired names in the reader.
 */
describe("was this view delivered unchecked", () => {
  it("YES when nobody looked — the D-246 road, an equality on a contract value", () => {
    expect(viewDeliveredUnchecked({ conformanceMethod: "unavailable" })).toBe(true);
  });

  it("YES when somebody looked and an axis did not hold — the #1612 road", () => {
    expect(viewDeliveredUnchecked({
      conformanceMethod: "judge:test",
      conformance: {
        identity: { pass: true, note: "" },
        intact: { pass: false, note: "garbled" },
        people: { pass: true, note: "" },
      },
    })).toBe(true);
  });

  /**
   * ⚠ **THE THREE LIVE ROWS — the arm #1903 could most easily have shipped
   * without, because nothing would have failed.**
   *
   * This is the shape assets 383/389/391 carry on production right now: a real
   * judge method and a failing `angle`, an axis name this product no longer
   * asks for. Reading only the CURRENT axis set returns `false` here, the room
   * drops the `Unchecked` line, and the free Try again those three views are
   * owed disappears with no error anywhere.
   */
  it("⚠ YES on a row carrying a RETIRED axis — assets 383/389/391, read at production", () => {
    expect(viewDeliveredUnchecked({
      conformanceMethod: "judge:openrouter:anthropic/claude-sonnet-5",
      conformance: {
        identity: { pass: true, verdict: "matches", note: "" },
        angle: { pass: false, verdict: "differs", note: "measured out of band" },
        wardrobe: { pass: true, verdict: "matches", note: "" },
      },
    })).toBe(true);
  });

  it("NO when every recorded axis passed under a real judge", () => {
    expect(viewDeliveredUnchecked({
      conformanceMethod: "judge:test",
      conformance: {
        identity: { pass: true, note: "" },
        intact: { pass: true, note: "" },
        people: { pass: true, note: "" },
      },
    })).toBe(false);
  });

  it("CONTROL — a retired axis that PASSED is not read as unchecked either", () => {
    expect(viewDeliveredUnchecked({
      conformanceMethod: "judge:test",
      conformance: {
        identity: { pass: true, note: "" },
        angle: { pass: true, note: "" },
        wardrobe: { pass: true, note: "" },
      },
    })).toBe(false);
  });

  it("⚠ NO when there is no conformance record at all — 20 live rows, unchanged", () => {
    expect(viewDeliveredUnchecked({ provider: "fal", engine: "fal-ai/nano-banana-pro" })).toBe(false);
    expect(viewDeliveredUnchecked({ conformanceMethod: "judge:test" })).toBe(false);
  });

  it("NO on a row with no provenance at all, rather than throwing on it", () => {
    expect(viewDeliveredUnchecked(null)).toBe(false);
    expect(viewDeliveredUnchecked(undefined)).toBe(false);
    expect(viewDeliveredUnchecked("not an object")).toBe(false);
  });

  it("reads only RECORDED axes — a half-written record is not a failing one", () => {
    expect(viewDeliveredUnchecked({
      conformanceMethod: "judge:test",
      conformance: { identity: { pass: true, note: "" } },
    })).toBe(false);
  });

  /*
    The two roads are ONE reading on purpose: `conformanceProvenance` writes the
    record and this reads it, in the same file. The projection used to keep its
    own copy of the equality, which is working law 4's shape on a surface where
    drift means the room offering a free Try again the entrance charges for.
  */
  it("is the reading the stored provenance is written for", () => {
    const written = conformanceProvenance({
      pass: false,
      method: "judge:test",
      axes: {
        identity: { pass: false, verdict: "unsure", note: "" },
        intact: { pass: true, verdict: "matches", note: "" },
        people: { pass: true, verdict: "matches", note: "" },
      },
    });
    expect(viewDeliveredUnchecked(written)).toBe(true);
  });
});

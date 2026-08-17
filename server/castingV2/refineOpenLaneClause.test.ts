import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import {
  CASTING_OPEN_LANE_SCOPE_ENV,
  captureCastingOpenLaneEnabled,
  validateCastingOpenLaneEnvironment,
} from "./castingV2Scope";
import { OPEN_KIND_SYSTEM } from "./openLaneKind";
import { KIND_PROPERTY_SYSTEM } from "./openKindProperties";
import { interpretRefinement, refineParseSystemPrompt } from "./refineInterpreter";

/**
 * THE OPEN LANE'S OPENING SENTENCE, AND THE FLAG IT IS BEHIND.
 *
 * Three things are proven here and each answers something that went wrong once:
 *
 *  1. **The OFF prompt is byte-identical to the one that shipped before the
 *     clause existed.** The routing bench's "before" arm is this function with
 *     the flag off, so a drift of one character would turn the measurement into
 *     a comparison of two things neither of which ships. The fixture was
 *     captured from the code BEFORE the clause was written and is never
 *     regenerated — a control that re-records itself marks its own homework.
 *  2. **The clause's two halves both land when the flag is on**, including the
 *     swap. The addition alone is inert: the wall check sits above the
 *     acceptance door, so an ask still routed to the stage wall never reaches
 *     the lane.
 *  3. **The door is gated too, not just the prompt.** A reply may name an
 *     unknown subject key without being invited to, and the door shipped
 *     ungated in a product whose casting scope is `all`.
 *
 * The interpreter arms are SCRIPTED, for law 3's reason: the behaviour that
 * matters is a reply naming an unknown key, and a real model will not produce
 * one on demand with the flag off.
 */

/** An engine that answers from a script and records what it was asked. */
function scripted(replies: string[]): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)]!;
      index += 1;
      return { text: reply, provenance: { provider: "openrouter" as const, model: "scripted" }, latencyMs: 0 };
    },
  } as TextEngine & { seen: TextRequest[] };
}

const FACE = {
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "curly",
  currentMakeup: null,
};

/** His own ask, and the only unfiled instruction in the production corpus. */
const HIS = "give her vampire fangs";
/** The reply the clause exists to make possible: an unknown subject key. */
const NAMES_A_NEW_KIND = JSON.stringify({ intent: "edit", free: { fangs: "vampire fangs" } });
/** What the normalizer answers when asked what the THING is. */
const NORMALIZED = JSON.stringify({ kind: "fangs" });

describe("the OFF prompt is the prompt that shipped", () => {
  /*
    THE FIXTURE IS JSON-ENCODED, AND THAT IS NOT TIDINESS.

    `core.autocrlf=true` with no `.gitattributes`: a plain-text fixture
    committed with LF comes back as CRLF on the next checkout, so this control
    would compare a CRLF file against an LF prompt and fail on every fresh
    clone — a guard failing for a reason that has nothing to do with what it
    guards. Inside a JSON string every newline is an escape on one physical
    line, which line-ending translation cannot reach.
  */
  const fixture = (mode: "classify" | "edit"): string =>
    JSON.parse(readFileSync(`server/castingV2/__fixtures__/refinePrompt.${mode}.before.json`, "utf8")) as string;

  for (const mode of ["classify", "edit"] as const) {
    it(`is byte-identical for mode ${mode}`, () => {
      const before = fixture(mode);
      expect(before).not.toContain("\r");
      expect(refineParseSystemPrompt(mode)).toBe(before);
      expect(refineParseSystemPrompt(mode, { openLane: false })).toBe(before);
    });
  }

  it("and the fixture is not vacuous — the ON prompt differs from it", () => {
    /* Without this the arms above would pass against an empty file, or against
       a prompt the flag never changes. The control is the whole point. */
    const before = fixture("classify");
    expect(before.length).toBeGreaterThan(5_000);
    expect(refineParseSystemPrompt("classify", { openLane: true })).not.toBe(before);
  });
});

describe("the clause lands in BOTH halves when the flag is on", () => {
  const on = refineParseSystemPrompt("classify", { openLane: true });
  const off = refineParseSystemPrompt("classify");

  it("adds the last resort, and only when on", () => {
    expect(on).toContain("WHEN NO SUBJECT ABOVE IS ABOUT IT");
    expect(on).toContain("THE KEY IS THE THING");
    expect(off).not.toContain("WHEN NO SUBJECT ABOVE IS ABOUT IT");
  });

  it("keeps the lane a FALLBACK rather than a peer — the sentence §2 turns on", () => {
    expect(on).toContain("ALWAYS");
    expect(on).toContain("wins and stays the answer");
  });

  it("SWAPS the fantastical-anatomy routing away from the stage wall", () => {
    /*
      The half that is not additive. With the lane shut this block sends horns
      to the stage wall, and the wall check returns before the acceptance door —
      so leaving it would make the addition above inert for exactly the
      population the lane exists for.
    */
    expect(off).toContain('Reply {"wall": "stage", "asked": "<the thing, in their words>"}');
    expect(on).not.toContain('Reply {"wall": "stage", "asked": "<the thing, in their words>"}');
    expect(on).toContain("They take the LAST RESORT at the end of the free-lane rules");
  });

  it("widens what may be NAMED and nothing else — wall (b) is restated, not relaxed", () => {
    expect(on).toContain("garments, headwear, the backdrop, props and the scene are the stage wall");
    /* The stage wall's own line is untouched by the clause. */
    expect(on).toContain('stage: garments, headwear, the backdrop, props, the scene');
  });
});

describe("the acceptance door is behind the flag too, not only the prompt", () => {
  it("files NOTHING for an unknown key when the lane is off — and never asks the normalizer", async () => {
    /*
      A reply naming an unknown key arrives with the flag OFF. Before this gate
      the door would have run, spent a normalizer call and filed `open:fangs`
      for every user of a product whose casting scope is `all`.

      Counted by WHICH question was asked rather than by how many: an unread
      delta is re-sampled, so the call count is three either way and would have
      hidden the door running inside it.
    */
    const engine = scripted([NAMES_A_NEW_KIND, NORMALIZED]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });
    expect(parse.ok).toBe(false);
    expect(engine.seen.some((request) => request.system === OPEN_KIND_SYSTEM)).toBe(false);
  });

  it("and §2's defect stays closed with the lane off — the facets beside it survive", async () => {
    /*
      The whole-delta null was the standing defect: one unknown noun discarded
      every facet in the same instruction. Step 5a closed it at the live
      boundary, and the gate must not reopen it — the subject is still RECORDED
      and skipped, and the mark she also asked for still files.
    */
    const both = JSON.stringify({
      intent: "edit",
      free: { fangs: "vampire fangs", marks: ["a small scar on her cheek"] },
    });
    const engine = scripted([both, NORMALIZED]);
    const parse = await interpretRefinement({
      instruction: "give her vampire fangs and a small scar on her cheek",
      engine,
      ...FACE,
    });
    expect(parse.ok).toBe(true);
    if (!parse.ok || !("delta" in parse)) throw new Error("expected a delta");
    expect(parse.delta.free?.marks).toEqual(["a small scar on her cheek"]);
    expect(parse.delta.open).toBeUndefined();
    expect(engine.seen.some((request) => request.system === OPEN_KIND_SYSTEM)).toBe(false);
  });

  it("files the open kind when the lane is on", async () => {
    const engine = scripted([NAMES_A_NEW_KIND, NORMALIZED]);
    const parse = await interpretRefinement({ instruction: HIS, engine, openLane: true, ...FACE });
    expect(parse.ok).toBe(true);
    if (!parse.ok || !("delta" in parse)) throw new Error("expected a delta");
    expect(parse.delta.open?.fangs).toEqual({ noun: "fangs", words: "vampire fangs" });
    /*
      THREE CALLS, AND THE THIRD IS 5b's PROPERTY READ — the parse, the
      normalizer, and *what is this kind* (`OPEN_KIND_PROPERTIES_DESIGN` §2).
      Named rather than counted, because a number alone would not notice a third
      call arriving from somewhere else.

      **This is the NO-STORE count.** With no database the property cache can
      never hit, so every ask re-buys the read; in production the row is written
      on the first ask for a noun and every later one is a table read, which is
      two calls. The cache itself is asserted at its own seam in
      `openKindProperties.test.ts`, by counting model calls rather than by
      inspecting a return value.
    */
    expect(engine.seen).toHaveLength(3);
    expect(engine.seen[1]!.system).toBe(OPEN_KIND_SYSTEM);
    expect(engine.seen[2]!.system).toBe(KIND_PROPERTY_SYSTEM);
  });

  it("sends the clause on the wire when on, and never when off", async () => {
    /* Assert at the wire: the flag's whole visible effect on a live call is the
       system string, and a contract about what is SENT is proven on the request. */
    const offEngine = scripted([NAMES_A_NEW_KIND, NORMALIZED]);
    await interpretRefinement({ instruction: HIS, engine: offEngine, ...FACE });
    expect(offEngine.seen[0]!.system).not.toContain("WHEN NO SUBJECT ABOVE IS ABOUT IT");

    const onEngine = scripted([NAMES_A_NEW_KIND, NORMALIZED]);
    await interpretRefinement({ instruction: HIS, engine: onEngine, openLane: true, ...FACE });
    expect(onEngine.seen[0]!.system).toContain("WHEN NO SUBJECT ABOVE IS ABOUT IT");
  });
});

describe("CASTING_OPEN_LANE_SCOPE — the parent is the REPAINT scope, and that is the finding", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env[CASTING_OPEN_LANE_SCOPE_ENV] = saved[CASTING_OPEN_LANE_SCOPE_ENV];
    process.env.CASTING_REPAINT_SCOPE = saved.CASTING_REPAINT_SCOPE;
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = saved.CASTING_REFERENCE_LIBRARY_SCOPE;
    process.env.CASTING_V2_SCOPE = saved.CASTING_V2_SCOPE;
  });

  it("is off when unset, and off is always valid", () => {
    expect(validateCastingOpenLaneEnvironment({ scope: undefined, repaintScope: undefined }).kind).toBe("off");
    expect(validateCastingOpenLaneEnvironment({ scope: "off", repaintScope: "off" }).kind).toBe("off");
  });

  it("REFUSES TO BOOT when the repaint road is off — the wall-(d) reason, in the error", () => {
    /*
      The paste road composes its prompt from `readDelta(variant.deltas)`, which
      drops `open` by construction. A paste-road user armed here would be charged
      for a render whose prompt never mentioned their ask.
    */
    expect(() => validateCastingOpenLaneEnvironment({ scope: "users:1", repaintScope: "off" }))
      .toThrow(/CASTING_REPAINT_SCOPE is off/);
  });

  it("refuses a user the repaint road does not carry", () => {
    expect(() => validateCastingOpenLaneEnvironment({ scope: "users:1,7", repaintScope: "users:1" }))
      .toThrow(/names users outside CASTING_REPAINT_SCOPE: 7/);
  });

  it("refuses `all` over a limited parent, and admits a covered user", () => {
    expect(() => validateCastingOpenLaneEnvironment({ scope: "all", repaintScope: "users:1" }))
      .toThrow(/cannot be "all"/);
    expect(validateCastingOpenLaneEnvironment({ scope: "users:1", repaintScope: "users:1" }).kind).toBe("users");
  });

  it("refuses a scope it cannot parse", () => {
    expect(() => validateCastingOpenLaneEnvironment({ scope: "users:", repaintScope: "all" }))
      .toThrow(/must be "off", "all", or "users:"/);
  });

  it("ANDs the whole chain where it is USED, not only at boot", () => {
    /* A boot check nobody invoked is the second way a flag pair goes wrong, so
       the runtime predicate re-asks the parent rather than trusting startup. */
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "users:1";
    process.env.CASTING_REPAINT_SCOPE = "users:1";
    process.env[CASTING_OPEN_LANE_SCOPE_ENV] = "users:1,2";
    expect(captureCastingOpenLaneEnabled(1)).toBe(true);
    /* User 2 is named here and NOT on the repaint road — the runtime AND is what
       stops them, and this is the arm that would go quiet if it were dropped. */
    expect(captureCastingOpenLaneEnabled(2)).toBe(false);

    process.env[CASTING_OPEN_LANE_SCOPE_ENV] = "off";
    expect(captureCastingOpenLaneEnabled(1)).toBe(false);
  });
});

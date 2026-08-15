/**
 * THE PRIOR-CONTEXT DOOR — an UNBACKED stage wall re-read without her filed
 * items (opus-481 / fable-639).
 *
 * # The defect these drive
 *
 * *"Refining can't do vampire fangs yet — it isn't one of the things this can
 * name"*, said about a capability the product has and the founder has a render
 * of. Measured on the live transport, first-read stage claims on the same face
 * and the same sentence, n=120 and n=90 interleaved:
 *
 * ```
 * nothing at all                     0%
 * + her five filed properties       39%     <- a SUBSET
 * + the accessories line            17%     <- its SUPERSET
 * + facets and the colour line      11%
 * the live service input             7.5%   (2-3% survive to the customer)
 * ```
 *
 * It RISES and then FALLS as context is added, so the cause is the composition
 * of the list rather than any line in it — which is why the cure withholds the
 * whole prior rather than a line of it.
 *
 * # WHY THEY ARE DRIVEN AND NOT PROBED
 *
 * Working law 3. Every engine here is scripted: the claim is made on demand,
 * including the re-claim that a real model produces on its own schedule, and
 * the assertions are on the outgoing request and the returned parse.
 *
 * The paid measurements live beside them and are cited rather than repeated:
 * `output/stage-pressure/pressure-sequential.json` and the interleaved re-run.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement } from "./refineInterpreter";

const STAGE = JSON.stringify({ wall: "stage", asked: "vampire fangs" });
const FILED = JSON.stringify({ intent: "edit", free: { teeth: "vampire fangs" } });

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
      return {
        text: reply,
        provenance: { provider: "openrouter" as const, model: "scripted" },
        latencyMs: 0,
      };
    },
  } as TextEngine & { seen: TextRequest[] };
}

const FACE = {
  currentEyeColour: "near-black",
  currentEyeShape: null,
  currentHairColour: "copper",
  currentHairStyle: "ponytail",
  currentHairTexture: "wavy",
  currentMakeup: null,
};
/* Her filed items, as the recorder captured them off the real service. */
const PRIOR = {
  marks: ["freckles"],
  statedAccessories: ["round tortoiseshell glasses"],
  hairCut: ["ponytail"],
  hairShade: ["copper"],
  hairPattern: ["wavy"],
  eyeColourFree: ["near-black"],
};
const ASK = "give her vampire fangs";
const FILED_LINE = "Currently filed under";

describe("the prior-context door", () => {
  it("(a) rescues an EDIT after an unbacked stage wall survives its re-look", async () => {
    /* Three calls: the read, fable-363's re-look, and this door's re-read. */
    const engine = scripted([STAGE, STAGE, FILED]);
    const parse = await interpretRefinement({ instruction: ASK, engine, ...FACE, prior: PRIOR });

    expect(parse.ok).toBe(true);
    expect(engine.seen).toHaveLength(3);
    /* ASSERTED AT THE WIRE, both ways: her filed items ride the first two
       requests and are absent from the third. */
    expect(engine.seen[0]!.user).toContain(FILED_LINE);
    expect(engine.seen[1]!.user).toContain(FILED_LINE);
    expect(engine.seen[2]!.user).not.toContain(FILED_LINE);
    /* And nothing else left with them — her current values are still there. */
    expect(engine.seen[2]!.user).toContain("Current hair colour: copper");
    expect(engine.seen[2]!.user).toContain(`Instruction: ${ASK}`);
  });

  it("(b) does NOT rescue a REMOVAL — D-173's referent lives in the lines it withholds", async () => {
    /*
      The one that would trade a false refusal for a wrong edit: read without
      the prior, "take her glasses off" can resolve no stored item, so a rescue
      here would prune against nothing. Driven, not assumed.
    */
    const removal = JSON.stringify({ remove: { subject: "statedAccessories", match: "her glasses" } });
    const engine = scripted([STAGE, STAGE, removal]);
    const parse = await interpretRefinement({
      instruction: "take her glasses off", engine, ...FACE, prior: PRIOR,
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
    expect(parse.ok === false && parse.door).toBe("upheld");
  });

  it("(c) is never reached by a genuine stage ask — the lexicon settles those in ONE call", async () => {
    const engine = scripted([STAGE, FILED, FILED]);
    const parse = await interpretRefinement({
      instruction: "put her in a long black coat", engine, ...FACE, prior: PRIOR,
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
    /* One call, and a scripted engine that WOULD have filed on its second and
       third replies is what makes that assertion mean something. */
    expect(engine.seen).toHaveLength(1);
    expect(parse.ok === false && parse.door).toBeUndefined();
  });

  it("(d) falls back to the refusal when the value NEEDED the prior to pass containment", async () => {
    /*
      D-171's restatement case, and the reason withholding is safe rather than
      merely narrow: a plural subject restates its whole set, so its value
      legitimately carries words from earlier sentences — and containment allows
      that ONLY because the prior is shown. Withheld, the same value fails
      containment, the re-read is not ok, and the original stage refusal stands.
      Worst case is exactly today's behaviour.
    */
    const restated = JSON.stringify({
      intent: "edit",
      free: { statedAccessories: "round tortoiseshell glasses and small gold hoops" },
    });
    const engine = scripted([STAGE, STAGE, restated, restated, restated, restated]);
    const parse = await interpretRefinement({
      instruction: "give her vampire fangs", engine, ...FACE, prior: PRIOR,
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
  });

  it("does not fire when there is nothing filed to withhold", async () => {
    const engine = scripted([STAGE, STAGE, FILED]);
    const parse = await interpretRefinement({ instruction: ASK, engine, ...FACE });

    expect(parse.ok).toBe(false);
    /* Two calls — the read and fable-363's re-look — and no third. */
    expect(engine.seen).toHaveLength(2);
  });

  it("withholds exactly ONCE — and the ceiling is four calls, not a loop", async () => {
    const engine = scripted([STAGE]);
    const parse = await interpretRefinement({ instruction: ASK, engine, ...FACE, prior: PRIOR });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
    /*
      FOUR, and the fourth is worth naming rather than trimming: the read,
      fable-363's re-look, this door's re-read — and that re-read claims the
      stage wall on its own account, so it buys its OWN re-look. It is not a
      second withholding (`priorWithheld` forbids that and the door is applied
      once, at the top, never inside the recursion), and it is not a loop: this
      engine claims the wall on every reply and the whole thing terminates at
      four.

      The alternative was to set `stageRelook` on the re-read to suppress it —
      rejected, because that also appends the re-look's constraint to the system
      prompt, and a door that changes two things at once cannot say which one
      served. Four free calls on a path that was refusing for nothing is the
      cheaper mistake.
    */
    expect(engine.seen).toHaveLength(4);
  });

  it("leaves a BACKED stage wall alone even with a prior to withhold — the negative control", async () => {
    /* Without this, a door that ignored `backed` would pass every test above
       and quietly re-ask genuine wardrobe refusals. */
    const engine = scripted([JSON.stringify({ wall: "stage", asked: "a coat" }), FILED]);
    const parse = await interpretRefinement({
      instruction: "put her in a long black coat", engine, ...FACE, prior: PRIOR,
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason === "wall_stage" && parse.refusal.backed).toBe(true);
    expect(engine.seen).toHaveLength(1);
  });
});

describe("(e) the tally counts this door at its own wall", () => {
  it("stamps a rescue with wall_stage", async () => {
    const engine = scripted([STAGE, STAGE, FILED]);
    const parse = await interpretRefinement({ instruction: ASK, engine, ...FACE, prior: PRIOR });

    expect(parse.ok && "door" in parse && parse.door).toBe("rescued");
    expect(parse.ok && "doorAt" in parse && parse.doorAt).toBe("wall_stage");
  });

  it("stamps an upheld refusal with wall_stage", async () => {
    const engine = scripted([STAGE]);
    const parse = await interpretRefinement({ instruction: ASK, engine, ...FACE, prior: PRIOR });

    expect(parse.ok === false && parse.door).toBe("upheld");
    expect(parse.ok === false && parse.doorAt).toBe("wall_stage");
  });

  it("does not relabel the COLOUR door's outcomes — three doors, three names", async () => {
    /* The control that stops one label swallowing the others, kept pointed the
       same way it was when the second door arrived. */
    const engine = scripted([JSON.stringify({ wall: "content" }), FILED]);
    const parse = await interpretRefinement({
      instruction: ASK, engine, ...FACE, prior: PRIOR, lastColourFacet: "the hair",
    });

    expect(parse.ok && "doorAt" in parse && parse.doorAt).toBe("wall_content");
  });
});

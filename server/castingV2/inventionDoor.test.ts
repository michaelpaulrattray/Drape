import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement } from "./refineInterpreter";

/**
 * THE GUARD POLICES WORDS; THE HARM IS INVENTED FACTS (fable-494/495).
 *
 * The founder typed *"give her a harry potter LIGHTING bolt scar on her
 * forehead"*. The model repaired his typo to "lightning" and containment read
 * the repair as a word he never said — the fifth incident of the same class,
 * after an apostrophe, a morphology, a prior-stated item and a plural
 * restatement the product itself had instructed.
 *
 * Replayed through the real parse before anything was built
 * (`probe-containment-scar-disposable`, four samplings each): his sentence
 * refused 4/4; the same sentence spelled correctly filed 4/4 WITH the brand
 * still in it. So the reference was never the trigger — one character was.
 *
 * These arms are scripted, because the arm that matters is the one a real model
 * will not perform on demand: **a value that genuinely invents must still be
 * refused**, and a door tested only through a well-behaved model is untested
 * (law 3).
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

/** His sentence, and the reading that repairs his spelling. */
const HIS = "give her a harry potter lighting bolt scar on her forehead";
const REPAIRED = JSON.stringify({
  intent: "edit",
  free: { marks: "a lightning bolt scar on her forehead" },
});

/*
  The parse runs once, the echo pass runs twice, then the invention question is
  asked, then — when it clears — the reading is taken again with the value
  vouched. Five replies, in that order.
*/
const asksNothing = JSON.stringify({ invents: false, fact: null });
const invents = JSON.stringify({ invents: true, fact: "a bar fight" });

describe("a repair of their own word is theirs", () => {
  it("files the value once the door says it asserts nothing of its own", async () => {
    const engine = scripted([REPAIRED, REPAIRED, REPAIRED, asksNothing, REPAIRED]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });

    expect(parse.ok).toBe(true);
    expect(parse.ok && "delta" in parse && parse.delta.free?.marks)
      .toEqual(["a lightning bolt scar on her forehead"]);
    /* Five calls: the parse, two echo passes, the question, the vouched read. */
    expect(engine.seen).toHaveLength(5);
    /* And the question is asked about the value, with their sentence beside
       it — asserted at the wire, not on a constant near it. */
    expect(engine.seen[3]!.system).toContain("does that value assert any FACT that is not theirs"
      .replace("does that value assert", "Answer whether that value asserts"));
    expect(engine.seen[3]!.user).toContain(HIS);
    expect(engine.seen[3]!.user).toContain("a lightning bolt scar on her forehead");
  });

  it("REFUSES when the door says the value invents — the arm that matters", async () => {
    const engine = scripted([REPAIRED, REPAIRED, REPAIRED, invents]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });

    expect(parse.ok).toBe(false);
    expect(!parse.ok && parse.refusal.reason).toBe("wall_unfileable");
    /* Four calls: nothing was re-read, because nothing was vouched. */
    expect(engine.seen).toHaveLength(4);
  });

  it("refuses when the door cannot be read at all", async () => {
    /* An unreadable verdict may not become a licence: the free refusal was
       already the answer. */
    const engine = scripted([REPAIRED, REPAIRED, REPAIRED, "not json at all"]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });
    expect(parse.ok).toBe(false);
  });

  it("refuses when the verdict is not the shape it must be", async () => {
    const engine = scripted([REPAIRED, REPAIRED, REPAIRED, JSON.stringify({ fact: null })]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });
    expect(parse.ok).toBe(false);
  });

  it("vouches ONE value and no other", async () => {
    /*
      The vouching is exact on the subject AND the words. A re-read that files
      something else — even in the same subject — meets containment unchanged,
      which is what stops one cleared value becoming a cleared lane.
    */
    const somethingElse = JSON.stringify({
      intent: "edit",
      free: { marks: "a long knife scar from a bar fight" },
    });
    const engine = scripted([REPAIRED, REPAIRED, REPAIRED, asksNothing, somethingElse]);
    const parse = await interpretRefinement({ instruction: HIS, engine, ...FACE });
    expect(parse.ok).toBe(false);
  });

  it("does not ask twice on the vouched reading", async () => {
    /* The door is closed to itself: a vouched input returns the refusal rather
       than buying a second question, so a loop is unreachable. */
    const engine = scripted([REPAIRED, REPAIRED, REPAIRED, asksNothing, REPAIRED]);
    await interpretRefinement({ instruction: HIS, engine, ...FACE });
    const questions = engine.seen.filter((request) => request.system?.includes("You are checking ONE thing"));
    expect(questions).toHaveLength(1);
  });
});

describe("what the door does not touch", () => {
  it("leaves every other wall exactly where it was", async () => {
    /* A stage refusal is not a containment failure, so the door never runs and
       the reply is the refusal the wall gave. */
    const engine = scripted([JSON.stringify({ wall: "stage", asked: "the backdrop" })]);
    const parse = await interpretRefinement({
      instruction: "change the backdrop to a red studio wall",
      engine,
      ...FACE,
    });
    expect(parse.ok).toBe(false);
    expect(!parse.ok && parse.refusal.reason).toBe("wall_stage");
    /* One call. No question was bought for a wall that is not this one's. */
    expect(engine.seen).toHaveLength(1);
  });

  it("never runs when containment passed in the first place", async () => {
    const engine = scripted([JSON.stringify({ intent: "edit", free: { marks: "a scar" } })]);
    const parse = await interpretRefinement({ instruction: "give her a scar", engine, ...FACE });
    expect(parse.ok).toBe(true);
    expect(engine.seen).toHaveLength(1);
  });
});

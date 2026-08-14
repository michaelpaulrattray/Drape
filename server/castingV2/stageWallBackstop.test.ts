/**
 * THE CODE DECIDES, THE MODEL PROPOSES — the stage wall's backstop
 * (fable-363 ruling 1, D-181's shape).
 *
 * # The defect these drive
 *
 * `wall_stage` was the one refusal in the interpreter nothing but the model
 * itself justified. `wall_likeness` is re-asked with the comparison settled;
 * `wall_content` is a policy answer and policy may be the model's; `wall_stage`
 * was taken on trust — while `readDelta` owns a real stage instrument
 * (`STAGE_WORDS`) that never ran on this path, because a wall reply carries no
 * delta to run it on.
 *
 * Measured on the real transport, *"make her albino"* — a sentence containing
 * not one stage word — hit that wall **4 times in 5** and filed correctly the
 * fifth. A coin-flip wall is a customer typing the same three words twice and
 * getting a different product each time, which this file's own header already
 * calls blocking.
 *
 * # WHY THEY ARE DRIVEN AND NOT PROBED
 *
 * Working law 3: a backstop tested only through an LLM that usually behaves is
 * untested. Every engine here is scripted, so the wall is claimed **on demand**
 * — including the case a real model produces rarely — and the assertions are on
 * the outgoing requests and the returned parse, never on a mood.
 *
 * The paid measurements live beside them and are cited, not repeated:
 * `output/stage-wall-verify/probe.txt` (n=5 per sentence, real transport).
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { stageWordIn } from "./refineDelta";

const FILED = JSON.stringify({ intent: "edit", eyeShape: "fox eyes" });
const WALL = JSON.stringify({ wall: "stage", asked: "her age" });

/** An engine that records every request and replies from a script. */
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
  currentEyeColour: "brown",
  currentEyeShape: "almond",
  currentHairColour: "dark brown",
  currentHairStyle: "long, worn down",
  currentHairTexture: "straight",
  currentMakeup: null,
};

describe("stageWordIn — the lexicon that can back a refusal and never disprove one", () => {
  it("names the offending word for a scene, a garment and a prop", () => {
    expect(stageWordIn("change the backdrop to a red studio wall")).toBe("backdrop");
    expect(stageWordIn("put her in a long black coat")).toBe("coat");
    expect(stageWordIn("have her holding a coffee cup")).toBe("holding");
  });

  it("finds nothing in a person ask — which is UNBACKED, not disproven", () => {
    expect(stageWordIn("make her albino")).toBeNull();
    expect(stageWordIn("give her freckles across her nose")).toBeNull();
    /* The honest limit, stated as a test so nobody reads a null as a licence:
       a finite lexicon has no `beach` in it and never will. */
    expect(stageWordIn("put her on a beach")).toBeNull();
  });

  it("carries D-160's accessory carve-out, and does not let it shelter a garment", () => {
    /* "Wearing" is how anyone describes an earring, and it is exempt in
       `readDelta` for exactly that reason. */
    expect(stageWordIn("wearing small gold hoops")).toBeNull();
    /* Every real garment ask names its garment too, so the carve-out costs
       nothing: the word that refuses this one is `coat`, not `wearing`. */
    expect(stageWordIn("wearing a long red coat")).toBe("coat");
  });

  it("matches whole words only, so a stage word inside another word is not one", () => {
    /* `set` lives inside "sunset", `hat` inside "that" — a substring match here
       would refuse half the language. */
    expect(stageWordIn("soften the sunset glow on her cheek")).toBeNull();
    expect(stageWordIn("that smile, a little wider")).toBeNull();
  });
});

describe("the stage wall's backstop", () => {
  it("overrides an UNBACKED wall and serves the re-look's filing", async () => {
    const engine = scripted([WALL, FILED]);
    const parse = await interpretRefinement({ instruction: "make her albino", engine, ...FACE });

    expect(parse.ok).toBe(true);
    expect(engine.seen).toHaveLength(2);
    /* Asserted at the wire: the re-look's constraint rides the SECOND request
       and is absent from the first. */
    expect(engine.seen[0]!.system).not.toContain("THE CODE HAS CHECKED THEIR SENTENCE FOR SCENERY");
    expect(engine.seen[1]!.system).toContain("THE CODE HAS CHECKED THEIR SENTENCE FOR SCENERY");
  });

  it("answers a claim the VOCABULARY owns, by name, in the prompt it is actually sent", async () => {
    /*
      MEASURED, THE DAY HORNS WAS PROMOTED. Two phrasings filed 3/3 and *"add
      horns to her head"* claimed the stage wall 3/3 — through the re-look,
      which had already told it no scenery was found. The model was not being
      random: it reads "add X to her head" as putting a THING on a person, and
      nothing in the constraint said the product's own list owns that word.

      Driven rather than probed (law 3), and asserted at the WIRE: the sentence
      lives in a prompt or it does not exist. Derived from `closedSubjectFor`,
      so every kind promoted after horns inherits it without a line being
      written for it.
    */
    const engine = scripted([JSON.stringify({ wall: "stage", asked: "horns" }), FILED]);
    await interpretRefinement({ instruction: "add horns to her head", engine, ...FACE });

    expect(engine.seen).toHaveLength(2);
    const relook = engine.seen[1]!.system;
    expect(relook).toContain('THEIR WORD "horns" IS ONE OF THE SUBJECTS YOU MAY FILE');
    expect(relook).toContain("horns"); // the subject it names is the card's own key
    /* And the first request never carried it — this is a REPLY to a claim. */
    expect(engine.seen[0]!.system).not.toContain("IS ONE OF THE SUBJECTS YOU MAY FILE");
  });

  it("says NOTHING extra when the claimed word is not ours — the negative control", async () => {
    /*
      The other half, and the half that keeps the backstop honest: a sentence
      about a beach must not be told the vocabulary owns anything. Without this
      the constraint would be a general nudge toward filing, which is exactly
      what the test below forbids.
    */
    const engine = scripted([JSON.stringify({ wall: "stage", asked: "beach" }), FILED]);
    await interpretRefinement({ instruction: "put her on a beach", engine, ...FACE });

    expect(engine.seen[1]!.system).not.toContain("IS ONE OF THE SUBJECTS YOU MAY FILE");
  });

  it("does not tell the model the answer — the re-look asks for a justified reply either way", () => {
    const engine = scripted([WALL, FILED]);
    return interpretRefinement({ instruction: "make her albino", engine, ...FACE }).then(() => {
      const relook = engine.seen[1]!.system;
      /* A constraint that pushed toward filing would push "put her on a beach"
         — equally unbacked — into whichever facet would take its words. So the
         re-look must keep the refusal available and say so. */
      expect(relook).toContain('reply {"wall": "stage"}');
      expect(relook).toContain("Never file a");
    });
  });

  it("spends NO second call when the wall is BACKED — the code refuses deterministically", async () => {
    const engine = scripted([WALL, FILED]);
    const parse = await interpretRefinement({
      instruction: "change the backdrop to a red studio wall",
      engine,
      ...FACE,
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
    /* One call. The lexicon settled it before any money or latency was spent,
       and a scripted engine that WOULD have filed on its second reply is what
       makes this assertion mean something. */
    expect(engine.seen).toHaveLength(1);
  });

  it("stands when the re-look claims the wall again, and re-looks exactly once", async () => {
    const engine = scripted([WALL]);
    const parse = await interpretRefinement({ instruction: "make her albino", engine, ...FACE });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_stage");
    /* Two, not three and not forever: the re-look sets `stageRelook`, and the
       override is gated on its absence. The worst case is exactly the
       behaviour that shipped before this existed, plus one call. */
    expect(engine.seen).toHaveLength(2);
  });

  it("keeps the re-claimed word, so a STAGE_WORDS gap is evidence rather than a guess", async () => {
    const engine = scripted([WALL, JSON.stringify({ wall: "stage", asked: "a beach" })]);
    const parse = await interpretRefinement({ instruction: "put her on a beach", engine, ...FACE });

    expect(parse.ok).toBe(false);
    /* The word the model named on the re-look is what reaches the caller and
       the log — the audit trail fable-363 asked for, carried by the mechanism
       rather than by a promise. */
    const refusal = parse.ok === false ? parse.refusal : null;
    expect(refusal?.reason).toBe("wall_stage");
    expect(refusal?.reason === "wall_stage" && refusal.asked).toBe("a beach");
  });

  it("leaves the other two walls alone", async () => {
    const likeness = scripted([JSON.stringify({ wall: "likeness" }), JSON.stringify({ wall: "likeness" })]);
    const content = scripted([JSON.stringify({ wall: "content" })]);

    const one = await interpretRefinement({ instruction: "make her look like Rihanna", engine: likeness, ...FACE });
    const two = await interpretRefinement({ instruction: "something unsafe", engine: content, ...FACE });

    expect(one.ok === false && one.refusal.reason).toBe("wall_likeness");
    expect(two.ok === false && two.refusal.reason).toBe("wall_content");
    /* `wall_content` is a policy answer and takes exactly one call — the
       backstop is pointed at one wall, not bolted onto all three. */
    expect(content.seen).toHaveLength(1);
  });
});

/**
 * THE ANSWER THE LEXICON GAVE, CARRIED TO THE CUSTOMER (this shift's rider).
 *
 * `backing` has been computed on this path since fable-363 and reached a warn
 * line and nothing else. So an UNBACKED refusal was delivered in the BACKED
 * refusal's words — *"antlers is a garment, a prop or the set"* — which is not
 * a vague sentence, it is a false one, said to somebody who asked for something
 * growing out of her head.
 *
 * Driven through scripted engines for law 3's reason: the interesting case is
 * one a real model produces on its own schedule, and the paid measurement lives
 * beside these rather than inside them (`probe-horns-wall-disposable.mts`:
 * "give her horns" wall_content 3/3 BEFORE, wall_stage 3/3 AFTER, with the
 * antlers control unmoved at wall_stage 3/3).
 */
describe("a refusal the lexicon could not back says so", () => {
  it("marks a re-claimed wall UNBACKED", async () => {
    const engine = scripted([WALL, JSON.stringify({ wall: "stage", asked: "antlers" })]);
    const parse = await interpretRefinement({ instruction: "give her antlers", engine, ...FACE });

    const refusal = parse.ok === false ? parse.refusal : null;
    expect(refusal?.reason).toBe("wall_stage");
    expect(refusal?.reason === "wall_stage" && refusal.backed).toBe(false);
  });

  it("marks a wall the lexicon DID back as backed — the positive control", async () => {
    /* Without this, `backed: false` everywhere would pass the test above and be
       exactly as wrong in the other direction. */
    const engine = scripted([JSON.stringify({ wall: "stage", asked: "a coat" })]);
    const parse = await interpretRefinement({ instruction: "put her in a long black coat", engine, ...FACE });

    const refusal = parse.ok === false ? parse.refusal : null;
    expect(refusal?.reason === "wall_stage" && refusal.backed).toBe(true);
    /* And it took ONE call: a backed claim is settled deterministically and
       never buys a re-look. */
    expect(engine.seen).toHaveLength(1);
  });

  it("tells the truth to the customer instead of naming a category it does not know", () => {
    const unbacked = refusalMessage({
      ok: false,
      refusal: { reason: "wall_stage", asked: "antlers", backed: false },
    });
    expect(unbacked).toContain("antlers");
    expect(unbacked).toContain("isn't one of the things this can name");
    /* THE FALSE SENTENCE, asserted absent. This is the whole finding. */
    expect(unbacked).not.toContain("a garment, a prop or the set");
    /* And it must not say the thing `wall_content`'s message says, which is
       what sent this rider here in the first place. */
    expect(unbacked.toLowerCase()).not.toContain("can't be rendered.");
    expect(unbacked).toContain("Nothing was charged");
  });

  it("still says the D-160 sentence when the wall IS about the shoot", () => {
    const backed = refusalMessage({
      ok: false,
      refusal: { reason: "wall_stage", asked: "a coat", backed: true },
    });
    expect(backed).toContain("a garment, a prop or the set");
    /* Jewellery is named as working, which is the D-160 repair itself and must
       survive this edit. */
    expect(backed).toContain("Jewellery");
  });

  it("reads a refusal written before the field existed as BACKED", () => {
    /* Absent means backed: every stored refusal predating this came from a
       matched stage word, and a missing field must not silently rewrite old
       copy into the new sentence. */
    const legacy = refusalMessage({ ok: false, refusal: { reason: "wall_stage", asked: "a coat" } });
    expect(legacy).toContain("a garment, a prop or the set");
  });
});

describe("the content wall's carve-out for fantastical anatomy", () => {
  it("tells the model, in the prompt it is actually sent", async () => {
    /* ASSERT AT THE WIRE. A prompt sentence written in a constant nobody sends
       is the inert-on-arrival class, and this shift has already found one. */
    const engine = scripted([FILED]);
    await interpretRefinement({ instruction: "give her horns", engine, ...FACE });
    const system = engine.seen[0]!.system;
    expect(system).toContain("NOR IS FANTASTICAL ANATOMY");
    expect(system).toContain("Horns, antlers, wings, a tail, scales, pointed ears");
    /* The neighbour it was modelled on must survive beside it. */
    expect(system).toContain("A BODY TATTOO IS NEVER THIS WALL");
  });
});

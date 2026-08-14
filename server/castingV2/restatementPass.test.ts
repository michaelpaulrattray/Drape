/**
 * THE RESTATEMENT PASS, AT THE WIRE — fable-460.
 *
 * The service asks for one more reading when the first came back holding only
 * what she already is, and it asks by setting `restated`. This proves the flag
 * actually changes the OUTGOING request — the half a service test cannot see,
 * since it stops at the interpreter's door.
 *
 * Scripted, never probed: the constraint has to be provable on demand, not on
 * the day a real model happens to lose a sentence (law 3).
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement } from "./refineInterpreter";

const FILED = JSON.stringify({ intent: "edit", eyeColour: "green" });

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

const MARKER = "YOUR LAST READING OF THIS SENTENCE FILED ONLY WHAT SHE ALREADY IS";

describe("the restatement constraint rides the request, and only when asked for", () => {
  it("is absent from an ordinary reading", async () => {
    const engine = scripted([FILED]);
    await interpretRefinement({ instruction: "her eyes meadow green", engine, ...FACE });
    expect(engine.seen).toHaveLength(1);
    expect(engine.seen[0]!.system).not.toContain(MARKER);
  });

  it("is present when the service asks again", async () => {
    const engine = scripted([FILED]);
    await interpretRefinement({
      instruction: "her eyes meadow green",
      engine,
      restated: true,
      ...FACE,
    });
    expect(engine.seen).toHaveLength(1);
    expect(engine.seen[0]!.system).toContain(MARKER);
  });

  /*
    AND IT DOES NOT TELL THE MODEL THE ANSWER. The same discipline the stage
    re-look was built with: a constraint that said "this is a real change, file
    it" would push a genuine no-op — someone asking for the colour she already
    has — into a paid render of nothing. The line has to leave the restatement
    available as a correct answer, because sometimes it IS the correct answer,
    and the door refuses on the second one.
  */
  it("leaves the restatement available as an answer", async () => {
    const engine = scripted([FILED]);
    await interpretRefinement({
      instruction: "her eyes meadow green",
      engine,
      restated: true,
      ...FACE,
    });
    const system = engine.seen[0]!.system ?? "";
    /* THE CONSTRAINT'S OWN BLOCK, not the whole prompt: the base prompt has
       plenty to say about restating, and reading the negative over all of it
       would be a reader that fails on someone else's sentence. */
    const at = system.indexOf(MARKER);
    expect(at).toBeGreaterThan(-1);
    const block = system.slice(at);
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("that answer is correct and the code handles it");
    expect(block).not.toMatch(/this is a real change|file it anyway|never restate/i);
  });
});

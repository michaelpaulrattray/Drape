import { describe, expect, it, vi } from "vitest";

/**
 * The feature with the switch held ON — because a feature that ships off with no
 * proof it works is a feature nobody can safely turn on.
 *
 * `PARTIAL_DEFERENCE_ENABLED` is a code constant (the founder's ruling: no new
 * env flag), so the only honest way to exercise the enabled path in CI is to
 * mock the constant. Everything else is real — the real gate, the real compiler,
 * the real composer.
 *
 * These are the founder's own bars from D-79 and the golden file, asserted at
 * the PROMPT layer where they can be checked deterministically. The image-layer
 * halves belong to the live harness (condition 4) and are named in each test so
 * the split is explicit rather than implied.
 */
vi.mock("./stylingResolution", async () => {
  const actual = await vi.importActual<typeof import("./stylingResolution")>("./stylingResolution");
  return { ...actual, PARTIAL_DEFERENCE_ENABLED: true };
});

const { castingBriefCompiler } = await import("./briefCompiler");
type TextEngine = import("../providers/types").TextEngine;

function engine(intent: Record<string, unknown>): TextEngine {
  return {
    id: "stub",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", ...intent }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

type Sheet = {
  candidates: Array<{
    prompt: string;
    resolvedIdentity: { realized: { hairStyle: { name: string } | null }; hair: { colour: string } | null };
  }>;
};

async function sheet(briefText: string, intent: Record<string, unknown>, seed: string) {
  return (await castingBriefCompiler({
    briefText,
    candidateCount: 8,
    rollSeed: seed,
    engine: engine(intent),
  } as never)) as unknown as Sheet;
}

function hairLine(prompt: string): string {
  const match = /(^|[^A-Z])\sHAIR:/.exec(prompt);
  if (!match) return "";
  const start = match.index + match[1].length;
  const rest = prompt.slice(start + 1);
  const end = rest.search(/\n| EYE COLOUR:| FACIAL HAIR:| BROW CHARACTER:| SKIN CHARACTER:/);
  return end < 0 ? rest : rest.slice(0, end);
}

describe("the gothic bogan — the golden that pinned this gap", () => {
  /*
    "a gothic male heavy metal bogan with a long beard and long hair in his
    mid 20s". Stating a LENGTH silenced the whole colour axis too, so the goth
    prior filled it and the sheet came back uniformly black.

    Founder's bar: length and beard honoured 8/8, colour still AUTHORED —
    dark-leaning for the aesthetic but not uniform, so the sheet can produce its
    blonde goth. The image-layer half of that bar is the live harness's.
  */
  const brief = "a gothic male heavy metal bogan with a long beard and long hair in his mid 20s";
  const intent = {
    role: "heavy metal bogan",
    sex: "male",
    ageBand: "20s",
    agePhase: "mid",
    characterNotes: "long beard",
    statedHair: { cutLength: "long" },
  };

  it("honours the stated length on all eight, and authors nothing over it", async () => {
    const compiled = await sheet(brief, intent, "bogan-on");
    for (const candidate of compiled.candidates) {
      const line = hairLine(candidate.prompt);
      expect(line).toContain("long");
    }
  });

  it("keeps the COLOUR authored — the half full-axis deference was destroying", async () => {
    /*
      THE DISCRIMINATING ASSERTION. Today's shipped behaviour fails this: with
      the whole axis deferred there is no authored colour anywhere, so the bar
      cannot be satisfied by doing nothing. It is also the counter-case to a lazy
      implementation that honours the length by suppressing everything again.
    */
    const colours = new Set<string>();
    for (let seed = 0; seed < 12; seed += 1) {
      const compiled = await sheet(brief, intent, `bogan-colour-${seed}`);
      for (const candidate of compiled.candidates) {
        const colour = candidate.resolvedIdentity.hair?.colour;
        expect(colour, "a colour must be authored, not left to the goth prior").toBeTruthy();
        if (colour) colours.add(colour);
      }
    }
    // Not uniform. The founder's words: the sheet must be able to produce its
    // blonde goth rather than eight black-haired ones.
    expect(colours.size).toBeGreaterThan(1);
  });

  it("still varies the parts the brief left unsaid", async () => {
    /*
      The counter-case that stops "honour the length" being satisfied by
      collapsing to one repeated long look — which is the original complaint
      wearing a pass.
    */
    const compiled = await sheet(brief, intent, "bogan-variety");
    const lines = new Set(compiled.candidates.map((candidate) => hairLine(candidate.prompt)));
    expect(lines.size).toBeGreaterThan(2);
  });
});

describe("salt and pepper — greying is a process, never a shade", () => {
  const brief = "a photographer in his 50s with salt and pepper hair";
  const intent = {
    role: "photographer",
    sex: "male",
    ageBand: "50s",
    statedHair: { greying: true },
  };

  it("says the greying on all eight", async () => {
    const compiled = await sheet(brief, intent, "salt-on");
    for (const candidate of compiled.candidates) {
      /*
        Asserted on the RENDER rather than the word. The founder's finding was
        that the bare word rendered too subtly — about two tiles a sheet did not
        read as greying at all — so the D1-style expansion is the thing that has
        to reach the prompt, exactly as the iris and finish prose do.
      */
      expect(hairLine(candidate.prompt).toLowerCase()).toContain("steel-grey strands");
    }
  });

  it("leaves a real base colour underneath, and cuts still vary", async () => {
    /*
      THE COUNTER-CASE the founder's bar needs. An implementation that wrote
      colour = "salt and pepper" would null the base, render uniform grey, and
      still pass "greying honoured" — satisfying the letter while producing
      exactly the sheet the ruling exists to prevent.
    */
    const compiled = await sheet(brief, intent, "salt-base");
    const cuts = new Set<string>();
    for (const candidate of compiled.candidates) {
      expect(candidate.resolvedIdentity.hair?.colour).toBeTruthy();
      const name = candidate.resolvedIdentity.realized.hairStyle?.name;
      if (name) cuts.add(name);
    }
    expect(cuts.size).toBeGreaterThan(2);
  });
});

describe("the parts the brief did settle stay settled", () => {
  it("authors no colour when the brief named one", async () => {
    const compiled = await sheet(
      "a woman with pastel pink hair",
      { sex: "female", statedHair: { colour: "pastel pink" } },
      "pink-on",
    );
    for (const candidate of compiled.candidates) {
      const line = hairLine(candidate.prompt);
      expect(line).toContain("pastel pink");
      for (const authored of ["brown", "blonde", "auburn", "black", "chestnut"]) {
        expect(line, `authored ${authored} over a stated colour`).not.toContain(authored);
      }
    }
  });

  it("still says nothing at all for a coverage brief", async () => {
    // There is no cut on a bald man, and this is the founding bug of the
    // doctrine — it must not come back through the partial path.
    const compiled = await sheet(
      "runway model, early 20s, shaved head",
      { role: "runway model", ageBand: "20s", agePhase: "early" },
      "shaved-on",
    );
    for (const candidate of compiled.candidates) {
      expect(hairLine(candidate.prompt)).toBe("");
    }
  });
});

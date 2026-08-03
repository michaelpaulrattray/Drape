import { describe, expect, it } from "vitest";
import { coveringDirective, statedCovering } from "./statedCovering";
import { composeCandidatePrompt, resolveCandidateIdentity } from "./cohortPhotorealHuman";
import type { CastingIntent } from "./castingIntent";

describe("statedCovering — reads the user's own sentence, never a faith", () => {
  it("recognises a stated covering", () => {
    expect(statedCovering("a woman in her 30s wearing a hijab")?.word).toBe("hijab");
    expect(statedCovering("a man in a turban, 40s")?.word).toBe("turban");
    expect(statedCovering("she wears a niqab")?.word).toBe("niqab");
    expect(statedCovering("in a head scarf")?.word).toBe("head scarf");
  });

  /*
    The half that matters most. D-124's whole point is that the unstated case
    verified at zero of eight and must STAY there: inferring a covering from a
    faith, a name or a heritage is stereotype authoring, and it is the failure
    this channel must never introduce while fixing the other one.
  */
  it("never infers a covering from a faith, a heritage or a name", () => {
    expect(statedCovering("a Muslim woman in her 30s")).toBeNull();
    expect(statedCovering("a Sikh man, 40s, warm")).toBeNull();
    expect(statedCovering("an Orthodox Jewish man in his 50s")).toBeNull();
    expect(statedCovering("Fatima, 28, editorial")).toBeNull();
    expect(statedCovering("a woman of Pakistani heritage")).toBeNull();
  });

  it("matches whole words, so ordinary English is not a garment instruction", () => {
    expect(statedCovering("a hijabi influencer")).toBeNull();
    expect(statedCovering("turbaned")).toBeNull();
    expect(statedCovering("")).toBeNull();
    expect(statedCovering(null)).toBeNull();
  });

  it("speaks the user's own noun back, with the prose that says how it sits", () => {
    const directive = coveringDirective(statedCovering("wearing a hijab")!);
    expect(directive).toContain("wearing a hijab");
    expect(directive).toContain("COMPLETELY covered");
    /* The stated-fact licence shape, which is what gives every sibling teeth. */
    expect(directive).toContain("failed candidate");
    /* The founder's actual complaint: it read as fashion styling, not faith. */
    expect(directive).toContain("never a loosely draped fashion scarf");
  });
});

function promptFor(briefText: string, characterNotes: string | null = null): string {
  const intent = {
    cohort: "photoreal_human",
    role: null,
    characterNotes,
    sex: null,
    ageBand: null,
    agePhase: null,
    heritage: [],
    build: null,
    energy: null,
    archetype: null,
    variationAxis: null,
    look: null,
    reads: [],
  } as unknown as CastingIntent;
  return composeCandidatePrompt({
    briefText,
    intent,
    resolved: resolveCandidateIdentity(intent, 0, "covering"),
    archetype: "raw editorial",
    seed: 1,
  });
}

describe("the covering channel in the composed prompt", () => {
  it("puts the directive in the prompt when the brief states one", () => {
    const prompt = promptFor("a woman in her 30s wearing a hijab");
    expect(prompt).toContain("STATED COVERING:");
    expect(prompt).toContain("COMPLETELY covered");
  });

  /*
    The latent fragility D-124 names. The prompt bans hats and excludes headwear
    from the accessories licence, and the constant speaks LAST with authority —
    so without a carve-out the covering renders only by luck of routing. This is
    the assertion that makes the law hold because something guarantees it.
  */
  it("carves the covering out of the headwear and hat exclusions", () => {
    const prompt = promptFor("a woman in her 30s wearing a hijab");
    expect(prompt).toContain("no hats");
    expect(prompt).toContain("STATED COVERINGS are the ONE exception");
    expect(prompt).toContain("overrules every no-hats and no-headwear line");
  });

  it("says nothing at all when no covering was stated", () => {
    const prompt = promptFor("a Muslim woman in her 30s");
    expect(prompt).not.toContain("STATED COVERING:");
    /* The exclusions are untouched in the unstated case, which is the default. */
    expect(prompt).toContain("no hats");
  });

  /*
    A follow inherits characterNotes without the original sentence. Reading the
    same stated union every other deference check reads is what stops a covering
    falling off the family it was stated into.
  */
  it("survives into a follow, where the sentence is gone and the notes remain", () => {
    const prompt = promptFor("", "she wears a hijab, warm and direct");
    expect(prompt).toContain("STATED COVERING:");
  });
});

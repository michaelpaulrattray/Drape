/**
 * RE-IMAGINE (#535) — the visible writing assistant's own suite.
 *
 * Three populations: the LOCKED TRIO reader (text-only, closed surface
 * forms), the REFUSAL CHAIN (the roll guards plus the trio, minus the retired
 * `droppedFactIn`), and the PRESS itself driven by a misbehaving double
 * (working law 3: the backstop is driven directly, never through a model that
 * usually behaves).
 *
 * The fixtures are HIS: the war-built woman (the card's correction, judged at
 * his eye — rolls 244 vs 245, "10x better"), the pirate (his thin-seed worked
 * case), and the sphinx court's shape (243 vs 246 — locked adult feline
 * humanoid, colours dropped). A chain that refuses his own passing outputs
 * has broken the design, whatever else it catches.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { INTERPRET_TIMEOUT_MS } from "./interpreter";
import {
  lockedTrioOf,
  reimagineAllowance,
  reimagineBrief,
  reimagineRefusal,
  reimagineSystemPrompt,
  REIMAGINE_WORD_BUDGET,
  speciesGroupsIn,
  SPECIES_GROUPS,
} from "./reimagine";
import { countWords, neverWrittenIn } from "./promptAuthor";

/* His brief and his RIGHT output, verbatim from the card's correction. */
const WAR_BUILT_BRIEF =
  "Broad-shouldered woman, late 30s, deep scarring across a face otherwise unaugmented except for one detail: "
  + "a thick black collar of plating fused directly into the base of her neck and upper spine, seamless with the skin, "
  + "studded with three small red status lights that never turn off. Her right arm from the elbow down is matte grey "
  + "chrome, heavily scratched and dented, clearly old military-grade rather than cosmetic. Her left eye is human and "
  + "tired; her right is a narrow horizontal slit of red light with no visible mechanism, just a line of glow set into "
  + "the socket like a wound that healed wrong.";
const WAR_BUILT_RIGHT =
  "A woman in her late 30s who was built for a war and has outlived the reason for it. Broad through the shoulders, "
  + "a face that carries old damage and doesn't hide it. Her augmentation is military, not cosmetic: fused into her "
  + "rather than worn, plainly older than she is now, scarred and dented where it meets skin, still faintly alive with "
  + "the small lights and glows of a system nobody maintains. Her two eyes don't match, and the human one is the tired "
  + "one. Guarded, unhurried, done being surprised.";
const PIRATE_RIGHT =
  "A pirate long past the glamour of it: a sea-worn man in his fifties, sun-cracked, salt in everything, the kind who "
  + "has buried the crew he sailed with and kept their debts. Dressed in what a life at sea leaves you, nothing fine. "
  + "Quiet, watchful, dangerous when still.";

function engineAnswering(replies: (string | Error)[]): { engine: TextEngine; sent: TextRequest[] } {
  const sent: TextRequest[] = [];
  let calls = 0;
  const complete = vi.fn(async (request: TextRequest) => {
    sent.push(request);
    const answer = replies[calls] ?? "";
    calls += 1;
    if (answer instanceof Error) throw answer;
    return {
      text: answer,
      latencyMs: 7,
      provenance: { provider: "openrouter" as const, model: "stub-model", servedModel: "stub-model" },
    };
  });
  return { engine: { id: "stub", complete } as unknown as TextEngine, sent };
}

describe("the locked trio, read from the box's own text", () => {
  it("sex locks when exactly one sex's words appear, and never on ordinary prose about the other", () => {
    expect(lockedTrioOf("a goth woman, severe").sex).toBe("female");
    expect(lockedTrioOf("a sea-worn man in his fifties").sex).toBe("male");
    /* Both said — a fold changing sex, a couple — locks neither. */
    expect(lockedTrioOf("a man and a woman, side by side").sex).toBeNull();
    expect(lockedTrioOf("a woman in men's tailoring").sex).toBe("female");
    /* Nonbinary locks on its explicit words only — they/them/their is ordinary prose. */
    expect(lockedTrioOf("an androgynous presence").sex).toBe("nonbinary");
    expect(lockedTrioOf("a pirate, their coat heavy with salt").sex).toBeNull();
  });

  it("age is the box's own readable claims; species is a single named group", () => {
    expect(lockedTrioOf(WAR_BUILT_BRIEF).ageBands).toEqual(["30s"]);
    expect(lockedTrioOf("a pirate").ageBands).toEqual([]);
    /*
      A steer word that is DESCRIPTION does not empty the lock (review of PR
      #598, finding 1): these are among the most natural briefs the product
      gets, each types an age, and each must stay locked.
    */
    expect(lockedTrioOf("a young woman in her 20s, freckled").ageBands).toEqual(["20s"]);
    expect(lockedTrioOf("an aging punk in his 60s").ageBands).toEqual(["60s"]);
    expect(lockedTrioOf("a middle-aged woman in her 40s").ageBands).toEqual(["40s"]);
    expect(lockedTrioOf("an adult sphinx in ceremonial armour").species).toBe("feline");
    expect(lockedTrioOf("a portrait of a diver").species).toBeNull();
    /* Two groups named — a fold changing species says both — locks none. */
    expect(lockedTrioOf("a sphinx… actually make it a dragon").species).toBeNull();
  });

  it("the species floor is groups with surface forms, no bare common words, every group non-empty", () => {
    /* "cat-eye makeup" must not lock a species onto a human brief — no bare "cat" in the vocabulary. */
    expect(speciesGroupsIn("a woman with cat-eye makeup")).toEqual([]);
    expect(speciesGroupsIn("a sphinx")).toEqual(["feline"]);
    expect(speciesGroupsIn("an ogre chieftain")).toEqual(["ogre"]);
    for (const { group, words } of SPECIES_GROUPS) {
      expect(words.length, group).toBeGreaterThan(0);
      expect(words).not.toContain("cat");
    }
  });
});

describe("the refusal chain — the roll guards plus the trio, and his own outputs pass it", () => {
  const allow = (seed: string) => reimagineAllowance(seed);

  it("HIS PASSING OUTPUTS PASS: the war-built woman against her brief, the pirate against 'a pirate'", () => {
    expect(reimagineRefusal(WAR_BUILT_RIGHT, allow(WAR_BUILT_BRIEF), WAR_BUILT_BRIEF)).toBeNull();
    expect(reimagineRefusal(PIRATE_RIGHT, allow("a pirate"), "a pirate")).toBeNull();
  });

  it("a locked age cannot be moved by the author — and a stray band the box never claimed is named", () => {
    expect(reimagineRefusal("A woman in her 20s, built for a war.", 400, WAR_BUILT_BRIEF)).toContain("20s");
    /* Dropping a typed age entirely is the same failure by omission. */
    expect(reimagineRefusal("A woman built for a war, guarded and unhurried.", 400, WAR_BUILT_BRIEF)).toContain("dropped the stated age");
    /* An added youth word moves a stated 30s+ age (#252's floor). */
    expect(reimagineRefusal("A young woman in her late 30s, built for a war.", 400, WAR_BUILT_BRIEF)).toContain('"young"');
  });

  it("THE FOLD UNLOCKS WHAT THE CUSTOMER IS STEERING — an ageing instruction in the box is her change, not the author's", () => {
    /*
      Driven at the real entrance before this rule existed: "…in their 30s…
      make them older" was refused TWICE by the lock meant to protect her,
      and the press answered "nothing to offer" to her own instruction. A
      steering word in the box empties the age lock; she reads the result in
      her own editable box, which is the design's fidelity control.
    */
    const folded = "a fitness creator in her 30s, close-cropped hair. make her young";
    expect(lockedTrioOf(folded).ageBands).toEqual([]);
    expect(reimagineRefusal("A fitness creator in her early 20s, close-cropped and quick.", 400, folded)).toBeNull();
    const older = "a fitness creator in their 30s, close-cropped hair. make them older and give them a beard";
    expect(lockedTrioOf(older).ageBands).toEqual([]);
    expect(reimagineRefusal("A fitness creator in their 50s, grey at the temples, full beard.", 400, older)).toBeNull();
    /* "aged 52" is a CLAIM, not steering — the lock holds on the number it states. */
    expect(lockedTrioOf("a ballerina, aged 52").ageBands).toEqual(["50s"]);
    /* And a DESCRIPTIVE steer word beside a claim leaves the guard armed: the reviewer's own failure case. */
    expect(reimagineRefusal("A woman in her 50s, freckled and quick.", 400, "a young woman in her 20s, freckled"))
      .toContain("50s");
    /* ⚠ Declared limits, both directions: a bare-number instruction steers invisibly, and an instruction typed BEFORE the brief's own age with no imperative reads as description. */
    expect(reimagineRefusal("A fitness creator in her mid 40s.", 400, "a fitness creator in her 30s. make her 45"))
      .toContain("40s");
    expect(lockedTrioOf("younger please. a woman in her 30s").ageBands).toEqual(["30s"]);
  });

  it("a locked sex must keep being said; a locked species survives as its GROUP, so his sphinx→'feline humanoid' passes", () => {
    expect(reimagineRefusal("A guarded presence, built for a war and done being surprised.", 400, "a woman built for war"))
      .toContain("dropped the subject's sex");
    /* His second court's own shape: the brief said sphinx, the passing draft said feline humanoid. */
    expect(reimagineRefusal("Adult feline humanoid, sovereign and predatory, in dark structured armour.", 400, "an adult sphinx in ceremonial armour"))
      .toBeNull();
    /* A species swap is refused by name. */
    expect(reimagineRefusal("An adult dragon in ceremonial armour.", 400, "an adult sphinx in ceremonial armour"))
      .toContain("feline");
  });

  it("the allowance is short by design and never orders a long brief cut", () => {
    expect(reimagineAllowance("a pirate")).toBe(REIMAGINE_WORD_BUDGET);
    const long = Array.from({ length: 400 }, () => "word").join(" ");
    expect(reimagineAllowance(long)).toBe(400 + 40);
    expect(reimagineAllowance(long)).toBeGreaterThan(countWords(long));
  });
});

describe("the instruction", () => {
  const rules = reimagineSystemPrompt(220);

  it("carries his contract: the fold first, the one-line rule, the locked trio, the lighting BAN, short by design", () => {
    expect(rules).toContain("EDITING INSTRUCTION");
    expect(rules).toContain("never tacked onto the end");
    expect(rules).toContain("KEEP WHO THEY ASKED FOR; REINVENT WHAT THEY ARE MADE OF");
    expect(rules).toContain("SEX, AGE and SPECIES");
    expect(rules).toContain("Named colours and materials are pieces too");
    expect(rules).toContain("NEVER write lighting, camera, lens, framing");
    expect(rules).toContain("START WITH THE PERSON");
    expect(rules).toContain("SHORT BY DESIGN");
    expect(rules).toContain("NEVER CONTRADICT A LOCKED FACT, AND NEVER CONTRADICT YOURSELF");
    /* His worked cases are shown and labelled. */
    expect(rules).toContain(WAR_BUILT_RIGHT);
    expect(rules).toContain("WRONG — keeps every piece and adds a story");
    expect(rules).toContain(PIRATE_RIGHT);
  });

  it("⚠ THE CLASS ARM (#477's lesson): every taught-good example passes the full refusal chain at its own worst facts", () => {
    /*
      An instruction that teaches a phrase its own guards refuse trains the
      model into refusals — measured on the old MAX road (the "youthful"
      echo, 5/5 stated-age events). The taught outputs ARE the seeds' ideal
      answers, so each must clear the chain against its own seed.
    */
    expect(reimagineRefusal(WAR_BUILT_RIGHT, reimagineAllowance(WAR_BUILT_BRIEF), WAR_BUILT_BRIEF)).toBeNull();
    expect(reimagineRefusal(PIRATE_RIGHT, reimagineAllowance("a pirate"), "a pirate")).toBeNull();
    /* And the instruction as a whole teaches no word this studio never sends. */
    expect(neverWrittenIn(rules)).toBeNull();
  });
});

describe("the press, driven by a misbehaving double (law 3)", () => {
  it("a clean draft: ONE call at 0.9, about 'author', the box as the user turn, the interpreter's deadline, no transport retries", async () => {
    const { engine, sent } = engineAnswering([WAR_BUILT_RIGHT]);
    const out = await reimagineBrief({ engine, briefText: WAR_BUILT_BRIEF });
    expect(out).toMatchObject({ kind: "idea", text: WAR_BUILT_RIGHT, attempts: 1, refusals: [] });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ about: "author", temperature: 0.9, user: WAR_BUILT_BRIEF, retries: 0, timeoutMs: INTERPRET_TIMEOUT_MS });
  });

  it("a refused draft is re-asked ONCE at 0.4 with the reason and the previous draft; a clean second stands", async () => {
    const { engine, sent } = engineAnswering(["A woman in her 20s, built for a war.", WAR_BUILT_RIGHT]);
    const out = await reimagineBrief({ engine, briefText: WAR_BUILT_BRIEF });
    expect(out.kind).toBe("idea");
    if (out.kind === "idea") expect(out.text).toBe(WAR_BUILT_RIGHT);
    expect(out.attempts).toBe(2);
    expect(out.refusals).toHaveLength(1);
    expect(sent[1]?.temperature).toBe(0.4);
    expect(sent[1]?.system).toContain("PREVIOUS DRAFT:");
    expect(sent[1]?.system).toContain("20s");
  });

  it("refused twice is NOTHING — the honest state, with both reasons on the record", async () => {
    const { engine } = engineAnswering(["A woman in her 20s.", "A woman in her 20s again."]);
    const out = await reimagineBrief({ engine, briefText: WAR_BUILT_BRIEF });
    expect(out.kind).toBe("nothing");
    expect(out.attempts).toBe(2);
    expect(out.refusals).toHaveLength(2);
  });

  it("a throwing call is NOTHING, never a thrown error — an outage and a refusal read the same to the customer", async () => {
    const { engine } = engineAnswering([new Error("ECONNRESET")]);
    const out = await reimagineBrief({ engine, briefText: "a pirate" });
    expect(out).toMatchObject({ kind: "nothing", attempts: 1 });
  });

  it("code fences are stripped and an empty reply is re-asked", async () => {
    const { engine } = engineAnswering(["```\n" + PIRATE_RIGHT + "\n```"]);
    const out = await reimagineBrief({ engine, briefText: "a pirate" });
    if (out.kind !== "idea") throw new Error("expected an idea");
    expect(out.text).toBe(PIRATE_RIGHT);
    const empty = engineAnswering(["", PIRATE_RIGHT]);
    const second = await reimagineBrief({ engine: empty.engine, briefText: "a pirate" });
    expect(second.kind).toBe("idea");
    expect(second.attempts).toBe(2);
  });
});

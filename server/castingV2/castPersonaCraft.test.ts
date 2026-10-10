/**
 * THE CRAFT IS SHARED, AND SHARING IT CHANGED NOTHING — #2196's load-bearing arm.
 *
 * Door 1 needs the drafted line's craft rules, and its card says to REUSE them
 * rather than write a second copy (working law 4).
 *
 * ⚠ **THIS ROAD SHIPPED ITS OWN `castPersonaCraft.ts` FOR HALF A DAY AND IT IS
 * GONE.** #2197's server half landed the same extraction on main, hours apart
 * and for the same reason — two answers to one need, which is precisely the
 * second-list shape working law 4 forbids. `castPersonaCraftRules` is the one
 * with real customers (the drafted line AND the translator), so it stands, and
 * this road composes from it. The ONE thing that came across from the deleted
 * module is its `where` parameter: the pronoun rule ends *"and no other pronoun
 * in either line"*, which is true of a two-line draft and false of six reads.
 *
 * ⚠ **THAT INSTRUCTION IS ONE HE COURTED (#2136) AND IT DRAFTS A LINE ON EVERY
 * SIGN, so the only acceptable outcome of adding a parameter to it is that not
 * one byte of its output moved.** *Context is not additive* is a measured law
 * here — one clause moves every cast — and #2136's first court measured drafts
 * 150 characters off his examples on wording alone.
 *
 * The golden beside this file is the instruction as it stood at `72ca9c22d`,
 * for all three pronoun sets. **It therefore also proves the two extractions
 * agreed**: it was captured before #2197's landed, and it is compared here
 * against #2197's structure carrying this card's parameter.
 *
 * ⚠ **A FAILURE HERE IS NEVER "UPDATE THE GOLDEN".** It means a shared block
 * moved and the drafted line he judges moved with it. Either the change was
 * meant — in which case it is his, not a refactor's — or it is the accident
 * this file exists to catch.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { castPersonaCraftRules, castPersonaSystemPrompt } from "./castPersona";
import { castPronouns } from "./castPronouns";
import { CAST_READS_COUNT, castReadsSystemPrompt } from "./castReads";

const GOLDEN = resolve(process.cwd(), "server/castingV2/__fixtures__/castPersonaInstruction.golden.txt");

const SETS: Array<[string, unknown]> = [
  ["she", { subject: { sex: "female" } }],
  ["he", { subject: { sex: "male" } }],
  ["they", {}],
];

function composed(): string {
  return SETS.map(([label, schema]) => `===== ${label} =====\n${castPersonaSystemPrompt(castPronouns(schema))}`).join("\n");
}

describe("the drafted line's instruction did not move when its rules were shared", () => {
  it("⚠ is byte-identical to the golden, for every pronoun set", () => {
    expect(composed()).toBe(readFileSync(GOLDEN, "utf8"));
  });

  it("the three pronoun sets are genuinely three — the negative control on the arm above", () => {
    /*
      The first run of this comparison used a fixture shape `castPronouns` does
      not read (`{ pronouns: "she/her" }`), so all four arms resolved to
      they/them and three of them compared the same string to itself. It
      passed, and proved a third of what it claimed. This holds the fixtures
      apart so that can never be true silently again.
    */
    const rendered = SETS.map(([, schema]) => castPersonaSystemPrompt(castPronouns(schema)));
    expect(new Set(rendered).size).toBe(SETS.length);
  });

  it("⚠ the `where` parameter DEFAULTS to the drafted line's own wording", () => {
    /* If the default ever moved, every caller that does not pass it — the
       drafted line and the translator both — would render different bytes. */
    const pronouns = castPronouns({ subject: { sex: "female" } });
    expect(castPersonaCraftRules(pronouns).writing.join("\n"))
      .toBe(castPersonaCraftRules(pronouns, "either line").writing.join("\n"));
  });
});

describe("the six reads obey the same craft, which is the whole point", () => {
  const pronouns = castPronouns({ subject: { sex: "female" } });
  const rules = castPersonaCraftRules(pronouns, `any of the ${CAST_READS_COUNT}`);
  const reads = castReadsSystemPrompt(pronouns);

  it("⚠ composes the shared blocks verbatim rather than restating any of them", () => {
    /*
      This is the arm the card actually asked for. If door 1 ever stops
      composing a shared block — a rule tightened in one instruction and not
      the other — the two sides of this product's one house style have split,
      and nothing else in the tree would say so.
    */
    for (const block of [rules.personality, rules.cameraOnly, rules.writing, rules.length, rules.personalityExample]) {
      expect(reads).toContain(block.join("\n"));
    }
  });

  it("binds the pronoun rule to all six, where the drafted line binds it to two", () => {
    expect(castPersonaSystemPrompt(pronouns)).toContain("and no other pronoun in\neither line.");
    expect(reads).toContain(`and no other pronoun in\nany of the ${CAST_READS_COUNT}.`);
    /* …and the rest of the rule is the same sentence on both roads. */
    const tail = "The pronouns are a fact about this performer that you are given;";
    expect(castPersonaSystemPrompt(pronouns)).toContain(tail);
    expect(reads).toContain(tail);
  });

  it("⚠ SABOTAGE CONTROL — a block that stopped being shared would be caught", () => {
    /*
      Law 2: the instrument gets a positive control before its verdicts count.
      A block the reads instruction does NOT compose must not be found in it,
      or `toContain` would pass on text that is there for another reason and
      the arm above would prove nothing.
    */
    expect(reads).not.toContain(rules.voice.join("\n"));
    expect(reads).not.toContain(rules.voiceExample.join("\n"));
    expect(castPersonaSystemPrompt(pronouns)).not.toContain("You write 6 alternative reads");
  });

  it("there is no second copy of the craft rules anywhere in the tree", () => {
    /*
      The deleted `castPersonaCraft.ts` is the reason this arm exists: two
      modules answering one need is what it was, and a grep is what would have
      caught it the morning it was written.
    */
    const sentence = "SENTENCE ONE is how this performer is at REST";
    const declaring = [
      "server/castingV2/castPersona.ts",
    ].filter((path) => readFileSync(resolve(process.cwd(), path), "utf8").includes(sentence));
    expect(declaring).toEqual(["server/castingV2/castPersona.ts"]);
  });
});

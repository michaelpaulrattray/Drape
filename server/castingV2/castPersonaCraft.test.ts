/**
 * THE EXTRACTION CHANGED NOTHING — #2196's load-bearing arm.
 *
 * Door 1 needs the drafted line's craft rules, and its card says to REUSE them
 * rather than write a second copy (working law 4). So `castPersonaCraft.ts`
 * now holds them and `castPersonaSystemPrompt` composes from it.
 *
 * ⚠ **THAT INSTRUCTION IS ONE HE COURTED (#2136) AND IT DRAFTS A LINE ON EVERY
 * SIGN, so the only acceptable outcome of this refactor is that not one byte of
 * it moved.** *Context is not additive* is a measured law in this repository —
 * one clause moves every cast — and the first court measured drafts 150
 * characters off his examples on wording alone.
 *
 * The golden beside this file is the instruction as it stood at `72ca9c22d`,
 * for all three pronoun sets. It was captured from the composed output only
 * AFTER that output was compared, character by character, against the function
 * as it stood before the extraction, with the comparison proven able to fail
 * (one word changed in a shared block reddened all four arms).
 *
 * ⚠ **A FAILURE HERE IS NEVER "UPDATE THE GOLDEN".** It means a shared block
 * moved, and the drafted line he judges moved with it. Either the change was
 * meant — in which case it is his, not a refactor's — or it is the accident
 * this file exists to catch.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { castPersonaSystemPrompt } from "./castPersona";
import {
  cameraVisibleLines,
  forbiddenMentionLines,
  lengthRuleLines,
  personalityCraftLines,
  personalityFormExampleLines,
  pronounRuleLines,
} from "./castPersonaCraft";
import { castPronouns } from "./castPronouns";
import { castReadsSystemPrompt } from "./castReads";

const GOLDEN = resolve(process.cwd(), "server/castingV2/__fixtures__/castPersonaInstruction.golden.txt");

const SETS: Array<[string, unknown]> = [
  ["she", { subject: { sex: "female" } }],
  ["he", { subject: { sex: "male" } }],
  ["they", {}],
];

function composed(): string {
  return SETS.map(([label, schema]) => `===== ${label} =====\n${castPersonaSystemPrompt(castPronouns(schema))}`).join("\n");
}

describe("the drafted line's instruction did not move when its rules were extracted", () => {
  it("⚠ is byte-identical to the golden, for every pronoun set", () => {
    expect(composed()).toBe(readFileSync(GOLDEN, "utf8"));
  });

  it("the three pronoun sets are genuinely three — the negative control on the arm above", () => {
    /*
      The first run of the identity check used a fixture shape `castPronouns`
      does not read (`{ pronouns: "she/her" }`), so all four arms resolved to
      they/them and three of them compared the same string to itself. The arm
      passed and proved a third of what it claimed. This holds the fixtures
      apart so that can never be true again silently.
    */
    const rendered = SETS.map(([, schema]) => castPersonaSystemPrompt(castPronouns(schema)));
    expect(new Set(rendered).size).toBe(SETS.length);
  });
});

describe("the shared blocks are shared, not copied", () => {
  const pronouns = castPronouns({ subject: { sex: "female" } });

  it("every block the drafted line composes appears in its output verbatim", () => {
    const instruction = castPersonaSystemPrompt(pronouns);
    for (const block of [
      personalityCraftLines(pronouns),
      cameraVisibleLines(),
      forbiddenMentionLines(),
      lengthRuleLines(),
      personalityFormExampleLines(),
      pronounRuleLines(pronouns, "either line"),
    ]) {
      expect(instruction).toContain(block.join("\n"));
    }
  });

  it("⚠ and the SIX READS carry the same craft, which is the whole reason the file exists", () => {
    /*
      This is the arm the card actually asked for. If door 1 ever stops
      composing a shared block — a rule tightened in one instruction and not
      the other — the two sides of this product's one house style have split,
      and nothing else in the tree would say so.
    */
    const reads = castReadsSystemPrompt(pronouns);
    for (const block of [
      personalityCraftLines(pronouns),
      cameraVisibleLines(),
      forbiddenMentionLines(),
      lengthRuleLines(),
      personalityFormExampleLines(),
    ]) {
      expect(reads).toContain(block.join("\n"));
    }
  });

  it("the pronoun rule is the ONE parameterised clause, and both callers get their own binding", () => {
    expect(castPersonaSystemPrompt(pronouns)).toContain("and no other pronoun in\neither line.");
    expect(castReadsSystemPrompt(pronouns)).toContain("and no other pronoun in\nany of the 6.");
    /* …and the rest of the rule is the same sentence on both roads. */
    const tail = "The pronouns are a fact about this performer that you are given;";
    expect(castPersonaSystemPrompt(pronouns)).toContain(tail);
    expect(castReadsSystemPrompt(pronouns)).toContain(tail);
  });

  it("⚠ SABOTAGE CONTROL — a block that stopped being shared would be caught", () => {
    /*
      Law 2: the instrument gets a positive control before its verdicts count.
      A block the reads instruction does NOT compose must not be found in it,
      or `toContain` would pass on text that happens to be there for another
      reason and the arm above would prove nothing.
    */
    expect(castReadsSystemPrompt(pronouns)).not.toContain("VOICE — two parts in one short passage.");
    expect(castPersonaSystemPrompt(pronouns)).not.toContain("You write 6 alternative reads");
  });
});

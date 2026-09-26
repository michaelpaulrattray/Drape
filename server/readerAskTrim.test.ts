/**
 * THE #1123 COURT'S SURGERY, DRIVEN AGAINST THE REAL ASK.
 *
 * The court (`scripts/court-reader-ask-1123.mts`, record
 * `docs/specs/READER_ASK_COURT_2026-09-26.md`) compares the brief reader's
 * answers on the ask it sends today against the same ask with four fields
 * removed. Everything it reports rests on the trim actually removing those four
 * and NOTHING ELSE — a trim that silently removed nothing would make the two
 * arms one ask, and a court whose arms are identical reports perfect agreement
 * and proves nothing (working law 2).
 *
 * So this drives `scripts/lib/readerAskTrim.mts` against the string the real
 * composer produces, with both controls:
 *
 *   NEGATIVE — every field the author road KEEPS survives the trim byte for
 *              byte, and the trimmed ask invents no line the full ask lacks.
 *   POSITIVE — each anchor is load-bearing: a prompt missing the schema line, a
 *              prompt missing the instruction block, and a prompt carrying the
 *              field twice each REFUSE rather than trimming something else.
 */
import { describe, expect, it } from "vitest";

import { interpreterSystemPrompt } from "./castingV2/interpreter";
import {
  CARD_FIELDS,
  CONTROL_FIELDS,
  DEAD_FIELDS,
  dropField,
  dropInstructionBlock,
  dropSchemaLine,
  trimAsk,
} from "../scripts/lib/readerAskTrim.mts";

/**
 * The ask production sends TODAY, and it is read from the composer rather than
 * quoted: `CASTING_CREATIVE_REGISTER_SCOPE`, `CASTING_BRIEF_FIDELITY_SCOPE` and
 * `CASTING_BORN_INK_SCOPE` all stand at `all`
 * (`scripts/lib/productionFlagPositions.mts`), and the compiler hands
 * `wardrobe` a literal `false` (`briefCompiler.ts:1136`).
 */
const productionAsk = (): string => interpreterSystemPrompt({
  wardrobe: false,
  ink: true,
  fidelity: true,
  author: true,
  statedWardrobe: true,
});

/** Every field the ask states, in the order the schema states them. */
const schemaFields = (prompt: string): string[] => prompt
  .split("\n")
  .flatMap((line) => {
    const match = /^ {2}"([A-Za-z]+)":/.exec(line);
    return match ? [match[1]!] : [];
  });

const instructionFields = (prompt: string): string[] => prompt
  .split("\n")
  .flatMap((line) => {
    const match = /^- "([A-Za-z]+)":/.exec(line);
    return match ? [match[1]!] : [];
  });

describe("the reader-ask trim", () => {
  it("finds every field it is asked to remove in the real production ask", () => {
    const ask = productionAsk();
    /* A population arm: if the ask stopped stating these, every arm below would
       pass by having nothing to do. */
    for (const field of [...CARD_FIELDS, ...CONTROL_FIELDS]) {
      expect(schemaFields(ask), `schema line for ${field}`).toContain(field);
      expect(instructionFields(ask), `instruction block for ${field}`).toContain(field);
    }
  });

  it("removes exactly the four the card names, and no other field", () => {
    const ask = productionAsk();
    const trimmed = trimAsk(ask, CARD_FIELDS);

    const before = schemaFields(ask);
    const after = schemaFields(trimmed);
    expect(before.filter((field) => !after.includes(field)).sort())
      .toEqual([...CARD_FIELDS].sort());
    expect(after.filter((field) => !before.includes(field))).toEqual([]);

    const blocksBefore = instructionFields(ask);
    const blocksAfter = instructionFields(trimmed);
    expect(blocksBefore.filter((field) => !blocksAfter.includes(field)).sort())
      .toEqual([...CARD_FIELDS].sort());
    expect(blocksAfter.filter((field) => !blocksBefore.includes(field))).toEqual([]);
  });

  it("NEGATIVE CONTROL — every surviving line is a line of the full ask, byte for byte", () => {
    const ask = productionAsk();
    const full = new Set(ask.split("\n"));
    const trimmed = trimAsk(ask, CARD_FIELDS);
    const invented = trimmed.split("\n").filter((line) => !full.has(line));
    /*
      The comma repair is the ONE line the trim may rewrite: `poolTendencies`
      was the schema's last member, so the line above it loses its trailing
      comma. Naming it here rather than allowing a count keeps the arm able to
      fail when a second rewrite appears.
    */
    expect(invented).toEqual(["  \"statedAccessories\": string[]"]);
  });

  it("NEGATIVE CONTROL — the three dead fields' trim leaves variationAxis asked", () => {
    const trimmed = trimAsk(productionAsk(), DEAD_FIELDS);
    expect(schemaFields(trimmed)).toContain("variationAxis");
    expect(instructionFields(trimmed)).toContain("variationAxis");
    for (const field of DEAD_FIELDS) {
      expect(trimmed).not.toContain(`"${field}":`);
    }
  });

  it("POSITIVE CONTROL — refuses when the schema line is gone", () => {
    const ask = productionAsk();
    const sabotaged = ask.split("\n").filter((line) => !line.startsWith("  \"reads\":")).join("\n");
    expect(() => dropSchemaLine(sabotaged, "reads")).toThrow(/appears 0 times/);
  });

  it("POSITIVE CONTROL — refuses when the schema states a field twice", () => {
    const ask = productionAsk();
    const doubled = ask.replace("  \"reads\":", "  \"reads\": [8 short strings] | null,\n  \"reads\":");
    expect(() => dropSchemaLine(doubled, "reads")).toThrow(/appears 2 times/);
  });

  it("POSITIVE CONTROL — refuses when the instruction block is gone", () => {
    const ask = productionAsk();
    const start = ask.split("\n").findIndex((line) => line.startsWith("- \"reads\":"));
    const lines = ask.split("\n");
    const after = lines.findIndex((line, index) => index > start && line.startsWith("- \""));
    const sabotaged = [...lines.slice(0, start), ...lines.slice(after)].join("\n");
    expect(() => dropInstructionBlock(sabotaged, "reads")).toThrow(/opens 0 times/);
  });

  it("POSITIVE CONTROL — refuses a field the ask does not state at all", () => {
    expect(() => dropField(productionAsk(), "notAFieldAnybodyAsksFor")).toThrow(/appears 0 times/);
  });

  it("POSITIVE CONTROL — the control's removal takes sex and heritage out of the ask, and nothing else", () => {
    const poisoned = trimAsk(productionAsk(), CONTROL_FIELDS);
    for (const field of CONTROL_FIELDS) {
      expect(poisoned).not.toContain(`"${field}":`);
      expect(schemaFields(poisoned)).not.toContain(field);
    }
    /* Exactly those two: a positive control that removes more than it declares
       cannot attribute the difference it produces. */
    const before = schemaFields(productionAsk());
    expect(before.filter((field) => !schemaFields(poisoned).includes(field)).sort())
      .toEqual([...CONTROL_FIELDS].sort());
  });

  it("refuses a trim of nothing", () => {
    expect(() => trimAsk(productionAsk(), [])).toThrow(/must not be built as an arm/);
  });
});

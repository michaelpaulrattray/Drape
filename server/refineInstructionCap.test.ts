/**
 * THE REFINE BOX TAKES 2,000 CHARACTERS AT THE WIRE (card #26).
 *
 * His word, 2026-10-15, verbatim: *"yes raise the refine limit to 2000"*.
 *
 * Proved by PARSING through the real `castingV2.refine` input parser that tRPC
 * holds, never by reading the constant beside it (working law 5, assert at the
 * wire): a constant compared to itself stays green while the schema spends a
 * literal. Each cap gets its positive arm (the longest legal value parses) and
 * its negative arm (one character more is refused), so neither can pass by the
 * parser accepting or refusing everything.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { castingV2Router } from "./routes/castingV2";
import {
  REFINE_ANSWERING_MAX_LENGTH,
  REFINE_INSTRUCTION_MAX_LENGTH,
  REFINE_REQUEST_TEXT_MAX_LENGTH,
} from "./castingV2/refineLimits";

/** The zod parser tRPC holds for `refine`, reached without running a handler. */
function refineParser(): { parse: (input: unknown) => unknown } {
  const procedure = (castingV2Router as unknown as Record<string, any>)._def.procedures.refine;
  if (!procedure) throw new Error("castingV2 has no procedure named refine");
  const inputs = procedure._def.inputs as Array<{ parse: (input: unknown) => unknown }>;
  if (inputs?.length !== 1) throw new Error(`refine declares ${inputs?.length ?? 0} input parsers`);
  return inputs[0]!;
}

const base = () => ({ clientRequestId: randomUUID(), candidateId: randomUUID() });

describe("card #26 — what the refine door accepts", () => {
  it("the number is his: 2,000", () => {
    expect(REFINE_INSTRUCTION_MAX_LENGTH).toBe(2000);
  });

  it("POSITIVE — a 2,000-character ask parses, whole", () => {
    const instruction = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH);
    const parsed = refineParser().parse({ ...base(), instruction }) as { instruction: string };
    expect(parsed.instruction).toHaveLength(2000);
  });

  it("NEGATIVE — one character more is refused at the door", () => {
    const instruction = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH + 1);
    expect(() => refineParser().parse({ ...base(), instruction })).toThrow();
  });

  it("an ANSWER at the derived answering cap parses, and one more does not", () => {
    const instruction = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH);
    expect(() => refineParser().parse({
      ...base(), instruction, answering: "y".repeat(REFINE_ANSWERING_MAX_LENGTH),
    })).not.toThrow();
    expect(() => refineParser().parse({
      ...base(), instruction, answering: "y".repeat(REFINE_ANSWERING_MAX_LENGTH + 1),
    })).toThrow();
  });

  it("a chip's remove can name a step typed at full length — the cap bolted to the box moved with it", () => {
    /* `removeStep.instruction` was a literal 200: once the box took 2,000, a
       step typed at full length could never have been pointed at. It is capped
       at the longest sentence a step can hold. */
    const instruction = "x".repeat(REFINE_INSTRUCTION_MAX_LENGTH);
    expect(() => refineParser().parse({
      ...base(), instruction, removeStep: { at: 0, instruction },
    })).not.toThrow();
    expect(() => refineParser().parse({
      ...base(), instruction,
      removeStep: { at: 0, instruction: "x".repeat(REFINE_REQUEST_TEXT_MAX_LENGTH + 1) },
    })).toThrow();
  });
});

import { HAIR_LENGTHS } from "./castingOptions";

export type CastingClarificationKind = "hair_length";

export interface CastingClarificationChoice {
  label: string;
  instruction: string;
}

/**
 * A free, server-owned follow-up question. It is a fulfilled classification
 * result, not a generation failure: no provider call, asset write or credit
 * movement has happened when this reaches the client.
 */
export interface CastingClarification {
  kind: CastingClarificationKind;
  question: string;
  detail: string;
  choices: CastingClarificationChoice[];
}

const HAIR_LENGTH_INSTRUCTIONS: Record<string, string> = {
  "Very Short": "Set the final hair length to very short.",
  Short: "Set the final hair length to short.",
  Medium: "Set the final hair length to medium.",
  Long: "Set the final hair length to long.",
  "Very Long": "Set the final hair length to very long.",
};

export function clarificationForCastingRefusal(code: string): CastingClarification | null {
  if (code !== "hair_length_vague") return null;
  return {
    kind: "hair_length",
    question: "How long should the hair be?",
    detail: "Choose one final length. Nothing was charged.",
    choices: HAIR_LENGTHS.map((label) => ({
      label,
      instruction: HAIR_LENGTH_INSTRUCTIONS[label],
    })),
  };
}

export function parseCastingClarification(value: unknown): CastingClarification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CastingClarification>;
  if (
    candidate.kind !== "hair_length"
    || typeof candidate.question !== "string"
    || typeof candidate.detail !== "string"
    || !Array.isArray(candidate.choices)
    || candidate.choices.length !== HAIR_LENGTHS.length
  ) {
    return null;
  }
  const expected = clarificationForCastingRefusal("hair_length_vague");
  if (!expected) return null;
  return candidate.question === expected.question
    && candidate.detail === expected.detail
    && candidate.choices.every((choice, index) => (
      choice?.label === expected.choices[index]?.label
      && choice?.instruction === expected.choices[index]?.instruction
    ))
    ? expected
    : null;
}

export const INK_TEXT_PROVIDER_CONFIG = {
  thinkingBudget: 0,
  includeThoughts: false,
  maxOutputTokens: 4096,
} as const;

const FINISH_REASONS = new Set([
  "STOP",
  "MAX_TOKENS",
  "SAFETY",
  "RECITATION",
  "LANGUAGE",
  "OTHER",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "MALFORMED_FUNCTION_CALL",
  "IMAGE_SAFETY",
  "IMAGE_PROHIBITED_CONTENT",
  "NO_IMAGE",
  "IMAGE_RECITATION",
  "UNEXPECTED_TOOL_CALL",
  "TOO_MANY_TOOL_CALLS",
  "MISSING_THOUGHT_SIGNATURE",
]);

const BLOCK_REASONS = new Set([
  "SAFETY",
  "OTHER",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "IMAGE_SAFETY",
]);

const ERROR_NAMES = new Set([
  "AbortError",
  "ApiError",
  "Error",
  "TimeoutError",
  "TypeError",
]);

export interface InkProviderTelemetry {
  candidateCount: number;
  finishReason: string | null;
  blockReason: string | null;
  textLength: number;
  promptTokenCount: number | null;
  candidateTokenCount: number | null;
  thoughtsTokenCount: number | null;
  totalTokenCount: number | null;
  errorName:
    | "AbortError"
    | "ApiError"
    | "Error"
    | "TimeoutError"
    | "TypeError"
    | "OtherError"
    | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function closedCode(
  value: unknown,
  allowed: ReadonlySet<string>,
): string | null {
  if (typeof value !== "string") return null;
  return allowed.has(value) ? value : "OTHER";
}

function safeCount(value: unknown): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null;
}

function safeErrorName(value: unknown): InkProviderTelemetry["errorName"] {
  const name = record(value)?.name;
  if (typeof name !== "string") return value == null ? null : "OtherError";
  return ERROR_NAMES.has(name)
    ? name as Exclude<InkProviderTelemetry["errorName"], "OtherError" | null>
    : "OtherError";
}

export function extractInkProviderTelemetry(input: {
  response?: unknown;
  textLength?: unknown;
  error?: unknown;
}): InkProviderTelemetry {
  const response = record(input.response);
  const candidates = Array.isArray(response?.candidates)
    ? response.candidates
    : [];
  const firstCandidate = record(candidates[0]);
  const promptFeedback = record(response?.promptFeedback);
  const usage = record(response?.usageMetadata);
  return {
    candidateCount: candidates.length,
    finishReason: closedCode(firstCandidate?.finishReason, FINISH_REASONS),
    blockReason: closedCode(promptFeedback?.blockReason, BLOCK_REASONS),
    textLength: safeCount(input.textLength) ?? 0,
    promptTokenCount: safeCount(usage?.promptTokenCount),
    candidateTokenCount: safeCount(usage?.candidatesTokenCount),
    thoughtsTokenCount: safeCount(usage?.thoughtsTokenCount),
    totalTokenCount: safeCount(usage?.totalTokenCount),
    errorName: safeErrorName(input.error),
  };
}

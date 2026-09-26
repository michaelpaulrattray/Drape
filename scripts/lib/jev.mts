/**
 * JEV — the calibrated fixed-answer reader, as a wire (#1224, his ruling
 * 2026-09-25: *"Where-ever jev can genuinely improve my agents workflow it
 * should be used."*).
 *
 * Jev (TypeSafe AI) answers a FIXED set of questions on TEXT: a choice out of
 * options you supply, with a calibrated probability. It writes no prose, reads
 * no pictures, and cannot answer outside the options given. Toolbelt: #1064.
 *
 * # WHY THIS MODULE IS PURE-BUILD PLUS ONE FETCH, AND NOT A CLIENT CLASS
 *
 * Working law 5 — assert at the wire. `buildSystemOneRequest` is a pure
 * function returning the exact bytes that will be sent, so a test can hold the
 * REQUEST and assert what the model is actually asked. A guard that reads a
 * constant near the call proves nothing about what left the machine; every
 * arm in `server/jevCardCategory.test.ts` reads this function's output.
 *
 * # THE SHAPE WAS READ AT THE ARTIFACT, NOT FROM A DOCUMENT (law 7b)
 *
 * The first probe written for this card sent `criteria` as an ARRAY, which is
 * what the team's own reference note recorded, and the API refused it 422:
 * `Input should be a valid dictionary`. `criteria` is an object — option name
 * to a description of what that option MEANS — and the description is part of
 * the question, not decoration. The response's own shape, read at a 200:
 *
 *   { model, answers: { <id>: { type, choice, confidence, probabilities } },
 *     usage: { input_tokens, output_tokens } }
 *
 * ⚠ **`confidence` AND `probabilities[choice]` ARE DIFFERENT NUMBERS and this
 * module surfaces both.** On the very first live call they were 0.85 and 0.88
 * for one answer. `confidence` is the calibrated figure — the thing Jev exists
 * to provide — so it is what a threshold keys on; the raw distribution is
 * carried beside it so a reader can see WHAT ELSE the model nearly said, which
 * is the part a single number hides.
 */

/** A choice question: pick one option, with a description of each. */
export type JevChoiceQuestion = {
  readonly type: "choice";
  readonly instructions: string;
  /** option name → what that option means. An ARRAY is refused 422 by the API. */
  readonly criteria: Readonly<Record<string, string>>;
};

export type JevRequest = {
  readonly model: string;
  readonly state: unknown;
  readonly questions: Readonly<Record<string, JevChoiceQuestion>>;
};

export type JevChoiceAnswer = {
  readonly choice: string;
  /** The CALIBRATED figure. Not the same as `probabilities[choice]`. */
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
};

export type JevReply = {
  readonly model: string;
  readonly answers: Readonly<Record<string, JevChoiceAnswer>>;
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number };
};

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";

/**
 * The exact body that goes on the wire. Pure — no key, no fetch, no clock —
 * so every arm about WHAT JEV IS ASKED reads this and not a constant beside
 * the call site.
 */
export function buildSystemOneRequest(
  state: unknown,
  questions: Readonly<Record<string, JevChoiceQuestion>>,
): JevRequest {
  const ids = Object.keys(questions);
  if (ids.length === 0) throw new Error("jev: a request with no questions asks nothing");
  for (const id of ids) {
    const question = questions[id]!;
    const options = Object.keys(question.criteria);
    /* Two options is the floor for a choice to BE a choice. One option is a
       question whose answer is already known, and the calibrated probability
       it comes back with would read as agreement rather than as the tautology
       it is — which is exactly the shape of an instrument that cannot fail. */
    if (options.length < 2) {
      throw new Error(`jev: question "${id}" offers ${options.length} option(s); a choice needs at least 2`);
    }
    for (const option of options) {
      if (question.criteria[option]!.trim() === "") {
        throw new Error(`jev: question "${id}" option "${option}" has no description`);
      }
    }
  }
  return { model: JEV_MODEL, state, questions };
}

/** Parses a reply, REFUSING anything it cannot read rather than guessing a default. */
export function parseSystemOneReply(payload: unknown, expectedIds: readonly string[]): JevReply {
  if (typeof payload !== "object" || payload === null) throw new Error("jev: reply is not an object");
  const body = payload as Record<string, unknown>;
  const answers = body.answers;
  if (typeof answers !== "object" || answers === null) throw new Error("jev: reply carries no answers");
  const parsed: Record<string, JevChoiceAnswer> = {};
  for (const id of expectedIds) {
    const answer = (answers as Record<string, unknown>)[id];
    if (typeof answer !== "object" || answer === null) throw new Error(`jev: no answer for question "${id}"`);
    const record = answer as Record<string, unknown>;
    const choice = record.choice;
    const confidence = record.confidence;
    if (typeof choice !== "string") throw new Error(`jev: answer "${id}" has no choice`);
    /* A missing confidence is REFUSED rather than defaulted to 0 or 1. The
       whole reason this model was chosen over a prose one is the calibrated
       number; a reader that silently substitutes one has quietly become the
       thing it replaced. */
    if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
      throw new Error(`jev: answer "${id}" has no finite confidence`);
    }
    const raw = record.probabilities;
    const probabilities: Record<string, number> = {};
    if (typeof raw === "object" && raw !== null) {
      for (const [option, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === "number" && Number.isFinite(value)) probabilities[option] = value;
      }
    }
    parsed[id] = { choice, confidence, probabilities };
  }
  const usage = (body.usage ?? {}) as Record<string, unknown>;
  return {
    model: typeof body.model === "string" ? body.model : "unknown",
    answers: parsed,
    usage: {
      input_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
      output_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
    },
  };
}

/** Sends one request. The key is read here and never logged, printed or returned. */
export async function askJev(
  state: unknown,
  questions: Readonly<Record<string, JevChoiceQuestion>>,
  options: {
    readonly apiKey?: string;
    readonly fetchImpl?: typeof fetch;
    /**
     * ⚠ **A CEILING ON ONE CALL, because without one a hung reply is a hung
     * CALLER** (#1281's review, 2026-09-26). Node's fetch has no default request
     * timeout worth the name — undici waits ~300 s on headers — so a caller that
     * asks about forty cards in a loop can sit for hours before it does anything
     * else. It is OPTIONAL and unset by default, so every caller written before
     * this behaves exactly as it did; a caller in a loop passes one.
     */
    readonly timeoutMs?: number;
  } = {},
): Promise<JevReply> {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("jev: TYPESAFE_API_KEY is not set — this reader refuses rather than guessing");
  const request = buildSystemOneRequest(state, questions);
  const send = options.fetchImpl ?? fetch;
  const response = await send(JEV_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    ...(typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? { signal: AbortSignal.timeout(options.timeoutMs) }
      : {}),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`jev: HTTP ${response.status} ${response.statusText} — ${detail.slice(0, 400)}`);
  }
  return parseSystemOneReply(await response.json(), Object.keys(questions));
}

/** $0.042 per million input tokens; output is free. Stated, never estimated from a list price. */
export const JEV_INPUT_USD_PER_MTOK = 0.042;

export function jevSpendUsd(inputTokens: number): number {
  return (inputTokens / 1_000_000) * JEV_INPUT_USD_PER_MTOK;
}

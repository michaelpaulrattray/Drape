import { createModuleLogger } from "../logging/logger";
import { isContentRefusal } from "./falTransport";
import { ProviderQueue, withRetry } from "./providerQueue";
import {
  ProviderError,
  type ProviderFailureClass,
  type TextEngine,
  type TextRequest,
  type TextResult,
} from "./types";

const log = createModuleLogger("providers/openrouterText");

/**
 * The text transport (plan §E, §H.9): one completion, through OpenRouter.
 *
 * This is the interpreter's road to a model, and nothing more. It knows how to
 * make a call, how long the call took, and how to classify a failure. It does
 * not know what a casting brief is, and it never inspects or repairs the text
 * it returns — that belongs to the intent schema, which treats every byte from
 * here as hostile until validated.
 *
 * Two properties matter to billing, and they are the reason this is its own
 * module rather than a fetch inside the compiler:
 *
 *   1. **It runs before the claim.** A text failure costs the user nothing, so
 *      this adapter may fail loudly and often; the caller decides whether to
 *      fall back or refuse.
 *   2. **It reports its own latency.** M3 could not evaluate §E.1's "+5s
 *      median" budget because the harness recorded image latency only, and the
 *      treatment stage's contribution was therefore unknown. Every call
 *      returns `latencyMs` so that condition becomes measurable rather than
 *      permanently deferred.
 */

const BASE_URL = "https://openrouter.ai/api/v1";

/**
 * The interpreter model, pinned. M3 ran this slug for path A's interpreter and
 * it is what the calibration evidence describes; changing it is a decision
 * about output quality, not a version bump.
 */
export const DEFAULT_INTERPRETER_MODEL = "anthropic/claude-sonnet-5";

function classifyHttp(status: number, body: string): ProviderFailureClass {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "transport";
  if (status === 408 || status === 504) return "timeout";
  if (status === 401 || status === 403) return "capability";
  if (status === 400 || status === 422) {
    // Specific phrases only. The M3 report's five lost candidates came from a
    // classifier that read the substring "content" in `content_type` as a
    // refusal and permanently failed transient errors.
    return isContentRefusal(body) ? "content_policy" : "capability";
  }
  return "unknown";
}

/**
 * The user turn: a bare string for text, content parts when there are pictures.
 *
 * Kept as a bare string in the text case on purpose — that is the shape every
 * interpreter call has used since M3, and a needless reshaping of the request
 * body is the kind of change that alters model behaviour for no stated reason.
 * Images ride as data URIs, the same way the identity engine sends references,
 * so nothing about a judged image is ever fetched from a URL we do not control.
 */
function userContent(request: TextRequest): unknown {
  if (!request.images || request.images.length === 0) return request.user;
  return [
    { type: "text", text: request.user },
    ...request.images.map((image) => ({
      type: "image_url",
      image_url: {
        url: `data:${image.contentType};base64,${image.bytes.toString("base64")}`,
      },
    })),
  ];
}

export type OpenRouterTextConfig = {
  apiKey: string;
  model?: string;
  /** A text call that has not answered in 45s is not going to. */
  timeoutMs?: number;
  queue?: ProviderQueue;
};

export function createOpenRouterTextEngine(config: OpenRouterTextConfig): TextEngine {
  const model = config.model ?? DEFAULT_INTERPRETER_MODEL;
  const timeoutMs = config.timeoutMs ?? 45_000;
  const queue =
    config.queue ??
    new ProviderQueue({ name: "openrouter-text", concurrency: 4, maxQueueDepth: 32 });

  return {
    id: `openrouter:${model}`,

    async complete(request: TextRequest): Promise<TextResult> {
      return queue.run("complete", () =>
        withRetry(
          "openrouterText.complete",
          async () => {
            const startedAt = Date.now();
            const timeout = AbortSignal.timeout(timeoutMs);
            const signal = request.signal
              ? AbortSignal.any([request.signal, timeout])
              : timeout;

            let response: Response;
            try {
              response = await fetch(`${BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${config.apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: request.system },
                    { role: "user", content: userContent(request) },
                  ],
                  temperature: request.temperature ?? 0.4,
                  max_tokens: request.maxOutputTokens ?? 900,
                  ...(request.json ? { response_format: { type: "json_object" } } : {}),
                }),
                signal,
              });
            } catch (error) {
              const name = (error as Error)?.name;
              if (name === "TimeoutError") {
                throw new ProviderError("timeout", "Interpreter call exceeded its deadline", {
                  cause: error,
                });
              }
              if (name === "AbortError") {
                throw new ProviderError("capability", "cancelled", { cause: error });
              }
              throw new ProviderError("transport", "OpenRouter unreachable", { cause: error });
            }

            const providerRef = response.headers.get("x-request-id") ?? undefined;

            if (!response.ok) {
              const body = await response.text().catch(() => "");
              const failureClass = classifyHttp(response.status, body);
              log.warn(
                { status: response.status, failureClass, providerRef },
                "[OpenRouterText] request failed",
              );
              throw new ProviderError(failureClass, "The interpreter call was refused", {
                status: response.status,
                providerRef,
              });
            }

            const payload = (await response.json()) as {
              choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
              model?: string;
            };
            const text = payload.choices?.[0]?.message?.content ?? "";
            if (!text.trim()) {
              // A 200 with no completion is not success. Fail closed so the
              // caller falls back rather than compiling from an empty string.
              throw new ProviderError("unknown", "The interpreter returned nothing", {
                providerRef,
              });
            }

            /*
              "length" means the provider stopped at the ceiling, so `text` is
              a fragment. Surfaced rather than inferred: the caller cannot tell
              a truncated reply from a malformed one by looking at it, and the
              two deserve opposite handling — one is retryable transport, the
              other is the model failing.
            */
            const truncated = payload.choices?.[0]?.finish_reason === "length";

            return {
              text,
              truncated,
              latencyMs: Date.now() - startedAt,
              provenance: {
                provider: "openrouter",
                model,
                servedModel: payload.model,
                providerRef,
              },
            };
          },
          { signal: request.signal },
        ),
      );
    },
  };
}

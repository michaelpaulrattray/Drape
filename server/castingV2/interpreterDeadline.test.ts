/**
 * THE BRIEF INTERPRETER'S DEADLINE IS ITS OWN, AND THE TRANSPORT HONOURS IT
 * (#121 — roll 219, the cyber-goth brief that delivered men and women).
 *
 * The defect: the interpreter ran under the OpenRouter engine's DEFAULT 45 s
 * deadline, sized for a describer's short read. A 1,494-character brief takes
 * ~36 s on the served model and crosses 45 s about one drive in three; when it
 * does, the call throws, the compiler falls back to `fallbackIntent`, and the
 * customer is charged for eight people cast from the first 80 characters of
 * her brief with no sex lock at all. Roll 219's row is that shape exactly.
 *
 * Two arms, each with a control that proves it can fail:
 *   1. at the TRANSPORT — a request carrying `timeoutMs` outlives an engine
 *      default that would have killed it, and the same request without one
 *      dies at the default (so the override is real, not a no-op);
 *   2. at the CALL — the brief interpreter's request carries a deadline sized
 *      past the worst success observed on production (41,995 ms, roll 206).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenRouterTextEngine } from "../providers/openrouterText";
import { ProviderQueue } from "../providers/providerQueue";
import type { TextEngine, TextRequest } from "../providers/types";
import { INTERPRET_TIMEOUT_MS, interpretBrief } from "./interpreter";

const reply = JSON.stringify({
  choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
  model: "served/x",
});

/** A network that answers after `afterMs`, and honours the abort it is handed. */
function slowFetch(afterMs: number): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      const timer = setTimeout(
        () => resolve(new Response(reply, { status: 200, headers: { "content-type": "application/json" } })),
        afterMs,
      );
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    })) as unknown as typeof fetch;
}

describe("the transport — a call's own deadline outranks the engine's default", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const engine = () =>
    createOpenRouterTextEngine({
      apiKey: "k",
      model: "test/model",
      timeoutMs: 30,
      queue: new ProviderQueue({ name: "test-deadline", concurrency: 1, maxQueueDepth: 4 }),
    });

  it("a request carrying timeoutMs survives a reply the engine default would have abandoned", async () => {
    globalThis.fetch = slowFetch(120);
    const result = await engine().complete({ system: "s", user: "u", timeoutMs: 2_000 });
    expect(result.text).toBe("{}");
  });

  it("CONTROL — the same reply with no per-call deadline dies at the engine default", async () => {
    globalThis.fetch = slowFetch(120);
    await expect(engine().complete({ system: "s", user: "u" })).rejects.toMatchObject({
      failureClass: "timeout",
    });
  }, 15_000);
});

describe("the call — the brief interpreter asks for the deadline its population needs", () => {
  it("every interpretation request carries INTERPRET_TIMEOUT_MS", async () => {
    const seen: TextRequest[] = [];
    const engine: TextEngine = {
      id: "fake",
      complete: vi.fn(async (request: TextRequest) => {
        seen.push(request);
        return {
          text: JSON.stringify({ cohort: "photoreal_human", role: "a nurse", sex: "female", heritage: [] }),
          latencyMs: 1,
          provenance: { model: "fake", servedModel: "fake" },
        };
      }),
    } as unknown as TextEngine;

    const outcome = await interpretBrief({ briefText: "a nurse in her thirties", engine, register: true });
    expect(outcome.ok).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
    for (const request of seen) expect(request.timeoutMs).toBe(INTERPRET_TIMEOUT_MS);
  });

  it("and that deadline clears the worst success production has recorded, with room to spare", () => {
    /* Roll 206: 41,995 ms, interpreted. Roll 219: >45,000 ms, fell back. */
    expect(INTERPRET_TIMEOUT_MS).toBeGreaterThanOrEqual(2 * 41_995);
  });
});

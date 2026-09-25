/**
 * A VIEW IS NOT DELIVERED UNJUDGED BECAUSE THE JUDGE RAN OUT OF ROOM (#1220).
 *
 * The defect, read at the rows: three of the twenty-four delivered Sign views in
 * production carry `conformanceMethod = "unavailable"` and the note *"the
 * conformance judge could not be reached"* — all three on 2026-09-25, all three
 * on his two Sifr casts, each one charged 50 credits. One of them is the frame
 * he reported wrong.
 *
 * The judge was reachable every time. Two of the three came back **200 with an
 * empty completion** because `anthropic/claude-sonnet-5` spent the judge's whole
 * 500-token ceiling on reasoning (`finishReason: "length"`, `reasoningChars:
 * 640` and `531`); the third died on the transport's 45 s default. Both were
 * filed under the one sentence that is false of both.
 *
 * ## Why these arms are driven through the real transport
 *
 * The misfiling lives in `openrouterText.ts` and the repair is a `failureClass`,
 * so a fake engine cannot see it: an engine double that throws the class the
 * test wants has assumed the very thing being proved. Every arm below that is
 * about the classification drives a stubbed NETWORK through the real transport,
 * the way `interpreterDeadline.test.ts` does for the same reason.
 *
 * ## What the court measured, so these numbers are not invented
 *
 * Four shapes against his own Sifr2 frames, through the real judge:
 *
 * | reasoning | ceiling | what happened |
 * |---|---|---|
 * | default | 500 | 45 s timeout — no verdict (production: empty completion) |
 * | default | 1,000 | starved twice, 999 of 1,000 tokens on reasoning |
 * | default | 2,000 | 45 s timeout — no verdict |
 * | `effort: low` | 2,000 | 90.5 s, timed out twice — no verdict |
 * | **off** | **1,000** | **a verdict, in 23.3 s and 36.3 s** |
 *
 * Bounded reasoning was measured and rejected rather than assumed away.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenRouterTextEngine } from "../providers/openrouterText";
import { ProviderQueue } from "../providers/providerQueue";
import { ProviderError, type TextEngine, type TextRequest } from "../providers/types";
import { createViewConformanceJudge } from "./viewConformance";

const anchor = { bytes: Buffer.from("anchor"), contentType: "image/png" };
const candidate = { bytes: Buffer.from("candidate"), contentType: "image/png" };

const verdictJson = JSON.stringify({
  identity: { verdict: "matches", note: "same person" },
  angle: { verdict: "differs", note: "the shoulders are in frame" },
  wardrobe: { verdict: "matches", note: "as the reference shows" },
});

/** A provider reply, exactly as OpenRouter shapes one. */
function reply(body: { content?: string; finishReason: string; reasoning?: string }) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: { content: body.content ?? "", ...(body.reasoning ? { reasoning: body.reasoning } : {}) },
          finish_reason: body.finishReason,
        },
      ],
      model: "served/x",
      usage: { prompt_tokens: 7_578, completion_tokens: 1_000 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** A network that answers with the given replies in order, and records the bodies sent. */
function network(replies: Array<() => Response>) {
  const sent: Array<Record<string, unknown>> = [];
  const fetchStub = vi.fn(async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    const next = replies[Math.min(sent.length - 1, replies.length - 1)];
    return next!();
  });
  globalThis.fetch = fetchStub as unknown as typeof fetch;
  return { sent, fetchStub };
}

function engine() {
  return createOpenRouterTextEngine({
    apiKey: "k",
    model: "test/model",
    queue: new ProviderQueue({ name: `judge-${Math.random()}`, concurrency: 1, maxQueueDepth: 4 }),
  });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("a reply cut off before it wrote anything is a CEILING, not an unreachable provider", () => {
  it("classes a 200 with finish_reason length and no content as retryable transport — and retries it", async () => {
    const { sent } = network([
      () => reply({ finishReason: "length", reasoning: "thinking about it at length" }),
      () => reply({ content: verdictJson, finishReason: "stop" }),
    ]);

    const result = await engine().complete({ system: "s", user: "u" });

    /*
      The whole point in one assertion: the starved attempt did not end the call.
      Before this, `unknown` is non-retryable, the transport gave up on the first
      attempt, and the judge wrote "could not be reached" onto a charged view.
    */
    expect(sent).toHaveLength(2);
    expect(result.text).toBe(verdictJson);
  });

  it("CONTROL — an empty completion that did NOT hit the ceiling stays non-retryable", async () => {
    /*
      The negative control, and it is the arm that makes the one above mean
      something: a silent upstream refusal and a stop sequence also arrive as a
      200 with no content, and neither is fixed by asking again. If this went
      green with the same class as the arm above, the repair would be "retry
      every empty reply", which is a different and worse change.
    */
    const { sent } = network([() => reply({ finishReason: "stop" })]);

    await expect(engine().complete({ system: "s", user: "u" })).rejects.toMatchObject({
      failureClass: "unknown",
    });
    expect(sent).toHaveLength(1);
  });

  it("a PARTIAL reply at the ceiling still reaches the caller as truncated, untouched", async () => {
    /*
      Not every ceiling hit is empty — with reasoning off the model writes a
      fragment and stops, measured at the provider (`contentChars: 24` at a
      12-token ceiling). That road already worked, through `truncated`, and this
      change must not have moved it.
    */
    network([() => reply({ content: '{"identity":{"verdict":"mat', finishReason: "length" })]);
    const result = await engine().complete({ system: "s", user: "u" });
    expect(result.truncated).toBe(true);
  });
});

describe("the reasoning switch, asserted at the wire (working law 5)", () => {
  it("sends OpenRouter's own field when a call asks for reasoning off", async () => {
    const { sent } = network([() => reply({ content: verdictJson, finishReason: "stop" })]);
    await engine().complete({ system: "s", user: "u", reasoning: "off" });
    expect(sent[0]?.reasoning).toEqual({ enabled: false });
  });

  it("CONTROL — a call that says nothing about reasoning sends no reasoning field at all", async () => {
    /*
      A default that quietly disabled reasoning on every text call would change
      what the brief interpreter and the author produce, which is a decision
      about the quality of his casts and not a transport repair.
    */
    const { sent } = network([() => reply({ content: verdictJson, finishReason: "stop" })]);
    await engine().complete({ system: "s", user: "u" });
    expect(sent[0]).not.toHaveProperty("reasoning");
  });
});

describe("the conformance judge asks for the room it needs", () => {
  it("asks for reasoning off, a 1,000 ceiling, 75 s and one retry", async () => {
    let seen: TextRequest | null = null;
    const double: TextEngine = {
      id: "test-judge",
      complete: vi.fn(async (request: TextRequest) => {
        seen = request;
        return { text: verdictJson, latencyMs: 1, provenance: { provider: "openrouter" as const, model: "t" } };
      }),
    };
    await createViewConformanceJudge({ engine: double })({ angle: "closeUp", anchor, candidate });

    const request = seen as unknown as TextRequest;
    expect(request.reasoning).toBe("off");
    expect(request.maxOutputTokens).toBe(1_000);
    /* Twice the worst success measured on his own frames (36.3 s), and the
       retry bound that paying for a long deadline obliges. */
    expect(request.timeoutMs).toBe(75_000);
    expect(request.retries).toBe(1);
  });

  it("END TO END — a starved first attempt now yields a VERDICT, not an unjudged delivery", async () => {
    network([
      () => reply({ finishReason: "length", reasoning: "640 characters of thinking, as production recorded" }),
      () => reply({ content: verdictJson, finishReason: "stop" }),
    ]);

    const verdict = await createViewConformanceJudge({ engine: engine() })({
      angle: "closeUp",
      anchor,
      candidate,
    });

    expect(verdict.unjudged ?? false).toBe(false);
    expect(verdict.method).toContain("judge:");
    /* And the verdict is the model's, not a fail-closed stand-in: this frame
       fails on angle alone, the way his close-up's shoulders would. */
    expect(verdict.pass).toBe(false);
    expect(verdict.axes.angle.pass).toBe(false);
    expect(verdict.axes.identity.pass).toBe(true);
  }, 10_000);

  it("CONTROL — starved on EVERY attempt, it leaves as a survivor after exactly its two tries", async () => {
    /*
      The retry is a net, not a guarantee. What a permanently starved call does
      now is LEAVE THE JUDGE as a retryable survivor, and that is a real change
      of road worth pinning: before this, `unknown` was non-retryable, so the
      judge itself wrote `unjudged("unavailable", "the conformance judge could
      not be reached")` — the exact sentence on three charged views.

      D-246 is untouched by the move. `judgeUnjudgedOnFailure` in
      `packageOrchestrator` catches precisely this and records the view as
      unjudged, delivered, `method: "unavailable"` — so the customer still gets a
      picture that may be perfect rather than nothing. What changed is only how
      often the sentence is true, never whether it may be said.
    */
    const { sent } = network([() => reply({ finishReason: "length", reasoning: "again" })]);

    await expect(
      createViewConformanceJudge({ engine: engine() })({ angle: "closeUp", anchor, candidate }),
    ).rejects.toMatchObject({ failureClass: "transport" });

    /* Two, because the judge bought a 75 s deadline and `retries: 1` is its price. */
    expect(sent).toHaveLength(2);
  }, 10_000);

  it("and a retryable failure still leaves the judge rather than becoming a verdict", async () => {
    /*
      Unchanged, pinned here because the class moved: `transport` is rethrown so
      the orchestrator owns the decision, and `judgeUnjudgedOnFailure` is what
      turns a survivor into an honest "nobody looked".
    */
    const throwing: TextEngine = {
      id: "test-judge",
      complete: vi.fn(async () => {
        throw new ProviderError("transport", "socket hang up");
      }),
    };
    await expect(
      createViewConformanceJudge({ engine: throwing })({ angle: "closeUp", anchor, candidate }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

/**
 * THE PARSER MUST NOT BE STARVED, AND AN EMPTY REPLY IS NOT HER MISTAKE.
 *
 * # The measurement
 *
 * Driven against the real transport with the real system prompt
 * (`scripts/drive-interpreter-ceiling.mts`, six readings per sentence,
 * 2026-08-09):
 *
 *     max_tokens 600     "remove her glasses, then fox eyes"   parsed 2/6, EMPTY 4
 *                        "remove her glasses"                  parsed 6/6
 *                        "fox eyes"                            parsed 6/6
 *     max_tokens 2000    all three                             parsed 6/6
 *
 * An empty completion on a 200 with `finish_reason: length` is not a model
 * declining to answer. It is a model spending its whole allowance on reasoning
 * and never reaching the JSON — and the harder the sentence, the likelier it
 * is, which is the worst possible shape: the customer whose instruction is
 * least ordinary is the one told *"that didn't come through clearly"*.
 *
 * # Why these tests and not the driver
 *
 * The driver costs money and needs a network, so it cannot gate a commit. These
 * two assertions are what survive without it, and each is driven directly
 * rather than through a model (working law 3):
 *
 *   1. THE CEILING RIDES THE OUTGOING REQUEST. Asserted at the wire, on the
 *      request the engine actually receives — not on the constant beside it.
 *   2. AN EMPTY REPLY IS RETRIED, not converted into a refusal. Two empty
 *      completions followed by a good one must parse, because that is exactly
 *      the sequence production saw and the sequence the retry exists for.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { ProviderError } from "../providers/types";
import { REFINE_PARSE_MAX_TOKENS, interpretRefinement } from "./refineInterpreter";

const GOOD = JSON.stringify({ intent: "edit", eyeShape: "fox eyes" });

/** An engine that records every request and replies from a script. */
function scripted(replies: Array<string | "EMPTY">): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      if (reply === "EMPTY") {
        /* The transport's own shape for this failure — a 200 with no
           completion, raised as a provider error rather than an empty string. */
        throw new ProviderError("unknown", "The interpreter returned nothing");
      }
      return {
        text: reply!,
        provenance: { provider: "openrouter" as const, model: "scripted" },
        latencyMs: 0,
      } as Awaited<ReturnType<TextEngine["complete"]>>;
    },
  };
}

describe("the parser's token ceiling (2026-08-09)", () => {
  it("is generous enough for the sentence that came back empty", () => {
    /*
      Pinned as a floor rather than an exact value: the number may rise, and a
      test that fixes it exactly would fail the next time someone gives the
      parser more room. What must never happen again is a return to a ceiling
      this model cannot finish a hard sentence under — 600 produced four empty
      replies in six on `remove her glasses, then fox eyes`.
    */
    expect(REFINE_PARSE_MAX_TOKENS).toBeGreaterThanOrEqual(2000);
  });

  it("sends that ceiling on the WIRE, not merely near it", async () => {
    const engine = scripted([GOOD]);
    await interpretRefinement({
      instruction: "fox eyes",
      currentEyeColour: "brown",
      currentEyeShape: null,
      engine,
    });
    expect(engine.seen).toHaveLength(1);
    expect(engine.seen[0]!.maxOutputTokens).toBe(REFINE_PARSE_MAX_TOKENS);
  });

  it("retries an empty reply instead of calling her sentence unclear", async () => {
    /*
      THE SEQUENCE PRODUCTION ACTUALLY SAW. Two empty completions on 200s and
      then a good one. If the first empty became a refusal, a person with a
      perfectly clear instruction would be told it did not come through.
    */
    const engine = scripted(["EMPTY", "EMPTY", GOOD]);
    const parsed = await interpretRefinement({
      instruction: "fox eyes",
      currentEyeColour: "brown",
      currentEyeShape: null,
      engine,
    });
    expect(parsed.ok, "an empty reply is a transport event, not her mistake").toBe(true);
    expect(engine.seen.length, "it re-sampled rather than refusing").toBe(3);
  });

  it("still refuses honestly when every reading comes back empty", async () => {
    /*
      The other half, and it must stay: three empties in a row is a real outage,
      and inventing an answer for her would be worse than saying so. What the
      raised ceiling changes is how often this branch is reached, not whether
      it exists.
    */
    const engine = scripted(["EMPTY"]);
    const parsed = await interpretRefinement({
      instruction: "fox eyes",
      currentEyeColour: "brown",
      currentEyeShape: null,
      engine,
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.refusal.reason).toBe("unreadable");
  });
});

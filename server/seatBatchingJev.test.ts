/**
 * THE TIE-BREAKER'S OWN ARMS (#1281) — driven WITHOUT the model.
 *
 * Working law 3: if the only test of a gate runs through an LLM that usually
 * behaves, the gate is untested. So every decision below is driven on a
 * fabricated answer object, and the one that matters is the NEGATIVE control —
 * a correct choice one hundredth BELOW the gate, which must change nothing.
 *
 * Working law 2's other half, the live controls, lives in
 * `scripts/jev-seat-batching-check.mts`: a labelled set with known answers, run
 * against the real reader before its verdicts count for anything.
 */
import { describe, expect, it } from "vitest";

import {
  areaQuestion,
  areaVerdict,
  buildSeatCardState,
  dependencyQuestion,
  dependencyVerdict,
  jevSeatAsk,
  DEPENDENCY_NO,
  DEPENDENCY_YES,
  NO_AREA,
  SEAT_BATCHING_CONFIDENCE_GATE,
} from "../scripts/lib/jevSeatBatching.mts";

const answer = (choice: string, confidence: number) => ({ choice, confidence, probabilities: { [choice]: confidence } });

const DOMAINS = ["boards", "casting", "billing"];

describe("the gate is a NUMBER, pinned", () => {
  it("is 0.85, and every arm below would pass at 0.50 without this one", () => {
    /* ⚠ Every other arm here is written as `GATE ± 0.01`, so the gate could be
       set to 0.50 and the suite would stay green while the reader started acting
       on readings it has never been shown to be right at (review of 2026-09-26).
       The figure is borrowed from the category reader's live calibration and the
       module's docblock says so; this arm is the one place it is a fact. */
    expect(SEAT_BATCHING_CONFIDENCE_GATE).toBe(0.85);
  });

  it("refuses the reading the controls measured wrong, at the confidence they measured it", () => {
    /* The one MISS the live controls produced: a garment card read as `studio` at
       0.50. It must not be used, and this arm names the real number rather than
       an offset from the gate. */
    expect(areaVerdict(answer("studio", 0.5), DOMAINS).area).toBeNull();
    /* And the readings they got RIGHT below the gate are also refused — the
       stated trade, so a future run that lowers the gate breaks this arm and has
       to argue for it. */
    expect(areaVerdict(answer("casting", 0.74), DOMAINS).area).toBeNull();
    expect(areaVerdict(answer("billing", 0.95), DOMAINS).area).toBe("billing");
    expect(dependencyVerdict(answer(DEPENDENCY_NO, 0.86)).kind).toBe("independent");
  });
});

describe("what goes on the wire", () => {
  it("carries the title, the body and the cited cards — and no label", () => {
    const state = buildSeatCardState({
      number: 42,
      title: "A bug in the roll queue",
      body: "It is filed bug and casting-upkeep.",
      cites: [99, 12],
    });
    expect(state.card.title).toBe("A bug in the roll queue");
    expect(state.card.namesOpenCards).toEqual([12, 99]);
    /* The one leak this cannot close is the card's own prose, which belongs to
       the card — the same stated limit `jevCardCategory.mts` carries. What must
       never be here is a `labels` field. */
    expect(Object.keys(state.card)).toEqual(["title", "body", "namesOpenCards"]);
  });

  it("offers a two-way dependency choice, never a one-way question", () => {
    const question = dependencyQuestion();
    const options = Object.keys(Object.values(question)[0]!.criteria);
    expect(options.sort()).toEqual([DEPENDENCY_NO, DEPENDENCY_YES].sort());
  });

  it("derives the area options from the Atlas's domain list, plus a way out", () => {
    const options = Object.keys(Object.values(areaQuestion(DOMAINS))[0]!.criteria);
    expect(options).toEqual([...DOMAINS].sort().concat(NO_AREA));
  });
});

describe("the dependency gate", () => {
  it('offers the card when Jev says "no" above the gate', () => {
    const verdict = dependencyVerdict(answer(DEPENDENCY_NO, 0.93));
    expect(verdict.kind).toBe("independent");
  });

  it("HOLDS the card when Jev says it builds on another", () => {
    const verdict = dependencyVerdict(answer(DEPENDENCY_YES, 0.99));
    expect(verdict.kind).toBe("held");
  });

  it("NEGATIVE CONTROL — a correct answer one hundredth below the gate holds it", () => {
    const below = dependencyVerdict(answer(DEPENDENCY_NO, SEAT_BATCHING_CONFIDENCE_GATE - 0.01));
    expect(below.kind).toBe("held");
    expect(below.kind === "held" && below.why).toContain("below the");
    /* POSITIVE CONTROL, the same answer AT the gate: the arm above must be
       measuring the gate and not the choice. */
    expect(dependencyVerdict(answer(DEPENDENCY_NO, SEAT_BATCHING_CONFIDENCE_GATE)).kind).toBe("independent");
  });

  it("holds the card when Jev answers something that is neither option", () => {
    expect(dependencyVerdict(answer("maybe", 0.99)).kind).toBe("held");
  });
});

describe("the area gate", () => {
  it("takes a domain above the gate", () => {
    expect(areaVerdict(answer("casting", 0.91), DOMAINS).area).toBe("casting");
  });

  it("NEGATIVE CONTROL — a real domain below the gate gives NO area", () => {
    expect(areaVerdict(answer("casting", SEAT_BATCHING_CONFIDENCE_GATE - 0.01), DOMAINS).area).toBeNull();
    expect(areaVerdict(answer("casting", SEAT_BATCHING_CONFIDENCE_GATE), DOMAINS).area).toBe("casting");
  });

  it("gives no area for the explicit way out, and for a domain the Atlas does not have", () => {
    expect(areaVerdict(answer(NO_AREA, 0.99), DOMAINS).area).toBeNull();
    expect(areaVerdict(answer("invented", 0.99), DOMAINS).area).toBeNull();
  });
});

describe("when Jev cannot be reached", () => {
  const card = { number: 7, title: "t", body: "b", cites: [] };

  it("returns null and records the failure rather than throwing", async () => {
    const asker = jevSeatAsk({
      domains: DOMAINS,
      apiKey: "test-key-not-a-real-one",
      fetchImpl: (async () => {
        throw new Error("getaddrinfo ENOTFOUND api.typesafe.ai");
      }) as unknown as typeof fetch,
    });
    expect(await asker.dependency(card)).toBeNull();
    expect(await asker.area(card)).toBeNull();
    expect(asker.failure()).toContain("ENOTFOUND");
    expect(asker.readings).toEqual([]);
  });

  it("does not wedge on a reply that never comes — the ask carries a timeout", async () => {
    /* ⚠ The wedge the review measured: `askJev` passed no signal to `fetch`, and
       undici waits ~300 s on headers, so a loop over forty arealess cards was
       nearly three hours before a seat launched. Driven with a fetch that never
       resolves unless it is aborted, and a 50 ms ceiling, so the arm fails by
       TIMING OUT if the signal is ever dropped again. */
    const hanging: typeof fetch = ((_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted due to timeout")));
      })) as unknown as typeof fetch;

    const asker = jevSeatAsk({
      domains: DOMAINS,
      apiKey: "test-key-not-a-real-one",
      fetchImpl: hanging,
      timeoutMs: 50,
    });
    const started = Date.now();
    expect(await asker.dependency(card)).toBeNull();
    expect(asker.failure()).toMatch(/abort/i);
    expect(Date.now() - started).toBeLessThan(2_000);

    /* AND THE SECOND ASK COSTS NOTHING: one failure ends the asking, so a pass
       pays one timeout rather than one per card. */
    const beforeSecond = Date.now();
    expect(await asker.area(card)).toBeNull();
    expect(Date.now() - beforeSecond).toBeLessThan(40);
  });

  it("reads a real reply and records it for the digest", async () => {
    const asker = jevSeatAsk({
      domains: DOMAINS,
      apiKey: "test-key-not-a-real-one",
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          model: "jev-latest",
          answers: { buildsOnAnotherCard: { choice: DEPENDENCY_NO, confidence: 0.92, probabilities: {} } },
          usage: { input_tokens: 1200, output_tokens: 0 },
        }),
      })) as unknown as typeof fetch,
    });
    const verdict = await asker.dependency(card);
    expect(verdict?.kind).toBe("independent");
    expect(asker.readings).toHaveLength(1);
    expect(asker.readings[0]).toMatchObject({ card: 7, question: "dependency", answer: DEPENDENCY_NO, used: true });
    expect(asker.inputTokens()).toBe(1200);
    expect(asker.failure()).toBeNull();
  });

  it("records a below-gate answer as NOT used, so the relay can audit it", async () => {
    const asker = jevSeatAsk({
      domains: DOMAINS,
      apiKey: "test-key-not-a-real-one",
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          model: "jev-latest",
          answers: { buildsOnAnotherCard: { choice: DEPENDENCY_NO, confidence: 0.4, probabilities: {} } },
          usage: { input_tokens: 10, output_tokens: 0 },
        }),
      })) as unknown as typeof fetch,
    });
    await asker.dependency(card);
    expect(asker.readings[0]!.used).toBe(false);
  });
});

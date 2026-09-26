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

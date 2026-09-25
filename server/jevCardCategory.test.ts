import { describe, expect, it } from "vitest";

import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches";
import {
  JEV_ENDPOINT,
  JEV_MODEL,
  askJev,
  buildSystemOneRequest,
  jevSpendUsd,
  parseSystemOneReply,
} from "../scripts/lib/jev.mts";
import {
  CARD_CATEGORY_QUESTION_ID,
  NO_CATEGORY,
  assertCriteriaCover,
  bodyNamesItsOwnCategory,
  buildCardCategoryRequest,
  buildCardState,
  categoryCriteria,
  categoryQuestion,
} from "../scripts/lib/jevCardCategory.mts";

/**
 * THE JEV CARD-CATEGORY READER, DRIVEN (#1224 stage 1).
 *
 * His ruling, 2026-09-25: *"Where-ever jev can genuinely improve my agents
 * workflow it should be used."* This is the first use, and the shape it sets is
 * the one every later use takes — so the arms here are about the SHAPE as much
 * as about this reader: controls before verdicts (law 2), the question asserted
 * on the OUTGOING REQUEST rather than on a constant beside it (law 5), and a
 * population derived from the source of truth rather than mirrored (law 4).
 *
 * # WHY EVERY ARM READS `buildCardCategoryRequest` AND NOT A LOCAL COPY
 *
 * An assertion about "what Jev is asked" that reads a constant in this file
 * proves the constant, not the wire. Every arm below holds the object that
 * `JSON.stringify` will actually serialise into the POST body.
 *
 * # WHAT IS NOT HERE, AND WHY THAT IS THE POINT
 *
 * There are no arms for a WRITER, because no writer exists yet. Stage 2 — the
 * one that may apply a label to a card arriving with none — is gated on stage
 * 1's controls having run and been read, which is the card's own sequencing.
 * Building its threshold gate now would be a control nothing invokes
 * (invariant 7), so it ships with the writer or not at all.
 */
describe("the Jev wire", () => {
  it("builds the exact body that goes on the POST, model and all", () => {
    const request = buildSystemOneRequest({ card: { title: "t", body: "b" } }, categoryQuestion());
    expect(request.model).toBe(JEV_MODEL);
    expect(JEV_ENDPOINT).toBe("https://api.typesafe.ai/v1/systemone");
    /* The serialised form is what leaves the machine; a shape that looks right
       as an object and serialises wrongly is the failure this re-parse sees. */
    const onTheWire = JSON.parse(JSON.stringify(request));
    expect(Object.keys(onTheWire.questions)).toEqual([CARD_CATEGORY_QUESTION_ID]);
    expect(onTheWire.questions[CARD_CATEGORY_QUESTION_ID].type).toBe("choice");
  });

  it("refuses a question with fewer than two options — a choice of one is not a choice", () => {
    expect(() =>
      buildSystemOneRequest(
        {},
        { only: { type: "choice", instructions: "pick", criteria: { onlyOption: "the only one" } } },
      ),
    ).toThrow(/at least 2/);
  });

  it("refuses an option with no description, because the description IS the question", () => {
    expect(() =>
      buildSystemOneRequest(
        {},
        { q: { type: "choice", instructions: "pick", criteria: { a: "a thing", b: "   " } } },
      ),
    ).toThrow(/no description/);
  });

  it("refuses a request that asks nothing", () => {
    expect(() => buildSystemOneRequest({}, {})).toThrow(/asks nothing/);
  });
});

describe("the reply parser refuses rather than defaulting", () => {
  /* The positive control: the exact shape read off a real 200 from the API on
     the day this was built. Every refusal arm below is only evidence because
     this one passes — a parser that rejects everything is not strict, it is
     broken, and nothing else here would notice. */
  const realReply = {
    model: "jev-1.13.0",
    answers: {
      [CARD_CATEGORY_QUESTION_ID]: {
        type: "choice",
        choice: "bugs",
        confidence: 0.85,
        probabilities: { bugs: 0.88, process: 0.02, smallFixes: 0.08 },
      },
    },
    usage: { input_tokens: 522, output_tokens: 80 },
  };

  it("parses a real recorded reply, keeping confidence and the raw distribution apart", () => {
    const parsed = parseSystemOneReply(realReply, [CARD_CATEGORY_QUESTION_ID]);
    const answer = parsed.answers[CARD_CATEGORY_QUESTION_ID]!;
    expect(answer.choice).toBe("bugs");
    /* They are DIFFERENT NUMBERS and the reader keeps both. 0.85 calibrated
       against 0.88 raw, on the first live call this reader ever made. A parser
       that collapsed them would hide what the model nearly said instead. */
    expect(answer.confidence).toBe(0.85);
    expect(answer.probabilities.bugs).toBe(0.88);
    expect(parsed.usage.input_tokens).toBe(522);
  });

  it("refuses a reply whose answer carries no confidence", () => {
    const noConfidence = {
      ...realReply,
      answers: { [CARD_CATEGORY_QUESTION_ID]: { type: "choice", choice: "bugs" } },
    };
    expect(() => parseSystemOneReply(noConfidence, [CARD_CATEGORY_QUESTION_ID])).toThrow(/finite confidence/);
  });

  it("refuses a reply missing the question it was asked about", () => {
    expect(() => parseSystemOneReply({ answers: {} }, [CARD_CATEGORY_QUESTION_ID])).toThrow(/no answer/);
  });

  it("refuses a reply that is not an object at all", () => {
    expect(() => parseSystemOneReply("nope", [CARD_CATEGORY_QUESTION_ID])).toThrow(/not an object/);
  });
});

describe("the category question, asserted at the wire", () => {
  const request = buildCardCategoryRequest({ number: 7, title: "a title", body: "a body" });
  const question = request.questions[CARD_CATEGORY_QUESTION_ID]!;
  const options = Object.keys(question.criteria);

  it("offers EXACTLY every live work category plus one explicit way out", () => {
    /* Derived from the source of truth, not restated: a category added to
       `CREW_WORK_CATEGORIES` is asked about here with no edit to this arm, and
       one that silently vanished from the option list reddens. */
    expect(options).toEqual([...CREW_WORK_CATEGORIES.map((category) => category.key), NO_CATEGORY]);
  });

  it("gives every option a real description, because Jev answers on the criteria", () => {
    for (const option of options) {
      expect(question.criteria[option]!.trim().length).toBeGreaterThan(20);
    }
  });

  it("refuses a category that has no criterion — DRIVEN, not inferred", () => {
    /* ⚠ This arm replaced one that deleted a key from a COPY and then asserted
       the real builder was unaffected. It never executed the refusal, and the
       sabotage run proved it: neutering the guard left the suite green at 19.
       Working law 3 — a backstop needs a test the model cannot rescue, so the
       guard is a pure function and this drives it with the data that trips it. */
    expect(() => assertCriteriaCover(["bugs", "security"], ["bugs"])).toThrow(
      /category "security" has no criterion/,
    );
  });

  it("refuses a leftover criterion that names no live category", () => {
    expect(() => assertCriteriaCover(["bugs"], ["bugs", "ghosts"])).toThrow(
      /criterion "ghosts" names no live category/,
    );
  });

  it("passes the real tree — the positive control that makes the two refusals evidence", () => {
    /* Without this, a guard that threw on everything would satisfy both arms
       above while breaking the product. */
    expect(() => categoryCriteria()).not.toThrow();
    const firstKey = CREW_WORK_CATEGORIES[0]!.key;
    expect(Object.keys(categoryQuestion()[CARD_CATEGORY_QUESTION_ID]!.criteria)).toContain(firstKey);
  });

  it("states the tie-break in the SAME order the desk homes a card in", () => {
    /* `homeWorkCategoryFor` returns the first matching category in list order.
       A reader told to break ties some other way disagrees with the desk on
       exactly the cards where two categories fit, and every such difference
       reads as a finding about the LABEL when it is really a disagreement
       about the question. Measured: the first control run put a casting-road
       defect in `bugs` against a fixture expecting `castingUpkeep`, and the
       DESK agreed with Jev. Derived, so a reordering of the list moves both. */
    const order = CREW_WORK_CATEGORIES.map((category) => category.key).join(", then ");
    expect(question.instructions).toContain(order);
  });
});

describe("what the reader is NOT shown", () => {
  it("never puts the card's own labels on the wire", () => {
    /* A reader shown the answer agrees with it, and every agreement number
       this produces would be worthless. The state carries title and body only. */
    const state = buildCardState({ number: 1, title: "t", body: "b" });
    expect(Object.keys(state)).toEqual(["card"]);
    expect(Object.keys(state.card).sort()).toEqual(["body", "title"]);
    const serialised = JSON.stringify(buildCardCategoryRequest({ number: 1, title: "t", body: "b" }).state);
    for (const category of CREW_WORK_CATEGORIES) {
      expect(serialised).not.toContain(category.queueLabel);
    }
  });

  it("caps a long body rather than sending a whole novel", () => {
    const state = buildCardState({ number: 1, title: "t", body: "x".repeat(50_000) });
    expect(state.card.body.length).toBeLessThan(50_000);
  });

  it("measures the one leak it cannot close instead of claiming there is none", () => {
    /* A card's own prose may name its category, and that is the card's to
       write. It is REPORTED as a limit on the agreement figure rather than
       asserted away. */
    const naming = { number: 1, title: "A bug in the sheet", body: "filed under bug" };
    const quiet = { number: 2, title: "The sheet loses its order", body: "it goes wrong on reload" };
    expect(bodyNamesItsOwnCategory(naming, "bugs")).toBe(true);
    expect(bodyNamesItsOwnCategory(quiet, "bugs")).toBe(false);
    expect(bodyNamesItsOwnCategory(naming, null)).toBe(false);
  });
});

describe("askJev, driven against a fake transport", () => {
  it("sends the built request to the endpoint and returns the recorded answer", async () => {
    let sentUrl: string | null = null;
    let sentBody: unknown = null;
    let sentAuth: string | null = null;

    const reply = await askJev(
      buildCardState({ number: 9, title: "The gallery takes four seconds", body: "one query, measured" }),
      categoryQuestion(),
      {
        apiKey: "test-key-not-a-real-one",
        fetchImpl: (async (url: string, init: RequestInit) => {
          sentUrl = url;
          sentAuth = (init.headers as Record<string, string>).Authorization ?? null;
          sentBody = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => ({
              model: "jev-1.13.0",
              answers: {
                [CARD_CATEGORY_QUESTION_ID]: {
                  type: "choice",
                  choice: "performance",
                  confidence: 0.94,
                  probabilities: { performance: 0.94, bugs: 0.04 },
                },
              },
              usage: { input_tokens: 610, output_tokens: 80 },
            }),
          };
        }) as unknown as typeof fetch,
      },
    );

    expect(sentUrl).toBe(JEV_ENDPOINT);
    expect(sentAuth).toBe("Bearer test-key-not-a-real-one");
    /* Law 5 — the assertion is on the OUTGOING body, not on the constant that
       built it. What the model is actually asked is this, or the arm is prose. */
    const body = sentBody as { model: string; questions: Record<string, { criteria: Record<string, string> }> };
    expect(body.model).toBe(JEV_MODEL);
    expect(Object.keys(body.questions[CARD_CATEGORY_QUESTION_ID]!.criteria)).toEqual([
      ...CREW_WORK_CATEGORIES.map((category) => category.key),
      NO_CATEGORY,
    ]);

    const answer = reply.answers[CARD_CATEGORY_QUESTION_ID]!;
    expect(answer.choice).toBe("performance");
    expect(answer.confidence).toBe(0.94);
  });

  it("refuses to run with no key rather than sending an unauthenticated request", async () => {
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      await expect(
        askJev({}, categoryQuestion(), {
          fetchImpl: (async () => {
            throw new Error("a request was sent with no key");
          }) as unknown as typeof fetch,
        }),
      ).rejects.toThrow(/TYPESAFE_API_KEY/);
    } finally {
      if (previous !== undefined) process.env.TYPESAFE_API_KEY = previous;
    }
  });

  it("surfaces an API refusal with its status instead of returning a default answer", async () => {
    await expect(
      askJev({}, categoryQuestion(), {
        apiKey: "k",
        fetchImpl: (async () => ({
          ok: false,
          status: 422,
          statusText: "Unprocessable Entity",
          text: async () => "Input should be a valid dictionary",
        })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/422/);
  });
});

describe("the spend line", () => {
  it("prices a run from the tokens the API reports", () => {
    /* $0.042 per million input tokens; output free. The live read of the whole
       open queue was 105,138 input tokens — well under a cent, and stated from
       the API's own count rather than estimated. */
    expect(jevSpendUsd(1_000_000)).toBeCloseTo(0.042, 6);
    expect(jevSpendUsd(105_138)).toBeLessThan(0.01);
    expect(jevSpendUsd(0)).toBe(0);
  });
});

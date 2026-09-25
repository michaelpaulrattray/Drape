import { describe, expect, it } from "vitest";

import {
  CREW_LADDER_GROUP_KEYS,
  CREW_PIPELINE_GROUPS,
  pipelineGroupFor,
} from "../shared/crewPipelineGroups";
import { CREW_WORK_CATEGORIES, homeWorkCategoryFor } from "../shared/crewWorkSwitches";
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
  CARD_CATEGORY_WRITE_THRESHOLD,
  NO_CATEGORY,
  assertApplyThreshold,
  assertCriteriaCover,
  bodyNamesItsOwnCategory,
  buildCardCategoryRequest,
  buildCardState,
  assertQueueLabelsExist,
  categoryCriteria,
  categoryQuestion,
  decideCardFiling,
  filingComment,
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
 * # STAGE 2 ARRIVED 2026-09-25 AND ITS ARMS ARE AT THE FOOT OF THIS FILE
 *
 * This block read *"there are no arms for a WRITER, because no writer exists
 * yet"* for exactly one day, which was the correct state while stage 1's
 * controls were the only thing on the card. They have now run, been read, and
 * been calibrated against the live queue three times over, so the writer
 * exists — `scripts/jev-card-category-file.mts` — and its gate ships with the
 * arms that fire it rather than as a control nothing invokes (invariant 7).
 *
 * ⚠ **Its arms drive the DECISION, never the model.** The card asked for
 * exactly that, and it is working law 3: a threshold whose only test runs
 * through an LLM that usually behaves has not been tested.
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

/**
 * STAGE 2 — THE WRITER'S DECISION, DRIVEN DIRECTLY.
 *
 * ⚠ **Not one arm below goes near Jev, and that is the card's own requirement**
 * (*"stage 2 refuses to write below threshold — driven directly, not through
 * Jev"*, working law 3: a backstop whose only test runs through a model that
 * usually behaves is untested). `decideCardFiling` is a pure function over a
 * label list, a choice and a number, so every refusal is fired by handing it
 * the state that should fire it.
 *
 * The property worth the most here is not the threshold at all — it is that
 * **the writer cannot move a card between switches.** A card already carrying
 * a work label is refused before anything else is looked at, at any
 * confidence, for every one of the seven labels. That is what makes a wrong
 * filing cost one deleted label rather than a lost card.
 */
describe("the writer's decision (stage 2)", () => {
  const CONFIDENT = { labels: [] as string[], choice: "bugs", confidence: 0.97 };

  it("files a confident reading on a card that has no work label — the positive control", () => {
    const decision = decideCardFiling(CONFIDENT);
    expect(decision.act).toBe("file");
    expect(decision).toMatchObject({ category: "bugs", queueLabel: "bug" });
  });

  it("REFUSES to write below the threshold — the arm the card names", () => {
    const decision = decideCardFiling({ ...CONFIDENT, confidence: 0.84 });
    expect(decision).toMatchObject({ act: "skip", reason: "below threshold" });
    expect((decision as { detail: string }).detail).toContain("0.84");
  });

  it("treats the threshold as a floor a reading may sit exactly on", () => {
    expect(decideCardFiling({ ...CONFIDENT, confidence: CARD_CATEGORY_WRITE_THRESHOLD }).act).toBe("file");
    expect(decideCardFiling({ ...CONFIDENT, confidence: CARD_CATEGORY_WRITE_THRESHOLD - 0.0001 }).act).toBe("skip");
  });

  it("refuses a card that already carries ANY of the seven labels, at full confidence", () => {
    /* Derived from the source of truth: a category added there is refused here
       without anyone touching this arm. */
    for (const category of CREW_WORK_CATEGORIES) {
      const decision = decideCardFiling({ labels: [category.queueLabel], choice: "bugs", confidence: 1 });
      expect(decision, `a card carrying ${category.queueLabel} must be left alone`).toMatchObject({
        act: "skip",
        reason: "already filed",
      });
    }
  });

  it("checks 'already filed' BEFORE the threshold, so the safety property never depends on the number", () => {
    const decision = decideCardFiling({ labels: ["bug"], choice: "process", confidence: 0.01 });
    expect(decision).toMatchObject({ act: "skip", reason: "already filed" });
  });

  it("agrees with the desk about what 'already filed' means, label for label", () => {
    for (const category of CREW_WORK_CATEGORIES) {
      const labels = [category.queueLabel, "rung:N2", "founder-ordered"];
      expect(homeWorkCategoryFor(labels)).toBe(category.key);
      expect(decideCardFiling({ labels, choice: "bugs", confidence: 1 }).act).toBe("skip");
    }
  });

  it("files nothing when the reader declines the card", () => {
    expect(decideCardFiling({ ...CONFIDENT, choice: NO_CATEGORY })).toMatchObject({
      act: "skip",
      reason: "no category fits",
    });
  });

  it("refuses a choice that names no live category rather than handing it to gh", () => {
    expect(decideCardFiling({ ...CONFIDENT, choice: "seat:warden" })).toMatchObject({
      act: "skip",
      reason: "not a live category",
    });
    expect(decideCardFiling({ ...CONFIDENT, choice: "" })).toMatchObject({ act: "skip" });
  });

  it("files every category under its own queue label, derived rather than listed", () => {
    for (const category of CREW_WORK_CATEGORIES) {
      expect(decideCardFiling({ labels: [], choice: category.key, confidence: 0.99 })).toMatchObject({
        act: "file",
        category: category.key,
        queueLabel: category.queueLabel,
      });
    }
  });

  it("keeps the gate a real number, where the measurement put it", () => {
    expect(CARD_CATEGORY_WRITE_THRESHOLD).toBe(0.85);
    expect(CARD_CATEGORY_WRITE_THRESHOLD).toBeGreaterThan(0);
    expect(CARD_CATEGORY_WRITE_THRESHOLD).toBeLessThanOrEqual(1);
  });
});

describe("the writer refuses a run it cannot finish", () => {
  const everyLabel = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);

  it("passes when the repository has all seven — the positive control that makes the refusal evidence", () => {
    expect(() => assertQueueLabelsExist([...everyLabel, "urgent", "blocked"])).not.toThrow();
  });

  it("refuses when ANY one of them is missing, naming it", () => {
    for (const missing of everyLabel) {
      const present = everyLabel.filter((label) => label !== missing);
      expect(() => assertQueueLabelsExist(present), `a missing ${missing} must refuse`).toThrow(missing);
    }
  });

  it("refuses --apply at a lowered gate, and allows a raised one", () => {
    expect(() => assertApplyThreshold(true, 0.2)).toThrow(/refusing to WRITE/);
    expect(() => assertApplyThreshold(true, CARD_CATEGORY_WRITE_THRESHOLD)).not.toThrow();
    expect(() => assertApplyThreshold(true, 0.95)).not.toThrow();
    /* A report may be run at any gate — that is how the gate was measured. */
    expect(() => assertApplyThreshold(false, 0.2)).not.toThrow();
  });
});

describe("the comment a filed card gets", () => {
  it("names the category, the confidence and the gate, in the founder's own vocabulary", () => {
    const comment = filingComment("castingUpkeep", 0.93);
    expect(comment).toContain("Casting upkeep");
    expect(comment).toContain("casting-upkeep");
    expect(comment).toContain("0.93");
    expect(comment).toContain("0.85");
  });

  it("says what was NOT done, because that is the reversibility promise", () => {
    const comment = filingComment("bugs", 0.99);
    expect(comment).toContain("only ever ADDS");
    expect(comment).toContain("nothing was moved");
  });

  it("writes a comment for every category without a hole in the list", () => {
    for (const category of CREW_WORK_CATEGORIES) {
      const comment = filingComment(category.key, 0.9);
      expect(comment, `${category.key} must name its own label`).toContain(category.queueLabel);
    }
  });
});

/**
 * THE LADDER REFUSAL — the arm that stopped stage 2's first apply run.
 *
 * ⚠ **Its two specimens are real and confident.** #14 (the reference selector)
 * and #30 (the auto-discovery scan) are unbuilt product features carrying
 * `roadmap` and `rung:N3`, and Jev read both as `process` at 0.92 — above any
 * gate the correct readings beside them would survive. The refusal is
 * therefore structural and not a number.
 *
 * The population is DERIVED from `CREW_LADDER_GROUP_KEYS`, so a fifth ladder
 * group added there is refused here with no edit — and the arm below holds
 * that promise by walking the real list rather than a copy of it.
 */
describe("the writer never files a card the ladder draws", () => {
  const CONFIDENT = { choice: "process", confidence: 0.99 };

  it("refuses every group homed on the ladder, walking the real list", () => {
    for (const key of CREW_LADDER_GROUP_KEYS) {
      const group = CREW_PIPELINE_GROUPS.find((candidate) => candidate.key === key)!;
      /* The rung group has no `queueLabel` — it is matched on the prefix. */
      const labels = group.queueLabel !== null ? [group.queueLabel] : ["rung:N3"];
      expect(pipelineGroupFor(labels), `${key} must still be a ladder card`).toBe(key);
      expect(decideCardFiling({ ...CONFIDENT, labels }), `${key} must be left alone`).toMatchObject({
        act: "skip",
        reason: "on a road",
      });
    }
  });

  it("refuses #14 and #30 as they actually stand, at the confidence Jev actually gave them", () => {
    /* The measured specimens, not invented ones. */
    expect(decideCardFiling({ labels: ["debt", "roadmap", "rung:N3"], choice: "process", confidence: 0.92 })).toMatchObject(
      { act: "skip", reason: "on a road" },
    );
    expect(
      decideCardFiling({ labels: ["design-unbuilt", "roadmap", "rung:N3"], choice: "process", confidence: 0.92 }),
    ).toMatchObject({ act: "skip", reason: "on a road" });
  });

  it("still files an ordinary card — the positive control that makes the refusal evidence", () => {
    /* `debt` is homed `here`, not on the ladder: it is ordinary work. Without
       this arm a refusal that swallowed everything would pass the one above. */
    expect(pipelineGroupFor(["debt"])).toBe("debt");
    expect(decideCardFiling({ labels: ["debt"], choice: "process", confidence: 0.93 })).toMatchObject({
      act: "file",
      queueLabel: "seat:retro",
    });
    expect(decideCardFiling({ labels: [], choice: "process", confidence: 0.93 }).act).toBe("file");
  });

  it("checks the road BEFORE the reading, so a low confidence cannot disguise the reason", () => {
    const decision = decideCardFiling({ labels: ["roadmap"], choice: NO_CATEGORY, confidence: 0.01 });
    expect(decision).toMatchObject({ act: "skip", reason: "on a road" });
  });

  it("still puts 'already filed' first, because that is the reversibility promise", () => {
    expect(decideCardFiling({ labels: ["roadmap", "bug"], choice: "process", confidence: 0.99 })).toMatchObject({
      act: "skip",
      reason: "already filed",
    });
  });
});

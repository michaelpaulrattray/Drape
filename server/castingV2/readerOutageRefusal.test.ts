import { describe, expect, it } from "vitest";

import { ProviderError, type TextEngine, type TextRequest, type TextResult } from "../providers/types";
import { classifyOpenRouterTextHttp } from "../providers/openrouterText";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { REFINE_REFUSALS, REFUSAL_REASONS } from "./refineRefusals";
import { refusalIsAnswerableByAReader } from "./referenceWordsLane";
import { castingBriefCompiler } from "./briefCompiler";
import { READER_DOWN_MESSAGE } from "./briefRefusalCopy";
import { PICTURE_READER_DOWN_MESSAGE } from "./readerDown";
import { readHairColourFromReference } from "./hairColourFromReference";
import { readMakeupFromReference } from "./makeupFromReference";

/**
 * WHOSE FAULT IT WAS, SAID OUT LOUD — the #126 class on the roads it was not
 * swept onto (foreman-111, 2026-08-30).
 *
 * # What went wrong
 *
 * When a reader did not answer, three paid roads told the customer the story of
 * a DIFFERENT failure: that her own words, or her own photograph, could not be
 * read, and that she should change them.
 *
 *   refine          "That one didn't come through clearly. Try naming what you
 *                    want changed about them. Nothing was charged."
 *   hair / makeup   "We couldn't read that picture — try another one."
 *
 * Neither is advice she can act on when the failure is ours: she rephrases, or
 * swaps the photograph, and it fails again, and we blame her every time.
 *
 * The roll road already draws the line — `interpretBrief` reports
 * `cause: "thrown"` against `cause: "unparsed"`, and #126 (founder Crew reply
 * #7, verbatim "refuse-free"; reply #9, "always") refuses free NAMING THE
 * OUTAGE on the first while leaving the second where it was. #126's own class
 * sweep asked whether any other paid road DEGRADES on a reader failure and
 * correctly answered no: the refine road has always refused free. What it did
 * not ask is what those roads SAY, and the money being right the whole time is
 * why nobody looked.
 *
 * # Why it is driven, and why now
 *
 * Law 3: the branch is driven with a double that throws the exact error an
 * overdrawn account produces, never through a reader that usually behaves. The
 * classifier's own mapping is asserted here too, so the fixture cannot drift
 * from the product's idea of what a 402 is.
 *
 * The occasion was a measured number rather than a hunch: the OpenRouter
 * balance stood at $7.70 of $260 with the granted figure flat for three days
 * (#202), which is roughly two days of runway. At zero this stops being an edge
 * case — it is what EVERY customer sees on EVERY refine.
 *
 * # The positive controls are half the file
 *
 * The first shape of this reading shared one "healthy" double across both roads
 * and BOTH CONTROLS REFUSED — the reply was the wrong schema for either
 * interpreter, so the dry arms were indistinguishable from the controls and the
 * run proved nothing. Every arm below that asserts a refusal has a sibling
 * asserting the same code path does NOT refuse when the reader answers.
 */

const OVERDRAWN = () =>
  new ProviderError("provider_account", "openrouter 402 insufficient credits", { status: 402 });

/** Nothing comes back — the transport throws on every call. */
const dryAccount: TextEngine = {
  id: "test:dry-account",
  complete: async (): Promise<TextResult> => {
    throw OVERDRAWN();
  },
};

/**
 * NOTHING COMES BACK, AND THE NEXT TRY MIGHT — the other half of the split
 * (#2688).
 *
 * `dryAccount` above throws a `provider_account`, which is OUR key and which no
 * retry reaches. This throws a `timeout`, which is weather: the same ask a
 * minute later is a different reading, so *"try again in a moment"* is true of
 * it and must stay. Without this double the new sentence would be
 * indistinguishable from a blanket reword of every reader failure.
 */
const weather: TextEngine = {
  id: "test:weather",
  complete: async (): Promise<TextResult> => {
    throw new ProviderError("timeout", "the deadline fired", { status: 504 });
  },
};

/** A reply DOES come back — the other side of the line. */
function replying(text: string): TextEngine {
  return {
    id: "test:replying",
    complete: async (_request: TextRequest): Promise<TextResult> => ({
      text,
      provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
      latencyMs: 1,
    }),
  };
}

const FACE = { currentEyeColour: "brown", currentEyeShape: "almond" };
const SENTENCE = "make her eyes green";
const PARSES = JSON.stringify({ intent: "edit", eyeColour: "green" });
const NOT_JSON = "Sorry, I cannot help with that.";

describe("a 402 is what an overdrawn account produces", () => {
  it("classifies 402/401/403 as provider_account — the fixture is the product's own mapping", () => {
    expect(classifyOpenRouterTextHttp(402, "")).toBe("provider_account");
    expect(classifyOpenRouterTextHttp(401, "")).toBe("provider_account");
    expect(classifyOpenRouterTextHttp(403, "")).toBe("provider_account");
    expect(OVERDRAWN().failureClass).toBe("provider_account");
    /* Non-retryable, so the doomed calls below are the interpreter's own
       re-samples and not the transport's `withRetry` stacked on top of them. */
    expect(OVERDRAWN().retryable).toBe(false);
  });
});

describe("refine — the reader did not answer, and the refusal says so", () => {
  it("POSITIVE CONTROL: a reader that answers is not refused at all", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: replying(PARSES), ...FACE });
    expect(parse.ok).toBe(true);
  });

  /*
    ⚠ THESE ARMS ASSERTED `reader_outage` AND ITS *"try again in a moment"*
    UNTIL #2688, AND THE DOUBLE IS WHY THEY WERE WRONG.

    `dryAccount` throws a `provider_account` — an overdrawn or disabled key —
    which is the one reader failure no retry reaches. So this file was driving
    the ACCOUNT case and pinning the WEATHER sentence onto it: the arm below
    read `expect(said).toContain("Try again in a moment")` about a key that was
    off. The money was right the whole time, which is why nobody looked.

    What replaces them is a SPLIT and not a reword: the account arms take the
    new door, and the `weather` arm beneath keeps every byte of the old
    sentence. Delete either side and the change stops being readable.
  */
  it("refuses reader_down when the provider refused OUR account", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: dryAccount, ...FACE });
    expect(parse.ok).toBe(false);
    expect(!parse.ok && parse.refusal.reason).toBe("reader_down");
  });

  it("and the sentence blames US and does not promise a retry that cannot work", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: dryAccount, ...FACE });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    const said = refusalMessage(parse);
    /* Whose it is — the studio, said the way every other entrance says it. */
    expect(said).toContain("The studio");
    expect(said).toContain("not your words");
    expect(said).toContain("Nothing was charged");
    /* THE WHOLE CARD, AS THREE ASSERTIONS: it must not send them back to their
       own sentence, it must not ask for a retry a disabled key cannot honour,
       and it must say what they CAN do instead. */
    expect(said).not.toContain("Try naming");
    expect(said).not.toContain("in a moment");
    expect(said).toContain("Try again later");
  });

  it("WEATHER CONTROL: a deadline keeps reader_outage and keeps 'in a moment'", async () => {
    /*
      The arm that makes the two above a split rather than a blanket reword. A
      `timeout` reads differently on the next try, so its advice is true and
      not one byte of it moves.
    */
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: weather, ...FACE });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    expect(parse.refusal.reason).toBe("reader_outage");
    const said = refusalMessage(parse);
    expect(said).toContain("didn't answer");
    expect(said).toContain("Try again in a moment");
    expect(said).toContain("Nothing was charged");
    expect(said).not.toContain("Try naming");
  });

  it("KEEPS unreadable when a reply DID come back and could not be read", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: replying(NOT_JSON), ...FACE });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    expect(parse.refusal.reason).toBe("unreadable");
    /* Rephrasing is real advice for a reply we could not read. It stays. */
    expect(refusalMessage(parse)).toContain("Try naming");
  });

  it("no engine configured takes the same door — a deployment state, and no retry reaches it either", async () => {
    /* ⚠ `reader_outage` UNTIL #2688. A deployment with no reader at all is the
       same fact to the customer as a refused key, and it sat in the very same
       condition on the roll road — so it moved with it rather than being left
       for a later card to find (working law 7: the sweep is part of the fix). */
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: null, ...FACE });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    expect(parse.refusal.reason).toBe("reader_down");
    expect(refusalMessage(parse)).not.toContain("in a moment");
  });

  it("costs nothing, exactly as unreadable did — the money does not move", () => {
    /* BOTH doors, because #2688 split one into two and that card's whole claim
       is that nothing but the sentence moved. */
    for (const reason of ["reader_outage", "reader_down"] as const) {
      expect(REFINE_REFUSALS[reason].charge, reason).toBe("free");
      expect(REFINE_REFUSALS[reason].charge, reason).toBe(REFINE_REFUSALS.unreadable.charge);
      expect(REFINE_REFUSALS[reason].report, reason).toBe(REFINE_REFUSALS.unreadable.report);
      expect(REFUSAL_REASONS).toContain(reason);
    }
  });

  /*
    ⚠ THE THIRD STATE — a reply cut off at OUR ceiling (#1275, the named
    remainder of #1272).

    Driven rather than reasoned, and driven at the DOUBLE rather than by moving
    the ceiling: `truncated` is the transport's own `finish_reason === "length"`,
    so a fixture that sets it is the product's own signal and cannot drift from a
    number. Before this, a fragment fell through to the parse failure and she was
    told to try naming what she wanted changed — about a sentence that was never
    the problem, on a road she has paid for.
  */
  const TRUNCATED_FRAGMENT = '{"intent":"edit","eyeColour":"gre';

  function truncating(text: string): TextEngine {
    return {
      id: "test:truncating",
      complete: async (_request: TextRequest): Promise<TextResult> => ({
        text,
        provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
        latencyMs: 1,
        truncated: true,
      }),
    };
  }

  it("the fragment really is unparseable — the fixture is not doing the work", () => {
    /* Law 2 pointed at the fixture: if this string happened to parse, every arm
       below would be measuring the wrong branch and passing for it. */
    expect(() => JSON.parse(TRUNCATED_FRAGMENT)).toThrow();
  });

  it("refuses reader_outage when the reply was cut off at our ceiling", async () => {
    const parse = await interpretRefinement({
      instruction: SENTENCE,
      engine: truncating(TRUNCATED_FRAGMENT),
      ...FACE,
    });
    expect(parse.ok).toBe(false);
    expect(!parse.ok && parse.refusal.reason).toBe("reader_outage");
  });

  it("and the sentence blames US — our ceiling is not her wording", async () => {
    const parse = await interpretRefinement({
      instruction: SENTENCE,
      engine: truncating(TRUNCATED_FRAGMENT),
      ...FACE,
    });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    const said = refusalMessage(parse);
    expect(said).toContain("Try again in a moment");
    /* The whole card, as one assertion. */
    expect(said).not.toContain("Try naming");
  });

  it("NEGATIVE CONTROL: the SAME fragment without the flag still blames her, correctly", async () => {
    /*
      This is the arm that proves the flag is what moved her sentence, and not
      the fragment's shape. A reply we could not read, that the provider says it
      finished, genuinely may be her sentence — that side of the line is #126's
      and does not move.
    */
    const parse = await interpretRefinement({
      instruction: SENTENCE,
      engine: replying(TRUNCATED_FRAGMENT),
      ...FACE,
    });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    expect(parse.refusal.reason).toBe("unreadable");
    expect(refusalMessage(parse)).toContain("Try naming");
  });

  it("POSITIVE CONTROL: a truncated reply that STILL PARSES is used, not refused", async () => {
    /*
      ⚠ THE DIVERGENCE FROM #1272's EIGHT, ASSERTED RATHER THAN DESCRIBED.

      Those eight refuse the moment `truncated` is set, before parsing. This road
      does not, because the provider can finish the object and then hit the
      ceiling on trailing text, and `firstObject` returns the first BALANCED
      `{…}` — so on a paid road that is a reading that WORKS today. Refusing
      early would have turned a working edit into a refusal to buy a tidier
      branch. Without this arm the fix would be indistinguishable from the one
      that costs her the edit.
    */
    const parse = await interpretRefinement({
      instruction: SENTENCE,
      engine: truncating(PARSES),
      ...FACE,
    });
    expect(parse.ok).toBe(true);
  });

  it("is NOT answerable by a second reader — you do not re-ask a reader that is down", () => {
    /* `unreadable` IS on that list, and correctly: a sentence the interpreter
       could not file, with a picture attached, is exactly what a words-take
       read fixes. An outage is not, and routing one there would buy a second
       doomed call on a road that has already failed three times. */
    expect(refusalIsAnswerableByAReader("unreadable")).toBe(true);
    expect(refusalIsAnswerableByAReader("reader_outage")).toBe(false);
    /* And the new door even more so: re-asking a provider that refused our key
       buys a second doomed call. It is false by ALLOWLIST rather than by a rule
       about this reason (`ANSWERABLE_REFUSALS`), which is why it needed no edit
       there and does need this assertion. */
    expect(refusalIsAnswerableByAReader("reader_down")).toBe(false);
  });
});

describe("the roll road is where this sentence comes from — the two agree", () => {
  const BRIEF = "a woman in her 30s, nordic, blonde, with a severe minimal look";

  it("POSITIVE CONTROL: a reader that answers compiles", async () => {
    const compiled = await castingBriefCompiler({
      briefText: BRIEF,
      engine: replying(JSON.stringify({ cohort: "photoreal_human", role: "a woman", ageBand: "30s" })),
    } as Parameters<typeof castingBriefCompiler>[0]);
    expect(compiled).toBeTruthy();
  });

  it("refuses reader_down on the same double, free, before the claim", async () => {
    /* ⚠ `reader_outage` UNTIL #2688 — the same mis-pin as the refine arms
       above, from the same double, and it is the roll half of that card. */
    await expect(castingBriefCompiler({
      briefText: BRIEF,
      engine: dryAccount,
    } as Parameters<typeof castingBriefCompiler>[0])).rejects.toMatchObject({ code: "reader_down" });
  });

  it("WEATHER CONTROL: a deadline on the roll road still refuses reader_outage", async () => {
    await expect(castingBriefCompiler({
      briefText: BRIEF,
      engine: weather,
    } as Parameters<typeof castingBriefCompiler>[0])).rejects.toMatchObject({ code: "reader_outage" });
  });

  it("THE THREE ENTRANCES AGREE ON WHOSE IT IS AND ON WHAT TO DO — the sameness that must not drift", () => {
    /*
      Three entrances now say this one fact — about a brief, an edit and a
      picture — and a customer who meets two of them in one sitting is being
      told about ONE outage. What is held is the ATTRIBUTION and the ADVICE,
      never the whole sentence: each names its own noun, and the roll road adds
      "nothing was made" because something would have been.
    */
    const refine = REFINE_REFUSALS.reader_down.say();
    for (const said of [READER_DOWN_MESSAGE, refine, PICTURE_READER_DOWN_MESSAGE]) {
      expect(said).toContain("The studio can't read");
      expect(said).toContain("at our end");
      expect(said).toContain("Try again later");
      expect(said).not.toContain("in a moment");
      /* The disappearing-technology law's one hard line — no vendor, no engine
         and no status code on a path someone must walk to reach their picture. */
      expect(said).not.toMatch(/openrouter|gemini|fal\b|nano banana|sunburst|gpt|40[123]/i);
    }
    /* And the two paid-road sentences keep their money clause, which the
       concept door deliberately does not have (a concept read is house money). */
    expect(READER_DOWN_MESSAGE).toMatch(/not been charged/);
    expect(refine).toMatch(/[Nn]othing was charged/);
  });
});

describe("the reference readers — ours, not her photograph", () => {
  const PICTURE = { bytes: Buffer.from("not-really-an-image"), contentType: "image/png" };
  const HAIR_ANSWER = JSON.stringify({ present: true, sections: [{ where: "all", colour: "copper red" }] });
  const MAKEUP_ANSWER = JSON.stringify({ present: true, slots: {} });

  it("POSITIVE CONTROL: an answering reader never produces the outage sentence", async () => {
    const hair = await readHairColourFromReference({ ...PICTURE, engine: replying(HAIR_ANSWER) });
    const makeup = await readMakeupFromReference({ ...PICTURE, engine: replying(MAKEUP_ANSWER) });
    for (const outcome of [hair, makeup]) {
      if (!outcome.ok) expect(outcome.refusal.message).not.toContain("try again in a moment");
    }
  });

  it("hair: a thrown read says it was ours and does not ask for another photograph", async () => {
    const outcome = await readHairColourFromReference({ ...PICTURE, engine: dryAccount });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.message).toContain("just now");
    expect(outcome.refusal.message).not.toContain("try another one");
  });

  it("makeup: the same, on the sibling road that shared the sentence", async () => {
    const outcome = await readMakeupFromReference({ ...PICTURE, engine: dryAccount });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.message).toContain("just now");
    expect(outcome.refusal.message).not.toContain("try another one");
  });

  it("and BOTH keep 'try another one' for a reply that came back unreadable", async () => {
    const hair = await readHairColourFromReference({ ...PICTURE, engine: replying(NOT_JSON) });
    const makeup = await readMakeupFromReference({ ...PICTURE, engine: replying(NOT_JSON) });
    expect(hair.ok).toBe(false);
    expect(makeup.ok).toBe(false);
    if (hair.ok || makeup.ok) return;
    expect(hair.refusal.message).toContain("try another one");
    expect(makeup.refusal.message).toContain("try another one");
  });
});

describe("the class, as a rule rather than three instances", () => {
  it("every refine refusal that fires on a READER failure says the money is safe", () => {
    /*
      The population is derived from the registry rather than listed, so a
      fourth reader-failure refusal cannot ship without meeting this. `empty` is
      excluded by name and on purpose: it fires when she typed nothing at all,
      so asking her to say something is the only honest answer there.
    */
    const readerFailures = REFUSAL_REASONS.filter(
      (reason) => REFINE_REFUSALS[reason].report === "unread" && reason !== "empty",
    );
    expect(readerFailures).toContain("reader_outage");
    expect(readerFailures).toContain("unreadable");

    for (const reason of readerFailures) {
      const said = REFINE_REFUSALS[reason].say({ reason } as never, undefined as never);
      expect(said, reason).toMatch(/[Nn]othing was charged/);
    }
  });
});

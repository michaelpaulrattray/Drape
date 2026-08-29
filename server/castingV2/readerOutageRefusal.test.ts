import { describe, expect, it } from "vitest";

import { ProviderError, type TextEngine, type TextRequest, type TextResult } from "../providers/types";
import { classifyOpenRouterTextHttp } from "../providers/openrouterText";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { REFINE_REFUSALS, REFUSAL_REASONS } from "./refineRefusals";
import { refusalIsAnswerableByAReader } from "./referenceWordsLane";
import { castingBriefCompiler } from "./briefCompiler";
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

  it("refuses reader_outage when nothing came back", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: dryAccount, ...FACE });
    expect(parse.ok).toBe(false);
    expect(!parse.ok && parse.refusal.reason).toBe("reader_outage");
  });

  it("and the sentence blames US, not her — no instruction to rephrase", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: dryAccount, ...FACE });
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    const said = refusalMessage(parse);
    expect(said).toContain("didn't answer");
    expect(said).toContain("Try again in a moment");
    expect(said).toContain("Nothing was charged");
    /* The whole defect, as one assertion: the outage must never wear the
       unreadable sentence's advice. */
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

  it("no engine configured is an outage too — a deployment state, not her sentence", async () => {
    const parse = await interpretRefinement({ instruction: SENTENCE, engine: null, ...FACE });
    expect(parse.ok).toBe(false);
    expect(!parse.ok && parse.refusal.reason).toBe("reader_outage");
  });

  it("costs nothing, exactly as unreadable did — the money does not move", () => {
    expect(REFINE_REFUSALS.reader_outage.charge).toBe("free");
    expect(REFINE_REFUSALS.reader_outage.charge).toBe(REFINE_REFUSALS.unreadable.charge);
    expect(REFINE_REFUSALS.reader_outage.report).toBe(REFINE_REFUSALS.unreadable.report);
    expect(REFUSAL_REASONS).toContain("reader_outage");
  });

  it("is NOT answerable by a second reader — you do not re-ask a reader that is down", () => {
    /* `unreadable` IS on that list, and correctly: a sentence the interpreter
       could not file, with a picture attached, is exactly what a words-take
       read fixes. An outage is not, and routing one there would buy a second
       doomed call on a road that has already failed three times. */
    expect(refusalIsAnswerableByAReader("unreadable")).toBe(true);
    expect(refusalIsAnswerableByAReader("reader_outage")).toBe(false);
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

  it("refuses reader_outage on the same double, free, before the claim", async () => {
    await expect(castingBriefCompiler({
      briefText: BRIEF,
      engine: dryAccount,
    } as Parameters<typeof castingBriefCompiler>[0])).rejects.toMatchObject({ code: "reader_outage" });
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

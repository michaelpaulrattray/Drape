/**
 * The refusal loop's slice 2 (#129): the patrol's reader, driven before its
 * verdicts are quoted anywhere.
 *
 * ⚠ **THIS SUITE IS WORKING LAW 2 AND NOT A FORMALITY.** *"A new metric, reader
 * or checker gets a negative control and a positive control before its verdicts
 * count for anything."* The reader's whole job is to decide what may enter the
 * author's rewrite list, so a reader that cannot refuse would launder a guess
 * into his instruction. Every bar below therefore has both arms — a corpus the
 * bar must admit and a corpus it must refuse — and the refusals are the arms
 * that matter.
 *
 * The run this suite stands behind is patrol run #4, recorded in
 * `docs/specs/REFUSAL_PATROL_2026-08-27.md`.
 */
import { describe, expect, it } from "vitest";

import {
  MIN_REFUSED_TEXTS,
  censusCorpus,
  identicalTextOutcomes,
  measuredPairVerdict,
  parseRefusalLoopKey,
  promptHash,
  tokenisePrompt,
  triggerCandidates,
  vocabularyReach,
  wordEvidence,
  type RefusalLoopEntry,
} from "./refusalLoopCorpus";
import { refusalLoopKey } from "./refusalLoopCapture";

/** A slice, hashed the way the capture hashes it so no arm can disagree by accident. */
function slice(input: {
  operationId: string;
  candidate: string;
  outcome: "refused" | "passed";
  prompt: string;
  userId?: number;
}): RefusalLoopEntry {
  return {
    userId: input.userId ?? 1,
    operationId: input.operationId,
    candidatePublicId: input.candidate,
    outcome: input.outcome,
    prompt: input.prompt,
    promptSha256: promptHash(input.prompt),
  };
}

/**
 * ONE ROLL, ONE TEXT, EIGHT SLICES — the author road's real shape (run #1 §2,
 * `distinctPrompts = 1`). The fixture every pseudo-replication arm is built on.
 */
function oneRollOneText(input: {
  operationId: string;
  prompt: string;
  refused: number;
  passed: number;
}): RefusalLoopEntry[] {
  const entries: RefusalLoopEntry[] = [];
  for (let index = 0; index < input.refused; index += 1) {
    entries.push(slice({
      operationId: input.operationId,
      candidate: `${input.operationId}-r${index}`,
      outcome: "refused",
      prompt: input.prompt,
    }));
  }
  for (let index = 0; index < input.passed; index += 1) {
    entries.push(slice({
      operationId: input.operationId,
      candidate: `${input.operationId}-p${index}`,
      outcome: "passed",
      prompt: input.prompt,
    }));
  }
  return entries;
}

describe("parseRefusalLoopKey — the inverse of the real builder", () => {
  /*
    A ROUND TRIP, not two shapes agreeing on paper (working law 4). A parser
    written from the format's description is a second copy of the format, and
    the builder is free to move without this file noticing.
  */
  it("round-trips every field through refusalLoopKey itself", () => {
    for (const outcome of ["refused", "passed"] as const) {
      const input = {
        userId: 1,
        operationId: "op_01JABCDEF",
        candidatePublicId: "cand_9f8e7d6c",
        outcome,
      };
      const parsed = parseRefusalLoopKey(refusalLoopKey(input));
      expect(parsed).toEqual(input);
    }
  });

  it("round-trips a candidate id carrying dots, which the leaf pattern must not eat", () => {
    const input = {
      userId: 42,
      operationId: "op_x",
      candidatePublicId: "cand.with.dots",
      outcome: "refused" as const,
    };
    expect(parseRefusalLoopKey(refusalLoopKey(input))).toEqual(input);
  });

  /* The negative controls: every one of these must be refused, not guessed at. */
  it.each([
    ["another prefix entirely", "casting-v2/diagnostics/1/op/cand.refused.json"],
    ["no outcome in the leaf", "casting-v2/refusal-loop/1/op/cand.json"],
    ["an outcome nobody writes", "casting-v2/refusal-loop/1/op/cand.skipped.json"],
    ["a non-numeric owner", "casting-v2/refusal-loop/me/op/cand.refused.json"],
    ["owner zero", "casting-v2/refusal-loop/0/op/cand.refused.json"],
    ["a missing segment", "casting-v2/refusal-loop/1/cand.refused.json"],
    ["an extra segment", "casting-v2/refusal-loop/1/op/more/cand.refused.json"],
    ["an empty candidate", "casting-v2/refusal-loop/1/op/.refused.json"],
  ])("refuses %s", (_label, key) => {
    expect(parseRefusalLoopKey(key)).toBeNull();
  });
});

describe("tokenisePrompt", () => {
  it("lowercases, splits on punctuation and de-duplicates", () => {
    expect([...tokenisePrompt("Porcelain skin; PORCELAIN again, porcelain.")]).toEqual(["porcelain", "skin", "again"]);
  });

  it("keeps an inner hyphen and drops an outer one", () => {
    expect([...tokenisePrompt("mid-torso — -crop-")]).toEqual(["mid-torso", "crop"]);
  });

  it("returns nothing for words-free text rather than an empty-string token", () => {
    expect([...tokenisePrompt("  ;,.—  ")]).toEqual([]);
  });
});

describe("censusCorpus — the gap between objects and evidence", () => {
  it("separates slices from distinct texts, and names the coin", () => {
    const corpus = [
      ...oneRollOneText({ operationId: "op-a", prompt: "a weathered fisherman", refused: 5, passed: 3 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "a quiet counter clerk", refused: 1, passed: 7 }),
    ];
    const census = censusCorpus(corpus);
    expect(census.slices).toBe(16);
    expect(census.refusedSlices).toBe(6);
    expect(census.passedSlices).toBe(10);
    expect(census.operations).toBe(2);
    /* SIXTEEN OBJECTS, TWO PIECES OF EVIDENCE. The whole reason for the module. */
    expect(census.distinctTexts).toBe(2);
    expect(census.singleTextOperations).toBe(2);
    expect(census.coinOperations).toBe(2);
    expect(census.users).toEqual([1]);
  });

  it("does not call an operation a coin when its one text only ever refused", () => {
    const census = censusCorpus(oneRollOneText({
      operationId: "op-c",
      prompt: "something refused throughout",
      refused: 8,
      passed: 0,
    }));
    expect(census.singleTextOperations).toBe(1);
    expect(census.coinOperations).toBe(0);
    expect(census.passedTexts).toBe(0);
  });

  it("counts an operation with two texts as neither single-text nor a coin", () => {
    const census = censusCorpus([
      slice({ operationId: "op-d", candidate: "c1", outcome: "refused", prompt: "first text" }),
      slice({ operationId: "op-d", candidate: "c2", outcome: "passed", prompt: "second text" }),
    ]);
    expect(census.operations).toBe(1);
    expect(census.distinctTexts).toBe(2);
    expect(census.singleTextOperations).toBe(0);
    expect(census.coinOperations).toBe(0);
  });

  it("reads an empty corpus as empty rather than throwing", () => {
    expect(censusCorpus([])).toMatchObject({ slices: 0, operations: 0, distinctTexts: 0, coinOperations: 0 });
  });
});

describe("identicalTextOutcomes — run #1's coin, made mechanical", () => {
  it("reports a text that both refused and delivered, with both counts", () => {
    const rows = identicalTextOutcomes(oneRollOneText({
      operationId: "op-222",
      prompt: "the cyber-goth brief",
      refused: 5,
      passed: 3,
    }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refusedSlices: 5, passedSlices: 3, operationIds: ["op-222"] });
  });

  it("sees one text across two operations as ONE coin", () => {
    const rows = identicalTextOutcomes([
      slice({ operationId: "op-1", candidate: "a", outcome: "refused", prompt: "same words" }),
      slice({ operationId: "op-2", candidate: "b", outcome: "passed", prompt: "same words" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.operationIds).toEqual(["op-1", "op-2"]);
  });

  /* THE NEGATIVE CONTROL: a corpus with no coin must report none. */
  it("reports nothing when no text ever carried both outcomes", () => {
    expect(identicalTextOutcomes([
      slice({ operationId: "op-1", candidate: "a", outcome: "refused", prompt: "refused words" }),
      slice({ operationId: "op-1", candidate: "b", outcome: "passed", prompt: "delivered words" }),
    ])).toEqual([]);
  });
});

describe("wordEvidence — distinct texts are the n, slices ride along", () => {
  it("counts one roll's eight slices as ONE refused text", () => {
    const evidence = wordEvidence(oneRollOneText({
      operationId: "op-a",
      prompt: "porcelain bald gaunt",
      refused: 5,
      passed: 0,
    }));
    expect(evidence.get("porcelain")).toMatchObject({
      refusedTexts: 1,
      refusedSlices: 5,
      refusedOperations: 1,
      passedTexts: 0,
    });
  });

  it("counts the same word across two rolls as two refused texts", () => {
    const evidence = wordEvidence([
      ...oneRollOneText({ operationId: "op-a", prompt: "porcelain skin", refused: 3, passed: 0 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "porcelain mask", refused: 2, passed: 0 }),
    ]);
    expect(evidence.get("porcelain")).toMatchObject({ refusedTexts: 2, refusedSlices: 5, refusedOperations: 2 });
    expect(evidence.get("skin")).toMatchObject({ refusedTexts: 1 });
  });
});

describe("triggerCandidates — the left half of his bar", () => {
  /*
    THE POSITIVE CONTROL. `porcelain` is refused in two distinct texts and
    delivered in none, so it must be offered. If this arm cannot pass, the
    reader can never find anything and a green suite would mean nothing.
  */
  it("offers a word refused in two distinct texts and delivered in none", () => {
    const candidates = triggerCandidates([
      ...oneRollOneText({ operationId: "op-a", prompt: "porcelain skin", refused: 3, passed: 0 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "porcelain mask", refused: 2, passed: 0 }),
      ...oneRollOneText({ operationId: "op-c", prompt: "a weathered fisherman", refused: 0, passed: 8 }),
    ]);
    expect(candidates.map((row) => row.word)).toContain("porcelain");
    expect(candidates.find((row) => row.word === "porcelain")).toMatchObject({ refusedTexts: 2, passedTexts: 0 });
  });

  /*
    THE NEGATIVE CONTROL THAT MATTERS MOST — pseudo-replication. One roll,
    one text, eight refused slices. Slice-counting would read n = 8 and clear
    the bar four times over on a single observation; the reader must offer
    NOTHING.
  */
  it("offers nothing from one roll, however many of its slices refused", () => {
    expect(triggerCandidates(oneRollOneText({
      operationId: "op-222",
      prompt: "porcelain bald gaunt severe bone structure",
      refused: 8,
      passed: 0,
    }))).toEqual([]);
  });

  /* And the arm that proves the sentence above is about the TEXT, not the roll. */
  it("offers nothing when two refused texts come from one roll's two slices of the same words", () => {
    const sameWords = "porcelain bald";
    expect(triggerCandidates([
      slice({ operationId: "op-a", candidate: "c1", outcome: "refused", prompt: sameWords }),
      slice({ operationId: "op-a", candidate: "c2", outcome: "refused", prompt: sameWords }),
    ])).toEqual([]);
  });

  /*
    THE COIN'S NEGATIVE CONTROL: a word inside a text that was also delivered
    is excluded by `passedTexts === 0` alone, with no second rule to drift.
  */
  it("excludes every word of a text that both refused and passed", () => {
    /*
      `porcelain` and `skin` each clear the n bar on their own — refused in two
      distinct texts — and are excluded ONLY because one of those texts was
      also delivered. `again` is the proof the bar is still live in the same
      corpus: two refused texts, never delivered, so it is offered.
    */
    expect(triggerCandidates([
      ...oneRollOneText({ operationId: "op-a", prompt: "porcelain skin", refused: 4, passed: 4 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "porcelain skin again", refused: 2, passed: 0 }),
      ...oneRollOneText({ operationId: "op-c", prompt: "porcelain again, elsewhere", refused: 2, passed: 0 }),
    ]).map((row) => row.word)).toEqual(["again"]);
  });

  it("reads the bar from MIN_REFUSED_TEXTS and lets a run tighten it", () => {
    const corpus = [
      ...oneRollOneText({ operationId: "op-a", prompt: "porcelain skin", refused: 1, passed: 0 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "porcelain mask", refused: 1, passed: 0 }),
    ];
    expect(MIN_REFUSED_TEXTS).toBe(2);
    expect(triggerCandidates(corpus).map((row) => row.word)).toContain("porcelain");
    expect(triggerCandidates(corpus, { minRefusedTexts: 3 })).toEqual([]);
  });

  it("offers nothing from an empty corpus", () => {
    expect(triggerCandidates([])).toEqual([]);
  });
});

describe("vocabularyReach — the run's own positive control", () => {
  /*
    THE ARM THAT MAKES A ZERO READABLE. Without this, a reader that tokenised
    nothing reports the same "0 candidates" as a reader that measured a total
    coin — the inert-instrument failure, caught here rather than in a run.
  */
  it("reports the words it held, and how many refused words were also delivered", () => {
    const reach = vocabularyReach([
      ...oneRollOneText({ operationId: "op-a", prompt: "porcelain skin", refused: 4, passed: 4 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "a weathered fisherman", refused: 0, passed: 8 }),
    ]);
    expect(reach.distinctWords).toBe(5);
    expect(reach.refusedWords).toBe(2);
    /* Both refused words sit on a coin text, so both were also delivered. */
    expect(reach.refusedWordsAlsoDelivered).toBe(2);
  });

  it("separates a genuinely refused-only word from the coin", () => {
    const reach = vocabularyReach([
      ...oneRollOneText({ operationId: "op-a", prompt: "porcelain skin", refused: 4, passed: 4 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "gaunt", refused: 2, passed: 0 }),
    ]);
    expect(reach.refusedWords).toBe(3);
    expect(reach.refusedWordsAlsoDelivered).toBe(2);
  });

  it("reads an empty corpus as zero words rather than throwing", () => {
    expect(vocabularyReach([])).toEqual({
      distinctWords: 0,
      refusedWords: 0,
      refusedWordsAlsoDelivered: 0,
    });
  });
});

describe("measuredPairVerdict — THE GATE on his rewrite list", () => {
  /** A corpus where `sternum` only ever refused and `collarbones` only ever passed. */
  const pairCorpus = [
    ...oneRollOneText({ operationId: "op-a", prompt: "the crop just below the sternum", refused: 2, passed: 0 }),
    ...oneRollOneText({ operationId: "op-b", prompt: "a sternum crop, again", refused: 2, passed: 0 }),
    ...oneRollOneText({ operationId: "op-c", prompt: "a crop at the collarbones", refused: 0, passed: 4 }),
    ...oneRollOneText({ operationId: "op-d", prompt: "collarbones, second brief", refused: 0, passed: 4 }),
  ];

  /* THE POSITIVE CONTROL — #125's real pair, in the shape the corpus would hold it. */
  it("admits a pair whose word refused in two texts and whose replacement passed in two", () => {
    const verdict = measuredPairVerdict(pairCorpus, { word: "sternum", replacement: "collarbones" });
    expect(verdict.admitted).toBe(true);
    expect(verdict.reason).toBeUndefined();
    expect(verdict.word).toMatchObject({ refusedTexts: 2, passedTexts: 0 });
    expect(verdict.replacement).toMatchObject({ passedTexts: 2 });
  });

  it("is case-insensitive about the proposal, because the corpus is lowercased", () => {
    expect(measuredPairVerdict(pairCorpus, { word: "STERNUM", replacement: "Collarbones" }).admitted).toBe(true);
  });

  /* Every refusal arm names its own half of the bar. */
  it("refuses when the word is short of two refused texts", () => {
    const verdict = measuredPairVerdict([
      ...oneRollOneText({ operationId: "op-a", prompt: "the sternum crop", refused: 1, passed: 0 }),
      ...oneRollOneText({ operationId: "op-c", prompt: "a crop at the collarbones", refused: 0, passed: 4 }),
      ...oneRollOneText({ operationId: "op-d", prompt: "collarbones, second brief", refused: 0, passed: 4 }),
    ], { word: "sternum", replacement: "collarbones" });
    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toContain("refused in 1 distinct text(s)");
  });

  /*
    AND IT SAYS SO WHEN THE SHORTFALL IS HIDING BEHIND SLICE COUNTS — the
    error this module exists to make impossible, quoted back at whoever
    proposed the pair.
  */
  it("names pseudo-replication in the refusal when one roll's slices look like n", () => {
    const verdict = measuredPairVerdict([
      ...oneRollOneText({ operationId: "op-a", prompt: "the sternum crop", refused: 8, passed: 0 }),
      ...oneRollOneText({ operationId: "op-c", prompt: "a crop at the collarbones", refused: 0, passed: 4 }),
      ...oneRollOneText({ operationId: "op-d", prompt: "collarbones, second brief", refused: 0, passed: 4 }),
    ], { word: "sternum", replacement: "collarbones" });
    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toContain("one roll's text counted more than once");
  });

  it("refuses when the word was also delivered", () => {
    const verdict = measuredPairVerdict([
      ...pairCorpus,
      ...oneRollOneText({ operationId: "op-e", prompt: "a sternum that was delivered twice over", refused: 0, passed: 2 }),
      ...oneRollOneText({ operationId: "op-f", prompt: "another delivered sternum brief", refused: 0, passed: 2 }),
    ], { word: "sternum", replacement: "collarbones" });
    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toContain("also DELIVERED");
  });

  it("refuses when the replacement has never been delivered twice", () => {
    const verdict = measuredPairVerdict([
      ...oneRollOneText({ operationId: "op-a", prompt: "the crop just below the sternum", refused: 2, passed: 0 }),
      ...oneRollOneText({ operationId: "op-b", prompt: "a sternum crop, again", refused: 2, passed: 0 }),
      ...oneRollOneText({ operationId: "op-c", prompt: "a crop at the collarbones", refused: 0, passed: 4 }),
    ], { word: "sternum", replacement: "collarbones" });
    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toContain("the replacement was delivered in 1 distinct text(s)");
  });

  it("refuses a replacement the corpus has never seen at all", () => {
    const verdict = measuredPairVerdict(pairCorpus, { word: "sternum", replacement: "clavicle" });
    expect(verdict.admitted).toBe(false);
    expect(verdict.replacement).toMatchObject({ passedTexts: 0, refusedTexts: 0 });
  });

  it("refuses a word proposed as its own replacement", () => {
    const verdict = measuredPairVerdict(pairCorpus, { word: "sternum", replacement: "sternum" });
    expect(verdict.admitted).toBe(false);
    expect(verdict.reason).toContain("the same word");
  });

  /*
    THE ARM THAT KEEPS THIS A CHECK. Item 4 — the author APPLYING the list — is
    deferred on the card, so an admitted verdict must change nothing anywhere.
  */
  it("is a verdict and not a write — the corpus it judged is untouched", () => {
    const corpus = [...pairCorpus];
    const before = JSON.stringify(corpus);
    measuredPairVerdict(corpus, { word: "sternum", replacement: "collarbones" });
    expect(JSON.stringify(corpus)).toBe(before);
  });
});

describe("the reader never returns a sentence", () => {
  /*
    The capture's own line — *"the words themselves never reach a log line"* —
    read at this half. A composed prompt is the `masterPrompt` class, so what
    leaves here is counts, hashes and single words that met a stated bar.
  */
  it("returns no prompt text from any public reader", () => {
    const prompt = "a weathered fisherman, north atlantic, sixty, porcelain skin";
    const corpus = [
      ...oneRollOneText({ operationId: "op-a", prompt, refused: 3, passed: 0 }),
      ...oneRollOneText({ operationId: "op-b", prompt: `${prompt} again`, refused: 2, passed: 0 }),
    ];
    const printed = JSON.stringify([
      censusCorpus(corpus),
      identicalTextOutcomes(corpus),
      triggerCandidates(corpus),
      measuredPairVerdict(corpus, { word: "porcelain", replacement: "fisherman" }),
      [...wordEvidence(corpus).values()],
    ]);
    expect(printed).not.toContain("weathered fisherman");
    expect(printed).not.toContain("north atlantic");
    expect(printed).not.toContain(prompt);
  });
});

/**
 * The class gate, driven directly — the door, not the reader.
 *
 * Working law 3: the guard is driven with its own inputs rather than through a
 * model that usually behaves. What a REAL reader answers when handed a real
 * out-of-class photograph is a different question, bought on real specimens in
 * both directions by `scripts/court-out-of-class-disposable.mts`.
 *
 * The arm this file exists for is the substring trap: *"not cosmetics"*
 * contains `cosmetics`, so a gate written with `includes` would admit the exact
 * sentence it was built to refuse. That is a false pass wearing the shape of a
 * pass, and it would be invisible in every green suite.
 */
import { describe, expect, it } from "vitest";

import {
  readReferenceClass,
  referenceClassAskLines,
  referenceClassVocabulary,
} from "./referenceClassGate";
import { REFERENCE_INTENTS } from "../../shared/referenceIntents";

describe("readReferenceClass — makeup", () => {
  it("admits the in-class word, with or without the politeness a model adds", () => {
    for (const answer of ["cosmetics", "Cosmetics.", " COSMETICS ", "it is cosmetics", "the cosmetics"]) {
      expect(readReferenceClass("makeup", answer), answer).toEqual({ kind: "inClass" });
    }
  });

  it("does NOT admit a negation that merely contains the word", () => {
    /*
      THE ARM THIS FILE EXISTS FOR. `includes` would pass every one of these,
      and each is a sentence the door was built to stop.
    */
    for (const answer of ["not cosmetics", "no cosmetics", "these are not cosmetics"]) {
      expect(readReferenceClass("makeup", answer), answer).not.toEqual({ kind: "inClass" });
    }
  });

  it("names each out-of-class answer it was offered", () => {
    expect(readReferenceClass("makeup", "prosthetics")).toEqual({ kind: "outOfClass", named: "prosthetics" });
    expect(readReferenceClass("makeup", "a mask")).toEqual({ kind: "outOfClass", named: "mask" });
    /* Normalisation earns its keep: a model writes `body-paint` about as often
       as it writes `body paint`. */
    expect(readReferenceClass("makeup", "body-paint")).toEqual({ kind: "outOfClass", named: "body paint" });
    expect(readReferenceClass("makeup", "digital effect")).toEqual({ kind: "outOfClass", named: "digital effect" });
  });

  it("reads the empty answer as NOTHING, which is not the same as out of class", () => {
    /*
      Two different facts and two different sentences: *there is no makeup on
      this face* is the road's existing empty answer, and *this is not a face
      wearing makeup at all* is this door's. Merging them would hand a customer
      with a bare-faced reference the wrong explanation.
    */
    expect(readReferenceClass("makeup", "nothing")).toEqual({ kind: "nothing" });
  });

  it("reads anything it was not offered as UNANSWERED, never as in-class", () => {
    /* Admission is positive. A word off the list is a question this door could
       not judge — and the caller spends `unreadable` on it rather than a claim
       about the face. */
    for (const answer of ["a photograph", "unsure", "", "   ", null, undefined, 7, {}]) {
      expect(readReferenceClass("makeup", answer), JSON.stringify(answer)).toEqual({ kind: "unanswered" });
    }
  });
});

describe("the vocabulary a road has not bought yet", () => {
  it("is total over the ruled intent vocabulary, so a new road cannot skip the question", () => {
    /* Law 4 in the type: the map is a `Record` over every intent, so opening
       hair means answering this rather than inheriting a blank. */
    for (const intent of REFERENCE_INTENTS) {
      expect(referenceClassVocabulary(intent), intent).toBeDefined();
    }
  });

  it("declares makeup and only makeup — nothing else has specimens yet", () => {
    const declared = REFERENCE_INTENTS.filter((intent) => referenceClassVocabulary(intent).declared);
    expect(declared).toEqual(["makeup"]);
  });

  it("refuses to compose an ask out of a vocabulary nobody decided", () => {
    /* A programming error, and loud: a prompt built from a blank list would ask
       the reader to pick from nothing and admit whatever came back. */
    expect(() => referenceClassAskLines("tattoo")).toThrow(/no class vocabulary/i);
  });

  it("answers UNANSWERED for an undeclared road rather than admitting it", () => {
    expect(readReferenceClass("tattoo", "tattoo")).toEqual({ kind: "unanswered" });
  });
});

describe("referenceClassAskLines", () => {
  it("names every answer the door accepts, derived from the vocabulary", () => {
    /*
      THE MECHANISM, ASSERTED. Naming the out-of-class answers is not decoration
      — it is the entire fix. A reader offered only *cosmetics* and *nothing* has
      the same two shapes it had when it called prosthetic circuitry a look, and
      a longer prompt.

      Derived rather than spot-checked: a word added to the list must appear in
      the ask, and a word removed from it must stop being offered, without
      anybody editing this test.
    */
    const vocabulary = referenceClassVocabulary("makeup");
    expect(vocabulary.declared).toBe(true);
    if (!vocabulary.declared) return;
    const lines = referenceClassAskLines("makeup").join("\n");
    for (const word of [vocabulary.inClass, vocabulary.nothing, ...vocabulary.outOfClass]) {
      expect(lines, word).toContain(word);
    }
    /* And it tells the reader what to do with them, which is the half a list
       alone does not carry. */
    expect(lines).toMatch(/name it rather than describing it as cosmetics anyway/i);
  });
});

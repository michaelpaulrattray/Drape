import { describe, expect, it } from "vitest";

import {
  VOICE_CANNOT_KEEP,
  VOICE_CARD_FIXED_STRINGS,
  VOICE_CLIP_WONT_PLAY,
  VOICE_KEEP_LOST_CONTACT,
  VOICE_MAKE_AGAIN,
  VOICE_MAKE_LOST_CONTACT,
  VOICE_TOO_SOON,
  voiceAuditionLoader,
  voiceCardEveryString,
  voiceKeepLabel,
  voiceKeptFoot,
  voiceLabel,
  voiceKeepFailedText,
  voiceMakeFailedText,
  voicePlayLabel,
  voiceRefundOwedText,
} from "@shared/voiceCardCopy";

/**
 * EVERY STRING ON THE VOICE CARD, READ — N4b-2 (#2470)'s own done-when:
 * *"a test reads every string on the card for vendor and pipeline words"*.
 *
 * # ⚠ WHY THE POPULATION IS DERIVED AND NOT LISTED HERE
 *
 * A guard over a hand-typed sample of the strings is the parallel copy working
 * law 4 names: a string added to the card next month would not be in it, and
 * the suite would go on passing while the leak shipped. So
 * `voiceCardEveryString()` composes the population out of the module's own
 * exports — including the COMPOSED sentences rendered with real arguments,
 * because a template read as a template passes a reader the rendered sentence
 * would fail.
 *
 * **The arm that holds that honest is the population floor below**: it compares
 * the derived list against the module's exported string constants, so a new
 * `export const` that is not in the list reddens rather than being skipped.
 *
 * ⚠ **IT LIVES UNDER `client/src/` RATHER THAN BESIDE ITS SUBJECT IN `shared/`,
 * AND THAT IS NOT A PREFERENCE.** `vitest.config.ts`'s `include` is
 * `server/**` and `client/src/**` — **`shared/**` is not in it**, so a suite
 * written next to `voiceCardCopy.ts` is never collected and `vitest run` says
 * *"No test files found"* while a whole guard sits on disk looking like
 * coverage. Measured on this card: the first copy of this file was in `shared/`
 * and ran zero times. The card it guards is a client surface, so this is also
 * where it belongs.
 */

/**
 * Words a customer must never meet on this path.
 *
 * ⚠ **The list is the disappearing-technology law's clause 5 turned into
 * tokens** — *no engine name on a path someone must walk* — plus the pipeline
 * nouns §6 names by hand (*"quota"*, *"slot"*, *"voice limit"*, *"clone"*).
 * Each is matched on a WORD BOUNDARY, which matters more than it looks: a
 * substring reader banning "he" would refuse the word "the", and a substring
 * reader banning "api" would refuse "rapid".
 *
 * ⚠ **"credit" AND "credits" CAME OFF THIS LIST ON 2026-10-14 (#2471), AND IT
 * IS THE ONE REMOVAL THAT NEEDS ITS REASON WRITTEN DOWN.** They were correct
 * here while the card had no price: nothing on it charged, so the word could
 * only have arrived as the house talking about its own books. The press charges
 * now, and **the prices-on-paid-buttons law requires the price on the button** —
 * a customer must never learn what something cost by being charged for it.
 *
 * **The distinction this list is really drawing is not "money words" — it is
 * WHOSE accounting a word belongs to.** "Quota", "slot" and "operation" are the
 * house's: a customer has no basis to act on any of them and would have to be
 * taught to read them. A credit is the customer's OWN unit — it is what they
 * hold, what they buy, and what every other paid button in the product is
 * denominated in (`shared/creditDisplay.ts` exists for exactly this, and the
 * Sign button says it). "Ledger" stays banned, because that one is the books.
 *
 * ⚠ **A price is still only allowed to be the number the server served.** The
 * reader below cannot see that; `shared/voiceCardCopy.ts` renders every price
 * through `displayPrice`, and the route serves the ledger figure.
 */
const FORBIDDEN_WORDS = [
  // Vendors and engines, whoever they are this month.
  "elevenlabs", "eleven", "inworld", "openai", "gemini", "anthropic", "claude",
  "fal", "sunburst", "flare", "banana", "runway", "higgsfield",
  // The house's own accounting, which a customer has no basis to act on.
  "quota", "slot", "slots", "clone", "cloning", "operation", "operations",
  "ledger",
  // The pipeline's vocabulary.
  "preview", "previews", "generated", "engine", "model", "provider", "api",
  "token", "tokens", "payload", "buffer", "sha256", "bucket", "mp3", "codec",
  "tts", "seed", "latency", "endpoint", "prompt", "synthesize", "synthesis",
] as const;

/**
 * Pronouns nobody gets. His word, 2026-10-09, verbatim: *"i dont want my crew
 * being gender specific about anything"* — and a cast is not gendered by the
 * product whatever the brief described.
 */
const GENDERED = ["she", "her", "hers", "he", "him", "his", "herself", "himself"] as const;

function offendingWords(sentence: string, words: readonly string[]): string[] {
  const lower = sentence.toLowerCase();
  return words.filter((word) => new RegExp(`\\b${word}\\b`).test(lower));
}

describe("the reader can see a leak (the positive control)", () => {
  it("finds a vendor name, an accounting noun and a pipeline noun", () => {
    expect(offendingWords("Made with ElevenLabs", FORBIDDEN_WORDS)).toContain("elevenlabs");
    expect(offendingWords("No voice slots left this month", FORBIDDEN_WORDS)).toContain("slots");
    /* The house's books are still banned, and the customer's own unit is not —
       the two halves of the distinction this list draws (#2471). */
    expect(offendingWords("Your ledger was debited", FORBIDDEN_WORDS)).toContain("ledger");
    expect(offendingWords("Make new voices from this text · 25 credits", FORBIDDEN_WORDS))
      .toEqual([]);
    expect(offendingWords("The preview could not be generated", FORBIDDEN_WORDS))
      .toEqual(expect.arrayContaining(["preview", "generated"]));
  });

  it("finds a gendered pronoun, and does not fire on a word that merely contains one", () => {
    expect(offendingWords("Recording her audition", GENDERED)).toContain("her");
    /* "the" contains "he"; "there" contains "here". A substring reader would
       refuse almost every sentence in the product. */
    expect(offendingWords("There aren't enough words here yet", GENDERED)).toEqual([]);
  });
});

describe("no string on the voice card names the technology", () => {
  it("reads every string, fixed and composed", () => {
    const offenders: string[] = [];
    for (const sentence of voiceCardEveryString()) {
      const hits = offendingWords(sentence, FORBIDDEN_WORDS);
      if (hits.length > 0) offenders.push(`${sentence} → ${hits.join(", ")}`);
    }
    expect(offenders, "the disappearing-technology law, clause 5").toEqual([]);
  });

  it("genders nobody, including the nameless cast", () => {
    const offenders: string[] = [];
    for (const sentence of voiceCardEveryString()) {
      const hits = offendingWords(sentence, GENDERED);
      if (hits.length > 0) offenders.push(`${sentence} → ${hits.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("reads a population that covers every exported string constant", async () => {
    /*
      THE POPULATION FLOOR. Without this, adding a tenth `export const` and
      forgetting it in `VOICE_CARD_FIXED_STRINGS` leaves a string nothing reads
      while every arm above stays green — the shape that makes a derived guard
      only as honest as its derivation.
    */
    const module = await import("@shared/voiceCardCopy");
    const exportedStrings = Object.entries(module)
      .filter(([, value]) => typeof value === "string")
      .map(([name]) => name);
    const covered = new Set(VOICE_CARD_FIXED_STRINGS);
    const missing = exportedStrings.filter((name) => {
      const value = (module as unknown as Record<string, string>)[name];
      return !covered.has(value);
    });
    expect(
      missing,
      "every exported customer string belongs in VOICE_CARD_FIXED_STRINGS, or the reader cannot see it",
    ).toEqual([]);
  });
});

describe("the labels are his design's", () => {
  it("says Voice, never Take", () => {
    /* His written design (#2140), to keep it clear of film takes. The frame
       `06` of the same design draws "Take 1"; the WORDS win. */
    expect([voiceLabel(0), voiceLabel(1), voiceLabel(2)]).toEqual(["Voice 1", "Voice 2", "Voice 3"]);
    for (const label of [voiceLabel(0), voicePlayLabel(1), voiceKeepLabel(2)]) {
      expect(label.toLowerCase()).not.toContain("take");
    }
  });

  it("counts from one, because that is how a customer says it", () => {
    expect(voicePlayLabel(0)).toBe("Play Voice 1");
    expect(voiceKeepLabel(1)).toBe('Keep "Voice 2"');
  });

  /* The price and the charge arrive together in the pricing slice — its card
     number is in this comment because the token guard reads a bare #NNNN in a
     string as a hex colour, and #2471 is a valid one. */
  it("carries no price, because nothing is charged yet", () => {
    /* The card asks for a placeholder figure; a credit number beside a press
       that charges nothing is a false promise. When the price lands it lands
       with the charge, and this arm is what that card edits. */
    expect(VOICE_MAKE_AGAIN).toBe("Make new voices from this text");
    expect(VOICE_MAKE_AGAIN).not.toMatch(/\d/);
  });
});

/**
 * THE SENTENCES #2470's FINDING CORRECTED — items 4, 5 and 6.
 *
 * Each of the three was a sentence that said something untrue or said nothing
 * at all, and each arm is about the PROMISE rather than the phrasing: a copy
 * arm pinned to an exact string is a change-detector, but a copy arm pinned to
 * what a sentence may not claim survives a rewrite and still catches the
 * defect coming back.
 */
describe("the refusals say what is true", () => {
  it("⚠ DOES NOT PROMISE THE MADE VOICES WILL STILL BE THERE", () => {
    /*
      It said *"The ones you made will still be here — try Keep again later"*.
      The handles live in an in-process store a deploy empties, and a preview is
      only known saveable for about fifty seconds, so *later* they are reliably
      gone. The sentence now promises nothing about persistence and names the
      one thing that works instead.
    */
    expect(VOICE_CANNOT_KEEP).not.toMatch(/still be (here|there)|will still|are still/i);
    expect(VOICE_CANNOT_KEEP).toMatch(/make them again/i);
  });

  it("⚠ TELLS A LIMITED PRESS TO WAIT, rather than to try the thing that just failed", () => {
    /*
      The limit is per hour, so a bare *try again* invites the press that fails
      identically — which is exactly what the generic failure sentence did when
      the automatic design hit the press limit.
    */
    expect(VOICE_TOO_SOON).toMatch(/little while/i);
    expect(VOICE_TOO_SOON).not.toMatch(/try again\.?$/i);
    /* It names no number: twelve an hour is our pacing of house money, not a
       fact a customer has any use for. */
    expect(VOICE_TOO_SOON).not.toMatch(/\d/);
  });

  it("⚠ HAS WORDS AT ALL FOR A CLIP THAT WILL NOT PLAY", () => {
    /*
      The press used to release the button and say nothing, which reads as a
      product that ignored you. It must also not blame the network or name a
      bucket — the machinery is not the customer's to read.
    */
    expect(VOICE_CLIP_WONT_PLAY.trim().length).toBeGreaterThan(0);
    expect(VOICE_CLIP_WONT_PLAY).not.toMatch(/network|bucket|storage|url|cdn|fetch|404|500/i);
  });

  it("all three are inside the population the no-technology reader walks", () => {
    /*
      The reader's own population, not a second list — a new sentence that the
      vendor-and-pronoun reader never sees is a sentence nobody checked.
    */
    const every = voiceCardEveryString();
    for (const sentence of [VOICE_CANNOT_KEEP, VOICE_TOO_SOON, VOICE_CLIP_WONT_PLAY]) {
      expect(every).toContain(sentence);
    }
  });
});

describe("a cast with no name is a real case", () => {
  it("names the cast when it has one", () => {
    expect(voiceAuditionLoader("Pigman")).toBe("Recording Pigman's audition");
    expect(voiceKeptFoot("Pigman")).toBe("Pigman's voice");
  });

  it("falls back without inventing or gendering", () => {
    expect(voiceAuditionLoader(null)).toBe("Recording this character's audition");
    expect(voiceKeptFoot(null)).toBe("This character's voice");
  });

  it("treats a blank name as no name", () => {
    /* A name of spaces would otherwise render "Recording 's audition". */
    expect(voiceAuditionLoader("   ")).toBe("Recording this character's audition");
    expect(voiceKeptFoot("  ")).toBe("This character's voice");
  });

  it("trims a name rather than pasting it", () => {
    expect(voiceKeptFoot(" Pigman ")).toBe("Pigman's voice");
  });
});

/* The pull request number lives in this comment and not in the title: the token
   guard reads a bare #NNNN in a STRING as a hex colour, and 2499 is a valid one
   — the same reason the price arm above carries its number this way. The
   findings are the relay's, on PR 2499. */
describe("what the card says about the money (the relay's findings)", () => {
  /**
   * The claim that may only be made when the ledger has answered.
   *
   * Written once here because three arms below read it, and read as a
   * SUBSTRING rather than a whole sentence: the defect was this phrase sitting
   * inside a longer failure line, not the phrase alone.
   */
  const MONEY_CAME_BACK_CLAIM = "Nothing was charged";

  it("⚠ NEVER CLAIMS NOTHING WAS CHARGED WHEN WE DID NOT HEAR THE SERVER", () => {
    /*
      Finding 1. Both of these are the catch-all's fallback — the branch for a
      transport, a proxy or a parser failing, where the server's own answer
      never arrived. The press charges now, so the card has no basis for either
      money claim, and it was making the cheerful one.
    */
    for (const sentence of [VOICE_MAKE_LOST_CONTACT, VOICE_KEEP_LOST_CONTACT]) {
      expect(sentence).not.toContain(MONEY_CAME_BACK_CLAIM);
      /* And it is not silent about money either — it points at the one number
         on this screen that is authoritative, which the press refetches. */
      expect(sentence).toContain("credits");
    }
  });

  it("⚠ NEVER CLAIMS IT WHEN THE REFUND DID NOT RECORD", () => {
    /*
      `atomicCredits`' own law, and the one this module exists to keep: a refund
      that failed to record is NEVER reported as money that came back. Both
      sides of the boolean are read, because an arm that only reads the false
      side cannot tell a correct sentence from a constant.
    */
    expect(voiceMakeFailedText(false)).not.toContain(MONEY_CAME_BACK_CLAIM);
    expect(voiceKeepFailedText(false)).not.toContain(MONEY_CAME_BACK_CLAIM);
    expect(voiceMakeFailedText(true)).toContain(MONEY_CAME_BACK_CLAIM);
    expect(voiceKeepFailedText(true)).toContain(MONEY_CAME_BACK_CLAIM);
  });

  it("⚠ GIVES THE CUSTOMER THE REFERENCE TO QUOTE, rather than making them the lookup key", () => {
    /*
      Finding 4. `refundTruth` quotes this same reference on every other money
      surface in the product (*"quote reference … and support will restore the N
      credits"*), so the voice card withholding it was the one surface asking
      its customer to be the lookup key for a problem we can already name.

      The specimen is the real shape `refundReferenceFor` produces, because a
      reader walking a tidy fake learns nothing about the live string.
    */
    const reference = "refund:pending-1-3f2a7c18-0b44-4e5e-9a21-7d6c5b8e1f90";
    for (const sentence of [
      voiceMakeFailedText(false, reference),
      voiceKeepFailedText(false, reference),
      voiceRefundOwedText(reference),
    ]) {
      expect(sentence).toContain(reference);
    }
    /* And it is never quoted beside credits that came back, where it would be
       machinery with nothing to do. */
    expect(voiceMakeFailedText(true, reference)).not.toContain(reference);
    expect(voiceKeepFailedText(true, reference)).not.toContain(reference);
  });

  it("still asks the customer to get in touch when there is no reference to quote", () => {
    /* The reference can be absent — a refund we never heard the outcome of.
       The sentence must not then have a gap where an id should be, and it must
       still tell them they are owed. */
    for (const sentence of [voiceRefundOwedText(null), voiceRefundOwedText("   ")]) {
      expect(sentence).toContain("haven't come back");
      expect(sentence).toContain("Get in touch");
      expect(sentence).not.toContain("reference");
    }
  });
});

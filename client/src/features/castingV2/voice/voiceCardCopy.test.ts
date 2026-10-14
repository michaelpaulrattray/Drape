import { describe, expect, it } from "vitest";

import {
  VOICE_CARD_FIXED_STRINGS,
  VOICE_MAKE_AGAIN,
  voiceAuditionLoader,
  voiceCardEveryString,
  voiceKeepLabel,
  voiceKeptFoot,
  voiceLabel,
  voicePlayLabel,
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
 */
const FORBIDDEN_WORDS = [
  // Vendors and engines, whoever they are this month.
  "elevenlabs", "eleven", "inworld", "openai", "gemini", "anthropic", "claude",
  "fal", "sunburst", "flare", "banana", "runway", "higgsfield",
  // The house's own accounting, which a customer has no basis to act on.
  "quota", "slot", "slots", "clone", "cloning", "operation", "operations",
  "credit", "credits", "ledger",
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

  it("carries no price, because nothing is charged yet (#2471 adds both)", () => {
    /* The card asks for a placeholder figure; a credit number beside a press
       that charges nothing is a false promise. When the price lands it lands
       with the charge, and this arm is what that card edits. */
    expect(VOICE_MAKE_AGAIN).toBe("Make new voices from this text");
    expect(VOICE_MAKE_AGAIN).not.toMatch(/\d/);
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

/**
 * ONE CURRENT DESCRIPTION (#2565 slice 1) — the writer and the sentence, driven
 * directly with an engine double (law 3: the backstops are tested without a
 * model that usually behaves).
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { pronounsForSex } from "./castPronouns";
import {
  CURRENT_DESCRIPTION_RETRIES,
  CURRENT_DESCRIPTION_TIMEOUT_MS,
  currentDescriptionUserTurn,
  CURRENT_DESCRIPTION_SYSTEM,
  describedNowSentence,
  addsWhatIsNotInShot,
  keepsWhatWasTakenBack,
  looksLikeAnEditList,
  mentionsThePicture,
  notInShotForThisCall,
  writeCurrentDescription,
} from "./currentDescription";
import { everyFeatureOutOfFrame, outOfFrame } from "./castingFrame";
import { pictureHalfPhrase } from "./sidePhrasing";

function engineSaying(text: string, sink: TextRequest[] = []): TextEngine {
  return {
    id: "test:describe",
    complete: async (request) => {
      sink.push(request);
      return {
        text,
        latencyMs: 7,
        tokens: { in: 300, out: 40 },
        provenance: { provider: "openrouter", model: "anthropic/claude-sonnet-5", providerRef: "r" },
      } as never;
    },
  };
}

const seed = { brief: "A weathered fisherman of the north Atlantic, sixty.", earlierAsks: [] as string[] };

describe("the description writer", () => {
  it("returns the model's paragraph, asked under its own purpose with the previous description and the change", async () => {
    const sent: TextRequest[] = [];
    const result = await writeCurrentDescription(
      engineSaying("A weathered fisherman of sixty with a short, neat beard and grey-green eyes.", sent),
      { previous: "A weathered fisherman of sixty with a short, neat beard.", seed, change: "the eyes grey-green" },
    );
    expect(result).toMatchObject({
      ok: true,
      description: "A weathered fisherman of sixty with a short, neat beard and grey-green eyes.",
      tokens: { in: 300, out: 40 },
      model: "anthropic/claude-sonnet-5",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.about).toBe("refine.describe");
    expect(sent[0]!.user).toContain("A weathered fisherman of sixty with a short, neat beard.");
    expect(sent[0]!.user).toContain("the eyes grey-green");
    /* The previous description is the memory: the brief is NOT re-sent beside it. */
    expect(sent[0]!.user).not.toContain("north Atlantic");
    expect(sent[0]!.system).toMatch(/never as a list of edits/);
    /* The two rules the court bought (round b): a comparison stays a comparison
       against the original photograph, and hair is not the beard. */
    expect(sent[0]!.system).toMatch(/stays a comparison against how they first looked/);
    expect(sent[0]!.system).toMatch(/Hair on the head and facial hair are separate features/);
  });

  /*
    THE DEADLINE AND THE RETRY BUDGET, ASSERTED ON THE OUTGOING REQUEST (working
    law 5) - the relay's finding on PR #2571.

    `timeoutMs` is per ATTEMPT and sits INSIDE the transport's retry loop, so a
    deadline with no retry budget beside it is only a third of the real wait: at
    45 s and the transport's default of 2 retries, a paid render waited up to
    135 s on a decoration whose failure is free. The court measured the work at
    1.46-3.16 s over 31 calls, so both numbers are asserted here rather than
    left to a docblock adjective - a constant nobody reads is how "short" came
    to mean 135 s.
  */
  it("asks with a deadline AND a retry budget, both sized from the measured work", async () => {
    const sent: TextRequest[] = [];
    await writeCurrentDescription(
      engineSaying("A weathered fisherman of sixty.", sent),
      { previous: null, seed, change: "the eyes grey-green" },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]!.timeoutMs).toBe(CURRENT_DESCRIPTION_TIMEOUT_MS);
    expect(sent[0]!.retries).toBe(CURRENT_DESCRIPTION_RETRIES);
    /* The two together are what the customer waits for, so the arm holds the
       PRODUCT rather than either number alone: anything past a minute is a
       decoration outstaying the render it precedes. */
    expect(CURRENT_DESCRIPTION_TIMEOUT_MS * (CURRENT_DESCRIPTION_RETRIES + 1)).toBeLessThanOrEqual(60_000);
    /* And a budget must actually be sent - `undefined` is the default of 2. */
    expect(sent[0]!.retries, "an absent budget is the transport's default of 2").not.toBeUndefined();
  });

  it("seeds from the brief and the asks already applied when the previous version has no description", () => {
    const turn = currentDescriptionUserTurn({
      previous: null,
      seed: { brief: "A street casting, mid 20s.", earlierAsks: ["cut the hair into a short crop", "wire-frame glasses"] },
      change: "take the glasses off",
    });
    expect(turn).toContain("A street casting, mid 20s.");
    expect(turn).toContain("- cut the hair into a short crop\n- wire-frame glasses");
    expect(turn).toContain("The change, in the customer's own words:\ntake the glasses off");
  });

  it("never throws — a throwing engine is a value the caller rides today's prompt on", async () => {
    const throwing: TextEngine = { id: "t", complete: async () => { throw new Error("upstream 502 with the brief echoed"); } };
    await expect(writeCurrentDescription(throwing, { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "failed" });
  });

  it("answers no_engine with nothing configured", async () => {
    await expect(writeCurrentDescription(null, { previous: null, seed, change: "x" }))
      .resolves.toEqual({ ok: false, reason: "no_engine", latencyMs: 0 });
  });

  it("REFUSES an edit list rather than filing it — his one named shape", async () => {
    const listy = "- short neat beard\n- grey-green eyes";
    await expect(writeCurrentDescription(engineSaying(listy), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "edit_list" });
    /* CONTROL: a paragraph is not a list, so the refusal above is the shape, not any text. */
    expect(looksLikeAnEditList("A fisherman with a short beard. They wear no glasses.")).toBe(false);
    expect(looksLikeAnEditList("1. beard shorter")).toBe(true);
    /* Several lines with no bullet are the list shape too — a description is one paragraph. */
    expect(looksLikeAnEditList("A fisherman with a short beard.\nThey wear no glasses.")).toBe(true);
  });

  it("REFUSES a reply that talks about the PICTURE, driven directly with a poisoned answer (#2578 §4)", async () => {
    /*
      LAW 3: the guard is driven with the exact shape it exists to stop, not
      through a model that usually behaves. The leak this prevents was measured
      on #2578 — handed the picture-half parenthetical, the writer wrote it into
      the stored paragraph 2 of 3 times — and that paragraph is what #2545 hands
      to the signed views, the persona, the voice and the creation record.
    */
    const leaked = "A fisherman of sixty with a right eye (on the left of the picture as you look at it) of emerald green.";
    await expect(writeCurrentDescription(engineSaying(leaked), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "picture_talk" });

    /*
      ⚠ THE CONTROL THAT MATTERS IS THE NEGATIVE ONE: an ANATOMICAL side is the
      whole point of a description and must pass. A guard keyed on "left" and
      "right" would refuse nearly every sided description there is, and would
      have read as working.
    */
    const anatomical = "A fisherman of sixty whose right eye is emerald green and whose left shoulder carries an anchor tattoo.";
    await expect(writeCurrentDescription(engineSaying(anatomical), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: true, description: anatomical });

    /* The phrase family, each form driven rather than reasoned about. */
    expect(mentionsThePicture("their eye is on the left of the picture as you look at it")).toBe(true);
    expect(mentionsThePicture("the scar sits on the right of the image")).toBe(true);
    expect(mentionsThePicture("a mole on the picture's left")).toBe(true);
    expect(mentionsThePicture("turned toward the left side of the frame")).toBe(true);
    expect(mentionsThePicture("as you look at it, the light is warm")).toBe(true);
    /* And the sentences that are about the PERSON stay allowed. */
    expect(mentionsThePicture("their right eye is emerald green")).toBe(false);
    expect(mentionsThePicture("a long scar down the left side of their face")).toBe(false);
    expect(mentionsThePicture("they wear a ring on their left hand")).toBe(false);
    expect(mentionsThePicture("a picture of calm, with weathered skin")).toBe(false);
  });

  it("the writer is TOLD not to describe the picture, and the instruction and the wall are one rule (#2578 §4)", () => {
    /* Both arms of §4: the instruction is half the control and the refusal is
       the other half, so the instruction is pinned rather than assumed. */
    expect(CURRENT_DESCRIPTION_SYSTEM).toContain("Describe the person, never the picture.");
    expect(CURRENT_DESCRIPTION_SYSTEM).toContain("as you look at it");
    /* The spelling the wall refuses on comes from `sidePhrasing`'s own owner,
       so a drift in that phrase moves both halves together. */
    expect(mentionsThePicture(`a feature ${pictureHalfPhrase("left")}`)).toBe(true);
    expect(mentionsThePicture(`a feature ${pictureHalfPhrase("right")}`)).toBe(true);
  });

  it("refuses an empty reply and a runaway one", async () => {
    await expect(writeCurrentDescription(engineSaying("   "), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "blank" });
    await expect(writeCurrentDescription(engineSaying("a".repeat(2401)), { previous: null, seed, change: "x" }))
      .resolves.toMatchObject({ ok: false, reason: "too_long" });
  });
});

describe("the sentence the refine prompt carries", () => {
  it("is round 2's A4 sentence, word for word, for a cast written as they", () => {
    expect(describedNowSentence("Their hair is cut into a short crop.", pronounsForSex(null))).toBe(
      "This is how they look now: Their hair is cut into a short crop. Everything else about them stays exactly as in Reference 1.",
    );
  });

  it("agrees its verb with a singular pronoun and closes an unpunctuated paragraph", () => {
    expect(describedNowSentence("A fisherman with a short beard", pronounsForSex("male"))).toBe(
      "This is how he looks now: A fisherman with a short beard. Everything else about him stays exactly as in Reference 1.",
    );
  });
});

describe("CASTING_CURRENT_DESCRIPTION_SCOPE", () => {
  it("refuses boot past its parent and admits only inside it", async () => {
    const { validateCastingCurrentDescriptionEnvironment: validate } = await import("./castingV2Scope");
    expect(validate({ scope: undefined, castingScope: undefined })).toEqual({ kind: "off" });
    expect(() => validate({ scope: "all", castingScope: "off" })).toThrow(/CASTING_V2_SCOPE is off/);
    expect(() => validate({ scope: "all", castingScope: "users:1" })).toThrow(/cannot be "all"/);
    expect(() => validate({ scope: "users:2", castingScope: "users:1" })).toThrow(/outside CASTING_V2_SCOPE: 2/);
    expect(() => validate({ scope: "everyone", castingScope: "all" })).toThrow(/must be "off"/);
    expect(validate({ scope: "users:1", castingScope: "users:1,2" })).toMatchObject({ kind: "users" });
  });

  it("is captured as an AND of the chain at the point of use", async () => {
    const { captureCastingCurrentDescriptionEnabled: capture } = await import("./castingV2Scope");
    const saved = { v2: process.env.CASTING_V2_SCOPE, child: process.env.CASTING_CURRENT_DESCRIPTION_SCOPE };
    try {
      process.env.CASTING_CURRENT_DESCRIPTION_SCOPE = "users:1";
      process.env.CASTING_V2_SCOPE = "users:1";
      expect(capture(1)).toBe(true);
      expect(capture(2)).toBe(false);
      process.env.CASTING_V2_SCOPE = "off";
      expect(capture(1), "the parent off closes the child").toBe(false);
      delete process.env.CASTING_CURRENT_DESCRIPTION_SCOPE;
      process.env.CASTING_V2_SCOPE = "all";
      expect(capture(1), "absent is off").toBe(false);
    } finally {
      if (saved.v2 === undefined) delete process.env.CASTING_V2_SCOPE; else process.env.CASTING_V2_SCOPE = saved.v2;
      if (saved.child === undefined) delete process.env.CASTING_CURRENT_DESCRIPTION_SCOPE;
      else process.env.CASTING_CURRENT_DESCRIPTION_SCOPE = saved.child;
    }
  });
});

/*
  #2645 — A REMOVAL IS WRITTEN AS A REMOVAL, AND THE CUSTOMER'S WORDS ARE KEPT.

  Found by the layout court on the real `refineCandidate` entrance (dev, the
  flag on for the bot): "take the horns off" filed a description that still
  said "with a pair of short curved horns" on both arms, so the next edit
  painted them back; and "cut the hair into a short crop" was filed as "a
  standard crop" for six edits — the house style name the writer was handed
  instead of the customer's sentence. His rule, 2026-10-17: the studio never
  rewords what the customer asked for.
*/
describe("removals and the customer's own words (#2645)", () => {
  const LIZARD = "A lizard man with scales a deeper emerald than their original coloring, a heavy brow and amber eyes, in his 40s, with a pair of short curved horns.";

  it("a removal chain: the horns are TOLD to the writer as taken away, and a reply that keeps them is REFUSED (law 3, a poisoned answer)", async () => {
    const sent: TextRequest[] = [];
    /* The court's own edit-5 reply, word for word in its shape. */
    const kept = "A lizard man with scales a deeper emerald than their original coloring, a heavy brow and amber eyes, in his 40s, with a pair of short curved horns.";
    await expect(writeCurrentDescription(engineSaying(kept, sent), {
      previous: LIZARD, seed, change: "take the horns off", takenBack: ["a pair of short curved horns"],
    })).resolves.toMatchObject({ ok: false, reason: "kept_removed" });
    expect(sent[0]!.user).toContain("The change, in the customer's own words:\ntake the horns off");
    expect(sent[0]!.user).toContain("- a pair of short curved horns");
    /* A REWORDING of the same feature is caught too — the head noun. */
    await expect(writeCurrentDescription(engineSaying("A lizard man with emerald scales and two small curved horns, in his 40s."), {
      previous: LIZARD, seed, change: "take the horns off", takenBack: ["a pair of short curved horns"],
    })).resolves.toMatchObject({ ok: false, reason: "kept_removed" });
  });

  it("CONTROL — the same removal with the horns gone, or stated as absent, is filed", async () => {
    const gone = "A lizard man with scales a deeper emerald than their original coloring, a heavy brow and amber eyes, in his 40s.";
    await expect(writeCurrentDescription(engineSaying(gone), {
      previous: LIZARD, seed, change: "take the horns off", takenBack: ["a pair of short curved horns"],
    })).resolves.toMatchObject({ ok: true, description: gone });
    const absent = `${gone} They have no horns.`;
    await expect(writeCurrentDescription(engineSaying(absent), {
      previous: LIZARD, seed, change: "take the horns off", takenBack: ["a pair of short curved horns"],
    })).resolves.toMatchObject({ ok: true, description: absent });
    /* And the edit AFTER the removal: nothing is taken back, so a paragraph
       that never mentions horns is simply filed, and one that brings them back
       is not this backstop's question (nothing was taken back this time). */
    expect(keepsWhatWasTakenBack(gone, [])).toBeNull();
  });

  it("the backstop reads the feature, not the place — a scar through an eyebrow does not refuse the eyebrow", () => {
    expect(keepsWhatWasTakenBack("A fisherman of sixty with a heavy left eyebrow.", ["a scar through the left eyebrow"])).toBeNull();
    expect(keepsWhatWasTakenBack("A fisherman of sixty with a scar through the left eyebrow.", ["a scar through the left eyebrow"]))
      .toBe("a scar through the left eyebrow");
    expect(keepsWhatWasTakenBack("A fisherman of sixty. They bear no scar through the left eyebrow.", ["a scar through the left eyebrow"])).toBeNull();
    /* `not` is a word, never a stem — "a notch" is not an absence. */
    expect(keepsWhatWasTakenBack("A lizard man, a notch missing from the left ear, short curved horns.", ["a pair of short curved horns"]))
      .toBe("a pair of short curved horns");
  });

  it("\"short crop\" is handed to the writer verbatim, and the writer is TOLD to keep the customer's words", async () => {
    const sent: TextRequest[] = [];
    await writeCurrentDescription(engineSaying("A street casting subject in their mid 20s, with hair cut into a short crop.", sent), {
      previous: "A street casting subject in their mid 20s.", seed, change: "cut the hair into a short crop",
    });
    expect(sent[0]!.user).toContain("cut the hair into a short crop");
    /* The house style name is never in what the writer sees. */
    expect(sent[0]!.user).not.toContain("standard crop");
    expect(CURRENT_DESCRIPTION_SYSTEM).toContain("goes into the description exactly as they wrote it");
    expect(CURRENT_DESCRIPTION_SYSTEM).toContain("never a synonym");
  });

  it("an addition: nothing taken back, no absences — the turn is the previous description and the customer's sentence alone", () => {
    const turn = currentDescriptionUserTurn({ previous: LIZARD, seed, change: "a notch missing from the left ear" });
    expect(turn).toBe(`How they looked before this change:\n${LIZARD}\n\nThe change, in the customer's own words:\na notch missing from the left ear`);
  });

  it("a recolour: the comparison is not strengthened, and a vacancy site phrase rides beside a removal of something the photograph had", () => {
    const recolour = currentDescriptionUserTurn({ previous: LIZARD, seed, change: "the eyes pale grey" });
    expect(recolour).toContain("The change, in the customer's own words:\nthe eyes pale grey");
    expect(CURRENT_DESCRIPTION_SYSTEM).toContain("Never strengthen a comparison the previous description already makes");
    const vacancy = currentDescriptionUserTurn({
      previous: "A woman of thirty with gold hoop earrings.", seed, change: "take her earrings off",
      absences: ["no earrings — both earlobes bare, nothing hanging from either ear"],
    });
    expect(vacancy).toContain("- no earrings — both earlobes bare, nothing hanging from either ear");
  });
});

/*
  #2645 FOLLOW-UP — THE HALF OF AN ASK THE PHOTOGRAPH CANNOT SHOW NEVER ENTERS
  THE DESCRIPTION.

  "A smaller waist and red lipstick" on a headshot serves only the lipstick: the
  frame strip takes the waist out of the delta before anything is painted. But
  the writer was handed the customer's whole sentence and nothing else, so it
  filed "a smaller waist" as a fact about the cast, and every later render
  painted from that paragraph. The sentence stays verbatim (his rule: never
  reword); the unserved half is told to the writer as not done, and a reply that
  writes it in anyway is refused.
*/
describe("what the photograph could not show (#2645 follow-up)", () => {
  const BEFORE = "A woman in her thirties with long dark hair and a bare lip.";
  const ask = { previous: BEFORE, seed: { brief: "", earlierAsks: [] }, change: "a smaller waist and red lipstick", notInShot: ["her waist"] };

  it("the writer gets the sentence verbatim AND is told the waist was not done", async () => {
    const sent: TextRequest[] = [];
    await writeCurrentDescription(engineSaying("A woman in her thirties with long dark hair and red lipstick.", sent), ask);
    const user = sent[0]!.user;
    expect(user).toContain("The change, in the customer's own words:\na smaller waist and red lipstick");
    expect(user).toContain("Part of this change was not made, because their photograph does not show it.");
    /* The feature in the writer's they/their terms, never the possessive. */
    expect(user).toContain("\n- waist");
    expect(user).not.toContain("- her waist");
  });

  it("CONTROL — an ask the frame took nothing from carries no such block", () => {
    expect(currentDescriptionUserTurn({ ...ask, notInShot: [] })).not.toContain("was not made");
    expect(currentDescriptionUserTurn({ ...ask, notInShot: undefined })).not.toContain("was not made");
  });

  it("a reply that writes the waist in is REFUSED (law 3, a poisoned answer)", async () => {
    await expect(writeCurrentDescription(
      engineSaying("A woman in her thirties with long dark hair, a smaller waist and red lipstick."),
      ask,
    )).resolves.toMatchObject({ ok: false, reason: "not_in_shot" });
  });

  it("CONTROL — the lipstick alone is filed", async () => {
    await expect(writeCurrentDescription(
      engineSaying("A woman in her thirties with long dark hair and red lipstick."),
      ask,
    )).resolves.toMatchObject({ ok: true, description: "A woman in her thirties with long dark hair and red lipstick." });
  });

  it("CONTROL — a waist the description before already named may stay", () => {
    expect(addsWhatIsNotInShot("They have a slim waist and red lipstick.", ["her waist"], "They have a slim waist.")).toBeNull();
    expect(addsWhatIsNotInShot("They have a slim waist and red lipstick.", ["her waist"], "They have long hair.")).toBe("waist");
    /* Judged against the brief when there is no previous description. */
    return expect(writeCurrentDescription(
      engineSaying("A dancer with a slim waist and red lipstick."),
      { ...ask, previous: null, seed: { brief: "A dancer with a slim waist.", earlierAsks: [] } },
    )).resolves.toMatchObject({ ok: true });
  });
});

/**
 * WHAT THE PHOTOGRAPH HAS NEVER SHOWN, ON THE SEED ROAD (#2657).
 *
 * The seed road prints every earlier ask as raw prose, and nothing stored
 * anywhere says which half of one the camera refused - the frame strip's
 * `dropped` list is computed per render and written to no column. So a waist
 * dropped three edits ago came back as a fact about the person: measured
 * through the real writer on 10 real briefs, twice each, **20 of 20**. These
 * arms drive the repair directly with an engine double (law 3).
 */
describe("what the photograph has never shown (#2657)", () => {
  const SEEDED = {
    previous: null,
    seed: { brief: "A weathered fisherman of the north Atlantic, sixty.", earlierAsks: ["a smaller waist and red lipstick"] },
    change: "give them green eyes",
  };
  const WAIST = outOfFrame("waist")!;

  it("the seeded writer is told the frame has never shown the waist, with no out-of-frame half in THIS change", () => {
    const user = currentDescriptionUserTurn(SEEDED);
    expect(user).toContain("Their photograph does not show these, so no change above was made to them.");
    /* The writer's they/their terms, never the possessive - same rule as the
       current change's own block one describe up. */
    expect(user).toContain("\n- waist");
    expect(user).not.toContain("- her waist");
  });

  it("CONTROL - the previous road carries no such sentence", () => {
    const user = currentDescriptionUserTurn({
      ...SEEDED,
      previous: "A weathered fisherman of sixty with grey-green eyes.",
    });
    expect(user).not.toContain("has never shown");
    expect(user).not.toContain("does not show these");
  });

  it("a seeded reply that writes the waist in is REFUSED, though this change named nothing out of frame", async () => {
    await expect(writeCurrentDescription(
      engineSaying("A weathered fisherman of sixty with a smaller waist and green eyes."),
      SEEDED,
    )).resolves.toMatchObject({ ok: false, reason: "not_in_shot" });
  });

  it("CONTROL - a seeded reply that leaves it alone is filed", async () => {
    await expect(writeCurrentDescription(
      engineSaying("A weathered fisherman of sixty with red lips and green eyes."),
      SEEDED,
    )).resolves.toMatchObject({ ok: true });
  });

  it("CONTROL - a waist the BRIEF itself names may stay, because the roll made whatever it made", async () => {
    await expect(writeCurrentDescription(
      engineSaying("A dancer with a slim waist and green eyes."),
      { ...SEEDED, seed: { brief: "A dancer with a slim waist.", earlierAsks: ["red lipstick"] } },
    )).resolves.toMatchObject({ ok: true });
  });

  it("the list is DERIVED from the casting frame and is not a second copy of it (working law 4)", () => {
    expect(notInShotForThisCall(SEEDED)).toEqual(everyFeatureOutOfFrame());
    expect(everyFeatureOutOfFrame()).toContain(WAIST);
    /* On the previous road it is this change's own half and nothing else. */
    expect(notInShotForThisCall({ ...SEEDED, previous: "Anything at all." })).toEqual([]);
    expect(notInShotForThisCall({ ...SEEDED, previous: "Anything at all.", notInShot: [WAIST] })).toEqual([WAIST]);
  });

  it("ONE sentence, not two, when THIS change's own half is the out-of-frame feature", () => {
    const user = currentDescriptionUserTurn({ ...SEEDED, notInShot: [WAIST] });
    expect(user).toContain("Part of this change was not made");
    expect(user).not.toContain("does not show these");
    /* And the feature is listed once rather than once per sentence. */
    expect(user.split("\n- waist").length - 1).toBe(1);
  });

  it("a blank previous description is the seed road too, not a short-circuit", () => {
    expect(notInShotForThisCall({ ...SEEDED, previous: "   " })).toEqual(everyFeatureOutOfFrame());
  });
});

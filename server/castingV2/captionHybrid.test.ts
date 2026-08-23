/**
 * THE CAPTION HYBRID — a picture-taken fact reaching the cousins as WORDS
 * (founder ruling fable-1434, verbatim: *"i like the caption hybrid approach
 * cousins are not emant to be an exact replica on the one your editing."*).
 *
 * His sentence carries the principle rather than just the pick: **Follow's
 * fidelity contract is the sketch, not the fingerprint.** A cousin is not meant
 * to be a replica of the version being edited, so a description read off the
 * delivered frame is the right carrier for it — while the CROP goes on being
 * the only carrier for a same-person edit, which this does not touch.
 *
 * # What went before it, on the record rather than in the abstract
 *
 * A crop take files `hairCut: "the hair in the attached picture"`. Filed into
 * the identity, a FOLLOW inherits `statedDetails` wholesale and eight new casts
 * are told to reproduce a photograph that is nowhere in their request —
 * production v532's own row carries that placeholder. Declining it (already
 * live) fixed the lie and left a different hole: the cousins then inherit NO
 * hair fact at all and re-roll the original, which is losing what she paid for
 * by a second road.
 *
 * # The arm, per the ruling's condition
 *
 * It drives the whole way to the cousin's prompt rather than stopping at the
 * record: caption → identity → the line `describeRealizedAxes` emits, which IS
 * what a followed cast is built from. Producer-sabotaged: take the caption out
 * of `identityDetailsOf` and the last assertion fails on the sentence itself.
 */
import { describe, expect, it } from "vitest";

import { applyDelta, identityDetailsOf, type RefineDelta } from "./refineDelta";
import { describeRealizedAxes } from "./realizedAxes";
import type { ResolvedIdentity } from "./castingIntent";

/** What a crop take files: the placeholder, marked as picture-sourced. */
const TAKE: RefineDelta = {
  free: { hairCut: ["the hair in the attached picture"] },
  fromPicture: ["hairCut"],
} as RefineDelta;

/** What the delivered frame was actually read to hold. */
const SAW = "a blunt jaw-length bob with a heavy fringe";

const IDENTITY = {
  sex: "female",
  ageBand: "20s",
  heritage: [],
  realized: {},
} as unknown as ResolvedIdentity;

describe("what a picture-taken fact leaves behind", () => {
  it("⚠ files the CAPTION, not the placeholder", () => {
    const details = identityDetailsOf(TAKE, { hairCut: SAW });
    expect(details?.hairCut).toBe(SAW);
    expect(JSON.stringify(details), "the placeholder is nowhere in the record").not.toContain("attached picture");
  });

  it("CONTROL — with no caption it files nothing, exactly as before", () => {
    /*
      The half that was already live and must stay live: a read-back that failed
      leaves silence rather than a sentence about a photograph. This is the
      negative control for the arm above — without it, "the caption is filed"
      could be true because EVERYTHING is filed.
    */
    expect(identityDetailsOf(TAKE)).toBeNull();
    expect(identityDetailsOf(TAKE, {})).toBeNull();
    expect(identityDetailsOf(TAKE, { hairCut: "   " }), "and whitespace is not a description").toBeNull();
  });

  it("answers only the subjects the delta marks as taken from a picture", () => {
    /*
      Derived from the delta's own record, never from a string match on the
      placeholder — that string is the defect's own currency. A caption offered
      for a subject this step did not take from a picture is ignored, and the
      subject keeps her own words.
    */
    const typed = {
      free: { hairCut: ["a blunt bob"], hairColour: ["copper"] },
      fromPicture: ["hairCut"],
    } as RefineDelta;
    const details = identityDetailsOf(typed, { hairCut: SAW, hairColour: "auburn, warm" });
    expect(details?.hairCut, "taken from a picture — the read-back wins").toBe(SAW);
    expect(details?.hairColour, "typed — her own words stand").toBe("copper");
  });
});

describe("⚠ and it reaches the cousin's prompt", () => {
  const promptFor = (captured?: Record<string, string>) => describeRealizedAxes(
    applyDelta(IDENTITY, TAKE, captured).realized,
    () => false,
    "prescribe",
  );

  it("the description a follow builds its cousins from is the CAPTION", () => {
    const line = promptFor({ hairCut: SAW });
    expect(line).toContain(SAW);
    expect(line, "and never the sentence about a photograph nobody has").not.toContain("attached picture");
  });

  it("CONTROL — without the caption the cousins are told nothing about it", () => {
    /*
      Today's behaviour, kept as the discriminator. If this ALSO contained the
      caption the arm above would be passing on something other than the hybrid.
    */
    expect(promptFor()).not.toContain(SAW);
  });
});

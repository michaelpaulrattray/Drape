/**
 * THE BRIEF REWRITE (#164) — a chip edit applied to the sentence itself, so
 * the engine receives ONE self-consistent prompt: no original-plus-override,
 * no precedence sentence, ever. The byte-identity arms prove a replacement
 * touches only the spans stating the fact; the vocabulary sweep drives every
 * appendable value through the author road's own refusals; the tie-breaker
 * words are forbidden with a positive control.
 */
import { describe, expect, it } from "vitest";

import { rewriteBrief } from "@shared/briefRewrite";
import { neverWrittenIn } from "./promptAuthor";
import { containsHouseSentence } from "./houseBlock";
import { ARCHETYPE_KEYS, BUILDS, ENERGY_KEYS, HERITAGES, LOOK_KEYS, SEXES, AGE_BANDS, AGE_PHASES } from "./castingIntent";

describe("replacement in place", () => {
  it("the founder's own specimen: 30s → 40s lands in the sentence, every other byte untouched", () => {
    const out = rewriteBrief("a fitness creator in their 30s, close-cropped hair", { ageBand: "40s" });
    expect(out?.text).toBe("a fitness creator in their 40s, close-cropped hair");
    expect(out?.edits).toEqual([{ field: "ageBand", mode: "replaced", to: "40s" }]);
  });

  it("a phase rides the replacement, and an existing phase is part of the replaced span", () => {
    expect(rewriteBrief("a woman in her mid 30s", { ageBand: "40s", agePhase: "late" })?.text).toBe("a woman in her late 40s");
    expect(rewriteBrief("a man in his thirties", { ageBand: "50s" })?.text).toBe("a man in his 50s");
  });

  it("a fact stated twice is said right twice — leaving one behind is the contradiction this exists to kill", () => {
    const out = rewriteBrief("a man in his 30s — yes, in his 30s", { ageBand: "40s" });
    expect(out?.text).toBe("a man in his 40s — yes, in his 40s");
  });

  it("a decade outside a fact-stating shape is some other fact's era and is never touched (review of #173, finding 1)", () => {
    /* The styling era survives; the subject's stated age is the one rewritten. */
    expect(rewriteBrief("a woman in her 30s with a 60s bouffant hairstyle", { ageBand: "40s" })?.text)
      .toBe("a woman in her 40s with a 60s bouffant hairstyle");
    /* Age never stated: the bouffant is untouched AND the append branch fires. */
    expect(rewriteBrief("a fitness creator with a 60s bouffant", { ageBand: "40s" })?.text)
      .toBe("a fitness creator with a 60s bouffant. In their 40s.");
  });

  it("'70s+' is consumed whole — the plus never survives into the rewritten text (review of #173, 4a)", () => {
    expect(rewriteBrief("a matriarch in her 70s+", { ageBand: "40s" })?.text).toBe("a matriarch in her 40s");
    expect(rewriteBrief("a rock climber", { ageBand: "70s+" })?.text).toBe("a rock climber. In their seventies or older.");
  });

  it("a gender noun is replaced; 'female' is not a match for 'male'", () => {
    expect(rewriteBrief("a woman with silver hair", { sex: "male" })?.text).toBe("a man with silver hair");
    const out = rewriteBrief("a female pilot", { sex: "male" });
    expect(out?.text).toBe("a male pilot");
  });

  /*
    THE POSSESSIVE FOLLOWS THE NOUN (#534, 2026-09-05).

    A defect this module always had and that nothing could see: until #534 the
    rewritten text went only to the engine, so "a Nordic man in HER 30s" was
    never read by a person. It is written into the customer's own brief box now,
    at the click, so it is read by the one person whose eye closes the card.
  */
  it("a replaced gender noun takes the age span's possessive with it — all three sexes", () => {
    expect(rewriteBrief("a Nordic woman in her 30s with an athletic build", { sex: "male" })?.text)
      .toBe("a Nordic man in his 30s with an athletic build");
    expect(rewriteBrief("a man in his 40s", { sex: "female" })?.text).toBe("a woman in her 40s");
    expect(rewriteBrief("a woman in her 30s", { sex: "nonbinary" })?.text)
      .toBe("an androgynous person in their 30s");
  });

  /*
    A SECOND PERSON'S AGE IS NEVER TOUCHED — and it took two review rounds to
    get the anchor right, so both failures have an arm rather than a comment.

    "daughter" and "son" are not in `GENDER_NOUN`, so the SUBJECT noun reads as
    unique and is replaced, while the age span in the sentence belongs to
    somebody else. Adjacency to the replaced noun is what attributes the
    pronoun; span-count was a proxy and failed in the second case below, where
    the sole span in the whole sentence is the daughter's.
  */
  it("a second person's age span is left alone even when the subject's age is also stated", () => {
    /* Round 1 of the review: this rewrote BOTH and gave "…her daughter in HIS teens". */
    expect(rewriteBrief("a woman in her 30s, her daughter in her teens", { sex: "male" })?.text)
      .toBe("a man in his 30s, her daughter in her teens");
  });

  it("…and when the subject's age is NOT stated, so the only span in the sentence is the other person's", () => {
    /*
      Round 2 of the review, and the reason the anchor is adjacency rather than
      "exactly one span": exactly one is not the same as the subject's. Both of
      these misgendered the child before this arm.
    */
    expect(rewriteBrief("a woman, her daughter in her teens", { sex: "male" })?.text)
      .toBe("a man, her daughter in her teens");
    expect(rewriteBrief("a guy, his son in his teens", { sex: "female" })?.text)
      .toBe("a woman, his son in his teens");
  });

  it("and NOTHING else: a possessive outside an anchored age span is left alone, because nobody can tell whose it is", () => {
    /*
      "her brother" belongs to the subject; "her jacket" might belong to
      anyone in the sentence. The anchored age span is the only possessive
      this module has ever been able to attribute, so it is the only one it
      touches — the unanchored-token lesson of the #173 review, applied to a
      pronoun.
    */
    expect(rewriteBrief("a woman in her 30s beside her brother", { sex: "male" })?.text)
      .toBe("a man in his 30s beside her brother");
  });

  it("an APPENDED sex changes no possessive at all — there was no noun for one to have followed", () => {
    /* The brief states no gender noun, so the edit appends and the subject's own wording is untouched. */
    expect(rewriteBrief("a fitness creator in their 30s", { sex: "male" })?.text)
      .toBe("a fitness creator in their 30s. Cast a man.");
  });

  it("two people in frame make the subject ambiguous — a gender edit falls to APPEND, never rewrites both (review of #173, finding 1)", () => {
    const out = rewriteBrief("a woman posing beside an older man", { sex: "male" });
    expect(out?.text).toBe("a woman posing beside an older man. Cast a man.");
    expect(out?.edits).toEqual([{ field: "sex", mode: "appended", to: "Cast a man." }]);
  });

  it("a heritage word counts only against a person — scenery keeps its sea (review of #173, finding 1)", () => {
    expect(rewriteBrief("a South Asian man in his 40s", { heritage: "West African" })?.text).toBe("a West African man in his 40s");
    expect(rewriteBrief("a model of Nordic heritage", { heritage: "East Asian" })?.text).toBe("a model of East Asian heritage");
    expect(rewriteBrief("shot on a Mediterranean rooftop", { heritage: "Slavic" })?.text)
      .toBe("shot on a Mediterranean rooftop. Of Slavic heritage.");
  });

  it("a build adjective is replaced only where it is anchored to the word 'build'", () => {
    expect(rewriteBrief("an athletic build, kind face", { build: "broad" })?.text).toBe("a broad build, kind face");
    /* A bare adjective is a shoulder or a smile, never touched — the fact falls to APPEND. */
    const bare = rewriteBrief("a broad smile and warm eyes", { build: "slim" });
    expect(bare?.text).toBe("a broad smile and warm eyes. Slim build.");
    expect(bare?.edits).toEqual([{ field: "build", mode: "appended", to: "Slim build." }]);
  });

  it("sentence case survives an article edit (review of #173, 4b)", () => {
    expect(rewriteBrief("An athletic build carries the outfit", { build: "broad" })?.text).toBe("A broad build carries the outfit");
  });
});

describe("append where the brief never stated it", () => {
  it("one plain sentence, sentence-broken from the brief, and NO precedence clause", () => {
    const out = rewriteBrief("a fitness creator, close-cropped hair", { ageBand: "40s" });
    expect(out?.text).toBe("a fitness creator, close-cropped hair. In their 40s.");
    expect(out?.edits).toEqual([{ field: "ageBand", mode: "appended", to: "In their 40s." }]);
  });

  it("existing terminal punctuation is not doubled", () => {
    expect(rewriteBrief("a quiet man.", { ageBand: "50s" })?.text).toBe("a quiet man. In their 50s.");
  });

  it("several edits land in one pass, replaced and appended together", () => {
    const out = rewriteBrief("a Nordic woman in her 30s", { ageBand: "40s", heritage: "Slavic", energy: "grave" });
    expect(out?.text).toBe("a Slavic woman in her 40s. A still, grave presence.");
    expect(out?.edits?.map((e) => e.mode)).toEqual(["replaced", "replaced", "appended"]);
  });

  it("nothing to write is null — an unedited brief does not move", () => {
    expect(rewriteBrief("a goth woman mid 30s", undefined)).toBeNull();
    expect(rewriteBrief("a goth woman mid 30s", {})).toBeNull();
  });
});

describe("vocabulary — nothing a rewrite can produce is a word this studio never sends", () => {
  const texts: string[] = [];
  const base = "a person for the campaign";
  for (const sex of SEXES) texts.push(rewriteBrief(base, { sex })!.text);
  for (const ageBand of AGE_BANDS) for (const agePhase of AGE_PHASES) texts.push(rewriteBrief(base, { ageBand, agePhase })!.text);
  for (const heritage of HERITAGES) texts.push(rewriteBrief(base, { heritage })!.text);
  for (const build of BUILDS) texts.push(rewriteBrief(base, { build })!.text);
  for (const energy of ENERGY_KEYS) texts.push(rewriteBrief(base, { energy })!.text);
  for (const look of LOOK_KEYS) texts.push(rewriteBrief(base, { look })!.text);
  for (const archetype of ARCHETYPE_KEYS) texts.push(rewriteBrief(base, { archetype })!.text);

  it("covers a real population", () => {
    expect(texts.length).toBeGreaterThan(50);
  });

  it("never a NEVER_WRITTEN word, never a house sentence", () => {
    expect(texts.filter((t) => neverWrittenIn(t) !== null)).toEqual([]);
    expect(texts.filter((t) => containsHouseSentence(t) !== null)).toEqual([]);
  });

  const TIE_BREAKERS = [/\bthis wins\b/i, /\bdiffers from the request above\b/i, /\btake precedence\b/i];
  it("never a tie-breaker phrase — the fighting prompt is the thing #164 kills", () => {
    expect(texts.filter((t) => TIE_BREAKERS.some((re) => re.test(t)))).toEqual([]);
  });

  it("positive control: the tie-breaker reader catches the old override paragraph's own words", () => {
    expect(TIE_BREAKERS.some((re) => re.test("Cast as a man; where this differs from the request above, this wins."))).toBe(true);
  });
});

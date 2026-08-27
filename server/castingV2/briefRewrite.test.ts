/**
 * THE BRIEF REWRITE (#164) — a chip edit applied to the sentence itself, so
 * the engine receives ONE self-consistent prompt: no original-plus-override,
 * no precedence sentence, ever. The byte-identity arms prove a replacement
 * touches only the spans stating the fact; the vocabulary sweep drives every
 * appendable value through the author road's own refusals; the tie-breaker
 * words are forbidden with a positive control.
 */
import { describe, expect, it } from "vitest";

import { rewriteBrief } from "./briefRewrite";
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
    const out = rewriteBrief("a 30s man, definitely 30s energy", { ageBand: "40s" });
    expect(out?.text).toBe("a 40s man, definitely 40s energy");
  });

  it("a gender noun is replaced; 'female' is not a match for 'male'", () => {
    expect(rewriteBrief("a woman with silver hair", { sex: "male" })?.text).toBe("a man with silver hair");
    const out = rewriteBrief("a female pilot", { sex: "male" });
    expect(out?.text).toBe("a male pilot");
  });

  it("a heritage vocabulary word is replaced, multiword included", () => {
    expect(rewriteBrief("a South Asian man in his 40s", { heritage: "West African" })?.text).toBe("a West African man in his 40s");
  });

  it("a build adjective is replaced only where it is anchored to the word 'build'", () => {
    expect(rewriteBrief("an athletic build, kind face", { build: "broad" })?.text).toBe("a broad build, kind face");
    /* A bare adjective is a shoulder or a smile, never touched — the fact falls to APPEND. */
    const bare = rewriteBrief("a broad smile and warm eyes", { build: "slim" });
    expect(bare?.text).toBe("a broad smile and warm eyes. Slim build.");
    expect(bare?.edits).toEqual([{ field: "build", mode: "appended", to: "Slim build." }]);
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

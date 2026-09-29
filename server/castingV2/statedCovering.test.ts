import { describe, expect, it } from "vitest";
import { coveringDirective, statedCovering } from "./statedCovering";
import type { CastingIntent } from "./castingIntent";

describe("statedCovering — reads the user's own sentence, never a faith", () => {
  it("recognises a stated covering", () => {
    expect(statedCovering("a woman in her 30s wearing a hijab")?.word).toBe("hijab");
    expect(statedCovering("a man in a turban, 40s")?.word).toBe("turban");
    expect(statedCovering("she wears a niqab")?.word).toBe("niqab");
    expect(statedCovering("in a head scarf")?.word).toBe("head scarf");
  });

  /*
    The half that matters most. D-124's whole point is that the unstated case
    verified at zero of eight and must STAY there: inferring a covering from a
    faith, a name or a heritage is stereotype authoring, and it is the failure
    this channel must never introduce while fixing the other one.
  */
  it("never infers a covering from a faith, a heritage or a name", () => {
    expect(statedCovering("a Muslim woman in her 30s")).toBeNull();
    expect(statedCovering("a Sikh man, 40s, warm")).toBeNull();
    expect(statedCovering("an Orthodox Jewish man in his 50s")).toBeNull();
    expect(statedCovering("Fatima, 28, editorial")).toBeNull();
    expect(statedCovering("a woman of Pakistani heritage")).toBeNull();
  });

  it("matches whole words, so ordinary English is not a garment instruction", () => {
    expect(statedCovering("a hijabi influencer")).toBeNull();
    expect(statedCovering("turbaned")).toBeNull();
    expect(statedCovering("")).toBeNull();
    expect(statedCovering(null)).toBeNull();
  });

  it("speaks the user's own noun back, with the prose that says how it sits", () => {
    const directive = coveringDirective(statedCovering("wearing a hijab")!);
    expect(directive).toContain("wearing a hijab");
    expect(directive).toContain("COMPLETELY covered");
    /* The stated-fact licence shape, which is what gives every sibling teeth. */
    expect(directive).toContain("failed candidate");
    /* The founder's actual complaint: it read as fashion styling, not faith. */
    expect(directive).toContain("never a loosely draped fashion scarf");
  });
});

/*
  ⚠ **THE FOUR PROMPT ARMS THAT STOOD HERE ARE GONE WITH THEIR SUBJECT — #1490
  ACT 2 — AND WHAT THEY WERE GUARDING IS NOW A FILED QUESTION, NOT A SILENCE.**

  They were: *puts the directive in the prompt when the brief states one*, *carves
  the covering out of the headwear and hat exclusions*, *says nothing at all when
  no covering was stated*, and *survives into a follow, where the sentence is gone
  and the notes remain*. All four composed a house-road prompt through
  `composeCandidatePrompt` and read the `STATED COVERING:` block out of it. Act 2
  deleted that composer, so there is no string left for them to assert on.

  ⚠ **READ AT THE CODE BEFORE THEY WERE CUT, BECAUSE THE OBVIOUS FEAR WAS THE
  WRONG ONE.** The worry was that the live prompt would be left telling an engine
  *"where a STATED COVERING block appears…"* with no such block ever present. It
  does not: that sentence and the `no hats` exclusion it carves out BOTH live in
  `cohortPhotorealHuman.ts`'s constant — the HOUSE road's block — and
  `houseBlock.ts`, which is what the author road appends to every prompt, carries
  neither. So nothing dangling ships.

  ⚠ **WHAT IS TRUE INSTEAD IS WORTH MORE, AND IT IS FILED RATHER THAN FOLDED IN
  (his rule on #1398).** D-124's repair — a stated covering described as the
  garment rather than left as a loose noun, because the founder's sheet came back
  with a draped fashion scarf — has not reached an engine since the author road
  became every account's road. `server/castingV2/statedCovering.ts` now has ZERO
  production readers: its last one was `coveringFor`, deleted in this act. On the
  live road a typed hijab reaches the engine as her own two words and gets
  whatever the model's prior does with them, which is exactly the condition D-124
  was written against.

  That is a capability decision, not a cleanup: whether the author road should
  carry a covering directive at all is a question about what the product promises
  a customer who types one. The parser below is therefore KEPT, unchanged and
  still driven — it is the half that would be reconnected, and deleting it would
  delete the founder's repair instead of asking about it.
*/

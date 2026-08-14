import { describe, expect, it } from "vitest";

import { namesUnknownProperNoun } from "./properNouns";
import { promoteStatedRole } from "./heritagePromotion";
import { castingBriefCompiler } from "./briefCompiler";
import type { CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * A name never becomes a casting category.
 *
 * Gate 21 the first time was a fashion-house list, because a house name in
 * `role` was how it presented. The second occurrence was a DIRECTOR, put there
 * by our own repair, and no list was ever going to hold it: measured live on "a
 * Wes Anderson casting, mid 30s", the interpreter returned `role: null` six
 * times out of six, and `promoteStatedRole` then promoted the whole brief into
 * `CASTING CATEGORY (ABSOLUTE)` on every candidate of the roll.
 */

const BASE = {
  cohort: "photoreal_human",
  role: null,
  characterNotes: null,
  sex: null,
  ageBand: null,
  agePhase: null,
  heritage: [],
  build: null,
  energy: null,
  archetype: null,
  variationAxis: "look",
  look: null,
  reads: null,
  composedDirection: null,
} as unknown as CastingIntent;

describe("the listless proper-noun test", () => {
  it("catches a name our vocabularies do not claim", () => {
    expect(namesUnknownProperNoun("a Wes Anderson casting, mid 30s", { mode: "phrase" })).toBe(true);
  });

  it("catches a LEADING name, which the brief-side variant is allowed to miss", () => {
    // The advisor's catch. A role is not a sentence: "Zendaya lookalike" leads
    // with the name, so the sentence-initial exemption would wave it through.
    expect(namesUnknownProperNoun("Zendaya lookalike", { mode: "sentence" })).toBe(false);
    expect(namesUnknownProperNoun("Zendaya lookalike", { mode: "phrase" })).toBe(true);
  });

  it("leaves real categories alone — including the ones carrying ages", () => {
    for (const role of [
      "high-fashion editorial model",
      "skincare founder",
      "a dad in his 30s",
      "runway model, early 20s",
      "beauty creator",
      "heavy metal bogan",
      "wiry cyclist",
    ]) {
      expect(namesUnknownProperNoun(role, { mode: "phrase" })).toBe(false);
    }
  });

  it("does not read a LEADING ARTICLE as a name", () => {
    /*
      Caught by the suite, not by review. "An East Asian model" is a founder's
      own golden, and reading its capitalized article as an unknown name nulled
      the category — reopening the exact category-drop bug the repair exists to
      close. An over-reaching guard is not the safe direction here; it is the
      original defect wearing the fix's clothes.
    */
    expect(namesUnknownProperNoun("An East Asian model", { mode: "phrase" })).toBe(false);
    expect(namesUnknownProperNoun("The wiry cyclist", { mode: "phrase" })).toBe(false);
    // And the article must not become a hiding place.
    expect(namesUnknownProperNoun("A Wes Anderson casting", { mode: "phrase" })).toBe(true);
  });

  it("does not read our own vocabulary words as names", () => {
    // "A Mediterranean man" states a heritage we model; capitalized, but ours.
    expect(namesUnknownProperNoun("Mediterranean male model", { mode: "phrase" })).toBe(false);
  });
});

describe("the repair declines rather than promoting a name", () => {
  it("refuses the brief that put a director in the category block", () => {
    const out = promoteStatedRole(BASE, "a Wes Anderson casting, mid 30s");
    expect(out.role).toBeNull();
  });

  it("still promotes a category carrying a HOUSE, because the scrub handles that", () => {
    /*
      The other over-reach the suite caught. A brand is not a name the guard has
      to refuse — `scrubBrands` removes it and keeps the sentence, which is gate
      21's actual promise. Declining on the raw words instead killed the
      category on every brand brief, Margiela included, which is the pinned
      anti-regression.
    */
    const out = promoteStatedRole(BASE, "a Margiela runway face, early 20s");
    expect(out.role).toBe("a Margiela runway face, early 20s");
  });

  it("still promotes the category it was built for", () => {
    // The negative control. If this goes null the guard has eaten the repair,
    // and the category-drop bug it exists to fix is back.
    const out = promoteStatedRole(BASE, "female mid 20's high-fashion editorial model");
    expect(out.role).toBe("female mid 20's high-fashion editorial model");
  });
});

/** An interpreter that writes a name into `role` — what the guard is for. */
function engineReturning(intent: Record<string, unknown>): TextEngine {
  return {
    id: "stub",
    complete: async () => ({
      text: JSON.stringify(intent),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

describe("the guard is invoked on the real compile path", () => {
  /*
    Invariant 7: a control that is not invoked does not exist. The repair
    declining is not enough on its own — the interpreter is a language model,
    and it wrote "Versace" into `role` unprompted once already.
  */
  it("nulls a name the INTERPRETER wrote, which no repair would have caught", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a moody portrait, mid 30s",
      candidateCount: 2,
      rollSeed: "guard-1",
      engine: engineReturning({
        cohort: "photoreal_human",
        role: "Wes Anderson casting",
        variationAxis: "disposition",
      }),
    } as never);
    const intent = (compiled.compiledBrief as { intent: CastingIntent }).intent;
    expect(intent.role).toBeNull();
  });

  it("keeps a legitimate category the interpreter wrote", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a skincare founder in his 40s",
      candidateCount: 2,
      rollSeed: "guard-2",
      engine: engineReturning({
        cohort: "photoreal_human",
        role: "skincare founder",
        variationAxis: "disposition",
      }),
    } as never);
    const intent = (compiled.compiledBrief as { intent: CastingIntent }).intent;
    expect(intent.role).toBe("skincare founder");
  });

  it("keeps the name out of every candidate's prompt, which is the actual promise", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a moody portrait, mid 30s",
      candidateCount: 4,
      rollSeed: "guard-3",
      engine: engineReturning({
        cohort: "photoreal_human",
        role: "Wes Anderson casting",
        variationAxis: "disposition",
      }),
    } as never);
    const candidates = (compiled as { candidates: Array<{ prompt: string }> }).candidates;
    expect(candidates.length).toBe(4);
    for (const candidate of candidates) {
      expect(candidate.prompt).not.toMatch(/Anderson/i);
    }
  });
});

/**
 * THE MEASURED DEFECT, and the controls that stop its fix reopening D-82.
 *
 * "a twitch streamer" returned `role: null` on 12 of 120 live samples (10.0%,
 * 95% CI 5.8–16.7%), and 11 of those were this guard firing on a role the
 * interpreter had written correctly — it capitalizes Twitch, because Twitch is
 * a proper noun, and the guard could not tell a platform from a person.
 *
 * These run on every change. The paid golden harness cannot be the only thing
 * standing between us and a 10% category loss, because it does not run on every
 * change and a 10% event hides from a single pass.
 */
describe("a platform is not a person", () => {
  it("keeps the category whichever way the interpreter capitalizes it", () => {
    // Both casings observed live: "a Twitch streamer" was dropped, the
    // lowercase forms were kept. They must now agree.
    for (const role of ["a Twitch streamer", "a twitch streamer", "twitch streamer"]) {
      expect(namesUnknownProperNoun(role, { mode: "phrase" }), role).toBe(false);
    }
  });

  it("keeps the platform and institution categories of the same class", () => {
    for (const role of [
      "a YouTube creator",
      "a TikTok dancer",
      "an Instagram model",
      "a K-pop idol",
      "an Olympic swimmer",
      "a Michelin-starred chef",
      "an NBA player",
    ]) {
      expect(namesUnknownProperNoun(role, { mode: "phrase" }), role).toBe(false);
    }
  });

  /*
    THE LOOSENING CONTROLS. This change made the guard more permissive, and the
    thing it must never become permissive about is a person — the D-82 defect
    cost provider refusals on a paid roll.
  */
  it("still nulls the director that D-82 was written for", () => {
    expect(namesUnknownProperNoun("a Wes Anderson casting, mid 30s", { mode: "phrase" })).toBe(true);
    expect(namesUnknownProperNoun("Zendaya lookalike", { mode: "phrase" })).toBe(true);
  });

  /*
    A vouched word does not vouch for its neighbours. This is the shape a
    list-based fix fails in: "the platform is fine, therefore the phrase is
    fine". Every token is tested on its own.
  */
  it("still fires when an unknown name stands next to a vouched one", () => {
    expect(namesUnknownProperNoun("a Twitch streamer called Ninja", { mode: "phrase" })).toBe(true);
    expect(namesUnknownProperNoun("Pokimane Twitch streamer", { mode: "phrase" })).toBe(true);
    expect(namesUnknownProperNoun("a YouTube creator like MrBeast", { mode: "phrase" })).toBe(true);
  });

  it("vouches nothing it was not given — an unlisted platform still fails closed", () => {
    // Not a regression: this is exactly today's behaviour, and it is the
    // property that makes the list safe to hold at all.
    expect(namesUnknownProperNoun("a Kick streamer", { mode: "phrase" })).toBe(true);
  });

  it("keeps the leading-article and vocabulary over-reaches pinned", () => {
    expect(namesUnknownProperNoun("An East Asian model", { mode: "phrase" })).toBe(false);
  });
});

/**
 * A CONDITION IS NOT A PERSON (fable-490 §1a).
 *
 * The founder typed "her skin — Vitiligo" — nobody named, nothing compared —
 * and the delivered render came back carrying the likeness confession: *"Refining
 * can't copy a real person's features, so that part of the comparison was set
 * aside."* The guard had read a capitalised condition as somebody's name.
 *
 * Both arms, because the loosening direction is the dangerous one: a real
 * likeness ask must still drop.
 */
describe("a condition is not a person", () => {
  it("does not read a capitalised condition as a name", () => {
    for (const phrase of [
      "her skin — Vitiligo",
      "Vitiligo",
      "give her Alopecia",
      "Heterochromia",
      "her left ear — Cauliflower ear",
      "a little Rosacea across her cheeks",
    ]) {
      expect(namesUnknownProperNoun(phrase, { mode: "phrase" }), phrase).toBe(false);
    }
  });

  it("STILL fires on a real likeness ask, capitalised or not", () => {
    /* The control, and the reason the list may only hold conditions: a name is
       what this guard exists to keep out of a paid prompt. */
    for (const phrase of [
      "Zendaya lookalike",
      "a Wes Anderson casting",
      "give her Zendaya's cheekbones",
      /* A syndrome named after its describer IS somebody's name, and the list
         deliberately does not hold one. */
      "Marfan syndrome build",
    ]) {
      expect(namesUnknownProperNoun(phrase, { mode: "phrase" }), phrase).toBe(true);
    }
  });

  it("vouches nothing it was not given — an unlisted condition still fails closed", () => {
    /* Not a regression: exactly today's behaviour, and the property that makes
       the list safe to hold at all. */
    expect(namesUnknownProperNoun("a touch of Poliosis at her temple", { mode: "phrase" })).toBe(true);
  });
});

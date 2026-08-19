/**
 * THE HAIR TAKE — its facet split, its complement, and the two fences that stop
 * a style ask carrying somebody else's colour.
 *
 * Everything here is free and offline: no engine, no database, no bytes. The
 * PAID half of this road — does a reader actually scope its answer — is bought
 * separately, on specimens, because a list nobody measured reads as measured to
 * whoever finds it next.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine } from "../providers/types";

import {
  HAIR_COLOUR_FACETS,
  HAIR_FACETS,
  HAIR_TAKES,
  asksAboutHair,
  hairColourFacetsMissedByTheColourTake,
  hairFacetPhrase,
  hairTakeAdmits,
  hairTakeClaims,
  hairTakeDisclaims,
  hairTakeEntry,
  hairTakeFor,
  hairTakeIsAmbiguous,
  hairTakesNamedIn,
  readHairTake,
  resolveHairTake,
  hairTakeNamedIn,
  hairTakeSentence,
  joinPhrases,
} from "./hairReferenceTake";
import { FREE_SUBJECT_KEYS, SUBJECT_CARDS, type FreeSubject } from "./subjectCards";

describe("the hair facets are derived, and the derivation is pinned", () => {
  it("is the five cards D-142 split hair into", () => {
    expect([...HAIR_FACETS].sort()).toEqual(
      ["hairCut", "hairFinish", "hairPattern", "hairShade", "hairWorn"],
    );
  });

  /* The negative control on the prefix rule. A beard is hair and is not HER
     hair, and no reference take has ever meant one — if the naming convention
     ever stops carrying that distinction, this is what says so. */
  it("does not sweep in facial hair", () => {
    expect(FREE_SUBJECT_KEYS).toContain("facialHair");
    expect(HAIR_FACETS).not.toContain("facialHair" as FreeSubject);
  });

  it("names only subjects the product actually has", () => {
    for (const facet of HAIR_FACETS) expect(FREE_SUBJECT_KEYS).toContain(facet);
  });
});

describe("a take is a claim over facets, and the disclaimer is its complement", () => {
  it("colour claims the colour and nothing else", () => {
    expect(hairTakeClaims("colour")).toEqual(HAIR_COLOUR_FACETS);
  });

  it("style claims everything the colour take does not", () => {
    expect([...hairTakeClaims("style")].sort()).toEqual(
      ["hairCut", "hairFinish", "hairPattern", "hairWorn"],
    );
    /* The half that matters: the one facet his amendment scopes out. */
    expect(hairTakeClaims("style")).not.toContain("hairShade" as FreeSubject);
    expect(hairTakeDisclaims("style")).toEqual(["hairShade"]);
  });

  it("the whole look claims every hair facet and disclaims nothing", () => {
    expect([...hairTakeClaims("fullLook")].sort()).toEqual([...HAIR_FACETS].sort());
    expect(hairTakeDisclaims("fullLook")).toEqual([]);
  });

  /*
    THE PARTITION, asserted rather than eyeballed: claims and disclaims cover
    every hair facet exactly once, for every take. This is what would catch a
    complement rewritten by hand into a list that drops a facet — the drift
    would leave a facet spoken for by neither half, which is a property nobody
    scoped riding into a prompt under a sentence that promised it was scoped.
  */
  it("every take partitions the hair facets", () => {
    for (const take of HAIR_TAKES) {
      const both = [...hairTakeClaims(take), ...hairTakeDisclaims(take)].sort();
      expect(both).toEqual([...HAIR_FACETS].sort());
      const claimed = new Set(hairTakeClaims(take));
      for (const facet of hairTakeDisclaims(take)) expect(claimed.has(facet)).toBe(false);
    }
  });

  it("admission is positive — a facet reaches the sentence only by being claimed", () => {
    expect(hairTakeAdmits("style", "hairCut")).toBe(true);
    expect(hairTakeAdmits("style", "hairShade")).toBe(false);
    expect(hairTakeAdmits("colour", "hairShade")).toBe(true);
    expect(hairTakeAdmits("colour", "hairCut")).toBe(false);
    /* A subject that is not hair at all is not admitted by any take. */
    for (const take of HAIR_TAKES) expect(hairTakeAdmits(take, "lips")).toBe(false);
  });
});

describe("THE HEADING FENCE — a future colour facet cannot land in style silently", () => {
  it("no hair card headed COLOUR sits outside the colour take", () => {
    expect(hairColourFacetsMissedByTheColourTake()).toEqual([]);
  });

  /*
    THE POSITIVE CONTROL. The assertion above passes on an empty stage unless
    the fence can fire, so this drives it: a card headed "HAIR ROOT COLOUR" that
    the colour take does not claim IS the leak, and the fence names it.

    Without this, `toEqual([])` would go on passing after somebody deleted the
    `includes("COLOUR")` clause, and nothing would say so.
  */
  it("fires on a hair facet whose heading names colour", () => {
    const cards: Record<string, { heading: string }> = Object.fromEntries(
      HAIR_FACETS.map((facet) => [facet, { heading: SUBJECT_CARDS[facet].heading }]),
    );
    cards.hairRoots = { heading: "HAIR ROOT COLOUR" };
    expect(
      hairColourFacetsMissedByTheColourTake(cards, [...HAIR_FACETS, "hairRoots" as FreeSubject]),
    ).toEqual(["hairRoots"]);
  });

  /* And a hair facet with no card at all is refused rather than reported clean —
     an absent heading must not read as "no colour in the name". */
  it("refuses a hair facet the cards do not carry", () => {
    expect(() => hairColourFacetsMissedByTheColourTake({}, ["hairCut" as FreeSubject]))
      .toThrow(/no subject card/);
  });

  it("the colour take's own facet is the one headed COLOUR", () => {
    expect(SUBJECT_CARDS.hairShade.heading).toBe("HAIR COLOUR");
  });
});

describe("the customer phrases are total over the hair facets", () => {
  it("every hair facet has ordinary words", () => {
    for (const facet of HAIR_FACETS) {
      expect(hairFacetPhrase(facet)).toMatch(/^[a-z]/);
    }
  });

  /* A facet with no phrase throws rather than describing itself by its key —
     "hairWorn" is not a phrase anybody says, and it must never reach a
     sentence a person reads. */
  it("refuses a facet nobody wrote words for", () => {
    expect(() => hairFacetPhrase("teeth")).toThrow(/no customer phrase/);
  });

  it("joins a list the way English does", () => {
    expect(joinPhrases([])).toBe("");
    expect(joinPhrases(["the cut"])).toBe("the cut");
    expect(joinPhrases(["the cut", "the texture"])).toBe("the cut and the texture");
    expect(joinPhrases(["a", "b", "c"])).toBe("a, b and c");
  });
});

describe("THE RIDE-ALONG SENTENCE — ruling 5, composed from the same list twice", () => {
  it("a style take claims the cut and explicitly not the colour", () => {
    const sentence = hairTakeSentence("style");
    expect(sentence).toContain("the cut");
    expect(sentence).toContain("how it is worn");
    /* The claim half must not name the colour, and the disclaimer half must. */
    const [claim, ...rest] = sentence.split(" Do not take ");
    expect(claim).not.toContain("the colour");
    expect(rest.join(" ")).toContain("the colour");
    expect(sentence).toMatch(/from the reference — keep hers\.$/);
  });

  it("a colour take claims the colour and disclaims the rest by name", () => {
    const sentence = hairTakeSentence("colour");
    expect(sentence).toContain("Take her hair from the reference: the colour.");
    expect(sentence).toContain("the cut");
    expect(sentence).toContain("how it is worn");
    expect(sentence).toMatch(/from the reference — keep hers\.$/);
  });

  it("the whole look ends without a disclaimer clause", () => {
    const sentence = hairTakeSentence("fullLook");
    expect(sentence).not.toContain("Do not take");
    expect(sentence).not.toContain("keep hers");
    for (const facet of HAIR_FACETS) expect(sentence).toContain(hairFacetPhrase(facet));
  });

  /*
    EVERY DISCLAIMED FACET IS NAMED, on every take. The failure this catches is
    a sentence that scopes ONE property and leaves the others unspoken — which
    reads as scoped and is not.
  */
  it("names every facet it does not claim", () => {
    for (const take of HAIR_TAKES) {
      const sentence = hairTakeSentence(take);
      for (const facet of hairTakeDisclaims(take)) {
        expect(sentence).toContain(hairFacetPhrase(facet));
      }
    }
  });
});

describe("the take vocabulary", () => {
  it("is his three answers, in his order", () => {
    expect(HAIR_TAKES).toEqual(["colour", "style", "fullLook"]);
    expect(HAIR_TAKES.map((take) => hairTakeEntry(take).label)).toEqual(
      ["the colour", "the style", "the whole look"],
    );
  });

  it("carries his ruling about which form each answer takes", () => {
    expect(hairTakeEntry("colour").form).toBe("words");
    expect(hairTakeEntry("style").form).toBe("crop");
    expect(hairTakeEntry("fullLook").form).toBe("crop");
  });
});

describe("READING THE ASK — is it about hair, and did she say which take", () => {
  /*
    THE TWO DIRECTIONS ERR DELIBERATELY OPPOSITE WAYS, and the tests say so.
    Missing a hair ask costs a paid render that ignored her picture; guessing a
    take costs the guess his ruling forbids.
  */
  it("hears hair in his own example", () => {
    expect(asksAboutHair("copy hair from reference")).toBe(true);
  });

  it("hears the words the cards themselves name", () => {
    /* Derived, so these pass because `hairWorn` and `hairCut` name them — not
       because anybody remembered to write them here. */
    expect(asksAboutHair("copy this updo from the reference")).toBe(true);
    expect(asksAboutHair("give her these bangs")).toBe(true);
    expect(asksAboutHair("take the highlights from this")).toBe(true);
    expect(asksAboutHair("use this braid")).toBe(true);
  });

  it("stays out of asks that are about something else", () => {
    expect(asksAboutHair("copy her makeup from this photo")).toBe(false);
    expect(asksAboutHair("give her green eyes")).toBe(false);
    expect(asksAboutHair("this tattoo on her right arm")).toBe(false);
  });

  it("asks the question when she named no take — which is his ruling", () => {
    expect(hairTakeNamedIn("copy hair from reference")).toBeNull();
    expect(hairTakeNamedIn("give her this hair")).toBeNull();
  });

  it("routes without asking when she already said which", () => {
    expect(hairTakeNamedIn("copy her hair colour from the reference")).toBe("colour");
    expect(hairTakeNamedIn("copy this hairstyle")).toBe("style");
    expect(hairTakeNamedIn("give her this haircut")).toBe("style");
    expect(hairTakeNamedIn("copy the whole look from this")).toBe("fullLook");
    /* The US spelling is not a different question. */
    expect(hairTakeNamedIn("take her hair color from this")).toBe("colour");
  });

  /* TWO TAKES NAMED IS NEITHER. "The colour and the cut" is a person describing
     a whole look in her own words, and the right answer to it is the question —
     not the first match, and not a guess at which she meant most. */
  it("treats two named takes as none", () => {
    expect(hairTakeNamedIn("copy the colour and the cut from this")).toBeNull();
  });

  it("does not read a take out of a value word", () => {
    /* "Copper" is the ask's own content, not a statement about which take. */
    expect(hairTakeNamedIn("make her hair copper like this")).toBeNull();
  });
});

describe("THE DEFAULT IS THE WHOLE LOT — his second ruling (fable-1087)", () => {
  /*
    The question that used to fire here is deleted. What replaces it is not a
    guess: law 8 says the user's ontology governs, and a stylist handed a
    picture and told *copy this hair* copies the hair. Reading that as
    under-specified was the product asking a person to speak its vocabulary
    back to it.
  */
  it("reads a vague hair ask as the whole look", () => {
    expect(hairTakeFor("copy this hair")).toBe("fullLook");
    expect(hairTakeFor("copy hair from reference")).toBe("fullLook");
    expect(hairTakeFor("give her this hair")).toBe("fullLook");
  });

  it("still honours a take she NAMED, which is the half his ruling preserves", () => {
    expect(hairTakeFor("copy just the hair colour")).toBe("colour");
    expect(hairTakeFor("copy this hairstyle")).toBe("style");
    expect(hairTakeFor("copy the whole look")).toBe("fullLook");
  });

  it("marks a two-take sentence as needing more than a word test", () => {
    expect(hairTakesNamedIn("copy the hairstyle but keep her colour").sort())
      .toEqual(["colour", "style"]);
    expect(hairTakeIsAmbiguous("copy the hairstyle but keep her colour")).toBe(true);
    expect(hairTakeIsAmbiguous("copy this hair")).toBe(false);
    expect(hairTakeIsAmbiguous("copy just the colour")).toBe(false);
  });
});

describe("THE ESCALATION — a sentence a person reads plainly (fable-1089 §2)", () => {
  /** A transport that answers with these words and records what it was asked. */
  function engineSaying(reply: string): { engine: TextEngine; sent: { user?: string } } {
    const sent: { user?: string } = {};
    const engine = {
      async complete(request: any) {
        sent.user = request.user;
        return { text: reply };
      },
    } as unknown as TextEngine;
    return { engine, sent };
  }

  /* An engine that must never be reached — the fast path's own proof. */
  const forbidden = {
    async complete() { throw new Error("the word tests should have answered this"); },
  } as unknown as TextEngine;

  it("HIS OWN SENTENCE — style, without the colour it says to keep", async () => {
    /*
      THE ARM THIS BUILD EXISTS FOR, and it was RED before the escalation:
      *"copy the hairstyle but keep her colour"* names two takes, two-at-once
      counted as neither, neither fell to the whole lot, and the ask that says
      KEEP HER COLOUR took the reference's colour — the exact failure his
      fable-1048 amendment was written to prevent.

      It goes green only when the take is `style`, which is the take whose
      ride-along sentence disclaims the colour.
    */
    const { engine } = engineSaying(JSON.stringify({ take: "style" }));
    const take = await resolveHairTake({
      instruction: "copy the hairstyle but keep her colour",
      engine,
    });
    expect(take).toBe("style");
    /* And the take it resolved to is one that promises to leave her colour
       alone — asserted through the take map rather than by reading the word,
       so the two cannot drift apart. */
    expect(hairTakeDisclaims("style")).toContain("hairShade");
  });

  it("the other shape that broke every guess — 'the colour and the cut' is the lot", async () => {
    /* A union rather than an exclusion. First-named-wins would have answered
       `colour` here and been wrong; the reader answers what a person would. */
    const { engine } = engineSaying(JSON.stringify({ take: "fullLook" }));
    expect(await resolveHairTake({ instruction: "copy the colour and the cut", engine }))
      .toBe("fullLook");
  });

  it("the ordinary asks never reach a model at all", async () => {
    /* The fast path, proven by an engine that throws if it is touched: the
       word tests answer for free and only a two-take sentence spends. */
    expect(await resolveHairTake({ instruction: "copy this hair", engine: forbidden }))
      .toBe("fullLook");
    expect(await resolveHairTake({ instruction: "copy just the colour", engine: forbidden }))
      .toBe("colour");
    expect(await resolveHairTake({ instruction: "copy this hairstyle", engine: forbidden }))
      .toBe("style");
  });

  it("asks with the three takes COMPOSED from the map, at the wire", async () => {
    const { engine, sent } = engineSaying(JSON.stringify({ take: "style" }));
    await resolveHairTake({ instruction: "the hairstyle but keep her colour", engine });
    /* Invariant 5: the fence is what is actually sent. A fourth take declared
       tomorrow appears here without anybody editing a prompt. */
    for (const take of HAIR_TAKES) {
      expect(sent.user).toContain(`${take} — ${hairTakeEntry(take).label}`);
    }
    /* Her own sentence, and the exclusion rule that is the whole reason for
       the call. */
    expect(sent.user).toContain('"the hairstyle but keep her colour"');
    expect(sent.user).toContain("she is taking");
  });

  it("REFUSES rather than inventing: a take outside the closed set is unreadable", async () => {
    for (const reply of [
      JSON.stringify({ take: "texture" }),
      JSON.stringify({ take: "the style" }),
      JSON.stringify({ take: "" }),
      JSON.stringify({ nope: "style" }),
      "style",
      "",
    ]) {
      const { engine } = engineSaying(reply);
      expect(await resolveHairTake({
        instruction: "copy the hairstyle but keep her colour",
        engine,
      })).toBeNull();
    }
  });

  it("tolerates the politeness a model puts around one word", async () => {
    const { engine } = engineSaying("```json\n{\"take\": \"Style\"}\n```");
    expect(await resolveHairTake({
      instruction: "copy the hairstyle but keep her colour",
      engine,
    })).toBe("style");
  });

  it("NEVER falls back to the whole lot when it cannot read — that is the defect", async () => {
    /*
      The one arm that must not be softened. A transport hiccup on a sentence
      saying *keep her colour* must not resolve to the take that takes it.
      `null` is unreadable and the caller spends the road's existing unreadable
      answer; a fallback here would be the bug wearing a retry.
    */
    const thrower = {
      async complete() { throw new Error("socket"); },
    } as unknown as TextEngine;
    expect(await resolveHairTake({
      instruction: "copy the hairstyle but keep her colour",
      engine: thrower,
    })).toBeNull();
    expect(await resolveHairTake({
      instruction: "copy the hairstyle but keep her colour",
      engine: null,
    })).toBeNull();
  });

  it("reads a bare reply the same way, so the parse cannot be the discriminator", () => {
    expect(readHairTake(JSON.stringify({ take: "fullLook" }))).toBe("fullLook");
    expect(readHairTake(JSON.stringify({ take: "colour" }))).toBe("colour");
    expect(readHairTake("not json at all")).toBeNull();
  });

  /*
    THE TWO FUNCTIONS STAY APART, and this arm is why. `hairTakeNamedIn` reports
    what she SAID; `hairTakeFor` reports what she GETS. Collapsing them would
    make "she named the whole look" and "she named nothing" the same fact, and
    the day that distinction matters — a court arm, a demand tally, a decision
    about whether to say what we assumed — it would already be gone.
  */
  it("keeps 'she named nothing' distinguishable from 'she named the whole look'", () => {
    expect(hairTakeNamedIn("copy this hair")).toBeNull();
    expect(hairTakeFor("copy this hair")).toBe("fullLook");
    expect(hairTakeNamedIn("copy the whole look")).toBe("fullLook");
  });

  /*
    AND TWO TAKES AT ONCE IS STILL NEITHER, which now means the whole lot rather
    than a question. That is the right answer to it: "the colour and the cut" is
    a person describing a whole look in her own words.
  */
  it("reads two takes named at once as the whole lot", () => {
    expect(hairTakeNamedIn("copy the colour and the cut")).toBeNull();
    expect(hairTakeFor("copy the colour and the cut")).toBe("fullLook");
  });
});

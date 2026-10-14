/**
 * THE HIDDEN VOICE CARD'S RULES, DRIVEN DIRECTLY — card #2498.
 *
 * The three rules the card names are enforced in `composeVoiceCard`, in code,
 * so they are driven here with writer drafts that BREAK them — a backstop only
 * ever tested through a model that usually behaves is untested (law 3):
 *
 *   · the customer's own words win over the picture on sex and age;
 *   · an accent is never inferred — "Native English" unless their words name one;
 *   · normal speaking volume unless their words ask for a whisper.
 *
 * Every rule has a positive control (the words DO say it) beside the negative
 * one, so an arm cannot pass by the rule being absent.
 */
import { describe, expect, it } from "vitest";

import type { CastVoiceCardSources } from "../db/castVoiceCards";
import type { TextEngine, TextRequest } from "../providers/types";
import {
  accentFromWords,
  ageFromWords,
  asksForWhisper,
  castDescriptionParagraph,
  composeVoiceCard,
  customerWords,
  parseVoiceCardDraft,
  sexFromWords,
  voiceCardSourceHash,
  writeVoiceCard,
} from "./voiceCardWriter";

const PREVIEW = "Don't come any closer unless you mean it. I answer slow, and I don't like repeating myself. Speak plain, say what you came for, and then go back the way you came.";

function draft(overrides: Partial<{ sex: string; age: string; body: string; preview: string }> = {}) {
  return {
    sex: "male",
    age: "early 50s",
    body: "Persona: a ruined hybrid brute. Emotion: sullen menace. Deep, low-pitched chest voice, gravelly. Slow, sparing delivery.",
    preview: PREVIEW,
    ...overrides,
  };
}

function sources(overrides: Partial<CastVoiceCardSources> = {}): CastVoiceCardSources {
  return {
    modelId: 7,
    name: "Test",
    briefText: "an undead man-bear-pig hybrid",
    masterPrompt: "A hulking hybrid creature.\nFRAMING: waist-up, centred.",
    personality: "Sits heavy and still.",
    voice: "A low voice with a rough edge.",
    personalityOwnWords: null,
    voiceOwnWords: null,
    personalityEditedAt: null,
    voiceEditedAt: null,
    ...overrides,
  };
}

describe("sex and age — the customer's words win over the picture", () => {
  it("reads sex from the words, and refuses to decide only when they name none", () => {
    expect(sexFromWords("a cyberpunk mercenary woman")).toBe("Female");
    expect(sexFromWords("a grizzled old man")).toBe("Male");
    expect(sexFromWords("an undead man-bear-pig hybrid")).toBe("Male");
    expect(sexFromWords("a non-binary pilot")).toBe("Androgynous");
    expect(sexFromWords("a glowing forest spirit")).toBeNull();
    /* Negative controls: words that only CONTAIN a marker are not a marker. */
    expect(sexFromWords("Pigman, a human theme")).toBeNull();
  });

  /*
    ⚠ **THIS ARM ASSERTED THE DEFECT** — it held `sexFromWords("a man and a
    woman")` to be `null`, which is the relay's finding 3 on PR #2500 written
    down as expected behaviour. A brief that mentions anybody else settled
    nothing and the PICTURE then decided, which is the exact
    female-written-as-male failure this whole card exists to close.
  */
  it("⚠ a brief that also mentions somebody else is settled by its SUBJECT, not handed to the picture", () => {
    expect(sexFromWords("a woman searching for her lost son")).toBe("Female");
    expect(sexFromWords("a man who raised his daughter alone")).toBe("Male");
    expect(sexFromWords("a mother and her boys")).toBe("Female");
    /* And the whole point of it: the picture-reader no longer gets a say. */
    const { voiceCard } = composeVoiceCard(draft({ sex: "male" }), "a woman searching for her lost son");
    expect(voiceCard).toContain("Female, early 50s.");
  });

  it("CONTROL — where only one sex is named the answer is unchanged, so nothing that read right now reads differently", () => {
    for (const [words, expected] of [
      ["a cyberpunk mercenary woman", "Female"],
      ["a grizzled old man", "Male"],
      ["a non-binary pilot", "Androgynous"],
      ["a glowing forest spirit", null],
    ] as const) {
      expect(sexFromWords(words)).toBe(expected);
    }
  });

  it("⚠ a body sentence naming the other sex is dropped, because the designer reads the whole card", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: a ruined brute. A gravelly man's baritone underneath. Emotion: sullen menace." }),
      "a cyberpunk mercenary woman",
    );
    expect(voiceCard).toContain("Female, early 50s.");
    expect(voiceCard).not.toMatch(/man's baritone/i);
    expect(voiceCard).toContain("Emotion: sullen menace.");
  });

  it("CONTROL — a body sentence agreeing with the opening, and one naming no sex at all, both survive", () => {
    const agreeing = composeVoiceCard(
      draft({ body: "Persona: a ruined brute. A gravelly chest baritone underneath. Emotion: sullen menace." }),
      "a cyberpunk mercenary woman",
    ).voiceCard;
    expect(agreeing).toContain("A gravelly chest baritone underneath.");
    /* With no sex settled there is nothing to contradict, so nothing is lost. */
    const unsettled = composeVoiceCard(
      draft({ sex: "nonsense", body: "Persona: a spirit. A gravelly man's baritone underneath." }),
      "a glowing forest spirit",
    ).voiceCard;
    expect(unsettled).toContain("A gravelly man's baritone underneath.");
  });

  it("⚠ a body sentence stating an age is dropped once the opening carries one, and kept when it does not", () => {
    const withAge = composeVoiceCard(
      draft({ age: "early 50s", body: "Persona: a courier. Sounds like a teenager who grew up fast. Emotion: wry." }),
      "a 64-year-old courier",
    ).voiceCard;
    expect(withAge).toContain("Male, 64-year-old.");
    expect(withAge).not.toMatch(/teenager/i);
    expect(withAge).toContain("Emotion: wry.");

    const noAge = composeVoiceCard(
      draft({ age: "   ", body: "Persona: a courier. Sounds like a teenager who grew up fast. Emotion: wry." }),
      "a courier",
    ).voiceCard;
    expect(noAge).toContain("Sounds like a teenager who grew up fast.");
  });

  it("⚠ the words say a woman and the picture-reader says male — the card says Female", () => {
    const { voiceCard } = composeVoiceCard(draft({ sex: "male" }), "a cyberpunk mercenary woman");
    expect(voiceCard.startsWith("Native English. Female, early 50s. Studio quality.")).toBe(true);
  });

  it("CONTROL — words silent on sex, so the picture-reader's proposal fills it", () => {
    const { voiceCard } = composeVoiceCard(draft({ sex: "female" }), "a glowing forest spirit");
    expect(voiceCard.startsWith("Native English. Female, early 50s.")).toBe(true);
  });

  it("⚠ a stated age wins over the reader's guess; silent words keep the guess", () => {
    expect(ageFromWords("a 32-year-old courier")).toBe("32-year-old");
    expect(ageFromWords("a woman in her forties")).toBe("in her forties");
    expect(ageFromWords("late 60s fisherman")).toBe("late 60s");
    expect(ageFromWords("a courier")).toBeNull();

    expect(composeVoiceCard(draft({ age: "early 20s" }), "a 64-year-old man").voiceCard)
      .toContain("Male, 64-year-old.");
    expect(composeVoiceCard(draft({ age: "early 20s" }), "a courier").voiceCard)
      .toContain("Male, early 20s.");
  });
});

describe("accent — never inferred from looks", () => {
  it("⚠ words name no accent: the card is Native English even when the reader wrote one", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: dock worker. Thick Jamaican accent with rolling vowels. Emotion: warm. Deep voice." }),
      "a dock worker",
    );
    expect(voiceCard.startsWith("Native English.")).toBe(true);
    expect(voiceCard).not.toMatch(/jamaican|accent/i);
    expect(voiceCard).toContain("Emotion: warm.");
  });

  it("CONTROL — the customer's own words name the accent, and it is theirs verbatim", () => {
    expect(accentFromWords("a sailor with a thick Scottish accent")).toBe("thick Scottish accent");
    expect(accentFromWords("speaks with an accent")).toBeNull();
    expect(accentFromWords("a sailor")).toBeNull();
    const { voiceCard } = composeVoiceCard(draft(), "a sailor with a thick Scottish accent");
    expect(voiceCard.startsWith("Thick Scottish accent. Male")).toBe(true);
    expect(voiceCard).not.toContain("Native English");
  });

  /*
    ⚠ **A DECORATIVE "ACCENT" IS NOT AN ACCENT** — the relay's finding 4 on PR
    #2500. A brief describing clothes put a colour into the card's opening
    clause and the voice designer was handed "Red accent." as a way of speaking.
  */
  it("⚠ a colour or a furnishing is refused, and a place-named accent still is not", () => {
    expect(accentFromWords("a courier in a jacket with a red accent colour")).toBeNull();
    expect(accentFromWords("a bare room with one brass accent")).toBeNull();
    expect(accentFromWords("stands by an accent wall")).toBeNull();
    /* CONTROLS — a place and a thickness are in neither refusing list. */
    expect(accentFromWords("a thick Scottish accent")).toBe("thick Scottish accent");
    expect(accentFromWords("a faint French accent")).toBe("faint French accent");
    expect(accentFromWords("a slight Southern accent")).toBe("slight Southern accent");
  });

  it("⚠ a dialect the writer invented without the word 'accent' is dropped too", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: dock worker. A soft Scottish lilt on the vowels. Emotion: warm. A Southern drawl at the ends." }),
      "a dock worker",
    );
    expect(voiceCard.startsWith("Native English.")).toBe(true);
    expect(voiceCard).not.toMatch(/lilt|drawl|scottish|southern/i);
    expect(voiceCard).toContain("Emotion: warm.");
  });

  it("CONTROL — once the customer HAS named an accent, the writer's matching dialect words stay", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: dock worker. A soft lilt on the vowels. Emotion: warm." }),
      "a dock worker with a thick Scottish accent",
    );
    expect(voiceCard.startsWith("Thick Scottish accent.")).toBe(true);
    expect(voiceCard).toContain("A soft lilt on the vowels.");
  });
});

describe("volume — normal unless the customer asks for a whisper", () => {
  it("⚠ a whispered or breathy sentence is dropped and the volume is stated", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: assassin. Speaks in a hushed, breathy whisper. Emotion: cold. Low-pitched, dry voice." }),
      "a quiet assassin",
    );
    expect(voiceCard).not.toMatch(/whisper|hushed|breathy/i);
    expect(voiceCard.endsWith("Normal speaking volume.")).toBe(true);
    expect(voiceCard).toContain("Emotion: cold.");
  });

  it("CONTROL — the customer asked for a whisper, so it stays and no volume is imposed", () => {
    expect(asksForWhisper("a ghost who only ever whispers")).toBe(true);
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: ghost. Speaks in a hushed whisper. Emotion: sorrowful." }),
      "a ghost who only ever whispers",
    );
    expect(voiceCard).toContain("Speaks in a hushed whisper.");
    expect(voiceCard).not.toContain("Normal speaking volume.");
  });

  it("does not state the volume twice when the reader already did", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: operative. Speaks at a normal volume and a measured pace." }),
      "an operative",
    );
    expect(voiceCard.match(/normal (speaking )?volume/gi)).toHaveLength(1);
  });

  /*
    ⚠ **NEGATION IS HONOURED** — the relay's finding 4 on PR #2500. A brief
    saying the character NEVER whispers read as asking for a whisper, so the
    card dropped the "Normal speaking volume." line that brief had demanded.
  */
  it("⚠ a brief refusing a whisper is not an ask for one, and the volume is stated", () => {
    expect(asksForWhisper("a sergeant who never whispers")).toBe(false);
    expect(asksForWhisper("not breathy at all")).toBe(false);
    expect(asksForWhisper("firm, rather than a murmur")).toBe(false);
    expect(asksForWhisper("speaks without a hush")).toBe(false);

    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: sergeant. Speaks in a hushed whisper. Emotion: clipped." }),
      "a sergeant who never whispers",
    );
    expect(voiceCard).not.toMatch(/hushed whisper/i);
    expect(voiceCard.endsWith("Normal speaking volume.")).toBe(true);
  });

  /*
    ⚠ **THE SWEEP'S OWN FINDINGS** (working law 7, on the relay's finding 4).
    The finding named the whisper reader; sweeping the class across this file
    found the SAME mistake in two readers it did not name. Neither was reported
    by anyone — both are this shift's, and these are their arms.
  */
  it("⚠ SWEEP — a negated AGE is not a stated age, and the opening does not claim one", () => {
    expect(ageFromWords("not a teenager")).toBeNull();
    expect(ageFromWords("never elderly")).toBeNull();
    expect(ageFromWords("no 40-year-olds")).toBeNull();
    /* CONTROLS — a stated age, and a negated one followed by a real one. */
    expect(ageFromWords("a teenager")).toBe("teenager");
    expect(ageFromWords("not a teenager, more like late 30s")).toBe("late 30s");

    const { voiceCard } = composeVoiceCard(draft({ age: "early 50s" }), "a courier, not a teenager");
    expect(voiceCard).toContain("early 50s.");
    expect(voiceCard).not.toMatch(/teenager/i);
  });

  it("⚠ SWEEP — a negated ACCENT is not a named one, and the filler list is what hid it", () => {
    expect(accentFromWords("a sailor with no Scottish accent")).toBeNull();
    expect(accentFromWords("never a French accent")).toBeNull();
    expect(accentFromWords("plain speech, not a thick Irish accent")).toBeNull();
    /* CONTROLS — the named accent still reads, and "no accent" still reads null. */
    expect(accentFromWords("a sailor with a thick Scottish accent")).toBe("thick Scottish accent");
    expect(accentFromWords("speaks with no accent")).toBeNull();

    const { voiceCard } = composeVoiceCard(draft(), "a sailor with no Scottish accent");
    expect(voiceCard.startsWith("Native English.")).toBe(true);
  });

  it("⚠ SWEEP — a negated SEX is skipped rather than believed, and a real one after it still wins", () => {
    expect(sexFromWords("not a woman")).toBeNull();
    expect(sexFromWords("not a woman — a man")).toBe("Male");
    /* CONTROL — an un-negated subject is untouched by any of this. */
    expect(sexFromWords("a woman searching for her lost son")).toBe("Female");
  });

  it("CONTROL — a real ask still reads as one, including beside a negated word", () => {
    expect(asksForWhisper("a ghost who only ever whispers")).toBe(true);
    expect(asksForWhisper("a breathy, intimate delivery")).toBe(true);
    /* Two whisper words, one negated and one asked — the ask wins. */
    expect(asksForWhisper("never shouts; a breathy edge throughout")).toBe(true);
  });

  it("⚠ the writer's own 'never breathy' sentence survives, because one reader answers both", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Persona: sergeant. Delivery is firm and clear, never breathy. Emotion: clipped." }),
      "a sergeant",
    );
    expect(voiceCard).toContain("Delivery is firm and clear, never breathy.");
    expect(voiceCard.endsWith("Normal speaking volume.")).toBe(true);
  });
});

describe("the card's shape and bounds", () => {
  it("opens accent → sex and age → Studio quality → the body, and drops a duplicate Studio quality", () => {
    const { voiceCard } = composeVoiceCard(
      draft({ body: "Studio quality. Persona: brute. Emotion: sullen." }),
      "an undead man-bear-pig hybrid",
    );
    expect(voiceCard).toBe("Native English. Male, early 50s. Studio quality. Persona: brute. Emotion: sullen. Normal speaking volume.");
  });

  it("stays within the provider's 1000 characters, cut at a sentence", () => {
    const long = Array.from({ length: 60 }, (_, index) => `Sentence number ${index} about the voice.`).join(" ");
    const { voiceCard } = composeVoiceCard(draft({ body: long }), "a man");
    expect(voiceCard.length).toBeLessThanOrEqual(1000);
    expect(voiceCard.endsWith("Normal speaking volume.")).toBe(true);
    expect(voiceCard).toMatch(/about the voice\. Normal speaking volume\.$/);
  });

  it("strips stage directions from the line the voices read", () => {
    const { previewLine } = composeVoiceCard(draft({ preview: "Whaddya want. [grunts] Leave me be. (snorts) *sighs* Go." }), "x");
    expect(previewLine).toBe("Whaddya want. Leave me be. Go.");
  });

  it("parses only the four strings, and refuses anything else", () => {
    expect(parseVoiceCardDraft("```json\n" + JSON.stringify(draft()) + "\n```")).toEqual(draft());
    expect(parseVoiceCardDraft('{"sex":"male","age":"50s","body":"x"}')).toBeNull();
    expect(parseVoiceCardDraft('{"sex":"male","age":"50s","body":"unterminated')).toBeNull();
    expect(parseVoiceCardDraft("no json at all")).toBeNull();
  });
});

describe("what counts as the customer's words, and what the card is written from", () => {
  it("a line counts only once the CUSTOMER rewrote it", () => {
    expect(customerWords(sources())).toBe("an undead man-bear-pig hybrid");
    const edited = customerWords(sources({ voiceEditedAt: new Date(), voiceOwnWords: "make it a whisper" }));
    expect(edited).toContain("A low voice with a rough edge.");
    expect(edited).toContain("make it a whisper");
  });

  it("the description paragraph stops at FRAMING", () => {
    expect(castDescriptionParagraph("A hulking hybrid creature.\nFRAMING: waist-up.")).toBe("A hulking hybrid creature.");
  });

  it("the source hash moves with every source and holds still otherwise", () => {
    const base = voiceCardSourceHash(sources(), "key/a.png");
    expect(voiceCardSourceHash(sources(), "key/a.png")).toBe(base);
    for (const changed of [
      voiceCardSourceHash(sources(), "key/b.png"),
      voiceCardSourceHash(sources(), null),
      voiceCardSourceHash(sources({ voice: "Bright." }), "key/a.png"),
      voiceCardSourceHash(sources({ personality: "Fidgets." }), "key/a.png"),
      voiceCardSourceHash(sources({ briefText: "a sea captain" }), "key/a.png"),
      voiceCardSourceHash(sources({ voiceOwnWords: "louder" }), "key/a.png"),
      voiceCardSourceHash(sources({ masterPrompt: "Another.\nFRAMING: x" }), "key/a.png"),
    ]) {
      expect(changed).not.toBe(base);
    }
  });
});

describe("the writer at the wire", () => {
  function engine(replies: string[]): { engine: TextEngine; sent: TextRequest[] } {
    const sent: TextRequest[] = [];
    return {
      sent,
      engine: {
        id: "stub",
        async complete(request: TextRequest) {
          sent.push(request);
          return { text: replies.shift() ?? "", latencyMs: 3_000, provenance: { provider: "openrouter", model: "stub" } };
        },
      } as TextEngine,
    };
  }

  it("sends the picture as inline bytes, never a URL, and retries one unusable reply", async () => {
    const { engine: writer, sent } = engine(['{"sex":"male","age":"50s","body":"Persona: x', JSON.stringify(draft())]);
    const picture = { bytes: Buffer.from("not an image"), contentType: "image/png" };
    const written = await writeVoiceCard({ sources: sources(), picture, engine: writer });
    expect(sent).toHaveLength(2);
    expect(sent[0].images?.[0].bytes).toBeInstanceOf(Buffer);
    expect(JSON.stringify(sent[0])).not.toMatch(/https?:\/\//);
    expect(sent[0].about).toBe("voice.card");
    expect(written.voiceCard.startsWith("Native English. Male, early 50s. Studio quality.")).toBe(true);
    expect(written.previewLine).toBe(PREVIEW);
    expect(written.writerModel).toBe("x-ai/grok-4.7");
  });

  /*
    ⚠ **IT REPORTS WHAT IT ACTUALLY SENT** — the relay's finding 2 on PR #2500.
    The caller keys the kept card on the picture, and could not see from the
    outside whether the picture went, so a words-only card was filed under the
    with-picture hash and reused for the life of the cast.
  */
  it("⚠ says whether the picture went, and says no when there was none", async () => {
    const { engine: withPicture } = engine([JSON.stringify(draft())]);
    const sentWith = await writeVoiceCard({
      sources: sources(),
      picture: { bytes: Buffer.from("not an image"), contentType: "image/png" },
      engine: withPicture,
    });
    expect(sentWith.withPicture).toBe(true);

    const { engine: withoutPicture, sent } = engine([JSON.stringify(draft())]);
    const sentWithout = await writeVoiceCard({ sources: sources(), picture: null, engine: withoutPicture });
    expect(sentWithout.withPicture).toBe(false);
    /* CONTROL — the claim matches the wire: no picture went, and the ask said so. */
    expect(sent[0].images).toBeUndefined();
    expect(sent[0].user).toContain("There is no picture");
  });

  it("⚠ a preview under the provider's 100-character floor is refused, never padded by repetition", async () => {
    const { engine: writer, sent } = engine([
      JSON.stringify(draft({ preview: "Leave me be." })),
      JSON.stringify(draft({ preview: "Leave me be." })),
    ]);
    await expect(writeVoiceCard({ sources: sources(), picture: null, engine: writer })).rejects.toThrow(/out of bounds/);
    expect(sent).toHaveLength(2);
  });
});

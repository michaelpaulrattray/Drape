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
  it("reads sex from the words, and refuses to decide when they point both ways or nowhere", () => {
    expect(sexFromWords("a cyberpunk mercenary woman")).toBe("Female");
    expect(sexFromWords("a grizzled old man")).toBe("Male");
    expect(sexFromWords("an undead man-bear-pig hybrid")).toBe("Male");
    expect(sexFromWords("a non-binary pilot")).toBe("Androgynous");
    expect(sexFromWords("a man and a woman")).toBeNull();
    expect(sexFromWords("a glowing forest spirit")).toBeNull();
    /* Negative controls: words that only CONTAIN a marker are not a marker. */
    expect(sexFromWords("Pigman, a human theme")).toBeNull();
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

  it("⚠ a preview under the provider's 100-character floor is refused, never padded by repetition", async () => {
    const { engine: writer, sent } = engine([
      JSON.stringify(draft({ preview: "Leave me be." })),
      JSON.stringify(draft({ preview: "Leave me be." })),
    ]);
    await expect(writeVoiceCard({ sources: sources(), picture: null, engine: writer })).rejects.toThrow(/out of bounds/);
    expect(sent).toHaveLength(2);
  });
});

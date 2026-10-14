import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  VOICE_CANNOT_KEEP,
  VOICE_CLIP_WONT_PLAY,
  VOICE_KEPT_HINT,
  VOICE_MAKE_AGAIN,
  VOICE_MAKING_LOADER,
  VOICE_NEEDS_A_LINE,
  voiceAuditionLoader,
} from "@shared/voiceCardCopy";

import {
  CastVoiceStudioPanel,
  KEPT_STRIP_KEY,
  VOICE_RESTING_WAVE,
  voiceRefusalSentence,
  voiceStripKey,
  type CastVoiceStudioPanelProps,
  type VoiceChoice,
} from "./CastVoiceStudio";

/**
 * WHAT THE VOICE CARD DRAWS, IN EVERY STATE — N4b-2 (#2470).
 *
 * The panel is pure so these arms can render it (the house pattern:
 * `CastCampaignsCard.test.ts` and `PublicCheckCard` both split a presentational
 * panel from the wired card for exactly this). The browser render in both
 * themes is law 6's and is the relay's eye on the pull request — this covers
 * the states a screenshot cannot reach in one sitting.
 *
 * ⚠ **THE FIRST ARM IS THE ONE THAT MATTERS MOST, AND IT IS ABOUT THE DIFF
 * RATHER THAN THE FEATURE**: while `CASTING_VOICE_SCOPE` is shut this card must
 * draw EXACTLY what it drew before, because the flag is unset everywhere and
 * every customer on production is in that state the moment this merges.
 */

const CHOICES: VoiceChoice[] = [
  { handle: "h-1", audioBase64: "AAA", contentType: "audio/mpeg", durationSeconds: 15 },
  { handle: "h-2", audioBase64: "BBB", contentType: "audio/mpeg", durationSeconds: 16 },
  { handle: "h-3", audioBase64: "CCC", contentType: "audio/mpeg", durationSeconds: 14 },
];

/**
 * The same escaping `renderToStaticMarkup` does, so an assertion compares the
 * SENTENCE rather than its entities.
 *
 * Without it every arm on a string containing an apostrophe is a near miss:
 * *"Voices can't be kept"* renders as `can&#x27;t`, and the failure reads as
 * missing copy rather than as an assertion written against the wrong form.
 */
function asMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function render(props: Partial<CastVoiceStudioPanelProps> = {}): string {
  const base: CastVoiceStudioPanelProps = {
    available: true,
    hasLine: true,
    name: "Pigman",
    kept: null,
    stage: "resting",
    choices: [],
    refusal: null,
    stripFor: () => ({ bars: null, playing: false, barsLit: 0, duration: null }),
    onToggle: () => {},
    onMake: () => {},
    onKeep: () => {},
  };
  return renderToStaticMarkup(createElement(CastVoiceStudioPanel, { ...base, ...props }));
}

describe("while the voice road is shut, the card is unchanged", () => {
  it("draws the resting player and the stub's own words", () => {
    const html = render({ available: false });
    expect(html).toContain("No voice yet");
    expect(html).toContain("A designed voice and an audition clip arrive with voice.");
    expect(html).toContain('class="dpc-voice__player"');
    expect(html).toContain('class="dpc-voice__wave"');
  });

  it("offers nothing to press", () => {
    /* A dark card with a working button would spend house money for an account
       the road is not open for — and the mutations refuse, so the press would
       read as broken. */
    const html = render({ available: false });
    expect(html).not.toContain(VOICE_MAKE_AGAIN);
    expect(html).not.toContain("<button");
  });

  it("draws the same number of bars the room drew inline", () => {
    /* The resting ornament moved here from `CastingRoom.tsx` as
       VOICE_RESTING_WAVE; a different count would be a visible change to a
       card nobody asked to change. */
    expect(VOICE_RESTING_WAVE).toHaveLength(30);
    const bars = render({ available: false }).match(/<span style="height:/g) ?? [];
    expect(bars).toHaveLength(30);
  });
});

describe("a cast with no written voice line", () => {
  it("points at the door above rather than offering a press that cannot work", () => {
    const html = render({ hasLine: false });
    expect(html).toContain(asMarkup(VOICE_NEEDS_A_LINE));
    expect(html).not.toContain(VOICE_MAKE_AGAIN);
  });
});

describe("three voices to listen to", () => {
  it("draws Voice 1, 2 and 3 with a Keep on each", () => {
    const html = render({ choices: CHOICES, stage: "choosing" });
    expect(html).toContain("Voice 1");
    expect(html).toContain("Voice 2");
    expect(html).toContain("Voice 3");
    expect(html).toContain("Keep &quot;Voice 1&quot;");
    expect(html).toContain("Keep &quot;Voice 3&quot;");
    expect(html).not.toContain("Voice 4");
  });

  it("gives each play control a name that says what it plays", () => {
    const html = render({ choices: CHOICES, stage: "choosing" });
    expect(html).toContain('aria-label="Play Voice 1"');
    expect(html).toContain('aria-label="Play Voice 2"');
  });

  it("keeps the Make button, so a fresh three is always one press away", () => {
    expect(render({ choices: CHOICES, stage: "choosing" })).toContain(VOICE_MAKE_AGAIN);
  });

  it("lights the played bars of the strip that is playing, and no other", () => {
    const html = render({
      choices: CHOICES,
      stage: "choosing",
      stripFor: (key) => key === voiceStripKey(CHOICES[1])
        ? { bars: [50, 50, 50, 50], playing: true, barsLit: 2, duration: "0:16" }
        : { bars: null, playing: false, barsLit: 0, duration: null },
    });
    expect((html.match(/dpc-voice__bar--lit/g) ?? [])).toHaveLength(2);
    expect(html).toContain("0:16");
  });
});

describe("the loaders name what is happening to the cast", () => {
  it("says it is making voices from their words", () => {
    const html = render({ stage: "making" });
    expect(html).toContain(asMarkup(VOICE_MAKING_LOADER));
    expect(html).toContain('role="status"');
  });

  it("names the cast while the audition is recorded", () => {
    expect(render({ stage: "keeping", choices: CHOICES }))
      .toContain(asMarkup(voiceAuditionLoader("Pigman")));
  });

  it("hides the choices while a Keep is in flight, so nothing else can be pressed", () => {
    const html = render({ stage: "keeping", choices: CHOICES });
    expect(html).not.toContain("Keep &quot;Voice 1&quot;");
  });

  it("disables the Make button while either loader is up", () => {
    expect(render({ stage: "making" })).toContain("disabled");
    expect(render({ stage: "keeping" })).toContain("disabled");
  });
});

describe("a kept voice is the card from then on", () => {
  it("names the voice and replaces No voice yet", () => {
    const html = render({ kept: { clipPath: "/api/cast/KI-ABCD/voice-clip" } });
    expect(html).toContain("Pigman&#x27;s voice");
    expect(html).toContain(asMarkup(VOICE_KEPT_HINT));
    expect(html).not.toContain("No voice yet");
  });

  it("offers no Make button, because a kept voice is changed only by keeping another", () => {
    /* The design's §9: editing the line does not replace a kept voice. */
    const html = render({ kept: { clipPath: "/api/cast/KI-ABCD/voice-clip" } });
    expect(html).not.toContain(VOICE_MAKE_AGAIN);
  });

  it("never puts the clip's address in the markup as a storage URL", () => {
    const html = render({ kept: { clipPath: "/api/cast/KI-ABCD/voice-clip" } });
    /* The player's source is set on an audio element by the wired half; what
       must never appear is a bucket URL. */
    expect(html).not.toContain("r2.dev");
    expect(html).not.toContain("casting/voices");
  });

  it("asks for the kept strip and not a choice strip", () => {
    const asked: string[] = [];
    render({
      kept: { clipPath: "/api/cast/KI-ABCD/voice-clip" },
      stripFor: (key) => {
        asked.push(key);
        return { bars: null, playing: false, barsLit: 0, duration: null };
      },
    });
    expect(asked).toEqual([KEPT_STRIP_KEY]);
  });
});

describe("a refusal says what to do", () => {
  it("draws the sentence where a screen reader will announce it", () => {
    const html = render({ refusal: VOICE_CANNOT_KEEP });
    expect(html).toContain(asMarkup(VOICE_CANNOT_KEEP));
    expect(html).toContain('role="alert"');
  });

  it("maps each refusal key to its own sentence, never to a server string", () => {
    expect(voiceRefusalSentence("no_operations_left", "keep")).toBe(VOICE_CANNOT_KEEP);
    expect(voiceRefusalSentence("no_slots_left", "keep")).toBe(VOICE_CANNOT_KEEP);
    expect(voiceRefusalSentence("no_voice_line", "make")).toBe(VOICE_NEEDS_A_LINE);
  });

  it("falls back on an unknown key rather than showing nothing", () => {
    /* A refusal with no words is the silence direction — the customer pressed
       something and would see no answer at all. */
    expect(voiceRefusalSentence("something_new", "make")).toContain("didn't come through");
    expect(voiceRefusalSentence("something_new", "keep")).toContain("couldn't be kept");
  });

  it("tells a failed make from a failed keep", () => {
    expect(voiceRefusalSentence("provider_failed", "make"))
      .not.toBe(voiceRefusalSentence("provider_failed", "keep"));
  });

  /* The card number lives in this comment and not in the title: the token guard
     reads a bare #NNNN in a STRING as a hex colour, and 2470 is a valid one —
     the same reason the copy suite's price arm carries its number this way. */
  it("⚠ DRAWS THE PLAY FAILURE'S OWN SENTENCE — the finding's item 6", () => {
    /*
      #2470, item 6. A kept clip that would not play used to release the button
      and say nothing. The wiring that sets this is the audio element's `onError` and
      the play promise's `catch` in the wired card; what this arm proves is the
      other half — that the panel has somewhere to PUT the sentence, so the
      wiring is not writing into a state nothing renders.
    */
    const html = render({
      kept: { clipPath: "/api/cast/KI-A/voice-clip" },
      refusal: VOICE_CLIP_WONT_PLAY,
    });
    expect(html).toContain(asMarkup(VOICE_CLIP_WONT_PLAY));
  });
});

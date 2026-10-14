import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

/*
  ⚠ **THE SHARED STRIPPER, NEVER A PRIVATE ONE (#1629).** The arms at the foot
  of this file read the component's own source, so they must tell what it SAYS
  from what it DISCUSSES — the comment beside the repair names the very constant
  the arm bans, which is exactly the sentence a future reader needs. The first
  draft hand-rolled `//` to end of line and `server/commentStripperShape.test.ts`
  refused it on the push: a `//` inside a string literal is not a comment, and a
  guard that reads SHORT passes for the wrong reason.
*/
import { withoutComments } from "../../../../../server/testing/withoutComments";

import { TRPCClientError } from "@trpc/client";
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
  isShortOfCredits,
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
    /* The real ledger prices the route serves (#2471). A fixture that omitted
       them rendered a panel no customer can reach, and the omission is what
       found the `undefined` the component now degrades on. */
    designPriceCredits: 125,
    keepPriceCredits: 500,
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

describe("the card's money reader, and what it must not catch (finding 2)", () => {
  /** A tRPC client error as the card actually receives one. */
  const refusal = (code: string) =>
    new TRPCClientError("…", { result: { error: { data: { code } } } } as never);

  it("⚠ READS THE LEDGER'S REFUSAL — the positive control", () => {
    /* `chargeRefusal` answers `PRECONDITION_FAILED` for a short balance
       deliberately, so this must stay true or the card stops being able to say
       "Not enough credits" at all. Without this arm the one below passes by
       reading nothing. */
    expect(isShortOfCredits(refusal("PRECONDITION_FAILED"))).toBe(true);
  });

  it("⚠ DOES NOT READ A SHUT ROAD AS A MONEY PROBLEM", () => {
    /*
      THE DEFECT, in the customer's terms: narrow `CASTING_VOICE_SCOPE` while
      somebody has the card open, let them press, and they were told *"Not
      enough credits"*. The route's half of this contract is driven in
      `server/routes/castingVoiceRoad.test.ts` — it refuses a shut road with
      `FORBIDDEN` — and this is the half that makes the code choice matter.
    */
    expect(isShortOfCredits(refusal("FORBIDDEN"))).toBe(false);
  });

  it("does not read a rate limit, a missing cast or a transport failure as one either", () => {
    for (const code of ["TOO_MANY_REQUESTS", "NOT_FOUND", "INTERNAL_SERVER_ERROR"]) {
      expect(isShortOfCredits(refusal(code))).toBe(false);
    }
    /* And a non-tRPC failure — a proxy's plain-text 502, the shape
       `failureSentence`'s own incident was about — is not a money fact. */
    expect(isShortOfCredits(new Error("upstream error"))).toBe(false);
  });
});

describe("the refusal sentence carries the refund reference (finding 4)", () => {
  const REFERENCE = "refund:pending-1-3f2a7c18-0b44-4e5e-9a21-7d6c5b8e1f90";

  it("⚠ QUOTES IT WHEN THE REFUND DID NOT RECORD", () => {
    /* The card is what the customer reads, so the reference has to survive the
       whole way out to the sentence — not merely exist on the wire. */
    for (const during of ["make", "keep"] as const) {
      const sentence = voiceRefusalSentence("provider_failed", during, false, REFERENCE);
      expect(sentence).toContain(REFERENCE);
      expect(sentence).not.toContain("Nothing was charged");
    }
  });

  it("says nothing about a reference when the credits came back", () => {
    for (const during of ["make", "keep"] as const) {
      expect(voiceRefusalSentence("provider_failed", during, true, REFERENCE))
        .not.toContain(REFERENCE);
    }
  });

  it("⚠ STILL SAYS THEY ARE OWED WHEN NO REFERENCE REACHED US", () => {
    /* The reference is nullable on the wire, and a missing one must not turn
       the sentence back into a claim that nothing was charged. */
    const sentence = voiceRefusalSentence("provider_failed", "keep", false, null);
    expect(sentence).toContain("haven't come back");
    expect(sentence).not.toContain("Nothing was charged");
  });

  it("⚠ PUTS THE MONEY FIRST EVEN FOR A REFUSAL THAT HAS ITS OWN SENTENCE", () => {
    /*
      `no_operations_left` has a sentence of its own (*"Voices can't be kept
      right now…"*), which says nothing about money. A customer who is out of
      pocket needs to hear that above everything else, so the unrecorded-refund
      branch outranks the whole switch below it.
    */
    const sentence = voiceRefusalSentence("no_operations_left", "keep", false, REFERENCE);
    expect(sentence).not.toBe(VOICE_CANNOT_KEEP);
    expect(sentence).toContain(REFERENCE);
  });
});

describe("the catch-all shows the server's sentence, not a money claim (finding 1)", () => {
  /**
   * The two catch blocks, each sliced out of the component's own source.
   *
   * ⚠ **WHY A SOURCE READ RATHER THAN A RENDER.** The repair is at a CALL SITE
   * inside the wired card, not in the pure panel these arms render, and the
   * wired half needs a tRPC provider to mount. Every other arm here would stay
   * green if somebody put `VOICE_MAKE_FAILED` back in that catch: the copy arms
   * read the CONSTANTS, which are still correct, and the road suite reads the
   * SERVER, which still sends the right sentence. This is the only reader that
   * can see the one line in between.
   *
   * ⚠ **AND IT IS SLICED, NOT READ WHOLE.** A `toContain` over the file passes
   * on an identical line in a neighbouring function — the class that has
   * survived sabotage green in this repository before — so each arm gets the
   * bytes of its own handler and nothing else, and the slice anchors are proven
   * unique before anything is asserted about them.
   */
  const source = readFileSync(
    new URL("./CastVoiceStudio.tsx", import.meta.url),
    "utf8",
  );

  const slice = (afterAnchor: string, untilAnchor: string): string => {
    expect(source.split(afterAnchor)).toHaveLength(2);
    const fromAnchor = source.slice(source.indexOf(afterAnchor));
    const end = fromAnchor.indexOf(untilAnchor);
    expect(end).toBeGreaterThan(0);
    return withoutComments(fromAnchor.slice(0, end));
  };

  /*
    ⚠ **THE SLICING IS LAZY, AND THAT WAS MEASURED RATHER THAN PREFERRED.** The
    first version computed each body here in the describe body, and sabotaging
    an anchor took the WHOLE FILE out at collection: thirty-one arms vanished
    and the run reported no tests at all rather than a failing one
    ([[test-files-tally-not-tests-tally]]). A guard whose own failure is
    indistinguishable from a broken suite is a guard nobody can diagnose, so
    each arm asks for its own bytes and only its own arm goes red.
  */
  const CATCHES = [
    {
      what: "the press",
      body: () => slice('logRawFailure("castingV2.voice.design", error);', "}, [castId, design"),
      fallback: "VOICE_MAKE_LOST_CONTACT",
      banned: "VOICE_MAKE_FAILED",
    },
    {
      what: "the Keep",
      body: () => slice('logRawFailure("castingV2.voice.keep", error);', "} finally {"),
      fallback: "VOICE_KEEP_LOST_CONTACT",
      banned: "VOICE_KEEP_FAILED",
    },
  ];

  it("sliced the right region (the positive control)", () => {
    /* Without this, a slice that silently came back empty would make both arms
       below pass by reading nothing at all. */
    for (const handler of CATCHES) {
      const body = handler.body();
      expect(body.length).toBeGreaterThan(80);
      expect(body).toContain("setRefusal");
    }
  });

  it("⚠ HANDS THE SERVER'S OWN SENTENCE THROUGH", () => {
    /* `readableFailure` is the product's one rule for this
       (`client/src/lib/failureSentence.ts`), and on this road the server's
       sentence already carries the refund truth and its reference. */
    for (const handler of CATCHES) {
      expect(handler.body()).toContain(`readableFailure(error, ${handler.fallback})`);
    }
  });

  it("⚠ AND NEVER ANSWERS A THROW WITH *NOTHING WAS CHARGED*", () => {
    /*
      THE DEFECT ITSELF. Both constants say *"Nothing was charged"*, which the
      press made a claim about the ledger the moment it started charging — and
      the catch-all is reached by a design that threw AFTER the charge, where
      the refund may not have recorded. `atomicCredits`' law: an unrecorded
      refund is never reported as money that came back.

      The constants are not deleted — they are still the right words where the
      refusal road has told us the refund DID record (`voiceMakeFailedText`).
      What may not happen is reaching them from here.
    */
    for (const handler of CATCHES) {
      expect(handler.body()).not.toContain(handler.banned);
    }
  });
});

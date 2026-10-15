import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { VOICE_LINE_BEING_WRITTEN, VOICE_NEEDS_A_LINE, VOICE_NONE_YET } from "@shared/voiceCardCopy";
import {
  CastPersonalityCard,
  CastVoiceLine,
  PERSONALITY_BEING_WRITTEN,
  personaLandingPoll,
  personaFieldPending,
} from "./components/CastPersonaCards";
import {
  CastVoiceStudioPanel,
  voiceAutoDesignDue,
  voiceLineArriving,
  voiceStatusStaleAfter,
  type CastVoiceStudioPanelProps,
} from "./voice/CastVoiceStudio";

/**
 * STRAIGHT AFTER SIGN THE ROOM SAYS THE LINES ARE BEING WRITTEN — #2521.
 *
 * His words, 2026-10-15, with a screenshot of a freshly signed cast: *"when i
 * sign a cast there is no pre-load for the personality/voice etc until its been
 * generated this isnt right"*.
 *
 * Two defects, one card:
 *  1. While the Sign builds, the Personality card was not drawn at all and the
 *     Voice card said "Write how they sound first" — a line the product was
 *     writing itself.
 *  2. Once the lines landed, the Voice card's status (read once, on mount,
 *     while the build ran) still said there was no line, so the card stayed on
 *     "write it yourself" and the free first three voices never fired.
 *
 * Everything here drives the real components and the real decision functions
 * the wired card calls; the source arms at the foot pin that the wired card
 * DOES call them (there is no DOM in this suite to mount the hooks in).
 */

const LINE = { text: "Stands planted and square. Moves late.", drafted: true, ownWords: null };
const VOICE = { text: "A wet, dragging rumble.", drafted: true, ownWords: null };

const BUILDING = { building: true, landing: false };
const LANDING = { building: false, landing: true };
const SETTLED = { building: false, landing: false };

const drawPersonality = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(CastPersonalityCard, {
    personality: null,
    onSave: vi.fn(),
    savingLine: null,
    name: "Pigman",
    ...extra,
  }));

const drawVoiceLine = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(CastVoiceLine, {
    voice: null,
    onSave: vi.fn(),
    savingLine: null,
    name: "Pigman",
    editing: false,
    onEditingChange: vi.fn(),
    ...extra,
  }));

function drawPanel(props: Partial<CastVoiceStudioPanelProps> = {}): string {
  const base: CastVoiceStudioPanelProps = {
    available: true,
    hasLine: false,
    name: "Pigman",
    kept: null,
    stage: "resting",
    choices: [],
    refusal: null,
    stripFor: () => ({ bars: null, playing: false, barsLit: 0, duration: null }),
    onToggle: () => {},
    onMake: () => {},
    onKeep: () => {},
    designPriceCredits: 125,
    keepPriceCredits: 500,
    changing: false,
    removeAsked: false,
    removing: false,
    onChange: () => {},
    onCancelChange: () => {},
    onAskRemove: () => {},
    onConfirmRemove: () => {},
    onCancelRemove: () => {},
  };
  return renderToStaticMarkup(createElement(CastVoiceStudioPanel, { ...base, ...props }));
}

const escaped = (text: string) => text.replace(/'/g, "&#x27;");

describe("a line is pending only while it is genuinely on its way", () => {
  it("is pending while the Sign builds and there is no line yet", () => {
    expect(personaFieldPending(null, BUILDING)).toBe(true);
  });

  it("is pending in the moment after the build when the room watched it finish", () => {
    expect(personaFieldPending(null, LANDING)).toBe(true);
  });

  it("⚠ IS NOT PENDING ON A SETTLED CAST WITH NO LINE — the read-failed and pre-N2b road stands", () => {
    expect(personaFieldPending(null, SETTLED)).toBe(false);
    expect(personaFieldPending(undefined, SETTLED)).toBe(false);
  });

  it("is never pending once there is a line, even mid-build", () => {
    expect(personaFieldPending(LINE, BUILDING)).toBe(false);
    expect(personaFieldPending(LINE, LANDING)).toBe(false);
  });
});

describe("the Personality card while the line is being written", () => {
  it("⚠ IS DRAWN, with its label and the wait — the defect was that it was absent", () => {
    const html = drawPersonality({ pending: true });
    expect(html).toContain(PERSONALITY_BEING_WRITTEN);
    expect(html).toContain('role="status"');
    expect(html.toLowerCase()).toContain("personality");
  });

  it("offers no box and no edit icon, because nothing exists yet to edit", () => {
    const html = drawPersonality({ pending: true });
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Edit personality");
  });

  it("draws nothing at all when no line is coming (the negative control)", () => {
    expect(drawPersonality({ pending: false })).toBe("");
    expect(drawPersonality()).toBe("");
  });

  it("draws the real line and no wait once it lands", () => {
    const html = drawPersonality({ personality: LINE, pending: true });
    expect(html).toContain(LINE.text);
    expect(html).not.toContain(PERSONALITY_BEING_WRITTEN);
  });
});

describe("the Voice card while the line is being written", () => {
  it("⚠ SAYS THE LINE IS BEING WRITTEN, over the strip", () => {
    expect(drawVoiceLine({ pending: true })).toContain(VOICE_LINE_BEING_WRITTEN);
  });

  it("⚠ NEVER TELLS THE CUSTOMER TO WRITE IT THEMSELVES while it is on its way", () => {
    const html = drawPanel({ hasLine: false, lineArriving: true });
    expect(html).not.toContain(escaped(VOICE_NEEDS_A_LINE));
    expect(html).toContain(VOICE_NONE_YET);
  });

  it("a settled cast with no line still says exactly what it said (the negative control)", () => {
    expect(drawVoiceLine({ pending: false })).toBe("");
    expect(drawPanel({ hasLine: false, lineArriving: false })).toContain(escaped(VOICE_NEEDS_A_LINE));
    expect(drawPanel({ hasLine: false })).toContain(escaped(VOICE_NEEDS_A_LINE));
  });

  it("the real line replaces the wait once it lands", () => {
    const html = drawVoiceLine({ voice: VOICE, pending: true });
    expect(html).toContain(VOICE.text);
    expect(html).not.toContain(VOICE_LINE_BEING_WRITTEN);
  });
});

describe("⚠ THE LINE ARRIVING STARTS THE FIRST THREE — the second defect, as a sequence", () => {
  /** The card, as the wired component reads it at one moment. */
  const due = (hasLine: boolean) =>
    voiceAutoDesignDue({ available: true, hasLine, kept: false, choices: 0, canKeep: true, designedAlready: false });

  it("walks mount → line lands → status re-read → automatic design", () => {
    /* 1. Mounted mid-build: the status answers no line, the room holds none, and
          the product is still writing it. */
    let statusHasLine = false;
    let roomLine = false;
    expect(voiceLineArriving({ lineExpected: true, lineWritten: roomLine }, statusHasLine)).toBe(true);
    expect(due(statusHasLine)).toBe(false);

    /* 2. The room's poll brings the line in. The card must notice, and must not
          fall back to "write it yourself" while its own read catches up. */
    const before = roomLine;
    roomLine = true;
    expect(voiceStatusStaleAfter(before, roomLine)).toBe(true);
    expect(voiceLineArriving({ lineExpected: false, lineWritten: roomLine }, statusHasLine)).toBe(true);
    expect(due(statusHasLine)).toBe(false);

    /* 3. The re-read answers with the line: the card leaves the no-line state
          and the free first three are due. */
    statusHasLine = true;
    expect(voiceLineArriving({ lineExpected: false, lineWritten: roomLine }, statusHasLine)).toBe(false);
    expect(due(statusHasLine)).toBe(true);
    expect(drawPanel({ hasLine: statusHasLine })).not.toContain(escaped(VOICE_NEEDS_A_LINE));
  });

  it("does not re-read on a render where the line did not change (the negative control)", () => {
    expect(voiceStatusStaleAfter(false, false)).toBe(false);
    expect(voiceStatusStaleAfter(true, true)).toBe(false);
  });

  it("the automatic design keeps every one of its existing holds", () => {
    const card = { available: true, hasLine: true, kept: false, choices: 0, canKeep: true as boolean | undefined, designedAlready: false };
    expect(voiceAutoDesignDue(card)).toBe(true);
    expect(voiceAutoDesignDue({ ...card, available: false })).toBe(false);
    expect(voiceAutoDesignDue({ ...card, hasLine: false })).toBe(false);
    expect(voiceAutoDesignDue({ ...card, kept: true })).toBe(false);
    expect(voiceAutoDesignDue({ ...card, choices: 3 })).toBe(false);
    expect(voiceAutoDesignDue({ ...card, canKeep: false })).toBe(false);
    expect(voiceAutoDesignDue({ ...card, canKeep: undefined })).toBe(true);
    expect(voiceAutoDesignDue({ ...card, designedAlready: true })).toBe(false);
  });
});

describe("the room keeps reading until the lines land", () => {
  it("polls a room that watched the build finish while both lines are missing", () => {
    expect(personaLandingPoll(null, true)).toBe(true);
    expect(personaLandingPoll({ personality: null, voice: null }, true)).toBe(true);
  });

  it("stops the moment a line lands, and never polls a room that watched no build", () => {
    expect(personaLandingPoll({ personality: LINE, voice: VOICE }, true)).toBe(false);
    expect(personaLandingPoll({ personality: null, voice: VOICE }, true)).toBe(false);
    expect(personaLandingPoll(null, false)).toBe(false);
  });
});

describe("the wired card and the room call these readings (source arms)", () => {
  const read = (path: string) => withoutComments(readFileSync(resolve(__dirname, path), "utf8"));
  const studio = read("./voice/CastVoiceStudio.tsx");
  const room = read("../../pages/CastingRoom.tsx");

  it("⚠ THE STUDIO RE-READS ITS STATUS WHEN THE ROOM'S LINE CHANGES", () => {
    const at = studio.indexOf("voiceStatusStaleAfter(lineSeen.current, lineWritten)");
    expect(at).toBeGreaterThan(-1);
    const effect = studio.slice(at, studio.indexOf("}, [castId, lineWritten, utils]);", at));
    expect(effect).toContain("utils.castingV2.voice.status.invalidate({ castId })");
  });

  it("the automatic design is decided by the tested function, and the panel is told the line is arriving", () => {
    expect(studio).toContain("voiceAutoDesignDue({");
    expect(studio).toContain("lineArriving={voiceLineArriving({ lineExpected, lineWritten }, hasLine)}");
  });

  it("the room hands both cards and the studio the pending reading and the line", () => {
    expect(room).toContain("lineWritten={Boolean(data.persona?.voice)}");
    expect(room).toContain("lineExpected={voiceLinePending}");
    expect(room).toContain("pending={voiceLinePending}");
    expect(room).toContain("pending={personaFieldPending(data.persona?.personality, {");
  });

  it("⚠ THE ROOM'S POLL READS THE LANDING, so the lines arrive without a reload", () => {
    expect(room).toContain("personaLandingPoll(query.state.data?.persona, awaitingLines) ? POLL_MS : false");
    expect(room).toContain("PERSONA_LANDING_GRACE_MS");
  });
});

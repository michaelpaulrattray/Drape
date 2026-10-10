/**
 * #2214 — THE PERSONALITY CARD GETS THE SAME QUIET *Change* AS THE VOICE CARD.
 *
 * His word, 2026-10-10, on a screenshot of the two cards: *"only voice has
 * change and personality doesnt so the question is do we require someone to
 * click change before making edits rather than just the text itself?"* — and,
 * to the relay's answer (keep click-the-words, add *Change* as a second door on
 * both cards), *"yes go ahead"*.
 *
 * So three things are held here:
 *  1. ONE button, drawn by both cards — the shown/absent rule is written once,
 *     inside it, and DRIVEN here rather than read.
 *  2. The personality card renders it in its head, beside the words that still
 *     open the editor on their own (rendered through the real component).
 *  3. The room's voice card uses that same button rather than its own copy.
 *
 * ⚠ What this cannot see: `pnpm test` has no DOM, so a real press of *Change*
 * or of the words is driven in the running app and recorded on the PR with
 * frames in both themes, not claimed here.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  CastPersonalityCard,
  PersonaChangeButton,
} from "./components/CastPersonaCards";

const CARDS = "client/src/features/castingV2/components/CastPersonaCards.tsx";
const ROOM = "client/src/pages/CastingRoom.tsx";
const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

type ButtonProps = Parameters<typeof PersonaChangeButton>[0];
const call = (props: Partial<ButtonProps> = {}) =>
  PersonaChangeButton({
    present: true,
    editing: false,
    saving: false,
    onOpen: () => {},
    ...props,
  }) as ReactElement<{ onClick: () => void; disabled: boolean; className: string }> | null;

describe("the one Change button: shown with a line and a shut box, absent otherwise", () => {
  it("is drawn when there is a line and the box is shut (positive control)", () => {
    const el = call();
    expect(el).not.toBeNull();
    const html = renderToStaticMarkup(el!);
    expect(html).toContain(">Change</button>");
    expect(html).toContain('class="dpc-rcard__quiet"');
    expect(html).not.toContain("disabled");
  });

  it("is absent while the box is open", () => {
    expect(call({ editing: true })).toBeNull();
  });

  it("is absent when there is no line to open", () => {
    expect(call({ present: false })).toBeNull();
    expect(call({ present: false, editing: true })).toBeNull();
  });

  it("pressing it opens the box — onOpen is what the click calls", () => {
    const onOpen = vi.fn();
    call({ onOpen })!.props.onClick();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("refuses only while that line's save is in flight, as the words do", () => {
    expect(call({ saving: true })!.props.disabled).toBe(true);
    expect(call({ saving: false })!.props.disabled).toBe(false);
  });
});

describe("the personality card carries it, and the words still open the editor", () => {
  const render = (personality: { text: string; drafted: boolean } | null) =>
    renderToStaticMarkup(
      createElement(CastPersonalityCard, {
        personality,
        onSave: () => {},
        savingLine: null,
        name: "Pigman",
      }),
    );

  it("draws Change in the card's head, shut", () => {
    const html = render({ text: "Quiet, watchful, dry.", drafted: true });
    const head = html.slice(html.indexOf('class="dpc-rcard__head"'), html.indexOf("dpc-persona__read"));
    expect(head).toContain("PERSONALITY");
    expect(head).toContain('<button type="button" class="dpc-rcard__quiet">Change</button>');
  });

  it("keeps click-the-words: the line is still a button of its own", () => {
    const html = render({ text: "Quiet, watchful, dry.", drafted: false });
    expect(html).toMatch(/<button type="button" class="dpc-persona__read">Quiet, watchful, dry\.<\/button>/);
    /* Two doors, not one: the words AND Change. */
    expect(html.split("<button").length - 1).toBe(2);
  });

  it("draws nothing at all with no line (negative control)", () => {
    expect(render(null)).toBe("");
  });

  it("the card's Change opens the card's own editor state", () => {
    const text = source(CARDS);
    const card = text.slice(
      text.indexOf("export function CastPersonalityCard("),
      text.indexOf("export function PersonaChangeButton("),
    );
    expect(card.length).toBeGreaterThan(200);
    expect(card).toContain("<PersonaChangeButton");
    expect(card).toContain("onOpen={() => setEditing(true)}");
    expect(card).toContain("editing={editing}");
    expect(card).toContain("onEditingChange={setEditing}");
  });
});

describe("the voice card uses the same button rather than a copy", () => {
  it("the room's voice head draws PersonaChangeButton and no hand-written Change", () => {
    const room = source(ROOM);
    const open = '<span className="dpc-rcard__label">VOICE</span>';
    expect(room.split(open)).toHaveLength(2);
    const head = room.slice(room.indexOf(open), room.indexOf("<CastVoiceLine"));
    expect(head).toContain("<PersonaChangeButton");
    expect(head).toContain("present={Boolean(data.persona?.voice)}");
    expect(head).toContain("editing={voiceEditing}");
    expect(head).toContain("onOpen={() => setVoiceEditing(true)}");
    expect(head).not.toContain('className="dpc-rcard__quiet"');
  });

  it("only one place in the product spells the Change button", () => {
    const both = source(CARDS) + source(ROOM);
    expect(both.split('className="dpc-rcard__quiet"').length - 1).toBe(1);
  });
});

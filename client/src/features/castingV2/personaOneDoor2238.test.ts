/**
 * #2238 — THE PERSONA CARDS: ONE EDIT ICON, NO BADGE, AN EXPLAINER, AND NO
 * LOST OR HALF-SAVED EDITS.
 *
 * His word, 2026-10-11 (terminal), verbatim: *"change the "change" button to
 * an editor icon which fits our design language. dont allow the text to be
 * editable until its been clicked i dont want two doors into editing the text,
 * remove drafted for you badge and put a hover tooltip next to personality and
 * voice that explain what it is for etc. (essentially its used for video
 * creation)"*. The tooltip wording is the one he approved on the card.
 *
 * ⚠ WHAT THIS SUITE CAN AND CANNOT SEE: `pnpm test` has no DOM. So markup is
 * rendered through the real components (`renderToStaticMarkup`), the key rule
 * and the leave guard are DRIVEN as functions (the guard against a stand-in
 * window whose history really moves), and what needs a browser — hover, a real
 * Escape, a real back button, phone width — is driven in the running app and
 * recorded on the PR with frames in both themes.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  CastPersonalityCard,
  CastReadsPicker,
  CastVoiceLine,
  PersonaEditButton,
  PersonaFailure,
  PersonaOwnWordsPanel,
  PersonaWait,
  PERSONA_OWN_WORDS_WORKING,
  PERSONA_READS_FAILED,
  PERSONA_READS_WORKING,
  armUnsavedLeaveGuard,
  personaExplainer,
  personaKeyAction,
  personaLeaveBody,
  personaOwnWordsUnsaved,
  personaReadsListSubtitle,
  personaReadsRowSubtitle,
  personaReflexive,
  type LeaveGuardWindow,
  type PersonaOwnWordsDoor,
  type PersonaReadsDoor,
} from "./components/CastPersonaCards";

const CARDS = "client/src/features/castingV2/components/CastPersonaCards.tsx";
const ROOM = "client/src/pages/CastingRoom.tsx";
const CSS = "client/src/features/castingV2/castingV2.css";
const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

/** A slice between two anchors, each asserted unique so the cut cannot widen silently. */
function slice(path: string, open: string, close: string): string {
  const text = source(path);
  expect(text.split(open), open).toHaveLength(2);
  expect(text.split(close), close).toHaveLength(2);
  const cut = text.slice(text.indexOf(open), text.indexOf(close));
  expect(cut.length).toBeGreaterThan(200);
  return cut;
}

/** One CSS rule body, by its exact selector line. */
function rule(selector: string): string {
  const css = source(CSS);
  const at = css.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

const LINE = { text: "Stands planted and square. Moves late.", drafted: true, ownWords: null };
const VOICE = { text: "A wet, dragging rumble.", drafted: true, ownWords: null };

const drawPersonality = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(CastPersonalityCard, {
    personality: LINE,
    onSave: vi.fn(),
    savingLine: null,
    name: "Pigman",
    ...extra,
  }));

const ownDoor = (over: Partial<PersonaOwnWordsDoor> = {}): PersonaOwnWordsDoor => ({
  stage: "writing",
  result: null,
  failure: null,
  onOpen: vi.fn(),
  onTranslate: vi.fn(),
  onReword: vi.fn(),
  onKeep: vi.fn(),
  onBack: vi.fn(),
  ...over,
});

const readsDoor = (over: Partial<PersonaReadsDoor> = {}): PersonaReadsDoor => ({
  state: "drafting",
  reads: [],
  onOpen: vi.fn(),
  onBack: vi.fn(),
  onKeep: vi.fn(),
  ...over,
});

describe("1 · one door: the words are words, the edit icon opens the box", () => {
  it("the shut card draws the line as a paragraph, never a button", () => {
    const html = drawPersonality();
    expect(html).toContain('<p class="dpc-persona__read">Stands planted and square. Moves late.</p>');
    expect(html).not.toMatch(/<button[^>]*dpc-persona__read/);
  });

  it("the only buttons on a shut card are the ? and the edit icon", () => {
    const html = drawPersonality();
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain("dpc-persona__help");
    expect(buttons[1]).toContain('aria-label="Edit personality"');
  });

  type IconProps = Parameters<typeof PersonaEditButton>[0];
  const icon = (props: Partial<IconProps> = {}) =>
    PersonaEditButton({ line: "voice", present: true, editing: false, saving: false, onOpen: () => {}, ...props });

  it("the icon is a lucide pen, named for a screen reader, with no visible word", () => {
    const html = renderToStaticMarkup(icon() as ReactElement);
    expect(html).toContain('aria-label="Edit voice"');
    expect(html).toContain("lucide-pen-line");
    expect(html).not.toContain(">Change<");
  });

  it("is absent with no line, and absent once the box is open (negative controls)", () => {
    expect(icon({ present: false })).toBeNull();
    expect(icon({ editing: true })).toBeNull();
  });

  it("pressing it is what opens the box, and it refuses only while that line saves", () => {
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(icon({ saving: true }) as ReactElement);
    expect(html).toMatch(/<button[^>]*disabled=""/);
    /* The button is the tooltip trigger's only child: dig it out and press it. */
    const tree = icon({ onOpen }) as ReactElement<{ children: ReactElement<{ children: ReactElement<{ onClick: () => void }> }> }>;
    const trigger = (tree.props.children as unknown as ReactElement[])[0] as ReactElement<{ children: ReactElement<{ onClick: () => void }> }>;
    trigger.props.children.props.onClick();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("the room's voice head draws the same icon, and no Change anywhere", () => {
    const head = slice(ROOM, '<PersonaLabel line="voice"', "<CastVoiceLine");
    expect(head).toContain("<PersonaEditButton");
    expect(head).toContain('line="voice"');
    expect(head).toContain("onOpen={() => setVoiceEditing(true)}");
    expect(source(CARDS) + source(ROOM)).not.toMatch(/>\s*Change\s*</);
  });
});

describe("2 · no Drafted for you badge on either card", () => {
  it("a drafted line renders with no badge (the drafted flag is still true here)", () => {
    expect(LINE.drafted).toBe(true);
    expect(drawPersonality()).not.toContain("Drafted");
    expect(drawPersonality()).not.toContain("dpc-persona__badge");
  });

  it("neither file nor the stylesheet spells the badge any more", () => {
    for (const path of [CARDS, ROOM, CSS]) {
      expect(source(path)).not.toContain('"Drafted for you"');
      expect(source(path)).not.toContain("dpc-persona__badge");
      expect(source(path)).not.toContain("CastVoiceBadge");
    }
  });
});

describe("3 · the explainer beside each label", () => {
  it("says the approved words, named", () => {
    expect(personaExplainer("personality", "Pigman")).toBe(
      "How Pigman carries themselves on camera. It guides Pigman's performance when you make video.",
    );
    expect(personaExplainer("voice", "Pigman")).toBe(
      "How Pigman sounds on camera. It guides Pigman's voice when you make video.",
    );
  });

  it("falls back to they/their with no name, and genders nobody", () => {
    expect(personaExplainer("personality", "  ")).toBe(
      "How they carry themselves on camera. It guides their performance when you make video.",
    );
    expect(personaExplainer("voice", null)).toBe("How they sound on camera. It guides their voice when you make video.");
    for (const line of ["personality", "voice"] as const) {
      for (const name of ["Pigman", null]) {
        const words = personaExplainer(line, name);
        expect(words).not.toMatch(/\b(she|her|hers|he|him|his)\b/i);
        expect(words).not.toMatch(/model|engine|AI\b|generat/i);
      }
    }
  });

  it("the ? carries the sentence on both cards", () => {
    expect(drawPersonality()).toContain(`aria-label="${personaExplainer("personality", "Pigman").replace("'", "&#x27;")}"`);
    const room = source(ROOM);
    expect(room).toContain('<PersonaLabel line="voice" name={data.name ?? null} />');
  });
});

describe("4 · unsaved edits: the hint, and the ask before leaving", () => {
  it("the hint is drawn from the one condition Keep agrees with", () => {
    const line = slice(CARDS, "function EditableLine(", "export type CastPersonaCardsProps");
    expect(line).toContain("const unsaved = editing && draft.trim() !== value.text;");
    expect(line).toMatch(/\{unsaved \? \(\s*<span className="dpc-persona__unsaved" role="status">\{PERSONA_UNSAVED\}<\/span>/);
  });

  it("an open box with untouched words shows no hint (negative control)", () => {
    const html = renderToStaticMarkup(createElement(CastVoiceLine, {
      voice: VOICE, onSave: vi.fn(), savingLine: null, name: "Pigman", editing: true, onEditingChange: vi.fn(),
    }));
    expect(html).toContain("dpc-persona__field");
    expect(html).not.toContain("Unsaved");
  });

  it("a say-it-your-way panel is unsaved with new words or an unkept translation, never when shut", () => {
    expect(personaOwnWordsUnsaved({ stage: "shut", result: null }, "typed", null)).toBe(false);
    expect(personaOwnWordsUnsaved({ stage: "writing", result: null }, null, "kept")).toBe(false);
    expect(personaOwnWordsUnsaved({ stage: "writing", result: null }, " kept ", "kept")).toBe(false);
    expect(personaOwnWordsUnsaved({ stage: "writing", result: null }, "new words", "kept")).toBe(true);
    expect(personaOwnWordsUnsaved({ stage: "read", result: "a line" }, null, null)).toBe(true);
  });

  it("the leave dialog names the line", () => {
    expect(personaLeaveBody({ personality: true, voice: false }, "Pigman"))
      .toBe("Your edit to Pigman's personality has not been kept. If you leave now, it is lost.");
    expect(personaLeaveBody({ personality: false, voice: true }, null))
      .toBe("Your edit to the cast's voice has not been kept. If you leave now, it is lost.");
    expect(personaLeaveBody({ personality: true, voice: true }, "Pigman")).toContain("personality and voice");
  });

  /**
   * A stand-in window whose history really moves — entries, an index, `back`
   * and `go` firing popstate — so the guard is driven, not read. The browser
   * truth this cannot reproduce (the router rendering between listeners) is
   * why the sentinel exists, and it is driven in the running app on the PR.
   */
  function fakeWindow(path = "/app/casting/cast/KI-1") {
    const listeners = new Map<string, Set<EventListener>>();
    const entries: { url: string; state: unknown }[] = [{ url: "http://x/app/casting", state: null }, { url: `http://x${path}`, state: { at: "room" } }];
    let index = 1;
    const fire = (type: string, event: object) => [...(listeners.get(type) ?? [])].forEach((fn) => fn(event as Event));
    const location = {
      get href() { return entries[index]!.url; },
      get pathname() { return new URL(entries[index]!.url).pathname; },
    };
    const go = (delta: number) => {
      index += delta;
      fire("popstate", { state: entries[index]!.state });
    };
    const history = {
      get state() { return entries[index]!.state; },
      get length() { return entries.length; },
      pushState(state: unknown, _unused: string, url?: string | URL | null) {
        entries.splice(index + 1);
        entries.push({ url: new URL(String(url), entries[index]!.url).href, state });
        index = entries.length - 1;
      },
      replaceState(state: unknown, _unused: string, url?: string | URL | null) {
        entries[index] = { url: new URL(String(url), entries[index]!.url).href, state };
      },
      back: () => go(-1),
      go,
    } as unknown as History;
    const win: LeaveGuardWindow = {
      history,
      location,
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    };
    return { win, history, fire, entries, location, listeners, index: () => index };
  }

  it("plants one sentinel entry for the same page when it arms", () => {
    const { win, entries, location } = fakeWindow();
    armUnsavedLeaveGuard(win, vi.fn());
    expect(entries).toHaveLength(3);
    expect(new URL(entries[2]!.url).pathname).toBe("/app/casting/cast/KI-1");
    expect(location.pathname).toBe("/app/casting/cast/KI-1");
  });

  it("holds an in-app move to another page and asks; leaving completes it", () => {
    const { win, history, location, entries } = fakeWindow();
    const original = history.pushState;
    const ask = vi.fn();
    armUnsavedLeaveGuard(win, ask);
    history.pushState({}, "", "/app/casting");
    expect(location.pathname).toBe("/app/casting/cast/KI-1");
    expect(ask).toHaveBeenCalledTimes(1);
    ask.mock.calls[0][0]();
    expect(location.pathname).toBe("/app/casting");
    /* It replaced the sentinel, so Back lands on the room once, not twice. */
    expect(entries.map((e) => new URL(e.url).pathname)).toEqual(["/app/casting", "/app/casting/cast/KI-1", "/app/casting"]);
    /* Leaving disarmed it and put the real method back. */
    expect(history.pushState).toBe(original);
  });

  it("lets a same-page move through without asking (positive control for the hold)", () => {
    const { win, history, location } = fakeWindow();
    const ask = vi.fn();
    armUnsavedLeaveGuard(win, ask);
    history.replaceState({}, "", "/app/casting/cast/KI-1?x=1");
    history.pushState({}, "", "?y=2");
    expect(ask).not.toHaveBeenCalled();
    expect(location.href).toContain("?y=2");
  });

  it("⚠ Back steps onto the room's OWN entry, is asked about, and the page never changes", () => {
    const { win, history, location } = fakeWindow();
    const ask = vi.fn();
    armUnsavedLeaveGuard(win, ask);
    const seen: string[] = [];
    win.addEventListener("popstate", () => seen.push(location.pathname));
    history.back();
    /* Every listener — the router's included — saw the room, never the lobby. */
    expect(seen).toEqual(["/app/casting/cast/KI-1"]);
    expect(location.pathname).toBe("/app/casting/cast/KI-1");
    expect(ask).toHaveBeenCalledTimes(1);
    ask.mock.calls[0][0]();
    expect(location.pathname).toBe("/app/casting");
  });

  it("staying steps off the sentinel so the next Back is not a dead press", () => {
    const { win, index } = fakeWindow();
    const disarm = armUnsavedLeaveGuard(win, vi.fn());
    expect(index()).toBe(2);
    disarm(true);
    expect(index()).toBe(1);
  });

  it("leaving (or unmounting) does not step back — that would land after the next page", () => {
    const { win, index } = fakeWindow();
    const disarm = armUnsavedLeaveGuard(win, vi.fn());
    disarm();
    expect(index()).toBe(2);
  });

  it("asks the browser before the tab closes, and stops once disarmed", () => {
    const { win, fire, listeners } = fakeWindow();
    const disarm = armUnsavedLeaveGuard(win, vi.fn());
    const event = { preventDefault: vi.fn(), returnValue: "x" };
    fire("beforeunload", event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    disarm();
    disarm();
    expect(listeners.get("beforeunload")?.size ?? 0).toBe(0);
    expect(listeners.get("popstate")?.size ?? 0).toBe(0);
  });

  it("the room arms it only while a card holds an unsaved edit, and stands it down to delete", () => {
    const room = source(ROOM);
    expect(room).toMatch(/if \(!anyUnsaved\) return;\s*const disarm = armUnsavedLeaveGuard\(window,/);
    /* Kept or cancelled: step off the sentinel; unmounting: do not. */
    expect(room).toContain("disarm(!unmounting.current);");
    expect(room).toMatch(/disarmLeave\.current\?\.\(\);\s*navigate\("\/app\/casting"\);/);
    expect(room.split("onUnsavedChange={reportUnsaved}")).toHaveLength(3);
    expect(room).toContain('title="Leave without keeping your edit?"');
  });
});

describe("5 · Enter adds a line; only Keep, or the send button, acts", () => {
  it("the key rule: Escape means something, Enter means nothing", () => {
    expect(personaKeyAction("Escape")).toBe("escape");
    expect(personaKeyAction("Enter")).toBeNull();
    expect(personaKeyAction("a")).toBeNull();
  });

  it("neither text box handles Enter itself", () => {
    const editor = slice(CARDS, "function EditableLine(", "export type CastPersonaCardsProps");
    const panel = slice(CARDS, "export function PersonaOwnWordsPanel(", "export function PersonaWait(");
    for (const cut of [editor, panel]) {
      expect(cut).not.toContain('"Enter"');
      expect(cut).not.toContain("shiftKey");
    }
  });

  it("a kept line break reads as one", () => {
    expect(rule(".dpc-persona__read")).toContain("white-space: pre-line;");
  });
});

describe("6 · the waits move, and every failure offers Try again", () => {
  it("the wait is a status with a moving sign", () => {
    const html = renderToStaticMarkup(createElement(PersonaWait, { words: "Working" }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('class="dpc-persona__pulse"');
    expect(source(CSS)).toContain("animation: dpc-persona-sweep");
  });

  it("both waits draw it", () => {
    const picker = renderToStaticMarkup(createElement(CastReadsPicker, { door: readsDoor(), name: "Pigman", saving: false }));
    expect(picker).toContain("dpc-persona__pulse");
    expect(picker).toContain(PERSONA_READS_WORKING);
    const panel = renderToStaticMarkup(createElement(PersonaOwnWordsPanel, {
      line: "voice", door: ownDoor({ stage: "reading" }), name: "Pigman", saving: false, onKept: vi.fn(),
    }));
    expect(panel).toContain("dpc-persona__pulse");
    expect(panel).toContain(PERSONA_OWN_WORDS_WORKING);
  });

  it("a failure line carries Try again, and pressing it asks again", () => {
    const onRetry = vi.fn();
    const tree = PersonaFailure({ words: "No.", onRetry }) as ReactElement<{ children: ReactElement<{ onClick: () => void }>[] }>;
    tree.props.children[1].props.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
    const reads = renderToStaticMarkup(createElement(CastReadsPicker, {
      door: readsDoor({ state: "failed" }), name: "Pigman", saving: false,
    }));
    expect(reads).toContain(PERSONA_READS_FAILED);
    expect(reads).toContain(">Try again</button>");
    /* The reads Try again re-opens the door; the panel's re-sends the sentence. */
    expect(slice(CARDS, "export function CastReadsPicker(", "export function CastPersonalityCard(")).toContain(
      "<PersonaFailure words={PERSONA_READS_FAILED} onRetry={door.onOpen} />",
    );
    expect(slice(CARDS, "export function PersonaOwnWordsPanel(", "export function PersonaWait(")).toContain(
      "<PersonaFailure words={door.failure} onRetry={ask} disabled={!sentence} />",
    );
  });

  it("a door closed mid-wait stays closed: an answer holding an old ticket is dropped", () => {
    const room = source(ROOM);
    /* Both halves of the reads answer — the six and the refusal. */
    expect(room).toMatch(/if \(ticket !== readsTicket\.current\) return;\s*setReads\(drafted\.reads\);/);
    expect(room).toMatch(/if \(ticket !== readsTicket\.current\) return;\s*setReadsState\("failed"\);/);
    expect(room).toContain("readsTicket.current += 1;");
    expect(room).toContain("if (current()) setOwnWords(line, personaOwnWordsAfter(answer));");
    expect(room).toContain("ownWordsTicket.current[line] += 1;");
  });
});

describe("7 · picked looks different from hovered", () => {
  it("hover is a lighter border; picked is ink, a tint, and the tag with a check", () => {
    const hover = rule(".dpc-persona__option:hover");
    const picked = rule(".dpc-persona__option.is-picked");
    expect(hover).toContain("border-color: color-mix(in srgb, var(--ink) 32%, var(--border))");
    expect(picked).toContain("border-color: var(--ink)");
    expect(picked).toContain("background: var(--well)");
    expect(hover).not.toContain("border-color: var(--ink)");
    const picker = slice(CARDS, "export function CastReadsPicker(", "export function CastPersonalityCard(");
    expect(picker).toMatch(/<span className="dpc-persona__picked">\s*<Check /);
  });
});

describe("8 · Escape closes the list and the panel, back to the draft", () => {
  it("both doors close on Escape", () => {
    const picker = slice(CARDS, "export function CastReadsPicker(", "export function CastPersonalityCard(");
    const panel = slice(CARDS, "export function PersonaOwnWordsPanel(", "export function PersonaWait(");
    for (const cut of [picker, panel]) {
      expect(cut).toMatch(/if \(personaKeyAction\(event\.key\) === "escape"\) \{\s*event\.stopPropagation\(\);\s*door\.onBack\(\);/);
    }
    /* The list takes focus so the key reaches it. */
    expect(picker).toContain("tabIndex={-1}");
    expect(picker).toContain("panel.current?.focus();");
  });

  it("the draft survives the trip: the editor stays mounted, hidden, under a door", () => {
    const html = drawPersonality({ ownWordsDoor: ownDoor({ stage: "writing" }) });
    /* The card is shut here, so there is no box to keep — the read view is
       simply withheld while the door has the card. */
    expect(html).not.toContain('class="dpc-persona__read"');
    const card = slice(CARDS, "export function CastPersonalityCard(", "export function personaOwnWordsUnsaved(");
    expect(card).toContain("concealed={inPicker || inOwnWords}");
    expect(rule(".dpc-persona__edit[hidden]")).toContain("display: none");
  });
});

describe("9 · focus marks", () => {
  it("rows take the quieter row mark, specific enough to beat the blanket", () => {
    const css = source(CSS);
    const at = css.indexOf(".dp-root .dpc-persona__option:focus-visible,\n.dp-root .dpc-persona__door:focus-visible {");
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf("}", at));
    expect(body).toContain("outline: none;");
    expect(body).toContain("box-shadow: 0 0 0 1px");
  });

  it("no persona rule gives a text field a focus ring", () => {
    const css = source(CSS);
    expect(css).toContain(".dpc-persona__field:focus { outline: none; }");
    expect(css).not.toMatch(/dpc-persona__(field|ownField)[^{]*:focus[^{]*\{[^}]*outline: 2px/);
  });
});

describe("10 · phone width", () => {
  it("the buttons stack and the links wrap at 460px and under", () => {
    const css = source(CSS);
    const at = css.lastIndexOf("@media (max-width: 460px) {");
    const block = css.slice(at, css.indexOf("\n}\n", at));
    expect(block).toContain(".dpc-persona__acts { flex-direction: column; align-items: stretch; }");
    expect(block).toContain(".dpc-persona__links { flex-wrap: wrap;");
  });
});

describe("12 · after a pick, Keep stays in view", () => {
  it("the Keep row is pinned to the bottom of the viewport, on the card's surface", () => {
    const pin = rule(".dpc-persona__pin");
    expect(pin).toContain("position: sticky;");
    expect(pin).toContain("bottom: 0;");
    expect(pin).toContain("background: var(--surface);");
    const picker = slice(CARDS, "export function CastReadsPicker(", "export function CastPersonalityCard(");
    expect(picker).toContain('<div className="dpc-persona__acts dpc-persona__pin">');
  });
});

describe("the reads header says himself / herself / themselves off the cast's record", () => {
  it("derives the reflexive from the recorded subject, never guessing", () => {
    expect(personaReflexive({ subject: "he" })).toBe("himself");
    expect(personaReflexive({ subject: "she" })).toBe("herself");
    expect(personaReflexive({ subject: "they" })).toBe("themselves");
    expect(personaReflexive(null)).toBe("themselves");
  });

  it("the header reads it, named or not", () => {
    expect(personaReadsListSubtitle("Pigman", { subject: "he" }))
      .toBe("Six ways Pigman could carry himself. Pick the one you recognise.");
    expect(personaReadsRowSubtitle(null, { subject: "she" }))
      .toBe("Six ways she could carry herself, in plain words");
    expect(personaReadsRowSubtitle("Pigman")).toBe("Six ways Pigman could carry themselves, in plain words");
  });

  it("the picker and the room hand it the cast's own pronouns", () => {
    const html = renderToStaticMarkup(createElement(CastReadsPicker, {
      door: readsDoor({ state: "open", reads: [] }), name: "Pigman", saving: false, pronouns: { subject: "he" },
    }));
    expect(html).toContain("could carry himself");
    expect(source(ROOM)).toContain("pronouns={data.pronouns}");
  });
});

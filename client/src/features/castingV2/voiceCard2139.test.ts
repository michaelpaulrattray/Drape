/**
 * #2139 — THE VOICE CARD EDITS IN PLACE: ITS OWN HELPER, AND A *Change* BUTTON
 * THAT CHANGES SOMETHING.
 *
 * His Desk design (Notion, *"Voice card: editing redesign (casting room)"*,
 * filed by Yuna 2026-10-09, *"Mike approved the design"*), section 1: the voice
 * text becomes editable *"with Keep / Cancel"* and a helper line reading
 * *"Written from your brief and Pigman's look. Describe the sound, then how
 * Pigman uses it. New takes follow these words."*
 *
 * # What was already there, and what this card actually owed
 *
 * Keep and Cancel arrived for BOTH lines with door 0 of #2137
 * (`client/src/features/castingV2/personaDoor0.test.ts`), because the two
 * cards share one editing component. So what section 1 still owed was the
 * voice line's OWN sentence — which is not the personality one, and the
 * difference is the whole point of it: it teaches #2136's voice rule (the
 * sound, then how it is used) at the moment a customer is about to write one.
 *
 * # ⚠ THE SECOND HALF IS A DEAD BUTTON, AND IT IS THE PART A CUSTOMER HITS
 *
 * The voice card's head carried a *Change* button that was `disabled` and did
 * nothing. A customer who wanted to change the voice pressed the one control
 * named for it and got silence — on the card this very rung makes editable.
 * The refine card's dead controls are honest because a line under them says
 * *"Refining arrives soon"*; this one said nothing at all.
 *
 * It is drawn only when there is a line to open and the box is shut, and both
 * halves are read off his frames rather than chosen: #2137's design shows
 * *Change* on the CLOSED voice card, and all three #2139 frames show it gone
 * once the card is open.
 *
 * # ⚠ WHAT THIS SUITE CAN AND CANNOT SEE, SAID FIRST
 *
 * `pnpm test` runs with no DOM. So the wiring is read from source and the copy
 * is DRIVEN through the exported helper, which is a pure function. **Pressing
 * Change, pressing Keep, pressing Cancel are driven in the running app and
 * recorded on the PR with frames in both themes** — a guard claiming to have
 * proven those from source would be claiming the thing working law 1 forbids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { personaEditHelper, voiceEditHelper } from "./components/CastPersonaCards";

const CARDS = "client/src/features/castingV2/components/CastPersonaCards.tsx";
const ROOM = "client/src/pages/CastingRoom.tsx";
const CSS = "client/src/features/castingV2/castingV2.css";

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

/**
 * Cut one declaration out of a file so an arm about it cannot be satisfied by
 * an identical line in a neighbour — the sibling-satisfied shape this
 * repository has paid for more than once. Both anchors are asserted UNIQUE
 * before the cut, so a rename that moves a boundary reddens here rather than
 * silently widening the slice to the whole file.
 */
function slice(path: string, open: string, close: string | null): string {
  const text = source(path);
  expect(text.split(open)).toHaveLength(2);
  if (close !== null) expect(text.split(close)).toHaveLength(2);
  const cut = text.slice(
    text.indexOf(open),
    close === null ? text.length : text.indexOf(close),
  );
  /* A slice that collapsed to nothing would pass every absence arm below. */
  expect(cut.length).toBeGreaterThan(200);
  return cut;
}

describe("the voice line's helper, driven rather than read", () => {
  it("names the cast twice and reads as his design does", () => {
    expect(voiceEditHelper("Pigman")).toBe(
      "Written from your brief and Pigman's look. Describe the sound, then how Pigman uses it.",
    );
  });

  /**
   * ⚠ THE SENTENCE THAT MAKES IT A SECOND HELPER RATHER THAN A SHARED ONE.
   *
   * His craft correction, verbatim on the design: *"The voice text carries
   * timbre AND performance style. The sound of him, then how he uses it."* A
   * customer editing this line without that sentence writes half of it, and
   * the half they drop is the one that makes the cast directable (#2136).
   */
  it("is not the personality line's sentence", () => {
    expect(voiceEditHelper("Pigman")).not.toBe(personaEditHelper("Pigman"));
    expect(voiceEditHelper("Pigman")).toContain("Describe the sound, then");
    expect(personaEditHelper("Pigman")).not.toContain("Describe the sound");
  });

  it("falls back to the room's own wording when there is no name", () => {
    /* `Refine their look` is the established fallback one file over; a second
       spelling of the same idea is the drift this repository keeps paying for. */
    for (const empty of [null, undefined, "", "   "]) {
      const copy = voiceEditHelper(empty);
      expect(copy).toContain("their look");
      expect(copy).not.toContain("'s look");
      /* ⚠ The verb has to agree with the subject the fallback produces. "how
         they uses it" is what a single interpolated sentence shape gives. */
      expect(copy).toContain("how they use it");
      expect(copy).not.toContain("uses it");
    }
    expect(source(ROOM)).toContain('"Refine their look"');
  });

  /**
   * ⚠ THE CLAUSE HIS DESIGN CARRIES AND THIS PRODUCT CANNOT YET SAY.
   *
   * *"New takes follow these words"* is dropped, on the same reading door 0
   * made for personality and re-taken at the code for this card: the refine
   * card's input, button and chips are all `disabled`, and `castPersona.ts`
   * says nothing reads these lines to build a prompt anywhere. The arm holds
   * BOTH halves of that reason, so the day either becomes false this suite is
   * what says the clause may come back.
   */
  it("does not promise that takes follow the edit, while no take can be made", () => {
    expect(voiceEditHelper("Pigman")).not.toContain("takes");

    const room = source(ROOM);
    /* Both anchors unique, so neither slice can quietly widen to the file. */
    expect(room.split('className="dpc-rcard dpc-rrefine"')).toHaveLength(2);
    expect(room.split("Refining arrives soon.")).toHaveLength(2);
    const shell = room.slice(
      room.indexOf('className="dpc-rcard dpc-rrefine"'),
      room.indexOf("Refining arrives soon."),
    );
    expect(shell).toContain("New takes");
    /* Three disabled controls: the input, the button and each chip. */
    expect(shell.split("disabled").length - 1).toBeGreaterThanOrEqual(3);

    expect(source("server/castingV2/castPersona.ts")).toContain(
      "nothing reads these two lines to build a prompt anywhere",
    );
  });

  it("says nothing gendered about the cast", () => {
    /* His word, 2026-10-09: never gender the customer, the cast or anyone. */
    for (const name of ["Pigman", null]) {
      expect(voiceEditHelper(name)).not.toMatch(/\b(she|he|her|his|hers|him)\b/i);
    }
  });
});

describe("the voice line is handed the helper and its open state", () => {
  const voiceLine = () =>
    /* It is the file's last export, so the cut runs to the end of the file. */
    slice(CARDS, "export function CastVoiceLine(", null);

  it("passes the helper the cast's name produces", () => {
    expect(voiceLine()).toContain("helper={voiceEditHelper(name)}");
  });

  it("takes its open state from the caller rather than keeping its own", () => {
    const cut = voiceLine();
    expect(cut).toContain("editing={editing}");
    expect(cut).toContain("onEditingChange={onEditingChange}");
    expect(cut).not.toContain("useState");
  });

  /*
    The editing component is CONTROLLED now, which is what lets a button
    outside this file open the box. An `editing` state back inside it would
    leave the room's Change button pressing on nothing again.
  */
  it("the editing component declares both halves of the controlled pair", () => {
    const props = slice(CARDS, "type EditableLineProps = {", "\n/**\n * ONE LINE");
    expect(props).toContain("editing: boolean;");
    expect(props).toContain("onEditingChange: (open: boolean) => void;");
  });
});

describe("the personality card keeps its own open state, above its early return", () => {
  /**
   * ⚠ THE ARM IS ABOUT THE ORDER, NOT THE HOOK. A `useState` under a
   * conditional `return null` runs on some renders and not others, which React
   * ends the page on (#310) — and the render it would die on is the common one
   * here: a Cast signed before N2b, with no line to draw.
   */
  it("declares the hook before the no-line return", () => {
    const card = slice(
      CARDS,
      "export function CastPersonalityCard(",
      "\n/**\n * THE VOICE CARD'S BADGE",
    );
    const hook = card.indexOf("const [editing, setEditing] = useState(false);");
    const bail = card.indexOf("if (!personality) return null;");
    expect(hook).toBeGreaterThan(-1);
    expect(bail).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(bail);
  });
});

describe("Change opens the voice line, and is absent when there is nothing to open", () => {
  const head = () =>
    slice(
      ROOM,
      '<span className="dpc-rcard__label">VOICE</span>',
      "<CastVoiceLine",
    );

  /*
    The load-bearing absence: the button must no longer be unconditionally
    `disabled`. It is read on a SLICE of the voice card's head, because the
    room has other disabled buttons and a whole-file arm would be satisfied by
    any one of them.
  */
  it("is no longer a dead control", () => {
    const cut = head();
    expect(cut).toContain('className="dpc-rcard__quiet"');
    expect(cut).toContain("onClick={() => setVoiceEditing(true)}");
    /* `disabled` survives, but only as the in-flight one the read view has. */
    expect(cut).toContain('disabled={savingPersonaField === "voice"}');
    expect(cut).not.toContain('className="dpc-rcard__quiet" disabled');
  });

  it("is drawn only with a voice line present and the box shut", () => {
    expect(head()).toContain("{data.persona?.voice && !voiceEditing ? (");
  });

  it("the room holds the open state above every early return", () => {
    const room = source(ROOM);
    const declared = room.indexOf("const [voiceEditing, setVoiceEditing] = useState(false);");
    expect(declared).toBeGreaterThan(-1);
    /* The page's first early return is the loading one; the hook sits above
       it for the same React #310 reason the saving-line state does. */
    const loading = room.indexOf("const [viewingImage, setViewingImage]");
    expect(declared).toBeLessThan(loading);
  });

  it("the room hands the voice line the name and the state", () => {
    const room = source(ROOM);
    const call = room.slice(room.indexOf("<CastVoiceLine"));
    expect(call.slice(0, 700)).toContain("name={data.name ?? null}");
    expect(call.slice(0, 700)).toContain("editing={voiceEditing}");
    expect(call.slice(0, 700)).toContain("onEditingChange={setVoiceEditing}");
  });

  it("the stylesheet lets the button be pressed, and refuses only when disabled", () => {
    const css = source(CSS);
    expect(css).toContain(".dpc-rcard__quiet { ");
    const rule = css.slice(css.indexOf(".dpc-rcard__quiet { "));
    expect(rule.slice(0, 200)).toContain("cursor: pointer");
    expect(css).toContain(".dpc-rcard__quiet:disabled { cursor: default");
  });
});

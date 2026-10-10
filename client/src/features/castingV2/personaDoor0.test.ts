/**
 * #2137 DOOR 0 — THE PERSONALITY CARD EDITS IN PLACE, WITH KEEP AND CANCEL.
 *
 * His Desk design (Notion, *"Personality & Voice cards: editing redesign…"*,
 * section 1, filed by Yuna 2026-10-09 with his *"Mike likes it"*): the drafted
 * lines become editable *"with Keep / Cancel and the helper line"*.
 *
 * # What a customer hits without it
 *
 * The card saved on BLUR. Clicking anywhere else on the page stored whatever
 * was in the box, with no button pressed and nothing on screen saying an edit
 * had been committed — and there was no way back to the line as it was except
 * remembering it and typing it again.
 *
 * # ⚠ THE ARM THAT MATTERS IS THE ABSENT ONE
 *
 * **A Cancel button cannot coexist with a blur-saving field.** Pressing Cancel
 * blurs the textarea first, so `commit` runs and the edit is sent before the
 * click is handled — the button whose whole job is to throw the edit away
 * would have stored it, every time, silently. So this suite's load-bearing
 * assertion is that `onBlur` is **gone from the textarea**, and it is taken on
 * a SLICE of the one function rather than on the file: `onBlur` appears
 * nowhere else today, and an arm that reads the whole file would go green
 * again the moment some neighbouring field grew one (the sibling-satisfied
 * shape, paid for more than once in this repository).
 *
 * # ⚠ WHAT THIS SUITE CAN AND CANNOT SEE, SAID FIRST
 *
 * `pnpm test` runs in a node environment with **no DOM** and the config says
 * so in its own words (*"Component rendering stays out of `pnpm test`"*). So
 * the wiring is read from source and the copy is DRIVEN through the exported
 * helper, which is a pure function and needs no DOM. **Pressing Keep, pressing
 * Cancel and clicking away are driven in the running app and recorded on the
 * PR with frames in both themes** — a guard claiming to have proven those from
 * source would be claiming the thing working law 1 forbids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { personaEditHelper } from "./components/CastPersonaCards";

const CARDS = "client/src/features/castingV2/components/CastPersonaCards.tsx";
const ROOM = "client/src/pages/CastingRoom.tsx";
const CSS = "client/src/features/castingV2/castingV2.css";

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

/**
 * The ONE editing function, cut out of the file so an arm about it cannot be
 * satisfied by a neighbour. The anchors are asserted unique before the cut, so
 * a rename that moves the boundary reddens here rather than silently widening
 * the slice to the whole file.
 */
function editableLine(): string {
  const text = source(CARDS);
  const open = "function EditableLine(";
  const close = "export type CastPersonaCardsProps";
  expect(text.split(open)).toHaveLength(2);
  expect(text.split(close)).toHaveLength(2);
  const slice = text.slice(text.indexOf(open), text.indexOf(close));
  /* A slice that collapsed to nothing would pass every absence arm below. */
  expect(slice.length).toBeGreaterThan(1_000);
  return slice;
}

describe("the field no longer saves on blur, which is what lets Cancel exist", () => {
  /*
    ⚠ `onBlur=` AND NOT `onBlur`, and the first shape of this arm was the
    looser one. It went red on the comment four lines above the return that
    EXPLAINS why the handler is gone — so a guard banning the word would have
    forbidden the file from describing its own fix, and the tempting repair is
    to delete the explanation. The attribute is what matters; prose about it is
    the thing a later reader needs most.
  */
  it("has no onBlur handler anywhere in the editing function", () => {
    expect(editableLine()).not.toContain("onBlur=");
  });

  /*
    ⚠ ENTER NO LONGER COMMITS — #2238, his word 2026-10-11: Enter stored a
    half-finished edit. Enter is a new line now and only Keep stores; the key
    rule itself is `personaKeyAction`, driven in `personaOneDoor2238.test.ts`.
  */
  it("still abandons on Escape, and Enter no longer commits", () => {
    const slice = editableLine();
    expect(slice).toContain('personaKeyAction(event.key) === "escape"');
    expect(slice).toContain("abandon();");
    expect(slice).not.toContain('"Enter"');
  });

  /*
    The positive control for the arm above: `abandon` must actually put the
    server's line back, or Cancel would close the box over a changed draft and
    the next open would show the abandoned words.
  */
  /*
    ⚠ THE CLOSE IS `onEditingChange(false)` AND IT WAS `setEditing(false)`
    UNTIL #2139. The open state moved out of this component so the voice
    card's *Change* button — which lives in a head this file does not own —
    could open the box; the assertion is the same one, in the spelling the
    controlled component now uses. `voiceCard2139.test.ts` holds the lift
    itself, so a quiet return to local state reddens there rather than here.
  */
  it("abandon restores the server's text and closes", () => {
    const slice = editableLine();
    const body = slice.slice(slice.indexOf("const abandon = () =>"));
    expect(body).toContain("setDraft(value.text);");
    expect(body).toContain("onEditingChange(false);");
  });
});

describe("Keep and Cancel are both drawn, and Keep refuses an empty box", () => {
  it("draws the two buttons with their own classes", () => {
    const slice = editableLine();
    expect(slice).toContain('className="dpc-persona__keep"');
    expect(slice).toContain('className="dpc-persona__cancel"');
    expect(slice).toContain("onClick={commit}");
    expect(slice).toContain("onClick={abandon}");
  });

  it("disables Keep on a blank draft rather than swallowing the press", () => {
    expect(editableLine()).toContain("disabled={!draft.trim()}");
  });

  it("every class the markup names is declared in the stylesheet", () => {
    const css = source(CSS);
    for (const klass of [
      "dpc-persona__edit",
      "dpc-persona__helper",
      "dpc-persona__acts",
      "dpc-persona__keep",
      "dpc-persona__cancel",
    ]) {
      expect(css).toContain(`.${klass}`);
    }
  });
});

describe("the helper line, driven rather than read", () => {
  it("names the cast and reads as his design does", () => {
    expect(personaEditHelper("Pigman")).toBe(
      "Written from your brief and Pigman's look. Fix anything that's off. It's just words.",
    );
  });

  it("falls back to the room's own wording when there is no name", () => {
    /* `Refine their look` is the established fallback one file over; a second
       spelling of the same idea is the drift this repository keeps paying for. */
    for (const empty of [null, undefined, "", "   "]) {
      expect(personaEditHelper(empty)).toContain("their look");
      expect(personaEditHelper(empty)).not.toContain("'s look");
    }
    expect(source(ROOM)).toContain('"Refine their look"');
  });

  /**
   * ⚠ THE CLAUSE HIS DESIGN CARRIES AND THIS PRODUCT CANNOT YET SAY.
   *
   * *"and new takes follow them"* is dropped, because #2137's own body asks
   * for the check and the code answers it twice: the refine card's input,
   * button and chips are all `disabled`, and `castPersona.ts` says nothing
   * reads these lines to build a prompt anywhere. The arm holds BOTH halves of
   * that reason, so the day either becomes false this suite is what says the
   * clause may come back.
   */
  it("does not promise that takes follow the edit, while no take can be made", () => {
    expect(personaEditHelper("Pigman")).not.toContain("takes");

    const room = source(ROOM);
    /* Both anchors unique, so neither slice can quietly widen to the file. */
    expect(room.split('className="dpc-rcard dpc-rrefine"')).toHaveLength(2);
    expect(room.split("Refining arrives soon.")).toHaveLength(2);
    /* The card's own shell: input, button and chips, up to the closing prose. */
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
      const copy = personaEditHelper(name);
      expect(copy).not.toMatch(/\b(she|he|her|his|hers|him)\b/i);
    }
  });
});

describe("the room hands the card the name the helper needs", () => {
  it("passes the cast's name into the personality card", () => {
    const room = source(ROOM);
    const card = room.slice(room.indexOf("<CastPersonalityCard"));
    expect(card.slice(0, 600)).toContain("name={data.name ?? null}");
  });
});

/**
 * DOOR 1 — *PICK A DIFFERENT READ* (#2196), driven through the real components.
 *
 * His approved Desk design, section 1, read at his own frames rather than off
 * the card's prose:
 *
 *  - `01-door0-dark.png` — the door rows sit UNDER the open editor, behind an
 *    *"or"*. A shut card shows none of them.
 *  - `02-door1-dark.png` — opening it REPLACES the card body with six rows,
 *    one ringed and tagged *Picked*, and a button reading `Keep "<label>"`.
 *    The reassurance and *Back to the draft* sit beneath.
 *
 * ⚠ What this cannot see: `pnpm test` has no DOM, so a real press and the
 * ~14-second wait are driven in the running app and recorded on the PR with
 * frames in both themes, never claimed here.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  CastPersonalityCard,
  CastReadsPicker,
  PERSONA_READS_FAILED,
  PERSONA_READS_TITLE,
  PERSONA_READS_WORKING,
  PersonaDoorRows,
  personaDoorRowSpecs,
  personaReadsListSubtitle,
  personaReadsReassurance,
  personaReadsRowSubtitle,
  type CastReadOption,
  type PersonaReadsDoor,
} from "./components/CastPersonaCards";

const CARDS = "client/src/features/castingV2/components/CastPersonaCards.tsx";
const ROOM = "client/src/pages/CastingRoom.tsx";
const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

const SIX: CastReadOption[] = Array.from({ length: 6 }, (_, index) => ({
  label: `The reader ${index + 1}`,
  personality: `Stands still number ${index + 1}. Moves late.`,
}));

const door = (over: Partial<PersonaReadsDoor> = {}): PersonaReadsDoor => ({
  state: "open",
  reads: SIX,
  onOpen: vi.fn(),
  onBack: vi.fn(),
  onKeep: vi.fn(),
  ...over,
});

const drawPicker = (over: Partial<PersonaReadsDoor> = {}, name: string | null = "Pigman") =>
  renderToStaticMarkup(createElement(CastReadsPicker, { door: door(over), name, saving: false }));

const drawCard = (readsDoor: PersonaReadsDoor | null, name: string | null = "Pigman") =>
  renderToStaticMarkup(
    createElement(CastPersonalityCard, {
      personality: { text: "Stands planted and square. Moves late.", drafted: true },
      onSave: vi.fn(),
      savingLine: null,
      name,
      readsDoor,
    }),
  );

describe("the six, as his frame draws them", () => {
  it("draws one row per read, each with its label and its exact words", () => {
    const html = drawPicker();
    for (const read of SIX) {
      expect(html).toContain(read.label);
      expect(html).toContain(read.personality);
    }
  });

  it("⚠ opens with NOTHING picked — no ring, no tag, and no Keep button", () => {
    /*
      His frame shows a picked row, but it shows it beside a button naming that
      row — a button that cannot exist before a label does. So the frame is the
      state after a press, and the caption under it says the act: *"Pick a read
      by recognising it."* Opening pre-picked would be the product choosing and
      then asking them to confirm, which his candidate-count ruling refused.
    */
    const html = drawPicker();
    expect(html).not.toContain("is-picked");
    expect(html).not.toContain("Picked</span>");
    expect(html).not.toContain("Keep “");
  });

  it("names the cast in the line above the six, and falls back without one", () => {
    expect(personaReadsListSubtitle("Pigman")).toBe(
      "Six ways Pigman could carry themselves. Pick the one you recognise.",
    );
    expect(personaReadsListSubtitle(null)).toBe(
      "Six ways they could carry themselves. Pick the one you recognise.",
    );
    expect(personaReadsListSubtitle("   ")).toContain("they could carry themselves");
  });

  it("the way back is drawn, and it is the quiet control rather than the loud one", () => {
    const html = drawPicker();
    expect(html).toContain("Back to the draft");
    expect(html).toContain("dpc-persona__back");
  });
});

describe("⚠ his reassurance keeps its promise and drops its forecast", () => {
  it("says the face and look are untouched, and does NOT promise new takes", () => {
    const line = personaReadsReassurance("Pigman");
    expect(line).toBe("Pigman's face and look stay exactly as they are. Only the acting changes.");
    expect(line).not.toContain("new takes");
  });

  it("falls back to a possessive that reads as English with no name", () => {
    expect(personaReadsReassurance(null)).toBe(
      "Their face and look stay exactly as they are. Only the acting changes.",
    );
  });

  it("⚠ the dropped clause stays dropped while BOTH its reasons hold", () => {
    /*
      The clause comes back in his words on the day it is true. This arm is
      what will say so: it holds the two facts the drop rests on, so the day
      either becomes false the suite asks for the sentence back rather than
      leaving a stale omission nobody re-reads.
    */
    expect(source(ROOM)).toContain("Refining arrives soon.");
    const composers = source("server/castingV2/castPersona.ts");
    expect(composers).toContain("nothing reads these two lines to build a prompt anywhere");
  });
});

describe("the wait and the refusal", () => {
  it("says what is happening to their cast, and names no engine", () => {
    const html = drawPicker({ state: "drafting", reads: [] });
    expect(html).toContain(PERSONA_READS_WORKING);
    expect(html).not.toContain("The reader 1");
    for (const leak of ["claude", "sonnet", "anthropic", "openrouter", "model", "token"]) {
      expect(PERSONA_READS_WORKING.toLowerCase()).not.toContain(leak);
    }
  });

  it("a refusal says what was refused and what to do", () => {
    const html = drawPicker({ state: "failed", reads: [] });
    expect(html).toContain(PERSONA_READS_FAILED);
    expect(PERSONA_READS_FAILED).toContain("Try again");
  });

  it("neither state draws a count, a bar or a number nobody can act on", () => {
    for (const state of ["drafting", "failed"] as const) {
      expect(drawPicker({ state, reads: [] })).not.toMatch(/\d+\s*%/);
    }
  });
});

describe("where the door is offered, which is read off his frame", () => {
  it("a SHUT card offers nothing — one line of words and the quiet edit icon (card 2238)", () => {
    const html = drawCard(door({ state: "shut", reads: [] }));
    expect(html).not.toContain(PERSONA_READS_TITLE);
    expect(html).toContain('aria-label="Edit personality"');
  });

  it("the row and its `or` appear only once the box is open", () => {
    /*
      The card holds `editing` itself, so the row cannot be reached by props
      from here — this holds the CONDITION in the source instead, beside the
      rendered arms above that prove the shut case.
    */
    expect(source(CARDS)).toContain("<PersonaDoorRows doors={doors}");
    expect(source(CARDS)).toMatch(/\{editing && !inPicker && !inOwnWords \? \(\s*<PersonaDoorRows doors=\{doors\}/);
    expect(renderToStaticMarkup(
      createElement(PersonaDoorRows, { doors: personaDoorRowSpecs("personality", "Pigman", door(), null), disabled: false }),
    )).toContain("or</span>");
  });

  it("the row says what the door is, in his words", () => {
    const html = renderToStaticMarkup(
      createElement(PersonaDoorRows, { doors: personaDoorRowSpecs("personality", "Pigman", door(), null), disabled: false }),
    );
    expect(html).toContain(PERSONA_READS_TITLE);
    expect(html).toContain(personaReadsRowSubtitle("Pigman"));
    expect(personaReadsRowSubtitle("Pigman")).toBe("Six ways Pigman could carry themselves, in plain words");
  });

  it("⚠ the picker REPLACES the card body — the words and the box are gone", () => {
    const html = drawCard(door({ state: "open" }));
    expect(html).toContain("The reader 1");
    /* The read view's own button class is what the body would draw. */
    expect(html).not.toContain("dpc-persona__read");
    expect(html).not.toContain("dpc-persona__field");
  });

  /* Door 2 (card 2197, named in a comment because the token guard reads a
     hash-number in code as a hex literal) arrived with its client half; its
     own suite is personaOwnWords2197.test.ts. This arm keeps door 1 honest
     about being FIRST when both are handed over, and ALONE when door 2 is not. */
  it("door 1 is the first of the rows, and the only one when door 2 is not handed over", () => {
    const alone = personaDoorRowSpecs("personality", "Pigman", door(), null);
    expect(alone.map((row) => row.title)).toEqual([PERSONA_READS_TITLE]);
    const row = renderToStaticMarkup(createElement(PersonaDoorRows, { doors: alone, disabled: false }));
    expect(row.match(/<button/g) ?? []).toHaveLength(1);
    expect(drawCard(door({ state: "shut", reads: [] }))).not.toContain("Say it your way");
  });
});

describe("the room owns the call, and the card owns none of it", () => {
  it("the card file imports no tRPC — the door is props, as every control here is", () => {
    expect(source(CARDS)).not.toContain("trpc.");
  });

  it("⚠ the open is a MUTATION, so a tab-away cannot pay for it twice", () => {
    const room = source(ROOM);
    expect(room).toContain("trpc.castingV2.draftCastReads.useMutation()");
    expect(room).not.toContain("draftCastReads.useQuery");
  });

  it("keeping a read goes through the edit the product already has — no new write", () => {
    const room = source(ROOM);
    expect(room).toContain('savePersonaField("personality", read.personality)');
  });

  it("the door shuts on a keep, so the customer lands on the words they chose", () => {
    const room = source(ROOM);
    const keep = room.slice(room.indexOf("const keepRead ="), room.indexOf("const keepRead =") + 400);
    expect(keep).toContain('setReadsState("shut")');
  });
});

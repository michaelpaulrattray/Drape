/**
 * DOOR 2 — *SAY IT YOUR WAY*, ON BOTH CARDS (card 2197 Personality, card 2205
 * Voice), driven through the real components and the real pure functions the
 * room calls.
 *
 * His frames, read at the pixels: `03-door2-dark.png` (Personality) and
 * `05-your-way-dark.png` (Voice) — a title, the ask, a box with the sentence,
 * the line it would store under *"…read from your sentence"*, then **Keep
 * this** / **Reword it**, the reassurance, and the footer links. The rows that
 * open it sit under the OPEN box behind an *"or"* (`01-door0-dark.png`,
 * `04-edit-in-place-dark.png`).
 *
 * ⚠ What this cannot see: `pnpm test` has no DOM, so a real press, the wait
 * and the keep are driven in the running app and recorded on the PR with
 * frames in both themes, never claimed here.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CAST_PERSONA_OWN_WORDS_MAX_LENGTH } from "@shared/inputLimits";
import {
  CastPersonalityCard,
  CastReadsPicker,
  CastVoiceLine,
  PERSONA_OWN_WORDS_BUSY,
  PERSONA_OWN_WORDS_FAILED,
  PERSONA_OWN_WORDS_TITLE,
  PERSONA_OWN_WORDS_WORKING,
  PERSONA_READS_TITLE,
  PersonaDoorRows,
  PersonaOwnWordsPanel,
  personaDoorRowSpecs,
  personaOwnWordsAfter,
  personaOwnWordsGoLabel,
  personaOwnWordsPrompt,
  personaOwnWordsResultHeading,
  personaOwnWordsRowSubtitle,
  personaReassurance,
  type CastPersonaFieldName,
  type PersonaOwnWordsDoor,
  type PersonaReadsDoor,
} from "./components/CastPersonaCards";

const ROOM = "client/src/pages/CastingRoom.tsx";
const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

const SENTENCE = "Basically a tired old bouncer who's seen everything and stopped being surprised.";
const LINE = "Planted and unhurried, heavy-lidded attention that never widens. Reacts late and minimally.";

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
  state: "shut",
  reads: [],
  onOpen: vi.fn(),
  onBack: vi.fn(),
  onKeep: vi.fn(),
  ...over,
});

const panel = (
  line: CastPersonaFieldName,
  door: Partial<PersonaOwnWordsDoor>,
  extra: { initialWords?: string | null; onPickRead?: (() => void) | null; name?: string | null } = {},
) =>
  renderToStaticMarkup(
    createElement(PersonaOwnWordsPanel, {
      line,
      door: ownDoor(door),
      name: extra.name === undefined ? "Pigman" : extra.name,
      saving: false,
      initialWords: extra.initialWords ?? SENTENCE,
      onKept: vi.fn(),
      onPickRead: extra.onPickRead ?? null,
    }),
  );

/** The rendered textarea's opening tag, so an attribute is read on the box and nowhere else. */
const textareaTag = (html: string): string => html.match(/<textarea[^>]*>/)?.[0] ?? "";

describe("the rows under the open box, in his frames' order", () => {
  it("the Personality card offers door 1 then door 2", () => {
    const rows = personaDoorRowSpecs("personality", "Pigman", readsDoor(), ownDoor({ stage: "shut" }));
    expect(rows.map((row) => row.title)).toEqual([PERSONA_READS_TITLE, PERSONA_OWN_WORDS_TITLE]);
    expect(rows[1].subtitle).toBe("Describe Pigman in a sentence. We turn it into what the camera sees");
  });

  it("the Voice card offers door 2 alone, even if a reads door were handed to it", () => {
    const rows = personaDoorRowSpecs("voice", "Pigman", readsDoor(), ownDoor({ stage: "shut" }));
    expect(rows.map((row) => row.title)).toEqual([PERSONA_OWN_WORDS_TITLE]);
    expect(rows[0].subtitle).toBe("Describe how Pigman sounds in a sentence. We turn it into a voice description");
  });

  it("each row opens its own door", () => {
    const reads = readsDoor();
    const own = ownDoor({ stage: "shut" });
    const rows = personaDoorRowSpecs("personality", "Pigman", reads, own);
    rows[1].onOpen();
    expect(own.onOpen).toHaveBeenCalledTimes(1);
    expect(reads.onOpen).not.toHaveBeenCalled();
  });

  it("⚠ no door handed over draws NOTHING — not even the `or`", () => {
    /* Negative control: a divider over nothing reads as a feature that failed to load. */
    expect(personaDoorRowSpecs("voice", "Pigman", null, null)).toEqual([]);
    expect(renderToStaticMarkup(createElement(PersonaDoorRows, { doors: [], disabled: false }))).toBe("");
  });

  it("both rows render under one `or`", () => {
    const html = renderToStaticMarkup(createElement(PersonaDoorRows, {
      doors: personaDoorRowSpecs("personality", "Pigman", readsDoor(), ownDoor({ stage: "shut" })),
      disabled: false,
    }));
    expect(html.match(/<button/g) ?? []).toHaveLength(2);
    expect(html.match(/>or</g) ?? []).toHaveLength(1);
    expect(html).toContain(PERSONA_OWN_WORDS_TITLE);
  });
});

describe("the voice card draws the row only under its OPEN box", () => {
  const voice = { text: "A wet, dragging rumble.", drafted: true, ownWords: null };
  const draw = (editing: boolean, door: PersonaOwnWordsDoor | null) =>
    renderToStaticMarkup(createElement(CastVoiceLine, {
      voice,
      onSave: vi.fn(),
      savingLine: null,
      name: "Pigman",
      editing,
      onEditingChange: vi.fn(),
      ownWordsDoor: door,
    }));

  it("open box, door handed over: the `or` and the row", () => {
    const html = draw(true, ownDoor({ stage: "shut" }));
    expect(html).toContain("or</span>");
    expect(html).toContain(PERSONA_OWN_WORDS_TITLE);
  });

  it("shut box: no row (the card at rest stays one line of words)", () => {
    expect(draw(false, ownDoor({ stage: "shut" }))).not.toContain(PERSONA_OWN_WORDS_TITLE);
  });

  it("no door: exactly the line the voice card shipped, no row", () => {
    expect(draw(true, null)).not.toContain(PERSONA_OWN_WORDS_TITLE);
  });

  it("an open door REPLACES the line with the panel", () => {
    const html = draw(true, ownDoor({ stage: "writing" }));
    expect(html).toContain(personaOwnWordsPrompt("voice", "Pigman"));
    expect(html).not.toContain("A wet, dragging rumble.");
  });
});

describe("the personality card: the panel replaces the body, and the footers cross", () => {
  const personality = { text: "Stands planted and square. Moves late.", drafted: true, ownWords: SENTENCE };
  const draw = (reads: PersonaReadsDoor | null, own: PersonaOwnWordsDoor | null) =>
    renderToStaticMarkup(createElement(CastPersonalityCard, {
      personality,
      onSave: vi.fn(),
      savingLine: null,
      name: "Pigman",
      readsDoor: reads,
      ownWordsDoor: own,
    }));

  it("an open door 2 draws the panel, its stored sentence in the box, and no read view", () => {
    const html = draw(readsDoor(), ownDoor({ stage: "writing" }));
    expect(html).toContain(PERSONA_OWN_WORDS_TITLE);
    expect(html).not.toContain("dpc-persona__read\"");
    /* The box opens on the sentence this line was last kept from. */
    expect(html).toContain(SENTENCE.replace("'", "&#x27;"));
    /* His footer: across to door 1, and back to the draft. */
    expect(html).toContain(`${PERSONA_READS_TITLE} ›`);
    expect(html).toContain("Back to the draft");
  });

  it("a shut card offers neither door", () => {
    const html = draw(readsDoor(), ownDoor({ stage: "shut" }));
    expect(html).not.toContain(PERSONA_OWN_WORDS_TITLE);
    expect(html).not.toContain(PERSONA_READS_TITLE);
  });

  it("door 1's footer crosses to door 2 — *None of these? Say it your way ›* — out of his frame", () => {
    const html = renderToStaticMarkup(createElement(CastReadsPicker, {
      door: readsDoor({ state: "open" }),
      name: "Pigman",
      saving: false,
      onSayItYourWay: vi.fn(),
    }));
    expect(html).toContain("None of these? Say it your way ›");
    /* Negative control: no door 2, no link. */
    const without = renderToStaticMarkup(createElement(CastReadsPicker, {
      door: readsDoor({ state: "open" }),
      name: "Pigman",
      saving: false,
    }));
    expect(without).not.toContain("Say it your way");
  });
});

describe("the panel, stage by stage", () => {
  it("writing: the ask, an editable box, and the press — no Keep this yet", () => {
    for (const line of ["personality", "voice"] as const) {
      const html = panel(line, { stage: "writing" });
      expect(html).toContain(personaOwnWordsPrompt(line, "Pigman"));
      expect(html).toContain(personaOwnWordsGoLabel(line));
      expect(html).not.toContain("Keep this");
      expect(textareaTag(html)).not.toContain("readOnly");
      expect(textareaTag(html)).toContain(`maxLength="${CAST_PERSONA_OWN_WORDS_MAX_LENGTH}"`);
    }
  });

  it("an empty box cannot be sent", () => {
    const html = panel("personality", { stage: "writing" }, { initialWords: "" });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>See what the camera sees</);
  });

  it("reading: the honest stage word, and the box held still", () => {
    const html = panel("voice", { stage: "reading" });
    expect(html).toContain(PERSONA_OWN_WORDS_WORKING);
    expect(textareaTag(html)).toContain("readOnly");
    expect(html).not.toContain("Keep this");
  });

  it("⚠ read: the line under his heading, Keep this / Reword it, and the box READ-ONLY", () => {
    /* The kept sentence must be the one the line was read from; an editable box
       under a finished translation would let the two drift apart. */
    const html = panel("personality", { stage: "read", result: LINE });
    expect(html).toContain("What the camera will see, read from your sentence");
    expect(html).toContain(LINE);
    expect(html).toContain("Keep this");
    expect(html).toContain("Reword it");
    expect(textareaTag(html)).toContain("readOnly");
    expect(html).not.toContain(personaOwnWordsGoLabel("personality"));
  });

  it("the voice's heading names the cast, and falls back without a name", () => {
    expect(personaOwnWordsResultHeading("voice", "Pigman")).toBe("What Pigman will sound like, read from your sentence");
    expect(personaOwnWordsResultHeading("voice", null)).toBe("What they will sound like, read from your sentence");
    expect(personaOwnWordsPrompt("personality", "  ")).toBe("Describe them however you would to a friend.");
    expect(personaOwnWordsRowSubtitle("voice", null)).toBe(
      "Describe how they sound in a sentence. We turn it into a voice description",
    );
  });

  it("failed: the plain sentence, the box editable again, the press back", () => {
    const html = panel("personality", { stage: "failed", failure: PERSONA_OWN_WORDS_BUSY });
    expect(html).toContain(PERSONA_OWN_WORDS_BUSY);
    expect(textareaTag(html)).not.toContain("readOnly");
    expect(html).toContain(personaOwnWordsGoLabel("personality"));
  });

  it("the voice footer has the way back and no link to door 1", () => {
    const html = panel("voice", { stage: "writing" });
    expect(html).toContain("Back to the draft");
    expect(html).not.toContain(PERSONA_READS_TITLE);
  });
});

describe("what a press leaves on the card", () => {
  it("a line is shown to keep", () => {
    expect(personaOwnWordsAfter({ kind: "line", text: LINE })).toEqual({ stage: "read", result: LINE, failure: null });
  });

  it("the server's own `nothing` is the plain failure", () => {
    expect(personaOwnWordsAfter({ kind: "nothing" })).toEqual({
      stage: "failed", result: null, failure: PERSONA_OWN_WORDS_FAILED,
    });
  });

  it("⚠ the hour's bound says BUSY, and only the hour's bound does", () => {
    expect(personaOwnWordsAfter({ kind: "error", code: "TOO_MANY_REQUESTS" }).failure).toBe(PERSONA_OWN_WORDS_BUSY);
    for (const code of ["NOT_FOUND", "INTERNAL_SERVER_ERROR", null]) {
      expect(personaOwnWordsAfter({ kind: "error", code }).failure).toBe(PERSONA_OWN_WORDS_FAILED);
    }
  });
});

describe("honest copy — the disappearing-technology law and his never-gender rule", () => {
  const every = (): string[] => {
    const out: string[] = [PERSONA_OWN_WORDS_TITLE, PERSONA_OWN_WORDS_WORKING, PERSONA_OWN_WORDS_FAILED, PERSONA_OWN_WORDS_BUSY];
    for (const line of ["personality", "voice"] as const) {
      for (const name of ["Pigman", null]) {
        out.push(
          personaOwnWordsRowSubtitle(line, name),
          personaOwnWordsPrompt(line, name),
          personaOwnWordsResultHeading(line, name),
          personaOwnWordsGoLabel(line),
          personaReassurance(line, name),
        );
      }
    }
    return out;
  };

  it("names no engine and no number nobody can act on", () => {
    for (const text of every()) {
      for (const leak of ["claude", "sonnet", "anthropic", "openrouter", "model", "token", "ai ", "%"]) {
        expect(text.toLowerCase()).not.toContain(leak);
      }
      expect(text).not.toMatch(/\d/);
    }
  });

  it("never genders anyone", () => {
    for (const text of every()) {
      expect(text).not.toMatch(/\b(she|her|hers|he|him|his)\b/i);
    }
  });

  it("⚠ the reassurance keeps its promise and drops the forecast on both cards", () => {
    expect(personaReassurance("voice", "Pigman")).toBe(
      "Pigman's face and look stay exactly as they are. Only the voice changes.",
    );
    expect(personaReassurance("personality", null)).toBe(
      "Their face and look stay exactly as they are. Only the acting changes.",
    );
    for (const text of every()) expect(text).not.toContain("new takes");
    /* The two facts the drop rests on, held so the day either changes the suite asks again. */
    expect(source(ROOM)).toContain("Refining arrives soon.");
    expect(source("server/castingV2/castPersona.ts")).toContain(
      "nothing reads these two lines to build a prompt anywhere",
    );
  });
});

describe("the room owns the call, and the keep is the edit the product already has", () => {
  const room = source(ROOM);
  const slice = (from: string, length: number) => {
    const at = room.indexOf(from);
    expect(at).toBeGreaterThan(-1);
    expect(room.indexOf(from, at + 1)).toBe(-1);
    return room.slice(at, at + length);
  };

  it("the translation is a MUTATION, so a tab-away cannot pay for it twice", () => {
    expect(room).toContain("trpc.castingV2.translateOwnWords.useMutation()");
    expect(room).not.toContain("translateOwnWords.useQuery");
  });

  it("⚠ Keep this sends the sentence beside the line, on the existing edit", () => {
    const save = slice("const savePersonaField = (", 1400);
    expect(save).toContain("...(kept ? { ownWords: kept.ownWords } : {})");
    const door = slice("const ownWordsDoor = (line: CastPersonaFieldName)", 1200);
    expect(door).toContain("onKeep: (ownWords, text, kept) => savePersonaField(line, text, {");
  });

  it("the cache writes the sentence it stored — and null on a plain edit, as the server does", () => {
    expect(room).toContain("ownWords: kept?.ownWords ?? null");
  });

  it("the voice player steps aside only while door 2 is open (his 05 frame)", () => {
    expect(room).toContain('{ownWordsDoors.voice.stage === "shut" ? (');
  });
});

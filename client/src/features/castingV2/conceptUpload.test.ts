import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  CONCEPT_ACCEPTED_FILES,
  CONCEPT_CARD_COMING,
  CONCEPT_CARD_LINE,
  CONCEPT_CARD_TITLE,
  CONCEPT_FAILED_FALLBACK,
  CONCEPT_READING_LABEL,
  briefWithDescription,
} from "./conceptUpload";

/**
 * UPLOAD A CONCEPT'S SURFACE, driven rather than reviewed (#185 slice two).
 *
 * The founder's UI contract puts the mechanizable half of a copy audit in the
 * suite, and this card has one claim it must never make and one it must:
 *
 *   - it does NOT cast the person in the picture (no likeness rides — the
 *     photograph is dropped at the describer), and
 *   - it DOES say the picture is not kept, because a customer who learns that
 *     from the result has already been surprised once.
 *
 * The rest is the merge rule, which is the only logic on this road that can
 * silently destroy something a customer typed.
 */
const CARD = new URL("./components/ConceptUploadCard.tsx", import.meta.url);
const PAGE = new URL("../../pages/CastingV2.tsx", import.meta.url);
const FIELD = new URL("./components/BriefField.tsx", import.meta.url);

const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the description lands beside her words, never on top of them", () => {
  it("IS the brief when the box is empty — his 'without having to type it all out'", () => {
    expect(briefWithDescription("", "A man in his 40s, close-cropped hair.")).toBe(
      "A man in his 40s, close-cropped hair.",
    );
    /* Whitespace alone is an empty box, not a sentence worth preserving. */
    expect(briefWithDescription("   \n  ", "A woman in her 20s.")).toBe("A woman in her 20s.");
  });

  it("KEEPS what she typed, first, when the box is not empty", () => {
    const merged = briefWithDescription("a skincare founder", "A man in his 40s.");
    expect(merged.startsWith("a skincare founder")).toBe(true);
    expect(merged).toContain("A man in his 40s.");
    /* A blank line between them: two paragraphs, both editable, in the order
       the author road itself composes in. */
    expect(merged).toBe("a skincare founder\n\nA man in his 40s.");
  });

  it("CANNOT drop her sentence — the arm that would have caught a silent replace", () => {
    /*
      The negative control for the whole rule. A replace-on-fill implementation
      passes every other assertion here and fails only this one.
    */
    for (const typed of ["a dad in his 30s", "  spaced  ", "line one\nline two"]) {
      expect(briefWithDescription(typed, "READ")).toContain(typed.trim());
    }
  });

  it("survives a description that is only whitespace without eating the brief", () => {
    expect(briefWithDescription("a dad in his 30s", "   ")).toBe("a dad in his 30s");
  });
});

describe("the card claims what the road does and nothing more", () => {
  it("never promises to cast the person in the picture", () => {
    /*
      THE LOAD-BEARING NEGATIVE. What the F5 placeholder said — "Casting from
      your own photos" — is a likeness promise, and this road manufactures a
      TYPE. A line that said "cast this person", "your likeness", or "the same
      face" would be the one lie the design cannot afford.
    */
    for (const line of [CONCEPT_CARD_LINE, CONCEPT_CARD_COMING, CONCEPT_CARD_TITLE]) {
      const said = line.toLowerCase();
      expect(said).not.toContain("likeness");
      expect(said).not.toContain("real person");
      expect(said).not.toContain("your own photos");
      expect(said).not.toContain("same face");
    }
    /* And it says the true thing in its place. */
    expect(CONCEPT_CARD_LINE.toLowerCase()).toContain("similar");
  });

  it("says the picture is not kept, on the control that takes it", () => {
    expect(CONCEPT_CARD_LINE.toLowerCase()).toContain("never keep");
  });

  it("carries his rename rather than the prototype's word", () => {
    expect(CONCEPT_CARD_TITLE).toBe("Upload a concept");
  });

  it("names the capability that is actually queued in the coming-state", () => {
    /*
      PROGRAM.md's placeholder amendment: honest or dark, never pretending. A
      coming-state promising a DIFFERENT feature from the one built and waiting
      behind the flag is the prototype claim surviving its own retirement.
    */
    expect(CONCEPT_CARD_COMING.toLowerCase()).toContain("coming");
    expect(CONCEPT_CARD_COMING.toLowerCase()).toContain("picture");
  });

  it("offers the three formats the door actually admits", async () => {
    /* The picker's filter is a courtesy; the BYTES are judged server-side. It
       still must not offer a format the door refuses. */
    expect(CONCEPT_ACCEPTED_FILES).toBe("image/png,image/jpeg,image/webp");
  });

  it("keeps the fallback about the picture, never about the plumbing", () => {
    expect(CONCEPT_FAILED_FALLBACK.toLowerCase()).not.toContain("error");
    expect(CONCEPT_FAILED_FALLBACK.toLowerCase()).not.toContain("server");
    expect(CONCEPT_READING_LABEL.toLowerCase()).toContain("reading");
  });
});

describe("the card is absent-or-live, never drawn as a control that can only refuse", () => {
  it("draws the coming-state when the page hands it no door", async () => {
    const source = withoutProse(await readFile(CARD, "utf8"));
    /* The gate is the DOOR itself, exactly as the refine panel's attach
       affordance is handed one — not a boolean beside it. */
    expect(source).toContain("if (!describe)");
    expect(source).toContain("dpc-entry--inert");
    /* And the inert state is a div: no tab stop, no tap target, no promise. */
    expect(source).toMatch(/<div\s+className="dpc-entry dpc-entry--inert"/);
  });

  it("asks the SERVER whether the door exists — the client never decides a scope", async () => {
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toContain("config.data.conceptUploadEnabled");
    /* Handed `null` rather than a disabled card when the answer is no. */
    expect(page).toMatch(/conceptUploadEnabled[\s\S]{0,200}: null/);
  });

  it("cannot fire twice while one read is in flight", async () => {
    const source = withoutProse(await readFile(CARD, "utf8"));
    expect(source).toContain("if (!file || reading) return;");
    expect(source).toContain("disabled={reading}");
  });

  it("shows our sentence and never the error's", async () => {
    const source = withoutProse(await readFile(CARD, "utf8"));
    expect(source).toContain("readableFailure(error, CONCEPT_FAILED_FALLBACK)");
    /* The two failures are separate: the browser's read and the door's refusal
       ask her to do different things. */
    expect(source).toContain("CONCEPT_FILE_UNREADABLE");
  });

  it("fills the box and stops — nothing is rolled and nothing is charged", async () => {
    const page = withoutProse(await readFile(PAGE, "utf8"));
    const onDescribed = page.slice(page.indexOf("onDescribed={"), page.indexOf("focusBrief();"));
    expect(onDescribed).toContain("briefWithDescription");
    expect(onDescribed).not.toContain("startCasting");
    expect(onDescribed).not.toContain("navigate(");
  });
});

describe("the box the description lands in can be read", () => {
  it("is the brief field, not the single-line input it used to be", async () => {
    const page = withoutProse(await readFile(PAGE, "utf8"));
    /*
      A 1,200-character description in a 60-character window is the defect
      `BriefField` was written for, and the start page kept it after the sheet
      was fixed. The class, not the instance.
    */
    expect(page).toContain("<BriefField");
    expect(page).not.toMatch(/<Input\s+[\s\S]{0,200}aria-label="Casting brief"/);
  });

  it("keeps Enter casting, and gives Shift+Enter the new line", async () => {
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toContain('event.key === "Enter" && !event.shiftKey');
    expect(page).toContain("event.preventDefault();");
  });

  it("finds the box by REF, not by tag name", async () => {
    const page = withoutProse(await readFile(PAGE, "utf8"));
    /*
      The selector this replaces was `input[aria-label="Casting brief"]` — a
      question about the element's TAG wearing the clothes of a question about
      the box. It would have gone silently dead on the line above, taking the
      New-cast-member tile's focus with it.
    */
    expect(page).not.toContain('querySelector<HTMLInputElement>(\'input[aria-label');
    expect(page).toContain("briefField.current");
  });

  it("MERGES a forwarded ref rather than letting it overwrite the measurement", async () => {
    const field = withoutProse(await readFile(FIELD, "utf8"));
    /*
      `{...rest}` is spread last, so a `ref` arriving in it would replace the
      internal one and the auto-grow would stop — silently, and only on the long
      briefs the component exists for.
    */
    expect(field).toContain("ref: forwarded");
    expect(field).toContain("ref.current = node;");
    expect(field).toMatch(/forwarded\.current = node/);
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  CONCEPT_CARD_COMING,
  CONCEPT_CARD_LINE,
  CONCEPT_CARD_TITLE,
  CONCEPT_FAILED_FALLBACK,
  CONCEPT_READING_LABEL,
  CONCEPT_REVIEW_DISCARD,
  CONCEPT_REVIEW_EXPLAINER,
  CONCEPT_REVIEW_EYEBROW,
  CONCEPT_REVIEW_TITLE,
  CONCEPT_REVIEW_USE,
  briefWithDescription,
  conceptCountLabel,
} from "./conceptUpload";
import { ACCEPTED_PICTURE_FILES } from "./pictureBytes";
import { INK_DESIGN_FORMATS, inkDesignContentType } from "@shared/pictureFormats";
import { readableGatedFailure } from "./failureCopy";

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

  it("offers exactly the formats the door admits, DERIVED rather than typed", async () => {
    /*
      The picker's filter is a courtesy; the BYTES are judged server-side. It
      still must not offer a format the door refuses — and it must not be a
      second author of the list, which is what it was until the review of #188
      made it one client copy and #27 made it a derivation.

      ⚠ This arm used to read `toBe("image/png,image/jpeg,image/webp")`, and
      that assertion could not tell a derivation from a literal: it pinned the
      answer the mirror already gave. It compares against the DOOR'S OWN LIST
      now, so adding a fourth format to `shared/pictureFormats.ts` moves both
      sides of this comparison together and the picker follows for free —
      which is the whole point of the move. What still cannot pass unnoticed is
      the list and the picker disagreeing, and the arm below bans re-typing it.
    */
    expect(ACCEPTED_PICTURE_FILES.split(",")).toEqual(
      INK_DESIGN_FORMATS.map(inkDesignContentType),
    );
    expect(INK_DESIGN_FORMATS.length).toBeGreaterThan(0);
    const panel = withoutProse(
      await readFile(new URL("./components/RefinePanel.tsx", import.meta.url), "utf8"),
    );
    expect(panel).toContain("accept={ACCEPTED_PICTURE_FILES}");
    expect(panel).not.toContain('accept="image/png');
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).not.toContain('accept="image/png');
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
    expect(source).toContain("readableGatedFailure(error, CONCEPT_FAILED_FALLBACK)");
    /* The two failures are separate: the browser's read and the door's refusal
       ask her to do different things. */
    expect(source).toContain("CONCEPT_FILE_UNREADABLE");
    /* And neither is discarded — the raw text is moved to the console, not lost. */
    expect(source).toContain("logRawFailure(");
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
      A long brief in a 60-character window is the defect `BriefField` was
      written for, and the start page kept it after the sheet was fixed. The
      class, not the instance. ⚠ The reason quoted here used to be the
      DESCRIPTION's length (1,200), and his ruling cut that to 300 — the box
      still needs to be a box, because HER OWN brief may run to 4,000
      (`BRIEF_TEXT_MAX_AUTHOR_ROAD`) and that is the larger case anyway.
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

  it("KEEPS THE IME GUARD Enter-to-cast would otherwise have lost", async () => {
    const field = withoutProse(await readFile(FIELD, "utf8"));
    /*
      THE FINDING THIS ARM EXISTS FOR (review of #188, working law 7's second
      half). The hero box was the shadcn `Input`, which wraps its caller's
      onKeyDown in a composition check — so a Japanese, Chinese or Korean
      customer pressing Enter to accept an IME candidate never reached the
      handler that dispatches a 160-CREDIT ROLL. Swapping the element for a raw
      textarea took that live control with it and left no failing test, because
      the only other caller rolls from a button.

      The guard lives on the BOX rather than at the call site, so the next
      surface to put a submit on Enter cannot rediscover this the expensive way.
    */
    expect(field).toContain("useComposition");
    expect(field).toContain("event.nativeEvent.isComposing || composition.isComposing()");
    expect(field).toContain('event.key === "Enter" && composing');
    /*
      And the three handlers are destructured OUT of the props, so `{...rest}`
      cannot spread a caller's raw onKeyDown over the guarded one — the same
      overwrite trap the ref comment names, on the prop that spends money.
    */
    expect(field).toContain("onKeyDown,");
    expect(field).toContain("onCompositionStart,");
    expect(field).toContain("onCompositionEnd,");
    expect(field).toContain("onKeyDown={composition.onKeyDown}");
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

describe("a scope that closes under a live control never speaks to the customer", () => {
  /*
    The review of #188's LOW finding, fixed as the CLASS. Every flag-gated
    procedure answers outside its scope with NOT_FOUND: "No such thing." — right
    for a probe, and passed straight through by `readableFailure`, because
    NOT_FOUND is on its OURS list. On a control that was DRAWN LIVE (stale
    config, scope narrowed while the page was open) that reaches the screen.
  */
  const notFound = { data: { code: "NOT_FOUND" }, message: "No such thing." };

  it("swallows the flag-first probe sentence", () => {
    expect(readableGatedFailure(notFound, CONCEPT_FAILED_FALLBACK)).toBe(CONCEPT_FAILED_FALLBACK);
    expect(readableGatedFailure(notFound, CONCEPT_FAILED_FALLBACK)).not.toContain("No such thing");
  });

  it("STILL PASSES our own authored refusals — the arm that stops this becoming a gag", () => {
    /*
      The positive control, and the one that matters: a helper that returned the
      fallback for everything would pass the arm above and silently replace the
      door's real sentences ("I couldn't find a person in that picture"), which
      is the exact defect `readableFailure` exists to prevent, inverted.
    */
    const spoken = {
      data: { code: "BAD_REQUEST" },
      message: "I couldn't find a person in that picture — try one with someone in it.",
    };
    expect(readableGatedFailure(spoken, CONCEPT_FAILED_FALLBACK)).toBe(spoken.message);
  });

  it("still replaces what a gateway or a parser wrote", () => {
    const parser = { message: "Unexpected token 'u', \"upstream error\" is not valid JSON" };
    expect(readableGatedFailure(parser, CONCEPT_FAILED_FALLBACK)).toBe(CONCEPT_FAILED_FALLBACK);
  });

  it("is used at BOTH flag-gated call sites, not just the one that found it", async () => {
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain("readableGatedFailure(error, CONCEPT_FAILED_FALLBACK)");
    const sheet = withoutProse(
      await readFile(new URL("../../pages/CastingSheet.tsx", import.meta.url), "utf8"),
    );
    /* Retry is behind CASTING_RETRY_SCOPE and is LIVE on his account today. */
    expect(sheet).toContain(`readableGatedFailure(error, "That tile didn't arrive again.`);
  });
});

/**
 * THE REVIEW STEP (#196) — his direction, driven at the source and at the copy.
 *
 * *"when you go to upload a concept image to be casted it opens in a popout
 * modal instead of putting it into the small prompt box?"* The words stop
 * landing in the brief box on arrival; they land beside the photograph and
 * reach the box on her confirm. Three things this suite must be able to catch,
 * because each of them is silent at the screen:
 *
 *   - the count growing a denominator (a second copy of a server cap that does
 *     not even govern the edited text — working law 4, and issue #27's class);
 *   - the review quietly becoming a REPLACE of what she typed (the append rule
 *     is founder record, and a review step deleting her sentence is the review
 *     step doing the thing it exists to prevent);
 *   - an abandoned read's answer arriving into the NEXT picture's modal, which
 *     puts a description under a photograph it was not read from — the exact
 *     mix-up the photo-beside-words view was adopted to make obvious.
 */
const REVIEW = new URL("./components/ConceptReviewModal.tsx", import.meta.url);
const SHELL = new URL("./components/CastingModal.tsx", import.meta.url);

describe("the count is a count, not a second copy of a server cap", () => {
  it("says how many characters and nothing about a ceiling", () => {
    expect(conceptCountLabel(184)).toBe("184 characters");
    expect(conceptCountLabel(0)).toBe("0 characters");
    /* Singular, because "1 characters" is the tell of a number formatted by nobody. */
    expect(conceptCountLabel(1)).toBe("1 character");
  });

  it("NEVER carries a denominator — the arm a 184 / 300 would fail", async () => {
    /*
      THE LOAD-BEARING NEGATIVE. `CONCEPT_DESCRIPTION_MAX` bounds what the
      DESCRIBER may return and had already done its work before these words
      appeared; after she edits them nothing refuses at 301, so a denominator
      here is a lie as well as a mirror. The only bound that governs the edited
      text is the roll entrance's, and the entrance speaks it itself.
    */
    for (const count of [0, 1, 184, 2999]) {
      const said = conceptCountLabel(count);
      /*
        The SHAPE is the assertion: a number and the word, nothing else. Every
        spelling a denominator could take — a slash, an "of 300", a remaining
        count, the cap itself — fails this before it needs an arm of its own.
      */
      expect(said).toMatch(/^\d+ characters?$/);
      expect(said).not.toContain("/");
      expect(said).not.toContain("max");
      expect(said).not.toContain("left");
    }
    /* And the describer's own bound is never spoken on this surface. */
    expect(conceptCountLabel(184)).not.toContain("300");
    /* And no client-side cap is typed on the field itself. */
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    expect(review).not.toContain("maxLength");
  });
});

describe("the review modal says what casts, and never promises a likeness", () => {
  it("keeps the one lie the road cannot afford out of every string it draws", () => {
    for (const line of [
      CONCEPT_REVIEW_TITLE,
      CONCEPT_REVIEW_EXPLAINER,
      CONCEPT_REVIEW_EYEBROW,
      CONCEPT_REVIEW_USE,
      CONCEPT_REVIEW_DISCARD,
    ]) {
      const said = line.toLowerCase();
      expect(said).not.toContain("likeness");
      expect(said).not.toContain("same face");
      expect(said).not.toContain("their face");
    }
  });

  it("tells her the WORDS cast and the picture is not kept — beside the picture", () => {
    const said = CONCEPT_REVIEW_EXPLAINER.toLowerCase();
    expect(said).toContain("words");
    expect(said).toContain("not");
    expect(said).toContain("kept");
    /* Her own instruction: edit anything. */
    expect(said).toContain("edit");
  });

  it("offers ONE primary action — a review, not a wizard", async () => {
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    expect(CONCEPT_REVIEW_USE).toBe("Use this brief");
    /* One primary button in the whole dialog, and no second page. */
    expect(review.split("dpc-signm__primary").length - 1).toBe(1);
    expect(review).not.toContain("Next");
  });
});

describe("the review is free to abandon, and abandons cleanly", () => {
  it("never latches the shell's busy — Esc works while the read is in flight", async () => {
    /*
      `CastingModal` blocks Esc while `busy`, which is right in front of a
      charge and wrong here: his order says nothing is charged either way, and
      the describer read is house money already spent when she picked the file.
    */
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    expect(review).toContain("busy={false}");
    /* `aria-busy={reading}` is legitimate and must not answer this question. */
    expect(review).not.toMatch(/(?<!aria-)busy=\{(reading|true)\}/);
  });

  it("creates the preview and revokes it in ONE effect, so every exit revokes", async () => {
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    expect(review).toContain("URL.createObjectURL(file)");
    /*
      The revoke is the effect's CLEANUP — not the confirm path, which would
      leak a handle for every abandoned upload.
    */
    const effect = review.slice(
      review.indexOf("URL.createObjectURL"),
      review.indexOf("}, [file]);"),
    );
    expect(effect).toContain("return () => {");
    expect(effect).toContain("URL.revokeObjectURL(url)");
  });

  it("goes through the shared shell rather than building a second scrim", async () => {
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    expect(review).toContain("<CastingModal");
    expect(review).not.toContain("createPortal");
    expect(withoutProse(await readFile(SHELL, "utf8"))).toContain("createPortal");
  });

  it("does not draw a confirm that would do nothing — the empty edit is disabled", async () => {
    /*
      Delete every character and `briefWithDescription` returns her existing
      brief unchanged, so the button would appear to do nothing (D-180's dead
      control). Proven at the merge rule as well as at the source, because that
      is WHY the disable exists.
    */
    expect(briefWithDescription("a dad in his 30s", "")).toBe("a dad in his 30s");
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    expect(review).toContain("const ready = text.trim().length > 0;");
    expect(review).toContain("disabled={reading || !ready}");
  });
});

describe("the words reach the box on her confirm, and never before", () => {
  it("opens on the PICK so the wait has a subject", async () => {
    const card = withoutProse(await readFile(CARD, "utf8"));
    const onChange = card.slice(
      card.indexOf("if (!file || reading) return;"),
      card.indexOf("void read(file, describe)"),
    );
    expect(onChange).toContain("setPicture(file);");
    expect(onChange).toContain("setDescription(null);");
  });

  it("hands the page its words only from the modal's confirm", async () => {
    const card = withoutProse(await readFile(CARD, "utf8"));
    /*
      THE ARM THAT WOULD CATCH THE OLD BEHAVIOUR SURVIVING. Before #196 the
      card called `onDescribed` with the door's answer directly; if that line
      came back the description would reach the brief box on arrival AND on the
      confirm — landing twice, which is the append rule turned into a duplicate.
    */
    expect(card).not.toContain("onDescribed(await door(imageBase64))");
    const onUse = card.slice(card.indexOf("onUse={"), card.indexOf("onDismiss={close}"));
    expect(onUse).toContain("onDescribed(words)");
  });

  it("cannot put an abandoned read's words under the next picture", async () => {
    /*
      Discard mid-read, pick another picture: without this guard the first
      call's answer arrives and fills the new modal — a description sitting
      under a photograph it was not read from, which is the mix-up this modal
      was adopted to make obvious. It is checked before the words are shown and
      before either failure speaks.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain("const mine = readId.current;");
    expect(card).toContain("readId.current += 1;");
    /*
      ⚠ THIS ARM WAS WRITTEN AS A BARE `toContain` FIRST AND ITS OWN SABOTAGE
      WALKED THROUGH IT: the guard appears on the success path AND on the
      failure path, so deleting the one that matters left the other behind and
      the string was still there. It is pinned to its POSITION now — immediately
      before the words are shown — and both occurrences are counted, because a
      guard that survives only where it is cheap is not the guard.
    */
    /*
      ⚠ PINNED BY POSITION AT EVERY EXIT, never by a COUNT. The count form said
      `toBe(2)` and went red the moment the review of #196 added the guard to
      the decode-failure path as well — a magic number pinning today's shape
      rather than the property, which is the arm getting in the way of the fix
      it should have been indifferent to. Each exit is named instead, so a new
      exit is caught by being unnamed and an extra guard is simply fine.
    */
    expect(card).toContain("if (readId.current !== mine) return;\n      setDescription(words);");
    expect(card).toContain(
      "if (readId.current !== mine) return;\n      close();\n      toast(CONCEPT_FILE_UNREADABLE);",
    );
    expect(card).toContain(
      "if (readId.current !== mine) return;\n      close();\n      toast(readableGatedFailure(",
    );
    /* And nothing may speak or land without one: every exit is on the list above. */
    expect(card.split("if (readId.current !== mine) return;").length - 1).toBe(
      card.split("toast(").length - 1 + 1,
    );
  });

  it("leaves the merge rule alone — the modal never replaces what she typed", async () => {
    const review = withoutProse(await readFile(REVIEW, "utf8"));
    const card = withoutProse(await readFile(CARD, "utf8"));
    /*
      The merge lives on the page, exactly where it did; neither of these
      decides where the words go.
    */
    expect(review).not.toContain("briefWithDescription");
    expect(card).not.toContain("briefWithDescription");
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toContain("briefWithDescription(current, description)");
  });
});

describe("walking away releases the card, rather than latching it to a dead call", () => {
  it("clears the reading flag in close(), not only when the abandoned call settles", async () => {
    /*
      THE GATE REVIEW OF #196's SECOND FINDING. `reading` disables the entry
      card and puts "Reading the picture…" on it, and it was cleared only in the
      promise's `finally` — so after Discard the card sat disabled, describing a
      picture she had just thrown away, for the rest of the abandoned call's
      life. Worse, the scenario `readId` exists for — discard, then immediately
      pick another picture — was UNREACHABLE, because the button was disabled
      and a re-entrant pick hits the `reading` early return.

      ⚠ This arm exists because the fix PASSED its own sabotage: removing
      `setReading(false)` from `close()` reddened nothing, so the repair was
      protected by no test at all until this one.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    const close = card.slice(card.indexOf("const close = () => {"), card.indexOf("const read = async"));
    expect(close).toContain("setReading(false);");
  });

  it("keeps the late settle from switching OFF a newer read", async () => {
    /*
      The other half: once `close()` clears the flag, an abandoned call's
      `finally` must not clear one a NEWER pick has since set, or the second
      read draws as idle while it is still running.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain("if (readId.current === mine) setReading(false);");
    expect(card).not.toContain(".finally(() => setReading(false));");
  });
});

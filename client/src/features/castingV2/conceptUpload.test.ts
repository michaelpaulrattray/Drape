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
  CONCEPT_CARD_DROP,
  CONCEPT_DROP_LINE,
  CONCEPT_NOT_A_PICTURE,
  CONCEPT_REVIEW_ANOTHER,
  CONCEPT_REVIEW_CAST,
  CONCEPT_REVIEW_EMPTY_EXPLAINER,
  CONCEPT_REVIEW_REFUSED_TITLE,
  CONCEPT_REVIEW_RETRY,
  briefWithDescription,
  conceptCountLabel,
} from "./conceptUpload";
import { ACCEPTED_PICTURE_FILES, firstPictureFrom } from "./pictureBytes";
import { BRIEF_TEXT_MIN } from "@shared/briefLength";
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
const REVIEW_SOURCE = new URL("./components/ConceptReviewModal.tsx", import.meta.url);
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
    /*
      ⚠ THE PICKER MOVED INTO THE DIALOG (#196, amendment 2) — a card that
      opened the OS file chooser on a tap could never open an EMPTY dialog with
      a drop zone in it, which is what his second entrance is. So the arm
      follows the control rather than staying pointed at the file it used to
      live in, which is how a derivation check quietly stops checking anything.
    */
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    expect(review).toContain("accept={ACCEPTED_PICTURE_FILES}");
    expect(review).not.toContain('accept="image/png');
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

  it("cannot start a second read behind its own dialog", async () => {
    /*
      ⚠ THE GUARD MOVED WITH THE ENTRANCES (#196, amendment 2). It used to be
      `if (!file || reading) return;` on the picker's change handler, which was
      the only way in. There are three ways in now — a drop on the card, a tap
      on the card, and a drop or a pick inside the dialog — so the property is
      no longer "the picker cannot re-fire": it is that the CARD is not a
      control at all while its dialog is up.

      Which is stronger, not weaker: the card is behind a scrim, and leaving it
      in the tab order gives the shell's focus trap somewhere to leak to.
    */
    const source = withoutProse(await readFile(CARD, "utf8"));
    expect(source).toContain("disabled={open}");
    /* And a drop that lands on it anyway is ignored rather than queued. */
    expect(source).toContain("if (open) return;");
    /*
      A read inside the dialog is allowed to supersede one already running —
      that is his "choose another picture" — and `readId` is what makes the
      first one's answer harmless. It is bumped by every entrance, because they
      all go through one road in.
    */
    expect(source).toContain("const beginRead = (file: File) => {");
    const begin = source.slice(source.indexOf("const beginRead = (file: File) => {"));
    expect(begin.slice(0, begin.indexOf("const onDragEnter"))).toContain("readId.current += 1;");
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
    /*
      SEARCH FORWARD FROM THE ANCHOR, NOT FROM THE TOP OF THE FILE. This slice
      used a bare `indexOf("focusBrief();")`, which found the FIRST caret call
      in the page — and the moment the hero deck gained one (#240) that call
      sat ABOVE `onDescribed={`, so the slice ran backwards and came back
      empty. An empty string satisfies both `not.toContain` arms here, so two
      of this test's three assertions would have passed on nothing.
    */
    const start = page.indexOf("onDescribed={");
    const onDescribed = page.slice(start, page.indexOf("focusBrief();", start));
    expect(onDescribed.length, "the slice must not be empty").toBeGreaterThan(20);
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
      door's real sentences ("I couldn't find anyone in that picture"), which
      is the exact defect `readableFailure` exists to prevent, inverted.
    */
    const spoken = {
      data: { code: "BAD_REQUEST" },
      message: "I couldn't find anyone in that picture — this reads people and creatures, not objects, places or things. Try one with someone in it.",
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
    expect(review.split("dpc-modal__primary").length - 1).toBe(1);
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
    /*
      ⚠ `description !== null` JOINED THE CONDITION with #196's amendments, and
      it is load-bearing rather than tidy. `reading` no longer covers every
      state in which there is nothing to act on: the dialog can now be OPEN with
      no picture at all (his second entrance) and can sit on a REFUSAL, and in
      both of those `text` is empty but `reading` is false. Keying on the words
      themselves answers all four states with one question.
    */
    expect(review).toContain("const ready = text.trim().length > 0 && description !== null;");
    /* Both ways on are disabled at zero — the free one and the paid one. */
    expect(review).toContain("disabled={!ready}");
    expect(review).toContain("disabled: !ready");
  });
});

describe("the words reach the box on her confirm, and never before", () => {
  it("opens on the FILE, not on the answer, so the wait has a subject", async () => {
    /*
      Several silent seconds after a drop or a file chooser reads as nothing
      having happened. The picture goes up first and the words fill in beside
      it. Read at `beginRead`, which is the one road in for all three entrances
      since #196's amendments — so this property cannot hold for the picker and
      quietly fail for the drop.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    const begin = card.slice(
      card.indexOf("const beginRead = (file: File) => {"),
      card.indexOf("void read(file, describe);"),
    );
    expect(begin).toContain("setOpen(true);");
    expect(begin).toContain("setPicture(file);");
    expect(begin).toContain("setDescription(null);");
    expect(begin).toContain("setFailure(null);");
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
      Cancel mid-read, drop another picture: without this guard the first call's
      answer arrives and fills the new modal — a description sitting under a
      photograph it was not read from, which is the mix-up this modal was
      adopted to make obvious. It is checked before the words are shown and
      before either failure speaks.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain("const mine = readId.current;");
    expect(card).toContain("readId.current += 1;");
    /*
      ⚠ PINNED BY POSITION AT EVERY EXIT, never by a COUNT of one shape. The
      count form said `toBe(2)` and went red the moment the review of #196 added
      the guard to the decode path as well — a magic number pinning today's
      shape rather than the property.

      ⚠ AND THE EXITS CHANGED SHAPE with his amendments: neither failure closes
      the dialog or raises a toast any more — each writes its sentence into the
      dialog she is looking at, so the SET-STATE is what must be guarded.
    */
    expect(card).toContain("if (readId.current !== mine) return;\n      setDescription(words);");
    expect(card).toContain(
      "if (readId.current !== mine) return;\n      setFailure(CONCEPT_FILE_UNREADABLE);",
    );
    expect(card).toContain(
      "if (readId.current !== mine) return;\n      setFailure(readableGatedFailure(",
    );
    /*
      And nothing may land without one: inside the read, every write a settling
      call performs is one of the three above, so the guards and the writes are
      counted against EACH OTHER rather than against a literal — a fourth exit
      added without a guard fails this before it needs an arm of its own.
    */
    const read = card.slice(card.indexOf("const read = async"), card.indexOf("const beginRead"));
    expect(read.split("if (readId.current !== mine) return;").length - 1).toBe(
      read.split(/set(?:Description|Failure)\(/).length - 1,
    );
    expect(read.split("if (readId.current !== mine) return;").length - 1).toBeGreaterThan(2);
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
  it("clears every piece of the read in close(), not only when the call settles", async () => {
    /*
      THE GATE REVIEW OF #196's SECOND FINDING, and it survives the amendments
      in a stronger form. `reading` used to be a flag cleared in the promise's
      `finally` — so after Discard the card sat disabled, describing a picture
      she had just thrown away, for the rest of the abandoned call's life.

      ⚠ THE FLAG IS GONE ENTIRELY NOW. `reading` is DERIVED from the picture and
      the two answers, all three of which `close()` resets in one place — so the
      class (a latch outliving the thing it describes) cannot be reintroduced by
      forgetting a line in a `finally`, because there is no `finally` and no
      second copy of the truth to forget. Working law 4 applied to a boolean.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    const close = card.slice(
      card.indexOf("const close = () => {"),
      card.indexOf("const read = async"),
    );
    expect(close).toContain("setOpen(false);");
    expect(close).toContain("setPicture(null);");
    expect(close).toContain("setDescription(null);");
    expect(close).toContain("setFailure(null);");
    /* The staleness counter is bumped first, so nothing in flight can speak after. */
    expect(close.indexOf("readId.current += 1;")).toBeLessThan(close.indexOf("setOpen(false);"));
  });

  it("has no reading flag left to go stale — it is read off the state", async () => {
    /*
      The other half of the old pair asserted that an abandoned call's `finally`
      must not clear a flag a NEWER read has since set. That arm is retired
      because its subject is: there is nothing to clear.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain(
      "const reading = picture !== null && description === null && failure === null;",
    );
    expect(card).not.toContain("setReading(");
    expect(card).not.toContain(".finally(");
  });
});

/**
 * HIS TWO AMENDMENTS (#196, both verbatim on the card, both filed before PR
 * #197 merged without them).
 *
 * > *"the button should be cast it and it automatically casts the prompt the
 * > same flow the original prompt and casting takes just through the modal"*
 *
 * > *"i want to be able to drag and drop the image into the upload concept card
 * > and it will auto open up the modal with the reference image in it
 * > alternatively i can click the card and it opens up the modal and then i can
 * > upload or drag and drop the reference image in - it gets analyzed - i read
 * > the brief decide whether to edit it and cast"*
 *
 * The things below are each silent at the screen, which is why they are here
 * rather than only in the evidence pack: a SECOND dispatch implementation looks
 * identical until the gear settings stop riding with it; a cast that composes
 * its own text rather than the merge looks identical until she has typed
 * something in the box first; and a drop target that forgets `preventDefault`
 * looks identical until the browser navigates the tab to the file and takes her
 * brief with it.
 */
describe("Cast it goes through the page's ONE roll flow", () => {
  it("dispatches from the page, never from the card or the dialog", async () => {
    /*
      THE LOAD-BEARING NEGATIVE. `createRoll` carries `imagination`, `style` and
      `path`, each of which travels only when its control was drawn — a second
      dispatch written inside the dialog would look right and quietly cast every
      concept at the wrong settings, which is working law 4 on the money path.
    */
    for (const url of [CARD, REVIEW_SOURCE]) {
      const source = withoutProse(await readFile(url, "utf8"));
      expect(source).not.toContain("createRoll");
      expect(source).not.toContain("createSession");
      expect(source).not.toContain("navigate(");
    }
    const page = withoutProse(await readFile(PAGE, "utf8"));
    /* One roll-starting function, and it takes its brief as an argument. */
    expect(page).toContain("const startCasting = async (briefText: string) => {");
    expect(page).toContain("briefText: briefText.trim(),");
    expect(page).not.toContain("briefText: brief.trim(),");
  });

  it("casts EXACTLY what 'Use this brief' would have put in the box", async () => {
    /*
      The two actions must never disagree about what her brief is, and the
      append rule is founder record (#185: the description lands beside her
      words, never on top of them) — so it governs the paid road as well as the
      free one. A cast that sent the description alone would silently delete
      anything she had typed, at the exact moment she is spending.
    */
    const page = withoutProse(await readFile(PAGE, "utf8"));
    const onCast = page.slice(page.indexOf("onCast={(description) => {"), page.indexOf("onDescribed={"));
    expect(onCast).toContain("briefWithDescription(brief, description)");
    expect(onCast).toContain("void startCasting(text);");
    /*
      `setBrief` FIRST — not the dispatch source (the argument is), but the
      safety net: the dialog has closed by then, so a refused session would
      otherwise take her edited words with it.
    */
    expect(onCast.indexOf("setBrief(text);")).toBeLessThan(onCast.indexOf("void startCasting(text);"));
    /* And the merged text is what BOTH roads use — proven at the rule itself. */
    expect(briefWithDescription("a skincare founder", "A man in his 40s.")).toBe(
      "a skincare founder\n\nA man in his 40s.",
    );
  });

  it("keeps the double-submit latch as the page's, so both entrances share one", async () => {
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toContain("castLatch.tryAcquire(null)");
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).not.toContain("tryAcquire");
    /*
      The dialog closes BEFORE the dispatch, so it is never the surface in front
      of a charge in flight — which is what lets it keep `busy={false}` and Esc
      working, and what keeps the page's latch the only one in the product.
    */
    const onCastProp = card.slice(card.indexOf("onCast={(words) => {"));
    expect(onCastProp.indexOf("close();")).toBeLessThan(onCastProp.indexOf("onCast(words);"));
  });

  it("puts the price ABOVE the button and never inside it — D-109", async () => {
    /*
      ⚠ THE CARD'S TEXT AND THE RATIFIED LAW DISAGREE, and the law wins on the
      half he did not say. His verbatim is *"the button should be cast it"*; the
      issue glosses it as *"with the price on it, per the paid-button law"*.
      D-109 names "Cast it" BY NAME as an immediate-fire action, rules that cost
      is metadata and never button text, and records that a price inside a
      confirm's button was tried and REVERSED the same day. So the number sits
      in the cost line directly above — she cannot tap without it in her eye.
    */
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    expect(CONCEPT_REVIEW_CAST).toBe("Cast it");
    expect(CONCEPT_REVIEW_CAST).not.toMatch(/\d/);
    expect(review).toContain("dpc-modal__cost");
    expect(review).toContain("{priceCredits} credits");
    /* The tilde, shared with every other cost line in the product. */
    expect(review).toContain("dpc-modal__tilde");
    /* Server-derived, never a constant on this side (D-15). */
    expect(review).not.toMatch(/priceCredits\s*=\s*\d/);
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toContain("priceCredits={price}");
    /* And nothing about a number inside the button itself. */
    const button = review.slice(review.indexOf('className="dpc-modal__primary"'));
    expect(button.slice(0, 300)).not.toContain("priceCredits");
    expect(button.slice(0, 300)).not.toMatch(/\d+\s*credits/);
  });

  it("still offers ONE primary in every state — a review, not a wizard", async () => {
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    expect(review.split("dpc-modal__primary").length - 1).toBe(1);
    /* Its label and its act are chosen once, so no state can draw two or none. */
    expect(review).toContain("const primary = empty");
    expect(review).toContain("disabled={primary.disabled}");
    expect(review).toContain("onClick={primary.act}");
    expect(review).not.toContain("Next");
  });
});

describe("two entrances, one read", () => {
  it("opens the dialog EMPTY on a tap — the entrance a file chooser could not be", async () => {
    /*
      His second amendment: *"i can click the card and it opens up the modal and
      then i can upload or drag and drop the reference image in"*. The card used
      to open the OS file chooser, which can only ever produce a dialog that
      already has a file — so the picker moved inside, and the dialog learned a
      state with no picture at all.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain("onClick={() => setOpen(true)}");
    expect(card).toContain("{open ? (");
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    expect(review).toContain("file: File | null;");
    expect(review).toContain("const empty = file === null;");
    /* The dialog's own drop and picker hand the files UP rather than judging them. */
    expect(review).toContain("onFiles(event.dataTransfer?.files ?? null);");
    expect(review).toContain("onFiles(files);");
    expect(review).toContain("notAPicture: boolean;");
    /* The drop zone stands in the picture's own slot, so nothing moves when one arrives. */
    expect(review).toContain("portraitFallback={");
    expect(review).toContain("dpc-modal__drop");
    /*
      ⚠ AND IT SAYS CANCEL, NOT DISCARD — the third state on this dialog caught
      saying something untrue about itself, and the same class as the refusal's
      heading. There is nothing to DISCARD before a picture exists; the word is
      earned only once there is something to throw away.
    */
    expect(review).toContain("{empty || reading ? CONCEPT_REVIEW_CANCEL : CONCEPT_REVIEW_DISCARD}");
  });

  it("reads a DROPPED picture straight away — the drop IS the upload", async () => {
    /*
      *"drag and drop the image into the upload concept card and it will auto
      open up the modal with the reference image in it"* — one gesture, no
      second confirm, and it lands on the same `beginRead` the picker does.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    const drop = card.slice(
      card.indexOf("const onDrop = (event:"),
      card.indexOf("if (!describe) {"),
    );
    expect(drop).toContain("offerFile(event.dataTransfer?.files ?? null)");
    /*
      ⚠ AND `offerFile` IS THE ONE JUDGEMENT FOR ALL THREE ENTRANCES. It was
      three: the card judged its own drop and the dialog judged its own two, and
      that split had a silent failure in it — a PDF dropped on the CARD opened
      the dialog with NOTHING SAID, because the sentence lived in the dialog's
      own state and could not know about a file the card had already rejected.
      One judgement, and a file that is not a picture always opens the dialog
      and says why.
    */
    const offer = card.slice(
      card.indexOf("const offerFile = (files: FileList | null) => {"),
      card.indexOf("const onDragEnter"),
    );
    expect(offer).toContain("firstPictureFrom(files)");
    expect(offer).toContain("beginRead(picture)");
    expect(offer).toContain("setNotAPicture(true);");
    expect(offer).toContain("setOpen(true);");
    /* Called in exactly one place in the whole feature. */
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    expect(review).not.toContain("firstPictureFrom");
    expect(card.split("firstPictureFrom(").length - 1).toBe(1);
  });

  it("SWALLOWS A DROP THE PAGE DID NOT CLAIM — or the browser eats her brief", async () => {
    /*
      THE HAZARD THIS BUILD ADDS, and the one worth an arm of its own. A file
      dropped anywhere the page has not claimed makes the browser NAVIGATE THE
      TAB TO IT — so a near-miss on the card replaces a 160-credit brief she has
      just typed with a JPEG in a viewer, and there is no undo. It is also the
      whole of his build note *"a drop anywhere else on the page does NOT
      trigger it (no accidental uploads)"*.

      And `preventDefault` on `dragover` is what MAKES an element a drop target
      — without it on the card, the window guard would swallow every drop and
      the card would look like a target while silently eating files.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain('window.addEventListener("dragover", swallow);');
    expect(card).toContain('window.addEventListener("drop", swallow);');
    expect(card).toContain('window.removeEventListener("dragover", swallow);');
    expect(card).toContain('window.removeEventListener("drop", swallow);');
    /*
      ⚠ FILES ONLY — the gate review of PR #199, finding 1, and it was a real
      regression for everyone inside the flag. A bare `preventDefault` here
      cancels EVERY drop on the page, so dragging selected TEXT into the brief
      textarea did nothing at all, silently, with no sentence anywhere. His build
      note is about FILES and so is the hazard.
    */
    const swallow = card.slice(
      card.indexOf("const swallow = (event: Event) => {"),
      card.indexOf('window.addEventListener("dragover", swallow);'),
    );
    expect(swallow).toContain('dataTransfer?.types?.includes("Files")');
    expect(swallow).toContain("return;");
    /* Mounted with the LIVE card only — an account outside the scope keeps the
       browser's own behaviour, which is the absent-or-live gate again. */
    const guard = card.slice(card.indexOf("useEffect(() => {"));
    expect(guard.slice(0, 200)).toContain("if (!describe) return;");
    /* Both the card and the dialog are real drop targets, not decorations. */
    for (const url of [CARD, REVIEW_SOURCE]) {
      const source = withoutProse(await readFile(url, "utf8"));
      /*
        ⚠ SLICED TO THE NEXT DECLARATION, NOT TO A CHARACTER COUNT — this arm
        WALKED THROUGH its own sabotage in the first form. Written as
        `over.slice(0, 300)`, the window ran past the end of `onDragOver` and
        into `onDrop`, which legitimately calls `preventDefault` — so deleting
        the one that MAKES the element a drop target reddened nothing. A window
        measured in characters is a window that grows into its neighbour.
      */
      /* Anchored on the NAME, not the parameter type: the card aliases React's
         DragEvent (its window listener takes the DOM one) and the dialog does
         not, so a type-bearing anchor reads one file and returns "" for the
         other — which is an empty slice quietly passing as a clean one. */
      const over = source.slice(
        source.indexOf("const onDragOver = (event:"),
        source.indexOf("const onDrop = (event:"),
      );
      expect(over).toContain("event.preventDefault();");
    }
  });

  it("counts drag depth, so the state does not flicker over its own children", async () => {
    /*
      `dragleave` fires every time the pointer crosses into a CHILD element — the
      icon, the title, the line — so a naive enter/leave pair strobes the drop
      state as the cursor moves across the target's own text. Both targets count.
    */
    for (const url of [CARD, REVIEW_SOURCE]) {
      const source = withoutProse(await readFile(url, "utf8"));
      expect(source).toContain("dragDepth.current += 1;");
      expect(source).toContain("dragDepth.current = Math.max(0, dragDepth.current - 1);");
      expect(source).toContain("if (dragDepth.current === 0) setDragging(false);");
    }
  });

  it("judges a dropped file in ONE place, and never turns away an unknown type", () => {
    /*
      Three entrances, one judgement — three copies of "is this a picture?" is
      working law 4 with a UI accent, and the copy that drifts is the one that
      silently refuses a customer's photograph.

      ⚠ AN EMPTY `type` IS ACCEPTED. A drop can arrive with the OS having told
      the browser nothing, and a client-side guess that turns away a valid PNG
      is strictly worse than passing it to a door that reads the BYTES and says
      something true. Only a file positively declaring itself something else is
      refused, which is the case worth catching before a multi-megabyte encode.
    */
    const asList = (files: File[]) =>
      ({
        ...files,
        length: files.length,
        item: (index: number) => files[index] ?? null,
      }) as unknown as FileList;
    const png = new File(["x"], "a.png", { type: "image/png" });
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    const unknown = new File(["x"], "a.png", { type: "" });
    expect(firstPictureFrom(asList([png]))).toBe(png);
    expect(firstPictureFrom(asList([unknown]))).toBe(unknown);
    expect(firstPictureFrom(asList([pdf]))).toBeNull();
    expect(firstPictureFrom(null)).toBeNull();
    expect(firstPictureFrom(asList([]))).toBeNull();
    /* The FIRST file, matching the picker — a multi-file drop is not a queue. */
    expect(firstPictureFrom(asList([png, pdf]))).toBe(png);
    /* Derived from the door's own vocabulary, so a fourth format needs no edit here. */
    for (const format of INK_DESIGN_FORMATS) {
      const file = new File(["x"], `a.${format}`, { type: inkDesignContentType(format) });
      expect(firstPictureFrom(asList([file]))).toBe(file);
    }
  });
});

describe("a refused read keeps her picture and offers a way on", () => {
  it("stays open with the door's own sentence — his 'plain retry inside the modal'", async () => {
    /*
      ⚠ THIS REVERSES WHAT PR #197 SHIPPED, on his newer and more specific word:
      *"a failed read gets a plain retry inside the modal, nothing charged"*.
      The shipped docblock argued an in-modal retry was the "extra options" his
      one-modal order rules out; closing the dialog instead threw her picture
      away, so recovering from a transport blip meant finding the file again.
    */
    const card = withoutProse(await readFile(CARD, "utf8"));
    expect(card).toContain("setFailure(readableGatedFailure(error, CONCEPT_FAILED_FALLBACK))");
    expect(card).toContain("setFailure(CONCEPT_FILE_UNREADABLE)");
    /* Neither failure closes the dialog or raises a toast any more. */
    expect(card).not.toContain("toast(");
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    expect(review).toContain("{failure}");
    expect(review).toContain("onRetry");
    /* The raw text is still moved to the console rather than lost. */
    expect(card).toContain("logRawFailure(");
  });

  it("offers TWO ways on, because the refusals mean different things", async () => {
    /*
      A gateway blip is worth the same picture again; *"I couldn't find anyone
      in that picture"* is deterministic, and a bare retry on the same file
      would spend house money to be told the same thing. So the wall gets an
      answer that can actually clear it.
    */
    expect(CONCEPT_REVIEW_RETRY).toBe("Try again");
    expect(CONCEPT_REVIEW_ANOTHER.toLowerCase()).toContain("another");
    /* The retry reads the SAME picture — through the one road in, so the
       staleness guard covers it exactly as it covers a first read. */
    const card = withoutProse(await readFile(CARD, "utf8"));
    const retry = card.slice(card.indexOf("onRetry={"));
    expect(retry.slice(0, 200)).toContain("beginRead(picture)");
  });

  it("does not claim words it does not have — the frame's own finding", async () => {
    /*
      ⚠ CAUGHT BY LOOKING, not by reading the source. The refusal shipped under
      *"This is what we'll cast"* with the read state's explainer above it —
      *"Edit anything. We cast from these words…"* — on a dialog holding no
      words at all, because nothing had been read. Two claims about a thing that
      does not exist, on the one surface whose job is saying what will be cast.
    */
    expect(CONCEPT_REVIEW_REFUSED_TITLE.toLowerCase()).not.toContain("cast");
    expect(CONCEPT_REVIEW_REFUSED_TITLE.toLowerCase()).toContain("read");
    const review = withoutProse(await readFile(REVIEW_SOURCE, "utf8"));
    /*
      ⚠ SLICED TO THE HEADING, because a bare `toContain` walked through its own
      sabotage: the accessible name branches on the same constant, so breaking
      the H2 left the string in the file and the arm passed. Two places say this
      and BOTH are asserted, each in its own slice.
    */
    const heading = review.slice(
      review.indexOf('<h2 className="dpc-modal__title">'),
      review.indexOf("</h2>"),
    );
    expect(heading).toContain("CONCEPT_REVIEW_REFUSED_TITLE");
    expect(heading).toContain("CONCEPT_REVIEW_EMPTY_TITLE");
    /* The explainer is ABSENT in that state rather than reworded. */
    expect(review).toContain("{refused ? null : (");
    /* And the accessible name follows the heading rather than staying behind. */
    const label = review.slice(review.indexOf("label={"), review.indexOf("portrait={preview}"));
    expect(label).toContain("CONCEPT_REVIEW_REFUSED_TITLE");
  });

  it("SPEAKS when the merged brief is too short, rather than closing on nothing", async () => {
    /*
      ⚠ THE GATE REVIEW OF PR #199, FINDING 2, repaired as the CLASS. The lobby's
      dispatch gate was a silent `return` under three characters — survivable
      while the only way to reach it was the hero button beside a nearly-empty
      box, and D-180's dead control the moment #196's modal made it reachable
      from behind a PRICE.

      Aligning the DIALOG's own threshold would have been cheaper and wrong:
      what the entrance refuses is the MERGED text, which the dialog cannot see,
      so it would have had to be told how long her existing brief is — page
      state leaking into a presentational component to answer a question the
      page already knows.
    */
    expect(BRIEF_TEXT_MIN).toBe(3);
    const page = withoutProse(await readFile(PAGE, "utf8"));
    expect(page).toContain("if (briefText.trim().length < BRIEF_TEXT_MIN) {");
    expect(page).toContain("toast(BRIEF_TOO_SHORT_MESSAGE);");
    /* Never a second wording of one rule: the compiler throws THIS sentence. */
    const compiler = withoutProse(
      await readFile(new URL("../../../../server/castingV2/briefCompiler.ts", import.meta.url), "utf8"),
    );
    expect(compiler).toContain('throw new BriefRefusal("uninterpretable", BRIEF_TOO_SHORT_MESSAGE);');
    expect(compiler).not.toContain("briefText.length < 3");
    expect(compiler).not.toContain("That brief is too short to cast from.");
    /* And the number is not re-typed on either side. */
    expect(page).not.toContain("trim().length < 3");
  });

  it("names the formats when a file is not a picture, rather than the refusal", () => {
    /* "Unsupported file type" says what happened and not what to do. */
    const said = CONCEPT_NOT_A_PICTURE.toLowerCase();
    expect(said).toContain("png");
    expect(said).toContain("jpeg");
    expect(said).toContain("webp");
    expect(said).not.toContain("error");
    expect(said).not.toContain("invalid");
  });

  it("says the drag-over line on the card, so the drop target is discoverable", () => {
    expect(CONCEPT_CARD_DROP.toLowerCase()).toContain("drop");
    expect(CONCEPT_DROP_LINE.toLowerCase()).toContain("drop");
    /* The empty state carries the same two facts the card's line does, because
       a customer can arrive here without having read the card at all. */
    const empty = CONCEPT_REVIEW_EMPTY_EXPLAINER.toLowerCase();
    expect(empty).toContain("similar");
    expect(empty).toContain("never keep");
    expect(empty).not.toContain("likeness");
  });
});

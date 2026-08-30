import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The three casting dialogs, against their specs.
 *
 * Sign and delete SHARE one shell — two copies of a scrim is two chances for
 * one of them to be mounted in the wrong place. Rename deliberately does not:
 * weight tracks stakes, and a rename is a text edit.
 */

const SHELL = new URL("./components/CastingModal.tsx", import.meta.url);
const SIGN = new URL("./components/SignConfirm.tsx", import.meta.url);
const DELETE = new URL("./components/DeleteCastConfirm.tsx", import.meta.url);
const RENAME = new URL("./components/RenameCastDialog.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

describe("sign and delete share one shell", () => {
  it("both render through it rather than rebuilding a scrim", async () => {
    for (const url of [SIGN, DELETE]) {
      expect(await readFile(url, "utf8")).toContain("<CastingModal");
    }
    // And the shell is the only thing that portals for those two.
    for (const url of [SIGN, DELETE]) {
      expect(await readFile(url, "utf8")).not.toContain("createPortal");
    }
    expect(await readFile(SHELL, "utf8")).toContain("createPortal");
  });

  it("portals to the body, which is what makes the scrim the viewport", async () => {
    /*
      Any ancestor with `backdrop-filter`, `filter`, `transform`, `perspective`
      or `will-change` becomes a containing block, and `inset: 0` then resolves
      against IT. The sheet's dock has `backdrop-filter` — a dialog mounted
      inside it renders as an off-screen sliver.
    */
    const shell = await readFile(SHELL, "utf8");
    expect(shell).toContain("document.body");
    const css = await readFile(CSS, "utf8");
    const scrim = css.slice(css.indexOf(".dpc-modal {"), css.indexOf("@keyframes dpc-modal-fade"));
    expect(scrim).toContain("position: fixed");
    expect(scrim).toContain("inset: 0");
  });
});

describe("the delete dialog never borrows the commit treatment", () => {
  it("arms into the danger zone rather than into ink or solid coral", async () => {
    /*
      Solid `--ink` is the system's "yes, proceed" — the same fill as Sign to
      your roster — and a destructive action must not look identical to a
      constructive one. Solid coral is worse: it already means KEPT on a
      candidate card.
    */
    const css = await readFile(CSS, "utf8");
    const danger = css.slice(css.indexOf(".dpc-modal__danger {"), css.indexOf(".dpc-modal__danger:focus-visible"));
    expect(danger).toContain("background: var(--fill)");
    expect(danger).toContain("color: var(--muted)");
    expect(danger).toContain("cursor: not-allowed");
    expect(danger).toContain("border-color: var(--accentLine)");
    expect(danger).toContain("background: var(--accentWash)");
    expect(danger).not.toContain("background: var(--ink)");
    expect(danger).not.toContain("background: var(--accentSolid)");
  });

  it("desaturates the portrait, carries the warning in the eyebrow, drops the arrow", async () => {
    const del = await readFile(DELETE, "utf8");
    expect(del).toContain("portraitMuted");
    expect(del).toContain("PERMANENT · NOT REFUNDABLE");
    // The arrow means "forward, proceed" and is wrong on a destructive action.
    expect(del).not.toContain("ArrowRight");

    const css = await readFile(CSS, "utf8");
    expect(css).toContain("filter: grayscale(1)");
    expect(css).toContain("opacity: 0.62");
    expect(css).toContain(".dpc-modal__eyebrow--danger { color: var(--accentInk); }");
  });

  it("branches its copy on signed state", async () => {
    // Warning an unsigned draft about non-refundable credits is simply false —
    // nothing was spent.
    const del = await readFile(DELETE, "utf8");
    expect(del).toContain("An unsigned draft");
    expect(del).toContain("signed?: boolean");
  });

  it("matches on the first name, case-insensitively", async () => {
    // Exact-case full names are friction without safety, and they carry
    // trailing initials nobody will guess the punctuation of.
    const del = await readFile(DELETE, "utf8");
    expect(del).toContain("firstNameOf");
    expect(del).toContain(".toLowerCase()");
    // The same first name in title, field label and Keep button.
    expect(del).toContain("Delete {first}?");
    expect(del).toContain("TYPE {first.toUpperCase()}");
    expect(del).toContain("Keep {first}");
  });
});

describe("the rename dialog", () => {
  it("HAS A FIELD — the defect that replaced it", async () => {
    /*
      The old dialog said "Rename this cast?" and offered Save name with
      nothing to type into. Whatever the styling, that was the defect: the one
      control it existed for was missing.
    */
    const rename = await readFile(RENAME, "utf8");
    expect(rename).toContain("<input");
    expect(rename).toContain("value={name}");
    // Prefilled AND selected, so typing replaces rather than appends.
    expect(rename).toContain("inputRef.current?.select()");
  });

  it("is lighter than its siblings, and stays that way", async () => {
    const css = await readFile(CSS, "utf8");
    const card = css.slice(css.indexOf(".dpc-renamem {"), css.indexOf(".dpc-renamem__head"));
    expect(card).toContain("max-width: 428px");
    // Against the shared shell's 664.
    expect(css).toContain("max-width: 664px");
  });

  it("commits in ink, never red, and never on a no-op", async () => {
    const css = await readFile(CSS, "utf8");
    const primary = css.slice(
      css.indexOf(".dpc-renamem__primary {"),
      css.indexOf(".dpc-renamem__secondary:focus-visible"),
    );
    expect(primary).toContain("background: var(--ink)");
    expect(primary).not.toContain("--accentSolid");
    expect(primary).toContain("cursor: not-allowed");

    const rename = await readFile(RENAME, "utf8");
    // Inert while empty OR unchanged — the most common accidental use.
    expect(rename).toContain("trimmed !== currentName.trim()");
  });

  it("puts the helper below the field", async () => {
    // Reassurance, not instruction: it must not stand between the user and the
    // control they opened the dialog for.
    const rename = await readFile(RENAME, "utf8");
    expect(rename.indexOf("dpc-modal__field")).toBeLessThan(rename.indexOf("dpc-renamem__helper"));
  });

  it("gives the actions air, and does not double it where a cost line already does", async () => {
    /*
      The delete dialog has no cost line between its field and its buttons, so
      without a margin the actions butt straight against the type row and read
      as part of the field rather than as the decision being made. The sign
      modal DOES have one, and stacking both would open a gap there.
    */
    const css = await readFile(CSS, "utf8");
    const actions = css.slice(
      css.indexOf(".dpc-modal__actions {"),
      css.indexOf(".dpc-modal__secondary"),
    );
    expect(actions).toContain("margin-top: 18px");
    expect(css).toContain(".dpc-modal__cost + .dpc-modal__actions { margin-top: 0; }");
  });
});

/**
 * THE THIRD CONSUMER (#196) — the concept review, which neither spends nor
 * destroys.
 *
 * The shell's docblock described itself as "built for spending and destroying"
 * and the `busy` latch is written to that: it blocks Esc, because walking out
 * of a charge mid-flight is worse than waiting. A free review is the opposite
 * case and his order says so — *abandons cleanly, nothing charged either way*.
 * So the two arms below are the ones that would catch this dialog quietly
 * acquiring a dialog-for-spending's manners, and the one that would catch the
 * focus trap failing in the only dialog with something worth typing in.
 */
const REVIEW = new URL("./components/ConceptReviewModal.tsx", import.meta.url);

describe("the concept review shares the shell without inheriting its latch", () => {
  it("renders through the shell rather than building a third scrim", async () => {
    expect(await readFile(REVIEW, "utf8")).toContain("<CastingModal");
    expect(await readFile(REVIEW, "utf8")).not.toContain("createPortal");
  });

  it("never goes busy, so Esc is always a way out", async () => {
    const review = await readFile(REVIEW, "utf8");
    expect(review).toContain("busy={false}");
    /* `aria-busy={reading}` is legitimate and must not answer this question. */
    expect(review).not.toMatch(/(?<!aria-)busy=\{(reading|true)\}/);
  });

  it("KEEPS TEXTAREA IN THE FOCUS TRAP — the arm the widening exists for", async () => {
    /*
      The trap queried `"button, input"`. The concept review's whole body is a
      textarea: leave it out and Tab walks straight out of the field she is
      editing into the page behind the scrim — the trap failing in the one
      dialog that has something worth typing in, and silently, because every
      other consumer's field is an `input`.
    */
    const shell = await readFile(SHELL, "utf8");
    expect(shell).toContain("textarea:not(:disabled)");
    const review = await readFile(REVIEW, "utf8");
    expect(review).toContain("<textarea");
  });

  it("dresses the textarea in the house field rather than a new box", async () => {
    /*
      Same wrapper, same focus treatment: the box is drawn by the wrapper and
      the control inside it is bare (the foundation law), which is why the
      focus rules had to learn `textarea` alongside `input` — a rule scoped to
      one of them leaves the browser's own ring drawing inside the other.
    */
    const review = await readFile(REVIEW, "utf8");
    expect(review).toContain('className="dpc-modal__field"');
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-modal__field textarea:focus-visible { outline: none; box-shadow: none; }");
    const field = css.slice(
      css.indexOf(".dpc-modal__field textarea {"),
      css.indexOf(".dpc-modal__field textarea::placeholder"),
    );
    /* No drag handle: it could push the body past the portrait it sits beside. */
    expect(field).toContain("resize: none");
  });
});

describe("the concept review shows the WHOLE picture she chose", () => {
  it("asks for it, rather than inheriting the crop our own renders can take", async () => {
    /*
      The other two consumers show OUR renders, every one of them already 4:5.
      This one shows a picture the CUSTOMER chose, of unknown proportions, and
      its whole job is letting her check a description against it — a crop can
      remove the very thing the words describe.
    */
    expect(await readFile(REVIEW, "utf8")).toContain("portraitWhole");
    expect(await readFile(SHELL, "utf8")).toContain("dpc-modal__portrait--whole");
  });

  it("styles it as a DESCENDANT, because a child selector is inert here", async () => {
    /*
      ⚠ THE FINDING THIS ARM EXISTS FOR, measured at the running app rather than
      read: `CastingModal` wraps the image in a `<span>`, so `.dpc-modal__portrait
      > img` matches NOTHING — the sign and delete portraits are sized by the
      browser and clipped by `overflow: hidden` instead. Written the same way,
      this rule computed `object-fit: fill` (the initial value) and looked
      exactly as though it had worked. A future tidy-up that "consistently"
      restores the child combinator here would put it back to inert, silently.
    */
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-modal__portrait--whole img {");
    expect(css).not.toContain(".dpc-modal__portrait--whole > img");
  });
});

/*
  ⚠ THE ISSUE NUMBER STAYS IN THIS COMMENT AND OUT OF THE `describe` STRING.
  These arms close issue 198, and writing that as `(#198)` in the title fails
  `foundation/token-guard.test.ts`: its comment-stripper deliberately spares
  prose, but a title is a STRING LITERAL, and every three-digit issue number is
  a valid three-digit hex colour. The guard is right about the shape and wrong
  about the intent, and its message names tokens.css rather than the trap.
*/
describe("all three portraits lay out by ONE mechanism", () => {
  /** The declarations of one rule, by its selector, so an arm reads the rule and not the file. */
  const block = (css: string, selector: string): string => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at, `no rule for \`${selector}\``).toBeGreaterThan(-1);
    const open = css.indexOf("{", at);
    const close = css.indexOf("}", open);
    expect(close, `unterminated rule for \`${selector}\``).toBeGreaterThan(open);
    return css.slice(open + 1, close);
  };

  it("the base portrait rule is a DESCENDANT, so it matches at all", async () => {
    /*
      ⚠ THE DEFECT THIS ARM EXISTS FOR (#198), measured at the running app: the
      rule was written as `.dpc-modal__portrait > img` and `CastingModal` puts a
      `<span>` between the two, so it matched NOTHING from the day it was
      written. The image computed `object-fit: fill` — the initial value — laid
      out at its own size and was clipped by `overflow: hidden`. On our own 2:3
      renders that looks exactly like the rule working, which is why it survived.
    */
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-modal__portrait img {");
    expect(css).not.toContain(".dpc-modal__portrait > img");
  });

  it("anchors the base crop to the TOP, which is what makes the repair free", async () => {
    /*
      Cover-with-default-centre is the tempting repair and it slides the crop
      window ~27px down — the face moves, which is the founder's eye and not a
      tidy-up's to spend. Anchored top, the window is the one the browser was
      already clipping to for any image at least as tall as the 4:5 slot, which
      is every render this product makes.
    */
    const css = await readFile(CSS, "utf8");
    const base = block(css, ".dpc-modal__portrait img");
    expect(base).toContain("object-fit: cover");
    expect(base).toContain("object-position: top");
  });

  it("⚠ both neighbours RE-STATE object-position, and the two values are his ruling", async () => {
    /*
      THE ARM THAT MATTERS, and its subject is the RE-STATEMENT rather than any
      one value. The cascade resolves each property independently: `--whole` and
      `__muted` come later and win `object-fit` on order, but where they declare
      no `object-position` the base rule — which matches the same element — is
      the winning declaration, and its `top` applies. Deleting either declaration
      is silent at the source and visible only in a frame nobody re-opens.

      Cascade fallthrough, NOT inheritance — `object-position` is not an
      inherited property and no parent's value is being read. The distinction
      decides where a future reader looks when this breaks (review of #198).

      ⚠ THE TWO VALUES NOW DIFFER, AND SO DOES WHAT THIS ARM BUYS FOR EACH.

      `--whole` is `center` for the concept review's own reason: it letterboxes a
      customer's picture of unknown proportions, and `top` would hang the
      letterbox entirely below it. That hazard is LIVE — delete the declaration
      and the next frame is visibly wrong.

      `__muted` is `top` on the founder's word (Crew reply #27, 2026-08-29:
      *"left and middle should match. Top crop on both. Don't ship the right
      panel."*), which is the same value the base rule carries. So for THIS
      selector the hazard is now LATENT: deleting the line changes nothing today
      and changes the delete dialog silently the day the base rule moves. Said
      out loud because an arm that implies both cases bite is an arm whose reason
      a future reader cannot check.
    */
    const css = await readFile(CSS, "utf8");
    expect(block(css, ".dpc-modal__portrait--whole img")).toContain("object-position: center");
    expect(block(css, ".dpc-modal__muted > img")).toContain("object-position: top");
  });

  it("and the base rule is declared BEFORE both, which is what that guard assumes", async () => {
    /*
      The guard above is about cascade ORDER, so it is only true while the base
      rule comes first. Move it below its neighbours and they would win
      `object-position` without declaring it — the arm would still pass and the
      reason it was written would be gone.
    */
    const css = await readFile(CSS, "utf8");
    const base = css.indexOf("\n.dpc-modal__portrait img {");
    /* Or an absent base rule is index -1 and every neighbour "comes after" it. */
    expect(base, "no base portrait rule to order against").toBeGreaterThan(-1);
    for (const selector of [".dpc-modal__portrait--whole img", ".dpc-modal__muted > img"]) {
      expect(css.indexOf(`\n${selector} {`), selector).toBeGreaterThan(base);
    }
  });
});

describe("the trap holds in the state where every end of the list is disabled", () => {
  it("excludes disabled elements, or the wrap can never fire", async () => {
    /*
      ⚠ THE REVIEW OF #196's FIRST FINDING. The wrap only fires when the active
      element is the FIRST or LAST of the list — so a list whose ends are
      DISABLED can never match it, the trap never engages, and Tab falls through
      to the browser default, which skips disabled elements and leaves the card.

      This is not an edge case: it is the concept review's OPENING state on
      every single use — `[textarea disabled, Discard, primary disabled]` for
      the ~9 s of the read — and Enter behind an open scrim reaches a live
      control, because a scrim stops clicks and not keys.
    */
    const shell = await readFile(SHELL, "utf8");
    expect(shell).toContain("button:not(:disabled)");
    expect(shell).toContain("input:not(:disabled)");
    expect(shell).toContain("textarea:not(:disabled)");
    /* The bare list is what shipped and what the review caught. */
    expect(shell).not.toContain('querySelectorAll<HTMLElement>("button, input, textarea")');
  });

  it("⚠ AND DROPS MATCHES THAT CANNOT TAKE FOCUS — the third finding on one selector", async () => {
    /*
      #196's amendments put a `<input type="file">` styled `display: none`
      inside the dialog, so the picker could live where the empty state needs
      it. It matches `input:not(:disabled)` and CANNOT be focused: `.focus()` on
      an unrendered element is a no-op, so the wrap fired, moved nothing, and
      left focus frozen on whichever control it started from.

      The trap still "held" — Tab never left the dialog — which is exactly why
      the walk that asks only *did focus escape* passed it. It was caught by
      reading what that walk PRINTED: `dpc-modal__primary` five times, never the
      field beside it. Same selector, third time: disabled ends, focus outside
      the card, and now matched-but-unrendered.

      `getClientRects()` rather than `offsetParent`, which is null for a fixed
      or transformed element that is perfectly focusable.
    */
    const shell = await readFile(SHELL, "utf8");
    expect(shell).toContain("element.getClientRects().length > 0");
    const list = shell.slice(
      shell.indexOf("const focusable = Array.from("),
      shell.indexOf("if (focusable.length === 0)"),
    );
    expect(list).toContain(".filter(");
    /* And the review really does put an unrendered input inside the card. */
    const review = await readFile(REVIEW, "utf8");
    expect(review).toContain('type="file"');
    expect(review).toContain('className="dpc-entry__file"');
    const css = await readFile(CSS, "utf8");
    const picker = css.slice(css.indexOf(".dpc-entry__file {"));
    expect(picker.slice(0, 60)).toContain("display: none;");
  });

  it("SWALLOWS Tab when nothing inside can take focus — the class, not the instance", async () => {
    /*
      A dialog whose every control is disabled has the same escape, and it
      pre-existed this PR: a sign or a delete mid-commit (`busy`) disables all
      of its controls while also refusing Esc and the scrim, so returning early
      would hand Tab back to the browser at exactly the moment the dialog is
      refusing to be dismissed. Preventing the default keeps focus where it is,
      which is what a modal means.
    */
    const shell = await readFile(SHELL, "utf8");
    const empty = shell.slice(
      shell.indexOf("if (focusable.length === 0)"),
      shell.indexOf("const first = focusable[0]"),
    );
    expect(empty).toContain("event.preventDefault();");
    expect(empty).toContain("return;");
  });
});

describe("focus is INSIDE the card, which is what the trap has always assumed", () => {
  it("the concept review takes focus on mount, like every other dialog here", async () => {
    /*
      ⚠ THE SECOND REVIEW OF #196, and it is the sharper half of the first
      finding. The trap only ever acts once focus is inside the card — and this
      modal's opener DISABLES itself on the pick, so the browser drops focus to
      `body` before the dialog mounts. Every other dialog in the feature focuses
      something on mount (`ConfirmDialog` focuses its cancel, and sign, delete,
      rename and the viewer all do the same), so the shell has always leaned on
      a precondition none of them wrote down; this was the first consumer that
      did not meet it.

      DISCARD and not the field: the textarea is disabled for the whole read,
      which is exactly the window that matters, and Discard is the safe option.
    */
    const review = await readFile(REVIEW, "utf8");
    /*
      ⚠ The ref is named for its POSITION rather than for its label since #196's
      amendments — the first action's word is "Cancel" while the read runs and
      "Discard" once it has finished, and a ref called `discardRef` pointing at
      a button that says Cancel is the name outliving the thing.
    */
    expect(review).toContain("firstAction.current?.focus();");
    expect(review).toContain("ref={firstAction}");
    /* On mount, once — not keyed on the read arriving. */
    expect(review).toMatch(/firstAction\.current\?\.focus\(\);\s*\n\s*\}, \[\]\);/);
    /*
      AND IT IS THE FIRST BUTTON IN THE ROW, which is what makes it reachable in
      the EMPTY state his second amendment added: a dialog opened by a tap has no
      picture, no field and no words, so the only focusable things in it are the
      way out and the picker — and the trap's own wrap needs one of them to hold
      focus before Tab can be caught at all.
    */
    const actions = review.slice(review.indexOf('className="dpc-modal__actions"'));
    expect(actions.indexOf("ref={firstAction}")).toBeGreaterThan(0);
    expect(actions.indexOf("ref={firstAction}")).toBeLessThan(
      actions.indexOf('className="dpc-modal__primary"'),
    );
  });

  it("and the SHELL pulls focus back in for any consumer that forgets — the sweep", async () => {
    /*
      The instance is the mount-focus above; this is the class. With focus
      outside the card and the focusable list non-empty, neither wrap branch can
      match, so Tab fell through to the browser and into the page behind the
      scrim. Driven at the running app both ways, during the read:

        pre-fix   BODY → INPUT.dp-input → BUTTON.dp-scopepill → …   (escaped)
        fixed     Discard → Discard → Discard → Discard            (held)

      With the mount-focus removed but this guard in place, the dialog opens on
      `body` and the FIRST Tab brings focus back to Discard — so the two halves
      are independent, and that is deliberate: the next consumer to forget its
      mount-focus is covered by the shell rather than by memory.
    */
    const shell = await readFile(SHELL, "utf8");
    expect(shell).toContain("!cardRef.current.contains(document.activeElement)");
    const guard = shell.slice(
      shell.indexOf("!cardRef.current.contains(document.activeElement)"),
      shell.indexOf("const first = focusable[0]"),
    );
    expect(guard).toContain("event.preventDefault();");
    expect(guard).toContain("focusable[0].focus();");
  });
});

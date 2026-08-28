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
    const scrim = css.slice(css.indexOf(".dpc-signm {"), css.indexOf("@keyframes dpc-signm-fade"));
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
    const danger = css.slice(css.indexOf(".dpc-signm__danger {"), css.indexOf(".dpc-signm__danger:focus-visible"));
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
    expect(css).toContain(".dpc-signm__eyebrow--danger { color: var(--accentInk); }");
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
    expect(rename.indexOf("dpc-signm__field")).toBeLessThan(rename.indexOf("dpc-renamem__helper"));
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
      css.indexOf(".dpc-signm__actions {"),
      css.indexOf(".dpc-signm__secondary"),
    );
    expect(actions).toContain("margin-top: 18px");
    expect(css).toContain(".dpc-signm__cost + .dpc-signm__actions { margin-top: 0; }");
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
    expect(shell).toContain('querySelectorAll<HTMLElement>("button, input, textarea")');
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
    expect(review).toContain('className="dpc-signm__field"');
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-signm__field textarea:focus-visible { outline: none; box-shadow: none; }");
    const field = css.slice(
      css.indexOf(".dpc-signm__field textarea {"),
      css.indexOf(".dpc-signm__field textarea::placeholder"),
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
    expect(await readFile(SHELL, "utf8")).toContain("dpc-signm__portrait--whole");
  });

  it("styles it as a DESCENDANT, because a child selector is inert here", async () => {
    /*
      ⚠ THE FINDING THIS ARM EXISTS FOR, measured at the running app rather than
      read: `CastingModal` wraps the image in a `<span>`, so `.dpc-signm__portrait
      > img` matches NOTHING — the sign and delete portraits are sized by the
      browser and clipped by `overflow: hidden` instead. Written the same way,
      this rule computed `object-fit: fill` (the initial value) and looked
      exactly as though it had worked. A future tidy-up that "consistently"
      restores the child combinator here would put it back to inert, silently.
    */
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-signm__portrait--whole img {");
    expect(css).not.toContain(".dpc-signm__portrait--whole > img");
  });
});

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
});

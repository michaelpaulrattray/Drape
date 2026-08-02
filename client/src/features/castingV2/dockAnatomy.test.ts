import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The sheet dock's anatomy and its SELECTION GRAMMAR.
 *
 * D-101's fourth gate, applied to the surface where money is committed. The
 * defect it pins is not a missing module this time but a *grammar* one: the
 * dock briefly carried its own cluster of kept thumbs beside the Sign button,
 * and a cluster next to "Sign 3 to roster" reads as signing three people. The
 * ceremony was always single (F2); the interface said otherwise, which is its
 * own kind of untruth.
 *
 * So the assertions here are about what the dock may NOT say as much as what it
 * must contain.
 */

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const TRAY = new URL("./components/KeptTray.tsx", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

describe("the sheet dock commits to one candidate", () => {
  it("names no count on the Sign button", async () => {
    const source = await readFile(SHEET, "utf8");
    /*
      "Sign 3 to roster" and "Sign 04 to roster" are both wrong, for different
      reasons: the first claims a ceremony that does not exist, the second makes
      the button say what the selection ring already says. The label is fixed
      and the price is server-derived (D-15).
    */
    expect(source).toContain("Sign to roster");
    expect(source).not.toMatch(/Sign \$\{[^}]*indexLabel[^}]*\} to roster/);
    expect(source).not.toMatch(/Sign \$\{[^}]*length[^}]*\} to roster/);
  });

  it("puts no price on the Sign button — the confirm is the commitment", async () => {
    /*
      SUPERSEDED BY D-109, deliberately inverted. This used to require a price
      ON the button; the doctrine now forbids one there.

      Sign is ceremony-gated: the confirm is where the commitment happens, it
      already states the full price and what it includes, and that is where
      D-15's letter is satisfied. A price on the button as well is the clutter
      three pricing iterations were spent removing.
    */
    const sheet = await readFile(SHEET, "utf8");
    const index = sheet.indexOf("Sign to roster");
    expect(index).toBeGreaterThan(0);
    const button = sheet.slice(index - 40, index + 60);
    expect(button).not.toContain("signPrice");
    expect(button).not.toMatch(/\d+\s*(cr|credits)/);

    /*
      And the confirm keeps its explicit number — but ABOVE the button, not
      inside it. D-109 said cost is metadata and never button text, then carved
      out confirms as an exception; the exception was wrong. The number stays
      because this is the commitment point; it is still metadata.
    */
    const confirm = await readFile(
      new URL("./components/SignConfirm.tsx", import.meta.url),
      "utf8",
    );
    expect(confirm).toContain("dpc-signm__cost");
    expect(confirm).toContain("{priceCredits} credits");
    // Approximate, and the tilde stays — generation cost varies, and a number
    // presented as exact that then differs is worse than one that never
    // claimed to be.
    expect(confirm).toContain("dpc-signm__tilde");
    // Never on the button itself.
    const signButton = confirm.slice(confirm.indexOf('className="dpc-signm__primary"'));
    expect(signButton.slice(0, 300)).not.toContain("priceCredits");
  });

  it("states an immediate-fire cost once, as metadata", async () => {
    /*
      D-109's other half. Roll again and Follow are immediate-fire, so the
      buttons go clean and the cost lives once in the adjacent meta line —
      right-aligned, muted, mono, with the balance because THIS action repeats.
    */
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("dpc-dock__cost");
    expect(sheet).toContain("credits");
    expect(sheet).toContain("left");
    // No price on any immediate-fire button.
    expect(sheet).not.toMatch(/Roll again[^"`]*\d+\s*(cr|credits)/);

    const css = await readFile(CSS, "utf8");
    const cost = css.slice(css.indexOf(".dpc-dock__cost,"), css.indexOf(".dpc-dock__cost {"));
    expect(cost).toContain("var(--font-mono)");
    expect(cost).toContain("var(--meta)");
  });

  it("keeps the thumb cluster out of the dock", async () => {
    const source = await readFile(SHEET, "utf8");
    // The cluster's own classes must not exist anywhere: selection lives on the
    // tray, and a second row of faces beside the button is the multi-sign
    // grammar coming back.
    expect(source).not.toContain("dpc-dock__stack");
    expect(source).not.toContain("dpc-dock__thumb");
  });

  it("gives the tray radio semantics and a selection ring", async () => {
    const tray = await readFile(TRAY, "utf8");
    const css = await readFile(CSS, "utf8");
    expect(tray).toContain('role={onSelect ? "radio" : undefined}');
    expect(tray).toContain("aria-checked");
    expect(tray).toContain("is-selected");
    // The ring is the standard selection grammar, and it must survive the
    // stack's overlap — so it is drawn as a shadow rather than an outline.
    expect(css).toContain(".dpc-keptstack__chip.is-selected");
    expect(css).toContain("--accentSolid");
  });

  it("lets a shortlist be browsed at scale", async () => {
    const tray = await readFile(TRAY, "utf8");
    // Ten keeps and no way to pick one was the founder's report. Clicking
    // selects, and the strip expands rather than truncating the choice.
    expect(tray).toContain("onSelect?.(entry.candidateId)");
    expect(tray).toContain("setExpanded(true)");
  });

  it("walks the kept set with the arrow keys and closes on Escape", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    expect(viewer).toContain('event.key === "ArrowRight"');
    expect(viewer).toContain('event.key === "ArrowLeft"');
    expect(viewer).toContain('event.key === "Escape"');
  });

  it("requires a name before anything is spent", async () => {
    /*
      Founder ruling: naming is part of the ceremony — no Cast is ever born
      "Unnamed". Enforced in three places, because a rule that lives only in the
      dialog is a rule the next caller skips: the button is disabled while the
      field is empty, the field is focused so the requirement is obvious, and
      the server's input schema refuses an absent name outright.
    */
    const confirm = await readFile(
      new URL("./components/SignConfirm.tsx", import.meta.url),
      "utf8",
    );
    expect(confirm).toContain("disabled={busy || !name.trim()}");
    // Focused on open — the spec's own behaviour note, achieved with a ref
    // rather than `autoFocus` so the portal has mounted first.
    expect(confirm).toContain("inputRef.current?.focus()");
    /*
      And it leads with HER — the shared shell renders a 4:5 portrait column
      echoing the candidate card the modal grew out of. The index appears only
      in the mono eyebrow, where it is provenance rather than a name.
    */
    expect(confirm).toContain("<CastingModal");
    expect(confirm).toContain("portrait={imageUrl}");
    expect(confirm).toContain("CANDIDATE {indexLabel}");
    expect(confirm).not.toContain("Sign {indexLabel}");

    const route = await readFile(new URL("../../../../server/routes/castingV2.ts", import.meta.url), "utf8");
    const signInput = route.slice(route.indexOf("  sign: protectedProcedure"), route.indexOf("  renameCast:"));
    expect(signInput).toContain("name: z.string().trim().min(1).max(60),");
    expect(signInput).not.toContain(".max(60).optional()");
  });

  it("lets a Cast be renamed from her own room", async () => {
    const room = await readFile(new URL("../../pages/CastingRoom.tsx", import.meta.url), "utf8");
    expect(room).toContain("renameCast");
    expect(room).toContain("dpc-room__nameinput");
    // Escape abandons, Enter saves — the two bindings an inline edit owes.
    expect(room).toContain('event.key === "Enter"');
    expect(room).toContain('event.key === "Escape"');
  });

  it("opens a room image large, and offers it for download", async () => {
    /*
      SUPERSEDED IN PLACE by the one image grammar (founder ruling,
      2026-08-02) — this used to pin double-click-to-open and a hover-revealed
      download row, and both are now defects rather than requirements.

      The grammar itself is enforced in `imageGrammar.test.ts`, which is the
      right home: it scans every casting source rather than the two files this
      one happens to know about. What stays here is the promise the DOCK made —
      that a room image can be opened large and taken away — expressed against
      the shape that actually delivers it now.
    */
    const room = await readFile(new URL("../../pages/CastingRoom.tsx", import.meta.url), "utf8");
    // Click, not double-click: clicking is expanding.
    expect(room).not.toContain("onDoubleClick");
    expect(room).toContain("setViewingImage");
    // Taking it away is a real control now, not chrome that appears on hover.
    expect(room).toContain("Download package");
    expect(room).not.toContain("dpc-media__actions");
    // The viewer still walks the package, master included.
    expect(room).toContain("packageFrames");
  });

  it("keeps the kept faces clear of the helper line", async () => {
    const css = await readFile(CSS, "utf8");
    /*
      The overlap regression: kept thumbs sat on top of "Your words steer this
      family", so a sentence the founder needed to read was half-covered by
      faces. Pinned as a rule rather than a screenshot, because the next
      addition to that row would silently reintroduce it.
    */
    const block = css.slice(css.indexOf(".dpc-keptstack {"), css.indexOf(".dpc-keptstack__chip"));
    expect(block).toMatch(/margin-left:\s*\d+px/);
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { canBeSigned, signTargets } from "./signTarget";

const TRAY = new URL("./components/KeptTray.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/**
 * THE RING AND THE TARGET AGREE ON EVERY CLICK (fable-729 §5).
 *
 * Sign spends 450 credits on the face the tray's accent ring is drawn around.
 * The sheet filtered signed faces out of its target list while the tray drew
 * every shortlist entry as a radio labelled "Sign 03 from ROLL 02" — so a
 * signed face could be clicked, the click wrote a selection the target list
 * could not honour, and the ring stayed on somebody else. Click one woman, arm
 * another, on the most expensive control in the product.
 */
const kept = (id: string, over: { signed?: boolean } = {}) => ({
  candidateId: id, ...over,
});

describe("who the Sign dock can be aimed at", () => {
  it("never offers a face that has already been signed", () => {
    expect(canBeSigned(kept("a"))).toBe(true);
    expect(canBeSigned(kept("b", { signed: true }))).toBe(false);
    /* Absent means unsigned — the field is optional on the wire and a missing
       one must never read as "already done", which would empty the dock. */
    expect(canBeSigned({})).toBe(true);
  });

  it("offers the newest keep first, which is what the dock defaults to", () => {
    const shortlist = [kept("first"), kept("second"), kept("third")];
    expect(signTargets(shortlist).map((entry) => entry.candidateId))
      .toEqual(["third", "second", "first"]);
  });

  it("keeps a signed face in the tray but out of the aim", () => {
    /*
      Both halves in one assertion, because dropping her from the tray would be
      the other way to get this wrong: she is part of the sheet's story and the
      server keeps her there deliberately.
    */
    const shortlist = [kept("signed-one", { signed: true }), kept("open-one")];
    expect(signTargets(shortlist).map((entry) => entry.candidateId)).toEqual(["open-one"]);
    expect(shortlist).toHaveLength(2);
  });

  it("has a default the dock can spend on when everything is signed", () => {
    /* Nothing to aim at is a real state — the dock's own fallback reads the
       first target, and there must not be one. */
    expect(signTargets([kept("a", { signed: true })])).toEqual([]);
  });
});

describe("and both surfaces ask it rather than keeping their own copy", () => {
  /*
    The mirror law (working law 4) is the actual defect here — the rule itself
    is three lines and was never wrong in either place; they simply were not the
    same three lines. These read the source so a second copy is a change to this
    file rather than a silent second opinion about who gets signed.
  */
  it("the tray decides a chip's aim through the shared rule", async () => {
    const tray = await readFile(TRAY, "utf8");
    expect(tray).toContain("canBeSigned(entry)");
    /* And the old private copy is gone rather than merely unused. */
    expect(tray).not.toContain("entry.signed !== true");
  });

  it("the sheet builds its target list through the same one", async () => {
    const sheet = await readFile(SHEET, "utf8");
    /*
      ⚠ The argument moved in #554 and this assertion moved with it, because it
      had pinned the VARIABLE NAME while its own describe block says the rule is
      "both surfaces ask the shared function rather than keeping their own
      copy". The sheet now aims at `keptStrip` — the server's shortlist overlaid
      with what the user has just clicked — so that the strip the eye sees and
      the target the 450-credit button spends on are one list. Feeding the raw
      server list here again would restore exactly the ring-and-target
      disagreement this file was written for, one network round trip wide, so
      the call is still pinned rather than loosened to `signTargets(`.
    */
    expect(sheet).toContain("signTargets(keptStrip)");
    expect(sheet).not.toContain("filter((entry) => !entry.signed)");
  });

  it("a signed chip is neither a radio nor a ring nor a selection write", async () => {
    const tray = await readFile(TRAY, "utf8");
    /* All three surfaces of one claim — the semantics a screen reader hears,
       the ring an eye sees, and what the click actually does — read the same
       `aimable`, so they cannot answer differently. */
    expect(tray).toContain('role={aimable ? "radio" : undefined}');
    expect(tray).toContain("aria-checked={aimable ? selected : undefined}");
    expect(tray).toContain("selected && aimable ?");
    expect(tray).toContain("onClick={() => (aimable ? onSelect?.(entry.candidateId) : setViewing(entry))}");
  });
});

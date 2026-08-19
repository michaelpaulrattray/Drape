import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { INK_PROVENANCES } from "@shared/inkProvenance";

import {
  ATTACHED_PICTURE_LABEL,
  ATTACHED_PICTURE_NOTE,
  ATTACH_ACTION_LABEL,
  ATTACH_CLAIM_QUESTION,
  ATTACH_REMOVE_LABEL,
  attachClaimChips,
} from "./referenceAttachCopy";

/**
 * THE ONE UNIVERSAL DOOR'S COPY, asserted rather than remembered.
 *
 * The UI milestone contract makes the mechanizable half of a copy audit a
 * suite. What these strings must not do is the founder's own complaint:
 *
 * > *"you put a small link take makeup from a photo???? this is stupid, you
 * > should be able to upload any image like grok and use it as a reference for
 * > anything"*
 *
 * So the load-bearing assertion here is NEGATIVE — no string on this control
 * may name a feature. A `+` that said what to attach a picture FOR would
 * rebuild the per-feature entry point the ruling deleted, in words, one commit
 * after deleting it.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);

const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

/* Every feature this product has ever put behind its own reference link. */
const FEATURE_WORDS = ["makeup", "hair", "tattoo", "ink", "eyes", "skin", "colour", "color"];

describe("the door names no feature", () => {
  it("says what the act is and nothing about what it is for", () => {
    for (const line of [ATTACH_ACTION_LABEL, ATTACHED_PICTURE_LABEL, ATTACH_REMOVE_LABEL]) {
      const said = line.toLowerCase().split(/[^a-z]+/);
      for (const feature of FEATURE_WORDS) expect(said).not.toContain(feature);
    }
  });

  it("points at the SENTENCE, because the sentence is the instruction", () => {
    /* The one line that says what a picture is for says it about her ask, not
       about a capability — what the road can do with it is the reply's job. */
    expect(ATTACHED_PICTURE_NOTE.toLowerCase()).toContain("say what to take from it");
    const said = ATTACHED_PICTURE_NOTE.toLowerCase().split(/[^a-z]+/);
    for (const feature of FEATURE_WORDS) expect(said).not.toContain(feature);
  });

  it("promises no deletion it does not perform", () => {
    /*
      There is no detach door: our copy lives under the Cast's purge path and is
      swept with it, which is what makes a crop re-derivable without asking her
      for the same photograph twice. The `×` takes the picture off the ASK.
    */
    expect(ATTACH_REMOVE_LABEL.toLowerCase()).toContain("off your ask");
    expect(ATTACH_REMOVE_LABEL.toLowerCase()).not.toContain("delete");
  });

  it("uses no jargon anywhere a person can read it", () => {
    for (const line of [
      ATTACH_ACTION_LABEL, ATTACHED_PICTURE_LABEL, ATTACH_REMOVE_LABEL,
      ATTACH_CLAIM_QUESTION, ATTACHED_PICTURE_NOTE,
    ]) {
      const said = line.toLowerCase().split(/[^a-z]+/);
      for (const jargon of ["ai", "upload", "reference", "handle", "provenance", "attachment"]) {
        expect(said).not.toContain(jargon);
      }
    }
  });
});

describe("where the picture came from", () => {
  it("asks, in her words, and never states an answer", () => {
    expect(ATTACH_CLAIM_QUESTION).toBe("Where's this from?");
    expect(ATTACH_CLAIM_QUESTION.endsWith("?")).toBe(true);
  });

  it("is TOTAL over the enum the door accepts", () => {
    /*
      The chips are derived from `INK_PROVENANCES` rather than typed beside it.
      A third provenance added server-side reddens this instead of shipping a
      chip row that silently cannot express it — and a row that cannot express
      a value is a value nobody can claim.
    */
    const chips = attachClaimChips();
    expect(chips.map((chip) => chip.provenance)).toEqual([...INK_PROVENANCES]);
    for (const chip of chips) expect(chip.label.length).toBeGreaterThan(0);
  });

  it("gives each one a phrase a person would say", () => {
    const byProvenance = Object.fromEntries(
      attachClaimChips().map((chip) => [chip.provenance, chip.label]),
    );
    expect(byProvenance.synthetic).toBe("I made it");
    expect(byProvenance.consented).toBe("I have permission");
  });
});

describe("the surface itself", () => {
  it("NEVER DEFAULTS THE CLAIM — she taps, or nothing is attached", async () => {
    /*
      THE ASSERTION THIS FILE EXISTS FOR.

      `attach` has no default provenance by ruling: a guessed one is precisely
      the value the real-person fence cannot carry. A client that sent a
      constant — behind a click-through sentence or otherwise — would be the
      guess wearing her tap. So the panel may not contain either literal except
      as it arrives from the chips.
    */
    const DEFAULTED = /provenance:\s*["'](synthetic|consented)["']/;
    const source = withoutProse(await readFile(PANEL, "utf8"));
    expect(source).not.toMatch(DEFAULTED);
    expect(source).toContain("claimPicture(chip.provenance)");

    /*
      THE POSITIVE CONTROL, without which the absence above is a test of its own
      regex. A checker that cannot fire proves nothing by staying silent — and
      this one is a string match over a whole file, which is the shape that
      quietly stops matching after an ordinary edit.
    */
    expect(`provenance: "consented",`).toMatch(DEFAULTED);
    expect(`provenance: 'synthetic'`).toMatch(DEFAULTED);
  });

  it("is drawn only where the page hands it a door", async () => {
    /*
      Absent rather than disabled outside the scope: `reference.attach` answers
      NOT_FOUND there, so a drawn `+` would be a control that refuses. Same
      doctrine as the Regenerate button and the read below it.
    */
    expect(withoutProse(await readFile(PANEL, "utf8"))).toMatch(/attachPicture \?/);
  });

  it("holds the ask until the picture is claimed, rather than dropping it", async () => {
    /*
      Sending anyway would drop her picture in silence and answer about a
      sentence she did not think she was asking alone — the quiet-truncation
      shape, on the one surface where the missing thing is a photograph she
      chose. The question that unblocks it is two taps above the box.
    */
    const source = withoutProse(await readFile(PANEL, "utf8"));
    expect(source).toMatch(/pictureUnclaimed/);
    expect(source).toMatch(/busy \|\| pictureUnclaimed/);
  });

  it("sends the HANDLE and never the bytes", async () => {
    /*
      The attach is its own door precisely so a paid, rate-limited refine does
      not carry a multi-megabyte upload. What rides with the sentence is the id
      that door minted.
    */
    const source = withoutProse(await readFile(PANEL, "utf8"));
    expect(source).toMatch(/onRefine\(trimmed, undefined, undefined, picture\?\.referenceId \?\? undefined\)/);
    /* And nothing on this surface hands a refine any BYTES — the negative half
       of the same claim, with its own control below. */
    const BYTES_ON_THE_ASK = /onRefine\([^)]*(imageBase64|base64)/;
    expect(source).not.toMatch(BYTES_ON_THE_ASK);
    expect(`onRefine(trimmed, undefined, undefined, imageBase64)`).toMatch(BYTES_ON_THE_ASK);
  });
});

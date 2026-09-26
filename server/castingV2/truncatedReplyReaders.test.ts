/**
 * A REPLY CUT OFF AT THE CEILING IS SAID BY ITS OWN NAME, IN EVERY READER (#1272).
 *
 * # What this is the guard for
 *
 * `TextResult.truncated` is computed by the transport from the provider's own
 * `finish_reason === "length"` and handed to every caller. Its declaration says
 * why it exists: *"a fragment of JSON does not degrade to a missing field — it
 * fails the whole parse … a truncated interpretation silently becomes 'the brief
 * said nothing'."* #1228 found `renderVerification` throwing that signal away and
 * fixed it; this suite is its named remainder, and the population is re-counted
 * here rather than trusted.
 *
 * # The one arm shape that actually proves the fix, and the trap it avoids
 *
 * An UNPARSEABLE fragment already failed open in every one of these readers — it
 * throws out of `JSON.parse` and lands in a catch. **An arm driving one would
 * pass with every guard in this change deleted**, measuring the catch instead of
 * the guard. #1228's own suite recorded that trap after nearly shipping it.
 *
 * So every arm below drives a reply that is cut off **and still parses**. That is
 * the case the readers genuinely got wrong: JSON truncated after its first field
 * is valid JSON, and an absent field is exactly what each of these readers reads
 * as a fact about the picture —
 *
 *   - `faceDescribe`   · absent `skin` means "no description" → an honest silence
 *   - `presentationState` · absent facet means "no pin"
 *   - `inkReferenceTake`  · absent `side` means "she never said one"
 *   - `realizationCaption` · absent `matches` means "the edit is not visible",
 *     and absent `visible` means SEEN, which is the wrong way round
 *
 * Each pair is therefore an arm and its NEGATIVE CONTROL: the same reply without
 * the flag must still be read the old way. A guard keying on the reply's SHAPE
 * rather than on `truncated` would fail the control.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "../testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

import { describeWithTeeth } from "./faceDescribe";
import { readHairColourFromReference } from "./hairColourFromReference";
import { resolveHairTake } from "./hairReferenceTake";
import { resolveInkReferenceTake } from "./inkReferenceTake";
import { readMakeupFromReference } from "./makeupFromReference";
import { capturePresentation } from "./presentationState";
import { readReferenceMedium } from "./referenceMediumDoor";
import { captionRealization, captionSlot } from "./realizationCaption";
import { facetOfSubject } from "./refineFacets";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const bytes = Buffer.from("pixels");
const BYTES = { bytes, contentType: "image/png" };

/**
 * One engine, one reply, and `truncated` as the ONLY thing that varies between
 * an arm and its control. Written here rather than reused from each reader's own
 * suite because every one of those helpers hard-codes `truncated: false`, which
 * is precisely why none of them could ever have caught this.
 */
function saying(text: string, truncated: boolean) {
  return {
    id: "stub:truncation",
    complete: async () => ({ text, truncated, latencyMs: 1 }),
  } as never;
}

describe("a reader cut off at the token ceiling says so, and files nothing", () => {
  it("faceDescribe: a fragment describes nothing, where it used to describe the fields it reached", async () => {
    const partial = JSON.stringify({ build: "slim shoulders" });

    expect(await describeWithTeeth({ ...BYTES, engine: saying(partial, true) }))
      .toEqual({ build: null, skin: null, teeth: null });

    /* NEGATIVE CONTROL — the same fragment, not flagged, is read exactly as
       before: the one field that arrived is kept and the two that did not read
       as an honest silence. This is what proves the guard keys on the flag. */
    expect(await describeWithTeeth({ ...BYTES, engine: saying(partial, false) }))
      .toEqual({ build: "slim shoulders", skin: null, teeth: null });
  });

  it("presentationState: a fragment pins nothing, where it used to pin the facets it reached", async () => {
    const partial = JSON.stringify({ hairWorn: "gathered" });

    expect(await capturePresentation({ ...BYTES, engine: saying(partial, true) })).toEqual({});

    const control = await capturePresentation({ ...BYTES, engine: saying(partial, false) });
    expect(control[facetOfSubject("hairWorn")]).toBeDefined();
  });

  it("referenceMediumDoor: a quoted bare word is VALID JSON, so a fragment used to answer the question", async () => {
    /* The sharp case here is not an unparseable object — it is that `"photograph"`
       on its own parses to a string, and this module reads a bare string as a
       positive medium on purpose (a one-word answer to a one-word question). So a
       reply cut off mid-sentence could assert a medium nobody finished reading. */
    expect(await readReferenceMedium({ ...BYTES, engine: saying('"photograph"', true) }))
      .toBe("unreadable");

    expect(await readReferenceMedium({ ...BYTES, engine: saying('"photograph"', false) }))
      .toBe("photograph");
  });

  it("hairReferenceTake: a fragment is no take, where it used to decide how much of her hair to copy", async () => {
    /* Only an ambiguous sentence reaches a model at all — the word tests answer
       the ordinary asks for free — so the instruction has to be one that spends. */
    const instruction = "copy the hairstyle but keep her colour";
    const partial = JSON.stringify({ take: "style" });

    expect(await resolveHairTake({ instruction, engine: saying(partial, true) })).toBeNull();
    expect(await resolveHairTake({ instruction, engine: saying(partial, false) })).toBe("style");
  });

  it("inkReferenceTake: a fragment used to drop a side she DID state and look like obedience", async () => {
    /* This ask has two fields and the second one is the trap: a reply cut off
       after `placement` parses with `side` absent, and absent is this module's
       word for "she never used the word". The control shows the fragment being
       read as a placement with no side — from a sentence that says "left". */
    const instruction = "use this tattoo design on my left sleeve";
    const partial = JSON.stringify({ placement: "sleeve" });

    expect(await resolveInkReferenceTake({ instruction, engine: saying(partial, true) })).toBeNull();

    const control = await resolveInkReferenceTake({ instruction, engine: saying(partial, false) });
    expect(control).not.toBeNull();
    expect(control?.side).toBeNull();
  });

  it("hairColourFromReference: a fragment takes the OURS road, not the one that blames her photograph", async () => {
    /* The whole point of this member. Both sentences already exist in the module
       and it draws the line itself: the transport branch says *"try again in a
       moment"*, the parse branch says *"try another one"*. A token ceiling is
       ours, so it may not produce the second — she would change the picture, it
       would fail again, and we would have blamed her twice. */
    const whole = JSON.stringify({ hair: "yes", sections: [{ tone: "chestnut brown", where: "all over" }] });

    const cut = await readHairColourFromReference({ ...BYTES, engine: saying(whole, true) });
    expect(cut.ok).toBe(false);
    if (cut.ok) throw new Error("unreachable");
    expect(cut.refusal.message).toContain("try again in a moment");
    expect(cut.refusal.message).not.toContain("try another one");

    expect((await readHairColourFromReference({ ...BYTES, engine: saying(whole, false) })).ok).toBe(true);
  });

  it("makeupFromReference: the same, on the twin the card's own count cleared", async () => {
    /* #1272 listed six and this was not one of them: its only mention of the word
       `truncated` is the prose in its transport branch, which reads as a handled
       signal to anything counting the token rather than opening the file. Clause
       for clause it is `hairColourFromReference`. */
    const whole = JSON.stringify({
      subject: "cosmetics",
      eyes: "soft brown smoky shadow",
      lips: "nude matte lip",
      brows: "brushed up",
      complexion: "dewy skin",
    });

    const cut = await readMakeupFromReference({ ...BYTES, engine: saying(whole, true) });
    expect(cut.ok).toBe(false);
    if (cut.ok) throw new Error("unreachable");
    expect(cut.refusal.message).toContain("try again in a moment");
    expect(cut.refusal.message).not.toContain("try another one");

    expect((await readMakeupFromReference({ ...BYTES, engine: saying(whole, false) })).ok).toBe(true);
  });

  it("captionRealization: a fragment pins nothing and makes no claim about the render", async () => {
    const partial = JSON.stringify({ caption: "Soft rose-pink irises, evenly toned." });
    const ask = { facet: facetOfSubject("eyeColourFree"), ...BYTES };

    expect(await captionRealization({ ...ask, engine: saying(partial, true) })).toBeNull();

    /* Driven with no `asked`, deliberately: with one, the corroboration gate
       returns null for the fragment too and the arm would pass with the guard
       deleted — the inert shape this suite's header is about. */
    expect(await captionRealization({ ...ask, engine: saying(partial, false) }))
      .toBe("Soft rose-pink irises, evenly toned.");
  });

  it("captionSlot: absent `visible` means SEEN, so a fragment used to file a sighting", async () => {
    /* The worst default of the nine. The ask spends four lines telling the model
       to answer `visible:false` when it cannot see the thing, and the reader is
       `parsed?.visible !== false` — so our own ceiling could take that answer
       away and the caption would be filed as a description of the person anyway.
       `view: "frame"` keeps this to a single read. */
    const partial = JSON.stringify({ caption: "Gold hoop earring" });
    const slot = { noun: "right earring", view: "frame" as const, ...BYTES };

    expect(await captionSlot({ ...slot, engine: saying(partial, true) })).toBeNull();
    expect(await captionSlot({ ...slot, engine: saying(partial, false) })).toBe("Gold hoop earring");
  });
});

/**
 * THE POPULATION, DERIVED — AND STRIPPED OF ITS COMMENTS FIRST.
 *
 * ⚠ The comment-stripping is the whole content of this arm, not a detail. #1272's
 * own count was made by opening each caller and looking for a read of
 * `truncated`, and it cleared THREE modules whose only mention of the word is
 * prose: `makeupFromReference` (a docblock in its transport branch),
 * `realizationCaption` and `refineInterpreter` (two comments about ceilings).
 * Two of those three were customer-visible and one is the exact twin of the
 * sharpest member. A guard searching raw source would inherit that miss exactly,
 * so the classifier below is proven against synthetic sources that contain the
 * word in a comment and nowhere else.
 */
const CASTING_DIR = path.join(import.meta.dirname, ".");

/** Source with block and line comments removed, so a MENTION cannot read as a READ. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function readsTruncatedInCode(source: string): boolean {
  return /\.truncated\b/.test(codeOnly(source));
}

/**
 * Callers deliberately outside the class, each with the reason it is out. A file
 * named here must still exist — an exemption whose subject has been deleted or
 * renamed is a hole that reads as coverage (the promoted-subject class).
 */
const NOT_IN_THE_CLASS: Record<string, string> = {
  "reimagine.ts":
    "calls .complete but never parses JSON from the reply, so a fragment cannot become a fact",
  /*
    ⚠ `refineInterpreter.ts` WAS EXEMPTED HERE AND IS NOT ANY MORE — #1275 made
    the decision the exemption was holding open (a third `ReadFailure` state,
    `truncated`, standing beside `threw` on the ours side). It is now an ordinary
    member of the population above and has its own arm below, so a revert
    reddens twice: once here for not reading the signal, once there by name.
  */
};

describe("every casting reader that asks a model reads the truncation signal", () => {
  const callers = fs.readdirSync(CASTING_DIR)
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"))
    .map((entry) => ({ entry, source: readListedSource(path.join(CASTING_DIR, entry)) }))
    /* A file listed and then gone is not part of the tree at the moment of the
       reading (#223); every other read still throws. */
    .filter((row): row is { entry: string; source: string } => row.source !== null)
    .filter((row) => row.source.includes(".complete("));

  it("found the callers at all — the walk cannot go quiet and pass", () => {
    /* A derived population that comes up empty looks identical to a fully
       compliant one, which is the collector class CLAUDE.md names. */
    expect(callers.length).toBeGreaterThanOrEqual(16);
  });

  it("each one either reads it in CODE or is named here with its reason", () => {
    const missing = callers
      .filter((row) => !readsTruncatedInCode(row.source))
      .map((row) => row.entry)
      .filter((entry) => !(entry in NOT_IN_THE_CLASS));

    expect(missing).toEqual([]);
  });

  it("every exemption still names a real file", () => {
    for (const entry of Object.keys(NOT_IN_THE_CLASS)) {
      expect(fs.existsSync(path.join(CASTING_DIR, entry)), `${entry} is exempted and gone`).toBe(true);
    }
    /* And an exemption may not quietly become unnecessary: a file that now reads
       the signal belongs out of this list, where its reason stops being read. */
    for (const entry of Object.keys(NOT_IN_THE_CLASS)) {
      const source = readListedSource(path.join(CASTING_DIR, entry));
      if (source === null) continue;
      expect(readsTruncatedInCode(source), `${entry} reads it now — take it off the list`).toBe(false);
    }
  });

  it("the eight this change fixed are in the population and read it", () => {
    /* Named rather than counted: a population arm that only counts would stay
       green if a fix were reverted and a new caller added in the same week. */
    const fixed = [
      "faceDescribe.ts", "hairColourFromReference.ts", "hairReferenceTake.ts",
      "inkReferenceTake.ts", "makeupFromReference.ts", "presentationState.ts",
      "realizationCaption.ts", "referenceMediumDoor.ts",
    ];
    for (const entry of fixed) {
      const row = callers.find((candidate) => candidate.entry === entry);
      expect(row, `${entry} is no longer a .complete caller`).toBeDefined();
      expect(readsTruncatedInCode(row!.source), `${entry} stopped reading truncated`).toBe(true);
    }
  });

  it("the ninth — the paid refine road — reads it and routes it to the OURS side", () => {
    /*
      #1275, kept SEPARATE from the eight above rather than appended to that
      list, because it is a different act with a different shape: the eight
      refuse the moment `truncated` is set, and this one lets the parse run and
      reclassifies only the FAILURE, so a flagged reply that still parses keeps
      working on a road the customer has paid for.

      Three assertions rather than one, because reading the signal and ACTING on
      it are different facts and only the second is the card. A fix that read
      `reply.truncated` into a variable and never used it would pass the
      population arm above — which is exactly the "collected, never asserted"
      shape this repository has already paid for.
    */
    const row = callers.find((candidate) => candidate.entry === "refineInterpreter.ts");
    expect(row, "refineInterpreter.ts is no longer a .complete caller").toBeDefined();
    const code = codeOnly(row!.source);
    expect(readsTruncatedInCode(row!.source), "it stopped reading truncated").toBe(true);
    expect(code, "`truncated` is no longer a ReadFailure state").toMatch(/"truncated"/);
    expect(
      /trace\.last === "threw"\s*\|\|\s*trace\.last === "truncated"/.test(code),
      "a truncated read no longer stands beside `threw` on the ours side",
    ).toBe(true);
  });

  /* ── THE CLASSIFIER'S OWN CONTROLS (law 2: verify the instrument) ────────── */

  it("POSITIVE CONTROL: a mention in a block comment is not a read", () => {
    /* This is the exact shape that miscounted #1272 — `makeupFromReference`'s
       docblock. A classifier reading raw source calls this compliant. */
    const source = [
      "/*", " * Nothing is silently truncated: what was left out is RETURNED.", " */",
      "const reply = await engine.complete({ json: true });",
      "const parsed = JSON.parse(reply.text);",
    ].join("\n");
    expect(/\.truncated\b/.test(source)).toBe(false);
    expect(readsTruncatedInCode(source)).toBe(false);
  });

  it("POSITIVE CONTROL: `reply.truncated` inside a comment is not a read either", () => {
    /* The harder half. `refineInterpreter` WAS the live specimen — the token
       appeared WITH its dot, in prose, and nowhere in its code — until #1275;
       its ceiling comments are still there, which is why it needed the stripping
       to be classified correctly in EITHER direction. Stripping is what tells a
       mention and a read apart, and this control is synthetic so it keeps
       proving that whatever the tree does next. */
    const source = [
      "/* The ceiling went up because `reply.truncated` does not degrade. */",
      "// a truncated reply parses to nothing — see reply.truncated",
      "const parsed = JSON.parse(reply.text);",
    ].join("\n");
    expect(/\.truncated\b/.test(source)).toBe(true);
    expect(readsTruncatedInCode(source)).toBe(false);
  });

  it("NEGATIVE CONTROL: a real read is found, and stripping does not eat it", () => {
    const source = [
      "/* truncated is handed to every caller. */",
      "if (reply.truncated) return blank;",
    ].join("\n");
    expect(readsTruncatedInCode(source)).toBe(true);
  });

  it("NEGATIVE CONTROL: a URL's slashes do not make the stripper eat the code after it", () => {
    /* The stripper's own failure mode, driven rather than reasoned about: an
       over-eager line-comment rule would swallow the read and redden a compliant
       file, which fails toward inventing work. */
    const source = [
      'const doc = "https://example.test/ceilings";',
      "if (reply.truncated) return null;",
    ].join("\n");
    expect(readsTruncatedInCode(source)).toBe(true);
  });
});

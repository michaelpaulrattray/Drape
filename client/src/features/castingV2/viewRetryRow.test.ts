import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  VIEW_RETRY_LINK,
  VIEW_RETRY_SEPARATOR,
  VIEW_RETRY_WORDS,
  viewRetryLine,
} from "./viewRetryRow";

/**
 * ONE MUTED LINE UNDER THE NAME (#1347) — his ruling held to the bytes.
 *
 * Desk reply 224, 2026-09-26, on the real strip his own Cast draws: *"Too heavy
 * — the good tiles have become louder than the broken one. Go more minimal, in
 * our design language: one muted line under the name, nothing else."*
 *
 * Five facts, and each one is a thing the room did differently the day before:
 *
 *   1. Under an unchecked view — `Unchecked · Try again`, the link being the
 *      last two words only.
 *   2. Under the view that never arrived — `Refunded · Try again`, same line.
 *   3. No credit count in the row (it read `Try again · 50 CR`).
 *   4. The three good views carry nothing — which is the gate, not a filter:
 *      the row exists exactly where the server offers a retry.
 *   5. `We didn't get to check this one` and the `50 CR BACK` pill are gone.
 *
 * ⚠ **EVERY SOURCE READING HERE STRIPS COMMENTS FIRST, AND THAT IS NOT A
 * DETAIL.** The room and this module both QUOTE the removed copy in their
 * docblocks, deliberately — naming what left is how the next reader knows it
 * was a decision. A guard reading the raw file would find `50 CR BACK` in a
 * comment explaining its own removal and call the removal a failure, and a
 * guard "fixed" by dropping that assertion would stop checking anything. The
 * reader has its own negative control below.
 */

const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);
const PROJECTION = new URL("../../../../server/castingV2/castProjection.ts", import.meta.url);

const NEWLINE = String.fromCharCode(10);

/**
 * The row's own span in the renderable room — from its class to the end of the
 * tile it closes.
 *
 * ⚠ **Both bounds are found FORWARD from the class, never with two bare
 * `indexOf`s.** `</article>` occurs several times in this page (the sibling
 * grid closes one too) and the first of them sits ABOVE the strip, so
 * `slice(indexOf(row), indexOf("</article>"))` returned the EMPTY STRING and
 * every `toContain` on it failed for a reason that had nothing to do with the
 * markup. An arm keyed on an empty slice is the same defect wearing the other
 * face: `not.toContain` would have passed forever.
 */
function rowSpan(room: string): string {
  const start = room.indexOf("dpc-slot__row");
  if (start < 0) throw new Error("the room draws no dpc-slot__row");
  const end = room.indexOf("</article>", start);
  if (end < 0) throw new Error("the row is not inside a tile");
  return room.slice(start, end);
}

/**
 * The whole strip's span — every tile in the signed package, and nothing right
 * of it.
 *
 * ⚠ **It REFUSES an empty or backwards slice for the same reason `rowSpan`
 * does, and here it matters more**: the arms over this span are mostly
 * `not.toContain`, and an empty string satisfies every one of them. A guard that
 * passes because it read nothing is the shape this repository has been bitten by
 * repeatedly (`surviving-sabotage-may-be-inert`).
 */
function stripSpan(room: string): string {
  const start = room.indexOf("dpc-strip__item");
  const end = room.indexOf("dpc-room__right");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`cannot place the strip: start ${start}, end ${end}`);
  }
  const span = room.slice(start, end);
  /* A floor, so a room refactored into another file cannot read as a clean strip. */
  if (!span.includes("dpc-slot__label")) throw new Error("the strip draws no slot labels");
  return span;
}

/** What actually reaches a screen: the source with every comment removed. */
function renderable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(NEWLINE)
    .map((line) => line.replace(/\{?\/\/.*$/, ""))
    .join(NEWLINE);
}

describe("the row is his one muted line", () => {
  it("says exactly what he wrote, both roads, character for character", () => {
    expect(viewRetryLine("unchecked")).toBe("Unchecked · Try again");
    expect(viewRetryLine("refunded")).toBe("Refunded · Try again");
  });

  it("puts the link on the last two words only — the word is not pressable", async () => {
    /*
      *"(Try again is the link)"* — his parenthesis, and the whole reason the row
      is three elements rather than one string. A single button reading
      "Unchecked · Try again" would look identical in a screenshot and offer the
      customer a word to press that does nothing.
    */
    expect(VIEW_RETRY_LINK).toBe("Try again");
    for (const word of Object.values(VIEW_RETRY_WORDS)) {
      expect(word).not.toContain(VIEW_RETRY_LINK);
    }
    const row = rowSpan(renderable(await readFile(ROOM, "utf8")));
    /* The word and the separator sit OUTSIDE the button; only the link is in it. */
    expect(row).toContain("VIEW_RETRY_WORDS[slot.retry.reason]");
    expect(row.indexOf("VIEW_RETRY_WORDS")).toBeLessThan(row.indexOf("<button"));
    expect(row.slice(row.indexOf("<button"))).toContain("{VIEW_RETRY_LINK}");
  });

  it("carries NO credit count — the number that used to ride the label", async () => {
    /*
      *"No credit count in the row."* Read on the renderable room, over the row's
      own span: `priceCredits` is still the number the entrance charges and it
      must simply never be drawn here.
    */
    const strip = stripSpan(renderable(await readFile(ROOM, "utf8")));
    expect(strip).not.toContain("priceCredits");
    expect(strip).not.toContain("CR");
    expect(strip).not.toContain("free");
  });

  it("appears exactly where a retry is offered, so a good view carries nothing", async () => {
    /*
      His *"The three good views carry nothing, as now."* A good view has no
      offer, so gating the row on `slot.retry` is the whole of it — no second
      predicate that could disagree with the one the server authorizes with.
    */
    const room = renderable(await readFile(ROOM, "utf8"));
    expect(room).toContain("{slot.retry && !beingAsked ? (");
    expect(room.slice(room.indexOf("{slot.retry && !beingAsked ? ("))).toContain("dpc-slot__row");
  });

  it("is the ONLY thing under the name — the caption line is gone", async () => {
    /*
      The sentence `We didn't get to check this one` was drawn here as
      `dpc-takes__caption`, giving an unchecked view three lines against the
      failed one's two. It is gone, and so is every other reading of `slot.note`
      outside the empty tile's own confession.
    */
    const strip = stripSpan(renderable(await readFile(ROOM, "utf8")));
    expect(strip).not.toContain("dpc-takes__caption");
    /* `slot.note` survives once, inside the confession that stands in for a picture. */
    expect(strip.match(/slot\.note/g)?.length).toBe(1);
    expect(strip.slice(0, strip.indexOf("slot.note"))).toContain("dpc-slot__confession");
  });

  it("leaves the empty tile one sentence and no pill", async () => {
    /*
      *"Drop the '50 CR BACK' inside the empty tile too — 'This view didn't
      arrive — refunded' is enough."* The sentence is server-authored and stays;
      the mono pill and its class are deleted.
    */
    const room = renderable(await readFile(ROOM, "utf8"));
    expect(room).not.toContain("dpc-slot__refund");
    expect(room).not.toContain("CR BACK");
    expect(room).toContain("dpc-slot__confession");

    const css = await readFile(CSS, "utf8");
    expect(renderable(css)).not.toContain(".dpc-slot__refund");
  });

  it("is one line in the stylesheet, at the caption's size, not a second block", async () => {
    /*
      *"one muted line … in our design language."* Two facts that make it ONE
      line rather than two stacked: the row is a baseline flex row, and the link
      inherits its type instead of setting a size of its own (11px against the
      row's 10.5px was what made the old button a line of its own).
    */
    const css = await readFile(CSS, "utf8");
    const row = css.slice(css.indexOf(".dpc-slot__row {"), css.indexOf(".dpc-slot__again {"));
    expect(row).toContain("align-items: baseline");
    expect(row).not.toContain("flex-direction: column");
    expect(row).toContain("10.5px");
    expect(row).toContain("var(--faint)");

    const again = css.slice(css.indexOf(".dpc-slot__again {"), css.indexOf(".dpc-slot__again:hover"));
    expect(again).toContain("font: inherit");
    expect(again).toContain("text-decoration: underline");
    /* The link is the stronger of the two greys — the only thing saying "press". */
    expect(again).toContain("var(--meta)");
  });

  it("draws the separator for the eye only — a screen reader hears two things", async () => {
    /*
      The dot is punctuation between a state and an action. Read aloud it is
      noise, and it sits in its own aria-hidden span for that reason. Asserted at
      the element rather than at the constant, because a `·` typed into the word
      or the label would look identical and be spoken.
    */
    expect(VIEW_RETRY_SEPARATOR).toBe("·");
    for (const word of Object.values(VIEW_RETRY_WORDS)) {
      expect(word).not.toContain(VIEW_RETRY_SEPARATOR);
    }
    expect(VIEW_RETRY_LINK).not.toContain(VIEW_RETRY_SEPARATOR);

    const row = rowSpan(renderable(await readFile(ROOM, "utf8")));
    const before = row.slice(0, row.indexOf("VIEW_RETRY_SEPARATOR"));
    expect(row).toContain("VIEW_RETRY_SEPARATOR");
    /* Its own span, hidden, opened on the line immediately before it. */
    expect(before).toContain('<span aria-hidden="true">');
    /* And it is not inside the button — the link is the last thing in the row. */
    expect(before).not.toContain("<button");
  });
});

describe("the word can only ever come from the server's own reason", () => {
  it("has a word for every reason the offer declares, read out of the server's union", async () => {
    /*
      THE POPULATION IS DERIVED, NOT TRANSCRIBED (working law 4). The union lives
      on `CastSlotRetry.reason`; TypeScript already refuses a map that is missing
      a key, but a union WIDENED in the same commit as a branch that returns it
      would type-check against a map widened to match and still ship a word
      nobody chose. This reads the declaration and holds the map to it.
    */
    const projection = await readFile(PROJECTION, "utf8");
    const declaration = projection.slice(
      projection.indexOf("reason:", projection.indexOf("export type CastSlotRetry")),
    );
    const union = declaration.slice(0, declaration.indexOf(";"));
    const reasons = [...union.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]).sort();

    expect(reasons.length, `read "${union}"`).toBeGreaterThan(1);
    expect(Object.keys(VIEW_RETRY_WORDS).sort()).toEqual(reasons);
    for (const reason of reasons) {
      expect(VIEW_RETRY_WORDS[reason as keyof typeof VIEW_RETRY_WORDS]).toBeTruthy();
    }
  });

  it("the two sentences his ruling removed are not in the projection at all", async () => {
    /*
      Deleted rather than left unused, so a later surface cannot quietly pick one
      up again and put a third line back under a tile.
    */
    const projection = renderable(await readFile(PROJECTION, "utf8"));
    expect(projection).not.toContain("UNJUDGED_SLOT_NOTE");
    expect(projection).not.toContain("ANCHOR_STANDIN_NOTE");
    /* The one he kept by name, so this arm cannot pass by reading an empty file. */
    expect(projection).toContain("FAILED_SLOT_CONFESSION");
    expect(projection).toContain("This view didn't arrive — refunded");
  });
});

describe("the reader itself", () => {
  /*
    WORKING LAW 2 — the comment stripper is the instrument every arm above runs
    through, and a stripper that removed everything would make all of them pass.
    Both directions, on the real files.
  */
  it("removes a comment and keeps the code beside it", () => {
    const source = [
      "/* 50 CR BACK and We didn't get to check this one */",
      'const a = "kept";',
      "const b = 1; // Try again · 50 CR",
    ].join(NEWLINE);
    const out = renderable(source);
    expect(out).not.toContain("CR BACK");
    expect(out).not.toContain("didn't get to check");
    expect(out).toContain('const a = "kept";');
    expect(out).toContain("const b = 1;");
  });

  it("would have FAILED on the room as it stood yesterday", async () => {
    /*
      The negative control that matters: the arms above pass on today's room, and
      that is only evidence if they would have reddened on the shape his ruling
      replaced. Driven on the real previous markup rather than on a paraphrase.
    */
    const yesterday = renderable([
      '<span className="dpc-slot__label">{slot.label}</span>',
      "{!beingAsked && slot.state !== \"failed-refunded\" && slot.note ? (",
      '  <span className="dpc-takes__caption">{slot.note}</span>',
      ") : null}",
      "{slot.retry && !beingAsked ? (",
      '  <button type="button" className="dpc-slot__again" onClick={() => askAgain(slot.angle)}>',
      "    {slot.retry.priceCredits > 0 ? `Try again · ${slot.retry.priceCredits} CR` : \"Try again · free\"}",
      "  </button>",
      ") : null}",
    ].join(NEWLINE));

    expect(yesterday).toContain("dpc-takes__caption");
    expect(yesterday).toContain("priceCredits");
    expect(yesterday).toContain("CR");
    expect(yesterday).not.toContain("dpc-slot__row");

    /* And today's room fails every one of those readings, which is the pair. */
    const strip = stripSpan(renderable(await readFile(ROOM, "utf8")));
    expect(strip).not.toContain("dpc-takes__caption");
    expect(strip).not.toContain("priceCredits");
    expect(strip).toContain("dpc-slot__row");
  });
});

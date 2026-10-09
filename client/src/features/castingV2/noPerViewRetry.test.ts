import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { CASTING_V2_PACKAGE_REDO_PRICE_CREDITS } from "../../../../server/casting/castingCreditCosts";
import { FAILED_SLOT_CONFESSION } from "../../../../server/castingV2/castProjection";
import { packageRedoPrice } from "./packageRedoRow";

/**
 * NO PER-VIEW TRY AGAIN ON ANY VIEW OF A SIGNED CAST — #2089.
 *
 * His word, 2026-10-08 (terminal), verbatim and entire: *"regenerate is the
 * only option"*.
 *
 * Until then the room drew one muted line under a view that never arrived —
 * `Refunded · Try again` (#1347's shape) — and a paid per-view retry behind it.
 * The row, its module (`viewRetryRow.ts`) and its press are deleted; the empty
 * tile keeps its one true sentence; the remedy is the whole-set button.
 *
 * The server half (no offer on any slot, a stale press refused before the
 * claim) is driven in `server/castingV2/viewRetryService.test.ts` and
 * `viewRetryOffer.test.ts`. This file holds the ROOM to it, at the source the
 * page renders from — because the server answering null proves nothing about
 * a client that draws a row from something else.
 *
 * ⚠ **EVERY SOURCE READING HERE STRIPS COMMENTS FIRST.** The room QUOTES the
 * removed row in the comment that records its removal, deliberately; a guard
 * reading the raw file would find `Refunded · Try again` there and call the
 * removal a failure. The stripper has its own controls at the bottom.
 */

const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);
const NEWLINE = String.fromCharCode(10);

/** What actually reaches a screen: the source with every comment removed. */
function renderable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(NEWLINE)
    .map((line) => line.replace(/\{?\/\/.*$/, ""))
    .join(NEWLINE);
}

/**
 * The strip's span — every tile in the signed package and nothing right of it.
 * REFUSES an empty or backwards slice: most arms here are `not.toContain`, and
 * an empty string satisfies every one of them.
 */
function stripSpan(room: string): string {
  const start = room.indexOf("dpc-strip__item");
  const end = room.indexOf("dpc-room__right");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`cannot place the strip: start ${start}, end ${end}`);
  }
  const span = room.slice(start, end);
  if (!span.includes("dpc-slot__label")) throw new Error("the strip draws no slot labels");
  return span;
}

const roomSource = async () => renderable(await readFile(ROOM, "utf8"));

describe("the room offers no per-view Try again (card 2089)", () => {
  it("draws nothing under a view's name — no row, no link, no offer read", async () => {
    const strip = stripSpan(await roomSource());
    expect(strip).not.toContain("slot.retry");
    expect(strip).not.toContain("dpc-slot__row");
    expect(strip).not.toContain("dpc-slot__again");
    expect(strip).not.toContain("Try again");
    expect(strip).not.toContain("askAgain");
    /* The label is the last thing in a tile: the article closes right after it. */
    const label = strip.indexOf("dpc-slot__label");
    const close = strip.indexOf("</article>", label);
    expect(close).toBeGreaterThan(label);
    expect(strip.slice(label, close)).not.toMatch(/<button|<span className="dpc-slot__/);
  });

  it("cannot press one: the page holds no per-view retry mutation at all", async () => {
    const room = await roomSource();
    expect(room).not.toContain("castingV2.retryView");
    expect(room).not.toContain("viewRetryRow");
    expect(room).not.toContain("VIEW_RETRY_");
  });

  it("keeps the refunded tile's one true sentence, drawn from the server's note", async () => {
    /*
      The sentence is server-authored (`FAILED_SLOT_CONFESSION`). The tile draws
      `slot.note` once, inside the confession that stands where the picture
      would be.

      ⚠ **IT ENDED IN "— refunded" UNTIL #1968 AND THE REASON KEPT HERE FOR IT
      HAS EXPIRED.** This arm read *"true: the Sign charges each view its own
      refundable slice, so a view that never arrived WAS refunded"* — and his
      word of 2026-10-08 (*"make both sign and redo/regenerate 650 credis"*)
      makes a Sign one flat charge with no per-view refund at all. The claim
      would have become false the moment that card shipped, with this arm still
      green on the old string.

      What the tile says now says less and stays true on both roads: a view
      that failed on a delivered Sign (nothing came back, and the remedy is the
      Regenerate button this file is about) and one that failed on a Sign that
      delivered nothing (where the WHOLE charge came back — a fact about the
      Sign, said by `TOTAL_LOSS_CONFESSION`, not by one tile).
    */
    expect(FAILED_SLOT_CONFESSION).toBe("This view didn't arrive");
    /* The card number stays in the comment above: this file is read by the
       token guard, which treats an issue number in a STRING as a hex literal. */
    expect(FAILED_SLOT_CONFESSION.toLowerCase(), "a per-view note claims no money")
      .not.toContain("refund");
    const strip = stripSpan(await roomSource());
    expect(strip).toContain('slot.state === "failed-refunded"');
    expect(strip.match(/slot\.note/g)?.length).toBe(1);
    expect(strip.slice(0, strip.indexOf("slot.note"))).toContain("dpc-slot__confession");
  });

  it("leaves Regenerate as the one remedy, priced on its button", async () => {
    /*
      The positive control for the absences above: a room that had lost the
      redo too would pass every one of them and leave her with no remedy.
    */
    const room = await roomSource();
    /* Since #2144 it is the row menu's first item, priced on the item. */
    expect(room).toContain("redo: data.redo,");
    expect(room).toContain("askForAllViewsAgain();");
    expect(packageRedoPrice(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS)).toBe("650 credits");
  });
});

describe("the reader itself", () => {
  it("removes a comment and keeps the code beside it", () => {
    const out = renderable([
      "/* Refunded · Try again */",
      'const a = "kept";',
      "const b = 1; // slot.retry",
    ].join(NEWLINE));
    expect(out).not.toContain("Try again");
    expect(out).not.toContain("slot.retry");
    expect(out).toContain('const a = "kept";');
    expect(out).toContain("const b = 1;");
  });

  it("would have FAILED on the strip as it stood before card 2089", () => {
    /* The row exactly as the room drew it, between a label and its tile's end. */
    const yesterday = renderable([
      '<article className="dpc-strip__item">',
      '<span className="dpc-slot__label">{slot.label}</span>',
      "{slot.retry && !beingAsked ? (",
      '  <span className="dpc-slot__row">',
      "    {VIEW_RETRY_WORDS[slot.retry.reason]}",
      '    <span aria-hidden="true">{VIEW_RETRY_SEPARATOR}</span>',
      '    <button type="button" className="dpc-slot__again" onClick={() => askAgain(slot.angle)}>',
      "      {VIEW_RETRY_LINK}",
      "    </button>",
      "  </span>",
      ") : null}",
      "</article>",
      '<div className="dpc-room__right">',
    ].join(NEWLINE));
    const strip = stripSpan(yesterday);
    expect(strip).toContain("slot.retry");
    expect(strip).toContain("dpc-slot__row");
    expect(strip).toContain("askAgain");
    const label = strip.indexOf("dpc-slot__label");
    expect(strip.slice(label, strip.indexOf("</article>", label))).toMatch(/<button/);
  });
});

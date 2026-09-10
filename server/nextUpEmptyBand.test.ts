/**
 * AN EMPTY NEXT UP IS BELIEVED ONLY WHEN SOMETHING CONFIRMS IT (#772).
 *
 * `scripts/crew-desk-sweep.mts` writes the NEXT UP block on his Crew page from
 * one narrow question — open issues carrying `founder-ordered`. An empty answer
 * to a narrow question is indistinguishable from a broken one, and `[]` was
 * written onto his page as *nothing queued* with full confidence. It is the
 * third instance of one class: the queue counter (#725, seen on production) and
 * the park gate (#730) are the other two.
 *
 * The arms that matter are the NEGATIVE ones — a verdict function that answered
 * "not believable" to everything would pass a positive-only suite while quietly
 * freezing his NEXT UP block forever, which is #504's saving undone by the
 * repair meant to protect it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ORDERED_BAND_LABEL, emptyOrderedBandVerdict } from "../scripts/lib/nextUpItems.mts";

const ordered = (n: number) => ({ number: n, labels: [{ name: ORDERED_BAND_LABEL }] });
const other = (n: number) => ({ number: n, labels: [{ name: "small-fix" }] });

describe("emptyOrderedBandVerdict — the witness that makes an empty band a fact", () => {
  it("BELIEVES an empty band when the whole queue answered and holds no ordered card", () => {
    const verdict = emptyOrderedBandVerdict([other(1), other(2), other(3)]);

    expect(verdict.believable).toBe(true);
    expect(verdict.why).toContain("3 open card(s)");
  });

  /* The state of the queue on the night this landed: 59 open, 0 ordered. A
     genuinely empty band is ORDINARY and must stay believable, or his page
     stops updating and the park gate's short road closes with it. */
  it("believes it with a large real-shaped population too", () => {
    const rows = Array.from({ length: 59 }, (_, i) => other(i + 1));

    expect(emptyOrderedBandVerdict(rows).believable).toBe(true);
  });

  it("REFUSES it when the whole-queue read could not be taken", () => {
    const verdict = emptyOrderedBandVerdict(null);

    expect(verdict.believable).toBe(false);
    expect(verdict.why).toContain("could not be taken");
  });

  /* THE ARM THIS FILE EXISTS FOR: `gh` exiting 0 with `[]`. A queue with zero
     open issues has never happened here, so this is a blip, and believing it
     empties his NEXT UP block. */
  it("REFUSES it when the whole queue came back empty as well", () => {
    const verdict = emptyOrderedBandVerdict([]);

    expect(verdict.believable).toBe(false);
    expect(verdict.why).toContain("blip");
  });

  /* PR #773 review, finding 1. `gh` returns the NEWEST rows and ordered cards
     skew OLD, so on the day the queue passes the cap the band is exactly what
     falls outside the window -- and the sweep's own ladder branch already calls
     a capped read "a floor, not a list". One consumer must not trust what the
     other refuses. */
  it("REFUSES it when the witness came back AT ITS LIMIT, however unlabelled the window looks", () => {
    const capped = Array.from({ length: 200 }, (_, i) => other(i + 1));
    const verdict = emptyOrderedBandVerdict(capped);

    expect(verdict.believable).toBe(false);
    expect(verdict.why).toContain("limit");
  });

  it("takes the cap from the caller, so it cannot drift from the read's own --limit", () => {
    const rows = Array.from({ length: 60 }, (_, i) => other(i + 1));

    expect(emptyOrderedBandVerdict(rows, 200).believable).toBe(true);
    expect(emptyOrderedBandVerdict(rows, 60).believable).toBe(false);
  });

  it("REFUSES it, and says how many, when the same run's own read holds ordered cards", () => {
    const verdict = emptyOrderedBandVerdict([other(1), ordered(2), ordered(3)]);

    expect(verdict.believable).toBe(false);
    expect(verdict.why).toContain("2 open card(s)");
    expect(verdict.why).toContain(ORDERED_BAND_LABEL);
  });

  it("reads the label off the row rather than assuming a shape", () => {
    expect(emptyOrderedBandVerdict([{ labels: undefined }, { labels: "nonsense" }]).believable).toBe(true);
    expect(emptyOrderedBandVerdict([{ labels: [{ name: ORDERED_BAND_LABEL }] }]).believable).toBe(false);
  });
});

describe("the sweep consults it, and on the road that writes his page", () => {
  /*
    A pure function nothing calls is invariant 7's shape. The ORDER — the
    whole-queue read above the NEXT UP block — needs no guard here: using a
    `const` before its declaration is a TypeScript error and a runtime
    ReferenceError, so `pnpm check` is the arm for that half.
  */
  it("crew-desk-sweep.mts calls the verdict in its NEXT UP branch", () => {
    const source = readFileSync(resolve("scripts/crew-desk-sweep.mts"), "utf8");

    expect(source).toContain("emptyOrderedBandVerdict");
    /* The condition, not the exact argument list: this arm reddened once
       already when the cap argument was added, which is a guard telling the
       truth about a call it had over-specified. What must hold is that an
       EMPTY band is put to the witness before the block is rewritten. */
    expect(source).toMatch(/ordered\.length === 0 && !emptyOrderedBandVerdict\(allOpen[^)]*\)\.believable/);
  });
});

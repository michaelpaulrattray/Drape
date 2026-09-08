/**
 * THE READING THAT REPLACES AN MTIME — driven (#526).
 *
 * Working law 2: a new reader gets a negative control and a positive control
 * before its verdicts count for anything. That bar is sharper than usual here,
 * because **the thing this reader replaces failed silently in the direction
 * nobody complains about**: every mtime reset says "too new, keep it", so the
 * population can only grow and no instrument anywhere goes red. Run 3 found it
 * only by reading a record run 2 had preserved on purpose.
 *
 * So the arms below are written the other way round from the usual: for each
 * of the four conditions that make a file sweepable, there is an arm proving
 * that **removing that one condition alone flips the verdict to KEEP**. A
 * reader that dropped a condition would otherwise pass a suite that only ever
 * checked the happy path — and dropping a condition here deletes somebody's
 * working file.
 *
 * The pure readers are driven directly with fixture strings rather than
 * against the disk: the population is untracked scratch that differs on every
 * machine and every hour, so a suite that read it would be asserting against
 * a moving target.
 */
import { describe, expect, it } from "vitest";
import {
  citationsFrom, nameAnchorOf, sweepable, untrackedDisposables, type Verdict,
} from "../scripts/disposable-age.mts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-09T00:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("untrackedDisposables — the population, and only the population", () => {
  const PORCELAIN = [
    "?? scripts/_429-plan-disposable.mts",
    "?? scripts/court-ink-plate-disposable.mts",
    "?? scripts/_briefing-e88-disposable.mts",
    /* NOT disposables: an untracked helper the team means to keep. */
    "?? scripts/lib/sabotage.mts",
    "?? scripts/_429-notes.md",
    /* NOT under scripts/. */
    "?? output/_500-frames-disposable.mts",
    "?? 692-evidence-dark.png",
    /* NOT untracked — a staged add and a modification. */
    "A  scripts/_777-staged-disposable.mts",
    " M scripts/deploy-rite.mts",
  ].join("\n");

  it("takes every untracked disposable under scripts/", () => {
    expect(untrackedDisposables(PORCELAIN)).toEqual([
      "scripts/_429-plan-disposable.mts",
      "scripts/court-ink-plate-disposable.mts",
      "scripts/_briefing-e88-disposable.mts",
    ]);
  });

  it("NEGATIVE CONTROL — a tracked, staged or non-disposable file is never in it", () => {
    const got = untrackedDisposables(PORCELAIN);
    /* Each of these is a way a real sweep could have eaten a file that is not
       litter: a staged new script, a modified tracked one, an untracked lib. */
    expect(got).not.toContain("scripts/_777-staged-disposable.mts");
    expect(got).not.toContain("scripts/deploy-rite.mts");
    expect(got).not.toContain("scripts/lib/sabotage.mts");
    expect(got).not.toContain("scripts/_429-notes.md");
    expect(got).not.toContain("output/_500-frames-disposable.mts");
  });

  it("reads a quoted path — git quotes any name it considers unusual", () => {
    expect(untrackedDisposables('?? "scripts/_1-a b-disposable.mts"'))
      .toEqual(["scripts/_1-a b-disposable.mts"]);
  });
});

describe("nameAnchorOf — what artifact does the name point at", () => {
  it("reads a card number", () => {
    expect(nameAnchorOf("scripts/_429-plan-disposable.mts")).toEqual({ kind: "card", id: 429 });
    expect(nameAnchorOf("scripts/_7_probe-disposable.mts")).toEqual({ kind: "card", id: 7 });
  });

  it("reads a briefing edition, and the edition shape wins over the card shape", () => {
    expect(nameAnchorOf("scripts/_briefing-e88-disposable.mts")).toEqual({ kind: "edition", id: 88 });
  });

  it("NEGATIVE CONTROL — a name it cannot read anchors at NOTHING, never at a guess", () => {
    /* Every one of these is in the live population, and every one of them must
       stay: `_read-…`, `_probe-…`, `court-…`, `_shift93-…`. A reader that
       invented an anchor for any of them would be deleting a working file. */
    for (const name of [
      "scripts/_read-rows-disposable.mts",
      "scripts/_probe-wall-disposable.mts",
      "scripts/court-ink-plate-disposable.mts",
      "scripts/_shift93-tables-disposable.mts",
      "scripts/_-disposable.mts",
    ]) expect(nameAnchorOf(name), name).toBeNull();
  });

  it("refuses a number too long to be a card in this repository", () => {
    /* Five digits is a date or a pixel width, not an issue. The reader keeps
       what it cannot name, so a wrong guess here is the expensive direction. */
    expect(nameAnchorOf("scripts/_20260830-sweep-disposable.mts")).toBeNull();
  });
});

describe("citationsFrom — a KEEP is a citation", () => {
  const POPULATION = [
    "scripts/_429-plan-disposable.mts",
    "scripts/_430-other-disposable.mts",
    "scripts/court-ink-plate-disposable.mts",
  ];

  it("POSITIVE CONTROL — finds the tracked file that names one", () => {
    const grep = [
      "docs/specs/INK_COURT.md:12:the strip was built by `scripts/court-ink-plate-disposable.mts`",
      "docs/JANITOR_LOG.md:400:| `scripts/_429-plan-disposable.mts` | kept |",
    ].join("\n");
    const found = citationsFrom(grep, POPULATION);
    expect(found.get("scripts/court-ink-plate-disposable.mts")).toEqual(["docs/specs/INK_COURT.md"]);
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["docs/JANITOR_LOG.md"]);
  });

  it("NEGATIVE CONTROL — a line naming a DIFFERENT disposable is not a citation of this one", () => {
    /* The failure this catches is the one that would matter: a substring pass
       that credited `_43-…` with `_430-…`'s citation, or credited every file
       on the line to every file in the population. */
    const found = citationsFrom(
      "docs/x.md:1:see scripts/_430-other-disposable.mts for the arm",
      POPULATION,
    );
    expect(found.get("scripts/_430-other-disposable.mts")).toEqual(["docs/x.md"]);
    expect(found.get("scripts/_429-plan-disposable.mts")).toBeUndefined();
    expect(found.get("scripts/court-ink-plate-disposable.mts")).toBeUndefined();
  });

  it("counts one citing file once however many times it names the file", () => {
    const found = citationsFrom([
      "docs/x.md:1:scripts/_429-plan-disposable.mts",
      "docs/x.md:9:scripts/_429-plan-disposable.mts again",
      "docs/y.md:2:scripts/_429-plan-disposable.mts",
    ].join("\n"), POPULATION);
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["docs/x.md", "docs/y.md"]);
  });

  it("POSITIVE CONTROL — sees the population's own INTERNAL edges", () => {
    /*
      The reader folds each untracked disposable's own text into the same
      `path:line:text` shape, because `git grep` reads tracked files only.
      Measured live before that existed: of 131 sweep candidates, 3 were named
      by files being KEPT — `_327-max-author-read` by `_466-authorread` and
      `_477-court-read`, `_327-strip` by `_477-strip`, `_briefing-e81` by
      `_patch195l` — and all 3 would have been deleted from under a script
      that still names them. Twelve scripts were restored for this same hole
      during the original purge.
    */
    const found = citationsFrom(
      "scripts/_430-other-disposable.mts:0:import x from \"./_429-plan-disposable.mts\";",
      POPULATION,
    );
    expect(found.get("scripts/_429-plan-disposable.mts")).toEqual(["scripts/_430-other-disposable.mts"]);
  });

  it("NEGATIVE CONTROL — a file naming ITSELF is not cited", () => {
    /* Every one of these scripts prints its own name in its own header, so
       without the self-exclusion the whole population reads as cited and the
       sweep can never fire — the hoarding failure this card is about, arriving
       through the repair for it. */
    const found = citationsFrom(
      "scripts/_429-plan-disposable.mts:0: * npx tsx scripts/_429-plan-disposable.mts",
      POPULATION,
    );
    expect(found.get("scripts/_429-plan-disposable.mts")).toBeUndefined();
  });

  it("is empty when git grep matched nothing at all", () => {
    expect(citationsFrom("", POPULATION).size).toBe(0);
  });
});

describe("sweepable — four conditions, and dropping ANY ONE must flip it to KEEP", () => {
  /*
    THE ARM SHAPE THAT MATTERS. Each case below is the sweepable base with
    exactly one condition spoiled, so a reader that stopped checking that
    condition passes every other arm in this file and fails only here. This is
    the deletion decision; a suite that only proved the happy path would be
    green over a reader that deletes a cited file, an open card's file, or a
    file somebody edited this morning.
  */
  const base: Verdict = {
    file: "scripts/_429-plan-disposable.mts",
    anchor: { kind: "card", id: 429, at: ago(30), note: "#429 closed" },
    citations: [],
    mtime: ago(30),
  };

  it("sweeps when all four hold", () => {
    expect(sweepable(base, 7, NOW)).toBe(true);
  });

  it("KEEPS a file a tracked document cites, however old", () => {
    expect(sweepable({ ...base, citations: ["docs/specs/A_COURT.md"] }, 7, NOW)).toBe(false);
  });

  it("KEEPS a file whose name resolves to nothing", () => {
    expect(sweepable({ ...base, anchor: { kind: "none", note: "unresolved" } }, 7, NOW)).toBe(false);
  });

  it("KEEPS a file whose artifact is inside the window", () => {
    expect(sweepable({ ...base, anchor: { kind: "card", id: 429, at: ago(3), note: "" } }, 7, NOW)).toBe(false);
  });

  it("KEEPS a file somebody has touched inside the window, even with an old artifact", () => {
    /* The mtime can only ever HOLD A DELETION BACK — the mass reset made files
       look newer, never older — so requiring it to agree costs nothing and
       protects the case where an old card's script is being reused today. */
    expect(sweepable({ ...base, mtime: ago(1) }, 7, NOW)).toBe(false);
  });

  it("respects a wider window", () => {
    expect(sweepable(base, 7, NOW)).toBe(true);
    expect(sweepable(base, 60, NOW)).toBe(false);
  });
});

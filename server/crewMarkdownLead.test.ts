/**
 * WHAT COUNTS AS DECORATION, AND WHAT MUST NEVER BE TREATED AS DECORATION
 * (#1559).
 *
 * Two readers of a card body were defeated by ordinary markdown and both failed
 * toward SILENCE: a release written under a heading left #180 reading as
 * `claimed` for twelve hours, and a `**Waiting on:**` line inside a blockquote
 * left #1414 held on his eye with nothing on his desk asking for it.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IN THIS FILE IS THE ONE THAT PROVES WHAT IS
 * *NOT* STRIPPED.** The tempting shape — remove every leading `>`, `#`, `-`
 * **and `*`** — repairs the release reader and breaks the hold reader in the
 * same stroke, because the hold marker is literally `**Waiting on:**`. One
 * silence traded for another is the worst possible outcome here, and it would
 * have looked like a fix.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { blockOpeningLines, decoratedLines, stripBlockLead } from "../shared/crewMarkdownLead";
import { withoutComments } from "./testing/withoutComments";

describe("block decoration is stepped over", () => {
  it("removes the markers markdown uses to say what KIND of block a line is", () => {
    expect(stripBlockLead("> RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead(">> RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("> > RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("## RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("###### RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("- RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("+ RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("* RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("1. RELEASED — a seat")).toBe("RELEASED — a seat");
    expect(stripBlockLead("2) RELEASED — a seat")).toBe("RELEASED — a seat");
    /* Nested, which is what a blockquoted bullet under a heading actually looks
       like — and the shape #1414's line was one level of. */
    expect(stripBlockLead(">   - **Waiting on:** YOU")).toBe("**Waiting on:** YOU");
    /* Leading whitespace alone. */
    expect(stripBlockLead("    RELEASED — a seat")).toBe("RELEASED — a seat");
    /* Nothing to strip is the identity, not a trim of the tail. */
    expect(stripBlockLead("RELEASED — a seat  ")).toBe("RELEASED — a seat  ");
    expect(stripBlockLead("")).toBe("");
  });

  it("⚠ NEVER strips inline emphasis — the hold marker's own text begins with it", () => {
    /*
      THE CONTROL THIS WHOLE MODULE EXISTS FOR. `CREW_HOLD_MARKER` is
      `**Waiting on:**`, and `holdReasonFromBody` matches it with `startsWith`.
      A stripper that ate leading asterisks would hand that function
      `Waiting on:**` and the marker would be unfindable — the same silence,
      arrived at by the repair.
    */
    expect(stripBlockLead("**Waiting on:** YOU")).toBe("**Waiting on:** YOU");
    expect(stripBlockLead("**RELEASED — a seat**")).toBe("**RELEASED — a seat**");
    expect(stripBlockLead("> **Waiting on:** YOU")).toBe("**Waiting on:** YOU");
    expect(stripBlockLead("*RELEASED*")).toBe("*RELEASED*");
    expect(stripBlockLead("_RELEASED_")).toBe("_RELEASED_");
    expect(stripBlockLead("__Waiting on:__")).toBe("__Waiting on:__");
  });

  it("tells a bullet from emphasis by the space markdown itself requires", () => {
    /*
      `* x` is a list item; `*x*` is emphasis. The distinction is the only reason
      `*` can be in the block set at all, and it is one character wide.
    */
    expect(stripBlockLead("* RELEASED")).toBe("RELEASED");
    expect(stripBlockLead("*RELEASED")).toBe("*RELEASED");
    expect(stripBlockLead("**RELEASED")).toBe("**RELEASED");
    /* Same for a heading: `#1559` is a card number, not an H1. */
    expect(stripBlockLead("#1559 is the card")).toBe("#1559 is the card");
    expect(stripBlockLead("# 1559 is a heading")).toBe("1559 is a heading");
    /* And a dash that is part of a word, not a bullet. */
    expect(stripBlockLead("-RELEASED")).toBe("-RELEASED");
  });

  it("gives back every line, in order, so a reader cannot lose one", () => {
    const body = "## Heading\n\n> **Waiting on:** YOU\n- a bullet\nplain\n";
    expect(decoratedLines(body)).toEqual([
      "Heading",
      "",
      "**Waiting on:** YOU",
      "a bullet",
      "plain",
      "",
    ]);
    /* CRLF, because GitHub hands bodies back with it and a reader that split on
       `\n` alone would carry a trailing `\r` into every match. */
    expect(decoratedLines("> a\r\n# b\r\n")).toEqual(["a", "b", ""]);
  });
});

describe("a line that OPENS a block, which is stricter than any line", () => {
  /*
    ⚠ THE ARM BELOW IS A FINDING, NOT A PRECAUTION. The first shape of #1559's
    repair read EVERY line, and the negative control written for it — *prose
    about releasing is still not a release* — went red on its own fixture: a
    hard-wrapped paragraph puts `RELEASED — Foreman (night shift) on #1492
    while…` at the start of line two, and a per-line reader cannot tell that
    from a handback. A missed release idles a seat; a false release cancels a
    live claim and two seats build the same card, so the expensive direction
    earns the stricter rule.
  */
  it("refuses a continuation line, which is what a wrapped paragraph is made of", () => {
    const wrapped = [
      "⚠ Worth knowing for whoever takes this: the previous shift posted",
      "RELEASED — Foreman (night shift) on #1492 while its part 2 was still held.",
    ].join("\n");
    expect(decoratedLines(wrapped)).toHaveLength(2);
    expect(blockOpeningLines(wrapped)).toEqual([
      "⚠ Worth knowing for whoever takes this: the previous shift posted",
    ]);
  });

  it("takes the first line, a line after a blank one, and a line after a heading", () => {
    /*
      The heading clause is not decoration: a shift writes `## Handover` and the
      release on the very next line with no blank between, markdown starts a new
      block there, and without this that shape would be a new silence of exactly
      the class this card is about.
    */
    expect(blockOpeningLines("first line only")).toEqual(["first line only"]);
    expect(blockOpeningLines(["a paragraph", "", "> RELEASED — a seat"].join("\n")))
      .toEqual(["a paragraph", "RELEASED — a seat"]);
    expect(blockOpeningLines(["## Handover", "**RELEASED — a seat**"].join("\n")))
      .toEqual(["Handover", "**RELEASED — a seat**"]);
    /* A blockquoted heading opens a block too — the shape a quoted ruling takes. */
    expect(blockOpeningLines(["> ## Quoted heading", "**RELEASED — a seat**"].join("\n")))
      .toEqual(["Quoted heading", "**RELEASED — a seat**"]);
    /* A line whose only content was decoration counts as BLANK, so a lone `>`
       separator does not swallow the line beneath it — the release below it is
       still an opener. The `>` line itself is not one, which is right: it
       carries no text to match against. */
    expect(blockOpeningLines(["a paragraph", ">", "RELEASED — a seat"].join("\n")))
      .toEqual(["a paragraph", "RELEASED — a seat"]);
  });

  it("is a SUBSET of every line, never a different set — so it can only ever be stricter", () => {
    /*
      The property that makes this safe to reason about. A bug that made an
      opener out of something `decoratedLines` never produced would be invisible
      to every arm above, and would be the one way this could get LOOSER.
    */
    const body = ["# H", "one", "two", "", "> three", "- four", "", "", "five"].join("\r\n");
    const every = decoratedLines(body);
    const openers = blockOpeningLines(body);
    expect(openers.length).toBeLessThanOrEqual(every.length);
    for (const line of openers) expect(every, `"${line}" is not a line of the body`).toContain(line);
  });
});

describe("one place, not two — the readers source it rather than copying it", () => {
  /*
    Working law 4, armed. The moment this rule had two readers in two files, a
    copy in each is the drift that produced #1559 in the first place — and the
    two live in different modules, so nothing would have made them disagree
    loudly. An import is not a call site (CLAUDE.md), so each arm looks for the
    USE and not only the import line.

    ⚠ Each consumer is pinned to the reader it should be using, not merely to
    "one of them": the comment reader wants the STRICT population (a false
    release costs a collision) and the hold reader wants EVERY line (its marker
    is the specific string `**Waiting on:**` rather than a common English word,
    so narrowing it would buy a silence for nothing). Swapping them would be a
    real regression that a looser arm would wave through.
  */
  const consumers = [
    { path: "shared/crewCardBuildState.ts", reader: "blockOpeningLines", why: "a false release cancels a live claim" },
    { path: "shared/crewNextUpHold.ts", reader: "decoratedLines", why: "its marker cannot collide with prose" },
  ] as const;

  it("each card-body reader calls the shared stripper, through the population it needs", () => {
    for (const { path, reader, why } of consumers) {
      const source = readFileSync(path, "utf8");
      expect(source, `${path} must import it`).toContain('from "./crewMarkdownLead"');
      expect(source, `${path} must USE ${reader} — ${why}`).toMatch(new RegExp(`${reader}\\(`));
    }
  });

  it("neither reader kept its own line splitter", () => {
    /*
      The failure this forbids is a repair that adds the shared reader and
      leaves the old walk beside it — one road still blind, and a suite green
      because the other one answers.
    */
    for (const { path, reader } of consumers) {
      const source = readFileSync(path, "utf8");
      const code = withoutComments(source);
      /*
        ⚠ THE POSITIVE CONTROL, ADDED BY #1636's CREW SLICE BECAUSE THIS ARM
        PASSED OVER AN EMPTY STRING. Driven rather than reasoned: with the
        shared reader stubbed to return the empty string, four of the six
        suites in this group reddened and this one stayed green on all nine
        arms. A `.not.toMatch()` is satisfied by nothing at all, so the
        absence below was guarding whatever the reader happened to hand it.
        Asserting that the reader's OWN call survives the strip is the
        cheapest thing that cannot be satisfied by silence.
      */
      expect(code, `${path} did not survive the stripper`).toContain(`${reader}(`);
      expect(code, `${path} splits lines itself`).not.toMatch(/\.split\(\/\\r\?\\n\//);
    }
  });
});

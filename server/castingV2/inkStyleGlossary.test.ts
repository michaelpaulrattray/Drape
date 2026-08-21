import { describe, expect, it } from "vitest";

import {
  INK_STYLES,
  inkStyleClause,
  inkStyleNamedIn,
} from "./inkStyleGlossary";

/**
 * THE STYLE GLOSSARY — founder-ordered (fable-1313 §2) after his own
 * cybersigilism neck tattoo came back as circuitry.
 *
 * The arms below are about the two ways a vocabulary like this fails: it names
 * a style in a sentence that never mentioned one (a clause on a paid prompt
 * about nothing), or it picks the WRONG entry when two names contain each
 * other. Both are cheap to write and neither is caught by reading the table.
 */
describe("the glossary reads what she actually named", () => {
  it("POSITIVE CONTROL — finds the style his own test misfired on", () => {
    const style = inkStyleNamedIn("a cybersigilism tattoo on his neck");
    expect(style?.key).toBe("cybersigilism");
  });

  it("NEGATIVE CONTROL — a sentence naming no style yields NOTHING", () => {
    /*
      The half that makes this safe to consult on every ink road. If a style
      clause could appear on an ask that never named one, the glossary would be
      writing instructions into paid prompts about a style nobody chose.
    */
    expect(inkStyleNamedIn("a small swallow on his neck")).toBeNull();
    expect(inkStyleClause("a small swallow on his neck")).toBe("");
    expect(inkStyleClause("")).toBe("");
    expect(inkStyleClause(null)).toBe("");
    expect(inkStyleClause(undefined)).toBe("");
  });

  it("takes the LONGEST name, so a compound style is never read as its suffix", () => {
    /*
      `neo-traditional` contains `traditional`, and they are different palettes.
      Matched by the shorter name, an ask for one would be painted as the other
      — a wrong answer wearing a right one's clothes.
    */
    expect(inkStyleNamedIn("a neo-traditional rose")?.key).toBe("neoTraditional");
    expect(inkStyleNamedIn("an american traditional rose")?.key).toBe("americanTraditional");
    expect(inkStyleNamedIn("a traditional rose")?.key).toBe("americanTraditional");
  });

  it("does not care whether she typed a hyphen, a space or neither", () => {
    for (const said of ["fine line florals", "fine-line florals", "fineline florals"]) {
      expect(inkStyleNamedIn(said)?.key).toBe("fineLine");
    }
  });

  it("matches on WORD BOUNDARIES — a style name inside another word is not a style", () => {
    /* "tribalism" is not "tribal", and a substring match would file it as one. */
    expect(inkStyleNamedIn("a design about tribalism")).toBeNull();
    expect(inkStyleNamedIn("a tribal design")?.key).toBe("tribal");
  });

  it("returns at most ONE style — two clauses would be two instructions", () => {
    /*
      The transform road's own rule, one lane along: two descriptions of how to
      draw one design contradict each other on the wire, and the engine picks.
    */
    const style = inkStyleNamedIn("a blackwork dotwork geometric piece");
    expect(style).not.toBeNull();
    expect(inkStyleClause("a blackwork dotwork geometric piece").match(/The style named is/g))
      .toHaveLength(1);
  });
});

describe("the clause says what to paint and what NOT to", () => {
  it("carries the NOT-clause where the name misleads — the half that does the work", () => {
    const clause = inkStyleClause("give him a cybersigilism piece on his neck");
    expect(clause).toContain("ultra-fine spiky ornamental linework");
    /* Without this the description merely competes with the engine's prior; his
       frame is the evidence that the prior wins. */
    expect(clause).toContain("NOT circuitry");
    expect(clause).toContain("nothing that depicts technology");
  });

  it("says NOTHING extra where the name is honest", () => {
    /* Dotwork really is made of dots. An invented refusal here would be noise
       on a paid prompt, so the field is absent rather than filled. */
    const dotwork = INK_STYLES.find((style) => style.key === "dotwork")!;
    expect(dotwork.not).toBeUndefined();
    expect(inkStyleClause("a dotwork mandala")).not.toContain("It is not");
  });
});

describe("the table itself holds together", () => {
  it("carries every style the ruling seeded", () => {
    /* fable-1313 §2's own list. A seed set that quietly loses a member is a
       glossary that silently stops answering for it. */
    const keys = new Set(INK_STYLES.map((style) => style.key));
    for (const key of [
      "cybersigilism", "fineLine", "americanTraditional", "neoTraditional", "irezumi",
      "blackwork", "dotwork", "tribal", "chicano", "geometric", "ignorantStyle",
      "biomechanical", "watercolour",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("has unique keys and unique names — an ambiguous name is an unanswerable ask", () => {
    const keys = INK_STYLES.map((style) => style.key);
    expect(new Set(keys).size).toBe(keys.length);
    const names = INK_STYLES.flatMap((style) => style.names.map((name) => name.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
  });

  it("every entry can actually be reached by its own names", () => {
    /* The table and the matcher agreeing is not obvious: a name with a
       character the flattener eats would sit in the table unreachable — the
       unreachable-copy class, in a vocabulary. */
    for (const style of INK_STYLES) {
      for (const name of style.names) {
        expect(inkStyleNamedIn(`a ${name} tattoo`)?.key).toBe(style.key);
      }
    }
  });
});

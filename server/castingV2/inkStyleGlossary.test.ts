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
    /*
      ⚠ THIS LINE ASSERTED THE DEFECT AND THE ANSWER HAS CHANGED, deliberately
      (fable-1390 §1). It read `americanTraditional`, because bare `traditional`
      matched anything after it — which is the same match that put a sailor
      palette on *"a traditional chinese dragon"*.

      `traditional` is now a BARE name and needs a marker, so a phrase where the
      next word names a SUBJECT goes quiet. The cost is admitted rather than
      hidden: *"a traditional rose"* is a phrase a tattooist would mean as
      American traditional, and the rule cannot tell it from *"a traditional
      chinese dragon"*. The ruled direction is silence, because an unfired
      clause composes the prompt this product composed for months and a wrongly
      fired one replaces her design.

      One word later it fires again, which is the shape of the whole rule.
    */
    expect(inkStyleNamedIn("a traditional rose")).toBeNull();
    expect(inkStyleNamedIn("a traditional rose tattoo")).toBeNull();
    expect(inkStyleNamedIn("a traditional tattoo of a rose")?.key).toBe("americanTraditional");
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

/*
  ⚠ THE OVER-TRIGGER CORPUS — the court's own cells, committed (fable-1390 §1a).

  Ordered fable-1384, run opus-1036: `geometric` and `traditional` are style
  names AND ordinary English, so an ask that never mentioned a style drew a
  style clause. Nineteen names in the glossary are ordinary words, and before
  the fix nineteen of nineteen ordinary asks fired.

  # THE HARM COLUMN IS HONEST, AND ONE CELL'S HARM WAS OVERRULED

  Only ONE cell has proven customer harm at the frames, and it is the geometric
  pair: "a small geometric skeleton design" delivered a wide symmetric mandala
  across the whole throat with a skull at its centre, where the same ask without
  the adjective delivered the small side-of-neck skeleton figure she asked for.

  The `traditional` pair's frames were rendered too, and the founder judged them
  BOTH acceptable ("traditional came out japanese traditional and its correct
  and the plain classic chineese dragon tattoo was correct also", fable-1392) —
  overruling both the engineer's eye and the reviewer's. So its cell stands on
  the MECHANISM (an entry's paint string reached a prompt that did not name that
  entry) and never on damage. **Nobody may cite the dragon pair as customer
  harm.**

  # AND THE ADVERSARIAL CELLS STAY MARKED ADVERSARIAL

  "a black work boot" and "a book of sacred geometry" are not sentences a
  customer types. They are in the corpus because they probe the mechanism, and
  they are labelled so that a later reader cannot mistake the corpus's size for
  a measurement of real exposure.
*/
type OverTriggerCell = {
  said: string;
  /** The key the fixed matcher must answer, or null. */
  expect: string | null;
  kind: "plausible" | "adversarial" | "style-ask";
  why: string;
};

const CORPUS: readonly OverTriggerCell[] = [
  /* ---- the ordinary-English asks that must now be QUIET ---- */
  { said: "a small geometric skeleton design on her neck", expect: null, kind: "plausible", why: "PROVEN HARM AT THE FRAMES — a throat mandala replaced her small skeleton" },
  { said: "a geometric wolf head on his neck", expect: null, kind: "plausible", why: "the adjective describes the wolf; the safe direction is silence" },
  { said: "a traditional chinese dragon tattoo on his neck", expect: null, kind: "plausible", why: "MECHANISM ONLY — he judged the fired frame acceptable (fable-1392)" },
  { said: "a japanese maple leaf on her neck", expect: null, kind: "plausible", why: "irezumi's koi, dragons and saturated colour onto a delicate leaf" },
  { said: "the japanese word for courage on his neck", expect: null, kind: "plausible", why: "a nationality before it is a style" },
  { said: "a tribal mask portrait on his neck", expect: null, kind: "plausible", why: "the mask is tribal, the tattoo is a portrait" },
  { said: "an old school telephone on her neck", expect: null, kind: "adversarial", why: "the spelling trap — `old school` marked, `old-school` not, both flatten alike" },
  { said: "a black work boot on his neck", expect: null, kind: "adversarial", why: "two ordinary words beside each other" },
  { said: "a blackout curtain design on her neck", expect: null, kind: "adversarial", why: "the marker rule is about the word IMMEDIATELY after, which is `curtain`" },
  { said: "a dot work of art on her neck", expect: null, kind: "adversarial", why: "the closed-up `dotwork` is the coined one" },
  { said: "an ignorant slogan on his neck", expect: null, kind: "adversarial", why: "`ignorant` alone is ordinary English" },

  /* ---- cells that still fire, DELIBERATELY, and each one is a judgement ---- */
  { said: "a traditional maori design on his neck", expect: "tribal", kind: "plausible", why: "the answer CHANGED and improved: `traditional` is gated, `maori` is not, and maori work IS the tribal tradition" },
  { said: "a fine line of stars across her collarbone", expect: "fineLine", kind: "adversarial", why: "`fine line` is NOT bare — in a tattoo ask it essentially always means the style, and thin delicate linework is harmless here anyway" },
  { said: "a stipple portrait of her dog on her neck", expect: "dotwork", kind: "style-ask", why: "`stipple` names the technique; this ask really is dotwork" },
  { said: "a watercolor palette and brush on her neck", expect: "watercolour", kind: "adversarial", why: "not bare — a customer typing `watercolor` in a tattoo ask means the style" },
  { said: "a biomechanical prosthetic hand on his neck", expect: "biomechanical", kind: "style-ask", why: "not bare — and the biomech clause is the right answer for this subject" },
  { said: "a chicano flag on his neck", expect: "chicano", kind: "adversarial", why: "not bare — an ethnonym, but in a tattoo ask it is the style" },
  { said: "a single needle and thread on her neck", expect: "fineLine", kind: "adversarial", why: "not bare — `single needle` is a tattooing term first" },
  { said: "a micro realism portrait on her neck", expect: "fineLine", kind: "style-ask", why: "not bare — this ask really is micro realism" },
  { said: "a book of sacred geometry on his neck", expect: "geometric", kind: "adversarial", why: "not bare — `sacred geometry` is a compound nobody says by accident" },

  /* ---- the marker rule's own positives: a bare name that IS the ask ---- */
  { said: "give him a tribal tattoo on his neck", expect: "tribal", kind: "style-ask", why: "bare name + marker" },
  { said: "give her a tribal band on the neck", expect: "tribal", kind: "style-ask", why: "`band` is a marker" },
  { said: "a geometric tattoo on her neck", expect: "geometric", kind: "style-ask", why: "bare name + marker" },
  { said: "a geometric pattern of triangles on her neck", expect: "geometric", kind: "style-ask", why: "`pattern` is a marker" },
  { said: "an american traditional swallow on his neck", expect: "americanTraditional", kind: "style-ask", why: "the COMPOUND name is not bare and matches longest-first" },
  { said: "make the tattoo geometric", expect: "geometric", kind: "style-ask", why: "a bare name as the LAST thing she said needs no marker" },
];

describe("a style name that is also an ordinary word", () => {
  for (const cell of CORPUS) {
    it(`[${cell.kind}] "${cell.said}" reads as ${cell.expect ?? "no style"}`, () => {
      expect(inkStyleNamedIn(cell.said)?.key ?? null, cell.why).toBe(cell.expect);
    });
  }

  it("the proven-harm pair differs ONLY by the adjective, and NEITHER fires now", () => {
    /* The controlled pair as an arm rather than as prose: this is the whole
       evidence that the clause replaced her design rather than tuning it, and
       after the fix both members compose the same prompt. */
    expect(inkStyleNamedIn("give him a small geometric skeleton design on his neck")).toBeNull();
    expect(inkStyleNamedIn("give him a small skeleton design on his neck")).toBeNull();
  });

  it("EVERY name in the glossary is classified — an unclassified name fails CLOSED", () => {
    /*
      Condition (b) of fable-1390 §1, made mechanical. The bare judgement is a
      human one and cannot be derived, so what is enforced instead is that
      nobody may SKIP it: this list pins every name in the vocabulary with its
      verdict, and a style added later arrives here as a failing test asking to
      be classified rather than as a silent `false`.
    */
    const BARE = [
      "tribal", "ignorant", "old school", "old-school", "traditional",
      "japanese", "black work", "black out", "blackout", "dot work", "geometric",
    ];
    const COINED = [
      "cybersigilism", "cyber sigilism", "cybersigil", "cyber sigil",
      "polynesian", "maori", "neotribal", "neo tribal",
      "biomechanical", "biomech", "bio mechanical", "bio-mech",
      "ignorant style", "ignorant-style", "naive style",
      "fine line", "fine-line", "fineline", "single needle", "single-needle",
      "micro realism", "microrealism",
      "american traditional", "sailor jerry",
      "neo traditional", "neo-traditional", "neotraditional",
      "irezumi", "japanese traditional", "tebori", "horimono",
      "blackwork", "dotwork", "stippling", "stipple",
      "sacred geometry", "linework geometric",
      "chicano", "chicanx", "black and grey chicano",
      "watercolour", "watercolor", "water colour", "water color",
    ];
    const classified = new Set([...BARE, ...COINED]);
    const unclassified = INK_STYLES
      .flatMap((style) => style.names)
      .filter((name) => !classified.has(name));
    expect(unclassified,
      "classify these names as bare (ordinary English, needs a marker) or coined, "
      + "then add them to the list in this test").toEqual([]);

    /* And the other direction: a name that left the vocabulary must leave this
       list too, or the list is a second source of truth that agrees with
       nothing (law 4). */
    const inVocabulary = new Set(INK_STYLES.flatMap((style) => style.names));
    expect([...classified].filter((name) => !inVocabulary.has(name))).toEqual([]);

    /*
      The marking on the entries must account for the verdict here — a reason
      written beside a word the matcher does not treat as bare is a comment, not
      a control.

      It is a SUBSET rather than an equality on purpose: bareness is a fact about
      the flattened word, so marking `old school` covers `old-school` too, and
      demanding both be marked would be asking a human to write the same reason
      twice. What is checked is that every bare name has a marked spelling, and
      that every marked spelling is bare.
    */
    const marked = INK_STYLES.flatMap((style) => Object.keys(style.bare ?? {}));
    const flat = (name: string): string => name.toLowerCase().replace(/[\s_-]+/g, " ").trim();
    const markedFlat = new Set(marked.map(flat));
    expect(BARE.filter((name) => !markedFlat.has(flat(name))),
      "these are listed bare above but no entry marks them").toEqual([]);
    expect(marked.filter((name) => !BARE.includes(name)),
      "these are marked bare on an entry but are not in the list above").toEqual([]);
  });

  it("every bare marking carries its REASON — the judgement is reviewable or it is not made", () => {
    for (const style of INK_STYLES) {
      for (const [name, why] of Object.entries(style.bare ?? {})) {
        expect(style.names, `${style.key} marks "${name}" bare but does not list it`).toContain(name);
        expect(why ?? "", `${style.key}.bare["${name}"] needs a reason`).not.toBe("");
        expect((why ?? "").length, `${style.key}.bare["${name}"] needs a reason`).toBeGreaterThan(20);
      }
    }
  });
});

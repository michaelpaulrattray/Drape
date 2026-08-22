/**
 * THE ONE OWNER OF *WHAT IS THIS PERSON WEARING* — condition (v)'s arms
 * (design §3.1a / §3.3, countersigned fable-1334 §2).
 *
 * The resolution is three lines of code and it is worth this many arms for one
 * reason: **its failure mode is refunded slices rather than an exception.** A
 * Cast signed after a wardrobe edit, judged against the born line it is no
 * longer wearing, fails the wardrobe axis on six paid views — which is not a
 * hypothetical, it is how the crew-neck chest design already cost money.
 *
 * So the arms are about the ORDER of precedence and about the third case the
 * design implies without naming, not about the plumbing.
 */
import { describe, expect, it } from "vitest";

import {
  HOUSE_WARDROBE_LINE,
  basicsWardrobeLine,
  bornWardrobeLine,
  currentWardrobeLine,
  type WardrobeResolution,
} from "./wardrobeLine";

/** The only two facts a pre-paths roll has, which is every production roll today. */
const UNPATHED = { rollPath: null, rollLine: null } as const;

describe("condition (v) — the edited line wins", () => {
  it("prefers this branch's edit over the sheet's born line", () => {
    /*
      THE WHOLE POINT. Everything else in this file is guarding the edges of
      this one sentence.
    */
    const resolved = currentWardrobeLine({
      rollPath: "wardrobe",
      rollLine: "a dark canvas work jacket, straight jeans, plain boots",
      editedLine: "a cream linen shirt, straight jeans, plain boots",
    });
    expect(resolved).toEqual<WardrobeResolution>({
      kind: "line",
      line: "a cream linen shirt, straight jeans, plain boots",
      source: "edited",
      path: "wardrobe",
    });
  });

  it("falls to the born line when this branch has not been edited", () => {
    const resolved = currentWardrobeLine({
      rollPath: "wardrobe",
      rollLine: "a dark canvas work jacket, straight jeans, plain boots",
    });
    expect(resolved).toEqual<WardrobeResolution>({
      kind: "line",
      line: "a dark canvas work jacket, straight jeans, plain boots",
      source: "born",
      path: "wardrobe",
    });
  });

  it("⚠ reports its SOURCE, so a caller that must have the born line cannot guess", () => {
    /*
      The Follow is the one caller allowed the born column by name, and the way
      it stays the only one is that everybody else can SEE which answer they
      got. A resolution that returned a bare string would make "is this the
      sheet's outfit or this person's?" unanswerable at the call site — and
      that question is the difference between eight strangers dressed in one
      person's mid-session change and eight strangers dressed as the sheet.
    */
    const edited = currentWardrobeLine({ rollPath: "basics", rollLine: "a", editedLine: "b" });
    const born = currentWardrobeLine({ rollPath: "basics", rollLine: "a" });
    expect(edited.kind === "line" && edited.source).toBe("edited");
    expect(born.kind === "line" && born.source).toBe("born");
  });

  it("treats a blank or whitespace edit as no edit at all", () => {
    /*
      A stored empty string is what a half-written form produces, and "she is
      wearing nothing in particular" is not an outfit — it is the absence of
      one wearing a value's clothes. The born line is the honest answer.
    */
    for (const blank of ["", "   ", "\n\t "]) {
      const resolved = currentWardrobeLine({
        rollPath: "wardrobe",
        rollLine: "a grey tee, straight jeans, plain shoes",
        editedLine: blank,
      });
      expect(resolved.kind === "line" && resolved.source, JSON.stringify(blank)).toBe("born");
    }
  });

  it("trims, so a stored line cannot differ from itself by whitespace", () => {
    const resolved = currentWardrobeLine({
      rollPath: "wardrobe",
      rollLine: "  a grey tee, straight jeans, plain shoes\n",
    });
    expect(resolved.kind === "line" && resolved.line).toBe("a grey tee, straight jeans, plain shoes");
  });
});

describe("the unpathed roll — every roll in production as this lands", () => {
  it("is `unpathed`, which is a state and not a failure", () => {
    expect(currentWardrobeLine(UNPATHED)).toEqual<WardrobeResolution>({ kind: "unpathed" });
  });

  it("⚠ stays `unpathed` even if a line somehow got written without a path", () => {
    /*
      The more helpful answer — "there is a line, use it" — is the wrong one.
      It would make a half-written row indistinguishable from a whole one at
      every reader downstream, and the readers downstream paint and judge paid
      frames. A line nobody chose a path for is not something to dress a render
      in.
    */
    expect(currentWardrobeLine({ rollPath: null, rollLine: "a grey tee" }))
      .toEqual<WardrobeResolution>({ kind: "unpathed" });
    expect(currentWardrobeLine({ rollPath: null, rollLine: null, editedLine: "a grey tee" }))
      .toEqual<WardrobeResolution>({ kind: "unpathed" });
  });
});

describe("⚠ the incoherent roll — pathed, and unable to say what it is wearing", () => {
  /*
    THIS CASE CANNOT BE PRODUCED BY THE WRITE PATH, and it is named anyway.

    A path and a line are stamped in one insert, so `basics` with no line is a
    row nothing writes. It gets a name rather than being folded into `unpathed`
    because the two demand OPPOSITE behaviour: `unpathed` means *paint what you
    always painted*, and on the Basics path that would put a plain grey tee on
    a cast whose entire purpose is a bare chest — silently, and in the one
    place the customer would notice last.

    "Declared unreachable" is how a corner ends up with no test. This one has
    two.
  */
  it("names itself rather than defaulting", () => {
    expect(currentWardrobeLine({ rollPath: "basics", rollLine: null }))
      .toEqual<WardrobeResolution>({ kind: "incoherent", path: "basics" });
    expect(currentWardrobeLine({ rollPath: "wardrobe", rollLine: "  " }))
      .toEqual<WardrobeResolution>({ kind: "incoherent", path: "wardrobe" });
  });

  it("⚠ NEVER resolves to the house line — that is the silent wrong it exists to prevent", () => {
    const resolved = currentWardrobeLine({ rollPath: "basics", rollLine: null });
    expect(resolved.kind).not.toBe("line");
    expect(JSON.stringify(resolved)).not.toContain("crew-neck");
  });

  it("carries the path, so a refusal can say which one it was", () => {
    const resolved = currentWardrobeLine({ rollPath: "basics", rollLine: null });
    expect(resolved.kind === "incoherent" && resolved.path).toBe("basics");
  });
});

describe("the house line — today's picture, written down", () => {
  it("⚠ names ONE colour, because the `or` is what cost a customer money", () => {
    /*
      The roll prompt says "neutral grey OR off-white" and the signed-view spec
      deliberately names no colour BECAUSE of that or — so a Cast signed in
      off-white had a package whose contract it could not satisfy. A stored
      exact line is what lets generator and judge agree, and it can only do
      that if it is exact.
    */
    expect(HOUSE_WARDROBE_LINE).toContain("neutral grey");
    expect(HOUSE_WARDROBE_LINE).not.toMatch(/\bor\b.*\boff-white\b/);
    expect(HOUSE_WARDROBE_LINE).not.toContain("off-white");
  });

  it("⚠ is COMPLETE — a top, bottoms and footwear", () => {
    /*
      The bottoms are invisible on the master (the sheet is waist-up) and that
      is exactly why they have to be written: the three full-length signed
      views are not waist-up, and today they are told that anything below the
      reference's frame "must not fail this check" — an honest answer to having
      nothing written down, and a wasteful one once something is.

      Asserted by the SHAPE of the sentence rather than by quoting it whole, so
      re-wording the line for taste does not redden an arm about completeness.
    */
    expect(HOUSE_WARDROBE_LINE).toMatch(/\btee\b|\btop\b|\bshirt\b/);
    expect(HOUSE_WARDROBE_LINE).toMatch(/\btrousers\b|\bjeans\b|\bshorts\b/);
    expect(HOUSE_WARDROBE_LINE).toMatch(/\bshoes\b|\bboots\b|\bfeet\b/);
  });

  it("carries nothing the roll prompt's own next sentence forbids", () => {
    /*
      `cohortPhotorealHuman` follows the wardrobe line with "No jackets, no
      accessories, no jewellery, no hats, no props of any kind, nothing held in
      the hands." A default that contradicted the sentence after it would be a
      prompt arguing with itself, and this is the arm that would catch it if
      the house line were ever "improved".
    */
    for (const forbidden of ["jacket", "hat", "jewellery", "necklace", "bag", "logo", "print"]) {
      expect(HOUSE_WARDROBE_LINE.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it("fits the column it will be stored in", () => {
    expect(HOUSE_WARDROBE_LINE.length).toBeLessThanOrEqual(240);
  });
});

describe("⚠ the Basics spec has two forms and `SEXES` has three members", () => {
  /*
    The gap is real and it is the same one `casting_ink_form_demand` exists to
    count. Answered rather than discovered at a customer: anything that is not
    `male` gets the COVERED form.

    The grounds are in the function's docblock and the important half is that
    the covered form loses NO capability — what Basics unlocks is `upperChest`,
    and the spec's own words are that the top is cut low enough to show a chest
    piece. So this is not a lesser option; it is the same option with a top on.
  */
  it("gives the male form a bare chest and everything else the covered one", () => {
    expect(basicsWardrobeLine("male")).toContain("shirtless");
    for (const sex of ["female", "nonbinary", null, undefined, "", "unknown"]) {
      expect(basicsWardrobeLine(sex as string | null), String(sex)).not.toContain("shirtless");
      expect(basicsWardrobeLine(sex as string | null), String(sex)).toContain("sports top");
    }
  });

  it("⚠ keeps the chest reachable on BOTH forms — that is what the path is for", () => {
    /*
      The arm that stops the covered form quietly becoming a crew neck. If the
      default ever stopped showing the upper chest, Basics would still be
      offered, still be charged, and no longer deliver the one placement it
      exists to unlock — which is worse than not offering it.
    */
    expect(basicsWardrobeLine("male")).toContain("shirtless");
    expect(basicsWardrobeLine("female")).toMatch(/scooped low|low at the chest/);
  });

  it("is black on every form, and carries no props", () => {
    for (const sex of ["male", "female", "nonbinary", null]) {
      const line = basicsWardrobeLine(sex as string | null);
      expect(line, String(sex)).toContain("black");
      for (const forbidden of ["logo", "print", "jacket", "hat", "jewellery"]) {
        expect(line.toLowerCase(), `${sex} / ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

describe("the born line — the write side of the same owner", () => {
  it("takes the brief's own outfit on the Wardrobe path", () => {
    expect(bornWardrobeLine({ path: "wardrobe", named: "a red apron over a white tee, dark trousers, plain shoes" }))
      .toBe("a red apron over a white tee, dark trousers, plain shoes");
  });

  it("falls to the house line when the brief named nothing", () => {
    for (const named of [null, undefined, "   "]) {
      expect(bornWardrobeLine({ path: "wardrobe", named }), String(named)).toBe(HOUSE_WARDROBE_LINE);
    }
  });

  it("⚠ REFUSES to let a brief dress a Basics cast", () => {
    /*
      The path IS the outfit. "Born and signed in plain black basics" is what
      the customer chose when she chose the toggle, and a brief that also names
      a red apron has asked for the other path.

      Letting a named outfit through here would make the two paths one path
      with a confusing name — and it would break the promise the Basics toggle
      makes about the chest, which is the only thing a customer picks it for.
    */
    expect(bornWardrobeLine({ path: "basics", sex: "male", named: "a red apron" }))
      .toBe(basicsWardrobeLine("male"));
    expect(bornWardrobeLine({ path: "basics", sex: "female", named: "a ballgown" }))
      .toBe(basicsWardrobeLine("female"));
  });

  it("⚠ never returns a line the column cannot hold", () => {
    /*
      `wardrobeLine` is varchar(240) and MySQL runs STRICT_TRANS_TABLES, so an
      over-long line is an INSERT error in the middle of a paid roll claim
      rather than a truncation. Both house-owned answers are checked here; a
      brief-supplied one is the PICK's door to bound, and it is named in that
      slice rather than silently trimmed in this one.
    */
    for (const line of [HOUSE_WARDROBE_LINE, basicsWardrobeLine("male"), basicsWardrobeLine("female")]) {
      expect(line.length, line).toBeLessThanOrEqual(240);
    }
  });

  it("CONTROL — the two paths do not produce the same sentence", () => {
    /* A resolver that ignored its argument would satisfy every arm above that
       checks one path at a time. */
    expect(bornWardrobeLine({ path: "wardrobe" }))
      .not.toBe(bornWardrobeLine({ path: "basics", sex: "female" }));
  });
});

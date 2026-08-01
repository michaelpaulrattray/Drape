import { describe, expect, it } from "vitest";

import { composeEcho, echoText, type BriefFacts } from "./briefEcho";

/**
 * The sentence has to survive every shape of intent, from everything pinned to
 * nothing pinned, without ever reading as a template with words dropped in.
 *
 * These are readability assertions as much as correctness ones: several check
 * the exact string, because "does it read like English" is the requirement and
 * a looser assertion would pass on prose no one would ship.
 */

function facts(partial: Partial<BriefFacts>): BriefFacts {
  return { role: null, locks: {}, open: [], variationAxis: null, ...partial };
}

describe("the sentence composes rather than templates", () => {
  it("fuses sex, age and build into one noun phrase", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "20s", agePhase: "early", build: "slim" },
        variationAxis: "look",
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a slim woman in her early 20s. The eight differ by look.",
    );
  });

  it("drops the phase when the brief only pinned the decade", () => {
    const spans = composeEcho(facts({ locks: { sex: "male", ageBand: "50s" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is a man in his 50s.");
  });

  it("writes heritage, presence and look as prose, not as a list", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "20s", heritage: ["East Asian"], energy: "dry", look: "severe minimal" },
        variationAxis: "look",
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman in her 20s, of East Asian heritage, reading dry, held to severe minimal. The eight differ by disposition.",
    );
  });

  it("says both heritages when two were pinned", () => {
    const spans = composeEcho(facts({ locks: { heritage: ["Nordic", "Slavic"], sex: "male" } }));
    expect(echoText(spans)).toContain("of Nordic and Slavic heritage");
  });

  it("says 'seventies or older' rather than the raw band label", () => {
    const spans = composeEcho(facts({ locks: { sex: "male", ageBand: "70s+" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is a man in his seventies or older.");
  });
});

describe("varying is visible, and never becomes a list", () => {
  it("names up to three open axes in real English", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "50s" },
        open: ["heritage", "build", "energy"],
        variationAxis: "look",
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman in her 50s. Heritage, build and presence were left to the roll. The eight differ by look.",
    );
  });

  it("collapses past three rather than enumerating them", () => {
    // Six named axes is the pill row wearing a coat, which is the thing this
    // whole design replaces.
    const spans = composeEcho(
      facts({
        locks: { ageBand: "30s", sex: "male" },
        open: ["heritage", "build", "energy", "look", "sex", "ageBand"],
        variationAxis: "disposition",
      }),
    );
    const text = echoText(spans);
    expect(text).not.toContain("left to the roll");
    expect(text).toBe("Everyone on this sheet is a man in his 30s. The eight differ by disposition.");
  });

  it("never names an axis the variation clause already names", () => {
    /*
      "presence was left to the roll. The eight differ by disposition" is one
      idea colliding with itself — the collision Fable caught in the mock.
    */
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "40s" },
        open: ["energy", "build"],
        variationAxis: "disposition",
      }),
    );
    const text = echoText(spans);
    expect(text).toContain("Build was left to the roll");
    expect(text).not.toContain("presence");
  });

  it("falls back to the free-cast line when nothing at all was pinned", () => {
    const spans = composeEcho(facts({ open: ["sex", "ageBand", "heritage"], variationAxis: "disposition" }));
    expect(echoText(spans)).toBe(
      "Nothing pinned — the roll cast freely from your words. The eight differ by disposition.",
    );
  });
});

describe("lineage and the terser repeat form", () => {
  it("closes with the followed candidate and the axis in one clause", () => {
    const spans = composeEcho(
      facts({ locks: { sex: "female", ageBand: "40s" }, variationAxis: "look" }),
      { followLabel: "the third face on roll 01" },
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman in her 40s. The eight follow the third face on roll 01, and differ by look.",
    );
  });

  it("terse drops the open-axis clause, keeping the pinned facts", () => {
    // Founder condition: prefer the terser composed form on repeat rolls within
    // a session. The pins are what a returning user is checking; the latitude
    // sentence is what they have already read.
    const full = composeEcho(
      facts({ locks: { sex: "female", ageBand: "20s" }, open: ["heritage", "build"], variationAxis: "look" }),
    );
    const terse = composeEcho(
      facts({ locks: { sex: "female", ageBand: "20s" }, open: ["heritage", "build"], variationAxis: "look" }),
      { terse: true },
    );
    expect(echoText(full)).toContain("were left to the roll");
    expect(echoText(terse)).toBe("Everyone on this sheet is a woman in her 20s. The eight differ by look.");
    expect(echoText(terse).length).toBeLessThan(echoText(full).length);
  });
});

describe("the spans carry the two-layer typography", () => {
  it("marks pinned facts as facts and connective prose as text", () => {
    const spans = composeEcho(
      facts({ locks: { sex: "female", ageBand: "20s", heritage: ["Nordic"] }, variationAxis: "look" }),
    );
    const fields = spans.filter((span) => span.kind === "fact").map((span) => span.field);
    expect(fields).toEqual(["sex", "ageBand", "heritage"]);
    // Every non-fact span is connective prose, which renders at secondary
    // weight — that split IS the founder's two-layer condition.
    expect(spans.some((span) => span.kind === "text")).toBe(true);
  });

  it("marks named open axes as pinnable rather than as dead prose", () => {
    // The mock shipped two of three open axes as unclickable text, which a
    // founder would have clicked. Every named axis is a span with a field.
    const spans = composeEcho(
      facts({ locks: { sex: "male" }, open: ["heritage", "build"], variationAxis: "look" }),
    );
    const open = spans.filter((span) => span.kind === "open");
    expect(open.map((span) => span.field)).toEqual(["heritage", "build"]);
  });

  it("gives every fact and open span a field the server will accept", () => {
    const spans = composeEcho(
      facts({
        locks: { sex: "female", ageBand: "30s", build: "athletic", energy: "wry", look: "quiet luxury" },
        open: ["heritage"],
        variationAxis: null,
      }),
    );
    const OVERRIDABLE = new Set(["sex", "ageBand", "agePhase", "heritage", "build", "energy", "look"]);
    for (const span of spans) {
      if (span.kind === "text") continue;
      expect(OVERRIDABLE.has(span.field)).toBe(true);
    }
  });
});

describe("the two-line cap is enforced by saying less", () => {
  it("drops the latitude clause when the full sentence would need a third line", () => {
    /*
      The first cap was CSS — line-clamp plus overflow:hidden — and it hid the
      later facts and cut the popover panel off at the sentence's bottom edge.
      A shorter true sentence beats a longer one with its end cut off.
    */
    const long = composeEcho({
      role: null,
      locks: {
        sex: "female",
        ageBand: "20s",
        agePhase: "early",
        build: "athletic",
        heritage: ["Western European", "Southeast Asian"],
        energy: "guarded",
        look: "commanding glamour",
      },
      open: ["look"],
      variationAxis: "disposition",
    }, { followLabel: "the third face on roll 01" });
    // The latitude clause is what goes. Asserting the fallback fired rather
    // than a magic character count — the rendered line count is measured by the
    // drive suite at real widths, which is the only place it is knowable.
    expect(echoText(long)).not.toContain("left to the roll");
  });

  it("keeps the latitude clause when there is room for it", () => {
    const short = composeEcho({
      role: null,
      locks: { sex: "male", ageBand: "40s" },
      open: ["heritage", "build"],
      variationAxis: "look",
    });
    expect(echoText(short)).toContain("were left to the roll");
  });

  it("never drops a pinned fact to make room", () => {
    // Latitude is what gets cut. A fact disappearing would be the CSS clip's
    // failure reproduced in the grammar.
    const spans = composeEcho({
      role: null,
      locks: {
        sex: "female",
        ageBand: "30s",
        agePhase: "late",
        build: "broad",
        heritage: ["Mediterranean", "West African"],
        energy: "wry",
        look: "quiet luxury",
      },
      open: [],
      variationAxis: "look",
    }, { followLabel: "the sixth face on roll 02" });
    const fields = spans.filter((s) => s.kind === "fact").map((s) => s.field);
    expect(fields).toEqual(["build", "ageBand", "heritage", "energy", "look"]);
  });
});

describe("the casting category is in the sentence", () => {
  /*
    Founder's round-6 finding: "a runway model early 20s" echoed as
    "Everyone on this sheet is someone early 20s" — the category missing
    entirely, and the grammar broken where it should have been.

    The interpreter was innocent: it captured role="runway model" on that exact
    brief and on every phrasing tried. The echo was composed from lockContract,
    which is the VALIDATOR's input and has no role field, so the category was
    never in the data the sentence was written from. The loudest lock on the
    sheet was the one the sentence could not see.
  */
  it("names the category the founder's brief stated", () => {
    const spans = composeEcho(
      facts({ role: "runway model", locks: { ageBand: "20s", agePhase: "early" }, variationAxis: "look" }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is cast as a runway model — in their early 20s. The eight differ by look.",
    );
  });

  it("never says 'someone early 20s' again", () => {
    // The other half of the report: with no sex pinned the preposition was
    // dropped, because it only existed on the branch that had a noun.
    const spans = composeEcho(facts({ locks: { ageBand: "20s", agePhase: "early" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is in their early 20s.");
    expect(echoText(spans)).not.toContain("someone");
  });

  it("carries the category alongside a full subject", () => {
    const spans = composeEcho(
      facts({
        role: "oncology nurse",
        locks: { sex: "female", ageBand: "50s", heritage: ["British Isles"], energy: "grave" },
        variationAxis: "disposition",
      }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is cast as an oncology nurse — a woman in her 50s, of British Isles heritage, reading grave. The eight differ by disposition.",
    );
  });

  it("stands alone when the category is all the brief gave", () => {
    const spans = composeEcho(facts({ role: "blacksmith", variationAxis: "disposition" }));
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is cast as a blacksmith. The eight differ by disposition.",
    );
  });

  it("does not double the article on a category the user wrote with one", () => {
    const spans = composeEcho(facts({ role: "a retired boxer" }));
    expect(echoText(spans)).toBe("Everyone on this sheet is cast as a retired boxer.");
    expect(echoText(spans)).not.toContain("as a a ");
  });

  it("picks 'an' before a vowel", () => {
    expect(echoText(composeEcho(facts({ role: "editorial fashion model" })))).toContain(
      "cast as an editorial fashion model",
    );
  });

  it("renders the category as a role span — full ink, never a picker", () => {
    // Every other fact opens a closed vocabulary. A category is free text, so
    // underlining it would promise an adjustment that cannot exist.
    const spans = composeEcho(facts({ role: "runway model", locks: { sex: "female" } }));
    const role = spans.find((span) => span.kind === "role");
    expect(role).toBeDefined();
    expect(spans.some((span) => span.kind === "fact" && span.text.includes("runway"))).toBe(false);
  });
});

describe("a locked look cannot also be what the eight differ by", () => {
  it("says disposition when the brief pinned the look", () => {
    /*
      The founder's sheet read "held to commanding glamour … The eight differ by
      look" — a sentence contradicting itself, and not merely bad copy: it was
      reporting the compiler's own confusion. A pinned look goes to every
      candidate, so disposition is what actually varies.
    */
    const spans = composeEcho(
      facts({ locks: { sex: "male", look: "commanding glamour" }, variationAxis: "look" }),
    );
    expect(echoText(spans)).toContain("The eight differ by disposition");
    expect(echoText(spans)).not.toContain("differ by look");
  });

  it("still says look when the look is the thing varying", () => {
    const spans = composeEcho(facts({ locks: { sex: "male" }, variationAxis: "look" }));
    expect(echoText(spans)).toContain("The eight differ by look");
  });
});

describe("no clause may open the sentence with a comma", () => {
  /*
    Founder report: "An East Asian model with long pastel pink hair" echoed as
    ", of East Asian heritage. The eight differ by look." — a leading comma and
    no opening clause.

    Cause: every clause after the subject was written assuming a subject
    existed, so each hard-coded a leading ", ". With no category and no sex,
    age or build, both openers return nothing and the first optional clause
    became the first thing on the line.

    One test per clause that can lead, because the bug is positional and a
    clause added later would reproduce it.
  */
  it("opens on heritage when heritage is the only thing pinned", () => {
    const spans = composeEcho(facts({ locks: { heritage: ["East Asian"] }, variationAxis: "look" }));
    const text = echoText(spans);
    expect(text.startsWith(",")).toBe(false);
    expect(text).toBe("Everyone on this sheet is of East Asian heritage. The eight differ by look.");
  });

  it("opens on presence when presence is the only thing pinned", () => {
    const spans = composeEcho(facts({ locks: { energy: "dry" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet reads dry.");
  });

  it("opens on look when the look is the only thing pinned", () => {
    const spans = composeEcho(facts({ locks: { look: "severe minimal" } }));
    expect(echoText(spans)).toBe("Everyone on this sheet is held to severe minimal.");
  });

  it("still continues rather than re-opening once a subject exists", () => {
    const spans = composeEcho(
      facts({ locks: { sex: "female", heritage: ["Nordic"], energy: "warm" } }),
    );
    expect(echoText(spans)).toBe(
      "Everyone on this sheet is a woman, of Nordic heritage, reading warm.",
    );
  });

  it("never starts with punctuation, whatever single fact is pinned", () => {
    // The class, not the instance. Any one lock alone must still read.
    const singles: Partial<BriefFacts["locks"]>[] = [
      { heritage: ["Latino"] },
      { energy: "wry" },
      { look: "clean commercial" },
      { sex: "male" },
      { ageBand: "40s" },
      { build: "athletic" },
    ];
    for (const locks of singles) {
      const text = echoText(composeEcho(facts({ locks })));
      expect(text[0], text).toMatch(/[A-Z]/);
      expect(text, text).not.toContain(" ,");
    }
  });
});

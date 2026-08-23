/**
 * SHE ASKED FOR IT AND IT IS NOT IN THE PICTURE — the gate, and the two ways
 * one paid render told her otherwise.
 *
 * # The specimens, all four from production
 *
 * Run 1 of the replay walk, 2026-08-11, the founder's own account, candidate
 * `32d1d79e`. Step 4's instruction was **"wear her hair down"**. The frame came
 * back with her hair in a high curly bun; the reader said so, verbatim, on that
 * render and the next one; the live reference library independently refused the
 * crop as `disputedDelivery`; and 25 credits were charged, twice. Three
 * instruments agreed and the money moved anyway, because `hairWorn` was not
 * binding and nothing consulted what the reader saw.
 *
 * Every fixture below is the real string off the real row:
 *
 *   v#169  {"facet":"hairWorn","asked":"hair down","read":true,
 *           "saw":"hair pulled up into a high curly bun, not down",
 *           "binding":false,"verified":false}       → charged
 *   v#170  ...same, "saw":"hair gathered up in a high bun, not down"
 *   v#170  prompt: "HAIR WORN: hair down — rendered exactly as this: in a bun
 *           — gathered and coiled or knotted against the head, …"
 *   v#169  prompt: "These are ALREADY TRUE … HAIR COLOUR: Bright copper-orange
 *           hair, warm reddish-brown tone, tight curls piled into a high bun."
 *
 * # And the specimen that must NOT fire
 *
 * Run-10: she asked for gold hoop earrings and got gold hoop earrings, one in
 * each ear, confirmed by opening the frame. The reader marked it unverified
 * because they were *"thin and understated, not bold hoops"* — an adjective she
 * never used. Refusing that hands back a refund for a picture she received, and
 * it is the reason D-187 exists. It rides here as a permanent tripwire.
 *
 * Everything is driven directly. No LLM anywhere in this file: the reader's
 * replies are strings, the checks are objects, and every assertion is about
 * arithmetic the model cannot rescue (working law 3).
 */
import { describe, expect, it } from "vitest";

import {
  aboutFacet,
  advisoryMisses,
  isRefusableMiss,
  okOf,
  shortfalls,
  type FacetCheck,
} from "./renderVerification";
import { facetBindsOnPresence, facetOfSubject } from "./refineFacets";
import { pairClauseFor } from "./accessoryKinds";
import { FREE_SUBJECT_KEYS, FREE_SUBJECT_KIND } from "./refineSubjects";
import { evidencesDelivery, withoutArrangementClaims } from "./realizationCaption";
import { composeRenderPrompt } from "./refineDelta";
import { classifyAttempt, summarize, type AttemptRow } from "./reliabilityReport";
import {
  EYE_SHAPE_RENDER,
  HAIR_COLOUR_RENDER,
  HAIR_TEXTURE_RENDER,
  IRIS_RENDER,
} from "./realizedAxes";

const HAIR_WORN = facetOfSubject("hairWorn");
const ACCESSORIES = facetOfSubject("statedAccessories");
const MARKS = facetOfSubject("marks");

const prose = {
  eyeColour: (value: keyof typeof IRIS_RENDER) => IRIS_RENDER[value],
  eyeShape: (value: keyof typeof EYE_SHAPE_RENDER) => EYE_SHAPE_RENDER[value],
  hairStyle: (value: string) => `a ${value}`,
  hairColour: (value: keyof typeof HAIR_COLOUR_RENDER) => HAIR_COLOUR_RENDER[value],
  hairTexture: (value: keyof typeof HAIR_TEXTURE_RENDER) => HAIR_TEXTURE_RENDER[value],
};

/** v#169's own check, byte for byte, with `binding` left as the caller decides. */
const hairDownMiss = (binding: boolean, absent?: boolean): FacetCheck => ({
  subject: aboutFacet(HAIR_WORN),
  asked: "hair down",
  saw: "hair pulled up into a high curly bun, not down",
  read: true,
  verified: false,
  binding,
  ...(absent === undefined ? {} : { absent }),
});

describe("presence binds, degree advises — and the table says which is which", () => {
  it("classifies every free subject, with no room for a new one to slip through", () => {
    /* `Record<FreeSubject, …>` makes this a build failure rather than a test
       failure — this asserts the two agree, so the type cannot be satisfied by
       a table that has drifted from the vocabulary it classifies. */
    expect(Object.keys(FREE_SUBJECT_KIND).sort()).toEqual([...FREE_SUBJECT_KEYS].sort());
  });

  it("binds hairWorn — the facet run 1 charged twice for not delivering", () => {
    expect(FREE_SUBJECT_KIND.hairWorn).toBe("presence");
    expect(facetBindsOnPresence(HAIR_WORN)).toBe(true);
  });

  it("keeps accessories bound — the widening must not lose what it widened from", () => {
    expect(facetBindsOnPresence(ACCESSORIES)).toBe(true);
  });

  it("leaves marks advisory, because byte adjudication is its honest instrument", () => {
    expect(FREE_SUBJECT_KIND.marks).toBe("degree");
    expect(facetBindsOnPresence(MARKS)).toBe(false);
  });

  it("does not give the guaranteed colour axis teeth by sharing a facet id", () => {
    /* `hairShade` writes `hair.colour`, and it is degree — the seafoam case. A
       facet-level predicate that ignored the subject table would bind the whole
       colour axis here, which is D-187's own counterexample. */
    expect(facetBindsOnPresence(facetOfSubject("hairShade"))).toBe(false);
    expect(facetBindsOnPresence(facetOfSubject("eyeColourFree"))).toBe(false);
  });

  it("binds nothing that is a matter of degree — the whole list, not a sample", () => {
    const bound = FREE_SUBJECT_KEYS.filter((subject) => FREE_SUBJECT_KIND[subject] === "presence");
    /* `horns` joined on 2026-08-14 and belongs here rather than beside the
       degrees: horns are in the picture or they are not, so an ask for them
       that comes back without them is an ABSENCE and refunds, exactly as a
       missing beard does. The delivery court's 6/6 on two faces is what makes
       that binding honest rather than optimistic. */
    /* `wardrobe` joined 2026-08-23 (item 8) and binds for the same reason: she
       is wearing the outfit she asked for or she is not, and a render that
       comes back in the old clothes is an ABSENCE that refunds rather than a
       matter of shade nobody has defined. */
    expect([...bound].sort()).toEqual([
      "facialHair", "hairWorn", "horns", "ink", "statedAccessories", "wardrobe",
    ]);
  });
});

describe("the gate: a miss refuses unless the reader says the thing is there", () => {
  it("REFUSES run 1's hair-down miss, now that hairWorn binds", () => {
    const check = hairDownMiss(true, true);
    expect(isRefusableMiss(check)).toBe(true);
    expect(okOf([check])).toBe(false);
    expect(shortfalls({ ok: false, checks: [check] })).toEqual(["without hair down"]);
  });

  it("refuses it even if the reader never answers the absence question", () => {
    /*
      D-235's asymmetry, and the reason the field is an EXEMPTION rather than a
      permission: a silent reader must never buy the house a free pass. The
      first cut of this fix required `absent === true` and broke eleven tests
      saying exactly that.
    */
    expect(isRefusableMiss(hairDownMiss(true))).toBe(true);
  });

  it("DOES NOT refuse run-10's hoops — the tripwire, and it must never fire", () => {
    /*
      "thin and understated, not bold hoops". The hoops are in the picture. A
      refusal here is a refund for a render she received, on a quality she never
      specified, and it is the failure D-187 was written about.
    */
    const quibble: FacetCheck = {
      subject: aboutFacet(ACCESSORIES),
      asked: "gold hoop earrings, one on each ear, a matching pair",
      saw: "thin and understated, not bold hoops",
      read: true,
      verified: false,
      binding: true,
      absent: false,
    };
    expect(isRefusableMiss(quibble)).toBe(false);
    expect(okOf([quibble])).toBe(true);
    /* Not refused, and not lost either — it lands on the watch list, which is
       where a reader inventing a fault belongs. */
    expect(advisoryMisses({ ok: true, checks: [quibble] })).toEqual([quibble]);
  });

  it("keeps a REMOVAL's teeth even when the reader calls the thing present", () => {
    /*
      "no glasses — they have been taken off and are not in the picture" is
      false exactly when the glasses ARE there, so a reader answering
      `absent:false` about it is both literally right and catastrophic. The fact
      declares itself instead of being asked.
    */
    const stillWearingThem: FacetCheck = {
      subject: aboutFacet(ACCESSORIES),
      asked: "no glasses — they have been taken off and are not in the picture",
      shortfall: "with the glasses still in the picture",
      saw: "she is still wearing the glasses",
      read: true,
      verified: false,
      binding: true,
      absent: false,
      absenceIsTheAsk: true,
    };
    expect(isRefusableMiss(stillWearingThem)).toBe(true);
    expect(shortfalls({ ok: false, checks: [stillWearingThem] }))
      .toEqual(["with the glasses still in the picture"]);
  });

  it("still never refuses on a DEGREE facet, however absent the reader says it is", () => {
    const marksMiss: FacetCheck = {
      subject: aboutFacet(MARKS),
      asked: "freckles",
      saw: "clear skin, no freckles anywhere",
      read: true,
      verified: false,
      binding: false,
      absent: true,
    };
    expect(isRefusableMiss(marksMiss)).toBe(false);
    expect(okOf([marksMiss])).toBe(true);
  });

  it("still never refuses on an UNREAD check — silence is neither pass nor miss", () => {
    const silent: FacetCheck = {
      subject: aboutFacet(HAIR_WORN), asked: "hair down", read: false, verified: false, binding: true,
    };
    expect(isRefusableMiss(silent)).toBe(false);
    expect(okOf([silent])).toBe(true);
  });
});

describe("the pair clause is part of the PROMPT and must not ride the gate's flag", () => {
  /*
    `const lateral = presence ? pairClauseFor(asked) : ""` was correct while
    `presence` meant "this is the accessories facet" and became a defect the
    moment it meant "this may refuse". The dangerous direction is a carried
    accessory with no realization caption — binding goes false, and the pair
    clause would have vanished from a PAID RENDER'S INSTRUCTIONS. Law 8's
    founding example ("earrings come in matching pairs"), lost to a shared
    variable. Found by reading the diff as a document, not by a failing test.
  */
  it("still asks for both ears on an accessory the gate would not refuse over", () => {
    expect(pairClauseFor("gold hoop earrings")).toBe(", one on each ear, a matching pair");
  });

  it("says nothing about sides for the facets the widening just added", () => {
    expect(pairClauseFor("hair down")).toBe("");
    expect(pairClauseFor("a full beard")).toBe("");
  });
});

describe("an ask that never landed does not gate the edits that come after it", () => {
  /*
    The trap the widening opens if nobody bounds it. `facts` is built from the
    COMPOSED recipe, so step 4's unfulfilled "hair down" is still in it at step
    5 — and binding it there would have refused "remove her glasses" as well,
    and step 6, and step 7, for as long as the painter kept failing that one
    sentence. She waits, she is refunded, and she never gets the thing she came
    back for. The evidence that separates the two cases already exists: D-183
    writes a realization caption ONLY after a render corroborated the ask.
  */
  it("does not treat a base PIN as evidence that an ask was delivered", () => {
    expect(evidencesDelivery({ wording: "in a bun — gathered and coiled", pin: "bun" })).toBe(false);
  });

  it("treats a realization caption as evidence, because D-183 refuses to write one otherwise", () => {
    expect(evidencesDelivery("Small gold hoop earrings with a dangling gold cross charm")).toBe(true);
  });

  it("treats a missing or empty caption as no evidence", () => {
    expect(evidencesDelivery(undefined)).toBe(false);
    expect(evidencesDelivery("")).toBe(false);
  });
});

describe("a pin describes the base, so it may not specify the ask that replaces it", () => {
  const BUN = { wording: "in a bun — gathered and coiled or knotted against the head", pin: "bun" };

  it("does not glue run 1's bun onto run 1's hair-down ask", () => {
    const composed = composeRenderPrompt(
      { free: { hairWorn: "hair down" } }, prose, { [HAIR_WORN]: BUN },
    );
    expect(composed.full).toContain("HAIR WORN: hair down");
    /* The exact production string this exists to stop. */
    expect(composed.full).not.toContain("hair down — rendered exactly as this: in a bun");
    expect(composed.full).not.toContain("in a bun — gathered and coiled");
  });

  it("still carries the pin when nothing is asking about the hair", () => {
    /* D-186's whole job: her hair was up in the base and nothing ever said so. */
    const composed = composeRenderPrompt({ eyeColour: "green" }, prose, { [HAIR_WORN]: BUN });
    expect(composed.full).toContain("in a bun — gathered and coiled");
    expect(composed.captionedFacets).toContain(HAIR_WORN);
  });

  it("still sharpens an ask with a REALIZATION caption — D-152 is untouched", () => {
    /* The measured win this rule must not undo: a caption read back off a
       delivered frame is evidence that the value was achieved, and it belongs
       in the ask. A pin is not that. */
    const kept = "warm coppery red through the whole length";
    const composed = composeRenderPrompt({ hairColour: "copper" }, prose, { "hair.colour": kept });
    expect(composed.full).toContain(kept);
    expect(composed.full).toContain("rendered exactly as this");
  });
});

describe("a caption for one facet may not speak for another that is being asked", () => {
  /* v#169's stored caption, verbatim. */
  const COLOUR_CAPTION =
    "Bright copper-orange hair, warm reddish-brown tone, tight curls piled into a high bun.";

  it("strips the arrangement clause and keeps the colour", () => {
    const pruned = withoutArrangementClaims(COLOUR_CAPTION);
    expect(pruned.caption).toBe("Bright copper-orange hair, warm reddish-brown tone.");
    expect(pruned.stripped).toEqual([" tight curls piled into a high bun."]);
  });

  it("leaves a caption that minds its own business exactly as it was", () => {
    const clean = "Bright copper-orange hair, warm reddish-brown tone.";
    const pruned = withoutArrangementClaims(clean);
    expect(pruned.caption).toBe(clean);
    expect(pruned.stripped).toEqual([]);
  });

  it("does not strip on the word 'down', which is also ordinary English", () => {
    /* The one arrangement id that is a common word. A matcher that cut on it
       would take colour description out of paid prompts. */
    const toned = "a deep auburn, toned down at the roots";
    expect(withoutArrangementClaims(toned).caption).toBe(toned);
  });

  it("keeps the bun OUT of the already-true lane when the hair is being restyled", () => {
    const composed = composeRenderPrompt(
      { free: { hairWorn: "hair down" }, hairColour: "copper" },
      prose,
      { "hair.colour": COLOUR_CAPTION },
    );
    expect(composed.full).toContain("HAIR WORN: hair down");
    expect(composed.full).not.toContain("piled into a high bun");
    /* And the copper survives — dropping the whole caption would have taken it
       on the one render where it most needs carrying. */
    expect(composed.full).toContain("Bright copper-orange hair");
  });

  it("leaves the same caption whole when nobody is touching the hair's arrangement", () => {
    const composed = composeRenderPrompt(
      { eyeColour: "green" }, prose, { "hair.colour": COLOUR_CAPTION },
    );
    /* It is simply true, and the already-true lane is for things that are true. */
    expect(composed.full).toContain("piled into a high bun");
  });
});

describe("the report can see the class that charged him", () => {
  const rowOf = (checks: AttemptRow["verification"]): AttemptRow => ({
    operationId: "47f9ed1c-3732-4b66-8665-3f7be039bea3",
    createdAt: new Date("2026-08-11T05:39:27Z"),
    status: "ready",
    pointsCost: 25,
    requestText: "wear her hair down",
    verification: checks,
  });

  it("classifies run 1 step 4 as delivered_absent, not as a reader's quibble", () => {
    const row = rowOf({
      checks: [
        { facet: "hair.colour", asked: "copper", verified: true, read: true, binding: true, carried: true },
        {
          subject: aboutFacet(HAIR_WORN),
          asked: "hair down",
          verified: false,
          read: true,
          binding: false,
          absent: true,
          saw: "hair pulled up into a high curly bun, not down",
        },
      ],
    });
    expect(classifyAttempt(row)).toBe("delivered_absent");
  });

  it("sees it even though the facet was NOT binding — the report is not the gate", () => {
    /*
      The point of the split. `binding:false` is exactly what the stored row
      says, because at the time of the render nobody had bound `hairWorn`. If
      this bucket could only see what the gate already believed, a facet nobody
      thought to bind would stay invisible for precisely as long as nobody
      thought to bind it — and this instrument would have found the defect
      without spending 125 credits to walk into it.
    */
    const report = summarize([rowOf({
      checks: [{
        subject: aboutFacet(HAIR_WORN),
        asked: "hair down",
        verified: false,
        read: true,
        binding: false,
        absent: true,
        saw: "hair pulled up into a high curly bun, not down",
      }],
    })]);
    expect(report.overall.delivered_absent).toBe(1);
    expect(report.overall.delivered_advisory).toBe(0);
    /* And it fails the founder's bar, which is the whole reason to name it. */
    expect(report.byClass.find((tally) => tally.edit === HAIR_WORN)?.clearsBar).toBe(false);
  });

  it("still calls run-10's hoops advisory — the same tripwire, one layer up", () => {
    const row = rowOf({
      checks: [{
        subject: aboutFacet(ACCESSORIES),
        asked: "gold hoop earrings, one on each ear, a matching pair",
        verified: false,
        read: true,
        binding: false,
        absent: false,
        saw: "thin and understated, not bold hoops",
      }],
    });
    expect(classifyAttempt(row)).toBe("delivered_advisory");
  });

  it("leaves a legacy row where it was — no absence answer, no reclassification", () => {
    /* Rows written before the reader was asked the question genuinely do not
       say which kind of miss they were. Promoting them would be inventing
       findings; demoting them would be losing them. */
    const row = rowOf({
      checks: [{
        subject: aboutFacet(HAIR_WORN), asked: "hair down", verified: false, read: true, binding: false,
        saw: "hair gathered at the nape",
      }],
    });
    expect(classifyAttempt(row)).toBe("delivered_advisory");
  });
});

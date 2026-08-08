/**
 * THE DEPARTURE — the one negative fact the recipe can hold (D-238).
 *
 * # What this file exists to stop happening again
 *
 * No removal of a BASE-WORN thing had ever worked in this product. The founder's
 * candidate came off a sheet whose brief asked for glasses; every face on it was
 * drawn wearing them; "remove her glasses" was masked for, verified for and
 * refunded for — and **never asked for**. `departed` reached the mask-cutter and
 * the verification net and never the painter, while the preservation tail was
 * actively telling the painter that anything worn in the reference stays worn.
 * Three paints, two faces, zero removals, and the painter obeyed us precisely
 * every time.
 *
 * The refunds were correct throughout, which is exactly why it survived: the
 * money was always right, so nothing screamed.
 *
 * # And the half that is easy to miss
 *
 * Renders are base-anchored — every one of them edits the ORIGINAL photograph —
 * so a departure that rides only its own render lasts exactly one ask. Her next
 * instruction re-renders from the bespectacled original, and the glasses come
 * back. That is run-7's vanishing freckles in reverse, at 100% reproduction, and
 * it is why the fact had to be given a home in the recipe rather than a better
 * sentence in one prompt.
 */
import { describe, expect, it } from "vitest";

import {
  composeDeltas,
  composeEditPrompt,
  composeRenderPrompt,
  contradictedFacets,
  departedClause,
  departedItems,
  departedNoun,
  facetsAnsweredBy,
  facetsWrittenBy,
  missingFromPrompt,
  readDelta,
  type RefineDelta,
} from "./refineDelta";
import { composePreservation } from "./refinePreservation";
import { fingerprintDelta, matchSteps } from "./refineRemoval";
import { readStoredDelta } from "./refineLegacy";
import { facetOfSubject } from "./refineFacets";
import { captionClause, dropFacets, staleCaptions } from "./realizationCaption";
import { DEPARTABLE_SUBJECTS, isDepartableSubject } from "./refineSubjects";

/** The engineered prose the composer asks for — irrelevant here, so it is flat. */
const PROSE = {
  eyeColour: (v: string) => v,
  eyeShape: (v: string) => v,
  hairStyle: (v: string) => v,
  hairColour: (v: string) => v,
  hairTexture: (v: string) => v,
} as unknown as Parameters<typeof composeEditPrompt>[1];

const GONE: RefineDelta = { absent: { statedAccessories: ["glasses"] } };
const HOOPS: RefineDelta = { free: { statedAccessories: ["small gold hoops"] } };

describe("the departure reaches the painter, in the reader's own words", () => {
  /*
    THE DEFECT ITSELF. Before this, `composeEditPrompt` had no idea a removal
    existed — grep `departed` in refineDelta.ts returned nothing at all.
  */
  it("asks for the removal in the edits lane", () => {
    const edits = composeEditPrompt(GONE, PROSE);
    expect(edits).toContain("no glasses");
    expect(edits).toContain("taken off");
  });

  /*
    ONE FACT, ONE WORDING (Fable, fable-032). The painter is sent a string and
    the reader is handed a string, and two hand-authored versions of one fact is
    a second vocabulary waiting to drift. This is the mechanical pin: the
    reader's EXACT sentence must appear in the prompt, so rewording either side
    alone goes red.
  */
  it("uses the verification net's exact sentence, verbatim", () => {
    const asked = departedClause("glasses");
    expect(composeEditPrompt(GONE, PROSE)).toContain(asked);
    expect(composeRenderPrompt(GONE, PROSE, "").full).toContain(asked);
  });

  /*
    D-183's lesson, kept. Naming a category invites it: the clause that used to
    list "glasses, earrings, studs, a chain" put a hoop and a stud on a
    bare-eared candidate. A removal has no choice but to name the thing, so the
    same sentence forbids anything arriving in its place.
  */
  it("forbids anything arriving in the vacated place", () => {
    expect(composeEditPrompt(GONE, PROSE)).toContain("put nothing in their place");
  });

  /* Their pointing word belongs to their sentence, not to the frame it is
     spliced into: "no her glasses" was going into a paid vision prompt. */
  it("splices the bare noun, never the pointing word", () => {
    expect(departedNoun("her glasses")).toBe("glasses");
    expect(departedNoun("the necklace")).toBe("necklace");
    expect(departedNoun("a silver anklet")).toBe("silver anklet");
    /* And a bare noun survives untouched, including one that merely starts with
       those letters. */
    expect(departedNoun("hercules tattoo")).toBe("hercules tattoo");
    expect(departedNoun("glasses")).toBe("glasses");
  });
});

/**
 * THE SECOND MOUTH (fable-033).
 *
 * A prompt carrying both instructions entitles the painter to either, so saying
 * it is only half the fix — the tail has to stop saying the opposite.
 */
describe("the preservation tail stops protecting what is leaving", () => {
  it("does not tell the painter to keep the departed thing", () => {
    const { clause } = composePreservation(facetsWrittenBy(GONE));
    /* This is the sentence that was defeating every removal. */
    expect(clause).not.toContain("anything worn in the reference photograph still worn");
  });

  it("still protects everything the removal is not about", () => {
    const { clause } = composePreservation(facetsWrittenBy(GONE));
    for (const whole of ["the same hair", "the same eyes", "the same skin", "the same person"]) {
      expect(clause, whole).toContain(whole);
    }
  });

  /*
    THE GUARD THAT COULD NOT SEE (fable-033, and it FAILS ON TODAY'S CODE).
    `contradictedFacets` compares the tail's protected facets against the edited
    ones, and a departure wrote no facet at all — so a prompt that said "take the
    glasses off" and "anything worn stays worn" in one breath was reported as
    perfectly consistent. The assertion below is the extension: the facet is in
    play, so a tail that protects it is a contradiction the guard reports.
  */
  it("SEES a departed facet, so a tail that protects it is caught", () => {
    const prompt = composeRenderPrompt(GONE, PROSE, "");
    /* Built correctly, there is nothing to catch. */
    expect(contradictedFacets(prompt, GONE)).toEqual([]);
    /* And if the tail ever protects it again — a hand-authored table is exactly
       the thing that drifts — the guard now has the facet to catch it with. */
    const protectedAnyway = {
      ...prompt,
      protectedFacets: [...prompt.protectedFacets, facetOfSubject("statedAccessories")],
    };
    expect(contradictedFacets(protectedAnyway, GONE))
      .toContain(facetOfSubject("statedAccessories"));
  });
});

/**
 * THE FOUNDER'S OWN SEQUENCE (fable-034), pinned as a required case.
 *
 * "Could someone still remove glasses and in later edits re-add them?" — and
 * supersession has to be DERIVATION, not a special case. If the home needed a
 * branch reading "if a later addition follows a departure", the home was wrong.
 */
describe("remove, then re-add, then remove again", () => {
  const REMOVE = GONE;
  const READD: RefineDelta = { free: { statedAccessories: ["round wire-frame glasses"] } };

  it("1. the departure composes and stands", () => {
    const composed = composeDeltas([{ free: { brows: "fuller" } }, REMOVE]);
    expect(departedItems(composed)).toEqual(["glasses"]);
    /* And the fact it is unrelated to survives. */
    expect(composed.free?.brows).toBe("fuller");
  });

  /*
    THE RETIREMENT, BY DERIVATION. `clearFacets` already drops everything
    answering a facet, and asking for a new pair ANSWERS the adornment facet —
    so the departure retires through the same machinery that makes a second hair
    colour beat the first. No branch anywhere reads "a later addition follows a
    departure".
  */
  it("2. a later answer on the same subject retires the departure", () => {
    const composed = composeDeltas([REMOVE, READD]);
    expect(composed.absent).toBeUndefined();
    expect(composed.free?.statedAccessories).toEqual(["round wire-frame glasses"]);
    /* And the prompt is no longer of two minds about her glasses. */
    const prompt = composeRenderPrompt(composed, PROSE, "");
    expect(prompt.full).not.toContain("taken off");
    expect(contradictedFacets(prompt, composed)).toEqual([]);
  });

  /*
    3. Removing THOSE glasses is the chain's own case — a step added them, so
    `matchSteps` finds it and D-173's prune path runs exactly as before. Pinned
    unchanged, per fable-032's condition 4.
  */
  it("3. removing the NEW pair routes via the chain prune, unchanged", () => {
    const chain = [
      { instruction: "remove her glasses", delta: REMOVE },
      { instruction: "round wire-frame glasses", delta: READD },
    ];
    const matched = matchSteps(chain, {
      subject: "statedAccessories",
      match: "round wire-frame glasses",
      items: ["round wire-frame glasses"],
    });
    expect(matched).toEqual([{ index: 1, keep: null }]);
  });

  /*
    AND THE STEP THAT RECORDED A DEPARTURE IS ITSELF REACHABLE. `facetsOfStep`
    was `facetsWrittenBy` copied by hand, and a departure claims no facet in the
    copy — so the matcher would have been blind to the removal step forever.
  */
  it("the departure step is visible to the matcher", () => {
    const chain = [{ instruction: "remove her glasses", delta: REMOVE }];
    expect(matchSteps(chain, { subject: "statedAccessories", match: null, whole: true }))
      .toEqual([{ index: 0, keep: null }]);
  });
});

/**
 * THE ASYMMETRY, and it is the reason `facetsAnsweredBy` exists (opus-028).
 *
 * `clearFacets` drops everything on a facet. If a departure carried its facet
 * into that clear, a base-worn "remove her glasses" would delete the hoops she
 * PAID for from the recipe — and renders being base-anchored, the next render
 * would stop asking for them and they would leave her face. Run-7, one layer in.
 */
describe("a departure subtracts from the base without deleting paid work", () => {
  it("leaves an earlier answer on the same subject standing", () => {
    const composed = composeDeltas([HOOPS, GONE]);
    expect(composed.free?.statedAccessories).toEqual(["small gold hoops"]);
    expect(departedItems(composed)).toEqual(["glasses"]);
  });

  it("says both things in one prompt, and they do not argue", () => {
    const composed = composeDeltas([HOOPS, GONE]);
    const prompt = composeRenderPrompt(composed, PROSE, "");
    expect(prompt.full).toContain("small gold hoops");
    expect(prompt.full).toContain(departedClause("glasses"));
    expect(contradictedFacets(prompt, composed)).toEqual([]);
  });

  /*
    DEPARTURES ACCUMULATE. A plain object spread — what the free lane does — is
    wrong here, because each removal event names ONE thing rather than restating
    a whole set, so the necklace would have replaced the glasses and quietly
    handed the glasses back.
  */
  it("accumulates a second departure instead of replacing the first", () => {
    const composed = composeDeltas([
      GONE,
      { absent: { statedAccessories: ["necklace"] } },
    ]);
    expect(departedItems(composed)).toEqual(["glasses", "necklace"]);
  });

  /*
    THE FOURTH DIRECTION (fable-036), and it is the one I had not walked.

    A departure is retired by a later ANSWER on the same subject — but
    `statedAccessories` is PLURAL, so the subject is too coarse a unit to retire
    on. Asking for gold hoops answers the same facet as her glasses, and
    retiring on that would put her glasses back on while she was asking about
    her ears. Same coarseness disease as the symmetric clear, one lane over.
  */
  it("a DIFFERENT thing on the same plural subject does not resurrect it", () => {
    const composed = composeDeltas([GONE, HOOPS]);
    expect(departedItems(composed), "her glasses must stay off").toEqual(["glasses"]);
    expect(composed.free?.statedAccessories).toEqual(["small gold hoops"]);
    /* And the prompt says both, which is the honest state of her face. */
    const prompt = composeRenderPrompt(composed, PROSE, "");
    expect(prompt.full).toContain(departedClause("glasses"));
    expect(prompt.full).toContain("small gold hoops");
  });

  it("the SAME thing on the same plural subject does retire it", () => {
    const composed = composeDeltas([
      GONE,
      { free: { statedAccessories: ["round wire-frame glasses"] } },
    ]);
    expect(composed.absent).toBeUndefined();
  });

  /*
    The kind table earns its keep on the synonym: "tortoiseshell frames" shares
    no word with "glasses", and only knowing that both are eyewear tells them
    apart from a pair of hoops. That knowledge already existed as the
    mask-cutter's placement table and is now shared rather than restated.
  */
  it("retires on the KIND, not on shared words", () => {
    const synonym = composeDeltas([
      GONE,
      { free: { statedAccessories: ["tortoiseshell frames"] } },
    ]);
    expect(synonym.absent, "frames are eyewear, so the glasses ask is answered")
      .toBeUndefined();
  });

  /*
    `marks` and `ink` have no kind vocabulary, so containment serves them — and
    it has to, or a scar would put her freckles back.
  */
  it("keeps a departure on a plural subject with no kind table", () => {
    const composed = composeDeltas([
      { absent: { marks: ["freckles"] } },
      { free: { marks: ["a small scar on her cheek"] } },
    ]);
    expect(departedItems(composed)).toEqual(["freckles"]);
  });

  it("retires it when the answer names the same mark", () => {
    const composed = composeDeltas([
      { absent: { marks: ["freckles"] } },
      { free: { marks: ["light freckles across her nose"] } },
    ]);
    expect(composed.absent).toBeUndefined();
  });

  /*
    A SINGULAR subject holds one fact, so it keeps facet granularity — stated
    explicitly, per fable-036. There is no set to be partly answered.
  */
  it("retires a singular subject's departure on any answer", () => {
    const composed = composeDeltas([
      { absent: { facialHair: ["beard"] } },
      { free: { facialHair: "light stubble" } },
    ]);
    expect(composed.absent).toBeUndefined();
  });

  it("does not accumulate the same thing twice", () => {
    const composed = composeDeltas([GONE, { absent: { statedAccessories: ["Glasses"] } }]);
    expect(departedItems(composed)).toEqual(["glasses"]);
  });

  /* The two views, stated plainly: a departure SAYS something about the facet
     and ANSWERS nothing. Everything downstream keys off this distinction. */
  it("is written-about but not answered", () => {
    expect(Array.from(facetsWrittenBy(GONE))).toEqual([facetOfSubject("statedAccessories")]);
    expect(Array.from(facetsAnsweredBy(GONE))).toEqual([]);
  });

  /*
    AND `[]` IS NOT AN ANSWER. The hand-copied view knew this and the original
    did not — an emptied plural subject reads as truthy and would have claimed
    its facet, clearing a live value on behalf of a subject holding nothing.
  */
  it("an emptied plural subject answers nothing and writes nothing", () => {
    const emptied: RefineDelta = { free: { marks: [] } };
    expect(Array.from(facetsAnsweredBy(emptied))).toEqual([]);
    expect(Array.from(facetsWrittenBy(emptied))).toEqual([]);
  });
});

/**
 * THE RECORD BOUNDARY. A departure is authored by the code at the one place
 * that has proved the thing is on her face — never by a model.
 */
describe("who may write a departure", () => {
  it("reads one back from our own record", () => {
    const stored = readStoredDelta({ absent: { statedAccessories: ["glasses"] } });
    expect(stored?.absent?.statedAccessories).toEqual(["glasses"]);
  });

  /*
    The interpreter is never told the key exists, so a reply carrying one has
    invented an authority it was not given — and a model that has started
    answering a question nobody asked is a model whose whole reply is suspect.
  */
  it("refuses one that arrives from the interpreter", () => {
    const check = { instruction: "remove her glasses" };
    expect(readDelta({ absent: { statedAccessories: ["glasses"] } }, check)).toBeNull();
    /* And it poisons the whole reply rather than being dropped silently. */
    expect(readDelta({ eyeColour: "green", absent: { marks: ["freckles"] } }, check)).toBeNull();
  });

  it("refuses a subject the code does not own", () => {
    expect(readDelta({ absent: { coat: ["red"] } })).toBeNull();
    expect(readDelta({ absent: { statedAccessories: "glasses" } })).toBeNull();
    expect(readDelta({ absent: { statedAccessories: [7] } })).toBeNull();
  });

  /*
    FABLE'S RIDER 1 (fable-035): the json-column claim gets an explicit test —
    an OLD row with no key composing beside a NEW one that has it.
  */
  it("composes an old row with no key beside a new one that has it", () => {
    const old = readStoredDelta({ free: { hairShade: "pastel pink" }, eyeShape: "hooded" })!;
    expect(old.absent).toBeUndefined();
    expect(departedItems(old)).toEqual([]);
    const composed = composeDeltas([old, GONE]);
    /* Every fact the old row held survives, and the departure joins it. */
    expect(composed.eyeShape).toBe("hooded");
    expect(composed.free?.hairShade).toBe("pastel pink");
    expect(departedItems(composed)).toEqual(["glasses"]);
  });
});

/**
 * THE MONEY, and D-143's teeth.
 */
describe("a departure is a filed fact like any other", () => {
  /*
    Rule 4 hands back an existing picture free when the recipe already exists.
    "Her, in her glasses" and "her, with them taken off" differ by nothing else,
    so a fingerprint blind to the departure would free-select the bespectacled
    face as though it were the recipe just described.
  */
  it("fingerprints differently from the same recipe without it", () => {
    expect(fingerprintDelta(GONE)).not.toBe(fingerprintDelta({}));
    expect(fingerprintDelta(composeDeltas([HOOPS, GONE]))).not.toBe(fingerprintDelta(HOOPS));
    /* And the same recipe fingerprints the same however it was built. */
    expect(fingerprintDelta({ absent: { statedAccessories: ["glasses", "necklace"] } }))
      .toBe(fingerprintDelta({ absent: { statedAccessories: ["necklace", "glasses"] } }));
  });

  /*
    COMPOSE-COMPLETENESS. The whole defect being closed here is a removal that
    never reached the prompt; a composition that drops it again must stop the
    render rather than buy a picture with the glasses still on.
  */
  it("stops a render whose prompt lost the removal", () => {
    expect(missingFromPrompt(GONE, composeEditPrompt(GONE, PROSE))).toEqual([]);
    expect(missingFromPrompt(GONE, "Edit this photograph, changing ONLY what is listed below."))
      .toEqual(["absent.statedAccessories"]);
  });
});

/**
 * THE CAPTION PATH (D-152), which fable-032's condition 4 asked for one look at.
 *
 * A caption is stated to the painter as ALREADY TRUE and must be reproduced
 * exactly. So a remembered "thin black rectangular glasses" would be a THIRD
 * mouth telling the painter to keep them — after the missing ask and the
 * preservation tail, the same defect a third time.
 *
 * It is already closed, and by derivation rather than by a new rule: captions
 * are dropped for every facet a delta WRITES, and a departure writes its facet.
 * Pinned here because "it falls out" is exactly the kind of claim that stops
 * being true when someone narrows the view it falls out of.
 */
describe("a departure retires the caption that described the thing", () => {
  it("drops a stored caption on the departed facet", () => {
    const captions = {
      [facetOfSubject("statedAccessories")]: "thin black rectangular glasses",
      [facetOfSubject("brows")]: "full, softly arched brows",
    };
    const written = facetsWrittenBy(GONE);
    expect(staleCaptions(captions, written)).toEqual([facetOfSubject("statedAccessories")]);
    const carried = dropFacets(captions, written);
    expect(carried[facetOfSubject("statedAccessories")]).toBeUndefined();
    /* And a caption about something else is not collateral. */
    expect(carried[facetOfSubject("brows")]).toBe("full, softly arched brows");
  });

  it("keeps no departed thing alive in the clause the painter is sent", () => {
    const carried = dropFacets(
      { [facetOfSubject("statedAccessories")]: "thin black rectangular glasses" },
      facetsWrittenBy(GONE),
    );
    expect(captionClause(carried)).not.toContain("glasses");
  });
});

/**
 * THE BOUNDARY, DECLARED (law 8, and the founder's fringe).
 *
 * A departure is the right shape only where absence is a state a person can be
 * in. "No her fringe — it has been taken off" is the maths-class answer to a
 * haircut ask, and it would render as exactly the absurdity it describes.
 */
describe("only things that sit on her can depart", () => {
  it("covers the things that come off", () => {
    for (const subject of ["statedAccessories", "ink", "marks", "facialHair"] as const) {
      expect(isDepartableSubject(subject), subject).toBe(true);
    }
  });

  it("leaves anatomy and hair to the stylist's road", () => {
    for (const subject of ["hairCut", "hairWorn", "nose", "jaw", "expression", "lips"] as const) {
      expect(isDepartableSubject(subject), subject).toBe(false);
    }
  });

  /* Every departable subject must have somewhere to be protected, or the tail
     cannot stop protecting it — the second mouth needs a mouth. */
  it("every departable subject moves the preservation tail", () => {
    for (const subject of DEPARTABLE_SUBJECTS) {
      const bare = composePreservation(new Set()).clause;
      const departed = composePreservation(
        facetsWrittenBy({ absent: { [subject]: ["something"] } }),
      ).clause;
      expect(departed, subject).not.toBe(bare);
    }
  });
});

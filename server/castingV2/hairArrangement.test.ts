/**
 * THE VOCABULARY'S OWN GUARD (D-238), driven without a model.
 *
 * Working law 2 says an instrument stands trial before its verdicts count. This
 * file is the half of that trial arithmetic can settle: that the list offered
 * to the vision pass and the list the parser accepts are the same list, that
 * free text is refused rather than approximated, and that the exact two strings
 * which cost `hairWorn` two 25% scores can never be pinned again.
 *
 * The other half — whether each value is TRUE of the faces this campaign has
 * walked — is a picture question and lives in
 * `scripts/calibration/hair-arrangement-court.mts`.
 */
import { describe, expect, it } from "vitest";

import {
  arrangementGuidance,
  arrangementIdOf,
  arrangementsWithPrecedent,
  arrangementWording,
  HAIR_ARRANGEMENTS,
  HAIR_ARRANGEMENT_IDS,
  HAIR_ARRANGEMENT_PRECEDENTS,
  isConstrainedArrangement,
  type HairArrangement,
} from "./hairArrangement";

describe("how the hair is worn is a closed list", () => {
  it("carries the value both broken pins were reaching for", () => {
    /* Run-12's pixie and run-13's tight crop are neither up nor down. Without
       this value the reader is made to argue about hair nobody arranged, which
       is exactly what it did, on two different faces, four frames each. */
    expect(HAIR_ARRANGEMENT_IDS).toContain("worn as cut");
  });

  it("offers the vision pass exactly the values the parser accepts", () => {
    /* Reverse direction. A model dutifully answering with a value the code has
       never heard of is a silent failure; a value the code accepts but never
       offers is a dead branch. Both are drift between two lists, so there is
       one list. */
    const offered = arrangementGuidance()
      .split("\n")
      .map((line) => /^- (.+?): /.exec(line)?.[1] ?? "");
    expect(offered).toEqual([...HAIR_ARRANGEMENT_IDS]);
    for (const id of offered) expect(arrangementIdOf(id)).toBe(id);
  });

  it("shows the wording beside each id, so a crop is not mistaken for 'down'", () => {
    const guidance = arrangementGuidance();
    for (const id of HAIR_ARRANGEMENT_IDS) {
      expect(guidance).toContain(`- ${id}: ${HAIR_ARRANGEMENTS[id]}`);
    }
  });

  it("gives every value ONE wording, and no two values the same one", () => {
    /* One fact, one wording (fable-048) — the painter, the pin and the reader
       all speak this string, so two values sharing one would make the pin
       unable to say which fact it is. */
    const wordings = HAIR_ARRANGEMENT_IDS.map((id) => arrangementWording(id));
    expect(new Set(wordings).size).toBe(wordings.length);
    for (const wording of wordings) expect(wording.length).toBeGreaterThan(0);
  });

  /*
    THE DEFECT ITSELF, PINNED.

    "Loose" means NOT GATHERED to this product and NOT TIGHTLY CURLED to anyone
    looking at curls. On run-13's crop the reader answered "not loose" three
    times and "worn loose" once — same pixels, same pin, opposite verdicts — and
    the word is why. It cannot be a value, and it must not creep into a wording
    either, because the wording is what the reader is shown.
  */
  it("cannot say 'loose' — not as a value, not inside a wording", () => {
    expect(arrangementIdOf("loose")).toBeNull();
    for (const id of HAIR_ARRANGEMENT_IDS) {
      expect(arrangementWording(id).toLowerCase()).not.toContain("loose");
    }
  });

  it("refuses the two strings that actually cost the campaign its score", () => {
    /* Verbatim from the walks: run-13's pin, and the shape run-12's took. */
    expect(arrangementIdOf("worn natural, loose")).toBeNull();
    expect(arrangementIdOf("pulled back low")).toBeNull();
    expect(arrangementIdOf("tied back, up")).toBeNull();
  });

  it("refuses the vision pass's two escape hatches", () => {
    /* Both mean "this build has no fact here", and no pin is the answer to
       that — an absent pin cannot argue with the picture (D-235's asymmetry). */
    expect(arrangementIdOf("other")).toBeNull();
    expect(arrangementIdOf("unclear")).toBeNull();
    expect(arrangementIdOf("")).toBeNull();
  });

  it("accepts a choice the model shouted or padded", () => {
    /* Case and whitespace are transport, not meaning. Anything beyond that is
       the model answering in its own words and takes the null road. */
    expect(arrangementIdOf("  Gathered ")).toBe("gathered");
    expect(arrangementIdOf("her hair is gathered")).toBeNull();
    /* And the two ids the merge retired are simply not ids any more. A pin
       carrying either is legacy free text and takes the retirement road. */
    expect(arrangementIdOf("up")).toBeNull();
    expect(arrangementIdOf("tied back")).toBeNull();
  });

  it("recognises its own wordings, and nothing else, as a standing pin", () => {
    for (const id of HAIR_ARRANGEMENT_IDS) {
      expect(isConstrainedArrangement(arrangementWording(id))).toBe(true);
    }
    /* Every pin written before this vocabulary existed — retired, never
       translated: the picture decides what her pin should have said. */
    expect(isConstrainedArrangement("worn natural, loose")).toBe(false);
    expect(isConstrainedArrangement("pulled back low")).toBe(false);
    /* Not even the bare id: the stored pin is the WORDING, because that is the
       string the painter and the reader both have to receive. */
    expect(isConstrainedArrangement("tied back")).toBe(false);
  });

  it("keeps every wording short enough to be a fact rather than a brief", () => {
    /* A pin is stated to the painter as ALREADY TRUE. A paragraph there is a
       description quietly replacing the photograph (D-152).

       Raised from 110 to 135 for exactly one wording — `gathered` — which needed
       the room to say WHERE to look ("behind the head") and which strands to
       forgive. It earned the clause with a court: 20/20 on the positives and
       10/10 on the controls, against 1/40 for the short version the ruling
       itself proposed. The cap is not a budget to spend; it is the line where a
       pin would start being a second brief, and one clause is not that. */
    for (const id of HAIR_ARRANGEMENT_IDS) {
      expect(arrangementWording(id).length).toBeLessThanOrEqual(135);
    }
  });

  it("names the arrangement AND its contrast in every wording", () => {
    /* The whole defect was an adjective that could be read against the cut. So
       each wording says what it is NOT as well as what it is, in the stylist's
       own vocabulary of gathering, tying and pinning. */
    const contrasts = /gather|tied|tie|pinned|fasten|hang|plait|comb|tuck|drawn/i;
    for (const id of HAIR_ARRANGEMENT_IDS) {
      expect(arrangementWording(id)).toMatch(contrasts);
    }
  });

  /*
    THE BOUNDARIES ARE PICTURES, AND THE SET OF PICTURES IS PINNED.

    Where two values are both defensible in words, no wording settles it — a
    wording is the thing that can be read two ways. The bob went to a ruling with
    its frame and came back `worn as cut`; the answer lives in exemplars the
    court replays, and these assertions stop one being dropped or re-valued in a
    refactor that never looks at a face.
  */
  describe("the boundaries, as case law", () => {
    it("keeps the bob ruling — three faces, not a sentence", () => {
      const bobs = [1567, 1565, 1561];
      for (const candidateId of bobs) {
        const precedent = HAIR_ARRANGEMENT_PRECEDENTS.find((row) => row.candidateId === candidateId);
        expect(precedent, `bob precedent ${candidateId} is missing`).toBeDefined();
        expect(precedent!.value).toBe("worn as cut");
      }
    });

    it("keeps `down` its own exemplars, so the bob ruling cannot swallow it", () => {
      expect(HAIR_ARRANGEMENT_PRECEDENTS.filter((row) => row.value === "down").length)
        .toBeGreaterThanOrEqual(2);
    });

    it("keeps the crop the value was written for", () => {
      /* Run-13's face. Without it, "worn as cut" could drift into meaning only
         'bob' now that bobs are in it. */
      const crop = HAIR_ARRANGEMENT_PRECEDENTS.find((row) => row.candidateId === 1564);
      expect(crop?.value).toBe("worn as cut");
      expect(crop?.candidate).toBe("72fa6229-6adf-453a-bff0-0dc9065c8b92");
    });

    it("records run-12's face as half-up — it is not the pixie two reports called it", () => {
      const runTwelve = HAIR_ARRANGEMENT_PRECEDENTS.find((row) => row.candidateId === 1482);
      expect(runTwelve?.value).toBe("half-up");
      expect(runTwelve?.candidate).toBe("8154ac6d-64ee-45ad-834b-fcbabca0f3ef");
    });

    it("names only values that exist, and says which have no face yet", () => {
      for (const row of HAIR_ARRANGEMENT_PRECEDENTS) {
        expect(HAIR_ARRANGEMENT_IDS).toContain(row.value);
        expect(row.why.length).toBeGreaterThan(0);
      }
      /* Declared rather than quietly true: chosen zero times on 57 faces, so no
         verdict about it should be trusted until a face for it exists. */
      const untested = HAIR_ARRANGEMENT_IDS.filter((id) => !arrangementsWithPrecedent().includes(id));
      expect(untested).toEqual(["tucked behind ears"]);
    });

    it("settles a boundary with more than one face on each side", () => {
      /* One exemplar per value is an anecdote; the neighbours that actually
         collided — `gathered` against `down` and against `ponytail`, and
         `worn as cut` against `down` — each carry two or more. `gathered`
         carries four, because it is the merge of two values whose seam three
         separate faces disproved. */
      for (const value of ["gathered", "worn as cut", "down", "ponytail"] as const) {
        expect(
          HAIR_ARRANGEMENT_PRECEDENTS.filter((row) => row.value === value).length,
          `${value} needs more than one face to be a boundary rather than an anecdote`,
        ).toBeGreaterThanOrEqual(2);
      }
    });
  });

  it("is total over its own type", () => {
    /* Compile-closed above; proven here too, so a value added without a wording
       is a red test as well as a red build. */
    const ids: HairArrangement[] = HAIR_ARRANGEMENT_IDS;
    expect(ids.length).toBe(Object.keys(HAIR_ARRANGEMENTS).length);
    for (const id of ids) expect(typeof HAIR_ARRANGEMENTS[id]).toBe("string");
  });
});

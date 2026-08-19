/**
 * The demand record's SHAPE — the part that can be proven without a database.
 *
 * This file exists for one failure that has no other detector. Both columns of
 * `casting_reference_reads` are MySQL enums, and MySQL's own answer to a value
 * outside an enum is not to refuse the insert — it is to write the EMPTY
 * STRING. A caller that drifts ahead of a migration therefore produces rows
 * that count toward a tally and name nothing, silently, forever.
 *
 * So the reader's refusal codes are walked against the column's own list here.
 * A fifth refusal added without a migration reddens this suite rather than
 * quietly filling a table with blanks.
 */
import { describe, expect, it } from "vitest";

import {
  CASTING_REFERENCE_READ_OUTCOMES,
  castingReferenceReads,
} from "../../drizzle/schema";
import { REFERENCE_INTENTS } from "../../shared/referenceIntents";
import { MAKEUP_READ_REFUSAL_CODES } from "../castingV2/makeupFromReference";
import { HAIR_COLOUR_READ_REFUSAL_CODES } from "../castingV2/hairColourFromReference";
import { referenceReadOutcomeFor } from "./castingV2ReferenceReads";

describe("the reference-read demand record", () => {
  it("holds a column value for every way a read can end badly", () => {
    /* The derivation under test, walked over the whole list rather than
       spot-checked: each refusal the reader can produce must snake-case onto a
       value the column actually holds. */
    for (const code of MAKEUP_READ_REFUSAL_CODES) {
      const outcome = referenceReadOutcomeFor({
        ok: false,
        refusal: { code, message: "irrelevant here" },
      });
      expect(
        CASTING_REFERENCE_READ_OUTCOMES,
        `the reader can refuse with "${code}" and the column has no value for it — that row would write as the empty string`,
      ).toContain(outcome);
    }
  });

  it("holds a column value for every way the HAIR reader can end badly", () => {
    /*
      THE SECOND READER, walked the same way — and this is the arm that would
      have caught the two words missing from the column when the colour take was
      wired. A reader whose refusals have no column value does not fail: the
      writer logs and skips, and the tally simply never learns that its gate is
      firing.
    */
    for (const code of HAIR_COLOUR_READ_REFUSAL_CODES) {
      const outcome = referenceReadOutcomeFor({
        ok: false,
        refusal: { code, message: "irrelevant here" },
      });
      expect(
        CASTING_REFERENCE_READ_OUTCOMES,
        `the hair reader can refuse with "${code}" and the column has no value for it`,
      ).toContain(outcome);
    }
  });

  it("keeps the two readers' gates APART in the tally", () => {
    /* `no_makeup_visible` and `no_hair_visible` are two facts about two
       readers, and a shared word would merge them with no way to ask which one
       is firing — which is what the `intent` column beside the outcome exists
       to prevent, and it cannot do it alone. */
    expect(referenceReadOutcomeFor({ ok: false, refusal: { code: "noHairVisible", message: "" } }))
      .toBe("no_hair_visible");
    expect(referenceReadOutcomeFor({ ok: false, refusal: { code: "noMakeupVisible", message: "" } }))
      .toBe("no_makeup_visible");
  });

  it("holds a value for the read that worked", () => {
    expect(CASTING_REFERENCE_READ_OUTCOMES).toContain(
      referenceReadOutcomeFor({ ok: true, sentence: "smoky eye", used: ["eyes"], dropped: [] }),
    );
  });

  it("spells the codes mechanically, so a fifth one needs no second list", () => {
    /* The positive control for the derivation itself: if this ever stopped
       converting case, the walk above would still pass for `unreadable` alone
       and fail loudly for the rest — this pins the rule rather than an example. */
    expect(referenceReadOutcomeFor({ ok: false, refusal: { code: "noMakeupVisible", message: "" } }))
      .toBe("no_makeup_visible");
    expect(referenceReadOutcomeFor({ ok: false, refusal: { code: "unreadable", message: "" } }))
      .toBe("unreadable");
  });

  it("carries the whole ruled intent vocabulary, including the forms not built", () => {
    /* The map is a founder ruling (fable-933) and the column follows it, not the
       build state — a hair read landing next month must not need a migration to
       be counted. */
    const column = castingReferenceReads.intent.enumValues;
    expect([...column].sort()).toEqual([...REFERENCE_INTENTS].sort());
  });

  it("has no column that could carry a person — the privacy boundary, asserted", () => {
    /*
      The short column list IS the boundary (invariant 8, migration 0031's rule
      applied again). The sentence a reader produced describes a real person's
      face; it is absent from the row rather than omitted from a projection.

      Asserted against the table object rather than the migration text, because
      the table object is what the writer inserts through.
    */
    const columns = Object.keys(castingReferenceReads);
    expect(columns.sort()).toEqual(["createdAt", "id", "intent", "outcome"]);
    for (const forbidden of ["userId", "candidateId", "sentence", "makeup", "storageKey", "instruction"]) {
      expect(columns).not.toContain(forbidden);
    }
  });
});

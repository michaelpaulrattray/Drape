/**
 * THE ATTACHMENT TABLE'S SHAPE — the part that can be proven without a database.
 *
 * Two failures with no other detector, and the second is the one that matters
 * on this road:
 *
 * - **an enum drifting from its constant.** `provenance` is the ink road's own
 *   two words, and MySQL's answer to a value outside an enum is to write the
 *   EMPTY STRING rather than to refuse — a row that claims a provenance and
 *   names none, on the one column the real-person fence rests on;
 * - **a column arriving that carries a person.** The short column list IS the
 *   privacy boundary (invariant 8), and this table keeps a photograph, so the
 *   list is asserted rather than trusted to review.
 *
 * The migration TEXT is compared as well as the table object, because a file can
 * be right about a table that was created from an older copy of it — and the
 * ceremony makes the third comparison, against what the database accepted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { castingReferenceAttachments } from "../../drizzle/schema";
import { INK_PROVENANCES } from "../../shared/inkProvenance";

const MIGRATION = readFileSync(
  new URL("../../drizzle/0043_casting_reference_attachments.sql", import.meta.url),
  "utf8",
);

describe("casting_reference_attachments", () => {
  it("spells provenance with the ink road's own two words, in both places", () => {
    expect([...castingReferenceAttachments.provenance.enumValues].sort())
      .toEqual([...INK_PROVENANCES].sort());
    /* And the migration file says the same thing — the copy that actually
       created the table. */
    for (const word of INK_PROVENANCES) {
      expect(MIGRATION).toContain(`'${word}'`);
    }
  });

  it("has no column that could carry a person, an ask, or a reader's prose", () => {
    /*
      Absent from the row rather than omitted from a projection. `sentence` and
      `instruction` are the two worth naming: a description of a real person's
      face, read off her own photograph, is the field this program is most
      careful never to persist.
    */
    const columns = Object.keys(castingReferenceAttachments);
    expect(columns.sort()).toEqual([
      "byteSize", "candidateId", "createdAt", "digest", "height", "id",
      "mime", "provenance", "publicId", "storageKey", "userId", "width",
    ]);
    for (const forbidden of ["sentence", "instruction", "makeup", "description", "caption", "faces"]) {
      expect(columns).not.toContain(forbidden);
    }
  });

  it("carries NO intents column, and the absence is deliberate rather than forgotten", () => {
    /*
      The ink design row has one; this one must not. That door is reached after
      a customer has said what she is taking, and this one before she has typed
      anything — so a NOT NULL intent here could only hold a guess about an ask
      that does not exist. The migration ARGUES for the absence in its own text,
      which is what stops a later reader "fixing" it.
    */
    expect(Object.keys(castingReferenceAttachments)).not.toContain("intents");
    expect(MIGRATION).toMatch(/THERE IS NO `intents` COLUMN/);
  });

  it("carries no placement and no side — it cannot claim anything about a body", () => {
    const columns = Object.keys(castingReferenceAttachments);
    expect(columns).not.toContain("placement");
    expect(columns).not.toContain("side");
  });

  it("is scoped by owner AND by candidate on the row itself", () => {
    /* Invariant 1 needs both: the candidate is what the purge enumerates, and
       the denormalised userId is what lets a read be owner-scoped in ONE
       statement rather than joined through the candidate every time. */
    expect(castingReferenceAttachments.userId.notNull).toBe(true);
    expect(castingReferenceAttachments.candidateId.notNull).toBe(true);
  });

  it("states the two lines that CONTAIN the keep, where the row is defined", () => {
    /*
      Ordered fable-1071 §4, and asserted rather than trusted for the reason the
      whole day's work was about: a bound that lives only in a design note is a
      bound the next reader of this table will not be holding. Both sentences
      are load-bearing — the first is what stops a whole photograph reaching an
      engine, the second is what stops it reaching a staff member.
    */
    expect(MIGRATION).toMatch(/NEVER RIDES WHOLE TO ANY ENGINE\. CROPS ONLY/);
    expect(MIGRATION).toMatch(/NO STAFF PROJECTION EVER SELECTS THIS ROW/);
  });

  it("states in its own text that the picture is KEPT, and that this is a change", () => {
    /*
      Not decoration. 0040's docblock still says a reference is "read once and
      dropped" and that no rectangle of a stranger's face exists in this
      product — true of the CROP row and no longer true of the product. A
      migration that quietly reverses a stated policy is how a table ends up
      justified by a sentence that moved.
    */
    expect(MIGRATION).toMatch(/THE PHOTOGRAPH IS KEPT, AND THAT IS A CHANGE/);
    expect(MIGRATION).toMatch(/fable-1063/);
  });
});

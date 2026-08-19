import { describe, expect, it } from "vitest";

import {
  INK_PLACEMENT_MAX_LENGTH,
  INK_PLACEMENT_TALLY_MAX_LENGTH,
  INK_PLACEMENT_TALLY_UNKEPT,
  inkPlacementColumnValue,
  inkPlacementTallyValue,
  resolveInkPlacement,
} from "./inkPlacementResolve";
import { INK_PLACEMENTS, inkPlacementEntry } from "../../shared/inkPlacementVocabulary";

describe("the measured surfaces are found however she spells them", () => {
  /*
    THE CAMELCASE TRAP, FIRST AND BY NAME.

    A resolver that lowercased before asking the vocabulary turns `upperArm`
    into `upperarm` and files HIS OLDEST MEASURED PLACEMENT as an open phantom
    — five of the seven design rows in the dev database are `upperArm`. This
    arm is the one that reddens if anybody ever "simplifies" the match.
  */
  it("finds upperArm from the key itself, camelCase intact", () => {
    expect(resolveInkPlacement("upperArm")).toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("finds the same surface from the reader's word and the customer's noun", () => {
    expect(resolveInkPlacement("upper arm")).toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("her upper arm")).toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("is not thrown by casing or spacing, which are transport and not meaning", () => {
    expect(resolveInkPlacement("  Upper   Arm  ")).toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("NECK")).toEqual({ kind: "measured", placement: "neck" });
  });

  it("matches EVERY member by all three of its spellings, so a fourth joins by existing", () => {
    /* The derivation asserted rather than the three cases spot-checked: a
       placement added to the vocabulary is matchable the moment it is added,
       and this arm is what says so. */
    for (const key of INK_PLACEMENTS) {
      const entry = inkPlacementEntry(key);
      for (const spelling of [key, entry.readerWord, entry.noun]) {
        expect(resolveInkPlacement(spelling), `${key} via "${spelling}"`)
          .toEqual({ kind: "measured", placement: key });
      }
    }
  });
});

describe("a word the vocabulary never measured is HERS, not a refusal", () => {
  it("files a sleeve as an open phrase", () => {
    expect(resolveInkPlacement("sleeve")).toEqual({ kind: "open", phrase: "sleeve" });
  });

  it("collapses casing and spacing into one signal", () => {
    for (const raw of ["Sleeve", " sleeve ", "SLEEVE", "sleeve"]) {
      expect(resolveInkPlacement(raw)).toEqual({ kind: "open", phrase: "sleeve" });
    }
  });

  it("DOES NOT merge a full sleeve into a sleeve — the meaning line", () => {
    /*
      The line this resolver will not cross, asserted so a later convenience
      cannot cross it quietly. A full sleeve and a half sleeve are different
      pieces of work; merging them hands the founder a number a machine has
      already applied a judgement to. The synonym judgement belongs to the human
      reading the tally.
    */
    const sleeve = resolveInkPlacement("sleeve");
    const full = resolveInkPlacement("full sleeve");
    expect(full).toEqual({ kind: "open", phrase: "full sleeve" });
    expect(full).not.toEqual(sleeve);
  });

  it("never strips an article, because that is inference", () => {
    expect(resolveInkPlacement("the ribs")).toEqual({ kind: "open", phrase: "the ribs" });
    expect(resolveInkPlacement("my ribs")).toEqual({ kind: "open", phrase: "my ribs" });
    /* And the two are not merged with each other, for the same reason. */
    expect(resolveInkPlacement("the ribs")).not.toEqual(resolveInkPlacement("ribs"));
  });
});

describe("the two answers that are questions, never refusals", () => {
  it("says ABSENT for a place nobody named", () => {
    for (const raw of ["", "   ", "\t\n "]) {
      expect(resolveInkPlacement(raw)).toEqual({ kind: "absent" });
    }
  });

  it("says TOO LONG for a sentence, with the length so the caller can say it", () => {
    const sentence = "x".repeat(INK_PLACEMENT_MAX_LENGTH + 1);
    expect(resolveInkPlacement(sentence)).toEqual({
      kind: "tooLong",
      length: INK_PLACEMENT_MAX_LENGTH + 1,
    });
  });

  it("admits a phrase of exactly the cap — the boundary, from the storable side", () => {
    const exact = "x".repeat(INK_PLACEMENT_MAX_LENGTH);
    expect(resolveInkPlacement(exact)).toEqual({ kind: "open", phrase: exact });
  });

  it("asks the MEASURED question before the length one", () => {
    /*
      Order, asserted rather than assumed. A measured spelling is short by
      construction so this can never bite today — which is exactly why it is
      pinned: a cap written for open prose must never become a gate on the
      vocabulary as well.
    */
    expect(INK_PLACEMENT_MAX_LENGTH).toBeGreaterThan("her upper chest".length);
    expect(resolveInkPlacement("her upper chest")).toEqual({ kind: "measured", placement: "upperChest" });
  });
});

describe("what each row stores", () => {
  it("the design row keeps the key for a measured surface and her phrase otherwise", () => {
    expect(inkPlacementColumnValue(resolveInkPlacement("her neck"))).toBe("neck");
    expect(inkPlacementColumnValue(resolveInkPlacement("sleeve"))).toBe("sleeve");
  });

  it("stores nothing for the two questions, because there is no ask yet", () => {
    expect(inkPlacementColumnValue(resolveInkPlacement(""))).toBeNull();
    expect(inkPlacementColumnValue(resolveInkPlacement("x".repeat(200)))).toBeNull();
  });

  it("every storable value fits the column, on every branch", () => {
    for (const raw of ["upperArm", "her upper chest", "sleeve", "x".repeat(INK_PLACEMENT_MAX_LENGTH)]) {
      const value = inkPlacementColumnValue(resolveInkPlacement(raw));
      expect(value === null || value.length <= INK_PLACEMENT_MAX_LENGTH, `"${raw.slice(0, 20)}"`).toBe(true);
    }
  });
});

describe("the tally keeps place names and refuses to keep sentences", () => {
  it("derives its bound from the vocabulary rather than from a feel", () => {
    /* Twice the longest thing this vocabulary has ever needed to say — `her
       upper chest`, 15 characters. Asserted as the DERIVATION so a fourth
       placement moves it without anybody editing a number. */
    const longest = Math.max(...INK_PLACEMENTS.flatMap((key) => {
      const entry = inkPlacementEntry(key);
      return [key.length, entry.readerWord.length, entry.noun.length];
    }));
    expect(longest).toBe("her upper chest".length);
    expect(INK_PLACEMENT_TALLY_MAX_LENGTH).toBe(2 * longest);
  });

  it("keeps a place-name-sized phrase exactly as the design row has it", () => {
    expect(inkPlacementTallyValue(resolveInkPlacement("sleeve"))).toBe("sleeve");
    expect(inkPlacementTallyValue(resolveInkPlacement("upperArm"))).toBe("upperArm");
  });

  it("replaces a longer phrase with a sentinel rather than truncating it", () => {
    /*
      THE PRIVACY BOUNDARY AT ITS EXACT EDGE. `casting_ink_form_demand` exists
      as its own table because its columns cannot be traced to a person. A
      truncation is a phrase somebody could still read; a sentinel is not.
    */
    const long = "my right arm where my son's name is already tattooed";
    expect(long.length).toBeGreaterThan(INK_PLACEMENT_TALLY_MAX_LENGTH);
    expect(long.length).toBeLessThanOrEqual(INK_PLACEMENT_MAX_LENGTH);

    const resolved = resolveInkPlacement(long);
    expect(resolved.kind).toBe("open");
    /* It is HERS on her own row… */
    expect(inkPlacementColumnValue(resolved)).toBe(long);
    /* …and it is nobody's on the unattributed one. */
    expect(inkPlacementTallyValue(resolved)).toBe(INK_PLACEMENT_TALLY_UNKEPT);
  });

  it("uses a sentinel no customer phrase can forge", () => {
    /*
      Uppercase, and the normaliser lowercases — so the sentinel is unreachable
      from any input rather than merely unlikely. A sentinel a customer could
      type is one that eventually means two things.
    */
    expect(INK_PLACEMENT_TALLY_UNKEPT).toBe(INK_PLACEMENT_TALLY_UNKEPT.toUpperCase());
    expect(INK_PLACEMENT_TALLY_UNKEPT).not.toBe(INK_PLACEMENT_TALLY_UNKEPT.toLowerCase());
    const forged = resolveInkPlacement(INK_PLACEMENT_TALLY_UNKEPT);
    expect(forged).toEqual({ kind: "open", phrase: "open" });
    expect(inkPlacementTallyValue(forged)).toBe("open");
    expect(inkPlacementTallyValue(forged)).not.toBe(INK_PLACEMENT_TALLY_UNKEPT);
  });

  it("keeps a MEASURED key whatever its length, because a key is not prose", () => {
    /* The tally bound is about free text. A vocabulary key is a value we chose
       and it identifies nobody, so it is never sentinelled — a distinction that
       only shows itself if a long placement is ever measured. */
    for (const key of INK_PLACEMENTS) {
      expect(inkPlacementTallyValue({ kind: "measured", placement: key })).toBe(key);
    }
  });
});

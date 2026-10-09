import { describe, expect, it } from "vitest";

/**
 * FIVE REQUEST IDS FROM ONE PRESS (#1903 slice 2).
 *
 * A redo is one deliberate intent that becomes five charged operations, and the
 * `clientRequestId` IS the idempotency key — so the five have to be distinct
 * (or four would read as replays of the first and return its receipt) and they
 * have to be DERIVED (or a double press would buy a second package).
 *
 * Driven directly rather than through the entrance, because the failure mode is
 * arithmetic: roughly 15 of every 16 raw hash slices land outside the UUID
 * grammar's version or variant nibbles, and a derivation that threw on most
 * inputs would look random instead of wrong.
 */
import { assertClientRequestId, isClientRequestId } from "../../shared/clientRequestId";
import { CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import { derivedClientRequestId } from "./operationContract";

const PRESS = "9f1c2b7a-5e44-4a31-9b02-7c6d1e5a8f30";
const OTHER_PRESS = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("the derived request id", () => {
  it("is a real UUID the claim store will accept", () => {
    for (const angle of CAST_VIEW_ANGLES) {
      const derived = derivedClientRequestId(PRESS, angle);
      /* The assertion the claim makes, made here: the one failure worse than a
         throw is a key `claimGenerationOperation` accepts and the grammar
         would not. */
      expect(() => assertClientRequestId(derived)).not.toThrow();
      expect(isClientRequestId(derived)).toBe(true);
    }
  });

  it("gives every view its own id", () => {
    /*
      THE ARM THAT MATTERS MOST. Two views sharing an id means the second claim
      reads as a replay of the first: one render, one charge, and a receipt
      claiming two views — which on this road is a customer charged for five
      views and handed fewer.
    */
    const ids = CAST_VIEW_ANGLES.map((angle) => derivedClientRequestId(PRESS, angle));
    expect(new Set(ids).size).toBe(CAST_VIEW_ANGLES.length);
  });

  it("is stable for the same press and view", () => {
    /* What makes a double press a replay rather than a second purchase. */
    expect(derivedClientRequestId(PRESS, "closeUp"))
      .toBe(derivedClientRequestId(PRESS, "closeUp"));
  });

  it("differs per press, so two redos are two purchases", () => {
    /*
      The negative control of the arm above, and the direction that would cost
      money the other way: if the press did not participate, a customer's SECOND
      redo would replay the first one's receipt and they would be handed the same
      pictures for a second charge — or, worse, no charge and no pictures.
    */
    expect(derivedClientRequestId(PRESS, "closeUp"))
      .not.toBe(derivedClientRequestId(OTHER_PRESS, "closeUp"));
  });

  it("refuses a parent that is not a UUID, and an empty label", () => {
    expect(() => derivedClientRequestId("not-a-uuid", "closeUp")).toThrow(TypeError);
    expect(() => derivedClientRequestId(PRESS, "")).toThrow(TypeError);
  });

  it("writes the version and variant the grammar checks, on EVERY angle", () => {
    /*
      ⚠ THE TWO BIT-WRITES ARE LOAD-BEARING AND THIS IS THEIR CONTROL. Without
      them the derivation is a raw hash slice, which satisfies the grammar only
      by luck: the version nibble must be 1-8 and the variant nibble 8/9/a/b.
      Asserting the characters directly means a removed mask is caught on the
      first angle rather than on whichever one happened to hash badly.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      const derived = derivedClientRequestId(PRESS, angle);
      expect(derived[14]).toBe("5");
      expect(["8", "9", "a", "b"]).toContain(derived[19]);
    }
  });
});

/**
 * THE BADGE IS DERIVED, AND THESE ARMS ARE WHAT SAYS SO — N2b (#1242).
 *
 * His brief stores `draftedAt`/`editedAt` *"so the badge is derived, not stored
 * as a flag"*, and the failure that choice avoids is specific: a stored
 * `isDraft` outlives the edit that was supposed to clear it, and the card then
 * tells a customer that her own sentence was written for her. So the derivation
 * is driven directly, including the two directions a one-sided arm would miss.
 *
 * ⚠ **AND THE PROJECTION IS DRIVEN THROUGH `projectSignedCast` TOO**, not only
 * through the little function, because the thing that actually reaches a
 * customer is the room's payload. A derivation that is right while nothing
 * calls it is invariant 7's shape, and this feature's whole surface is one
 * field on one projection.
 */
import { describe, expect, it } from "vitest";

import { projectCastPersona } from "./castPersonaProjection";

const DRAFTED = new Date("2026-10-09T01:00:00.000Z");
const EDITED = new Date("2026-10-09T02:00:00.000Z");

const row = (over: Partial<Parameters<typeof projectCastPersona>[0]> = {}) => ({
  personality: null,
  voice: null,
  personaDraftedAt: null,
  personalityEditedAt: null,
  voiceEditedAt: null,
  ...over,
});

/* --------------------------------------------------- absent is not empty */

describe("a Cast with no lines gets no card at all", () => {
  it("answers null when both lines are absent — never an empty card", () => {
    expect(projectCastPersona(row())).toBeNull();
  });

  it("answers null for a Cast signed before N2b, stamp and all", () => {
    /* There is no such row today — the stamp and the text are written in one
       statement — but a stamp with no text must never draw a badged blank. */
    expect(projectCastPersona(row({ personaDraftedAt: DRAFTED }))).toBeNull();
  });

  it("treats whitespace as absent rather than as a line", () => {
    expect(projectCastPersona(row({ personality: "   ", voice: "\n" }))).toBeNull();
  });
});

/* ------------------------------------------- drafted, and not since edited */

describe("the badge is drafted AND not since edited", () => {
  it("badges a line we drafted and she has not touched", () => {
    const read = projectCastPersona(row({
      personality: "Unhurried, hands still.",
      voice: "Low and level.",
      personaDraftedAt: DRAFTED,
    }));
    expect(read?.personality).toEqual({ text: "Unhurried, hands still.", drafted: true });
    expect(read?.voice).toEqual({ text: "Low and level.", drafted: true });
  });

  /*
    ⚠ THE DEFECT A STORED FLAG WOULD HAVE SHIPPED. The draft stamp is STILL on
    the row after her edit — it records when WE drafted, not whose the words are
    now — so an arm that only checked the stamp would be green here while the
    card called her own sentence a draft.
  */
  it("drops the badge on a line she has rewritten, with the draft stamp still on the row", () => {
    const read = projectCastPersona(row({
      personality: "Her own words.",
      voice: "Low and level.",
      personaDraftedAt: DRAFTED,
      personalityEditedAt: EDITED,
    }));
    expect(read?.personality?.drafted).toBe(false);
    /* ⚠ AND THE OTHER CARD KEEPS ITS BADGE — two stamps, not one, because
       rewriting who she is must not un-badge how she sounds. */
    expect(read?.voice?.drafted).toBe(true);
  });

  it("drops the badge the other way round too", () => {
    const read = projectCastPersona(row({
      personality: "Unhurried, hands still.",
      voice: "Her own words.",
      personaDraftedAt: DRAFTED,
      voiceEditedAt: EDITED,
    }));
    expect(read?.voice?.drafted).toBe(false);
    expect(read?.personality?.drafted).toBe(true);
  });

  it("badges nothing that was never drafted, however it got there", () => {
    const read = projectCastPersona(row({ personality: "Typed by hand.", voice: "By hand." }));
    expect(read?.personality?.drafted).toBe(false);
    expect(read?.voice?.drafted).toBe(false);
  });
});

/* ---------------------------------------------------------- a half answer */

describe("one line present and one absent draws the card it has", () => {
  it("keeps the personality and says nothing about the voice", () => {
    const read = projectCastPersona(row({
      personality: "Unhurried, hands still.",
      personaDraftedAt: DRAFTED,
    }));
    expect(read?.personality?.text).toBe("Unhurried, hands still.");
    expect(read?.voice).toBeNull();
  });
});

/* -------------------------------------------------------- trimming is ours */

describe("the stored text is handed over trimmed", () => {
  it("trims what a model left on either end", () => {
    const read = projectCastPersona(row({
      personality: "  Unhurried, hands still.\n",
      voice: " Low. ",
      personaDraftedAt: DRAFTED,
    }));
    expect(read?.personality?.text).toBe("Unhurried, hands still.");
    expect(read?.voice?.text).toBe("Low.");
  });
});

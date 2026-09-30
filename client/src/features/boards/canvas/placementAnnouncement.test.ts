/**
 * A CHARGED-BUT-UNPLACED CAST EXPLAINS ITSELF — driven, and guarded at source.
 *
 * Card 1571. Three sentences were written by the server and read by NOBODY in
 * the client; the only reader in the tree was a server test asserting their
 * contents, which is what kept a dead field looking alive for as long as it
 * did. So the arms here are in two halves, and the second is the one that
 * matters:
 *
 *   1. the RULE, driven directly — when to speak and with what;
 *   2. the HOOK, guarded at source, because a rule nothing calls is the exact
 *      defect this card is about arriving one layer down. There is no DOM
 *      environment in this repository (`vitest.config.ts` is
 *      `environment: "node"`, its client include ends in `.test.ts`, zero
 *      `.test.tsx` files), so a render is not available and a source guard with
 *      a positive control is the house idiom (`staffRole.test.ts`,
 *      `section05-guard.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { placementAnnouncement, PLACEMENT_ANNOUNCEMENT_MS } from "./placementAnnouncement";

const HOOK = path.join(__dirname, "useCastActions.ts");
const hookSource = readFileSync(HOOK, "utf8");

describe("what a charged-but-unplaced cast says", () => {
  const SENTENCE = "Your cast was created and charged — find the draft in your Library. "
    + "Placing it on the board failed; it was not charged twice.";

  it("announces the server's own sentence when the cast was not placed", () => {
    expect(placementAnnouncement({ placed: false, placementMessage: SENTENCE })).toBe(SENTENCE);
  });

  it("says NOTHING on the ordinary success, where the node appearing is the feedback", () => {
    expect(placementAnnouncement({ placed: true })).toBeNull();
  });

  it("⚠ says NOTHING when the response was never about placing anything", () => {
    /*
      The arm that decides between `placed === false` and `!placed`. The field
      is ABSENT on every road that places nothing, and `!undefined` is `true` —
      so the loose test announces a failure on all of them, with no sentence to
      show. A blank toast over someone's canvas, on every successful action.
    */
    expect(placementAnnouncement({})).toBeNull();
    expect(placementAnnouncement({ placementMessage: SENTENCE })).toBeNull();
  });

  it("says nothing rather than inventing words when the sentence is missing or blank", () => {
    /*
      The words are the SERVER's and #1565 has already had to correct them once
      — two of the three said "saved in Models", naming a page the rail has
      called Library since the foundation landed. A fallback authored here
      would be a second copy of a sentence that has drifted before.
    */
    expect(placementAnnouncement({ placed: false })).toBeNull();
    expect(placementAnnouncement({ placed: false, placementMessage: null })).toBeNull();
    expect(placementAnnouncement({ placed: false, placementMessage: "   " })).toBeNull();
  });

  it("stays on screen as long as this app's other money sentences", () => {
    // Not a number chosen here: it is what the variation failures, the package
    // refresh and the cast gate already give a money-adjacent line.
    expect(PLACEMENT_ANNOUNCEMENT_MS).toBe(9_000);
  });
});

describe("the hook actually calls it", () => {
  /*
    ⚠ THE HALF THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. A perfect rule with
    no caller is `placementMessage` again, one layer down — and the rule's own
    suite would stay green through it, which is precisely how the server's
    three sentences kept a live reputation while reaching nobody.
  */
  it("reads the outcome and raises it on the run-generation success", () => {
    expect(hookSource).toContain("placementAnnouncement(result)");
    expect(hookSource).toContain("toast.warning(announcement");
    expect(hookSource).toContain("PLACEMENT_ANNOUNCEMENT_MS");
  });

  it("⚠ is a POSITIVE CONTROL — the file it reads is the real hook, not an empty string", () => {
    /*
      A source guard that silently read the wrong path would pass every
      assertion above by asserting nothing, forever. So the same read is shown
      to contain something only this hook has.
    */
    expect(hookSource.length).toBeGreaterThan(500);
    expect(hookSource).toContain("trpc.boardOps.runGeneration.execute.useMutation");
  });

  it("does NOT call it an error — the cast succeeded and the charge was right", () => {
    /*
      The sentence's whole job is to say the money is fine. Announcing it as an
      error tells the reader the opposite of what they are reading, on the one
      path where that distinction is the entire point.
    */
    const success = hookSource.slice(
      hookSource.indexOf("runGeneration.execute.useMutation"),
      hookSource.indexOf("onError"),
    );
    expect(success).toContain("toast.warning");
    expect(success).not.toContain("toast.error");
  });
});

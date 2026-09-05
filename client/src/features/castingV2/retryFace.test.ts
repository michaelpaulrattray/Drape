import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { retryShowsSkeleton } from "./retryFace";

/**
 * #551 — RETRY SAID NOTHING FOR FIVE SECONDS.
 *
 * The founder clicked Retry on a failed tile and watched it keep its failure
 * face while the engine worked: *"to a user it would feel like you clicked
 * retry there was a 5 second delay and there something happened rather than an
 * immediate effect."*
 *
 * Every arm here has its opposite beside it. A predicate that only ever
 * answered `true` would satisfy the "it paints" arm and blank every delivered
 * face on the sheet; one that only ever answered `false` would satisfy nothing
 * and restore the exact defect. Both must be catchable.
 */

const TILE = new URL("./components/CandidateTile.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

describe("the tile paints on the click, not on the poll", () => {
  it("shows the skeleton the moment a failed tile's retry is out", () => {
    /* The fix itself: this is the thing that must keep working. */
    expect(retryShowsSkeleton({ status: "failed-refunded", retrying: true })).toBe(true);
  });

  it("keeps the failure when nothing has been clicked", () => {
    /*
      The defect's other half. A failed tile at rest is a failed tile — it says
      what went wrong and offers the Retry button, and covering that with a
      skeleton would be a sheet that never admits anything failed.
    */
    expect(retryShowsSkeleton({ status: "failed-refunded", retrying: false })).toBe(false);
    expect(retryShowsSkeleton({ status: "failed-refunded" })).toBe(false);
  });

  it("returns the tile to its failure when the flag clears", () => {
    /*
      The refusal path, stated as the sequence it actually is. The sheet clears
      `retrying` in its `finally`, so a refused retry — closed scope, no
      credits, a second content-filter hit — lands back here, and the tile must
      go back to the face that carries the toast's explanation.
    */
    const clicked = retryShowsSkeleton({ status: "failed-refunded", retrying: true });
    const refused = retryShowsSkeleton({ status: "failed-refunded", retrying: false });
    expect([clicked, refused]).toEqual([true, false]);
  });
});

describe("the flag can never blank a face the user is looking at", () => {
  it("leaves a DELIVERED candidate alone even with the flag set", () => {
    /*
      ⚠ The arm worth keeping. `retrying` is only offered on a failed tile
      today, so this cannot fire in the product as it stands — which is exactly
      why it is asserted rather than assumed. Without the status narrowing, a
      future caller setting this flag on a ready face replaces a finished
      picture with a skeleton that will never resolve.
    */
    expect(retryShowsSkeleton({ status: "ready", retrying: true })).toBe(false);
  });

  it("leaves a SIGNED candidate alone even with the flag set", () => {
    /*
      A signed face is a 450-credit purchase and her tile is how she is found
      again (the ruling in `CandidateTile`'s signed branch). Hiding her behind a
      skeleton is the same lost-Cast defect that branch was written for.
    */
    expect(retryShowsSkeleton({ status: "signed", retrying: true })).toBe(false);
  });

  it("does not claim credit for a tile that is already casting", () => {
    /*
      Such a tile shows the skeleton from its own status. Answering `true` here
      would make this predicate look like the reason, and would hide a real
      regression in the status branch behind a passing arm.
    */
    expect(retryShowsSkeleton({ status: "casting", retrying: true })).toBe(false);
  });
});

describe("the predicate is wired, not merely present", () => {
  /*
    Invariant 7: a control that is not invoked does not exist. The arms above
    would all pass with this module imported by nothing — the defect would be
    live and the suite green — so the wiring is asserted at both ends.
  */
  it("is what the tile asks before choosing its face", async () => {
    const tile = await readFile(TILE, "utf8");
    expect(tile).toContain("retryShowsSkeleton");
    /*
      And it must govern the CASTING branch, which is where the skeleton is
      drawn. A tile that computed the answer and then ignored it would satisfy
      a bare "is the name present" check.
    */
    expect(tile).toMatch(/candidate\.status === "casting" \|\| retryInFlight/);
  });

  it("is fed by the sheet from the same state the button reads", async () => {
    const sheet = await readFile(SHEET, "utf8");
    /*
      One fact, two readings. `busy` disables the button and `retrying` paints
      the tile, and both come from the same map — a second piece of state for
      the face is a second thing that can disagree with the button.
    */
    expect(sheet).toMatch(/retrying=\{Boolean\(retrying\[candidate\.candidateId\]\)\}/);
    expect(sheet).toContain("setRetrying((current) => ({ ...current, [candidateId]: Date.now() }))");
  });
});

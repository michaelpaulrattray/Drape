import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { inFlightCandidate, refineBusy } from "./refineBusy";

/**
 * THE TWO WAYS THE SHEET LOCKED A FACE IT HAD NO BUSINESS LOCKING.
 *
 * Both were live founder findings on the evening of 2026-08-13, and both were
 * one expression: `refine.isPending || pending.length > 0`, evaluated for the
 * whole sheet and never asking whose render it was or whether anyone was still
 * running it.
 *
 * Every test here has its negative control beside it, because a predicate that
 * only ever returns `false` would pass the release arms and quietly delete the
 * protection that stops an edit being bought twice (D-161).
 */

const HER = "cand-her";
const THE_OTHER = "cand-other";

const live = { stage: "dispatched" as const };
const queued = { stage: "queued" as const };
const settling = { stage: "settling" as const };

describe("a render belongs to the face it was asked about (fable-465)", () => {
  it("locks the face the request is out for", () => {
    /* The protection, first: this is what must keep working. */
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: HER,
      pending: [],
    })).toBe(true);
  });

  it("leaves ANOTHER cast alone while that one renders", () => {
    /*
      The founder's own sentence: *"i was not rendering her image i was
      rendering another cast image"* — and her boxes were gone and her button
      said "Refining…". One mutation hook, eight faces.
    */
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: THE_OTHER,
      pending: [],
    })).toBe(false);
  });

  it("reads the subject off the request itself, only while it is out", () => {
    /*
      `variables` survives the mutation settling — TanStack keeps the last ones
      — so a predicate that read them unconditionally would leave the last face
      edited locked forever.
    */
    expect(inFlightCandidate({ isPending: true, variables: { candidateId: HER } })).toBe(HER);
    expect(inFlightCandidate({ isPending: false, variables: { candidateId: HER } })).toBe(null);
    expect(inFlightCandidate({ isPending: true, variables: undefined })).toBe(null);
  });

  it("does not lock every face when no face is open", () => {
    /* `null === null` is the trap this guards: a closed viewer must not match
       a mutation that is out for nothing. */
    expect(refineBusy({
      viewerCandidateId: null,
      inFlightCandidateId: null,
      pending: [],
    })).toBe(false);
  });
});

describe("a row nobody is rendering gives the customer their hands back (fable-466/467)", () => {
  it("locks while the server says someone is drawing it", () => {
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: null,
      pending: [live],
    })).toBe(true);
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: null,
      pending: [queued],
    })).toBe(true);
  });

  it("RELEASES once the row is settling", () => {
    /*
      The lease has passed, the worker is dead, the sweep owns the row and is
      refunding it. Holding the ask box shut on it protects nothing — there is
      no picture coming to be bought twice — and the founder sat in it for five
      minutes with only a manual refresh as an exit.
    */
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: null,
      pending: [settling],
    })).toBe(false);
  });

  it("still locks when a settling row sits beside a live one", () => {
    /* The mixed case: one dead row must not unlock the face a SECOND render is
       genuinely still out on. */
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: null,
      pending: [settling, live],
    })).toBe(true);
  });

  it("treats a row with no stage as still running", () => {
    /* An older server, or a field that stops being sent: cannot-tell must
       claim less, never more. */
    expect(refineBusy({
      viewerCandidateId: HER,
      inFlightCandidateId: null,
      pending: [{}],
    })).toBe(true);
  });
});

describe("the sheet computes this in one place", () => {
  const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

  it("uses the derivation for both surfaces and keeps no copy of the old one", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("refineBusy({");
    /*
      Both consumers — the boxes ON the picture (`FaceRegions`) and the ask box
      under it (`RefinePanel`) — take the same value. Two of them is the whole
      count, and a third `busy=` would be a third answer to one question.
    */
    expect(sheet.match(/busy=\{viewerBusy\}/g)?.length).toBe(2);
    /* The defect itself, spelled out: the sheet-wide term must not come back
       beside the derivation. */
    expect(sheet).not.toContain("refine.isPending ||");
  });
});

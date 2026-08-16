import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { PendingStage } from "./refineBusy";
import {
  PROVISIONAL_GHOST_ID,
  inFlightCandidate,
  refineBusy,
  refineGhosts,
  refineWait,
} from "./refineBusy";

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

describe("his evening, in order (fable-474 §2)", () => {
  /*
    THE REGRESSION TEST THAT IS THE FOUNDER'S OWN SEQUENCE, start to finish.
    The arms above each hold one rule; this holds the walk they were found in,
    so a future change that satisfies every rule separately and still recreates
    his night has somewhere to fail.
  */
  it("edit cast A · look at cast B · A's worker dies · the sheet comes back", () => {
    const A = "cand-A";
    const B = "cand-B";

    /* 1. He fires an edit on A, and is looking at A. */
    let inFlight: string | null = A;
    expect(refineBusy({ viewerCandidateId: A, inFlightCandidateId: inFlight, pending: [] })).toBe(true);

    /* 2. He walks the viewer to B, which is rendering nothing. This is where
          his boxes vanished and B's button read "Refining…". */
    expect(refineBusy({ viewerCandidateId: B, inFlightCandidateId: inFlight, pending: [] })).toBe(false);

    /* 3. The request comes back (his was a lost-contact rejection), so the
          client's own knowledge falls away — and A is still busy, because the
          SERVER says a row is running on it. */
    inFlight = null;
    expect(refineBusy({ viewerCandidateId: A, inFlightCandidateId: inFlight, pending: [live] })).toBe(true);

    /* 4. A's worker dies. For as long as the lease runs the row still reads
          dispatched, and A stays honestly shut — this is the designed cost. */
    expect(refineBusy({ viewerCandidateId: A, inFlightCandidateId: inFlight, pending: [live] })).toBe(true);
    /*    …and B is untouched throughout, which is the half he lost. */
    expect(refineBusy({ viewerCandidateId: B, inFlightCandidateId: inFlight, pending: [] })).toBe(false);

    /* 5. The lease passes. The sweep owns the row, the server says settling,
          and A gives him his hands back — no refresh. */
    expect(refineBusy({ viewerCandidateId: A, inFlightCandidateId: inFlight, pending: [settling] })).toBe(false);
  });
});

describe("the sheet computes this in one place", () => {
  const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

  it("uses the derivation for both surfaces and keeps no copy of the old one", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("refineBusy({");
    /* And the wait is the derivation's too, not a second answer assembled in
       the page — the seam where the two surfaces drifted apart. */
    expect(sheet).toContain("refineWait({");
    expect(sheet).not.toContain("filter((row) => row.stage !== \"settling\").at(-1)");
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

/**
 * THE PHOTOGRAPH AND THE BUTTON, SAYING THE SAME THING AT THE SAME TIME
 * (fable-582, from the founder: *"it does go into a loading state eventually
 * but it takes awhile"*).
 *
 * The button was instant and the picture was not, because one read the click
 * and the other read the server. These drive the handover in both directions:
 * the click narrates immediately, the row takes over the moment it exists, and
 * the row keeps narrating when the click is long gone — which is the half that
 * must not regress, because a wait that dies with the panel is how one edit got
 * bought twice (D-161).
 */
describe("the wait the picture shows", () => {
  const out = { isPending: true, variables: { candidateId: HER, instruction: "give her horns" } };
  const idle = { isPending: false, variables: { candidateId: HER, instruction: "give her horns" } };
  const row = (over: Record<string, unknown> = {}) => ({
    stage: "dispatched" as PendingStage, instruction: "dangly cross earrings", ...over,
  });

  it("narrates from the click, before the server has a row for it", () => {
    expect(refineWait({ viewerCandidateId: HER, mutation: out, pending: [] }))
      .toEqual({ instruction: "give her horns", stage: "queued", extra: 0 });
  });

  it("hands over to the row the moment it exists, without a flicker of nothing", () => {
    expect(refineWait({ viewerCandidateId: HER, mutation: out, pending: [row()] }))
      .toEqual({ instruction: "dangly cross earrings", stage: "dispatched", extra: 0 });
  });

  it("keeps narrating from the row when the click is long gone (D-161)", () => {
    /* The panel was closed and reopened; the mutation is a memory, the render
       is not. This is the arm that must never be traded for immediacy. */
    expect(refineWait({ viewerCandidateId: HER, mutation: idle, pending: [row()] }))
      .toEqual({ instruction: "dangly cross earrings", stage: "dispatched", extra: 0 });
  });

  it("says nothing about ANOTHER cast's click", () => {
    expect(refineWait({ viewerCandidateId: THE_OTHER, mutation: out, pending: [] })).toBe(null);
  });

  it("narrates the live row over the settling one, and counts the rest", () => {
    const wait = refineWait({
      viewerCandidateId: HER,
      mutation: idle,
      pending: [row({ stage: "settling", instruction: "the dead one" }), row()],
    });
    expect(wait).toEqual({ instruction: "dangly cross earrings", stage: "dispatched", extra: 1 });
  });

  it("still describes a settling row, because the controls come back before the picture does", () => {
    expect(refineWait({
      viewerCandidateId: HER,
      mutation: idle,
      pending: [row({ stage: "settling" })],
    })).toEqual({ instruction: "dangly cross earrings", stage: "settling", extra: 0 });
  });

  it("says nothing when nothing is out", () => {
    expect(refineWait({ viewerCandidateId: HER, mutation: idle, pending: [] })).toBe(null);
  });
});

/**
 * THE TEN TO TWENTY SECONDS THE RAIL SPENT NOT NOTICING HIS EDIT (fable-738).
 *
 * Screenshot #312. The plate paints on the click and the D-161 ghost waits for
 * a row and a poll, so the two surfaces disagreed about whether anything was
 * happening for as long as the server took to write the row down. Every arm
 * here has its negative control beside it, because a seed that appeared
 * whenever the sheet felt busy would draw a ghost for somebody else's render —
 * which is the fable-465 defect wearing the other surface's clothes.
 */
describe("the rail's ghost is seeded from the click and retired by the row (fable-738)", () => {
  const HER_ROW = {
    variantId: "v-real",
    instruction: "copper hair",
    stage: "queued" as PendingStage,
    regenerating: null,
  };
  const out = { isPending: true, variables: { candidateId: HER, instruction: "copper hair" } };
  const idle = { isPending: false, variables: undefined };

  it("draws a provisional ghost the instant the click goes out, before any row exists", () => {
    const ghosts = refineGhosts({
      viewerCandidateId: HER,
      mutation: out,
      pending: [],
      pendingAtClick: 0,
    });
    expect(ghosts).toEqual([
      { variantId: PROVISIONAL_GHOST_ID, instruction: "copper hair", stage: "queued", regenerating: null },
    ]);
  });

  it("stands down the moment the server has a row of its own — one edit, one chip", () => {
    /* THE SWAP. Both drawn at once would be one render wearing two ghosts, and
       the count is what tells them apart — never the sentence (fable-703). */
    const ghosts = refineGhosts({
      viewerCandidateId: HER,
      mutation: out,
      pending: [HER_ROW],
      pendingAtClick: 0,
    });
    expect(ghosts).toEqual([HER_ROW]);
  });

  it("puts a fresh take's wait on the version it replaces, not on a chip of its own", () => {
    /*
      fable-703's rule, said by the client a poll earlier than the server can
      say it. Regenerate replaces a version rather than adding one, so a ghost
      chip beside it would stand in for a render that is not coming.
    */
    const ghosts = refineGhosts({
      viewerCandidateId: HER,
      mutation: {
        isPending: true,
        variables: { candidateId: HER, instruction: "copper hair", replayOf: "v-selected" },
      },
      pending: [],
      pendingAtClick: 0,
    });
    expect(ghosts.at(-1)).toMatchObject({ regenerating: "v-selected" });
  });

  it("NEGATIVE CONTROL — a REFUSED request leaves no ghost behind (fable-734 §3b)", () => {
    /*
      His entangled report: the plate said "in line · usually three to four
      minutes" for a request the already-has door was about to kill. Both
      surfaces are latched to the same fact — the mutation being in flight — so
      a refusal returns them to rest together. This is the arm that proves the
      seed cannot outlive the request that made it.
    */
    expect(refineGhosts({
      viewerCandidateId: HER,
      mutation: idle,
      pending: [],
      pendingAtClick: 0,
    })).toEqual([]);
    /* And the plate, on the same latch and in the same breath. */
    expect(refineWait({ viewerCandidateId: HER, mutation: idle, pending: [] })).toBe(null);
  });

  it("NEGATIVE CONTROL — says nothing about ANOTHER cast's click", () => {
    expect(refineGhosts({
      viewerCandidateId: THE_OTHER,
      mutation: out,
      pending: [],
      pendingAtClick: 0,
    })).toEqual([]);
  });

  it("NEGATIVE CONTROL — a request with no sentence seeds nothing", () => {
    /* `variables` arrives before `instruction` is readable in some paths, and a
       ghost with no words is a ring the founder cannot attribute to anything. */
    expect(refineGhosts({
      viewerCandidateId: HER,
      mutation: { isPending: true, variables: { candidateId: HER } },
      pending: [],
      pendingAtClick: 0,
    })).toEqual([]);
  });

  it("leaves OTHER faces' rows alone while seeding its own", () => {
    /* The provisional is appended, never a replacement: a row already running
       on this face keeps its ghost, and the count says the rest. */
    const ghosts = refineGhosts({
      viewerCandidateId: HER,
      mutation: out,
      pending: [HER_ROW],
      pendingAtClick: 1,
    });
    expect(ghosts).toHaveLength(2);
    expect(ghosts[0]).toEqual(HER_ROW);
    expect(ghosts[1]).toMatchObject({ variantId: PROVISIONAL_GHOST_ID });
  });
});

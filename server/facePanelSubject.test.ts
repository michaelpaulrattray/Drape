/**
 * THE FACE-PANEL DRIVER'S SUBJECT FINDER (#1151).
 *
 * The thing this replaces was a hard-coded session id, which cannot be tested
 * and cannot go red when it rots — it rotted, and the driver failed on a
 * selector ninety seconds in, which its own header warns is indistinguishable
 * from a broken panel. So the choice is a function, and these are its controls:
 * every tie-break decides a case its neighbour does not, and the empty list is a
 * refusal rather than a null.
 */
import { describe, expect, it } from "vitest";

import {
  type SubjectCandidateRow,
  chooseSubject,
  describeSubject,
  tileLabelFor,
} from "../scripts/lib/facePanelSubject.mts";

function row(overrides: Partial<SubjectCandidateRow> = {}): SubjectCandidateRow {
  return {
    sessionPublicId: "session-a",
    sessionStatus: "open",
    candidatePublicId: "cand-a",
    userId: 823,
    position: 0,
    libraryRows: 1,
    newestRowAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

describe("the tile label is the product's own spelling", () => {
  it("is position + 1, zero-padded to two — the shape rollProjection builds", () => {
    expect(tileLabelFor(0)).toBe("01");
    expect(tileLabelFor(1)).toBe("02");
    expect(tileLabelFor(7)).toBe("08");
    expect(tileLabelFor(9)).toBe("10");
  });

  /*
    ⚠ THE ARM THAT NAMES THE BUG. The driver carried `TILE = "01"` as a
    constant, which addresses position 0 — and the subject actually found in dev
    sits at position 1. A run that opened tile 01 would have graded a different
    candidate from the one the subject query chose, and every reading would have
    been true of the wrong face.
  */
  it("the real subject's position does NOT spell the old hard-coded label", () => {
    expect(tileLabelFor(1)).not.toBe("01");
    expect(chooseSubject([row({ position: 1 })]).tile).toBe("02");
  });
});

describe("⚠ an empty list is a refusal, never a null", () => {
  it("throws, and says what the empty result actually means", () => {
    expect(() => chooseSubject([])).toThrow(/no candidate in this database is BOTH ready and carrying/);
  });

  it("POSITIVE CONTROL: one row is chosen rather than refused", () => {
    expect(chooseSubject([row()]).candidatePublicId).toBe("cand-a");
  });
});

describe("the tie-breaks, each proven to be the one deciding", () => {
  it("a live session beats a dead one EVEN when the dead one has far more rows", () => {
    const chosen = chooseSubject([
      row({ candidatePublicId: "dead", sessionStatus: "abandoned", libraryRows: 500 }),
      row({ candidatePublicId: "live", sessionStatus: "open", libraryRows: 1 }),
    ]);
    expect(chosen.candidatePublicId).toBe("live");
    /* NEGATIVE CONTROL: with both alive, the row count is what decides — so the
       arm above turned on liveness and not on some other accident of order. */
    expect(chooseSubject([
      row({ candidatePublicId: "dead", sessionStatus: "open", libraryRows: 500 }),
      row({ candidatePublicId: "live", sessionStatus: "open", libraryRows: 1 }),
    ]).candidatePublicId).toBe("dead");
  });

  it("every dead status is treated alike — expired, abandoned and closed all lose to open", () => {
    for (const status of ["expired", "abandoned", "closed"]) {
      expect(chooseSubject([
        row({ candidatePublicId: "dead", sessionStatus: status, libraryRows: 500 }),
        row({ candidatePublicId: "live", sessionStatus: "open", libraryRows: 1 }),
      ]).candidatePublicId, status).toBe("live");
    }
  });

  it("with liveness and rows equal, the NEWEST library row decides", () => {
    expect(chooseSubject([
      row({ candidatePublicId: "old", newestRowAt: new Date("2026-08-01T00:00:00Z") }),
      row({ candidatePublicId: "new", newestRowAt: new Date("2026-09-20T00:00:00Z") }),
    ]).candidatePublicId).toBe("new");
  });

  it("and with everything equal it is deterministic, so two runs grade one face", () => {
    const pair = [row({ candidatePublicId: "b" }), row({ candidatePublicId: "a" })];
    expect(chooseSubject(pair).candidatePublicId).toBe("a");
    expect(chooseSubject([...pair].reverse()).candidatePublicId).toBe("a");
  });

  it("the input is not mutated — the caller's rows survive the sort", () => {
    const rows = [row({ candidatePublicId: "b" }), row({ candidatePublicId: "a" })];
    chooseSubject(rows);
    expect(rows.map((r) => r.candidatePublicId)).toEqual(["b", "a"]);
  });
});

describe("the run names its own subject (D-235)", () => {
  it("the line carries the account, the session, the candidate, the tile and the row count", () => {
    const line = describeSubject(chooseSubject([row({
      userId: 28601,
      sessionPublicId: "ede2b37e-be4c-4f72-a4c1-c120f2550d40",
      candidatePublicId: "0642a0f5-b2a6-4779-a388-215f5b56506b",
      position: 1,
      libraryRows: 53,
    })]));
    expect(line).toContain("user 28601");
    expect(line).toContain("ede2b37e-be4c-4f72-a4c1-c120f2550d40");
    expect(line).toContain("0642a0f5-b2a6-4779-a388-215f5b56506b");
    expect(line).toContain("tile 02");
    expect(line).toContain("53 library rows");
  });
});

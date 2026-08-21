/**
 * THE CAPABILITY CENSUS'S OWN INSTRUMENT CHECKS (working law 2: an instrument
 * gets a negative control and a positive control before its verdicts count).
 *
 * The static half is exercised for real — it reads the source tree. The driven
 * half is NOT run here (it makes text calls); what is checked about it is that
 * the committed file's static half is fresh and that its findings are the ones
 * the library recomputes from the same data, so a stale census fails the suite
 * the way a stale Atlas does.
 */
import { describe, expect, it } from "vitest";

import {
  buildStaticAtlas, declaredInterpreterRefusals, declaredServiceRefusals, drivenFindings, outcomeId,
  pinningTests, readCommittedAtlas, reasonOfNote,
} from "../scripts/lib/capabilityAtlas.mts";
import { CORPUS, type CorpusRow } from "../scripts/capability-atlas-corpus.mts";
import { cannotSaySentence } from "./castingV2/cannotSayCopy";

describe("the static half reads what the source declares", () => {
  it("POSITIVE CONTROL — finds doors known to exist", () => {
    const service = declaredServiceRefusals();
    expect(service).toContain("busy");
    expect(service).toContain("scope_unknown");
    const interpreter = declaredInterpreterRefusals();
    expect(interpreter).toContain("unreadable");
    expect(interpreter).toContain("gate_ink_document");
    const ids = buildStaticAtlas(CORPUS).declared.map((d) => d.id);
    /* `inkRemovalNotYet` stood here until 2026-08-22 and was DELETED with its
       door (fable-1322 §1) — a positive control has to name a door that
       exists, and a control pinning a deleted one is the census asserting its
       own history. `inkOneChangeAtATime` is its live sibling on the same road. */
    expect(ids).toContain("inkOneChangeAtATime");
    expect(ids).toContain("noInkToChange");
  });

  it("is deterministic — two builds on one tree are identical", () => {
    expect(JSON.stringify(buildStaticAtlas(CORPUS))).toEqual(JSON.stringify(buildStaticAtlas(CORPUS)));
  });

  it("reports a declared door that no corpus row expects, and stops when a row expects it", () => {
    const without = buildStaticAtlas(CORPUS.filter((row) => outcomeId(row.expect) !== "scope_unknown"));
    expect(without.findings.some((f) => f.kind === "unreached" && f.subject === "scope_unknown")).toBe(true);
    const withRow = buildStaticAtlas(CORPUS);
    expect(withRow.findings.some((f) => f.kind === "unreached" && f.subject === "scope_unknown")).toBe(false);
  });

  it("knows which doors no test file names — both directions, on ids it cannot be wrong about", () => {
    /*
      ⚠ THIS CONTROL WAS REAL AND IS NOW SYNTHETIC, on purpose.

      It named `history_predates_undo` and `refine_limit` — two doors found
      unpinned by hand on 2026-08-21 — and told the next person, in its own
      comment, "if someone pins them, update this list; that is the instrument
      being right, not wrong." Census card C5 pinned all thirteen of the
      service's unpinned doors on 2026-08-22, so **the real unpinned set is now
      EMPTY**, and a positive control with nothing to point at is not a control.

      So the join is driven directly instead, on an id no source file can
      contain — which is stronger than the old form was, because it cannot decay
      the next time somebody closes a door. The negative half is a REAL id
      several files name: without it, a join that had simply stopped reading
      would pass the positive half perfectly.
    */
    const pins = pinningTests(["a_door_no_file_will_ever_name_zzz", "busy"]);
    expect(pins.get("a_door_no_file_will_ever_name_zzz")).toEqual([]);
    expect(pins.get("busy")!.length).toBeGreaterThan(0);

    /* And the finding is really produced from an empty pin list, rather than
       the emptiness being read straight off the map above. */
    const atlas = buildStaticAtlas(CORPUS);
    for (const entry of atlas.declared) {
      const reported = atlas.findings.some(
        (f) => f.kind === "unpinned-refusal" && f.subject === entry.id,
      );
      expect(reported).toBe(entry.pinnedBy.length === 0);
    }
  });

  it("NEGATIVE CONTROL — this file's own mention of an id is never counted as its pin", () => {
    /* The first run of the scan counted the line above as the pin for
       "refine_limit" and declared the door proven. The instrument must not be
       able to prove a door by being told which door to look for. */
    const atlas = buildStaticAtlas(CORPUS);
    for (const entry of atlas.declared) {
      expect(entry.pinnedBy).not.toContain("server/capabilityAtlas.test.ts");
    }
  });
});

describe("the corpus is well-formed", () => {
  it("ids are unique and every belief is in the census vocabulary", () => {
    const ids = CORPUS.map((row) => row.id);
    expect(new Set(ids).size).toEqual(ids.length);
    for (const row of CORPUS) {
      expect(row.expect).toMatch(/^(would-render|offered|refused:[a-zA-Z_]+|free:[a-zA-Z_]+|asked:[a-zA-Z_-]+)$/);
    }
  });
});

describe("free answers are matched back to the member that wrote them", () => {
  it("POSITIVE CONTROL — a rendered member round-trips", () => {
    /* A male Cast on purpose: §5e made these sentences a function of the Cast's
       own pronouns, and the round trip has to hold for a set the reader was not
       written around. */
    const said = cannotSaySentence("noInkToChange", {
      words: null, facet: "ink", scopeNoun: null, moneySafe: true,
      pronouns: { subject: "he", object: "him", possessive: "his", plural: false },
    });
    expect(reasonOfNote(said, { facet: "ink", scopeNoun: null })).toEqual("noInkToChange");
  });
  it("NEGATIVE CONTROL — a sentence the table never wrote is unmatched", () => {
    expect(reasonOfNote("The weather is lovely today and nothing here was charged.", { facet: null, scopeNoun: null })).toEqual("unmatched");
  });
});

describe("driven findings", () => {
  const staticAtlas = buildStaticAtlas(CORPUS);
  const row = CORPUS.find((r) => r.id === "guard.scope.unknown")!;
  const driven = (observed: string, ledgerAfter = 0) => ({
    profile: { name: "test", flags: {}, fixture: "test" },
    observations: [{ id: row.id, observed, facet: null, said: null, calls: [], ms: 1 }],
    notDriven: [],
    ledger: { before: 0, after: ledgerAfter },
  });
  it("a belief that was wrong is a finding; a belief that held is not", () => {
    const wrong = drivenFindings({ staticAtlas, driven: driven("would-render"), corpus: [row] as CorpusRow[] });
    expect(wrong.some((f) => f.kind === "belief-mismatch" && f.subject === row.id)).toBe(true);
    const held = drivenFindings({ staticAtlas, driven: driven(row.expect), corpus: [row] as CorpusRow[] });
    expect(held.some((f) => f.kind === "belief-mismatch")).toBe(false);
  });
  it("a moved ledger is an ERROR — the census must never spend", () => {
    const spent = drivenFindings({ staticAtlas, driven: driven(row.expect, 1), corpus: [row] as CorpusRow[] });
    expect(spent.some((f) => f.kind === "ledger-moved" && f.severity === "error")).toBe(true);
  });
  it("an observation that differs from the committed one is route-changed", () => {
    const committed = { schemaVersion: "1.0.0", static: staticAtlas, driven: driven(row.expect), findings: [] };
    const changed = drivenFindings({ staticAtlas, driven: driven("would-render"), corpus: [row] as CorpusRow[], committed });
    expect(changed.some((f) => f.kind === "route-changed" && f.severity === "error")).toBe(true);
  });
});

describe("the committed census is fresh", () => {
  const committed = readCommittedAtlas();
  it("exists — the generator has been run at least once", () => {
    expect(committed).not.toBeNull();
  });
  it("its static half matches a fresh build of this tree (regenerate if this is red)", () => {
    if (!committed) return;
    expect(JSON.stringify(committed.static)).toEqual(JSON.stringify(buildStaticAtlas(CORPUS)));
  });
});

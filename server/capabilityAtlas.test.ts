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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildStaticAtlas, declaredConceptRefusals, declaredInterpreterRefusals, declaredServiceRefusals, drivenFindings,
  duplicateDoorFindings, listFiles, outcomeId,
  pinningTests, readCommittedAtlas, reasonOfNote, renderCapabilityPage, committedPageIsFresh, lfOnly,
  CAPABILITY_MD, type Finding,
} from "../scripts/lib/capabilityAtlas.mts";
import { CORPUS, type CorpusRow } from "../scripts/capability-atlas-corpus.mts";
import { cannotSaySentence } from "./castingV2/cannotSayCopy";
import { CONCEPT_DESCRIBE_COPY } from "./castingV2/conceptDescribeCopy";

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

  /*
    ONE COMMIT, ONE VERDICT ON EVERY PLATFORM (issue #37). The walk used to
    sort ABSOLUTE paths, and the separator byte — `\` (0x5C) on Windows, `/`
    (0x2F) on Linux — sits on the opposite side of the uppercase letters, so
    sibling directories like `casting/` and `castingV2/` flipped order between
    platforms and the committed census read fresh on one OS and stale on the
    other. This is the Windows half of the two-platform proof: with `\` as the
    separator, an absolute-path sort puts `castingV2\` FIRST, so this arm is
    red without the separator-neutral sort. The Linux half is the gate's own
    `pnpm capability:check` on CI, where the raw sort happens to agree with
    the neutral one.
  */
  it("walks sibling directories in separator-neutral order (casting/ before castingV2/)", () => {
    const root = mkdtempSync(join(tmpdir(), "atlas-walk-order-"));
    try {
      mkdirSync(join(root, "casting"));
      mkdirSync(join(root, "castingV2"));
      writeFileSync(join(root, "casting", "z.test.ts"), "");
      writeFileSync(join(root, "castingV2", "a.test.ts"), "");
      const order = listFiles(root, (name) => name.endsWith(".test.ts"))
        .map((file) => relative(root, file).split(sep).join("/"));
      expect(order).toEqual(["casting/z.test.ts", "castingV2/a.test.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

  it("NEGATIVE CONTROL — a door EXPLAINED in a docblock is not CITED there", () => {
    /*
      The map cited two comment lines as raise sites: `refusalTag.ts`'s own
      docblock showing `refusal("removal_absent", {...})` as an EXAMPLE, and a
      `conceptDescribe.ts` docblock quoting `reason: "unreadable"` while naming
      which branches produce it. In the artifact a citation pointing at prose
      is indistinguishable from one pointing at the throw — which is the whole
      thing these citations exist to let a reader check.

      Asserted over the WHOLE map rather than on the two specimens, because the
      next docblock to name a door has not been written yet.
    */
    for (const entry of buildStaticAtlas(CORPUS).declared) {
      for (const site of entry.sites) {
        const at = site.lastIndexOf(":");
        const line = readFileSync(site.slice(0, at), "utf8").split("\n")[Number(site.slice(at + 1)) - 1] ?? "";
        expect(`${site} :: ${line.trim()}`).not.toMatch(/:: (\*|\/\/|\/\*)/);
      }
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

/*
  #192 — THE CONCEPT UPLOAD IS THE MAP'S SECOND ENTRANCE, and until 2026-08-28
  three of its five doors were invisible while the fourth wore the interpreter's
  label. These arms hold the reader that fixed it.
*/
describe("the concept upload's doors are on the map", () => {
  it("POSITIVE CONTROL — every member of the copy table is a declared door", () => {
    const declared = declaredConceptRefusals();
    expect(declared).toContain("concept.no_being");
    expect(declared).toContain("concept.no_transport");
    expect(declared).toContain("concept.not_a_casting_note");
    expect(declared).toContain("concept.not_about_the_person");
    expect(declared).toContain("concept.unreadable");
    expect(declared.length).toEqual(Object.keys(CONCEPT_DESCRIBE_COPY).length);
    const atlas = buildStaticAtlas(CORPUS);
    const ids = atlas.declared.map((d) => d.id);
    for (const id of declared) expect(ids).toContain(id);
    /*
      AND THE PINS RESOLVE. `pinningTests` searches for a QUOTED literal and a
      test quotes what the product returns (`"no_being"`), never this file's
      `concept.no_being` — so searching the qualified id finds nothing and
      reports five doors as proven by no test, a finding manufactured entirely
      by the atlas's own naming choice. Written as its own assertion because
      the `unpinned-refusal` arm below compares findings to `pinnedBy` and is
      therefore green whether the pins resolve or not.
    */
    for (const id of declared) {
      const entry = atlas.declared.find((d) => d.id === id)!;
      expect(entry.pinnedBy, id).toContain("server/castingV2/conceptDescribe.test.ts");
    }
  });

  it("NEGATIVE CONTROL — the pre-#204 name is absent, so the reader reads the declaration", () => {
    /*
      `no_person` was this door's name until #204 renamed it `no_being` the same
      day the map was found blind to it. A reader working off a remembered list
      — which is what the population was, one source list short — would still
      carry it. This is the arm that says the population comes from the live
      table: it goes red the moment anyone reintroduces a hand-typed list here.
    */
    const declared = declaredConceptRefusals();
    expect(declared).not.toContain("concept.no_person");
    expect(declared.join(" ")).not.toMatch(/no_person/);
  });

  it("cites its raise sites in the entrance's own files, and takes NONE from the interpreter's door", () => {
    /*
      The defect this repairs, asserted directly: `conceptDescribe.ts:835` used
      to be filed under the INTERPRETER's `unreadable`, a citation pointing at
      the right line and naming the wrong door. Two of the five reasons are also
      chosen by a ternary that no `reason:`-shaped regex sees, so their only
      site is the copy table's key line — which is why the key lines are sites.
    */
    const atlas = buildStaticAtlas(CORPUS);
    for (const entry of atlas.declared.filter((d) => d.id.startsWith("concept."))) {
      expect(entry.sites.length, entry.id).toBeGreaterThan(0);
      for (const site of entry.sites) {
        expect(site, entry.id).toMatch(/server\/castingV2\/conceptDescribe(Copy)?\.ts:/);
      }
    }
    for (const entry of atlas.declared.filter((d) => !d.id.startsWith("concept."))) {
      for (const site of entry.sites) {
        expect(`${entry.id} :: ${site}`).not.toMatch(/conceptDescribe\.ts:/);
      }
    }
  });

  it("each concept door is documented unreachable — the corpus drives sentences, not pictures", () => {
    /*
      Failability is not assumed here: the `unreached`/`documented` join is
      already driven both ways by the `scope_unknown` arm above, which drops a
      corpus row and watches the finding appear. What this adds is that the five
      new ids landed on the DOCUMENTED side rather than the `unmapped` ERROR
      side — the state the founder law's teeth produce for a door with no entry.
    */
    const atlas = buildStaticAtlas(CORPUS);
    for (const id of declaredConceptRefusals()) {
      const found = atlas.findings.filter((f) => f.subject === id);
      expect(found.map((f) => f.kind), id).toEqual(["documented-unreachable"]);
    }
    expect(atlas.findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("THE CLASS ARM — no two declared sources claim one id", () => {
    /*
      The collision that hid this whole defect: `unreadable` is a door on the
      refine road AND on the concept upload, and one map row carried both
      doors' pins and citations while every downstream check read it as one
      well-covered door. Nothing could go red, because nothing was looking.

      Driven rather than asserted off the live tree: a live-tree uniqueness
      check passes today whatever the finding does, so the finding itself is
      produced from a deliberately colliding list.
    */
    const live = buildStaticAtlas(CORPUS).declared.map((d) => d.id);
    expect(new Set(live).size).toEqual(live.length);
    expect(buildStaticAtlas(CORPUS).findings.some((f) => f.kind === "duplicate-door-id")).toBe(false);

    const colliding = [
      { id: "unreadable", kind: "interpreter-refusal" as const, pinnedBy: [], sites: [] },
      { id: "unreadable", kind: "concept-refusal" as const, pinnedBy: [], sites: [] },
    ];
    expect(duplicateDoorFindings(colliding).map((f) => f.subject)).toEqual(["unreadable"]);
    expect(duplicateDoorFindings(colliding)[0]!.severity).toEqual("error");
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

  /*
    ⚠ #195's SWEEP — THE PAGE IS GENERATED TOO AND NOTHING COMPARED IT.

    `writeAtlas` writes two files, the JSON and `capability-atlas.md`, and both
    the CLI check and this suite read only the first. So a hand-edited or stale
    committed PAGE — the artifact a human actually reads — shipped green.

    It is the mirror of the defect this shift fixed in `check-architecture.mts`:
    there, an UNTRACKED derived file was refused over; here, a TRACKED one was
    never looked at. The rule both now follow: a freshness verdict is a finding
    exactly where a reviewable committed copy exists. This file is tracked, and
    `server/atlasMergeDriver.test.ts` pins that `.gitattributes` names it.

    Compared on CONTENT: the generator writes LF and a Windows checkout can
    hand it back with CRLF (fable-1366 §3c, paid for once already).
  */
  /* The path the WRITER uses, imported rather than retyped beside it — a
     second spelling of a path is a second source of truth (working law 4).
     `lfOnly` and the comparison itself come from the library for the same
     reason: the CLI check and this suite must not be two opinions about one
     artifact, which is how they came to disagree (PR #201's review). */
  const pagePath = CAPABILITY_MD;

  it("⚠ its PAGE matches a render of the committed census (regenerate if this is red)", () => {
    if (!committed) return;
    expect(existsSync(pagePath), "the committed page exists").toBe(true);
    expect(committedPageIsFresh(committed, buildStaticAtlas(CORPUS), readFileSync(pagePath, "utf8"))).toBe(true);
  });

  it("CONTROL — a hand-edited page does NOT match, and a CRLF checkout does", () => {
    /* Without this, the arm above is satisfied by a comparison that returns
       true for anything. One appended line must break it; a line-ending smudge
       must not — the two failure modes the architecture checker learned to tell
       apart the hard way. */
    if (!committed) return;
    const fresh = renderCapabilityPage({ ...committed, static: buildStaticAtlas(CORPUS) });
    expect(committedPageIsFresh(committed, buildStaticAtlas(CORPUS), `${fresh}hand edited\n`)).toBe(false);
    /* ⚠ THE CRLF HALF IS DRIVEN THROUGH THE COMPARISON, NOT THROUGH THE
       NORMALIZER (second review of #201). Asserting `lfOnly(crlf(x)) ===
       lfOnly(x)` exercises `lfOnly` in isolation: delete the `lfOnly(pageText)`
       call from `committedPageIsFresh` and every arm in both suites stays green
       while a CRLF working copy gets the false "stale" verdict fable-1366 §3c
       already paid for once. A normalizer that is correct and never consulted
       is the failure this whole file is the opposite of. */
    expect(committedPageIsFresh(
      committed,
      buildStaticAtlas(CORPUS),
      fresh.split("\n").join(String.fromCharCode(13) + "\n"),
    )).toBe(true);
  });

  it("⚠ A ROUTE-CHANGED FINDING DOES NOT MAKE ITS OWN PAGE STALE (PR #201's review, finding 1)", () => {
    /*
      The defect the review caught before it could fire. `drivenFindings` emits
      `changed:*` rows ONLY when handed a prior census — which `--drive` does
      and `--check` deliberately does not. So the first spelling of this check
      compared the committed page against a FRESHLY COMPUTED atlas, and a page
      written by a legitimate re-drive after a route moved would have been
      called "stale or hand-edited" on every machine, forever: the exact class
      of misleading refusal #195 exists to remove, planted one checker over.

      Driven on a SYNTHETIC census rather than waiting for a real route change:
      today's committed census carries no `changed:*` row, so an arm resting on
      the real one would pass whatever the comparison did.
    */
    if (!committed) return;
    const routeChanged: Finding = {
      id: "changed:probe", severity: "error", kind: "route-changed", subject: "probe",
      message: '"a probe ask" — committed refusal_a, now refusal_b',
    };
    const afterDrive = { ...committed, findings: [...committed.findings, routeChanged] };
    const staticAtlas = buildStaticAtlas(CORPUS);
    const page = renderCapabilityPage({ ...afterDrive, static: staticAtlas });

    /* The page prints severity/kind/subject/message, not the id — read off the
       renderer rather than assumed, which is what the first spelling of this
       line got wrong and this population control caught. */
    expect(page, "the finding really does reach the page").toContain("`route-changed` probe");
    expect(committedPageIsFresh(afterDrive, staticAtlas, page), "its own census renders it").toBe(true);
    /* CONTROL — and it is only true because the COMMITTED findings are the
       target. A census without that row (what a recomputing check holds) does
       not reproduce the page, which is precisely the false refusal. */
    expect(committedPageIsFresh(committed, staticAtlas, page)).toBe(false);
  });
});

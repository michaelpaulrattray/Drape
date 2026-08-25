/**
 * THE BRIEFING FILE PARSES, THE DEGRADED STATE IS HONEST, AND "SEEN" MEANS
 * WHAT IT SAYS (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §2, §9
 * arms 1 and 6).
 *
 * The real `crew-briefing.json` is parsed against the real schema on every
 * commit — that, plus esbuild parsing the STATIC IMPORT at build time, is why
 * a malformed edition cannot reach production; the runtime degraded state
 * stands BEHIND those two, not instead of them. (The import being static is
 * itself load-bearing and has its own arm below: a runtime `readFileSync`
 * resolved from `import.meta.url` points at `dist/` in production, where the
 * JSON is never emitted — the PR #72 review's finding 1.) So the arms here are: the real file
 * parses, the schema can refuse (a green parser that cannot fail proves
 * nothing — working law 2), the degraded state carries the honest problem
 * entry, and the acknowledgement function is exactly the deployed edition's
 * own list.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CREW_JOURNAL_CAP,
  crewBriefingSchema,
  degradedCrewBriefing,
  readCrewBriefing,
  replyIsAcknowledged,
  resetCrewBriefingCacheForTests,
} from "./crewBriefing";

const briefingPath = path.join(__dirname, "crew-briefing.json");

describe("the briefing file", () => {
  it("the REAL crew-briefing.json parses against the real schema", () => {
    const parsed = crewBriefingSchema.parse(JSON.parse(readFileSync(briefingPath, "utf8")));
    /* And it is a real edition, not a stub: the parse alone would pass an
       empty-but-valid file, and this file is the founder's briefing. */
    expect(parsed.edition).toBeGreaterThanOrEqual(1);
    expect(parsed.program.mission.length).toBeGreaterThan(10);
  });

  it("⚠ NEGATIVE CONTROL — the schema refuses what it should refuse", () => {
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));

    // An undeclared key anywhere is a shift's typo, not a tolerated extra.
    expect(() => crewBriefingSchema.parse({ ...valid, somethingNobodyDeclared: 1 })).toThrow();

    // A needs-you card with an undeclared field — strict must hold at DEPTH,
    // not only at the top level.
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        needsYou: [{ ...valid.needsYou[0], urgency: "high" }],
      }),
    ).toThrow();

    // A state outside the vocabulary.
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        program: {
          ...valid.program,
          focus: { ...valid.program.focus, state: "maybe" },
        },
      }),
    ).toThrow();
  });

  it("⚠ a duplicated identity fails the PARSE, never degrades at render (PR #78 review, law 7)", () => {
    /* React keys on these ids and replies point at them — an edition carrying
       a duplicate would render one row where two claims were written. The
       refusal must land on the shift's own commit (this file parses the real
       briefing), so each population's uniqueness is driven with a real
       duplicate. */
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));

    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        program: { ...valid.program, ladder: [...valid.program.ladder, valid.program.ladder[0]] },
      }),
    ).toThrow(/ladder\[\]\.key/);

    expect(() =>
      crewBriefingSchema.parse({ ...valid, needsYou: [...valid.needsYou, valid.needsYou[0]] }),
    ).toThrow(/needsYou\[\]\.id/);

    expect(() =>
      crewBriefingSchema.parse({ ...valid, pipeline: [...valid.pipeline, valid.pipeline[0]] }),
    ).toThrow(/pipeline\[\]\.id/);

    expect(() =>
      crewBriefingSchema.parse({ ...valid, problems: [...valid.problems, valid.problems[0]] }),
    ).toThrow(/problems\[\]\.id/);

    /* eyeItems is empty in the real file, so its duplicate is synthetic —
       and doubles as the positive control that a VALID eye item parses. */
    const eyeItem = {
      id: "court-item",
      title: "t",
      question: "q",
      state: "open",
      filedAt: "2026-08-26T00:00:00+10:00",
      issueNumber: null,
      frames: [{
        key: "crew-eye/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png",
        caption: "c",
        arm: null,
      }],
    };
    expect(() =>
      crewBriefingSchema.parse({ ...valid, eyeItems: [eyeItem] }),
    ).not.toThrow();
    expect(() =>
      crewBriefingSchema.parse({ ...valid, eyeItems: [eyeItem, eyeItem] }),
    ).toThrow(/eyeItems\[\]\.id/);

    /* And ACROSS the two thread-host populations (PR #79 review finding 2):
       crew.reply's cardId is one namespace, so an eye item wearing a
       needs-you card's id would render his verdict under the wrong claim. */
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        eyeItems: [{ ...eyeItem, id: valid.needsYou[0].id }],
      }),
    ).toThrow(/share one reply namespace/);
  });

  it("the journal cap holds at the schema", () => {
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));
    const entry = { at: "2026-08-25T00:00:00+10:00", shift: "x", text: "y" };
    const atCap = { ...valid, journal: Array.from({ length: CREW_JOURNAL_CAP }, () => entry) };
    expect(() => crewBriefingSchema.parse(atCap)).not.toThrow();
    const overCap = { ...valid, journal: Array.from({ length: CREW_JOURNAL_CAP + 1 }, () => entry) };
    expect(() => crewBriefingSchema.parse(overCap)).toThrow();
  });

  it("⚠ the briefing travels INSIDE the bundle — a static import, never a runtime path", () => {
    /* Production runs the esbuild bundle (dist/index.js). A runtime file read
       resolved from import.meta.url names dist/crew-briefing.json — a file the
       build never emits — so every production getState would serve the
       degraded state forever, while `pnpm dev` (unbundled) works perfectly.
       The static import inlines the JSON into the bundle and makes esbuild
       validate it at build time. This arm pins that shape at the source. */
    const moduleSource = readFileSync(path.join(__dirname, "crewBriefing.ts"), "utf8");
    expect(moduleSource).toContain('from "./crew-briefing.json"');
    /* The code half only — the header KEEPS the story of the broken shape, so
       comments are stripped before the absences are asserted. */
    const code = moduleSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "the module survived the stripper").toContain("export function readCrewBriefing");
    for (const forbidden of ["readFileSync", "import.meta.url", "fileURLToPath"]) {
      expect(
        code,
        `${forbidden} in crewBriefing.ts — a runtime file read resolves against dist/ in production, where the JSON is never emitted`,
      ).not.toContain(forbidden);
    }
  });

  it("readCrewBriefing returns the real file's edition (and caches)", () => {
    resetCrewBriefingCacheForTests();
    const first = readCrewBriefing();
    const onDisk = JSON.parse(readFileSync(briefingPath, "utf8"));
    expect(first.edition).toBe(onDisk.edition);
    expect(readCrewBriefing()).toBe(first);
    resetCrewBriefingCacheForTests();
  });
});

describe("the degraded state", () => {
  it("carries exactly one problem entry that says what happened, and empty sections", () => {
    const degraded = degradedCrewBriefing();
    expect(degraded.problems).toHaveLength(1);
    expect(degraded.problems[0]!.severity).toBe("urgent");
    expect(degraded.problems[0]!.state).toBe("open");
    /* The words the founder actually reads: it must say the briefing failed,
       that his replies are unaffected, and where the fallback is. */
    expect(degraded.problems[0]!.title.toLowerCase()).toContain("failed to load");
    expect(degraded.problems[0]!.detail).toContain("Your replies are unaffected");
    expect(degraded.problems[0]!.detail).toContain("git history");
    expect(degraded.needsYou).toEqual([]);
    expect(degraded.journal).toEqual([]);
    expect(degraded.acknowledgedReplyIds).toEqual([]);
  });

  it("acknowledges nothing — an unreadable edition cannot claim a reply was read", () => {
    expect(replyIsAcknowledged(degradedCrewBriefing(), 1)).toBe(false);
  });
});

describe("acknowledgement — the only definition of seen (§9 arm 6)", () => {
  it("a reply id the deployed edition names is acknowledged; one absent is not", () => {
    const edition = { acknowledgedReplyIds: [1, 3] };
    expect(replyIsAcknowledged(edition, 1)).toBe(true);
    expect(replyIsAcknowledged(edition, 3)).toBe(true);
    expect(replyIsAcknowledged(edition, 2)).toBe(false);
    expect(replyIsAcknowledged({ acknowledgedReplyIds: [] }, 1)).toBe(false);
  });

  it("an optimistic (negative) id can never read as acknowledged", () => {
    /* The client appends unsent replies with a NEGATIVE id for exactly this
       reason; the schema refuses a negative id in the deployed list, so the
       two cannot meet. */
    expect(replyIsAcknowledged({ acknowledgedReplyIds: [1, 3] }, -1724500000000)).toBe(false);
    /* Through the WHOLE schema — after the cross-namespace refine (#79
       review finding 2) there is no `.shape` to reach into, and the whole
       parse is the door the file actually goes through. */
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));
    expect(() =>
      crewBriefingSchema.parse({ ...valid, acknowledgedReplyIds: [-1] }),
    ).toThrow();
  });
});

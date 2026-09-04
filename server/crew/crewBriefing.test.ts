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

import { CREW_HELD_STATES, CREW_HOLD_REASON_MAX } from "../../shared/crewNextUpHold.js";

import {
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

  it("⚠ an eye item cannot outlive its card (#133): an open eye item beside an answered card is refused at the parse", () => {
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));
    const eye = valid.eyeItems.find((item: { cardId?: string }) => item.cardId);
    expect(eye).toBeTruthy();
    const card = valid.needsYou.find((c: { id: string }) => c.id === eye.cardId);
    expect(card).toBeTruthy();
    // The incident's shape: the card answered, the frames still open.
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        needsYou: valid.needsYou.map((c: { id: string }) => (c.id === card.id ? { ...c, state: "answered" } : c)),
        eyeItems: valid.eyeItems.map((item: { id: string }) => (item.id === eye.id ? { ...item, state: "open" } : item)),
      }),
    ).toThrow(/open eye item needs an open card/);
    // A cardId naming no card is a typo, refused.
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        eyeItems: valid.eyeItems.map((item: { id: string }) => (item.id === eye.id ? { ...item, cardId: "no-such-card" } : item)),
      }),
    ).toThrow(/cardId must name a needsYou card/);
    // Both open together is the ordinary waiting state, admitted.
    crewBriefingSchema.parse({
      ...valid,
      needsYou: valid.needsYou.map((c: { id: string }) => (c.id === card.id ? { ...c, state: "open" } : c)),
      eyeItems: valid.eyeItems.map((item: { id: string }) => (item.id === eye.id ? { ...item, state: "open" } : item)),
    });
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

  it("⚠ a pipeline row may not claim he is blocking it unless his desk agrees (#291)", () => {
    /*
      THE DEFECT THIS REFUSES, MEASURED: seven rows said `waiting-founder`
      while Needs You was at ZERO open — the same page telling him two
      different things about the same question, which costs more than either
      being wrong on its own, because it costs him trust in the whole page.

      `waiting-founder` was a word a shift TYPED, so it survived his own
      answer. Every arm below is driven through the REAL schema against the
      REAL briefing, and the positive control is the one that matters: a guard
      that refuses everything would pass the four negatives on its own.
    */
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));
    const openCard = { ...valid.needsYou[0], id: "an-open-card", state: "open" };
    const answeredCard = { ...valid.needsYou[0], id: "an-answered-card", state: "answered" };
    const row = { id: "a-row", title: "t", status: "waiting-founder", prNumber: null, note: null };

    /* POSITIVE CONTROL — the shape this rule EXISTS to allow. */
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        needsYou: [openCard],
        eyeItems: [],
        pipeline: [{ ...row, cardId: "an-open-card" }],
      }),
    ).not.toThrow();

    /* The live defect: a row naming a card he has already answered. */
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        needsYou: [answeredCard],
        eyeItems: [],
        pipeline: [{ ...row, cardId: "an-answered-card" }],
      }),
    ).toThrow(/waiting-founder/);

    /* A row naming no card at all — how all seven were written. */
    expect(() =>
      crewBriefingSchema.parse({ ...valid, needsYou: [openCard], eyeItems: [], pipeline: [row] }),
    ).toThrow(/waiting-founder/);

    /* A row naming a card that does not exist. */
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        needsYou: [openCard],
        eyeItems: [],
        pipeline: [{ ...row, cardId: "no-such-card" }],
      }),
    ).toThrow(/waiting-founder/);

    /* And the other direction: only a waiting-founder row may carry one, so
       `cardId` can never become a second general-purpose link nobody reads. */
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        needsYou: [openCard],
        eyeItems: [],
        pipeline: [{ ...row, status: "merged", cardId: "an-open-card" }],
      }),
    ).toThrow(/waiting-founder/);
  });

  it("⚠ NEXT UP is a stamped snapshot, and it says when it looked (#290)", () => {
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));

    /* POSITIVE CONTROL first — the real file's own block parses. */
    expect(() => crewBriefingSchema.parse(valid)).not.toThrow();
    expect(typeof valid.nextUp.readAt).toBe("string");
    expect(Number.isNaN(Date.parse(valid.nextUp.readAt))).toBe(false);

    /* The stamp is the honest part (`crew_queue_counts.countedAt`'s argument):
       a block with no reading time implies an instant it does not have. */
    const { readAt: _dropped, ...noStamp } = valid.nextUp;
    expect(() => crewBriefingSchema.parse({ ...valid, nextUp: noStamp })).toThrow();

    /* One row per card: a duplicate would render one line where two cards are
       queued, and the running order would silently be short. */
    const item = { issueNumber: 999, title: "t", urgent: false };
    expect(() =>
      crewBriefingSchema.parse({ ...valid, nextUp: { readAt: valid.nextUp.readAt, items: [item] } }),
    ).not.toThrow();
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        nextUp: { readAt: valid.nextUp.readAt, items: [item, item] },
      }),
    ).toThrow(/issueNumber must be unique/);

    /* ⚠ `blockedOnYou` is DERIVED at render off his open cards and must never
       become a field here — a second copy of "he is blocking this" is exactly
       what put seven false rows in front of him. */
    expect(() =>
      crewBriefingSchema.parse({
        ...valid,
        nextUp: {
          readAt: valid.nextUp.readAt,
          items: [{ ...item, blockedOnYou: true }],
        },
      }),
    ).toThrow();
  });

  it("a held row carries its state and its reason, and nothing else (#298)", () => {
    const valid = crewBriefingSchema.parse(JSON.parse(readFileSync(briefingPath, "utf8")));
    const at = valid.nextUp.readAt;
    const row = (held: unknown) => ({
      ...valid,
      nextUp: { readAt: at, items: [{ issueNumber: 999, title: "t", urgent: false, held }] },
    });

    /* ⚠ **THE FIELD IS OPTIONAL AND THAT IS THE COMPATIBILITY PROPERTY**:
       every edition written before it existed still parses, and absent says
       the true thing about those rows — nothing was stopping a shift. */
    expect(() => crewBriefingSchema.parse({
      ...valid,
      nextUp: { readAt: at, items: [{ issueNumber: 999, title: "t", urgent: false }] },
    })).not.toThrow();

    for (const state of CREW_HELD_STATES) {
      expect(() => crewBriefingSchema.parse(row({ state }))).not.toThrow();
      expect(() => crewBriefingSchema.parse(row({ state, because: "a reason" }))).not.toThrow();
    }

    /* A state nobody has built a chip for would render as a blank label. */
    expect(() => crewBriefingSchema.parse(row({ state: "somebody-elses-idea" }))).toThrow();
    expect(() => crewBriefingSchema.parse(row({}))).toThrow();

    /* ⚠ `.strict()` sits INSIDE `.optional()` — on the wrapper it does nothing
       in zod 4, which is a strictness that reads as present and is not. This
       arm is what proves it landed on the object. */
    expect(() => crewBriefingSchema.parse(row({ state: "blocked", untilWhen: "soon" }))).toThrow();

    /* An empty reason is a filer mid-edit, not a sentence to render. */
    expect(() => crewBriefingSchema.parse(row({ state: "blocked", because: "" }))).toThrow();
    expect(() => crewBriefingSchema.parse(
      row({ state: "blocked", because: "x".repeat(CREW_HOLD_REASON_MAX + 1) }),
    )).toThrow();
  });

  /**
   * ⚠ **THE JOURNAL IS GONE AND ITS CAP WITH IT (#293)** — the founder removed
   * it from his page, so the field, its 40-entry cap and the two arms that
   * proved the cap are all deleted rather than left standing over nothing.
   * What replaces them is the arm below: the schema is `.strict()`, so an
   * edition that still carries a `journal` is REFUSED rather than silently
   * accepted and never drawn. That is the only journal fact worth a test now,
   * and it is the one that catches a shift copying an old edition forward.
   */
  it("an edition that still carries a journal is refused — the field is gone, not ignored", () => {
    const valid = JSON.parse(readFileSync(briefingPath, "utf8"));
    expect(valid.journal).toBeUndefined();
    expect(() => crewBriefingSchema.parse(valid)).not.toThrow();
    const withJournal = {
      ...valid,
      journal: [{ at: "2026-08-25T00:00:00+10:00", shift: "x", text: "y" }],
    };
    expect(() => crewBriefingSchema.parse(withJournal)).toThrow();
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
       that his replies are unaffected, and that the one control on the page
       still works. ⚠ It used to point him at "the journal in git history" as
       the fallback; #293 removed the journal, so that sentence would have sent
       him to a file that no longer holds one. The General box is what is
       actually still standing on a degraded page, and it is what he is told. */
    expect(degraded.problems[0]!.title.toLowerCase()).toContain("failed to load");
    expect(degraded.problems[0]!.detail).toContain("Your replies are unaffected");
    expect(degraded.problems[0]!.detail).toContain("General box");
    expect(degraded.problems[0]!.detail).not.toContain("journal");
    expect(degraded.needsYou).toEqual([]);
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

/*
  #492 — THE LABEL CAP IS AT THE SCHEMA, AND THIS IS THE ARM THAT SAYS SO.

  His words at a frame of the top of THE PROGRAM card: *"the top of the programs
  card with the little status card readings needs a better design honest it
  looks terribly designed"*. The design fault was structural rather than
  decorative — shifts wrote HEADLINES into a field built for a few words, so a
  stroked pill wrapped to two lines of 11px text and the grey sentence beneath
  carried the actual reading. The three labels on the edition he was looking at
  ran 42, 67 and 59 characters against an 80 cap that never bound.

  ⚠ **A CAP THAT LIVES IN A SHIFT'S MEMORY IS NOT A CAP.** This page has now
  had four mechanisms shipped with nothing calling them (#286, #295, the
  promotion pass, #325's half). The one thing that has reliably held on this
  feature is a schema the rite refuses to deploy past, so that is where the
  number went.

  ⚠ **THE POSITIVE ARM IS THE ONE THAT MATTERS.** A cap on the wrong field, or
  a cap so tight the real briefing cannot be written, passes a refusal arm by
  refusing everything. So 40 is proven ACCEPTED at the boundary and 41 REFUSED
  one character later, and the source sentence — the field the headline is
  supposed to move into — is proven to take a real citation at its own cap.

  ⚠ **AND `source` CAME DOWN TO 100 IN THE SAME COMMIT, ON A BROWSER READING
  AND NOT ON TASTE.** The first drive of the finished strip failed its own
  line-count arm on all three cells: 171, 133 and 165 characters came out at
  five, four and five lines. A 213px column at 1440 fits 33 characters, so
  three lines is 99. The cap is what stops the next shift writing for a
  full-width paragraph that no longer exists.
*/
describe("#492 — the at-a-glance label is capped where it cannot be forgotten", () => {
  const valid = () => JSON.parse(readFileSync(briefingPath, "utf8"));
  const withLabel = (label: string) => {
    const base = valid();
    return {
      ...base,
      program: {
        ...base.program,
        chips: [{ label, tone: "neutral", source: "A reading, cited." }],
      },
    };
  };

  it("40 characters is accepted — the boundary, from the inside", () => {
    const label = "x".repeat(40);
    expect(label).toHaveLength(40);
    const parsed = crewBriefingSchema.parse(withLabel(label));
    expect(parsed.program.chips[0].label).toBe(label);
  });

  it("41 is refused, one character later", () => {
    expect(() => crewBriefingSchema.parse(withLabel("x".repeat(41)))).toThrow();
  });

  it("the headline he was shown would be refused today", () => {
    /* Verbatim from edition 236, the edition his frame was taken from. */
    const his = "The queue: 79 open, 8 carrying your word, none urgent, 4 going stale";
    expect(his.length).toBeGreaterThan(40);
    expect(() => crewBriefingSchema.parse(withLabel(his))).toThrow();
  });

  it("an empty label is still refused, so the cap did not replace the floor", () => {
    expect(() => crewBriefingSchema.parse(withLabel(""))).toThrow();
  });

  it("the sentence has somewhere to go — source takes a full three lines", () => {
    const base = valid();
    const source = "y".repeat(100);
    const parsed = crewBriefingSchema.parse({
      ...base,
      program: {
        ...base.program,
        chips: [{ label: "The queue", tone: "neutral", source }],
      },
    });
    expect(parsed.program.chips[0].source).toBe(source);
    expect(() =>
      crewBriefingSchema.parse({
        ...base,
        program: {
          ...base.program,
          chips: [{ label: "The queue", tone: "neutral", source: "y".repeat(101) }],
        },
      }),
    ).toThrow();
  });

  it("the REAL briefing's labels all fit, so the cap is live rather than aspirational", () => {
    const parsed = crewBriefingSchema.parse(valid());
    expect(parsed.program.chips.length).toBeGreaterThan(0);
    for (const chip of parsed.program.chips) {
      expect(chip.label.length, `"${chip.label}" is over the cap`).toBeLessThanOrEqual(40);
    }
  });
});

/*
  #493 — THE ONE-PLACE RULE AND THE RUNG'S EXISTENCE, HELD AT THE PARSE.

  The ladder cards and NEXT UP are written by one sweep from one partition, so
  these refinements can only fire on a hand edit — and when one does, the rite
  refuses the edition instead of deploying a page that lists a card twice
  (the exact doubling his order names) or draws a rung the bar above does not
  hold. Both arms drive the refusal, not just the acceptance (working law 2).
*/
describe("#493 — the briefing cannot list one card in two homes", () => {
  const valid = () => JSON.parse(readFileSync(briefingPath, "utf8"));

  it("the real file parses, and both populations are real", () => {
    const parsed = crewBriefingSchema.parse(valid());
    expect(parsed.program.ladderCards.items.length).toBeGreaterThan(0);
    expect(parsed.nextUp.items.length).toBeGreaterThan(0);
  });

  it("⚠ POSITIVE CONTROL — a NEXT UP card copied onto the ladder is REFUSED", () => {
    const base = valid();
    const doubled = base.nextUp.items[0].issueNumber;
    base.program.ladderCards.items.push({
      issueNumber: doubled,
      title: "the same card, listed twice",
      kind: "roadmap",
      rung: null,
    });
    expect(() => crewBriefingSchema.parse(base)).toThrow(/exactly one home/);
  });

  it("⚠ POSITIVE CONTROL — a rung the ladder does not hold is REFUSED", () => {
    const base = valid();
    base.program.ladderCards.items.push({
      issueNumber: 999999,
      title: "a card on a rung that does not exist",
      kind: "roadmap",
      rung: "N99",
    });
    expect(() => crewBriefingSchema.parse(base)).toThrow(/program\.ladder\[\]\.key/);
  });

  it("a duplicated ladder card is refused within its own list too", () => {
    const base = valid();
    base.program.ladderCards.items.push({ ...base.program.ladderCards.items[0] });
    expect(() => crewBriefingSchema.parse(base)).toThrow(/unique/);
  });
});

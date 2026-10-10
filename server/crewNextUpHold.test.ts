import { describe, expect, it } from "vitest";

import {
  CREW_HELD_STATES,
  CREW_HOLD_LABELS,
  CREW_HOLD_MARKER,
  CREW_HOLD_ORDER,
  CREW_HOLD_REASON_MAX,
  CREW_HOLD_WORD,
  FOUNDER_HELD_CARDS,
  heldStateFromLabels,
  heldStatesFromLabels,
  holdOwnerFromReason,
  holdReasonFromBody,
  planDeskHoldLabels,
  planFounderHeldDrift,
  planUnreadableHolds,
  resolveHold,
} from "../shared/crewNextUpHold.js";

/**
 * The hold verdict's own arms (#298) — the two readers `crew-desk-sweep.mts`
 * runs over the queue, driven directly rather than through the sweep.
 *
 * The sweep shells out to `gh`, so a test of it would be a test of a mock.
 * These drive the functions the sweep calls with the shapes GitHub actually
 * returns, which is the half a mock could not have told the truth about.
 */

describe("the state comes from a LABEL, and only from a label", () => {
  it("each label puts a card in its own state", () => {
    expect(heldStateFromLabels(["blocked"])).toBe("blocked");
    expect(heldStateFromLabels(["awaiting-fable"])).toBe("fable");
    expect(heldStateFromLabels(["needs-sitting"])).toBe("sitting");
  });

  it("an unheld card is null — takeable is the default, never a state to declare", () => {
    expect(heldStateFromLabels([])).toBeNull();
    expect(heldStateFromLabels(["urgent", "founder-ordered", "bug"])).toBeNull();
  });

  /**
   * ⚠ **`needs-fable` ALREADY MEANS SOMETHING ELSE** — *"force the full Fable
   * review on this PR"*, a PR-scoped instruction to the gate. A card asking for
   * a review and a card waiting on the review arm must stay distinguishable,
   * because one of them is takeable.
   */
  it("the existing needs-fable label does NOT hold a card", () => {
    expect(heldStateFromLabels(["needs-fable"])).toBeNull();
    expect(CREW_HOLD_LABELS.fable).not.toBe("needs-fable");
  });

  it("two hold labels resolve to the one furthest from takeable", () => {
    expect(heldStateFromLabels(["needs-sitting", "blocked"])).toBe("sitting");
    expect(heldStateFromLabels(["blocked", "awaiting-fable"])).toBe("fable");
  });

  /**
   * THE COLLAPSE IS LOSSY, AND A CALLER THAT ACTS ON IT CAN BE WRONG (found by
   * the reviewer on PR #544, 2026-09-05, before it shipped).
   *
   * The line directly above is correct for a CHIP, which shows one word. But
   * `blocked` + `awaiting-fable` answering "fable" told the auto-escalation gate
   * that a BLOCKED card was Fable's to take, and that gate spends an expensive
   * session when it agrees. So the full list is the answer for anyone deciding
   * whether they may act, and the one-word answer is derived from it.
   */
  it("reports EVERY hold, so a caller can ask about one instead of the winner", () => {
    expect(heldStatesFromLabels(["blocked", "awaiting-fable"])).toEqual(["fable", "blocked"]);
    expect(heldStatesFromLabels(["needs-sitting", "blocked"])).toEqual(["sitting", "blocked"]);
    expect(heldStatesFromLabels(["awaiting-fable"])).toEqual(["fable"]);
    expect(heldStatesFromLabels(["urgent", "founder-ordered"])).toEqual([]);
  });

  it("keeps the one-word answer DERIVED from the full list, never a second sort", () => {
    for (const labels of [
      ["blocked", "awaiting-fable"],
      ["needs-sitting", "blocked", "awaiting-fable"],
      ["awaiting-fable"],
      ["urgent"],
      [],
    ]) {
      expect(heldStateFromLabels(labels)).toBe(heldStatesFromLabels(labels)[0] ?? null);
    }
  });

  /**
   * Working law 4, asserted rather than trusted: the enum the schema validates
   * against, the precedence order and the chip words are all DERIVED from the
   * one label map, so a fourth hold cannot exist in three lists and not the
   * fourth.
   */
  it("every list is the same population, derived from one", () => {
    const states = Object.keys(CREW_HOLD_LABELS).sort();
    expect([...CREW_HELD_STATES].sort()).toEqual(states);
    expect([...CREW_HOLD_ORDER].filter((kind) => kind !== "you").sort()).toEqual(states);
    expect(Object.keys(CREW_HOLD_WORD).sort()).toEqual(["you", ...states].sort());
    for (const state of CREW_HELD_STATES) {
      expect(CREW_HOLD_WORD[state], `${state} must have a word`).toBeTruthy();
    }
  });

  it("`you` is not a label — his desk owns that verdict, not the queue", () => {
    expect(Object.values(CREW_HOLD_LABELS)).not.toContain("you");
    expect(heldStateFromLabels(["you"])).toBeNull();
  });
});

describe("the reason comes from ONE line of the body", () => {
  const body = (...lines: string[]) => lines.join("\n");

  it("reads the marker line and nothing around it", () => {
    expect(holdReasonFromBody(body(
      "# A card",
      "",
      `${CREW_HOLD_MARKER} the sectioned Settings modal (your section 03 brief)`,
      "",
      "More prose that is not the reason.",
    ))).toBe("the sectioned Settings modal (your section 03 brief)");
  });

  it("a body with no marker has no reason — the chip stands alone", () => {
    /* Demanding prose would let a filer's omission quietly un-hold a card. */
    expect(holdReasonFromBody("# A card with no marker at all")).toBeNull();
    expect(holdReasonFromBody("")).toBeNull();
  });

  it("an empty marker is the same as no marker", () => {
    expect(holdReasonFromBody(`${CREW_HOLD_MARKER}   `)).toBeNull();
  });

  it("indented and CRLF bodies still read — GitHub returns both", () => {
    expect(holdReasonFromBody(`intro\r\n   ${CREW_HOLD_MARKER} a sitting of its own\r\nmore`))
      .toBe("a sitting of its own");
  });

  it("⚠ reads a marker inside a BLOCKQUOTE — #1414's own line, the question his desk could not draw", () => {
    /*
      #1414 carried `> **Waiting on:** YOU — your eye on two frames, and nothing
      else.` and this function read `line.trim().startsWith(CREW_HOLD_MARKER)`.
      After `.trim()` that line starts with `>`, not with `**`, so the marker was
      invisible and **the card sat held on his eye with nothing on his desk
      asking for it** — the exact silence this module's own docblock names, one
      function below the sentence.

      The live card was repaired BY HAND on 2026-09-30 (the marker lifted out of
      the quote), so the shape is quoted here from #1559's record rather than
      re-fetched: the fixture must outlive the repair, which is the whole reason
      a guard exists for it.
    */
    const body = [
      "## The two frames",
      "",
      `> ${CREW_HOLD_MARKER} YOU — your eye on two frames, and nothing else.`,
      "",
      "More prose that is not the reason.",
    ].join("\n");
    expect(holdReasonFromBody(body)).toBe("YOU — your eye on two frames, and nothing else.");
  });

  it("reads it through a heading, a bullet and a nested quote too — the rest of the class", () => {
    const through = (decoration: string) =>
      holdReasonFromBody(`intro\n\n${decoration}${CREW_HOLD_MARKER} his word on the shape`);
    for (const decoration of ["> ", ">> ", "> > ", "- ", "* ", "  > - ", "### "]) {
      expect(holdReasonFromBody(`intro\n\n${decoration}${CREW_HOLD_MARKER} his word on the shape`),
        `decoration ${JSON.stringify(decoration)}`).toBe("his word on the shape");
      expect(through(decoration)).toBe("his word on the shape");
    }
  });

  it("⚠ and the marker's OWN asterisks are never eaten — the repair's own failure mode", () => {
    /*
      THE CONTROL THAT MATTERS MOST ON THIS FUNCTION. The obvious stripper takes
      every leading `>`, `#`, `-` AND `*`; the marker is literally
      `**Waiting on:**`, so that stripper hands this function `Waiting on:**`
      and the line is unfindable again — one silence traded for another, wearing
      a fix's clothes. `shared/crewMarkdownLead.ts` strips BLOCK decoration only,
      and this arm is what says so from the consumer's side.
    */
    expect(CREW_HOLD_MARKER.startsWith("**"), "the premise of this arm").toBe(true);
    expect(holdReasonFromBody(`${CREW_HOLD_MARKER} plainly, with no decoration at all`))
      .toBe("plainly, with no decoration at all");
    /* A bullet is `*` followed by a space; the marker's `**` is not one. */
    expect(holdReasonFromBody(`* ${CREW_HOLD_MARKER} a bulleted hold`)).toBe("a bulleted hold");
  });

  /**
   * ⚠ **THE FIRST MARKER WINS.** A body that says it twice is a card mid-edit;
   * taking the first keeps the answer stable while somebody is typing, and
   * taking the last would let a quoted example at the bottom of a card beat the
   * filer's own line.
   */
  it("the first marker wins, so a quoted example lower down cannot hijack it", () => {
    expect(holdReasonFromBody(body(
      `${CREW_HOLD_MARKER} the real reason`,
      "For example, a card might say:",
      `${CREW_HOLD_MARKER} something else entirely`,
    ))).toBe("the real reason");
  });

  it("a long reason is truncated by the writer, so the page never has to be", () => {
    const long = "x".repeat(CREW_HOLD_REASON_MAX + 40);
    const read = holdReasonFromBody(`${CREW_HOLD_MARKER} ${long}`)!;
    expect(read.length).toBeLessThanOrEqual(CREW_HOLD_REASON_MAX);
    expect(read.endsWith("…")).toBe(true);
  });
});

describe("the resolved verdict", () => {
  it("takeable is null, not a state", () => {
    expect(resolveHold({ blockedOnYou: false, held: null })).toBeNull();
    expect(resolveHold({ blockedOnYou: false, held: undefined })).toBeNull();
  });

  it("his desk outranks any label", () => {
    expect(resolveHold({ blockedOnYou: true, held: { state: "sitting" } })?.kind).toBe("you");
    expect(resolveHold({ blockedOnYou: true, held: null })?.word).toBe("Waiting on you");
  });

  it("the word is resolved here so no caller retypes it", () => {
    for (const state of CREW_HELD_STATES) {
      expect(resolveHold({ blockedOnYou: false, held: { state } })?.word)
        .toBe(CREW_HOLD_WORD[state]);
    }
  });
});

/**
 * ⚠ THE DESK'S ANSWER, TRANSLATED INTO THE LABEL VOCABULARY (#586).
 *
 * The incident: on 2026-09-06 the #508 Fable shift parked its card on his desk,
 * removed `awaiting-fable`, and applied nothing in its place. Twenty-one
 * minutes later the escalation gate answered *"NONE: the next card is #508,
 * which an Opus shift can take"* — so an Opus shift launched and **#535, the
 * next `awaiting-fable` card in his own order, was never escalated**. A hold
 * that lives only in prose is invisible to the thing that launches shifts.
 *
 * The fixtures below are the four cards of that morning.
 */
describe("a card his desk is holding gets a label the escalation gate can see", () => {
  const orderedCard = (issueNumber: number, labels: string[] = [], body = "") =>
    ({ issueNumber, labels, body });

  it("⚠ THE #586 CASE: on his desk, no hold label — apply `blocked`", () => {
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(508)],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply).toEqual([
      { issueNumber: 508, deskCardId: "deploy-flip-508", bodyCarriesFossil: false },
    ]);
    expect(plan.stale).toEqual([]);
  });

  it("the desk card ID rides along, so the report says WHY rather than just what", () => {
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(508)],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply[0]?.deskCardId).toBe("deploy-flip-508");
  });

  it("a card already carrying ANY hold label is left alone — a second chip changes nothing", () => {
    for (const label of Object.values(CREW_HOLD_LABELS)) {
      const plan = planDeskHoldLabels({
        ordered: [orderedCard(535, [label])],
        deskOpen: [{ issueNumber: 535, cardId: "reimagine-design-535" }],
      });
      expect(plan.apply, `already held by ${label}`).toEqual([]);
    }
  });

  it("⚠ THE NEGATIVE CONTROL: a card his desk does NOT name is never labelled", () => {
    /* Without this arm the rule could be "label everything" and every arm
       above would still pass. */
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(543)],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply).toEqual([]);
  });

  it("a desk card that has been ANSWERED does not hold anything — only OPEN cards are passed in", () => {
    /* The sweep filters on `state === "open"` before calling; this pins the
       contract that an empty desk produces an empty plan rather than a
       hold-everything default. */
    expect(planDeskHoldLabels({ ordered: [orderedCard(543)], deskOpen: [] }).apply).toEqual([]);
  });

  it("two open desk cards naming one issue hold it once, not twice", () => {
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(530)],
      deskOpen: [
        { issueNumber: 530, cardId: "tail-court-reimagine-530" },
        { issueNumber: 530, cardId: "tail-court-verdict-530" },
      ],
    });
    expect(plan.apply).toHaveLength(1);
  });
});

/**
 * ⚠ IT APPLIES AND IT NEVER REMOVES — the asymmetry the module header argues
 * for, driven rather than promised.
 *
 * `blocked` is applied by hand for reasons that have nothing to do with his
 * desk (#404 is blocked on #391's ladder fold), so a script that stripped it
 * on a silent desk would un-hold a card nobody had read.
 */
describe("a hold whose reason has gone is REPORTED, never cleared", () => {
  it("⚠ #404's real shape: `blocked` with a written reason, desk silent — reported QUIETLY", () => {
    /* The first shape filtered this card out entirely, and that is the defect
       the reviewer found: the marker line cannot tell a live hand-hold from a
       FOSSIL one, so filtering on it freezes any card whose body ever carried
       a line. It is reported; `hasWrittenReason` sets the loudness. */
    const plan = planDeskHoldLabels({
      ordered: [{
        issueNumber: 404,
        labels: ["design-unbuilt", "founder-ordered", "blocked"],
        body: `${CREW_HOLD_MARKER} #391 — the blurb is one line per rung, and the ladder folds first.`,
      }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([{ issueNumber: 404, hasWrittenReason: true }]);
    expect(plan.apply).toEqual([]);
  });

  it("`blocked`, no written reason, desk silent — reported LOUDLY", () => {
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 508, labels: ["blocked"], body: "no marker line here" }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([{ issueNumber: 508, hasWrittenReason: false }]);
  });

  it("⚠ THE FOSSIL CARD: once hand-held, unblocked, now on his desk — the old line is flagged", () => {
    /* PR #613 review, finding 1, the second symptom. #298 deliberately leaves a
       rotted marker line in a body when a label is removed, because nothing
       renders it. A hold applied HERE would adopt that sentence and show it
       beside a brand-new chip, which is exactly the "stale reason outliving its
       state" bug #298 was built to kill. The caller is told, and takes its
       reason from the desk instead. */
    const plan = planDeskHoldLabels({
      ordered: [{
        issueNumber: 508,
        labels: ["founder-ordered"],
        body: `${CREW_HOLD_MARKER} #391 — a hold that ended weeks ago.`,
      }],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply).toEqual([
      { issueNumber: 508, deskCardId: "deploy-flip-508", bodyCarriesFossil: true },
    ]);
  });

  it("⚠ AND IT CANNOT FREEZE: the same fossil card, after his desk card is answered", () => {
    /* The reviewer's own failure scenario, driven end to end. Under the first
       shape this returned an EMPTY stale list — the card kept `blocked` for
       ever and was named to nobody. */
    const plan = planDeskHoldLabels({
      ordered: [{
        issueNumber: 508,
        labels: ["founder-ordered", "blocked"],
        body: `${CREW_HOLD_MARKER} #391 — a hold that ended weeks ago.`,
      }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([{ issueNumber: 508, hasWrittenReason: true }]);
  });

  it("the plan NEVER carries a removal — there is no shape for one", () => {
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 508, labels: ["blocked"], body: "" }],
      deskOpen: [],
    });
    expect(Object.keys(plan).sort()).toEqual(["apply", "stale"]);
  });

  it("a card still on his desk is not stale, whatever its body says", () => {
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 508, labels: ["blocked"], body: "" }],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.stale).toEqual([]);
  });

  it("`awaiting-fable` with a silent desk is not this rule's business", () => {
    /* Removing a Fable hold is a person's read of the card (#541 rule 3), and
       this reader must not start quietly counting it as rot. */
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 535, labels: ["awaiting-fable"], body: "" }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([]);
  });
});

/**
 * WHOSE HOLD IS IT — `holdOwnerFromReason` (#1467).
 *
 * ⚠ **THE CORPUS IS THE REAL ONE.** Every sentence in the first block is a
 * live `**Waiting on:**` line read off an open card on 2026-09-29, not a
 * fixture written to suit the reader. That matters most for the one that is
 * the whole reason this function is anchored rather than searching: **#129's
 * line ENDS with the words "Not waiting on him."** A reader looking for a
 * pronoun anywhere puts that card on his desk while its filer says the
 * opposite, which is the failure that would make the section untrustworthy on
 * its first day.
 */
describe("who a hold is waiting on, read from the filer's own sentence", () => {
  it("the real sentences that mean HIM", () => {
    /* #1434, verbatim. */
    expect(holdOwnerFromReason("you — a yes or no, and no is a fine answer.")).toBe("you");
    /* #1492, verbatim — a possessive, and his name rather than the pronoun. */
    expect(holdOwnerFromReason("Michael's ruling on the retry shape (A / B / C in the body). No seat picks a shape."))
      .toBe("you");
  });

  it("the real sentences that do NOT, including the one that names him at the end", () => {
    /* #129, verbatim — the negative control this whole instrument turns on. */
    expect(holdOwnerFromReason(
      "slice 1's rows — PR #1007 merged (9d517932); slice 2's patrol needs refused AND passed prompts on record first. Not waiting on him.",
    )).toBe("other");
    /* #1098, verbatim — a leading article, and a seat rather than a person. */
    expect(holdOwnerFromReason(
      "the **Janitor patrol** (clock every 3 days; last run 2026-09-21, so ~24 Sep).",
    )).toBe("other");
  });

  it("an absent or wordless reason is unknown, and unknown is never his", () => {
    expect(holdOwnerFromReason(null)).toBe("unknown");
    expect(holdOwnerFromReason(undefined)).toBe("unknown");
    expect(holdOwnerFromReason("")).toBe("unknown");
    expect(holdOwnerFromReason("   ")).toBe("unknown");
    expect(holdOwnerFromReason("#535")).toBe("unknown");
  });

  it("steps over emphasis and a leading article, and trims a possessive", () => {
    expect(holdOwnerFromReason("**you** — a yes or no")).toBe("you");
    expect(holdOwnerFromReason("~~you~~ — superseded")).toBe("you");
    expect(holdOwnerFromReason("the founder's word on the shape")).toBe("you");
    expect(holdOwnerFromReason("His eye on the frames")).toBe("you");
    expect(holdOwnerFromReason("your answer on option B")).toBe("you");
  });

  it("a hold on something that is not a person reads as other", () => {
    expect(holdOwnerFromReason("a DESIGN DECISION (#541 rule 3) — the retention shape")).toBe("other");
    expect(holdOwnerFromReason("#535, not independently buildable")).toBe("other");
    expect(holdOwnerFromReason("the gate going green on PR #1234")).toBe("other");
    expect(holdOwnerFromReason("N2b closing — the milestone gate")).toBe("other");
  });

  it("reads the whole answer out of the marker line the body carries", () => {
    /* The two halves joined: what the page actually does is take the body's
       line and ask whose it is, so the pair is driven end to end here. */
    const body = [
      "## Why this is held",
      `${CREW_HOLD_MARKER} you — a yes or no, and no is a fine answer.`,
    ].join("\n");
    expect(holdOwnerFromReason(holdReasonFromBody(body))).toBe("you");
    expect(holdOwnerFromReason(holdReasonFromBody("no marker anywhere in this body"))).toBe("unknown");
  });
});

/**
 * ⚠ **THE HELD CARDS NOTHING DRAWS (#1467 slice 2).**
 *
 * `liveWaitingOnYou` draws a held card when its own sentence names HIM. This is
 * its stated remainder: a live hold whose sentence names nobody is correctly not
 * drawn, and was named by nothing until `planUnreadableHolds` existed.
 *
 * ⚠ **THE CORPUS IS THE REAL QUEUE**, read on 2026-09-29 with these same three
 * readers over all 42 open cards — 6 held, 2 naming him, 2 naming a clock or a
 * body of data, 2 with no marker line at all. The bodies below are those cards'
 * own sentences, not fixtures invented to suit the reader.
 */
describe("a live hold that does not say whose it is gets NAMED, never repaired", () => {
  const held = (issueNumber: number, reason: string | null, labels: readonly string[] = [CREW_HOLD_LABELS.blocked]) => ({
    issueNumber,
    labels,
    body: reason === null
      ? "A body with no marker line anywhere in it."
      : [`Some prose first.`, ``, `${CREW_HOLD_MARKER} ${reason}`, ``, `And more after it.`].join("\n"),
  });

  it("names a held card with no marker line at all — #1468 and #1337's real shape", () => {
    const found = planUnreadableHolds({ open: [held(1468, null), held(1337, null)] });
    expect(found.map((h) => h.issueNumber)).toEqual([1337, 1468]);
    expect(found.every((h) => h.reason === null)).toBe(true);
    expect(found[0].heldStates).toEqual(["blocked"]);
  });

  it("does NOT name a card whose sentence names him — his page already draws those", () => {
    /* #1434 and #1492, verbatim from the live queue. */
    expect(planUnreadableHolds({
      open: [
        held(1434, "you — a yes or no, and no is a fine answer."),
        held(1492, "Michael's ruling on the retry shape (A / B / C in the body). No seat picks a shape."),
      ],
    })).toEqual([]);
  });

  it("does NOT name a card whose sentence names something that is not a person", () => {
    /* #1098 and #129, verbatim. Correctly undrawn AND correctly unreported —
       the filer said what it waits for, which is the whole ask. */
    expect(planUnreadableHolds({
      open: [
        held(1098, "the **Janitor patrol** (clock every 3 days; last run 2026-09-21, so ~24 Sep)."),
        held(129, "slice 1's rows — PR #1007 merged (9d517932); slice 2's patrol needs refused AND passed prompts on record first"),
      ],
    })).toEqual([]);
  });

  it("⚠ is silent about a card with NO hold label, however empty its body — #298 leaves a rotted line in place on purpose", () => {
    expect(planUnreadableHolds({ open: [held(900, null, [])] })).toEqual([]);
    expect(planUnreadableHolds({ open: [held(901, null, ["bug", "rung:N2"])] })).toEqual([]);
  });

  it("reads EVERY hold label, not `blocked` alone — a sitting is a hold whose whole meaning is a person", () => {
    for (const state of CREW_HELD_STATES) {
      const found = planUnreadableHolds({ open: [held(700, null, [CREW_HOLD_LABELS[state]])] });
      expect(found.map((h) => h.issueNumber), `hold label ${CREW_HOLD_LABELS[state]}`).toEqual([700]);
      expect(found[0].heldStates).toEqual([state]);
    }
  });

  it("⚠ keys on the OWNER reader, so a sentence of pure punctuation is caught rather than passing as written", () => {
    /* The two rules — "no sentence" and "no readable owner" — pick the same two
       cards today. This is the case that tells them apart, and it is why the
       function asks the question the page asks. */
    const found = planUnreadableHolds({ open: [held(910, "**** — ((")] });
    expect(found.map((h) => h.issueNumber)).toEqual([910]);
    expect(found[0].reason).not.toBeNull();
  });

  it("separates the two repairs: a missing sentence from an unreadable one", () => {
    const found = planUnreadableHolds({ open: [held(2, null), held(1, "*** ***")] });
    expect(found.find((h) => h.issueNumber === 2)?.reason).toBeNull();
    expect(found.find((h) => h.issueNumber === 1)?.reason).toBe("*** ***");
  });

  it("is sorted by card number and reports an empty queue as empty", () => {
    expect(planUnreadableHolds({ open: [held(90, null), held(9, null), held(50, null)] })
      .map((h) => h.issueNumber)).toEqual([9, 50, 90]);
    expect(planUnreadableHolds({ open: [] })).toEqual([]);
  });

  /**
   * ⚠ **A CARD THAT IS HIS IS MARKED, NEVER DROPPED (#2117).**
   *
   * The finding this answers was measured rather than supposed: the sweep asked
   * five consecutive shifts to repair #1995, and **both repairs it offers are
   * acts his own order forbids** — writing a `**Waiting on:**` line edits his
   * card, and dropping the hold label is the thing he named outright. Each
   * shift correctly did nothing; what it cost is that a block whose finding is
   * always unactionable teaches its reader to skim the rows beside it.
   */
  it("⚠ a card of HIS stays in the population and carries his words with it", () => {
    const found = planUnreadableHolds({ open: [held(1995, null)] });
    /* STILL FOUND. Filtering it out would make the sweep silent about a live
       hold nothing draws, which is the silence this reader was written to end. */
    expect(found.map((h) => h.issueNumber)).toEqual([1995]);
    expect(found[0].founderHeld).toBe(FOUNDER_HELD_CARDS.get(1995));
    expect(found[0].founderHeld).toContain("dont let the crew touch it");
  });

  it("⚠ CONTROL — an ordinary held card is NOT marked, or the field excuses everything", () => {
    /* Without this arm a `founderHeld` that answered truthy for every card
       would pass the arm above and empty the repair band entirely. */
    const found = planUnreadableHolds({ open: [held(1468, null), held(1337, null)] });
    expect(found.every((h) => h.founderHeld === null)).toBe(true);
  });

  it("marks only the hold, never the hold TEST — an exempt card with a readable owner is still silent", () => {
    /* The exemption decides which BAND a finding is printed in. It must not
       become a second way of being exempt from the reader itself: a card of his
       that said whose hold it was would be drawn by his page and reported by
       nobody, exactly as any other such card is. */
    expect(planUnreadableHolds({ open: [held(1995, "you — a yes or no")] })).toEqual([]);
  });
});

/**
 * ⚠ **THE EXEMPTION LIST CANNOT ROT QUIETLY (#2117), WHICH IS THE ONLY THING
 * THAT MAKES A HAND-WRITTEN LIST DEFENSIBLE UNDER WORKING LAW 4.**
 *
 * A list of card numbers is a second list, and this repository has been bitten
 * by those. The difference here is that there is no other machine-readable
 * source to drift FROM — a label would be the tidier shape and applying one to
 * #1995 would mean editing #1995 — so the real risk is not disagreement with a
 * source, it is an entry outliving its card and silently excusing nothing for
 * ever. These arms are what stops that.
 */
describe("a founder-held exemption that no longer names an open card is reported", () => {
  it("says nothing while the card is open", () => {
    expect(planFounderHeldDrift({ openIssueNumbers: [1, 1995, 2117] })).toEqual([]);
  });

  it("⚠ names the entry, and quotes his words, once the card has gone", () => {
    const drift = planFounderHeldDrift({ openIssueNumbers: [1, 2117] });
    expect(drift.map((row) => row.issueNumber)).toEqual([1995]);
    /* The reason travels with the finding: a shift deleting the line should see
       what it is deleting, not just a number. */
    expect(drift[0].why).toBe(FOUNDER_HELD_CARDS.get(1995));
  });

  it("⚠ a queue that could not be READ is never drift — an outage must not empty the list", () => {
    /* The sweep passes `null` when `gh` did not answer. Treating that as "no
       card is open" would report every exemption as stale and invite a shift to
       delete the lot, which is the fail-open direction on a control. */
    expect(planFounderHeldDrift({ openIssueNumbers: null })).toEqual([]);
  });

  it("every entry carries a date and his own words, so the next reader can check it", () => {
    /* Not decoration. The sweep prints this sentence instead of a repair, so an
       entry saying only "his" would make the row as unactionable as the one it
       replaced — a reader has to be able to tell whether it is still true. */
    expect(FOUNDER_HELD_CARDS.size).toBeGreaterThan(0);
    for (const [issueNumber, why] of FOUNDER_HELD_CARDS) {
      expect(Number.isSafeInteger(issueNumber) && issueNumber > 0, `card ${issueNumber}`).toBe(true);
      expect(why, `card ${issueNumber} has no date`).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(why, `card ${issueNumber} does not quote him`).toMatch(/"/);
    }
  });
});

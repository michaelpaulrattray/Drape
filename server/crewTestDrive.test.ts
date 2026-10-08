/**
 * THE DRIVE COMES OFF THE CARD, AND HIS ANSWER GOES BACK ON IT (#1646).
 *
 * The subject is the one thing a milestone completion card exists for. #1644
 * shipped a seven-step drive in its body, his Desk never renders a body, and his
 * question was *"i mean this could be a card on my desk if it tell me exactly
 * what to drive and test but it didnt??"*
 *
 * ⚠ **THE FIXTURE IS #1644'S REAL BODY, PASTED, NOT A SHAPE IMAGINED HERE.**
 * Its heading is `## Your test drive (each one is a minute or two)` — not the
 * bare string the card's own done-when names — and an extractor demanding an
 * exact heading would have found nothing on the one card this was built for
 * while every hand-written fixture passed. The constant below is a copy of
 * `gh issue view 1644 --json body` taken 2026-10-01, trimmed only of the
 * sections between the ones that matter, and each trim is marked.
 *
 * ⚠ **AND THE ARMS THAT MATTER MOST ARE THE ONES THAT PROVE WHAT IS *NOT* A
 * STEP**: the `## Carried forward, not lost` bullets under the drive (things
 * carried, not things to go and do), the closing sentence after them, and a
 * reply that DISCUSSES a step rather than answering it. Each of those read as a
 * step or a verdict would put work or a false *done* in front of him.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_TEST_DRIVE_HEADING,
  testDriveAnswerBody,
  testDriveAnswerFromReply,
  testDriveAnswers,
  testDriveCardId,
  testDriveFromBody,
  testDriveOpenSteps,
  testDrivesStillDrawn,
} from "../shared/crewTestDrive";

/**
 * #1644 as GitHub returns it. `…` marks where a section the drive does not
 * depend on was cut; nothing inside the drive or its neighbours is altered.
 */
const CARD_1644 = `**Waiting on:** nobody — this is the record of what N2 delivered and a test-drive list you can pick up whenever you like. Nothing is asked here; pricing (P1) is already open on your word.

## What N2 was for

Every switch that had been turned on for your account alone either went to everyone or was retired with its machinery, so what you see is what a customer gets.

## What changed for a customer, in plain terms

- **One way to cast.** The old casting lane is gone from the product in five slices (#1442–#1445, #1490, #1495, #180).
- **The wardrobe/basics paths and the tattoo studio are retired** (#203, #1148, #1158, #1160), with their flags off the service.

## Your test drive (each one is a minute or two)

1. **Sign a cast that is not shaped like a person** (Jingu, or a new creature) and check the close-up and three-quarter arrive instead of being refused (#1582, #1612).
2. **Sign a cast with an asymmetric outfit** (one bare shoulder) and check the side profile arrives (#1579).
3. **On a signed cast, press Try again on an unchecked view** and confirm it is free and says *Unchecked*; on a refunded view confirm the price shows before the press (#1347).
4. **Open one of your old links**: \`/casting\`, \`/casting/cast/<id>\`, \`/app/boards\` — each should land on the new address (#1583).
5. **Sign a cast whose brief names a dress or a robe** and check the full-length views wear it, not a plain version (#1278).
6. **Reply on any Desk card** and check the card carries your words within a minute (#1539).
7. **Click Errors on the admin overview**: the Sentry project should show events, not a welcome screen (#1542).

## Carried forward, not lost

- #1612 remainder: the hand-over of the framing axis to the measurement (money, its own PR), the framing-template court (part 3), and your eye on a real Sign's strip after the hand-over. #1594, #1595, #1611 close on that receipt.
- #1218 closed as superseded: a fourth checker axis for light runs against your ruling that only identity refuses.

If anything on the drive does not match, say so on this card and it becomes a bug.`;

describe("the drive #1644 actually shipped", () => {
  const steps = testDriveFromBody(CARD_1644);

  it("finds seven steps and nothing else in the body", () => {
    expect(steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("reads the heading as a PREFIX — the real one carries a parenthetical", () => {
    /* The positive control for the clause the card's own done-when would have
       got wrong: `## Your test drive (each one is a minute or two)`. */
    expect(CARD_1644).toContain(`## ${CREW_TEST_DRIVE_HEADING} (each one`);
    expect(steps.length).toBe(7);
  });

  it("gives him the instruction with no markdown, no backticks and no card numbers", () => {
    expect(steps[0].text).toBe(
      "Sign a cast that is not shaped like a person (Jingu, or a new creature) and check the close-up and three-quarter arrive instead of being refused.",
    );
    expect(steps[3].text).toBe(
      "Open one of your old links: /casting, /casting/cast/<id>, /app/boards — each should land on the new address.",
    );
    for (const step of steps) {
      expect(step.text).not.toContain("#");
      expect(step.text).not.toContain("*");
      expect(step.text).not.toContain("`");
    }
  });

  it("KEEPS a parenthetical of real prose and removes only one of card numbers", () => {
    /* The negative control for the strip. A looser rule that ate any
       parenthetical containing a `#` would delete half his instruction and the
       step would still read as a sentence, so nothing would look wrong. */
    expect(steps[0].text).toContain("(Jingu, or a new creature)");
    expect(steps[1].text).toContain("(one bare shoulder)");
    expect(steps[1].text).toContain("check the side profile arrives.");
  });

  it("records what each step proves, which is what the bug card is cut from", () => {
    expect(steps[0].proves).toEqual([1582, 1612]);
    expect(steps[2].proves).toEqual([1347]);
    expect(steps[6].proves).toEqual([1542]);
  });

  it("stops at the next heading — the carried-forward remainder is not a drive", () => {
    const text = steps.map((step) => step.text).join(" | ");
    expect(text).not.toContain("Carried forward");
    expect(text).not.toContain("closed as superseded");
    expect(text).not.toContain("the framing-template court");
  });

  it("does not glue the closing sentence onto the last step", () => {
    expect(steps[6].text).toBe(
      "Click Errors on the admin overview: the Sentry project should show events, not a welcome screen.",
    );
  });
});

describe("what is not a drive", () => {
  it("is empty for a card with no such section", () => {
    expect(testDriveFromBody("**Waiting on:** you — a yes or no.\n\n## What is wrong\n\n1. nothing")).toEqual([]);
  });

  it("is empty for a body that only talks about test drives", () => {
    const prose = "THE MILESTONE GATE says every boundary ships a completion card and a test drive.\n\n1. not a step";
    expect(testDriveFromBody(prose)).toEqual([]);
  });

  it("numbers steps by POSITION, never by the digit the writer typed", () => {
    /* Markdown renders `1.` all the way down as 1, 2, 3 — and writers do it.
       The number is the id his answer is keyed on, so two steps sharing one
       would file his verdict against the wrong step. */
    const body = "## Your test drive\n\n1. first\n1. second\n1. third\n";
    expect(testDriveFromBody(body).map((step) => step.n)).toEqual([1, 2, 3]);
    expect(testDriveFromBody(body).map((step) => step.text)).toEqual(["first", "second", "third"]);
  });

  it("joins a hard-wrapped step and splits on a paragraph break", () => {
    const wrapped = "## Your test drive\n\n1. open the page\n   and look at the strip\n2. press Try again\n";
    expect(testDriveFromBody(wrapped).map((step) => step.text))
      .toEqual(["open the page and look at the strip", "press Try again"]);

    /* A paragraph after a blank line ends the list — markdown's own rule, and
       the thing that saves a drive written as the LAST section of a card. */
    const trailing = "## Your test drive\n\n1. open the page\n\nIf anything does not match, say so here.\n";
    expect(testDriveFromBody(trailing).map((step) => step.text)).toEqual(["open the page"]);
  });

  it("reads a drive quoted inside a blockquote", () => {
    /* #1559's lesson: a reader anchored past a `>` goes silent on ordinary
       markdown a writer has every reason to use. */
    const quoted = "> ## Your test drive\n>\n> 1. open the page (#1)\n> 2. press the button\n";
    expect(testDriveFromBody(quoted).map((step) => step.text)).toEqual(["open the page", "press the button"]);
  });

  it("drops a step that reads as nothing once the bookkeeping is off it", () => {
    expect(testDriveFromBody("## Your test drive\n\n1. (#1612)\n2. real step\n").map((s) => s.text))
      .toEqual(["real step"]);
  });
});

describe("his answer is an ordinary reply, and reads back as a verdict", () => {
  it("writes a sentence he and his GitHub readers can read", () => {
    expect(testDriveAnswerBody({ step: 3, verdict: "matched", note: null }))
      .toBe("Test drive step 3 — matched");
    expect(testDriveAnswerBody({ step: 3, verdict: "did-not-match", note: "the price did not show" }))
      .toBe("Test drive step 3 — did not match\n\nthe price did not show");
  });

  it("round-trips both verdicts and the note", () => {
    for (const verdict of ["matched", "did-not-match"] as const) {
      const body = testDriveAnswerBody({ step: 7, verdict, note: "a note" });
      expect(testDriveAnswerFromReply(body)).toEqual({ step: 7, verdict, note: "a note" });
    }
  });

  it("accepts an en dash or a hyphen, because a round trip may change the one we write", () => {
    expect(testDriveAnswerFromReply("Test drive step 2 – did not match")?.verdict).toBe("did-not-match");
    expect(testDriveAnswerFromReply("Test drive step 2 - matched")?.verdict).toBe("matched");
    expect(testDriveAnswerFromReply("test drive step 2 — MATCHED")?.verdict).toBe("matched");
  });

  it("is anchored on the FIRST LINE — prose about a step is not a verdict", () => {
    /* The negative control, and the expensive direction: a reader scanning the
       whole body would mark a step done on a sentence that was asking a
       question. He writes freely on these cards. */
    expect(testDriveAnswerFromReply("step 3 matched but the wording is odd")).toBeNull();
    expect(testDriveAnswerFromReply("Looks good.\n\nTest drive step 3 — matched")).toBeNull();
    expect(testDriveAnswerFromReply("Test drive step 3 — matched for the most part")).toBeNull();
    expect(testDriveAnswerFromReply("Test drive step three — matched")).toBeNull();
  });
});

describe("which steps are answered is DERIVED from the replies the Desk already has", () => {
  const card = testDriveCardId(1644);

  it("keys on the card the reply names and ignores every other card's", () => {
    const answers = testDriveAnswers(1644, [
      { cardId: card, body: "Test drive step 1 — matched", createdAt: "2026-10-01T01:00:00Z" },
      { cardId: "card-1612", body: "Test drive step 2 — matched", createdAt: "2026-10-01T01:00:00Z" },
      { cardId: null, body: "Test drive step 3 — matched", createdAt: "2026-10-01T01:00:00Z" },
    ]);
    expect([...answers.keys()]).toEqual([1]);
  });

  it("lets him change his mind — the NEWEST reply per step wins", () => {
    const answers = testDriveAnswers(1644, [
      { cardId: card, body: "Test drive step 3 — matched", createdAt: "2026-10-01T01:00:00Z" },
      { cardId: card, body: "Test drive step 3 — did not match\n\nactually the price was missing", createdAt: "2026-10-01T02:00:00Z" },
    ]);
    expect(answers.get(3)).toEqual({
      step: 3,
      verdict: "did-not-match",
      note: "actually the price was missing",
    });
  });

  it("ignores ordinary prose on the same card", () => {
    const answers = testDriveAnswers(1644, [
      { cardId: card, body: "nice work on this one", createdAt: "2026-10-01T01:00:00Z" },
    ]);
    expect(answers.size).toBe(0);
  });
});

describe("the number on his section menu", () => {
  const drive = (issueNumber: number, steps: number) => ({
    issueNumber,
    steps: Array.from({ length: steps }, (_unused, index) => ({
      n: index + 1,
      text: `step ${index + 1}`,
      proves: [] as number[],
    })),
  });

  it("counts the steps he has not answered, across every drive", () => {
    expect(testDriveOpenSteps([drive(1644, 7), drive(1200, 3)], [])).toBe(10);
    expect(testDriveOpenSteps([drive(1644, 7)], [
      { cardId: testDriveCardId(1644), body: "Test drive step 1 — matched", createdAt: "2026-10-01T01:00:00Z" },
      { cardId: testDriveCardId(1644), body: "Test drive step 2 — did not match", createdAt: "2026-10-01T01:00:00Z" },
    ])).toBe(5);
  });

  it("is zero for a finished drive, and zero when there is no drive at all", () => {
    const answered = [1, 2].map((step) => ({
      cardId: testDriveCardId(1644),
      body: `Test drive step ${step} — matched`,
      createdAt: "2026-10-01T01:00:00Z",
    }));
    expect(testDriveOpenSteps([drive(1644, 2)], answered)).toBe(0);
    expect(testDriveOpenSteps([], answered)).toBe(0);
  });

  it("CONTROL — an answer on another card does not retire a step here", () => {
    expect(testDriveOpenSteps([drive(1644, 2)], [
      { cardId: testDriveCardId(1200), body: "Test drive step 1 — matched", createdAt: "2026-10-01T01:00:00Z" },
    ])).toBe(2);
  });

  it("takes a Date as readily as a string — superjson revives one on the page", () => {
    const answers = testDriveAnswers(1644, [
      { cardId: testDriveCardId(1644), body: "Test drive step 1 — matched", createdAt: new Date("2026-10-01T01:00:00Z") },
      { cardId: testDriveCardId(1644), body: "Test drive step 1 — did not match", createdAt: new Date("2026-10-01T03:00:00Z") },
    ]);
    expect(answers.get(1)?.verdict).toBe("did-not-match");
  });
});

describe("a finished drive leaves his page (#1988)", () => {
  /* His report, 2026-10-08: "i finished the test drive but its still showing on
     my desk" — P2's drive (#1933), five of five Matched, card closed. */
  const drive = (issueNumber: number, steps: number, cardClosed: boolean) => ({
    issueNumber,
    cardClosed,
    steps: Array.from({ length: steps }, (_unused, index) => ({
      n: index + 1,
      text: `step ${index + 1}`,
      proves: [] as number[],
    })),
  });
  const answer = (issueNumber: number, step: number, word = "matched") => ({
    cardId: testDriveCardId(issueNumber),
    body: `Test drive step ${step} — ${word}`,
    createdAt: "2026-10-08T09:00:00Z",
  });
  const allFive = [1, 2, 3, 4, 5].map((step) => answer(1933, step));
  const numbers = (drives: ReadonlyArray<{ issueNumber: number }>) => drives.map((d) => d.issueNumber);

  it("a CLOSED card with every step answered draws no drive", () => {
    expect(testDrivesStillDrawn([drive(1933, 5, true)], allFive)).toEqual([]);
  });

  it("a `did not match` is an answer — the step has his word on it", () => {
    const replies = [...allFive.slice(0, 4), answer(1933, 5, "did not match")];
    expect(testDrivesStillDrawn([drive(1933, 5, true)], replies)).toEqual([]);
  });

  it("CONTROL — an OPEN card with every step answered still draws: closing it is his", () => {
    expect(numbers(testDrivesStillDrawn([drive(1933, 5, false)], allFive))).toEqual([1933]);
  });

  it("CONTROL — a CLOSED card with one step unanswered still draws: there is something left to do", () => {
    expect(numbers(testDrivesStillDrawn([drive(1933, 5, true)], allFive.slice(0, 4)))).toEqual([1933]);
  });

  it("CONTROL — answers on ANOTHER card do not finish this one", () => {
    const elsewhere = [1, 2, 3, 4, 5].map((step) => answer(1644, step));
    expect(numbers(testDrivesStillDrawn([drive(1933, 5, true)], elsewhere))).toEqual([1933]);
  });

  it("drops only the finished drive and keeps the rest in their order", () => {
    const drives = [drive(1990, 3, false), drive(1933, 5, true), drive(1644, 7, true)];
    expect(numbers(testDrivesStillDrawn(drives, allFive))).toEqual([1990, 1644]);
  });

  it("the page's menu count and its section read the SAME filtered list", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync(new URL("../client/src/pages/AdminCrew.tsx", import.meta.url), "utf8");
    /* The one assignment the section menu and <CrewTestDrive drives={testDrives}> share. */
    expect(page).toMatch(/const testDrives = testDrivesStillDrawn\(\s*live\.available \? live\.desk\.testDrives : \[\],\s*data\.replies,?\s*\);/);
    expect(page).toMatch(/testDriveOpenSteps\(testDrives, data\.replies\)/);
    expect(page).toMatch(/drives=\{testDrives\}/);
  });
});

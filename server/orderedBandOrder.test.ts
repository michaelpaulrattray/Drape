/**
 * TWO VIEWS OF ONE RANKING, HELD TO ONE SORT (#718).
 *
 * The founder ruled on 2026-09-09 (Crew reply #168, verbatim and entire):
 *
 * > **Urgent wins inside your ordered group**
 *
 * Before that ruling the two shift-facing views of his ordered band could give
 * different *take this first* answers, and both were defensible readings of his
 * own words:
 *
 * - `scripts/crew-desk-sweep.mts` writes NEXT UP on his Crew page and floated
 *   `urgent` to the top of the ordered population.
 * - `scripts/queue-standing-exceptions.mts` printed that band oldest-first with
 *   nothing floating.
 *
 * ⚠ **The interesting arm is not "does urgent float" — it is "do the two agree"**,
 * because the thing that broke was an ASSERTED agreement. The desk sweep's
 * docblock said *"queue-standing-exceptions is the same sort"*; it was true when
 * written, stopped being true, and nothing anywhere could notice, which is
 * working law 4 exactly (a second list shadowing a source of truth drifts). So
 * the comparator is one function and this suite drives BOTH consumers over the
 * SAME fixture and compares the two running orders row for row.
 *
 * Driven both ways before it was believed:
 *   · either consumer's call to `sortOrderedBand` replaced by a plain
 *     oldest-first sort → the agreement arm reddens, naming both orders;
 *   · the comparator's urgent limb removed → the ruling arms redden.
 */
import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  ORDERED_BAND_RULE,
  compareOrderedBand,
  filedKey,
  sortOrderedBand,
} from "../scripts/lib/orderedBand.mts";
import {
  type OrderedIssue,
  planNextUpItems,
} from "../scripts/lib/nextUpItems.mts";
import {
  type Row,
  orderedBandRunningOrder,
  renderBands,
} from "../scripts/lib/standingExceptions.mts";

const NOW = new Date("2026-09-09T13:00:00Z");

/**
 * THE CARD'S OWN WORKED EXAMPLE, and it is the fixture on purpose: *an old
 * non-urgent `founder-ordered` card filed 25 Aug and a newer card carrying BOTH
 * labels filed 5 Sept.* Before the ruling his page said take the newer one and
 * the shift's priority view said take the older one.
 */
const WORKED_EXAMPLE = [
  { number: 100, title: "old and not urgent", createdAt: "2026-08-25T00:00:00Z", urgent: false },
  { number: 400, title: "newer and urgent", createdAt: "2026-09-05T00:00:00Z", urgent: true },
  { number: 250, title: "middling and urgent", createdAt: "2026-08-30T00:00:00Z", urgent: true },
  { number: 500, title: "newest and not urgent", createdAt: "2026-09-07T00:00:00Z", urgent: false },
];

const asQueueRow = (card: typeof WORKED_EXAMPLE[number]): Row => ({
  number: card.number,
  title: card.title,
  createdAt: card.createdAt,
  labels: [{ name: "founder-ordered" }, ...(card.urgent ? [{ name: "urgent" }] : [])],
});

const asIssue = (card: typeof WORKED_EXAMPLE[number]): OrderedIssue => ({
  number: card.number,
  title: card.title,
  createdAt: card.createdAt,
  labels: [{ name: "founder-ordered" }, ...(card.urgent ? [{ name: "urgent" }] : [])],
  body: "",
});

/** What a shift reading the priority view would take, in order. */
const priorityViewOrder = (cards: typeof WORKED_EXAMPLE): number[] =>
  orderedBandRunningOrder(cards.map(asQueueRow)).map((row) => row.number);

/** What his Crew page's NEXT UP shows him, in order. */
const deskPageOrder = (cards: typeof WORKED_EXAMPLE): number[] =>
  planNextUpItems({
    ordered: cards.map(asIssue),
    appliedReasons: new Map<number, string>(),
  }).map((item) => item.issueNumber);

describe("his ruling — urgent wins inside the ordered group", () => {
  it("floats the urgent cards above the older non-urgent one", () => {
    expect(priorityViewOrder(WORKED_EXAMPLE)).toEqual([250, 400, 100, 500]);
  });

  it("keeps oldest-first inside each half — his clause is otherwise untouched", () => {
    /* 250 (30 Aug) before 400 (5 Sept) among the urgent; 100 (25 Aug) before
       500 (7 Sept) among the rest. `absent a word, oldest first` still holds
       everywhere the ruling does not reach. */
    const urgentHalf = priorityViewOrder(WORKED_EXAMPLE).slice(0, 2);
    const restHalf = priorityViewOrder(WORKED_EXAMPLE).slice(2);
    expect(urgentHalf).toEqual([250, 400]);
    expect(restHalf).toEqual([100, 500]);
  });

  it("is a stable rule, not an artefact of the fixture's input order", () => {
    /* The same four cards handed in every rotation give one running order —
       a comparator that leant on input order would pass the arms above. */
    for (let shift = 0; shift < WORKED_EXAMPLE.length; shift += 1) {
      const rotated = [...WORKED_EXAMPLE.slice(shift), ...WORKED_EXAMPLE.slice(0, shift)];
      expect(priorityViewOrder(rotated)).toEqual([250, 400, 100, 500]);
      expect(deskPageOrder(rotated)).toEqual([250, 400, 100, 500]);
    }
  });

  it("does not re-order the caller's own array", () => {
    const given = WORKED_EXAMPLE.map(asQueueRow);
    orderedBandRunningOrder(given);
    expect(given.map((row) => row.number)).toEqual([100, 400, 250, 500]);
  });
});

describe("THE AGREEMENT — his page and the shift's priority view", () => {
  it("give the same running order on the card's own worked example", () => {
    /* The failure this suite exists for: before the ruling these two answered
       400 and 100 respectively, and nothing could see it. */
    expect(deskPageOrder(WORKED_EXAMPLE)).toEqual(priorityViewOrder(WORKED_EXAMPLE));
  });

  it("agree on every subset of the worked example, not just the whole", () => {
    /* A disagreement can hide in a shape the headline fixture does not have —
       one card, all urgent, none urgent, ties. */
    const total = 1 << WORKED_EXAMPLE.length;
    for (let mask = 1; mask < total; mask += 1) {
      const subset = WORKED_EXAMPLE.filter((_, index) => (mask & (1 << index)) !== 0);
      expect(
        deskPageOrder(subset),
        `his page and the priority view disagree on subset ${JSON.stringify(subset.map((c) => c.number))}`,
      ).toEqual(priorityViewOrder(subset));
    }
  });

  it("agree when two ordered cards were filed in the same second", () => {
    /* A tie is where two comparators most easily diverge, and `Array#sort` is
       only stable within one implementation of one comparator. */
    const tied = [
      { number: 700, title: "tie, urgent", createdAt: "2026-09-01T00:00:00Z", urgent: true },
      { number: 600, title: "tie, urgent too", createdAt: "2026-09-01T00:00:00Z", urgent: true },
      { number: 650, title: "tie, not urgent", createdAt: "2026-09-01T00:00:00Z", urgent: false },
    ];
    expect(deskPageOrder(tied)).toEqual(priorityViewOrder(tied));
    /* Whatever the tie resolves to, the ruling still holds across it. */
    expect(deskPageOrder(tied).at(-1)).toBe(650);
  });

  it("both read the SAME comparator rather than declaring their own", () => {
    /*
      ⚠ **A GREP WOULD NOT PROVE THIS AND IS NOT WHAT THIS ARM DOES** (the same
      lesson `standingExceptions.mts` carries: a commented-out call passes a
      substring test). The proof is behavioural — `compareOrderedBand` is
      driven directly, and both consumers are asserted to reproduce its order on
      a fixture whose answer differs under every plausible alternative sort
      (oldest-first, newest-first, by number).
    */
    const byComparator = sortOrderedBand(
      WORKED_EXAMPLE.map((card) => ({ ...card, issueNumber: card.number })),
    ).map((card) => card.number);
    expect(byComparator).toEqual([250, 400, 100, 500]);
    expect(deskPageOrder(WORKED_EXAMPLE)).toEqual(byComparator);
    expect(priorityViewOrder(WORKED_EXAMPLE)).toEqual(byComparator);

    /* The alternatives, so the fixture is known to discriminate. */
    const oldestFirst = [...WORKED_EXAMPLE]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((c) => c.number);
    const byNumber = [...WORKED_EXAMPLE].sort((a, b) => a.number - b.number).map((c) => c.number);
    expect(oldestFirst).not.toEqual(byComparator);
    expect(byNumber).not.toEqual(byComparator);
  });
});

describe("the comparator itself", () => {
  it("puts urgent before non-urgent whatever the dates say", () => {
    const older = { urgent: false, createdAt: "2020-01-01T00:00:00Z", issueNumber: 1 };
    const newer = { urgent: true, createdAt: "2026-09-09T00:00:00Z", issueNumber: 2 };
    expect(compareOrderedBand(newer, older)).toBeLessThan(0);
    expect(compareOrderedBand(older, newer)).toBeGreaterThan(0);
  });

  it("falls back to oldest first when both carry the same urgency", () => {
    const older = { urgent: true, createdAt: "2026-08-01T00:00:00Z", issueNumber: 9 };
    const newer = { urgent: true, createdAt: "2026-09-01T00:00:00Z", issueNumber: 1 };
    expect(compareOrderedBand(older, newer)).toBeLessThan(0);
  });

  it("is a TOTAL order — same second, same urgency, still decided", () => {
    /*
      ⚠ **Review of PR #722, finding 2.** Without the numeric limb these two
      compared equal and fell to input order under a stable sort, so the three
      views agreed on ties only because all three feed on one `gh` call and
      inherit its server-side ordering — a premise no fixture can test, since a
      fixture hands every consumer the same array.
    */
    const first = { urgent: true, createdAt: "2026-09-01T00:00:00Z", issueNumber: 100 };
    const second = { urgent: true, createdAt: "2026-09-01T00:00:00Z", issueNumber: 400 };
    expect(compareOrderedBand(first, second)).toBeLessThan(0);
    expect(compareOrderedBand(second, first)).toBeGreaterThan(0);
    expect(compareOrderedBand(first, { ...first })).toBe(0);
  });

  it("orders a tie the same way whichever way round it is handed the pair", () => {
    /* A stable sort would pass the arm above while still returning 0 — this is
       the one that fails if the numeric limb is dropped. */
    const rows = [
      { urgent: false, createdAt: "2026-09-01T00:00:00Z", issueNumber: 400 },
      { urgent: false, createdAt: "2026-09-01T00:00:00Z", issueNumber: 100 },
    ];
    expect(sortOrderedBand(rows).map((r) => r.issueNumber)).toEqual([100, 400]);
    expect(sortOrderedBand([...rows].reverse()).map((r) => r.issueNumber)).toEqual([100, 400]);
  });
});

describe("a row with no filing date — ONE normalisation, not three", () => {
  /*
    ⚠ **Review of PR #722, finding 1**, and it is this module's own defect in
    miniature: `String(row.createdAt)` gives `"undefined"` and sorts LAST,
    `String(row.createdAt ?? "")` gives `""` and sorts FIRST. Two consumers had
    one each, so a row without the field would have led one view and trailed
    another — while every fixture supplied the field and nothing went red.
  */
  const undated = [
    { number: 100, title: "no date", createdAt: undefined as unknown as string, urgent: false },
    { number: 400, title: "dated", createdAt: "2026-09-05T00:00:00Z", urgent: false },
  ];

  it("sorts an undated card LAST rather than to the front of his queue", () => {
    /* A card whose filing date could not be read must not be handed the top of
       the band on the strength of a missing field. */
    expect(deskPageOrder(undated)).toEqual([400, 100]);
    expect(priorityViewOrder(undated)).toEqual([400, 100]);
  });

  it("makes his page and the priority view agree on it — which they did not", () => {
    expect(deskPageOrder(undated)).toEqual(priorityViewOrder(undated));
  });

  it("ranks BOTH historical spellings identically — the divergence is gone", () => {
    /*
      ⚠ **THIS IS THE ARM THAT ACTUALLY CLOSES FINDING 1, AND IT IS WORTH
      SAYING WHY THE OBVIOUS SABOTAGE DOES NOT REDDEN.** Re-introducing
      `String(row.createdAt)` in one consumer produces `"undefined"`, which
      localeCompares after every ISO date — the SAME rank the sentinel gets. The
      bug was never `"undefined"`; it was `""`, which sorted BEFORE every date
      and put an undated card at the front of his queue. `filedKey` maps `""`
      to the sentinel, so the two spellings can no longer disagree at all.
    */
    const iso = "2026-09-05T00:00:00Z";
    for (const spelling of ["undefined", "", undefined, null]) {
      expect(
        filedKey(spelling).localeCompare(iso),
        `${JSON.stringify(spelling)} must rank AFTER a real date, as every other absent shape does`,
      ).toBeGreaterThan(0);
    }
  });

  it("is reached RAW by both consumers — nobody stringifies on the way in", () => {
    /*
      The behavioural arms above cannot see a consumer that pre-formats the
      field into some third spelling. This can, and it is the one thing a source
      read is genuinely better at: proving a second normalisation has not
      re-grown beside the shared one.
    */
    for (const file of ["lib/nextUpItems.mts", "next-up-escalation.mts"]) {
      const source = readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8");
      expect(source, `${file} must hand createdAt through raw, not stringify it`)
        .not.toMatch(/String\(row\.createdAt/);
    }
  });

  it("treats every absent-ish shape the same way, in one place", () => {
    for (const absent of [undefined, null, "", 0, {}]) {
      expect(filedKey(absent), `${JSON.stringify(absent)} must read as undated`)
        .toBe(filedKey(undefined));
    }
    /* And an undated key sorts after every real ISO date, not before. */
    expect(filedKey(undefined).localeCompare("2999-12-31T23:59:59Z")).toBeGreaterThan(0);
  });
});

describe("what the priority view PRINTS about its own order", () => {
  const rendered = (cards: typeof WORKED_EXAMPLE): string =>
    renderBands({ ordered: cards.map(asQueueRow), urgent: [], now: NOW }).join("\n");

  it("names the rule it obeys, in the words his page uses", () => {
    /* One sentence, one source — so his page and a shift's terminal cannot
       describe the same sort two different ways. */
    expect(rendered(WORKED_EXAMPLE)).toContain(ORDERED_BAND_RULE);
  });

  it("no longer claims the band is plain oldest-first", () => {
    /* The old footer said "Oldest first within each band", which is now false
       of his band and is the sentence a shift would have obeyed. */
    expect(rendered(WORKED_EXAMPLE)).not.toContain("Oldest first within each band");
  });

  it("prints his band in the ruling's order, numbered as a running order", () => {
    const lines = rendered(WORKED_EXAMPLE).split("\n");
    const numbered = lines
      .map((line) => /^\s*(\d+)\. #(\d+)\s/.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => `${match[1]}:${match[2]}`);
    expect(numbered).toEqual(["1:250", "2:400", "3:100", "4:500"]);
  });

  it("shows the `urgent` label on the rows that floated, so the WHY is visible", () => {
    /* A card that jumped the queue with no visible reason is a running order a
       shift cannot check — the labels line is what makes the float legible. */
    const lines = rendered(WORKED_EXAMPLE).split("\n");
    const floated = lines.findIndex((line) => line.includes("#250"));
    expect(lines[floated + 1]).toContain("urgent");
  });
});

import { describe, expect, it } from "vitest";

import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches";
import {
  EXPLANATION_EXCERPT_CHARS,
  LABEL_EXPLANATION_WINDOW_MS,
  SAME_INSTANT_MS,
  counselOnDisagreement,
  mapGithubTimeline,
  readLabelArrival,
  relabelReceipt,
  type CardTimelineEvent,
} from "../scripts/lib/cardLabelProvenance.mts";
import { decideCardFiling } from "../scripts/lib/jevCardCategory.mts";

/**
 * HOW A WORK LABEL GOT ONTO A CARD, DRIVEN (#1273).
 *
 * # THE REPLAY IS THE CARD'S OWN VERIFICATION REQUIREMENT
 *
 * #1273: *"the check is a replay over those six cards plus a card whose label
 * was deliberately set: the reader must leave the deliberate one alone, or
 * annotate it."*
 *
 * ⚠ **Every timestamp and label below was READ at
 * `repos/.../issues/N/timeline` on 2026-09-26, not reconstructed from the
 * card's prose.** The six moves of 2026-09-25 are:
 *
 *   #1203 `10:45:56Z`  casting-upkeep → seat:retro
 *   #1220 `10:45:58Z`  casting-upkeep → bug
 *   #1143 `10:46:00Z`  seat:janitor   → seat:retro
 *   #1183 `10:46:02Z`  small-fix      → seat:retro
 *   #1188 `10:46:04Z`  bug            → seat:retro
 *   #1151 `10:46:06Z`  small-fix      → seat:retro
 *
 * and **not one of the six has a comment anywhere between 10:00Z and 12:00Z
 * that day** — checked per card at the timeline before this suite was written.
 *
 * The explained moves on the same cards, for the other direction:
 *
 *   #1220 `07:50:10Z`  bug   → casting-upkeep, comment `07:50:12Z`
 *   #1183 `2026-09-24T23:19:51Z` debt → small-fix, comment `23:19:52Z`
 *   #1151 `2026-09-24T23:19:41Z` debt → small-fix, comment `23:19:43Z`
 *
 * # WHAT THIS SUITE IS NOT ALLOWED TO DRIFT INTO
 *
 * ⚠ It must never start asserting that a comment inside the window MAKES a
 * move legitimate. The module reports the comment and holds either way; an arm
 * below pins exactly that, because the permissive reading is the one that
 * would quietly re-open the defect.
 */

const WORK_LABELS = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);

function move(input: {
  at: string;
  from: string;
  to: string;
  comment?: { at: string; body: string };
}): CardTimelineEvent[] {
  const events: CardTimelineEvent[] = [
    { kind: "unlabeled", at: input.at, label: input.from },
    { kind: "labeled", at: input.at, label: input.to },
  ];
  if (input.comment) events.push({ kind: "commented", at: input.comment.at, excerpt: input.comment.body });
  return events;
}

/** The six, as the API gave them. The `to` label is what each card carried after. */
const THE_SIX_SILENT_MOVES = [
  { number: 1203, at: "2026-09-25T10:45:56Z", from: "casting-upkeep", to: "seat:retro" },
  { number: 1220, at: "2026-09-25T10:45:58Z", from: "casting-upkeep", to: "bug" },
  { number: 1143, at: "2026-09-25T10:46:00Z", from: "seat:janitor", to: "seat:retro" },
  { number: 1183, at: "2026-09-25T10:46:02Z", from: "small-fix", to: "seat:retro" },
  { number: 1188, at: "2026-09-25T10:46:04Z", from: "bug", to: "seat:retro" },
  { number: 1151, at: "2026-09-25T10:46:06Z", from: "small-fix", to: "seat:retro" },
] as const;

describe("the six relabels of 2026-09-25, replayed", () => {
  it("reads every one of them as a MOVE with nothing said, and HOLDS all six", () => {
    for (const entry of THE_SIX_SILENT_MOVES) {
      const arrival = readLabelArrival({
        events: move({ at: entry.at, from: entry.from, to: entry.to }),
        workLabels: WORK_LABELS,
        label: entry.to,
      });
      expect(arrival.shape, `#${entry.number}`).toBe("move");
      expect(arrival.displaced, `#${entry.number}`).toEqual([entry.from]);
      expect(arrival.nearestComment, `#${entry.number}`).toBeNull();

      const counsel = counselOnDisagreement(arrival);
      expect(counsel.verdict, `#${entry.number}`).toBe("hold");
      expect(counsel.why, `#${entry.number}`).toContain("NOTHING on the card says why");
    }
  });

  it("#1220's whole real history reads the STANDING label, not the first one", () => {
    /* Four label acts in one day. The arrival that matters is the last one, and
       an implementation sorting the wrong way would answer the 05:01 fill and
       call the card's label unruled — which is the reading that produced the
       incident. */
    const events: CardTimelineEvent[] = [
      { kind: "labeled", at: "2026-09-25T05:01:18Z", label: "bug" },
      { kind: "commented", at: "2026-09-25T05:06:09Z", excerpt: "**His ruling, 2026-09-25 (terminal)" },
      ...move({
        at: "2026-09-25T07:50:10Z",
        from: "bug",
        to: "casting-upkeep",
        comment: { at: "2026-09-25T07:50:12Z", body: "**Relabelled, and said rather than done quietly.**\nThe defect…" },
      }),
      ...move({ at: "2026-09-25T10:45:58Z", from: "casting-upkeep", to: "bug" }),
    ];

    const arrival = readLabelArrival({ events, workLabels: WORK_LABELS, label: "bug" });
    expect(arrival.at).toBe("2026-09-25T10:45:58Z");
    expect(arrival.shape).toBe("move");
    expect(arrival.displaced).toEqual(["casting-upkeep"]);
    expect(arrival.nearestComment).toBeNull();
    expect(counselOnDisagreement(arrival).verdict).toBe("hold");
  });
});

describe("a label somebody explained", () => {
  it("shows the reason and its lag, and STILL holds — the comment is evidence, never permission", () => {
    const arrival = readLabelArrival({
      events: move({
        at: "2026-09-25T07:50:10Z",
        from: "bug",
        to: "casting-upkeep",
        comment: {
          at: "2026-09-25T07:50:12Z",
          body: "**Relabelled, and said rather than done quietly.**\nThe defect this card was filed about is fixed.",
        },
      }),
      workLabels: WORK_LABELS,
      label: "casting-upkeep",
    });

    expect(arrival.shape).toBe("move");
    expect(arrival.nearestComment?.lagSeconds).toBe(2);
    expect(arrival.nearestComment?.excerpt).toBe("**Relabelled, and said rather than done quietly.**");

    const counsel = counselOnDisagreement(arrival);
    expect(counsel.verdict).toBe("hold");
    expect(counsel.why).toContain("read it first");
  });

  it("takes the FIRST line of the reason, capped, never the whole body", () => {
    const arrival = readLabelArrival({
      events: move({
        at: "2026-09-24T23:19:51Z",
        from: "debt",
        to: "small-fix",
        comment: { at: "2026-09-24T23:19:52Z", body: `\n\n${"x".repeat(400)}\nand a second line` },
      }),
      workLabels: WORK_LABELS,
      label: "small-fix",
    });
    expect(arrival.nearestComment?.excerpt.length).toBe(EXPLANATION_EXCERPT_CHARS);
    expect(arrival.nearestComment?.excerpt).not.toContain("second line");
  });

  it("ignores a comment that landed BEFORE the move, however close", () => {
    const events: CardTimelineEvent[] = [
      { kind: "commented", at: "2026-09-25T10:45:57Z", excerpt: "an unrelated progress note" },
      ...move({ at: "2026-09-25T10:45:58Z", from: "casting-upkeep", to: "bug" }),
    ];
    const arrival = readLabelArrival({ events, workLabels: WORK_LABELS, label: "bug" });
    expect(arrival.nearestComment).toBeNull();
  });

  it("ignores a comment past the window", () => {
    const events = move({
      at: "2026-09-25T10:45:58Z",
      from: "casting-upkeep",
      to: "bug",
      comment: {
        at: new Date(Date.parse("2026-09-25T10:45:58Z") + LABEL_EXPLANATION_WINDOW_MS + 1_000).toISOString(),
        body: "far too late to be about it",
      },
    });
    const arrival = readLabelArrival({ events, workLabels: WORK_LABELS, label: "bug" });
    expect(arrival.nearestComment).toBeNull();
  });
});

describe("a label that filled a blank", () => {
  it("is the ONE shape a reading may be acted on, and #1188's real fill is the fixture", () => {
    const arrival = readLabelArrival({
      events: [{ kind: "labeled", at: "2026-09-24T22:48:42Z", label: "bug" }],
      workLabels: WORK_LABELS,
      label: "bug",
    });
    expect(arrival.shape).toBe("fill");
    expect(arrival.displaced).toEqual([]);
    const counsel = counselOnDisagreement(arrival);
    expect(counsel.verdict).toBe("look");
    expect(counsel.why).toContain("filled a blank");
  });

  it("a non-work label displaced at the same instant is NOT a move — #1183's debt → small-fix shape", () => {
    /* `debt` is a desk group, not a work switch. A card whose `debt` label came
       off as a work label went on has not had a work DECISION overturned, and
       treating it as one would hold half the queue for no reason. */
    const arrival = readLabelArrival({
      events: [
        { kind: "unlabeled", at: "2026-09-24T23:19:51Z", label: "debt" },
        { kind: "labeled", at: "2026-09-24T23:19:51Z", label: "small-fix" },
      ],
      workLabels: WORK_LABELS,
      label: "small-fix",
    });
    expect(arrival.shape).toBe("fill");
    expect(arrival.displaced).toEqual([]);
  });

  it("holds when the timeline read says nothing about the label at all", () => {
    const arrival = readLabelArrival({ events: [], workLabels: WORK_LABELS, label: "bug" });
    expect(arrival.shape).toBe("unknown");
    expect(arrival.at).toBeNull();
    /* A truncated or failed timeline read must not read as "nobody ruled on
       it" — that is the permissive direction and it is the whole defect. */
    expect(counselOnDisagreement(arrival).verdict).toBe("hold");
  });
});

describe("the same-instant window", () => {
  it("counts a move made as two commands a fraction of a second apart", () => {
    const arrival = readLabelArrival({
      events: [
        { kind: "unlabeled", at: "2026-09-25T10:45:58Z", label: "casting-upkeep" },
        { kind: "labeled", at: "2026-09-25T10:45:58.700Z", label: "bug" },
      ],
      workLabels: WORK_LABELS,
      label: "bug",
    });
    expect(arrival.shape).toBe("move");
  });

  it("does NOT swallow an unrelated removal a minute earlier", () => {
    const arrival = readLabelArrival({
      events: [
        { kind: "unlabeled", at: "2026-09-25T10:44:58Z", label: "small-fix" },
        { kind: "labeled", at: "2026-09-25T10:45:58Z", label: "bug" },
      ],
      workLabels: WORK_LABELS,
      label: "bug",
    });
    expect(arrival.shape).toBe("fill");
    expect(SAME_INSTANT_MS).toBeLessThan(60_000);
  });
});

describe("the population is the work labels the desk declares", () => {
  it("refuses a label that is not one of them, rather than answering a different question", () => {
    expect(() =>
      readLabelArrival({ events: [], workLabels: WORK_LABELS, label: "rung:N2" }),
    ).toThrow(/not one of the work labels/);
  });

  it("every fixture label above is a live work label — so a rename reddens this suite", () => {
    for (const entry of THE_SIX_SILENT_MOVES) {
      expect(WORK_LABELS, `#${entry.number} from`).toContain(entry.from);
      expect(WORK_LABELS, `#${entry.number} to`).toContain(entry.to);
    }
  });
});

describe("the GitHub timeline reduction", () => {
  it("reads all three kinds off rows shaped as the real API gives them", () => {
    const events = mapGithubTimeline([
      { event: "labeled", created_at: "2026-09-25T10:45:58Z", label: { name: "bug" }, actor: { login: "x" } },
      { event: "unlabeled", created_at: "2026-09-25T10:45:58Z", label: { name: "casting-upkeep" } },
      { event: "commented", created_at: "2026-09-25T21:56:43Z", body: "## The label on this card was flipped" },
      { event: "cross-referenced", created_at: "2026-09-25T11:00:00Z" },
      { event: "labeled", label: { name: "no timestamp" } },
      { event: "labeled", created_at: "2026-09-25T10:00:00Z" },
    ]);
    expect(events).toEqual([
      { kind: "labeled", at: "2026-09-25T10:45:58Z", label: "bug" },
      { kind: "unlabeled", at: "2026-09-25T10:45:58Z", label: "casting-upkeep" },
      { kind: "commented", at: "2026-09-25T21:56:43Z", excerpt: "## The label on this card was flipped" },
    ]);
  });

  it("refuses an unreadable timestamp rather than sorting it to one end", () => {
    expect(() =>
      readLabelArrival({
        events: [{ kind: "labeled", at: "not a date", label: "bug" }],
        workLabels: WORK_LABELS,
        label: "bug",
      }),
    ).toThrow(/unreadable timestamp/);
  });
});

describe("the receipt a move leaves", () => {
  it("names both labels, the confidence, and what it displaced", () => {
    const arrival = readLabelArrival({
      events: move({ at: "2026-09-25T10:45:58Z", from: "casting-upkeep", to: "bug" }),
      workLabels: WORK_LABELS,
      label: "bug",
    });
    const receipt = relabelReceipt({ from: "bug", to: "casting-upkeep", confidence: 0.94, arrival });
    expect(receipt).toContain("`bug` → `casting-upkeep`");
    expect(receipt).toContain("0.94");
    expect(receipt).toContain("over `casting-upkeep`");
    expect(receipt).toContain("with no reason recorded");
  });

  it("says a reader never moves a label on its own — the sentence the writer's rule makes true", () => {
    const arrival = readLabelArrival({
      events: [{ kind: "labeled", at: "2026-09-24T22:48:42Z", label: "bug" }],
      workLabels: WORK_LABELS,
      label: "bug",
    });
    const receipt = relabelReceipt({ from: "bug", to: "seat:retro", confidence: 0.91, arrival });
    expect(receipt).toContain("refuses any card that already carries one");
    /* And that sentence is not a promise — it is `decideCardFiling`'s first
       act, driven here so the receipt's claim and the code cannot part. */
    expect(decideCardFiling({ labels: ["bug"], choice: "process", confidence: 1 })).toEqual({
      act: "skip",
      reason: "already filed",
      detail: "carries bug",
    });
  });
});

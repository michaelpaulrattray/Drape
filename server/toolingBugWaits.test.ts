/**
 * A TOOLING BUG WAITS BEHIND THE FOCUS (#1647) — replayed against the ten real
 * cards the card names, plus #1645.
 *
 * **His word, 2026-10-01 (terminal), on the narrowing put to him after seven
 * self-filed tooling cards ran all night while N2 waited:** *"i like your
 * idea."* And on the hole he spotted in it himself, about #1645 (a required
 * check that had gone silent): *"if somthing like this appeared under the new
 * bugs rule because its not customer facing wouldnt the crew be stuck until it
 * was fixed?"* — so the rule has TWO exemptions, not one.
 *
 * # The rule
 *
 * A `bug`/`small-fix` card jumps the milestone and the focus when EITHER holds:
 * **a customer can hit it**, or **it blocks the line**. Everything else so
 * labelled is tooling REFINEMENT — still work, still real — and it waits behind
 * the focus like a switch card.
 *
 * # ⚠ THE CARD NAMED THE WRONG GATE, AND THAT IS WHY THIS SUITE DRIVES BOTH
 *
 * #1647's diagnosis reads *"`rungHoldFor` … exempts `isFixWork` cards from the
 * milestone hold … so the exemption fed itself for a night"*. True of the
 * function, false of the night: **not one of the seven cards carries a rung
 * label**, so `rungHoldFor` returned on its first line (`rungs.length === 0`)
 * every time and never consulted `isFixWork` at all. They reached the lane
 * through `seatPopulation`, **which had no expression of the
 * focus-before-switches ranking whatsoever** — any background card whose switch
 * was on was takeable, and `bug` is a switch that is on. Both are changed, and
 * the arms below hold the distinction so a later shift cannot reintroduce the
 * belief that one of them was the whole of it.
 *
 * # THE FIXTURE IS REAL, AND WHAT OF IT IS REAL IS STATED
 *
 * `CARDS` below carries each card's **real labels** and **the real list of paths
 * its body names**, read from GitHub on 2026-10-01 through the seat cut's own
 * `pathsNamedIn`. The bodies themselves are 39 KB and are not inlined; the
 * extraction they would exercise has its own arms elsewhere, and what this suite
 * is about is the ARITHMETIC over the paths, which runs on the real lists.
 *
 * ⚠ **`tooling` is NOT in the fixture's labels** — none of the seven carried it
 * on the day, because the label did not exist. The arms apply it explicitly
 * where they are testing the labelled case, so the fixture stays a record of
 * what was true rather than a record retro-fitted to make the rule pass.
 */
import { describe, expect, it } from "vitest";

import {
  blocksTheLine,
  CREW_BLOCKS_LINE_LABEL,
  CREW_TOOLING_LABEL,
  fixJumpsTheQueue,
  isToolingWork,
  type CrewWorkSwitchState,
} from "../shared/crewWorkSwitches";
import {
  rungHoldFor,
  seatPopulation,
  toolingPathReading,
  type SeatAreaIndex,
  type SeatCandidateCard,
} from "../scripts/lib/seatBatches.mts";

/**
 * The seven cards of 2026-09-30, in the order the card lists them. Each was
 * found while fixing the one before — which is the shape this closes.
 */
const TOOLING = [1620, 1623, 1625, 1629, 1635, 1636, 1638] as const;

/** Three fixes a customer can genuinely hit, which must stay on offer. */
const CUSTOMER = [1579, 1582, 1594] as const;

/**
 * Real labels and real named paths, read 2026-10-01. See the header for what is
 * fixtured and what is not.
 */
const CARDS: readonly { number: number; labels: readonly string[]; paths: readonly string[] }[] = [
  {
    number: 1579,
    labels: ["bug"],
    paths: [
      "server/castingV2/castViewPackage.ts",
    ],
  },
  {
    number: 1582,
    labels: ["bug", "urgent"],
    paths: [
      "server/castingV2/castViewPackage.ts",
    ],
  },
  {
    number: 1594,
    labels: ["bug", "blocked"],
    paths: [
      "server/castingV2/viewConformance.ts",
    ],
  },
  {
    number: 1620,
    labels: ["bug"],
    paths: [
      "scripts/lib/trackedFiles.mts",
      "scripts/lib/importerCountDiff.mts",
      "scripts/check-cleanup-dispositions.mts",
      "scripts/diff-importer-count-across-time.mts",
      "server/unwiringDiffer.test.ts",
      "server/deletionDoorSecondReader.test.ts",
      "server/trackedFilePopulation.test.ts",
    ],
  },
  {
    number: 1623,
    labels: ["bug"],
    paths: [
      "server/trackedFilePopulation.test.ts",
      "server/testing/hookDriver.test.ts",
      "scripts/_1619-branch-file-disposable.mts",
      "scripts/lib/productionMention.mts",
      "scripts/_1619-guard-population-disposable.mts",
    ],
  },
  {
    number: 1625,
    labels: ["small-fix"],
    paths: [
      "scripts/lib/productionMention.mts",
      "server/landingEngineNames.test.ts",
      "client/src/features/castingV2/refineWait.test.ts",
      "scripts/sweep-duplicated-sentences-disposable.mts",
      "client/src",
      "scripts/lib/",
    ],
  },
  {
    number: 1629,
    labels: ["small-fix"],
    paths: [
      "server/testing/withoutComments.ts",
      "client/src",
      "client/src/components/accountMenuPopulation.test.ts",
      "client/src/components/appChrome.test.ts",
      "client/src/components/signOutWording.test.ts",
      "client/src/features/admin/components/crew/section08-guard.test.ts",
      "client/src/features/admin/overview/section07-guard.test.ts",
      "client/src/features/castingV2/section10-guard.test.ts",
      "client/src/features/moderator/section09-guard.test.ts",
      "client/src/features/settings/card385-guard.test.ts",
      "client/src/features/settings/card390-guard.test.ts",
      "client/src/features/settings/card425-guard.test.ts",
      "client/src/features/settings/section03-guard.test.ts",
      "client/src/features/settings/settings387-guard.test.ts",
      "client/src/features/staff/counts415-guard.test.ts",
      "client/src/features/staff/counts416-guard.test.ts",
      "client/src/features/staff/section05-guard.test.ts",
      "client/src/features/staff/section06-guard.test.ts",
      "client/src/features/staff/section11-guard.test.ts",
      "client/src/foundation/promotion-guard.test.ts",
      "client/src/foundation/staffClock.test.ts",
      "server/card391LadderFold.test.ts",
      "server/castRefusalVocabulary.test.ts",
      "server/castingV2/houseRoadUnreachable.test.ts",
      "server/changeRequestLabels.test.ts",
      "server/cycleSpend.test.ts",
      "server/hookFixtureMode.test.ts",
      "server/viewThumbnailWiring.test.ts",
      "client/src/features/castingV2/refineDust.test.ts",
      "server/abuseStripHonesty.test.ts",
      "server/auditLogCategoryAgreement.test.ts",
      "server/gateTriggers.test.ts",
      "scripts/_shift114-absent-callsites-disposable.mts",
      "server/testing/withoutComments",
    ],
  },
  {
    number: 1635,
    labels: ["bug"],
    paths: [
      "server/testing/withoutComments.ts",
      "client/src/features/staff/section05-guard.test.ts",
      "client/src/features/boards/BoardPage.tsx",
      "client/src/features/admin/components/crew/section08-guard.test.ts",
      "shared/pictureFormats.ts",
    ],
  },
  {
    number: 1636,
    labels: ["small-fix"],
    paths: [
      "scripts/_1629-declarations-disposable.mts",
      "client/src/features/moderator/section09-guard.test.ts",
      "client/src/features/settings/card390-guard.test.ts",
      "client/src/features/staff/section05-guard.test.ts",
      "server/eyeFramePresence.test.ts",
      "shared/crewNextUpHold.ts",
      "client/src/foundation/",
      "client/src/components/",
      "client/src/features/settings/",
      "client/src/features/staff/",
      "client/src/features/castingV2/",
      "client/src/features/admin/",
      "client/src/features/moderator/",
      "server/commentStripperShape.test.ts",
    ],
  },
  {
    number: 1638,
    labels: ["bug"],
    paths: [
      "server/testing/childProcessSuites.ts",
      "server/testing/sourceSweepSuites.ts",
      "server/deployTriggerClaims.test.ts",
      "server/contendedTestTimeouts.test.ts",
      "server/selfInvocationCheck.test.ts",
      "shared/crewNextUpHold.ts",
      "server/castingV2/openLanePinning.test.ts",
      "server/casting/evidence/evidenceComposerSchema.ts",
      "server/claudeMdFlagEnumeration.test.ts",
      "server/crewShiftArguments.test.ts",
      "client/src/foundation/iconbutton-guard.test.ts",
      "server/castingV2/inkCutRouteCoupling.test.ts",
      "server/childProcessTestTimeouts.test.ts",
      "server/castingV2/truncatedReplyReaders.test.ts",
    ],
  },
  {
    number: 1645,
    labels: ["bug"],
    paths: [
    ],
  },
];

/** A card as the gates take it, built from the fixture's real facts. */
function cardOf(number: number, extraLabels: readonly string[] = []): SeatCandidateCard {
  const row = CARDS.find((c) => c.number === number);
  if (row === undefined) throw new Error(`#${number} is not in the fixture`);
  return {
    number: row.number,
    title: `card ${row.number}`,
    /* The paths joined one per line IS the body for this reader's purposes:
       `pathsNamedIn` returns the same set either way. */
    body: row.paths.join("\n"),
    labels: [...row.labels, ...extraLabels],
  } as SeatCandidateCard;
}

/** Every switch on — the state the night of 2026-09-30 actually ran in. */
const ALL_ON = {
  master: true, bugs: true, smallFixes: true, process: true,
  performance: true, housekeeping: true, security: true, castingUpkeep: true,
} as unknown as CrewWorkSwitchState;

const NO_AREAS: SeatAreaIndex = {
  domains: [], byPath: new Map(), byDirectory: new Map(), unassigned: new Set(),
};

const OPEN_BOARD = { holdsOffOffer: () => false, phraseFor: () => null };

/** The lane as it ran that night: a named milestone and ordered work waiting. */
function lane(cards: readonly SeatCandidateCard[], overrides: Record<string, unknown> = {}) {
  return seatPopulation({
    cards,
    focusRung: "N2",
    switches: ALL_ON,
    board: OPEN_BOARD,
    areaIndex: NO_AREAS,
    orderedLaneOffers: 3,
    ...overrides,
  } as Parameters<typeof seatPopulation>[0]);
}

const whyFor = (result: ReturnType<typeof lane>, number: number): string | null =>
  result.skipped.find((s) => s.number === number)?.why ?? null;

describe("#1647 · the rule itself — two exemptions and nothing else", () => {
  it("⚠ A TOOLING FIX DOES NOT JUMP THE QUEUE", () => {
    expect(fixJumpsTheQueue(["bug", CREW_TOOLING_LABEL])).toBe(false);
    expect(fixJumpsTheQueue(["small-fix", CREW_TOOLING_LABEL])).toBe(false);
  });

  it("exemption 1 — a customer can hit it, so an unlabelled fix jumps", () => {
    /* The card's own direction: *a card naming no path is product (fail toward
       offering a real bug)*. Absence of the label means product. */
    expect(fixJumpsTheQueue(["bug"])).toBe(true);
    expect(fixJumpsTheQueue(["small-fix"])).toBe(true);
  });

  it("⚠ EXEMPTION 2 — IT BLOCKS THE LINE, which is his own hole in the rule", () => {
    /*
      #1645: Socket stopped answering and it is a required check. Tooling by
      path, and the crew is stuck until it is fixed. Both labels together, which
      is exactly the shape that card describes.
    */
    expect(fixJumpsTheQueue(["bug", CREW_TOOLING_LABEL, CREW_BLOCKS_LINE_LABEL])).toBe(true);
    expect(blocksTheLine(["bug", CREW_BLOCKS_LINE_LABEL])).toBe(true);
    expect(blocksTheLine(["bug"])).toBe(false);
  });

  it("⚠ AND A CARD THAT IS NOT FIX WORK IS NOT MADE EXEMPT BY EITHER LABEL", () => {
    /*
      The exemptions narrow `isFixWork`; they never widen it. A feature-shaped
      card mislabelled `tooling` must not acquire a jump it never had — that
      would be this change handing out the opposite of what it removes.
    */
    expect(fixJumpsTheQueue([CREW_TOOLING_LABEL])).toBe(false);
    expect(fixJumpsTheQueue([CREW_BLOCKS_LINE_LABEL])).toBe(false);
    expect(fixJumpsTheQueue(["design-unbuilt", CREW_BLOCKS_LINE_LABEL])).toBe(false);
    expect(fixJumpsTheQueue([])).toBe(false);
  });
});

describe("#1647 · the seven cards of 2026-09-30, replayed — ALL HELD", () => {
  it("⚠ EVERY ONE OF THE SEVEN IS HELD, WITH THE SENTENCE THE CARD ASKED FOR", () => {
    const result = lane(TOOLING.map((n) => cardOf(n, [CREW_TOOLING_LABEL])));

    expect(result.takeable.map((c) => c.number)).toEqual([]);
    for (const number of TOOLING) {
      expect(whyFor(result, number), `#${number} was not held`)
        .toContain("a tooling bug — waits behind the focus");
    }
  });

  it("⚠ AND THE THREE CUSTOMER BUGS ARE ALL STILL OFFERED — the positive control", () => {
    /*
      THE ARM THAT MATTERS. A rule that holds everything passes the arm above by
      holding the product too, and the failure would be invisible: a customer
      bug waiting behind a milestone is exactly what his *one exception* exists
      to prevent. #1594 carries `blocked` and is excluded by the queue's own
      vocabulary rather than by this rule, so it is asserted as
      held-for-another-reason instead of as offered.
    */
    const result = lane(CUSTOMER.map((n) => cardOf(n)));

    expect(result.takeable.map((c) => c.number).sort()).toEqual([1579, 1582]);
    expect(whyFor(result, 1594)).not.toContain("a tooling bug");
  });
});

describe("#1647 · what the hold does NOT do", () => {
  it("⚠ WITH NO MILESTONE, A TOOLING FIX IS OFFERED — maintenance mode is its night", () => {
    /*
      `PROGRAM.md`'s MAINTENANCE MODE: with no confirmed focus, fixes to live
      behaviour and inside-existing-behaviour improvements are the ONLY
      admissible work. There is nothing to wait behind, so holding here would
      freeze the lane on exactly the nights it is meant to run.
    */
    const result = lane(TOOLING.map((n) => cardOf(n, [CREW_TOOLING_LABEL])), { focusRung: null });
    expect(result.takeable.map((c) => c.number).sort()).toEqual([...TOOLING].sort());
  });

  it("⚠ WITH NO ORDERED CARD STARTABLE, IT IS OFFERED — waiting is never idle", () => {
    /*
      The 2026-09-25 ranking is *"takes a switch card only when NO focus card can
      be started"*. The night this was written every P1 card was blocked on his
      word, so a hold keyed on the milestone alone would have left four seats
      with nothing at all to do.
    */
    const result = lane(TOOLING.map((n) => cardOf(n, [CREW_TOOLING_LABEL])), { orderedLaneOffers: 0 });
    expect(result.takeable.map((c) => c.number).sort()).toEqual([...TOOLING].sort());
  });

  it("⚠ AND AN UNSUPPLIED COUNT HOLDS NOTHING — a reading nobody gave cannot empty the lane", () => {
    const result = seatPopulation({
      cards: TOOLING.map((n) => cardOf(n, [CREW_TOOLING_LABEL])),
      focusRung: "N2",
      switches: ALL_ON,
      board: OPEN_BOARD,
      areaIndex: NO_AREAS,
    } as Parameters<typeof seatPopulation>[0]);
    expect(result.takeable.map((c) => c.number).sort()).toEqual([...TOOLING].sort());
  });

  it("⚠ AND ONE THAT BLOCKS THE LINE IS OFFERED UNDER A LIVE MILESTONE — #1645's case", () => {
    const result = lane([cardOf(1645, [CREW_TOOLING_LABEL, CREW_BLOCKS_LINE_LABEL])]);
    expect(result.takeable.map((c) => c.number)).toEqual([1645]);
  });
});

describe("#1647 · rungHoldFor — narrowed, and it was never the gate that night", () => {
  it("⚠ A RUNG-LABELLED TOOLING FIX NO LONGER USES #1553's EXEMPTION", () => {
    /*
      #1553 freed a fix whose rung label was a LOCATOR — three of his own fixes
      to live surfaces were frozen by one. That exemption was never meant to
      cover the crew's own machinery, and this is the narrowing.
    */
    expect(rungHoldFor(["bug", "rung:N6", CREW_TOOLING_LABEL], "N2")).toContain("milestone gate");
    expect(rungHoldFor(["bug", "rung:N6"], "N2")).toBeNull();
    expect(rungHoldFor(["bug", "rung:N6", CREW_TOOLING_LABEL, CREW_BLOCKS_LINE_LABEL], "N2")).toBeNull();
  });

  it("⚠ AND NONE OF THE SEVEN EVER REACHED THAT FUNCTION'S EXEMPTION — read at the real labels", () => {
    /*
      THE CARD'S DIAGNOSIS, CHECKED. `rungHoldFor` returns null on its FIRST line
      for a card with no rung label, so `isFixWork` was never consulted for any
      of the seven, before this change or after it. The arm asserts the premise
      rather than the consequence, so it stays true whatever the function's body
      becomes.
    */
    for (const number of TOOLING) {
      const labels = CARDS.find((c) => c.number === number)!.labels;
      expect(labels.filter((l) => l.startsWith("rung:")), `#${number}`).toEqual([]);
      expect(rungHoldFor([...labels, CREW_TOOLING_LABEL], "N2"), `#${number}`).toBeNull();
    }
  });
});

describe("#1647 · the path reading is a REPORT, and its accuracy is measured both ways", () => {
  /** The card's own stated tooling set, re-declared so the arm reads the rule it judges. */
  const isToolingPath = (p: string) =>
    /(^|\/)[^/]*\.test\.[A-Za-z0-9]+$/.test(p)
    || p.startsWith("scripts/") || p.startsWith("server/testing/")
    || p.startsWith(".github/") || p.startsWith(".githooks/") || p.startsWith("docs/");

  it("⚠ IT IS NOT THE GATE, AND THE MEASUREMENT IS WHY — 5 of the 7 disagree", () => {
    /*
      The card offered two mechanisms and asked which. This is the reading that
      settled it: *tooling iff EVERY path the body names is a tooling path* —
      the card's own stated set — disagrees with the card's own positive control
      on five cards, every one of them toward OFFERING. The cause is structural:
      a tooling card names product paths as the files its instrument READS, not
      as files it changes.
    */
    const wrong = TOOLING.filter((number) => {
      const paths = CARDS.find((c) => c.number === number)!.paths;
      return paths.some((p) => !isToolingPath(p));
    });
    expect(wrong).toEqual([1625, 1629, 1635, 1636, 1638]);

    /* And it gets the three customer bugs right, each naming a single product
       file — so it fails in one direction only, which is the one that matters. */
    for (const number of CUSTOMER) {
      expect(CARDS.find((c) => c.number === number)!.paths.every((p) => !isToolingPath(p))).toBe(true);
    }
  });

  it("⚠ THE REPORT FLAGS 6 OF THE 7 AND 0 OF THE 3 — a floor, stated as one", () => {
    const flagged = TOOLING.filter((n) => toolingPathReading(cardOf(n)) !== null);
    /* #1636 is missed: 6 of its 14 named paths are tooling, which is not a
       majority. Asserted BY NAME so the floor is a recorded fact rather than a
       hope, and so a later widening has to move this line deliberately. */
    expect(flagged).toEqual([1620, 1623, 1625, 1629, 1635, 1638]);
    expect(toolingPathReading(cardOf(1636))).toBeNull();

    for (const number of CUSTOMER) {
      expect(toolingPathReading(cardOf(number)), `#${number} must not be flagged`).toBeNull();
    }
  });

  it("⚠ AND IT GOES QUIET ONCE THE LABEL IS ON — it reports a MISSING label, not a category", () => {
    expect(toolingPathReading(cardOf(1620))).not.toBeNull();
    expect(toolingPathReading(cardOf(1620, [CREW_TOOLING_LABEL]))).toBeNull();
    expect(isToolingWork(["bug", CREW_TOOLING_LABEL])).toBe(true);
    expect(isToolingWork(["bug"])).toBe(false);
  });

  it("a card naming no path at all is never flagged — #1645 names none", () => {
    expect(CARDS.find((c) => c.number === 1645)!.paths).toEqual([]);
    expect(toolingPathReading(cardOf(1645))).toBeNull();
  });
});

/**
 * THE ARMS FOR A PASS'S SEAT BATCHES (#1281).
 *
 * The four readings this cut must never get wrong, each with its own arm and
 * each in the direction that costs something:
 *
 *  1. **a NEXT UP card must never appear in a seat's batch** unless it passes his
 *     independence and area conditions — the sabotage the card names is a queue
 *     whose only takeable card is `founder-ordered`, which must launch ZERO
 *     seats;
 *  2. **two seats must never be handed the same card** — the cut is a partition,
 *     asserted over every batch rather than eyeballed;
 *  3. **a pass must never launch more than MAX_SEATS**, whatever the queue's
 *     size;
 *  4. **a switched-off band must never reach a seat.**
 *
 * Every arm drives the pure functions directly, so nothing here needs GitHub, a
 * database or Jev (working law 3).
 */
import { describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

/* This suite imports `cardBuildState.mts`, which reaches `gh` through
   `execFileSync` — so it is in `childProcessTestTimeouts`' derived population
   and declares the class's timeout (#548). */
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

import {
  areaOfLabel,
  areaOfPath,
  buildAreaIndex,
  citedOpenCards,
  cutSeatBatches,
  dependencyCitations,
  orderedBandForSeats,
  pathsNamedIn,
  readIndependence,
  resolveCardArea,
  seatPopulation,
  type SeatAreaIndex,
  type SeatCandidateCard,
  type SeatTakeableCard,
} from "../scripts/lib/seatBatches.mts";
import { buildBoard, factsFromRows } from "../scripts/lib/cardBuildState.mts";
import type { OpenPullRequest } from "../scripts/lib/cardClaimWarning.mts";

/* ── FIXTURES ──────────────────────────────────────────────────────────────── */

const MODULES = [
  { path: "server/casting/aiService.ts", domain: "casting" },
  { path: "server/casting/queue.ts", domain: "casting" },
  { path: "server/castingV2/roll.ts", domain: "castingV2" },
  { path: "client/src/features/boards/Canvas.tsx", domain: "boards" },
  { path: "client/src/features/boards/store.ts", domain: "boards" },
  { path: "server/routes/billing.ts", domain: "billing" },
  { path: "server/wardrobe/vto.ts", domain: "wardrobe" },
  { path: "client/src/App.tsx", domain: "unassigned" },
];

const INDEX: SeatAreaIndex = buildAreaIndex(MODULES);

const ALL_ON = {
  master: true,
  bugs: true,
  security: true,
  performance: true,
  housekeeping: true,
  process: true,
  smallFixes: true,
  castingUpkeep: true,
};

function card(number: number, labels: string[], extra: Partial<SeatCandidateCard> = {}): SeatCandidateCard {
  return {
    number,
    title: `card ${number}`,
    labels,
    body: "",
    createdAt: `2026-09-0${(number % 9) + 1}T00:00:00Z`,
    ...extra,
  };
}

const NOW = Date.parse("2026-09-26T12:00:00Z");

/**
 * THE BOARD, BUILT BY THE REAL OWNER (#1094), never a hand-written stand-in.
 *
 * ⚠ An object literal with `holdsOffOffer: () => false` would satisfy the type
 * and prove nothing: the interesting half is WHICH states hold a card off, and
 * that lives in `buildStateHoldsOffOffer`. So the arms feed real pull-request
 * rows and real comment facts through `buildBoard` and let it judge.
 */
function boardOf(prs: readonly OpenPullRequest[] = [], rows: readonly unknown[] = []) {
  return buildBoard({ openPullRequests: prs, comments: factsFromRows(rows), nowMs: NOW });
}

const CLEAN_BOARD = boardOf();

/**
 * A comment as GitHub's REST listing gives one — `issue_url` is how
 * `factFromCommentRow` learns which card it is on, so a fixture that invents a
 * shape here would be tested against nothing.
 */
function commentRow(card: number, body: string, at: string) {
  return { issue_url: `https://api.github.com/repos/michaelpaulrattray/Drape/issues/${card}`, body, created_at: at };
}

function population(cards: SeatCandidateCard[], switches = ALL_ON, board = CLEAN_BOARD) {
  return seatPopulation({ cards, switches, board, areaIndex: INDEX });
}

/* ── THE AREA INDEX ────────────────────────────────────────────────────────── */

describe("the area index is the Atlas's own boundary", () => {
  it("never makes `unassigned` an area", () => {
    expect(INDEX.domains).not.toContain("unassigned");
    expect(areaOfPath("client/src/App.tsx", INDEX)).toBeNull();
  });

  it("resolves a path the Atlas has never seen by its longest unanimous parent", () => {
    expect(areaOfPath("server/casting/newFile.ts", INDEX)).toBe("casting");
    expect(areaOfPath("client/src/features/boards/deep/thing.ts", INDEX)).toBe("boards");
  });

  it("answers nothing for a directory whose modules disagree", () => {
    /* `server/` holds casting, castingV2, billing and wardrobe modules, so it is
       not unanimous and must not resolve. A first-match reader would say
       "casting" here, which is the mistake that puts two seats on one area. */
    expect(areaOfPath("server/somethingNew.ts", INDEX)).toBeNull();
  });

  it("reads a domain out of a label only as a whole token", () => {
    expect(areaOfLabel("casting-upkeep", INDEX)).toBe("casting");
    expect(areaOfLabel("seat:janitor", INDEX)).toBeNull();
    expect(areaOfLabel("bug", INDEX)).toBeNull();
    expect(areaOfLabel("small-fix", INDEX)).toBeNull();
  });

  it("finds the paths a body names and ignores prose", () => {
    const found = pathsNamedIn("See `server/casting/queue.ts` and client/src/features/boards/store.ts (line 4).");
    expect(found).toEqual(["server/casting/queue.ts", "client/src/features/boards/store.ts"]);
    expect(pathsNamedIn("the queue.ts file is slow")).toEqual([]);
  });

  it("files a card by the plurality of the files it names, not the first one", () => {
    const subject = card(1, ["bug"], {
      body: "Fix server/casting/queue.ts and server/casting/aiService.ts; the same shape as server/routes/billing.ts.",
    });
    expect(resolveCardArea(subject, INDEX)).toBe("casting");
  });

  it("falls back to the label when the body names no file", () => {
    expect(resolveCardArea(card(2, ["casting-upkeep"]), INDEX)).toBe("casting");
    expect(resolveCardArea(card(3, ["bug"]), INDEX)).toBeNull();
  });
});

/* ── THE SEAT POPULATION ───────────────────────────────────────────────────── */

describe("what a background seat may take", () => {
  it("takes a switched-on card with a work label", () => {
    const { takeable } = population([card(10, ["bug"])]);
    expect(takeable.map((c) => c.number)).toEqual([10]);
  });

  it("NEVER takes a NEXT UP card — the sabotage the card names", () => {
    const { takeable, skipped } = population([card(11, ["bug", "founder-ordered"])]);
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("NEXT UP");
    /* And the whole point of the arm: zero cards means zero seats. */
    expect(cutSeatBatches({ cards: takeable, maxSeats: 4, batchSize: 5 }).seatCount).toBe(0);
  });

  it("never takes a card on a rung, even carrying a switch label", () => {
    const { takeable, skipped } = population([card(12, ["bug", "rung:N2"])]);
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("rung");
  });

  it("never takes a blocked, parked, fable-held or sitting-held card", () => {
    for (const label of ["blocked", "parked", "awaiting-fable", "needs-sitting"]) {
      const { takeable } = population([card(13, ["bug", label])]);
      expect(takeable, `label ${label}`).toEqual([]);
    }
  });

  it("never takes a card whose band switch is off", () => {
    const { takeable, skipped } = population([card(14, ["casting-upkeep"])], { ...ALL_ON, castingUpkeep: false });
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("casting-upkeep switch is off");
  });

  it("takes nothing at all when his master switch is off", () => {
    const { takeable } = population([card(15, ["bug"]), card(16, ["small-fix"])], { ...ALL_ON, master: false });
    expect(takeable).toEqual([]);
  });

  it("never takes a card with an open pull request", () => {
    const { takeable, skipped } = population(
      [card(17, ["bug"])],
      ALL_ON,
      boardOf([{ number: 900, title: "something (#17)" }]),
    );
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("PR #900");
  });

  it("never takes a card claimed in the last twelve hours, and takes one claimed before that", () => {
    const claim = (at: string) => [commentRow(18, `CLAIMED — seat-2, ${at}`, at)];
    const live = population([card(18, ["bug"])], ALL_ON, boardOf([], claim("2026-09-26T09:00:00Z")));
    expect(live.takeable).toEqual([]);
    expect(live.skipped[0]!.why).toContain("claimed by seat-2");

    const stale = population([card(18, ["bug"])], ALL_ON, boardOf([], claim("2026-09-24T09:00:00Z")));
    expect(stale.takeable.map((c) => c.number)).toEqual([18]);
  });

  it("DOES still take a refused card, and carries the refusal into the batch", () => {
    /* ⚠ #1281's body says a refusal is not on offer; `buildStateHoldsOffOffer`
       says a refusal ANNOTATES and is still offered, and the code is the
       artifact (law 7c). The value of this arm is that the annotation travels,
       so a seat reads the refusal instead of rediscovering it. */
    const { takeable } = population(
      [card(19, ["bug"])],
      ALL_ON,
      boardOf([], [commentRow(19, "NOT BUILT — the body is wrong against the code", "2026-09-26T11:00:00Z")]),
    );
    expect(takeable.map((c) => c.number)).toEqual([19]);
    expect(takeable[0]!.annotation).toContain("not built");
  });
});

/* ── THE CUT ───────────────────────────────────────────────────────────────── */

function takeables(spec: ReadonlyArray<[number, string | null]>): SeatTakeableCard[] {
  return spec.map(([number, area]) => ({ ...card(number, ["bug"]), area }));
}

describe("how a pass cuts its batches", () => {
  it("launches min(ceil(cards / batchSize), maxSeats) seats", () => {
    expect(cutSeatBatches({ cards: takeables([[1, "casting"]]), maxSeats: 4, batchSize: 5 }).seatCount).toBe(1);
    expect(cutSeatBatches({
      cards: takeables([[1, "a"], [2, "b"], [3, "c"], [4, "d"], [5, "e"], [6, "f"]]),
      maxSeats: 4,
      batchSize: 5,
    }).seatCount).toBe(2);
  });

  it("NEVER launches more than maxSeats, however long the queue", () => {
    const many = takeables(Array.from({ length: 60 }, (_, i) => [i + 1, `area${i}`] as [number, string]));
    const plan = cutSeatBatches({ cards: many, maxSeats: 4, batchSize: 5 });
    expect(plan.seatCount).toBe(4);
    expect(plan.batches).toHaveLength(4);
  });

  it("is a PARTITION — every card in exactly one batch, and no card twice", () => {
    const cards = takeables([
      [1, "casting"], [2, "casting"], [3, "boards"], [4, "boards"],
      [5, "billing"], [6, null], [7, "wardrobe"], [8, null],
    ]);
    const plan = cutSeatBatches({ cards, maxSeats: 4, batchSize: 3 });
    const handed = plan.batches.flatMap((batch) => batch.cards.map((c) => c.number)).sort((a, b) => a - b);
    expect(handed).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(handed).size).toBe(handed.length);
  });

  it("keeps one area on one seat, so two seats never work the same files", () => {
    const cards = takeables([[1, "casting"], [2, "casting"], [3, "casting"], [4, "boards"], [5, "boards"], [6, "billing"]]);
    const plan = cutSeatBatches({ cards, maxSeats: 3, batchSize: 2 });
    for (const area of ["casting", "boards", "billing"]) {
      const seatsHolding = plan.batches.filter((batch) => batch.cards.some((c) => c.area === area));
      expect(seatsHolding, `area ${area} is split`).toHaveLength(1);
    }
  });

  it("sends a card naming no area to the smallest batch", () => {
    const cards = takeables([[1, "casting"], [2, "casting"], [3, "casting"], [4, "boards"], [9, null]]);
    const plan = cutSeatBatches({ cards, maxSeats: 2, batchSize: 3 });
    const holder = plan.batches.find((batch) => batch.cards.some((c) => c.number === 9))!;
    const other = plan.batches.find((batch) => batch !== holder)!;
    expect(holder.cards.length).toBeLessThanOrEqual(other.cards.length);
  });

  it("cuts the same queue the same way twice", () => {
    const cards = takeables([[3, "boards"], [1, "casting"], [2, "casting"], [4, null], [5, "billing"]]);
    const once = cutSeatBatches({ cards, maxSeats: 3, batchSize: 2 });
    const twice = cutSeatBatches({ cards: [...cards].reverse(), maxSeats: 3, batchSize: 2 });
    expect(JSON.stringify(once.batches)).toBe(JSON.stringify(twice.batches));
  });

  it("NEVER launches an empty seat — the reviewer's own two cases", () => {
    /* Driven on the PR: 6 casting cards, max 4, batch 2 gave seatCount 3 and
       sizes [6, 0, 0]; 8 casting + 2 boards gave [8, 2, 0, 0]. Two Opus sessions
       with nothing to do, every pass. */
    const sixCasting = takeables(Array.from({ length: 6 }, (_, i) => [i + 1, "casting"] as [number, string]));
    const one = cutSeatBatches({ cards: sixCasting, maxSeats: 4, batchSize: 2 });
    expect(one.seatCount).toBe(1);
    expect(one.batches.map((b) => b.cards.length)).toEqual([6]);

    const mixed = takeables([
      ...Array.from({ length: 8 }, (_, i) => [i + 1, "casting"] as [number, string]),
      [20, "boards"], [21, "boards"],
    ]);
    const two = cutSeatBatches({ cards: mixed, maxSeats: 4, batchSize: 2 });
    expect(two.seatCount).toBe(2);
    expect(two.batches.map((b) => b.cards.length).sort((a, b) => b - a)).toEqual([8, 2]);

    /* And the general property, over every shape and every seat count. */
    for (const maxSeats of [1, 2, 3, 4]) {
      for (const batchSize of [1, 2, 5]) {
        const plan = cutSeatBatches({ cards: mixed, maxSeats, batchSize });
        expect(plan.batches.every((b) => b.cards.length > 0), `max ${maxSeats} batch ${batchSize}`).toBe(true);
        expect(plan.seatCount).toBe(plan.batches.length);
        expect(plan.batches.map((b) => b.seat)).toEqual(plan.batches.map((_, i) => i + 1));
      }
    }
  });

  it("counts the cards it HANDED OUT, never the ones it held", () => {
    /* The runner prints this number. It read `total`, which includes an ordered
       card the area rule then held: `cards 3` for a pass that handed 2. */
    const plan = cutSeatBatches({
      cards: takeables([[1, "boards"], [2, "boards"]]),
      ordered: [{ ...card(101, ["founder-ordered"]), area: "boards" }],
      maxSeats: 1,
      batchSize: 5,
    });
    expect(plan.held.map((h) => h.number)).toEqual([101]);
    expect(plan.cardCount).toBe(2);
    expect(plan.cardCount).toBe(plan.batches.reduce((n, b) => n + b.cards.length, 0));
  });

  it("refuses a nonsense seat count rather than inventing one", () => {
    expect(() => cutSeatBatches({ cards: takeables([[1, "a"]]), maxSeats: 0, batchSize: 5 })).toThrow(/positive/);
    expect(() => cutSeatBatches({ cards: takeables([[1, "a"]]), maxSeats: 4, batchSize: 0 })).toThrow(/positive/);
  });
});

/* ── HIS ORDERED BAND ──────────────────────────────────────────────────────── */

describe("the independence reading", () => {
  it("reads a dependency phrase beside an open card as dependent", () => {
    expect(dependencyCitations("This stacks on PR #1325 and lands after it.", [1325], 99)).toEqual([1325]);
    expect(readIndependence({ card: 99, body: "builds on #1325", openCards: [1325] }).kind).toBe("dependent");
  });

  it("reads a bare citation as UNCLEAR rather than as a dependency", () => {
    const reading = readIndependence({ card: 99, body: "The same class as #1325.", openCards: [1325] });
    expect(reading.kind).toBe("unclear");
  });

  it("reads a card that cites nothing open as independent", () => {
    expect(readIndependence({ card: 99, body: "Fixes the loader. See #12 (closed).", openCards: [1325] }).kind)
      .toBe("independent");
    expect(citedOpenCards("see #12", [1325], 99)).toEqual([]);
  });

  it("never reads a card's own number as a dependency on itself", () => {
    expect(readIndependence({ card: 1325, body: "for card #1325", openCards: [1325] }).kind).toBe("independent");
  });

  it("reads the comments too, not only the body", () => {
    const reading = readIndependence({
      card: 99,
      body: "Nothing here.",
      comments: ["This waits on #1325 landing first."],
      openCards: [1325],
    });
    expect(reading.kind).toBe("dependent");
  });
});

describe("his ordered band, split between the lanes", () => {
  const band = (cards: SeatCandidateCard[], independence: (c: SeatCandidateCard) => ReturnType<typeof readIndependence>) =>
    orderedBandForSeats({ cards, board: CLEAN_BOARD, areaIndex: INDEX, switches: ALL_ON, independenceOf: independence });

  const ordered = (number: number, body: string, labels: string[] = []) =>
    card(number, ["founder-ordered", ...labels], { body });

  it("holds the TOP card for the focus shift and never offers it to a seat", () => {
    const result = band(
      [
        ordered(100, "Change server/casting/queue.ts."),
        ordered(101, "Change client/src/features/boards/Canvas.tsx."),
      ],
      () => ({ kind: "independent" }),
    );
    expect(result.focus!.number).toBe(100);
    expect(result.offered.map((c) => c.number)).toEqual([101]);
    expect(result.held.some((h) => h.number === 100 && h.why.includes("top of NEXT UP"))).toBe(true);
  });

  it("puts urgent first, so the focus card is the one his order names", () => {
    const result = band(
      [
        ordered(100, "Change server/casting/queue.ts."),
        ordered(101, "Change client/src/features/boards/Canvas.tsx.", ["urgent"]),
      ],
      () => ({ kind: "independent" }),
    );
    expect(result.focus!.number).toBe(101);
  });

  it("never offers a DEPENDENT ordered card", () => {
    const result = band(
      [
        ordered(100, "Change server/casting/queue.ts."),
        ordered(101, "Builds on #100. Change client/src/features/boards/Canvas.tsx."),
      ],
      (c) => (c.number === 101 ? { kind: "dependent", on: [100] } : { kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("builds on #100");
  });

  it("never offers an ordered card whose independence is UNCLEAR", () => {
    const result = band(
      [ordered(100, "server/casting/queue.ts"), ordered(101, "client/src/features/boards/Canvas.tsx")],
      (c) => (c.number === 101 ? { kind: "unclear", cites: [42] } : { kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("nothing says whether");
  });

  it("never offers an ordered card in the focus card's own area", () => {
    const result = band(
      [ordered(100, "Change server/casting/queue.ts."), ordered(101, "Change server/casting/aiService.ts too.")],
      () => ({ kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("same area");
  });

  it("offers NOTHING when the FOCUS card's own area is unknown", () => {
    /* The reviewer drove this: focus arealess, candidate casting, and it was
       offered — while the file's own reason argued the other way. */
    const result = band(
      [ordered(100, "Make the studio nicer."), ordered(101, "Change server/casting/queue.ts.")],
      () => ({ kind: "independent" }),
    );
    expect(result.focus!.area).toBeNull();
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("names no area");
  });

  it("never offers an ordered card whose area is unknown", () => {
    const result = band(
      [ordered(100, "Change server/casting/queue.ts."), ordered(101, "Make it nicer.")],
      () => ({ kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("no area named");
  });

  it("never offers an ordered card on a rung", () => {
    const result = band(
      [ordered(100, "server/casting/queue.ts"), ordered(101, "client/src/features/boards/Canvas.tsx", ["rung:N3"])],
      () => ({ kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
  });

  it("HIS MASTER SWITCH STOPS THE ORDERED LANE TOO, and an unreadable {} stops it", () => {
    for (const switches of [{ ...ALL_ON, master: false }, {}]) {
      const result = orderedBandForSeats({
        cards: [ordered(100, "server/casting/queue.ts"), ordered(101, "client/src/features/boards/Canvas.tsx")],
        board: CLEAN_BOARD,
        areaIndex: INDEX,
        switches,
        independenceOf: () => ({ kind: "independent" }),
      });
      expect(result.focus, JSON.stringify(switches)).toBeNull();
      expect(result.offered, JSON.stringify(switches)).toEqual([]);
      expect(result.held.map((h) => h.number).sort()).toEqual([100, 101]);
      expect(result.held[0]!.why).toContain("switch is off");
    }
  });

  it("names no focus card when every ordered card is held", () => {
    const result = band([ordered(100, "x", ["blocked"])], () => ({ kind: "independent" }));
    expect(result.focus).toBeNull();
    expect(result.offered).toEqual([]);
  });

  it("places an offered ordered card in a batch that holds no card of its area", () => {
    const backgroundCards = takeables([[1, "casting"], [2, "casting"], [3, "wardrobe"]]);
    const plan = cutSeatBatches({
      cards: backgroundCards,
      ordered: [{ ...ordered(101, "client/src/features/boards/Canvas.tsx"), area: "boards" }],
      maxSeats: 2,
      batchSize: 2,
    });
    const holder = plan.batches.find((b) => b.cards.some((c) => c.number === 101))!;
    expect(holder).toBeDefined();
    expect(holder.cards.filter((c) => c.area === "boards")).toHaveLength(1);
    expect(plan.held).toEqual([]);
  });

  it("HOLDS an offered ordered card when every seat already works its area", () => {
    const plan = cutSeatBatches({
      cards: takeables([[1, "boards"], [2, "boards"]]),
      ordered: [{ ...ordered(101, "client/src/features/boards/Canvas.tsx"), area: "boards" }],
      maxSeats: 1,
      batchSize: 5,
    });
    expect(plan.batches[0]!.cards.map((c) => c.number)).toEqual([1, 2]);
    expect(plan.held.map((h) => h.number)).toEqual([101]);
  });
});

/* ── THE FILE ITSELF ───────────────────────────────────────────────────────── */

describe("the cut derives rather than mirrors", () => {
  const source = readFileSync("scripts/lib/seatBatches.mts", "utf8");

  it("CALLS every takeability rule's owner — an import is not a call site", () => {
    /* The first shape of this arm searched for the NAME, which an import line
       satisfies on its own: a symbol could be imported and never used and the
       arm stayed green (review of 2026-09-26). Each pattern is the use itself. */
    const checks: ReadonlyArray<readonly [string, RegExp]> = [
      ["homeWorkCategoryFor", /homeWorkCategoryFor\(card\.labels\)/],
      ["backgroundWorkAllowed", /backgroundWorkAllowed\(input\.switches, category\)/],
      ["exclusionFor", /exclusionFor\(card\.labels\)/],
      ["the build board", /input\.board\.holdsOffOffer\(/],
      ["RUNG_LABEL_PREFIX", /startsWith\(RUNG_LABEL_PREFIX\)/],
      ["sortOrderedBand", /sortOrderedBand\(band\)/],
      ["heldStateFromLabels", /heldStateFromLabels\(card\.labels\)/],
      ["CREW_HOLD_WORD", /CREW_HOLD_WORD\[hold\]/],
      ["the master switch", /input\.switches\[CREW_WORK_MASTER_KEY\]/],
    ];
    for (const [owner, call] of checks) {
      expect(call.test(source), `${owner} must be CALLED here, not merely imported`).toBe(true);
    }
  });

  it("names no work label, hold label or domain of its own — IN EVERY FILE OF THE FEATURE", () => {
    /* ⚠ The first shape read the LIBRARY only, and the CLI carried
       `const ORDERED_LABEL = "founder-ordered"` the whole time (review of
       2026-09-26). An arm that reads one file of a feature is an arm about that
       file, not about the rule. Comments are stripped: these labels are
       discussed in prose on purpose, and a rule about CODE must not become a
       rule about documentation. */
    const files = [
      "scripts/lib/seatBatches.mts",
      "scripts/cut-seat-batches.mts",
      "scripts/lib/seatPassDigest.mts",
      "scripts/seat-pass-digest.mts",
      "scripts/lib/jevSeatBatching.mts",
    ];
    const literals = ['"bug"', '"small-fix"', '"casting-upkeep"', '"founder-ordered"', '"blocked"', '"awaiting-fable"', '"parked"', '"casting"', '"boards"'];
    for (const file of files) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        /* A LOOKUP BY KEY into the shared vocabulary is a derivation, not a typed
           label: `QUEUE_EXCLUSION_REASONS.find((r) => r.key === "parked")` reads
           the label OUT of the owner, and `parked` being both the key and the
           label is a coincidence of that vocabulary. The label itself is never
           written; only the identifier used to look it up is. */
        .replace(/\.key === "[a-zA-Z]+"/g, "");
      for (const literal of literals) {
        expect(code.includes(literal), `${file} names ${literal}; it must come from the shared vocabulary`).toBe(false);
      }
    }
  });
});

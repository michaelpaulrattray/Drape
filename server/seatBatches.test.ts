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
  focusRungFromLadder,
  managerIndependence,
  managerPairVerdict,
  orderedBandForSeats,
  pairDisjointOnPaths,
  pathsNamedIn,
  readIndependence,
  resolveCardArea,
  seatPopulation,
  touchedRegions,
  type SeatAreaIndex,
  type SeatCandidateCard,
  type SeatManagerFacts,
  type SeatTakeableCard,
} from "../scripts/lib/seatBatches.mts";
import type { ManagerCardRow } from "../scripts/lib/managerFactSheet.mts";
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
function boardOf(
  prs: readonly OpenPullRequest[] = [],
  rows: readonly unknown[] = [],
  notBuilt?: ReadonlySet<number>,
) {
  return buildBoard({
    openPullRequests: prs,
    comments: factsFromRows(rows),
    /* Read and clean — explicit, because `buildBoard` REQUIRES it (#1337): an
       omitted argument is how a caller silently loses an annotation. */
    notBuilt: notBuilt ?? new Set<number>(),
    nowMs: NOW,
  });
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

/**
 * ⚠ `focusRung` DEFAULTS TO `null` HERE, AND THAT IS THE STRICT SETTING (#1496).
 *
 * With no focus named, every rung card is held — so an existing arm that
 * happened to carry a `rung:` label keeps the behaviour it was written against,
 * and a NEW arm about the narrower rule has to name the focus rung on purpose.
 * The alternative (defaulting to the focus's rung) would have quietly relaxed
 * arms nobody re-read.
 */
function population(
  cards: SeatCandidateCard[],
  switches = ALL_ON,
  board = CLEAN_BOARD,
  focusRung: string | null = null,
) {
  return seatPopulation({ cards, switches, board, areaIndex: INDEX, focusRung });
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

  /* ── THE SECOND READER, FOR THE PAIRS THE ATLAS CANNOT PLACE (#1547) ─────── */

  it("reads a named FILE as its parent directory and a named DIRECTORY as itself", () => {
    /* The whole point of the grain: two different files in one directory must
       come back as ONE region, or the pair reads as disjoint on a coincidence of
       spelling. */
    expect(touchedRegions("Change scripts/crew-desk-sweep.mts and scripts/crew-shift-close.mts.")).toEqual(["scripts"]);
    expect(touchedRegions("Rework client/src/features/wardrobe/ end to end.")).toEqual(["client/src/features/wardrobe"]);
    expect(touchedRegions("See server/crew/crew-briefing.json.")).toEqual(["server/crew"]);
    expect(touchedRegions("no paths here at all")).toEqual([]);
    expect(touchedRegions(null)).toEqual([]);
  });

  it("calls two path sets disjoint only when neither contains the other", () => {
    const at = (body: string) => ({ body });
    expect(pairDisjointOnPaths({ number: 1, body: "server/crew/x.ts" }, at("client/src/pages/Y.tsx")).disjoint).toBe(true);
    /* Same directory, different files. */
    expect(pairDisjointOnPaths({ number: 1, body: "server/crew/x.ts" }, at("server/crew/y.ts")).disjoint).toBe(false);
    /* Nested, so neither region is equal to the other. */
    expect(pairDisjointOnPaths({ number: 1, body: "scripts/lib/" }, at("scripts/lib/seatBatches.mts")).disjoint).toBe(false);
    /* Siblings under one root are NOT a collision — `server/` is the whole
       backend and holding on it would hold everything. */
    expect(pairDisjointOnPaths({ number: 1, body: "server/crew/x.ts" }, at("server/routes/y.ts")).disjoint).toBe(true);
  });

  it("⚠ FAILS CLOSED ON SILENCE — no path named is never a proof of anything", () => {
    /* The direction that matters: the gate may only turn *unknown* into
       *offered* where there is something positive to read. */
    const quiet = pairDisjointOnPaths({ number: 1, body: "nothing at all" }, { body: "server/crew/x.ts" });
    expect(quiet.disjoint).toBe(false);
    expect(quiet.why).toContain("names no area and no files");
    expect(pairDisjointOnPaths({ number: 1, body: "server/crew/x.ts" }, { body: "" }).disjoint).toBe(false);
    expect(pairDisjointOnPaths({ number: 1, body: "" }, { body: "" }).disjoint).toBe(false);
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

  /*
    ⚠ THIS ARM USED TO READ "never takes a card on a rung" AND THAT RULE IS GONE
    (#1496). What it proves now is the strict END of the narrower rule: with no
    focus named, a rung card is still held. The rest of the rule has its own
    block below.
  */
  it("holds a rung card when nothing names the current focus", () => {
    const { takeable, skipped } = population([card(12, ["casting-upkeep", "rung:N2"])]);
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("nothing names the current focus");
  });

  /*
    ── THE MILESTONE GATE ON THE SEAT LANE (#1496) ──────────────────────────

    His word was *"file it urgently we need to increase through put"*, and the
    measured cost of the old blanket rule was six consecutive passes at
    seatCount 1, 0, 1, 1, 0, 1 with thirteen rung cards held.

    ⚠ EVERY ARM HERE HAS ITS OPPOSITE BESIDE IT, because the two ways to get
    this wrong are a throughput fix that frees nothing and a throughput fix that
    lets a seat start N3 tonight. The first is invisible; the second breaks THE
    MILESTONE GATE, which is his law.

    ⚠ AND THEY ARE DRIVEN THROUGH `seatPopulation`, NOT ONLY THROUGH
    `orderedBandForSeats` — that is the whole finding of this card. The ordered
    gate filters on `founder-ordered` before it looks at anything, so eleven of
    the thirteen cards #1496 listed never reach it. An arm that only drove the
    ordered lane would pass while the real population stayed shut.

    ⚠ **EVERY ARM IN THIS BLOCK CARRIED `bug` UNTIL #1553 AND NOW CARRIES
    `casting-upkeep`, WHICH IS NOT COSMETIC.** #1553 makes a rung label on a
    `bug` or `small-fix` card a LOCATOR rather than a hold, so a `bug` carrier
    would make all six of these arms green through the EXEMPTION while proving
    nothing at all about the gate — the worst shape a guard can take. The
    carrier is a real work label that is deliberately outside
    `CREW_FIX_CATEGORY_KEYS`, so these arms still say what they were written to
    say. The exemption has its own block below, with the mislabelling case
    beside it.
  */
  it("TAKES a rung card that sits on the focus card's own rung — the throughput this card is for", () => {
    const { takeable, skipped } = population(
      [card(12, ["casting-upkeep", "rung:N2"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable.map((c) => c.number)).toEqual([12]);
    expect(skipped).toEqual([]);
  });

  it("HOLDS a card on a LATER rung while the focus is on N2 — the milestone gate", () => {
    const { takeable, skipped } = population(
      [card(12, ["casting-upkeep", "rung:N3"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("milestone gate");
  });

  /* Both in one population, so the arm proves the gate SEPARATES them rather
     than that it happens to answer each one alone. */
  it("separates them in one reading: N2 offered, N2b and N3 held, focus on N2", () => {
    const { takeable, skipped } = population(
      [
        card(12, ["casting-upkeep", "rung:N2"]),
        card(13, ["casting-upkeep", "rung:N2b"]),
        card(14, ["casting-upkeep", "rung:N3"]),
      ],
      ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable.map((c) => c.number)).toEqual([12]);
    expect(skipped.map((c) => c.number).sort()).toEqual([13, 14]);
  });

  /* `rung:N2b` is not `rung:N2` — a prefix test would call it a match and open
     the next rung on his ladder, which is precisely what he asked about
     ("they wont start n3 automatically though right"). */
  it("does not treat N2b as N2 — the comparison is the whole label, not a prefix", () => {
    const { takeable } = population(
      [card(12, ["casting-upkeep", "rung:N2b"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable).toEqual([]);
  });

  it("holds a card carrying TWO rungs even when one of them is the focus rung", () => {
    const { takeable, skipped } = population(
      [card(12, ["casting-upkeep", "rung:N2", "rung:N3"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("milestone gate");
  });

  /*
    ── A RUNG LABEL ON A FIX IS A LOCATOR, NOT A HOLD (#1553) ───────────────

    Three fixes he had asked for sat unbuildable under the milestone gate in one
    pass — a server claiming to report crashes that reported none, a live door
    calling a dead model, a crash report nobody could read — because somebody
    had helpfully written down whose territory each lived in.

    ⚠ EVERY ARM HAS ITS OPPOSITE, as the block above does, and the opposite here
    is the one that matters: a FEATURE card must not slip into a seat by wearing
    a fix's label.
  */
  it("TAKES a bug on a rung that is NOT the focus — the class this card is for", () => {
    const { takeable, skipped } = population(
      [card(12, ["bug", "rung:N3"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable.map((c) => c.number)).toEqual([12]);
    expect(skipped).toEqual([]);
  });

  it("HOLDS a feature-shaped card on that same rung, in the same reading", () => {
    /*
      The card's own named opposite. `design-unbuilt` carries no work label, so
      this is held BEFORE the rung gate is even asked — which is the honest
      finding and is why the assertion reads the sentence rather than assuming
      which gate stopped it. Either way the seat never sees it.
    */
    const { takeable, skipped } = population(
      [card(13, ["design-unbuilt", "rung:N3"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("no switch label");
  });

  it("separates a bug from a casting card on ONE later rung, in one reading", () => {
    /*
      Both in one population, so the arm proves the gate SEPARATES them rather
      than that it happens to answer each alone — the same discipline the
      milestone block above uses.
    */
    const { takeable, skipped } = population(
      [card(12, ["bug", "rung:N3"]), card(13, ["casting-upkeep", "rung:N3"]), card(14, ["small-fix", "rung:N8"])],
      ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable.map((c) => c.number).sort()).toEqual([12, 14]);
    expect(skipped.map((c) => c.number)).toEqual([13]);
    expect(skipped[0]!.why).toContain("milestone gate");
  });

  it("TAKES a fix on a rung when NOTHING names the focus — maintenance mode is the whole point", () => {
    /*
      ⚠ The arm that pins WHERE the exemption sits. Asked after the no-focus
      branch instead of before it, a fix would still be frozen on exactly the
      nights `PROGRAM.md`'s MAINTENANCE MODE says it must run — and every arm
      above would still be green, because they all name a focus.
    */
    const { takeable, skipped } = population([card(12, ["bug", "rung:N6"]), card(13, ["small-fix", "rung:N8"])]);
    expect(takeable.map((c) => c.number).sort()).toEqual([12, 13]);
    expect(skipped).toEqual([]);
  });

  it("reads the card's ONE home category, so a bug filed under casting upkeep is still a bug", () => {
    /*
      His one-work-label rule makes this rare rather than impossible, and
      `homeWorkCategoryFor`'s precedence already answers it: a bug is a bug
      wherever else it lives. Pinned here because the alternative — asking
      whether ANY label is a fix label — would let `design-unbuilt` + `bug`
      through on the same reasoning, and the two shapes look identical.
    */
    const { takeable } = population(
      [card(12, ["bug", "casting-upkeep", "rung:N3"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable.map((c) => c.number)).toEqual([12]);
  });

  /* A card with no rung at all is untouched by any of this. */
  it("leaves a card with no rung label exactly where it was", () => {
    const { takeable } = population(
      [card(12, ["bug"])], ALL_ON, CLEAN_BOARD, "N2",
    );
    expect(takeable.map((c) => c.number)).toEqual([12]);
  });

  it("never takes a blocked, parked, fable-held or sitting-held card", () => {
    for (const label of ["blocked", "parked", "awaiting-fable", "needs-sitting"]) {
      const { takeable } = population([card(13, ["bug", label])]);
      expect(takeable, `label ${label}`).toEqual([]);
    }
  });

  it("⚠ #1548 — NEVER takes his research team's proposal, by name rather than by a missing category", () => {
    /*
      A `research` card carries no work label today (#1465 and #1535, measured),
      so this lane already held it — for want of a category, which is an ACCIDENT
      and not a rule. Add `bug` to one and `homeWorkCategoryFor` answers `bugs`:
      the card enters a switch's offered population and a seat builds his research
      team's proposal as tonight's work. The exclusion vocabulary's `research` row
      is what holds it, and the skip sentence is that row's own word.
    */
    const { takeable, skipped } = population([card(15, ["research", "bug"])]);
    expect(takeable).toEqual([]);
    expect(skipped[0]!.why).toContain("research");
    /* ⚠ POSITIVE CONTROL — the same card WITHOUT the label is taken, so the arm
       measures the label and not a `seatPopulation` that has stopped offering
       anything. */
    expect(population([card(15, ["bug"])]).takeable.map((c) => c.number)).toEqual([15]);
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
  /* `focusRung` defaults to `null` for `population`'s stated reason (#1496): with
     no milestone every rung card is held, so an arm that happened to carry a
     `rung:` label keeps the behaviour it was written against, and an arm about
     the narrower rule names the milestone on purpose. Since #1541 it is an INPUT
     rather than read off the band's own top card. */
  const band = (
    cards: SeatCandidateCard[],
    independence: (c: SeatCandidateCard) => ReturnType<typeof readIndependence>,
    focusRung: string | null = null,
  ) =>
    orderedBandForSeats({ cards, board: CLEAN_BOARD, areaIndex: INDEX, switches: ALL_ON, independenceOf: independence, focusRung });

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

  it("⚠ #1548 — a research proposal is held in THIS lane too, and this is the lane that had no arm", () => {
    /*
      `seatPopulation` asks the exclusion vocabulary about every background card,
      and `research` is its first row. This band does not: it filters on
      `founder-ordered` and then asks only about parking, holds and the build
      board — so a proposal carrying `research` + `founder-ordered` would have
      been offered to a seat as tonight's work, and as the FOCUS card if it sorted
      to the top.

      It should never exist — the relay's scope note on #1548 says an approved
      proposal is filed WITHOUT the label, as ordinary work opening *"Approved by
      Michael on the Notion desk"* — which is exactly why the arm is here rather
      than left to the rule. Two roads into a seat must give one answer about one
      label, and the road with no such card today is the road nobody notices is
      missing it.
    */
    const result = band(
      [
        ordered(100, "Change server/casting/queue.ts.", ["research"]),
        ordered(101, "Change client/src/features/boards/Canvas.tsx."),
      ],
      () => ({ kind: "independent" }),
    );
    /* Not the focus, not offered, and the sentence names the Notion desk. */
    expect(result.focus!.number).toBe(101);
    expect(result.offered.map((c) => c.number)).toEqual([]);
    expect(result.held.some((h) => h.number === 100 && h.why.includes("Notion desk"))).toBe(true);
    /* ⚠ POSITIVE CONTROL — without the label card 100 IS the focus, so the arm
       above measures the label rather than a band that has stopped offering. */
    const control = band(
      [
        ordered(100, "Change server/casting/queue.ts."),
        ordered(101, "Change client/src/features/boards/Canvas.tsx."),
      ],
      () => ({ kind: "independent" }),
    );
    expect(control.focus!.number).toBe(100);
    expect(control.offered.map((c) => c.number)).toEqual([101]);
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

  it("offers NOTHING when the FOCUS card names neither an area nor a file", () => {
    /*
      The reviewer drove this: focus arealess, candidate casting, and it was
      offered — while the file's own reason argued the other way.

      ⚠ **SINCE #1547 THE FOCUS CARD'S BODY IS WHAT MAKES THIS HOLD, NOT ONLY ITS
      AREA.** *"Make the studio nicer."* names no path, so there is nothing
      positive to read on either reader and the gate fails closed exactly as it
      did. A focus card that DOES name files is the next arm but one, and it is
      the case that used to be held here for the wrong reason.
    */
    const result = band(
      [ordered(100, "Make the studio nicer."), ordered(101, "Change server/casting/queue.ts.")],
      () => ({ kind: "independent" }),
    );
    expect(result.focus!.area).toBeNull();
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("names no area and no files");
  });

  it("never offers an ordered card that names neither an area nor a file", () => {
    /* The candidate's side of the same fail-closed rule: the focus card here
       names a real path, so the silence being punished is the candidate's. */
    const result = band(
      [ordered(100, "Change server/casting/queue.ts."), ordered(101, "Make it nicer.")],
      () => ({ kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("names no area and no files");
  });

  /*
    ⚠ WHEN THE ATLAS CANNOT PLACE ONE OF THE PAIR, THE FILES ARE READ INSTEAD (#1547).

    The gate's two `null`-area holds were sound about what an AREA can prove and
    wrong to be the last word: one rungless tooling card on top of his band held
    every candidate behind it and cut `seatCount 0` with four seats idle. These
    arms fix the conversion in both directions — a proof offers, and silence
    still holds.
  */
  describe("the pair is judged on its files where the Atlas places neither", () => {
    it("OFFERS a candidate whose files are provably clear of an arealess focus card", () => {
      /* Neither path is in `MODULES`, so both areas are null and only the files
         can answer. `scripts/` and `docs/` are roots the Atlas maps NOTHING
         under, which is the live shape of this defect. */
      const result = band(
        [ordered(100, "Rewrite scripts/crew-desk-sweep.mts."), ordered(101, "Rewrite docs/specs/DECISION_LOG.md.")],
        () => ({ kind: "independent" }),
      );
      expect(result.focus!.area, "the focus card is genuinely unplaced").toBeNull();
      expect(result.offered.map((c) => c.number)).toEqual([101]);
      expect(result.offered[0]!.area, "and it is offered WITHOUT inventing an area for it").toBeNull();
    });

    it("HOLDS two arealess cards that share a directory, naming the directory", () => {
      const result = band(
        [ordered(100, "Rewrite scripts/crew-desk-sweep.mts."), ordered(101, "Also touch scripts/crew-shift-close.mts.")],
        () => ({ kind: "independent" }),
      );
      expect(result.offered).toEqual([]);
      expect(result.held.find((h) => h.number === 101)!.why).toContain("shares scripts");
    });

    it("HOLDS a candidate nested INSIDE the focus card's named directory", () => {
      /* Neither region equals the other, and one contains the other — the case a
         bare filename comparison would have called disjoint. */
      const result = band(
        [ordered(100, "Rework scripts/lib/ end to end."), ordered(101, "Change scripts/lib/seatBatches.mts.")],
        () => ({ kind: "independent" }),
      );
      expect(result.offered).toEqual([]);
      expect(result.held.find((h) => h.number === 101)!.why).toContain("shares");
    });

    it("OFFERS when only the FOCUS card is unplaced and the candidate has a real area", () => {
      const result = band(
        [ordered(100, "Rewrite scripts/crew-desk-sweep.mts."), ordered(101, "Change server/casting/queue.ts.")],
        () => ({ kind: "independent" }),
      );
      expect(result.focus!.area).toBeNull();
      expect(result.offered.map((c) => c.number)).toEqual([101]);
      expect(result.offered[0]!.area, "the candidate keeps the area the Atlas gave it").toBe("casting");
    });

    it("⚠ A KNOWN AREA IS STILL THE FIRST READER — the file proof never overrides it", () => {
      /*
        THE REGRESSION THIS GUARDS, and the fixture is a real discriminator
        rather than an illustration: the two cards are in the SAME area and their
        FILES are disjoint, so the two readers disagree and only the ordering
        decides. #101 takes its area from its `casting-upkeep` LABEL (its body
        names a `scripts/` path the Atlas cannot place), so its region is
        `scripts` against the focus card's `server/casting`.

        Consult the files first and this pair is offered. An area is the coarser,
        safer reading and must win wherever it exists — getting this backwards
        would widen the gate everywhere, not only here.
      */
      const focusCard = { number: 100, title: "", labels: [], body: "Change server/casting/queue.ts." };
      const candidate = { number: 101, title: "", labels: ["casting-upkeep"], body: "Change scripts/castingHelper.mts." };
      expect(resolveCardArea(focusCard, INDEX)).toBe("casting");
      expect(resolveCardArea(candidate, INDEX), "same area, by label").toBe("casting");
      expect(pairDisjointOnPaths(focusCard, candidate).disjoint, "and their files ARE disjoint").toBe(true);

      const result = band(
        [ordered(100, "Change server/casting/queue.ts."), card(101, ["founder-ordered", "casting-upkeep"], { body: candidate.body })],
        () => ({ kind: "independent" }),
      );
      expect(result.offered, "a placed pair is judged on its areas, never on its files").toEqual([]);
      expect(result.held.find((h) => h.number === 101)!.why).toContain("same area");
    });

    it("tonight's exact shape, driven against the REAL Atlas — #1467 on top, #1545 behind it", () => {
      /*
        The card's own done-when. `#1467` names one path, `server/crew/crew-briefing.json`,
        and `#1545` names `client/src/features/lobby/LibraryView.tsx` — their real
        bodies' paths, read off the live cards on 2026-09-30.

        ⚠ **THE PREMISE IS ASSERTED RATHER THAN ASSUMED**, so a change in the
        Atlas reads as a change in the premise and not as this repair breaking:
        `server/crew` has five modules and the Atlas files EVERY one of them
        `unassigned`, which is why `#1467` is unplaced. It is not a `scripts/`
        card — the cheaper *declare a crew-tooling area* repair #1547 floats
        would not have reached tonight's case at all.
      */
      const realIndex = buildAreaIndex(
        (JSON.parse(readFileSync("docs/architecture/drape-architecture.json", "utf8")) as {
          modules?: readonly { path?: string | null; domain?: string | null }[];
        }).modules ?? [],
      );
      expect(areaOfPath("server/crew/crew-briefing.json", realIndex), "the premise: the Atlas cannot place the crew desk").toBeNull();

      const result = orderedBandForSeats({
        cards: [
          card(1467, ["founder-ordered", "seat:retro"], {
            body: "The desk is hand-written into server/crew/crew-briefing.json.",
            createdAt: "2026-09-29T00:00:00Z",
          }),
          card(1545, ["founder-ordered", "casting-upkeep"], {
            body: "It reads /library — client/src/features/lobby/LibraryView.tsx.",
            createdAt: "2026-09-30T00:00:00Z",
          }),
        ],
        board: CLEAN_BOARD,
        areaIndex: realIndex,
        switches: ALL_ON,
        independenceOf: () => ({ kind: "independent" }),
        focusRung: "N2",
      });
      expect(result.focus!.number, "the rungless tooling card is still the focus shift's").toBe(1467);
      expect(result.focus!.area).toBeNull();
      expect(result.offered.map((c) => c.number), "and the seat lane is no longer empty behind it").toEqual([1545]);
    });
  });

  /*
    ⚠ THE ORDERED LANE ASKS THE SAME QUESTION, AND ITS FOCUS RUNG COMES FROM THE
    TOP CARD ITSELF (#1496) — not from a constant, so moving the focus moves the
    seats with it and nothing here is edited.
  */
  it("holds an ordered card on a LATER rung than the focus card's", () => {
    const result = band(
      [
        ordered(100, "server/casting/queue.ts", ["rung:N2"]),
        ordered(101, "client/src/features/boards/Canvas.tsx", ["rung:N3"]),
      ],
      () => ({ kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("milestone gate");
  });

  it("OFFERS an ordered card sitting on the MILESTONE's rung", () => {
    /* ⚠ The milestone is named here since #1541. It used to be read off the top
       card's own label, so this arm passed without ever saying which rung it
       meant — and the same silence is what let a rungless top card hold the whole
       backlog. The rung is now stated, which is the point. */
    const result = band(
      [
        ordered(100, "server/casting/queue.ts", ["rung:N2"]),
        ordered(101, "client/src/features/boards/Canvas.tsx", ["rung:N2"]),
      ],
      () => ({ kind: "independent" }),
      "N2",
    );
    expect(result.offered.map((c) => c.number)).toEqual([101]);
  });

  /* The focus card itself carrying no rung is the unreadable case, and it holds
     everything rather than freeing everything. */
  it("holds every rung card when the focus card names no rung", () => {
    const result = band(
      [ordered(100, "server/casting/queue.ts"), ordered(101, "client/src/features/boards/Canvas.tsx", ["rung:N3"])],
      () => ({ kind: "independent" }),
    );
    expect(result.offered).toEqual([]);
    expect(result.held.find((h) => h.number === 101)!.why).toContain("nothing names the current focus");
  });

  it("HIS MASTER SWITCH STOPS THE ORDERED LANE TOO, and an unreadable {} stops it", () => {
    for (const switches of [{ ...ALL_ON, master: false }, {}]) {
      const result = orderedBandForSeats({
        cards: [ordered(100, "server/casting/queue.ts"), ordered(101, "client/src/features/boards/Canvas.tsx")],
        board: CLEAN_BOARD,
        areaIndex: INDEX,
        switches,
        independenceOf: () => ({ kind: "independent" }),
        focusRung: "N2",
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

/* ── THE MILESTONE (#1541) ─────────────────────────────────────────────────── */

describe("the milestone comes from the ladder he declared, not the top of his band", () => {
  /*
    ⚠ THE DEFECT THESE ARMS ARE ABOUT HAD TWO FACES AND BOTH ARE DRIVEN BELOW,
    each from a real pass on disk rather than from an invented shape:

     - `seat-plan-20260930-100621.json` — a RUNGLESS ordered card on top (#1467,
       then #1541 itself) made the milestone read `null`, and NINE rung cards were
       held. #1496's two-seat throughput lasted one pass.
     - `runner-pass-20260930-064523.md` — #509 (`rung:N6`) on top made every N2
       card read as *"a later rung (N2) than the focus (N6)"*. N2 is not later
       than N6, and the whole real milestone was held for an evening.

    Neither face is about a missing label. The top of his band is whatever he
    asked for most recently; the ladder's `current` is what says which milestone
    is open.
  */

  it("reads the rung marked `current`", () => {
    expect(focusRungFromLadder([
      { key: "N1", state: "done" },
      { key: "N2", state: "current" },
      { key: "N3", state: "queued" },
    ])).toBe("N2");
  });

  it("⚠ FAILS CLOSED — and each `null` is its own arm, because one of them used to be the whole bug", () => {
    /* No milestone declared: THE MILESTONE GATE clears the focus at every
       boundary, so this is legitimate and must hold every rung card. */
    expect(focusRungFromLadder([{ key: "N1", state: "done" }, { key: "N2", state: "queued" }])).toBeNull();
    /* Two is an incoherent ladder, not a choice between them. The briefing schema
       refuses that edition; this is the belt to that braces. */
    expect(focusRungFromLadder([{ key: "N2", state: "current" }, { key: "N3", state: "current" }])).toBeNull();
    /* An unreadable or absent ladder — the CLI's catch hands `null` through. */
    expect(focusRungFromLadder(null)).toBeNull();
    expect(focusRungFromLadder(undefined)).toBeNull();
    expect(focusRungFromLadder([])).toBeNull();
    /* A `current` entry with no usable key is not a milestone either. */
    expect(focusRungFromLadder([{ state: "current" }])).toBeNull();
    expect(focusRungFromLadder([{ key: "", state: "current" }])).toBeNull();
    expect(focusRungFromLadder([{ key: 2, state: "current" }])).toBeNull();
  });

  it("THE REAL BRIEFING NAMES ONE CURRENT RUNG, and it is the milestone his page draws", () => {
    /*
      ⚠ THE POSITIVE CONTROL OVER THE ARTIFACT, not over a fixture. Every arm
      above would stay green against a briefing that declared nothing, which is
      the state this whole card is about — so one arm reads the file the CLI
      reads. It also pins the schema's `at most one` refinement to something real.
    */
    const briefing = JSON.parse(readFileSync("server/crew/crew-briefing.json", "utf8")) as {
      program: { ladder: readonly { readonly key: string; readonly state: string }[] };
    };
    const ladder = briefing.program.ladder;
    expect(ladder.length, "the ladder must not be empty or the seat lane has no milestone").toBeGreaterThan(0);
    expect(ladder.filter((rung) => rung.state === "current").length, "exactly one current rung").toBe(1);
    /* ⚠ THIS PIN MOVES ONLY ON HIS WORD, and the rite refuses an edition that
       flips the ladder without it — which is the guard doing its job. N2 → P1
       on 2026-10-01: *"after n2 is wrapped up start the pricing/money work then
       proceed onto n2b and n2c"* (terminal), after his Desk word *"close"* on
       #1218, the last N2 card. The next flip is P1 → N2b, on P1's completion
       card and his word. */
    expect(focusRungFromLadder(ladder)).toBe("P1");
  });

  describe("tonight's two measured shapes, driven through the ordered gate", () => {
    const band = (cards: SeatCandidateCard[], focusRung: string | null) =>
      orderedBandForSeats({
        cards,
        board: CLEAN_BOARD,
        areaIndex: INDEX,
        switches: ALL_ON,
        independenceOf: () => ({ kind: "independent" }),
        focusRung,
      });
    /*
      #1467 and #1541 are `seat:retro` tooling cards carrying no rung — the exact
      fixture the card asks for. #1539 is the N2 card that was held behind them.

      Two things are explicit rather than inherited from `card()`, because both
      decide what the arm measures: **`createdAt`**, since the band sorts oldest
      first and the whole question is which card sits ON TOP; and **a body path
      out of `MODULES`**, since the area gate holds any card whose area — or the
      focus card's — cannot be resolved, which would make every arm below pass
      for the wrong reason. The paths are the fixture's area vocabulary, not the
      real cards' files.
    */
    const TOP = "2026-09-01T00:00:00Z";
    const UNDER = "2026-09-02T00:00:00Z";
    const rungless = (n: number, createdAt = TOP) =>
      card(n, ["founder-ordered", "seat:retro"], { body: "client/src/features/boards/Canvas.tsx", createdAt });
    const onRung = (n: number, rung: string, createdAt = UNDER, body = "server/casting/queue.ts") =>
      card(n, ["founder-ordered", `rung:${rung}`], { body, createdAt });

    it("⚠ A RUNGLESS CARD ON TOP NO LONGER ERASES THE MILESTONE — the card's own fixture", () => {
      const result = band([rungless(1467), onRung(1539, "N2")], "N2");
      expect(result.focus!.number, "the rungless card is still the focus shift's").toBe(1467);
      expect(result.offered.map((c) => c.number), "and the N2 card reaches a seat").toEqual([1539]);
    });

    it("⚠ AND A LATER-RUNG CARD ON TOP DOES NOT REPLACE IT — #509 at N6, the second face", () => {
      /* #509 gets the boards path so the AREA gate is not what decides this arm —
         same area as the focus card is its own hold, and it would mask the rung
         reading the arm is about. */
      const result = band(
        [onRung(509, "N6", TOP, "client/src/features/boards/Canvas.tsx"), onRung(1539, "N2", UNDER)],
        "N2",
      );
      expect(result.focus!.number).toBe(509);
      expect(result.offered.map((c) => c.number), "the N2 card is the milestone's, whatever sits on top").toEqual([1539]);
      /* And #509 itself is held — it is on a rung that is not the milestone. */
      expect(result.held.find((h) => h.number === 509)!.why).toContain("the top of NEXT UP");
    });

    it("holds a rung that is not the milestone, and SAYS SO WITHOUT CLAIMING AN ORDERING", () => {
      /*
        ⚠ THE OLD SENTENCE WAS MEASURED FALSE, not merely loose: it printed *"a
        later rung (N2) than the focus (N6)"* on thirteen real cards. Nothing here
        has ever compared two rungs, so it no longer says one is later.
      */
      const result = band([rungless(1541), onRung(1469, "N2c")], "N2");
      const why = result.held.find((h) => h.number === 1469)!.why;
      expect(why).toContain("on rung N2c");
      expect(why).toContain("the milestone is N2");
      expect(why, "it must not claim an ordering it never computed").not.toContain("later rung");
    });

    it("⚠ AN UNKNOWN RUNG IS STILL A RUNG — a rung the ladder does not list is HELD, never read as rungless", () => {
      /*
        THE TRAP FOR THE NEXT REPAIR. `rungFromLabels` — the reader his page and
        the desk sweep use — validates a rung against the ladder's keys, and it is
        right to: an unplaced card renders in the ladder's honest remainder. Doing
        the same HERE would read that card as RUNGLESS and hand it to a seat,
        which is the milestone gate failing open on a rung he has not opened.
        `rungsNamedBy` stays raw for exactly this reason.

        ⚠ **THE LIVE INSTANCE TODAY IS `rung:N2c` ON #1469 — N2c is not in the
        ladder at all — AND THIS ARM DELIBERATELY DOES NOT USE IT.** An arm keyed
        on N2c's absence would go red the day a shift transcribes his word into
        the ladder line, which is ordinary edition work and is owed. `N99` is the
        same never-a-rung value `crewBriefing.test.ts` uses for its own
        not-in-the-ladder arm, so the premise below cannot rot.
      */
      const ladder = JSON.parse(readFileSync("server/crew/crew-briefing.json", "utf8")) as {
        program: { ladder: readonly { readonly key: string }[] };
      };
      expect(ladder.program.ladder.map((rung) => rung.key)).not.toContain("N99");
      const result = band([rungless(1541), onRung(9999, "N99")], "N2");
      expect(result.offered, "a rung the ladder does not list must never be offered as rungless work").toEqual([]);
      expect(result.held.find((h) => h.number === 9999)!.why).toContain("on rung N99");
    });

    it("no milestone holds every rung card, and leaves rungless work alone", () => {
      const result = band([rungless(1467), onRung(1539, "N2")], null);
      expect(result.offered).toEqual([]);
      expect(result.held.find((h) => h.number === 1539)!.why).toContain("nothing names the current focus");
    });

    /*
      ── AND THE LOCATOR RULE REACHES THIS LANE TOO (#1553) ──────────────────

      #1420 is the real shape: `founder-ordered` + `bug` + `rung:N6`, filed the
      morning he added the Sentry token for it, held by the gate the same pass.
      It is driven here as well as through `seatPopulation` for the reason
      #1496's own body got wrong once — the two lanes are different code, and an
      arm on one says nothing about the other.
    */
    const orderedFix = (n: number, rung: string, work = "bug", createdAt = UNDER) =>
      card(n, ["founder-ordered", work, `rung:${rung}`], { body: "server/casting/queue.ts", createdAt });

    it("offers HIS ordered bug on a rung that is not the milestone — #1420's own shape", () => {
      const result = band([rungless(1467), orderedFix(1420, "N6")], "N2");
      expect(result.offered.map((c) => c.number)).toEqual([1420]);
      expect(result.held.map((h) => h.number)).not.toContain(1420);
    });

    it("and still holds his ordered card that is milestone work, in the same reading", () => {
      /*
        The opposite, in one population. #1469 carries no work label — the shape
        almost every rung card in his band has — so the gate is untouched by the
        exemption exactly where the milestone gate does its work.
      */
      const result = band([rungless(1467), orderedFix(1420, "N6"), onRung(1469, "N2c")], "N2");
      expect(result.offered.map((c) => c.number)).toEqual([1420]);
      expect(result.held.find((h) => h.number === 1469)!.why).toContain("the milestone is N2");
    });

    it("offers an ordered fix with NO milestone named at all — maintenance mode, on this lane too", () => {
      const result = band([rungless(1467), orderedFix(1420, "N6")], null);
      expect(result.offered.map((c) => c.number)).toEqual([1420]);
    });
  });
});

/* ── THE MANAGER'S FACT SHEET, AND THE WALLS IT CANNOT MOVE (#1658) ────────── */

describe("the manager answers the soft readings and every wall still wins", () => {
  /** A sheet row, with the shape `scripts/lib/managerFactSheet.mts` validates. */
  const sheetRow = (card: number, over: Partial<ManagerCardRow> = {}): ManagerCardRow => ({
    card,
    dependsOn: [],
    area: null,
    collidesWith: [],
    ready: "yes",
    why: "",
    batchHint: null,
    reason: `read at the card: #${card} names its own files and cites nothing as a prerequisite.`,
    ...over,
  });

  const factsOf = (...rows: ManagerCardRow[]): SeatManagerFacts => {
    const byCard = new Map(rows.map((row) => [row.card, row] as const));
    return { rowFor: (card: number) => byCard.get(card) };
  };

  const ordered = (number: number, body: string, labels: string[] = []) =>
    card(number, ["founder-ordered", ...labels], { body });

  /**
   * THE COMPOSITION THE CLI PERFORMS, written once here: the manager's reading
   * where it has a row, today's mechanical reading otherwise. The text arm at the
   * foot of this block holds `cut-seat-batches.mts` to calling the same function.
   */
  const independenceWith = (facts: SeatManagerFacts | undefined, openCards: readonly number[]) =>
    (subject: SeatCandidateCard) =>
      managerIndependence(facts?.rowFor(subject.number), openCards, subject.number)
        ?? readIndependence({ card: subject.number, body: subject.body, openCards });

  const bandWith = (
    cards: SeatCandidateCard[],
    facts: SeatManagerFacts | undefined,
    focusRung: string | null = null,
    switches = ALL_ON,
  ) =>
    orderedBandForSeats({
      cards,
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      switches,
      independenceOf: independenceWith(facts, cards.map((c) => c.number)),
      focusRung,
      facts,
    });

  it("⚠ frees a card whose body opens \"Parent: #N\" — the measured defect", () => {
    /*
      THE CARD'S OWN HEADLINE MEASUREMENT. All seven open pricing cards open with
      *"Parent: #1598."* and were held every pass on *"cites #1598 and nothing says
      whether it builds on them"* — a bare citation no human reads as a dependency.
      `Parent:` is not in `DEPENDENCY_PHRASES` and cannot be added to it without
      making every precedent a dependency, which is why a reader was needed rather
      than a longer list.
    */
    const cards = [
      ordered(100, "Change server/casting/queue.ts."),
      ordered(101, "Parent: #100.\n\nChange client/src/features/boards/Canvas.tsx."),
    ];

    /* TODAY, with no sheet: held, and the sentence is the one the card quotes. */
    const before = bandWith(cards, undefined);
    expect(before.offered.map((c) => c.number)).toEqual([]);
    expect(before.held.some((h) => h.number === 101 && h.why.includes("nothing says whether it builds on them"))).toBe(true);

    /* WITH the sheet: the manager's empty `dependsOn` is a positive statement. */
    const after = bandWith(cards, factsOf(sheetRow(100), sheetRow(101)));
    expect(after.offered.map((c) => c.number)).toEqual([101]);
    expect(after.offered[0]!.managerReason).toContain("cites nothing as a prerequisite");
  });

  it("⚠ marks a dependency the phrase reader misses, and the card is then held", () => {
    /* The other direction, and the one that makes this a reader rather than a
       rubber stamp: a body naming no `#N` at all reads as independent today. */
    const cards = [
      ordered(100, "Change server/casting/queue.ts."),
      ordered(101, "Rework the same tile store, after the queue change lands. client/src/features/boards/Canvas.tsx."),
    ];
    const before = bandWith(cards, undefined);
    expect(before.offered.map((c) => c.number)).toEqual([101]);

    const after = bandWith(cards, factsOf(sheetRow(100), sheetRow(101, { dependsOn: [100] })));
    expect(after.offered.map((c) => c.number)).toEqual([]);
    expect(after.held.some((h) => h.number === 101 && h.why.includes("builds on #100"))).toBe(true);
  });

  it("discharges a dependency on a card that is no longer open", () => {
    /* A manager reading a body written weeks ago names cards that have merged.
       Honouring one would hold a card forever on finished work. */
    expect(managerIndependence(sheetRow(101, { dependsOn: [999] }), [100, 101], 101)).toEqual({ kind: "independent" });
    expect(managerIndependence(sheetRow(101, { dependsOn: [100, 999] }), [100, 101], 101)).toEqual({ kind: "dependent", on: [100] });
    /* And a row that does not exist leaves the caller's reading alone. */
    expect(managerIndependence(undefined, [100], 100)).toBeNull();
  });

  it("⚠ THE RUNG WALL WINS over a sheet that says the card is ready", () => {
    const cards = [
      ordered(100, "Change server/casting/queue.ts."),
      ordered(101, "Change client/src/features/boards/Canvas.tsx.", ["rung:N3"]),
    ];
    const facts = factsOf(sheetRow(100), sheetRow(101, { area: "boards", ready: "yes" }));
    const held = bandWith(cards, facts, "P1");
    expect(held.offered.map((c) => c.number)).toEqual([]);
    expect(held.held.some((h) => h.number === 101 && h.why.includes("the milestone is P1"))).toBe(true);
    /* ⚠ POSITIVE CONTROL — on the OPEN rung the same sheet offers it, so the arm
       above measures the wall rather than a band that stopped offering. */
    const open = bandWith(
      [ordered(100, "Change server/casting/queue.ts."), ordered(101, "Change client/src/features/boards/Canvas.tsx.", ["rung:P1"])],
      facts,
      "P1",
    );
    expect(open.offered.map((c) => c.number)).toEqual([101]);
  });

  it("⚠ HIS MASTER SWITCH WINS over a perfect sheet, in both lanes", () => {
    const off = { ...ALL_ON, master: false };
    const cards = [ordered(100, "Change server/casting/queue.ts."), ordered(101, "Change client/src/features/boards/Canvas.tsx.")];
    const facts = factsOf(sheetRow(100, { area: "casting" }), sheetRow(101, { area: "boards" }));
    const band = bandWith(cards, facts, "P1", off);
    expect(band.focus).toBeNull();
    expect(band.offered).toEqual([]);
    expect(band.held.every((h) => h.why.includes("switch is off"))).toBe(true);

    /* The background lane's own switch, with the same sheet in hand. */
    const bugsOff = seatPopulation({
      cards: [card(200, ["bug"], { body: "Change server/casting/queue.ts." })],
      switches: { ...ALL_ON, bugs: false },
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      focusRung: "P1",
      facts: factsOf(sheetRow(200, { area: "casting", ready: "yes" })),
    });
    expect(bugsOff.takeable).toEqual([]);
    expect(bugsOff.skipped[0]!.why).toContain("switch is off");
  });

  it("⚠ MAX_SEATS WINS however many cards the sheet frees", () => {
    const cards = [
      ordered(100, "Change docs/one.md."),
      ordered(101, "Change docs/two.md."),
      ordered(102, "Change docs/three.md."),
      ordered(103, "Change docs/four.md."),
      ordered(104, "Change docs/five.md."),
    ];
    const facts = factsOf(
      sheetRow(100, { area: "casting" }),
      sheetRow(101, { area: "boards" }),
      sheetRow(102, { area: "billing" }),
      sheetRow(103, { area: "wardrobe" }),
      sheetRow(104, { area: "castingV2" }),
    );
    const band = bandWith(cards, facts, "P1");
    /* Every card but the focus is freed by the sheet — the precondition of the
       arm, asserted so a cap passing for lack of candidates cannot pass here. */
    expect(band.offered.map((c) => c.number)).toEqual([101, 102, 103, 104]);
    const plan = cutSeatBatches({ cards: [], ordered: band.offered, maxSeats: 2, batchSize: 1 });
    expect(plan.seatCount).toBe(2);
    expect(plan.batches.every((batch) => batch.cards.length > 0)).toBe(true);
  });

  it("takes the manager's area where the Atlas knows the name, and discards one it does not", () => {
    const subject = card(200, ["bug"], { body: "Change server/casting/queue.ts and server/casting/aiService.ts." });
    const taken = seatPopulation({
      cards: [subject],
      switches: ALL_ON,
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      focusRung: null,
      facts: factsOf(sheetRow(200, { area: "billing" })),
    });
    expect(taken.takeable[0]!.area).toBe("billing");
    expect(taken.takeable[0]!.areaFrom).toBe("manager");

    /* ⚠ A WALL: a name the Atlas does not carry is not vocabulary. It is
       DISCARDED rather than refused, so the Atlas reading still answers. */
    const invented = seatPopulation({
      cards: [subject],
      switches: ALL_ON,
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      focusRung: null,
      facts: factsOf(sheetRow(200, { area: "pricing" })),
    });
    expect(invented.takeable[0]!.area).toBe("casting");
    expect(invented.takeable[0]!.areaFrom).toBe("atlas");
  });

  it("holds a card the manager says nobody can start, in its own words, after the walls", () => {
    const stopped = seatPopulation({
      cards: [card(200, ["bug"], { body: "Change server/casting/queue.ts." })],
      switches: ALL_ON,
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      focusRung: null,
      facts: factsOf(sheetRow(200, { ready: "no", why: "it waits on his answer about the retry price" })),
    });
    expect(stopped.takeable).toEqual([]);
    expect(stopped.skipped[0]!.why).toContain("waits on his answer about the retry price");
    expect(stopped.skipped[0]!.why).toContain("the manager's reading of this pass");
  });

  it("holds an ORDERED card the manager says nobody can start, after the rung wall", () => {
    /* The ordered lane has its own copy of the readiness hold, and it had no arm
       until the sabotage pass went looking for one (working law 2 pointed at the
       arms rather than at the code). */
    const cards = [
      ordered(100, "Change server/casting/queue.ts."),
      ordered(101, "Change client/src/features/boards/Canvas.tsx."),
    ];
    const held = bandWith(
      cards,
      factsOf(sheetRow(100), sheetRow(101, { area: "boards", ready: "no", why: "it waits on his ruling about the noun" })),
      "P1",
    );
    expect(held.offered).toEqual([]);
    expect(held.held.some((h) => h.number === 101 && h.why.includes("waits on his ruling about the noun"))).toBe(true);
    /* ⚠ POSITIVE CONTROL — ready, and the same pass offers it. */
    const ready = bandWith(cards, factsOf(sheetRow(100), sheetRow(101, { area: "boards" })), "P1");
    expect(ready.offered.map((c) => c.number)).toEqual([101]);
  });

  it("reads the collision question off the sheet, symmetrically, in place of the area rule", () => {
    const cards = [
      ordered(100, "Change server/casting/queue.ts."),
      ordered(101, "Change server/casting/aiService.ts."),
    ];
    /* Today: same area, so held. */
    expect(bandWith(cards, undefined).held.some((h) => h.number === 101 && h.why.includes("same area"))).toBe(true);

    /* The manager says they do not meet: offered despite one area. */
    const clear = bandWith(cards, factsOf(sheetRow(100, { area: "casting" }), sheetRow(101, { area: "casting" })));
    expect(clear.offered.map((c) => c.number)).toEqual([101]);

    /* The manager says they meet: held, with its reason quoted. */
    const meets = bandWith(
      cards,
      factsOf(sheetRow(100, { area: "casting" }), sheetRow(101, { area: "casting", collidesWith: [100] })),
    );
    expect(meets.offered).toEqual([]);
    expect(meets.held.some((h) => h.number === 101 && h.why.includes("touching the focus card #100's files"))).toBe(true);

    /* ⚠ SYMMETRIC: only the FOCUS row names the other, and it still holds. Two
       rows can disagree, and the safe reading of a disagreement is the one that
       holds a card back. */
    const onlyFocusSaysSo = bandWith(
      cards,
      factsOf(sheetRow(100, { area: "casting", collidesWith: [101] }), sheetRow(101, { area: "casting" })),
    );
    expect(onlyFocusSaysSo.offered).toEqual([]);

    /* And the verdict is `null` — fall through to today's readers — the moment
       either card is missing from the sheet. */
    expect(managerPairVerdict({ number: 100 }, { number: 101 }, factsOf(sheetRow(100)))).toBeNull();
    expect(managerPairVerdict({ number: 100 }, { number: 101 }, undefined)).toBeNull();
  });

  it("⚠ NO USABLE SHEET REPRODUCES TODAY'S READING EXACTLY, in both gates", () => {
    /*
      The card's §5. `scripts/lib/managerFactSheet.mts` turns every missing,
      unparseable, stale or partial sheet into `undefined` — those four states have
      their own arms in `server/managerFactSheet.test.ts` — so what has to be true
      HERE is that `undefined` changes nothing at all.

      ⚠ **AND THIS ARM IS A STRUCTURAL CHECK, NOT THE MEASUREMENT — said plainly
      because the sabotage pass tried and could not break it.** `facts?.rowFor` is
      the same code path for an absent key and an `undefined` one, so no edit to
      this library makes these two calls disagree; what the arm really pins is that
      a later shift has not given the key a DEFAULT, which is the one way they
      could part. **The measurement is the drive**
      (`.agents/foreman/drive-runner-manager-1658.ps1`): on one fake queue a pass
      with a usable sheet hands out 3 cards and a pass whose sheet is absent,
      partial, off-queue or unreadable hands out 2 — the same 2, four times.
    */
    const cards = [
      ordered(100, "Change server/casting/queue.ts."),
      ordered(101, "Parent: #100.\n\nChange client/src/features/boards/Canvas.tsx."),
      card(200, ["bug"], { body: "Change server/routes/billing.ts." }),
      card(201, ["small-fix"], { body: "Change server/wardrobe/vto.ts." }),
    ];
    const numbers = cards.map((c) => c.number);
    const withoutKey = orderedBandForSeats({
      cards,
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      switches: ALL_ON,
      independenceOf: independenceWith(undefined, numbers),
      focusRung: "P1",
    });
    const withUndefined = bandWith(cards, undefined, "P1");
    expect(withUndefined).toEqual(withoutKey);

    const popWithoutKey = seatPopulation({ cards, switches: ALL_ON, board: CLEAN_BOARD, areaIndex: INDEX, focusRung: "P1" });
    const popWithUndefined = seatPopulation({
      cards,
      switches: ALL_ON,
      board: CLEAN_BOARD,
      areaIndex: INDEX,
      focusRung: "P1",
      facts: undefined,
    });
    expect(popWithUndefined).toEqual(popWithoutKey);

    /* And the same fixtures through the real cut, both ways. */
    const planA = cutSeatBatches({ cards: popWithoutKey.takeable, ordered: withoutKey.offered, maxSeats: 4, batchSize: 5 });
    const planB = cutSeatBatches({ cards: popWithUndefined.takeable, ordered: withUndefined.offered, maxSeats: 4, batchSize: 5 });
    expect(planB).toEqual(planA);
  });

  it("the CLI is wired to these functions — the floor under the arms above", () => {
    /*
      ⚠ A FLOOR, AND IT SAYS SO. Every arm in this block drives the LIBRARY; the
      composition that reaches a pass lives in `scripts/cut-seat-batches.mts`, and
      the review of 2026-09-26 found exactly that gap on this feature once already
      (an arm that reads one file of a feature is an arm about that file). The
      end-to-end proof is `.agents/foreman/drive-runner-manager-1658.ps1`, which
      runs the real cut against a real sheet; this is the cheap check that the
      wiring has not simply been deleted.
    */
    const cli = readFileSync("scripts/cut-seat-batches.mts", "utf8");
    expect(cli).toContain("readManagerSheet(");
    expect(cli).toContain("managerIndependence(");
    /* Both gates, not one: #1496's own body named only the ordered gate and
       eleven of the thirteen cards it listed reach the lane through the other. */
    expect(cli.match(/facts: managerFacts/g)?.length ?? 0).toBe(2);
  });
});

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
      ["rungHoldFor, at BOTH gates", /rungHoldFor\(card\.labels, input\.focusRung\)/],
      ["rungHoldFor, at BOTH gates", /rungHoldFor\(card\.labels, focusRung\)/],
      /* ⚠ #1541: the ordered gate must READ the milestone it was handed, never
         re-derive one from its own top card. `focusRungOf(focus)` was the
         defect and its absence is now part of the contract (arm below). */
      ["the handed-in milestone", /const focusRung = input\.focusRung;/],
      ["currentLadderRung", /currentLadderRung\(ladder\)/],
    ];
    for (const [owner, call] of checks) {
      expect(call.test(source), `${owner} must be CALLED here, not merely imported`).toBe(true);
    }
  });

  /*
    ⚠ THE ARM THAT CLOSES A SURVIVING SABOTAGE, AND IT IS THE WHOLE POINT OF
    #1496 (foreman-20260929-1141).

    Driven before it was written: replacing `focusRung: focusRungOf(ordered.focus)`
    in the CLI with `focusRung: null` left **all 52 arms green**. Every test in
    this file drives the pure functions directly, so none of them can see the
    caller's wiring — and with the focus rung unthreaded the background lane
    holds every rung card exactly as it did before, which is #1496's own failure
    mode: a throughput fix that frees nothing and closes as done.

    The eleven cards that card listed reach the lane through `seatPopulation`,
    and `seatPopulation` can only apply the milestone gate if something HANDS IT
    the focus rung. That handing-over happens in one place and nothing else
    watches it.

    **Its limit, stated rather than left to be assumed:** this reads source, so
    it proves the call is written, not that the value flowing through it is the
    right one. The pure arms above prove the rule; this proves the rule is
    reached. Neither is the other.
  */
  it("THE CLI THREADS THE MILESTONE INTO BOTH GATES — a rule nothing calls is a rule that frees nothing", () => {
    const cli = readFileSync("scripts/cut-seat-batches.mts", "utf8");
    /*
      ⚠ THIS ARM CHANGED WITH #1541 AND THE OLD VERSION WOULD NOW PASS ON THE BUG.
      It asserted `focusRung: focusRungOf(ordered.focus)` — the defect itself — so
      it pinned the wrong wiring in place. What it must hold is the shape, not the
      old expression: the milestone is read ONCE from the ladder, and both gates
      are handed that one value.
    */
    expect(
      /const focusRung = focusRungFromLadder\(ladder\);/.test(cli),
      "the CLI must read the milestone from the ladder he declared, once",
    ).toBe(true);
    /* ⚠ ONCE. Two reads is two milestones waiting to disagree, which is the class
       this card is an instance of. */
    expect(cli.split("focusRungFromLadder(").length - 1, "read the ladder in exactly one place").toBe(1);
    /* And the old reading must be GONE, not merely unused: an expression left
       behind is what a later shift copies. */
    expect(/focusRungOf\(/.test(cli), "focusRungOf is the defect and must not survive anywhere in the CLI").toBe(false);
    /*
      BOTH gates receive it. `orderedBandForSeats` used to derive its own from its
      top card while `seatPopulation` was handed one — two gates, two milestones,
      nothing holding them equal. Now each takes `focusRung,` as a shorthand
      property, so they are the same binding by construction.
    */
    const ordered = cli.slice(cli.indexOf("orderedBandForSeats({"));
    expect(/focusRung,/.test(ordered.slice(0, ordered.indexOf("});"))), "the ordered gate must be handed the milestone").toBe(true);
    const background = cli.slice(cli.indexOf("seatPopulation({"));
    expect(/focusRung,/.test(background.slice(0, background.indexOf("});"))), "the background gate must be handed the milestone").toBe(true);
    /*
      ⚠ AND THE ORDERING REQUIREMENT IS GONE, WHICH IS WORTH SAYING OUT LOUD.
      The old arm asserted `orderedBandForSeats` was called before
      `seatPopulation`, because the background gate read `ordered.focus`. It no
      longer does, so that assertion would now pin an accident rather than a
      contract — and a guard that pins an accident is the thing that stops the
      next repair. It is deliberately not replaced.
    */
  });

  it("the milestone reaches the PLAN and the runner's line, so a pass that holds every rung card says why", () => {
    /*
      #1541 was found by inferring a reading from a card title: the plan recorded
      `focusCard` and which cards were held, and NOTHING about the milestone that
      held them. Both of the reasons a pass holds everything — an unreadable
      briefing, and a ladder naming no current rung — are now written down.
    */
    const cli = readFileSync("scripts/cut-seat-batches.mts", "utf8");
    expect(cli).toContain("focusRungSource: briefingPath,");
    expect(/ladderNote: ladderNote === "" \? null : ladderNote,/.test(cli)).toBe(true);
    expect(/no milestone — every rung card held/.test(cli)).toBe(true);
    /* The runner matches `^SEATS (\d+)` and nothing further, so the count stays
       the first thing on the line (`.agents/` is gitignored — no suite can read
       that regex, which is exactly why this is asserted here). */
    expect(/`SEATS \$\{plan\.seatCount\} \| cards/.test(cli)).toBe(true);
    expect(/`SEATS 0 \| nothing on offer\$\{rungWord\}/.test(cli)).toBe(true);
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
      /* #1658's two files join the population rather than sitting beside it: a
         feature's newest module is exactly the one a hand-named list loses. */
      "scripts/lib/managerFactSheet.mts",
      "scripts/manager-fact-sheet.mts",
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

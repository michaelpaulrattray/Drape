/**
 * HOW ONE PASS DIVIDES THE BACKGROUND QUEUE BETWEEN N SEATS (#1281).
 *
 * His word, 2026-09-26 (terminal), verbatim: *"can the crew launch multiple
 * opus 5 agents now to handle more workload at once?"* — asked after a day in
 * which the relay launched eight seats by hand (26 seat PRs merged, 25 cards
 * closed, 0 code defects found in review). The runner launched ONE shift per
 * pass; this module is the arithmetic that lets it launch several.
 *
 * # ⚠ TWO LANES, AND ONLY ONE OF THEM IS HERE
 *
 * The founder's division, 2026-09-26, asked at the moment the hold lifted:
 *
 * - **The FOCUS lane is unchanged** — ONE crew shift takes the top takeable
 *   card of NEXT UP, in his order, one at a time, because milestone work is
 *   sequential by his word (the milestone gate). Nothing in this file can
 *   reach that lane, and `orderedBandForSeats` names the card it holds.
 * - **The SEAT lane is BACKGROUND WORK ONLY** — cards on offer under the
 *   switch bands he has turned on. Never one on a rung, never blocked, never
 *   claimed, never one with an open pull request.
 *
 * ⚠ **AND NEXT UP IS NOT ENTIRELY BARRED FROM THE SEAT LANE — his revision the
 * same hour, verbatim: *"yes independent ones also"*.** The TOP card of his
 * ordered band is the focus shift's alone, always. Any OTHER ordered card may
 * join a seat's batch in the same pass on three conditions, and all three are
 * tested in `orderedBandForSeats` and `cutSeatBatches`:
 *
 *  1. it is **independent** — nothing in its body or comments cites another
 *     OPEN card as something it builds on (`readIndependence`, which is
 *     mechanical first and asks Jev only where the mechanical reading is
 *     genuinely silent);
 *  2. its **area is known** — an unknown area cannot be proven to differ from
 *     anything, so the card stays with the focus lane rather than being placed
 *     on a hope;
 *  3. its **area differs from the focus card's and from every card already in
 *     the batch** — an ordered card is alone in its area inside its seat.
 *
 * A card that cites another open card waits until that one closes. That is his
 * sentence, and it is the whole of the dependency rule: nothing here ranks,
 * schedules or re-orders his band.
 *
 * So a card reaching a seat's batch has passed four independent readings, and
 * **not one of them is written here** (working law 4 — a second list shadowing
 * a source of truth always drifts from it):
 *
 *  1. `homeWorkCategoryFor` — which switch band the card is homed in
 *     (`shared/crewWorkSwitches.ts`, and it is ONE band per card by his own
 *     ruling about double-counted cards);
 *  2. `backgroundWorkAllowed` — whether that band's switch, and his master
 *     switch, are on right now;
 *  3. `exclusionFor` — the queue's own exclusion vocabulary
 *     (`shared/crewQueueExclusions.ts`): `founder-ordered` reads as *already
 *     queued*, which is exactly "in NEXT UP", plus `parked`, `blocked`,
 *     `awaiting-fable` and `awaiting-a-sitting`;
 *  4. `crewCardBuildState` — the fact-grade *is somebody already building
 *     this* (`shared/crewCardBuildState.ts`, #1094): an open PR, a live claim
 *     under twelve hours, or a recorded refusal.
 *
 * ⚠ **THE RUNG LIMB IS THE ONE RULE THIS FILE ADDS, AND IT IS DELIBERATELY
 * STRICTER THAN THE SENTENCE IT SERVES.** The instruction was *never a card on
 * a rung AHEAD of the current focus*; the rule below is **never a card on a
 * rung at all**. The reason is that `pipelineGroupFor` cannot answer the
 * narrower question for this population — it files a card carrying a switch
 * label under `switched` before it ever looks at `rung:`, so `#1222`
 * (`bug` + `urgent` + `rung:N2`) reads as switch work there — and deriving
 * "which rung is the focus" mechanically would mean parsing PROGRAM.md prose,
 * which is a report and not an artifact (law 1). A rung card IS milestone work
 * whatever else it carries, so the focus lane is the right lane for it and the
 * stricter rule cannot be wrong in the expensive direction. The prefix comes
 * from `RUNG_LABEL_PREFIX` rather than the letters `rung:` typed again here.
 *
 * # WHY BATCHES ARE CUT BY AREA
 *
 * Measured on the eight hand-launched seats: the collisions that cost time were
 * two seats touching the same files. An area is the Atlas's own product domain
 * (`docs/architecture/drape-architecture.json`, `modules[].domain`), so the
 * boundary a batch respects is the one the architecture already draws rather
 * than a taxonomy invented here. A domain group is never split across two
 * seats — that is the whole point of cutting by area — so a batch may exceed
 * `batchSize` when one domain holds more than that many cards. It is stated
 * rather than trimmed: `batchSize` decides HOW MANY SEATS a pass launches, not
 * how many cards a seat may hold.
 *
 * Every function here is pure over facts a caller has already read, so
 * `server/seatBatches.test.ts` drives them on fixtures rather than on a shape
 * imagined here. `scripts/cut-seat-batches.mts` is the one caller that reads
 * the world.
 */
import {
  crewCardBuildPhrase,
  crewCardBuildState,
  type CrewBuildPullRequest,
  type CrewCardCommentFact,
} from "../../shared/crewCardBuildState.js";
import { CREW_HOLD_WORD, heldStateFromLabels } from "../../shared/crewNextUpHold.js";
import { sortOrderedBand } from "../../shared/crewOrderedBand.js";
import { RUNG_LABEL_PREFIX } from "../../shared/crewPipelineGroups.js";
import { exclusionFor, QUEUE_EXCLUSION_REASONS } from "../../shared/crewQueueExclusions.js";
import {
  backgroundWorkAllowed,
  CREW_WORK_CATEGORIES,
  homeWorkCategoryFor,
  type CrewWorkSwitchState,
} from "../../shared/crewWorkSwitches.js";

/** A card as `gh issue list --json number,title,labels,body,createdAt` hands it over. */
export interface SeatCandidateCard {
  readonly number: number;
  readonly title: string;
  readonly labels: readonly string[];
  readonly body?: string | null;
  readonly createdAt?: string | null;
}

/** One card a pass did NOT hand out, with the sentence the digest prints. */
export interface SeatSkippedCard {
  readonly number: number;
  readonly title: string;
  readonly why: string;
}

/** A card a seat may take, with the area it was filed under. */
export interface SeatTakeableCard extends SeatCandidateCard {
  /** The Atlas domain this card's work lands in, or `null` when it names none. */
  readonly area: string | null;
}

/**
 * The area index, built from the Atlas's own module list.
 *
 * `byDirectory` holds only directories whose every module agrees on one domain,
 * so a path the Atlas has never seen resolves by its longest UNANIMOUS parent
 * and a mixed directory answers nothing rather than answering by whichever
 * module happened to be first.
 */
export interface SeatAreaIndex {
  readonly domains: readonly string[];
  readonly byPath: ReadonlyMap<string, string>;
  readonly byDirectory: ReadonlyMap<string, string>;
  /**
   * Modules the Atlas itself files as `unassigned`.
   *
   * ⚠ **Kept, rather than simply left out of `byPath`.** Dropping them let the
   * directory fallback answer for them, so `client/src/App.tsx` — which the
   * Atlas says belongs to no domain — inherited `boards` from its siblings.
   * The Atlas's own answer for such a module is "none", and inventing one from
   * the neighbours is exactly the confident-wrong reading an area exists to
   * prevent. Caught by an arm, not by reading.
   */
  readonly unassigned: ReadonlySet<string>;
}

/** A module row as the Atlas records one. */
export interface AtlasModuleRow {
  readonly path?: string | null;
  readonly domain?: string | null;
}

/**
 * The Atlas's own word for "this module belongs to nothing in particular". It
 * is a real domain in the artifact and it is NOT an area: a card naming only
 * unassigned files has named no area, which is the honest answer.
 */
const ATLAS_UNASSIGNED = "unassigned";

function normalisePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

export function buildAreaIndex(modules: readonly AtlasModuleRow[]): SeatAreaIndex {
  const byPath = new Map<string, string>();
  const unassigned = new Set<string>();
  const domains = new Set<string>();
  /** directory → the domains seen under it; a directory with two loses its entry. */
  const perDirectory = new Map<string, Set<string>>();

  for (const row of modules) {
    const path = typeof row.path === "string" ? normalisePath(row.path) : "";
    const domain = typeof row.domain === "string" ? row.domain : "";
    if (path === "" || domain === "") continue;
    if (domain === ATLAS_UNASSIGNED) {
      unassigned.add(path);
      continue;
    }
    domains.add(domain);
    byPath.set(path, domain);
    /* Every ancestor directory, not just the immediate one: a body naming
       `client/src/features/wardrobe/` resolves even when no module sits
       directly in it. */
    const parts = path.split("/");
    for (let depth = 1; depth < parts.length; depth += 1) {
      const dir = parts.slice(0, depth).join("/");
      const seen = perDirectory.get(dir) ?? new Set<string>();
      seen.add(domain);
      perDirectory.set(dir, seen);
    }
  }

  const byDirectory = new Map<string, string>();
  for (const [dir, seen] of perDirectory) {
    if (seen.size === 1) byDirectory.set(dir, [...seen][0]!);
  }
  return { domains: [...domains].sort(), byPath, byDirectory, unassigned };
}

/**
 * Every repository path a card's body names. Deliberately anchored on the
 * top-level directories this repository actually has: a bare `foo.ts` in prose
 * is not a path, and a URL is not one either.
 */
const BODY_PATH_RE = /\b(?:client|server|shared|scripts|docs|patches|drizzle|\.github|\.githooks)\/[A-Za-z0-9_.@\-/]+/g;

export function pathsNamedIn(body: string | null | undefined): string[] {
  if (typeof body !== "string" || body === "") return [];
  const found = body.match(BODY_PATH_RE) ?? [];
  const cleaned = found
    .map((raw) => normalisePath(raw).replace(/[).,:;`'"]+$/, ""))
    .filter((path) => path !== "");
  return [...new Set(cleaned)];
}

/** The domain a single path lands in — exact module first, then its longest unanimous parent. */
export function areaOfPath(path: string, index: SeatAreaIndex): string | null {
  const clean = normalisePath(path);
  const exact = index.byPath.get(clean);
  if (exact !== undefined) return exact;
  /* The Atlas has seen this module and filed it under no domain — its answer,
     not its neighbours'. */
  if (index.unassigned.has(clean)) return null;
  const parts = clean.split("/");
  for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
    const dir = parts.slice(0, depth).join("/");
    const domain = index.byDirectory.get(dir);
    if (domain !== undefined) return domain;
  }
  return null;
}

/**
 * The domain a LABEL names, or null. The whole label first (`casting-v2` is a
 * domain), then its `:`/`-`-separated tokens, so `casting-upkeep` reads as
 * casting and `seat:janitor` reads as nothing.
 */
export function areaOfLabel(label: string, index: SeatAreaIndex): string | null {
  const lower = label.trim().toLowerCase();
  if (lower === "") return null;
  const domains = new Set(index.domains.map((name) => name.toLowerCase()));
  const exact = index.domains.find((name) => name.toLowerCase() === lower);
  if (exact !== undefined) return exact;
  for (const token of lower.split(/[:\-\s]+/)) {
    if (token !== "" && domains.has(token)) {
      return index.domains.find((name) => name.toLowerCase() === token) ?? null;
    }
  }
  return null;
}

/**
 * WHICH AREA A CARD IS FILED UNDER — the files its body names first, its labels
 * second, `null` when neither says anything.
 *
 * ⚠ **The files win because collisions happen in files**, which is the thing an
 * area batch exists to prevent. A plurality rather than a first match: a card
 * naming four casting files and quoting one billing line is casting work. Ties
 * break alphabetically so two readers of the same card cannot disagree.
 */
export function resolveCardArea(card: SeatCandidateCard, index: SeatAreaIndex): string | null {
  const counts = new Map<string, number>();
  for (const path of pathsNamedIn(card.body)) {
    const area = areaOfPath(path, index);
    if (area !== null) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  if (counts.size > 0) {
    const ranked = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    return ranked[0]![0];
  }
  for (const label of card.labels) {
    const area = areaOfLabel(label, index);
    if (area !== null) return area;
  }
  return null;
}

/** What `seatPopulation` answers. */
export interface SeatPopulation {
  readonly takeable: readonly SeatTakeableCard[];
  readonly skipped: readonly SeatSkippedCard[];
}

/** The switch label a category is reached by, for the skip sentence. */
const CATEGORY_LABEL = new Map(CREW_WORK_CATEGORIES.map((c) => [c.key, c.queueLabel] as const));
/** The exclusion vocabulary's own words, keyed for the skip sentence. */
const EXCLUSION_WORDS = new Map(QUEUE_EXCLUSION_REASONS.map((r) => [r.key, r.label] as const));

/**
 * THE SEAT LANE'S POPULATION — which of these cards a background seat may take
 * right now, and one plain sentence for every card it may not.
 *
 * Every skip carries its reason because a population that silently shrinks is
 * indistinguishable from a broken reader — `shared/crewQueueExclusions.ts`'s
 * own argument, and the digest prints these lines straight out.
 */
export function seatPopulation(input: {
  readonly cards: readonly SeatCandidateCard[];
  readonly switches: CrewWorkSwitchState;
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly areaIndex: SeatAreaIndex;
  readonly nowMs: number;
}): SeatPopulation {
  const takeable: SeatTakeableCard[] = [];
  const skipped: SeatSkippedCard[] = [];

  for (const card of input.cards) {
    const note = (why: string) => skipped.push({ number: card.number, title: card.title, why });

    const category = homeWorkCategoryFor(card.labels);
    if (category === null) {
      note("not background work — it carries no switch label");
      continue;
    }
    if (!backgroundWorkAllowed(input.switches, category)) {
      note(`the ${CATEGORY_LABEL.get(category) ?? category} switch is off`);
      continue;
    }
    const exclusion = exclusionFor(card.labels);
    if (exclusion !== null) {
      note(exclusion === "ordered"
        ? "in NEXT UP — the focus lane's, never a seat's"
        : (EXCLUSION_WORDS.get(exclusion) ?? exclusion));
      continue;
    }
    if (card.labels.some((label) => label.startsWith(RUNG_LABEL_PREFIX))) {
      note("on a rung — milestone work, the focus lane's");
      continue;
    }
    const building = crewCardBuildState({
      card: card.number,
      openPullRequests: input.openPullRequests,
      facts: input.facts,
      nowMs: input.nowMs,
    });
    if (building !== null) {
      note(crewCardBuildPhrase(building, input.nowMs));
      continue;
    }
    takeable.push({ ...card, area: resolveCardArea(card, input.areaIndex) });
  }

  return { takeable, skipped };
}

/* ── HIS ORDERED BAND, AND THE INDEPENDENCE READING ───────────────────────── */

/**
 * The phrases that make a `#N` a DEPENDENCY rather than a citation.
 *
 * ⚠ **This list is NAMED rather than derived, and the reason is that nothing in
 * the repository declares it.** The nearest thing is
 * `shared/crewCardBuildState.ts`'s own narrow reading — *a bare `#N` anywhere is
 * not a claim* — and its argument applies here word for word: measured on the
 * open pull requests of 2026-09-26, PR #1326's body named five cards of which
 * one was the card it built. A card body that merely cites a precedent must not
 * read as a dependency, or nothing in his band would ever be independent.
 *
 * Each phrase is one a card in this repository actually uses. They are matched
 * case-insensitively inside a window ending at the `#N`, so *"stacks on PR
 * #1325"* counts and *"the rule #230 set"* does not.
 */
export const DEPENDENCY_PHRASES: readonly string[] = [
  "builds on",
  "build on",
  "built on",
  "stacks on",
  "stacked on",
  "depends on",
  "dependent on",
  "blocked by",
  "waits on",
  "waiting on",
  "waits for",
  "after",
  "on top of",
  "part 2 of",
  "part 3 of",
  "part two of",
  "part three of",
  "follows",
  "once",
  "requires",
];

/** How many characters before a `#N` are read for a dependency phrase. */
export const DEPENDENCY_WINDOW = 90;

/** Every `#N` in this text that names one of `openCards` — a citation, not yet a dependency. */
export function citedOpenCards(text: string, openCards: readonly number[], self: number): number[] {
  const open = new Set(openCards);
  const found = new Set<number>();
  for (const match of text.matchAll(/#(\d+)/g)) {
    const card = Number(match[1]);
    if (card !== self && open.has(card)) found.add(card);
  }
  return [...found].sort((a, b) => a - b);
}

/** The subset of those citations that sit in a dependency sentence. */
export function dependencyCitations(text: string, openCards: readonly number[], self: number): number[] {
  const open = new Set(openCards);
  const found = new Set<number>();
  for (const match of text.matchAll(/#(\d+)/g)) {
    const card = Number(match[1]);
    if (card === self || !open.has(card)) continue;
    const start = Math.max(0, (match.index ?? 0) - DEPENDENCY_WINDOW);
    const window = text.slice(start, match.index ?? 0).toLowerCase();
    if (DEPENDENCY_PHRASES.some((phrase) => window.includes(phrase))) found.add(card);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * IS THIS CARD INDEPENDENT OF EVERY OTHER OPEN CARD?
 *
 * Three answers, and the third is the only one that costs anything:
 *
 * - `dependent` — a dependency phrase sits beside a `#N` that is OPEN. Decided
 *   mechanically; Jev is not asked.
 * - `independent` — the card cites no open card at all, so there is nothing for
 *   it to depend on. Decided mechanically; Jev is not asked.
 * - `unclear` — it cites an open card but not in a dependency sentence. This is
 *   the fixed-answer question on text that Jev exists for, and the caller asks
 *   it (`scripts/lib/jevSeatBatching.mts`). Until it is answered the card is
 *   treated as dependent, because the safe default holds his band's order.
 */
export type IndependenceReading =
  | { readonly kind: "dependent"; readonly on: readonly number[] }
  | { readonly kind: "independent" }
  | { readonly kind: "unclear"; readonly cites: readonly number[] };

export function readIndependence(input: {
  readonly card: number;
  readonly body?: string | null;
  readonly comments?: readonly string[];
  readonly openCards: readonly number[];
}): IndependenceReading {
  const text = [input.body ?? "", ...(input.comments ?? [])].join("\n\n");
  const depends = dependencyCitations(text, input.openCards, input.card);
  if (depends.length > 0) return { kind: "dependent", on: depends };
  const cites = citedOpenCards(text, input.openCards, input.card);
  if (cites.length === 0) return { kind: "independent" };
  return { kind: "unclear", cites };
}

/** The `parked` label, taken from the exclusion vocabulary rather than retyped. */
const PARKED_LABEL = QUEUE_EXCLUSION_REASONS.find((reason) => reason.key === "parked")!.queueLabel;
/** His own label on a card he asked for by name, from the same vocabulary. */
const ORDERED_LABEL = QUEUE_EXCLUSION_REASONS.find((reason) => reason.key === "ordered")!.queueLabel;

/** What `orderedBandForSeats` answers. */
export interface OrderedBandForSeats {
  /** The top takeable card of NEXT UP — the focus shift's, never a seat's. */
  readonly focus: SeatTakeableCard | null;
  /** The ordered cards a seat MAY hold, subject to the area rule at placement. */
  readonly offered: readonly SeatTakeableCard[];
  /** Every ordered card held back, with the sentence the digest prints. */
  readonly held: readonly SeatSkippedCard[];
}

/**
 * HIS BAND, SPLIT INTO THE ONE CARD THE FOCUS SHIFT TAKES AND THE INDEPENDENT
 * ONES A SEAT MAY HELP WITH.
 *
 * The sort is `compareOrderedBand` — the repository's ONE comparator for this
 * band (#472: *"the repair was never that two sorts agree — it is that there is
 * one"*), so the card this names as the top is the same card the desk sweep and
 * the escalation gate call the top.
 *
 * `independenceOf` is a caller-supplied reading, so this function stays pure and
 * the network lives in the CLI: it hands back `unclear` where the mechanical
 * reading is silent and the caller has not asked Jev.
 */
export function orderedBandForSeats(input: {
  readonly cards: readonly SeatCandidateCard[];
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly areaIndex: SeatAreaIndex;
  readonly nowMs: number;
  readonly independenceOf: (card: SeatCandidateCard) => IndependenceReading;
}): OrderedBandForSeats {
  const held: SeatSkippedCard[] = [];
  const band = input.cards
    .filter((card) => card.labels.includes(ORDERED_LABEL))
    .map((card) => ({
      card,
      rank: null as number | null,
      urgent: card.labels.includes("urgent"),
      createdAt: card.createdAt,
      issueNumber: card.number,
    }));

  /* Takeable first, in his order, so "the top card" means the top card a shift
     could actually start — the focus lane's own rule. */
  const takeable: SeatCandidateCard[] = [];
  for (const row of sortOrderedBand(band)) {
    const card = row.card;
    const note = (why: string) => held.push({ number: card.number, title: card.title, why });
    if (card.labels.includes(PARKED_LABEL)) {
      note("parked on your own ruling");
      continue;
    }
    const hold = heldStateFromLabels(card.labels);
    if (hold !== null) {
      /* His page's own word for the hold, never a second spelling of it. */
      note(`held — ${CREW_HOLD_WORD[hold]}`);
      continue;
    }
    const building = crewCardBuildState({
      card: card.number,
      openPullRequests: input.openPullRequests,
      facts: input.facts,
      nowMs: input.nowMs,
    });
    if (building !== null) {
      note(crewCardBuildPhrase(building, input.nowMs));
      continue;
    }
    takeable.push(card);
  }

  const [top, ...rest] = takeable;
  if (top === undefined) return { focus: null, offered: [], held };

  const focus: SeatTakeableCard = { ...top, area: resolveCardArea(top, input.areaIndex) };
  held.push({
    number: top.number,
    title: top.title,
    why: "the top of NEXT UP — the focus shift takes it, never a seat",
  });

  const offered: SeatTakeableCard[] = [];
  for (const card of rest) {
    const note = (why: string) => held.push({ number: card.number, title: card.title, why });
    if (card.labels.some((label) => label.startsWith(RUNG_LABEL_PREFIX))) {
      note("on a rung — milestone work, the focus lane's");
      continue;
    }
    const independence = input.independenceOf(card);
    if (independence.kind === "dependent") {
      note(`builds on ${independence.on.map((n) => `#${n}`).join(", ")} — it waits until that closes`);
      continue;
    }
    if (independence.kind === "unclear") {
      note(`cites ${independence.cites.map((n) => `#${n}`).join(", ")} and nothing says whether it builds on them — held`);
      continue;
    }
    const area = resolveCardArea(card, input.areaIndex);
    if (area === null) {
      note("no area named, so it cannot be proven to sit clear of the focus card — held");
      continue;
    }
    if (focus.area !== null && area === focus.area) {
      note(`same area as the focus card (${area}) — held`);
      continue;
    }
    offered.push({ ...card, area });
  }

  return { focus, offered, held };
}

/** One seat's work for a pass. */
export interface SeatBatch {
  /** 1-based, and it is the seat's name on the Desk and on disk. */
  readonly seat: number;
  /** The areas this batch holds, in the words the Atlas uses. */
  readonly areas: readonly string[];
  readonly cards: readonly SeatTakeableCard[];
}

export interface SeatBatchPlan {
  readonly seatCount: number;
  readonly batches: readonly SeatBatch[];
  /** Every takeable card, for the arm that proves the cut is a partition. */
  readonly cardCount: number;
  /** Ordered cards no batch could take without breaking the area rule. */
  readonly held: readonly SeatSkippedCard[];
}

/** Urgent first, then oldest, then the number — a total order, so two cuts agree. */
function compareWithinBatch(a: SeatTakeableCard, b: SeatTakeableCard): number {
  const ua = a.labels.includes("urgent");
  const ub = b.labels.includes("urgent");
  if (ua !== ub) return ua ? -1 : 1;
  const fa = typeof a.createdAt === "string" && a.createdAt !== "" ? a.createdAt : "￿";
  const fb = typeof b.createdAt === "string" && b.createdAt !== "" ? b.createdAt : "￿";
  const byDate = fa.localeCompare(fb);
  if (byDate !== 0) return byDate;
  return a.number - b.number;
}

/**
 * HOW MANY SEATS, AND WHICH CARDS EACH ONE GETS.
 *
 * `min(ceil(takeable / batchSize), maxSeats)` is the founder's arithmetic; both
 * numbers are the caller's, with no default here on purpose — the runner's own
 * top is where he changes them, and a library default would be a second home
 * for a founder number (working law 4).
 *
 * Area groups are placed largest first into the batch holding the fewest cards,
 * and a card naming no area goes to the smallest batch, which is the card's own
 * instruction. Deterministic throughout: equal sizes break by area name, so the
 * same queue cuts the same way twice.
 */
export function cutSeatBatches(input: {
  readonly cards: readonly SeatTakeableCard[];
  readonly maxSeats: number;
  readonly batchSize: number;
  /** His ordered band's independent cards — placed last, one area each. */
  readonly ordered?: readonly SeatTakeableCard[];
}): SeatBatchPlan {
  const { cards, maxSeats, batchSize } = input;
  const ordered = input.ordered ?? [];
  if (!Number.isInteger(maxSeats) || maxSeats < 1) {
    throw new Error(`cutSeatBatches: maxSeats must be a positive integer, got ${maxSeats}`);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`cutSeatBatches: batchSize must be a positive integer, got ${batchSize}`);
  }
  const total = cards.length + ordered.length;
  if (total === 0) return { seatCount: 0, batches: [], cardCount: 0, held: [] };

  const seatCount = Math.min(Math.ceil(total / batchSize), maxSeats);
  const buckets: SeatTakeableCard[][] = Array.from({ length: seatCount }, () => []);

  const grouped = new Map<string, SeatTakeableCard[]>();
  const arealess: SeatTakeableCard[] = [];
  for (const card of cards) {
    if (card.area === null) {
      arealess.push(card);
      continue;
    }
    const group = grouped.get(card.area) ?? [];
    group.push(card);
    grouped.set(card.area, group);
  }

  const smallest = (): SeatTakeableCard[] => {
    let best = 0;
    for (let i = 1; i < buckets.length; i += 1) {
      if (buckets[i]!.length < buckets[best]!.length) best = i;
    }
    return buckets[best]!;
  };

  const groups = [...grouped.entries()].sort((a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]));
  for (const [, group] of groups) smallest().push(...group);
  for (const card of arealess.sort(compareWithinBatch)) smallest().push(card);

  /*
    HIS ORDERED CARDS LAST, AND ONE AREA EACH.

    The condition is his: an ordered card's area must differ from every card
    already in the batch it joins (the focus card's area was excluded before it
    ever reached here). Placed into the SMALLEST batch that can take it, so a
    seat that is already carrying five background cards does not also carry a
    card he asked for by name. A card no batch can take is HELD and says so —
    never squeezed in, because the area rule is the thing that keeps two seats
    off the same files.
  */
  const held: SeatSkippedCard[] = [];
  for (const card of [...ordered].sort(compareWithinBatch)) {
    const candidates = buckets
      .map((bucket, index) => ({ bucket, index }))
      .filter(({ bucket }) => !bucket.some((placed) => placed.area === card.area))
      .sort((a, b) => (a.bucket.length - b.bucket.length) || (a.index - b.index));
    const chosen = candidates[0];
    if (chosen === undefined) {
      held.push({
        number: card.number,
        title: card.title,
        why: `every seat this pass already holds ${card.area} work — held for the next pass`,
      });
      continue;
    }
    chosen.bucket.push(card);
  }

  const batches: SeatBatch[] = buckets.map((bucket, index) => ({
    seat: index + 1,
    areas: [...new Set(bucket.map((card) => card.area).filter((area): area is string => area !== null))].sort(),
    cards: [...bucket].sort(compareWithinBatch),
  }));

  return { seatCount, batches, cardCount: total, held };
}

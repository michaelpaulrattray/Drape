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
 *  2. **the pair can be proven not to collide** — by AREA where the Atlas has
 *     placed both cards, and ⚠ **since #1547, by the FILES both cards name where
 *     it has placed either of them nowhere.** This condition read *"its area is
 *     known"* until 2026-09-30, and an unknown area ended the enquiry: one
 *     rungless tooling card on top of his band (`#1467`) therefore held every
 *     candidate behind it and cut `seatCount 0` with four seats idle. The Atlas
 *     is a PRODUCT map, so its silence is usually honest rather than missing —
 *     it files all five `server/crew/` modules `unassigned` and maps no
 *     `scripts/` module at all — which makes *"this card named no area"* a
 *     weaker fact than it sounds and frequently false of a card that named
 *     several paths. `pairDisjointOnPaths` is the second reader and it still
 *     fails CLOSED on silence: a card naming no path at all is held exactly as
 *     before, because the gate only converts *unknown* into *offered* where
 *     there is something positive to read;
 *  3. it is **alone in its area inside its seat** — an ordered card joins no
 *     batch that already holds work in the same area.
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
 *  4. **the card build BOARD** — `scripts/lib/cardBuildState.mts`'s `buildBoard`
 *     (#1094 piece 2), which is *"the ONE reader every queue reader consults"*.
 *     This cut is the sixth such reader and it consults the same board, so a
 *     card his page calls *being built* can never be handed to a seat.
 *
 * ⚠ **AND THAT BOARD SETTLES ONE THING AGAINST THIS CARD'S OWN BODY, WHICH IS
 * WHY IT IS DERIVED RATHER THAN RE-READ.** #1281 says *"a card with an open PR,
 * a live claim or a refusal is not on offer"*; `buildStateHoldsOffOffer` holds
 * off TWO of those three, and a refusal *annotates and is still offered* — its
 * own docblock carries the argument. The code is the artifact (law 7c), so a
 * refused card still reaches a seat here, **carrying its phrase as an
 * `annotation`** that travels into the batch, so the seat reads the refusal
 * before it starts rather than rediscovering it. Inventing a stricter rule in a
 * derived reader is how six readers come to disagree again.
 *
 * ⚠ **THE RUNG LIMB IS THE ONE RULE THIS FILE ADDS, AND SINCE #1496 IT IS THE
 * SENTENCE IT SERVES RATHER THAN A STRICTER STAND-IN FOR IT.** The instruction
 * was always *never a card on a rung AHEAD of the current focus*; the rule here
 * was *never a card on a rung at all*, and `rungHoldFor` below is now the
 * narrower one the instruction actually asked for.
 *
 * **The stricter version was not laziness — it had a stated reason, and the
 * reason has been discharged rather than overruled.** It read: deriving "which
 * rung is the focus" mechanically would mean parsing PROGRAM.md prose, which is
 * a report and not an artifact (law 1). That was correct about PROGRAM.md and
 * incomplete about the sources available — but ⚠ **THE SOURCE IT THEN PICKED WAS
 * THE WRONG ONE, AND #1541 IS THAT CORRECTION.** This paragraph read *"the top
 * of his ordered band IS the focus card, and its rung is a LABEL on it"* until
 * 2026-09-30. Both halves are true and the conclusion does not follow: the top
 * of his band is whatever he asked for most recently, which is frequently not
 * milestone work, and it broke in BOTH directions inside one night — a rungless
 * tooling card on top read `null` and held nine rung cards, and #509 (`rung:N6`)
 * on top held every N2 card with the false sentence *"a later rung (N2) than the
 * focus (N6)"*. The milestone now comes from the artifact that DECLARES it,
 * `currentLadderRung` over the briefing's `program.ladder` — see its docblock in
 * `shared/crewPipelineGroups.ts` for both measurements and for why *the lowest
 * rung in his band* was rejected. **Nothing in this file names a rung.**
 *
 * ⚠ **WHAT THE STRICT RULE COST, MEASURED, is why it moved** (his word, 2026-09-29:
 * *"file it urgently we need to increase through put"*): over six consecutive
 * passes `seatCount` was **1, 0, 1, 1, 0, 1** while thirteen rung cards sat
 * held, so the entire milestone backlog ran through one agent with up to four
 * seats idle. "Cannot be wrong in the expensive direction" was true of
 * correctness and false of throughput, which is the cost nobody was counting.
 *
 * ⚠ **AND IT IS ASKED AT BOTH GATES, WHICH IS WHERE #1496's OWN BODY WAS
 * WRONG.** It cited only `orderedBandForSeats`; that function filters on
 * `ORDERED_LABEL` first, so it never sees a background card. Eleven of the
 * thirteen cards the card listed reach the lane through `seatPopulation`
 * instead — relaxing the ordered gate alone moves nothing and closes as done.
 * `pipelineGroupFor` still cannot answer this question for this population (it
 * files a switch-labelled card under `switched` before it looks at `rung:`, so
 * `#1222` reads as switch work there), which is why the predicate is local. The
 * prefix comes from `RUNG_LABEL_PREFIX` rather than the letters `rung:` typed
 * again here.
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
import { CREW_HOLD_WORD, heldStateFromLabels } from "../../shared/crewNextUpHold.js";
import { sortOrderedBand } from "../../shared/crewOrderedBand.js";
import { RUNG_LABEL_PREFIX, currentLadderRung } from "../../shared/crewPipelineGroups.js";
import { exclusionFor, QUEUE_EXCLUSION_REASONS, RESEARCH_LABEL } from "../../shared/crewQueueExclusions.js";
import {
  backgroundWorkAllowed,
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  homeWorkCategoryFor,
  isFixWork,
  type CrewWorkSwitchState,
} from "../../shared/crewWorkSwitches.js";

/**
 * WHAT THIS CUT NEEDS OFF THE CARD BUILD BOARD, and nothing more.
 *
 * Structurally satisfied by `CardBuildBoard` (`scripts/lib/cardBuildState.mts`),
 * which is what the caller passes. It is narrowed to two members so the arms can
 * drive this file without building a board, and so this module cannot reach for
 * the judgement itself — the whole point of #1094 being one reader.
 */
export interface SeatBuildBoard {
  /** `true` when this card must not be OFFERED to a shift as takeable work. */
  readonly holdsOffOffer: (card: number) => boolean;
  /** The phrase his page draws about this card, or `null` when nothing is happening. */
  readonly phraseFor: (card: number) => string | null;
}

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
  /**
   * The board's phrase for this card when there is one and it does not hold the
   * card off — in practice a recorded refusal. It travels into the batch so the
   * seat reads it before it starts.
   */
  readonly annotation?: string | null;
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

/**
 * THE DIRECTORIES A CARD'S NAMED PATHS LAND IN — its blast radius as the card
 * itself states it, for the pairs the Atlas cannot place (#1547).
 *
 * ⚠ **A named FILE contributes its PARENT DIRECTORY, not the file.** Two cards
 * naming two different files in one directory collide in practice — the second
 * one's build reads the first one's neighbours — and this gate exists to prevent
 * exactly that. Comparing bare filenames would call such a pair disjoint on a
 * coincidence of spelling, which is the confident-wrong reading an area exists
 * to prevent. A named DIRECTORY contributes itself.
 *
 * A last segment carrying a dot is read as a file. That is a heuristic on
 * prose and it is deliberately the conservative direction: misreading a
 * directory as a file widens the region to its parent, which holds MORE pairs
 * rather than fewer.
 */
export function touchedRegions(body: string | null | undefined): string[] {
  const regions = new Set<string>();
  for (const path of pathsNamedIn(body)) {
    const clean = path.replace(/\/+$/, "");
    if (clean === "") continue;
    const parts = clean.split("/");
    const last = parts[parts.length - 1]!;
    const region = last.includes(".") && parts.length > 1 ? parts.slice(0, -1).join("/") : clean;
    if (region !== "") regions.add(region);
  }
  return [...regions].sort();
}

/** Two regions overlap when they are the same directory, or one contains the other. */
function regionsOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/** What `pairDisjointOnPaths` answers. */
export interface PairPathVerdict {
  /** `true` only when BOTH cards named files and no region of either touches the other's. */
  readonly disjoint: boolean;
  /** The sentence the digest prints when they are not provably disjoint. */
  readonly why: string;
}

/**
 * CAN THESE TWO CARDS BE PROVEN NOT TO COLLIDE, WHEN THE ATLAS CANNOT SAY? (#1547)
 *
 * The area rule answers by product domain and is the first reader; this is the
 * second, and it is consulted **only where an area came back `null`**. Its
 * question is the one the gate actually cares about — *do these two pieces of
 * work touch the same place* — asked of the pair rather than of either card
 * alone, which is #1547's own shape: *"two cards whose areas are both unknown
 * may still be provably disjoint on their FILE SETS, which is what the collision
 * actually is. The Atlas is not the only reader of a path."*
 *
 * ⚠ **IT FAILS CLOSED ON SILENCE, AND THAT IS THE WHOLE DIFFERENCE BETWEEN A
 * PROOF AND A HOPE.** A card that names no path at all has said nothing about
 * where it works, so it is HELD — exactly as an unknown area is held today. The
 * gate only ever converts *"unknown, so held"* into *"offered"* when there is
 * something positive to read.
 *
 * ⚠ **ITS STATED LIMIT: a card's named paths are not the complete set of files
 * its build will touch.** So is an area's — an area is derived from the same
 * named paths, one grain coarser — so this is not a new class of risk, it is the
 * existing one read at finer grain, and it is why this never overrides a known
 * area. The remedy for the residue is the claim rule, and the measured cost of a
 * duplicate is one wasted seat (#1547).
 */
export function pairDisjointOnPaths(
  focus: { readonly number: number; readonly body?: string | null },
  candidate: { readonly body?: string | null },
): PairPathVerdict {
  const focusRegions = touchedRegions(focus.body);
  const candidateRegions = touchedRegions(candidate.body);
  if (focusRegions.length === 0) {
    return {
      disjoint: false,
      why: `the focus card #${focus.number} names no area and no files, so nothing can be proven to sit clear of it — held`,
    };
  }
  if (candidateRegions.length === 0) {
    return {
      disjoint: false,
      why: "it names no area and no files, so it cannot be proven to sit clear of the focus card — held",
    };
  }
  for (const mine of candidateRegions) {
    for (const theirs of focusRegions) {
      if (regionsOverlap(mine, theirs)) {
        const shared = mine === theirs ? mine : `${mine} and ${theirs}`;
        return { disjoint: false, why: `it shares ${shared} with the focus card #${focus.number} — held` };
      }
    }
  }
  return { disjoint: true, why: "" };
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

/** Every rung this card's labels name — usually none or one. */
function rungsNamedBy(labels: readonly string[]): string[] {
  return labels
    .filter((label) => label.startsWith(RUNG_LABEL_PREFIX))
    .map((label) => label.slice(RUNG_LABEL_PREFIX.length));
}

/**
 * THE MILESTONE RUNG A SEAT MAY BUILD — read off the ladder he has declared,
 * never off whichever card sits on top of his band (#1541, 2026-09-30).
 *
 * Give it the briefing's `program.ladder`; it hands back the rung marked
 * `current`, or `null` when the ladder names none, names two, or is unreadable.
 * `null` holds every rung card, which is THE MILESTONE GATE's own direction.
 *
 * ⚠ **THE ARGUMENT AND BOTH MEASUREMENTS LIVE ON `currentLadderRung`** in
 * `shared/crewPipelineGroups.ts`, with the rejected alternative and the reason.
 * This wrapper exists so the seat gate names one function whatever the ladder's
 * shape becomes, and so the CLI's call site reads as the question it is asking.
 *
 * ⚠ **IT DELIBERATELY DOES NOT VALIDATE A CANDIDATE CARD'S RUNG AGAINST THE
 * LADDER'S KEYS, and `rungHoldFor` must not start doing so.** `rung:N2c` is a
 * real label on a real open card (#1469) and **N2c is not in the ladder at
 * all** — so a reader that validated it would call that card RUNGLESS and hand
 * it to a seat, which is the milestone gate failing open on the exact rung he
 * has not opened yet. `rungsNamedBy` stays raw: an unknown rung is still a rung.
 */
export function focusRungFromLadder(
  ladder: readonly { readonly key?: unknown; readonly state?: unknown }[] | null | undefined,
): string | null {
  return currentLadderRung(ladder);
}

/**
 * MAY A SEAT BE OFFERED THIS RUNG CARD? — one predicate, asked by both gates
 * (#1496, his word: *"file it urgently we need to increase through put"*).
 *
 * Returns the hold sentence, or `null` when the card may be offered.
 *
 * # Why the rule changed
 *
 * It used to be *never a card on a rung at all*, and that serialised the whole
 * milestone backlog through one agent while up to four seats sat idle: measured
 * over six consecutive passes, `seatCount` was 1, 0, 1, 1, 0, 1. Most rung
 * cards today are independent slices that share nothing but the label — a Sign
 * box, a prompt tightening, a judge axis — and the independence and area gates
 * below already answer whether two of them can run side by side.
 *
 * # ⚠ AND WHY IT IS *EQUALS THE FOCUS RUNG*, NOT *DROP THE CLAUSE*
 *
 * Dropping it outright would let a seat start **N3 tonight**. Open at the time
 * this was written: `rung:N2` 13, `rung:N2b` 1, `rung:N2c` 1, `rung:N3` 10,
 * `rung:N4` 1, `rung:N4b` 1, `rung:N6` 3, `rung:N8` 1 — and THE MILESTONE GATE
 * (`PROGRAM.md`) says completing a milestone never authorises starting the next
 * one; N2b and N2c open on his word after N2 closes, and nothing else does.
 * This clause is the gate's only mechanical expression on the seat lane.
 *
 * # EVERY rung label must match, not merely one
 *
 * A card tagged both `rung:N2` and `rung:N3` is held. Fail closed is the
 * milestone gate's own direction, and the alternative lets a later rung in
 * through a second label nobody looked at.
 *
 * # No focus ⇒ every rung card held
 *
 * An empty or unreadable ordered band must not open the seat lane to every rung
 * on the ladder. Same direction as the master-switch arm in
 * `orderedBandForSeats`: the reading that cannot be trusted stops the seats
 * rather than freeing them.
 *
 * # ⚠ EXCEPT ON A FIX, WHERE A RUNG LABEL IS A LOCATOR AND NOT A CLAIM (#1553)
 *
 * **The rung label on a `bug` or `small-fix` card says WHOSE TERRITORY the fix
 * lives in — which rung's completion card should mention it — not that the fix
 * is that milestone's work.** This function could not tell the two apart, so a
 * defect on a live surface became unbuildable the moment somebody labelled it
 * helpfully. Read at `.agents/shift-logs/seat-plan-20260930-113014.json`, the
 * first pass after #1544, three of his own fixes were held in one pass:
 *
 * | card | held sentence | what it actually was |
 * |---|---|---|
 * | #1542 | *on rung N6, and the milestone is N2* | a server saying "reporting to Sentry" while nothing arrived |
 * | #1537 | *on rung N8, and the milestone is N2* | a live route calling a model Google shut down 2026-06-25 |
 * | #1420 | *on rung N6, and the milestone is N2* | the crash report nobody could read — he had added the token that morning |
 *
 * Not one of the three adds a feature, and **MAINTENANCE MODE says exactly this
 * work runs with NO focus at all.** The instances were freed by hand the same
 * day, by stripping the labels; this is the class.
 *
 * ⚠ **AND IT IS ASKED FIRST, BEFORE THE NO-FOCUS BRANCH, WHICH IS THE ONLY
 * PLACE IT CAN GO.** Maintenance mode is precisely the state where no focus
 * exists — a fix exempted only once a focus is named would still be frozen on
 * exactly the nights the founder's law says it should run.
 *
 * ⚠ **WHAT IT DOES NOT OPEN, AND THE MILESTONE GATE IS UNTOUCHED BY IT.** A
 * feature-shaped card carries `design-unbuilt` or `roadmap` and no work label,
 * so `isFixWork` answers false and the hold stands — in the ORDERED band, where
 * a rung card usually has no work label at all, this exemption changes nothing
 * whatsoever. What guards a feature card MISLABELLED `bug` is not this gate: it
 * is the Retro's double-label reading and his own one-work-label-per-card rule,
 * which is where a wrong label is a wrong label rather than a hole here.
 */
export function rungHoldFor(
  labels: readonly string[],
  focusRung: string | null,
): string | null {
  const rungs = rungsNamedBy(labels);
  if (rungs.length === 0) return null;
  if (isFixWork(labels)) return null;
  if (focusRung === null) {
    return "on a rung, and nothing names the current focus — the milestone gate holds it";
  }
  if (rungs.every((rung) => rung === focusRung)) return null;
  /*
    ⚠ IT SAYS *NOT THE RUNG HE HAS OPENED*, NEVER *LATER* — #1541, and the old
    wording was measured false rather than merely loose. On the 20:45Z pass of
    2026-09-29 it printed *"a later rung (N2) than the focus (N6)"* on thirteen
    cards; N2 is not later than N6. Nothing here has ever compared two rungs, and
    an earlier rung is held for the same reason a later one is — it is not the
    milestone. So the sentence states the two facts it actually knows.
  */
  return `on rung ${rungs.join(", ")}, and the milestone is ${focusRung} — the milestone gate holds it; opens on his word`;
}

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
  /**
   * The rung the focus card sits on, or `null` when nothing names a focus.
   *
   * ⚠ **THIS GATE IS THE ONE THAT MATTERS AND #1496's BODY NAMED THE OTHER
   * ONE.** Measured at the labels of the thirteen cards that card listed as
   * wrongly held: **eleven of them are background work and reach the lane
   * through HERE**, not through `orderedBandForSeats`, which filters on
   * `ORDERED_LABEL` before it looks at anything else. Relaxing only the ordered
   * gate would have moved nothing and closed as done.
   */
  readonly focusRung: string | null;
  readonly switches: CrewWorkSwitchState;
  readonly board: SeatBuildBoard;
  readonly areaIndex: SeatAreaIndex;
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
    const rungHold = rungHoldFor(card.labels, input.focusRung);
    if (rungHold !== null) {
      note(rungHold);
      continue;
    }
    if (input.board.holdsOffOffer(card.number)) {
      note(input.board.phraseFor(card.number) ?? "somebody is already on it");
      continue;
    }
    takeable.push({
      ...card,
      area: resolveCardArea(card, input.areaIndex),
      annotation: input.board.phraseFor(card.number),
    });
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
const DEPENDENCY_PHRASES: readonly string[] = [
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
const DEPENDENCY_WINDOW = 90;

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
/**
 * His own label on a card he asked for by name, from the queue's own vocabulary.
 *
 * ⚠ **EXPORTED because the CLI needs it too and typed it again** (review of
 * 2026-09-26): `cut-seat-batches.mts` had `const ORDERED_LABEL = "founder-ordered"`
 * beside a library that derives it, which is working law 4 inside one feature.
 */
export const ORDERED_BAND_LABEL: string = QUEUE_EXCLUSION_REASONS.find((reason) => reason.key === "ordered")!.queueLabel;
const ORDERED_LABEL = ORDERED_BAND_LABEL;

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
  readonly board: SeatBuildBoard;
  readonly areaIndex: SeatAreaIndex;
  readonly switches: CrewWorkSwitchState;
  readonly independenceOf: (card: SeatCandidateCard) => IndependenceReading;
  /**
   * The rung he has opened, from `focusRungFromLadder` — `null` holds every rung
   * card.
   *
   * ⚠ **IT IS AN INPUT NOW AND WAS DERIVED FROM `focus` UNTIL #1541.** This
   * function used to call `focusRungOf(focus)` on its own top card, so the
   * milestone changed whenever he added an ordered card — measured twice in one
   * night, both directions, both in `currentLadderRung`'s docblock. The two gates
   * must also apply the SAME milestone: while each derived its own there was
   * nothing to stop them diverging, and this one's source was the narrower.
   */
  readonly focusRung: string | null;
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

  /*
    ⚠ HIS MASTER SWITCH STOPS EVERY SEAT, INCLUDING THIS LANE (review of
    2026-09-26). Until this arm existed only `seatPopulation` asked about the
    switches, so a pass with background work switched OFF still cut seats loaded
    with his ordered cards — and the fail-closed `{}` an unreadable switch table
    produces read the same way. The switch is his answer to "should the crew be
    working by itself right now", and that question does not change because the
    card is one he named.

    It reads the MASTER alone, keyed on the shared constant: a category switch
    says which BAND of background work may run, and an ordered card is in no
    band. Absent ⇒ false, so an unreadable table stops the seats.
  */
  if (!(input.switches[CREW_WORK_MASTER_KEY] ?? false)) {
    return {
      focus: null,
      offered: [],
      held: input.cards
        .filter((card) => card.labels.includes(ORDERED_LABEL))
        .map((card) => ({ number: card.number, title: card.title, why: "your background-work switch is off, so no seat runs" })),
    };
  }

  /* Takeable first, in his order, so "the top card" means the top card a shift
     could actually start — the focus lane's own rule. */
  const takeable: SeatCandidateCard[] = [];
  for (const row of sortOrderedBand(band)) {
    const card = row.card;
    const note = (why: string) => held.push({ number: card.number, title: card.title, why });
    /*
      ⚠ **A PROPOSAL IS NOT WORK, AND THIS LANE IS THE ONE `exclusionFor` NEVER
      REACHES (#1548).** `seatPopulation` above asks the exclusion vocabulary
      about every background card, and `research` is its first row — so a
      proposal that also carried a work label was already held there. This band
      filters on `founder-ordered` and then asks only about parking, holds and
      the build board, so a card carrying `research` + `founder-ordered` would
      have been offered to a seat as tonight's work.

      It should never exist: the relay's scope note on #1548 says an approved
      proposal is filed WITHOUT this label, as ordinary work opening *"Approved
      by Michael on the Notion desk"*. That is exactly why the arm is here
      rather than left to the rule — the two roads into a seat must give one
      answer about one label, and the road that has no such card today is the
      road nobody will notice is missing it.
    */
    if (card.labels.includes(RESEARCH_LABEL)) {
      note("a research proposal — it is decided on your Notion desk, never built by a seat");
      continue;
    }
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
    if (input.board.holdsOffOffer(card.number)) {
      note(input.board.phraseFor(card.number) ?? "somebody is already on it");
      continue;
    }
    takeable.push(card);
  }

  const [top, ...rest] = takeable;
  if (top === undefined) return { focus: null, offered: [], held };

  const focus: SeatTakeableCard = {
    ...top,
    area: resolveCardArea(top, input.areaIndex),
    annotation: input.board.phraseFor(top.number),
  };
  held.push({
    number: top.number,
    title: top.title,
    why: "the top of NEXT UP — the focus shift takes it, never a seat",
  });

  /* The milestone, handed in by the caller from the ladder he declared — NOT
     read off `focus` above. See `focusRung` on the input type. */
  const focusRung = input.focusRung;

  const offered: SeatTakeableCard[] = [];
  for (const card of rest) {
    const note = (why: string) => held.push({ number: card.number, title: card.title, why });
    const rungHold = rungHoldFor(card.labels, focusRung);
    if (rungHold !== null) {
      note(rungHold);
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
    if (area !== null && focus.area !== null) {
      /* Both placed: the Atlas answers, exactly as it has since 2026-09-26. */
      if (area === focus.area) {
        note(`same area as the focus card (${area}) — held`);
        continue;
      }
    } else {
      /*
        ⚠ ONE OF THE TWO AREAS IS UNKNOWN, SO THE PAIR IS JUDGED ON THE FILES
        (#1547). This read `no area named … — held` and, for the focus card's
        side, `the focus card #N names no area … — held`, and both sentences are
        sound about what an area can prove. What was wrong is that they were the
        LAST word: an unknown area ended the enquiry, so a single rungless
        tooling card on top of his band held every ordered candidate behind it
        and the seat lane cut `seatCount 0`. Measured the night this landed —
        `#1467` on top, `#1545` behind it, four seats idle.

        The Atlas is a PRODUCT map and its silence is often honest rather than
        missing: it files all five `server/crew/` modules as `unassigned`, and it
        maps no `scripts/`, `docs/`, `.github/` or `.githooks/` module at all,
        while `pathsNamedIn` deliberately extracts paths under every one of
        those roots. So *"this card named no area"* was frequently false of a
        card that had named several paths — it was the Atlas that had no domain
        for them, which is a different fact and a weaker one.
      */
      const proof = pairDisjointOnPaths(focus, card);
      if (!proof.disjoint) {
        note(proof.why);
        continue;
      }
    }
    offered.push({ ...card, area, annotation: input.board.phraseFor(card.number) });
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
 * ⚠ **AND IT IS CAPPED A THIRD TIME, BY HOW MANY NON-EMPTY BATCHES CAN EXIST
 * (review of 2026-09-26).** The arithmetic alone sizes the pass before the cards
 * are grouped, and a domain group is never split — so six casting cards at
 * `batchSize 2` sized THREE seats and filled one: `[6, 0, 0]`, and the runner
 * launched two Opus sessions with nothing to do. The ceiling is the number of
 * buckets that can be filled at all: one per area group, plus one per card that
 * names no area (those CAN be split), plus one per ordered card. Empty buckets
 * are then dropped and the seats renumbered, so `seatCount` is what was really
 * cut and `server/seatBatches.test.ts` holds it to never being empty.
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

  /* The groups FIRST, because how many batches can be non-empty depends on them. */
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
  /* One bucket per area group (never split), one per arealess card (splittable),
     one per ordered card. Past this every extra bucket is provably empty. */
  const fillable = grouped.size + arealess.length + ordered.length;
  const seatCount = Math.max(1, Math.min(Math.ceil(total / batchSize), maxSeats, fillable));
  const buckets: SeatTakeableCard[][] = Array.from({ length: seatCount }, () => []);

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
        /* ⚠ `card.area` IS REACHABLY NULL SINCE #1547 and this printed the word
           `null` at him. An ordered card the Atlas cannot place now reaches here
           on a file-set proof, and `placed.area === card.area` is true of two
           unplaced cards, so the no-bucket exit is exactly where it lands. */
        why:
          card.area === null
            ? "every seat this pass already holds a card whose area could not be placed — held for the next pass"
            : `every seat this pass already holds ${card.area} work — held for the next pass`,
      });
      continue;
    }
    chosen.bucket.push(card);
  }

  /* ⚠ EMPTY BUCKETS ARE DROPPED AND THE SEATS RENUMBERED. The cap above makes
     one unlikely; dropping them is what makes "a seat is never launched with
     nothing" true rather than probable. */
  const batches: SeatBatch[] = buckets
    .filter((bucket) => bucket.length > 0)
    .map((bucket, index) => ({
      seat: index + 1,
      areas: [...new Set(bucket.map((card) => card.area).filter((area): area is string => area !== null))].sort(),
      cards: [...bucket].sort(compareWithinBatch),
    }));

  /* ⚠ `cardCount` IS WHAT WAS HANDED OUT, not what was considered (review of
     2026-09-26): it read `total`, which includes every ordered card the area
     rule then held, so the runner printed `cards 3` for a pass that handed 2. */
  const cardCount = batches.reduce((sum, batch) => sum + batch.cards.length, 0);
  return { seatCount: batches.length, batches, cardCount, held };
}

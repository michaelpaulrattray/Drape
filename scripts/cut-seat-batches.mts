/**
 * CUT ONE PASS'S SEAT BATCHES — the runner's one reader, and the only thing in
 * #1281 that touches the world.
 *
 *     npx tsx scripts/cut-seat-batches.mts --max-seats 4 --batch-size 5 --out plan.json
 *
 * It prints ONE machine-readable line on stdout and the plan as JSON to `--out`:
 *
 *     SEATS 2 | cards 9 | areas casting, boards | jev 3 asks | $0.0001
 *     SEATS 0 | nothing on offer
 *
 * `.agents/foreman/foreman-runner.ps1` reads that line, launches that many
 * seats, and hands each one its batch out of the JSON. Every seat's cards come
 * from here, so the population is read ONCE per pass by ONE reader — never once
 * per seat, which is how eight seats on one GitHub account tripped the burst
 * limit four times on 2026-09-26.
 *
 * # ⚠ WHICH WORLD, AND WHY IT MATTERS MORE HERE THAN ANYWHERE
 *
 * His background-work switches live in `crew_work_switches` on PRODUCTION —
 * that is the panel he touches. A plain local run reads `.env`'s dev database,
 * where the table may not exist or may hold stale positions, and would hand
 * seats work he had switched OFF. So the runner calls this under
 * `railway.cmd run --service MySQL --`, and **an unreadable switch table reads
 * as OFF** (`crew-shift-start.mts`'s own bar: *"the switch table does not exist
 * in this world yet, which reads OFF"*).
 *
 * # EVERY FAILURE DIRECTION IS "NO SEATS"
 *
 * `SEATS 0` is exactly today's behaviour — the focus shift alone — so an
 * unreadable queue, an unreadable switch table, a missing Atlas or a thrown
 * anything costs the team nothing but the seats it might have launched. The
 * opposite direction is a pass handing four seats work he had turned off, or
 * work somebody is already building. Nothing here fails open.
 *
 * # WHAT IT READS, AND HOW OFTEN
 *
 *  - the open cards: one `gh issue list` (or `--cards <file>`);
 *  - **who is already building what: `buildBoard`** — `scripts/lib/cardBuildState.mts`,
 *    *"the ONE reader every queue reader consults"* (#1094 piece 2), which owns
 *    all three halves of that read (`readOpenPullRequests` + `readCardComments` +
 *    `readNotBuiltCards`, the refusal label of #1337) and keeps *the board was
 *    not read* apart from *the board is clean*. This cut is the sixth reader to
 *    consult it and it adds no read of its own;
 *  - his switches: one query (or `--switches <file>`);
 *  - the Atlas: the file on disk. Never generated here.
 *
 * ⚠ **AN UNREADABLE BOARD DOES NOT WITHHOLD A CARD — IT CANCELS THE PASS'S
 * SEATS.** `buildBoard`'s own direction is that a failed read never hides work
 * (`unreadable` travels out for the renderer to say). That is right for a reader
 * that OFFERS cards to a person; it is wrong here, because the thing being
 * handed out is four autonomous sessions, and the measured cost of a duplicate
 * is a wasted seat and a conflicting branch. So this cut prints the board's
 * `unreadable` reasons and refuses: SEATS 0, the focus shift alone, which is
 * exactly today's behaviour.
 *
 * # ⚠ AND SINCE #1658 A MANAGER MAY HAVE ANSWERED THE SOFT READINGS FIRST
 *
 *     --facts .agents/shift-logs/manager-<stamp>.json --pass <stamp>
 *
 * Founder-ordered 2026-10-01: *"you code it into the crew so an opus manager runs
 * and checks them all before the cut is made"* — *"we cant keep guessing
 * things."* `--facts` is the sheet an Opus manager session produced before this
 * cut ran, and `--pass` is the stamp it must belong to. Where it has a row for a
 * card, `area` replaces `resolveCardArea`, `collidesWith` replaces the area
 * equality and the file-set proof, `dependsOn` replaces `readIndependence`, and
 * `ready: "no"` adds a hold.
 *
 * ⚠ **`--facts` IS THE ONE INPUT HERE THAT NEVER REFUSES THE PASS.** Missing,
 * unparseable, stale or partial, the sheet is dropped, the reason is printed on
 * the verdict line and recorded in the plan's `manager` block, and the cut runs
 * exactly as it did before this card. That asymmetry against the Atlas above is
 * deliberate and it is stated at the read: the Atlas is load-bearing (no Atlas,
 * no areas at all), while the sheet improves readings that already work, so
 * losing it must cost the pass only the improvement.
 *
 * ⚠ **JEV IS STILL ASKED, AS A CONTROL, AND THE MANAGER STILL WINS.** The card's
 * §3 keeps Jev's dependency reading for one week logged beside the manager's, and
 * his decision to retire or keep it rests on the measured disagreement rate — so
 * the ask happens BEFORE the overlay, independently, and both answers go into the
 * plan's `managerVsJev`. A control computed after seeing the answer it checks is
 * not a control.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { readOpenPullRequests } from "./lib/cardClaimWarning.mts";
import { buildBoard, readCardComments, readNotBuiltCards } from "./lib/cardBuildState.mts";
import {
  managerRowsByCard,
  readManagerSheet,
  type ManagerCardRow,
} from "./lib/managerFactSheet.mts";
import {
  jevSeatAsk,
  type JevSeatReading,
  type SeatCardForReading,
} from "./lib/jevSeatBatching.mts";
import {
  buildAreaIndex,
  citedOpenCards,
  cutSeatBatches,
  ORDERED_BAND_LABEL,
  focusRungFromLadder,
  managerIndependence,
  orderedBandForSeats,
  readIndependence,
  seatPopulation,
  type IndependenceReading,
  type SeatAreaIndex,
  type SeatCandidateCard,
  type SeatManagerFacts,
  type SeatSkippedCard,
  type SeatTakeableCard,
} from "./lib/seatBatches.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import { findCardCollisions } from "../shared/crewShiftState.js";
import { jevSpendUsd } from "./lib/jev.mjs";
import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  type CrewWorkSwitchState,
} from "../shared/crewWorkSwitches.js";

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: [
    "max-seats",
    "batch-size",
    "out",
    "cards",
    "open-prs",
    "switches",
    "shift-runs",
    "comments",
    "not-built",
    "atlas",
    "briefing",
    /* #1658 — the manager's fact sheet, and the pass it must belong to. */
    "facts",
    "pass",
  ],
  boolean: ["no-jev", "quiet"],
});

/** Twenty seconds, `cardClaimWarning`'s own number for a `gh` read. */
const GH_READ_TIMEOUT_MS = 20_000;

function refuse(message: string): never {
  console.error(`cut-seat-batches: REFUSING — ${message}`);
  console.log("SEATS 0 | the cut refused");
  process.exit(1);
}

function readNumber(name: string): number {
  const raw = ARGS.value(name);
  if (raw === null) refuse(`--${name} is required (the runner's own founder number)`);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) refuse(`--${name} must be a positive whole number, got "${raw}"`);
  return parsed;
}

function readJsonFile<T>(path: string, what: string): T {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
  } catch (error) {
    refuse(`${what} at ${path} could not be read (${error instanceof Error ? error.message : String(error)})`);
  }
}

/* ── THE OPEN CARDS ────────────────────────────────────────────────────────── */

type GhLabel = { readonly name?: string };
type GhIssueRow = {
  readonly number?: number;
  readonly title?: string;
  readonly body?: string | null;
  readonly createdAt?: string | null;
  readonly labels?: readonly GhLabel[] | readonly string[];
};

function labelNames(row: GhIssueRow): string[] {
  const labels = row.labels ?? [];
  return labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name): name is string => typeof name === "string" && name !== "");
}

function readOpenCards(): SeatCandidateCard[] {
  const fixture = ARGS.value("cards");
  const rows: GhIssueRow[] = fixture
    ? readJsonFile<GhIssueRow[]>(fixture, "the card fixture")
    : (() => {
      try {
        const out = execFileSync(
          "gh",
          ["issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,body,labels,createdAt"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: GH_READ_TIMEOUT_MS },
        );
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        refuse(`the open cards could not be read (${error instanceof Error ? error.message : String(error)})`);
      }
    })();
  if (!Array.isArray(rows)) refuse("the card list is not an array");
  return rows
    .filter((row): row is GhIssueRow & { number: number } => Number.isSafeInteger(row.number) && (row.number ?? 0) > 0)
    .map((row) => ({
      number: row.number,
      title: typeof row.title === "string" ? row.title : "",
      labels: labelNames(row),
      body: typeof row.body === "string" ? row.body : "",
      createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    }));
}

/* ── HIS SWITCHES, AND WHO IS ALREADY SITTING ON A CARD ────────────────────── */

/** One open row of `crew_shift_runs`, shaped for `findCardCollisions`. */
type OpenShiftRun = { readonly cardRef: string | null; readonly shift: string };

/**
 * ONE DATABASE READ, TWO FACTS, AND THE SECOND ONE CLOSES A REAL HOLE.
 *
 * The switches are his panel. The open shift ROWS are the other half, and the
 * review of 2026-09-26 is the reason they are here: the board reads open pull
 * requests and card comments, and **pass N+1 can cut before seat N's `CLAIMED —`
 * comment has landed** — a seat claims within its first minute, but a pass cuts
 * in seconds. A row, by contrast, is written by `crew-shift-start.mts` BEFORE a
 * line of code (#272's whole argument) and `findCardCollisions` is the reader
 * that script already uses for exactly this question, so a card named by an open
 * row is not on offer here either.
 *
 * ⚠ **WHERE THE CLAIM IS WRITTEN, said plainly because nothing in this file
 * writes one.** Two artifacts, in this order, both by the SEAT and neither by
 * the runner: (1) its shift row, opened with `--shift <its own id> --card '#N'`,
 * which `crew-shift-start.mts` REFUSES when an open row already names that card
 * (#608) — that refusal is the mechanical lock, not a convention; (2) its
 * `CLAIMED — <seat>, <UTC>` comment, which the standing orders and the seat brief
 * put before any build and which the board reads for twelve hours. The runner's
 * brief tells the seat to do both before it builds, and the row's own refusal is
 * what makes the first one stick.
 *
 * `--shift-runs <file.json>` feeds a fixture instead of the database, which is
 * what makes the arm drivable without one.
 */
async function readWorld(): Promise<{ switches: CrewWorkSwitchState; openRuns: OpenShiftRun[] }> {
  const switchFixture = ARGS.value("switches");
  const runsFixture = ARGS.value("shift-runs");
  const fixedRuns = runsFixture ? readJsonFile<OpenShiftRun[]>(runsFixture, "the shift-run fixture") : null;
  if (switchFixture) {
    return {
      switches: readJsonFile<CrewWorkSwitchState>(switchFixture, "the switch fixture"),
      openRuns: fixedRuns ?? [],
    };
  }
  try {
    await import("dotenv/config");
    const { openDatabase, resolveDatabaseUrl } = await import("./lib/dbConnection.mts");
    const url = resolveDatabaseUrl();
    if (!url) refuse("no database URL, so his switches cannot be read — reads OFF");
    const conn = await openDatabase(url);
    try {
      const [present] = await conn.query<any[]>("SHOW TABLES LIKE 'crew_work_switches'");
      /* His bar, verbatim from `crew-shift-start.mts`: an absent table reads OFF.
         With no switches nothing is on offer, so the rows need not be read. */
      if (present.length !== 1) return { switches: {}, openRuns: fixedRuns ?? [] };
      const [rows] = await conn.query<any[]>("SELECT switchKey, enabled FROM `crew_work_switches`");
      const switches: Record<string, boolean> = {};
      for (const row of rows) switches[String(row.switchKey)] = Boolean(row.enabled);

      let openRuns: OpenShiftRun[] = fixedRuns ?? [];
      if (fixedRuns === null) {
        const [runTable] = await conn.query<any[]>("SHOW TABLES LIKE 'crew_shift_runs'");
        if (runTable.length !== 1) {
          refuse("`crew_shift_runs` does not exist in this world, so a seat already sitting on a card cannot be seen");
        }
        const [runRows] = await conn.query<any[]>(
          "SELECT shift, cardRef FROM `crew_shift_runs` WHERE endedAt IS NULL",
        );
        openRuns = runRows.map((row) => ({
          shift: String(row.shift),
          cardRef: row.cardRef === null || row.cardRef === undefined ? null : String(row.cardRef),
        }));
      }
      return { switches, openRuns };
    } finally {
      await conn.end();
    }
  } catch (error) {
    refuse(`the crew tables could not be read (${error instanceof Error ? error.message : String(error)}) — reads OFF`);
  }
}

/* ── THE CUT ───────────────────────────────────────────────────────────────── */

const maxSeats = readNumber("max-seats");
const batchSize = readNumber("batch-size");
const atlasPath = ARGS.value("atlas") ?? "docs/architecture/drape-architecture.json";
const atlas = readJsonFile<{ modules?: readonly { path?: string | null; domain?: string | null }[] }>(
  atlasPath,
  "the Atlas",
);
if (!Array.isArray(atlas.modules) || atlas.modules.length === 0) {
  refuse(`the Atlas at ${atlasPath} lists no modules, so no area can be resolved`);
}
const areaIndex: SeatAreaIndex = buildAreaIndex(atlas.modules);

/*
  ── THE MILESTONE, FROM THE LADDER HE DECLARED (#1541) ───────────────────────

  The rung marked `current` in `server/crew/crew-briefing.json` is the one
  artifact that says which milestone is open. It is written only when a shift
  records his word, it is schema-validated, and he sees it on his own page — so
  it cannot advance itself the way *the lowest rung in his band* would. Both gates
  below are handed THIS value; neither derives its own any more.

  ⚠ **AN UNREADABLE BRIEFING DOES NOT REFUSE THE PASS, unlike the Atlas above,
  and the difference is deliberate.** Without the Atlas no card has an area, so
  nothing can be handed out at all and `refuse` is honest. Without the ladder the
  area and independence machinery still works: the milestone reads `null`, every
  rung card is held, and non-rung switch work is still offered — which is exactly
  the behaviour of a pass with the focus cleared. Refusing here would turn a
  missing file into zero seats when it should cost only the rung lane.

  ⚠ **It is the WORKING TREE's briefing, not production's.** That is the right
  one: the seats build in this tree, and a shift that records his word opening a
  rung edits this file in the same commit that ships the edition. A production
  read would also put a network call on the one path that must not fail open.
*/
const briefingPath = ARGS.value("briefing") ?? "server/crew/crew-briefing.json";
let ladder: readonly { readonly key?: unknown; readonly state?: unknown }[] | null = null;
let ladderNote = "";
try {
  const briefing = JSON.parse(readFileSync(resolve(briefingPath), "utf8")) as {
    program?: { ladder?: readonly { readonly key?: unknown; readonly state?: unknown }[] };
  };
  ladder = briefing.program?.ladder ?? null;
} catch (error) {
  ladderNote = `the ladder at ${briefingPath} could not be read (${error instanceof Error ? error.message : String(error)}) — every rung card is held`;
}
const focusRung = focusRungFromLadder(ladder);
if (focusRung === null && ladderNote === "") {
  ladderNote = `${briefingPath} names no single rung as \`current\` — every rung card is held until it does`;
}

const cards = readOpenCards();
const nowMs = Date.now();

/*
  ── THE MANAGER'S FACT SHEET (#1658, founder-ordered 2026-10-01) ──────────────

  An Opus manager session reads every open card and pull request before this cut
  runs and leaves a sheet; `scripts/lib/managerFactSheet.mts` owns its shape, its
  validation and the four states that make it unusable. Where it has a row for a
  card, its readings replace the prose guessing below: `area` replaces
  `resolveCardArea`, `collidesWith` replaces the area equality and the file-set
  proof, `dependsOn` replaces `readIndependence`, and `ready: "no"` adds a hold.

  ⚠ **FAILS TOWARD TODAY, AND THAT IS A SINGLE EXPRESSION RATHER THAN A HABIT.**
  Missing, unparseable, stale or partial — every one yields `managerFacts =
  undefined`, and every function in the library behaves as it did before this
  card. The REASON is recorded in the plan and on the stdout line, because *the
  manager did not run* and *the manager answered half the queue* are different
  facts about a pass and the first week of this feature is judged on them.

  ⚠ **AND IT IS DELIBERATELY NOT A `refuse`.** The Atlas refuses the pass because
  without it nothing has an area at all; the sheet is an improvement on readings
  that already work, so losing it must cost the pass only the improvement.
*/
const factsPath = ARGS.value("facts");
const passStamp = ARGS.value("pass");
let managerFacts: SeatManagerFacts | undefined;
let managerRows: ReadonlyMap<number, ManagerCardRow> = new Map();
let managerNote: string | null = null;
let managerState = "not asked";
let managerSheetReadAt: string | null = null;
let managerModel: string | null = null;
let managerCostUsd: number | null = null;
if (factsPath !== null) {
  if (passStamp === null || passStamp.trim() === "") {
    /* The pass stamp is what makes `stale` detectable, so a sheet offered
       without one is not usable even if the file is perfect. */
    managerState = "stale";
    managerNote = "--facts was given without --pass, so the sheet cannot be proven to belong to this pass";
  } else {
    let raw: string | null = null;
    try {
      raw = readFileSync(resolve(factsPath), "utf8");
    } catch {
      raw = null;
    }
    const verdict = readManagerSheet({ raw, pass: passStamp.trim(), nowMs });
    if (verdict.kind === "usable") {
      managerRows = managerRowsByCard(verdict.sheet);
      managerFacts = { rowFor: (card: number) => managerRows.get(card) };
      managerState = "usable";
      managerSheetReadAt = verdict.sheet.readAt;
      managerModel = verdict.sheet.model;
      managerCostUsd = verdict.sheet.costUsd;
    } else {
      managerState = verdict.state;
      managerNote = verdict.why;
    }
  }
}

/*
  THE BOARD, read ONCE per pass through the owner of that read. Both halves are
  asked for explicitly so an unreadable one can be NAMED: `buildBoard` keeps
  "clean" and "not read" apart, and this caller is the one that must refuse on
  the second rather than carry on.
*/
const prRows = readOpenPullRequests(ARGS.value("open-prs"));
const commentFacts = readCardComments(ARGS.value("comments"), null, nowMs);
const notBuiltRows = readNotBuiltCards(ARGS.value("not-built"));
const board = buildBoard({
  openPullRequests: prRows ?? { unreadable: "`gh pr list` could not be read (absent, unauthenticated, offline or slow)" },
  comments: commentFacts ?? { unreadable: "the card comments could not be read, so a live claim cannot be ruled out" },
  /* THE THIRD HALF (#1337) — the `not-built` label, which is a refusal's durable
     home and the one the comment window above cannot see past. */
  notBuilt: notBuiltRows ?? { unreadable: "the refused cards could not be read, so a refusal older than the comment window is invisible" },
  nowMs,
});
if (board.partial) {
  refuse(`the board was not fully read, so a card somebody is on could read as free: ${board.unreadable.join("; ")}`);
}

const world = await readWorld();
const switches = world.switches;

/* The population the independence reading has to look at: every card carrying a
   switch label or his own. Far fewer than the queue, and it is the same set the
   batches are cut from. */
/* Derived, never retyped: the library reads it out of the queue's own
   vocabulary and this CLI asks the library (review of 2026-09-26). */
const ORDERED_LABEL = ORDERED_BAND_LABEL;
const SWITCH_LABELS: readonly string[] = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);
const inBand = cards.filter((card) =>
  card.labels.includes(ORDERED_LABEL) || card.labels.some((label) => SWITCH_LABELS.includes(label)));

/*
  A CARD AN OPEN SHIFT ROW ALREADY NAMES IS NOT ON OFFER — the cross-pass half
  (review of 2026-09-26). `findCardCollisions` is the reader `crew-shift-start.mts`
  uses for this question, and it normalises `#608` / `608` / `#0608` to one card,
  so a seat that wrote its row with a bare number still collides.
*/
const sittingOn: SeatSkippedCard[] = [];
const candidates = inBand.filter((card) => {
  const collisions = findCardCollisions(world.openRuns, `#${card.number}`);
  if (collisions.length === 0) return true;
  sittingOn.push({
    number: card.number,
    title: card.title,
    why: `a seat is sitting on it right now (${collisions.map((run) => run.shift).join(", ")})`,
  });
  return false;
});
const openCardNumbers = cards.map((card) => card.number);

/* ── THE INDEPENDENCE READING, MECHANICAL FIRST, JEV ONLY WHERE SILENT ─────── */

const jev = ARGS.flag("no-jev")
  ? null
  : jevSeatAsk({ domains: areaIndex.domains });

const mechanical = new Map<number, IndependenceReading>();
for (const card of candidates) {
  /* The BODY is what the mechanical reading sees. The board's facts are claims
     and refusals, not prose, so a dependency sentence living only in a comment is
     the one thing this reading cannot see — stated rather than implied, and Jev
     is not shown what the reader could not read either. */
  mechanical.set(card.number, readIndependence({
    card: card.number,
    body: card.body,
    openCards: openCardNumbers,
  }));
}

/** Filled by the Jev pass below; `orderedBandForSeats` reads it. */
const resolvedIndependence = new Map<number, IndependenceReading>(mechanical);

if (jev !== null) {
  for (const card of candidates) {
    if (!card.labels.includes(ORDERED_LABEL)) continue;
    const reading = mechanical.get(card.number);
    if (reading?.kind !== "unclear") continue;
    const ask: SeatCardForReading = {
      number: card.number,
      title: card.title,
      body: card.body,
      cites: citedOpenCards(card.body ?? "", openCardNumbers, card.number),
    };
    const verdict = await jev.dependency(ask);
    if (verdict === null) break; /* Unreachable — stop asking and run mechanically. */
    if (verdict.kind === "independent") resolvedIndependence.set(card.number, { kind: "independent" });
  }
}

/*
  ── THE MANAGER'S DEPENDENCY READING WINS, AND JEV STAYS AS THE CONTROL ───────
  (#1658 §3: *"Jev's reading is kept for one week as a CONTROL, logged beside the
  manager's answer in the plan, then retired or kept on the measured disagreement
  rate."*)

  The overlay is LAST on purpose: Jev is still asked exactly as it was, so its
  answer is produced independently rather than conditioned on the manager's, and
  the comparison in the plan is between two readings of the same question. A
  control computed after seeing the answer it is checking is not a control.

  ⚠ **A `dependsOn` naming a card that is not open is DISCHARGED, not honoured.**
  `readIndependence` has always counted open cards only — a closed dependency is a
  dependency met — and a manager reading a body written weeks ago will name cards
  that have since merged. Honouring one would hold a card forever on work that is
  already done, which is the exact failure this card exists to end.
*/
type ManagerVsJevRow = {
  readonly card: number;
  readonly manager: string;
  readonly mechanical: string;
  readonly jev: string | null;
  readonly agreed: boolean;
};
const managerVsJev: ManagerVsJevRow[] = [];
const readingWord = (reading: IndependenceReading | undefined): string =>
  reading === undefined ? "none" : reading.kind === "dependent" ? `dependent on ${reading.on.join(", ")}` : reading.kind;

for (const card of candidates) {
  const managerReading = managerIndependence(managerRows.get(card.number), openCardNumbers, card.number);
  if (managerReading === null) continue;
  const before = resolvedIndependence.get(card.number);
  resolvedIndependence.set(card.number, managerReading);
  /* Logged for the ordered band only: that is the only lane Jev was ever asked
     about, so it is the only lane where a disagreement rate means anything. */
  if (card.labels.includes(ORDERED_LABEL)) {
    /* `jev.readings` is read here rather than through the `readings` const
       below, which is declared after the cut: a control must be read where it
       was produced, and hoisting the const up would put a `jev` field in the
       plan's shape before the cut that fills it. */
    const jevWord = jev === null
      ? null
      : (jev.readings.find((reading) => reading.card === card.number && reading.question === "dependency")?.answer ?? null);
    managerVsJev.push({
      card: card.number,
      manager: readingWord(managerReading),
      mechanical: readingWord(mechanical.get(card.number)),
      jev: jevWord,
      agreed: readingWord(managerReading) === readingWord(before),
    });
  }
}

const ordered = orderedBandForSeats({
  cards: candidates,
  board,
  areaIndex,
  switches,
  independenceOf: (card) => resolvedIndependence.get(card.number) ?? { kind: "unclear", cites: [] },
  focusRung,
  facts: managerFacts,
});

const background = seatPopulation({
  cards: candidates.filter((card) => !card.labels.includes(ORDERED_LABEL)),
  /*
    THE MILESTONE, so the background lane applies the same gate the ordered lane
    does (#1496) — and since #1541 it is literally the same VALUE, read once from
    the ladder above rather than derived twice.

    ⚠ **Until #1541 this read the top card's own rung, through the `focusRungOf`
    helper, and that is the defect.** (Named without its parentheses on purpose:
    the suite asserts that expression appears NOWHERE here, so that a later shift
    cannot copy it back out of a comment.) The milestone was whatever rung label
    sat on the top card of his
    band, so an ordered card he filed about tooling erased it (`null`, nine rung
    cards held) and an ordered card on a later rung replaced it (#509 at N6, every
    N2 card held). It no longer depends on `ordered` at all, so the two calls have
    no ordering requirement between them.
  */
  focusRung,
  switches,
  board,
  areaIndex,
  facts: managerFacts,
});

let takeable = [...background.takeable];
const orderedOffered = [...ordered.offered];

/* THE AREA TIE-BREAKER: only for background cards the mechanical reading left
   arealess, and only when Jev is reachable. A failure leaves the card arealess,
   which sends it to the smallest batch — exactly where it was going. */
if (jev !== null) {
  const filled: SeatTakeableCard[] = [];
  for (const card of takeable) {
    if (card.area !== null) {
      filled.push(card);
      continue;
    }
    /*
      ⚠ AND THE MANAGER'S `null` IS AN ANSWER, NOT SILENCE (#1658). Where the
      sheet has a row for this card, its area has already replaced
      `resolveCardArea`; asking Jev after it would be a second reader answering
      the same question with the later one winning, which is the drift this card
      removed from the dependency question. Most tooling, script and crew-page
      work genuinely belongs to no product domain, and `null` is the honest
      answer the brief asks for.
    */
    if (managerRows.has(card.number)) {
      filled.push(card);
      continue;
    }
    /* ⚠ THE SHORT-CIRCUIT, at the call site as well as inside the asker (review
       of 2026-09-26): the dependency loop above stopped on the first failure and
       this one did not, so an unreachable Jev cost one timeout per arealess card.
       Both gates now exist and either alone is enough.

       ⚠ AND IT IS A `continue`, NOT A `break`. The first shape of this repair
       was a break, which left every remaining card out of `filled` — a
       tie-breaker that DROPS cards when it cannot be consulted, which is far
       worse than the wedge it was fixing. */
    if (jev.failure() !== null) {
      filled.push(card);
      continue;
    }
    const verdict = await jev.area({ number: card.number, title: card.title, body: card.body, cites: [] });
    if (verdict === null) {
      filled.push(card);
      continue;
    }
    filled.push({ ...card, area: verdict.area });
  }
  takeable = filled;
}

const plan = cutSeatBatches({ cards: takeable, ordered: orderedOffered, maxSeats, batchSize });

const readings: readonly JevSeatReading[] = jev?.readings ?? [];
const jevFailure = jev?.failure() ?? null;
const jevSpend = jev === null ? 0 : jevSpendUsd(jev.inputTokens());

const out = {
  cutAt: new Date(nowMs).toISOString(),
  maxSeats,
  batchSize,
  seatCount: plan.seatCount,
  focusCard: ordered.focus === null
    ? null
    : {
      number: ordered.focus.number,
      title: ordered.focus.title,
      area: ordered.focus.area,
      /* Which reader placed it, and the manager's checkable sentence (#1658). */
      areaFrom: ordered.focus.areaFrom ?? "atlas",
      managerReason: ordered.focus.managerReason ?? null,
    },
  /*
    THE MILESTONE, AND WHERE IT CAME FROM, ON THE RECORD (#1541).

    The plan carried `focusCard` and no milestone, so a pass that held nine rung
    cards recorded WHICH cards it held and nothing about the reading that held
    them — the defect was found by inference from a title rather than read off
    the plan. `focusRung: null` beside its own reason is the fact a later reader
    needs, and `ladderNote` says which of the two nulls it is: an unreadable file,
    or a ladder that names no current rung.
  */
  focusRung,
  focusRungSource: briefingPath,
  ladderNote: ladderNote === "" ? null : ladderNote,
  /*
    THE HAND-OVER, ON THE RECORD (#1658 §6).

    `state` is one of `not asked`, `usable`, `missing`, `unparseable`, `stale`,
    `partial`, and `note` carries the sentence for every state but the first two.
    `managerVsJev` is the control the card asks for: the manager's reading beside
    the mechanical one and Jev's, per ordered card, for one week — his decision on
    retiring or keeping Jev here rests on that measured disagreement rate, so it
    is written per pass rather than summarised.

    ⚠ The per-card hand-over is on the CARDS, not here: `areaFrom` and
    `managerReason` travel on every offered card and on `focusCard`, because one
    pass can legitimately carry both readings — a card filed after the manager's
    snapshot falls back — and a header figure could not say which.
  */
  manager: {
    state: managerState,
    note: managerNote,
    sheet: factsPath,
    pass: passStamp,
    readAt: managerSheetReadAt,
    model: managerModel,
    /* The manager's own figure, so the pass's recorded spend carries it (#1658). */
    costUsd: managerCostUsd,
    rows: managerRows.size,
    managerVsJev,
  },
  batches: plan.batches,
  skipped: [...background.skipped, ...ordered.held, ...plan.held, ...sittingOn],
  jev: {
    asked: jev !== null,
    readings,
    failure: jevFailure,
    spendUsd: jevSpend,
  },
  switches: Object.fromEntries(
    [CREW_WORK_MASTER_KEY, ...CREW_WORK_CATEGORIES.map((c) => c.key)].map((key) => [key, switches[key] ?? false]),
  ),
};

const outPath = ARGS.value("out");
if (outPath) {
  try {
    writeFileSync(resolve(outPath), `${JSON.stringify(out, null, 2)}\n`, "utf8");
  } catch (error) {
    refuse(`the plan could not be written to ${outPath} (${error instanceof Error ? error.message : String(error)})`);
  }
}

if (!ARGS.flag("quiet")) {
  const areas = [...new Set(plan.batches.flatMap((batch) => batch.areas))].sort().join(", ");
  const jevWord = jevFailure !== null
    ? ` | jev unreachable (${jevFailure.slice(0, 80)}) — mechanical only`
    : jev === null
      ? " | jev not asked"
      : ` | jev ${readings.length} asks | $${jevSpend.toFixed(4)}`;
  /* The milestone on the line the runner logs: a pass that holds every rung card
     must say WHY where somebody will see it, not only in the plan JSON (#1541). */
  const rungWord = focusRung === null
    ? ` | no milestone — every rung card held${ladderNote === "" ? "" : ` (${ladderNote})`}`
    : ` | milestone ${focusRung}`;
  /* WHICH READER DECIDED THIS PASS, on the line the runner logs (#1658). A pass
     that lost its sheet must say so where somebody will see it, not only in the
     plan JSON — the same argument the milestone word above was added under. */
  const managerWord = managerState === "not asked"
    ? ""
    : managerState === "usable"
      ? ` | manager ${managerRows.size} rows`
      : ` | manager ${managerState}${managerNote === null ? "" : ` (${managerNote.slice(0, 90)})`} — read as before`;
  console.log(
    plan.seatCount === 0
      ? `SEATS 0 | nothing on offer${rungWord}${managerWord}${jevWord}`
      : `SEATS ${plan.seatCount} | cards ${plan.cardCount} | areas ${areas || "none named"}${rungWord}${managerWord}${jevWord}`,
  );
}

/*
  AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`).
  A script that falls off the end waits for whatever handle is still open - a
  database pool, a fetch agent - and a runner waiting on it reads as wedged.
  The failure arms above all exit non-zero through `refuse`; this is the happy one.
*/
process.exit(0);

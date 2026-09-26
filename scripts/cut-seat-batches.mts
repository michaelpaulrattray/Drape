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
 *    both halves of that read (`readOpenPullRequests` + `readCardComments`) and
 *    keeps *the board was not read* apart from *the board is clean*. This cut is
 *    the sixth reader to consult it and it adds no read of its own;
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
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { readOpenPullRequests } from "./lib/cardClaimWarning.mts";
import { buildBoard, readCardComments } from "./lib/cardBuildState.mts";
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
  orderedBandForSeats,
  readIndependence,
  seatPopulation,
  type IndependenceReading,
  type SeatAreaIndex,
  type SeatCandidateCard,
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
    "atlas",
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

const cards = readOpenCards();
const nowMs = Date.now();

/*
  THE BOARD, read ONCE per pass through the owner of that read. Both halves are
  asked for explicitly so an unreadable one can be NAMED: `buildBoard` keeps
  "clean" and "not read" apart, and this caller is the one that must refuse on
  the second rather than carry on.
*/
const prRows = readOpenPullRequests(ARGS.value("open-prs"));
const commentFacts = readCardComments(ARGS.value("comments"), null, nowMs);
const board = buildBoard({
  openPullRequests: prRows ?? { unreadable: "`gh pr list` could not be read (absent, unauthenticated, offline or slow)" },
  comments: commentFacts ?? { unreadable: "the card comments could not be read, so a live claim cannot be ruled out" },
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

const ordered = orderedBandForSeats({
  cards: candidates,
  board,
  areaIndex,
  switches,
  independenceOf: (card) => resolvedIndependence.get(card.number) ?? { kind: "unclear", cites: [] },
});

const background = seatPopulation({
  cards: candidates.filter((card) => !card.labels.includes(ORDERED_LABEL)),
  switches,
  board,
  areaIndex,
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
  focusCard: ordered.focus === null ? null : { number: ordered.focus.number, title: ordered.focus.title, area: ordered.focus.area },
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
  console.log(
    plan.seatCount === 0
      ? `SEATS 0 | nothing on offer${jevWord}`
      : `SEATS ${plan.seatCount} | cards ${plan.cardCount} | areas ${areas || "none named"}${jevWord}`,
  );
}

/*
  AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`).
  A script that falls off the end waits for whatever handle is still open - a
  database pool, a fetch agent - and a runner waiting on it reads as wedged.
  The failure arms above all exit non-zero through `refuse`; this is the happy one.
*/
process.exit(0);

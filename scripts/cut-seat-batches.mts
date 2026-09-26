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
    "comments",
    "atlas",
    "repo",
  ],
  boolean: ["no-jev", "quiet"],
});

/** Twenty seconds, `cardClaimWarning`'s own number for a `gh` read. */
const GH_READ_TIMEOUT_MS = 20_000;
/** How many cards' comments one pass will read. A cap, not a truncation: past it the cut refuses. */
const COMMENT_READ_CAP = 60;

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

/* ── HIS SWITCHES ──────────────────────────────────────────────────────────── */

async function readSwitches(): Promise<CrewWorkSwitchState> {
  const fixture = ARGS.value("switches");
  if (fixture) return readJsonFile<CrewWorkSwitchState>(fixture, "the switch fixture");
  try {
    await import("dotenv/config");
    const { openDatabase, resolveDatabaseUrl } = await import("./lib/dbConnection.mts");
    const url = resolveDatabaseUrl();
    if (!url) refuse("no database URL, so his switches cannot be read — reads OFF");
    const conn = await openDatabase(url);
    try {
      const [present] = await conn.query<any[]>("SHOW TABLES LIKE 'crew_work_switches'");
      if (present.length !== 1) {
        /* His bar, verbatim from `crew-shift-start.mts`: an absent table reads OFF. */
        return {};
      }
      const [rows] = await conn.query<any[]>("SELECT switchKey, enabled FROM `crew_work_switches`");
      const switches: Record<string, boolean> = {};
      for (const row of rows) switches[String(row.switchKey)] = Boolean(row.enabled);
      return switches;
    } finally {
      await conn.end();
    }
  } catch (error) {
    refuse(`his switches could not be read (${error instanceof Error ? error.message : String(error)}) — reads OFF`);
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

const switches = await readSwitches();

/* The population the independence reading has to look at: every card carrying a
   switch label or his own. Far fewer than the queue, and it is the same set the
   batches are cut from. */
const ORDERED_LABEL = "founder-ordered";
const SWITCH_LABELS: readonly string[] = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);
const candidates = cards.filter((card) =>
  card.labels.includes(ORDERED_LABEL) || card.labels.some((label) => SWITCH_LABELS.includes(label)));
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
  skipped: [...background.skipped, ...ordered.held, ...plan.held],
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

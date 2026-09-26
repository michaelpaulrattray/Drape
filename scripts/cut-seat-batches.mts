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
 *  - the open pull requests: one call, through `readOpenPullRequests`, which is
 *    the repository's one owner of that read (or `--open-prs <file>`);
 *  - the comments of the candidate cards only: one REST read each, capped, and
 *    the cap is a refusal to read further rather than a silent truncation;
 *  - his switches: one query (or `--switches <file>`);
 *  - the Atlas: the file on disk. Never generated here.
 *
 * ⚠ **`gh issue list --json comments` RETURNS `[]` IN LIST VIEW** — a measured
 * trap in this repository — so the comments are read per card through
 * `gh api`, REST, which is also the rule the card sets for a shared account.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { readOpenPullRequests } from "./lib/cardClaimWarning.mts";
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
import {
  crewCardCommentFact,
  type CrewBuildPullRequest,
  type CrewCardCommentFact,
} from "../shared/crewCardBuildState.js";

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

/* ── THE COMMENTS, REST, ONE CARD AT A TIME, CAPPED ────────────────────────── */

type CommentRow = { readonly body?: string | null; readonly created_at?: string | null; readonly createdAt?: string | null };

/** Card → its comments' times, in the same order as the bodies. */
const commentTimes = new Map<number, string[]>();
/** Cards whose comments could not be read at all. */
const unreadable = new Set<number>();

const timeOf = (row: CommentRow): string => `${row.created_at ?? row.createdAt ?? ""}`;

function readComments(cards: readonly number[]): Map<number, string[]> {
  const byCard = new Map<number, string[]>();
  const fixture = ARGS.value("comments");
  if (fixture) {
    const raw = readJsonFile<Record<string, readonly CommentRow[]>>(fixture, "the comment fixture");
    for (const [card, rows] of Object.entries(raw)) {
      byCard.set(Number(card), (rows ?? []).map((row) => `${row.body ?? ""}`));
      commentTimes.set(Number(card), (rows ?? []).map(timeOf));
    }
    return byCard;
  }
  if (cards.length > COMMENT_READ_CAP) {
    refuse(`${cards.length} candidate cards is past the ${COMMENT_READ_CAP}-card read cap — the cut refuses rather than reading a partial board`);
  }
  const repo = ARGS.value("repo") ?? "michaelpaulrattray/Drape";
  for (const card of cards) {
    try {
      const out = execFileSync(
        "gh",
        ["api", "--method", "GET", `repos/${repo}/issues/${card}/comments`, "--paginate", "-q", ".[] | {body, created_at}"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: GH_READ_TIMEOUT_MS },
      );
      const rows = out
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as CommentRow);
      byCard.set(card, rows.map((row) => `${row.body ?? ""}`));
      /* The facts (claim / release / refusal) need the TIMES: a claim's age is
         what decides whether it is live, so a time dropped here would read a
         year-old claim as a live one. */
      commentTimes.set(card, rows.map(timeOf));
    } catch {
      /* One unreadable card is not a reason to cut nothing — it is a reason not
         to OFFER that card, which `readable` below does. */
      unreadable.add(card);
    }
  }
  return byCard;
}

/**
 * The claim / release / refusal facts, through the shared owner.
 *
 * ⚠ A comment with NO time is dropped rather than dated: `crewCardBuildState`
 * decides a claim's liveness by its age, and substituting a time would either
 * resurrect an ancient claim or kill a fresh one. A dropped fact means the card
 * reads as on offer, so the card's own unreadable-comment path is what covers
 * it — this one only has to avoid inventing a date.
 */
function factsFrom(comments: ReadonlyMap<number, readonly string[]>): CrewCardCommentFact[] {
  const facts: CrewCardCommentFact[] = [];
  for (const [card, bodies] of comments) {
    const times = commentTimes.get(card) ?? [];
    bodies.forEach((body, index) => {
      const at = times[index] ?? "";
      if (at === "") return;
      const fact = crewCardCommentFact({ card, body, createdAt: at });
      if (fact !== null) facts.push(fact);
    });
  }
  return facts;
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
const openPrRows = readOpenPullRequests(ARGS.value("open-prs"));
if (openPrRows === null) {
  refuse("`gh pr list` could not be read — a card with an open PR would read as on offer, which is the one mistake this cut must not make");
}
/*
  THE ONE SHAPE ADAPTER, AND IT EXISTS BECAUSE THE TWO SHAPES ANSWER THE SAME
  QUESTION FROM DIFFERENT SIDES. `OpenPullRequest` is what `gh pr list` gives
  (`isDraft`, an optional number); `CrewBuildPullRequest` is what the shared
  build-state reader takes (`draft`, a required number). A pull request with no
  number is dropped rather than defaulted — a zero would match no card and read
  as a clean board.
*/
const openPullRequests: CrewBuildPullRequest[] = openPrRows
  .filter((pr): pr is typeof pr & { number: number } => Number.isSafeInteger(pr.number))
  .map((pr) => ({
    number: pr.number,
    title: pr.title ?? null,
    body: pr.body ?? null,
    headRefName: pr.headRefName ?? null,
    draft: pr.isDraft === true,
    labels: (pr.labels ?? []).map((label) => label?.name).filter((name): name is string => typeof name === "string"),
  }));
const switches = await readSwitches();

/* The comment read is scoped to the cards that could possibly be offered: every
   card carrying a switch label or his own, which is far fewer than the queue. */
const ORDERED_LABEL = "founder-ordered";
const SWITCH_LABELS: readonly string[] = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);
const candidates = cards.filter((card) =>
  card.labels.includes(ORDERED_LABEL) || card.labels.some((label) => SWITCH_LABELS.includes(label)));
const comments = readComments(candidates.map((card) => card.number));
const facts = factsFrom(comments);
const openCardNumbers = cards.map((card) => card.number);
const nowMs = Date.now();

/* ── THE INDEPENDENCE READING, MECHANICAL FIRST, JEV ONLY WHERE SILENT ─────── */

const jev = ARGS.flag("no-jev")
  ? null
  : jevSeatAsk({ domains: areaIndex.domains });

const mechanical = new Map<number, IndependenceReading>();
for (const card of candidates) {
  mechanical.set(card.number, readIndependence({
    card: card.number,
    body: card.body,
    comments: comments.get(card.number) ?? [],
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
      cites: citedOpenCards(
        [card.body ?? "", ...(comments.get(card.number) ?? [])].join("\n\n"),
        openCardNumbers,
        card.number,
      ),
    };
    const verdict = await jev.dependency(ask);
    if (verdict === null) break; /* Unreachable — stop asking and run mechanically. */
    if (verdict.kind === "independent") resolvedIndependence.set(card.number, { kind: "independent" });
  }
}

const ordered = orderedBandForSeats({
  cards: candidates,
  openPullRequests,
  facts,
  areaIndex,
  nowMs,
  independenceOf: (card) => resolvedIndependence.get(card.number) ?? { kind: "unclear", cites: [] },
});

const background = seatPopulation({
  cards: candidates.filter((card) => !card.labels.includes(ORDERED_LABEL)),
  switches,
  openPullRequests,
  facts,
  areaIndex,
  nowMs,
});

/* A card whose comments could not be read is not offered: an unread board is
   not a clean one (`cardClaimWarning`'s sentence, and the same direction). */
const unread: SeatSkippedCard[] = [];
const readable = <T extends { number: number; title: string }>(rows: readonly T[]): T[] =>
  rows.filter((row) => {
    if (!unreadable.has(row.number)) return true;
    unread.push({ number: row.number, title: row.title, why: "its comments could not be read, so a live claim cannot be ruled out" });
    return false;
  });

let takeable = readable(background.takeable);
const orderedOffered = readable(ordered.offered);

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
  skipped: [...background.skipped, ...ordered.held, ...plan.held, ...unread],
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

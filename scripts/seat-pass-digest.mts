/**
 * WRITE ONE PASS'S DIGEST — the last act of a multi-seat pass (#1281).
 *
 *     npx tsx scripts/seat-pass-digest.mts --plan plan.json --out digest.md \
 *       --started 2026-09-26T14:30:00Z --seat-failures failures.json
 *
 * It re-reads the open pull requests and the handed-out cards' comments AFTER
 * the seats have finished, so every outcome line is an artifact rather than a
 * seat's claim, and prints one summary line the runner logs:
 *
 *     DIGEST 7 cards | 5 PRs | 2 waiting on a verdict -> digest.md
 *
 * ⚠ **IT NEVER FAILS A PASS.** Every unreadable input degrades to a digest that
 * SAYS it could not read that input; the pass is already over by the time this
 * runs, and a throw here would lose the one record of it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { readOpenPullRequests } from "./lib/cardClaimWarning.mts";
import {
  renderPassDigest,
  type PassCardHandout,
  type PassCardSkipped,
  type PassJevReading,
} from "./lib/seatPassDigest.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";
import {
  crewCardCommentFact,
  pullRequestBuildsCard,
  CREW_REVIEW_PR_LABELS,
  type CrewBuildPullRequest,
  type CrewCardCommentFact,
} from "../shared/crewCardBuildState.js";

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["plan", "out", "started", "open-prs", "comments", "seat-failures", "repo"],
  boolean: ["quiet"],
});

const GH_READ_TIMEOUT_MS = 20_000;

type PlanFile = {
  readonly cutAt?: string;
  readonly seatCount?: number;
  readonly focusCard?: { readonly number: number; readonly title: string } | null;
  readonly batches?: readonly {
    readonly seat: number;
    readonly cards: readonly { readonly number: number; readonly title: string; readonly area: string | null }[];
  }[];
  readonly skipped?: readonly PassCardSkipped[];
  readonly jev?: {
    readonly asked?: boolean;
    readonly failure?: string | null;
    readonly readings?: readonly PassJevReading[];
    readonly spendUsd?: number;
  };
};

function readJson<T>(path: string | null, fallback: T): T {
  if (path === null) return fallback;
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const planPath = ARGS.value("plan");
const plan = readJson<PlanFile>(planPath, {});
const handout: PassCardHandout[] = (plan.batches ?? []).flatMap((batch) =>
  batch.cards.map((card) => ({ number: card.number, title: card.title, seat: batch.seat, area: card.area ?? null })));

/* ── THE ARTIFACTS, READ NOW ───────────────────────────────────────────────── */

const prRows = readOpenPullRequests(ARGS.value("open-prs"));
const openPullRequests: CrewBuildPullRequest[] = (prRows ?? [])
  .filter((pr): pr is typeof pr & { number: number } => Number.isSafeInteger(pr.number))
  .map((pr) => ({
    number: pr.number,
    title: pr.title ?? null,
    body: pr.body ?? null,
    headRefName: pr.headRefName ?? null,
    draft: pr.isDraft === true,
    labels: (pr.labels ?? []).map((label) => label?.name).filter((name): name is string => typeof name === "string"),
  }));

type CommentRow = { readonly body?: string | null; readonly created_at?: string | null; readonly createdAt?: string | null };

function readFacts(cards: readonly number[]): CrewCardCommentFact[] {
  const fixture = ARGS.value("comments");
  const facts: CrewCardCommentFact[] = [];
  const push = (card: number, rows: readonly CommentRow[]) => {
    for (const row of rows) {
      const at = `${row.created_at ?? row.createdAt ?? ""}`;
      if (at === "") continue;
      const fact = crewCardCommentFact({ card, body: `${row.body ?? ""}`, createdAt: at });
      if (fact !== null) facts.push(fact);
    }
  };
  if (fixture !== null) {
    const raw = readJson<Record<string, readonly CommentRow[]>>(fixture, {});
    for (const [card, rows] of Object.entries(raw)) push(Number(card), rows ?? []);
    return facts;
  }
  const repo = ARGS.value("repo") ?? "michaelpaulrattray/Drape";
  for (const card of cards) {
    try {
      const out = execFileSync(
        "gh",
        ["api", "--method", "GET", `repos/${repo}/issues/${card}/comments`, "--paginate", "-q", ".[] | {body, created_at}"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: GH_READ_TIMEOUT_MS },
      );
      push(
        card,
        out.split("\n").map((l) => l.trim()).filter((l) => l !== "").map((l) => JSON.parse(l) as CommentRow),
      );
    } catch {
      /* One card's comments unread costs one outcome line its precision, and the
         line says "nothing recorded" — never a claim that nothing happened. */
    }
  }
  return facts;
}

const facts = readFacts(handout.map((card) => card.number));

/**
 * PULL REQUESTS WAITING ON A VERDICT — read off the LABEL, deliberately.
 *
 * ⚠ `reviewRounds.mts` owns the sharper question (*does a FRESH hand verdict
 * exist on the current head*) and answering it needs, per pull request, its
 * comments AND its head commit's date — two reads each, on the one GitHub
 * account every seat shares, at the end of a pass that has just used it hard.
 * The label is what the triage applies and what the relay clears, so
 * `CREW_REVIEW_PR_LABELS` answers *"whose verdict is owed"* for free and the
 * digest says exactly that rather than implying the sharper reading. The relay
 * opens the PRs anyway; this number is there to tell it how many.
 */
const awaitingVerdict = openPullRequests
  .filter((pr) => (pr.labels ?? []).some((label) => CREW_REVIEW_PR_LABELS.includes(label)))
  .map((pr) => pr.number);

const seatFailures = readJson<{ readonly seat: number; readonly why: string }[]>(ARGS.value("seat-failures"), []);

const nowMs = Date.now();
const digest = renderPassDigest({
  passStartedAt: ARGS.value("started") ?? plan.cutAt ?? "unknown",
  finishedAt: new Date(nowMs).toISOString(),
  seatCount: plan.seatCount ?? (plan.batches ?? []).length,
  focusCard: plan.focusCard ?? null,
  handout,
  skipped: plan.skipped ?? [],
  openPullRequests,
  facts,
  awaitingVerdict,
  jev: {
    asked: plan.jev?.asked ?? false,
    failure: plan.jev?.failure ?? null,
    readings: plan.jev?.readings ?? [],
    spendUsd: plan.jev?.spendUsd ?? 0,
  },
  nowMs,
  seatFailures,
});

const outPath = ARGS.value("out");
if (outPath !== null) {
  try {
    writeFileSync(resolve(outPath), digest, "utf8");
  } catch (error) {
    console.error(`seat-pass-digest: could not write ${outPath} (${error instanceof Error ? error.message : String(error)})`);
  }
} else {
  process.stdout.write(digest);
}

if (!ARGS.flag("quiet")) {
  /* The one owner of "does this pull request build that card" — never a second
     spelling of a rule `shared/crewCardBuildState.ts` already states. */
  const withPr = handout.filter((card) =>
    openPullRequests.some((pr) => pullRequestBuildsCard(pr, card.number).length > 0)).length;
  console.log(
    `DIGEST ${handout.length} cards | ${withPr} PRs | ${awaitingVerdict.length} waiting on a verdict${
      outPath === null ? "" : ` -> ${outPath}`
    }`,
  );
}

/*
  AND THE LAST STATEMENT ENDS THE PROCESS (`server/scriptExitDiscipline.test.ts`).
  A script that falls off the end waits for whatever handle is still open - a
  database pool, a fetch agent - and a runner waiting on it reads as wedged.
  The failure arms above all exit non-zero through `refuse`; this is the happy one.
*/
process.exit(0);

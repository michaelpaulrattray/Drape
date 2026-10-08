/**
 * THE REPAIRS OWED, ON HIS PAGE — read the way the merge tool reads them (#1984).
 *
 * # The defect
 *
 * The Crew tab's *In flight* list decided a pull request was held by asking *is
 * the relay's finding newer than the last thing that happened to this pull
 * request?* (`handVerdictFreshness`, `shared/handVerdict.ts`). Any comment moves
 * that clock, so **a seat answering a finding under its own header — which the
 * standing orders tell it to do — made the page forget the finding.** Measured
 * the day #1977 put a count on it: the page said **5** need a repair where the
 * seat cut's reader (`scripts/lib/repairsOwed.mts`) saw **9** — #1924, #1946,
 * #1960 (a reply 31 seconds after the finding) and #1974 were drawn as waiting
 * for review or in the gate, three of the four on money or privacy.
 *
 * # ⚠ THERE IS NO SECOND READER HERE, AND THAT IS THE DESIGN
 *
 * Which hand comment holds a pull request is decided by `tallyRounds` +
 * `reviewPresence` — `scripts/lib/reviewRounds.mts`, the merge tool's own
 * reader, which `repairsOwed.mts` also hands its rows to. This module imports
 * those two functions and computes nothing about verdicts itself. What it adds
 * is the ONE input the page never had: **the date of each pull request's head
 * commit**, which is what makes a finding fresh or stale on that reader (a
 * finding before the head is a repair already pushed). With that date in hand,
 * a reply under a finding changes nothing, exactly as it changes nothing for the
 * merge tool.
 *
 * # What it costs, read against the budget the page already spends
 *
 * The repository is public and the server reads it unauthenticated: the CORE
 * allowance is 60 an hour, and `cardActivity.ts` already spends up to 30 of it.
 * So this reader is deliberately frugal:
 *
 *  - **one** `GET /repos/{repo}/pulls?state=open` per `PULL_HEADS_TTL_MS` (five
 *    minutes — twelve an hour) gives every open pull request's head sha;
 *  - **one** `GET /repos/{repo}/git/commits/{sha}` per head it has never seen
 *    gives that head's committer date — the field `gh`'s `committedDate` is,
 *    which is what the merge tool compares against — and a commit's date never
 *    changes, so it is cached for the life of the process;
 *  - and it only asks for the date of a pull request **the relay has written a
 *    hand comment on**, because nothing else can be held or passed.
 *
 * In practice that is twelve calls an hour plus one per push to a reviewed pull
 * request. ⚠ **Its limit is stated rather than hidden: a push shows on the page
 * up to five minutes late**, so for those minutes a repaired pull request still
 * reads *Needs a repair*. The direction is the one that costs a glance, never a
 * missed repair.
 *
 * # When it cannot answer
 *
 * A pull request this reading has no head date for — the read failed, GitHub
 * refused it, or the pull request opened inside the last five minutes — falls
 * back to the page's old reading (`handVerdictForPullRequest`), the one every
 * row used before this card. That under-counts in the measured way and never
 * invents a hold.
 */
import {
  reviewPresence,
  tallyRounds,
  type HandVerdictReading,
} from "../../scripts/lib/reviewRounds.mts";
import { HAND_FINDING_MARKER, HAND_VERDICT_MARKER, type HandVerdictFreshness } from "../../shared/handVerdict";
import type { CrewCardCommentFact } from "../../shared/crewCardBuildState";
import { LIVE_QUEUE_REPO } from "./liveQueue";

/** The one account whose comment can be a verdict — derived from the repository, as `cardActivity.ts` does. */
export const LIVE_REPAIRS_OWNER = LIVE_QUEUE_REPO.split("/")[0] ?? "";

/** Five minutes: twelve list reads an hour, beside `cardActivity`'s thirty, inside an allowance of sixty. */
export const PULL_HEADS_TTL_MS = 300_000;
export const PULL_HEADS_PAGE = 100;
const REQUEST_TIMEOUT_MS = 8_000;

/** One open pull request's head, as this reader knows it. */
export type LivePullRequestHead = {
  readonly number: number;
  readonly headSha: string;
  /** The head commit's committer date, or `null` when it has not been read. */
  readonly headCommittedAt: string | null;
};

export type LivePullRequestHeads =
  | { readonly available: false; readonly why: string }
  | {
    readonly available: true;
    readonly stale: boolean;
    readonly why: string | null;
    readonly heads: readonly LivePullRequestHead[];
  };

/**
 * WHAT THE RELAY'S HAND COMMENTS MEAN FOR ONE PULL REQUEST, read on the merge
 * tool's reader.
 *
 * The comment facts carry the newest FINDING and the newest VERDICT per pull
 * request (`cardActivity.ts`' store keeps the newest of each kind), and that is
 * enough for `reviewPresence` to give the same answer it gives over every
 * comment: if the newest finding is before the head, every older one is too, and
 * the same for verdicts. The facts were already author-gated and classified by
 * `isHandFinding` / `isHandVerdict` — the same predicates `classifyComment`
 * applies — so each is handed back to `tallyRounds` as a reading whose body is
 * its own marker, and the reader classifies it again rather than being told.
 * `server/crew/liveRepairs.test.ts` holds that round trip to the predicates.
 */
export function handReadingsFromFacts(
  pullRequest: number,
  facts: readonly CrewCardCommentFact[],
  ownerLogin: string = LIVE_REPAIRS_OWNER,
): HandVerdictReading[] {
  const readings: HandVerdictReading[] = [];
  facts.forEach((fact, index) => {
    if (fact.card !== pullRequest) return;
    if (fact.kind !== "finding" && fact.kind !== "verdict") return;
    readings.push({
      id: index,
      authorLogin: ownerLogin,
      createdAt: fact.at,
      body: fact.kind === "finding" ? `${HAND_FINDING_MARKER} — HELD**` : `${HAND_VERDICT_MARKER}**`,
    });
  });
  return readings;
}

/** The exact answer for one pull request, with the finding it rests on. */
export type ExactHandReading = {
  readonly handVerdict: HandVerdictFreshness;
  /** The fresh finding's timestamp when `handVerdict` is `finding`, else `null`. */
  readonly flaggedAt: string | null;
};

/**
 * `tallyRounds` + `reviewPresence` over one pull request, mapped onto the words
 * the page already speaks: `finding` holds it, `verdict` is a pass, and anything
 * else is `stale` when the relay has spoken on an earlier head and `none` when
 * it has not spoken at all.
 */
export function exactHandReading(input: {
  readonly pullRequest: number;
  readonly createdAt: string;
  readonly headCommittedAt: string;
  readonly facts: readonly CrewCardCommentFact[];
  readonly ownerLogin?: string;
}): ExactHandReading {
  const ownerLogin = input.ownerLogin ?? LIVE_REPAIRS_OWNER;
  const readings = handReadingsFromFacts(input.pullRequest, input.facts, ownerLogin);
  const tally = tallyRounds(readings, {
    number: input.pullRequest,
    headRefName: "",
    createdAt: input.createdAt,
    headCommittedAt: input.headCommittedAt,
    ownerLogin,
  });
  /* `false` for `reviewOwed`, as `repairsOwed.mts` passes it: a finding outranks
     it either way, and this page is not the place to decide whether a review is
     owed. */
  const presence = reviewPresence(tally, false);
  if (presence === "finding") {
    return { handVerdict: "finding", flaggedAt: tally.findings[tally.findings.length - 1]?.createdAt ?? null };
  }
  if (presence === "verdict") return { handVerdict: "fresh", flaggedAt: null };
  return { handVerdict: readings.length > 0 ? "stale" : "none", flaggedAt: null };
}

// ── the reader ────────────────────────────────────────────────────────────

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type PullRequestHeadReaderOptions = {
  fetch?: FetchLike;
  now?: () => number;
  ttlMs?: number;
  repo?: string;
  token?: () => string | undefined;
};

export type PullRequestHeadReader = {
  /** `wanted` — the pull requests the relay has spoken on; only those are dated. */
  read(wanted: ReadonlySet<number>): Promise<LivePullRequestHeads>;
  reset(): void;
};

/** The two request URLs — exported so the suite asserts what is SENT. */
export function pullHeadsListRequest(repo: string): string {
  return `https://api.github.com/repos/${repo}/pulls?state=open&per_page=${PULL_HEADS_PAGE}&sort=updated&direction=desc`;
}

export function headCommitRequest(repo: string, sha: string): string {
  return `https://api.github.com/repos/${repo}/git/commits/${encodeURIComponent(sha)}`;
}

function headersFor(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "drape-crew-desk",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token.trim() !== "") headers.Authorization = `Bearer ${token.trim()}`;
  return headers;
}

/** One row of the pulls list, reduced to the two fields read. */
export function pullHeadFromRow(raw: unknown): { number: number; headSha: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { number?: unknown; head?: { sha?: unknown } | null };
  if (typeof row.number !== "number" || !Number.isSafeInteger(row.number) || row.number <= 0) return null;
  const sha = row.head && typeof row.head.sha === "string" ? row.head.sha : "";
  if (sha === "") return null;
  return { number: row.number, headSha: sha };
}

export function createPullRequestHeadReader(options: PullRequestHeadReaderOptions = {}): PullRequestHeadReader {
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? PULL_HEADS_TTL_MS;
  const repo = options.repo ?? LIVE_QUEUE_REPO;
  const token = options.token ?? (() => process.env.GITHUB_READ_TOKEN);

  /* A commit's date never changes, so a sha once dated is dated for good. */
  const commitDates = new Map<string, string>();
  /* When each sha was last ASKED for, so a head GitHub will not date is asked
     again once per TTL rather than on every page load. */
  const dateAskedMs = new Map<string, number>();
  let heads: { number: number; headSha: string }[] = [];
  let everSucceeded = false;
  let lastGoodMs = 0;
  let lastAttemptMs = 0;
  let lastFailure: string | null = null;
  let inFlight: Promise<void> | null = null;

  async function getJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { headers: headersFor(token()), signal: controller.signal });
      if (!response.ok) {
        throw new Error(`GitHub answered ${response.status}${response.status === 403 || response.status === 429 ? " (rate limited)" : ""}`);
      }
      return await response.json() as unknown;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshList(): Promise<void> {
    lastAttemptMs = now();
    try {
      const body = await getJson(pullHeadsListRequest(repo));
      if (!Array.isArray(body)) throw new Error("GitHub answered without a pull request list");
      heads = body.map(pullHeadFromRow).filter((row): row is { number: number; headSha: string } => row !== null);
      everSucceeded = true;
      lastGoodMs = lastAttemptMs;
      lastFailure = null;
    } catch (cause) {
      lastFailure = describe(cause);
    }
  }

  /* One date per sha it has never seen, for the wanted pull requests only. A
     failure here leaves that one pull request undated — it falls back to the
     old reading — and never discards the list. */
  async function dateWanted(wanted: ReadonlySet<number>): Promise<void> {
    for (const head of heads) {
      if (!wanted.has(head.number) || commitDates.has(head.headSha)) continue;
      const asked = dateAskedMs.get(head.headSha);
      if (asked !== undefined && now() - asked < ttlMs) continue;
      dateAskedMs.set(head.headSha, now());
      try {
        const body = await getJson(headCommitRequest(repo, head.headSha)) as { committer?: { date?: unknown } } | null;
        const date = body && body.committer && typeof body.committer.date === "string" ? body.committer.date : "";
        if (date !== "" && Number.isFinite(Date.parse(date))) commitDates.set(head.headSha, date);
      } catch (cause) {
        lastFailure = describe(cause);
        /* A refusing GitHub is not helped by being asked for the next sha. */
        return;
      }
    }
  }

  function undatedWanted(wanted: ReadonlySet<number>): boolean {
    return heads.some((head) => {
      if (!wanted.has(head.number) || commitDates.has(head.headSha)) return false;
      const asked = dateAskedMs.get(head.headSha);
      return asked === undefined || now() - asked >= ttlMs;
    });
  }

  function answer(): LivePullRequestHeads {
    if (!everSucceeded) return { available: false, why: lastFailure ?? "the open pull requests have not been read yet" };
    return {
      available: true,
      stale: lastFailure !== null,
      why: lastFailure,
      heads: heads.map((head) => ({
        number: head.number,
        headSha: head.headSha,
        headCommittedAt: commitDates.get(head.headSha) ?? null,
      })),
    };
  }

  return {
    async read(wanted) {
      const fresh = everSucceeded && now() - lastGoodMs < ttlMs;
      const recentlyTried = lastAttemptMs !== 0 && now() - lastAttemptMs < ttlMs;
      if (inFlight === null && !fresh && !recentlyTried) {
        inFlight = refreshList().then(() => dateWanted(wanted)).finally(() => { inFlight = null; });
      } else if (inFlight === null && undatedWanted(wanted)) {
        /* The list is fresh but the relay has just spoken on a pull request
           whose head is undated — date it now rather than five minutes late. */
        inFlight = dateWanted(wanted).finally(() => { inFlight = null; });
      }
      if (inFlight !== null) await inFlight;
      return answer();
    },
    reset() {
      commitDates.clear();
      dateAskedMs.clear();
      heads = [];
      everSucceeded = false;
      lastGoodMs = 0;
      lastAttemptMs = 0;
      lastFailure = null;
      inFlight = null;
    },
  };
}

function describe(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.name === "AbortError" ? `GitHub did not answer within ${REQUEST_TIMEOUT_MS / 1000} s` : cause.message;
  }
  return String(cause);
}

/** The process-wide reader the crew router uses. */
const pullRequestHeadReader: PullRequestHeadReader = createPullRequestHeadReader();

export function readPullRequestHeads(wanted: ReadonlySet<number>): Promise<LivePullRequestHeads> {
  return pullRequestHeadReader.read(wanted);
}

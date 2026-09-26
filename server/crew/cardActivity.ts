/**
 * THE CARD ACTIVITY READER — the claims and refusals his page had no way to
 * see (#1094).
 *
 * `liveQueue.ts` reads GitHub's SEARCH API and gets everything a card's own
 * fields say. Neither of the two facts this card is about is in a field: a
 * claim and a refusal are COMMENTS (`shared/crewCardBuildState.ts`'s header has
 * the conventions and why they are comments). So this reads
 * `GET /repos/{repo}/issues/comments`, which hands back every comment in the
 * repository newest-first with its body, its card and its timestamp — one call
 * for every card at once, rather than one call per card.
 *
 * # ⚠ IT IS A SECOND READER ON PURPOSE, AND THE REASON IS THE BUDGET
 *
 * Read at the wire the day this landed: the comments listing is the **core**
 * allowance (`x-ratelimit-resource: core`, **60 an hour** unauthenticated),
 * while `liveQueue`'s two searches are the **search** allowance (10 a minute).
 * They cannot be folded into one reader without one of them spending the
 * other's budget. So this keeps its own, longer TTL — `CARD_ACTIVITY_TTL_MS`,
 * two minutes, 30 an hour at worst — and, crucially:
 *
 * ⚠ **A FAILURE HERE NEVER MAKES THE QUEUE STALE.** The two readings are
 * awaited independently and the Desk is built from whichever ones answered. A
 * page that lost its whole live half because a supplementary phrase could not
 * be read would be a worse page than the one before this card.
 *
 * # ⚠ IT ACCUMULATES, WHICH IS WHAT MAKES IT CHEAP AND WHAT BOUNDS IT
 *
 * A claim and a refusal are facts about the past, so a reader that re-asked for
 * the whole window every two minutes would pay three pages for the same 222
 * comments forever. Instead: the first read asks for `CARD_ACTIVITY_BOOT_HOURS`
 * and pages to `CARD_ACTIVITY_MAX_PAGES`, and every read after it asks only for
 * what is NEW (`since` the last success, less `CARD_ACTIVITY_OVERLAP_MS` so a
 * comment landing inside a request cannot fall between two windows). The facts
 * are kept per card, newest of each kind, for as long as the process lives.
 *
 * ⚠ **THE STATED LIMIT, AND IT IS REAL: A REFUSAL OLDER THAN THE BOOT WINDOW
 * AND NEVER RE-COMMENTED IS NOT SEEN.** Measured: 222 comments in the twelve
 * hours before this shipped, so two days is about six pages and three are
 * taken. His page then says NOTHING about that card rather than something
 * wrong, which is the direction this whole file is built to fail in — but it is
 * a floor, not a proof, and the durable answer is a LABEL on a refused card
 * rather than a comment nobody can index. That is filed as its own card, not
 * assumed here.
 */
import {
  crewCardCommentFact,
  type CrewCardCommentFact,
} from "../../shared/crewCardBuildState";
import { LIVE_QUEUE_REPO } from "./liveQueue";

/**
 * THE ONE ACCOUNT WHOSE COMMENT CAN BE A VERDICT — derived from the repository
 * this reader is pointed at rather than typed again, because a hand-written
 * `"michaelpaulrattray"` beside a repository constant that already says it is
 * the mirror working law 4 is about.
 */
export const LIVE_QUEUE_OWNER = LIVE_QUEUE_REPO.split("/")[0] ?? "";

export const CARD_ACTIVITY_TTL_MS = 120_000;
export const CARD_ACTIVITY_BOOT_HOURS = 48;
export const CARD_ACTIVITY_MAX_PAGES = 3;
export const CARD_ACTIVITY_PAGE = 100;
/** One minute of overlap on an incremental read — cheaper than a lost fact. */
export const CARD_ACTIVITY_OVERLAP_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

export type CrewCardActivity =
  | { readonly available: false; readonly why: string }
  | {
    readonly available: true;
    readonly readAt: string;
    readonly stale: boolean;
    readonly why: string | null;
    readonly facts: readonly CrewCardCommentFact[];
  };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type CardActivityReaderOptions = {
  fetch?: FetchLike;
  now?: () => number;
  ttlMs?: number;
  repo?: string;
  token?: () => string | undefined;
};

/** The card a comment hangs on — `issue_url` ends in the number. */
export function cardOfCommentUrl(issueUrl: unknown): number | null {
  if (typeof issueUrl !== "string") return null;
  const tail = issueUrl.match(/\/(\d+)$/);
  if (!tail) return null;
  const value = Number(tail[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * One listing row → one fact, or `null`. Exported so the arms prove the mapping
 * against a captured response rather than a shape imagined here.
 */
export function factFromCommentRow(
  raw: unknown,
  ownerLogin: string = LIVE_QUEUE_OWNER,
): CrewCardCommentFact | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const card = cardOfCommentUrl(row.issue_url);
  if (card === null) return null;
  if (typeof row.body !== "string" || typeof row.created_at !== "string") return null;
  /* ⚠ `user.login` RIDES ALONG FOR THE VERDICT AND FOR NOTHING ELSE (#1094, his
     desk correction of 2026-09-26). A claim or a refusal is judged on its body
     alone — any seat may write one — while a hand verdict is judged on WHO wrote
     it, which is `reviewRounds`' own floor. An absent login therefore costs a
     verdict and never a claim. */
  const user = row.user;
  const authorLogin = user && typeof user === "object" && typeof (user as { login?: unknown }).login === "string"
    ? (user as { login: string }).login
    : null;
  return crewCardCommentFact({
    card,
    body: row.body,
    createdAt: row.created_at,
    authorLogin,
    ownerLogin,
  });
}

/**
 * The request URL — exported so the wire arm asserts what is SENT (working law
 * 5) rather than a constant near it.
 */
export function cardActivityRequest(repo: string, sinceIso: string, page: number): string {
  const query = new URLSearchParams({
    since: sinceIso,
    per_page: String(CARD_ACTIVITY_PAGE),
    sort: "created",
    direction: "desc",
    page: String(page),
  });
  return `https://api.github.com/repos/${repo}/issues/comments?${query.toString()}`;
}

export function cardActivityHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "drape-crew-desk",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token.trim() !== "") headers.Authorization = `Bearer ${token.trim()}`;
  return headers;
}

/** Whole-second ISO — GitHub's `since` rejects nothing fractional, but the two readers say time the same way. */
export function activitySince(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export type CardActivityReader = {
  read(): Promise<CrewCardActivity>;
  /** Tests only — forgets the cache and every accumulated fact. */
  reset(): void;
};

/**
 * Newest of each KIND per card. A card can hold a claim and a later refusal and
 * both are worth keeping: the judgement in `crewCardBuildState` compares their
 * timestamps, so throwing the older one away here would move a decision into
 * the reader that belongs beside the page.
 */
function remember(store: Map<string, CrewCardCommentFact>, fact: CrewCardCommentFact): void {
  const key = `${fact.card}:${fact.kind}`;
  const held = store.get(key);
  if (held === undefined || held.at.localeCompare(fact.at) < 0) store.set(key, fact);
}

export function createCardActivityReader(options: CardActivityReaderOptions = {}): CardActivityReader {
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? CARD_ACTIVITY_TTL_MS;
  const repo = options.repo ?? LIVE_QUEUE_REPO;
  const token = options.token ?? (() => process.env.GITHUB_READ_TOKEN);

  const facts = new Map<string, CrewCardCommentFact>();
  let everSucceeded = false;
  let lastGoodMs = 0;
  let lastFailure: string | null = null;
  let lastAttemptMs = 0;
  let inFlight: Promise<void> | null = null;

  async function page(url: string, headers: Record<string, string>): Promise<unknown[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { headers, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`GitHub answered ${response.status}${response.status === 403 || response.status === 429 ? " (rate limited)" : ""}`);
      }
      const body = await response.json() as unknown;
      if (!Array.isArray(body)) throw new Error("GitHub answered without a comment list");
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh(): Promise<void> {
    const startedMs = now();
    lastAttemptMs = startedMs;
    /* Incremental once anything has succeeded; the boot window otherwise. */
    const sinceMs = everSucceeded
      ? lastGoodMs - CARD_ACTIVITY_OVERLAP_MS
      : startedMs - CARD_ACTIVITY_BOOT_HOURS * 3_600_000;
    const sinceIso = activitySince(sinceMs);
    const headers = cardActivityHeaders(token());
    const maxPages = everSucceeded ? 1 : CARD_ACTIVITY_MAX_PAGES;
    try {
      for (let index = 1; index <= maxPages; index += 1) {
        const rows = await page(cardActivityRequest(repo, sinceIso, index), headers);
        for (const row of rows) {
          const fact = factFromCommentRow(row);
          if (fact !== null) remember(facts, fact);
        }
        /* A short page is the last page — no Link header parsing needed. */
        if (rows.length < CARD_ACTIVITY_PAGE) break;
      }
      everSucceeded = true;
      lastGoodMs = startedMs;
      lastFailure = null;
    } catch (cause) {
      lastFailure = cause instanceof Error
        ? (cause.name === "AbortError" ? `GitHub did not answer within ${REQUEST_TIMEOUT_MS / 1000} s` : cause.message)
        : String(cause);
    }
  }

  function answer(): CrewCardActivity {
    if (!everSucceeded) {
      return { available: false, why: lastFailure ?? "GitHub's comments have not been read yet" };
    }
    return {
      available: true,
      readAt: new Date(lastGoodMs).toISOString(),
      stale: lastFailure !== null,
      why: lastFailure,
      /* `Array.from` rather than a spread: one tsconfig that reads this file
         targets es5 and cannot iterate a map iterator. */
      facts: Array.from(facts.values()),
    };
  }

  return {
    async read() {
      const fresh = everSucceeded && now() - lastGoodMs < ttlMs;
      /* A refusing GitHub is not helped by being asked again inside the TTL. */
      const recentlyTried = lastAttemptMs !== 0 && now() - lastAttemptMs < ttlMs;
      if (!fresh && !recentlyTried) {
        if (inFlight === null) inFlight = refresh().finally(() => { inFlight = null; });
        await inFlight;
      } else if (inFlight !== null) {
        await inFlight;
      }
      return answer();
    },
    reset() {
      facts.clear();
      everSucceeded = false;
      lastGoodMs = 0;
      lastFailure = null;
      lastAttemptMs = 0;
      inFlight = null;
    },
  };
}

/** The process-wide reader the crew router uses. */
export const cardActivityReader: CardActivityReader = createCardActivityReader();

export function readCardActivity(): Promise<CrewCardActivity> {
  return cardActivityReader.read();
}

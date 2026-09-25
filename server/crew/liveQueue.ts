/**
 * THE LIVE QUEUE — the Desk reads GitHub itself (#1193, his order 2026-09-25:
 * *"take over my browser and make it live"*).
 *
 * WHAT WAS WRONG. `/admin/crew` polled `crew.getState` every 30 s, but what it
 * polled was `crew-briefing.json`: a file compiled into the server bundle and
 * rewritten by hand at the END of each shift, so every fact about cards (open,
 * in review, merged, waiting under a rung) was one cycle old — measured at
 * ~80 minutes between editions on the night of 2026-09-24, and the page said
 * PR #1185 was *in review* for an hour after it had merged. The crew router
 * deliberately carried no GitHub credential; the repository is PUBLIC, so it
 * never needed one.
 *
 * WHAT THIS IS. One reader over GitHub's search API, cached in memory for
 * `LIVE_QUEUE_TTL_MS`, answering the page from the cache and refreshing it at
 * most once per TTL however many admins are looking. Two calls per refresh —
 * every open issue and PR, and everything closed or merged in the last
 * `RECENT_WINDOW_HOURS` — against an unauthenticated allowance of 10 search
 * calls a minute (read at the wire: `x-ratelimit-limit: 10`), so a 30 s TTL
 * spends at most 4. `GITHUB_READ_TOKEN` is honoured if it is ever set (5,000
 * an hour) and is NOT required; nothing here refuses to run without it.
 *
 * WHAT IT REFUSES TO DO. It never says "nothing is open" because a request
 * failed: a failed refresh hands back the LAST GOOD reading marked `stale`
 * with the reason, and a reader that has never succeeded answers
 * `available: false` — the same discipline `crewShiftRuns.ts` keeps for an
 * absent table. It never sends a body to the page: the only thing read from
 * one is the `**Waiting on:**` line (`holdReasonFromBody`), and that sentence
 * is what travels.
 *
 * ⚠ THE SEARCH RESPONSE IS A FLOOR WHEN `total_count` EXCEEDS THE PAGE. The
 * reader takes one page of 100 and says `truncated: true` past it rather than
 * paging — 48 open items on the day this landed — because a second page is a
 * second allowance call and the honest answer to "there are more than 100" is
 * the word, not the list.
 */
import { holdReasonFromBody } from "../../shared/crewNextUpHold";

export const LIVE_QUEUE_REPO = "michaelpaulrattray/Drape";
export const LIVE_QUEUE_TTL_MS = 30_000;
export const RECENT_WINDOW_HOURS = 48;
export const LIVE_QUEUE_PAGE = 100;
const REQUEST_TIMEOUT_MS = 8_000;

export type LiveQueueItem = {
  readonly number: number;
  readonly title: string;
  readonly kind: "issue" | "pr";
  /** GitHub's own state — `status` rather than `state` so it is never mistaken for a crew card's. */
  readonly status: "open" | "closed" | "merged";
  readonly draft: boolean;
  readonly labels: readonly string[];
  readonly author: string;
  readonly assignees: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly mergedAt: string | null;
  /** The card's own `**Waiting on:**` line, or null — the one thing read from a body. */
  readonly holdReason: string | null;
  readonly url: string;
};

export type LiveQueueReading = {
  readonly readAt: string;
  readonly open: readonly LiveQueueItem[];
  readonly recent: readonly LiveQueueItem[];
  /** True when GitHub reported more matches than one page holds — a floor, not a list. */
  readonly truncated: boolean;
};

export type LiveQueue =
  | ({ readonly available: true; readonly stale: false } & LiveQueueReading)
  | ({ readonly available: true; readonly stale: true; readonly why: string } & LiveQueueReading)
  | { readonly available: false; readonly why: string };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type LiveQueueReaderOptions = {
  fetch?: FetchLike;
  now?: () => number;
  ttlMs?: number;
  repo?: string;
  /** Read lazily on every refresh so a token set after boot is honoured without a restart. */
  token?: () => string | undefined;
};

function labelNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((label) => (label && typeof label === "object" ? String((label as { name?: unknown }).name ?? "") : String(label ?? "")))
    .filter((name) => name !== "");
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * One search item → one queue row. Exported for the arms that prove the
 * mapping against a captured response rather than a shape imagined here.
 */
export function liveQueueItemFromSearch(raw: unknown): LiveQueueItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const number = Number(item.number);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  const pull = item.pull_request && typeof item.pull_request === "object"
    ? item.pull_request as Record<string, unknown>
    : null;
  const mergedAt = pull ? isoOrNull(pull.merged_at) : null;
  const rawState = String(item.state ?? "");
  const status: LiveQueueItem["status"] = mergedAt !== null
    ? "merged"
    : rawState === "open" ? "open" : "closed";
  const user = item.user && typeof item.user === "object" ? item.user as Record<string, unknown> : null;
  return {
    number,
    title: String(item.title ?? "").slice(0, 300),
    kind: pull ? "pr" : "issue",
    status,
    draft: item.draft === true,
    labels: labelNames(item.labels),
    author: user ? String(user.login ?? "") : "",
    assignees: Array.isArray(item.assignees)
      ? item.assignees.map((a) => String((a as { login?: unknown })?.login ?? "")).filter((a) => a !== "")
      : [],
    createdAt: isoOrNull(item.created_at) ?? "",
    updatedAt: isoOrNull(item.updated_at) ?? "",
    closedAt: isoOrNull(item.closed_at),
    mergedAt,
    holdReason: typeof item.body === "string" ? holdReasonFromBody(item.body) : null,
    url: String(item.html_url ?? ""),
  };
}

function searchUrl(repo: string, query: string): string {
  const q = encodeURIComponent(`repo:${repo} ${query}`);
  return `https://api.github.com/search/issues?q=${q}&per_page=${LIVE_QUEUE_PAGE}&sort=updated&order=desc`;
}

export function recentSince(nowMs: number): string {
  /* Whole-second ISO without milliseconds — GitHub's `closed:>=` qualifier
     rejects a fractional timestamp. */
  return new Date(nowMs - RECENT_WINDOW_HOURS * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Builds the two request URLs — exported so the wire arm can assert what is
 * SENT (working law 5) rather than a constant near it.
 */
export function liveQueueRequests(repo: string, nowMs: number): { open: string; recent: string } {
  return {
    open: searchUrl(repo, "state:open"),
    recent: searchUrl(repo, `state:closed closed:>=${recentSince(nowMs)}`),
  };
}

export function liveQueueHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "drape-crew-desk",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token.trim() !== "") headers.Authorization = `Bearer ${token.trim()}`;
  return headers;
}

async function searchOnce(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
): Promise<{ items: LiveQueueItem[]; total: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`GitHub answered ${response.status}${response.status === 403 || response.status === 429 ? " (rate limited)" : ""}`);
    }
    const body = await response.json() as { items?: unknown; total_count?: unknown };
    if (!Array.isArray(body.items)) throw new Error("GitHub answered without an items list");
    const items = body.items.map(liveQueueItemFromSearch).filter((item): item is LiveQueueItem => item !== null);
    const total = Number(body.total_count);
    return { items, total: Number.isFinite(total) ? total : items.length };
  } finally {
    clearTimeout(timer);
  }
}

export type LiveQueueReader = {
  read(): Promise<LiveQueue>;
  /** Tests only — forgets the cache and the last good reading. */
  reset(): void;
};

export function createLiveQueueReader(options: LiveQueueReaderOptions = {}): LiveQueueReader {
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? LIVE_QUEUE_TTL_MS;
  const repo = options.repo ?? LIVE_QUEUE_REPO;
  const token = options.token ?? (() => process.env.GITHUB_READ_TOKEN);

  let lastGood: LiveQueueReading | null = null;
  let lastGoodAtMs = 0;
  let lastFailure: string | null = null;
  let lastAttemptMs = 0;
  let inFlight: Promise<void> | null = null;

  async function refresh(): Promise<void> {
    const startedMs = now();
    lastAttemptMs = startedMs;
    const urls = liveQueueRequests(repo, startedMs);
    const headers = liveQueueHeaders(token());
    try {
      const [open, recent] = await Promise.all([
        searchOnce(fetchImpl, urls.open, headers),
        searchOnce(fetchImpl, urls.recent, headers),
      ]);
      lastGood = {
        readAt: new Date(startedMs).toISOString(),
        open: open.items,
        recent: recent.items,
        truncated: open.total > open.items.length || recent.total > recent.items.length,
      };
      lastGoodAtMs = startedMs;
      lastFailure = null;
    } catch (cause) {
      lastFailure = cause instanceof Error
        ? (cause.name === "AbortError" ? `GitHub did not answer within ${REQUEST_TIMEOUT_MS / 1000} s` : cause.message)
        : String(cause);
    }
  }

  function answer(): LiveQueue {
    if (lastGood === null) {
      return { available: false, why: lastFailure ?? "GitHub has not been read yet" };
    }
    if (lastFailure !== null) return { available: true, stale: true, why: lastFailure, ...lastGood };
    return { available: true, stale: false, ...lastGood };
  }

  return {
    async read() {
      const fresh = lastGood !== null && now() - lastGoodAtMs < ttlMs;
      /* A failed attempt is not retried inside the TTL either — a GitHub that
         is refusing is not helped by being asked twenty times a minute. */
      const recentlyTried = now() - lastAttemptMs < ttlMs && lastAttemptMs !== 0;
      if (!fresh && !recentlyTried) {
        if (inFlight === null) inFlight = refresh().finally(() => { inFlight = null; });
        await inFlight;
      } else if (inFlight !== null) {
        await inFlight;
      }
      return answer();
    },
    reset() {
      lastGood = null;
      lastGoodAtMs = 0;
      lastFailure = null;
      lastAttemptMs = 0;
      inFlight = null;
    },
  };
}

/** The process-wide reader the crew router uses. */
export const liveQueueReader: LiveQueueReader = createLiveQueueReader();

export function readLiveQueue(): Promise<LiveQueue> {
  return liveQueueReader.read();
}

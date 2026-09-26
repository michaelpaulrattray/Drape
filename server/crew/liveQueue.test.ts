/**
 * The live queue reader (#1193) — driven against a fake fetch, never GitHub.
 *
 * What the arms hold, and why each is here:
 *  - the mapping is proven on a CAPTURED search item (PR #1185 as GitHub
 *    returned it on 2026-09-25), not on a shape imagined in the reader;
 *  - the wire is asserted (working law 5): which URLs are sent, and that the
 *    Authorization header is present exactly when a token is set;
 *  - the cache is the whole point of the reader — one refresh per TTL however
 *    many readers ask, and concurrent askers share ONE in-flight refresh;
 *  - a failed refresh hands back the last good reading marked stale with the
 *    reason, a reader that has never succeeded says `available: false`, and a
 *    refusing GitHub is not re-asked inside the TTL.
 */
import { describe, expect, it } from "vitest";
import {
  LIVE_QUEUE_PAGE,
  createLiveQueueReader,
  liveQueueHeaders,
  liveQueueItemFromSearch,
  liveQueueRequests,
  recentSince,
} from "./liveQueue";

/* Captured 2026-09-25 from
   GET /search/issues?q=repo:michaelpaulrattray/Drape+is:pr+is:merged&per_page=1 */
const CAPTURED_PR_1185 = {
  number: 1185,
  title: "refactor(casting): retire the segment flags, their boot checks and the store's db layer (#1160 slice 3)",
  state: "closed",
  draft: false,
  labels: [{ name: "founder-review" }, { name: "needs-fable" }],
  user: { login: "michaelpaulrattray" },
  assignees: [],
  created_at: "2026-09-24T19:42:18Z",
  updated_at: "2026-09-24T23:34:59Z",
  closed_at: "2026-09-24T23:34:59Z",
  pull_request: {
    url: "https://api.github.com/repos/michaelpaulrattray/Drape/pulls/1185",
    html_url: "https://github.com/michaelpaulrattray/Drape/pull/1185",
    merged_at: "2026-09-24T23:34:59Z",
  },
  html_url: "https://github.com/michaelpaulrattray/Drape/pull/1185",
  state_reason: null,
  comments: 8,
  body: "**Closed by hand** …",
};

const OPEN_ISSUE = {
  number: 1193,
  title: "Live Desk: the Crew page reads GitHub itself",
  state: "open",
  labels: [{ name: "founder-ordered" }, { name: "urgent" }],
  user: { login: "michaelpaulrattray" },
  assignees: [{ login: "someone" }],
  created_at: "2026-09-25T00:10:00Z",
  updated_at: "2026-09-25T00:12:00Z",
  closed_at: null,
  html_url: "https://github.com/michaelpaulrattray/Drape/issues/1193",
  body: "Some prose.\n\n**Waiting on:** his eye on the frames\n\nMore prose.",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Call = { url: string; headers: Record<string, string> };

function fakeFetch(
  answer: (url: string, call: number) => Response | Promise<Response>,
): { fetch: (input: string, init: RequestInit) => Promise<Response>; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (input, init) => {
      calls.push({ url: input, headers: { ...(init.headers as Record<string, string>) } });
      return answer(input, calls.length);
    },
  };
}

const openAnswer = { total_count: 1, items: [OPEN_ISSUE] };
const recentAnswer = { total_count: 1, items: [CAPTURED_PR_1185] };
const byQuery = (url: string) => (url.includes("state%3Aopen") ? openAnswer : recentAnswer);

describe("the mapping, on a captured search item", () => {
  it("reads PR #1185 exactly as GitHub returned it — merged, held labels, author, times", () => {
    const item = liveQueueItemFromSearch(CAPTURED_PR_1185);
    expect(item).toEqual({
      number: 1185,
      title: CAPTURED_PR_1185.title,
      kind: "pr",
      status: "merged",
      draft: false,
      labels: ["founder-review", "needs-fable"],
      author: "michaelpaulrattray",
      assignees: [],
      createdAt: "2026-09-24T19:42:18Z",
      updatedAt: "2026-09-24T23:34:59Z",
      closedAt: "2026-09-24T23:34:59Z",
      mergedAt: "2026-09-24T23:34:59Z",
      holdReason: null,
      /* #1094 — a PULL REQUEST's body is kept, because the read that answers
         *which card is this building* is the brief's own `card #N` sentence and
         two of the eleven open PRs measured that day named their card nowhere
         else. It stays server-side: the issue arm below still proves a CARD's
         prose never leaves the reader, and nothing in this type is sent to the
         page. */
      body: CAPTURED_PR_1185.body,
      url: "https://github.com/michaelpaulrattray/Drape/pull/1185",
    });
  });

  it("a card's body is still dropped — only a PULL REQUEST keeps one (#1094)", () => {
    expect(liveQueueItemFromSearch(OPEN_ISSUE)!.body).toBeNull();
    expect(liveQueueItemFromSearch(CAPTURED_PR_1185)!.body).toBe(CAPTURED_PR_1185.body);
  });

  it("an open issue is an issue, open, with its Waiting-on line and NOT its body", () => {
    const item = liveQueueItemFromSearch(OPEN_ISSUE)!;
    expect(item.kind).toBe("issue");
    expect(item.status).toBe("open");
    expect(item.holdReason).toBe("his eye on the frames");
    expect(item.assignees).toEqual(["someone"]);
    expect(JSON.stringify(item)).not.toContain("Some prose");
  });

  it("a PR closed without merging is closed, not merged", () => {
    const item = liveQueueItemFromSearch({
      ...CAPTURED_PR_1185,
      pull_request: { ...CAPTURED_PR_1185.pull_request, merged_at: null },
    })!;
    expect(item.status).toBe("closed");
    expect(item.mergedAt).toBeNull();
  });

  it("refuses a row without a positive number rather than inventing one", () => {
    expect(liveQueueItemFromSearch({ title: "no number" })).toBeNull();
    expect(liveQueueItemFromSearch(null)).toBeNull();
  });
});

describe("the wire (working law 5)", () => {
  it("sends two searches: every open item, and everything closed inside the window", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const requests = liveQueueRequests("owner/repo", now);
    expect(requests.open).toBe(
      `https://api.github.com/search/issues?q=repo%3Aowner%2Frepo%20state%3Aopen&per_page=${LIVE_QUEUE_PAGE}&sort=updated&order=desc`,
    );
    expect(requests.recent).toContain("state%3Aclosed%20closed%3A%3E%3D2026-09-23T12%3A00%3A00Z");
    expect(recentSince(now)).toBe("2026-09-23T12:00:00Z");
  });

  it("carries Authorization exactly when a token is set — and never an empty one", () => {
    expect(liveQueueHeaders(undefined)).not.toHaveProperty("Authorization");
    expect(liveQueueHeaders("   ")).not.toHaveProperty("Authorization");
    expect(liveQueueHeaders("ghp_x").Authorization).toBe("Bearer ghp_x");
    expect(liveQueueHeaders(undefined)["User-Agent"]).toBe("drape-crew-desk");
  });

  it("the reader asks for the token on EVERY refresh, so one set after boot is honoured", async () => {
    let token: string | undefined;
    let clock = 0;
    const { fetch, calls } = fakeFetch((url) => jsonResponse(byQuery(url)));
    const reader = createLiveQueueReader({ fetch, now: () => clock, ttlMs: 1000, token: () => token });
    await reader.read();
    expect(calls[0]!.headers).not.toHaveProperty("Authorization");
    token = "ghp_later";
    clock = 5000;
    await reader.read();
    expect(calls[2]!.headers.Authorization).toBe("Bearer ghp_later");
  });
});

describe("the cache", () => {
  it("one refresh per TTL however many times the page asks, and both lists come from it", async () => {
    let clock = 0;
    const { fetch, calls } = fakeFetch((url) => jsonResponse(byQuery(url)));
    const reader = createLiveQueueReader({ fetch, now: () => clock, ttlMs: 30_000 });
    const first = await reader.read();
    await reader.read();
    clock = 29_999;
    const third = await reader.read();
    expect(calls.length, "two searches, once").toBe(2);
    expect(first).toMatchObject({ available: true, stale: false, truncated: false });
    if (!first.available) throw new Error("unreachable");
    expect(first.open.map((i) => i.number)).toEqual([1193]);
    expect(first.recent.map((i) => i.number)).toEqual([1185]);
    expect(third).toEqual(first);
    clock = 30_000;
    await reader.read();
    expect(calls.length, "the TTL elapsed — refreshed once more").toBe(4);
  });

  it("concurrent askers share ONE in-flight refresh", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { fetch, calls } = fakeFetch(async (url) => { await gate; return jsonResponse(byQuery(url)); });
    const reader = createLiveQueueReader({ fetch, now: () => 0 });
    const a = reader.read();
    const b = reader.read();
    const c = reader.read();
    release();
    const results = await Promise.all([a, b, c]);
    expect(calls.length).toBe(2);
    expect(results.every((r) => r.available)).toBe(true);
  });

  it("says truncated when GitHub holds more than one page — a floor, not a list", async () => {
    const { fetch } = fakeFetch((url) =>
      jsonResponse(url.includes("state%3Aopen") ? { total_count: 250, items: [OPEN_ISSUE] } : recentAnswer));
    const reader = createLiveQueueReader({ fetch, now: () => 0 });
    const reading = await reader.read();
    expect(reading).toMatchObject({ available: true, truncated: true });
  });
});

describe("failure never becomes an empty queue", () => {
  it("a reader that has never succeeded is `available: false`, with the reason", async () => {
    const { fetch } = fakeFetch(() => jsonResponse({ message: "rate limited" }, 403));
    const reader = createLiveQueueReader({ fetch, now: () => 0 });
    expect(await reader.read()).toEqual({ available: false, why: "GitHub answered 403 (rate limited)" });
  });

  it("a failed refresh hands back the LAST GOOD reading marked stale, and recovers on the next success", async () => {
    let clock = 0;
    let failing = false;
    const { fetch, calls } = fakeFetch((url) =>
      failing ? jsonResponse({}, 502) : jsonResponse(byQuery(url)));
    const reader = createLiveQueueReader({ fetch, now: () => clock, ttlMs: 1000 });
    const good = await reader.read();
    failing = true;
    clock = 2000;
    const stale = await reader.read();
    expect(stale).toMatchObject({ available: true, stale: true, why: "GitHub answered 502" });
    if (!stale.available || !good.available) throw new Error("unreachable");
    expect(stale.open).toEqual(good.open);
    expect(stale.readAt, "the stamp is the GOOD reading's, not the failed attempt's").toBe(good.readAt);

    clock = 2500;
    await reader.read();
    expect(calls.length, "a refusing GitHub is not re-asked inside the TTL").toBe(4);

    failing = false;
    clock = 4000;
    const recovered = await reader.read();
    expect(recovered).toMatchObject({ available: true, stale: false });
    if (!recovered.available) throw new Error("unreachable");
    expect(recovered.readAt).toBe(new Date(4000).toISOString());
  });

  it("a body without an items list is a failure, not an empty queue", async () => {
    const { fetch } = fakeFetch(() => jsonResponse({ message: "Validation Failed" }));
    const reader = createLiveQueueReader({ fetch, now: () => 0 });
    expect(await reader.read()).toEqual({ available: false, why: "GitHub answered without an items list" });
  });
});

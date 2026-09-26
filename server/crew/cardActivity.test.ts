/**
 * THE CARD ACTIVITY READER, DRIVEN (#1094).
 *
 * The reader never reaches GitHub here: `fetch` is a function this suite owns,
 * so every branch is reachable — including the three that matter and are
 * invisible from the outside, which are *never read*, *read and empty*, and
 * *read once and failing since*. That is `cardClaimWarning.mts`'s own header
 * rule, applied to the second GitHub reader on this page.
 *
 * ⚠ **THE WIRE ARM IS FIRST BECAUSE THE BUDGET IS THE DESIGN.** What this
 * reader SENDS is what keeps it inside a 60-an-hour allowance: the boot window,
 * the page cap, and — the whole reason it is cheap — a `since` on every read
 * after the first that asks only for what is new. A test that asserted those
 * from the constants beside them would prove nothing (working law 5).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CARD_ACTIVITY_BOOT_HOURS,
  CARD_ACTIVITY_MAX_PAGES,
  CARD_ACTIVITY_OVERLAP_MS,
  CARD_ACTIVITY_PAGE,
  CARD_ACTIVITY_TTL_MS,
  cardActivityHeaders,
  cardActivityRequest,
  cardOfCommentUrl,
  createCardActivityReader,
  factFromCommentRow,
} from "./cardActivity";

/** A comment row exactly as the REST listing returned one on 2026-09-26. */
const CAPTURED_CLAIM = {
  url: "https://api.github.com/repos/michaelpaulrattray/Drape/issues/comments/5842292726",
  html_url: "https://github.com/michaelpaulrattray/Drape/issues/1094#issuecomment-5842292726",
  issue_url: "https://api.github.com/repos/michaelpaulrattray/Drape/issues/1094",
  user: { login: "michaelpaulrattray" },
  created_at: "2026-09-26T02:15:15Z",
  updated_at: "2026-09-26T02:15:15Z",
  body: "CLAIMED — seat-desk-2, 2026-09-26T02:15:15Z\n",
};

const CAPTURED_REFUSAL = {
  ...CAPTURED_CLAIM,
  issue_url: "https://api.github.com/repos/michaelpaulrattray/Drape/issues/1217",
  created_at: "2026-09-26T00:21:50Z",
  body: "**NOT BUILT — the card's measurement is wrong against the code. Read at the bytes"
    + " by seat-janitor, 2026-09-26.**\n",
};

const CAPTURED_PROSE = {
  ...CAPTURED_CLAIM,
  issue_url: "https://api.github.com/repos/michaelpaulrattray/Drape/issues/1300",
  created_at: "2026-09-26T02:18:29Z",
  body: "**Fable review — by hand** (the relay is the reviewer; head `db80d60c`)\n",
};

const NOW = Date.parse("2026-09-26T03:00:00Z");

function ok(rows: unknown[]): Response {
  return { ok: true, status: 200, json: async () => rows } as unknown as Response;
}
function rateLimited(): Response {
  return { ok: false, status: 403, json: async () => ({}) } as unknown as Response;
}

describe("the mapping, on captured rows", () => {
  it("the card is the tail of the issue url", () => {
    expect(cardOfCommentUrl(CAPTURED_CLAIM.issue_url)).toBe(1094);
    expect(cardOfCommentUrl("https://api.github.com/repos/x/y/pulls/9")).toBe(9);
    expect(cardOfCommentUrl("not a url")).toBeNull();
    expect(cardOfCommentUrl(undefined)).toBeNull();
  });

  it("a claim, a refusal and ordinary prose", () => {
    expect(factFromCommentRow(CAPTURED_CLAIM))
      .toEqual({ kind: "claim", card: 1094, seat: "seat-desk-2", at: "2026-09-26T02:15:15Z" });
    expect(factFromCommentRow(CAPTURED_REFUSAL)?.kind).toBe("refusal");
    expect(factFromCommentRow(CAPTURED_PROSE)).toBeNull();
  });

  it("a row missing what it needs is nothing, not a throw", () => {
    expect(factFromCommentRow({ ...CAPTURED_CLAIM, body: 7 })).toBeNull();
    expect(factFromCommentRow({ ...CAPTURED_CLAIM, created_at: null })).toBeNull();
    expect(factFromCommentRow(null)).toBeNull();
    expect(factFromCommentRow("a string")).toBeNull();
  });
});

describe("what it sends", () => {
  it("the request carries the window, the page size and the newest-first order", () => {
    const url = cardActivityRequest("owner/repo", "2026-09-24T03:00:00Z", 2);
    expect(url).toContain("https://api.github.com/repos/owner/repo/issues/comments?");
    const query = new URL(url).searchParams;
    expect(query.get("since")).toBe("2026-09-24T03:00:00Z");
    expect(query.get("per_page")).toBe(String(CARD_ACTIVITY_PAGE));
    expect(query.get("sort")).toBe("created");
    expect(query.get("direction")).toBe("desc");
    expect(query.get("page")).toBe("2");
  });

  it("no Authorization header without a token, and one with it", () => {
    expect(cardActivityHeaders(undefined).Authorization).toBeUndefined();
    expect(cardActivityHeaders("   ").Authorization).toBeUndefined();
    expect(cardActivityHeaders("abc").Authorization).toBe("Bearer abc");
    expect(cardActivityHeaders(undefined).Accept).toBe("application/vnd.github+json");
  });

  it("⚠ the BOOT read asks for the whole window and the next read asks only for what is new", async () => {
    const sent: string[] = [];
    let clock = NOW;
    const fetchImpl = vi.fn(async (url: string) => { sent.push(url); return ok([CAPTURED_CLAIM]); });
    const reader = createCardActivityReader({
      fetch: fetchImpl as never, now: () => clock, repo: "owner/repo",
    });

    await reader.read();
    const boot = new URL(sent[0]!).searchParams.get("since")!;
    expect(Date.parse(boot)).toBe(NOW - CARD_ACTIVITY_BOOT_HOURS * 3_600_000);

    clock = NOW + CARD_ACTIVITY_TTL_MS + 1;
    await reader.read();
    const next = new URL(sent[1]!).searchParams.get("since")!;
    /* The last SUCCESS, less the overlap — not the clock, and not the window. */
    expect(Date.parse(next)).toBe(NOW - CARD_ACTIVITY_OVERLAP_MS);
  });

  it("the boot read pages to the cap, and a short page ends it", async () => {
    const full = Array.from({ length: CARD_ACTIVITY_PAGE }, () => CAPTURED_PROSE);
    const capped = vi.fn(async () => ok(full));
    const reader = createCardActivityReader({ fetch: capped as never, now: () => NOW });
    await reader.read();
    expect(capped).toHaveBeenCalledTimes(CARD_ACTIVITY_MAX_PAGES);

    const short = vi.fn(async () => ok([CAPTURED_PROSE]));
    const second = createCardActivityReader({ fetch: short as never, now: () => NOW });
    await second.read();
    expect(short).toHaveBeenCalledTimes(1);
  });
});

describe("the three outcomes are kept apart", () => {
  it("never read is not an empty board", async () => {
    const reader = createCardActivityReader({
      fetch: vi.fn(async () => rateLimited()) as never, now: () => NOW,
    });
    const answer = await reader.read();
    expect(answer.available).toBe(false);
    expect(answer.available === false && answer.why).toContain("403");
  });

  it("read and empty is available, fresh, and holds nothing", async () => {
    const reader = createCardActivityReader({ fetch: vi.fn(async () => ok([])) as never, now: () => NOW });
    const answer = await reader.read();
    expect(answer).toMatchObject({ available: true, stale: false, why: null });
    expect(answer.available === true && answer.facts).toEqual([]);
  });

  it("⚠ read once and failing since keeps every fact and says it is stale", async () => {
    let clock = NOW;
    let healthy = true;
    const reader = createCardActivityReader({
      fetch: vi.fn(async () => (healthy ? ok([CAPTURED_CLAIM, CAPTURED_REFUSAL]) : rateLimited())) as never,
      now: () => clock,
    });
    const first = await reader.read();
    expect(first.available === true && first.facts).toHaveLength(2);

    healthy = false;
    clock = NOW + CARD_ACTIVITY_TTL_MS + 1;
    const second = await reader.read();
    expect(second).toMatchObject({ available: true, stale: true });
    /* THE POINT: a failed refresh must not empty the claims. A reader that
       forgot them would put every claimed card back on offer on his page. */
    expect(second.available === true && second.facts).toHaveLength(2);
  });

  it("a body GitHub did not send as a list is a failure, not an empty read", async () => {
    const reader = createCardActivityReader({
      fetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: "x" }) })) as never,
      now: () => NOW,
    });
    expect((await reader.read()).available).toBe(false);
  });
});

describe("the cache", () => {
  let clock = NOW;
  beforeEach(() => { clock = NOW; });

  it("inside the TTL it does not ask again", async () => {
    const fetchImpl = vi.fn(async () => ok([CAPTURED_CLAIM]));
    const reader = createCardActivityReader({ fetch: fetchImpl as never, now: () => clock });
    await reader.read();
    clock = NOW + CARD_ACTIVITY_TTL_MS - 1;
    await reader.read();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("a refusing GitHub is not asked again inside the TTL either", async () => {
    const fetchImpl = vi.fn(async () => rateLimited());
    const reader = createCardActivityReader({ fetch: fetchImpl as never, now: () => clock });
    await reader.read();
    clock = NOW + CARD_ACTIVITY_TTL_MS - 1;
    await reader.read();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("two readers at once share one refresh", async () => {
    let resolve: ((rows: unknown[]) => void) | null = null;
    const fetchImpl = vi.fn(() => new Promise<Response>((done) => {
      resolve = (rows) => done(ok(rows));
    }));
    const reader = createCardActivityReader({ fetch: fetchImpl as never, now: () => clock });
    const both = Promise.all([reader.read(), reader.read()]);
    /* Let both callers reach the reader before the single request answers. */
    await Promise.resolve();
    resolve!([CAPTURED_CLAIM]);
    const [a, b] = await both;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.available === true && a.facts).toHaveLength(1);
    expect(b.available).toBe(true);
  });

  it("the newest of each kind per card is what it keeps", async () => {
    const older = { ...CAPTURED_CLAIM, created_at: "2026-09-25T10:00:00Z", body: "CLAIMED — seat-old, x\n" };
    const newer = { ...CAPTURED_CLAIM, created_at: "2026-09-26T02:15:15Z", body: "CLAIMED — seat-new, x\n" };
    const reader = createCardActivityReader({
      fetch: vi.fn(async () => ok([newer, older])) as never, now: () => NOW,
    });
    const answer = await reader.read();
    expect(answer.available === true && answer.facts).toEqual([
      { kind: "claim", card: 1094, seat: "seat-new", at: "2026-09-26T02:15:15Z" },
    ]);
  });

  it("reset forgets, so a suite cannot inherit another's board", async () => {
    const reader = createCardActivityReader({ fetch: vi.fn(async () => ok([CAPTURED_CLAIM])) as never, now: () => NOW });
    await reader.read();
    reader.reset();
    expect((await createCardActivityReader({
      fetch: vi.fn(async () => ok([])) as never, now: () => NOW,
    }).read()).available).toBe(true);
    reader.reset();
  });
});

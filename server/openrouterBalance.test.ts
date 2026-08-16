/**
 * THE BALANCE LINE THAT NOBODY TYPES.
 *
 * The founder was ~$100 down on OpenRouter while every shift report truthfully
 * said "zero model calls" (fable-682): the per-shift figure was honest and the
 * week had spent $118.62 on courts, benches and his own edits. The account was
 * at **$9.76 of $210.00** when it was finally read — and at zero the
 * interpreter and treatment stage fail, so every paid roll and refine dies at
 * dispatch.
 *
 * The fix is a line in the park block and the deploy receipt that is READ
 * every time, and the thing that must never happen is the one this suite
 * guards: an unreadable balance rendering as a comfortable number. A missing
 * key, an HTTP 401, a garbled body — each has to say UNREAD, because a state
 * block that quietly reports "fine" when it learned nothing is worse than no
 * line at all.
 *
 * Driven through the real reader with a fake `fetch`. The real network is
 * never touched here and the real key is never read.
 */
import { describe, expect, it, vi } from "vitest";

import {
  balanceLine,
  LOW_BALANCE_USD,
  readOpenRouterBalance,
  readOpenRouterUsage,
} from "../scripts/lib/openrouterBalance.mts";

const KEY = "sk-or-v1-NOT-A-REAL-KEY";

function respond(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("the OpenRouter balance is read, never remembered", () => {
  it("reads the remainder off the account's two lifetime figures", async () => {
    // The real figures from the morning this was ordered.
    const balance = await readOpenRouterBalance(
      KEY,
      respond({ data: { total_credits: 210, total_usage: 200.24 } }),
    );
    expect(balance).toEqual({ ok: true, remaining: 210 - 200.24, total: 210, used: 200.24, low: true });
    expect(balanceLine(balance)).toContain("$9.76 remaining of $210.00");
  });

  it("SHOUTS below the floor, and names the consequence", () => {
    const line = balanceLine({ ok: true, remaining: 9.76, total: 210, used: 200.24, low: true });
    expect(line).toContain("LOW");
    expect(line, "a number without its consequence is a number nobody acts on")
      .toContain("dies at dispatch");
  });

  it("is quiet above the floor", async () => {
    const balance = await readOpenRouterBalance(
      KEY,
      respond({ data: { total_credits: 210, total_usage: 100 } }),
    );
    expect(balance.ok && balance.low).toBe(false);
    expect(balanceLine(balance)).not.toContain("LOW");
    expect(balanceLine(balance)).toContain("$110.00 remaining");
  });

  it("puts the boundary on the right side", async () => {
    const just = await readOpenRouterBalance(
      KEY,
      respond({ data: { total_credits: 100, total_usage: 100 - LOW_BALANCE_USD } }),
    );
    expect(just.ok && just.remaining).toBe(LOW_BALANCE_USD);
    expect(just.ok && just.low, "exactly at the floor is not below it").toBe(false);
  });

  /*
    THE ARM THE WHOLE FILE EXISTS FOR.

    Every way of learning nothing must READ as learning nothing. A state block
    that prints a comfortable figure when the read failed is the defect the
    campaign ledger already paid for once, in the other direction.
  */
  describe("an unreadable balance says UNREAD", () => {
    it("no key", async () => {
      const balance = await readOpenRouterBalance(undefined, respond({}));
      expect(balance.ok).toBe(false);
      expect(balanceLine(balance)).toContain("UNREAD");
    });

    it("HTTP failure", async () => {
      const balance = await readOpenRouterBalance(KEY, respond({}, { ok: false, status: 401 }));
      expect(balance.ok).toBe(false);
      expect(balanceLine(balance)).toContain("HTTP 401");
    });

    it("a body with no numbers in it", async () => {
      const balance = await readOpenRouterBalance(KEY, respond({ data: { total_credits: "lots" } }));
      expect(balance.ok).toBe(false);
      expect(balanceLine(balance)).toContain("UNREAD");
    });

    it("a network that is not there", async () => {
      const dead = vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as unknown as typeof fetch;
      const balance = await readOpenRouterBalance(KEY, dead);
      expect(balance.ok).toBe(false);
      expect(balanceLine(balance)).toContain("UNREAD");
    });
  });

  /*
    The key is used and never printed. Asserted over every failure path,
    because a provider's error body is exactly where a key gets echoed back —
    and a state block is pasted into a mailbox and read by two agents.
  */
  /*
    THIS ARM FOUND A REAL LEAK, on its first run, in the code above it.

    The transport-error path was `unreachable (${error.message})`, and an error
    message is written by whatever threw it — a fetch or a proxy can echo the
    request, key and all. The line is pasted into a mailbox two agents read.
    The fix was to print a CODE (`ENOTFOUND`) from a closed set instead, which
    cannot carry a secret. Keeping the arm pointed at all four paths, because
    the leak was on the one path a reader would least expect to render text.
  */
  it("never puts the key in the line, on any path", async () => {
    const paths = [
      await readOpenRouterBalance(KEY, respond({}, { ok: false, status: 401 })),
      await readOpenRouterBalance(KEY, respond({ error: `bad key ${KEY}` })),
      await readOpenRouterBalance(KEY, vi.fn().mockRejectedValue(new Error(`refused for ${KEY}`)) as unknown as typeof fetch),
      await readOpenRouterBalance(KEY, respond({ data: { total_credits: 210, total_usage: 1 } })),
    ];
    for (const balance of paths) expect(balanceLine(balance)).not.toContain(KEY);
  });

  it("sends the key as a bearer token and asks the credits endpoint", async () => {
    const spy = respond({ data: { total_credits: 1, total_usage: 0 } });
    await readOpenRouterBalance(KEY, spy);
    const [url, init] = (spy as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/credits");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });
});

/**
 * THE USAGE WINDOWS — the founder's "$100 in LLM credits" question, read off
 * the account rather than reconstructed from our rows (fable-684 §6).
 *
 * The reason this is a READING and not a derivation is the whole point of it:
 * nothing about our own record-keeping can make it wrong. Our rows get the
 * humbler job of explaining its shape, and of saying how much they cannot.
 */
describe("what this key has spent, in the account's own windows", () => {
  const REAL = {
    data: {
      /* The truncated key OpenRouter echoes back. It must never leave here. */
      label: "sk-or-v1-b5c...843",
      is_management_key: false,
      usage: 200.31760482,
      usage_daily: 0.093356,
      usage_weekly: 118.700916,
      usage_monthly: 198.00078,
    },
  };

  it("reads all four windows off the real payload", async () => {
    const usage = await readOpenRouterUsage(KEY, respond(REAL));
    expect(usage).toEqual({
      ok: true,
      lifetime: 200.31760482,
      monthly: 198.00078,
      weekly: 118.700916,
      daily: 0.093356,
      isManagementKey: false,
    });
  });

  /*
    THE LABEL IS A TRUNCATED KEY. It rides in the same object as the numbers,
    and this reader's return type is the only thing standing between it and a
    mailbox. An explicit projection, not a spread (invariant 8).
  */
  it("never carries the key's own label out of the reader", async () => {
    const usage = await readOpenRouterUsage(KEY, respond(REAL));
    expect(JSON.stringify(usage)).not.toContain("sk-or");
    expect(Object.keys(usage)).not.toContain("label");
  });

  it("says UNREAD rather than reporting zeroes when it learns nothing", async () => {
    expect((await readOpenRouterUsage(undefined, respond(REAL))).ok).toBe(false);
    expect((await readOpenRouterUsage(KEY, respond({}, { ok: false, status: 401 }))).ok).toBe(false);
    const empty = await readOpenRouterUsage(KEY, respond({ data: {} }));
    expect(empty.ok).toBe(false);
    expect(empty.ok === false && empty.why).toContain("no numeric usage");
  });

  /* The door to the per-day, per-model breakdown. `/api/v1/activity` refuses
     this key with "Only management keys can fetch activity for an account", so
     a report that wants the breakdown must say which key it lacks. */
  it("reports whether this key could ask for the daily breakdown", async () => {
    const ordinary = await readOpenRouterUsage(KEY, respond(REAL));
    expect(ordinary.ok === true && ordinary.isManagementKey).toBe(false);
    const management = await readOpenRouterUsage(
      KEY,
      respond({ data: { ...REAL.data, is_management_key: true } }),
    );
    expect(management.ok === true && management.isManagementKey).toBe(true);
  });
});

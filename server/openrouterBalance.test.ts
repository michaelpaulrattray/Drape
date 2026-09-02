/**
 * THE BALANCE LINE THAT NOBODY TYPES.
 *
 * The founder was ~$100 down on OpenRouter while every shift report truthfully
 * said "zero model calls" (fable-682): the per-shift figure was honest and the
 * week had spent $118.62 on courts, benches and his own edits. The account was
 * at **$9.76 of $210.00** when it was finally read — and at that time zero meant
 * an outage: the interpreter and treatment stage fail, so every paid roll and
 * refine dies at dispatch. **That consequence was retired on 2026-08-16**, when
 * the founder turned auto top-up on for both providers. **And the shout itself
 * was retired on 2026-09-02**, on his word — *"open router auto tops up i
 * never want to see it as an issue appear again"* — after thirteen days of a
 * `*** LOW ***` line that could never clear (floor $20, top-up $10) and was
 * transcribed by shifts into a problems row on his page. The line is a reading
 * now: the figures, nothing else. The `low` field is still computed so the
 * boundary arm proves the arithmetic, and the arm below proves nobody prints it.
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  balanceLine,
  LOW_BALANCE_USD,
  readOpenRouterBalance,
  readOpenRouterUsage,
  readOpenRouterActivity,
  activityByDay,
  booksLine,
} from "../scripts/lib/openrouterBalance.mts";

const KEY = "sk-or-v1-NOT-A-REAL-KEY";

function respond(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }) as unknown as typeof fetch;
}

/**
 * EVERY READER HERE DEFAULTS ITS KEY OUT OF `process.env`, AND
 * `vitest.setup.ts` LOADS `.env`.
 *
 * So an arm that passes `undefined` to prove the missing-key path is, on a
 * machine that HAS the key, an assertion about the developer's machine rather
 * than about the reader. It bit twice in one shift — once in `falSpend.test.ts`
 * the moment a real `FAL_ADMIN_KEY` appeared, and once here the moment
 * `OPENROUTER_MANAGEMENT_KEY` did — so the fix is at the file rather than at
 * the two call sites that happened to be caught.
 *
 * Removed for every test and restored afterwards: no test in this file wants
 * an ambient credential, and the ones that want a key pass one explicitly.
 */
const CREDENTIALS = ["OPENROUTER_API_KEY", "OPENROUTER_MANAGEMENT_KEY"] as const;
let saved: Array<string | undefined> = [];
beforeEach(() => {
  saved = CREDENTIALS.map((name) => process.env[name]);
  for (const name of CREDENTIALS) delete process.env[name];
});
afterEach(() => {
  CREDENTIALS.forEach((name, index) => {
    const value = saved[index];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  });
});

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

  /**
   * Every word the shout actually carried on a real receipt, declared ONCE:
   * the arm reads it, and the positive control drives the retired line through
   * the same arm (reviewer finding on #440, law 4 — a control that re-declares
   * a subset of the list proves `includes` works, not that the arm can fail).
   */
  const RETIRED_SHOUT = ["LOW", "***", "not firing", "spend line", "covers the outage", "dies at dispatch"] as const;
  const assertNoShout = (line: string) => {
    for (const banned of RETIRED_SHOUT) {
      if (line.includes(banned)) throw new Error(`the retired shout is back: "${banned}"`);
    }
  };

  it("does NOT shout below the floor — a balance is a reading, never a problem (founder, 2026-09-02)", () => {
    const line = balanceLine({ ok: true, remaining: 9.76, total: 210, used: 200.24, low: true });
    /* The consequence clause MOVED TWICE (2026-08-16, 2026-08-19) and then the
       whole shout was retired on his word. What is asserted now is the
       opposite of what this arm used to assert: the figures are present, and
       none of the alarm vocabulary is — not the marker, not the accusation,
       not the instruction to go and look. */
    expect(line).toContain("$9.76 remaining of $210.00");
    expect(() => assertNoShout(line)).not.toThrow();
  });

  it("the banned-word arm can fail — the retired shout, driven through the SAME arm, reddens", () => {
    const retired = "openrouter *** LOW: $9.76 remaining of $210.00 — below $20. Look at the spend line. ***";
    expect(() => assertNoShout(retired)).toThrow(/retired shout is back/);
    expect(RETIRED_SHOUT.length, "an emptied list would pass the arm above on anything").toBeGreaterThan(0);
  });

  it("is quiet above the floor, and identical in shape to below it", async () => {
    const balance = await readOpenRouterBalance(
      KEY,
      respond({ data: { total_credits: 210, total_usage: 100 } }),
    );
    expect(balance.ok && balance.low).toBe(false);
    expect(balanceLine(balance)).not.toContain("LOW");
    expect(balanceLine(balance)).toContain("$110.00 remaining");
    /* Above and below the floor the line has ONE shape — the figures. If a
       future edit makes the two differ, the difference is a shout coming back
       by another name. */
    const below = balanceLine({ ok: true, remaining: 9.76, total: 210, used: 200.24, low: true });
    expect(below.replace(/\$[\d.]+/g, "$N")).toBe(balanceLine(balance).replace(/\$[\d.]+/g, "$N"));
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

/**
 * THE BOOKS — per day, per model, from the provider (fable-693).
 *
 * This is the reading that turns the reconciliation the right way round: the
 * account's own figures become the CLAIM and our census becomes the
 * cross-check. Two properties of it have to survive into every line built on
 * it, and both are asserted here: it is ACCOUNT-wide rather than per-key, and
 * it is DAILY grain — too coarse to prove a drip, however tempting.
 */
describe("the daily books, read rather than derived", () => {
  /* Three real rows, as the endpoint returned them on 2026-08-16. */
  const REAL = {
    data: [
      {
        date: "2026-08-15 00:00:00", model: "anthropic/claude-sonnet-5",
        usage: 98.04217, requests: 10102, prompt_tokens: 42910025, completion_tokens: 1222212,
      },
      {
        date: "2026-08-15 00:00:00", model: "anthropic/claude-sonnet-5",
        usage: 0.010066, requests: 1, prompt_tokens: 4978, completion_tokens: 11,
      },
      {
        date: "2026-08-14 00:00:00", model: "anthropic/claude-sonnet-5",
        usage: 6.476766, requests: 854, prompt_tokens: 2748563, completion_tokens: 97964,
      },
    ],
  };

  it("reads the rows and folds a day's endpoints together", async () => {
    const activity = await readOpenRouterActivity(KEY, respond(REAL));
    expect(activity.ok).toBe(true);
    const days = activityByDay(activity.ok === true ? activity.rows : []);
    expect(days).toHaveLength(2);
    /* Newest first, and the two 08-15 rows are ONE day. */
    expect(days[0]!.date).toBe("2026-08-15");
    expect(days[0]!.usd).toBeCloseTo(98.052236, 6);
    expect(days[0]!.requests).toBe(10103);
  });

  it("prints the biggest day beside the window's total, and says ACCOUNT-wide", async () => {
    const line = booksLine(await readOpenRouterActivity(KEY, respond(REAL)));
    expect(line).toContain("biggest 2026-08-15 $98.05");
    expect(line).toContain("30d $104.53");
    expect(line, "a per-key reading is what a reader will assume unless told")
      .toContain("ACCOUNT-wide");
  });

  /* A management key is a different credential from the inference one, and the
     refusal has to name WHICH — the same rule the fal 403 taught. */
  it("names the management key when refused, and stays UNREAD everywhere else", async () => {
    const refused = await readOpenRouterActivity(KEY, respond({}, { ok: false, status: 403 }));
    expect(refused.ok === false && refused.why).toContain("MANAGEMENT key");
    expect(booksLine(refused)).toContain("UNREAD");
    expect((await readOpenRouterActivity(undefined, respond(REAL))).ok).toBe(false);
    expect(booksLine(await readOpenRouterActivity(KEY, respond({ data: "nope" }))))
      .toContain("no activity rows");
  });

  /* An empty window is not an unreadable one, and must not print as a failure —
     a new account and a broken key would otherwise look identical. */
  it("distinguishes an empty window from an unreadable one", async () => {
    const line = booksLine(await readOpenRouterActivity(KEY, respond({ data: [] })));
    expect(line).toContain("no activity in the last 30 days");
    expect(line).not.toContain("UNREAD");
  });
});

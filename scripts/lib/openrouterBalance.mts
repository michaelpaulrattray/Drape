/**
 * WHAT IS LEFT ON THE OPENROUTER ACCOUNT — generated, never typed.
 *
 * # The incident
 *
 * The founder noticed he was **~$100 down on OpenRouter** while every shift
 * report said "zero model calls" (fable-682). Both were true and the pair was
 * misleading: the per-shift figure was honest, and the WEEK spent $118.62 on
 * court campaigns, benches and his own edits — word-billed interpreter and
 * verification reads that the census only began counting two days earlier.
 * "Unmeasured is not free" was literally this money, and he felt it before we
 * priced it.
 *
 * The account was at **$9.76 remaining of $210.00** when that was read.
 *
 * ⚠ **AND THE SENTENCE THAT STOOD HERE WAS TRUE OF ONE ROAD AND SAID OF BOTH**
 * (corrected 2026-08-24, opus-1142, read at the two call sites). It said *"every
 * paid roll and refine dies at dispatch"*. Read at the code, a zero balance does
 * two different things, and the difference is what a shift needs before it
 * decides whether to spend the last of it on a diagnostic:
 *
 *   refine   **dies, free.** `interpretRefinement` has no engine and returns
 *            `unreadable` — *"Fail CLOSED — refusing costs nobody anything"*
 *            (`refineInterpreter.ts`). Nobody is charged and nobody can edit.
 *   roll     **RUNS, degraded.** `castingBriefCompiler` falls back to
 *            `fallbackIntent(briefText)` on `unavailable` — the house fail-open
 *            policy for checkers, so an interpreter outage never blocks a paid
 *            run. The one exception is a STYLED brief, refused free rather than
 *            cast photoreal (`briefCompiler.ts`, the `styledBrief` arm).
 *
 * So the outage is total on the edit surface and invisible-but-worse on the
 * casting one: rolls keep charging and keep landing, cast from a sentence
 * nothing interpreted. A fuse measured in days of ordinary use either way.
 *
 * # Why it is a generated line and not a note in a report
 *
 * A number a human types into a state block is a number that goes stale
 * silently, and the campaign ledger learned this the expensive way: a gross
 * figure was carried across weeks of reports while the real one grew
 * underneath it. So the balance is READ at park time and at deploy time, or it
 * says it could not be read. There is no third option and no remembered value.
 *
 * # The key
 *
 * Used, never printed, never returned, never logged — not in the happy path
 * and not in an error. The failure line names the STATUS, never the response
 * body, because a provider's error body is exactly where a key gets echoed
 * back at you.
 */

/**
 * ⚠ **IT CANNOT PRICE A SHORT RUN, AND IT FAILS TOWARD *FREE*** — measured
 * 2026-08-24 (opus-1148), because a court was about to be costed with it.
 *
 * `/api/v1/credits`' `total_usage` SETTLES LATE. One interpreter drive was put
 * through the real entrance with this reader called at both ends, the way every
 * court here reads a balance:
 *
 *     before   $4.7629
 *     after    $4.7629      delta $0.0000
 *     +30s     $4.7629
 *     +~1min   $4.7629
 *     +~5min   $4.6829      delta $0.0800
 *
 * The drive had spent eight cents the whole time. So a before/after read around
 * minutes of work prints **FREE**, which is the dangerous direction of wrong:
 * a shift reading it would report a spend that happened as a spend that did
 * not, and would size the next court off it.
 *
 * **The instrument that works at that resolution is the CALL CENSUS times the
 * published price**, and the two reconcile to the cent: the census recorded
 * 15,262 prompt and 4,949 completion tokens against `anthropic/claude-sonnet-5`,
 * whose `/api/v1/models` figures are $0.000002 and $0.00001 a token —
 * $0.0305 + $0.0495 = **$0.0800**, which is exactly the delta that appeared
 * five minutes later.
 *
 * So: this reader is the RUNWAY line — will the product stop working — and it
 * is honest at that grain. It is not a receipt, and a court that prices itself
 * with it is quoting a number that had not happened yet.
 */

/** Below this, the line shouts. Days of ordinary use, not weeks. */
export const LOW_BALANCE_USD = 20;

/**
 * The short, closed-vocabulary half of a thrown error.
 *
 * `code` where the runtime supplies one (node puts `ENOTFOUND` on the cause of
 * a failed fetch), otherwise the error's class name. Never `message`.
 */
function transportCode(error: unknown): string {
  const direct = (error as { code?: unknown } | null)?.code;
  if (typeof direct === "string" && direct) return direct;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof cause === "string" && cause) return cause;
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" && name ? name : "unknown";
}

export type OpenRouterBalance =
  | { ok: true; remaining: number; total: number; used: number; low: boolean }
  | { ok: false; why: string };

/**
 * Read the account's credit position.
 *
 * `/api/v1/credits` answers with the two lifetime figures — granted and spent
 * — and the difference is what is left. Deliberately not the per-day/week
 * endpoint: this line exists to answer "will the product stop working", and
 * only the remainder answers that.
 *
 * # ⚠ IT IS A POSITION, NOT A SPEND METER (2026-08-24, ruled fable-1544 Q4)
 *
 * Reading it either side of a call answers *what does the account hold*, which
 * is only *what did that cost* if the charge has landed and nothing else moved
 * the account. **Neither holds by default**, and this endpoint's own shape says
 * why the first one bites: `total` is the LIFETIME granted figure, so a top-up
 * raises the remainder without any of it being a refund — which is exactly what
 * the rite's warning line means by *"a top-up would RAISE the granted figure
 * beside it; if that number is not moving, the top-up is not firing."*
 *
 * The sibling ledger is where this was measured rather than argued:
 * `scripts/lib/falSpend.mts` settles about **three minutes late** and rose $20
 * mid-run on an auto top-up, printing a spend of **`$-18.6600`**. So a caller
 * pricing anything against EITHER ledger waits for **two consecutive equal
 * reads after a move** and **checks the direction as well as the delta** — a run
 * whose balance rose is un-measured rather than cheap.
 *
 * `docs/specs/INSTRUMENT_DOCTRINE.md` #25 is the rule both readers belong to.
 */
export async function readOpenRouterBalance(
  key: string | undefined = process.env.OPENROUTER_API_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterBalance> {
  if (!key) return { ok: false, why: "OPENROUTER_API_KEY not set in this process" };
  let response: Response;
  try {
    response = await fetchImpl("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (error) {
    /*
      A CODE, NEVER A MESSAGE — and this line was the other way round until its
      own test failed.

      An error's `message` is written by whatever threw it, and a transport or
      provider error is exactly the place a key gets echoed back inside one
      ("refused for sk-or-…"). This line is printed into a park block that is
      pasted into a mailbox and read by two agents, so the message cannot be
      trusted into it. A code (`ENOTFOUND`, `ECONNRESET`) is a fixed token from
      a closed set, it cannot carry a secret, and it is the half that actually
      helps diagnosis.
    */
    return { ok: false, why: `unreachable (${transportCode(error)})` };
  }
  if (!response.ok) return { ok: false, why: `HTTP ${response.status}` };

  let body: { data?: { total_credits?: unknown; total_usage?: unknown } };
  try {
    body = await response.json() as typeof body;
  } catch {
    return { ok: false, why: "unparseable response" };
  }
  const total = Number(body?.data?.total_credits);
  const used = Number(body?.data?.total_usage);
  if (!Number.isFinite(total) || !Number.isFinite(used)) {
    return { ok: false, why: "response carried no numeric credit figures" };
  }
  const remaining = total - used;
  return { ok: true, remaining, total, used, low: remaining < LOW_BALANCE_USD };
}

export type OpenRouterUsage =
  | {
    ok: true;
    /** Lifetime, and the three windows the account keeps itself. */
    lifetime: number;
    monthly: number;
    weekly: number;
    daily: number;
    /** Whether this key could ask for the per-day, per-model breakdown. */
    isManagementKey: boolean;
  }
  | { ok: false; why: string };

/**
 * WHAT THIS KEY HAS SPENT, IN THE ACCOUNT'S OWN WINDOWS — the founder's
 * "$100 in LLM credits" question, answered by a reading rather than a
 * derivation (fable-684 §6).
 *
 * `/api/v1/key` describes the key you asked with, and it carries `usage`,
 * `usage_daily`, `usage_weekly` and `usage_monthly`. That is the whole
 * headline of the reconciliation: **it is not our arithmetic, so nothing about
 * our own record-keeping can make it wrong.** Our rows then have the humbler
 * and more useful job of explaining the SHAPE of it, and of saying out loud how
 * much of it they cannot explain.
 *
 * `is_management_key` rides along because it is the door to the rest: the
 * per-day, per-model breakdown lives at `/api/v1/activity`, which answers
 * *"Only management keys can fetch activity for an account"* to this one. Same
 * shape as fal's admin key, and the same two-minute fix.
 */
export async function readOpenRouterUsage(
  key: string | undefined = process.env.OPENROUTER_API_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterUsage> {
  if (!key) return { ok: false, why: "OPENROUTER_API_KEY not set in this process" };
  let response: Response;
  try {
    response = await fetchImpl("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (error) {
    return { ok: false, why: `unreachable (${transportCode(error)})` };
  }
  if (!response.ok) return { ok: false, why: `HTTP ${response.status}` };
  let body: { data?: Record<string, unknown> };
  try {
    body = await response.json() as typeof body;
  } catch {
    return { ok: false, why: "unparseable response" };
  }
  /*
    THE LABEL IS NEVER TOUCHED. `data.label` carries a truncated form of the key
    itself; this reader takes the four numbers and the one boolean and leaves
    the rest in the response object, so no caller can print what it never got.
  */
  const data = body?.data ?? {};
  const numbers = {
    lifetime: Number(data.usage),
    monthly: Number(data.usage_monthly),
    weekly: Number(data.usage_weekly),
    daily: Number(data.usage_daily),
  };
  if (Object.values(numbers).some((value) => !Number.isFinite(value))) {
    return { ok: false, why: "response carried no numeric usage figures" };
  }
  return { ok: true, ...numbers, isManagementKey: data.is_management_key === true };
}

/** One day of one model's traffic, as the provider's own books record it. */
export type ActivityRow = {
  /** `YYYY-MM-DD`, UTC, as OpenRouter groups it. */
  date: string;
  model: string;
  usd: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
};

export type OpenRouterActivity =
  | { ok: true; rows: ActivityRow[] }
  | { ok: false; why: string };

/**
 * THE BOOKS, PER DAY AND PER MODEL — the provider's own, not our arithmetic
 * (fable-693).
 *
 * `/api/v1/activity` covers the last 30 completed UTC days and needs a
 * MANAGEMENT key, which is why every earlier attempt at this question had to be
 * a derivation. With the key set it is a reading, and it moves the
 * reconciliation the way fable-682 §4b wanted and could not have: **the
 * provider's books are the claim and our census is the cross-check**, rather
 * than the other way round.
 *
 * TWO THINGS IT IS NOT, and both belong in any line built on it:
 *
 *  - **It is ACCOUNT-wide, not key-wide.** The rows carry `endpoint_id` (which
 *    provider served the model) and no API-key attribution at all, so a second
 *    key on the same account is inside these figures with nothing to separate
 *    it. Today that is safe and it is CHECKABLE rather than assumed: the
 *    inference key's own lifetime `usage` equals the account total. The day it
 *    does not, this becomes an over-count and the line must say so.
 *  - **It is DAILY grain.** It cannot resolve a 7¢-per-half-hour drip, and
 *    quoting it as proof of one would be a reading pretending to a resolution
 *    it has not got.
 *
 * Its own key, like fal's admin key: this reader is the only thing that touches
 * `OPENROUTER_MANAGEMENT_KEY`, and inference keeps using `OPENROUTER_API_KEY`.
 */
export async function readOpenRouterActivity(
  key: string | undefined = process.env.OPENROUTER_MANAGEMENT_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterActivity> {
  if (!key) return { ok: false, why: "OPENROUTER_MANAGEMENT_KEY not set in this process" };
  let response: Response;
  try {
    response = await fetchImpl("https://openrouter.ai/api/v1/activity", {
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (error) {
    return { ok: false, why: `unreachable (${transportCode(error)})` };
  }
  if (response.status === 403) {
    return { ok: false, why: "HTTP 403 — activity wants a MANAGEMENT key; this one is not" };
  }
  if (!response.ok) return { ok: false, why: `HTTP ${response.status}` };
  let body: { data?: unknown };
  try {
    body = await response.json() as typeof body;
  } catch {
    return { ok: false, why: "unparseable response" };
  }
  if (!Array.isArray(body?.data)) return { ok: false, why: "response carried no activity rows" };
  const rows: ActivityRow[] = [];
  for (const entry of body.data as Array<Record<string, unknown>>) {
    const usd = Number(entry.usage);
    if (typeof entry.date !== "string" || !Number.isFinite(usd)) continue;
    rows.push({
      /* The API returns `2026-08-15 00:00:00`; the day is the whole grain. */
      date: entry.date.slice(0, 10),
      model: typeof entry.model === "string" ? entry.model : "(unnamed)",
      usd,
      requests: Number(entry.requests) || 0,
      promptTokens: Number(entry.prompt_tokens) || 0,
      completionTokens: Number(entry.completion_tokens) || 0,
    });
  }
  return { ok: true, rows };
}

/** Days, newest first, with each day's models folded together. */
export function activityByDay(
  rows: readonly ActivityRow[],
): Array<{ date: string; usd: number; requests: number; promptTokens: number; models: string[] }> {
  const days = new Map<string, { usd: number; requests: number; promptTokens: number; models: Set<string> }>();
  for (const row of rows) {
    const day = days.get(row.date)
      ?? { usd: 0, requests: 0, promptTokens: 0, models: new Set<string>() };
    day.usd += row.usd;
    day.requests += row.requests;
    day.promptTokens += row.promptTokens;
    day.models.add(row.model);
    days.set(row.date, day);
  }
  return [...days]
    .map(([date, day]) => ({ date, ...day, models: [...day.models].sort() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * The books, as one receipt line: the biggest day in the window and the window's
 * own total, because a single day's figure with no scale beside it is the shape
 * of number that gets misread in both directions.
 */
export function booksLine(activity: OpenRouterActivity): string {
  if (!activity.ok) return `openrouter books UNREAD — ${activity.why}`;
  const days = activityByDay(activity.rows);
  if (days.length === 0) return "openrouter books — no activity in the last 30 days";
  const total = days.reduce((sum, day) => sum + day.usd, 0);
  const worst = [...days].sort((a, b) => b.usd - a.usd)[0]!;
  const latest = days[0]!;
  return `openrouter books  ${latest.date} $${latest.usd.toFixed(2)}`
    + ` · 30d $${total.toFixed(2)} over ${days.length} day(s)`
    + ` · biggest ${worst.date} $${worst.usd.toFixed(2)} (${worst.requests.toLocaleString()} requests)`
    + "  [ACCOUNT-wide, not per-key]";
}

/**
 * The one line a state block prints.
 *
 * Shaped so the shout cannot be missed in a wall of monospace, and so an
 * UNREAD says unread rather than falling back to a comfortable number — an
 * unreadable balance and a healthy one must never look the same.
 */
export function balanceLine(balance: OpenRouterBalance): string {
  if (!balance.ok) return `openrouter UNREAD — ${balance.why}`;
  const figures = `$${balance.remaining.toFixed(2)} remaining of $${balance.total.toFixed(2)}`
    + ` (spent $${balance.used.toFixed(2)})`;
  /*
    THE CONSEQUENCE CLAUSE MOVED WHEN THE WORLD DID (founder, 2026-08-16 —
    auto top-up is ON for both providers; fable-692 §1).

    It used to end "every paid roll and refine dies at dispatch", which was the
    truth when a low balance stranded the product. It no longer strands: the
    account refills itself. Leaving the outage sentence in place would be this
    week's third instance of a line going on saying a thing after the thing
    stopped being true — so it now names what a low balance actually means
    today, which is a top-up about to fire and a reason to look at WHY.

    The line itself stays, loudly, because its job was never only runway: it is
    the leak detector, and the founder's own cast-browsing drip is exactly what
    it exists to make visible.

    AND THE CONSEQUENCE MOVED AGAIN, 2026-08-19 — the same defect, one revision
    later, on the very line that carries a paragraph about it. "Auto top-up
    covers the outage" was written from the founder's word that top-up is ON,
    and it was printed as a FACT this reader had not read. It is false for this
    provider: the balance went $8.75 (08-17) → $5.94 (08-19), both below the
    floor, with `total` UNCHANGED at $210 — a top-up landing would have raised
    it. fal's fired at $20 on the 17th; this one has let the balance fall
    through it twice.

    So the line no longer asserts what the account will do. `total` is what it
    can actually see, and a top-up is the only thing that moves it — so the
    line reports the reading and names the doubt, which is the whole difference
    between a leak detector and a reassurance. Working law 1: this reader may
    state what it read, never what somebody said was configured elsewhere.
  */
  return balance.low
    ? `openrouter *** LOW: ${figures} — below $${LOW_BALANCE_USD}. `
      + `A top-up would RAISE the $${balance.total.toFixed(2)} granted figure beside it; `
      + `if that number is not moving, the top-up is not firing. Look at the spend line. ***`
    : `openrouter ${figures}`;
}

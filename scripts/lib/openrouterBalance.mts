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
 * The account was at **$9.76 remaining of $210.00** when that was read. When
 * an OpenRouter balance reaches zero the interpreter and the treatment stage
 * fail, so **every paid roll and refine dies at dispatch** — a production
 * outage with a fuse measured in days of ordinary use.
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
  return balance.low
    ? `openrouter *** LOW: ${figures} — below $${LOW_BALANCE_USD}. `
      + `At zero the interpreter fails and every paid roll and refine dies at dispatch. ***`
    : `openrouter ${figures}`;
}

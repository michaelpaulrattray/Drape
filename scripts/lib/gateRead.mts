/**
 * A READ THAT FAILED IS NEVER A VERDICT — the retry behind
 * `scripts/gate-stall-check.mts` (#1409).
 *
 * # The incident, measured twice in one shift
 *
 * `--watch` is the one form of waiting a headless shift is allowed to do, and
 * a SINGLE transient network failure killed the whole poll. Both times, the
 * same shape (foreman-20260926-2230, on PR #1404):
 *
 *     Get "https://api.github.com/repos/…/actions/workflows/341788731/runs?…":
 *       dial tcp 4.237.22.34:443: connectex: A connection attempt failed
 *       because the connected party did not properly respond after a period…
 *
 * followed by an unhandled throw and a Node stack. Both retries succeeded
 * immediately, so nothing was wrong with GitHub, the gate, or the PR.
 *
 * # ⚠ WHY IT MATTERS MORE THAN IT LOOKS, AND IT IS NOT THE LOST MINUTES
 *
 * **An unhandled throw is neither of the script's two answers.** Its whole
 * purpose is to tell a RUNNING gate from one that will never arrive, and its
 * exit-2 finding means *stop waiting, this is a stall*. A shift reading a Node
 * stack in a log has to work out that its own INSTRUMENT fell over rather than
 * the thing it was watching — and it fails in the expensive direction, because
 * a shift that reads the stack as a stall stops waiting on a perfectly healthy
 * gate. That is the reverse of what the script exists for.
 *
 * It is the rule the desk sweep already follows and states in plain words:
 * **a read that failed is never a verdict.**
 *
 * # What is retried, and what must still throw
 *
 * Only a **network-level** failure: a dial or connection error, a timeout, a
 * 5xx, a rate-limit refusal. Everything else throws exactly as before —
 * **a 404, a 401, `gh auth login`, a malformed response are real faults, and
 * swallowing one would make the instrument lie**, which is the only failure
 * here worse than the one being fixed.
 *
 * ⚠ **THE CLASSIFIER IS THE RISK AND IT IS BOUNDED DELIBERATELY.** A pattern
 * that owns a real word would retry a genuine fault four times and then report
 * it in the wrong vocabulary. So the table below is explicit, each row named,
 * and its suite drives the whole non-transient list — a 404, a 401, bad
 * credentials, an unknown command, a JSON parse failure — as the arms that
 * matter.
 *
 * ⚠ **THE RETRY WRAPS THE `gh` CALL AND NOT THE JSON PARSE, which is the line
 * between the two classes.** A transient failure means `gh` itself failed; a
 * parse failure means `gh` SUCCEEDED and returned garbage, which is a real
 * fault about a real answer. Keeping the parse outside the retry is what makes
 * "malformed still throws" structural rather than a promise about patterns.
 *
 * # When the retries run out
 *
 * `GateReadUnavailable`, which the script reports in its own vocabulary and
 * with its own exit code — *"could not read the gate after N attempts"*, never
 * a raw stack. A reader can then tell **"my instrument could not see"** from
 * **"the gate has stalled"**, which is the whole point.
 *
 * ⚠ **A RATE LIMIT WILL USUALLY EXHAUST RATHER THAN RECOVER, AND THAT IS THE
 * INTENDED OUTCOME.** The backoff totals ~11 seconds and GitHub's secondary
 * limit asks for a minute, so a rate-limited read ends in the named finding.
 * That is correct: the budget is ONE account shared by every seat and the
 * crew, and a poller that sat there grinding against a rate limit would be
 * spending the thing it was refused for. Bounded, honest, and it stops.
 */

/** How many times a read is attempted in total, the first try included. */
export const READ_ATTEMPTS = 4;

/** The wait before attempts 2, 3 and 4. Short: a dial failure recovers fast. */
export const READ_BACKOFF_MS: readonly number[] = [1_000, 3_000, 7_000];

export type TransientClass = "network" | "server" | "rate-limit";

export type FailureReading =
  | { transient: true; why: TransientClass; matched: string }
  | { transient: false };

/**
 * The table. Each row is named so the retry line can say WHICH reading fired,
 * rather than printing "transient" over an unexplained decision.
 */
const TRANSIENT_PATTERNS: ReadonlyArray<{
  readonly why: TransientClass;
  readonly name: string;
  readonly pattern: RegExp;
}> = [
  /* The measured incident's own two strings, first and by name. */
  { why: "network", name: "dial tcp", pattern: /dial tcp/i },
  { why: "network", name: "connectex", pattern: /connectex/i },
  { why: "network", name: "connection refused/reset/attempt failed", pattern: /connection (?:reset|refused|attempt failed)/i },
  { why: "network", name: "i/o timeout", pattern: /i\/o timeout/i },
  { why: "network", name: "TLS handshake timeout", pattern: /TLS handshake timeout/i },
  { why: "network", name: "client timeout exceeded", pattern: /Client\.Timeout exceeded/i },
  { why: "network", name: "unexpected EOF", pattern: /unexpected EOF/i },
  { why: "network", name: "request timed out", pattern: /request timed out/i },
  /* Node's own errno strings, word-bounded so `ENOTFOUNDER` cannot match and
     so the English "not found" of a 404 never reaches this row. */
  { why: "network", name: "errno", pattern: /\b(?:ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|EPIPE|EHOSTUNREACH|ENETUNREACH)\b/ },
  /* A 5xx and nothing else — `HTTP 404` and `HTTP 401` must not match, and
     the suite drives both as negative controls. */
  { why: "server", name: "HTTP 5xx", pattern: /HTTP 5\d\d/ },
  { why: "server", name: "gateway/unavailable", pattern: /(?:Bad Gateway|Service Unavailable|Gateway Time-?out)/i },
  { why: "rate-limit", name: "rate limit", pattern: /rate limit/i },
  { why: "rate-limit", name: "submitted too quickly", pattern: /was submitted too quickly/i },
  { why: "rate-limit", name: "abuse detection", pattern: /abuse detection/i },
];

/** Every pattern's name, for a suite that wants the population derived. */
export const TRANSIENT_PATTERN_NAMES: readonly string[] = TRANSIENT_PATTERNS.map((row) => row.name);

/**
 * Is this failure worth retrying? Reads the whole text a failed `execFileSync`
 * produces — `message` carries the command, `stderr` carries what `gh` said,
 * and which of the two holds the reason is not this function's business.
 */
export function classifyReadFailure(text: string): FailureReading {
  for (const row of TRANSIENT_PATTERNS) {
    if (row.pattern.test(text)) return { transient: true, why: row.why, matched: row.name };
  }
  return { transient: false };
}

/** Everything a thrown `execFileSync` failure can be carrying, as one string. */
export function failureText(error: unknown): string {
  if (error === null || typeof error !== "object") return String(error);
  const shaped = error as { message?: unknown; stderr?: unknown; stdout?: unknown };
  return [shaped.message, shaped.stderr, shaped.stdout]
    .map((part) => (typeof part === "string" ? part : part instanceof Buffer ? part.toString("utf8") : ""))
    .filter((part) => part.length > 0)
    .join("\n");
}

/**
 * The retries ran out. Carries what a reader needs to tell this apart from a
 * stall at a glance, and never a stack.
 */
export class GateReadUnavailable extends Error {
  readonly attempts: number;
  readonly why: TransientClass;
  readonly lastText: string;

  constructor(attempts: number, why: TransientClass, lastText: string) {
    super(`could not read the gate after ${attempts} attempts (${why})`);
    this.name = "GateReadUnavailable";
    this.attempts = attempts;
    this.why = why;
    this.lastText = lastText;
  }
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `attempt`, retrying only the transient class.
 *
 * `sleep` is injected so the arms drive the REAL retry loop without spending
 * eleven seconds per case — the loop, the classifier and the give-up are the
 * code that ships; only the wait is substituted.
 */
export async function readWithRetry<T>(
  attempt: () => T,
  options: {
    attempts?: number;
    backoffMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (info: {
      attempt: number;
      of: number;
      waitMs: number;
      why: TransientClass;
      matched: string;
    }) => void;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? READ_ATTEMPTS;
  const backoff = options.backoffMs ?? READ_BACKOFF_MS;
  const sleep = options.sleep ?? realSleep;

  let lastText = "";
  let lastWhy: TransientClass = "network";

  for (let index = 0; index < attempts; index += 1) {
    try {
      return attempt();
    } catch (error) {
      const text = failureText(error);
      const reading = classifyReadFailure(text);
      /* ⚠ NOT TRANSIENT MEANS THE ORIGINAL ERROR, RE-THROWN UNTOUCHED. Not
         wrapped, not re-worded: a 401 must reach the caller looking exactly
         like a 401, because the whole bargain of this module is that it
         changes nothing about a real fault. */
      if (!reading.transient) throw error;

      lastText = text;
      lastWhy = reading.why;
      if (index === attempts - 1) break;

      const waitMs = backoff[Math.min(index, backoff.length - 1)] ?? 0;
      options.onRetry?.({
        attempt: index + 1,
        of: attempts,
        waitMs,
        why: reading.why,
        matched: reading.matched,
      });
      await sleep(waitMs);
    }
  }

  throw new GateReadUnavailable(attempts, lastWhy, lastText);
}

/**
 * WHAT ONE RENDER ACTUALLY COSTS, IN CALLS AND IN SECONDS — the stopwatch the
 * latency-and-cost program is ordered to take BEFORE anything is optimised.
 *
 * # Why this exists
 *
 * The founder's two sentences are the whole brief: *"5 minutes for 1 generation
 * is absurd"* and *"costs are getting ridiculous"*. The roadmap's answer to both
 * begins with the same instruction — **stopwatch every stage before optimising**
 * — and the product had no stopwatch. Every model call logs its own `latencyMs`
 * into a container log whose window rotates on every deploy, and nothing
 * anywhere says how many calls one paid edit makes or where its minutes go.
 *
 * A number nobody can read back is not a measurement. That is the same lesson
 * the scan-miss counter cost tonight, one surface along, and this is the same
 * shape of fix: the census rides on the row the render already writes, so
 * tomorrow's question is a query rather than an archaeology.
 *
 * # What it records, and what it deliberately does not
 *
 * One entry per outbound model call: which stage asked, which provider and
 * model answered, how long it took, and whether it succeeded. **No prompts, no
 * images, no replies** — this is a bill, not a transcript, and the creative
 * content of a customer's cast has no business in a telemetry field.
 *
 * # Why an AsyncLocalStorage rather than a parameter
 *
 * The calls happen four modules deep — a segmenter inside a harvest inside a
 * render, a verification reading inside a net — and threading a collector
 * through every signature would be a refactor of the paid path to buy a
 * measurement. The store is entered once per request and every call inside it
 * lands in the right census by construction, including the ones nobody
 * remembered to count.
 *
 * Outside a census, `recordProviderCall` does nothing at all: a roll, a sign, a
 * scan and every test that never opens one are unchanged.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** Which part of the product asked. Kept coarse: this answers "where do the
 *  minutes go", not "which line of code ran". */
export type CallStage =
  /** The brief or refine interpreter, and its re-looks. */
  | "interpret"
  /** A segmentation question — the region reader, on any of its roads. */
  | "segment"
  /** The paid picture itself. */
  | "render"
  /** A reading ABOUT a picture: verification, captions, descriptions. */
  | "read"
  /** Anything else that reaches a provider, named rather than hidden. */
  | "other";

export type ProviderCall = {
  stage: CallStage;
  /** `fal`, `openrouter` — the account the money leaves. */
  provider: string;
  /** The model as the provider names it, so an invoice line can be matched. */
  model: string;
  ms: number;
  ok: boolean;
  /** What it was asked about, when that is a fixed word rather than a
   *  customer's sentence — a region name or a `ReadPurpose`, never their
   *  prose. */
  about?: string;
  /**
   * WHAT IT COST IN TOKENS, where the provider bills that way (fable-658 §4).
   *
   * Calls and milliseconds price an image — a paint is a flat rate per picture,
   * measured at $0.099 off the account balance. They do not price a READING:
   * Sonnet is token-billed, so a fifth of every render was uncountable in money
   * even once its purposes were named. Two integers close that.
   *
   * Numbers only, and that is the whole content boundary — a token count is the
   * SIZE of a sentence and carries none of it.
   */
  tokens?: { in: number; out: number };
};

type Census = {
  calls: ProviderCall[];
  startedAt: number;
};

const store = new AsyncLocalStorage<Census>();

/**
 * Run something with a census open, and hand back what it cost.
 *
 * The result comes back beside the value rather than through a mutable the
 * caller passes in, so a caller cannot half-read a census that is still
 * filling — the shape that makes a partial reading look like a cheap render.
 */
export async function withCallCensus<T>(
  run: () => Promise<T>,
): Promise<{ value: T; census: CallCensus }> {
  const census: Census = { calls: [], startedAt: Date.now() };
  const value = await store.run(census, run);
  return { value, census: summarize(census) };
}

/** The same, for a caller that needs the census even when the work THREW. */
export async function censusOfAttempt<T>(
  run: () => Promise<T>,
): Promise<{ value?: T; error?: unknown; census: CallCensus }> {
  const census: Census = { calls: [], startedAt: Date.now() };
  try {
    const value = await store.run(census, run);
    return { value, census: summarize(census) };
  } catch (error) {
    return { error, census: summarize(census) };
  }
}

/**
 * Count one outbound model call. A no-op outside a census, by design.
 *
 * Called from the transport modules themselves rather than from their callers:
 * a call site that forgets is a call that does not appear, and the whole value
 * of this is that the total is the TOTAL.
 */
export function recordProviderCall(call: ProviderCall): void {
  const census = store.getStore();
  if (census === undefined) return;
  census.calls.push(call);
}

/**
 * Time a call and record it, whichever way it ends.
 *
 * `detail` exists because a token count is only knowable from the REPLY, and
 * everything else about a call is knowable before it is made. It reads the
 * returned value and nothing else — it is never handed the request, so it
 * cannot become a route by which a prompt reaches telemetry.
 *
 * A failed call has no reply to read, so it records no tokens. That is honest
 * rather than convenient: the provider may well have billed for it, and a zero
 * we invented would be indistinguishable from one we measured.
 */
export async function throughCensus<T>(
  what: Omit<ProviderCall, "ms" | "ok">,
  run: () => Promise<T>,
  detail?: (value: T) => Pick<ProviderCall, "tokens"> | undefined,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const value = await run();
    recordProviderCall({ ...what, ...(detail?.(value) ?? {}), ms: Date.now() - startedAt, ok: true });
    return value;
  } catch (error) {
    recordProviderCall({ ...what, ms: Date.now() - startedAt, ok: false });
    throw error;
  }
}

export type CallCensus = {
  /** Every call, in the order they finished. */
  calls: readonly ProviderCall[];
  /**
   * How many, how long they took added up — and the tokens, where the provider
   * bills that way.
   *
   * `tokenCalls` is beside the counts on purpose: a render whose token totals
   * come from three of its nine reads is a different number from one where all
   * nine reported, and without the denominator the two are indistinguishable.
   */
  total: { calls: number; ms: number; failed: number; tokensIn: number; tokensOut: number; tokenCalls: number };
  /**
   * WALL TIME, against the sum above — the pair that says whether the minutes
   * are spent waiting on one slow thing or on many things in a row.
   *
   * A render whose sum is four times its wall clock is running in parallel and
   * its problem is the slowest call; one whose sum EQUALS its wall clock is a
   * queue of serial round trips, and that is an architecture question rather
   * than a provider one. Neither is visible from a log line per call.
   */
  wallMs: number;
  /** Calls and milliseconds per stage, which is where the optimising starts. */
  byStage: Record<string, { calls: number; ms: number }>;
  /** And per model, which is where the invoice starts. */
  byModel: Record<string, { calls: number; ms: number }>;
  /**
   * AND PER QUESTION, which is where the reading stops being an argument.
   *
   * `about` has been recorded on every call since it existed — its own comment
   * says the point out loud, *"the difference between eleven segment calls and
   * eleven segment calls, six of them about eyes"* — and nothing ever summed
   * it, so the number that names the lever was collected and never read. A
   * field nobody asserts on is a field nobody has.
   *
   * Only calls that carry one appear, so a render whose calls are all prose
   * (the interpreter, the treatment) contributes nothing here rather than a row
   * of blanks.
   */
  byAbout: Record<string, { calls: number; ms: number }>;
};

function summarize(census: Census): CallCensus {
  const byStage: Record<string, { calls: number; ms: number }> = {};
  const byModel: Record<string, { calls: number; ms: number }> = {};
  const byAbout: Record<string, { calls: number; ms: number }> = {};
  let ms = 0;
  let failed = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let tokenCalls = 0;
  for (const call of census.calls) {
    ms += call.ms;
    if (!call.ok) failed += 1;
    if (call.tokens) {
      tokensIn += call.tokens.in;
      tokensOut += call.tokens.out;
      tokenCalls += 1;
    }
    const stage = byStage[call.stage] ?? { calls: 0, ms: 0 };
    stage.calls += 1;
    stage.ms += call.ms;
    byStage[call.stage] = stage;
    const key = `${call.provider}:${call.model}`;
    const model = byModel[key] ?? { calls: 0, ms: 0 };
    model.calls += 1;
    model.ms += call.ms;
    byModel[key] = model;

    if (call.about !== undefined) {
      const about = byAbout[call.about] ?? { calls: 0, ms: 0 };
      about.calls += 1;
      about.ms += call.ms;
      byAbout[call.about] = about;
    }
  }
  return {
    calls: census.calls,
    total: { calls: census.calls.length, ms, failed, tokensIn, tokensOut, tokenCalls },
    wallMs: Date.now() - census.startedAt,
    byStage,
    byModel,
    byAbout,
  };
}

/**
 * THE CALLS MADE SO FAR, for a row that is written before the request ends.
 *
 * Named for what it is rather than offered as "the census", because it is a
 * HALF-READ by construction: a variant's row lands while the request is still
 * finishing, so what it can honestly carry is what had been spent by the time
 * it was written. A reader that treated this as the total would understate
 * every render by whatever happens after the picture is stored.
 *
 * The complete one goes to the log line at the end of the request, and the two
 * are meant to be read together.
 */
export function censusSoFar(): CallCensus | null {
  const census = store.getStore();
  return census === undefined ? null : summarize(census);
}

/** True while a census is open — for a caller that wants to skip building a
 *  description nobody will read. */
export function censusIsOpen(): boolean {
  return store.getStore() !== undefined;
}

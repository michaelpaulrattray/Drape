import { ProviderError, providerMayHaveBilled } from "./types";

/**
 * HOW MANY PAID RENDERS ONE THING MAY COST — the cap Cid's flat price rests on
 * (#1968, his word 2026-10-08: *"on this card make both sign and
 * redo/regenerate 650 credis"*).
 *
 * His 650 for a Sign holds on a condition his finance team wrote down and the
 * card labels **required**: *"at most 2 head-sheet and 2 body-sheet renders per
 * Sign, re-makes and arrival retries from one pool, or Cid's figure is about
 * 1,100."* Nothing capped the sum, so this is that one pool.
 *
 * ## Why it is counted HERE and not in either loop
 *
 * ⚠ **THREE loops compose on this road, and the card names two of them.** The
 * house re-make ({@link SHEET_MAX_RENDERS} 2) sits above the arrival retry
 * (`ARRIVAL_ATTEMPTS` 3), and **below both sits `withRetry`'s own attempt loop
 * (`retries` 2, so three submissions)** — which `signSheetCoordinator`'s
 * docblock had already measured as the 3× in *"3 x ARRIVAL_ATTEMPTS 3 x
 * SHEET_MAX_RENDERS 2 = 18 engine calls"*. A counter in either named loop would
 * still let the unnamed one multiply underneath it, so the budget is charged at
 * the ONE place every submission passes through: each `attempt()` inside
 * {@link withRetry} is exactly one job submitted to the provider.
 *
 * ## Why a FAILED attempt usually costs nothing, and when it does not
 *
 * Cid's note on the card asks for exactly this distinction: *"a transport
 * failure that returned no frame is usually not billed by the provider. Say on
 * the PR which attempts actually cost money, and count those."*
 *
 * So the budget is charged AFTER an attempt rather than before it, and a
 * failure is charged only when it may have reached the provider's queue
 * ({@link providerMayHaveBilled}). Charging before the attempt would spend the
 * allowance on an unreachable host or a 4xx refusal — faults that cost us
 * nothing — and two network blips would then end a Sign that was never in any
 * danger. That is the rescue the arrival retry exists to give, and it survives.
 *
 * ⚠ **The direction of the doubt is deliberate and it is the opposite of the
 * retry question's.** `ProviderError.completed` defaults FALSE because the
 * retrying direction is kind to a customer who has paid. A BUDGET that read the
 * same default would undercount and the price would not hold, so
 * `providerMayHaveBilled` is fail-CLOSED: it answers false only where the error
 * proves the job never reached the queue. An over-count costs one rescue; an
 * under-count costs the margin on every Sign.
 */
export type RenderBudget = {
  /** Paid renders this budget allows in total. */
  readonly limit: number;
  /** Submissions charged so far — those that may have cost money. */
  readonly spent: number;
  /** Is there room for one more possibly-billed submission? */
  hasRoom(): boolean;
  /** Record a submission that may have cost money. */
  charge(): void;
};

/**
 * The fault a spent budget raises.
 *
 * ⚠ **Its class is `capability`, which is a choice and not a default**, on two
 * properties this needs and nothing else in the union has together:
 *
 * - it is **terminal for every loop above it** — not in `RETRYABLE_FAILURES`,
 *   so `withRetry` stops, and inside `VIEW_ARRIVAL_TERMINAL`, so neither
 *   arrival loop re-asks. A budget stop that any loop could retry would be no
 *   budget at all;
 * - it **does not open the circuit breaker** (`ProviderQueue.noteFailure`
 *   returns early for `content_policy` and `capability`). A spent budget is OUR
 *   decision about OUR money, not evidence that the provider is unwell, and
 *   counting it toward the breaker would take every other caller down with it.
 *
 * **The declined alternative is a failure class of its own**, which reads more
 * honestly and is the wrong trade here: four sets and `candidateFailureKind`
 * would each have to learn it, and a set that did not would fail OPEN — the
 * loop would retry and the cap would silently stop binding. `capability` maps
 * to the customer-facing `engine` bucket either way, so nothing a customer
 * reads says this picture was impossible.
 */
export function renderBudgetSpent(label: string, budget: RenderBudget): ProviderError {
  return new ProviderError(
    "capability",
    `${label}: this render budget is spent — ${budget.spent} of ${budget.limit} paid renders used`,
  );
}

/**
 * One pool, created by whoever owns the thing being priced.
 *
 * For a Sign that is `settleSignSheet`, once per sheet, so the head sheet and
 * the body sheet each get their own two and neither can eat the other's — which
 * is Cid's cap read exactly as he wrote it ("2 head-sheet and 2 body-sheet").
 */
export function createRenderBudget(limit: number): RenderBudget {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`createRenderBudget: limit must be a positive integer, got ${limit}`);
  }
  let spent = 0;
  return {
    limit,
    get spent() {
      return spent;
    },
    hasRoom() {
      return spent < limit;
    },
    charge() {
      spent += 1;
    },
  };
}

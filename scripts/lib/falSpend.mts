/**
 * WHAT WE ARE SPENDING AT FAL — read where fal will tell us, derived where it
 * will not, and never remembered (fable-684 §1).
 *
 * # Why this is not simply the OpenRouter line again
 *
 * The OpenRouter line answers one question — *will the product stop working* —
 * because that account publishes a remainder. **fal's remainder is behind a
 * door we are not through.** `GET /v1/account/billing?expand=credits` exists
 * and answers with `credits.current_balance`; probed with our own key on
 * 2026-08-16 it returns **HTTP 403 `authorization_error`**, because it wants an
 * ADMIN key and ours is an ordinary one. That is a fact about our key, not
 * about the API, and the day the founder mints an admin key this module starts
 * printing a real balance with no code change.
 *
 * Until then the line is DERIVED and says so in the word "derived", because a
 * derived figure wearing a read figure's clothes is the "collected, never
 * asserted" failure with a dollar sign on it.
 *
 * # The prices are fal's own, not ours
 *
 * `GET /v1/models/pricing?endpoint_id=…` DOES answer to our key, and it is the
 * difference between a table we maintain and a table that maintains itself
 * (law 4 — derive, never mirror). Read live on 2026-08-16 for the seven
 * endpoints this product calls:
 *
 *   openai/gpt-image-2               1        units            OPAQUE
 *   openai/gpt-image-2/edit          1        units            OPAQUE
 *   fal-ai/nano-banana-pro           0.15     images
 *   fal-ai/nano-banana-pro/edit      0.15     images
 *   fal-ai/sam-3/image               0.005    units            OPAQUE
 *   fal-ai/birefnet/v2               0.0008   compute seconds
 *   fal-ai/moondream3-preview/point  1        units            OPAQUE
 *
 * **`unit: "units"` is not dollars per call and must never be read as such.**
 * A `unit_price` of 1 "units" for GPT Image 2 would price a roll at $8 and a
 * week at four figures; the same field says 1 for a segmentation question that
 * fal's own model page prices at half a cent. So an opaque unit falls through
 * to OUR measured figure where we have one, and is declared UNPRICED where we
 * do not — a named gap, never a silent zero. (`fal-ai/sam-3/image` is the
 * happy case of that fall-through: the price is opaque in the API and
 * published as $0.005 per request on the model page, which is exactly the
 * figure `count-scan-reads-disposable.mts` had been assuming without a source.)
 *
 * # Where the calls come from
 *
 * The call census rides on the row a refine already writes
 * (`internalPrompt.census.byModel`), so a REFINE's fal calls — its render and
 * every segmentation read inside it — are counted exactly. Two things are not,
 * and both are named on the face of the reading rather than rounded away:
 *
 *   ROLLS      open a census per candidate and write it to the LOG only, so a
 *              roll's renders are counted from the candidate ROWS instead —
 *              one GPT Image 2 render per delivered attempt.
 *   FACE SCANS mint nothing at all by design (CLAUDE.md), so their ~20
 *              segmenter calls per version looked at are invisible here. This
 *              is the largest blind spot and the derived total is a FLOOR
 *              because of it.
 */
import type { Connection } from "mysql2/promise";

/** Below this, a READ balance shouts. Days of ordinary use, not weeks. */
export const FAL_LOW_BALANCE_USD = 20;

/**
 * WHAT ONE FACE SCAN ASKS OF fal — counted, not derived.
 *
 * `count-scan-reads-disposable.mts` drives the real `scanFace` through a
 * recording reader and gets **20**: twelve questions, five of them read as two
 * half-frames, one composed below-head slot costing a head read and a subject
 * matte, and one shared midline read. Every hand-derivation of this number
 * before that script was wrong, which is why the figure lives in one place and
 * carries its instrument's name.
 *
 * The describer call a scan also makes is NOT in here — different transport,
 * different price — and every reader of this constant names it separately.
 */
export const FACE_SCAN_READS_PER_VERSION = 20;

/**
 * OUR OWN MEASURED PRICES, for the endpoints whose published unit is opaque.
 *
 * Deliberately tiny, and every entry carries where it came from. This is the
 * table that has to be maintained by hand, so the rule is that nothing joins it
 * without a measurement or a published per-call figure behind it.
 */
/**
 * WHAT A REPAINT-ROAD RENDER REALLY COSTS — measured 2026-08-17, and NOT yet
 * written into the table below (fable-859 §4).
 *
 * The constant beside it, `$0.099`, was measured on 2026-07-30 over nine
 * SINGLE-REFERENCE images. A repaint carries the master plus every carried
 * crop, each PADDED TO THE FULL FRAME — so a render on that road puts two to
 * six 1024×1536 images on the wire, and the price moves with them:
 *
 *   6 renders, 2–3 references   $1.29 total   $0.215 each   (opus-634, corrected)
 *   4 renders, 5–6 references   $0.94 total   $0.235 each   (opus-635)
 *
 * **Recorded here rather than replacing the constant**, because these are not
 * the same measurement: an ordinary refine carries fewer references than either
 * bench, and swapping one wrong figure for another wrong figure would leave
 * every derived line just as confidently wrong in the other direction. What is
 * certain is the direction — **every `fal DERIVED` figure built on $0.099 is a
 * FLOOR for the repaint road, low by roughly half.**
 *
 * # AND THE ACCOUNT SETTLES LATE — read this before taking any subtraction
 *
 * Measured the same night: the balance read `$12.12` the moment a run's last
 * render returned and `$11.89` four minutes later, with nothing rendering and
 * the founder eleven hours quiet — **$0.23, one render's worth, arriving after
 * the fact.** Three readings thirty seconds apart with nothing in flight were
 * flat, so this is settlement lag rather than drift.
 *
 * Two consequences, both paid for once already:
 *
 *   1. A before/after subtraction closed AT the last render is a floor. The
 *      first court reported $1.10 and had really spent $1.29.
 *   2. A per-render subtraction is offset by about one render, so a column of
 *      per-render prices attributes each cost to the render AFTER the one that
 *      incurred it. Price a render by giving it its own settle window, or do
 *      not price it per render at all.
 *
 * (`subtract-from-the-same-reading`, one level deeper: subtract at the same
 * SETTLEMENT STATE, not merely from the same instrument.)
 */
export const FAL_REPAINT_MEASURED_2026_08_17 = {
  twoToThreeReferences: { usd: 0.215, renders: 6, source: "opus-634 court, corrected for settle lag" },
  fiveToSixReferences: { usd: 0.235, renders: 4, source: "opus-635 court, settled reading" },
  settleLagUsd: 0.23,
} as const;

export const FAL_MEASURED_USD: Record<string, { usd: number; source: string }> = {
  /* $0.8912 across 9 medium 1024×1536 images, read off the account balance
     before and after on 2026-07-30. List arithmetic said $0.084 — 18% low.
     `FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE` is the same number in the server
     tree; it is repeated rather than imported so this module stays free of the
     server's import graph, and the test pins them equal. */
  "openai/gpt-image-2": { usd: 0.099, source: "measured 2026-07-30, 9 images off the balance" },
  "openai/gpt-image-2/edit": { usd: 0.099, source: "measured 2026-07-30, 9 images off the balance" },
  /* fal's own model page: "$0.005 per request", 200 segmentations per dollar. */
  "fal-ai/sam-3/image": { usd: 0.005, source: "fal model page, $0.005 per request" },
};

/**
 * The short, closed-vocabulary half of a thrown error.
 *
 * Copied in shape from `openrouterBalance.mts` and for its reason: an error's
 * `message` is written by whoever threw it, and a provider's error text is
 * exactly where a key gets echoed back at you. These lines go into a mailbox.
 */
function transportCode(error: unknown): string {
  const direct = (error as { code?: unknown } | null)?.code;
  if (typeof direct === "string" && direct) return direct;
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof cause === "string" && cause) return cause;
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" && name ? name : "unknown";
}

export type FalBalance =
  | { ok: true; remaining: number; currency: string; low: boolean }
  | { ok: false; why: string };

/**
 * Ask fal what is left. Expected to be refused today, and the refusal is a
 * READING — it names which door is shut so the fix is one sentence long.
 */
export async function readFalBalance(
  /*
    `FAL_ADMIN_KEY` FIRST, AND IT IS A SEPARATE VARIABLE ON PURPOSE.

    The balance wants an admin key; image dispatch wants the least privilege
    that can dispatch an image. Reading the admin key out of `FAL_KEY` would
    hand every render call an account-management credential to carry — so the
    admin key lands in its own variable, this is the only reader of it, and
    `FAL_KEY` stays exactly as privileged as it is today. Falls back to
    `FAL_KEY` so the ordinary key still produces the honest 403 rather than a
    "not set" that reads like a missing feature.
  */
  key: string | undefined = process.env.FAL_ADMIN_KEY ?? process.env.FAL_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<FalBalance> {
  if (!key) return { ok: false, why: "FAL_KEY not set in this process" };
  let response: Response;
  try {
    response = await fetchImpl("https://api.fal.ai/v1/account/billing?expand=credits", {
      headers: { Authorization: `Key ${key}` },
    });
  } catch (error) {
    return { ok: false, why: `unreachable (${transportCode(error)})` };
  }
  if (response.status === 403) {
    return {
      ok: false,
      why: "HTTP 403 — the balance endpoint wants an ADMIN key; ours is an ordinary one",
    };
  }
  if (!response.ok) return { ok: false, why: `HTTP ${response.status}` };
  let body: { credits?: { current_balance?: unknown; currency?: unknown } };
  try {
    body = await response.json() as typeof body;
  } catch {
    return { ok: false, why: "unparseable response" };
  }
  const remaining = Number(body?.credits?.current_balance);
  if (!Number.isFinite(remaining)) {
    return { ok: false, why: "response carried no numeric balance" };
  }
  const currency = typeof body?.credits?.currency === "string" ? body.credits.currency : "USD";
  return { ok: true, remaining, currency, low: remaining < FAL_LOW_BALANCE_USD };
}

export type FalUnitPrice = { unitPrice: number; unit: string; currency: string };
export type FalPrices =
  | { ok: true; prices: Map<string, FalUnitPrice> }
  | { ok: false; why: string };

/**
 * fal's own price for each endpoint we call.
 *
 * Fifty ids per request is the documented ceiling; this product calls a
 * handful, so one request is the whole question.
 */
export async function readFalPrices(
  endpointIds: readonly string[],
  key: string | undefined = process.env.FAL_KEY,
  fetchImpl: typeof fetch = fetch,
): Promise<FalPrices> {
  if (!key) return { ok: false, why: "FAL_KEY not set in this process" };
  if (endpointIds.length === 0) return { ok: true, prices: new Map() };
  const query = endpointIds.map(encodeURIComponent).join(",");
  let response: Response;
  try {
    response = await fetchImpl(`https://api.fal.ai/v1/models/pricing?endpoint_id=${query}`, {
      headers: { Authorization: `Key ${key}` },
    });
  } catch (error) {
    return { ok: false, why: `unreachable (${transportCode(error)})` };
  }
  if (!response.ok) return { ok: false, why: `HTTP ${response.status}` };
  let body: { prices?: Array<Record<string, unknown>> };
  try {
    body = await response.json() as typeof body;
  } catch {
    return { ok: false, why: "unparseable response" };
  }
  if (!Array.isArray(body?.prices)) return { ok: false, why: "response carried no price list" };
  const prices = new Map<string, FalUnitPrice>();
  for (const entry of body.prices) {
    const id = entry.endpoint_id;
    const unitPrice = Number(entry.unit_price);
    if (typeof id !== "string" || !Number.isFinite(unitPrice)) continue;
    prices.set(id, {
      unitPrice,
      unit: typeof entry.unit === "string" ? entry.unit : "unknown",
      currency: typeof entry.currency === "string" ? entry.currency : "USD",
    });
  }
  return { ok: true, prices };
}

/** One model's traffic in a window, and what it cost — with whose figure. */
export type PricedModel = {
  model: string;
  calls: number;
  ms: number;
  /** Null means UNPRICED. Never zero: a gap and a free call are different. */
  usd: number | null;
  basis: "provider" | "measured" | "unpriced";
  /** Readable provenance, printed beside the number in any report. */
  note: string;
};

/**
 * Price a window's calls.
 *
 * The order is the argument: fal's own figure wins wherever fal states one in a
 * unit we can convert, our measured figure covers the opaque ones, and anything
 * left is UNPRICED and says so. Nothing is ever assumed to be free.
 */
export function priceFalCalls(
  traffic: ReadonlyArray<{ model: string; calls: number; ms: number }>,
  prices: FalPrices,
): { models: PricedModel[]; usd: number; unpriced: PricedModel[] } {
  const models: PricedModel[] = traffic.map((row) => {
    const published = prices.ok ? prices.prices.get(row.model) : undefined;
    if (published) {
      if (published.unit === "images") {
        return {
          ...row,
          usd: published.unitPrice * row.calls,
          basis: "provider" as const,
          note: `fal: $${published.unitPrice} / image × ${row.calls}`,
        };
      }
      if (published.unit === "compute seconds") {
        const seconds = row.ms / 1000;
        return {
          ...row,
          usd: published.unitPrice * seconds,
          basis: "provider" as const,
          note: `fal: $${published.unitPrice} / compute second × ${seconds.toFixed(1)} s`,
        };
      }
      /*
        AN OPAQUE UNIT IS NOT A PRICE. `unit: "units"` with `unit_price: 1` is
        what fal answers for GPT Image 2 and for a half-cent segmentation
        question alike; multiplying by it would price a single roll at $8. Fall
        through to a figure somebody actually measured.
      */
    }
    const measured = FAL_MEASURED_USD[row.model];
    if (measured) {
      return {
        ...row,
        usd: measured.usd * row.calls,
        basis: "measured" as const,
        note: `${measured.source} — $${measured.usd} × ${row.calls}`
          + (published ? ` (fal publishes an opaque "${published.unit}")` : ""),
      };
    }
    return {
      ...row,
      usd: null,
      basis: "unpriced" as const,
      note: published
        ? `UNPRICED — fal publishes an opaque "${published.unit}" and nothing has measured it`
        : "UNPRICED — fal published no price for this endpoint",
    };
  });
  const unpriced = models.filter((model) => model.usd === null);
  const usd = models.reduce((sum, model) => sum + (model.usd ?? 0), 0);
  return { models, usd, unpriced };
}

export type FalTraffic = {
  from: string;
  to: string;
  /** Refine rows in the window, and how many of them carried a census. */
  refineRows: number;
  refineRowsWithCensus: number;
  /** Roll renders, counted from the candidate rows because rolls log rather
   *  than persist their census. */
  rollRenders: number;
  models: Array<{ model: string; calls: number; ms: number }>;
};

/**
 * WHAT WENT TO FAL IN A WINDOW, off our own rows.
 *
 * Refines contribute their persisted census exactly. Rolls contribute one GPT
 * Image 2 render per candidate attempt, because their census only ever reached
 * a container log. `refineRowsWithCensus` rides beside `refineRows` for the
 * same reason `labelledCalls` rides beside `calls`: without the denominator, a
 * subset reads as the whole.
 */
export async function readFalTraffic(
  connection: Connection,
  sinceIso: string,
  untilIso: string = new Date().toISOString(),
): Promise<FalTraffic> {
  const window = [sinceIso.slice(0, 19).replace("T", " "), untilIso.slice(0, 19).replace("T", " ")];
  const [variantRows] = await connection.query<any[]>(
    `SELECT internalPrompt FROM casting_candidate_variants
      WHERE createdAt >= ? AND createdAt < ?`,
    window,
  );
  const byModel = new Map<string, { calls: number; ms: number }>();
  let withCensus = 0;
  for (const row of variantRows) {
    const payload = row.internalPrompt && typeof row.internalPrompt === "object"
      ? row.internalPrompt
      : (() => { try { return JSON.parse(String(row.internalPrompt)); } catch { return null; } })();
    const census = payload?.census;
    if (!census || typeof census.byModel !== "object" || census.byModel === null) continue;
    withCensus += 1;
    for (const [key, value] of Object.entries(census.byModel as Record<string, any>)) {
      /* `provider:model` — only fal's half belongs on a fal line. */
      if (!key.startsWith("fal:")) continue;
      const model = key.slice("fal:".length);
      const previous = byModel.get(model) ?? { calls: 0, ms: 0 };
      byModel.set(model, {
        calls: previous.calls + (Number(value?.calls) || 0),
        ms: previous.ms + (Number(value?.ms) || 0),
      });
    }
  }

  /*
    A roll's renders, from the rows. `attemptCount` is the honest multiplier —
    a candidate retried once cost two pictures — but it is 0 on rows written
    before the column was kept, and a zero there would price a delivered face
    at nothing. So it is `GREATEST(attemptCount, 1)` per candidate that got as
    far as having an image asked for.
  */
  const [rollRows] = await connection.query<any[]>(
    `SELECT COALESCE(SUM(GREATEST(attemptCount, 1)), 0) AS renders
       FROM casting_candidates
      WHERE createdAt >= ? AND createdAt < ?
        AND status NOT IN ('queued', 'cancelled')`,
    window,
  );
  const rollRenders = Number(rollRows[0]?.renders ?? 0);
  if (rollRenders > 0) {
    const previous = byModel.get("openai/gpt-image-2") ?? { calls: 0, ms: 0 };
    byModel.set("openai/gpt-image-2", { calls: previous.calls + rollRenders, ms: previous.ms });
  }

  return {
    from: sinceIso,
    to: untilIso,
    refineRows: variantRows.length,
    refineRowsWithCensus: withCensus,
    rollRenders,
    models: [...byModel].map(([model, totals]) => ({ model, ...totals }))
      .sort((a, b) => b.calls - a.calls),
  };
}

/**
 * The one line a state block or a deploy receipt prints.
 *
 * A read balance shouts when low, exactly like the OpenRouter line. A derived
 * figure says **derived**, says the window it covers, and says that it is a
 * FLOOR whenever anything in it went unpriced or unseen — because a spend
 * figure that quietly omits the face scans looks identical to one that includes
 * them, and only one of them is true.
 */
export function falLine(
  balance: FalBalance,
  derived?: { traffic: FalTraffic; priced: { models: PricedModel[]; usd: number; unpriced: PricedModel[] } },
): string {
  if (balance.ok) {
    const figure = `$${balance.remaining.toFixed(2)} ${balance.currency} remaining`;
    return balance.low
      /* Same amendment as the OpenRouter line, same day and same reason
         (founder: auto top-up is ON for BOTH providers; fable-692 §1). The
         shout stays — it is a leak detector, not only a runway gauge. */
      ? `fal *** LOW: ${figure} — below $${FAL_LOW_BALANCE_USD}. `
        + `Auto top-up covers the outage; a low balance now means money is MOVING — look at the spend. ***`
      : `fal ${figure}`;
  }
  if (!derived) return `fal UNREAD — ${balance.why}`;
  const days = Math.max(
    1,
    Math.round((Date.parse(derived.traffic.to) - Date.parse(derived.traffic.from)) / 86_400_000),
  );
  const calls = derived.traffic.models.reduce((sum, model) => sum + model.calls, 0);
  const blind = derived.traffic.refineRows - derived.traffic.refineRowsWithCensus;
  const gaps = [
    ...derived.priced.unpriced.map((model) => `${model.model} (${model.calls} calls)`),
    /*
      THE DENOMINATOR, WHENEVER IT IS NOT THE WHOLE (fable-658 §4's rule, one
      level up). Production's first reading of this line covered 4 of 21 refine
      rows, because the census only landed on the build most of the window
      predates — and every uncounted row contributes exactly nothing, so a
      figure that omitted this reads as near-complete when it is a quarter.
    */
    ...(blind > 0
      ? [`${blind} of ${derived.traffic.refineRows} refine rows carry NO census`]
      : []),
    /* Named every time, priced never: the scan mints nothing to count. The
       per-version figure comes from the constant above rather than from a
       number typed into this sentence — the same fact in two spellings is how
       one of them goes stale. */
    `face scans (mint nothing, ~${FACE_SCAN_READS_PER_VERSION} segmenter calls per version viewed)`,
  ];
  return `fal DERIVED $${derived.priced.usd.toFixed(2)} over ${days}d`
    + ` from ${calls} calls on ${derived.traffic.models.length} model(s)`
    + ` — a FLOOR, unpriced/unseen: ${gaps.join(", ")}`
    + ` · balance UNREAD (${balance.why})`;
}

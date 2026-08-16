/**
 * THE FAL SPEND LINE — and the one arithmetic mistake that would make it lie
 * by two orders of magnitude.
 *
 * The founder asked for fal to get the same rigour as OpenRouter (fable-684
 * §1). The two accounts are not symmetrical and that asymmetry is the whole
 * design: OpenRouter publishes a remainder, fal's remainder is behind an admin
 * key we do not hold, and fal's PRICE list is open to us. So the line reads
 * where it can, derives where it cannot, and — the part this suite exists for —
 * never lets those two look the same.
 *
 * Driven through the real readers with a fake `fetch`. The real network is
 * never touched and no real key is read.
 */
import { describe, expect, it, vi } from "vitest";

import {
  FAL_LOW_BALANCE_USD,
  FAL_MEASURED_USD,
  falLine,
  priceFalCalls,
  readFalBalance,
  readFalPrices,
  type FalTraffic,
} from "../scripts/lib/falSpend.mts";
import { FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "./providers/falImages";

const KEY = "NOT-A-REAL-FAL-KEY";

function respond(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
  }) as unknown as typeof fetch;
}

/** fal's real answer for our seven endpoints, read on 2026-08-16. */
const REAL_PRICES = {
  prices: [
    { endpoint_id: "openai/gpt-image-2", unit_price: 1, unit: "units", currency: "USD" },
    { endpoint_id: "openai/gpt-image-2/edit", unit_price: 1, unit: "units", currency: "USD" },
    { endpoint_id: "fal-ai/nano-banana-pro", unit_price: 0.15, unit: "images", currency: "USD" },
    { endpoint_id: "fal-ai/nano-banana-pro/edit", unit_price: 0.15, unit: "images", currency: "USD" },
    { endpoint_id: "fal-ai/sam-3/image", unit_price: 0.005, unit: "units", currency: "USD" },
    { endpoint_id: "fal-ai/birefnet/v2", unit_price: 0.0008, unit: "compute seconds", currency: "USD" },
    { endpoint_id: "fal-ai/moondream3-preview/point", unit_price: 1, unit: "units", currency: "USD" },
  ],
};

async function realPrices() {
  const prices = await readFalPrices(["openai/gpt-image-2"], KEY, respond(REAL_PRICES));
  return prices;
}

describe("the balance is asked for, and its refusal is a reading", () => {
  it("reads a balance when fal gives one", async () => {
    const balance = await readFalBalance(
      KEY,
      respond({ username: "klieg", credits: { current_balance: 24.5, currency: "USD" } }),
    );
    expect(balance).toEqual({ ok: true, remaining: 24.5, currency: "USD", low: false });
    expect(falLine(balance)).toBe("fal $24.50 USD remaining");
  });

  it("SHOUTS below the floor and names the consequence", () => {
    const line = falLine({ ok: true, remaining: 4, currency: "USD", low: true });
    expect(line).toContain("LOW");
    expect(line, "a number without its consequence is a number nobody acts on")
      .toContain("dies at dispatch");
    expect(FAL_LOW_BALANCE_USD).toBe(20);
  });

  /*
    THE ANSWER WE ACTUALLY GET TODAY, and it must not read as an outage or as a
    bug in this module. A 403 here means one specific, fixable thing — our key
    is not an admin key — and the line has to say which door is shut, or the
    next reader re-probes an endpoint that was never going to answer.
  */
  it("names the ADMIN KEY when fal refuses, rather than reporting a generic failure", async () => {
    const balance = await readFalBalance(KEY, respond({}, { status: 403 }));
    expect(balance.ok).toBe(false);
    expect(balance.ok === false && balance.why).toContain("ADMIN key");
    expect(falLine(balance)).toContain("UNREAD");
  });

  it("says UNREAD for a missing key, an unreachable host and a garbled body", async () => {
    expect(falLine(await readFalBalance(undefined, respond({})))).toContain("FAL_KEY not set");
    const threw = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "ENOTFOUND" }));
    expect(falLine(await readFalBalance(KEY, threw as unknown as typeof fetch)))
      .toContain("ENOTFOUND");
    const garbled = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new Error("nope"); },
    }) as unknown as typeof fetch;
    expect(falLine(await readFalBalance(KEY, garbled))).toContain("unparseable");
  });

  it("never lets an unreadable balance render as a comfortable number", async () => {
    const line = falLine(await readFalBalance(KEY, respond({ credits: {} })));
    expect(line).toContain("UNREAD");
    expect(line).not.toMatch(/\$\d/);
  });
});

describe("the prices come from fal, and its opaque unit is not a price", () => {
  it("reads the published list", async () => {
    const prices = await readFalPrices(
      ["fal-ai/nano-banana-pro"], KEY, respond(REAL_PRICES),
    );
    expect(prices.ok).toBe(true);
    expect(prices.ok === true && prices.prices.get("fal-ai/nano-banana-pro"))
      .toEqual({ unitPrice: 0.15, unit: "images", currency: "USD" });
  });

  it("prices a per-image endpoint off fal's own figure", async () => {
    const { models } = priceFalCalls(
      [{ model: "fal-ai/nano-banana-pro/edit", calls: 4, ms: 100_000 }],
      await realPrices(),
    );
    expect(models[0]).toMatchObject({ usd: 0.6, basis: "provider" });
  });

  it("prices a per-compute-second endpoint off the census's own milliseconds", async () => {
    const { models } = priceFalCalls(
      [{ model: "fal-ai/birefnet/v2", calls: 3, ms: 12_500 }],
      await realPrices(),
    );
    /* 12.5 s × $0.0008. The CALL COUNT is deliberately not the multiplier —
       this is the endpoint where those two answers differ. */
    expect(models[0]!.usd).toBeCloseTo(0.01, 6);
    expect(models[0]!.basis).toBe("provider");
  });

  /*
    THE TRAP THIS SUITE EXISTS FOR.

    fal answers `unit_price: 1, unit: "units"` for GPT Image 2 — an opaque
    billing unit, not a dollar. Multiplying by it prices one eight-face roll at
    $8.00 against a real ~$0.79, and a week of court work in the thousands.
    A spend line wrong by 10x in the ALARMING direction gets acted on.
  */
  it("does NOT multiply by an opaque \"units\" price — it falls through to the measured one", async () => {
    const { models, usd } = priceFalCalls(
      [{ model: "openai/gpt-image-2", calls: 8, ms: 400_000 }],
      await realPrices(),
    );
    expect(usd, "a roll of eight is ~$0.79, not $8.00").toBeCloseTo(0.792, 6);
    expect(models[0]!.basis).toBe("measured");
    expect(models[0]!.note).toContain("opaque");
  });

  /* The measured figure and the server's own constant are ONE fact. A second
     copy free to drift is law 4, and this is where it would drift silently. */
  it("carries the same measured render price the server transport does", () => {
    expect(FAL_MEASURED_USD["openai/gpt-image-2"]!.usd)
      .toBe(FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE);
    expect(FAL_MEASURED_USD["openai/gpt-image-2/edit"]!.usd)
      .toBe(FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE);
  });

  /*
    A GAP IS NOT A ZERO. An endpoint nobody has priced must arrive as `null`
    and be named, because `0` sums into a total that then looks complete.
  */
  it("declares an unpriced endpoint rather than counting it as free", async () => {
    const { models, usd, unpriced } = priceFalCalls(
      [{ model: "fal-ai/moondream3-preview/point", calls: 12, ms: 9_000 }],
      await realPrices(),
    );
    expect(models[0]!.usd).toBeNull();
    expect(usd).toBe(0);
    expect(unpriced).toHaveLength(1);
    expect(models[0]!.note).toContain("UNPRICED");
  });

  it("and an endpoint fal never listed at all is unpriced too, not assumed", async () => {
    const { models } = priceFalCalls(
      [{ model: "fal-ai/something-new", calls: 2, ms: 100 }],
      await realPrices(),
    );
    expect(models[0]!.basis).toBe("unpriced");
    expect(models[0]!.note).toContain("no price");
  });

  it("survives an unreadable price list by falling back to what we measured", async () => {
    const { models, usd } = priceFalCalls(
      [{ model: "openai/gpt-image-2/edit", calls: 10, ms: 1000 }],
      { ok: false, why: "HTTP 500" },
    );
    expect(usd).toBeCloseTo(0.99, 6);
    expect(models[0]!.basis).toBe("measured");
  });
});

describe("the derived line says derived, and says what it cannot see", () => {
  const traffic: FalTraffic = {
    from: "2026-08-09T00:00:00.000Z",
    to: "2026-08-16T00:00:00.000Z",
    refineRows: 40,
    refineRowsWithCensus: 40,
    rollRenders: 16,
    models: [
      { model: "fal-ai/sam-3/image", calls: 186, ms: 1_626_889 },
      { model: "openai/gpt-image-2/edit", calls: 40, ms: 4_318_239 },
      { model: "openai/gpt-image-2", calls: 16, ms: 0 },
      { model: "fal-ai/moondream3-preview/point", calls: 5, ms: 900 },
    ],
  };

  it("prints the word DERIVED, the window, and the FLOOR caveat", async () => {
    const priced = priceFalCalls(traffic.models, await realPrices());
    const line = falLine({ ok: false, why: "HTTP 403 — the balance endpoint wants an ADMIN key" }, { traffic, priced });
    expect(line).toContain("DERIVED");
    expect(line).toContain("over 7d");
    expect(line, "a derived figure that omits the scans looks exactly like one that includes them")
      .toContain("FLOOR");
    expect(line).toContain("face scans");
    expect(line).toContain("moondream3-preview/point (5 calls)");
    expect(line).toContain("UNREAD");
  });

  it("carries the real arithmetic", async () => {
    const priced = priceFalCalls(traffic.models, await realPrices());
    /* 186 × 0.005 + 56 × 0.099, and moondream contributing nothing but a name. */
    expect(priced.usd).toBeCloseTo(0.93 + 5.544, 6);
  });

  /*
    THE DENOMINATOR. Production's first real reading of this line covered FOUR
    of twenty-one refine rows — the census only landed on the build that most
    of the window predates — and an uncounted row contributes exactly nothing.
    Without this clause $4.52 reads as the week's fal spend when it is a
    quarter of the countable part of it.
  */
  it("names how many rows carried no census, and stays quiet when they all did", async () => {
    const priced = priceFalCalls(traffic.models, await realPrices());
    const refused = { ok: false as const, why: "HTTP 403" };
    const partial = { ...traffic, refineRows: 21, refineRowsWithCensus: 4 };
    expect(falLine(refused, { traffic: partial, priced }))
      .toContain("17 of 21 refine rows carry NO census");
    /* The negative half: a complete window must not print a nought-shaped
       caveat, or the clause becomes noise nobody reads. */
    expect(falLine(refused, { traffic, priced })).not.toContain("carry NO census");
  });

  /* A READ balance supersedes the derived line entirely: the day an admin key
     exists, the receipt should print the real remainder and not a floor. */
  it("prefers a real balance over the derived figure when both are available", async () => {
    const priced = priceFalCalls(traffic.models, await realPrices());
    const line = falLine({ ok: true, remaining: 42.5, currency: "USD", low: false }, { traffic, priced });
    expect(line).toBe("fal $42.50 USD remaining");
    expect(line).not.toContain("DERIVED");
  });
});

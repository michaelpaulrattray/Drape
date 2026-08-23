/**
 * THE PRICE ON A SPEND SURFACE COMES FROM THE SERVER — the choice, driven.
 *
 * D-15 says every paid affordance shows a cost computed server-side. The client
 * declared its OWN `CREDIT_COSTS` and three sites read it; only one of the three
 * asked the server. Found by the Atlas price list once it could show both copies
 * at once, ruled fable-1435 §1: server value first, today's literal as fallback,
 * which cannot regress because the fallback IS today's behaviour.
 *
 * The two source sites are asserted here as well as the choice function, because
 * the whole defect was a site that never asked — a pure function nobody calls
 * would be the same bug with a test on it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { servedCost } from "./castingPrices";
import { CREDIT_COSTS } from "./constants";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("the served price wins, and the literal only stands in", () => {
  it("takes the SERVER's number when the server has answered", () => {
    expect(servedCost({ castingImage: 400 }, "castingImage", 350)).toBe(400);
  });

  it("takes the local literal when the server has not answered", () => {
    /* The fallback that makes this non-regressive: a query in flight must not
       leave a spend button with no number on it. */
    expect(servedCost(undefined, "castingImage", 350)).toBe(350);
    expect(servedCost({}, "castingImage", 350)).toBe(350);
  });

  it("⚠ keeps a served ZERO, which `||` would silently replace", () => {
    /*
      `masterPrompt` is a real price and it is 0. `served?.[key] || fallback`
      reads that as absent and substitutes the literal — which is right today
      only because the literal is also 0, and would be wrong the moment either
      moved. The guard is `typeof === "number"`, and this is the arm that says so.
    */
    expect(servedCost({ masterPrompt: 0 }, "masterPrompt", 99)).toBe(0);
  });

  it("does not treat a non-numeric answer as a price", () => {
    /* NEGATIVE CONTROL: a malformed payload must fall back rather than render
       `NaN credits` or the string itself onto a spend button. */
    expect(servedCost({ castingImage: undefined }, "castingImage", 350)).toBe(350);
    expect(servedCost({ castingImage: "350" as unknown as number }, "castingImage", 350)).toBe(350);
  });
});

describe("the sites that spend actually ask", () => {
  /* The defect was never the arithmetic — it was two call sites that never
     queried. These assert the wiring, which is the part that regressed. */
  const controlPanel = readFileSync(path.join(here, "ControlPanel.tsx"), "utf8");
  const generation = readFileSync(path.join(here, "hooks", "useCastingGeneration.ts"), "utf8");

  it("⚠ the armed Cast button renders the SERVED price, not the literal", () => {
    expect(controlPanel).toContain("trpc.credits.getCosts.useQuery");
    expect(controlPanel).toContain('servedCost(costsQuery.data, "castingImage", CREDIT_COSTS.castingImage)');
    expect(controlPanel).toContain("· ~{castingImageCost} credits");
    expect(
      controlPanel,
      "the button must not print the client literal again under any spelling",
    ).not.toContain("~{CREDIT_COSTS.castingImage}");
  });

  it("⚠ the pre-flight affordability gate spends against the SERVED price", () => {
    /* This one is not visible until it is wrong: too low and it waves someone
       into a server refusal, too high and it blocks a purchase they can afford. */
    expect(generation).toContain("trpc.credits.getCosts.useQuery");
    expect(generation).toContain('servedCost(costsQuery.data, "castingImage", CREDIT_COSTS.castingImage)');
    expect(generation).toContain('servedCost(costsQuery.data, "masterPrompt", CREDIT_COSTS.masterPrompt)');
    expect(
      generation,
      "the old two-literal sum must be gone",
    ).not.toContain("CREDIT_COSTS.masterPrompt + CREDIT_COSTS.castingImage");
  });

  it("⚠ CONTROL — the literals still exist, because they are the fallback", () => {
    /* Deleting the client copy would be the OTHER failure: a spend button with
       no number while the query is in flight. It stays, as the fallback, and
       the Atlas price list shows both copies so the pair stays visible. */
    expect(CREDIT_COSTS.castingImage).toBeGreaterThan(0);
    expect(CREDIT_COSTS.masterPrompt).toBe(0);
  });
});
